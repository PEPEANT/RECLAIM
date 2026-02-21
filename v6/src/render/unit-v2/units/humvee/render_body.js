// Body rendering for: humvee
(function attachUnitRenderV2Body_humvee(globalScope) {
    'use strict';

    function drawBody(unit, ctx, palette) {
        if (!ctx) return;
        var p = palette || {};
        var base = p.base || '#4E5B31';
        var dark = p.dark || '#3D4825';
        var shadow = p.shadow || '#2C3519';
        var windowColor = p.window || '#3b4d59';
        var accent = p.accent || '#8b1e1e';
        var accent2 = p.accent2 || '#b91c1c';
        var enemyPattern = p.enemyPattern === true;

        // Main hull silhouette (slant-back style).
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(58, 10);
        ctx.lineTo(58, -2);
        ctx.lineTo(55, -10);
        ctx.lineTo(28, -12);
        ctx.lineTo(15, -30);
        ctx.lineTo(-25, -30);
        ctx.lineTo(-55, -12);
        ctx.lineTo(-58, -5);
        ctx.lineTo(-58, 10);
        ctx.closePath();
        ctx.fill();

        // Body shading.
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.beginPath();
        ctx.moveTo(58, -2);
        ctx.lineTo(55, -10);
        ctx.lineTo(28, -12);
        ctx.lineTo(15, -30);
        ctx.lineTo(-25, -30);
        ctx.lineTo(-55, -12);
        ctx.lineTo(-58, -5);
        ctx.lineTo(-16, -5);
        ctx.lineTo(24, -7);
        ctx.closePath();
        ctx.fill();

        if (enemyPattern) {
            // Desert camo chips + red aggression marks.
            ctx.fillStyle = 'rgba(60,46,30,0.28)';
            ctx.fillRect(-38, -25, 17, 7);
            ctx.fillRect(-4, -18, 20, 6);
            ctx.fillRect(26, -12, 13, 5);

            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(20, -10);
            ctx.lineTo(41, -6);
            ctx.moveTo(17, -6);
            ctx.lineTo(38, -2);
            ctx.stroke();

            ctx.fillStyle = accent2;
            ctx.fillRect(-49, -8, 8, 3);
        }

        // Windows.
        ctx.fillStyle = windowColor;
        ctx.beginPath();
        ctx.moveTo(-2, -27);
        ctx.lineTo(13, -27);
        ctx.lineTo(25, -14);
        ctx.lineTo(-2, -14);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-22, -27);
        ctx.lineTo(-4, -27);
        ctx.lineTo(-4, -14);
        ctx.lineTo(-22, -14);
        ctx.closePath();
        ctx.fill();

        // Door panel and X-stamp details.
        ctx.strokeStyle = shadow;
        ctx.lineWidth = 1;

        ctx.strokeRect(-2, -12, 28, 20);
        ctx.beginPath(); ctx.moveTo(-2, -12); ctx.lineTo(26, 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(26, -12); ctx.lineTo(-2, 8); ctx.stroke();

        ctx.strokeRect(-24, -12, 22, 20);
        ctx.beginPath(); ctx.moveTo(-24, -12); ctx.lineTo(-2, 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, -12); ctx.lineTo(-24, 8); ctx.stroke();

        // Snorkel/exhaust stack.
        ctx.fillStyle = '#222';
        ctx.fillRect(26, -35, 3, 23);
        ctx.fillStyle = '#111';
        ctx.fillRect(25, -38, 5, 3);

        // Lights and bumper accents.
        ctx.fillStyle = '#ff2200';
        ctx.fillRect(-58, -2, 3, 5);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(54, -6, 2, 4);

        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(58, 8);
        ctx.lineTo(61, -2);
        ctx.lineTo(55, -8);
        ctx.stroke();
    }

    globalScope.UnitRenderV2Body_humvee = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
