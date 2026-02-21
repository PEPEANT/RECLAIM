// Render-related VFX (smoke, muzzle flash, etc) for: engineer
(function attachUnitRenderV2Fx_engineer(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for engineer
    }

    globalScope['UnitRenderV2Fx_engineer'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
