// Unitdex Korean Language Pack
window.UNITDEX_LANG_KR = {
    // UI Labels
    title: "유닛 도감",
    category_all: "전체",
    category_infantry: "보병",
    category_armored: "기갑",
    category_air: "공중",
    category_drone: "드론",
    category_special: "특수",
    close: "닫기",

    // Stat Labels (Korean)
    stat_hp: "체력",
    stat_dmg: "공격력",
    stat_range: "사거리",
    stat_speed: "이동속도",
    stat_cost: "비용",
    stat_mobility: "기동력",
    stat_cooldown: "쿨타임",
    stat_max: "최대",

    // Unit Data (name, role, desc)
    units: {
        infantry: {
            name: "민병대",
            role: "기본 민병",
            desc: "저렴한 비용으로 전선을 유지하는 기본 민병대입니다."
        },
        rpg: {
            name: "로켓병",
            role: "대전차/대공",
            desc: "지상과 공중의 장갑 목표물을 타격합니다."
        },
        special_forces: {
            name: "보병",
            role: "주력 보병",
            desc: "높은 체력과 연사력을 갖춘 전열 보병입니다."
        },
        special_ops: {
            name: "특수부대",
            role: "고성능 돌격",
            desc: "전술 장비를 갖춘 정예 보병. 기동성과 생존력이 높습니다."
        },
        sniper: {
            name: "저격수",
            role: "초장거리 저격",
            desc: "매우 긴 사거리와 높은 단발 화력을 가지지만 발사 간격이 길다."
        },
        humvee: {
            name: "험비",
            role: "고속 기동",
            desc: "빠른 속도로 치고 빠지며 보병을 제압합니다."
        },
        apc: {
            name: "장갑차",
            role: "전투 수송",
            desc: "피격 시 즉시 보병 4명을 하차시키고 전투를 지속합니다."
        },
        aa_tank: {
            name: "대공전차",
            role: "대공 방어",
            desc: "강력한 유도 미사일로 항공기를 격추합니다."
        },
        mbt: {
            name: "전차",
            role: "주력 전차",
            desc: "높은 체력과 화력으로 전선을 돌파합니다."
        },
        spg: {
            name: "자주포",
            role: "장거리 포격",
            desc: "매우 긴 사거리에서 광역 포격을 가합니다."
        },
        icbm: {
            name: "ICBM 미사일차량",
            role: "전략 미사일 발사",
            desc: "핵/전술/EMP 미사일을 선택 발사하는 전략 TEL 차량입니다."
        },
        fighter: {
            name: "전투기",
            role: "제공권 장악",
            desc: "적 항공기(헬기, 폭격기)만 전문적으로 요격합니다. (드론 불가)"
        },
        apache: {
            name: "아파치",
            role: "지상 지원",
            desc: "로켓으로 지상군을 지속적으로 공격합니다."
        },
        blackhawk: {
            name: "블랙호크",
            role: "보병 투입",
            desc: "지정 지점으로 이동해 보병 4명을 투입하고, 근접 드론을 플레어로 무력화합니다."
        },
        chinook: {
            name: "치누크",
            role: "혼성 보병 투입",
            desc: "지정 지점으로 이동해 보병 4명, RPG병 1명, 저격수 1명, 특수부대 2명을 투입하고 상공으로 이탈합니다."
        },
        bomber: {
            name: "폭격기",
            role: "전략 폭격",
            desc: "고고도 융단 폭격. 대공 미사일에만 피격됩니다."
        },
        recon: {
            name: "정찰기",
            role: "정찰 지원",
            desc: "고고도 정찰 드론. 명령탭에서 적군 전력을 분석합니다."
        },
        drone_operator: {
            name: "드론병",
            role: "드론 운용",
            desc: "아군 건물 뒤에서 정지해 적을 감지하면 드론을 1회 발진한다. 드론 소멸 후에는 소총으로 전투에 참여한다."
        },
        drone_suicide: {
            name: "자폭드론",
            role: "자폭 공격",
            desc: "보병/경장갑을 향해 돌진해 폭발하는 1회용 드론. (드론병이 소환)"
        },
        drone_at: {
            name: "AT드론",
            role: "대전차",
            desc: "장갑/건물을 우선 타격한다. 전술급 폭발로 광역 피해를 준다. (드론병이 소환)"
        },
        tactical_drone: {
            name: "전술드론",
            role: "정밀 타격",
            desc: "지정된 대상을 끝까지 추적하여 파괴합니다."
        },
        stealth_drone: {
            name: "스텔스드론",
            role: "고고도 강습",
            desc: "지정 지점으로 고고도 침투 후 급강하 폭발합니다 (광역 피해)."
        },
        bomber_drone: {
            name: "폭격드론",
            role: "폭격/귀환",
            desc: "목표 지점 폭격 후 귀환합니다. 생존 시 재고 회복."
        },
        emp: {
            name: "EMP미사일",
            role: "광역 마비",
            desc: "ICBM 발사차량에서 발사되는 광역 마비 EMP 미사일입니다."
        },
        nuke: {
            name: "핵미사일",
            role: "대량 살상",
            desc: "ICBM 발사차량 전용 핵미사일로 광범위 지역을 초토화합니다."
        },
        tactical_missile: {
            name: "전술미사일",
            role: "정밀 타격",
            desc: "ICBM 발사차량 전용 정밀 타격 미사일입니다."
        }
    }
};
