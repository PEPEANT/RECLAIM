(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
    // Config: Spawn Rates (frames between spawns) & Resource Multipliers
    settings: {
        recruit: { rate: 200, supplyMult: 1.0, smart: false },
        veteran: { rate: 120, supplyMult: 2.0, smart: true },
        elite: { rate: 90, supplyMult: 3.0, smart: 'very' }
    },

    // 점령전 스테이지별 웨이브 유닛 생성 한도(동시 생존 적 유닛 수).
    // waveAt: [1웨이브 종료 프레임, 2웨이브 종료 프레임]
    // caps: [1웨이브 한도, 2웨이브 한도, 3웨이브 한도]
    occupationWaveCaps: {
        default: { waveAt: [60 * 90, 60 * 210], caps: [10, 14, 18] },
        1: { caps: [8, 10, 12] },
        2: { caps: [9, 11, 13] },
        3: { caps: [10, 13, 15] },
        4: { caps: [10, 12, 14] },
        5: { caps: [11, 14, 16] },
        6: { caps: [12, 15, 17] },
        7: { waveAt: [60 * 150, 60 * 360], caps: [16, 23, 30] }
    },

    // 안전 모드: 복잡한 retreat 없이 HOLD/PUSH + 스폰 품질 개선만 사용
    enableSafeAiV2: true,

    spawnControl: {
        recentWindow: 6,
        familyCooldownFrames: {
            infantry: 14,
            armored: 34,
            air: 90,
            support: 60,
            siege: 120
        }
    },

    // 난이도/시간대별 기본 생존 캡 (점령전 캡과 함께 최소값으로 적용)
    globalAliveCaps: {
        recruit: [9, 13, 17],
        veteran: [11, 16, 21],
        elite: [13, 19, 25]
    },

    occupationSpawnProfiles: {
        default: {
            early: [
                { id: 'infantry', w: 5 }, { id: 'humvee', w: 3 }, { id: 'engineer', w: 3 }, { id: 'drone_operator', w: 2 }
            ],
            mid: [
                { id: 'infantry', w: 2 }, { id: 'mbt', w: 4 }, { id: 'apc', w: 3 }, { id: 'aa_tank', w: 2 }, { id: 'spg', w: 2 }, { id: 'apache', w: 2 }
            ],
            late: [
                { id: 'mbt', w: 3 }, { id: 'apc', w: 2 }, { id: 'aa_tank', w: 2 }, { id: 'apache', w: 2 }, { id: 'fighter', w: 2 }, { id: 'spg', w: 2 }, { id: 'bomber', w: 1 }, { id: 'drone_operator', w: 2 }
            ]
        },
        1: {
            early: [
                { id: 'infantry', w: 6 }, { id: 'humvee', w: 3 }, { id: 'engineer', w: 2 }
            ],
            mid: [
                { id: 'infantry', w: 3 }, { id: 'humvee', w: 3 }, { id: 'mbt', w: 2 }, { id: 'aa_tank', w: 2 }, { id: 'drone_operator', w: 2 }
            ],
            late: [
                { id: 'mbt', w: 3 }, { id: 'apc', w: 2 }, { id: 'aa_tank', w: 3 }, { id: 'fighter', w: 2 }, { id: 'apache', w: 2 }, { id: 'spg', w: 1 }
            ]
        },
        2: {
            early: [
                { id: 'infantry', w: 5 }, { id: 'engineer', w: 3 }, { id: 'drone_operator', w: 2 }
            ],
            mid: [
                { id: 'mbt', w: 3 }, { id: 'apc', w: 3 }, { id: 'spg', w: 2 }, { id: 'aa_tank', w: 2 }, { id: 'humvee', w: 2 }
            ],
            late: [
                { id: 'mbt', w: 3 }, { id: 'spg', w: 3 }, { id: 'apache', w: 2 }, { id: 'fighter', w: 2 }, { id: 'bomber', w: 1 }, { id: 'drone_operator', w: 2 }
            ]
        },
        3: {
            early: [
                { id: 'infantry', w: 4 }, { id: 'humvee', w: 3 }, { id: 'engineer', w: 3 }, { id: 'apc', w: 2 }
            ],
            mid: [
                { id: 'mbt', w: 3 }, { id: 'apc', w: 3 }, { id: 'aa_tank', w: 2 }, { id: 'apache', w: 2 }, { id: 'drone_operator', w: 2 }
            ],
            late: [
                { id: 'mbt', w: 3 }, { id: 'aa_tank', w: 3 }, { id: 'fighter', w: 2 }, { id: 'apache', w: 2 }, { id: 'spg', w: 2 }, { id: 'bomber', w: 1 }
            ]
        },
        4: {
            early: [
                { id: 'infantry', w: 4 }, { id: 'engineer', w: 3 }, { id: 'humvee', w: 2 }, { id: 'drone_operator', w: 3 }
            ],
            mid: [
                { id: 'apc', w: 3 }, { id: 'mbt', w: 3 }, { id: 'aa_tank', w: 2 }, { id: 'spg', w: 2 }, { id: 'apache', w: 2 }
            ],
            late: [
                { id: 'mbt', w: 3 }, { id: 'spg', w: 2 }, { id: 'apache', w: 2 }, { id: 'fighter', w: 2 }, { id: 'bomber', w: 1 }, { id: 'drone_operator', w: 2 }
            ]
        },
        5: {
            early: [
                { id: 'infantry', w: 4 }, { id: 'humvee', w: 2 }, { id: 'engineer', w: 3 }, { id: 'apc', w: 2 }
            ],
            mid: [
                { id: 'mbt', w: 3 }, { id: 'apc', w: 3 }, { id: 'aa_tank', w: 2 }, { id: 'fighter', w: 2 }, { id: 'spg', w: 2 }
            ],
            late: [
                { id: 'mbt', w: 3 }, { id: 'aa_tank', w: 2 }, { id: 'fighter', w: 2 }, { id: 'apache', w: 2 }, { id: 'spg', w: 2 }, { id: 'bomber', w: 1 }, { id: 'drone_operator', w: 2 }
            ]
        },
        6: {
            early: [
                { id: 'infantry', w: 3 }, { id: 'engineer', w: 3 }, { id: 'humvee', w: 2 }, { id: 'drone_operator', w: 3 }
            ],
            mid: [
                { id: 'mbt', w: 3 }, { id: 'spg', w: 2 }, { id: 'aa_tank', w: 2 }, { id: 'apc', w: 2 }, { id: 'apache', w: 2 }, { id: 'fighter', w: 1 }
            ],
            late: [
                { id: 'mbt', w: 3 }, { id: 'spg', w: 3 }, { id: 'fighter', w: 2 }, { id: 'apache', w: 2 }, { id: 'bomber', w: 1 }, { id: 'drone_operator', w: 2 }
            ]
        },
        7: {
            early: [
                { id: 'infantry', w: 5 }, { id: 'engineer', w: 4 }, { id: 'humvee', w: 4 }, { id: 'drone_operator', w: 3 }, { id: 'apc', w: 2 }
            ],
            mid: [
                { id: 'mbt', w: 5 }, { id: 'apc', w: 4 }, { id: 'aa_tank', w: 4 }, { id: 'spg', w: 3 }, { id: 'fighter', w: 3 }, { id: 'apache', w: 3 }, { id: 'drone_operator', w: 3 }
            ],
            late: [
                { id: 'mbt', w: 6 }, { id: 'spg', w: 5 }, { id: 'aa_tank', w: 4 }, { id: 'fighter', w: 4 }, { id: 'apache', w: 4 }, { id: 'bomber', w: 3 }, { id: 'drone_operator', w: 4 }
            ]
        }
    },
    });
})(window);
