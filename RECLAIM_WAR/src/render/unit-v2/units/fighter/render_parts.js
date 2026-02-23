// Additional part rendering (turret/tracks/rotor/etc) for: fighter
(function attachUnitRenderV2Parts_fighter(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for fighter
    }

    globalScope['UnitRenderV2Parts_fighter'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
