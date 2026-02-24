// Unit Render V2 entry for: drone_operator
(function attachUnitRenderV2_drone_operator(globalScope) {
    'use strict';

    var PALETTES = {
        player: {
            uniform: '#556B2F',
            vest: '#3e4e26',
            helmet: '#3A4A20',
            pack: '#2d3748',
            screen: '#0ea5e9',
            skin: '#ffdbac',
            gunDark: '#1a1a1a',
            gunBody: '#2a313a'
        },
        enemy: {
            uniform: '#8b7a5a',
            vest: '#6e5f45',
            helmet: '#78674b',
            pack: '#665a47',
            screen: '#f97316',
            skin: '#ffdbac',
            gunDark: '#1a1a1a',
            gunBody: '#3a3329'
        }
    };

    function resolvePalette(team) {
        var resolvedTeam = String(team || 'player').trim().toLowerCase();
        if (globalScope.UnitRenderV2Palettes && typeof globalScope.UnitRenderV2Palettes.resolveLegacyTeam === 'function') {
            resolvedTeam = globalScope.UnitRenderV2Palettes.resolveLegacyTeam(resolvedTeam);
        }
        return (resolvedTeam === 'player') ? PALETTES.player : PALETTES.enemy;
    }

    function getDeps() {
        var stateApi = globalScope['UnitRenderV2State_drone_operator'];
        var bodyApi = globalScope['UnitRenderV2Body_drone_operator'];
        var weaponApi = globalScope['UnitRenderV2Weapons_drone_operator'];
        var fxApi = globalScope['UnitRenderV2Fx_drone_operator'];
        if (!stateApi || !bodyApi || !weaponApi || !fxApi) return null;
        if (typeof stateApi.getState !== 'function' || typeof stateApi.updateState !== 'function') return null;
        if (typeof bodyApi.drawBody !== 'function' || typeof weaponApi.drawWeapon !== 'function') return null;
        return {
            stateApi: stateApi,
            bodyApi: bodyApi,
            weaponApi: weaponApi,
            fxApi: fxApi
        };
    }

    function draw(unit, ctx, env) {
        if (!unit || !ctx) return false;
        var deps = getDeps();
        if (!deps) return false;

        var palette = resolvePalette(unit.team);
        var state = deps.stateApi.getState(unit);
        if (!state) return false;
        deps.stateApi.updateState(unit, state);

        ctx.save();
        ctx.scale(state.facing, 1);

        deps.bodyApi.drawBody(unit, ctx, state, palette);
        deps.weaponApi.drawWeapon(ctx, state.stance, palette, state.recoil, state);
        deps.fxApi.drawFx(unit, ctx, state);

        ctx.restore();
        return true;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['drone_operator'] = {
            draw: draw,
            getMuzzlePosition: function(unit) {
                var deps = getDeps();
                if (!deps) return null;
                var state = deps.stateApi.getState(unit);
                return deps.weaponApi.getMuzzlePosition(unit, state);
            }
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
