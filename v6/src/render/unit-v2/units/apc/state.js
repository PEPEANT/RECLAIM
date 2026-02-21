// Per-unit runtime render state for: apc (M2 Bradley IFV)
(function attachUnitRenderV2State_apc(globalScope) {
    'use strict';

    var DEFAULT_STATE = {
        turretAngle: -0.08,
        trackOffset: 0,
        recoil: 0,
        autoFlash: 0,
        towFlash: 0,
        exhaustAlpha: 0,
        facing: 1
    };

    function ensureStateStore(unit) {
        if (!unit || typeof unit !== 'object') return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        return unit._renderV2State;
    }

    function getState(unit) {
        var store = ensureStateStore(unit);
        if (!store) return null;
        var state = store.apc;
        if (!state || typeof state !== 'object') {
            state = Object.assign({}, DEFAULT_STATE);
            store.apc = state;
        }
        if (!Number.isFinite(state.turretAngle)) state.turretAngle = DEFAULT_STATE.turretAngle;
        if (!Number.isFinite(state.trackOffset)) state.trackOffset = DEFAULT_STATE.trackOffset;
        if (!Number.isFinite(state.recoil)) state.recoil = DEFAULT_STATE.recoil;
        if (!Number.isFinite(state.autoFlash)) state.autoFlash = DEFAULT_STATE.autoFlash;
        if (!Number.isFinite(state.towFlash)) state.towFlash = DEFAULT_STATE.towFlash;
        if (!Number.isFinite(state.exhaustAlpha)) state.exhaustAlpha = DEFAULT_STATE.exhaustAlpha;
        if (!Number.isFinite(state.facing) || state.facing === 0) state.facing = DEFAULT_STATE.facing;
        return state;
    }

    function updateRuntimeState(unit, state) {
        if (!unit || !state) return state;

        var facing = Number(unit.facing);
        if (Number.isFinite(facing) && facing !== 0) {
            state.facing = facing > 0 ? 1 : -1;
        }

        var vx = Number(unit.vx);
        if (!Number.isFinite(vx)) vx = 0;
        if (Math.abs(vx) > 0.01) {
            state.trackOffset = (Number(state.trackOffset || 0) - vx * 1.35) % 14;
            if (state.trackOffset < 0) state.trackOffset += 14;
        }

        var recoil = Number(unit.recoil);
        if (Number.isFinite(recoil) && recoil >= 0) {
            state.recoil = Math.min(8, recoil * 1.7);
        } else {
            state.recoil = Math.max(0, Number(state.recoil || 0) - 0.25);
        }

        var frameNow = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : NaN;
        var shotFrame = Number(unit.lastAttack);
        var shotDiff = Number.isFinite(frameNow) && Number.isFinite(shotFrame)
            ? (frameNow - shotFrame)
            : NaN;
        if (Number.isFinite(shotDiff) && shotDiff >= 0 && shotDiff <= 1) {
            state.autoFlash = Math.max(0, 1 - shotDiff);
        } else {
            state.autoFlash = Math.max(0, Number(state.autoFlash || 0) - 0.22);
        }

        var missileFlash = Number(unit.missileFlash);
        if (Number.isFinite(missileFlash) && missileFlash > 0) {
            state.towFlash = Math.max(state.towFlash || 0, Math.min(1, missileFlash / 7));
        } else {
            state.towFlash = Math.max(0, Number(state.towFlash || 0) - 0.16);
        }

        var moving = Math.abs(vx) > 0.14;
        if (moving) {
            state.exhaustAlpha = Math.min(0.50, 0.12 + (Math.abs(vx) * 0.08));
        } else {
            state.exhaustAlpha = Math.max(0, Number(state.exhaustAlpha || 0) - 0.04);
        }
        return state;
    }

    function setIconState(state, options) {
        if (!state) return state;
        var opts = options || {};
        var turretAngle = Number(opts.turretAngle);
        state.turretAngle = Number.isFinite(turretAngle) ? turretAngle : -0.10;
        state.trackOffset = 4.2;
        state.recoil = 0;
        state.autoFlash = 0;
        state.towFlash = 0;
        state.exhaustAlpha = 0;
        state.facing = 1;
        return state;
    }

    globalScope.UnitRenderV2State_apc = {
        getState: getState,
        updateRuntimeState: updateRuntimeState,
        setIconState: setIconState
    };
})(typeof window !== 'undefined' ? window : globalThis);
