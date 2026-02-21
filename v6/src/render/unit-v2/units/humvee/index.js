// Unit Render V2 entry for: humvee
(function attachUnitRenderV2_humvee(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for humvee
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['humvee'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
