// Unit Render V2 entry for: recon
(function attachUnitRenderV2_recon(globalScope) {
    'use strict';

    function draw(unit, ctx, env) {
        // TODO: implement V2 renderer for recon
        return false;
    }

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry['recon'] = {
            draw: draw
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
