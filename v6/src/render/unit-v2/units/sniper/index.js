// Unit Render V2 entry for: sniper
(function attachUnitRenderV2_sniper(globalScope) {
    'use strict';

    var PALETTES = {
        player: {
            uniform: '#2f4727',
            uniformHi: '#3b5b2f',
            vest: '#1f3220',
            helmet: '#2b4526',
            pouch: '#182718',
            pack: '#253828',
            skin: '#ffdbac',
            gunDark: '#121820',
            gunBody: '#2a313a'
        },
        enemy: {
            uniform: '#847354',
            uniformHi: '#9a8865',
            vest: '#695a41',
            helmet: '#76664c',
            pouch: '#584b36',
            pack: '#62553f',
            skin: '#ffdbac',
            gunDark: '#1a1a1a',
            gunBody: '#3f392f'
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
        var stateApi = globalScope['UnitRenderV2State_sniper'];
        var bodyApi = globalScope['UnitRenderV2Body_sniper'];
        var weaponApi = globalScope['UnitRenderV2Weapons_sniper'];
        var fxApi = globalScope['UnitRenderV2Fx_sniper'];
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
        deps.weaponApi.drawWeapon(ctx, state.stance, palette, state.recoil, state, unit);
        deps.fxApi.drawFx(unit, ctx, state);

        ctx.restore();
        return true;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['sniper'] = {
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
