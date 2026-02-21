// Unit Render V2 entry for: blackhawk (UH-60)
(function attachUnitRenderV2_blackhawk(globalScope) {
    'use strict';

    var BATTLE_MODEL_SCALE = 1.40;
    var BATTLE_BASE_DRAW_SCALE = 1.4;
    var BATTLE_WORLD_SCALE = BATTLE_BASE_DRAW_SCALE * BATTLE_MODEL_SCALE;

    function getDeps() {
        return {
            stateApi: globalScope.UnitRenderV2State_blackhawk,
            weaponApi: globalScope.UnitRenderV2Weapons_blackhawk,
            bodyApi: globalScope.UnitRenderV2Body_blackhawk,
            partsApi: globalScope.UnitRenderV2Parts_blackhawk,
            fxApi: globalScope.UnitRenderV2Fx_blackhawk
        };
    }

    function resolvePalette(unit, options) {
        var team = String(options && options.team ? options.team : (unit && unit.team ? unit.team : 'player')).trim();
        if (team === 'enemy') {
            return {
                body: '#a88f69',
                dark: '#7b6548',
                light: '#c1ab85',
                window: '#6f7d8a',
                gear: '#5b4c39',
                tire: '#171312',
                rotor: '#2c241f',
                highlight: '#cfb794',
                accent: '#8b1e1e',
                accent2: '#b91c1c',
                enemyPattern: true
            };
        }
        if (team !== 'player') return null;
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

        var palette = resolvePalette(unit, options || {});
        if (!palette) return false;

        var opts = options || {};
        var iconMode = opts.iconMode === true;
        var iconScale = Number(opts.iconScale);
        var modelScale = Number(opts.modelScale);
        var facing = Number(opts.facing);
        if (!Number.isFinite(facing) || facing === 0) {
            facing = Number(state && state.facing) || 1;
        }

        ctx.save();
        if (facing < 0) ctx.scale(-1, 1);

        if (Number.isFinite(modelScale) && modelScale > 0 && modelScale !== 1) {
            ctx.scale(modelScale, modelScale);
        }
        if (Number.isFinite(iconScale) && iconScale > 0 && iconScale !== 1) {
            ctx.scale(iconScale, iconScale);
        }

        var shakeX = Number(state.bodyShakeX) || 0;
        var shakeY = Number(state.bodyShakeY) || 0;
        var bobY = Number(state.hoverBob) || 0;
        if (!iconMode) {
            ctx.translate(shakeX, shakeY + bobY);
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
        if (id !== 'blackhawk' && id !== 'uh60') return false;

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
            mainRotorAngle: 0.2,
            tailRotorAngle: 0.8,
            bodyShakeX: 0,
            bodyShakeY: 0,
            hoverBob: 0,
            muzzleFlash: 0
        };
        deps.stateApi.setIconState(state, options || {});

        return drawModel({ team: 'player', stats: { id: 'blackhawk' } }, ctx, state, {
            team: 'player',
            iconMode: true,
            iconScale: Number(options && options.iconScale),
            modelScale: BATTLE_MODEL_SCALE
        });
    }

    var api = {
        draw: draw,
        drawIcon: drawIcon,
        getBattleWorldScale: function getBattleWorldScale() {
            return BATTLE_WORLD_SCALE;
        }
    };

    globalScope.UnitRenderV2Blackhawk = api;

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry.blackhawk = api;
        registry.uh60 = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
