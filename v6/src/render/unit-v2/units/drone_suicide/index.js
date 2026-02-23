// Unit Render V2 entry for: drone_suicide
(function attachUnitRenderV2_drone_suicide(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for drone_suicide
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['drone_suicide'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
