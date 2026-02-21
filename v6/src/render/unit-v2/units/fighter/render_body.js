// Body rendering for: fighter
// Coordinate contract: origin = unit center, nose at +x (facing=1), +y downward.
// ctx already translated to unit pos with scale(1.4). facing applied once in index.js.
(function attachUnitRenderV2Body_fighter(globalScope) {
    'use strict';

    function poly(ctx, points) {
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (var i = 2; i < points.length; i += 2) {
            ctx.lineTo(points[i], points[i + 1]);
        }
        ctx.closePath();
    }

    function drawBody(unit, ctx, state, palette) {
        if (!ctx || !palette) return;

        var ab = Number(state && state.afterburner) || 0;

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';

        // ── 1. 후방 수직 꼬리날개 (뒤, 어두운색) ────────────────────────
        ctx.fillStyle = palette.bodyDark;
        poly(ctx, [-22, -5,  -17, -22,  -13, -22,  -20, -5]);
        ctx.fill();

        // ── 2. 후방 수평 안정익 (stabilator) ────────────────────────────
        ctx.fillStyle = palette.bodyDark;
        poly(ctx, [-22, 3,  -32, 11,  -20, 11,  -17, 3]);
        ctx.fill();

        // ── 3. 주익 (main wing, swept delta) ────────────────────────────
        ctx.fillStyle = palette.bodyLight;
        poly(ctx, [8, 6,  -20, 22,  -8, 6]);
        ctx.fill();

        // ── 4. 전방 수직 꼬리날개 ────────────────────────────────────────
        ctx.fillStyle = palette.bodyLight;
        poly(ctx, [-15, -6,  -8, -26,  -4, -26,  -12, -6]);
        ctx.fill();

        // ── 5. 동체 (fuselage, stealth angular shape) ────────────────────
        ctx.fillStyle = palette.body;
        ctx.beginPath();
        ctx.moveTo(42,  0);
        ctx.lineTo(28, -5);
        ctx.lineTo(16, -8);
        ctx.lineTo(-12, -6);
        ctx.lineTo(-28, -4);
        ctx.lineTo(-42, -2);
        ctx.lineTo(-42,  2);
        ctx.lineTo(-28,  4);
        ctx.lineTo(-5,   5);
        ctx.lineTo(16,   4);
        ctx.lineTo(35,   2);
        ctx.closePath();
        ctx.fill();

        // ── 6. 패널 하이라이트 선 ────────────────────────────────────────
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = palette.highlight;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(28, -5);
        ctx.lineTo(8,  -5);
        ctx.stroke();
        // 동체 하복선 라인
        ctx.beginPath();
        ctx.moveTo(35, 2);
        ctx.lineTo(-5, 5);
        ctx.stroke();
        ctx.restore();

        // ── 7. 추진 노즐 (후방) ─────────────────────────────────────────
        ctx.fillStyle = palette.bodyDark;
        poly(ctx, [-42, -3,  -46, -1,  -46, 1,  -42, 3]);
        ctx.fill();

        // ── 8. 공기 흡입구 (Air Intake) ────────────────────────────────
        ctx.fillStyle = '#111214';
        poly(ctx, [8, 3,  3, 6,  10, 8,  14, 5]);
        ctx.fill();

        // ── 9. 캐노피 (gold-tinted canopy) ──────────────────────────────
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = palette.canopy;
        ctx.beginPath();
        ctx.moveTo(18, -8);
        ctx.quadraticCurveTo(24, -16, 30, -15);
        ctx.quadraticCurveTo(36, -14, 36, -8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 캐노피 프레임
        ctx.strokeStyle = palette.bodyDark;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(18, -8);
        ctx.quadraticCurveTo(24, -16, 30, -15);
        ctx.quadraticCurveTo(36, -14, 36, -8);
        ctx.closePath();
        ctx.stroke();

        // 캐노피 하이라이트
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(20, -10);
        ctx.quadraticCurveTo(27, -16, 33, -13);
        ctx.stroke();
        ctx.restore();

        // ── 10. 기수 레이돔 분리선 ──────────────────────────────────────
        ctx.strokeStyle = palette.bodyDark;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(28, -5);
        ctx.lineTo(28,  2);
        ctx.stroke();

        // ── 11. 저시인성 국적 마크 (optional subtle marking) ─────────────
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle   = '#000';
        ctx.beginPath();
        ctx.arc(0, 1, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-7, -0.5, 3, 3);
        ctx.fillRect(4, -0.5, 3, 3);
        ctx.restore();

        ctx.restore();
    }

    globalScope['UnitRenderV2Body_fighter'] = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
