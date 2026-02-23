// Per-unit runtime render state for: mbt
(function attachUnitRenderV2State_mbt(globalScope) {
    'use strict';

    var DEFAULT_STATE = {
        turretAngle: -0.10,
        trackOffset: 0,
        recoil: 0,
        mgFlash: 0,
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
        var state = store.mbt;
        if (!state || typeof state !== 'object') {
            state = Object.assign({}, DEFAULT_STATE);
            store.mbt = state;
        }
        if (!Number.isFinite(state.turretAngle)) state.turretAngle = DEFAULT_STATE.turretAngle;
        if (!Number.isFinite(state.trackOffset)) state.trackOffset = DEFAULT_STATE.trackOffset;
        if (!Number.isFinite(state.recoil)) state.recoil = DEFAULT_STATE.recoil;
        if (!Number.isFinite(state.mgFlash)) state.mgFlash = DEFAULT_STATE.mgFlash;
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
            state.recoil = Math.min(14, recoil * 1.8);
        } else {
            state.recoil = Math.max(0, state.recoil - 0.3);
        }

        // Tie muzzle flash to actual fire frame so it cannot linger.
        var frameNow = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : NaN;
        var shotFrame = Number(unit.lastAttack);
        var shotDiff = Number.isFinite(frameNow) && Number.isFinite(shotFrame)
            ? (frameNow - shotFrame)
            : NaN;
        if (Number.isFinite(shotDiff) && shotFrame > 0 && shotDiff >= 0 && shotDiff <= 3) {
            state.mainFlash = Math.max(0, 1 - (shotDiff / 4));
        } else if (state.recoil > 2.8) {
            // Fallback for edge cases where frame counters are unavailable.
            state.mainFlash = Math.max(0, Math.min(0.7, (state.recoil - 2.8) / 6));
        } else {
            state.mainFlash = Math.max(0, Number(state.mainFlash || 0) - 0.30);
        }
        if (state.mainFlash < 0.02) state.mainFlash = 0;

        var vx = Number(unit.vx);
        if (Number.isFinite(vx) && Math.abs(vx) > 0.01) {
            state.trackOffset = (state.trackOffset - vx * 1.2) % 12;
            if (state.trackOffset < 0) state.trackOffset += 12;
        }

        if (Number.isFinite(unit._mgLastShotFrame) && typeof game !== 'undefined' && Number.isFinite(game.frame)) {
            var mgDiff = game.frame - Number(unit._mgLastShotFrame);
            state.mgFlash = mgDiff >= 0 && mgDiff <= 1 ? Math.max(0, 1 - mgDiff) : 0;
        } else {
            state.mgFlash = Math.max(0, state.mgFlash - 0.35);
        }

        return state;
    }

    function setIconState(state, options) {
        if (!state) return state;
        var opts = options || {};
        var turretAngle = Number(opts.turretAngle);
        state.turretAngle = Number.isFinite(turretAngle) ? turretAngle : -0.12;
        state.trackOffset = 4.2;
        state.recoil = 0;
        state.facing = 1;
        state.mainFlash = 0;
        state.mgFlash = 0;
        return state;
    }

    globalScope.UnitRenderV2State_mbt = {
        getState: getState,
        updateRuntimeState: updateRuntimeState,
        setIconState: setIconState
    };
})(typeof window !== 'undefined' ? window : globalThis);
