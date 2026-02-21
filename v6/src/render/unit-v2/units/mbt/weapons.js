// Weapon render/muzzle helpers for: mbt
(function attachUnitRenderV2Weapons_mbt(globalScope) {
    'use strict';

    var LIMIT_DOWN = 0.15;
    var LIMIT_UP = -Math.PI / 4;

    function clampTurretAngle(angle) {
        var value = Number(angle);
        if (!Number.isFinite(value)) return -0.1;
        if (value < LIMIT_UP) return LIMIT_UP;
        if (value > LIMIT_DOWN) return LIMIT_DOWN;
        return value;
    }

    function computeAimAngleFromPoint(unit, targetX, targetY) {
        if (!unit) return -0.1;
        var worldScale = 1;
        if (globalScope && globalScope.UnitRenderV2MBT && typeof globalScope.UnitRenderV2MBT.getBattleWorldScale === 'function') {
            var s = Number(globalScope.UnitRenderV2MBT.getBattleWorldScale());
            if (Number.isFinite(s) && s > 0.01) worldScale = s;
        }
        var facing = Number(unit.facing);
        if (!Number.isFinite(facing) || facing === 0) facing = 1;
        facing = facing >= 0 ? 1 : -1;

        var px = Number(unit.x) + (facing * 5 * worldScale);
        var py = Number(unit.y) + (-30 * worldScale);
        var tx = Number(targetX);
        var ty = Number(targetY);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return -0.1;

        var dxWorld = tx - px;
        var dyWorld = ty - py;
        var dxLocal = dxWorld * facing;
        var angle = Math.atan2(dyWorld, dxLocal);

        // Back-side aim lock: preserve up/down clamp when target is behind the hull.
        if (dxLocal < 0) {
            return dyWorld < 0 ? LIMIT_UP : LIMIT_DOWN;
        }
        return clampTurretAngle(angle);
    }

    function computeMuzzleLocal(state, options) {
        var opts = options || {};
        var length = Number(opts.barrelLength);
        var barrelLength = Number.isFinite(length) ? length : 70;
        var angle = clampTurretAngle(Number(state && state.turretAngle));
        var recoil = Math.max(0, Number(state && state.recoil) || 0);
        var baseFromPivot = 40;
        var muzzleDistance = Math.max(0, (baseFromPivot + barrelLength) - recoil);
        var x = Math.cos(angle) * muzzleDistance;
        var y = Math.sin(angle) * muzzleDistance;
        return { x: x, y: y, angle: angle };
    }

    globalScope.UnitRenderV2Weapons_mbt = {
        LIMIT_DOWN: LIMIT_DOWN,
        LIMIT_UP: LIMIT_UP,
        clampTurretAngle: clampTurretAngle,
        computeAimAngleFromPoint: computeAimAngleFromPoint,
        computeMuzzleLocal: computeMuzzleLocal
    };
})(typeof window !== 'undefined' ? window : globalThis);
