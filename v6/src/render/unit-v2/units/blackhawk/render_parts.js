// Additional part rendering (turret/tracks/rotor/etc) for: blackhawk
(function attachUnitRenderV2Parts_blackhawk(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for blackhawk
    }

    globalScope['UnitRenderV2Parts_blackhawk'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
