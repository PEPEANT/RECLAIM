// Additional part rendering (turret/tracks/rotor/etc) for: spg
(function attachUnitRenderV2Parts_spg(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for spg
    }

    globalScope['UnitRenderV2Parts_spg'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
