// Unit Render V2 entry for: infantry
(function attachUnitRenderV2_infantry(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for infantry
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['infantry'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
