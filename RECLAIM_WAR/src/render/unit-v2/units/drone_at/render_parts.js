// Additional part rendering (turret/tracks/rotor/etc) for: drone_at
(function attachUnitRenderV2Parts_drone_at(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for drone_at
    }

    globalScope['UnitRenderV2Parts_drone_at'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
