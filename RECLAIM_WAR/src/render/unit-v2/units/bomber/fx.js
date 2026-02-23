// Render-related VFX (smoke, muzzle flash, etc) for: bomber
(function attachUnitRenderV2Fx_bomber(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for bomber
    }

    globalScope['UnitRenderV2Fx_bomber'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
