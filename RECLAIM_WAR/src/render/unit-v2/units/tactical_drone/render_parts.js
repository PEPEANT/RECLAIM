// Additional part rendering (turret/tracks/rotor/etc) for: tactical_drone
(function attachUnitRenderV2Parts_tactical_drone(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for tactical_drone
    }

    globalScope['UnitRenderV2Parts_tactical_drone'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
