# MOIT v2.0 개발 진행 트래커

## 진행 상황

### ✅ 완료
- [x] v1.0 코드 새 레포 클론 및 VS Code 세팅
- [x] 백엔드 로컬 개발 환경 초기 세팅 (.env 구성 완료)
- [x] 백엔드 서버 정상 기동 확인 (MongoDB Atlas 연결 성공, 포트 3000)
- [x] 프론트엔드 로컬 환경 세팅 (Vite, 포트 5173)
- [x] 백엔드 v1.0 → v2.0 리팩토링
  - [x] 보안 강화 (helmet, rate-limit, multer 파일 검증)
  - [x] 전역 에러 핸들러 + morgan 로깅 적용
  - [x] 공용 upload 미들웨어 통합 (post/meeting/upload)
  - [x] 중복 verifyToken 제거 (survey.js)
  - [x] 계정 삭제 API 인증 가드 누락 패치
  - [x] AI 목 데이터 모드 적용 (USE_MOCK_AI=true)
  - [x] AI 스마트 검색 → MongoDB 텍스트 검색 폴백

- [x] AI 서버 v1.0 → v2.0 리팩토링 (포폴 품질)
  - [x] 설문 변환 로직 분리 (`AI/utils/survey.py`)
  - [x] 단일 파일 → 모듈 분리 (`agents/hobby.py`, `agents/search.py`, `agents/master.py`)
  - [x] Tenacity 재시도 로직 (`_call_gemini_with_retry`, `_run_agent_with_retry`)
  - [x] 멀티모달 사진 업로드 파이프라인 완성 (프론트 → 백엔드 → AI 서버)

### 📋 Todo
- [ ] 프론트엔드: 설문 화면에 사진 첨부 UI 추가 (FormData로 /api/survey/recommend 요청)
- [ ] Python AI 서버 연동 (API 키 발급 후: OpenAI, Gemini, Pinecone, Tavily)
- [ ] CLAUDE.md 프로젝트 컨텍스트 작성
- [ ] v2.0 기능 개발 시작
