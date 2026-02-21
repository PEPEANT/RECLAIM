// Per-unit runtime render state for: blackhawk (UH-60)
(function attachUnitRenderV2State_blackhawk(globalScope) {
    'use strict';

    var TAU = Math.PI * 2;

    var DEFAULT_STATE = {
        facing: 1,
        mainRotorAngle: 0,
        tailRotorAngle: 0,
        bodyShakeX: 0,
        bodyShakeY: 0,
        hoverBob: 0,
        muzzleFlash: 0,
        lastAttackFrame: -1,
        speed: 0,
        prevX: null,
        phaseSeed: 0,
        phaseSeedReady: false
    };

    function ensureState(unit) {
        if (!unit || typeof unit !== 'object') return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        if (!unit._renderV2State.blackhawk || typeof unit._renderV2State.blackhawk !== 'object') {
            unit._renderV2State.blackhawk = Object.assign({}, DEFAULT_STATE);
        }
        return unit._renderV2State.blackhawk;
    }

    function getState(unit) {
        var state = ensureState(unit);
        if (!state) return null;

        state.facing = (state.facing === -1) ? -1 : 1;
        if (!Number.isFinite(state.mainRotorAngle)) state.mainRotorAngle = 0;
        if (!Number.isFinite(state.tailRotorAngle)) state.tailRotorAngle = 0;
        if (!Number.isFinite(state.bodyShakeX)) state.bodyShakeX = 0;
        if (!Number.isFinite(state.bodyShakeY)) state.bodyShakeY = 0;
        if (!Number.isFinite(state.hoverBob)) state.hoverBob = 0;
        if (!Number.isFinite(state.muzzleFlash)) state.muzzleFlash = 0;
        if (!Number.isFinite(state.lastAttackFrame)) state.lastAttackFrame = -1;
        if (!Number.isFinite(state.speed)) state.speed = 0;
        if (!Number.isFinite(state.prevX)) state.prevX = null;
        if (!Number.isFinite(state.phaseSeed)) state.phaseSeed = 0;
        state.phaseSeedReady = (state.phaseSeedReady === true);

        return state;
    }

    function updateRuntimeState(unit, state) {
        if (!unit || !state) return state;

        var facing = Number(unit.facing);
        if (Number.isFinite(facing) && facing !== 0) {
            state.facing = facing > 0 ? 1 : -1;
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
            state.phaseSeed = Math.abs((xNow * 0.11) + (yNow * 0.07)) % TAU;
            state.phaseSeedReady = true;
        }

        var speedRatio = Math.max(0, Math.min(1, state.speed / 3.4));
        var mainStep = 0.34 + (speedRatio * 0.14);
        var tailStep = 1.25 + (speedRatio * 0.55);

        state.mainRotorAngle = (state.mainRotorAngle + mainStep) % TAU;
        state.tailRotorAngle = (state.tailRotorAngle + tailStep) % TAU;

        var vibe = 0.12 + (speedRatio * 0.10);
        state.bodyShakeX = Math.sin((state.mainRotorAngle * 4.8) + state.phaseSeed) * vibe;
        state.bodyShakeY = Math.cos((state.mainRotorAngle * 6.9) + state.phaseSeed) * (vibe + 0.04);
        state.hoverBob = Math.sin((state.mainRotorAngle * 0.35) + state.phaseSeed) * 0.55;

        var attackFrame = Number(unit.lastAttack);
        if (Number.isFinite(attackFrame) && attackFrame > 0 && attackFrame !== state.lastAttackFrame) {
            state.lastAttackFrame = attackFrame;
            state.muzzleFlash = 1;
        }
        state.muzzleFlash = Math.max(0, (Number(state.muzzleFlash) || 0) - 0.20);

        return state;
    }

    function setIconState(state, options) {
        if (!state) return state;
        var opts = options || {};
        var facing = Number(opts.facing);
        state.facing = (Number.isFinite(facing) && facing < 0) ? -1 : 1;
        state.mainRotorAngle = Number.isFinite(Number(opts.mainRotorAngle)) ? Number(opts.mainRotorAngle) : 0.2;
        state.tailRotorAngle = Number.isFinite(Number(opts.tailRotorAngle)) ? Number(opts.tailRotorAngle) : 0.8;
        state.bodyShakeX = 0;
        state.bodyShakeY = 0;
        state.hoverBob = 0;
        state.muzzleFlash = 0;
        state.lastAttackFrame = -1;
        state.speed = 0;
        state.prevX = null;
        state.phaseSeed = 0;
        state.phaseSeedReady = true;
        return state;
    }

    globalScope.UnitRenderV2State_blackhawk = {
        getState: getState,
        updateRuntimeState: updateRuntimeState,
        setIconState: setIconState
    };
})(typeof window !== 'undefined' ? window : globalThis);
