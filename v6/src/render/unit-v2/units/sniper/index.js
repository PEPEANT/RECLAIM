// Unit Render V2 entry for: sniper
(function attachUnitRenderV2_sniper(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for sniper
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['sniper'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
