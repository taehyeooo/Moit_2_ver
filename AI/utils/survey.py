"""
설문 응답 변환 유틸리티

프론트엔드의 텍스트/숫자 응답(Q1, Q2 ...)을
AI 분석용 숫자 인덱스({"1": 2, "2": 3, ...})로 변환합니다.

백엔드는 변환 없이 원본 응답을 그대로 전달하고,
변환 책임은 AI 서버가 단독으로 담당합니다.
"""

Q1_OPTS  = ['1시간 미만', '1시간 ~ 3시간', '3시간 ~ 5시간', '5시간 이상']
Q2_OPTS  = ['거의 없음 또는 3만원 미만', '3만원 ~ 5만원', '5만원 ~ 10만원', '10만원 이상']
Q5_OPTS  = ['오랜 시간 앉아 있거나 서 있는 것이 힘들다.', '계단을 오르거나 조금만 걸어도 숨이 차다.', '만성적인 통증이나 피로감이 있다.', '딱히 신체적인 어려움은 없다.']
Q6_OPTS  = ['익숙하고 안전한 집 안에서 할 수 있는 활동', '집 근처에서 가볍게 할 수 있는 야외 활동', '새로운 장소를 찾아가는 활동']
Q12_OPTS = ['활동에 집중할 수 있는 독립된 공간이 있다.', '공용 공간을 사용해야 해서 제약이 있다.', '층간 소음 등 주변 환경이 신경 쓰인다.', '공간이 협소하여 활동에 제약이 있다.']
Q21_OPTS = ['거의 방에서만 시간을 보냈다.', '집 안에서는 활동하지만 외출은 거의 하지 않았다.', '편의점 방문 등 필수적인 용무로만 잠시 외출했다.', '산책 등 혼자 하는 활동을 위해 외출한 적이 있다.', '다른 사람과 만나는 활동을 위해 외출한 적이 있다.']
Q31_OPTS = ['성취: 새로운 기술을 배우고 실력이 느는 것을 확인하는 것', '회복: 복잡한 생각에서 벗어나 편안하게 재충전하는 것', '연결: 좋은 사람들과 교류하며 소속감을 느끼는 것', '활력: 몸을 움직여 건강해지고 에너지를 얻는 것']
Q39_OPTS = ['단독형: 누구에게도 방해받지 않는 나만의 공간에서 혼자 하는 활동', '병렬형: 다른 사람들이 주변에 있지만, 각자 자기 활동에 집중하는 조용한 공간 (예: 도서관, 카페)', '저강도 상호작용형: 선생님이나 안내자가 활동을 이끌어주는 소규모 그룹 (예: 강좌, 워크숍)', '고강도 상호작용형: 공통의 목표를 위해 협력하거나 자유롭게 소통하는 모임 (예: 동호회, 팀 스포츠)']
Q40_OPTS = ['마음이 잘 맞는 단 한 명의 파트너와 함께하는 것', '3~4명 정도의 소규모 그룹', '다양한 사람들을 만날 수 있는 대규모 그룹']


def _get_num(answers: dict, key: str, default: int = 3) -> int:
    val = answers.get(key)
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _get_choice_idx(answers: dict, key: str, options: list, default: int = 3) -> int:
    val = answers.get(key)
    if not val:
        return default
    try:
        return options.index(val) + 1
    except ValueError:
        return default


def convert_raw_answers(answers: dict) -> dict:
    """
    프론트엔드 설문 응답을 AI 분석용 숫자 인덱스로 변환합니다.

    Args:
        answers: 프론트엔드 원본 응답 {"Q1": "1시간 ~ 3시간", "Q3": 4, ...}

    Returns:
        숫자 인덱스 변환 결과 {"1": 2, "3": 4, ...}
    """
    return {
        "1":  _get_choice_idx(answers, "Q1",  Q1_OPTS),
        "2":  _get_choice_idx(answers, "Q2",  Q2_OPTS),
        "3":  _get_num(answers, "Q3"),
        "4":  _get_num(answers, "Q4"),
        "5":  _get_choice_idx(answers, "Q5",  Q5_OPTS),
        "6":  _get_choice_idx(answers, "Q6",  Q6_OPTS),
        "12": _get_choice_idx(answers, "Q12", Q12_OPTS),
        "13": _get_num(answers, "Q13"),
        "14": _get_num(answers, "Q14"),
        "15": _get_num(answers, "Q15"),
        "16": _get_num(answers, "Q16"),
        "18": _get_num(answers, "Q18"),
        "20": _get_num(answers, "Q20"),
        "21": _get_choice_idx(answers, "Q21", Q21_OPTS),
        "27": _get_num(answers, "Q27"),
        "29": _get_num(answers, "Q29"),
        "31": _get_choice_idx(answers, "Q31", Q31_OPTS),
        "33": _get_num(answers, "Q33"),
        "34": _get_num(answers, "Q34"),
        "35": _get_num(answers, "Q35"),
        "36": _get_num(answers, "Q36"),
        "37": _get_num(answers, "Q37"),
        "38": _get_num(answers, "Q38"),
        "39": _get_choice_idx(answers, "Q39", Q39_OPTS),
        "40": _get_choice_idx(answers, "Q40", Q40_OPTS),
        "41": _get_num(answers, "Q41"),
        "42": _get_num(answers, "Q42"),
        "43": _get_num(answers, "Q43"),
        "44": _get_num(answers, "Q44"),
        "45": _get_num(answers, "Q45"),
        "46": _get_num(answers, "Q46"),
        "47": _get_num(answers, "Q47"),
    }
