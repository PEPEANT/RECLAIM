// Per-unit runtime render state for: apache
// 헬기 특유의 호버링 부유 + 메인/테일 로터 회전 + 미사일 섬광 관리
(function attachUnitRenderV2State_apache(globalScope) {
    'use strict';

    var TAU = Math.PI * 2;

    var DEFAULT_STATE = {
        facing:          1,
        floatOffset:     0,
        bodyBank:        0,
        thrustPhase:     0,
        rotorAngle:      0,
        tailRotorAngle:  0,
        muzzleFlash:     0,
        lastAttackFrame: -1,
        speed:           0,
        prevX:           null,
        phaseSeed:       0,
        phaseSeedReady:  false
    };

    function clamp(v, min, max) {
        if (!Number.isFinite(v)) return min;
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    function ensureState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        if (!unit._renderV2State.apache || typeof unit._renderV2State.apache !== 'object') {
            unit._renderV2State.apache = Object.assign({}, DEFAULT_STATE);
        }
        return unit._renderV2State.apache;
    }

    function getState(unit) {
        var state = ensureState(unit);
        if (!state) return null;
        var keys = Object.keys(DEFAULT_STATE);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (!Number.isFinite(DEFAULT_STATE[k])) continue;
            if (!Number.isFinite(state[k])) state[k] = DEFAULT_STATE[k];
        }
        if (state.facing !== 1 && state.facing !== -1) state.facing = DEFAULT_STATE.facing;
        return state;
    }

    function updateState(unit, state) {
        if (!unit || !state) return;

        // facing
        var facing = Number(unit.facing);
        if (facing !== 1 && facing !== -1) {
            facing = (unit.team === 'player') ? 1 : -1;
        }
        state.facing = facing;

        // phaseSeed: 유닛마다 다른 부유 타이밍
        if (state.phaseSeedReady !== true) {
            var base = Math.abs((Number(unit.x) || 0) * 0.17 + (Number(unit.y) || 0) * 0.11);
            state.phaseSeed = base % TAU;
            state.phaseSeedReady = true;
        }

        // speed
        var xNow = Number(unit.x) || 0;
        var vx = Number(unit.vx);
        var vy = Number(unit.vy);
        if (!Number.isFinite(vx) || Math.abs(vx) < 0.001) {
            vx = Number.isFinite(state.prevX) ? (xNow - Number(state.prevX)) : 0;
        }
        if (!Number.isFinite(vy)) vy = 0;
        state.prevX = xNow;
        state.speed = Math.hypot(vx, vy * 0.7);

        // 호버링 부유 (헬기는 더 느리고 크게)
        state.thrustPhase = (Number(state.thrustPhase) + 0.042) % TAU;
        state.floatOffset = Math.sin(state.thrustPhase + state.phaseSeed) * 3.8;

        // Body bank while maneuvering.
        var bankTarget = clamp((vx * 0.11) + (vy * 0.025), -0.18, 0.18);
        if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) bankTarget = 0;
        state.bodyBank = Number(state.bodyBank) || 0;
        state.bodyBank += (bankTarget - state.bodyBank) * 0.18;
        state.bodyBank = clamp(state.bodyBank, -0.2, 0.2);

        // 메인 로터 (항상 회전)
        state.rotorAngle = (Number(state.rotorAngle) + 0.5) % TAU;

        // 테일 로터 (더 빠르게)
        state.tailRotorAngle = (Number(state.tailRotorAngle) + 0.45) % TAU;

        // 미사일 섬광: lastAttack 변경 감지
        var currentAttackFrame = Number(unit.lastAttack);
        if (Number.isFinite(currentAttackFrame) && currentAttackFrame > 0 &&
            currentAttackFrame !== state.lastAttackFrame) {
            state.lastAttackFrame = currentAttackFrame;
            state.muzzleFlash = 5;
        }
        state.muzzleFlash = Math.max(0, Number(state.muzzleFlash || 0) - 1);
    }

    // Legacy icon-state compatibility helper (setIconState)
    function setIconState(state) {
        if (!state) return;
        state.rotorAngle     = state.rotorAngle     || 0;
        state.tailRotorAngle = state.tailRotorAngle || 0;
        state.floatOffset    = 0;
        state.bodyBank       = 0;
        state.muzzleFlash    = 0;
    }

    globalScope['UnitRenderV2State_apache'] = {
        getState:    getState,
        updateState: updateState,
        setIconState: setIconState
    };
})(typeof window !== 'undefined' ? window : globalThis);
