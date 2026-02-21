// Unit Render V2 entry for: special_ops
(function attachUnitRenderV2_special_ops(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for special_ops
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['special_ops'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
