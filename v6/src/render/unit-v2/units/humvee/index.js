// Unit Render V2 entry for: humvee
(function attachUnitRenderV2_humvee(globalScope) {
    'use strict';

    var BATTLE_MODEL_SCALE = 0.66;
    var BATTLE_BASE_DRAW_SCALE = 1.4 * 1.18;
    var BATTLE_WORLD_SCALE = BATTLE_BASE_DRAW_SCALE * BATTLE_MODEL_SCALE;
    var MANUAL_AIM_STALE_FRAMES = 45;

    function getDeps() {
        return {
            stateApi: globalScope.UnitRenderV2State_humvee,
            weaponApi: globalScope.UnitRenderV2Weapons_humvee,
            bodyApi: globalScope.UnitRenderV2Body_humvee,
            partsApi: globalScope.UnitRenderV2Parts_humvee,
            fxApi: globalScope.UnitRenderV2Fx_humvee
        };
    }

    function resolvePalette(unit, options) {
        var team = String(options && options.team ? options.team : (unit && unit.team ? unit.team : 'player')).trim();
        if (globalScope.UnitRenderV2Palettes && typeof globalScope.UnitRenderV2Palettes.resolveLegacyTeam === 'function') {
            team = globalScope.UnitRenderV2Palettes.resolveLegacyTeam(team);
        }

        if (team === 'enemy') {
            return {
                base: '#8b7a5a',
                dark: '#6f5f45',
                shadow: '#4b3f2f',
                window: '#534f45',
                tire: '#1a1a1a',
                rim: '#3c342b',
                gun: '#221f1a',
                tow: '#7e745f',
                accent: '#5a4630',
                accent2: '#3f3021',
                enemyPattern: false
            };
        }
        if (team !== 'player') return null;

        return {
            base: '#4E5B31',
            dark: '#3D4825',
            shadow: '#2C3519',
            window: '#3b4d59',
            tire: '#1a1a1a',
            rim: '#444',
            gun: '#222',
            tow: '#4B5320',
            accent: '#5d3f22',
            accent2: '#3f2d1a',
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

        ctx.save();
        ctx.translate(0, Number(state && state.bounceY) || 0);
        deps.bodyApi.drawBody(unit, ctx, palette, state);
        deps.partsApi.drawTurret(ctx, state, palette, opts);
        if (!iconMode) deps.fxApi.drawExhaust(ctx, state, { alphaMul: 1 });
        ctx.restore();
        // User request: keep wheels as the foremost layer.
        deps.partsApi.drawWheels(ctx, state, palette);

        ctx.restore();
        return true;
    }

    function draw(unit, ctx, env) {
        if (!unit || !ctx || !unit.stats || String(unit.stats.id || '') !== 'humvee') return false;
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
                ty = Number(target.y) - (Number(target.height) || 0) * 0.30;
            }
        }

        if (Number.isFinite(tx) && Number.isFinite(ty)) {
            var next = deps.weaponApi.computeAimAngleFromPoint(unit, tx, ty);
            var diff = next - state.turretAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            state.turretAngle += diff * 0.20;
        } else {
            var idle = -0.08;
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
            turretAngle: -0.10,
            wheelAngle: 0.4,
            bounceY: 0,
            bounceTick: 0,
            mgFlash: 0,
            exhaustAlpha: 0,
            facing: 1
        };
        deps.stateApi.setIconState(state, options || {});
        state.turretAngle = deps.weaponApi.clampTurretAngle(state.turretAngle);

        return drawModel({ team: 'player', stats: { id: 'humvee' } }, ctx, state, {
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

    globalScope.UnitRenderV2Humvee = api;

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry.humvee = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);

