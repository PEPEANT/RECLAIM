// Unit Render V2 entry for: apache
(function attachUnitRenderV2_apache(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for apache
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['apache'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
