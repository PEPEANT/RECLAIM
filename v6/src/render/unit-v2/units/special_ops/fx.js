// Render-related VFX (smoke, muzzle flash, etc) for: special_ops
(function attachUnitRenderV2Fx_special_ops(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for special_ops
    }

    globalScope['UnitRenderV2Fx_special_ops'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
