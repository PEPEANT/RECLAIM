const CONFIG = {
    mapWidth: 6000,
    baseMapWidth: 6000,
    defenseExtraWidth: 1200,
    forwardDefenseOffset: 400,
    groundHeight: 250,
    startSupply: 1500,
    supplyRate: 2.0,
    maxSupply: 2500,

    buildings: {
        // 🛰️ 후방 HQ (공중 요격만)
        hq_player: {
            hp: 5000, width: 200, height: 140, name: '총사령부', canShoot: true, antiAir: true, onlyAir: true,
            damage: 80, range: 900, rate: 34, projectileType: 'aa_shell',
            yOffset: -10,
        },
        hq_enemy: {
            hp: 5000, width: 200, height: 140, name: '총사령부', canShoot: true, antiAir: true, onlyAir: true,
            damage: 80, range: 900, rate: 34, projectileType: 'aa_shell',
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

        // 🔭 감시탑 (지상 약공격 / 드론 요격 불가 / 공중엔 약하게만)
        watchtower: {
            hp: 1200, width: 60, height: 80, name: '감시탑',
            canShoot: true, antiAir: false,
            damage: 8, range: 400, rate: 12, projectileType: 'bullet',
            allowAir: true, ignoreDrone: true, airDamageMult: 0.35,
            yOffset: 0,
        },
        bunker: { hp: 2000, width: 80, height: 60, color: '#475569', name: '전술 벙커', damage: 25, range: 350, rate: 30 },
        turret: { hp: 1500, width: 50, height: 60, color: '#64748b', name: 'CIWS 포탑', damage: 12, range: 500, rate: 8, antiAir: true }
    },

    units: {
        // [INFANTRY]
        infantry: {
            id: 'infantry', name: '보병', cost: 15, cooldown: 25, maxCount: 40,
            hp: 50, damage: 8, range: 120, speed: 0.8,
            width: 15, height: 25, color: '#60a5fa', type: 'bio', category: 'infantry',
            role: '기본 보병', description: '저렴한 비용으로 전선을 유지하는 기본 보병입니다.'
        },
        rpg: {
            id: 'rpg', name: 'RPG', cost: 30, cooldown: 20, maxCount: 12,
            hp: 60, damage: 40, range: 300, speed: 0.7,
            width: 14, height: 22, color: '#f87171', type: 'bio', antiAir: true, category: 'infantry',
            role: '대전차/대공', description: '지상과 공중의 장갑 목표물을 타격합니다.'
        },
        sniper: {
            id: 'sniper', name: '저격수', cost: 45, cooldown: 80, maxCount: 10,
            hp: 45, damage: 90, range: 520, speed: 0.75,
            width: 15, height: 25, color: '#60a5fa', type: 'bio', category: 'infantry',
            role: '초장거리 저격', description: '매우 긴 사거리에서 강력한 단발을 발사합니다. (대공 불가)'
        },
        special_forces: {
            id: 'special_forces', name: '특수부대', cost: 200, cooldown: 60, maxCount: 6,
            hp: 180, damage: 25, range: 180, speed: 1.2,
            width: 16, height: 26, color: '#171717', type: 'bio', category: 'infantry',
            role: '엘리트 보병', description: '높은 체력과 연사력, 은신 능력을 갖춘 정예 부대입니다.'
        },

        // [ARMORED]
        humvee: {
            id: 'humvee', name: '험비', cost: 45, cooldown: 100, maxCount: 15,
            hp: 200, damage: 15, range: 250, speed: 1.5,
            width: 45, height: 28, color: '#14b8a6', type: 'mech', category: 'armored',
            role: '고속 기동', description: '빠른 속도로 치고 빠지며 보병을 제압합니다.'
        },
        apc: {
            id: 'apc', name: '장갑차', cost: 60, cooldown: 130, maxCount: 12,
            hp: 400, damage: 10, range: 200, speed: 1.0,
            width: 50, height: 30, color: '#6366f1', type: 'mech', category: 'armored',
            role: '전투 수송', description: '피격 시 즉시 보병 4명을 하차시키고 전투를 지속합니다.'
        },
        aa_tank: {
            id: 'aa_tank', name: '대공전차', cost: 75, cooldown: 150, maxCount: 8,
            hp: 500, damage: 30, damageGround: 15, damageAir: 39, range: 520, speed: 0.5,
            width: 48, height: 34, color: '#ec4899', type: 'mech', antiAir: true, category: 'armored',
            role: '대공 방어', description: '강력한 유도 미사일로 항공기를 격추합니다.'
        },
        mbt: {
            id: 'mbt', name: '전차', cost: 85, cooldown: 180, maxCount: 10,
            hp: 800, damage: 90, range: 280, speed: 0.4,
            width: 60, height: 38, color: '#22c55e', type: 'mech', category: 'armored',
            role: '주력 전차', description: '높은 체력과 화력으로 전선을 돌파합니다.'
        },
        spg: {
            id: 'spg', name: '자주포', cost: 160, cooldown: 400, maxCount: 6,
            hp: 200, damage: 150, range: 900, speed: 0.3,
            width: 65, height: 40, color: '#fb923c', type: 'mech', category: 'armored',
            role: '장거리 포격', description: '매우 긴 사거리에서 광역 포격을 가합니다.'
        },

        // [AIR]
        fighter: {
            id: 'fighter', name: '전투기', cost: 160, cooldown: 300, maxCount: 5,
            hp: 300, damage: 80, range: 600, speed: 3.0,
            width: 70, height: 18, color: '#0ea5e9', type: 'air', category: 'air',
            role: '제공권 장악', description: '적 항공기(헬기, 폭격기)만 전문적으로 요격합니다. (드론 무시)'
        },
        apache: {
            id: 'apache', name: '공격헬기', cost: 120, cooldown: 280, maxCount: 5,
            hp: 400, damage: 70, range: 380, speed: 0.9,
            width: 70, height: 24, color: '#a855f7', type: 'air', category: 'air',
            role: '지상 지원', description: 'AH-64 아파치. 로켓으로 지상군을 공격합니다.'
        },
        md500: {
            id: 'md500', name: '소형헬기', cost: 160, cooldown: 360, maxCount: 1,
            hp: 320, damage: 10, range: 260, speed: 1.6,
            width: 55, height: 22, color: '#22c55e', type: 'air', category: 'air',
            role: '공중 영웅 / 연사 제압', description: 'MD500. 미니건 연사로 드론·보병을 빠르게 제압하는 영웅 유닛입니다. (최대 1기)'
        },
        blackhawk: {
            id: 'blackhawk', name: '블랙호크', cost: 220, cooldown: 420, maxCount: 2,
            hp: 900, damage: 30, range: 260, speed: 3.2,
            width: 78, height: 26, color: '#0f172a', type: 'air', category: 'air', antiAir: true,
            role: '특수부대 투입', description: '지정 지점으로 이동해 특수부대 4명을 투입하고, 근접 드론을 플레어로 무력화합니다.'
        },
        chinook: {
            id: 'chinook', name: '치누크', cost: 260, cooldown: 520, maxCount: 2,
            hp: 2000, damage: 0, range: 0, speed: 3.6,
            width: 90, height: 30, color: '#475569', type: 'air', category: 'air', invulnerable: true,
            role: '보병 대량 투입', description: '지정 지점으로 1회 이동해 보병 10명을 투입하고 상공으로 이탈합니다. (피격 불가)'
        },
        bomber: {
            id: 'bomber', name: '폭격기', cost: 200, cooldown: 400, maxCount: 3,
            hp: 800, damage: 150, range: 100, speed: 2.5,
            width: 90, height: 30, color: '#334155', type: 'air', category: 'air', highAltitude: true,
            role: '전략 폭격', description: '고고도 융단 폭격. 대공 미사일에만 피격됩니다. (생존 귀환 시 재고 회복)'
        },

        // [DRONE] - Tactical moved here
        drone_suicide: {
            id: 'drone_suicide', name: '자폭드론', cost: 35, cooldown: 60, maxCount: 20,
            hp: 30, damage: 300, range: 10, speed: 4.2, mobility: 12,
            width: 16, height: 8, color: '#94a3b8', type: 'air', stealth: true, lockOn: true, category: 'drone',
            role: '자폭 공격', description: '적에게 돌진하여 자폭합니다. 스텔스 기능.'
        },
        drone_at: {
            id: 'drone_at', name: 'AT드론', cost: 55, cooldown: 100, maxCount: 12,
            hp: 40, damage: 700, range: 10, speed: 3.6, mobility: 10,
            width: 20, height: 10, color: '#facc15', type: 'air', splash: true, lockOn: true, category: 'drone',
            role: '대전차', description: '기갑 유닛에게 치명적인 범위 피해를 줍니다.'
        },
        tactical_drone: {
            id: 'tactical_drone', name: '전술드론', cost: 50, cooldown: 120, maxCount: 6,
            hp: 50, damage: 300, range: 10, speed: 4.8, mobility: 7,
            width: 18, height: 9, color: '#dc2626', type: 'air', lockOn: true, category: 'drone', // category changed
            role: '정밀 타격', description: '지정된 대상을 끝까지 추적하여 파괴합니다.'
        },
        stealth_drone: {
            id: 'stealth_drone', name: '스텔스드론', cost: 85, cooldown: 180, maxCount: 5,
            hp: 55, damage: 600, range: 0, speed: 3.72, mobility: 8,
            width: 22, height: 10, color: '#0ea5e9', type: 'air', category: 'drone', stealth: true,
            splash: true, splashRadius: 180,
            role: '고고도 강습', description: '지정 지점으로 고고도 침투 후 급강하 폭발합니다. (광역 피해)'
        },

        // [SPECIAL] - EMP / Nuke integrated as virtual units for UI
        emp: {
            id: 'emp', name: 'EMP', cost: 0, cooldown: 0, maxCount: 0,
            hp: 0, damage: 0, range: 300, speed: 0,
            width: 40, height: 40, color: '#3b82f6', type: 'skill', category: 'special',
            role: '광역 마비', description: '지정 범위의 기계 유닛을 10초간 마비시킵니다.',
            isSkill: true, chargeKey: 'emp'
        },
        nuke: {
            id: 'nuke', name: '전술핵', cost: 0, cooldown: 0, maxCount: 0,
            hp: 0, damage: 0, range: 0, speed: 0,
            width: 40, height: 40, color: '#ef4444', type: 'skill', category: 'special',
            role: '대량 살상', description: '전술핵을 투하하여 광범위한 지역을 초토화합니다.',
            isSkill: true, chargeKey: 'nuke'
        },
        tactical_missile: {
            id: 'tactical_missile', name: '전술미사일', cost: 700, cooldown: 45, maxCount: 3,
            hp: 0, damage: 350, range: 800, speed: 0,
            width: 40, height: 40, color: '#ff3333', type: 'skill', category: 'special',
            role: '정밀 타격', description: '본부에서 전술미사일을 발사해 지정 지점을 강타합니다. 넓은 범위에 강력한 피해를 입힙니다.',
            isSkill: true, chargeKey: 'tactical'
        }
    }
};

// [R 2.2] CONFIG를 window에 등록 (도감 등 다른 씬에서 참조용)
window.CONFIG = CONFIG;
