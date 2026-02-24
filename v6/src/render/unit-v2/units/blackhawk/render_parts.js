// Additional part rendering (rotors) for: blackhawk (UH-60)
(function attachUnitRenderV2Parts_blackhawk(globalScope) {
    'use strict';

    var TAU = Math.PI * 2;
    var SCALE = 0.145;

    function sx(x) {
        return (x - 340) * SCALE;
    }

    function sy(y) {
        return (y - 235) * SCALE;
    }

    function drawParts(unit, ctx, state, palette) {
        if (!ctx) return;

        var p = palette || {};
        var rotor = p.rotor || '#1a1a1a';
        var gear = p.gear || '#3a3d40';
        var light = p.light || '#484c52';

        var mainAngle = Number(state && state.mainRotorAngle) || 0;

        var mainCx = sx(340);
        var mainCyRear = sy(134);
        var mainCyFront = sy(132);
        var halfBlade = 300 * SCALE;
        var bladeW = 4.0 * SCALE;

        // Main rotor: keep visible blade strip, but remove circular spin impression.
        ctx.save();
        ctx.translate(mainCx, mainCyRear);
        ctx.rotate(Math.sin(mainAngle * 0.2) * 0.06);
        ctx.globalAlpha = 0.44;
        ctx.fillStyle = rotor;
        ctx.fillRect(-halfBlade, -bladeW * 0.55, halfBlade * 2, bladeW * 1.1);
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = light;
        ctx.fillRect(-halfBlade * 0.84, -bladeW * 0.22, halfBlade * 1.68, bladeW * 0.44);
        ctx.restore();

        // Front overlay strip: same heading only (no 90deg cross to avoid disc-like look).
        ctx.save();
        ctx.translate(mainCx, mainCyFront);
        ctx.rotate(Math.sin(mainAngle * 0.2) * 0.06);
        ctx.globalAlpha = 0.20;
        ctx.fillStyle = rotor;
        ctx.fillRect(-halfBlade * 0.90, -bladeW * 0.40, halfBlade * 1.80, bladeW * 0.80);
        ctx.restore();

        // Tail rotor center reference
        var tx = sx(705);
        var ty = sy(145);

        // Tail rotor blades: visible shape without circular spinning.
        ctx.save();
        ctx.translate(tx, ty);
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = rotor;
        // Vertical blade
        ctx.fillRect(-(4 * SCALE) / 2, -(76 * SCALE) / 2, 4 * SCALE, 76 * SCALE);
        // Short cross-blade (to keep rotor visible)
        ctx.fillRect(-(28 * SCALE) / 2, -(4 * SCALE) / 2, 28 * SCALE, 4 * SCALE);
        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    globalScope.UnitRenderV2Parts_blackhawk = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
