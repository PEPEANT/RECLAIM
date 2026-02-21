// Additional part rendering (turret/tracks/rotor/etc) for: humvee
(function attachUnitRenderV2Parts_humvee(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for humvee
    }

    globalScope['UnitRenderV2Parts_humvee'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
