// Unit Render V2 entry for: icbm_enemy
(function attachUnitRenderV2_icbm_enemy(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for icbm_enemy
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['icbm_enemy'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
