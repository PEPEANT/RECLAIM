// Render-related VFX for: apache
// 로켓 발사 섬광: 스터브 윙 파일런 위치 (facing 이미 적용된 ctx 기준)
(function attachUnitRenderV2Fx_apache(globalScope) {
    'use strict';

    // 로켓 발사 위치 (로컬, 오른쪽 파일런 끝)
    var MUZZLE_X = 38;
    var MUZZLE_Y = 27;

    function drawFx(unit, ctx, state) {
        if (!ctx || !state) return;

        var flash = Number(state.muzzleFlash) || 0;
        if (flash <= 0) return;

        var alpha  = (flash / 5) * 0.9;
        var radius = 3 + flash * 0.6;

        ctx.save();

        // 외부 오렌지 글로우
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle   = '#f97316';
        ctx.beginPath();
        ctx.arc(MUZZLE_X, MUZZLE_Y, radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // 내부 밝은 황색
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#fef08a';
        ctx.beginPath();
        ctx.arc(MUZZLE_X, MUZZLE_Y, radius, 0, Math.PI * 2);
        ctx.fill();

        // 스파크 (좌상 방향으로 4개)
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle   = '#ffffff';
        for (var i = 0; i < 4; i++) {
            var angle  = (i / 4) * Math.PI * 2;
            var spread = radius * 1.4;
            ctx.beginPath();
            ctx.arc(
                MUZZLE_X + Math.cos(angle) * spread,
                MUZZLE_Y + Math.sin(angle) * spread,
                1.2, 0, Math.PI * 2
            );
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    globalScope['UnitRenderV2Fx_apache'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
