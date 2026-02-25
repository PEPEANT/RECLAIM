(function (global) {
    'use strict';

    const STATES = Object.freeze({
        APPROACH: 'approach',
        BEACH: 'beach',
        RAMP_OPEN: 'ramp_open',
        HOLD: 'hold',
        DONE: 'done',
        FAILED: 'failed'
    });

    const DEFAULT_CONFIG = Object.freeze({
        enabled: true,
        initialCrafts: 3,
        staggerSec: 1.1,
        arrivalRandomMinSec: 0,
        arrivalRandomMaxSec: 2.4,
        approachSpeed: 155,
        approachSec: 4.8,
        beachSec: 1.5,
        rampOpenSec: 1.7,
        holdSec: 3.8,
        timeoutSec: 25,
        startX: -760,
        beachStartX: 220,
        beachGapX: 0,
        beachGapY: 74,
        baseYOffset: 62,
        craftScale: 0.95,
        craftHp: 1800,
        enemyPressureDps: 18,
        damageRadiusX: 280,
        damageRadiusY: 170
    });

    function clampNumber(raw, fallback, min, max) {
        const n = Number(raw);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    }

    function toBool(raw, fallback) {
        if (typeof raw === 'boolean') return raw;
        return fallback;
    }

    function normalizeLandingIntroConfig(raw) {
        const src = (raw && typeof raw === 'object') ? raw : {};
        const arrivalRandomMinSec = clampNumber(
            src.arrivalRandomMinSec,
            DEFAULT_CONFIG.arrivalRandomMinSec,
            0,
            60
        );
        const arrivalRandomMaxSec = Math.max(
            arrivalRandomMinSec,
            clampNumber(
                src.arrivalRandomMaxSec,
                DEFAULT_CONFIG.arrivalRandomMaxSec,
                0,
                60
            )
        );
        return {
            enabled: toBool(src.enabled, DEFAULT_CONFIG.enabled),
            initialCrafts: Math.floor(clampNumber(src.initialCrafts, DEFAULT_CONFIG.initialCrafts, 1, 12)),
            staggerSec: clampNumber(src.staggerSec, DEFAULT_CONFIG.staggerSec, 0, 8),
            arrivalRandomMinSec,
            arrivalRandomMaxSec,
            approachSpeed: clampNumber(src.approachSpeed, DEFAULT_CONFIG.approachSpeed, 30, 360),
            approachSec: clampNumber(src.approachSec, DEFAULT_CONFIG.approachSec, 0.6, 20),
            beachSec: clampNumber(src.beachSec, DEFAULT_CONFIG.beachSec, 0.2, 8),
            rampOpenSec: clampNumber(src.rampOpenSec, DEFAULT_CONFIG.rampOpenSec, 0.25, 10),
            holdSec: clampNumber(src.holdSec, DEFAULT_CONFIG.holdSec, 0.4, 20),
            timeoutSec: clampNumber(src.timeoutSec, DEFAULT_CONFIG.timeoutSec, 5, 120),
            startX: clampNumber(src.startX, DEFAULT_CONFIG.startX, -1600, 400),
            beachStartX: clampNumber(src.beachStartX, DEFAULT_CONFIG.beachStartX, 160, 2200),
            beachGapX: clampNumber(src.beachGapX, DEFAULT_CONFIG.beachGapX, -500, 500),
            beachGapY: clampNumber(src.beachGapY, DEFAULT_CONFIG.beachGapY, 20, 180),
            baseYOffset: clampNumber(src.baseYOffset, DEFAULT_CONFIG.baseYOffset, -60, 120),
            craftScale: clampNumber(src.craftScale, DEFAULT_CONFIG.craftScale, 0.45, 1.6),
            craftHp: clampNumber(src.craftHp, DEFAULT_CONFIG.craftHp, 200, 12000),
            enemyPressureDps: clampNumber(src.enemyPressureDps, DEFAULT_CONFIG.enemyPressureDps, 1, 200),
            damageRadiusX: clampNumber(src.damageRadiusX, DEFAULT_CONFIG.damageRadiusX, 60, 900),
            damageRadiusY: clampNumber(src.damageRadiusY, DEFAULT_CONFIG.damageRadiusY, 40, 600)
        };
    }

    global.LandingIntroTypes = {
        STATES,
        DEFAULT_CONFIG,
        normalizeLandingIntroConfig
    };
})(typeof window !== 'undefined' ? window : globalThis);
