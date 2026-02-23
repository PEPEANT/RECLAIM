// Additional part rendering (turret/tracks/rotor/etc) for: sniper
(function attachUnitRenderV2Parts_sniper(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for sniper
    }

    globalScope['UnitRenderV2Parts_sniper'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
