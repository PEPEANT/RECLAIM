// Weapon render/muzzle helpers for: aa_tank (SPAAG)
(function attachUnitRenderV2Weapons_aa_tank(globalScope) {
    'use strict';

    var LIMIT_DOWN = 0.10;
    var LIMIT_UP = -Math.PI / 1.8;
    var TURRET_PIVOT_X = 0;
    var TURRET_PIVOT_Y = -30;
    var AUTO_BARREL_LEN = 45;
    var BARREL_Y_OFFSET = 4;
    var SAM_OFFSET_X = 5;
    var SAM_OFFSET_Y = -15;
    var SAM_BARREL_LEN = 2;

    function clampTurretAngle(angle) {
        var value = Number(angle);
        if (!Number.isFinite(value)) return -Math.PI / 4;
        if (value < LIMIT_UP) return LIMIT_UP;
        if (value > LIMIT_DOWN) return LIMIT_DOWN;
        return value;
    }

    function getWorldScale() {
        if (globalScope && globalScope.UnitRenderV2AATank && typeof globalScope.UnitRenderV2AATank.getBattleWorldScale === 'function') {
            var s = Number(globalScope.UnitRenderV2AATank.getBattleWorldScale());
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
        if (!unit) return -Math.PI / 4;
        var tx = Number(targetX);
        var ty = Number(targetY);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return -Math.PI / 4;

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

    function computeAutoMuzzleLocal(state, options) {
        var opts = options || {};
        var len = Number(opts.barrelLength);
        var barrelLength = Number.isFinite(len) ? len : AUTO_BARREL_LEN;
        var angle = clampTurretAngle(Number(state && state.turretAngle));
        var recoil = Math.max(0, Number(state && state.recoil) || 0);
        var toggle = !!(state && state.barrelToggle);
        var yOffset = toggle ? -BARREL_Y_OFFSET : BARREL_Y_OFFSET;
        var dist = Math.max(16, barrelLength - recoil);

        return {
            x: Math.cos(angle) * dist - Math.sin(angle) * yOffset,
            y: Math.sin(angle) * dist + Math.cos(angle) * yOffset,
            yOffset: yOffset,
            angle: angle
        };
    }

    function computeSamMuzzleLocal(state) {
        var angle = clampTurretAngle(Number(state && state.turretAngle));
        var cosA = Math.cos(angle);
        var sinA = Math.sin(angle);
        var ox = (SAM_OFFSET_X * cosA) - (SAM_OFFSET_Y * sinA);
        var oy = (SAM_OFFSET_X * sinA) + (SAM_OFFSET_Y * cosA);
        return {
            x: ox + (cosA * SAM_BARREL_LEN),
            y: oy + (sinA * SAM_BARREL_LEN),
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

        if (weapon === 'auto' && state) {
            var shotFrame = Number(opts.shotFrame);
            if (Number.isFinite(shotFrame) && shotFrame > 0 && shotFrame !== Number(state.lastShotFrame)) {
                state.lastShotFrame = shotFrame;
                state.barrelToggle = !state.barrelToggle;
            }
        }

        var local;
        if (weapon === 'sam') {
            local = computeSamMuzzleLocal({ turretAngle: angle });
        } else {
            local = computeAutoMuzzleLocal({
                turretAngle: angle,
                recoil: Number(state && state.recoil),
                barrelToggle: !!(state && state.barrelToggle)
            }, {
                barrelLength: Number(opts.barrelLength) || AUTO_BARREL_LEN
            });
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

    globalScope.UnitRenderV2Weapons_aa_tank = {
        LIMIT_DOWN: LIMIT_DOWN,
        LIMIT_UP: LIMIT_UP,
        TURRET_PIVOT_X: TURRET_PIVOT_X,
        TURRET_PIVOT_Y: TURRET_PIVOT_Y,
        AUTO_BARREL_LEN: AUTO_BARREL_LEN,
        clampTurretAngle: clampTurretAngle,
        computeAimAngleFromPoint: computeAimAngleFromPoint,
        computeAutoMuzzleLocal: computeAutoMuzzleLocal,
        computeSamMuzzleLocal: computeSamMuzzleLocal,
        computeMuzzleWorld: computeMuzzleWorld
    };
})(typeof window !== 'undefined' ? window : globalThis);
