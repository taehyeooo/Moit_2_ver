require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── 보안 헤더 ────────────────────────────────────────
app.use(helmet());

// ─── 요청 로깅 ───────────────────────────────────────
app.use(morgan("dev"));

// ─── CORS ────────────────────────────────────────────
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}));

// ─── 바디 파서 / 쿠키 ─────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── 정적 파일 ───────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Rate Limiting (인증 라우트) ──────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "요청이 너무 많습니다. 15분 후 다시 시도해주세요." }
});

// ─── 라우트 ──────────────────────────────────────────
const userRoutes    = require("./routes/user");
const contactRoutes = require("./routes/contact");
const postRoutes    = require("./routes/post");
const uploadRoutes  = require("./routes/upload");
const surveyRoutes  = require("./routes/survey");
const meetingRoutes = require("./routes/meeting");
const statsRoutes   = require("./routes/stats");
const adminRoutes   = require("./routes/admin");

app.use("/api/auth",     authLimiter, userRoutes);
app.use("/api/contact",  contactRoutes);
app.use("/api/post",     postRoutes);
app.use("/api/upload",   uploadRoutes);
app.use("/api/survey",   surveyRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/stats",    statsRoutes);
app.use("/api/admin",    adminRoutes);

app.get("/", (req, res) => res.send("OK"));

// ─── 전역 에러 핸들러 ─────────────────────────────────
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: '파일 크기는 5MB 이하여야 합니다.' });
    }
    if (err.message && err.message.includes('이미지 파일만')) {
        return res.status(400).json({ message: err.message });
    }
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    res.status(err.status || 500).json({
        message: err.message || "서버 내부 오류가 발생했습니다."
    });
});

// ─── DB 연결 & 서버 시작 ──────────────────────────────
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB와 성공적으로 연결되었습니다."))
    .catch((error) => console.log("❌ MongoDB 연결에 실패했습니다: ", error));

app.listen(PORT, () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    if (process.env.USE_MOCK_AI === 'true') {
        console.log("🤖 [MOCK] AI 목 데이터 모드 활성화");
    }
});
