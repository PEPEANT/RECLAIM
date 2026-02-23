// Per-unit runtime render state for: bomber
(function attachUnitRenderV2State_bomber(globalScope) {
    'use strict';

    var TAU = Math.PI * 2;

    var DEFAULT_STATE = {
        facing: 1,
        speed: 0,
        prevX: null,
        phaseSeed: 0,
        phaseSeedReady: false,
        hoverPhase: 0,
        hoverOffsetY: 0,
        jitterX: 0,
        jitterY: 0,
        wingSweep: 0.18,
        gearDown: 1,
        afterburner: 0.12,
        flamePhase: 0,
        bombPulse: 0,
        lastBombFrame: -1
    };

    function clamp(v, min, max) {
        if (!Number.isFinite(v)) return min;
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    function ensureState(unit) {
        if (!unit || typeof unit !== 'object') return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        if (!unit._renderV2State.bomber || typeof unit._renderV2State.bomber !== 'object') {
            unit._renderV2State.bomber = Object.assign({}, DEFAULT_STATE);
        }
        return unit._renderV2State.bomber;
    }

    function getState(unit) {
        var state = ensureState(unit);
        if (!state) return null;

        var keys = Object.keys(DEFAULT_STATE);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (typeof DEFAULT_STATE[key] === 'number' && !Number.isFinite(state[key])) {
                state[key] = DEFAULT_STATE[key];
            }
        }
        state.facing = (state.facing === -1) ? -1 : 1;
        state.phaseSeedReady = (state.phaseSeedReady === true);
        state.prevX = Number.isFinite(state.prevX) ? state.prevX : null;

        return state;
    }

    function getCurrentFrame() {
        var g = globalScope.game;
        var frame = Number(g && g.frame);
        return Number.isFinite(frame) ? frame : 0;
    }

    function updateState(unit, state) {
        if (!unit || !state) return state;

        var facing = Number(unit.facing);
        if (Number.isFinite(facing) && facing !== 0) {
            state.facing = (facing < 0) ? -1 : 1;
        } else {
            state.facing = (String(unit.team || '') === 'enemy') ? -1 : 1;
        }

        var xNow = Number(unit.x) || 0;
        var vx = Number(unit.vx);
        if (!Number.isFinite(vx) || Math.abs(vx) < 0.001) {
            vx = Number.isFinite(state.prevX) ? (xNow - state.prevX) : 0;
        }
        state.prevX = xNow;
        state.speed = Math.abs(vx);

        if (state.phaseSeedReady !== true) {
            var yNow = Number(unit.y) || 0;
            state.phaseSeed = Math.abs((xNow * 0.12) + (yNow * 0.08)) % TAU;
            state.phaseSeedReady = true;
        }

        state.hoverPhase = (Number(state.hoverPhase) + 0.04 + Math.min(0.07, state.speed * 0.013)) % TAU;
        var hoverAmp = 0.4 + Math.min(1.2, state.speed * 0.35);
        state.hoverOffsetY = Math.sin(state.hoverPhase + state.phaseSeed) * hoverAmp;

        var frame = getCurrentFrame();
        var bombFrame = Number(unit.lastBomb);
        if (Number.isFinite(bombFrame) && bombFrame > 0 && bombFrame !== state.lastBombFrame) {
            state.lastBombFrame = bombFrame;
            state.bombPulse = 1;
        }
        state.bombPulse = Math.max(0, (Number(state.bombPulse) || 0) * 0.9 - 0.02);

        var hasRecentBomb = Number.isFinite(state.lastBombFrame) && frame > 0 && ((frame - state.lastBombFrame) < 80);
        var hasTarget = !!(unit.attackTarget && unit.attackTarget.dead !== true);
        var highSpeed = state.speed > 2.35;
        var combatMode = hasTarget || hasRecentBomb;

        var sweepTarget = (highSpeed || combatMode) ? 1 : 0.15;
        state.wingSweep = clamp(Number(state.wingSweep) + (sweepTarget - Number(state.wingSweep)) * 0.08, 0, 1);

        var gearTarget = (highSpeed || combatMode) ? 0 : 1;
        state.gearDown = clamp(Number(state.gearDown) + (gearTarget - Number(state.gearDown)) * 0.12, 0, 1);

        var afterburnerTarget = (highSpeed || combatMode) ? 1 : 0.16;
        state.afterburner = clamp(Number(state.afterburner) + (afterburnerTarget - Number(state.afterburner)) * 0.1, 0, 1);

        state.flamePhase = (Number(state.flamePhase) + 0.22 + (state.speed * 0.08) + (state.afterburner * 0.25)) % TAU;

        var jitterAmp = 0.08 + (state.afterburner * 0.42) + (state.bombPulse * 0.28);
        state.jitterX = Math.sin((state.hoverPhase * 8.2) + state.phaseSeed) * jitterAmp;
        state.jitterY = Math.cos((state.hoverPhase * 9.4) + state.phaseSeed) * jitterAmp * 0.85;

        return state;
    }

    function setIconState(state, options) {
        if (!state) return state;
        var opts = options || {};

        var facing = Number(opts.facing);
        state.facing = (Number.isFinite(facing) && facing < 0) ? -1 : 1;
        state.speed = 2.6;
        state.prevX = null;
        state.phaseSeed = 0;
        state.phaseSeedReady = true;
        state.hoverPhase = 0;
        state.hoverOffsetY = 0;
        state.jitterX = 0;
        state.jitterY = 0;

        state.wingSweep = clamp(Number(opts.wingSweep), 0, 1);
        if (!Number.isFinite(state.wingSweep)) state.wingSweep = 0.72;
        state.gearDown = clamp(Number(opts.gearDown), 0, 1);
        if (!Number.isFinite(state.gearDown)) state.gearDown = 0;
        state.afterburner = clamp(Number(opts.afterburner), 0, 1);
        if (!Number.isFinite(state.afterburner)) state.afterburner = 0.55;
        state.flamePhase = Number.isFinite(Number(opts.flamePhase)) ? Number(opts.flamePhase) : 0.7;

        state.bombPulse = 0;
        state.lastBombFrame = -1;
        return state;
    }

    globalScope['UnitRenderV2State_bomber'] = {
        getState: getState,
        updateState: updateState,
        setIconState: setIconState
    };
})(typeof window !== 'undefined' ? window : globalThis);
