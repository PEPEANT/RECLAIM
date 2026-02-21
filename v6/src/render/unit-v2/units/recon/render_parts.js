// Additional part rendering (turret/tracks/rotor/etc) for: recon
(function attachUnitRenderV2Parts_recon(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for recon
    }

    globalScope['UnitRenderV2Parts_recon'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
