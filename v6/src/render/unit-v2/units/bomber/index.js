// Unit Render V2 entry for: bomber
(function attachUnitRenderV2_bomber(globalScope) {
    'use strict';

    var BATTLE_MODEL_SCALE = 0.62;
    var ICON_MODEL_SCALE = 0.72;
    var BATTLE_BASE_DRAW_SCALE = 1.4;
    var BATTLE_WORLD_SCALE = BATTLE_BASE_DRAW_SCALE * BATTLE_MODEL_SCALE;

    function getDeps() {
        return {
            stateApi: globalScope.UnitRenderV2State_bomber,
            bodyApi: globalScope.UnitRenderV2Body_bomber,
            partsApi: globalScope.UnitRenderV2Parts_bomber,
            fxApi: globalScope.UnitRenderV2Fx_bomber
        };
    }

    function resolvePalette(unit, options) {
        var team = String(options && options.team ? options.team : (unit && unit.team ? unit.team : 'player')).trim();
        if (globalScope.UnitRenderV2Palettes && typeof globalScope.UnitRenderV2Palettes.resolveLegacyTeam === 'function') {
            team = globalScope.UnitRenderV2Palettes.resolveLegacyTeam(team);
        }
        if (team === 'ally') team = 'player';
        if (team === 'foe') team = 'enemy';

        if (team === 'enemy') {
            return {
                bodyDark: '#3a2f21',
                bodyBase: '#59462f',
                bodyLight: '#756047',
                canopy: '#2d2f33',
                canopyDark: '#1f2326',
                highlight: '#9d8a70',
                intake: '#18140f',
                nacelle: '#262016',
                nozzle: '#0f0d0a',
                accent: '#ef4444',
                accentEnemy: '#f97316',
                wingBack: '#4c3d2a',
                wingFront: '#3f3222',
                wingEdge: '#8b7458',
                gear: '#6e5b44',
                tire: '#171412'
            };
        }

        return {
            bodyDark: '#232529',
            bodyBase: '#2d3035',
            bodyLight: '#3e4248',
            canopy: '#1c262e',
            canopyDark: '#0f171e',
            highlight: '#616975',
            intake: '#0f1113',
            nacelle: '#1a1d21',
            nozzle: '#07080a',
            accent: '#4b5563',
            accentEnemy: '#ef4444',
            wingBack: '#2a2d31',
            wingFront: '#1f2227',
            wingEdge: '#4d5560',
            gear: '#3e4248',
            tire: '#111214'
        };
    }

    function drawModel(unit, ctx, state, options) {
        if (!ctx || !state) return false;
        var deps = getDeps();
        if (!deps.stateApi || !deps.bodyApi || !deps.partsApi || !deps.fxApi) return false;

        var opts = options || {};
        var iconMode = (opts.iconMode === true);
        var modelScale = Number(opts.modelScale);
        if (!Number.isFinite(modelScale) || modelScale <= 0) modelScale = 1;
        var iconScale = Number(opts.iconScale);
        if (!Number.isFinite(iconScale) || iconScale <= 0) iconScale = 1;

        var facing = Number(opts.facing);
        if (!Number.isFinite(facing) || facing === 0) facing = Number(state.facing) || 1;
        facing = (facing < 0) ? -1 : 1;

        var palette = resolvePalette(unit, opts);

        ctx.save();
        ctx.scale(facing, 1);
        if (modelScale !== 1) ctx.scale(modelScale, modelScale);
        if (iconScale !== 1) ctx.scale(iconScale, iconScale);

        if (!iconMode) {
            var jitterX = Number(state.jitterX) || 0;
            var jitterY = Number(state.jitterY) || 0;
            var hoverY = Number(state.hoverOffsetY) || 0;
            ctx.translate(jitterX, jitterY + hoverY);
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
        if (id !== 'bomber') return false;

        var deps = getDeps();
        if (!deps.stateApi) return false;

        var state = deps.stateApi.getState(unit);
        if (!state) return false;
        deps.stateApi.updateState(unit, state, env);

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
            speed: 2.6,
            prevX: null,
            phaseSeed: 0,
            phaseSeedReady: true,
            hoverPhase: 0,
            hoverOffsetY: 0,
            jitterX: 0,
            jitterY: 0,
            wingSweep: 0.72,
            gearDown: 0,
            afterburner: 0.55,
            flamePhase: 0.7,
            bombPulse: 0,
            lastBombFrame: -1
        };
        deps.stateApi.setIconState(state, options || {});

        return drawModel({ team: 'player', stats: { id: 'bomber' } }, ctx, state, {
            team: 'player',
            iconMode: true,
            iconScale: Number(options && options.iconScale),
            modelScale: ICON_MODEL_SCALE
        });
    }

    function getBombReleasePosition(unit) {
        if (!unit) return null;
        var facing = Number(unit.facing);
        if (!Number.isFinite(facing) || facing === 0) {
            facing = (String(unit.team || '') === 'enemy') ? -1 : 1;
        }
        facing = (facing < 0) ? -1 : 1;
        return {
            x: (Number(unit.x) || 0) + (facing * (14 * BATTLE_WORLD_SCALE)),
            y: (Number(unit.y) || 0) + (11 * BATTLE_WORLD_SCALE)
        };
    }

    var api = {
        draw: draw,
        drawIcon: drawIcon,
        getBombReleasePosition: getBombReleasePosition,
        getBattleWorldScale: function getBattleWorldScale() {
            return BATTLE_WORLD_SCALE;
        }
    };

    globalScope.UnitRenderV2Bomber = api;

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry.bomber = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);

