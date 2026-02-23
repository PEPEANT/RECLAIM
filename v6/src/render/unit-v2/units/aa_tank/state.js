// Per-unit runtime render state for: aa_tank (SPAAG)
(function attachUnitRenderV2State_aa_tank(globalScope) {
    'use strict';

    var DEFAULT_STATE = {
        turretAngle: -Math.PI / 4,
        trackOffset: 0,
        recoil: 0,
        autoFlash: 0,
        samFlash: 0,
        radarAngle: 0,
        barrelToggle: false,
        lastShotFrame: -9999,
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
        var state = store.aa_tank;
        if (!state || typeof state !== 'object') {
            state = Object.assign({}, DEFAULT_STATE);
            store.aa_tank = state;
        }

        if (!Number.isFinite(state.turretAngle)) state.turretAngle = DEFAULT_STATE.turretAngle;
        if (!Number.isFinite(state.trackOffset)) state.trackOffset = DEFAULT_STATE.trackOffset;
        if (!Number.isFinite(state.recoil)) state.recoil = DEFAULT_STATE.recoil;
        if (!Number.isFinite(state.autoFlash)) state.autoFlash = DEFAULT_STATE.autoFlash;
        if (!Number.isFinite(state.samFlash)) state.samFlash = DEFAULT_STATE.samFlash;
        if (!Number.isFinite(state.radarAngle)) state.radarAngle = DEFAULT_STATE.radarAngle;
        if (typeof state.barrelToggle !== 'boolean') state.barrelToggle = DEFAULT_STATE.barrelToggle;
        if (!Number.isFinite(state.lastShotFrame)) state.lastShotFrame = DEFAULT_STATE.lastShotFrame;
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
            state.trackOffset = (Number(state.trackOffset || 0) - vx * 1.35) % 15;
            if (state.trackOffset < 0) state.trackOffset += 15;
        }

        state.radarAngle = Number(state.radarAngle || 0) + 0.08 + Math.min(0.06, Math.abs(vx) * 0.02);
        if (state.radarAngle > Math.PI * 2) state.radarAngle -= Math.PI * 2;

        var frameNow = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : NaN;
        var shotFrame = Number(unit.lastAttack);
        var shotDiff = Number.isFinite(frameNow) && Number.isFinite(shotFrame)
            ? (frameNow - shotFrame)
            : NaN;

        if (Number.isFinite(shotFrame) && shotFrame > 0 && shotFrame !== state.lastShotFrame) {
            state.lastShotFrame = shotFrame;
            state.barrelToggle = !state.barrelToggle;
            state.autoFlash = 1;
            state.recoil = Math.max(Number(state.recoil) || 0, 3.0);
        } else {
            state.autoFlash = Math.max(0, Number(state.autoFlash || 0) - 0.22);
        }

        if (Number.isFinite(shotDiff) && shotDiff >= 0 && shotDiff <= 3) {
            state.autoFlash = Math.max(state.autoFlash, Math.max(0, 1 - (shotDiff / 3.4)));
            state.recoil = Math.max(Number(state.recoil) || 0, Math.max(0, 3.0 - shotDiff));
        } else {
            state.recoil = Math.max(0, Number(state.recoil || 0) - 0.30);
        }

        var missileFlash = Number(unit.missileFlash);
        if (Number.isFinite(missileFlash) && missileFlash > 0) {
            state.samFlash = Math.max(Number(state.samFlash || 0), Math.min(1, missileFlash / 7));
        } else {
            state.samFlash = Math.max(0, Number(state.samFlash || 0) - 0.14);
        }

        return state;
    }

    function setIconState(state, options) {
        if (!state) return state;
        var opts = options || {};
        var turretAngle = Number(opts.turretAngle);
        state.turretAngle = Number.isFinite(turretAngle) ? turretAngle : (-Math.PI / 3.6);
        state.trackOffset = 4.2;
        state.recoil = 0;
        state.autoFlash = 0;
        state.samFlash = 0;
        state.radarAngle = Math.PI * 0.35;
        state.barrelToggle = false;
        state.lastShotFrame = -9999;
        state.facing = 1;
        return state;
    }

    globalScope.UnitRenderV2State_aa_tank = {
        getState: getState,
        updateRuntimeState: updateRuntimeState,
        setIconState: setIconState
    };
})(typeof window !== 'undefined' ? window : globalThis);
