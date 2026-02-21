// Additional part rendering (turret/tracks/rotor/etc) for: apc
(function attachUnitRenderV2Parts_apc(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for apc
    }

    globalScope['UnitRenderV2Parts_apc'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
