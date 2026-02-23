// Weapon render/muzzle helpers for: drone_operator
(function attachUnitRenderV2Weapons_drone_operator(globalScope) {
    'use strict';

    var RIFLE_CONFIG = {
        standing:  { x: 3,  y: -20, barrelEnd: 18, angle: -0.05 },
        crouching: { x: 4,  y: -14, barrelEnd: 18, angle: -0.03 },
        prone:     { x: 12, y:  -5, barrelEnd: 18, angle: 0.00 }
    };

    var TABLET_CONFIG = {
        standing:  { x: 7,  y: -13, barrelEnd: 8, angle: -0.2 },
        crouching: { x: 8,  y:  -8, barrelEnd: 8, angle: -0.1 },
        prone:     { x: 10, y:  -1, barrelEnd: 7, angle: 0.0 }
    };

    function getPose(state) {
        var s = state || {};
        return {
            weaponBobX: Number(s.weaponBobX) || 0,
            weaponBobY: Number(s.weaponBobY) || 0,
            weaponSway: Number(s.weaponSway) || 0,
            recoil: Number(s.recoil) || 0,
            stance: s.stance || 'standing',
            mode: s.mode || 'rifle',
            facing: (s.facing === -1) ? -1 : 1
        };
    }

    function getCfg(mode, stance) {
        if (mode === 'laptop') return TABLET_CONFIG[stance] || TABLET_CONFIG.standing;
        return RIFLE_CONFIG[stance] || RIFLE_CONFIG.standing;
    }

    function getMuzzleLocal(state) {
        var pose = getPose(state);
        var cfg = getCfg(pose.mode, pose.stance);
        var kickMul = (pose.mode === 'laptop') ? 0 : 0.38;
        var baseX = cfg.x - (pose.recoil * kickMul) + pose.weaponBobX;
        var baseY = cfg.y - pose.weaponBobY;
        var swayMul = (pose.mode === 'laptop') ? 0.2 : 1;
        var ang = cfg.angle + pose.weaponSway * swayMul;
        return {
            x: baseX + Math.cos(ang) * cfg.barrelEnd,
            y: baseY + Math.sin(ang) * cfg.barrelEnd,
            angle: ang
        };
    }

    function drawRifle(ctx, palette, tx, ty, ang) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ang);
        ctx.fillStyle = palette.gunBody;
        ctx.fillRect(-5, -1.5, 6, 3);
        ctx.fillStyle = palette.gunDark;
        ctx.fillRect(0, -2, 10, 4);
        ctx.fillStyle = '#111';
        ctx.fillRect(10, -1, 8, 2);
        ctx.fillStyle = '#222';
        ctx.fillRect(3, 2, 3, 5);
        ctx.restore();
    }

    function drawTablet(ctx, palette, tx, ty, ang) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ang);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-4, -3, 10, 7);
        ctx.fillStyle = palette.screen;
        ctx.fillRect(-3, -2, 8, 5);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, -3);
        ctx.lineTo(-5, -6);
        ctx.stroke();
        ctx.restore();
    }

    function drawWeapon(ctx, stance, palette, recoil, state) {
        if (!ctx || !palette) return;
        var pose = getPose(state);
        var cfg = getCfg(pose.mode, stance);
        var kickMul = (pose.mode === 'laptop') ? 0 : 0.38;
        var tx = cfg.x - (Number(recoil) || 0) * kickMul + pose.weaponBobX;
        var ty = cfg.y - pose.weaponBobY;
        var swayMul = (pose.mode === 'laptop') ? 0.2 : 1;
        var ang = cfg.angle + pose.weaponSway * swayMul;

        if (pose.mode === 'laptop') drawTablet(ctx, palette, tx, ty, ang);
        else drawRifle(ctx, palette, tx, ty, ang);
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

    globalScope['UnitRenderV2Weapons_drone_operator'] = {
        drawWeapon: drawWeapon,
        getMuzzlePosition: getMuzzlePosition,
        getMuzzleLocal: getMuzzleLocal
    };
})(typeof window !== 'undefined' ? window : globalThis);
