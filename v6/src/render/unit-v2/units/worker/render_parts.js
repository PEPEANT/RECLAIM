// Additional part rendering (turret/tracks/rotor/etc) for: worker
(function attachUnitRenderV2Parts_worker(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for worker
    }

    globalScope['UnitRenderV2Parts_worker'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
