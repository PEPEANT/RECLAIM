// Weapon render/muzzle helpers for: drone_suicide
(function attachUnitRenderV2Weapons_drone_suicide(globalScope) {
    'use strict';

    function getMuzzlePosition(unit) {
        if (!unit) return null;
        return { x: unit.x || 0, y: unit.y || 0 };
    }

    globalScope['UnitRenderV2Weapons_drone_suicide'] = {
        getMuzzlePosition: getMuzzlePosition
    };
})(typeof window !== 'undefined' ? window : globalThis);
