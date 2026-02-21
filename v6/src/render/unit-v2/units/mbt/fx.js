// Render-related VFX (smoke, muzzle flash, etc) for: mbt
(function attachUnitRenderV2Fx_mbt(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for mbt
    }

    globalScope['UnitRenderV2Fx_mbt'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
