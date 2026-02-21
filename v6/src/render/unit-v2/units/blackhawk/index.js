// Unit Render V2 entry for: blackhawk
(function attachUnitRenderV2_blackhawk(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for blackhawk
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['blackhawk'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
