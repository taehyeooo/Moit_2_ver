# MOIT — 취미 기반 소모임 연결 플랫폼

> 사회적 고립감 해소를 목적으로, 사용자의 심리·환경 데이터를 AI로 분석해 맞춤 취미를 추천하고 관심사가 비슷한 사람들과 모임을 연결하는 플랫폼입니다.  
> 교내 해커톤 수상작 (2024년 9월)

---

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [기술 스택](#기술-스택)
- [AI 서버](#-ai-서버)
- [백엔드](#-백엔드)
- [프론트엔드](#-프론트엔드)
- [한계 및 개선 예정](#한계-및-개선-예정)

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 개발 기간 | 2024년 9월 |
| 아키텍처 | Python FastAPI AI 서버 + Node.js 백엔드 + React 프론트엔드 |
| 핵심 기능 | 심리 기반 취미 추천, AI 모임 검색, 소모임 생성·참여 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| AI | FastAPI, LangGraph, LangChain, OpenAI GPT-4o-mini, Google Gemini 2.5 Flash, Pinecone, Tavily |
| 백엔드 | Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs, Multer |
| 프론트엔드 | React, Vite, TailwindCSS, Framer Motion, Axios, SweetAlert2 |

---

## 🤖 AI 서버

> **파일: [`AI/main.py`](AI/main.py)**

### 아키텍처 — LangGraph 멀티 에이전트

요청 종류에 따라 적합한 에이전트로 분기하는 마스터 라우터 구조입니다.

```
사용자 요청
    ↓
마스터 라우터 (GPT-4o-mini)
    ├── hobby_recommendation  →  취미 추천 에이전트
    ├── meeting_matching      →  범용 검색 에이전트
    └── general_search        →  범용 검색 에이전트
```

```python
# AI/main.py:353-367
master_builder = StateGraph(MasterAgentState)
master_builder.add_node("router", route_request)
master_builder.add_node("hobby_recommender", call_multimodal_hobby_agent)
master_builder.add_node("general_searcher", call_general_search_agent)

master_builder.add_conditional_edges("router", lambda x: x['route'], {
    "hobby_recommendation": "hobby_recommender",
    "general_search":       "general_searcher",
    "meeting_matching":     "general_searcher"
})
master_agent = master_builder.compile()
```

### 취미 추천 — 설문 분석 + 사진 분석 파이프라인

취미 추천은 두 노드가 순차 실행되는 별도의 StateGraph로 구성됩니다.

```
설문 분석 노드 (analyze_survey) → 사진 분석 노드 (analyze_photo) → 결과
```

**설문 분석:** 49문항의 응답을 5개 차원으로 구조화하고 0~1로 정규화합니다.

| 차원 | 의미 | 예시 항목 |
|------|------|-----------|
| FSC | 현실 제약 | 가용 시간, 예산, 이동 가능 여부 |
| PSSR | 심리 상태 | 사회 불안 점수, 고립 수준 |
| MP | 핵심 동기 | 성취 / 회복 / 연결 / 활력 |
| DLS | 사회성 선호 | 단독형 / 병렬형 / 저강도 / 고강도 |
| IP | 관심사 | 자연, 창작, 지적, 예술, 신체 |

관심도 0.3 미만인 카테고리는 Hard Constraint로 등록되어 프롬프트에서 명시적으로 금지됩니다.

```python
# AI/main.py:195-200
if ip.get('nature_interest', 0.5) < 0.3:  hard_constraints += "- '자연' 관련 활동 금지\n"
if ip.get('craft_interest', 0.5)  < 0.3:  hard_constraints += "- '만들기' 관련 활동 금지\n"
if ip.get('art_interest', 0.5)    < 0.3:  hard_constraints += "- '예술' 관련 활동 금지\n"
```

**사진 분석:** 사용자가 업로드한 일상 사진을 Google Gemini 2.5 Flash가 분석해 설문으로 드러나지 않는 잠재 관심사를 파악합니다.

```python
# AI/main.py:301-303
model = genai.GenerativeModel('gemini-2.5-flash')
response = model.generate_content([prompt_text] + image_parts)
```

### 범용 검색 에이전트 — RAG + 실시간 웹 검색

Pinecone 벡터 DB에서 의미 유사도 기반으로 기존 모임을 검색하고, 필요시 Tavily로 실시간 웹 검색도 수행합니다.

```python
# AI/main.py:116-122
vector_store = PineconeVectorStore.from_existing_index(
    index_name=meeting_index_name,
    embedding=OpenAIEmbeddings(model='text-embedding-3-large')
)
retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={'k': 3})
```

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/agent/invoke` | 마스터 에이전트 호출 (취미 추천 / 모임 검색) |
| POST | `/meetings/add` | Pinecone에 신규 모임 임베딩 추가 |
| DELETE | `/meetings/delete/{id}` | Pinecone에서 모임 삭제 |

---

## 🗄️ 백엔드

> **파일: [`backend/`](backend/)**

### 구조

```
backend/
├── index.js          # 서버 진입점, 미들웨어, DB 연결
├── models/
│   ├── User.js       # 사용자 스키마 (bcrypt 자동 해싱)
│   ├── Meeting.js    # 모임 스키마
│   ├── Post.js       # 게시글 스키마
│   ├── Contact.js    # 문의 스키마
│   └── SurveyResult.js
├── routes/
│   ├── user.js       # 회원가입, 로그인, 마이페이지
│   ├── meeting.js    # 모임 CRUD + AI 연동
│   ├── survey.js     # 설문 저장 및 AI 추천 요청
│   ├── post.js       # 게시글 CRUD
│   ├── admin.js      # 관리자 전용 API
│   ├── contact.js    # 문의 접수
│   └── upload.js     # 파일 업로드
└── utils/
    └── auth.js       # JWT 검증 미들웨어
```

### 인증 시스템

HttpOnly 쿠키 기반 JWT를 사용합니다. 로그인 시 role 정보를 토큰에 포함해 프론트엔드에서 권한 분기에 활용합니다.

```javascript
// backend/routes/user.js:140-145
const token = jwt.sign(
    { userId: user._id, username: user.username, nickname: user.nickname, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
);
res.cookie('token', token, { httpOnly: true, secure: ..., sameSite: 'strict' });
```

로그인 실패 5회 시 계정이 자동으로 비활성화되고, 로그인 성공 시 카운터가 초기화됩니다.

### 모임 생성 플로우

단순 DB 저장이 아니라 AI 서버와 연동된 3단계 흐름입니다.

```
1. 모임 생성 요청
      ↓
2. AI 서버에 유사 모임 검색 요청
      ├── 유사 모임 있음 → 추천 결과 반환 (action: 'recommend')
      └── 유사 모임 없음 → 신규 모임 DB 저장 + Pinecone 동기화 (action: 'created')
```

사용자가 추천을 무시하고 생성하겠다고 선택하면 `/force-create`로 신규 모임이 강제 생성됩니다.

### 관리자 시스템

`role: 1` 계정만 접근 가능한 전용 API를 별도 라우터로 분리했습니다.

| 기능 | 엔드포인트 |
|------|-----------|
| 전체 사용자 조회 / 삭제 | `GET/DELETE /api/admin/users` |
| 전체 모임 조회 / 삭제 | `GET/DELETE /api/admin/meetings` |
| 문의사항 조회 / 답변 / 삭제 | `GET/PUT/DELETE /api/admin/contacts` |
| 답변 등록 → Q&A 게시글 자동 발행 | `PUT /api/admin/contacts/:id/reply` |
| 대시보드 통계 | `GET /api/admin/dashboard-stats` |

### 주요 API 엔드포인트

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/signup` | - | 회원가입 (adminKey로 관리자 등록 가능) |
| POST | `/api/auth/login` | - | 로그인 |
| POST | `/api/auth/verify-token` | - | 토큰 검증 |
| POST | `/api/auth/logout` | - | 로그아웃 |
| GET | `/api/auth/mypage` | 필요 | 마이페이지 데이터 조회 |
| GET | `/api/meetings` | - | 모임 목록 |
| GET | `/api/meetings/closing-soon` | - | 마감 임박 모임 (MongoDB Aggregation) |
| POST | `/api/meetings` | 필요 | 모임 생성 (AI 연동) |
| POST | `/api/meetings/ai-search` | - | AI 스마트 검색 |
| POST | `/api/meetings/:id/join` | 필요 | 모임 참여 |
| POST | `/api/survey/recommend` | 필요 | AI 취미 추천 요청 |

---

## 🖥️ 프론트엔드

> **파일: [`frontend/src/`](frontend/src/)**

### 구조

```
frontend/src/
├── context/
│   └── AuthContext.jsx       # 전역 인증 상태 (서버 토큰 검증)
├── Components/
│   ├── Navbar/               # 상단 네비게이션
│   ├── Footer/               # 하단 푸터
│   ├── AdminLayout/          # 관리자 레이아웃
│   ├── AdminRoute/           # 관리자 라우트 가드
│   └── AdminNavbar/
└── Page/
    ├── MainPage/             # 메인 페이지 (Hero, Forum, Contact 섹션)
    ├── Meetings/             # 모임 목록
    ├── MeetingDetail/        # 모임 상세 + 유사 모임
    ├── CreateMeeting/        # 모임 생성 (AI 추천 연동)
    ├── MeetingRecommend/     # AI 추천 결과 중간 단계
    ├── HobbyRecommend/       # 49문항 심리 설문 + AI 추천
    ├── Auth/                 # 로그인 / 회원가입
    ├── Mypage/               # 마이페이지
    ├── ProfileEdit/          # 프로필 수정
    ├── Board/                # 게시판
    ├── QnA/                  # Q&A 게시판
    ├── Admin/                # 관리자 대시보드 (사용자·모임·문의 관리)
    └── ...
```

### 인증 및 라우트 보호

앱 초기화 시 서버에 토큰 검증 요청을 보내고 결과를 Context로 전체 트리에 공유합니다.

```jsx
// frontend/src/context/AuthContext.jsx
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.post("/api/auth/verify-token", {}, { withCredentials: true })
            .then(res => setUser(res.data.user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    return (
        <AuthContext.Provider value={{ user, setUser, loading }}>
            {!loading && children}  {/* 인증 확인 전 렌더링 차단 */}
        </AuthContext.Provider>
    );
};
```

라우트는 3단계로 보호됩니다.

```jsx
// frontend/src/App.jsx
<GuestRoute />          // 비로그인 전용 (로그인 상태면 role에 따라 리다이렉트)
<UserProtectedRoute />  // 로그인 필수
<AdminRoute />          // role === 1 (관리자)만 접근 가능
```

### 취미 추천 설문 (49문항 4단계)

| 단계 | 문항 수 | 측정 내용 |
|------|---------|-----------|
| 1단계 | Q1~Q12 | 현실 제약 (시간, 예산, 이동성, 신체 상태, 주거 환경) |
| 2단계 | Q13~Q30 | 심리 상태 (자기비판, 사회 불안, 고립 수준, 스트레스) |
| 3단계 | Q31~Q48 | 동기·선호 (핵심 동기, 사회성 유형, 관심 분야) |
| 4단계 | Q49 | 일상 사진 업로드 (Gemini 멀티모달 분석) |

문항 유형은 `choice` (선택지), `scale` (1~5점 척도), `checkbox` (다중 선택), `photo` (파일 업로드) 4가지입니다.

페이지 전환은 Framer Motion `AnimatePresence`로 슬라이드 애니메이션 처리됩니다.

저장된 설문 결과가 있으면 설문을 건너뛰고 바로 결과 화면을 보여줍니다.

### 페이지 목록

| 경로 | 페이지 | 접근 제한 |
|------|--------|-----------|
| `/` | 메인 페이지 | - |
| `/recommend` | 취미 추천 설문 | 로그인 필요 |
| `/meetings` | 모임 목록 | - |
| `/meetings/:id` | 모임 상세 | - |
| `/meetings/create` | 모임 생성 | 로그인 필요 |
| `/meetings/recommend` | AI 모임 추천 결과 | 로그인 필요 |
| `/mypage` | 마이페이지 | 로그인 필요 |
| `/board` | 게시판 | - |
| `/qna` | Q&A 게시판 | - |
| `/admin` | 관리자 대시보드 | 관리자 전용 |

---

## 한계 및 개선 예정

**AI 서버**
- `survey.js`의 설문 변환 로직(답변 텍스트 → 숫자 인덱스)이 백엔드에 하드코딩되어 있어 문항 변경 시 양쪽 모두 수정 필요
- 사진 업로드는 프론트엔드에서 미리보기만 제공되고, AI 서버로의 실제 전송 파이프라인이 미완성 상태
- `tenacity` 재시도 로직을 import하고 있으나 실제 적용된 곳 없음

**백엔드**
- 인증 미들웨어(`verifyToken`)가 `utils/auth.js`로 분리되었으나 `survey.js`에는 동일 코드가 중복 인라인 정의됨
- 계정 삭제 API(`DELETE /api/auth/delete/:userId`)에 인증 미들웨어 없음
- 모임 삭제 시 관련 이미지 파일이 서버 디스크에서 삭제되지 않음 (주석으로 TODO 처리됨)
- `CORS origin`이 `http://localhost:5173` 하드코딩

**프론트엔드**
- `AuthContext`의 API 주소가 `http://localhost:3000`으로 하드코딩 (Vite proxy 미활용)
- 설문 이전 버튼 방향 버그 존재 (`currentStep + 1`이어야 할 곳에 조건 확인 필요)
