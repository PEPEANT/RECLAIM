// Per-unit runtime render state for: humvee
(function attachUnitRenderV2State_humvee(globalScope) {
    'use strict';

    var DEFAULT_STATE = {
        turretAngle: -0.08,
        wheelAngle: 0,
        bounceY: 0,
        bounceTick: 0,
        mgFlash: 0,
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
        var state = store.humvee;
        if (!state || typeof state !== 'object') {
            state = Object.assign({}, DEFAULT_STATE);
            store.humvee = state;
        }
        if (!Number.isFinite(state.turretAngle)) state.turretAngle = DEFAULT_STATE.turretAngle;
        if (!Number.isFinite(state.wheelAngle)) state.wheelAngle = DEFAULT_STATE.wheelAngle;
        if (!Number.isFinite(state.bounceY)) state.bounceY = DEFAULT_STATE.bounceY;
        if (!Number.isFinite(state.bounceTick)) state.bounceTick = DEFAULT_STATE.bounceTick;
        if (!Number.isFinite(state.mgFlash)) state.mgFlash = DEFAULT_STATE.mgFlash;
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

        state.wheelAngle = (Number(state.wheelAngle || 0) + (vx * 0.15)) % (Math.PI * 2);
        if (state.wheelAngle < 0) state.wheelAngle += Math.PI * 2;

        var movingFast = Math.abs(vx) > 0.45;
        if (movingFast) {
            state.bounceTick = Number(state.bounceTick || 0) + (Math.abs(vx) * 0.16);
            state.bounceY = Math.sin(state.bounceTick) * 1.4;
        } else {
            state.bounceY = Number(state.bounceY || 0) * 0.82;
        }

        var frameNow = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : NaN;
        if (Number.isFinite(frameNow)) {
            var srcFrame = Number(unit._mgLastShotFrame);
            if (!Number.isFinite(srcFrame)) srcFrame = Number(unit.lastAttack);
            var diff = frameNow - srcFrame;
            state.mgFlash = (Number.isFinite(diff) && diff >= 0 && diff <= 1) ? Math.max(0, 1 - diff) : Math.max(0, Number(state.mgFlash || 0) - 0.25);
        } else {
            state.mgFlash = Math.max(0, Number(state.mgFlash || 0) - 0.25);
        }

        var moving = Math.abs(vx) > 0.2;
        if (moving) {
            state.exhaustAlpha = Math.min(0.55, 0.14 + (Math.abs(vx) * 0.08));
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
        state.wheelAngle = 0.6;
        state.bounceY = 0;
        state.bounceTick = 0;
        state.mgFlash = 0;
        state.exhaustAlpha = 0;
        state.facing = 1;
        return state;
    }

    globalScope.UnitRenderV2State_humvee = {
        getState: getState,
        updateRuntimeState: updateRuntimeState,
        setIconState: setIconState
    };
})(typeof window !== 'undefined' ? window : globalThis);
