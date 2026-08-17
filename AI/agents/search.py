"""
범용 검색 에이전트 (Corrective RAG)

Pinecone 검색 결과의 관련성(Relevance)을 LLM으로 검증하고, 관련 문서가
부족하면 Tavily 웹 검색으로 보강한 뒤, 생성된 답변이 근거 문서에 충실한지
(Groundedness)까지 재검증해 부실하면 재생성하는 자기 수정(Self-Correction)
파이프라인입니다. 모임 매칭 및 일반 질의응답에 사용됩니다.

흐름: retrieve → grade_documents → (필요 시 web_search) → generate
      → grade_generation → (근거 부실 시 generate로 재순환, 최대 1회)
"""

import os
import logging
from datetime import datetime
from typing import TypedDict, List

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_pinecone import PineconeVectorStore
from langchain_community.tools.tavily_search import TavilySearchResults
from langgraph.graph import StateGraph, END
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

llm = ChatOpenAI(model="gpt-4o-mini", timeout=30)
_web_search_tool = TavilySearchResults(max_results=3)

MIN_RELEVANT_DOCS = 1        # 관련 문서가 이 개수 미만이면 웹 검색으로 보강
MAX_GENERATION_RETRIES = 1   # 근거 부실 판정 시 최대 재생성 횟수 (무한 루프 방지)


def _build_retriever():
    """Pinecone 리트리버를 생성합니다. 연결 실패 시 None 반환(graceful degradation)."""
    try:
        index_name = os.getenv("PINECONE_INDEX_NAME_MEETING")
        vector_store = PineconeVectorStore.from_existing_index(
            index_name=index_name,
            embedding=OpenAIEmbeddings(model='text-embedding-3-large')
        )
        return vector_store.as_retriever(search_type="similarity", search_kwargs={'k': 4})
    except Exception as e:
        logging.warning(f"Pinecone 리트리버 초기화 실패 (내부 검색 없이 진행): {e}")
        return None


# 모듈 로드 시 한 번만 초기화 — 요청마다 Pinecone 재연결 방지
_RETRIEVER = _build_retriever()


# ─── 관련성 평가 (Relevance Grading) ─────────────────────

_grade_doc_prompt = ChatPromptTemplate.from_template(
    """당신은 검색된 문서가 사용자 질문에 관련이 있는지 평가하는 채점자입니다.
문서에 질문과 관련된 키워드나 의미가 포함되어 있다면 관련 있다고 판단하세요.
명백히 무관한 검색 결과만 걸러내면 되며, 엄격한 테스트일 필요는 없습니다.

[질문]: {question}
[문서]: {document}

이 문서가 질문에 관련이 있습니까? "yes" 또는 "no"로만 답하세요."""
)
_grade_doc_chain = _grade_doc_prompt | llm | StrOutputParser()


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=5),
    retry=retry_if_exception_type(Exception),
)
def _grade_document(question: str, document: str) -> bool:
    result = _grade_doc_chain.invoke({"question": question, "document": document})
    return "yes" in result.strip().lower()


# ─── 근거 충실성 평가 (Groundedness Grading) ─────────────

_grade_answer_prompt = ChatPromptTemplate.from_template(
    """당신은 생성된 답변을 검증하는 채점자입니다. 아래 [근거 문서]만을 사실 판단 기준으로 삼아
[답변]이 (1) 근거 문서 내용에 기반하며 문서와 모순되지 않고(hallucination 없음), (2) [질문]에
실제로 답하고 있는지 평가하세요.

[질문]: {question}
[근거 문서]: {context}
[답변]: {generation}

이 답변이 근거에 충실하고 질문에 답하고 있습니까? "yes" 또는 "no"로만 답하세요."""
)
_grade_answer_chain = _grade_answer_prompt | llm | StrOutputParser()


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=5),
    retry=retry_if_exception_type(Exception),
)
def _grade_generation(question: str, context: str, generation: str) -> bool:
    if not context.strip():
        # 근거 문서가 전혀 없으면(순수 일반 지식 답변) 근거성 평가 대상이 아님
        return True
    result = _grade_answer_chain.invoke(
        {"question": question, "context": context, "generation": generation}
    )
    return "yes" in result.strip().lower()


# ─── 답변 생성 ─────────────────────────────────────────────

_generate_prompt = ChatPromptTemplate.from_template(
    """당신은 AI 어시스턴트 'MOIT'입니다. 오늘은 {today}입니다.
아래 [참고 자료]를 우선적으로 활용하여 [질문]에 답변하세요. 참고 자료에 없는 내용은
일반 지식으로 보완하되, 참고 자료와 모순되는 답은 하지 마세요.

[참고 자료]
{context}

[질문]
{question}"""
)
_generate_chain = _generate_prompt | llm | StrOutputParser()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    before_sleep=lambda rs: logging.warning(
        f"답변 생성 실패 — {rs.attempt_number}회 재시도 중... ({rs.outcome.exception()})"
    )
)
def _generate_answer(question: str, context: str) -> str:
    today = datetime.now().strftime("%Y년 %m월 %d일")
    return _generate_chain.invoke({"question": question, "context": context, "today": today})


# ─── LangGraph 상태 및 노드 ────────────────────────────────

class SearchState(TypedDict):
    question: str
    documents: List[str]
    generation: str
    retry_count: int


def retrieve_node(state: SearchState) -> dict:
    """Pinecone에서 관련 문서를 검색합니다."""
    logging.info("--- RETRIEVE: Pinecone 내부 검색 ---")
    if _RETRIEVER is None:
        return {"documents": []}
    docs = _RETRIEVER.invoke(state["question"])
    return {"documents": [d.page_content for d in docs]}


def grade_documents_node(state: SearchState) -> dict:
    """검색된 문서의 관련성을 LLM으로 평가해 무관한 문서를 걸러냅니다 (Relevance Check)."""
    logging.info("--- GRADE: 검색 문서 관련성 평가 ---")
    question = state["question"]
    relevant = []
    for doc in state["documents"]:
        try:
            if _grade_document(question, doc):
                relevant.append(doc)
        except Exception as e:
            logging.warning(f"문서 채점 실패 — 해당 문서 제외: {e}")
    logging.info(f"관련 문서 {len(relevant)}/{len(state['documents'])}건 통과")
    return {"documents": relevant}


def web_search_node(state: SearchState) -> dict:
    """내부 검색 결과가 부실할 때 Tavily 웹 검색으로 보강합니다 (Self-Correction)."""
    logging.info("--- WEB SEARCH: 내부 검색 부실 — 웹 검색으로 보강 ---")
    try:
        results = _web_search_tool.invoke({"query": state["question"]})
        snippets = [r.get("content", "") for r in results] if isinstance(results, list) else [str(results)]
    except Exception as e:
        logging.warning(f"웹 검색 실패: {e}")
        snippets = []
    return {"documents": state["documents"] + snippets}


def generate_node(state: SearchState) -> dict:
    """참고 자료를 바탕으로 답변을 생성합니다."""
    logging.info("--- GENERATE: 답변 생성 ---")
    context = "\n\n".join(state["documents"])
    try:
        answer = _generate_answer(state["question"], context)
    except Exception as e:
        logging.error(f"답변 생성 최종 실패: {e}")
        answer = "오류가 발생하여 답변할 수 없습니다."
    return {"generation": answer, "retry_count": state.get("retry_count", 0) + 1}


def decide_after_grading(state: SearchState) -> str:
    """관련 문서가 부족하면 웹 검색으로, 충분하면 바로 생성으로 분기합니다."""
    if len(state["documents"]) < MIN_RELEVANT_DOCS:
        return "web_search"
    return "generate"


def decide_after_generation(state: SearchState) -> str:
    """답변의 근거 충실성을 평가해 부실하면 재생성, 충분하거나 재시도 한도 도달 시 종료합니다."""
    logging.info("--- GRADE: 답변 근거 충실성(Groundedness) 평가 ---")
    context = "\n\n".join(state["documents"])
    try:
        grounded = _grade_generation(state["question"], context, state["generation"])
    except Exception as e:
        logging.warning(f"답변 채점 실패 — 재시도 없이 진행: {e}")
        grounded = True

    if grounded or state["retry_count"] > MAX_GENERATION_RETRIES:
        return "end"
    logging.info("답변이 근거에 부실함 — 재생성")
    return "generate"


# ─── 그래프 조립 ────────────────────────────────────────────

_search_builder = StateGraph(SearchState)
_search_builder.add_node("retrieve", retrieve_node)
_search_builder.add_node("grade_documents", grade_documents_node)
_search_builder.add_node("web_search", web_search_node)
_search_builder.add_node("generate", generate_node)

_search_builder.set_entry_point("retrieve")
_search_builder.add_edge("retrieve", "grade_documents")
_search_builder.add_conditional_edges("grade_documents", decide_after_grading, {
    "web_search": "web_search",
    "generate": "generate",
})
_search_builder.add_edge("web_search", "generate")
_search_builder.add_conditional_edges("generate", decide_after_generation, {
    "generate": "generate",
    "end": END,
})

search_graph = _search_builder.compile()


# ─── 마스터 에이전트에서 호출하는 진입 함수 ────────────────

def call_general_search_agent(state: dict) -> dict:
    """Corrective RAG 파이프라인 — 검색 → 관련성 평가 → (필요 시) 웹 검색 보강 → 생성 → 근거성 재검증."""
    logging.info("--- CALLING: General Search Agent (Corrective RAG) ---")

    # user_input 정규화
    user_input = state['user_input']
    try:
        if isinstance(user_input, dict):
            if 'messages' in user_input:
                query = user_input['messages'][0][1]
            elif 'title' in user_input:
                query = user_input['title']
            else:
                query = str(user_input)
        else:
            query = str(user_input)
    except Exception:
        query = str(user_input)

    try:
        result = search_graph.invoke({
            "question": query,
            "documents": [],
            "generation": "",
            "retry_count": 0,
        })
        answer = result.get("generation") or "죄송합니다. 답변을 생성하지 못했습니다."
    except Exception as e:
        logging.error(f"검색 파이프라인 실행 최종 실패: {e}")
        answer = "오류가 발생하여 답변할 수 없습니다."

    return {"final_answer": answer}


def call_meeting_matching_agent(state: dict) -> dict:
    """모임 매칭 요청 — 범용 검색 에이전트를 재사용합니다."""
    logging.info("--- CALLING: Meeting Matching Agent ---")
    return call_general_search_agent(state)
