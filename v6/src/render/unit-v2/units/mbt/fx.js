// Render-related VFX (smoke, muzzle flash, etc) for: mbt
(function attachUnitRenderV2Fx_mbt(globalScope) {
    'use strict';

    function drawEngineHeat(ctx, options) {
        if (!ctx) return;
        var opts = options || {};
        var alpha = Number(opts.alpha);
        var a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0.24;

        ctx.save();
        ctx.globalAlpha = a;
        var grad = ctx.createRadialGradient(-86, -15, 2, -96, -16, 14);
        grad.addColorStop(0, 'rgba(210, 210, 210, 0.42)');
        grad.addColorStop(1, 'rgba(210, 210, 210, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(-96, -16, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawMainMuzzleFlash(ctx, options) {
        if (!ctx) return;
        var opts = options || {};
        var x = Number(opts.x);
        var y = Number(opts.y);
        var angle = Number(opts.angle);
        var alpha = Number(opts.alpha);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(angle)) return;
        var a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalAlpha = a;

        var glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
        glow.addColorStop(0, 'rgba(255,245,210,0.95)');
        glow.addColorStop(0.55, 'rgba(255,176,32,0.72)');
        glow.addColorStop(1, 'rgba(255,120,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(-2, -15);
        ctx.lineTo(56, 0);
        ctx.lineTo(-2, 15);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffecb3';
        ctx.beginPath();
        ctx.moveTo(-2, -9);
        ctx.lineTo(32, 0);
        ctx.lineTo(-2, 9);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    globalScope.UnitRenderV2Fx_mbt = {
        drawEngineHeat: drawEngineHeat,
        drawMainMuzzleFlash: drawMainMuzzleFlash
    };
})(typeof window !== 'undefined' ? window : globalThis);
