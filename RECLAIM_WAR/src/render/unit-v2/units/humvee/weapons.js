// Weapon render/muzzle helpers for: humvee
(function attachUnitRenderV2Weapons_humvee(globalScope) {
    'use strict';

    var LIMIT_DOWN = 0.20;
    var LIMIT_UP = -Math.PI / 2.5;
    var TURRET_PIVOT_X = -5;
    var TURRET_PIVOT_Y = -30;
    var MG_BARREL_LEN = 35;
    var TOW_OFFSET_X = 0;
    var TOW_OFFSET_Y = -14;

    function clampTurretAngle(angle) {
        var value = Number(angle);
        if (!Number.isFinite(value)) return -0.08;
        if (value < LIMIT_UP) return LIMIT_UP;
        if (value > LIMIT_DOWN) return LIMIT_DOWN;
        return value;
    }

    function getWorldScale() {
        if (globalScope && globalScope.UnitRenderV2Humvee && typeof globalScope.UnitRenderV2Humvee.getBattleWorldScale === 'function') {
            var s = Number(globalScope.UnitRenderV2Humvee.getBattleWorldScale());
            if (Number.isFinite(s) && s > 0.01) return s;
        }
        return 1;
    }

    function getFacing(unit) {
        var facing = Number(unit && unit.facing);
        if (!Number.isFinite(facing) || facing === 0) facing = 1;
        return facing >= 0 ? 1 : -1;
    }

    function getPivotWorld(unit, worldScale) {
        var scale = Number.isFinite(worldScale) ? worldScale : getWorldScale();
        var facing = getFacing(unit);
        return {
            x: Number(unit && unit.x) + (facing * TURRET_PIVOT_X * scale),
            y: Number(unit && unit.y) + (TURRET_PIVOT_Y * scale),
            facing: facing,
            worldScale: scale
        };
    }

    function computeAimAngleFromPoint(unit, targetX, targetY) {
        if (!unit) return -0.08;
        var tx = Number(targetX);
        var ty = Number(targetY);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return -0.08;

        var pivot = getPivotWorld(unit);
        var dxWorld = tx - pivot.x;
        var dyWorld = ty - pivot.y;
        var dxLocal = dxWorld * pivot.facing;
        var angle = Math.atan2(dyWorld, dxLocal);

        if (dxLocal < 0) {
            return dyWorld < 0 ? LIMIT_UP : LIMIT_DOWN;
        }
        return clampTurretAngle(angle);
    }

    function computeMgMuzzleLocal(state, options) {
        var opts = options || {};
        var len = Number(opts.barrelLength);
        var barrelLength = Number.isFinite(len) ? len : MG_BARREL_LEN;
        var angle = clampTurretAngle(Number(state && state.turretAngle));
        return {
            x: Math.cos(angle) * barrelLength,
            y: Math.sin(angle) * barrelLength,
            angle: angle
        };
    }

    function computeTowTubeLocal(state) {
        var angle = clampTurretAngle(Number(state && state.turretAngle));
        var cosA = Math.cos(angle);
        var sinA = Math.sin(angle);
        return {
            x: (TOW_OFFSET_X * cosA) - (TOW_OFFSET_Y * sinA),
            y: (TOW_OFFSET_X * sinA) + (TOW_OFFSET_Y * cosA),
            angle: angle
        };
    }

    function computeMuzzleWorld(unit, options) {
        if (!unit) return null;
        var opts = options || {};
        var state = opts.state || null;
        var weapon = String(opts.weapon || 'mg').trim().toLowerCase();

        var angle = Number(opts.angle);
        var targetX = Number(opts.targetX);
        var targetY = Number(opts.targetY);
        if (!Number.isFinite(angle)) {
            if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
                angle = computeAimAngleFromPoint(unit, targetX, targetY);
            } else {
                angle = Number(state && state.turretAngle);
            }
        }
        angle = clampTurretAngle(angle);

        var local;
        if (weapon === 'tow') {
            local = computeTowTubeLocal({ turretAngle: angle });
        } else {
            local = computeMgMuzzleLocal({ turretAngle: angle }, { barrelLength: Number(opts.barrelLength) || MG_BARREL_LEN });
        }

        var pivot = getPivotWorld(unit);
        return {
            x: Number(unit.x) + (pivot.facing * (TURRET_PIVOT_X + local.x) * pivot.worldScale),
            y: Number(unit.y) + ((TURRET_PIVOT_Y + local.y) * pivot.worldScale),
            angle: local.angle,
            dirX: pivot.facing * Math.cos(local.angle),
            dirY: Math.sin(local.angle)
        };
    }

    globalScope.UnitRenderV2Weapons_humvee = {
        LIMIT_DOWN: LIMIT_DOWN,
        LIMIT_UP: LIMIT_UP,
        TURRET_PIVOT_X: TURRET_PIVOT_X,
        TURRET_PIVOT_Y: TURRET_PIVOT_Y,
        MG_BARREL_LEN: MG_BARREL_LEN,
        clampTurretAngle: clampTurretAngle,
        computeAimAngleFromPoint: computeAimAngleFromPoint,
        computeMgMuzzleLocal: computeMgMuzzleLocal,
        computeTowTubeLocal: computeTowTubeLocal,
        computeMuzzleWorld: computeMuzzleWorld
    };
})(typeof window !== 'undefined' ? window : globalThis);
