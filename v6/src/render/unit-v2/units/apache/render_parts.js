// Additional part rendering (turret/tracks/rotor/etc) for: apache
(function attachUnitRenderV2Parts_apache(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for apache
    }

    globalScope['UnitRenderV2Parts_apache'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
