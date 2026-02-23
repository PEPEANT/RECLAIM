// Unit Render V2 entry for: special_forces
(function attachUnitRenderV2_special_forces(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for special_forces
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['special_forces'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
