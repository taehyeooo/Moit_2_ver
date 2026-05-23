"""
마스터 에이전트

단일 진입점으로 들어온 요청을 GPT-4o-mini가 의도를 분류하고
취미 추천 / 범용 검색 에이전트로 분기하는 StateGraph입니다.

분기 규칙:
- survey / survey_raw 키 포함 → hobby_recommendation (룰 기반, LLM 호출 없음)
- 그 외 → LLM이 meeting_matching / general_search 중 선택
"""

import logging
from typing import TypedDict

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, END

from agents.hobby import call_multimodal_hobby_agent
from agents.search import call_general_search_agent

llm = ChatOpenAI(model="gpt-4o-mini")

_router_prompt = ChatPromptTemplate.from_template(
    """당신은 사용자의 요청을 분석하여 어떤 담당자에게 전달할지 결정하는 AI 라우터입니다.
아래 세 가지 경로 중 가장 적절한 경로 하나만 정확히 답변해주세요.
(meeting_matching, hobby_recommendation, general_search 중 택1)

[사용자 요청]:
{user_input}
"""
)
_router_chain = _router_prompt | llm | StrOutputParser()


class MasterAgentState(TypedDict):
    user_input: dict
    route: str
    final_answer: str


def route_request(state: MasterAgentState) -> dict:
    logging.info("--- ROUTING ---")
    user_input = state['user_input']

    # 설문 데이터 포함 시 LLM 없이 즉시 분기 (토큰 절약)
    if isinstance(user_input, dict) and ('survey' in user_input or 'survey_raw' in user_input):
        logging.info("라우팅 결정: hobby_recommendation (Rule-based)")
        return {"route": "hobby_recommendation"}

    try:
        decision = _router_chain.invoke({"user_input": user_input})
        route = decision.strip().lower().replace("'", "").replace('"', '')
    except Exception as e:
        logging.error(f"라우팅 오류: {e}")
        route = "general_search"

    logging.info(f"라우팅 결정: {route}")
    return {"route": route}


# ─── StateGraph 조립 ──────────────────────────────────────

_builder = StateGraph(MasterAgentState)
_builder.add_node("router",           route_request)
_builder.add_node("hobby_recommender", call_multimodal_hobby_agent)
_builder.add_node("general_searcher",  call_general_search_agent)

_builder.set_entry_point("router")
_builder.add_conditional_edges("router", lambda x: x['route'], {
    "hobby_recommendation": "hobby_recommender",
    "meeting_matching":     "general_searcher",
    "general_search":       "general_searcher",
})
_builder.add_edge("hobby_recommender", END)
_builder.add_edge("general_searcher",  END)

master_agent = _builder.compile()
