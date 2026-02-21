// Weapon render/muzzle helpers for: engineer
(function attachUnitRenderV2Weapons_engineer(globalScope) {
    'use strict';

    var RIFLE_CONFIG = {
        standing:  { x: 3,  y: -20, barrelEnd: 18, angle: -0.05 },
        crouching: { x: 4,  y: -14, barrelEnd: 18, angle: -0.03 },
        prone:     { x: 12, y:  -5, barrelEnd: 18, angle: 0.00 }
    };

    var LAUNCHER_CONFIG = {
        standing:  { x: 2,  y: -22, barrelEnd: 26, angle: -0.08 },
        crouching: { x: 3,  y: -16, barrelEnd: 26, angle: -0.04 },
        prone:     { x: 10, y:  -7, barrelEnd: 25, angle: 0.00 }
    };

    function getPose(state) {
        var s = state || {};
        return {
            weaponBobX: Number(s.weaponBobX) || 0,
            weaponBobY: Number(s.weaponBobY) || 0,
            weaponSway: Number(s.weaponSway) || 0,
            recoil: Number(s.recoil) || 0,
            stance: s.stance || 'standing',
            mode: s.mode || 'carrying',
            facing: (s.facing === -1) ? -1 : 1
        };
    }

    function getCfg(mode, stance) {
        if (mode === 'firing') return LAUNCHER_CONFIG[stance] || LAUNCHER_CONFIG.standing;
        return RIFLE_CONFIG[stance] || RIFLE_CONFIG.standing;
    }

    function getMuzzleLocal(state) {
        var pose = getPose(state);
        var cfg = getCfg(pose.mode, pose.stance);
        var kickMul = (pose.mode === 'firing') ? 0.48 : 0.38;
        var baseX = cfg.x - (pose.recoil * kickMul) + pose.weaponBobX;
        var baseY = cfg.y - pose.weaponBobY;
        var swayMul = (pose.mode === 'firing') ? 0.45 : 1;
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

    function drawLauncher(ctx, palette, tx, ty, ang, flash) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ang);

        ctx.fillStyle = palette.launcher;
        ctx.fillRect(-12, -3.2, 28, 6.4);
        ctx.fillStyle = '#0d131a';
        ctx.fillRect(-14, -4.2, 4, 8.4);
        ctx.fillRect(14, -4.2, 4, 8.4);

        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-2, -7, 8, 4.2);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(5.2, -6.1, 1.8, 1.8);

        if (flash > 0) {
            var a = Math.min(1, flash / 8);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#ffd08a';
            ctx.beginPath();
            ctx.moveTo(16, -2.5);
            ctx.lineTo(26, 0);
            ctx.lineTo(16, 2.5);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    function drawWeapon(ctx, stance, palette, recoil, state) {
        if (!ctx || !palette) return;
        var pose = getPose(state);
        var cfg = getCfg(pose.mode, stance);
        var kickMul = (pose.mode === 'firing') ? 0.48 : 0.38;
        var tx = cfg.x - (Number(recoil) || 0) * kickMul + pose.weaponBobX;
        var ty = cfg.y - pose.weaponBobY;
        var swayMul = (pose.mode === 'firing') ? 0.45 : 1;
        var ang = cfg.angle + pose.weaponSway * swayMul;

        if (pose.mode === 'firing') {
            drawLauncher(ctx, palette, tx, ty, ang, Number(state && state.launcherFlash) || 0);
        } else {
            drawRifle(ctx, palette, tx, ty, ang);
        }
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

    globalScope['UnitRenderV2Weapons_engineer'] = {
        drawWeapon: drawWeapon,
        getMuzzlePosition: getMuzzlePosition,
        getMuzzleLocal: getMuzzleLocal
    };
})(typeof window !== 'undefined' ? window : globalThis);
