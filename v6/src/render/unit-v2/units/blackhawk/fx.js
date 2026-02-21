// Render-related VFX (muzzle flash + exhaust haze) for: blackhawk (UH-60)
(function attachUnitRenderV2Fx_blackhawk(globalScope) {
    'use strict';

    function drawFx(unit, ctx, state, palette) {
        if (!ctx || !state) return;

        var p = palette || {};
        var muzzleFlash = Math.max(0, Number(state.muzzleFlash) || 0);
        var mainAngle = Number(state.mainRotorAngle) || 0;
        var speed = Math.max(0, Number(state.speed) || 0);

        // Exhaust haze around engine outlet.
        var hazeAlpha = Math.min(0.26, 0.08 + (speed * 0.03));
        if (hazeAlpha > 0.02) {
            var flicker = 0.75 + (Math.sin(mainAngle * 3.4) * 0.25);
            ctx.save();
            ctx.globalAlpha = hazeAlpha * flicker;
            ctx.fillStyle = 'rgba(180,180,180,0.30)';
            ctx.beginPath();
            ctx.ellipse(-10.2, -5.8, 1.5, 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(120,120,120,0.22)';
            ctx.beginPath();
            ctx.ellipse(-11.4, -6.2, 2.2, 1.0, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Door gun muzzle flash.
        if (muzzleFlash > 0.01) {
            var alpha = Math.min(1, muzzleFlash);
            var mx = 20.5;
            var my = -1.8;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ffcc55';
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(mx + 2.1, my - 0.9);
            ctx.lineTo(mx + 3.6, my);
            ctx.lineTo(mx + 2.1, my + 0.9);
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = alpha * 0.75;
            ctx.fillStyle = '#ff8a00';
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(mx + 1.7, my - 0.55);
            ctx.lineTo(mx + 2.7, my);
            ctx.lineTo(mx + 1.7, my + 0.55);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    globalScope.UnitRenderV2Fx_blackhawk = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
