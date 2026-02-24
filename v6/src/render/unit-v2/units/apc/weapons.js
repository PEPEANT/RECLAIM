// Weapon render/muzzle helpers for: apc (M2 Bradley IFV)
(function attachUnitRenderV2Weapons_apc(globalScope) {
    'use strict';

    var LIMIT_DOWN_FRONT = 0.15;
    var LIMIT_DOWN_BACK = -0.10;
    var LIMIT_UP = -Math.PI / 2.2;
    var TURRET_PIVOT_X = -5;
    // Keep muzzle/aim pivot aligned with render_parts turret anchor.
    var TURRET_PIVOT_Y = -33;
    var AUTO_BARREL_LEN = 65;
    var TOW_OFFSET_X = -10;
    var TOW_OFFSET_Y = -18;
    var TOW_BARREL_LEN = 0;

    function clampTurretAngle(angle) {
        var value = Number(angle);
        if (!Number.isFinite(value)) return -0.08;
        if (value < LIMIT_UP) return LIMIT_UP;
        if (value > LIMIT_DOWN_FRONT) return LIMIT_DOWN_FRONT;
        return value;
    }

    function getWorldScale() {
        if (globalScope && globalScope.UnitRenderV2APC && typeof globalScope.UnitRenderV2APC.getBattleWorldScale === 'function') {
            var s = Number(globalScope.UnitRenderV2APC.getBattleWorldScale());
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
            return dyWorld < 0 ? LIMIT_UP : LIMIT_DOWN_BACK;
        }
        return clampTurretAngle(angle);
    }

    function computeAutoMuzzleLocal(state, options) {
        var opts = options || {};
        var len = Number(opts.barrelLength);
        var barrelLength = Number.isFinite(len) ? len : AUTO_BARREL_LEN;
        var angle = clampTurretAngle(Number(state && state.turretAngle));
        var recoil = Math.max(0, Number(state && state.recoil) || 0);
        var dist = Math.max(18, barrelLength - recoil);
        return {
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            angle: angle
        };
    }

    function computeTowTubeLocal(state) {
        var angle = clampTurretAngle(Number(state && state.turretAngle));
        var cosA = Math.cos(angle);
        var sinA = Math.sin(angle);
        var ox = (TOW_OFFSET_X * cosA) - (TOW_OFFSET_Y * sinA);
        var oy = (TOW_OFFSET_X * sinA) + (TOW_OFFSET_Y * cosA);
        return {
            x: ox + (Math.cos(angle) * TOW_BARREL_LEN),
            y: oy + (Math.sin(angle) * TOW_BARREL_LEN),
            angle: angle
        };
    }

    function computeMuzzleWorld(unit, options) {
        if (!unit) return null;
        var opts = options || {};
        var state = opts.state || null;
        var weapon = String(opts.weapon || 'auto').trim().toLowerCase();

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
            local = computeAutoMuzzleLocal({ turretAngle: angle, recoil: Number(state && state.recoil) }, { barrelLength: Number(opts.barrelLength) || AUTO_BARREL_LEN });
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

    globalScope.UnitRenderV2Weapons_apc = {
        LIMIT_DOWN_FRONT: LIMIT_DOWN_FRONT,
        LIMIT_DOWN_BACK: LIMIT_DOWN_BACK,
        LIMIT_UP: LIMIT_UP,
        TURRET_PIVOT_X: TURRET_PIVOT_X,
        TURRET_PIVOT_Y: TURRET_PIVOT_Y,
        AUTO_BARREL_LEN: AUTO_BARREL_LEN,
        clampTurretAngle: clampTurretAngle,
        computeAimAngleFromPoint: computeAimAngleFromPoint,
        computeAutoMuzzleLocal: computeAutoMuzzleLocal,
        computeTowTubeLocal: computeTowTubeLocal,
        computeMuzzleWorld: computeMuzzleWorld
    };
})(typeof window !== 'undefined' ? window : globalThis);
