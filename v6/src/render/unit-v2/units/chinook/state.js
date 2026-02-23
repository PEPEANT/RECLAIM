// Per-unit runtime render state for: chinook
(function attachUnitRenderV2State_chinook(globalScope) {
    'use strict';

    var TAU = Math.PI * 2;

    var DEFAULT_STATE = {
        facing: 1,
        frontRotorAngle: 0.15,
        rearRotorAngle: 1.05,
        speed: 0,
        prevX: null,
        phaseSeed: 0,
        phaseSeedReady: false,
        bodyShakeX: 0,
        bodyShakeY: 0,
        hoverBob: 0
    };

    function ensureState(unit) {
        if (!unit || typeof unit !== 'object') return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        if (!unit._renderV2State.chinook || typeof unit._renderV2State.chinook !== 'object') {
            unit._renderV2State.chinook = Object.assign({}, DEFAULT_STATE);
        }
        return unit._renderV2State.chinook;
    }

    function getState(unit) {
        var state = ensureState(unit);
        if (!state) return null;
        state.facing = (state.facing === -1) ? -1 : 1;
        if (!Number.isFinite(state.frontRotorAngle)) state.frontRotorAngle = DEFAULT_STATE.frontRotorAngle;
        if (!Number.isFinite(state.rearRotorAngle)) state.rearRotorAngle = DEFAULT_STATE.rearRotorAngle;
        if (!Number.isFinite(state.speed)) state.speed = 0;
        if (!Number.isFinite(state.prevX)) state.prevX = null;
        if (!Number.isFinite(state.phaseSeed)) state.phaseSeed = 0;
        state.phaseSeedReady = (state.phaseSeedReady === true);
        if (!Number.isFinite(state.bodyShakeX)) state.bodyShakeX = 0;
        if (!Number.isFinite(state.bodyShakeY)) state.bodyShakeY = 0;
        if (!Number.isFinite(state.hoverBob)) state.hoverBob = 0;
        return state;
    }

    function updateRuntimeState(unit, state) {
        if (!unit || !state) return state;

        var facing = Number(unit.facing);
        if (Number.isFinite(facing) && facing !== 0) {
            state.facing = (facing < 0) ? -1 : 1;
        } else {
            state.facing = (String(unit.team || '').trim().toLowerCase() === 'enemy') ? -1 : 1;
        }

        var xNow = Number(unit.x) || 0;
        var vx = Number(unit.vx);
        if (!Number.isFinite(vx)) {
            vx = Number.isFinite(state.prevX) ? (xNow - state.prevX) : 0;
        }
        state.prevX = xNow;
        state.speed = Math.abs(vx);

        if (state.phaseSeedReady !== true) {
            var yNow = Number(unit.y) || 0;
            state.phaseSeed = Math.abs((xNow * 0.09) + (yNow * 0.07)) % TAU;
            state.phaseSeedReady = true;
        }

        var speedRatio = Math.max(0, Math.min(1, state.speed / 3.4));
        var frontStep = 1.22 + (speedRatio * 0.58);
        var rearStep = 1.16 + (speedRatio * 0.55);
        state.frontRotorAngle = (state.frontRotorAngle + frontStep) % TAU;
        state.rearRotorAngle = (state.rearRotorAngle - rearStep + TAU) % TAU;

        var vibe = 0.08 + (speedRatio * 0.08);
        state.bodyShakeX = Math.sin((state.frontRotorAngle * 3.8) + state.phaseSeed) * vibe;
        state.bodyShakeY = Math.cos((state.rearRotorAngle * 4.5) + state.phaseSeed) * (vibe + 0.025);
        state.hoverBob = Math.sin((state.frontRotorAngle * 0.2) + state.phaseSeed) * 0.52;

        return state;
    }

    function setIconState(state, options) {
        if (!state) return state;
        var opts = options || {};
        var facing = Number(opts.facing);
        state.facing = (Number.isFinite(facing) && facing < 0) ? -1 : 1;
        state.frontRotorAngle = Number.isFinite(Number(opts.frontRotorAngle)) ? Number(opts.frontRotorAngle) : 0.18;
        state.rearRotorAngle = Number.isFinite(Number(opts.rearRotorAngle)) ? Number(opts.rearRotorAngle) : 1.15;
        state.speed = 0;
        state.prevX = null;
        state.phaseSeed = 0;
        state.phaseSeedReady = true;
        state.bodyShakeX = 0;
        state.bodyShakeY = 0;
        state.hoverBob = 0;
        return state;
    }

    globalScope.UnitRenderV2State_chinook = {
        getState: getState,
        updateRuntimeState: updateRuntimeState,
        setIconState: setIconState
    };
})(typeof window !== 'undefined' ? window : globalThis);
