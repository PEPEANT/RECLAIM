// Render-related VFX (smoke, muzzle flash, etc) for: sniper
(function attachUnitRenderV2Fx_sniper(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for sniper
    }

    globalScope['UnitRenderV2Fx_sniper'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
