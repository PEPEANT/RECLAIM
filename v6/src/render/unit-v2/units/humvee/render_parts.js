// Additional part rendering (wheels/turret) for: humvee
(function attachUnitRenderV2Parts_humvee(globalScope) {
    'use strict';

    function drawWheels(ctx, state, palette) {
        if (!ctx) return;
        var p = palette || {};
        var tire = p.tire || '#1a1a1a';
        var rim = p.rim || '#444';
        var wheelAngle = Number(state && state.wheelAngle) || 0;

        var wheelRadius = 11;
        var wheels = [
            { x: -38, y: 15 },
            { x: 38, y: 15 }
        ];

        for (var i = 0; i < wheels.length; i++) {
            var w = wheels[i];
            ctx.save();
            ctx.translate(w.x, w.y);
            ctx.rotate(wheelAngle);

            ctx.fillStyle = tire;
            ctx.beginPath();
            ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#111';
            for (var t = 0; t < 8; t++) {
                ctx.rotate(Math.PI / 4);
                ctx.fillRect(8, -1.2, 3, 2.4);
            }

            ctx.fillStyle = rim;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    function drawTurret(ctx, state, palette) {
        if (!ctx) return;
        var p = palette || {};
        var dark = p.dark || '#3D4825';
        var gun = p.gun || '#222';
        var tow = p.tow || '#4B5320';
        var angle = Number(state && state.turretAngle);
        if (!Number.isFinite(angle)) angle = -0.08;

        ctx.save();
        ctx.translate(-5, -30);
        ctx.rotate(angle);

        // Gunner shield.
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(12, 2);
        ctx.lineTo(14, -14);
        ctx.lineTo(4, -14);
        ctx.lineTo(-2, 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#111';
        ctx.fillRect(8, -10, 4, 4);

        // M2 machine gun.
        ctx.fillStyle = gun;
        ctx.fillRect(5, -6, 25, 2);
        ctx.fillRect(-8, -8, 15, 5);
        ctx.fillStyle = '#3a422a';
        ctx.fillRect(-4, -2, 7, 5);

        // TOW launcher tube.
        ctx.save();
        ctx.translate(0, -14);
        ctx.fillStyle = tow;
        ctx.fillRect(-18, -6, 38, 10);
        ctx.fillStyle = '#222';
        ctx.fillRect(-12, -6, 2, 10);
        ctx.fillRect(16, -6, 2, 10);
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(12, -6, 2, 10);
        ctx.fillStyle = '#111';
        ctx.fillRect(-8, -12, 10, 6);
        ctx.fillStyle = '#5599ff';
        ctx.fillRect(0, -11, 2, 4);
        ctx.restore();

        // MG muzzle flash.
        var mgFlash = Math.max(0, Number(state && state.mgFlash) || 0);
        if (mgFlash > 0.03) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, mgFlash);
            ctx.fillStyle = '#ffcc55';
            ctx.beginPath();
            ctx.moveTo(30, -5);
            ctx.lineTo(38, -7.5);
            ctx.lineTo(38, -2.5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ff8a00';
            ctx.beginPath();
            ctx.moveTo(30, -5);
            ctx.lineTo(35, -6.4);
            ctx.lineTo(35, -3.6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    globalScope.UnitRenderV2Parts_humvee = {
        drawWheels: drawWheels,
        drawTurret: drawTurret
    };
})(typeof window !== 'undefined' ? window : globalThis);
