// Weapon render/muzzle helpers for: infantry
(function attachUnitRenderV2Weapons_infantry(globalScope) {
    'use strict';

    var RIFLE_CONFIG = {
        standing:  { x: 3,  y: -20, barrelEnd: 18, angle: -0.05 },
        crouching: { x: 4,  y: -14, barrelEnd: 18, angle: -0.03 },
        prone:     { x: 12, y:  -5, barrelEnd: 18, angle: 0.00 }
    };

    function getCfg(stance) {
        return RIFLE_CONFIG[stance] || RIFLE_CONFIG.standing;
    }

    function getPose(state) {
        var s = state || {};
        return {
            weaponBobX: Number(s.weaponBobX) || 0,
            weaponBobY: Number(s.weaponBobY) || 0,
            weaponSway: Number(s.weaponSway) || 0,
            recoil: Number(s.recoil) || 0,
            stance: s.stance || 'standing',
            facing: (s.facing === -1) ? -1 : 1
        };
    }

    function getMuzzleLocal(state) {
        var pose = getPose(state);
        var cfg = getCfg(pose.stance);
        var kickback = pose.recoil * 0.4;
        var baseX = cfg.x - kickback + pose.weaponBobX;
        var baseY = cfg.y - pose.weaponBobY;
        var ang = cfg.angle + pose.weaponSway;

        return {
            x: baseX + Math.cos(ang) * cfg.barrelEnd,
            y: baseY + Math.sin(ang) * cfg.barrelEnd,
            angle: ang
        };
    }

    function drawRifle(ctx, stance, palette, recoil, state) {
        if (!ctx || !palette) return;

        var cfg = getCfg(stance);
        var pose = getPose(state);
        var kickback = (Number(recoil) || 0) * 0.4;
        var tx = cfg.x - kickback + pose.weaponBobX;
        var ty = cfg.y - pose.weaponBobY;
        var ang = cfg.angle + pose.weaponSway;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ang);

        ctx.fillStyle = palette.gunWood;
        ctx.fillRect(-5, -1.5, 6, 3);

        ctx.fillStyle = palette.gun;
        ctx.fillRect(0, -2, 10, 4);

        ctx.fillStyle = '#111';
        ctx.fillRect(10, -1, 8, 2);

        ctx.fillStyle = '#222';
        ctx.fillRect(3, 2, 3, 5);

        ctx.restore();
    }

    function getMuzzlePosition(unit, state) {
        if (!unit || !state) return null;

        var local = getMuzzleLocal(state);
        var facing = (state.facing === -1) ? -1 : 1;

        return {
            x: unit.x + (local.x * facing),
            y: unit.y + local.y
        };
    }

    globalScope['UnitRenderV2Weapons_infantry'] = {
        drawRifle: drawRifle,
        getMuzzlePosition: getMuzzlePosition,
        getMuzzleLocal: getMuzzleLocal
    };
})(typeof window !== 'undefined' ? window : globalThis);
