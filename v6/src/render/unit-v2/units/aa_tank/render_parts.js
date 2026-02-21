// Additional part rendering (turret/tracks/rotor/etc) for: aa_tank
(function attachUnitRenderV2Parts_aa_tank(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for aa_tank
    }

    globalScope['UnitRenderV2Parts_aa_tank'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
