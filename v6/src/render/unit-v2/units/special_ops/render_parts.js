// Additional part rendering (turret/tracks/rotor/etc) for: special_ops
(function attachUnitRenderV2Parts_special_ops(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for special_ops
    }

    globalScope['UnitRenderV2Parts_special_ops'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
