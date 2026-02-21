// Unit Render V2 entry for: fighter
(function attachUnitRenderV2_fighter(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for fighter
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['fighter'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
