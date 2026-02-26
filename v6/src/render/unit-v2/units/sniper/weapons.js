// Weapon render/muzzle helpers for: sniper
(function attachUnitRenderV2Weapons_sniper(globalScope) {
    'use strict';

    var RIFLE_CONFIG = {
        standing:  { x: 2,  y: -20, barrelEnd: 29, angle: -0.04 },
        crouching: { x: 3,  y: -14, barrelEnd: 29, angle: -0.03 },
        prone:     { x: 12, y:  -5, barrelEnd: 30, angle: 0.00 }
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

    function getWeaponStyle(unit) {
        if (!unit || typeof unit !== 'object') {
            return { barrelMul: 1, stockMul: 1, tone: 0 };
        }
        if (!unit._sniperWeaponStyle || typeof unit._sniperWeaponStyle !== 'object') {
            unit._sniperWeaponStyle = {
                barrelMul: 0.95 + (Math.random() * 0.18),
                stockMul: 0.92 + (Math.random() * 0.18),
                tone: Math.round((Math.random() * 14) - 7)
            };
        }
        return unit._sniperWeaponStyle;
    }

    function getMuzzleLocal(state, unit) {
        var pose = getPose(state);
        var cfg = getCfg(pose.stance);
        var style = getWeaponStyle(unit);
        var kickback = pose.recoil * 0.45;
        var baseX = cfg.x - kickback + pose.weaponBobX;
        var baseY = cfg.y - pose.weaponBobY;
        var ang = cfg.angle + pose.weaponSway * 0.6;
        var barrelEnd = cfg.barrelEnd * Math.max(0.85, Math.min(1.25, Number(style.barrelMul) || 1));
        return {
            x: baseX + Math.cos(ang) * barrelEnd,
            y: baseY + Math.sin(ang) * barrelEnd,
            angle: ang
        };
    }

    function drawWeapon(ctx, stance, palette, recoil, state, unit) {
        if (!ctx || !palette) return;
        var cfg = getCfg(stance);
        var pose = getPose(state);
        var style = getWeaponStyle(unit);
        var kickback = (Number(recoil) || 0) * 0.45;
        var tx = cfg.x - kickback + pose.weaponBobX;
        var ty = cfg.y - pose.weaponBobY;
        var ang = cfg.angle + pose.weaponSway * 0.6;
        var bipod = (stance === 'prone');
        var barrelMul = Math.max(0.85, Math.min(1.25, Number(style.barrelMul) || 1));
        var stockMul = Math.max(0.82, Math.min(1.25, Number(style.stockMul) || 1));
        var tone = Math.max(-14, Math.min(14, Number(style.tone) || 0));

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ang);

        // Stock.
        ctx.fillStyle = palette.gunBody;
        ctx.fillRect(-8, -1.3, 8 * stockMul, 3);

        // Receiver.
        ctx.fillStyle = palette.gunDark;
        ctx.fillRect(0, -2.1, 12, 4.2);

        // Barrel + muzzle.
        ctx.fillStyle = '#0d1115';
        ctx.fillRect(12, -1.2, 14 * barrelMul, 2.4);
        ctx.fillRect(12 + (14 * barrelMul), -1.8, 3, 3.6);

        // Scope body and lenses.
        ctx.fillStyle = '#1b2430';
        ctx.fillRect(2, -5.2, 8.6, 3);
        ctx.fillRect(1, -5.8, 2.1, 4.1);
        ctx.fillRect(9.7, -5.8, 2.1, 4.1);
        ctx.fillStyle = '#9ec9ff';
        ctx.fillRect(10.2, -4.8, 1.2, 1.2);

        // Magazine.
        ctx.fillStyle = (tone >= 0) ? '#454f5b' : palette.gunBody;
        ctx.fillRect(6, 2, 2.8, 3.2);

        // Bipod.
        ctx.fillStyle = '#2b333c';
        if (bipod) {
            ctx.beginPath();
            ctx.moveTo(20, 1);
            ctx.lineTo(16.2, 8);
            ctx.lineTo(18.2, 8);
            ctx.lineTo(22, 1);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(20, 1);
            ctx.lineTo(24, 8);
            ctx.lineTo(22, 8);
            ctx.lineTo(18, 1);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillRect(18.2, 1, 5.8, 1.7);
        }

        ctx.restore();
    }

    function getMuzzlePosition(unit, state) {
        if (!unit || !state) return null;
        var local = getMuzzleLocal(state, unit);
        var facing = (state.facing === -1) ? -1 : 1;
        return {
            x: unit.x + (local.x * facing),
            y: unit.y + local.y
        };
    }

    globalScope['UnitRenderV2Weapons_sniper'] = {
        drawWeapon: drawWeapon,
        getMuzzlePosition: getMuzzlePosition,
        getMuzzleLocal: getMuzzleLocal
    };
})(typeof window !== 'undefined' ? window : globalThis);
