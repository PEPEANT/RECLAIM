// Render-related VFX for: aa_tank (SPAAG)
(function attachUnitRenderV2Fx_aa_tank(globalScope) {
    'use strict';

    function drawEngineHeat(ctx, options) {
        if (!ctx) return;
        var alpha = Number(options && options.alpha);
        if (!Number.isFinite(alpha)) alpha = 0.22;
        alpha = Math.max(0, Math.min(0.75, alpha));
        if (alpha <= 0.01) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(95,95,95,0.55)';
        ctx.beginPath();
        ctx.arc(-78, -20, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(130,130,130,0.35)';
        ctx.beginPath();
        ctx.arc(-82, -24, 4.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawAutoMuzzleFlash(ctx, options) {
        if (!ctx) return;
        var x = Number(options && options.x);
        var y = Number(options && options.y);
        var angle = Number(options && options.angle);
        var alpha = Number(options && options.alpha);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (!Number.isFinite(angle)) angle = 0;
        if (!Number.isFinite(alpha)) alpha = 1;
        alpha = Math.max(0, Math.min(1, alpha));
        if (alpha <= 0.01) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalAlpha = alpha;

        ctx.fillStyle = '#6aff3d';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(12, -2.8);
        ctx.lineTo(12, 2.8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fffbe3';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(7, -1.4);
        ctx.lineTo(7, 1.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawSamLaunchFlash(ctx, options) {
        if (!ctx) return;
        var x = Number(options && options.x);
        var y = Number(options && options.y);
        var angle = Number(options && options.angle);
        var alpha = Number(options && options.alpha);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (!Number.isFinite(angle)) angle = 0;
        if (!Number.isFinite(alpha)) alpha = 1;
        alpha = Math.max(0, Math.min(1, alpha));
        if (alpha <= 0.01) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalAlpha = alpha;

        ctx.fillStyle = '#9ad9ff';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, -2.2);
        ctx.lineTo(10, 2.2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(5.5, -1);
        ctx.lineTo(5.5, 1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    globalScope.UnitRenderV2Fx_aa_tank = {
        drawEngineHeat: drawEngineHeat,
        drawAutoMuzzleFlash: drawAutoMuzzleFlash,
        drawSamLaunchFlash: drawSamLaunchFlash
    };
})(typeof window !== 'undefined' ? window : globalThis);
