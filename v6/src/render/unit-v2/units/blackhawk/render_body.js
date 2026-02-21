// Body rendering for: blackhawk (UH-60)
(function attachUnitRenderV2Body_blackhawk(globalScope) {
    'use strict';

    function rr(ctx, x, y, w, h, r) {
        if (!ctx) return;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
            return;
        }
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function poly(ctx, pts) {
        if (!ctx || !Array.isArray(pts) || pts.length < 4) return;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (var i = 2; i < pts.length; i += 2) {
            ctx.lineTo(pts[i], pts[i + 1]);
        }
        ctx.closePath();
    }

    function drawBody(unit, ctx, state, palette) {
        if (!ctx) return;

        var p = palette || {};
        var body = p.body || '#2e3136';
        var dark = p.dark || '#1c1e20';
        var light = p.light || '#484c52';
        var windowColor = p.window || '#5a7b8c';
        var gear = p.gear || '#3a3d40';
        var tire = p.tire || '#0f0f11';
        var highlight = p.highlight || '#484c52';
        var accent = p.accent || '#4b5563';
        var accent2 = p.accent2 || '#374151';
        var enemyPattern = p.enemyPattern === true;

        // Rear wheel (depth layer)
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(10.6, 3.6);
        ctx.lineTo(11.5, 8.5);
        ctx.stroke();
        ctx.fillStyle = tire;
        ctx.beginPath();
        ctx.arc(11.5, 8.5, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Main fuselage silhouette (tail boom widened + smoothed)
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(24.4, 0);
        ctx.bezierCurveTo(24.4, 2.9, 23.2, 4.4, 18.8, 4.6);
        ctx.lineTo(-11.3, 4.6);
        ctx.lineTo(-46.2, 2.0);
        ctx.lineTo(-50.2, -1.8);
        ctx.lineTo(-52.7, -6.7);
        ctx.lineTo(-52.9, -11.3);
        ctx.lineTo(-50.9, -14.1);
        ctx.lineTo(-46.5, -14.4);
        ctx.lineTo(-41.2, -12.8);
        ctx.lineTo(-13.8, -2.5);
        ctx.bezierCurveTo(-11.3, -5.3, -8.8, -7.5, -5.0, -7.5);
        ctx.lineTo(3.8, -7.5);
        ctx.lineTo(8.8, -5.0);
        ctx.lineTo(16.3, -5.0);
        ctx.lineTo(20.0, -2.5);
        ctx.bezierCurveTo(22.4, -2.5, 24.4, -1.6, 24.4, 0);
        ctx.closePath();
        ctx.fill();

        // Fuselage panel lines
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.moveTo(18.8, 4.6);
        ctx.lineTo(-11.3, 4.6);
        ctx.lineTo(-46.2, 2.0);
        ctx.stroke();

        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(-13.8, -2.5);
        ctx.lineTo(-50.2, -1.8);
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(3.8, -7.5);
        ctx.lineTo(8.8, -5.0);
        ctx.lineTo(16.3, -5.0);
        ctx.stroke();

        // Tail boom connector reinforcement (keeps top surface visually filled)
        ctx.fillStyle = dark;
        poly(ctx, [
            -40.9, -9.7,
            -50.2, -11.4,
            -49.8, -13.1,
            -40.5, -11.8
        ]);
        ctx.fill();
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 0.45;
        ctx.beginPath();
        ctx.moveTo(-40.8, -10.1);
        ctx.lineTo(-50.0, -11.7);
        ctx.stroke();

        // Tail fin root around tail rotor axis
        ctx.fillStyle = dark;
        poly(ctx, [
            -49.6, -4.5,
            -52.6, -9.8,
            -51.7, -13.7,
            -49.1, -8.3
        ]);
        ctx.fill();

        // Side sponson
        ctx.fillStyle = dark;
        poly(ctx, [
            15.4, 3.4,
            8.0, 3.4,
            6.9, 1.7,
            13.6, 1.5
        ]);
        ctx.fill();

        // Cockpit windows
        ctx.fillStyle = windowColor;
        poly(ctx, [
            19.8, -2.4,
            16.5, -4.6,
            15.0, -4.6,
            15.0, -0.6,
            19.8, -1.1
        ]);
        ctx.fill();
        ctx.strokeStyle = body;
        ctx.lineWidth = 0.5;
        poly(ctx, [
            19.8, -2.4,
            16.5, -4.6,
            15.0, -4.6,
            15.0, -0.6,
            19.8, -1.1
        ]);
        ctx.stroke();

        // Side pilot glass
        ctx.fillStyle = windowColor;
        poly(ctx, [
            23.0, 0.3,
            20.5, -0.6,
            20.5, 2.1,
            22.4, 2.8
        ]);
        ctx.fill();

        // Crew small window
        ctx.fillStyle = windowColor;
        rr(ctx, 9.6, -4.2, 4.4, 4.4, 0.6);
        ctx.fill();

        // Cargo sliding door outline + windows
        ctx.strokeStyle = dark;
        ctx.lineWidth = 0.6;
        rr(ctx, 0.9, -4.9, 10.6, 9.2, 0.5);
        ctx.stroke();

        ctx.fillStyle = windowColor;
        rr(ctx, 2.1, -3.8, 3.4, 3.4, 0.55);
        ctx.fill();
        rr(ctx, 6.4, -3.8, 3.4, 3.4, 0.55);
        ctx.fill();

        // Engine exhaust housing
        ctx.fillStyle = dark;
        poly(ctx, [
            -5.0, -7.5,
            -10.0, -7.5,
            -9.4, -4.6,
            -6.2, -4.6
        ]);
        ctx.fill();
        ctx.fillStyle = '#0f0f11';
        ctx.beginPath();
        ctx.ellipse(-9.6, -6.1, 0.8, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stabilator
        ctx.fillStyle = dark;
        poly(ctx, [
            -44.4, 1.3,
            -50.4, 0.1,
            -50.3, 1.8,
            -44.4, 2.2
        ]);
        ctx.fill();

        // Sensors / mast details
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(24.1, 1.4, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(10.2, -5.8, 0.6, 0.9);
        ctx.strokeStyle = dark;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-11.0, 4.6);
        ctx.lineTo(-11.7, 6.0);
        ctx.lineTo(-12.4, 4.4);
        ctx.stroke();

        // Front landing gear
        ctx.strokeStyle = gear;
        ctx.lineWidth = 1.15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(14.0, 3.4);
        ctx.lineTo(15.0, 9.2);
        ctx.stroke();

        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(11.1, 3.5);
        ctx.lineTo(15.0, 9.2);
        ctx.stroke();

        ctx.fillStyle = tire;
        ctx.beginPath();
        ctx.arc(15.0, 9.2, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(15.0, 9.2, 0.58, 0, Math.PI * 2);
        ctx.fill();

        // Tail landing gear
        ctx.strokeStyle = gear;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-45.0, 2.0);
        ctx.lineTo(-46.4, 5.3);
        ctx.stroke();

        ctx.fillStyle = tire;
        ctx.beginPath();
        ctx.arc(-46.4, 5.3, 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(-46.4, 5.3, 0.36, 0, Math.PI * 2);
        ctx.fill();

        // Team accent
        ctx.fillStyle = enemyPattern ? accent : accent2;
        ctx.fillRect(4.8, -1.7, 6.0, 0.95);

        if (enemyPattern) {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 0.72;
            ctx.beginPath();
            ctx.moveTo(-4.5, -1.6);
            ctx.lineTo(1.2, -1.0);
            ctx.moveTo(-4.5, 0.0);
            ctx.lineTo(1.2, 0.6);
            ctx.stroke();
        }
    }

    globalScope.UnitRenderV2Body_blackhawk = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
