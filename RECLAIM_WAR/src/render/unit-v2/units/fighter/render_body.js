// Body rendering for: fighter
// 좌표 계약: origin = 기체 중심(unit.x, unit.y), 기수 = +x 방향 (facing=1).
// ctx는 이미 scale(1.4) 적용됨. 추가 스케일 없음.
// 좌표는 HTML 프로토타입 SVG (viewBox 800×400, center≈420,205) 에서 역산:
//   game_x = -(svg_x - 420) / 8   (x 반전: 기수 → +x)
//   game_y =  (svg_y - 205) / 8
(function attachUnitRenderV2Body_fighter(globalScope) {
    'use strict';

    function poly(ctx, pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.closePath();
    }

    function drawBody(unit, ctx, state, palette) {
        if (!ctx || !palette) return;

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';

        // ── 1. 후방 수직 꼬리날개 (더 어두운색, 뒤쪽) ─────────────────
        // SVG: points="545,170 625,65 660,65 685,170"
        ctx.fillStyle = palette.bodyDark;
        poly(ctx, [-16, -4,  -26, -17,  -30, -17,  -33, -4]);
        ctx.fill();

        // ── 2. 전방 수직 꼬리날개 ────────────────────────────────────
        // SVG: points="530,170 610,70 650,70 680,170"
        ctx.fillStyle = palette.bodyLight;
        poly(ctx, [-14, -4,  -24, -17,  -29, -17,  -33, -4]);
        ctx.fill();

        // ── 3. 후방 수평 안정익 (stabilator) ────────────────────────
        // SVG: points="570,220 670,220 700,230 630,230"
        ctx.fillStyle = palette.bodyDark;
        poly(ctx, [-19, 2,  -31, 2,  -35, 3,  -26, 3]);
        ctx.fill();

        // ── 4. 주익 (main wing, swept delta) ────────────────────────
        // SVG: points="360,215 470,215 590,255 410,250"
        ctx.fillStyle = palette.bodyLight;
        poly(ctx, [8, 1,  -6, 1,  -21, 6,  1, 6]);
        ctx.fill();

        // ── 5. 동체 (fuselage, 스텔스 각진 실루엣) ───────────────────
        // SVG body path mapped:
        ctx.fillStyle = palette.body;
        ctx.beginPath();
        ctx.moveTo( 43,  1);   // nose tip
        ctx.lineTo( 35,  0);
        ctx.lineTo( 29, -1);
        ctx.lineTo( 18, -3);
        ctx.lineTo( -4, -4);   // mid-body top
        ctx.lineTo(-29, -3);
        ctx.lineTo(-33, -3);   // tail top
        ctx.lineTo(-33,  3);   // tail bottom
        ctx.lineTo(-25,  3);
        ctx.lineTo( -8,  4);
        ctx.lineTo(  9,  4);   // belly
        ctx.lineTo( 21,  4);
        ctx.lineTo( 35,  3);   // nose belly
        ctx.closePath();
        ctx.fill();

        // ── 6. 패널 라인 하이라이트 ─────────────────────────────────
        ctx.save();
        ctx.globalAlpha  = 0.55;
        ctx.strokeStyle  = palette.highlight;
        ctx.lineWidth    = 0.8;
        // 동체 상부 능선
        ctx.beginPath();
        ctx.moveTo(35, 0);
        ctx.lineTo(-4, -4);
        ctx.stroke();
        // 동체 하부 능선
        ctx.beginPath();
        ctx.moveTo(21, 4);
        ctx.lineTo(-8, 4);
        ctx.stroke();
        ctx.restore();

        // ── 7. 엔진 노즐 ─────────────────────────────────────────────
        // SVG: points="680,185 730,195 730,215 680,225"
        ctx.fillStyle = palette.bodyDark;
        poly(ctx, [-33, -3,  -39, -1,  -39, 1,  -33, 3]);
        ctx.fill();

        // ── 8. 공기 흡입구 (Air Intake) ──────────────────────────────
        // SVG: polygon 250,210 280,200 310,238 270,236 → approx
        ctx.fillStyle = '#111214';
        poly(ctx, [21, 2,  17, 0,  12, 3,  16, 4]);
        ctx.fill();

        // ── 9. 캐노피 ────────────────────────────────────────────────
        // SVG: M 180 196 L 210 170 L 260 165 L 310 183 Z
        ctx.fillStyle   = palette.canopy;
        ctx.globalAlpha = 0.85;
        poly(ctx, [30, -1,  26, -4,  20, -5,  14, -3]);
        ctx.fill();
        ctx.globalAlpha = 1;

        // 캐노피 프레임
        ctx.strokeStyle = palette.bodyDark;
        ctx.lineWidth   = 1.2;
        poly(ctx, [30, -1,  26, -4,  20, -5,  14, -3]);
        ctx.stroke();

        // 캐노피 하이라이트
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#fff9c4';
        ctx.lineWidth   = 0.8;
        ctx.beginPath();
        ctx.moveTo(28, -2);
        ctx.lineTo(22, -4.5);
        ctx.stroke();
        ctx.restore();

        // ── 10. 기수 레이돔 분리선 ───────────────────────────────────
        ctx.strokeStyle = palette.bodyDark;
        ctx.lineWidth   = 0.8;
        ctx.beginPath();
        ctx.moveTo(35, 0);
        ctx.lineTo(35, 3);
        ctx.stroke();

        ctx.restore();
    }

    globalScope['UnitRenderV2Body_fighter'] = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
