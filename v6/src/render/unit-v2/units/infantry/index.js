// Unit Render V2 entry for: infantry
// 3단계 자세 시스템: 서서쏴(standing) / 앉아쏴(crouching) / 누워쏴(prone)
//
// [좌표 계약]
// classes.js가 V2 호출 전에 이미:
//   ctx.translate(unit.x, unit.y + snapDy) + ctx.scale(1.4, 1.4) 적용됨
// 따라서 이 렌더러는 ctx.translate(unit.x, unit.y) 하지 않는다.
// facing 스케일은 classes.js legacy 경로에서만 적용되므로 여기서 직접 한 번만 적용.
(function attachUnitRenderV2_infantry(globalScope) {
    'use strict';

    var PALETTES = {
        player: {
            uniform:  '#556B2F',
            vest:     '#3e4e26',
            skin:     '#ffdbac',
            gun:      '#1a1a1a',
            gunWood:  '#3b2f2f',
            helmet:   '#3A4A20'
        },
        enemy: {
            uniform:  '#8b7a5a',
            vest:     '#6e5f45',
            skin:     '#ffdbac',
            gun:      '#1a1a1a',
            gunWood:  '#5a4a34',
            helmet:   '#78674b'
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
        var stateApi   = globalScope['UnitRenderV2State_infantry'];
        var bodyApi    = globalScope['UnitRenderV2Body_infantry'];
        var weaponsApi = globalScope['UnitRenderV2Weapons_infantry'];
        var fxApi      = globalScope['UnitRenderV2Fx_infantry'];
        if (!stateApi || !bodyApi || !weaponsApi || !fxApi) return null;
        return { stateApi: stateApi, bodyApi: bodyApi, weaponsApi: weaponsApi, fxApi: fxApi };
    }

    function draw(unit, ctx, env) {
        if (!unit || !ctx) return false;
        var deps = getDeps();
        if (!deps) return false;

        var palette = resolvePalette(unit.team);
        var state = deps.stateApi.getState(unit);
        if (!state) return false;
        deps.stateApi.updateState(unit, state);

        // ctx는 이미 (unit.x, unit.y+snapDy) 기준 + scale(1.4) 상태.
        // facing 하나만 적용하고, 그 안에서 body/rifle/fx 모두 그린다.
        ctx.save();
        ctx.scale(state.facing, 1);

        deps.bodyApi.drawBody(unit, ctx, state, palette);
        deps.weaponsApi.drawRifle(ctx, state.stance, palette, state.recoil, state, unit);
        deps.fxApi.drawFx(unit, ctx, state);

        ctx.restore();
        return true;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['infantry'] = {
            draw: draw,
            getMuzzlePosition: function(unit) {
                var deps = getDeps();
                if (!deps) return null;
                var state = deps.stateApi.getState(unit);
                return deps.weaponsApi.getMuzzlePosition(unit, state);
            }
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
