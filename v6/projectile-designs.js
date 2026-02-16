// projectile-designs.js
(function () {
    'use strict';

    function drawTacticalMissile(ctx, scale = 1) {
        ctx.save();
        ctx.scale(scale, scale);

        const colors = {
            body: '#e5e7eb',
            dark: '#374151',
            wing: '#64748b',
            band: '#f1c40f',
            nose: '#ef4444',
            intake: '#334155',
            flame: '#f59e0b'
        };

        // Body
        ctx.fillStyle = colors.body;
        ctx.fillRect(-14, -3, 28, 6);

        // Nose
        ctx.fillStyle = colors.nose;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(10, -4);
        ctx.lineTo(10, 4);
        ctx.closePath();
        ctx.fill();

        // Warhead band
        ctx.fillStyle = colors.band;
        ctx.fillRect(6, -3, 2, 6);

        // Intake (cruise missile feel)
        ctx.fillStyle = colors.intake;
        ctx.beginPath();
        ctx.moveTo(-6, 3);
        ctx.lineTo(2, 3);
        ctx.lineTo(4, 6);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();

        // Wings
        ctx.fillStyle = colors.wing;
        ctx.beginPath();
        ctx.moveTo(-2, -1);
        ctx.lineTo(-8, -10);
        ctx.lineTo(0, -1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, 1);
        ctx.lineTo(-8, 10);
        ctx.lineTo(0, 1);
        ctx.closePath();
        ctx.fill();

        // Tail fins
        ctx.fillStyle = colors.dark;
        ctx.beginPath();
        ctx.moveTo(-14, -3);
        ctx.lineTo(-20, -8);
        ctx.lineTo(-18, -3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-14, 3);
        ctx.lineTo(-20, 8);
        ctx.lineTo(-18, 3);
        ctx.closePath();
        ctx.fill();

        // Nozzle + flame
        ctx.fillStyle = colors.dark;
        ctx.fillRect(-18, -2, 4, 4);
        ctx.fillStyle = colors.flame;
        ctx.beginPath();
        ctx.arc(-20, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawNuke(ctx, scale = 1) {
        ctx.save();
        ctx.scale(scale, scale);

        const colors = {
            body: '#e5e7eb',
            band: '#cbd5e1',
            nose: '#111827',
            fin: '#64748b',
            check: '#1f2937'
        };

        // Tail fins
        ctx.fillStyle = colors.fin;
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-26, -10);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-26, 10);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();

        // Body
        ctx.fillStyle = colors.body;
        ctx.fillRect(-20, -6, 34, 12);

        // Stage band
        ctx.fillStyle = colors.band;
        ctx.fillRect(-2, -6, 2, 12);

        // Re-entry nose
        ctx.fillStyle = colors.body;
        ctx.beginPath();
        ctx.moveTo(14, -6);
        ctx.bezierCurveTo(22, -5, 26, -2, 28, 0);
        ctx.bezierCurveTo(26, 2, 22, 5, 14, 6);
        ctx.closePath();
        ctx.fill();

        // Nose cap
        ctx.fillStyle = colors.nose;
        ctx.beginPath();
        ctx.moveTo(24, -2);
        ctx.lineTo(28, 0);
        ctx.lineTo(24, 2);
        ctx.closePath();
        ctx.fill();

        // Check pattern
        ctx.fillStyle = colors.check;
        ctx.fillRect(6, -6, 4, 3);
        ctx.fillRect(10, -3, 4, 3);
        ctx.fillRect(6, 0, 4, 3);
        ctx.fillRect(10, 3, 4, 3);

        ctx.restore();
    }

    function drawIcbmNukeMissile(ctx, scale = 1) {
        ctx.save();
        ctx.scale(scale, scale);

        ctx.fillStyle = '#4b5563';
        ctx.beginPath();
        ctx.moveTo(-30, -7);
        ctx.lineTo(18, -7);
        ctx.lineTo(28, 0);
        ctx.lineTo(18, 7);
        ctx.lineTo(-30, 7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.moveTo(18, -7);
        ctx.lineTo(30, 0);
        ctx.lineTo(18, 7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#facc15';
        ctx.fillRect(4, -7, 3, 14);
        ctx.fillRect(9, -7, 3, 14);

        ctx.fillStyle = '#111827';
        ctx.fillRect(5, -7, 1, 14);
        ctx.fillRect(10, -7, 1, 14);

        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.moveTo(-22, -6); ctx.lineTo(-32, -12); ctx.lineTo(-24, -6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-22, 6); ctx.lineTo(-32, 12); ctx.lineTo(-24, 6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawIcbmTacticalMissile(ctx, scale = 1) {
        ctx.save();
        ctx.scale(scale, scale);

        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(-24, -4, 38, 8);

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(14, -4);
        ctx.lineTo(24, 0);
        ctx.lineTo(14, 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-2, -4, 3, 8);

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-10, -2); ctx.lineTo(-18, -10); ctx.lineTo(-8, -2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-10, 2); ctx.lineTo(-18, 10); ctx.lineTo(-8, 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-26, -2, 3, 4);
        ctx.restore();
    }

    function drawIcbmEmpMissile(ctx, scale = 1) {
        ctx.save();
        ctx.scale(scale, scale);

        ctx.fillStyle = '#dbeafe';
        ctx.fillRect(-24, -4, 36, 8);

        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(-4, -4, 4, 8);
        ctx.fillRect(2, -4, 2, 8);

        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, -4);
        ctx.lineTo(22, 0);
        ctx.lineTo(12, 4);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(-12, -2); ctx.lineTo(-20, -8); ctx.lineTo(-12, -2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-12, 2); ctx.lineTo(-20, 8); ctx.lineTo(-12, 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(-26, -2, 3, 4);

        ctx.restore();
    }

    function drawArtilleryShell(ctx, scale = 1) {
        ctx.save();
        ctx.scale(scale, scale);

        const colors = {
            body: '#4b5320',
            copper: '#b87333',
            fuse: '#95a5a6',
            booster: '#2f3437',
            fin: '#5b642f'
        };

        // Body (shell)
        ctx.fillStyle = colors.body;
        ctx.beginPath();
        ctx.moveTo(-14, -5);
        ctx.lineTo(-18, -3);
        ctx.lineTo(-18, 3);
        ctx.lineTo(-14, 5);
        ctx.lineTo(6, 5);
        ctx.bezierCurveTo(14, 5, 18, 2, 20, 1);
        ctx.lineTo(20, -1);
        ctx.bezierCurveTo(18, -2, 14, -5, 6, -5);
        ctx.closePath();
        ctx.fill();

        // Copper band
        ctx.fillStyle = colors.copper;
        ctx.fillRect(-10, -5, 3, 10);

        // Fuse
        ctx.fillStyle = colors.fuse;
        ctx.beginPath();
        ctx.moveTo(20, -1);
        ctx.lineTo(24, -0.5);
        ctx.lineTo(24, 0.5);
        ctx.lineTo(20, 1);
        ctx.closePath();
        ctx.fill();

        // Rocket booster
        ctx.fillStyle = colors.booster;
        ctx.fillRect(-20, -3.5, 4, 7);
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(-20, -2);
        ctx.lineTo(-24, -1);
        ctx.lineTo(-24, 1);
        ctx.lineTo(-20, 2);
        ctx.closePath();
        ctx.fill();

        // Tail fins
        ctx.fillStyle = colors.fin;
        ctx.beginPath();
        ctx.moveTo(-12, -4);
        ctx.lineTo(-18, -8);
        ctx.lineTo(-10, -5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-12, 4);
        ctx.lineTo(-18, 8);
        ctx.lineTo(-10, 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    const root = (typeof window !== 'undefined') ? window : globalThis;
    root.ProjectileDesigns = {
        drawTacticalMissile,
        drawNuke,
        drawArtilleryShell,
        drawIcbmNukeMissile,
        drawIcbmTacticalMissile,
        drawIcbmEmpMissile
    };
})();
