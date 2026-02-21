// Unit Render V2 entry for: tactical_drone
(function attachUnitRenderV2_tactical_drone(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for tactical_drone
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['tactical_drone'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
