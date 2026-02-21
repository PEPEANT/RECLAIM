// Additional part rendering (turret/tracks/rotor/etc) for: mbt
(function attachUnitRenderV2Parts_mbt(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for mbt
    }

    globalScope['UnitRenderV2Parts_mbt'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
