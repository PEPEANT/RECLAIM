// Additional part rendering (turret/tracks/rotor/etc) for: special_forces
(function attachUnitRenderV2Parts_special_forces(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for special_forces
    }

    globalScope['UnitRenderV2Parts_special_forces'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
