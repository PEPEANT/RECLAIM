// Render-related VFX (smoke, muzzle flash, etc) for: aa_tank
(function attachUnitRenderV2Fx_aa_tank(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for aa_tank
    }

    globalScope['UnitRenderV2Fx_aa_tank'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
