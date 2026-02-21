// Per-unit runtime render state for: infantry
(function attachUnitRenderV2State_infantry(globalScope) {
    'use strict';

    var TAU = Math.PI * 2;

    var DEFAULT_STATE = {
        stance: 'standing',
        facing: 1,
        recoil: 0,
        muzzleFlash: 0,
        lastAttackFrame: -1,
        walkCycle: 0,
        moveBlend: 0,
        legSwing: 0,
        armSwing: 0,
        bodyBob: 0,
        torsoLean: 0,
        idleBreath: 0,
        weaponBobX: 0,
        weaponBobY: 0,
        weaponSway: 0,
        phaseSeed: 0,
        phaseSeedReady: false
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
        if (!unit._renderV2State.infantry || typeof unit._renderV2State.infantry !== 'object') {
            unit._renderV2State.infantry = Object.assign({}, DEFAULT_STATE);
        }
        return unit._renderV2State.infantry;
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

        if (!state.stance) state.stance = DEFAULT_STATE.stance;
        if (state.facing !== 1 && state.facing !== -1) state.facing = DEFAULT_STATE.facing;
        return state;
    }

    function updateState(unit, state) {
        if (!unit || !state) return;

        var facing = Number(unit.facing);
        if (facing !== 1 && facing !== -1) facing = (unit.team === 'player') ? 1 : -1;
        state.facing = facing;

        var hp = Number(unit.hp);
        var maxHp = Number(unit.maxHp);
        if (!Number.isFinite(hp)) hp = 1;
        if (!Number.isFinite(maxHp) || maxHp <= 0) maxHp = 1;
        var hpRatio = hp / maxHp;

        if (hpRatio < 0.4) state.stance = 'prone';
        else if (unit.attackTarget != null) state.stance = 'crouching';
        else state.stance = 'standing';

        var currentAttackFrame = Number(unit.lastAttack);
        if (Number.isFinite(currentAttackFrame) && currentAttackFrame > 0 && currentAttackFrame !== state.lastAttackFrame) {
            state.lastAttackFrame = currentAttackFrame;
            state.recoil = 3;
            state.muzzleFlash = 4;
        }

        state.recoil = (state.recoil > 0) ? state.recoil * 0.65 : 0;
        if (state.recoil < 0.05) state.recoil = 0;
        state.muzzleFlash = Math.max(0, Number(state.muzzleFlash || 0) - 1);

        var vx = Number(unit.vx) || 0;
        var speedAbs = Math.abs(vx);
        var moveTarget = clamp((speedAbs - 0.02) / 0.85, 0, 1);
        state.moveBlend += (moveTarget - state.moveBlend) * 0.18;
        if (state.moveBlend < 0.001) state.moveBlend = 0;

        var cadence = 0.08 + (0.30 * state.moveBlend) + (speedAbs * 0.20);
        state.walkCycle = (Number(state.walkCycle) + cadence) % TAU;
        if (state.walkCycle < 0) state.walkCycle += TAU;

        if (state.phaseSeedReady !== true) {
            var base = Math.abs((Number(unit.x) || 0) * 0.17 + (Number(unit.y) || 0) * 0.07);
            state.phaseSeed = base % TAU;
            state.phaseSeedReady = true;
        }

        var frameNow = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : 0;
        var idleT = (frameNow * 0.07) + state.phaseSeed;
        state.idleBreath = Math.sin(idleT) * (1 - state.moveBlend) * 0.35;

        var phase = state.walkCycle + state.phaseSeed * 0.15;
        var stepSin = Math.sin(phase);
        var stepCos = Math.cos(phase);
        var stanceMul = (state.stance === 'standing') ? 1 : (state.stance === 'crouching' ? 0.55 : 0.15);
        var swingAmp = 0.55 * state.moveBlend * stanceMul;

        state.legSwing = stepSin * swingAmp;
        state.armSwing = -stepSin * swingAmp * 0.8;
        state.bodyBob = Math.abs(stepCos) * 1.5 * state.moveBlend * (state.stance === 'standing' ? 1 : 0.6);
        state.torsoLean = clamp(vx * 0.08, -0.14, 0.14) * stanceMul * state.moveBlend;

        state.weaponBobX = stepSin * 0.9 * state.moveBlend * stanceMul;
        state.weaponBobY = (state.bodyBob * 0.35) + (state.idleBreath * 0.45);
        state.weaponSway = (stepSin * 0.07 * state.moveBlend + state.torsoLean * 0.35) * stanceMul;
    }

    globalScope['UnitRenderV2State_infantry'] = {
        getState: getState,
        updateState: updateState
    };
})(typeof window !== 'undefined' ? window : globalThis);
