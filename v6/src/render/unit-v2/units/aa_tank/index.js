// Unit Render V2 entry for: aa_tank
(function attachUnitRenderV2_aa_tank(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for aa_tank
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['aa_tank'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
