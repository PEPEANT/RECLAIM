// Render-related VFX for: fighter
// - Afterburner flame at tail (x=-42 in local coords, facing already applied)
// - Muzzle flash at nose (x=43)
(function attachUnitRenderV2Fx_fighter(globalScope) {
    'use strict';

    function drawFx(unit, ctx, state) {
        if (!ctx || !state) return;

        var ab    = Number(state.afterburner)  || 0;
        var flash = Number(state.muzzleFlash)  || 0;

        // ── 애프터버너 불꽃 ──────────────────────────────────────────────
        if (ab > 0.01) {
            var abPhase = Number(state.afterburnerPhase) || 0;
            var len = (20 + Math.sin(abPhase) * 5) * ab;

            ctx.save();

            // 외부: 오렌지/레드
            ctx.globalAlpha = ab * 0.75;
            ctx.fillStyle   = '#ff4500';
            ctx.beginPath();
            ctx.moveTo(-42, -3);
            ctx.lineTo(-42 - len * 0.9,  0);
            ctx.lineTo(-42,  3);
            ctx.closePath();
            ctx.fill();

            // 중간: 푸른 코어
            ctx.globalAlpha = ab * 0.9;
            ctx.fillStyle   = '#00a8ff';
            ctx.beginPath();
            ctx.moveTo(-42, -2);
            ctx.lineTo(-42 - len * 0.6,  0);
            ctx.lineTo(-42,  2);
            ctx.closePath();
            ctx.fill();

            // 내부: 흰색 코어
            ctx.globalAlpha = ab;
            ctx.fillStyle   = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(-42, -1);
            ctx.lineTo(-42 - len * 0.3,  0);
            ctx.lineTo(-42,  1);
            ctx.closePath();
            ctx.fill();

            // 노즐 주변 열 글로우
            ctx.globalAlpha = ab * 0.3;
            ctx.fillStyle   = '#ffaa00';
            ctx.beginPath();
            ctx.ellipse(-42, 0, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // ── 미사일 발사 섬광 (기수) ──────────────────────────────────────
        if (flash > 0) {
            var alpha  = (flash / 4) * 0.85;
            var radius = 3 + flash * 0.5;

            ctx.save();

            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle   = '#f97316';
            ctx.beginPath();
            ctx.arc(43, 0, radius * 1.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = alpha;
            ctx.fillStyle   = '#fef08a';
            ctx.beginPath();
            ctx.arc(43, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    globalScope['UnitRenderV2Fx_fighter'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
