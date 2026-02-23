// Render-related VFX for: chinook
(function attachUnitRenderV2Fx_chinook(globalScope) {
    'use strict';

    var SCALE = 0.128;

    function sx(x) {
        return (x - 410) * SCALE;
    }

    function sy(y) {
        return (y - 220) * SCALE;
    }

    function drawEngineHaze(ctx, x, y, phase, alpha) {
        if (!ctx) return;
        var flicker = 0.75 + (Math.sin(phase) * 0.25);
        ctx.save();
        ctx.globalAlpha = alpha * flicker;
        ctx.fillStyle = 'rgba(180,180,180,0.32)';
        ctx.beginPath();
        ctx.ellipse(x, y, 2.4 * SCALE / 0.128, 1.1 * SCALE / 0.128, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(120,120,120,0.22)';
        ctx.beginPath();
        ctx.ellipse(x - (7 * SCALE), y, 3.8 * SCALE / 0.128, 1.5 * SCALE / 0.128, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawFx(unit, ctx, state, palette, options) {
        if (!ctx || !state) return;
        var iconMode = !!(options && options.iconMode === true);
        if (iconMode) return;

        var speed = Math.max(0, Number(state.speed) || 0);
        var alpha = Math.min(0.24, 0.08 + (speed * 0.03));
        if (alpha < 0.03) return;

        var phase = Number(state.frontRotorAngle) || 0;
        drawEngineHaze(ctx, sx(674), sy(200), phase * 3.6, alpha);
    }

    globalScope.UnitRenderV2Fx_chinook = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
