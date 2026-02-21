// Render-related VFX (exhaust / muzzle glow) for: humvee
(function attachUnitRenderV2Fx_humvee(globalScope) {
    'use strict';

    function drawExhaust(ctx, state, options) {
        if (!ctx) return;
        var opts = options || {};
        var alphaMul = Number(opts.alphaMul);
        if (!Number.isFinite(alphaMul)) alphaMul = 1;

        var alpha = Math.max(0, Math.min(1, (Number(state && state.exhaustAlpha) || 0) * alphaMul));
        if (alpha <= 0.01) return;

        ctx.save();
        ctx.globalAlpha = alpha;

        var grad = ctx.createRadialGradient(27, -38, 1, 27, -38, 10);
        grad.addColorStop(0, 'rgba(80,80,80,0.45)');
        grad.addColorStop(1, 'rgba(80,80,80,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(27, -38, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    globalScope.UnitRenderV2Fx_humvee = {
        drawExhaust: drawExhaust
    };
})(typeof window !== 'undefined' ? window : globalThis);
