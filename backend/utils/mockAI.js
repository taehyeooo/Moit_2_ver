const isMockMode = () => process.env.USE_MOCK_AI === 'true';

const MOCK_SURVEY_RESPONSE = {
    summary: "활동적이고 창의적인 성향의 사용자님께 어울리는 취미를 추천해드립니다.",
    recommendations: [
        {
            name_ko: "수채화 그리기",
            short_desc: "물과 색의 흐름으로 표현하는 감성 예술",
            reason: "창의적 표현에 대한 관심도와 차분한 환경 선호도를 고려했습니다.",
            score_total: 92,
            category: "예술"
        },
        {
            name_ko: "보드게임 모임",
            short_desc: "전략과 유머가 어우러지는 소셜 게임",
            reason: "소규모 그룹 활동 선호와 지적 자극에 대한 관심도가 높습니다.",
            score_total: 88,
            category: "사교"
        },
        {
            name_ko: "홈 베이킹",
            short_desc: "직접 만드는 달콤한 성취감",
            reason: "실내 활동 선호도와 창작 활동에 대한 흥미가 잘 맞습니다.",
            score_total: 85,
            category: "요리"
        }
    ]
};

module.exports = { isMockMode, MOCK_SURVEY_RESPONSE };
