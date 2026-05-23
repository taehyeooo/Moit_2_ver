const express = require('express');
const router = express.Router();
const axios = require('axios');
const SurveyResult = require('../models/SurveyResult');
const User = require('../models/User');
const { verifyToken } = require('../utils/auth');
const { isMockMode, MOCK_SURVEY_RESPONSE } = require('../utils/mockAI');

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

// AI 서버에 추천 요청
router.post('/recommend', verifyToken, async (req, res) => {
    try {
        // 목 모드
        if (isMockMode()) {
            console.log("[MOCK] 취미 추천 목 데이터 반환");
            return res.json(MOCK_SURVEY_RESPONSE);
        }

        const { answers } = req.body;
        const aiBaseUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';

        // 변환 없이 원본 응답을 그대로 전달 — 변환 책임은 AI 서버(utils/survey.py)가 담당
        const agentResponse = await axios.post(`${aiBaseUrl}/agent/invoke`, {
            user_input: { survey_raw: answers }
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
