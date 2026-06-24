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

---

## 🔧 v2.0 (2026.06) : 기술 부채 해소 및 고도화

> v1.0에서 지적된 한계점을 실제로 개선한 내역입니다.
> 성능·안정성·보안·코드 품질 네 가지 축으로 분류했습니다.

---

### [성능] 1. 순차 DB 쿼리 → Promise.all 병렬 처리

**문제**: 독립적인 DB 쿼리들을 `await`으로 순차 실행해 응답 지연 발생.
적용 파일: `routes/stats.js`, `routes/post.js`, `routes/admin.js`

```js
// Before — 순차 실행 (총 대기 시간 = 쿼리1 + 쿼리2 + 쿼리3)
const totalMeetings  = await Meeting.countDocuments();
const popularCategory = await Meeting.aggregate([...]);
const newUsersThisWeek = await User.countDocuments({ ... });

// After — 병렬 실행 (총 대기 시간 = max(쿼리1, 쿼리2, 쿼리3))
const [totalMeetings, popularCategory, newUsersThisWeek] = await Promise.all([
    Meeting.countDocuments(),
    Meeting.aggregate([...]),
    User.countDocuments({ ... })
]);
```

---

### [성능] 2. Pinecone 연결 모듈 레벨 초기화

**문제**: 검색 에이전트 호출마다 `_build_tools()`가 실행되어 Pinecone Vector Store가 매 요청마다 재연결됨.
적용 파일: `AI/agents/search.py`

```python
# Before — 요청마다 Pinecone 재연결
def call_general_search_agent(state):
    tools = _build_tools()  # 매 요청 실행
    executor = AgentExecutor(agent=..., tools=tools)

# After — 서버 시작 시 1회만 초기화
_TOOLS = _build_tools()  # 모듈 레벨

def call_general_search_agent(state):
    executor = AgentExecutor(agent=..., tools=_TOOLS)
```

---

### [성능] 3. MongoDB 인덱스 추가

**문제**: 자주 사용되는 정렬·필터 쿼리에 인덱스가 없어 컬렉션 풀스캔 발생.
적용 파일: `models/Meeting.js`, `models/Post.js`, `models/Contact.js`

```js
// models/Meeting.js
meetingSchema.index({ category: 1 });    // 유사 모임 검색
meetingSchema.index({ date: 1 });        // 마감 임박 조회
meetingSchema.index({ createdAt: -1 }); // 최신순 목록

// models/Post.js
postSchema.index({ createdAt: -1 });    // 최신순 목록

// models/Contact.js
contactSchema.index({ status: 1, repliedAt: -1 }); // Q&A 필터 + 정렬 복합 인덱스
```

---

### [안정성] 4. AI 서버 axios retry 래퍼 도입

**문제**: AI 서버(FastAPI) 호출 시 타임아웃만 있고 일시적 장애에 대한 재시도 로직 없음.
적용 파일: `routes/meeting.js` (4곳), `routes/survey.js` (1곳)

```js
// Before — 실패 시 즉시 500 반환
const res = await axios.post(`${AI_URL}/agent/invoke`, data, { timeout: 30000 });

// After — 5xx·네트워크 오류 시 최대 2회 지수 백오프 재시도
async function axiosWithRetry(config, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await axios(config);
        } catch (err) {
            const isRetryable = !err.response || err.response.status >= 500;
            if (!isRetryable || attempt > maxRetries) throw err;
            const delay = Math.min(1000 * attempt, 3000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
const res = await axiosWithRetry({ method: 'post', url: `${AI_URL}/agent/invoke`, data, timeout: 30000 });
```

---

### [안정성] 5. LLM 타임아웃 / retry 강화

**문제**: 라우터 LLM 타임아웃 10초로 짧아 부하 시 타임아웃 빈발, retry 횟수 부족.
적용 파일: `AI/agents/master.py`

```python
# Before
llm = ChatOpenAI(model="gpt-4o-mini", timeout=10)
@retry(stop=stop_after_attempt(2), ...)   # 최대 2회

# After
llm = ChatOpenAI(model="gpt-4o-mini", timeout=25)  # 25초로 증가
@retry(stop=stop_after_attempt(3), ...)   # 최대 3회
```

---

### [안정성] 6. 문의 답변 보상 로직 추가

**문제**: 문의 답변 저장 성공 후 게시글 자동 생성이 실패하면 Contact는 업데이트됐는데 500 에러가 반환되는 상태 불일치 발생.
적용 파일: `routes/admin.js`

```js
// Before — 게시글 저장 실패 시 답변 롤백 불가 → 불일치 상태
await contact.update(...);
await newPost.save();  // 실패하면 catch → 500 반환, Contact는 이미 업데이트됨

// After — 보상 로직으로 상태 불일치 방지
await contact.update(...);  // 핵심 작업 완료
try {
    await newPost.save();
} catch (postError) {
    console.error(`[보상] 답변 등록 성공, 게시글 자동 생성 실패:`, postError.message);
    return res.json({ message: '답변이 등록되었습니다. (게시글 자동 발행은 실패했습니다.)' });
}
```

---

### [보안] 7. verifyAdmin DB 조회 제거

**문제**: 관리자 미들웨어가 매 요청마다 `User.findById()`를 호출해 불필요한 DB 왕복 발생. JWT 토큰에 이미 `role`이 포함되어 있어 중복 조회.
적용 파일: `utils/auth.js`

```js
// Before — 매 관리자 API 요청마다 DB 조회 1회
const verifyAdmin = async (req, res, next) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);  // DB 왕복
    if (!user || user.role !== 1) return res.status(403).json({ ... });
    req.user = user;
    next();
};

// After — 토큰 기반 처리 (DB 조회 없음)
const verifyAdmin = (req, res, next) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 1) return res.status(403).json({ ... });
    req.user = decoded;
    next();
};
```

---

### [보안] 8. password 필드 기본 노출 차단

**문제**: `User` 모델 `password` 필드가 모든 `find` 쿼리에 기본 포함되어 의도치 않은 데이터 노출 위험.
적용 파일: `models/User.js`

```js
// Before — User.findById() 결과에 password 자동 포함
password: { type: String, minlength: 5 }

// After — 기본 제외, 필요 시 .select('+password') 명시
password: { type: String, minlength: 5, select: false }
```

---

### [코드품질] 9. User pre-save 훅 async/await 현대화 + 레거시 제거

**문제**: 비밀번호 해싱 로직이 콜백 중첩(Callback Hell) 패턴. 미사용 레거시 메서드(`generateToken`, `findByToken`, `comparePassword`) 잔존.
적용 파일: `models/User.js`

```js
// Before — 콜백 중첩
userSchema.pre("save", function (next) {
    if (user.isModified("password")) {
        bcrypt.genSalt(10, function (err, salt) {
            if (err) return next(err);
            bcrypt.hash(user.password, salt, function (err, hash) {
                if (err) return next(err);
                user.password = hash;
                next();
            });
        });
    } else { next(); }
});

// After — async/await, 레거시 메서드 3개 제거
userSchema.pre("save", async function () {
    if (this.isModified("password")) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
});
```

---

### [코드품질] 10. 환경 변수화 / 매직넘버 상수화

**문제**: AI 모델명과 쿠키 만료 시간이 하드코딩되어 변경 시 코드 수정 필요.
적용 파일: `AI/agents/hobby.py`, `routes/user.js`

```python
# Before
model = genai.GenerativeModel('gemini-2.5-flash')  # 하드코딩

# After — .env의 GEMINI_MODEL 값으로 교체 가능
model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
```

```js
// Before
maxAge: 24 * 60 * 60 * 1000  // 매직넘버

// After
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24시간
maxAge: TOKEN_MAX_AGE_MS
```

---

### v2.0 개선 요약

| 분류 | 항목 | Before | After |
|------|------|--------|-------|
| **성능** | DB 쿼리 병렬화 | 순차 `await` | `Promise.all` 동시 실행 |
| **성능** | Pinecone 초기화 | 요청마다 재연결 | 모듈 레벨 1회 초기화 |
| **성능** | DB 인덱스 | 없음 | Meeting·Post·Contact 인덱스 추가 |
| **안정성** | axios retry | 없음 | 5xx·네트워크 오류 최대 2회 재시도 |
| **안정성** | LLM 타임아웃 | 10초 | 25초 |
| **안정성** | LLM retry | 2회 | 3회 |
| **안정성** | 보상 로직 | 없음 | 문의 답변·게시글 분리 처리 |
| **보안** | verifyAdmin | 매 요청 DB 조회 | JWT 토큰 기반 처리 |
| **보안** | password 노출 | 모든 쿼리에 포함 | `select: false` 기본 제외 |
| **코드품질** | pre-save 훅 | 콜백 중첩 | async/await |
| **코드품질** | 레거시 코드 | 미사용 메서드 3개 | 제거 |
| **코드품질** | 하드코딩 | 모델명·매직넘버 | 환경 변수·상수화 |
| **코드품질** | 에러 로깅 | catch 블록 누락 7곳 | console.error 전체 추가 |
