// Unit Render V2 entry for: special_ops
(function attachUnitRenderV2_special_ops(globalScope) {
    'use strict';

    var PALETTES = {
        player: {
            uniform: '#1d2f1e',
            uniformHi: '#294529',
            vest: '#102111',
            armor: '#172f18',
            helmet: '#163118',
            pouch: '#0c1a0d',
            pack: '#142515',
            nvgGlow: '#22c55e',
            skin: '#ffdbac',
            gunDark: '#101510',
            gunBody: '#263127'
        },
        enemy: {
            uniform: '#7b6a4d',
            uniformHi: '#917e5c',
            vest: '#5f513a',
            armor: '#514632',
            helmet: '#6f6046',
            pouch: '#4c402f',
            pack: '#5a4d38',
            nvgGlow: '#ef4444',
            skin: '#ffdbac',
            gunDark: '#121212',
            gunBody: '#3a342b'
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
        var stateApi = globalScope['UnitRenderV2State_special_ops'];
        var bodyApi = globalScope['UnitRenderV2Body_special_ops'];
        var weaponApi = globalScope['UnitRenderV2Weapons_special_ops'];
        var fxApi = globalScope['UnitRenderV2Fx_special_ops'];
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
        registry['special_ops'] = {
            draw: draw,
            getMuzzlePosition: function(unit) {
                var deps = getDeps();
                if (!deps) return null;
                var state = deps.stateApi.getState(unit);
                return deps.weaponApi.getMuzzlePosition(unit, state);
            }
        };
        // Backward compatibility for old unit IDs.
        registry['special_forces'] = registry['special_ops'];
    }
})(typeof window !== 'undefined' ? window : globalThis);
