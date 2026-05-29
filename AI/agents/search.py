"""
범용 검색 에이전트

Pinecone RAG + Tavily 실시간 검색을 조합한 ReAct 에이전트.
모임 매칭 및 일반 질의응답에 사용됩니다.
"""

import os
import logging
from datetime import datetime

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langchain_pinecone import PineconeVectorStore
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain.tools.retriever import create_retriever_tool
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

llm = ChatOpenAI(model="gpt-4o-mini", timeout=30)


@tool
def get_current_date() -> str:
    """오늘 날짜를 'YYYY년 MM월 DD일' 형식으로 반환합니다."""
    return datetime.now().strftime("%Y년 %m월 %d일")


def _build_tools() -> list:
    """에이전트 도구 목록을 생성합니다. Pinecone 연결 실패 시 graceful degradation."""
    tools = [TavilySearchResults(max_results=3, name="web_search"), get_current_date]

    try:
        index_name = os.getenv("PINECONE_INDEX_NAME_MEETING")
        vector_store = PineconeVectorStore.from_existing_index(
            index_name=index_name,
            embedding=OpenAIEmbeddings(model='text-embedding-3-large')
        )
        retriever = vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={'k': 3}
        )
        tools.append(create_retriever_tool(
            retriever,
            "moit_internal_meeting_search",
            "MOIT 서비스 내에 등록된 기존 모임 정보를 검색합니다."
        ))
    except Exception as e:
        logging.warning(f"Pinecone 도구 설정 실패 (해당 도구 없이 진행): {e}")

    return tools


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    before_sleep=lambda rs: logging.warning(
        f"에이전트 실행 실패 — {rs.attempt_number}회 재시도 중... ({rs.outcome.exception()})"
    )
)
def _run_agent_with_retry(executor: AgentExecutor, query: str) -> dict:
    """OpenAI Tools Agent 실행 — 일시적 오류 시 최대 3회 지수 백오프 재시도."""
    return executor.invoke({"input": query, "chat_history": []})


def call_general_search_agent(state: dict) -> dict:
    """Pinecone RAG + Tavily 검색을 활용하는 범용 ReAct 에이전트."""
    logging.info("--- CALLING: General Search Agent ---")

    tools = _build_tools()

    react_prompt = ChatPromptTemplate.from_messages([
        ("system", "당신은 AI 어시스턴트 'MOIT'입니다. 주어진 도구를 활용해 답변하세요."),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad")
    ])

    agent = create_openai_tools_agent(llm, tools, react_prompt)
    executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

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
        result = _run_agent_with_retry(executor, query)
        answer = result.get("output", "죄송합니다. 답변을 생성하지 못했습니다.")
    except Exception as e:
        logging.error(f"에이전트 실행 최종 실패 (3회 재시도 소진): {e}")
        answer = "오류가 발생하여 답변할 수 없습니다."

    return {"final_answer": answer}


def call_meeting_matching_agent(state: dict) -> dict:
    """모임 매칭 요청 — 범용 검색 에이전트를 재사용합니다."""
    logging.info("--- CALLING: Meeting Matching Agent ---")
    return call_general_search_agent(state)
