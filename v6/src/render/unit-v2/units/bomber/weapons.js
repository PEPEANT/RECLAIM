// Weapon render/muzzle helpers for: bomber
(function attachUnitRenderV2Weapons_bomber(globalScope) {
    'use strict';

    function getMuzzlePosition(unit) {
        if (!unit) return null;
        return { x: unit.x || 0, y: unit.y || 0 };
    }

    globalScope['UnitRenderV2Weapons_bomber'] = {
        getMuzzlePosition: getMuzzlePosition
    };
})(typeof window !== 'undefined' ? window : globalThis);
