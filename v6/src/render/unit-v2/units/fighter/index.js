// Unit Render V2 entry for: fighter
// [좌표 계약]
// classes.js가 V2 호출 전에 이미:
//   ctx.translate(unit.x, unit.y) + ctx.scale(1.4, 1.4) 적용됨
// 따라서 이 렌더러는 ctx.translate 하지 않는다.
// facing 스케일은 여기서 한 번만 적용 (infantry 패턴 동일).
//
// [아군/적군 동일 색상] - 팀 컬러 없음 (스텔스 그레이 팔레트 단일)
(function attachUnitRenderV2_fighter(globalScope) {
    'use strict';

    var PALETTE = {
        body:        '#363b40',
        bodyDark:    '#24272b',
        bodyLight:   '#3f444a',
        canopy:      '#cda434',
        highlight:   '#4e555e',
        missile:     '#e5e7eb',
        missileHead: '#dc2626'
    };

    function getDeps() {
        var stateApi   = globalScope['UnitRenderV2State_fighter'];
        var bodyApi    = globalScope['UnitRenderV2Body_fighter'];
        var weaponsApi = globalScope['UnitRenderV2Weapons_fighter'];
        var fxApi      = globalScope['UnitRenderV2Fx_fighter'];
        if (!stateApi || !bodyApi || !weaponsApi || !fxApi) return null;
        return { stateApi: stateApi, bodyApi: bodyApi, weaponsApi: weaponsApi, fxApi: fxApi };
    }

    function draw(unit, ctx, env) {
        if (!unit || !ctx) return false;
        if (!unit.stats || String(unit.stats.id || '') !== 'fighter') return false;

        var deps = getDeps();
        if (!deps) return false;

        var state = deps.stateApi.getState(unit);
        if (!state) return false;
        deps.stateApi.updateState(unit, state);

        // ctx는 이미 (unit.x, unit.y) 기준 + scale(1.4) 상태.
        // 부유 오프셋 → facing 한 번만 적용. 추가 스케일 없음.
        ctx.save();
        ctx.translate(0, state.floatOffset);  // 상하 부유 오프셋
        ctx.scale(state.facing, 1);           // facing 한 번만

        deps.bodyApi.drawBody(unit, ctx, state, PALETTE);

        if ((unit.missileChargesLeft || 0) > 0) {
            deps.weaponsApi.drawMissile(ctx, PALETTE);
        }

        deps.fxApi.drawFx(unit, ctx, state);

        ctx.restore();
        return true;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['fighter'] = {
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
