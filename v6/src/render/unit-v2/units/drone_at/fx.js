// Render-related VFX (smoke, muzzle flash, etc) for: drone_at
(function attachUnitRenderV2Fx_drone_at(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for drone_at
    }

    globalScope['UnitRenderV2Fx_drone_at'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
