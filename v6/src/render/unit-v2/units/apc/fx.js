// Render-related VFX (smoke, muzzle flash, etc) for: apc
(function attachUnitRenderV2Fx_apc(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for apc
    }

    globalScope['UnitRenderV2Fx_apc'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
