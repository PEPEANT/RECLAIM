// Render-related VFX (smoke, muzzle flash, etc) for: tactical_drone
(function attachUnitRenderV2Fx_tactical_drone(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for tactical_drone
    }

    globalScope['UnitRenderV2Fx_tactical_drone'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
