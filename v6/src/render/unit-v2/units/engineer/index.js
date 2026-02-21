// Unit Render V2 entry for: engineer
(function attachUnitRenderV2_engineer(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for engineer
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['engineer'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
