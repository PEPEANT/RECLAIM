// Render-related VFX (smoke, muzzle flash, etc) for: blackhawk
(function attachUnitRenderV2Fx_blackhawk(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for blackhawk
    }

    globalScope['UnitRenderV2Fx_blackhawk'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
