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
    var DEG_TO_RAD = Math.PI / 180;
    var SPG_MOVE_DOWN_TARGET = Math.PI * 0.97;
    var SPG_FIRE_READY_ANGLE_DEG = -12;

    function stepAngleToward(current, target, maxStep) {
        var c = Number(current);
        var t = Number(target);
        var s = Number(maxStep);
        if (!Number.isFinite(t)) return c;
        if (!Number.isFinite(c)) return t;
        if (!Number.isFinite(s) || s <= 0) return t;

        var diff = t - c;
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

        var moving = Math.abs(Number(unit.vx) || 0) > 0.08;

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

        if (hasManualAim) {
            tx = manualX;
            ty = manualY;
        } else {
            var target = unit.attackTarget;
            if (target && !target.dead) {
                tx = Number(target.x);
                ty = Number(target.y) - (Number(target.height) || 0) * 0.25;
            }
        }

        var hasAimTarget = Number.isFinite(tx) && Number.isFinite(ty);
        var wasMoving = state._spgWasMoving === true;
        if (moving) {
            // Move posture first: when the vehicle starts moving, barrel goes down and stays down.
            if (!wasMoving) state.gunAngle = SPG_MOVE_DOWN_TARGET;
            state.gunAngle = stepAngleToward(state.gunAngle, SPG_MOVE_DOWN_TARGET, 0.8 * DEG_TO_RAD);
        } else if (hasAimTarget) {
            var next = deps.weaponApi.computeAimAngleFromPoint(unit, tx, ty);
            // Combat posture: keep barrel generally above horizontal.
            var combatMaxDown = 0.20;
            if (next > combatMaxDown) next = combatMaxDown;
            state.gunAngle = stepAngleToward(state.gunAngle, next, 1.0 * DEG_TO_RAD);
        } else {
            var idleTarget = (unit.team === 'enemy') ? (-Math.PI / 3.6) : (-Math.PI / 3.2);
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
