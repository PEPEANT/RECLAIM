// Per-unit runtime render state for: fighter
(function attachUnitRenderV2State_fighter(globalScope) {
    'use strict';

    var TAU = Math.PI * 2;

    var DEFAULT_STATE = {
        facing:           1,
        floatOffset:      0,
        thrustPhase:      0,
        afterburner:      0,
        afterburnerPhase: 0,
        muzzleFlash:      0,
        lastAttackFrame:  -1,
        speed:            0,
        prevX:            null,
        phaseSeed:        0,
        phaseSeedReady:   false
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
        if (!unit._renderV2State.fighter || typeof unit._renderV2State.fighter !== 'object') {
            unit._renderV2State.fighter = Object.assign({}, DEFAULT_STATE);
        }
        return unit._renderV2State.fighter;
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
        if (facing !== 1 && facing !== -1) facing = (unit.team === 'player') ? 1 : -1;
        state.facing = facing;

        // phaseSeed (once per unit)
        if (state.phaseSeedReady !== true) {
            var base = Math.abs((Number(unit.x) || 0) * 0.13 + (Number(unit.y) || 0) * 0.07);
            state.phaseSeed = base % TAU;
            state.phaseSeedReady = true;
        }

        // speed from vx or delta-x
        var xNow = Number(unit.x) || 0;
        var vx = Number(unit.vx);
        if (!Number.isFinite(vx) || Math.abs(vx) < 0.001) {
            vx = Number.isFinite(state.prevX) ? (xNow - Number(state.prevX)) : 0;
        }
        state.prevX = xNow;
        state.speed = Math.abs(vx);

        // float oscillation
        state.thrustPhase = (Number(state.thrustPhase) + 0.05) % TAU;
        state.floatOffset = Math.sin(state.thrustPhase + state.phaseSeed) * 3.5;

        // afterburner: ramp up when fast or attacking
        var hasTarget = !!(unit.attackTarget && !unit.attackTarget.dead);
        var afterburnerTarget = (state.speed > 1.5 || hasTarget) ? 1.0 : 0.0;
        var currentAb = Number(state.afterburner) || 0;
        state.afterburner = clamp(currentAb + (afterburnerTarget - currentAb) * 0.08, 0, 1);

        // afterburner flame flicker phase
        state.afterburnerPhase = (Number(state.afterburnerPhase) + 0.3) % TAU;

        // muzzle flash: detect new attack
        var currentAttackFrame = Number(unit.lastAttack);
        if (Number.isFinite(currentAttackFrame) && currentAttackFrame > 0 && currentAttackFrame !== state.lastAttackFrame) {
            state.lastAttackFrame = currentAttackFrame;
            state.muzzleFlash = 4;
        }
        state.muzzleFlash = Math.max(0, Number(state.muzzleFlash || 0) - 1);
    }

    globalScope['UnitRenderV2State_fighter'] = {
        getState:    getState,
        updateState: updateState
    };
})(typeof window !== 'undefined' ? window : globalThis);
