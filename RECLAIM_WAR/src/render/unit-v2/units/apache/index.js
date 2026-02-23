// Unit Render V2 entry for: apache (AH-64D Longbow)
// [좌표 계약]
// classes.js가 V2 호출 전에 이미:
//   ctx.translate(unit.x, unit.y) + ctx.scale(1.4, 1.4) 적용됨
// 이 렌더러는 추가로:
//   ctx.scale(APACHE_SCALE) → floatOffset → facing 순서로 적용
//
// [팀 팔레트]
//   player: 다크 카모 (흑회색 계열)
//   enemy:  사막 카모 (황갈색 계열)
(function attachUnitRenderV2_apache(globalScope) {
    'use strict';

    // 기체 크기 배율 (1.4 × APACHE_SCALE = 최종 렌더 크기)
    // 원형 좌표계가 넓기 때문에 축소 필요
    var APACHE_SCALE = 0.60;

    var PALETTE_PLAYER = {
        body:     '#2c2f33',
        dark:     '#16181a',
        panel:    '#484f57',
        glass:    '#0c111a',
        glassRef: '#1e3348',
        metal:    '#606a78',
        weapon:   '#141618',
        accent:   '#52595f'
    };

    var PALETTE_ENEMY = {
        body:     '#6b5e3e',
        dark:     '#3e3420',
        panel:    '#9a8c6a',
        glass:    '#141a12',
        glassRef: '#2a3020',
        metal:    '#8a7e62',
        weapon:   '#2a220e',
        accent:   '#7a6e52'
    };

    function getDeps() {
        var stateApi   = globalScope['UnitRenderV2State_apache'];
        var bodyApi    = globalScope['UnitRenderV2Body_apache'];
        var weaponsApi = globalScope['UnitRenderV2Weapons_apache'];
        var fxApi      = globalScope['UnitRenderV2Fx_apache'];
        if (!stateApi || !bodyApi || !weaponsApi || !fxApi) return null;
        return { stateApi: stateApi, bodyApi: bodyApi, weaponsApi: weaponsApi, fxApi: fxApi };
    }

    function draw(unit, ctx, env) {
        if (!unit || !ctx) return false;
        if (!unit.stats || String(unit.stats.id || '') !== 'apache') return false;

        var deps = getDeps();
        if (!deps) return false;

        var state = deps.stateApi.getState(unit);
        if (!state) return false;
        deps.stateApi.updateState(unit, state);

        var palette = (unit.team === 'enemy') ? PALETTE_ENEMY : PALETTE_PLAYER;

        // ctx는 이미 (unit.x, unit.y) + scale(1.4) 상태
        // APACHE_SCALE → floatOffset → facing 적용
        ctx.save();
        ctx.scale(APACHE_SCALE, APACHE_SCALE);
        ctx.translate(0, state.floatOffset);   // 호버링 부유
        ctx.scale(state.facing, 1);            // facing 한 번만

        deps.bodyApi.drawBody(unit, ctx, state, palette);
        deps.fxApi.drawFx(unit, ctx, state);

        ctx.restore();
        return true;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['apache'] = {
            draw: draw,
            getMuzzlePosition: function (unit) {
                var deps = getDeps();
                if (!deps) return null;
                var state = deps.stateApi.getState(unit);
                return deps.weaponsApi.getMuzzlePosition(unit, state);
            }
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
