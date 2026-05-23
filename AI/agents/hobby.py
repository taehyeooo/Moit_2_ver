"""
취미 추천 에이전트

설문 49문항 → 5차원 심리 프로파일 정규화 → Gemini 멀티모달 분석 → 취미 3개 JSON 반환
"""

import json
import logging
from typing import List, TypedDict

from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
import google.generativeai as genai

from utils.survey import convert_raw_answers

# Gemini 초기화
import os
from dotenv import load_dotenv
load_dotenv()

try:
    gemini_api_key = os.getenv("GOOGLE_API_KEY")
    if gemini_api_key:
        genai.configure(api_key=gemini_api_key)
    else:
        logging.warning("GOOGLE_API_KEY 미설정 — 사진 분석 기능 비활성화")
except Exception as e:
    logging.warning(f"Gemini 초기화 실패: {e}")


# ─── 프로파일 정규화 ──────────────────────────────────────

def normalize(value, min_val, max_val):
    if value is None:
        return None
    return round((value - min_val) / (max_val - min_val), 4)


def generate_prompt(profile: dict) -> str:
    """5차원 프로파일을 Gemini 프롬프트 문자열로 변환합니다."""
    def get_val(val, fmt="{:.2f}"):
        if val is None:
            return "N/A"
        return fmt.format(val) if fmt else val

    fsc  = profile.get('FSC',  {})
    pssr = profile.get('PSSR', {})
    mp   = profile.get('MP',   {})
    dls  = profile.get('DLS',  {})
    ip   = profile.get('IP',   {})

    hard_constraints = "\n# ★★★ 금지 규칙 (Hard Constraints) ★★★\n"
    if ip.get('nature_interest',   0.5) < 0.3: hard_constraints += "- '자연' 관련 활동 금지\n"
    if ip.get('craft_interest',    0.5) < 0.3: hard_constraints += "- '만들기' 관련 활동 금지\n"
    if ip.get('intellect_interest',0.5) < 0.3: hard_constraints += "- '공부/독서' 관련 활동 금지\n"
    if ip.get('art_interest',      0.5) < 0.3: hard_constraints += "- '예술' 관련 활동 금지\n"
    if ip.get('activity_interest', 0.5) < 0.3: hard_constraints += "- '신체 활동' 금지\n"

    return f"""# 페르소나: 디지털 치료 레크리에이션 전문가
사용자의 프로필을 분석하여 맞춤형 취미 3가지를 추천해주세요.

[사용자 프로필]
* 현실적 제약(FSC): 시간({get_val(fsc.get('time_availability'))}), 예산({get_val(fsc.get('financial_budget'))}), 에너지({get_val(fsc.get('energy_level'))}), 이동성({get_val(fsc.get('mobility'))})
* 심리적 상태(PSSR): 사회 불안({get_val(pssr.get('social_anxiety_score'))}), 고립 수준({get_val(pssr.get('isolation_level'))})
* 핵심 동기(MP): {get_val(mp.get('core_motivation'), fmt=None)}
* 사회성 선호(DLS): {get_val(dls.get('preferred_sociality_type'), fmt=None)}
* 관심사(IP): 자연({get_val(ip.get('nature_interest'))}), 창작({get_val(ip.get('craft_interest'))}), 지적({get_val(ip.get('intellect_interest'))}), 예술({get_val(ip.get('art_interest'))}), 신체({get_val(ip.get('activity_interest'))})
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
        }}
    ]
}}"""


# ─── 설문 분석 Tool ──────────────────────────────────────

@tool
def analyze_survey_tool(survey_json_string: str) -> dict:
    """설문 응답 JSON 문자열을 분석하여 5차원 심리 프로파일을 반환합니다."""
    logging.info("--- 설문 분석 시작 ---")
    try:
        responses = json.loads(survey_json_string)
        f = {'FSC': {}, 'PSSR': {}, 'MP': {}, 'DLS': {}, 'IP': {}}

        def to_int(key):
            val = responses.get(key)
            return int(val) if val is not None else None

        # FSC — 현실적 제약
        f['FSC']['time_availability']     = normalize(to_int('1'), 1, 4)
        f['FSC']['financial_budget']      = normalize(to_int('2'), 1, 4)
        f['FSC']['energy_level']          = normalize(to_int('3'), 1, 5)
        f['FSC']['mobility']              = normalize(to_int('4'), 1, 5)
        f['FSC']['has_physical_constraints'] = to_int('5') in [1, 2, 3]
        f['FSC']['has_housing_constraints']  = to_int('12') in [2, 3, 4]
        f['FSC']['preferred_space']       = 'indoor' if to_int('6') == 1 else 'outdoor'

        # PSSR — 심리적 상태
        q13 = to_int('13') or 3
        q14_r = 6 - (to_int('14') or 3)
        q16 = to_int('16') or 3
        f['PSSR']['self_criticism_score'] = normalize((q13 + q14_r + q16) / 3, 1, 5)
        q15 = to_int('15') or 3
        q18 = to_int('18') or 3
        q20 = to_int('20') or 3
        f['PSSR']['social_anxiety_score'] = normalize((q15 + q18 + q20) / 3, 1, 5)
        f['PSSR']['isolation_level']           = normalize(to_int('21'), 1, 5)
        f['PSSR']['structure_preference_score']= normalize(to_int('27'), 1, 5)
        f['PSSR']['avoidant_coping_score']     = normalize(to_int('29'), 1, 5)

        # MP — 핵심 동기
        motivation_map = {1: '성취', 2: '회복', 3: '연결', 4: '활력'}
        f['MP']['core_motivation'] = motivation_map.get(to_int('31'))

        # DLS — 사회성 선호
        sociality_map = {1: '단독형', 2: '병렬형', 3: '저강도 상호작용형', 4: '고강도 상호작용형'}
        f['DLS']['preferred_sociality_type'] = sociality_map.get(to_int('39'))

        # IP — 관심사
        f['IP']['nature_interest']    = normalize(to_int('43'), 1, 5)
        f['IP']['craft_interest']     = normalize(to_int('44'), 1, 5)
        f['IP']['intellect_interest'] = normalize(to_int('45'), 1, 5)
        f['IP']['art_interest']       = normalize(to_int('46'), 1, 5)
        f['IP']['activity_interest']  = normalize(to_int('47'), 1, 5)

        return f
    except Exception as e:
        logging.error(f"설문 분석 오류: {e}")
        return {}


# ─── 사진 분석 Tool ──────────────────────────────────────

@tool
def analyze_photo_tool(image_paths: list[str], survey_profile: dict) -> str:
    """사용자 사진과 설문 프로파일을 바탕으로 Gemini가 취미를 추천합니다."""
    from PIL import Image
    logging.info("--- 사진 분석 및 추천 생성 시작 ---")

    try:
        prompt_text = generate_prompt(survey_profile)
    except Exception:
        prompt_text = "사용자에게 알맞은 취미를 추천해주세요."

    image_parts = []
    for path in (image_paths or []):
        try:
            image_parts.append(Image.open(path))
        except Exception as e:
            logging.warning(f"이미지 로드 실패: {path} — {e}")

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content([prompt_text] + image_parts)
        logging.info("--- Gemini 응답 완료 ---")
        return response.text
    except Exception as e:
        logging.error(f"Gemini 호출 오류: {e}")
        return json.dumps({
            "summary": "AI 모델 연결에 일시적인 문제가 발생했습니다. API 키와 접근 권한을 확인해주세요.",
            "recommendations": []
        }, ensure_ascii=False)


# ─── HobbyAgent SubGraph ─────────────────────────────────

class HobbyAgentState(TypedDict):
    survey_data: dict
    image_paths: List[str]
    survey_profile: dict
    final_recommendation: str


def analyze_survey_node(state: HobbyAgentState):
    survey_json = json.dumps(state["survey_data"], ensure_ascii=False)
    profile = analyze_survey_tool.invoke({"survey_json_string": survey_json})
    return {"survey_profile": profile}


def analyze_photo_node(state: HobbyAgentState):
    result = analyze_photo_tool.invoke({
        "image_paths": state.get("image_paths", []),
        "survey_profile": state.get("survey_profile", {})
    })
    return {"final_recommendation": result}


_hobby_builder = StateGraph(HobbyAgentState)
_hobby_builder.add_node("analyze_survey", analyze_survey_node)
_hobby_builder.add_node("analyze_photo",  analyze_photo_node)
_hobby_builder.set_entry_point("analyze_survey")
_hobby_builder.add_edge("analyze_survey", "analyze_photo")
_hobby_builder.add_edge("analyze_photo",  END)
hobby_graph = _hobby_builder.compile()


# ─── 마스터 에이전트에서 호출하는 진입 함수 ──────────────

def call_multimodal_hobby_agent(state: dict) -> dict:
    logging.info("--- CALLING: Hobby Agent ---")
    user_input  = state['user_input']

    # survey_raw: 원본 응답 → 변환 / survey: 이미 변환된 데이터
    if 'survey_raw' in user_input:
        survey_data = convert_raw_answers(user_input['survey_raw'])
    else:
        survey_data = user_input.get('survey', {})
        if isinstance(survey_data, str):
            try:
                survey_data = json.loads(survey_data)
            except Exception:
                pass

    result = hobby_graph.invoke({"survey_data": survey_data, "image_paths": []})
    return {"final_answer": result.get('final_recommendation', "")}
