// Per-unit runtime render state for: infantry
(function attachUnitRenderV2State_infantry(globalScope) {
    'use strict';

    var TAU = Math.PI * 2;

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

    function getFrameNow() {
        return (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : 0;
    }

    function getEffectiveRange(unit) {
        if (!unit) return 0;
        var r = 0;
        if (typeof unit.getEffectiveRange === 'function') {
            r = Number(unit.getEffectiveRange());
        }
        if (!Number.isFinite(r) || r <= 0) {
            r = Number(unit.stats && unit.stats.range);
        }
        if (!Number.isFinite(r) || r < 0) r = 0;
        return r;
    }

    function isInfantryLike(unit) {
        if (!unit || !unit.stats) return false;
        return String(unit.stats.category || '') === 'infantry';
    }

    function getTeamUnits(team) {
        if (typeof game === 'undefined' || !game) return null;
        var list = (team === 'player') ? game.players : game.enemies;
        return Array.isArray(list) ? list : null;
    }

    function getFormationInfo(unit, target) {
        var info = {
            frontCount: 0,
            rearCount: 0,
            hasFrontOverlap: false,
            hasRearOverlap: false,
            sameTargetCount: 1
        };
        if (!unit || !target) return info;

        var allies = getTeamUnits(unit.team);
        if (!allies || allies.length <= 1) return info;

        var targetX = Number(target.x);
        var selfX = Number(unit.x);
        if (!Number.isFinite(targetX) || !Number.isFinite(selfX)) return info;

        var selfDist = Math.abs(targetX - selfX);
        var overlapGap = 20;
        var tierGap = 4;

        for (var i = 0; i < allies.length; i++) {
            var ally = allies[i];
            if (!ally || ally === unit || ally.dead) continue;
            if (!isInfantryLike(ally)) continue;
            if (ally.attackTarget !== target) continue;

            info.sameTargetCount += 1;
            var allyX = Number(ally.x);
            if (!Number.isFinite(allyX)) continue;
            var allyDist = Math.abs(targetX - allyX);
            var overlap = Math.abs(allyX - selfX) <= overlapGap;

            if (allyDist + tierGap < selfDist) {
                info.frontCount += 1;
                if (overlap) info.hasFrontOverlap = true;
            } else if (allyDist > selfDist + tierGap) {
                info.rearCount += 1;
                if (overlap) info.hasRearOverlap = true;
            }
        }

        return info;
    }

    function chooseDesiredStance(unit, state, frameNow, hp, hpRatio, vx) {
        var target = (unit && unit.attackTarget && !unit.attackTarget.dead) ? unit.attackTarget : null;
        var effRange = getEffectiveRange(unit);
        var targetDist = target ? Math.abs((Number(target.x) || 0) - (Number(unit.x) || 0)) : Infinity;
        var inRange = !!target && targetDist <= (effRange + 14);
        var moving = Math.abs(vx) > 0.08 || Number(state.moveBlend || 0) > 0.16 || unit.commandMode === 'move';
        var underFire = Number.isFinite(Number(unit.lastDamagedFrame)) && (frameNow - Number(unit.lastDamagedFrame) <= 90);
        var lowHp = (hp <= 40) || (hpRatio <= 0.45);
        var criticalHp = (hp <= 28) || (hpRatio <= 0.32);
        var longRangeFight = !!target && targetDist >= Math.max(180, effRange * 0.62);
        var closeRangeFight = !!target && targetDist <= Math.min(130, Math.max(90, effRange * 0.35));

        if (moving) {
            return {
                stance: 'standing',
                moving: true,
                underFire: underFire,
                critical: criticalHp
            };
        }

        if (!target || !inRange) {
            return {
                stance: (underFire && lowHp) ? 'crouching' : 'standing',
                moving: false,
                underFire: underFire,
                critical: criticalHp
            };
        }

        var formation = getFormationInfo(unit, target);
        var desired = 'crouching';

        // Rear infantry can keep standing if front line already exists.
        if (formation.hasFrontOverlap && !underFire && !lowHp) desired = 'standing';

        // Front infantry lowers stance so rear infantry can shoot over.
        if (formation.hasRearOverlap) desired = 'crouching';

        var pressured = underFire || formation.sameTargetCount >= 3;
        if (!closeRangeFight && (criticalHp || (lowHp && pressured && longRangeFight))) desired = 'prone';
        else if (!closeRangeFight && longRangeFight && formation.hasRearOverlap && pressured) desired = 'prone';

        if (formation.hasRearOverlap && desired === 'standing') desired = 'crouching';

        return {
            stance: desired,
            moving: false,
            underFire: underFire,
            critical: criticalHp
        };
    }

    function applyStanceTransition(state, desiredInfo) {
        if (!state || !desiredInfo) return;

        var desired = desiredInfo.stance || 'standing';
        if (state.stance === desired) {
            state.desiredStance = desired;
            state.desiredStanceFrames = 0;
            return;
        }

        if (state.desiredStance !== desired) {
            state.desiredStance = desired;
            state.desiredStanceFrames = 1;
        } else {
            state.desiredStanceFrames = (Number(state.desiredStanceFrames) || 0) + 1;
        }

        var framesNeeded = 6;
        if (desired === 'prone' || state.stance === 'prone') framesNeeded = 8;
        if (desiredInfo.moving && state.stance === 'prone') framesNeeded = 2;
        if (desiredInfo.critical) framesNeeded = Math.min(framesNeeded, 2);
        if (desiredInfo.underFire && desired !== 'standing') framesNeeded = Math.min(framesNeeded, 4);

        if (state.desiredStanceFrames >= framesNeeded) {
            state.stance = desired;
            state.desiredStanceFrames = 0;
        }
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

        var frameNow = getFrameNow();

        var currentAttackFrame = Number(unit.lastAttack);
        if (Number.isFinite(currentAttackFrame) && currentAttackFrame > 0 && currentAttackFrame !== state.lastAttackFrame) {
            state.lastAttackFrame = currentAttackFrame;
            state.recoil = 3;
            state.muzzleFlash = 4;
        }

        state.recoil = (state.recoil > 0) ? state.recoil * 0.65 : 0;
        if (state.recoil < 0.05) state.recoil = 0;
        state.muzzleFlash = Math.max(0, Number(state.muzzleFlash || 0) - 1);

        var xNow = Number(unit.x) || 0;
        var vx = Number(unit.vx);
        if (!Number.isFinite(vx) || Math.abs(vx) < 0.001) {
            vx = Number.isFinite(state.prevX) ? (xNow - Number(state.prevX)) : 0;
        }
        state.prevX = xNow;
        state.velocityX = vx;

        var speedAbs = Math.abs(vx);
        var speedRef = Math.max(0.6, Number(unit.stats && unit.stats.speed) || 0.9);
        var moveTarget = clamp(speedAbs / (speedRef * 1.2), 0, 1);
        state.moveBlend += (moveTarget - state.moveBlend) * 0.18;
        if (state.moveBlend < 0.001) state.moveBlend = 0;

        var desiredInfo = chooseDesiredStance(unit, state, frameNow, hp, hpRatio, vx);
        applyStanceTransition(state, desiredInfo);

        var cadence = 0.08 + (0.30 * state.moveBlend) + (speedAbs * 0.20);
        state.walkCycle = (Number(state.walkCycle) + cadence) % TAU;
        if (state.walkCycle < 0) state.walkCycle += TAU;

        if (state.phaseSeedReady !== true) {
            var base = Math.abs((Number(unit.x) || 0) * 0.17 + (Number(unit.y) || 0) * 0.07);
            state.phaseSeed = base % TAU;
            state.phaseSeedReady = true;
        }

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
