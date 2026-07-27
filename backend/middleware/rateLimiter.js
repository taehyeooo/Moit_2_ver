const rateLimit = require('express-rate-limit');

// 전체 API 공통 기본 방어선 — 단일 IP가 비정상적으로 많은 요청을 보내는 상황을 차단
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
});

// GPT-4o-mini / Gemini 등 외부 AI 모델을 호출하는 라우트 전용 한도.
// 호출당 응답 지연이 길고(최대 60초) 비용이 발생하므로 일반 API보다 훨씬 낮게 제한한다.
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'AI 요청이 너무 많습니다. 15분 후 다시 시도해주세요.' }
});

module.exports = { apiLimiter, aiLimiter };
