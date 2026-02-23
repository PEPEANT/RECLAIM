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

    });
})(window);
