// Additional part rendering (turret/tracks/rotor/etc) for: infantry
(function attachUnitRenderV2Parts_infantry(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for infantry
    }

    globalScope['UnitRenderV2Parts_infantry'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
