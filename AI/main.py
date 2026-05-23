"""
MOIT AI Agent Server v3

FastAPI 앱 진입점 — API 라우트 정의만 담당합니다.
에이전트 로직은 agents/ 패키지, 유틸리티는 utils/ 패키지에 위치합니다.
"""

import os
import logging
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.master import master_agent
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(levelname)s:     %(message)s')

# ─── FastAPI 앱 ───────────────────────────────────────────

app = FastAPI(
    title="MOIT AI Agent Server",
    description="LangGraph 기반 멀티 에이전트 — 취미 추천 / 모임 매칭 / 범용 검색",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── 요청 스키마 ──────────────────────────────────────────

class UserRequest(BaseModel):
    user_input: dict

class NewMeeting(BaseModel):
    meeting_id: str
    title: str
    description: str
    time: str
    location: str


# ─── API 라우트 ───────────────────────────────────────────

@app.post("/agent/invoke")
async def invoke_agent(request: UserRequest):
    """마스터 에이전트 호출 — 취미 추천 / 모임 매칭 / 범용 검색 자동 분기"""
    try:
        result = master_agent.invoke({"user_input": request.user_input})
        return {"final_answer": result.get("final_answer", "")}
    except Exception as e:
        logging.error(f"에이전트 처리 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/meetings/add")
async def add_meeting(meeting: NewMeeting):
    """신규 모임을 Pinecone 벡터 DB에 임베딩하여 추가합니다."""
    try:
        index_name = os.getenv("PINECONE_INDEX_NAME_MEETING")
        if not index_name:
            raise ValueError("PINECONE_INDEX_NAME_MEETING이 .env에 설정되지 않았습니다.")

        vector_store = PineconeVectorStore.from_existing_index(
            index_name=index_name,
            embedding=OpenAIEmbeddings(model='text-embedding-3-large')
        )
        full_text = (
            f"제목: {meeting.title}\n"
            f"설명: {meeting.description}\n"
            f"시간: {meeting.time}\n"
            f"장소: {meeting.location}"
        )
        vector_store.add_texts(
            texts=[full_text],
            metadatas=[meeting.model_dump()],
            ids=[meeting.meeting_id]
        )
        logging.info(f"Pinecone 모임 추가 완료 (ID: {meeting.meeting_id})")
        return {"status": "success", "meeting_id": meeting.meeting_id}
    except Exception as e:
        logging.error(f"Pinecone 추가 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/meetings/delete/{meeting_id}")
async def delete_meeting(meeting_id: str):
    """Pinecone 벡터 DB에서 모임을 삭제합니다."""
    try:
        index_name = os.getenv("PINECONE_INDEX_NAME_MEETING")
        if not index_name:
            raise ValueError("PINECONE_INDEX_NAME_MEETING이 .env에 설정되지 않았습니다.")

        vector_store = PineconeVectorStore.from_existing_index(
            index_name=index_name,
            embedding=OpenAIEmbeddings(model='text-embedding-3-large')
        )
        vector_store.delete(ids=[meeting_id])
        logging.info(f"Pinecone 모임 삭제 완료 (ID: {meeting_id})")
        return {"status": "success", "meeting_id": meeting_id}
    except Exception as e:
        logging.error(f"Pinecone 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── 서버 실행 ────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
