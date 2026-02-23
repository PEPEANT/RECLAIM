// Render-related VFX for: bomber
(function attachUnitRenderV2Fx_bomber(globalScope) {
    'use strict';

    function drawAfterburner(ctx, state, iconMode) {
        if (!ctx || !state) return;
        var afterburner = Number(state.afterburner) || 0;
        if (afterburner < 0.03) return;

        var phase = Number(state.flamePhase) || 0;
        var flicker = 0.92 + (Math.sin(phase * 3.2) * 0.1) + (Math.cos(phase * 5.1) * 0.08);
        var pulse = 0.9 + (Math.sin(phase * 2.3) * 0.08);
        var length = (16 + (afterburner * 28)) * flicker;
        var spread = (3.2 + (afterburner * 3.6)) * pulse;
        var nozzleX = -78;
        var nozzleY = 0;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, (0.28 + (afterburner * 0.38)) * (iconMode ? 0.8 : 1));

        var outerGrad = ctx.createLinearGradient(nozzleX, nozzleY, nozzleX - length, nozzleY);
        outerGrad.addColorStop(0, 'rgba(167,224,255,0.88)');
        outerGrad.addColorStop(0.22, 'rgba(96,183,255,0.84)');
        outerGrad.addColorStop(0.58, 'rgba(255,118,34,0.72)');
        outerGrad.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.moveTo(nozzleX, nozzleY - spread);
        ctx.lineTo(nozzleX - length, nozzleY);
        ctx.lineTo(nozzleX, nozzleY + spread);
        ctx.closePath();
        ctx.fill();

        var coreLen = length * 0.52;
        var coreSpread = spread * 0.36;
        var coreGrad = ctx.createLinearGradient(nozzleX, nozzleY, nozzleX - coreLen, nozzleY);
        coreGrad.addColorStop(0, 'rgba(222,244,255,0.78)');
        coreGrad.addColorStop(0.45, 'rgba(181,227,255,0.7)');
        coreGrad.addColorStop(1, 'rgba(170,226,255,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.moveTo(nozzleX, nozzleY - coreSpread);
        ctx.lineTo(nozzleX - coreLen, nozzleY);
        ctx.lineTo(nozzleX, nozzleY + coreSpread);
        ctx.closePath();
        ctx.fill();

        if (!iconMode) {
            var diamonds = 2;
            var baseSeg = length / (diamonds + 1);
            for (var i = 0; i < diamonds; i++) {
                var cx = nozzleX - (baseSeg * (i + 0.95));
                var w = (4.4 - (i * 0.95)) * afterburner;
                var h = (0.95 - (i * 0.16)) * afterburner;
                if (w <= 0.2 || h <= 0.1) continue;
                ctx.globalAlpha = (0.22 - (i * 0.06)) * afterburner;
                ctx.fillStyle = '#def2ff';
                ctx.beginPath();
                ctx.moveTo(cx - w, nozzleY);
                ctx.lineTo(cx, nozzleY - h);
                ctx.lineTo(cx + w, nozzleY);
                ctx.lineTo(cx, nozzleY + h);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.restore();
    }

    function drawBombPulse(ctx, state, iconMode) {
        if (!ctx || !state || iconMode) return;
        var pulse = Number(state.bombPulse) || 0;
        if (pulse <= 0.02) return;

        var radius = 6 + (pulse * 8);
        ctx.save();
        ctx.globalAlpha = Math.min(0.45, pulse * 0.45);
        ctx.fillStyle = '#ffd78a';
        ctx.beginPath();
        ctx.arc(-3, 13.5, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawFx(unit, ctx, state, palette, options) {
        if (!ctx || !state) return;
        var iconMode = !!(options && options.iconMode === true);
        drawAfterburner(ctx, state, iconMode);
        drawBombPulse(ctx, state, iconMode);
    }

    globalScope['UnitRenderV2Fx_bomber'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
