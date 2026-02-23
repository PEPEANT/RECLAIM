// Render-related VFX (smoke, muzzle flash, etc) for: icbm_enemy
(function attachUnitRenderV2Fx_icbm_enemy(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for icbm_enemy
    }

    globalScope['UnitRenderV2Fx_icbm_enemy'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
