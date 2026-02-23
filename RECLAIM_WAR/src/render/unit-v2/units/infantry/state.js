// Per-unit runtime render state for: infantry
(function attachUnitRenderV2State_infantry(globalScope) {
    'use strict';

    var TAU = Math.PI * 2;

    var DEFAULT_STATE = {
        stance: 'standing',
        desiredStance: 'standing',
        desiredStanceFrames: 0,
        stanceStableFrames: 0,
        stationaryFrames: 0,
        stationaryAnchorX: null,
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

    // ~60fps 기준. 필요한 경우 이 초 단위 값만 조절하면 됨.
    var STANCE_TIMING_SEC = {
        crouchMinHold: 1.0,      // 앉은 자세 최소 유지 시간
        crouchToPronePrep: 0.8,  // 앉은 후 누울 수 있기까지 준비 시간
        proneMinHold: 1.4        // 누운 자세 최소 유지 시간
    };

    function secToFrames(sec) {
        var s = Number(sec);
        if (!Number.isFinite(s) || s <= 0) return 1;
        return Math.max(1, Math.round(s * 60));
    }

    var CROUCH_MIN_HOLD_FRAMES = secToFrames(STANCE_TIMING_SEC.crouchMinHold);
    var CROUCH_TO_PRONE_PREP_FRAMES = secToFrames(STANCE_TIMING_SEC.crouchToPronePrep);
    var PRONE_MIN_HOLD_FRAMES = secToFrames(STANCE_TIMING_SEC.proneMinHold);

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
        var moving = desiredInfo.moving === true;
        var stanceStable = Number(state.stanceStableFrames) || 0;
        var stationaryFrames = Number(state.stationaryFrames) || 0;

        // Hard rule: standing -> prone direct jump is not allowed.
        if (state.stance === 'standing' && desired === 'prone') {
            desired = 'crouching';
        }

        if (!moving) {
            // Crouch/prone must hold for a while when stationary.
            if (state.stance === 'crouching') {
                // Prone transition requires staying on almost the same spot.
                if (desired === 'prone' && stationaryFrames < CROUCH_TO_PRONE_PREP_FRAMES) {
                    desired = 'crouching';
                } else if (desired === 'standing' && stanceStable < CROUCH_MIN_HOLD_FRAMES) {
                    desired = 'crouching';
                }
            } else if (state.stance === 'prone') {
                if (desired !== 'prone' && stanceStable < PRONE_MIN_HOLD_FRAMES) {
                    desired = 'prone';
                }
            }
        }

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

        var forcedStanceRaw = String(unit._forcedInfantryStance || '').trim().toLowerCase();
        var forcedStance = (
            forcedStanceRaw === 'standing'
            || forcedStanceRaw === 'crouching'
            || forcedStanceRaw === 'prone'
        ) ? forcedStanceRaw : '';
        if (forcedStance && String(unit.commandMode || '').trim().toLowerCase() === 'stop') {
            var xForced = Number(unit.x) || 0;
            state.prevX = xForced;
            state.velocityX = 0;
            state.stationaryAnchorX = xForced;
            state.stationaryFrames = (Number(state.stationaryFrames) || 0) + 1;
            state.stance = forcedStance;
            state.desiredStance = forcedStance;
            state.desiredStanceFrames = 0;
            state.stanceStableFrames = (Number(state.stanceStableFrames) || 0) + 1;
            state.moveBlend = 0;
            state.legSwing = 0;
            state.armSwing = 0;
            if (state.phaseSeedReady !== true) {
                var seedBase = Math.abs((Number(unit.x) || 0) * 0.17 + (Number(unit.y) || 0) * 0.07);
                state.phaseSeed = seedBase % TAU;
                state.phaseSeedReady = true;
            }
            var idleForced = (frameNow * 0.07) + state.phaseSeed;
            state.idleBreath = Math.sin(idleForced) * 0.35;
            state.bodyBob = Math.abs(state.idleBreath) * 0.4;
            state.torsoLean = 0;
            state.weaponBobX = 0;
            state.weaponBobY = state.idleBreath * 0.3;
            state.weaponSway = 0;
            return;
        } else if (forcedStance) {
            // Intro pose should only lock while holding position.
            unit._forcedInfantryStance = null;
        }

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

        // Track "holding position" frames for crouch->prone preparation.
        var isStationaryNow = (Math.abs(vx) <= 0.03)
            && (moveTarget <= 0.05)
            && (unit.commandMode !== 'move');
        if (isStationaryNow) {
            var anchorX = Number(state.stationaryAnchorX);
            if (!Number.isFinite(anchorX)) {
                state.stationaryAnchorX = xNow;
                state.stationaryFrames = 1;
            } else {
                var drift = Math.abs(xNow - anchorX);
                if (drift <= 1.8) {
                    state.stationaryFrames = (Number(state.stationaryFrames) || 0) + 1;
                } else {
                    state.stationaryAnchorX = xNow;
                    state.stationaryFrames = 1;
                }
            }
        } else {
            state.stationaryAnchorX = xNow;
            state.stationaryFrames = 0;
        }

        var desiredInfo = chooseDesiredStance(unit, state, frameNow, hp, hpRatio, vx);
        var prevStance = state.stance;
        applyStanceTransition(state, desiredInfo);
        if (state.stance === prevStance) {
            state.stanceStableFrames = (Number(state.stanceStableFrames) || 0) + 1;
        } else {
            state.stanceStableFrames = 0;
        }

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
