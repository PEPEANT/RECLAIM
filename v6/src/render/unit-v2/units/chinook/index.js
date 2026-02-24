// Unit Render V2 entry for: chinook (CH-47)
(function attachUnitRenderV2_chinook(globalScope) {
    'use strict';

    var BATTLE_MODEL_SCALE = 2.72;
    var ICON_MODEL_SCALE = 1.52;
    var BATTLE_BASE_DRAW_SCALE = 1.4;
    var BATTLE_WORLD_SCALE = BATTLE_BASE_DRAW_SCALE * BATTLE_MODEL_SCALE;

    function getDeps() {
        return {
            stateApi: globalScope.UnitRenderV2State_chinook,
            weaponApi: globalScope.UnitRenderV2Weapons_chinook,
            bodyApi: globalScope.UnitRenderV2Body_chinook,
            partsApi: globalScope.UnitRenderV2Parts_chinook,
            fxApi: globalScope.UnitRenderV2Fx_chinook
        };
    }

    function resolvePalette(unit, options) {
        var team = String(options && options.team ? options.team : (unit && unit.team ? unit.team : 'player')).trim();
        if (team === 'ally') team = 'player';
        if (team === 'foe') team = 'enemy';
        if (team === 'enemy') {
            return {
                body: '#5e513c',
                dark: '#352d22',
                light: '#8f7d62',
                window: '#6f7d8a',
                gear: '#544634',
                tire: '#171312',
                rotor: '#2c241f',
                highlight: '#aa9a7f',
                accent: '#b91c1c',
                accent2: '#7f1d1d',
                enemyPattern: true
            };
        }
        return {
            body: '#2e3136',
            dark: '#1c1e20',
            light: '#484c52',
            window: '#5a7b8c',
            gear: '#3a3d40',
            tire: '#0f0f11',
            rotor: '#1a1a1a',
            highlight: '#484c52',
            accent: '#4b5563',
            accent2: '#374151',
            enemyPattern: false
        };
    }

    function drawModel(unit, ctx, state, options) {
        if (!ctx || !state) return false;
        var deps = getDeps();
        if (!deps.stateApi || !deps.weaponApi || !deps.bodyApi || !deps.partsApi || !deps.fxApi) return false;

        var opts = options || {};
        var iconMode = opts.iconMode === true;
        var iconScale = Number(opts.iconScale);
        var modelScale = Number(opts.modelScale);
        var facing = Number(opts.facing);
        if (!Number.isFinite(facing) || facing === 0) {
            facing = Number(state.facing) || 1;
        }
        facing = (facing < 0) ? -1 : 1;

        var palette = resolvePalette(unit, opts);

        ctx.save();
        if (!iconMode) {
            var bodyBank = Number(state.bodyBank) || 0;
            if (Math.abs(bodyBank) > 0.0005) ctx.rotate(bodyBank);
        }
        // Source CH-47 profile is left-facing.
        if (facing > 0) ctx.scale(-1, 1);

        if (Number.isFinite(modelScale) && modelScale > 0 && modelScale !== 1) {
            ctx.scale(modelScale, modelScale);
        }
        if (Number.isFinite(iconScale) && iconScale > 0 && iconScale !== 1) {
            ctx.scale(iconScale, iconScale);
        }

        if (!iconMode) {
            var shakeX = Number(state.bodyShakeX) || 0;
            var shakeY = Number(state.bodyShakeY) || 0;
            var hoverBob = Number(state.hoverBob) || 0;
            ctx.translate(shakeX, shakeY + hoverBob);
        }

        deps.bodyApi.drawBody(unit, ctx, state, palette, opts);
        deps.partsApi.drawParts(unit, ctx, state, palette, opts);
        deps.fxApi.drawFx(unit, ctx, state, palette, opts);

        ctx.restore();
        return true;
    }

    function draw(unit, ctx, env) {
        if (!unit || !ctx || !unit.stats) return false;
        var id = String(unit.stats.id || '').trim();
        if (id !== 'chinook') return false;

        var deps = getDeps();
        if (!deps.stateApi) return false;

        var state = deps.stateApi.getState(unit);
        if (!state) return false;
        deps.stateApi.updateRuntimeState(unit, state, env);

        return drawModel(unit, ctx, state, {
            team: unit.team,
            facing: state.facing,
            modelScale: BATTLE_MODEL_SCALE,
            iconMode: false
        });
    }

    function drawIcon(ctx, options) {
        if (!ctx) return false;
        var deps = getDeps();
        if (!deps.stateApi) return false;

        var state = {
            facing: 1,
            frontRotorAngle: 0.2,
            rearRotorAngle: 1.1,
            speed: 0,
            prevX: null,
            phaseSeed: 0,
            phaseSeedReady: true,
            bodyShakeX: 0,
            bodyShakeY: 0,
            hoverBob: 0
        };
        deps.stateApi.setIconState(state, options || {});

        return drawModel({ team: 'player', stats: { id: 'chinook' } }, ctx, state, {
            team: 'player',
            iconMode: true,
            iconScale: Number(options && options.iconScale),
            modelScale: ICON_MODEL_SCALE
        });
    }

    var api = {
        draw: draw,
        drawIcon: drawIcon,
        getBattleWorldScale: function getBattleWorldScale() {
            return BATTLE_WORLD_SCALE;
        }
    };

    globalScope.UnitRenderV2Chinook = api;

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry.chinook = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
