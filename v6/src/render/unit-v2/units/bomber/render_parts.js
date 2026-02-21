// Additional part rendering (turret/tracks/rotor/etc) for: bomber
(function attachUnitRenderV2Parts_bomber(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for bomber
    }

    globalScope['UnitRenderV2Parts_bomber'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
