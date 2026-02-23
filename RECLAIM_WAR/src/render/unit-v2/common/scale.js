// Shared scale tokens for Unit Render V2.
(function attachUnitRenderV2Scale(globalScope) {
    'use strict';

    globalScope.UnitRenderV2Scale = {
        WORLD_SCALE: 1,
        UNIT_RENDER_SCALE: 1,
        BG_SCALE: 1
    };
})(typeof window !== 'undefined' ? window : globalThis);
