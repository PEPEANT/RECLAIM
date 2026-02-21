// Unit Render V2 entry for: mbt
(function attachUnitRenderV2_mbt(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for mbt
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['mbt'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
