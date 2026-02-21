// Weapon render/muzzle helpers for: blackhawk
(function attachUnitRenderV2Weapons_blackhawk(globalScope) {
    'use strict';

    function getMuzzlePosition(unit) {
        if (!unit) return null;
        return { x: unit.x || 0, y: unit.y || 0 };
    }

    globalScope['UnitRenderV2Weapons_blackhawk'] = {
        getMuzzlePosition: getMuzzlePosition
    };
})(typeof window !== 'undefined' ? window : globalThis);
