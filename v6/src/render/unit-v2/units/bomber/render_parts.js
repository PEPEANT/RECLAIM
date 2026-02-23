// Additional part rendering for: bomber
(function attachUnitRenderV2Parts_bomber(globalScope) {
    'use strict';

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function clamp(v, min, max) {
        if (!Number.isFinite(v)) return min;
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    function drawWing(ctx, palette, sweep, isBack) {
        if (!ctx || !palette) return;

        var tipX = isBack ? lerp(-20, -58, sweep) : lerp(-14, -54, sweep);
        var tipY = isBack ? lerp(-34, -10, sweep) : lerp(30, 10, sweep);
        var rootFrontX = 8;
        var rootFrontY = isBack ? -2.1 : 2.1;
        var rootBackX = -7;
        var rootBackY = isBack ? -5.3 : 5.3;

        ctx.save();
        ctx.globalAlpha = isBack ? 0.72 : 0.95;
        ctx.fillStyle = isBack ? palette.wingBack : palette.wingFront;
        ctx.beginPath();
        ctx.moveTo(rootFrontX, rootFrontY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(rootBackX, rootBackY);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = isBack ? 0.28 : 0.36;
        ctx.strokeStyle = palette.wingEdge;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(rootFrontX, rootFrontY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(rootBackX, rootBackY);
        ctx.stroke();

        ctx.globalAlpha = isBack ? 0.14 : 0.18;
        ctx.strokeStyle = palette.highlight;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(rootFrontX - 2, isBack ? -3.2 : 3.2);
        ctx.lineTo(tipX * 0.72, tipY * 0.72);
        ctx.stroke();
        ctx.restore();
    }

    function drawLandingGear(ctx, palette, gearDown, iconMode) {
        if (!ctx || !palette || iconMode) return;
        if (gearDown <= 0.02) return;

        var g = clamp(gearDown, 0, 1);
        var retract = 1 - g;

        ctx.save();
        ctx.globalAlpha = 0.12 + (g * 0.88);
        ctx.translate(0, -(retract * 16));
        ctx.scale(1, 0.74 + (g * 0.26));

        ctx.strokeStyle = palette.gear;
        ctx.fillStyle = palette.tire;
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';

        // Nose gear.
        ctx.beginPath();
        ctx.moveTo(40, 8);
        ctx.lineTo(40, 18);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(40, 12);
        ctx.lineTo(36, 16);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(40, 20, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.gear;
        ctx.beginPath();
        ctx.arc(40, 20, 1.05, 0, Math.PI * 2);
        ctx.fill();

        // Main gear bogie.
        ctx.strokeStyle = palette.gear;
        ctx.fillStyle = palette.tire;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-18, 11);
        ctx.lineTo(-18, 22);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-24, 22);
        ctx.lineTo(-12, 22);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-22, 22, 3.3, 0, Math.PI * 2);
        ctx.arc(-14, 22, 3.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.gear;
        ctx.beginPath();
        ctx.arc(-22, 22, 1.15, 0, Math.PI * 2);
        ctx.arc(-14, 22, 1.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawParts(unit, ctx, state, palette, options) {
        if (!ctx || !state || !palette) return;
        var opts = options || {};
        var iconMode = !!(opts.iconMode === true);
        var sweep = clamp(Number(state.wingSweep), 0, 1);
        var gearDown = clamp(Number(state.gearDown), 0, 1);

        drawWing(ctx, palette, sweep, true);
        drawLandingGear(ctx, palette, gearDown, iconMode);
        drawWing(ctx, palette, sweep, false);
    }

    globalScope['UnitRenderV2Parts_bomber'] = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
