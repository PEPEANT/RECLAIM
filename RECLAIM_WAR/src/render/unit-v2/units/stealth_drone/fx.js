// Render-related VFX (smoke, muzzle flash, etc) for: stealth_drone
(function attachUnitRenderV2Fx_stealth_drone(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for stealth_drone
    }

    globalScope['UnitRenderV2Fx_stealth_drone'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
