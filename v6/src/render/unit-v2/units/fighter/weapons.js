// Weapon render/muzzle helpers for: fighter
(function attachUnitRenderV2Weapons_fighter(globalScope) {
    'use strict';

    function getMuzzlePosition(unit) {
        if (!unit) return null;
        return { x: unit.x || 0, y: unit.y || 0 };
    }

    globalScope['UnitRenderV2Weapons_fighter'] = {
        getMuzzlePosition: getMuzzlePosition
    };
})(typeof window !== 'undefined' ? window : globalThis);
