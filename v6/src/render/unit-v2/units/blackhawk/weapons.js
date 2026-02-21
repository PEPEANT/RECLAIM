// Weapon render/muzzle helpers for: blackhawk (UH-60)
(function attachUnitRenderV2Weapons_blackhawk(globalScope) {
    'use strict';

    var MUZZLE_LOCAL = { x: 20.5, y: -1.8 };

    function getWorldScale() {
        if (globalScope && globalScope.UnitRenderV2Blackhawk && typeof globalScope.UnitRenderV2Blackhawk.getBattleWorldScale === 'function') {
            var s = Number(globalScope.UnitRenderV2Blackhawk.getBattleWorldScale());
            if (Number.isFinite(s) && s > 0.01) return s;
        }
        return 1;
    }

    function getFacing(unit, state) {
        var facing = Number(state && state.facing);
        if (!Number.isFinite(facing) || facing === 0) facing = Number(unit && unit.facing);
        if (!Number.isFinite(facing) || facing === 0) facing = 1;
        return facing >= 0 ? 1 : -1;
    }

    function getMuzzleLocal() {
        return { x: MUZZLE_LOCAL.x, y: MUZZLE_LOCAL.y };
    }

    function getMuzzlePosition(unit, state) {
        if (!unit) return null;
        var facing = getFacing(unit, state);
        var worldScale = getWorldScale();
        return {
            x: (Number(unit.x) || 0) + (facing * MUZZLE_LOCAL.x * worldScale),
            y: (Number(unit.y) || 0) + (MUZZLE_LOCAL.y * worldScale)
        };
    }

    function computeMuzzleWorld(unit, options) {
        if (!unit) return null;
        var opts = options || {};
        var localX = Number(opts.localX);
        var localY = Number(opts.localY);
        if (!Number.isFinite(localX)) localX = MUZZLE_LOCAL.x;
        if (!Number.isFinite(localY)) localY = MUZZLE_LOCAL.y;

        var facing = getFacing(unit, opts.state);
        var worldScale = getWorldScale();
        return {
            x: (Number(unit.x) || 0) + (facing * localX * worldScale),
            y: (Number(unit.y) || 0) + (localY * worldScale),
            angle: 0,
            dirX: facing,
            dirY: 0
        };
    }

    globalScope.UnitRenderV2Weapons_blackhawk = {
        MUZZLE_LOCAL: MUZZLE_LOCAL,
        getMuzzleLocal: getMuzzleLocal,
        getMuzzlePosition: getMuzzlePosition,
        computeMuzzleWorld: computeMuzzleWorld
    };
})(typeof window !== 'undefined' ? window : globalThis);
