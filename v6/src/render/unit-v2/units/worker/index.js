// Unit Render V2 entry for: worker
(function attachUnitRenderV2_worker(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for worker
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['worker'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
