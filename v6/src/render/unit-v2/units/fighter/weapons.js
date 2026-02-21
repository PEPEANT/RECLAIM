// Weapon render/muzzle helpers for: fighter
// Local coords: nose at +x, origin = body center, facing applied by index.js.
(function attachUnitRenderV2Weapons_fighter(globalScope) {
    'use strict';

    // Muzzle tip in local coords (before facing scale)
    var MUZZLE_LOCAL = { x: 43, y: 0 };

    function drawMissile(ctx, palette) {
        if (!ctx || !palette) return;
        ctx.save();
        ctx.lineJoin = 'round';

        // 미사일 동체
        ctx.fillStyle = palette.missile;
        ctx.fillRect(-6, 7, 12, 3);

        // 탄두 (앞쪽 삼각형 = +x 방향)
        ctx.fillStyle = palette.missileHead;
        ctx.beginPath();
        ctx.moveTo(6,  8.5);
        ctx.lineTo(3,  7);
        ctx.lineTo(3, 10);
        ctx.closePath();
        ctx.fill();

        // 꼬리 날개
        ctx.fillStyle = '#475569';
        ctx.fillRect(-8,  6, 2, 2);
        ctx.fillRect(-8,  9, 2, 2);

        ctx.restore();
    }

    function getMuzzleLocal(state) {
        return MUZZLE_LOCAL;
    }

    function getMuzzlePosition(unit, state) {
        if (!unit) return null;
        var facing = (state && (state.facing === 1 || state.facing === -1)) ? state.facing : 1;
        return {
            x: (Number(unit.x) || 0) + MUZZLE_LOCAL.x * facing,
            y: (Number(unit.y) || 0) + MUZZLE_LOCAL.y
        };
    }

    globalScope['UnitRenderV2Weapons_fighter'] = {
        drawMissile:      drawMissile,
        getMuzzleLocal:   getMuzzleLocal,
        getMuzzlePosition: getMuzzlePosition
    };
})(typeof window !== 'undefined' ? window : globalThis);
