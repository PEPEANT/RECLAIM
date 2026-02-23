// Render-related VFX (smoke, muzzle flash, etc) for: worker
(function attachUnitRenderV2Fx_worker(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for worker
    }

    globalScope['UnitRenderV2Fx_worker'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
