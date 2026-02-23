// Unit Render V2 entry for: aa_tank (SPAAG)
(function attachUnitRenderV2_aa_tank(globalScope) {
    'use strict';

    var BATTLE_MODEL_SCALE = 0.76;
    var BATTLE_BASE_DRAW_SCALE = 1.4 * 1.12;
    var BATTLE_WORLD_SCALE = BATTLE_BASE_DRAW_SCALE * BATTLE_MODEL_SCALE;
    var MANUAL_AIM_STALE_FRAMES = 45;

    function getDeps() {
        return {
            stateApi: globalScope.UnitRenderV2State_aa_tank,
            weaponApi: globalScope.UnitRenderV2Weapons_aa_tank,
            bodyApi: globalScope.UnitRenderV2Body_aa_tank,
            partsApi: globalScope.UnitRenderV2Parts_aa_tank,
            fxApi: globalScope.UnitRenderV2Fx_aa_tank
        };
    }

    function resolvePalette(unit, options) {
        var team = String(options && options.team ? options.team : (unit && unit.team ? unit.team : 'player')).trim();
        if (team === 'enemy') {
            return {
                main: '#8a795b',
                dark: '#6e5f46',
                shadow: '#4a3e2f',
                track: '#1f1d1a',
                wheelOuter: '#151515',
                wheelInner: '#675941',
                hub: '#222',
                sprocket: '#352c23',
                accent: '#5a4630',
                accent2: '#3f3021',
                enemyPattern: false
            };
        }
        if (team !== 'player') return null;
        return {
            main: '#4E5B31',
            dark: '#3D4825',
            shadow: '#2C3519',
            track: '#222',
            wheelOuter: '#151515',
            wheelInner: '#3D4825',
            hub: '#222',
            sprocket: '#333',
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
            deps.fxApi.drawEngineHeat(ctx, { alpha: 0.18 });
        } else {
            if (Number(state && state.autoFlash) > 0.04) {
                var muzzleAuto = deps.weaponApi.computeAutoMuzzleLocal(state, { barrelLength: 45 });
                deps.fxApi.drawAutoMuzzleFlash(ctx, {
                    x: muzzleAuto.x,
                    y: -30 + muzzleAuto.y,
                    angle: muzzleAuto.angle,
                    alpha: state.autoFlash
                });
            }
            if (Number(state && state.samFlash) > 0.04) {
                var muzzleSam = deps.weaponApi.computeSamMuzzleLocal(state);
                deps.fxApi.drawSamLaunchFlash(ctx, {
                    x: muzzleSam.x,
                    y: -30 + muzzleSam.y,
                    angle: muzzleSam.angle,
                    alpha: state.samFlash
                });
            }
        }

        ctx.restore();
        return true;
    }

    function draw(unit, ctx, env) {
        if (!unit || !ctx || !unit.stats || String(unit.stats.id || '') !== 'aa_tank') return false;
        var deps = getDeps();
        if (!deps.stateApi || !deps.weaponApi) return false;

        var state = deps.stateApi.getState(unit);
        if (!state) return false;
        deps.stateApi.updateRuntimeState(unit, state);

        var tx = null;
        var ty = null;
        var manualX = Number(unit.manualAimX);
        var manualY = Number(unit.manualAimY);
        var manualFrame = Number(unit.manualAimFrame);
        var gameRef = (globalScope && globalScope.game) ? globalScope.game : null;
        var frameNow = Number(env && env.frame);
        if (!Number.isFinite(frameNow) && gameRef && Number.isFinite(gameRef.frame)) frameNow = gameRef.frame;

        var hasManualAim = unit.isSelected === true
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
                ty = Number(target.y) - ((Number(target.height) || 0) * 0.32);
            }
        }

        if (Number.isFinite(tx) && Number.isFinite(ty)) {
            var next = deps.weaponApi.computeAimAngleFromPoint(unit, tx, ty);
            var diff = next - state.turretAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            state.turretAngle += diff * 0.18;
        } else {
            var idle = -Math.PI / 4;
            var idleDiff = idle - state.turretAngle;
            while (idleDiff < -Math.PI) idleDiff += Math.PI * 2;
            while (idleDiff > Math.PI) idleDiff -= Math.PI * 2;
            state.turretAngle += idleDiff * 0.12;
        }
        state.turretAngle = deps.weaponApi.clampTurretAngle(state.turretAngle);

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
            turretAngle: -Math.PI / 3.8,
            trackOffset: 4.2,
            recoil: 0,
            autoFlash: 0,
            samFlash: 0,
            radarAngle: Math.PI * 0.35,
            barrelToggle: false,
            facing: 1
        };
        deps.stateApi.setIconState(state, options || {});
        state.turretAngle = deps.weaponApi.clampTurretAngle(state.turretAngle);

        return drawModel({ team: 'player', stats: { id: 'aa_tank' } }, ctx, state, {
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

    globalScope.UnitRenderV2AATank = api;

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry.aa_tank = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
