// Per-unit runtime render state for: spg
(function attachUnitRenderV2State_spg(globalScope) {
    'use strict';

    var DEFAULT_STATE = {
        gunAngle: -Math.PI / 12,
        trackOffset: 0,
        recoil: 0,
        mainFlash: 0,
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
        var state = store.spg;
        if (!state || typeof state !== 'object') {
            state = Object.assign({}, DEFAULT_STATE);
            store.spg = state;
        }
        if (!Number.isFinite(state.gunAngle)) state.gunAngle = DEFAULT_STATE.gunAngle;
        if (!Number.isFinite(state.trackOffset)) state.trackOffset = DEFAULT_STATE.trackOffset;
        if (!Number.isFinite(state.recoil)) state.recoil = DEFAULT_STATE.recoil;
        if (!Number.isFinite(state.mainFlash)) state.mainFlash = DEFAULT_STATE.mainFlash;
        if (!Number.isFinite(state.facing) || state.facing === 0) state.facing = DEFAULT_STATE.facing;
        return state;
    }

    function updateRuntimeState(unit, state) {
        if (!unit || !state) return state;

        var facing = Number(unit.facing);
        if (Number.isFinite(facing) && facing !== 0) {
            state.facing = facing > 0 ? 1 : -1;
        }

        var recoil = Number(unit.recoil);
        if (Number.isFinite(recoil) && recoil >= 0) {
            // SPG should feel heavier than MBT for the same recoil stat.
            state.recoil = Math.min(20, recoil * 3.0);
        } else {
            state.recoil = Math.max(0, state.recoil - 0.4);
        }

        if (state.recoil > 2.5) {
            state.mainFlash = Math.max(state.mainFlash || 0, Math.min(1, (state.recoil - 2.5) / 8));
        } else {
            state.mainFlash = Math.max(0, Number(state.mainFlash || 0) - 0.24);
        }

        var vx = Number(unit.vx);
        if (Number.isFinite(vx) && Math.abs(vx) > 0.01) {
            state.trackOffset = (state.trackOffset - vx * 1.4) % 15;
            if (state.trackOffset < 0) state.trackOffset += 15;
        }

        return state;
    }

    function setIconState(state, options) {
        if (!state) return state;
        var opts = options || {};
        var gunAngle = Number(opts.gunAngle);
        state.gunAngle = Number.isFinite(gunAngle) ? gunAngle : -Math.PI / 12;
        state.trackOffset = 4.2;
        state.recoil = 0;
        state.mainFlash = 0;
        state.facing = 1;
        return state;
    }

    globalScope.UnitRenderV2State_spg = {
        getState: getState,
        updateRuntimeState: updateRuntimeState,
        setIconState: setIconState
    };
})(typeof window !== 'undefined' ? window : globalThis);

