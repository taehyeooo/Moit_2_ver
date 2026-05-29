### 2. `Progress.md` (프로젝트 진행 트래커)
파일 위치: 루트 디렉토리 최상단 (`/Progress.md`)

```markdown
# 🚀 MOIT v2.0 Backend & AI - Progress Tracker

> **목적:** AI와의 대화 시 토큰 절약 및 프로젝트 상태 동기화를 위한 핵심 문서
> **마지막 업데이트:** 2026-05-30 — AI 서버 axios 타임아웃 + survey/meeting To-Do 재검토

## 📌 현재 개발 목표 (Current Sprint)
- Node.js 백엔드 코드의 기술 부채(하드코딩, 중복 코드) 해결
- 미완성된 AI 멀티모달(사진 분석) 파이프라인 완벽 연동 및 안정성 강화
- AI 기반 백엔드 아키텍처 포트폴리오 스펙으로 고도화

## ✅ 완료된 작업 (Done)
- [x] v1.0(해커톤 수상작) 레포지토리 복제 및 분리 완료
- [x] 새로운 GitHub 레포지토리에 v1.0 초기 소스코드 푸시 완료
- [x] 성능 최적화: 마이페이지 모임 조회 순차 → Promise.all 병렬 처리
- [x] 성능 최적화: 게시글 조회수 증가 findById+save → findByIdAndUpdate() 원자적 처리
- [x] 성능 최적화: 관리자 게시글 목록 API 페이지네이션 추가
- [x] 성능 최적화: 모임 참여/탈퇴 DB 왕복 횟수 감소 (원자적 업데이트)
- [x] 리팩토링: 로그인 dead code 및 존재하지 않는 필드 참조 제거
- [x] 리팩토링: `admin.js` 내 중복 `verifyAdmin` 미들웨어 → `utils/auth.js`로 이전 통합
- [x] 버그수정: 모임 삭제 시 `uploads/` 디렉토리 이미지 파일 동시 삭제 로직 추가
- [x] 보안확인: 계정 삭제 API — 이미 `verifyToken` + 본인/관리자 권한 확인 적용됨
- [x] 보안확인: CORS — 이미 `CLIENT_URL` 환경 변수로 관리됨

## 📍 진행 중인 작업 (In Progress)
- [ ] 로컬 개발 환경 세팅 (Node.js 패키지 설치 및 `.env` 복구)

## ⏳ 대기 중인 작업 (To-Do)

**[백엔드 (Node.js) 리팩토링]**
- [x] `survey.js` JWT 중복 — 이미 `utils/auth.js`의 `verifyToken` 사용 중 (코드 확인 완료)

**[AI 파이프라인 (Node.js ↔ FastAPI) 고도화]**
- [x] 사진 파이프라인 — `survey.js`에서 이미 base64 변환 후 AI 서버 전송 구현됨 (코드 확인 완료)
- [x] AI 서버 `tenacity` Retry 로직 실적용 — `hobby.py`(Gemini), `search.py`(OpenAI) 이미 완료, `master.py` 라우터 LLM에 2회 재시도 추가
- [x] AI 서버 타임아웃 설정 — `master.py` (10s), `search.py` (30s) ChatOpenAI timeout 추가
- [x] 백엔드 → AI 서버 axios 타임아웃 추가 — `survey.js` (60s), `meeting.js` agent/invoke (30s), meetings/add (10s), meetings/delete (10s)

## 🛠️ 환경 변수 상태 (.env) - (실제 값은 로컬에만 보관)
**Backend (`backend/.env`)**
- `MONGO_URI`: 세팅 대기 중
- `JWT_SECRET`: 세팅 대기 중
- `PORT`: 세팅 대기 중 (기본 3000)
- `FRONTEND_URL`: 세팅 대기 중

**AI Server (`AI/.env`)**
- `OPENAI_API_KEY`: 세팅 대기 중
- `GEMINI_API_KEY`: 세팅 대기 중
- `PINECONE_API_KEY`: 세팅 대기 중