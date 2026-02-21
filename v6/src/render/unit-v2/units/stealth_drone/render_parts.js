// Additional part rendering (turret/tracks/rotor/etc) for: stealth_drone
(function attachUnitRenderV2Parts_stealth_drone(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for stealth_drone
    }

    globalScope['UnitRenderV2Parts_stealth_drone'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
