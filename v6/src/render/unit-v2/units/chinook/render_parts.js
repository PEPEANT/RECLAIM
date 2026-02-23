// Additional part rendering (dual rotors) for: chinook
(function attachUnitRenderV2Parts_chinook(globalScope) {
    'use strict';

    var SCALE = 0.128;

    function sx(x) {
        return (x - 410) * SCALE;
    }

    function sy(y) {
        return (y - 220) * SCALE;
    }

    function clamp(v, min, max) {
        if (!Number.isFinite(v)) return min;
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    function drawRotorStrip(ctx, cx, cy, rotorAngle, palette, alphaBack, alphaFront) {
        if (!ctx || !palette) return;
        var rotorColor = palette.rotor;
        var half = 240 * SCALE;
        var h = 4 * SCALE;

        // Back depth strip.
        ctx.save();
        ctx.translate(cx, cy);
        var flipBack = clamp(Math.abs(Math.cos(rotorAngle)), 0.12, 1);
        ctx.scale(flipBack, 1);
        ctx.globalAlpha = alphaBack;
        ctx.fillStyle = rotorColor;
        ctx.fillRect(-half, -h * 0.5, half * 2, h);
        ctx.restore();

        // Front strip.
        ctx.save();
        ctx.translate(cx, cy + (2 * SCALE));
        var flipFront = clamp(Math.abs(Math.cos(rotorAngle + 0.8)), 0.12, 1);
        ctx.scale(flipFront, 1);
        ctx.globalAlpha = alphaFront;
        ctx.fillStyle = rotorColor;
        ctx.fillRect(-half, -h * 0.5, half * 2, h);

        ctx.restore();
    }

    function drawParts(unit, ctx, state, palette, options) {
        if (!ctx || !state || !palette) return;
        var iconMode = !!(options && options.iconMode === true);

        var frontAngle = Number(state.frontRotorAngle) || 0;
        var rearAngle = Number(state.rearRotorAngle) || 0;

        var backAlpha = iconMode ? 0.28 : 0.44;
        var frontAlpha = iconMode ? 0.52 : 0.86;

        drawRotorStrip(ctx, sx(220), sy(145), frontAngle, palette, backAlpha, frontAlpha);
        drawRotorStrip(ctx, sx(620), sy(85), rearAngle, palette, backAlpha, frontAlpha);
    }

    globalScope.UnitRenderV2Parts_chinook = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
