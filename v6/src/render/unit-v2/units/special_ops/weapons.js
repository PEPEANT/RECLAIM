// Weapon render/muzzle helpers for: special_ops
(function attachUnitRenderV2Weapons_special_ops(globalScope) {
    'use strict';

    var RIFLE_CONFIG = {
        standing:  { x: 3,  y: -20, barrelEnd: 22, angle: -0.04 },
        crouching: { x: 4,  y: -14, barrelEnd: 22, angle: -0.02 },
        prone:     { x: 12, y:  -5, barrelEnd: 22, angle: 0.00 }
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
        var ang = cfg.angle + pose.weaponSway * 0.75;
        return {
            x: baseX + Math.cos(ang) * cfg.barrelEnd,
            y: baseY + Math.sin(ang) * cfg.barrelEnd,
            angle: ang
        };
    }

    function drawWeapon(ctx, stance, palette, recoil, state) {
        if (!ctx || !palette) return;
        var cfg = getCfg(stance);
        var pose = getPose(state);
        var kickback = (Number(recoil) || 0) * 0.4;
        var tx = cfg.x - kickback + pose.weaponBobX;
        var ty = cfg.y - pose.weaponBobY;
        var ang = cfg.angle + pose.weaponSway * 0.75;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ang);

        // Receiver / handguard.
        ctx.fillStyle = palette.gunDark;
        ctx.fillRect(-4, -2.1, 15, 4.2);
        ctx.fillRect(11, -1.6, 6, 3.2);

        // Suppressor.
        ctx.fillStyle = '#0b120d';
        ctx.fillRect(17, -1.4, 8, 2.8);

        // Optic + rail.
        ctx.fillStyle = '#1f2a23';
        ctx.fillRect(1.8, -5.2, 5.2, 2.4);
        ctx.fillRect(0.5, -3.8, 8.2, 1);

        // Laser / tactical module.
        ctx.fillStyle = '#102215';
        ctx.fillRect(10, 2, 2.8, 2.2);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(12.2, 2.7, 0.9, 0.9);

        // Extended magazine + foregrip.
        ctx.fillStyle = palette.gunBody;
        ctx.fillRect(3.8, 2, 3, 5);
        ctx.fillRect(10.8, 2, 1.8, 4.5);

        // Stock.
        ctx.fillStyle = palette.gunBody;
        ctx.fillRect(-8, -1.2, 4.2, 2.8);
        ctx.fillRect(-6.2, -2.2, 2.1, 1.2);

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

    globalScope['UnitRenderV2Weapons_special_ops'] = {
        drawWeapon: drawWeapon,
        getMuzzlePosition: getMuzzlePosition,
        getMuzzleLocal: getMuzzleLocal
    };
})(typeof window !== 'undefined' ? window : globalThis);
