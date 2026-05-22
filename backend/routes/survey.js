const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SurveyResult = require('../models/SurveyResult');
const User = require('../models/User');
const axios = require('axios');

// --- JWT 인증 미들웨어 ---
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: '인증이 필요합니다.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
};

// --- API 라우트 ---

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
      { userId: userId },
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

// Python AI 서버에 추천을 요청하는 API
router.post('/recommend', verifyToken, async (req, res) => {
    try {
        const { answers } = req.body;
        
        const aiBaseUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';
        const aiAgentUrl = `${aiBaseUrl}/agent/invoke`;
        
        console.log(`AI 에이전트 서버(${aiAgentUrl})로 추천 요청을 보냅니다...`);

        // 답변 변환 로직
        const getNum = (key) => Number(answers[key]) || 3;
        const getChoiceIdx = (key, options) => {
            const val = answers[key];
            if (!val) return 3;
            const idx = options.indexOf(val);
            return idx !== -1 ? idx + 1 : 3;
        };

        const q1_opts = ['1시간 미만', '1시간 ~ 3시간', '3시간 ~ 5시간', '5시간 이상'];
        const q2_opts = ['거의 없음 또는 3만원 미만', '3만원 ~ 5만원', '5만원 ~ 10만원', '10만원 이상'];
        const q5_opts = ['오랜 시간 앉아 있거나 서 있는 것이 힘들다.', '계단을 오르거나 조금만 걸어도 숨이 차다.', '만성적인 통증이나 피로감이 있다.', '딱히 신체적인 어려움은 없다.'];
        const q6_opts = ['익숙하고 안전한 집 안에서 할 수 있는 활동', '집 근처에서 가볍게 할 수 있는 야외 활동', '새로운 장소를 찾아가는 활동'];
        const q12_opts = ['활동에 집중할 수 있는 독립된 공간이 있다.', '공용 공간을 사용해야 해서 제약이 있다.', '층간 소음 등 주변 환경이 신경 쓰인다.', '공간이 협소하여 활동에 제약이 있다.'];
        const q21_opts = ['거의 방에서만 시간을 보냈다.', '집 안에서는 활동하지만 외출은 거의 하지 않았다.', '편의점 방문 등 필수적인 용무로만 잠시 외출했다.', '산책 등 혼자 하는 활동을 위해 외출한 적이 있다.', '다른 사람과 만나는 활동을 위해 외출한 적이 있다.'];
        const q31_opts = ['성취: 새로운 기술을 배우고 실력이 느는 것을 확인하는 것', '회복: 복잡한 생각에서 벗어나 편안하게 재충전하는 것', '연결: 좋은 사람들과 교류하며 소속감을 느끼는 것', '활력: 몸을 움직여 건강해지고 에너지를 얻는 것'];
        const q39_opts = ['단독형: 누구에게도 방해받지 않는 나만의 공간에서 혼자 하는 활동', '병렬형: 다른 사람들이 주변에 있지만, 각자 자기 활동에 집중하는 조용한 공간 (예: 도서관, 카페)', '저강도 상호작용형: 선생님이나 안내자가 활동을 이끌어주는 소규모 그룹 (예: 강좌, 워크숍)', '고강도 상호작용형: 공통의 목표를 위해 협력하거나 자유롭게 소통하는 모임 (예: 동호회, 팀 스포츠)'];
        const q40_opts = ['마음이 잘 맞는 단 한 명의 파트너와 함께하는 것', '3~4명 정도의 소규모 그룹', '다양한 사람들을 만날 수 있는 대규모 그룹'];

        const surveyPayload = {
            "1": getChoiceIdx("Q1", q1_opts),
            "2": getChoiceIdx("Q2", q2_opts),
            "3": getNum("Q3"), "4": getNum("Q4"),
            "5": getChoiceIdx("Q5", q5_opts), "6": getChoiceIdx("Q6", q6_opts),
            "12": getChoiceIdx("Q12", q12_opts),
            "13": getNum("Q13"), "14": getNum("Q14"), "15": getNum("Q15"), "16": getNum("Q16"),
            "18": getNum("Q18"), "20": getNum("Q20"), 
            "21": getChoiceIdx("Q21", q21_opts),
            "27": getNum("Q27"), "29": getNum("Q29"),
            "31": getChoiceIdx("Q31", q31_opts),
            "33": getNum("Q33"), "34": getNum("Q34"), "35": getNum("Q35"), 
            "36": getNum("Q36"), "37": getNum("Q37"), "38": getNum("Q38"),
            "41": getNum("Q41"), "42": getNum("Q42"),
            "39": getChoiceIdx("Q39", q39_opts),
            "40": getChoiceIdx("Q40", q40_opts),
            "43": getNum("Q43"), "44": getNum("Q44"), "45": getNum("Q45"), 
            "46": getNum("Q46"), "47": getNum("Q47")
        };

        const payload = {
            user_input: {
                survey: surveyPayload
            }
        };
        
        const agentResponse = await axios.post(aiAgentUrl, payload);
        console.log('AI 에이전트로부터 응답을 받았습니다.');

        let finalAnswer = agentResponse.data.final_answer;

        // [수정] AI가 에러 메시지를 보냈는지 먼저 확인
        if (typeof finalAnswer === 'string' && finalAnswer.startsWith("오류:")) {
            console.error("AI 서버 처리 실패:", finalAnswer);
            return res.status(500).json({ message: finalAnswer }); // 프론트엔드에 에러 내용 전달
        }

        // JSON 파싱 시도
        if (typeof finalAnswer === 'string') {
            try {
                finalAnswer = finalAnswer.replace(/```json\n|\n```/g, '').trim();
                finalAnswer = JSON.parse(finalAnswer);
            } catch (e) {
                console.error("AI 응답 파싱 실패:", e);
                // 파싱 실패 시 에러 반환
                return res.status(500).json({ message: "AI 응답 형식이 올바르지 않습니다.", raw: finalAnswer });
            }
        }
        
        res.json(finalAnswer);

    } catch (error) {
        console.error("AI 에이전트 호출 중 심각한 오류 발생!");
        if (axios.isAxiosError(error)) {
            if (error.response) {
                console.error("AI 에이전트 응답 상태:", error.response.status);
                return res.status(500).json({ message: `AI 에이전트 오류: ${error.response.status}` });
            } 
            else if (error.request) {
                return res.status(500).json({ message: "AI 추천 에이전트에 연결할 수 없습니다." });
            }
        }
        console.error("알 수 없는 오류:", error.message);
        res.status(500).json({ message: "AI 추천 요청 처리 중 문제가 발생했습니다." });
    }
});

module.exports = router;