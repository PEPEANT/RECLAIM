// Render-related VFX (smoke, muzzle flash, etc) for: infantry
(function attachUnitRenderV2Fx_infantry(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for infantry
    }

    globalScope['UnitRenderV2Fx_infantry'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
