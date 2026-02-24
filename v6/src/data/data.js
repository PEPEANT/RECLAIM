// [FILE] data.js: ?? ?? ??(CONFIG)? ??/??/?? ??? ???.
const CONFIG = {
    mapWidth: 6000,
    baseMapWidth: 6000,
    defenseExtraWidth: 1200,
    forwardDefenseOffset: 400,
    groundHeight: 300,
    startSupply: 1500,
    supplyRate: 2.0,
    maxSupply: 2500,

    buildings: {
        // 🛰️ 후방 HQ (공중 요격만)
        hq_player: {
            hp: 5000, width: 200, height: 140, name: '총사령부', canShoot: true, antiAir: true, onlyAir: true,
            damage: 80, range: 1300, rate: 34, projectileType: 'aa_shell',
            yOffset: -10,
        },
        hq_enemy: {
            hp: 5000, width: 200, height: 140, name: '총사령부', canShoot: true, antiAir: true, onlyAir: true,
            damage: 80, range: 1300, rate: 34, projectileType: 'aa_shell',
            yOffset: -10,
        },

        // 🧱 전방 방어요새 (공격 불가/요격 없음)
        // [TUNE] 요새 크기 더 축소(절반급)
        fortress_player: {
            hp: 3600, width: 160, height: 120, name: '방어요새', canShoot: false, antiAir: false,
            yOffset: 8, hpBarOffsetY: 35,
        },
        fortress_enemy: {
            hp: 3600, width: 160, height: 120, name: '방어요새', canShoot: false, antiAir: false,
            yOffset: 8, hpBarOffsetY: 35,
        },

        // 🧱 도시 전방 방어선 (플레이어 전용, 저지용)
        defense_line: {
            hp: 1008, width: 320, height: 140, name: '전방 방어선',
            canShoot: true, antiAir: false,
            damage: 14, range: 720, rate: 14, projectileType: 'bullet',
            allowAir: true, ignoreDrone: true, airDamageMult: 0.35,
            yOffset: 6, hpBarOffsetY: 45,
        },

        // 🔭 감시탑 (지상 약공격 / 드론 요격 불가 / 공중엔 약하게만)
        watchtower: {
            hp: 1200, width: 60, height: 80, name: '감시탑',
            canShoot: true, antiAir: false,
            damage: 8, range: 620, rate: 12, projectileType: 'bullet',
            allowAir: true, ignoreDrone: true, airDamageMult: 0.35,
            yOffset: 0,
        },
        // [CAMPAIGN][C] 점령전 HQ 미존재 맵에서 HQ 대체 생산 거점
        spawn_flag_player: {
            hp: 2200, width: 72, height: 96, name: '전개 깃발',
            canShoot: false,
            yOffset: 0,
            hpBarOffsetY: 18
        },
        bunker: { hp: 2000, width: 80, height: 60, color: '#475569', name: '전술 벙커', damage: 25, range: 520, rate: 30 },
        turret: { hp: 1500, width: 50, height: 60, color: '#64748b', name: 'CIWS 포탑', damage: 12, range: 760, rate: 8, antiAir: true }
    },

    // ============================================
    // [NEW] 건설 가능 건물 정의 (작업자가 건설)
    // 감시탑(watchtower)만 건설 가능 - 기존 디자인 사용
    // ============================================
    constructable: {
        watchtower: {
            id: 'watchtower',
            name: '감시탑',
            hp: 1200,
            width: 60,
            height: 80,
            buildTime: 180,      // 3초
            cooldown: 120,       // 2초 쿨타임
            cost: 150,
            footprint: { w: 80, h: 20 },
            canShoot: true,
            damage: 8,
            range: 620,
            rate: 12,
            projectileType: 'bullet',
        }
    },

    units: {
        // [INFANTRY]
        // [NEW] 작업자 (건설 유닛)
        worker: {
            id: 'worker', name: '작업자', cost: 50, cooldown: 60, maxCount: 1,
            hp: 80, damage: 0, range: 0, speed: 1.0,
            width: 18, height: 28, color: '#facc15', type: 'bio', category: 'infantry',
            role: '건설 유닛', description: '건물을 건설할 수 있는 작업자입니다. 전투 능력이 없습니다.',
            isBuilder: true,  // 건설 가능 플래그
            hideFromUnitBar: true, hideFromUnitDex: true, disabled: true
        },
        infantry: {
            id: 'infantry', name: '보병', cost: 30, cooldown: 25, maxCount: 40,
            hp: 80, damage: 12, range: 250, speed: 0.9,
            width: 15, height: 25, color: '#60a5fa', type: 'bio', category: 'infantry',
            role: '기본 보병', description: '전선을 유지하는 기본 보병입니다.'
        },
        bagpiper: {
            id: 'bagpiper', name: '백파이프병', cost: 30, cooldown: 70, maxCount: 1,
            hp: 80, damage: 0, range: 0, speed: 0.9,
            width: 16, height: 26, color: '#60a5fa', type: 'bio', category: 'infantry',
            role: '전투 치유 지원', description: '공격하지 않고 백파이프 연주로 주변 아군 보병을 치유합니다.',
            bagpipeSkill: true,
            bagpipeHealRadius: 180,
            bagpipeHealFlat: 2,
            bagpipeHealTickFrames: 30
        },
        engineer: {
            id: 'engineer', name: '공병', cost: 30, cooldown: 20, maxCount: 12,
            hp: 60, damage: 15, range: 180, missileRange: 620, missileDamage: 80, speed: 0.7,
            width: 14, height: 22, color: '#f87171', type: 'bio', antiAir: true, category: 'infantry',
            role: '대전차/대공', description: '보병에겐 기관총, 기갑/공중에겐 유도 미사일로 공격합니다.',
            hasMissile: true, missileCount: 1, missileAimFrames: 54
        },
        // [NEW] 병영 신규 유닛
        sniper: {
            id: 'sniper', name: '저격수', cost: 667, cooldown: 220, maxCount: 4,
            hp: 90, damage: 180, range: 860, speed: 0.62,
            width: 16, height: 26, color: '#334155', type: 'bio', category: 'infantry',
            role: '초장거리 저격', description: '매우 긴 사거리와 높은 단발 화력을 가지지만 발사 간격이 길다.',
            targetScanInterval: 12,
            antiArmorMult: 0.16
        },
        special_ops: {
            id: 'special_ops', name: '특수부대', cost: 417, cooldown: 90, maxCount: 8,
            hp: 200, damage: 30, range: 220, speed: 1.15,
            width: 16, height: 26, color: '#0f172a', type: 'bio', category: 'infantry',
            role: '고성능 돌격', description: '전술 장비를 갖춘 정예 보병. 기동성과 생존력이 높다.'
        },

        // [ARMORED]
        humvee: {
            id: 'humvee', name: '험비', cost: 45, cooldown: 100, maxCount: 15,
            hp: 200, damage: 15, range: 250, speed: 1.5,
            width: 45, height: 28, color: '#14b8a6', type: 'mech', category: 'armored',
            role: '고속 기동', description: '빠른 속도로 치고 빠지며 보병을 제압합니다.'
        },
        apc: {
            id: 'apc', name: 'M2 브래들리 IFV', cost: 65, cooldown: 130, maxCount: 12,
            hp: 430, damage: 16, range: 260, speed: 0.95,
            missileRange: 900, missileDamage: 140, missileCooldownFrames: 150,
            width: 66, height: 40, color: '#6366f1', type: 'mech', category: 'armored',
            role: '보병전투장갑차', description: '25mm 기관포로 제압하고 TOW 미사일로 적 기갑/시설을 타격합니다.'
        },
        mbt: {
            id: 'mbt', name: '전차', cost: 85, cooldown: 180, maxCount: 12,
            hp: 800, damage: 90, range: 480, speed: 0.4,
            width: 80, height: 52, color: '#22c55e', type: 'mech', category: 'armored',
            role: '주력 전차', description: '높은 체력과 화력으로 전선을 돌파합니다.'
        },
        spg: {
            id: 'spg', name: '자주포', cost: 160, cooldown: 400, maxCount: 6,
            hp: 200, damage: 150, range: 1000, speed: 0.3,
            width: 78, height: 48, color: '#fb923c', type: 'mech', category: 'armored',
            role: '장거리 포격', description: '매우 긴 사거리에서 광역 포격을 가합니다.'
        },
        icbm: {
            id: 'icbm', name: 'ICBM 미사일차량', cost: 260, cooldown: 420, maxCount: 2,
            hp: 1400, damage: 0, range: 0, speed: 0.42,
            icbmAmmo: 3,
            width: 150, height: 48, color: '#4b5563', type: 'mech', category: 'armored',
            role: '전략 미사일 발사', description: '핵/전술/EMP 미사일을 선택 발사하는 전략 TEL 발사차량입니다.'
        },
        icbm_enemy: {
            id: 'icbm_enemy', name: '적 ICBM 미사일차량', cost: 260, cooldown: 420, maxCount: 2,
            hp: 1400, damage: 0, range: 0, speed: 0.42,
            icbmAmmo: 3,
            width: 150, height: 48, color: '#4b5563', type: 'mech', category: 'armored',
            role: '적 전략 미사일 발사', description: '적 AI 전용 ICBM TEL 발사차량입니다.',
            hideFromUnitBar: true,
            hideFromUnitDex: true
        },
        aa_tank: {
            id: 'aa_tank', name: '대공전차', cost: 75, cooldown: 150, maxCount: 4,
            hp: 500, damage: 30, damageGround: 0, damageAir: 39, range: 520, speed: 0.5,
            width: 58, height: 41, color: '#ec4899', type: 'mech', antiAir: true, onlyAir: true, category: 'armored',
            role: '대공 방어', description: '강력한 유도 미사일로 항공기를 격추합니다. (지상 공격 불가)'
        },

        // [AIR]
        fighter: {
            id: 'fighter', name: '전투기', cost: 160, cooldown: 300, maxCount: 5,
            hp: 300, damage: 80, range: 600, speed: 3.0,
            width: 70, height: 18, color: '#0ea5e9', type: 'air', category: 'air',
            role: '제공권 장악', description: '적 항공기(헬기, 폭격기)만 전문적으로 요격합니다. (드론 무시)',
            missileCommand: true, missileCount: 1, missileProjectile: 'fighter_missile', missileSpeed: 400
        },
        apache: {
            id: 'apache', name: '아파치', cost: 120, cooldown: 280, maxCount: 5,
            hp: 400, damage: 70, range: 380, speed: 0.9,
            width: 140, height: 52, color: '#a855f7', type: 'air', category: 'air',
            role: '지상 지원', description: '로켓으로 지상군을 지속적으로 공격합니다.'
        },
        blackhawk: {
            id: 'blackhawk', name: '수송헬기 UH-60', cost: 220, cooldown: 420, maxCount: 2,
            hp: 900, damage: 30, range: 260, speed: 3.2,
            width: 78, height: 26, color: '#0f172a', type: 'air', category: 'air', antiAir: true,
            role: '보병 투입', description: '지정 지점으로 이동해 보병 4명을 투입하고, 근접 드론을 플레어로 무력화합니다.'
        },
        chinook: {
            id: 'chinook', name: '치누크', cost: 260, cooldown: 520, maxCount: 2,
            hp: 2000, damage: 0, range: 0, speed: 3.2,
            width: 145, height: 44, color: '#475569', type: 'air', category: 'air', invulnerable: false,
            role: '혼성 보병 투입', description: '지정 지점으로 이동해 보병 4명, RPG병 1명, 저격수 1명, 특수부대 2명을 투입하고 상공으로 이탈합니다.'
        },
        bomber: {
            id: 'bomber', name: '폭격기', cost: 200, cooldown: 400, maxCount: 3,
            hp: 1500, damage: 150, range: 100, speed: 2.5,
            width: 90, height: 30, color: '#334155', type: 'air', category: 'air', highAltitude: true,
            bombStrikeCooldown: 360,  // 융단폭격 런 재사용 대기(프레임)
            carpetBurstCount: 7,      // 런 1회당 투하 수
            carpetBurstInterval: 5,   // 런 중 투하 간격(프레임)
            carpetTriggerRange: 120,  // 목표 감지 폭
            carpetSpreadX: 24,        // 투하 산포(가로)
            role: '전략 폭격', description: '긴 재장전 후 다수의 폭탄을 연속 투하하는 고고도 융단 폭격기. 대공 미사일에만 피격됩니다. (생존 귀환 시 재고 회복)'
        },

        // [RECON] 정찰기 (공중 탭에 배치)
        recon: {
            id: 'recon', name: '정찰기', cost: 100, cooldown: 300, maxCount: 2,
            hp: 80, damage: 0, range: 0, speed: 2.5, mobility: 5,
            width: 30, height: 12, color: '#cbd5e1', type: 'air', category: 'air',
            invulnerable: false, stealth: true,
            role: '정찰 지원', description: '고고도 정찰 드론. 선택 후 명령탭에서 적 전력 분석 가능.'
        },

        // [DRONE] - R4.2 드론병 기반 시스템으로 개편
        // [NEW] 드론병 (Drone Operator)
        drone_operator: {
            id: 'drone_operator', name: '드론병', cost: 80, cooldown: 120, maxCount: 6,
            hp: 100, damage: 12, range: 150, speed: 0.9,
            width: 18, height: 28, color: '#64748b', type: 'bio', category: 'infantry',
            role: '드론 운용', description: '아군 건물 뒤에서 정지해 적을 감지하면 드론을 1회 발진한다. 회수에 성공하면 1회 추가 발진할 수 있다.',
            // 드론병 전용 필드
            operator: true,
            droneCharges: 1,
            droneRecallRefunds: 1,
            detectRange: 1100,       // 자동 발진 시작 거리(아군 드론병 포함)
            aiDetectRange: 1900,     // AI는 더 먼 거리에서 선발진
            coverOffset: 70,         // [FIX v3] 건물 뒤 자리 넉넉히
            frontSpawnOffset: 80,    // 전방 발진 위치(플레이어) - 드론병 바로 앞
            aiFrontSpawnOffset: 100, // 전방 발진 위치(AI) - 너무 멀지 않게 조정
            launchPrepFrames: 90,    // [LEGACY] 기본 발진 프렙 총합(하위호환)
            launchGroundHoldFrames: 140,   // 지상 대기(약 2.3초)
            launchRiseFrames: 200,         // 상승(소폭 빠르게 조정)
            launchHoverFrames: 30,         // 상공 호버(짧게 유지 후 공격)
            aiLaunchGroundHoldFrames: 150, // AI는 더 길게 지상 대기
            aiLaunchRiseFrames: 230,       // AI 상승 속도 소폭 상향
            aiLaunchHoverFrames: 40,       // AI도 짧게 체공 후 공격
            launchMaxRisePerFrame: 0.78,   // 프레임당 최대 상승(px) - 소폭 상향
            aiLaunchMaxRisePerFrame: 0.68, // AI 프레임당 최대 상승(px) - 소폭 상향
            launchCruiseHeight: 220,       // 이륙 직후 순항 고도(px)
            attackCruiseHeight: 430,       // 공격 접근 순항 고도(px, 최소 헬기급)
            attackDiveTriggerRange: 260,   // 이 거리부터 즉시 대각선 강하 돌입
            dynamicRetargetEnabled: true,  // 순항/상승 중 더 좋은 표적이 보이면 재지정
            dynamicRetargetMargin: 60      // 같은 우선순위일 때 최소 거리 이득(px)
        },
        drone_suicide: {
            id: 'drone_suicide', name: '자폭드론', cost: 35, cooldown: 60, maxCount: 20,
            hp: 90, damage: 280, range: 10, speed: 4.2, mobility: 12,
            width: 16, height: 8, color: '#94a3b8', type: 'air', stealth: true, lockOn: true, category: 'infantry',
            splashRadius: 120,  // [FIX] 약한 폭발
            role: '자폭 공격', description: '보병/경장갑을 향해 돌진해 폭발하는 1회용 드론.',
            droneLaunchOnly: true,
            hideFromUnitBar: true
        },
        drone_at: {
            id: 'drone_at', name: 'AT드론', cost: 55, cooldown: 100, maxCount: 12,
            hp: 120, damage: 700, range: 10, speed: 3.6, mobility: 10,
            width: 22, height: 11, color: '#facc15', type: 'air', splash: true, lockOn: true, category: 'infantry',
            splashRadius: 260,  // [FIX] 전술급 폭발
            role: '대전차', description: '장갑/건물을 우선 타격한다. 전술급 폭발로 광역 피해를 준다.',
            droneLaunchOnly: true,
            hideFromUnitBar: true
        },
        tactical_drone: {
            id: 'tactical_drone', name: '전술드론', cost: 50, cooldown: 120, maxCount: 0,
            hp: 50, damage: 300, range: 10, speed: 4.8, mobility: 7,
            width: 18, height: 9, color: '#dc2626', type: 'air', lockOn: true, category: 'drone',
            role: '정밀 타격', description: '[비활성화] 지정된 대상을 끝까지 추적하여 파괴합니다.',
            hideFromUnitBar: true,
            hideFromUnitDex: true,
            disabled: true  // [R 4.2] 완전 비활성화 - 스폰/총력전 차단
        },
        stealth_drone: {
            id: 'stealth_drone', name: '스텔스드론', cost: 85, cooldown: 180, maxCount: 0,
            hp: 55, damage: 600, range: 0, speed: 3.72, mobility: 8,
            width: 22, height: 10, color: '#0ea5e9', type: 'air', category: 'drone', stealth: true,
            splash: true, splashRadius: 180,
            role: '고고도 강습', description: '[비활성화] 지정 지점으로 고고도 침투 후 급강하 폭발합니다.',
            hideFromUnitBar: true,
            hideFromUnitDex: true,
            disabled: true  // [R 4.2] 완전 비활성화 - 스폰/총력전 차단
        },

        // [CIVILIAN] - 도시맵 전용 중립 민간인/차량
        civ_sedan: {
            id: 'civ_sedan', name: '민간 승용차', cost: 0, cooldown: 0, maxCount: 0,
            hp: 30, damage: 0, range: 0, speed: 0.55,
            width: 50, height: 18, color: '#94a3b8', type: 'civilian', category: 'civilian',
            role: '민간 차량', description: '도시맵 장식용 차량입니다.',
            civilian: true, hideFromUnitBar: true, hideFromUnitDex: true, disabled: true
        },
        civ_suv: {
            id: 'civ_suv', name: '민간 SUV', cost: 0, cooldown: 0, maxCount: 0,
            hp: 40, damage: 0, range: 0, speed: 0.5,
            width: 56, height: 20, color: '#64748b', type: 'civilian', category: 'civilian',
            role: '민간 차량', description: '도시맵 장식용 차량입니다.',
            civilian: true, hideFromUnitBar: true, hideFromUnitDex: true, disabled: true
        },
        civ_bus: {
            id: 'civ_bus', name: '민간 버스', cost: 0, cooldown: 0, maxCount: 0,
            hp: 70, damage: 0, range: 0, speed: 0.38,
            width: 80, height: 28, color: '#cbd5e1', type: 'civilian', category: 'civilian',
            role: '민간 차량', description: '도시맵 장식용 차량입니다.',
            civilian: true, hideFromUnitBar: true, hideFromUnitDex: true, disabled: true
        },
        civ_a: {
            id: 'civ_a', name: '민간인 A', cost: 0, cooldown: 0, maxCount: 0,
            hp: 12, damage: 0, range: 0, speed: 0.35,
            width: 10, height: 20, color: '#94a3b8', type: 'civilian', category: 'civilian',
            role: '민간인', description: '도시맵 장식용 민간인입니다.',
            civilian: true, hideFromUnitBar: true, hideFromUnitDex: true, disabled: true
        },
        civ_b: {
            id: 'civ_b', name: '민간인 B', cost: 0, cooldown: 0, maxCount: 0,
            hp: 12, damage: 0, range: 0, speed: 0.33,
            width: 10, height: 20, color: '#64748b', type: 'civilian', category: 'civilian',
            role: '민간인', description: '도시맵 장식용 민간인입니다.',
            civilian: true, hideFromUnitBar: true, hideFromUnitDex: true, disabled: true
        },
        civ_crowd: {
            id: 'civ_crowd', name: '군중', cost: 0, cooldown: 0, maxCount: 0,
            hp: 30, damage: 0, range: 0, speed: 0.25,
            width: 28, height: 24, color: '#475569', type: 'civilian', category: 'civilian',
            role: '군중', description: '도시맵 장식용 군중입니다.',
            civilian: true, hideFromUnitBar: true, hideFromUnitDex: true, disabled: true
        },

        // [NEW] 방송국 카메라맨 (뉴스 시스템 전용)
        cameraman: {
            id: 'cameraman', name: '방송국 카메라맨', cost: 0, cooldown: 0, maxCount: 1,
            hp: 80, damage: 0, range: 0, speed: 1.2,
            width: 16, height: 28, color: '#3b82f6', type: 'civilian', category: 'civilian',
            role: '방송 촬영', description: '뉴스 카메라로 전장을 촬영하는 방송국 요원입니다.',
            civilian: true, isCameraman: true, cannotCapture: true,
            hideFromUnitBar: true, hideFromUnitDex: true, disabled: true
        },

        // [SPECIAL] - EMP / Nuke integrated as virtual units for UI
        emp: {
            id: 'emp', name: 'EMP미사일', cost: 0, cooldown: 45, maxCount: 0,
            hp: 0, damage: 0, range: 300, speed: 0,
            width: 40, height: 40, color: '#3b82f6', type: 'skill', category: 'special',
            role: '광역 마비', description: 'ICBM 발사차량에서 EMP미사일을 발사해 광역 마비를 유발합니다.',
            isSkill: true, chargeKey: 'emp'
        },
        nuke: {
            id: 'nuke', name: '핵미사일', cost: 0, cooldown: 90, maxCount: 0,
            hp: 0, damage: 0, range: 0, speed: 0,
            width: 40, height: 40, color: '#ef4444', type: 'skill', category: 'special',
            role: '대량 살상', description: 'ICBM 발사차량 전용 핵미사일로 광범위한 지역을 초토화합니다.',
            isSkill: true, chargeKey: 'nuke'
        },
        tactical_missile: {
            id: 'tactical_missile', name: '전술미사일', cost: 0, cooldown: 45, maxCount: 0,
            hp: 0, damage: 350, range: 800, speed: 0,
            width: 40, height: 40, color: '#ff3333', type: 'skill', category: 'special',
            role: '정밀 타격', description: 'ICBM 발사차량 전용 전술미사일로 지정 지점을 정밀 타격합니다.',
            isSkill: true, chargeKey: 'tactical'
        }
    }
};

// 전체 유닛 가격 할인 비율(0 = 할인 없음, 원가 유지).
// cost가 0보다 큰 유닛만 일괄 반영한다.
const UNIT_GLOBAL_DISCOUNT_RATE = 0;
const UNIT_GLOBAL_COST_MULT = 1 - UNIT_GLOBAL_DISCOUNT_RATE;
if (CONFIG && CONFIG.units && typeof CONFIG.units === 'object') {
    Object.keys(CONFIG.units).forEach((key) => {
        const def = CONFIG.units[key];
        if (!def || typeof def !== 'object') return;
        const baseCost = Number(def.cost);
        if (!Number.isFinite(baseCost) || baseCost <= 0) return;
        def.cost = Math.max(1, Math.floor(baseCost * UNIT_GLOBAL_COST_MULT));
    });
}

// 다른 모듈(예: 시티 생산건물 비용 계산)에서도 동일 할인 배율을 재사용한다.
window.UNIT_GLOBAL_DISCOUNT_RATE = UNIT_GLOBAL_DISCOUNT_RATE;
window.UNIT_GLOBAL_COST_MULT = UNIT_GLOBAL_COST_MULT;

// [R 2.2] CONFIG를 window에 등록 (도감 등 다른 씬에서 참조용)
window.CONFIG = CONFIG;
