// Additional part rendering (turret/tracks/rotor/etc) for: icbm_enemy
(function attachUnitRenderV2Parts_icbm_enemy(globalScope) {
    'use strict';

    function drawParts(unit, ctx) {
        if (!ctx) return;
        // TODO: implement extra parts for icbm_enemy
    }

    globalScope['UnitRenderV2Parts_icbm_enemy'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
