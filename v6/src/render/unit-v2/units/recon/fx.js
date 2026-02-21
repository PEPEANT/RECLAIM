// Render-related VFX (smoke, muzzle flash, etc) for: recon
(function attachUnitRenderV2Fx_recon(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for recon
    }

    globalScope['UnitRenderV2Fx_recon'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
