const express = require('express');
const router = express.Router();
const fs = require('fs');
const axios = require('axios');
const SurveyResult = require('../models/SurveyResult');
const User = require('../models/User');
const { verifyToken } = require('../utils/auth');
const { isMockMode, MOCK_SURVEY_RESPONSE } = require('../utils/mockAI');
const upload = require('../middleware/upload');

// 기존 설문 결과 조회
router.get('/', verifyToken, async (req, res) => {
    try {
        const result = await SurveyResult.findOne({ userId: req.user.userId });
        if (!result) {
            return res.status(404).json({ message: '저장된 설문 결과가 없습니다.' });
        }
        res.json(result);
    } catch (error) {
        console.error("Survey GET Error:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 설문 결과 저장
router.post('/', verifyToken, async (req, res) => {
    try {
        const { answers, recommendations } = req.body;
        const userId = req.user.userId;

        const result = await SurveyResult.findOneAndUpdate(
            { userId },
            { userId, answers, recommendations },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        await User.findByIdAndUpdate(userId, { surveyResult: result._id });

        res.status(201).json(result);
    } catch (error) {
        console.error("Survey POST Error:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// AI 서버에 추천 요청 (사진 선택 첨부 가능)
router.post('/recommend', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        // 목 모드
        if (isMockMode()) {
            console.log("[MOCK] 취미 추천 목 데이터 반환");
            if (req.file) fs.unlinkSync(req.file.path); // 임시 파일 정리
            return res.json(MOCK_SURVEY_RESPONSE);
        }

        const aiBaseUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';

        // FormData 전송 시 answers가 JSON 문자열로 옴, JSON 전송 시 객체로 옴
        const rawAnswers = req.body.answers;
        const answers = typeof rawAnswers === 'string'
            ? JSON.parse(rawAnswers)
            : rawAnswers;

        const payload = { survey_raw: answers };

        // 사진이 첨부된 경우 base64로 변환하여 AI 서버에 전달
        if (req.file) {
            const imageBuffer = fs.readFileSync(req.file.path);
            payload.image_base64_list = [imageBuffer.toString('base64')];
            fs.unlinkSync(req.file.path); // 전송 후 임시 파일 삭제
            console.log(`사진 첨부 감지 — base64 변환 완료 (${req.file.originalname})`);
        }

        // 변환 책임은 AI 서버(utils/survey.py)가 담당
        const agentResponse = await axios.post(`${aiBaseUrl}/agent/invoke`, {
            user_input: payload
        });

        let finalAnswer = agentResponse.data.final_answer;

        if (typeof finalAnswer === 'string' && finalAnswer.startsWith("오류:")) {
            return res.status(500).json({ message: finalAnswer });
        }

        if (typeof finalAnswer === 'string') {
            try {
                finalAnswer = JSON.parse(finalAnswer.replace(/```json\n|\n```/g, '').trim());
            } catch (e) {
                console.error("AI 응답 파싱 실패:", e);
                return res.status(500).json({ message: "AI 응답 형식이 올바르지 않습니다." });
            }
        }

        res.json(finalAnswer);

    } catch (error) {
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        if (axios.isAxiosError(error)) {
            if (error.response) {
                return res.status(500).json({ message: `AI 에이전트 오류: ${error.response.status}` });
            }
            return res.status(500).json({ message: "AI 추천 에이전트에 연결할 수 없습니다." });
        }
        console.error("AI 추천 오류:", error.message);
        res.status(500).json({ message: "AI 추천 요청 처리 중 문제가 발생했습니다." });
    }
});

module.exports = router;
