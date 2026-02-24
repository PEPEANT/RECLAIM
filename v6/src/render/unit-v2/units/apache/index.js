// Unit Render V2 entry for: apache (AH-64D Longbow)
// [醫뚰몴 怨꾩빟]
// classes.js媛 V2 ?몄텧 ?꾩뿉 ?대?:
//   ctx.translate(unit.x, unit.y) + ctx.scale(1.4, 1.4) ?곸슜??
// ???뚮뜑?щ뒗 異붽?濡?
//   ctx.scale(APACHE_SCALE) ??floatOffset ??facing ?쒖꽌濡??곸슜
//
// [? ?붾젅??
//   player: ?ㅽ겕 移대え (?묓쉶??怨꾩뿴)
//   enemy:  ?щ쭑 移대え (?⑷컝??怨꾩뿴)
(function attachUnitRenderV2_apache(globalScope) {
    'use strict';

    // 湲곗껜 ?ш린 諛곗쑉 (1.4 횞 APACHE_SCALE = 理쒖쥌 ?뚮뜑 ?ш린)
    // ?먰삎 醫뚰몴怨꾧? ?볤린 ?뚮Ц??異뺤냼 ?꾩슂
    var APACHE_SCALE = 0.57;

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

        // ctx???대? (unit.x, unit.y) + scale(1.4) ?곹깭
        // APACHE_SCALE ??floatOffset ??facing ?곸슜
        ctx.save();
        ctx.scale(APACHE_SCALE, APACHE_SCALE);
        ctx.translate(0, state.floatOffset);   // hover offset
        var bodyBank = Number(state.bodyBank) || 0;
        if (Math.abs(bodyBank) > 0.0005) ctx.rotate(bodyBank);
        ctx.scale(state.facing, 1);            // facing ??踰덈쭔

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

