// Additional part rendering (turret/tracks/rotor/etc) for: icbm
(function attachUnitRenderV2Parts_icbm(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for icbm
    }

    globalScope['UnitRenderV2Parts_icbm'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
