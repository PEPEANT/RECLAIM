// Unit Render V2 entry for: icbm
(function attachUnitRenderV2_icbm(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for icbm
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['icbm'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
