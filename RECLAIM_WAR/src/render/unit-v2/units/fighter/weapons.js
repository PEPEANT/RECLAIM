// Weapon render/muzzle helpers for: fighter
// 로컬 좌표: 기수 = +x, origin = 기체 중심.
// getMuzzlePosition: 게임 엔진 발사체 스폰용 월드 좌표 반환.
(function attachUnitRenderV2Weapons_fighter(globalScope) {
    'use strict';

    // 기수 끝 (로컬, 발사체 스폰 기준)
    var MUZZLE_LOCAL = { x: 43, y: 0 };

    // 미사일 장착 위치: 주익 아래 (로컬)
    var MISSILE_Y = 4;   // 동체 하부 기준선

    function drawMissile(ctx, palette) {
        if (!ctx || !palette) return;
        ctx.save();
        ctx.lineJoin = 'round';

        // 미사일 동체: 주익 중간 아래쪽 (-8 ~ 4, y = MISSILE_Y+1)
        ctx.fillStyle = palette.missile;
        ctx.fillRect(-8, MISSILE_Y + 1, 12, 2.5);

        // 탄두 (앞쪽, +x 방향)
        ctx.fillStyle = palette.missileHead;
        ctx.beginPath();
        ctx.moveTo(4,  MISSILE_Y + 2.25);
        ctx.lineTo(1,  MISSILE_Y + 1);
        ctx.lineTo(1,  MISSILE_Y + 3.5);
        ctx.closePath();
        ctx.fill();

        // 꼬리 날개
        ctx.fillStyle = '#475569';
        ctx.fillRect(-9, MISSILE_Y,     1.5, 1.5);
        ctx.fillRect(-9, MISSILE_Y + 3, 1.5, 1.5);

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
        drawMissile:       drawMissile,
        getMuzzleLocal:    getMuzzleLocal,
        getMuzzlePosition: getMuzzlePosition
    };
})(typeof window !== 'undefined' ? window : globalThis);
