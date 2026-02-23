// Additional part rendering (turret/tracks/rotor/etc) for: chinook
(function attachUnitRenderV2Parts_chinook(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for chinook
    }

    globalScope['UnitRenderV2Parts_chinook'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
