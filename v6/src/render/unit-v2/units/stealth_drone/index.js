// Unit Render V2 entry for: stealth_drone
(function attachUnitRenderV2_stealth_drone(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for stealth_drone
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['stealth_drone'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
