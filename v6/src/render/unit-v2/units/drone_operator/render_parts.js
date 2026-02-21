// Additional part rendering (turret/tracks/rotor/etc) for: drone_operator
(function attachUnitRenderV2Parts_drone_operator(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for drone_operator
    }

    globalScope['UnitRenderV2Parts_drone_operator'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
