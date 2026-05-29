## 🛠️ v1.0 (2025.09) : 프로젝트 초기 구현 (교내 학술제 금상 수상작)

> **사회적 고립감 해소를 위한 AI 기반 맞춤형 취미 추천 및 소모임 연결 플랫폼**
> 사용자의 심리·환경 데이터를 다차원으로 분석하여 최적의 취미를 제안하고, 유사한 관심사를 가진 소모임을 매칭합니다.

### 1. 기술 스택

**AI Server**

| 분류 | 기술 | 버전 | 역할 |
|------|------|------|------|
| API 서버 | FastAPI + Uvicorn | - | REST API 서버 (포트 8000), Pydantic 요청 검증 |
| 에이전트 오케스트레이션 | LangGraph | 0.0.51 | `StateGraph` 기반 노드-엣지 구조로 에이전트 실행 흐름 제어 |
| LLM | OpenAI GPT-4o-mini | - | 요청 의도 분류(라우팅), 범용 검색 에이전트 추론 |
| 멀티모달 LLM | Google Gemini 2.5 Flash | - | 사용자 일상 사진 분석 → 설문으로 드러나지 않는 잠재 관심사 도출 |
| 임베딩 모델 | OpenAI text-embedding-3-large | - | 모임 텍스트(제목+설명+장소+시간) → 고차원 벡터 변환 |
| 벡터 DB | Pinecone | - | 모임 임베딩 저장 및 코사인 유사도 기반 검색 (k=3) |
| 웹 검색 도구 | Tavily | - | ReAct 에이전트의 실시간 외부 정보 검색 도구 (max_results=3) |
| LLM 추상화 | LangChain + langchain-openai | 0.1.20 | OpenAI Tools Agent 구성, Retriever Tool 생성, 프롬프트 체인 |

**Backend**

* Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs, Multer

**Frontend**

* React, Vite, TailwindCSS

---

### 2-1. AI 핵심 아키텍처 상세

#### LangGraph StateGraph — 마스터 라우터 + 2개 에이전트

단일 진입점(`/agent/invoke`)으로 들어온 요청을 GPT-4o-mini가 의도를 분류하고, 적합한 에이전트로 자동 분기합니다. 설문 데이터가 포함된 경우 LLM 호출 없이 룰 기반으로 즉시 분기해 불필요한 토큰 소비를 방지합니다.

```
POST /agent/invoke
        ↓
   [router 노드]  ← GPT-4o-mini 의도 분류 (또는 룰 기반 즉시 분기)
        ↓
  ┌─────────────────────────────┐
  │                             │
hobby_recommendation    meeting_matching / general_search
        ↓                            ↓
[HobbyAgent SubGraph]     [General Search Agent]
  설문 분석 → Gemini        Pinecone RAG + Tavily 검색
```

#### 취미 추천 에이전트 — 5차원 심리 프로파일링 파이프라인

설문 49문항의 응답을 5개 차원으로 구조화하고 0~1 범위로 정규화한 뒤, 프롬프트에 주입해 Gemini가 맞춤 취미 3개를 JSON으로 반환합니다.

```
[analyze_survey 노드]
  49문항 응답 → 5차원 프로필로 변환 및 정규화
        ↓
[analyze_photo 노드]
  프로필 + 이미지(선택) → Gemini 2.5 Flash → JSON 추천
```

**5차원 프로파일링 구조**

| 차원 | 의미 | 주요 문항 | 처리 방식 |
|------|------|-----------|-----------|
| FSC | 현실적 제약 | 가용 시간(Q1), 예산(Q2), 에너지(Q3), 이동성(Q4) | 선택지 인덱스 → 1~4 또는 1~5 범위 정규화 |
| PSSR | 심리적 상태 | 사회불안(Q15,Q18,Q20), 자기비판(Q13,Q14,Q16) | 복수 문항 평균 → 역채점 포함 후 정규화 |
| MP | 핵심 동기 | 성취/회복/연결/활력(Q31) | 선택지 인덱스 → 카테고리 매핑 |
| DLS | 사회성 선호 | 단독형/병렬형/저강도/고강도(Q39) | 선택지 인덱스 → 카테고리 매핑 |
| IP | 관심사 프로필 | 자연/창작/지적/예술/신체(Q43~Q47) | 1~5 척도 정규화 |

**Hard Constraint 로직** — IP 각 항목이 0.3 미만이면 해당 카테고리를 프롬프트에 명시적으로 금지 조건으로 삽입합니다.

```python
if ip.get('nature_interest', 0.5) < 0.3:
    hard_constraints += "- '자연' 관련 활동 금지\n"
```

#### 범용 검색 에이전트 — RAG + ReAct

OpenAI Tools Agent(`create_openai_tools_agent`) 기반으로 3가지 도구를 조합해 추론합니다.

| 도구 | 역할 |
|------|------|
| `moit_internal_meeting_search` | Pinecone에서 `text-embedding-3-large`로 기존 모임 유사도 검색 |
| `web_search` (Tavily) | 실시간 외부 정보 검색 |
| `get_current_date` | 날짜 기반 추론 지원 |

모임 생성 시 유사 모임을 Pinecone에서 먼저 탐색해 중복 생성을 방지하고, 모임 삭제 시에도 벡터 DB와 MongoDB를 동기화합니다.

### 2. 핵심 아키텍처 및 기능

* **LangGraph 기반 멀티 에이전트 라우팅 (AI)**
* 사용자 요청 의도를 파악하여 **취미 추천 에이전트**와 **범용 모임 검색 에이전트(RAG+실시간 검색)** 로 자동 분기 처리.


* **다차원 심리·환경 기반 취미 추천 (Front/AI)**
* 49문항 설문(현실 제약, 심리 상태, 동기 등) 정규화 데이터와 사용자 일상 사진(Gemini 멀티모달 분석)을 결합하여 잠재 관심사를 도출하고 맞춤 취미 추천.


* **AI 연동 스마트 모임 매칭 (Backend/AI)**
* 단순 DB 저장이 아닌, 모임 생성 전 Pinecone 벡터 DB 유사도 검색을 수행해 기존 유사 모임을 우선 추천하여 중복 생성을 방지.


* **보안 및 관리자 시스템 (Front/Backend)**
* JWT 및 Role 기반 3단계 라우팅 가드(Guest / User / Admin) 구현 및 관리자 전용 대시보드(통계, 데이터 관리) 제공.



### 3. 한계점 및 유지보수 과제 (Refactoring Points)

이후 v2.0 개선을 위한 기존 아키텍처의 주요 한계점입니다.

* **하드코딩 및 강한 결합도:** AI 설문 변환 로직이 백엔드에 종속되어 있고, 프론트/백엔드 내 API 주소(localhost) 및 CORS 설정이 하드코딩 되어 유연성 저하.
* **파이프라인 미완성:** 멀티모달(사진) 업로드 UI는 존재하나 AI 서버로의 실제 전송 파이프라인 미연결.
* **보안 및 에러 핸들링 누락:** 계정 삭제 API 인증 가드 누락, 모임 삭제 시 서버 디스크 내 이미지 파일 잔존, AI 서버 재시도(Retry) 로직 부재.
* **코드 중복:** 백엔드 내 인증 미들웨어 코드의 불필요한 인라인 중복 발생.
