// Weapon render/muzzle helpers for: spg
(function attachUnitRenderV2Weapons_spg(globalScope) {
    'use strict';

    // Wide clamp so renderer can express both move-posture(down) and combat-posture(up).
    var LIMIT_DOWN = Math.PI * 0.995;
    var LIMIT_UP = -Math.PI / 2;
    var GUN_PIVOT_X = 10;
    var GUN_PIVOT_Y = -61;
    var DEFAULT_BARREL_LENGTH = 155;

    function clampGunAngle(angle) {
        var value = Number(angle);
        if (!Number.isFinite(value)) return -Math.PI / 12;
        if (value < LIMIT_UP) return LIMIT_UP;
        if (value > LIMIT_DOWN) return LIMIT_DOWN;
        return value;
    }

    function getWorldScale() {
        if (globalScope && globalScope.UnitRenderV2SPG && typeof globalScope.UnitRenderV2SPG.getBattleWorldScale === 'function') {
            var s = Number(globalScope.UnitRenderV2SPG.getBattleWorldScale());
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
            x: Number(unit && unit.x) + (facing * GUN_PIVOT_X * scale),
            y: Number(unit && unit.y) + (GUN_PIVOT_Y * scale),
            facing: facing,
            worldScale: scale
        };
    }

    function computeAimAngleFromPoint(unit, targetX, targetY) {
        if (!unit) return -Math.PI / 12;
        var tx = Number(targetX);
        var ty = Number(targetY);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return -Math.PI / 12;

        var pivot = getPivotWorld(unit);
        var dxWorld = tx - pivot.x;
        var dyWorld = ty - pivot.y;
        var dxLocal = dxWorld * pivot.facing;
        var angle = Math.atan2(dyWorld, dxLocal);

        if (dxLocal < 0) {
            return dyWorld < 0 ? LIMIT_UP : LIMIT_DOWN;
        }
        return clampGunAngle(angle);
    }

    function computeMuzzleLocal(state, options) {
        var opts = options || {};
        var len = Number(opts.barrelLength);
        var barrelLength = Number.isFinite(len) ? len : DEFAULT_BARREL_LENGTH;
        var angle = clampGunAngle(Number(state && (state.gunAngle != null ? state.gunAngle : state.turretAngle)));
        var recoil = Math.max(0, Number(state && state.recoil) || 0);
        var distance = Math.max(0, barrelLength - recoil);
        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            angle: angle
        };
    }

    function computeMuzzleWorld(unit, options) {
        if (!unit) return null;
        var opts = options || {};
        var state = opts.state || null;
        var targetX = Number(opts.targetX);
        var targetY = Number(opts.targetY);

        var angle = Number(opts.angle);
        if (!Number.isFinite(angle)) {
            if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
                angle = computeAimAngleFromPoint(unit, targetX, targetY);
            } else {
                angle = Number(state && state.gunAngle);
            }
        }
        angle = clampGunAngle(angle);

        var recoil = Number(opts.recoil);
        if (!Number.isFinite(recoil)) recoil = Number(state && state.recoil);
        if (!Number.isFinite(recoil)) recoil = Number(unit.recoil);
        if (!Number.isFinite(recoil)) recoil = 0;

        var local = computeMuzzleLocal({ gunAngle: angle, recoil: recoil }, {
            barrelLength: Number(opts.barrelLength) || DEFAULT_BARREL_LENGTH
        });
        var pivot = getPivotWorld(unit);

        return {
            x: Number(unit.x) + (pivot.facing * (GUN_PIVOT_X + local.x) * pivot.worldScale),
            y: Number(unit.y) + ((GUN_PIVOT_Y + local.y) * pivot.worldScale),
            angle: local.angle,
            dirX: pivot.facing * Math.cos(local.angle),
            dirY: Math.sin(local.angle)
        };
    }

    globalScope.UnitRenderV2Weapons_spg = {
        LIMIT_DOWN: LIMIT_DOWN,
        LIMIT_UP: LIMIT_UP,
        GUN_PIVOT_X: GUN_PIVOT_X,
        GUN_PIVOT_Y: GUN_PIVOT_Y,
        DEFAULT_BARREL_LENGTH: DEFAULT_BARREL_LENGTH,
        clampGunAngle: clampGunAngle,
        computeAimAngleFromPoint: computeAimAngleFromPoint,
        computeMuzzleLocal: computeMuzzleLocal,
        computeMuzzleWorld: computeMuzzleWorld
    };
})(typeof window !== 'undefined' ? window : globalThis);
