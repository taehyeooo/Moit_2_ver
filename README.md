# MOIT v2.0 — AI 기반 취미 모임 매칭 플랫폼

> 교내 학술제 금상 수상, 경진대회 동상 수상작(v1.0)을 고도화한 ai(RAG), 백엔드(node.js) 프로젝트입니다.
> **사회적 고립감 해소**를 목적으로, 사용자의 심리·환경 데이터를 다차원 분석하여 맞춤형 취미를 추천하고 유사 관심사 소모임을 매칭합니다.

---

## AI 기술 스택

### 사용 AI 모델

| 모델 | 제공사 | 역할 |
|------|--------|------|
| **GPT-4o-mini** | OpenAI | 사용자 요청 의도 분류(라우팅), 범용 모임 검색 에이전트 추론 |
| **Gemini 2.5 Flash** | Google | 사용자 일상 사진 멀티모달 분석 → 잠재 관심사 도출 |
| **text-embedding-3-large** | OpenAI | 모임 텍스트(제목·설명·장소·시간) → 고차원 벡터 변환 |

### AI 파이프라인 아키텍처


<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/3da38c96-b40a-4e24-83af-de1e43f6af9d" />



### AI 프레임워크 및 도구

| 분류 | 기술 | 역할 |
|------|------|------|
| 에이전트 오케스트레이션 | **LangGraph** | `StateGraph` 노드-엣지 구조로 멀티 에이전트 실행 흐름 제어 |
| LLM 추상화 | **LangChain** | OpenAI Tools Agent 구성, Retriever Tool 생성, 프롬프트 체인 |
| 벡터 DB | **Pinecone** | 모임 임베딩 저장 및 코사인 유사도 기반 검색 (k=3) |
| 웹 검색 | **Tavily** | ReAct 에이전트의 실시간 외부 정보 검색 (max_results=3) |
| LLM 재시도 | **tenacity** | 일시적 API 오류 시 지수 백오프 자동 재시도 |

### 취미 추천 — 5차원 심리 프로파일링

설문 49문항 응답을 5개 차원으로 구조화하고 0~1로 정규화 후 Gemini에 주입합니다.

| 차원 | 의미 | 주요 문항 |
|------|------|-----------|
| **FSC** | 현실적 제약 | 가용 시간(Q1), 예산(Q2), 에너지(Q3), 이동성(Q4) |
| **PSSR** | 심리적 상태 | 사회불안(Q15·Q18·Q20), 자기비판(Q13·Q14·Q16) |
| **MP** | 핵심 동기 | 성취/회복/연결/활력(Q31) |
| **DLS** | 사회성 선호 | 단독형/병렬형/저강도/고강도(Q39) |
| **IP** | 관심사 프로필 | 자연/창작/지적/예술/신체(Q43~Q47) |

IP 각 항목이 **0.3 미만**이면 해당 카테고리를 프롬프트에 Hard Constraint로 명시 삽입합니다.

```python
if ip.get('nature_interest', 0.5) < 0.3:
    hard_constraints += "- '자연' 관련 활동 금지\n"
```

---

## 유지보수 전·후 수치 비교

> v1.0 코드 기준으로 2회에 걸쳐 유지보수를 진행했습니다.

### 성능

| 항목 | Before | After | 개선율 |
|------|--------|-------|--------|
| 통계 API DB 쿼리 | 순차 3회 (누적 대기) | Promise.all 병렬 1회 대기 | 응답 시간 약 **60% 단축** |
| 게시글 목록 API DB 쿼리 | 순차 2회 (누적 대기) | Promise.all 병렬 1회 대기 | 응답 시간 약 **50% 단축** |
| 대시보드 통계 API DB 쿼리 | 순차 4회 (누적 대기) | Promise.all 병렬 1회 대기 | 응답 시간 약 **75% 단축** |
| 마이페이지 모임 조회 | 순차 2회 (누적 대기) | Promise.all 병렬 1회 대기 | 응답 시간 약 **50% 단축** |
| 조회수 증가 DB 왕복 | findById + save (2회) | findByIdAndUpdate 원자적 처리 (1회) | DB 왕복 **50% 감소** |
| 모임 참여·탈퇴 DB 왕복 | save + 재조회 (2회) | $addToSet/$pull 원자적 처리 (1회) | DB 왕복 **50% 감소** |
| Pinecone 연결 횟수 | 검색 요청마다 재연결 | 서버 시작 시 **1회** 초기화 | 반복 연결 **100% 제거** |
| verifyAdmin DB 조회 | 관리자 API 요청마다 1회 | **0회** (JWT 토큰 기반) | 요청당 DB 조회 **100% 제거** |

### 안정성

| 항목 | Before | After |
|------|--------|-------|
| AI 서버 일시 장애 시 | 즉시 500 에러 반환 | 최대 **2회 자동 재시도** 후 반환 |
| LLM 라우터 타임아웃 | **10초** (부하 시 빈번한 타임아웃) | **25초** |
| LLM 라우터 재시도 | **2회** | **3회** |
| Gemini retry | **3회** (유지) | **3회** |
| 문의 답변 + 게시글 생성 실패 시 | 500 에러 + 상태 불일치 | 답변 저장 유지 + **보상 메시지 반환** |

### 보안 · 코드 품질

| 항목 | Before | After |
|------|--------|-------|
| password 필드 기본 노출 | 모든 쿼리에 **자동 포함** | `select: false` → **기본 제외** |
| pre-save 훅 패턴 | **콜백 중첩 3단계** | async/await **단일 블록** |
| 미사용 레거시 메서드 | `generateToken`, `findByToken`, `comparePassword` **3개 잔존** | **전체 제거** |
| Admin catch 블록 에러 로깅 | **7곳 누락** | 전체 `console.error` 추가 |
| AI 모델명 관리 | 코드 내 **하드코딩** | `.env` 환경 변수화 |

---

## 1차 유지보수 — 성능 최적화 · 버그 수정 · 리팩토링

> **기간**: v1.0 직후 · **목적**: 코드의 즉각적인 성능 문제 및 버그 해소

### 1-1. 마이페이지 모임 조회 병렬화

```js
// Before — 호스팅 모임과 참여 모임을 순차 조회
const hostedMeetings  = await Meeting.find({ host: userId });
const joinedMeetings  = await Meeting.find({ participants: userId, host: { $ne: userId } });

// After — Promise.all로 동시 조회
const [hostedMeetings, joinedMeetings] = await Promise.all([
    Meeting.find({ host: userId }).sort({ date: -1 }),
    Meeting.find({ participants: userId, host: { $ne: userId } }).sort({ date: -1 })
]);
```

### 1-2. 게시글 조회수 원자적 처리

```js
// Before — findById로 조회 후 views++ 후 save (DB 2회 왕복, 동시 요청 시 race condition 가능)
const post = await Post.findById(req.params.id);
post.views += 1;
await post.save();

// After — findByIdAndUpdate 원자적 처리 (DB 1회, 동시 요청 안전)
const post = await Post.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
);
```

### 1-3. 모임 참여·탈퇴 원자적 처리

```js
// Before — 참여 후 save(), 별도 populate 재조회 (DB 2회 왕복)
meeting.participants.push(req.user.userId);
await meeting.save();
const updated = await Meeting.findById(req.params.id).populate('host', 'nickname');

// After — $addToSet 원자적 업데이트 + populate 체이닝 (DB 1회)
const updatedMeeting = await Meeting.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { participants: req.user.userId } },
    { new: true }
).populate('host', 'nickname').populate('participants', 'nickname');
```

### 1-4. 관리자 게시글·사용자 목록 페이지네이션 추가

```js
// Before — 전체 데이터 한 번에 반환 (데이터 증가 시 응답 지연)
const posts = await Post.find({}).sort({ createdAt: -1 });

// After — 페이지네이션 지원 (기존 호환성 유지)
if (page && limit) {
    const [posts, total] = await Promise.all([
        Post.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Post.countDocuments()
    ]);
    return res.json({ posts, currentPage: page, totalPages: Math.ceil(total / limit), total });
}
```

### 1-5. verifyAdmin 미들웨어 통합 (중복 제거)

```js
// Before — admin.js 내 인증 로직 인라인 중복 작성
router.delete('/users/:id', async (req, res) => {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // 매 라우터마다 반복
    const user = await User.findById(decoded.userId);
    if (!user || user.role !== 1) return res.status(403).json({ ... });
    // ... 핵심 로직
});

// After — utils/auth.js의 verifyAdmin 미들웨어로 분리 적용
router.delete('/users/:id', verifyAdmin, async (req, res) => {
    // 핵심 로직만 작성
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: '사용자가 삭제되었습니다.' });
});
```

### 1-6. 모임 삭제 시 이미지 파일 정리 (버그 수정)

```js
// Before — 모임 삭제 시 MongoDB 문서만 삭제, uploads/ 이미지 파일 서버에 잔존
await Meeting.findByIdAndDelete(meetingId);

// After — 이미지 파일 먼저 삭제 후 DB 삭제
if (meeting.coverImage) {
    const filePath = path.join(__dirname, '..', meeting.coverImage);
    fs.unlink(filePath, (err) => {
        if (err) console.error('이미지 파일 삭제 실패:', err.message);
    });
}
await Meeting.findByIdAndDelete(meetingId);
```

### 1-7. AI 서버 안정성 기반 구축 (타임아웃 + Retry)

```python
# Before — 타임아웃·재시도 없음, 장애 시 무한 대기 또는 즉시 실패
response = model.generate_content([prompt] + image_parts)

# After — tenacity 기반 재시도 + ChatOpenAI 타임아웃 설정
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _call_gemini_with_retry(model, prompt_text, image_parts):
    return model.generate_content([prompt_text] + image_parts)

llm = ChatOpenAI(model="gpt-4o-mini", timeout=10)  # 타임아웃 설정
```

```js
// Backend → AI 서버 axios 타임아웃 추가
await axios.post(`${AI_URL}/agent/invoke`, data, { timeout: 60000 }); // survey
await axios.post(`${AI_URL}/agent/invoke`, data, { timeout: 30000 }); // meeting
```

---

## 2차 유지보수 — 안정성 강화 · 보안 개선 · 코드 품질

> **기간**: 2026.06 · **목적**: 잔여 기술 부채 전수 점검 및 프로덕션 수준 고도화

### 2-1. 순차 DB 쿼리 전면 병렬화

1차에서 마이페이지만 적용했던 병렬화를 나머지 API 전체로 확장했습니다.

```js
// stats.js — 3개 쿼리 병렬화
const [totalMeetings, popularCategoryAgg, newUsersThisWeek] = await Promise.all([
    Meeting.countDocuments(),
    Meeting.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
    User.countDocuments({ createdAt: { $gte: oneWeekAgo } })
]);

// admin.js — 대시보드 통계 4개 병렬화
const [userCount, postCount, contactCount, meetingCount] = await Promise.all([
    User.countDocuments(), Post.countDocuments(),
    Contact.countDocuments(), Meeting.countDocuments()
]);
```

### 2-2. axios retry 래퍼 도입

1차에서 추가한 타임아웃에 더해, 일시적 장애에 대한 재시도 로직을 추가했습니다.

```js
// Before — 타임아웃은 있으나 실패 시 즉시 500 반환
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
            console.warn(`[AI 서버] 요청 실패 — ${attempt}회 재시도 중... (${delay}ms 후)`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
// meeting.js 4곳, survey.js 1곳 전체 적용
```

### 2-3. LLM 타임아웃·retry 상향

```python
# Before — 타임아웃 짧고 retry 부족
llm = ChatOpenAI(model="gpt-4o-mini", timeout=10)
@retry(stop=stop_after_attempt(2), ...)

# After
llm = ChatOpenAI(model="gpt-4o-mini", timeout=25)  # 10초 → 25초
@retry(stop=stop_after_attempt(3), ...)             # 2회 → 3회
```

### 2-4. Pinecone 모듈 레벨 초기화

```python
# Before — 검색 에이전트 호출마다 Pinecone 재연결 (불필요한 반복 초기화)
def call_general_search_agent(state):
    tools = _build_tools()  # 매 요청 실행
    executor = AgentExecutor(agent=..., tools=tools)

# After — 서버 시작 시 1회만 초기화
_TOOLS = _build_tools()  # 모듈 레벨 캐싱

def call_general_search_agent(state):
    executor = AgentExecutor(agent=..., tools=_TOOLS)
```

### 2-5. verifyAdmin DB 조회 제거

1차에서 통합한 `verifyAdmin` 미들웨어에서 불필요한 DB 조회를 제거했습니다.

```js
// Before — JWT에 role이 있는데도 매 요청마다 DB 조회
const verifyAdmin = async (req, res, next) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);  // 불필요한 DB 왕복
    if (!user || user.role !== 1) return res.status(403).json({ ... });
    req.user = user;
    next();
};

// After — 토큰에 포함된 role만으로 처리 (DB 조회 제거)
const verifyAdmin = (req, res, next) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 1) return res.status(403).json({ ... });
    req.user = decoded;
    next();
};
```

### 2-6. password 필드 기본 노출 차단

```js
// Before — User.findById() 등 모든 쿼리에 password 자동 포함
password: { type: String, minlength: 5 }

// After — 기본 제외, 로그인·프로필 수정 시에만 .select('+password') 명시
password: { type: String, minlength: 5, select: false }
```

### 2-7. 문의 답변 보상 로직 추가

```js
// Before — 게시글 저장 실패 시 Contact 업데이트는 완료됐는데 500 반환 (상태 불일치)
await Contact.findByIdAndUpdate(req.params.id, { reply, status: '완료' });
await newPost.save();  // 실패 → catch → 500 (답변은 이미 저장됨)

// After — 핵심 작업(답변)과 부가 작업(게시글)을 분리해 보상 처리
await Contact.findByIdAndUpdate(req.params.id, { reply, status: '완료' });
try {
    await newPost.save();
} catch (postError) {
    console.error('[보상] 답변 등록 성공, 게시글 자동 생성 실패:', postError.message);
    return res.json({ message: '답변이 등록되었습니다. (게시글 자동 발행은 실패했습니다.)' });
}
```

### 2-8. MongoDB 인덱스 추가

```js
// models/Meeting.js
meetingSchema.index({ category: 1 });    // 유사 모임 검색 최적화
meetingSchema.index({ date: 1 });        // 마감 임박 조회 최적화
meetingSchema.index({ createdAt: -1 }); // 최신순 목록 최적화

// models/Post.js
postSchema.index({ createdAt: -1 });    // 최신순 목록 최적화

// models/Contact.js
contactSchema.index({ status: 1, repliedAt: -1 }); // Q&A 필터 + 정렬 복합 인덱스
```

### 2-9. User 모델 코드 품질 개선

```js
// Before — 콜백 중첩 3단계
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
// 미사용 레거시: generateToken, findByToken, comparePassword (3개 잔존)

// After — async/await + 레거시 전체 제거
userSchema.pre("save", async function () {
    if (this.isModified("password")) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
});
```

### 2-10. 환경 변수화 / 매직넘버 상수화

```python
# hobby.py — AI 모델명 환경 변수로 분리
# Before
model = genai.GenerativeModel('gemini-2.5-flash')
# After
model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
```

```js
// user.js — 쿠키 만료 매직넘버 상수화
// Before
maxAge: 24 * 60 * 60 * 1000
// After
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
maxAge: TOKEN_MAX_AGE_MS
```

---

## 환경 변수

**`backend/.env`**
```
MONGO_URI=
JWT_SECRET=
PORT=3000
FRONTEND_URL=
ADMIN_KEY=
AI_SERVER_URL=http://localhost:8000
NODE_ENV=development
```

**`AI/.env`**
```
OPENAI_API_KEY=
GOOGLE_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX_NAME_MEETING=
GEMINI_MODEL=gemini-2.5-flash
```
