// Additional part rendering (turret/tracks/rotor/etc) for: engineer
(function attachUnitRenderV2Parts_engineer(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for engineer
    }

    globalScope['UnitRenderV2Parts_engineer'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
