// Render-related VFX for: fighter
// 애프터버너: 노즐 (x=-39) 에서 -x 방향으로 불꽃 분사 (facing 이미 적용된 ctx 기준)
// 미사일 섬광: 기수 (x=43) 에서 flash
(function attachUnitRenderV2Fx_fighter(globalScope) {
    'use strict';

    var NOZZLE_X  = -39;  // 엔진 노즐 위치 (render_body 노즐 polygon 기준)
    var MUZZLE_X  =  43;  // 기수 끝 위치

    function drawFx(unit, ctx, state) {
        if (!ctx || !state) return;

        var ab    = Number(state.afterburner)  || 0;
        var flash = Number(state.muzzleFlash)  || 0;

        // ── 애프터버너 불꽃 (노즐 뒤쪽) ─────────────────────────────
        if (ab > 0.01) {
            var abPhase = Number(state.afterburnerPhase) || 0;
            var len = (18 + Math.sin(abPhase) * 4) * ab;

            ctx.save();

            // 외부: 오렌지/레드
            ctx.globalAlpha = ab * 0.72;
            ctx.fillStyle   = '#ff4500';
            ctx.beginPath();
            ctx.moveTo(NOZZLE_X, -2);
            ctx.lineTo(NOZZLE_X - len * 0.9, 0);
            ctx.lineTo(NOZZLE_X,  2);
            ctx.closePath();
            ctx.fill();

            // 중간: 푸른 코어
            ctx.globalAlpha = ab * 0.88;
            ctx.fillStyle   = '#00a8ff';
            ctx.beginPath();
            ctx.moveTo(NOZZLE_X, -1.2);
            ctx.lineTo(NOZZLE_X - len * 0.58, 0);
            ctx.lineTo(NOZZLE_X,  1.2);
            ctx.closePath();
            ctx.fill();

            // 내부: 흰색 코어
            ctx.globalAlpha = ab;
            ctx.fillStyle   = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(NOZZLE_X, -0.6);
            ctx.lineTo(NOZZLE_X - len * 0.28, 0);
            ctx.lineTo(NOZZLE_X,  0.6);
            ctx.closePath();
            ctx.fill();

            // 노즐 주변 열 글로우
            ctx.globalAlpha = ab * 0.25;
            ctx.fillStyle   = '#ffaa00';
            ctx.beginPath();
            ctx.ellipse(NOZZLE_X, 0, 6, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // ── 미사일 발사 섬광 (기수) ──────────────────────────────────
        if (flash > 0) {
            var alpha  = (flash / 4) * 0.85;
            var radius = 2.5 + flash * 0.4;

            ctx.save();

            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle   = '#f97316';
            ctx.beginPath();
            ctx.arc(MUZZLE_X, 0, radius * 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = alpha;
            ctx.fillStyle   = '#fef08a';
            ctx.beginPath();
            ctx.arc(MUZZLE_X, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    globalScope['UnitRenderV2Fx_fighter'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
