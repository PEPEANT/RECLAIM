// Weapon render/muzzle helpers for: recon
(function attachUnitRenderV2Weapons_recon(globalScope) {
    'use strict';

    function getMuzzlePosition(unit) {
        if (!unit) return null;
        return { x: unit.x || 0, y: unit.y || 0 };
    }

    globalScope['UnitRenderV2Weapons_recon'] = {
        getMuzzlePosition: getMuzzlePosition
    };
})(typeof window !== 'undefined' ? window : globalThis);
