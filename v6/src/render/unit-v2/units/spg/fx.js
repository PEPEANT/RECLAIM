// Render-related VFX (smoke, muzzle flash, etc) for: spg
(function attachUnitRenderV2Fx_spg(globalScope) {
    'use strict';

    function drawEngineHeat(ctx, options) {
        if (!ctx) return;
        var opts = options || {};
        var alpha = Number(opts.alpha);
        var a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0.2;

        ctx.save();
        ctx.globalAlpha = a;
        var grad = ctx.createRadialGradient(-76, -8, 2, -86, -8, 14);
        grad.addColorStop(0, 'rgba(190,190,190,0.38)');
        grad.addColorStop(1, 'rgba(190,190,190,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(-86, -8, 16, 8, 0, 0, Math.PI * 2);
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
        glow.addColorStop(0, 'rgba(255,240,205,0.95)');
        glow.addColorStop(0.5, 'rgba(255,136,0,0.75)');
        glow.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff7a00';
        ctx.beginPath();
        ctx.moveTo(-2, -14);
        ctx.lineTo(58, 0);
        ctx.lineTo(-2, 14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffd27a';
        ctx.beginPath();
        ctx.moveTo(-2, -8);
        ctx.lineTo(34, 0);
        ctx.lineTo(-2, 8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    globalScope.UnitRenderV2Fx_spg = {
        drawEngineHeat: drawEngineHeat,
        drawMainMuzzleFlash: drawMainMuzzleFlash
    };
})(typeof window !== 'undefined' ? window : globalThis);

