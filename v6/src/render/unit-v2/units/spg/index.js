// Unit Render V2 entry for: spg
(function attachUnitRenderV2_spg(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for spg
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['spg'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
