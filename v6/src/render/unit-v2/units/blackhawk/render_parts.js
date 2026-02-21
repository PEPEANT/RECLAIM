// Additional part rendering (rotor/gear hub) for: blackhawk (UH-60)
(function attachUnitRenderV2Parts_blackhawk(globalScope) {
    'use strict';

    function drawParts(unit, ctx, state, palette) {
        if (!ctx) return;
        var TAU = Math.PI * 2;

        var p = palette || {};
        var rotor = p.rotor || '#1a1a1a';
        var gear = p.gear || '#3a3d40';
        var light = p.light || '#484c52';

        var mainAngle = Number(state && state.mainRotorAngle) || 0;
        var tailAngle = Number(state && state.tailRotorAngle) || 0;
        var mainPulse = 0.86 + (Math.abs(Math.sin(mainAngle)) * 0.24);
        var mainPulseFront = 0.78 + (Math.abs(Math.cos(mainAngle)) * 0.32);

        // Main rotor: filled blur disk + strip (not thin line-only)
        ctx.save();
        ctx.translate(0, -12.85);
        ctx.scale(mainPulse, 1);
        ctx.globalAlpha = 0.44;
        ctx.fillStyle = rotor;
        ctx.beginPath();
        ctx.ellipse(0, 0, 45.5, 2.2, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.58;
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.ellipse(0, 0, 41.0, 1.45, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.70;
        ctx.fillStyle = rotor;
        ctx.fillRect(-43.2, -0.80, 86.4, 1.60);
        ctx.restore();

        // Main rotor mast + hub
        ctx.fillStyle = gear;
        ctx.fillRect(-0.88, -11.8, 1.76, 4.4);
        ctx.fillStyle = p.dark || '#1c1e20';
        ctx.beginPath();
        ctx.moveTo(-2.5, -12.9);
        ctx.lineTo(2.5, -12.9);
        ctx.lineTo(1.8, -11.7);
        ctx.lineTo(-1.8, -11.7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = light;
        ctx.fillRect(-1.7, -11.6, 3.4, 0.7);
        ctx.fillStyle = gear;
        ctx.beginPath();
        ctx.arc(0, -13.1, 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Main rotor (front sharp strip)
        ctx.save();
        ctx.translate(0, -13.15);
        ctx.scale(mainPulseFront, 1);
        ctx.globalAlpha = 0.96;
        ctx.fillStyle = rotor;
        ctx.fillRect(-43.5, -0.75, 87.0, 1.50);
        ctx.globalAlpha = 0.70;
        ctx.fillStyle = light;
        ctx.fillRect(-39.0, -0.48, 78.0, 0.96);
        ctx.fillStyle = '#0f0f11';
        ctx.beginPath();
        ctx.arc(0, 0, 0.85, 0, TAU);
        ctx.fill();
        ctx.restore();

        // Tail rotor hub
        var tx = -50.3;
        var ty = -10.4;
        ctx.fillStyle = gear;
        ctx.beginPath();
        ctx.arc(tx, ty, 1.15, 0, Math.PI * 2);
        ctx.fill();

        // Tail rotor blur ring
        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = rotor;
        ctx.beginPath();
        ctx.arc(tx, ty, 4.25, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.26;
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.arc(tx, ty, 3.4, 0, TAU);
        ctx.fill();
        ctx.restore();

        // Tail rotor blades
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(tailAngle);
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = rotor;
        ctx.fillRect(-0.62, -5.9, 1.24, 11.8);
        ctx.fillRect(-5.9, -0.62, 11.8, 1.24);
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(0, 0, 0.64, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    globalScope.UnitRenderV2Parts_blackhawk = {
        drawParts: drawParts
    };
})(typeof window !== 'undefined' ? window : globalThis);
