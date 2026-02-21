// Unit Render V2 entry for: apc
(function attachUnitRenderV2_apc(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for apc
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['apc'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
