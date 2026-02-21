// Render-related VFX (smoke, muzzle flash, etc) for: apache
(function attachUnitRenderV2Fx_apache(globalScope) {
    'use strict';

    function drawFx(unit, ctx) {
        if (!ctx) return;
        // TODO: implement VFX rendering for apache
    }

    globalScope['UnitRenderV2Fx_apache'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
