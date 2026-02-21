// Unit Render V2 entry for: bomber
(function attachUnitRenderV2_bomber(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for bomber
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['bomber'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
