# main_V3.py (main_tea.py 기반 + StateGraph 취미 추천 에이전트 이식)

# --- 1. 기본 라이브러리 import ---
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import requests
import json
from datetime import datetime
from typing import List, TypedDict, Optional
import logging
from fastapi.middleware.cors import CORSMiddleware

# --- 2. 로깅 기본 설정 ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s:     %(message)s')

# --- 3. LangChain, LangGraph 및 AI 관련 라이브러리 import ---
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import chain
from langchain_pinecone import PineconeVectorStore
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langgraph.graph import StateGraph, END
from langchain_core.tools import tool
from tenacity import retry, stop_after_attempt, wait_fixed
from utils.survey import convert_raw_answers
import google.generativeai as genai
from requests.exceptions import Timeout, ConnectionError
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain.tools.retriever import create_retriever_tool
from langchain_core.documents import Document

# --- 4. 환경 설정 및 FastAPI 앱 초기화 ---
load_dotenv()
app = FastAPI(
    title="MOIT AI Agent Server v3 (StateGraph 이식)",
    description="main_tea.py 기반 위에 StateGraph 취미 추천 에이전트를 이식한 버전",
    version="3.0.0",
)

# --- CORS 미들웨어 추가 ---
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AI 모델 및 API 키 설정 ---
try:
    gemini_api_key = os.getenv("GOOGLE_API_KEY")
    if gemini_api_key:
        genai.configure(api_key=gemini_api_key)
    else:
        logging.warning("GOOGLE_API_KEY가 .env 파일에 설정되지 않았습니다. 사진 분석 기능이 작동하지 않을 수 있습니다.")
except Exception as e:
    logging.warning(f"Gemini API 키 설정 실패: {e}")

llm = ChatOpenAI(model="gpt-4o-mini")


# --- 5. 마스터 에이전트 로직 전체 정의 ---

class MasterAgentState(TypedDict):
    user_input: dict
    route: str
    final_answer: str

# 라우터 정의
router_prompt = ChatPromptTemplate.from_template(
    """당신은 사용자의 요청을 분석하여 어떤 담당자에게 전달해야 할지 결정하는 AI 라우터입니다.
    사용자의 요청을 보고, 아래 세 가지 경로 중 가장 적절한 경로 하나만 골라 그 이름만 정확히 답변해주세요.
    (meeting_matching, hobby_recommendation, general_search 중 택1)
 
    [사용자 요청]:
    {user_input}
    """
)
router_chain = router_prompt | llm | StrOutputParser()

def route_request(state: MasterAgentState):
    logging.info("--- ROUTING ---")
    user_input = state['user_input']
    
    if isinstance(user_input, dict) and ('survey' in user_input or 'survey_raw' in user_input):
        logging.info("라우팅 결정: hobby_recommendation (Rule-based)")
        return {"route": "hobby_recommendation"}

    try:
        route_decision = router_chain.invoke({"user_input": user_input})
        cleaned_decision = route_decision.strip().lower().replace("'", "").replace('"', '')
    except Exception as e:
        logging.error(f"라우팅 중 오류: {e}")
        cleaned_decision = "general_search" 
        
    logging.info(f"라우팅 결정: {cleaned_decision}")
    return {"route": cleaned_decision}

@tool
def get_current_date() -> str:
    """오늘 날짜를 'YYYY년 MM월 DD일' 형식의 문자열로 반환합니다."""
    return datetime.now().strftime("%Y년 %m월 %d일")

# 범용 검색 에이전트
def call_general_search_agent(state: MasterAgentState):
    logging.info("--- CALLING: General Search Agent ---")

    tavily_tool = TavilySearchResults(max_results=3, name="web_search")
    
    # Pinecone 검색 도구
    try:
        meeting_index_name = os.getenv("PINECONE_INDEX_NAME_MEETING")
        embedding_function = OpenAIEmbeddings(model='text-embedding-3-large')
        vector_store = PineconeVectorStore.from_existing_index(index_name=meeting_index_name, embedding=embedding_function)
        retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={'k': 3})
        moit_meeting_retriever_tool = create_retriever_tool(
            retriever,
            "moit_internal_meeting_search",
            "MOIT 서비스 내에 등록된 기존 모임 정보를 검색합니다."
        )
    except Exception as e:
        logging.warning(f"Pinecone 도구 설정 실패 (이 도구 없이 진행): {e}")
        moit_meeting_retriever_tool = None

    tools = [tavily_tool, get_current_date]
    if moit_meeting_retriever_tool:
        tools.append(moit_meeting_retriever_tool)

    react_prompt = ChatPromptTemplate.from_messages([
        ("system", "당신은 AI 어시스턴트 'MOIT'입니다. 주어진 도구를 활용해 답변하세요."),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad")
    ])
    
    agent = create_openai_tools_agent(llm, tools, react_prompt)
    general_agent_runnable = AgentExecutor(agent=agent, tools=tools, verbose=True)

    try:
        user_question = state['user_input']
        if isinstance(user_question, dict):
            if 'messages' in user_question:
                user_question = user_question['messages'][0][1]
            elif 'title' in user_question:
                user_question = user_question['title']
            else:
                user_question = str(user_question)
    except:
        user_question = str(state['user_input'])

    input_data = {"input": str(user_question), "chat_history": []}
    
    try:
        result = general_agent_runnable.invoke(input_data)
        final_answer = result.get("output", "죄송합니다. 답변을 생성하지 못했습니다.")
    except Exception as e:
        logging.error(f"에이전트 실행 중 오류: {e}")
        final_answer = "오류가 발생하여 답변할 수 없습니다."
        
    return {"final_answer": final_answer}

# 모임 매칭 에이전트
def call_meeting_matching_agent(state: MasterAgentState):
    logging.info("--- CALLING: Meeting Matching Agent ---")
    return call_general_search_agent(state)


# --- 취미 추천 에이전트 ---

def normalize(value, min_val, max_val):
    if value is None: return None
    return round((value - min_val) / (max_val - min_val), 4)

def generate_prompt(profile):
    def get_val(val, format_str="{:.2f}"):
        if val is None: return "N/A"
        if format_str: return format_str.format(val)
        return val

    fsc = profile.get('FSC', {})
    pssr = profile.get('PSSR', {})
    mp = profile.get('MP', {})
    dls = profile.get('DLS', {})
    ip = profile.get('IP', {}) 

    fsc_summary = (f"* **현실적 제약**: 시간({get_val(fsc.get('time_availability'))}), 예산({get_val(fsc.get('financial_budget'))}), 에너지({get_val(fsc.get('energy_level'))}), 이동성({get_val(fsc.get('mobility'))}) / 선호공간: {get_val(fsc.get('preferred_space'), format_str=None)}")
    pssr_summary = (f"* **심리적 상태**: 사회적 불안({get_val(pssr.get('social_anxiety_score'))}), 현재 고립 수준({get_val(pssr.get('isolation_level'))}) (0:고립, 1:활발)")
    mp_summary = (f"* **주요 동기**: 핵심 목표는 '{get_val(mp.get('core_motivation'), format_str=None)}' 입니다.")
    dls_summary = (f"* **사회성 선호**: '{get_val(dls.get('preferred_sociality_type'), format_str=None)}' 활동을 선호합니다.")
    ip_summary = (f"* **관심사 프로필**: 자연({get_val(ip.get('nature_interest'))}), 창작({get_val(ip.get('craft_interest'))}), 지적({get_val(ip.get('intellect_interest'))}), 예술({get_val(ip.get('art_interest'))}), 신체({get_val(ip.get('activity_interest'))})")

    hard_constraints = "\n# ★★★ 금지 규칙 (Hard Constraints) ★★★\n"
    if ip.get('nature_interest', 0.5) < 0.3: hard_constraints += "- '자연' 관련 활동 금지\n"
    if ip.get('craft_interest', 0.5) < 0.3: hard_constraints += "- '만들기' 관련 활동 금지\n"
    if ip.get('intellect_interest', 0.5) < 0.3: hard_constraints += "- '공부/독서' 관련 활동 금지\n"
    if ip.get('art_interest', 0.5) < 0.3: hard_constraints += "- '예술' 관련 활동 금지\n"
    if ip.get('activity_interest', 0.5) < 0.3: hard_constraints += "- '신체 활동' 금지\n"

    prompt = f"""# 페르소나: 디지털 치료 레크리에이션 전문가
    사용자의 프로필을 분석하여 맞춤형 취미 3가지를 추천해주세요.
    
    [사용자 프로필]
    {fsc_summary}
    {pssr_summary}
    {mp_summary}
    {dls_summary}
    {ip_summary}
    {hard_constraints}

    [결과 형식]
    반드시 아래 JSON 형식으로만 출력하세요.
    {{
        "summary": "사용자 분석 요약 (친절한 말투)",
        "recommendations": [
            {{ 
                "name_ko": "취미이름", 
                "short_desc": "한줄설명", 
                "reason": "추천이유", 
                "score_total": 95,
                "category": "카테고리"
            }},
            ... (3개)
        ]
    }}
    """
    return prompt

@tool
def analyze_survey_tool(survey_json_string: str) -> dict:
    """설문 응답 JSON 문자열을 분석하여 사용자의 성향 프로필을 반환합니다."""
    logging.info("--- 📊 설문 분석 시작 ---")
    try:
        responses = json.loads(survey_json_string)
        
        features = {'FSC': {}, 'PSSR': {}, 'MP': {}, 'DLS': {}, 'IP': {}}
        
        def to_int(q_num_str):
            val = responses.get(q_num_str)
            return int(val) if val is not None else None

        features['FSC']['time_availability'] = normalize(to_int('1'), 1, 4)
        features['FSC']['financial_budget'] = normalize(to_int('2'), 1, 4)
        features['FSC']['energy_level'] = normalize(to_int('3'), 1, 5)
        features['FSC']['mobility'] = normalize(to_int('4'), 1, 5)
        features['FSC']['has_physical_constraints'] = True if to_int('5') in [1, 2, 3] else False
        features['FSC']['has_housing_constraints'] = True if to_int('12') in [2, 3, 4] else False
        features['FSC']['preferred_space'] = 'indoor' if to_int('6') == 1 else 'outdoor'

        q13 = to_int('13') or 3; q14_r = 6 - (to_int('14') or 3); q16 = to_int('16') or 3
        self_criticism_raw = (q13 + q14_r + q16) / 3
        features['PSSR']['self_criticism_score'] = normalize(self_criticism_raw, 1, 5)
        q15 = to_int('15') or 3; q18 = to_int('18') or 3; q20 = to_int('20') or 3
        social_anxiety_raw = (q15 + q18 + q20) / 3
        features['PSSR']['social_anxiety_score'] = normalize(social_anxiety_raw, 1, 5)
        features['PSSR']['isolation_level'] = normalize(to_int('21'), 1, 5)
        features['PSSR']['structure_preference_score'] = normalize(to_int('27'), 1, 5)
        features['PSSR']['avoidant_coping_score'] = normalize(to_int('29'), 1, 5)

        motivation_map = {1: '성취', 2: '회복', 3: '연결', 4: '활력'}
        features['MP']['core_motivation'] = motivation_map.get(to_int('31'))
        
        sociality_map = {1: '단독형', 2: '병렬형', 3: '저강도 상호작용형', 4: '고강도 상호작용형'}
        features['DLS']['preferred_sociality_type'] = sociality_map.get(to_int('39'))
        
        features['IP']['nature_interest'] = normalize(to_int('43'), 1, 5)
        features['IP']['craft_interest'] = normalize(to_int('44'), 1, 5)
        features['IP']['intellect_interest'] = normalize(to_int('45'), 1, 5)
        features['IP']['art_interest'] = normalize(to_int('46'), 1, 5)
        features['IP']['activity_interest'] = normalize(to_int('47'), 1, 5)
        
        return features
    except Exception as e:
        logging.error(f"설문 분석 오류: {e}")
        return {}

@tool
def analyze_photo_tool(image_paths: list[str], survey_profile: dict) -> str:
    """사용자의 사진과 설문 프로필을 바탕으로 맞춤형 취미를 추천합니다."""
    from PIL import Image
    logging.info(f"--- 📸 사진 분석 및 추천 생성 시작 ---")
    
    try:
        prompt_text = generate_prompt(survey_profile)
    except:
        prompt_text = "사용자에게 알맞은 취미를 추천해주세요."

    image_parts = []
    if image_paths:
        for path in image_paths:
            try:
                img = Image.open(path)
                image_parts.append(img)
            except Exception as e:
                logging.warning(f"이미지 로드 실패: {path} - {e}")

    try:
        # [핵심 수정] 404 에러가 발생했던 모델 대신, 현재 가장 안정적인 최신 모델 사용
        model = genai.GenerativeModel('gemini-2.5-flash') 
        response = model.generate_content([prompt_text] + image_parts) 
        logging.info("--- ✅ Gemini 응답 완료 ---")
        return response.text
    except Exception as e:
        logging.error(f"Gemini 호출 오류: {e}")
        return json.dumps({
            "summary": "죄송합니다. AI 모델 연결에 일시적인 문제가 발생했습니다. API 키와 모델 접근 권한을 확인해 주세요.",
            "recommendations": []
        }, ensure_ascii=False)

class HobbyAgentState(TypedDict):
    survey_data: dict
    image_paths: List[str]
    survey_profile: dict
    final_recommendation: str

def analyze_survey_node(state: HobbyAgentState):
    survey_json_string = json.dumps(state["survey_data"], ensure_ascii=False)
    survey_profile = analyze_survey_tool.invoke({"survey_json_string": survey_json_string})
    return {"survey_profile": survey_profile}

def analyze_photo_node(state: HobbyAgentState):
    result = analyze_photo_tool.invoke({
        "image_paths": state.get("image_paths", []),
        "survey_profile": state.get("survey_profile", {})
    })
    return {"final_recommendation": result}

hobby_builder = StateGraph(HobbyAgentState)
hobby_builder.add_node("analyze_survey", analyze_survey_node)
hobby_builder.add_node("analyze_photo", analyze_photo_node) 
hobby_builder.set_entry_point("analyze_survey")
hobby_builder.add_edge("analyze_survey", "analyze_photo") 
hobby_builder.add_edge("analyze_photo", END) 
hobby_graph = hobby_builder.compile()

def call_multimodal_hobby_agent(state: MasterAgentState):
    logging.info("--- CALLING: Hobby Agent ---")
    user_input = state['user_input']

    # survey_raw: 프론트엔드 원본 응답 → AI 서버에서 변환
    # survey: 이미 변환된 숫자 인덱스 (하위 호환)
    if 'survey_raw' in user_input:
        survey_data = convert_raw_answers(user_input['survey_raw'])
        logging.info("설문 원본 응답을 AI 서버에서 변환 완료")
    else:
        survey_data = user_input.get('survey', {})
        if isinstance(survey_data, str):
            try:
                survey_data = json.loads(survey_data)
            except:
                pass

    inputs = {"survey_data": survey_data, "image_paths": []}
    result = hobby_graph.invoke(inputs)
    return {"final_answer": result.get('final_recommendation', "")}

master_builder = StateGraph(MasterAgentState)

master_builder.add_node("router", route_request)
master_builder.add_node("hobby_recommender", call_multimodal_hobby_agent)
master_builder.add_node("general_searcher", call_general_search_agent)

master_builder.set_entry_point("router")
master_builder.add_conditional_edges("router", lambda x: x['route'], {
    "hobby_recommendation": "hobby_recommender",
    "general_search": "general_searcher",
    "meeting_matching": "general_searcher" 
})
master_builder.add_edge("hobby_recommender", END)
master_builder.add_edge("general_searcher", END)
master_agent = master_builder.compile()

class UserRequest(BaseModel):
    user_input: dict

@app.post("/agent/invoke")
async def invoke_agent(request: UserRequest):
    try:
        result = master_agent.invoke({"user_input": request.user_input})
        return {"final_answer": result.get("final_answer", "")}
    except Exception as e:
        logging.error(f"API 처리 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class NewMeeting(BaseModel):
    meeting_id: str
    title: str
    description: str
    time: str
    location: str

@app.post("/meetings/add")
async def add_meeting_to_pinecone(meeting: NewMeeting):
    try:
        logging.info(f"--- Pinecone에 새로운 모임 추가 시작 (ID: {meeting.meeting_id}) ---")
        meeting_index_name = os.getenv("PINECONE_INDEX_NAME_MEETING")
        if not meeting_index_name: raise ValueError("'.env' 파일에 PINECONE_INDEX_NAME_MEETING이(가) 설정되지 않았습니다.")
        
        embedding_function = OpenAIEmbeddings(model='text-embedding-3-large')
        vector_store = PineconeVectorStore.from_existing_index(index_name=meeting_index_name, embedding=embedding_function)
        
        full_text = f"제목: {meeting.title}\n설명: {meeting.description}\n시간: {meeting.time}\n장소: {meeting.location}"
        metadata = {
            "title": meeting.title, 
            "description": meeting.description, 
            "time": meeting.time, 
            "location": meeting.location,
            "meeting_id": meeting.meeting_id 
        }
        
        vector_store.add_texts(texts=[full_text], metadatas=[metadata], ids=[meeting.meeting_id])
        
        logging.info(f"--- Pinecone에 모임 추가 성공 (ID: {meeting.meeting_id}) ---")
        return {"status": "success", "message": f"모임(ID: {meeting.meeting_id})이 성공적으로 추가되었습니다."}
    except Exception as e:
        logging.error(f"Pinecone 업데이트 중 오류 발생: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pinecone에 모임을 추가하는 중 오류가 발생했습니다: {str(e)}")

@app.delete("/meetings/delete/{meeting_id}")
async def delete_meeting_from_pinecone(meeting_id: str):
    try:
        logging.info(f"--- Pinecone에서 모임 삭제 시작 (ID: {meeting_id}) ---")
        meeting_index_name = os.getenv("PINECONE_INDEX_NAME_MEETING")
        if not meeting_index_name: raise ValueError("'.env' 파일에 PINECONE_INDEX_NAME_MEETING이(가) 설정되지 않았습니다.")
        
        embedding_function = OpenAIEmbeddings(model='text-embedding-3-large')
        vector_store = PineconeVectorStore.from_existing_index(index_name=meeting_index_name, embedding=embedding_function)
        
        vector_store.delete(ids=[meeting_id])
        
        logging.info(f"--- Pinecone에서 모임 삭제 성공 (ID: {meeting_id}) ---")
        return {"status": "success", "message": f"모임(ID: {meeting.meeting_id})이 성공적으로 삭제되었습니다."}
    except Exception as e:
        logging.error(f"Pinecone 삭제 중 오류 발생: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pinecone에서 모임을 삭제하는 중 오류가 발생했습니다.: {str(e)}")

# --- 7. (추가) 서버 실행 ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)