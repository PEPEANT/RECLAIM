// Render-related VFX (smoke, muzzle flash, etc) for: spg
(function attachUnitRenderV2Fx_spg(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for spg
    }

    globalScope['UnitRenderV2Fx_spg'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
