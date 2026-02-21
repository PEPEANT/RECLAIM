// Render-related VFX (smoke, muzzle flash, etc) for: drone_operator
(function attachUnitRenderV2Fx_drone_operator(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for drone_operator
    }

    globalScope['UnitRenderV2Fx_drone_operator'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
