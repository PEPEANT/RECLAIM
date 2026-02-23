// Render-related VFX (smoke, muzzle flash, etc) for: icbm
(function attachUnitRenderV2Fx_icbm(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for icbm
    }

    globalScope['UnitRenderV2Fx_icbm'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
