// Per-unit runtime render state for: special_ops
(function attachUnitRenderV2State_special_ops(globalScope) {
    'use strict';

    var DEFAULT_STATE = {
        stance: 'standing',
        desiredStance: 'standing',
        desiredStanceFrames: 0,
        facing: 1,
        recoil: 0,
        muzzleFlash: 0,
        lastAttackFrame: -1,
        velocityX: 0,
        prevX: null,
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

    function ensureState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        if (!unit._renderV2State.special_ops || typeof unit._renderV2State.special_ops !== 'object') {
            unit._renderV2State.special_ops = Object.assign({}, DEFAULT_STATE);
        }
        return unit._renderV2State.special_ops;
    }

    function getState(unit) {
        var state = ensureState(unit);
        if (!state) return null;
        var keys = Object.keys(DEFAULT_STATE);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (typeof state[k] === 'undefined') state[k] = DEFAULT_STATE[k];
        }
        if (!state.stance) state.stance = 'standing';
        if (!state.desiredStance) state.desiredStance = state.stance;
        if (state.facing !== 1 && state.facing !== -1) state.facing = 1;
        return state;
    }

    function updateState(unit, state) {
        if (!unit || !state) return;
        var prevAttackFrame = Number(state.lastAttackFrame);

        var baseApi = globalScope['UnitRenderV2State_infantry'];
        if (baseApi && typeof baseApi.getState === 'function' && typeof baseApi.updateState === 'function') {
            var baseState = baseApi.getState(unit);
            baseApi.updateState(unit, baseState);
            if (baseState && typeof baseState === 'object') {
                Object.assign(state, baseState);
            }
        } else {
            var facing = Number(unit.facing);
            if (facing !== 1 && facing !== -1) facing = (unit.team === 'player') ? 1 : -1;
            state.facing = facing;
        }

        var attackFrame = Number(unit.lastAttack);
        if (Number.isFinite(attackFrame) && attackFrame > 0 && attackFrame !== prevAttackFrame) {
            state.recoil = Math.max(Number(state.recoil) || 0, 2.6);
            state.muzzleFlash = Math.max(Number(state.muzzleFlash) || 0, 3);
        }

        state.weaponSway = (Number(state.weaponSway) || 0) * 0.82;
        state.torsoLean = (Number(state.torsoLean) || 0) * 0.9;
        state.legSwing = (Number(state.legSwing) || 0) * 0.95;

        if (state.stance === 'standing' && unit.attackTarget && !unit.attackTarget.dead) {
            state.stance = 'crouching';
        }
    }

    globalScope['UnitRenderV2State_special_ops'] = {
        getState: getState,
        updateState: updateState
    };
})(typeof window !== 'undefined' ? window : globalThis);
