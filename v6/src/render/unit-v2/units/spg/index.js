// Unit Render V2 entry for: spg
// [SPG 고정 요구사항]
// 1) K9 계열 차체/포탑 실루엣 반영
// 2) 고각 조준 범위 유지 + 이동/전투 자세 분리
// 3) 포구 화염/반동/탄착 파이프라인 유지
// 4) 이동 중 AI는 하강 자세, 교전 시 상승 자세
(function attachUnitRenderV2_spg(globalScope) {
    'use strict';

    var BATTLE_MODEL_SCALE = 0.60;
    var BATTLE_BASE_DRAW_SCALE = 1.4 * 1.16;
    var BATTLE_WORLD_SCALE = BATTLE_BASE_DRAW_SCALE * BATTLE_MODEL_SCALE;
    var MANUAL_AIM_STALE_FRAMES = 45;
    var SPG_SHOT_AIM_STALE_FRAMES = 25;
    var DEG_TO_RAD = Math.PI / 180;
    // Move posture: keep a mild raised angle (do not point to ground while moving).
    var SPG_MOVE_DOWN_TARGET = (-10 * Math.PI) / 180;
    var SPG_FIRE_READY_ANGLE_DEG = -16; // fire gate: must be raised above this

    function normalizeAngleRad(value) {
        var v = Number(value);
        if (!Number.isFinite(v)) return 0;
        while (v <= -Math.PI) v += Math.PI * 2;
        while (v > Math.PI) v -= Math.PI * 2;
        return v;
    }

    function stepAngleToward(current, target, maxStep) {
        var c = Number(current);
        var t = Number(target);
        var s = Number(maxStep);
        if (!Number.isFinite(t)) return c;
        if (!Number.isFinite(c)) return t;
        if (!Number.isFinite(s) || s <= 0) return t;

        var diff = normalizeAngleRad(t - c);
        if (Math.abs(diff) <= s) return t;
        return c + (diff > 0 ? s : -s);
    }

    function getDeps() {
        return {
            stateApi: globalScope.UnitRenderV2State_spg,
            weaponApi: globalScope.UnitRenderV2Weapons_spg,
            bodyApi: globalScope.UnitRenderV2Body_spg,
            partsApi: globalScope.UnitRenderV2Parts_spg,
            fxApi: globalScope.UnitRenderV2Fx_spg
        };
    }

    function resolvePalette(unit, options) {
        var team = String(options && options.team ? options.team : (unit && unit.team ? unit.team : 'player')).trim();
        if (team === 'enemy') {
            return {
                base: '#8b7a5a',
                dark: '#6f5f45',
                shadow: '#4b3f2f',
                track: '#1a1a1a',
                wheelOuter: '#151515',
                wheelInner: '#6b5d45',
                hub: '#111',
                accent: '#5a4630',
                accent2: '#3f3021',
                enemyPattern: false
            };
        }
        if (team !== 'player') return null;
        return {
            base: '#4A5D23',
            dark: '#324016',
            shadow: '#212B0E',
            track: '#1a1a1a',
            wheelOuter: '#151515',
            wheelInner: '#324016',
            hub: '#111',
            accent: '#3f2f1d',
            accent2: '#2a2014',
            enemyPattern: false
        };
    }

    function drawModel(unit, ctx, state, options) {
        if (!ctx) return false;
        var deps = getDeps();
        if (!deps.stateApi || !deps.weaponApi || !deps.bodyApi || !deps.partsApi || !deps.fxApi) return false;

        var palette = resolvePalette(unit, options || {});
        if (!palette) return false;

        var opts = options || {};
        var iconMode = opts.iconMode === true;
        var iconScale = Number(opts.iconScale);
        var modelScale = Number(opts.modelScale);
        var facing = Number(opts.facing);
        if (!Number.isFinite(facing) || facing === 0) facing = Number(state && state.facing) || 1;

        ctx.save();
        if (facing < 0) ctx.scale(-1, 1);

        if (Number.isFinite(modelScale) && modelScale > 0 && modelScale !== 1) {
            if (!iconMode) {
                var groundPivotY = 15;
                ctx.translate(0, groundPivotY);
                ctx.scale(modelScale, modelScale);
                ctx.translate(0, -groundPivotY);
            } else {
                ctx.scale(modelScale, modelScale);
            }
        }
        if (Number.isFinite(iconScale) && iconScale > 0 && iconScale !== 1) {
            ctx.scale(iconScale, iconScale);
        }

        deps.partsApi.drawTracksAndWheels(ctx, state, palette);
        deps.bodyApi.drawBody(unit, ctx, palette);
        deps.partsApi.drawTurret(ctx, state, palette, opts);

        if (iconMode) {
            deps.fxApi.drawEngineHeat(ctx, { alpha: 0.12 });
        }

        var muzzle = deps.weaponApi.computeMuzzleLocal(state, { barrelLength: 155 });
        if (!iconMode && Number(state && state.mainFlash) > 0.05) {
            deps.fxApi.drawMainMuzzleFlash(ctx, {
                x: 10 + muzzle.x,
                y: -61 + muzzle.y,
                angle: muzzle.angle,
                alpha: state.mainFlash
            });
        }

        ctx.restore();
        return true;
    }

    function draw(unit, ctx, env) {
        if (!unit || !ctx || !unit.stats || String(unit.stats.id || '') !== 'spg') return false;
        var deps = getDeps();
        if (!deps.stateApi || !deps.weaponApi) return false;

        var state = deps.stateApi.getState(unit);
        if (!state) return false;
        deps.stateApi.updateRuntimeState(unit, state);

        var speedX = Math.abs(Number(unit.vx) || 0);
        var wasMoving = state._spgWasMoving === true;
        var cmd = String(unit.commandMode || '').trim().toLowerCase();
        var moving = wasMoving ? (speedX > 0.05) : (speedX > 0.14);
        // Keep gun stowed whenever SPG is explicitly in move/retreat travel modes.
        if (cmd === 'move' || cmd === 'retreat' || unit.returnToBase === true) {
            moving = true;
        }
        if (!moving && speedX > 0.04 && cmd !== 'stop') {
            moving = true;
        }

        var tx = null;
        var ty = null;
        var manualX = Number(unit.manualAimX);
        var manualY = Number(unit.manualAimY);
        var manualFrame = Number(unit.manualAimFrame);
        var frameNow = Number(env && env.frame);
        if (!Number.isFinite(frameNow)) {
            var gameRef = (globalScope && globalScope.game) ? globalScope.game : null;
            frameNow = Number(gameRef && gameRef.frame);
        }
        var hasManualAim = unit.team === 'player'
            && unit.isSelected === true
            && Number.isFinite(manualX)
            && Number.isFinite(manualY)
            && (!Number.isFinite(frameNow) || !Number.isFinite(manualFrame) || (frameNow - manualFrame) <= MANUAL_AIM_STALE_FRAMES);
        var shotAimX = Number(unit._spgLastShotAimX);
        var shotAimY = Number(unit._spgLastShotAimY);
        var shotAimFrame = Number(unit._spgLastShotFrame);
        var hasRecentShotAim = Number.isFinite(shotAimX)
            && Number.isFinite(shotAimY)
            && Number.isFinite(frameNow)
            && Number.isFinite(shotAimFrame)
            && ((frameNow - shotAimFrame) <= SPG_SHOT_AIM_STALE_FRAMES);

        var liveTarget = (unit.attackTarget && !unit.attackTarget.dead) ? unit.attackTarget : null;

        if (hasManualAim) {
            tx = manualX;
            ty = manualY;
        } else if (hasRecentShotAim) {
            tx = shotAimX;
            ty = shotAimY;
        } else {
            if (liveTarget) {
                tx = Number(liveTarget.x);
                ty = Number(liveTarget.y) - (Number(liveTarget.height) || 0) * 0.25;
            }
        }

        var hasAimTarget = Number.isFinite(tx) && Number.isFinite(ty);
        var allowCombatElevation = !!liveTarget
            || hasRecentShotAim
            || (hasManualAim && unit.isDirectControl === true);
        if (moving) {
            state.gunAngle = stepAngleToward(state.gunAngle, SPG_MOVE_DOWN_TARGET, 0.9 * DEG_TO_RAD);
        } else if (hasAimTarget && allowCombatElevation) {
            var arcRaw = Number(unit._spgLastShotArcHeight);
            var gravRaw = Number(unit._spgLastShotGrav);
            var arcHeight = Number.isFinite(arcRaw)
                ? Math.max(28, arcRaw)
                : Math.max(90, Math.min(260, Math.round(Math.abs(tx - (Number(unit.x) || 0)) * 0.20)));
            var grav = Number.isFinite(gravRaw) ? Math.max(0.05, gravRaw) : 0.33;
            var next = -Math.PI / 4;
            if (deps.weaponApi && typeof deps.weaponApi.computeBallisticAimAngleFromPoint === 'function') {
                next = deps.weaponApi.computeBallisticAimAngleFromPoint(unit, tx, ty, {
                    arcHeight: arcHeight,
                    grav: grav
                });
            } else if (deps.weaponApi && typeof deps.weaponApi.computeAimAngleFromPoint === 'function') {
                next = deps.weaponApi.computeAimAngleFromPoint(unit, tx, ty);
            }
            var combatReadyAngleRad = SPG_FIRE_READY_ANGLE_DEG * DEG_TO_RAD;
            if (next > combatReadyAngleRad) next = combatReadyAngleRad;
            state.gunAngle = stepAngleToward(state.gunAngle, next, 1.05 * DEG_TO_RAD);
        } else {
            var idleTarget = (unit.team === 'enemy')
                ? ((-20 * Math.PI) / 180)
                : ((-18 * Math.PI) / 180);
            state.gunAngle = stepAngleToward(state.gunAngle, idleTarget, 0.7 * DEG_TO_RAD);
        }
        state._spgWasMoving = moving;

        state.gunAngle = deps.weaponApi.clampGunAngle(state.gunAngle);

        var normalizedDeg = state.gunAngle * 180 / Math.PI;
        while (normalizedDeg <= -180) normalizedDeg += 360;
        while (normalizedDeg > 180) normalizedDeg -= 360;
        unit._spgGunAngleDeg = normalizedDeg;
        unit._spgFireBlockDeg = 140;
        unit._spgFireReadyAngleDeg = SPG_FIRE_READY_ANGLE_DEG;
        unit._spgIsMoving = moving;
        var blockedByHardLimit = Math.abs(normalizedDeg) >= unit._spgFireBlockDeg;
        var raisedForFire = normalizedDeg <= SPG_FIRE_READY_ANGLE_DEG;
        unit._spgFireReady = !moving && raisedForFire && !blockedByHardLimit;
        unit._spgFireBlocked = blockedByHardLimit || !unit._spgFireReady;

        return drawModel(unit, ctx, state, {
            team: unit.team,
            iconMode: false,
            facing: state.facing,
            modelScale: BATTLE_MODEL_SCALE
        });
    }

    function drawIcon(ctx, options) {
        if (!ctx) return false;
        var deps = getDeps();
        if (!deps.stateApi || !deps.weaponApi) return false;

        var state = {
            gunAngle: -Math.PI / 12,
            trackOffset: 4.2,
            recoil: 0,
            mainFlash: 0,
            facing: 1
        };
        deps.stateApi.setIconState(state, options || {});
        state.gunAngle = deps.weaponApi.clampGunAngle(state.gunAngle);

        return drawModel({ team: 'player', stats: { id: 'spg' } }, ctx, state, {
            team: 'player',
            iconMode: true,
            iconScale: Number(options && options.iconScale)
        });
    }

    var api = {
        draw: draw,
        drawIcon: drawIcon,
        getBattleWorldScale: function getBattleWorldScale() {
            return BATTLE_WORLD_SCALE;
        }
    };

    globalScope.UnitRenderV2SPG = api;

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry.spg = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
