// Render-related VFX (smoke, muzzle flash, etc) for: fighter
(function attachUnitRenderV2Fx_fighter(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for fighter
    }

    globalScope['UnitRenderV2Fx_fighter'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
