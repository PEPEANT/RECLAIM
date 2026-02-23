// Body rendering for: aa_tank (SPAAG)
(function attachUnitRenderV2Body_aa_tank(globalScope) {
    'use strict';

    function drawBody(unit, ctx, palette) {
        if (!ctx) return;
        var p = palette || {};
        var main = p.main || '#4E5B31';
        var dark = p.dark || '#3D4825';
        var shadow = p.shadow || '#2C3519';
        var accent = p.accent || '#8b1e1e';
        var accent2 = p.accent2 || '#b91c1c';
        var enemyPattern = p.enemyPattern === true;

        // Lower hull (extended baseline chassis).
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.moveTo(-75, 0);
        ctx.lineTo(-75, -24);
        ctx.lineTo(60, -24);
        ctx.lineTo(75, -10);
        ctx.lineTo(70, 0);
        ctx.lineTo(-68, 0);
        ctx.closePath();
        ctx.fill();

        // Upper hull block (reference pure hull extension).
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.moveTo(-50, -24);
        ctx.lineTo(-45, -48);
        ctx.lineTo(20, -48);
        ctx.lineTo(40, -25);
        ctx.lineTo(45, -24);
        ctx.closePath();
        ctx.fill();

        // Armor shade.
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.moveTo(20, -48);
        ctx.lineTo(40, -25);
        ctx.lineTo(35, -24);
        ctx.lineTo(15, -35);
        ctx.closePath();
        ctx.fill();

        // Driver viewport.
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(23, -45);
        ctx.lineTo(38, -27);
        ctx.lineTo(33, -25);
        ctx.lineTo(19, -42);
        ctx.closePath();
        ctx.fill();

        // Side skirt strip.
        ctx.fillStyle = dark;
        ctx.fillRect(-72, -14, 140, 8);

        // Panel lines.
        ctx.strokeStyle = shadow;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var x = -58; x <= 52; x += 18) {
            ctx.moveTo(x, -14);
            ctx.lineTo(x, 0);
        }
        ctx.moveTo(-68, -20);
        ctx.lineTo(58, -20);
        ctx.stroke();

        // Rear deck.
        ctx.fillStyle = shadow;
        ctx.fillRect(-66, -24, 26, 3);

        // Lights.
        ctx.fillStyle = '#ff2200';
        ctx.fillRect(-75, -14, 4, 6);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(72, -15, 3, 5);

        if (enemyPattern) {
            ctx.fillStyle = 'rgba(80,64,42,0.26)';
            ctx.fillRect(-56, -21, 18, 7);
            ctx.fillRect(-10, -28, 20, 7);
            ctx.fillRect(22, -24, 14, 6);

            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(-40, -11);
            ctx.lineTo(-6, -11);
            ctx.moveTo(-35, -7);
            ctx.lineTo(-1, -7);
            ctx.stroke();

            ctx.fillStyle = accent2;
            ctx.fillRect(18, -30, 10, 3);
        }
    }

    globalScope.UnitRenderV2Body_aa_tank = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
