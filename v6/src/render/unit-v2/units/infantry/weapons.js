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

    function clampByte(v) {
        return Math.max(0, Math.min(255, Math.round(v)));
    }

    function tintHex(hex, delta) {
        var src = String(hex || '').trim();
        var m = /^#([0-9a-fA-F]{6})$/.exec(src);
        if (!m) return src || '#111111';
        var code = m[1];
        var r = clampByte(parseInt(code.slice(0, 2), 16) + delta);
        var g = clampByte(parseInt(code.slice(2, 4), 16) + delta);
        var b = clampByte(parseInt(code.slice(4, 6), 16) + delta);
        var toHex = function (n) { return n.toString(16).padStart(2, '0'); };
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    function getWeaponStyle(unit) {
        if (!unit || typeof unit !== 'object') {
            return { barrelMul: 1, bodyMul: 1, stockMul: 1, tone: 0, magMul: 1 };
        }
        if (!unit._infantryWeaponStyle || typeof unit._infantryWeaponStyle !== 'object') {
            unit._infantryWeaponStyle = {
                barrelMul: 0.90 + (Math.random() * 0.26),
                bodyMul: 0.92 + (Math.random() * 0.20),
                stockMul: 0.85 + (Math.random() * 0.24),
                magMul: 0.84 + (Math.random() * 0.30),
                tone: Math.round((Math.random() * 20) - 10)
            };
        }
        return unit._infantryWeaponStyle;
    }

    function getMuzzleLocal(state, unit) {
        var pose = getPose(state);
        var cfg = getCfg(pose.stance);
        var style = getWeaponStyle(unit);
        var kickback = pose.recoil * 0.4;
        var baseX = cfg.x - kickback + pose.weaponBobX;
        var baseY = cfg.y - pose.weaponBobY;
        var ang = cfg.angle + pose.weaponSway;
        var barrelEnd = cfg.barrelEnd * Math.max(0.75, Math.min(1.35, Number(style.barrelMul) || 1));

        return {
            x: baseX + Math.cos(ang) * barrelEnd,
            y: baseY + Math.sin(ang) * barrelEnd,
            angle: ang
        };
    }

    function drawRifle(ctx, stance, palette, recoil, state, unit) {
        if (!ctx || !palette) return;

        var cfg = getCfg(stance);
        var pose = getPose(state);
        var style = getWeaponStyle(unit);
        var kickback = (Number(recoil) || 0) * 0.4;
        var tx = cfg.x - kickback + pose.weaponBobX;
        var ty = cfg.y - pose.weaponBobY;
        var ang = cfg.angle + pose.weaponSway;
        var stockLen = 6 * Math.max(0.75, Math.min(1.4, Number(style.stockMul) || 1));
        var bodyLen = 10 * Math.max(0.75, Math.min(1.35, Number(style.bodyMul) || 1));
        var barrelLen = 8 * Math.max(0.75, Math.min(1.5, Number(style.barrelMul) || 1));
        var magLen = 5 * Math.max(0.72, Math.min(1.5, Number(style.magMul) || 1));
        var tone = Math.max(-20, Math.min(20, Number(style.tone) || 0));
        var gunWood = tintHex(palette.gunWood, Math.round(tone * 0.5));
        var gunMain = tintHex(palette.gun, tone);

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ang);

        ctx.fillStyle = gunWood;
        ctx.fillRect(-5, -1.5, stockLen, 3);

        ctx.fillStyle = gunMain;
        ctx.fillRect(0, -2, bodyLen, 4);

        ctx.fillStyle = '#111';
        ctx.fillRect(bodyLen, -1, barrelLen, 2);

        ctx.fillStyle = '#222';
        ctx.fillRect(3, 2, 3, magLen);

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

    globalScope['UnitRenderV2Weapons_infantry'] = {
        drawRifle: drawRifle,
        getMuzzlePosition: getMuzzlePosition,
        getMuzzleLocal: getMuzzleLocal
    };
})(typeof window !== 'undefined' ? window : globalThis);
