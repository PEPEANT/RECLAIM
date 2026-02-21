// Render-related VFX (exhaust) for: apc
(function attachUnitRenderV2Fx_apc(globalScope) {
    'use strict';

    function drawExhaust(ctx, state, options) {
        if (!ctx) return;
        var alpha = Number(state && state.exhaustAlpha) || 0;
        var mul = Number(options && options.alphaMul);
        if (!Number.isFinite(mul)) mul = 1;
        var finalAlpha = Math.max(0, Math.min(0.7, alpha * mul));
        if (finalAlpha <= 0.01) return;

        ctx.save();
        ctx.globalAlpha = finalAlpha;
        ctx.fillStyle = 'rgba(95,95,95,0.55)';
        ctx.beginPath();
        ctx.arc(-84, -18, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(130,130,130,0.35)';
        ctx.beginPath();
        ctx.arc(-88, -22, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    globalScope.UnitRenderV2Fx_apc = {
        drawExhaust: drawExhaust
    };
})(typeof window !== 'undefined' ? window : globalThis);
