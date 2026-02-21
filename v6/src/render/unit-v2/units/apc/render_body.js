// Body rendering for: apc (M2 Bradley IFV)
(function attachUnitRenderV2Body_apc(globalScope) {
    'use strict';

    function drawBody(unit, ctx, palette) {
        if (!ctx) return;
        var p = palette || {};
        var base = p.base || '#4E5B31';
        var dark = p.dark || '#3D4825';
        var shadow = p.shadow || '#2C3519';
        var accent = p.accent || '#8b1e1e';
        var accent2 = p.accent2 || '#b91c1c';
        var enemyPattern = p.enemyPattern === true;

        // Reference design baseline converted to V2 feet baseline (y - 15).
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(65, -32);
        ctx.lineTo(82, -11);
        ctx.lineTo(82, 1);
        ctx.lineTo(75, 7);
        ctx.lineTo(-75, 7);
        ctx.lineTo(-80, -11);
        ctx.lineTo(-80, -37);
        ctx.lineTo(45, -37);
        ctx.closePath();
        ctx.fill();

        // Side skirt armor.
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(75, -11);
        ctx.lineTo(-78, -11);
        ctx.lineTo(-75, 5);
        ctx.lineTo(72, 5);
        ctx.closePath();
        ctx.fill();

        // Side armor panel lines.
        ctx.strokeStyle = shadow;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var px = -60; px <= 60; px += 25) {
            ctx.moveTo(px, -11);
            ctx.lineTo(px, 5);
        }
        ctx.stroke();

        // Rear storage box + center vent deck.
        ctx.fillStyle = shadow;
        ctx.fillRect(-70, -32, 20, 10);
        ctx.fillRect(10, -32, 30, 8);

        // Vent slits.
        ctx.fillStyle = '#111';
        for (var i = 0; i < 6; i++) {
            ctx.fillRect(12 + i * 4.5, -31, 2, 6);
        }

        // Driver sight.
        ctx.fillStyle = '#2b3842';
        ctx.fillRect(48, -35, 10, 4);

        // Lights.
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(80, -14, 3, 5);
        ctx.fillStyle = '#ff2200';
        ctx.fillRect(-80, -21, 2, 6);

        if (enemyPattern) {
            ctx.fillStyle = 'rgba(80,64,42,0.26)';
            ctx.fillRect(-62, -30, 20, 7);
            ctx.fillRect(-15, -24, 18, 6);
            ctx.fillRect(26, -19, 14, 5);

            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(18, -21);
            ctx.lineTo(42, -18);
            ctx.moveTo(16, -17);
            ctx.lineTo(40, -14);
            ctx.stroke();

            ctx.fillStyle = accent2;
            ctx.fillRect(-44, -15, 10, 3);
        }
    }

    globalScope.UnitRenderV2Body_apc = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
