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

        // Upper hull.
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(-84, -26);
        ctx.lineTo(-84, -8);
        ctx.lineTo(66, -8);
        ctx.lineTo(88, -18);
        ctx.lineTo(82, -28);
        ctx.lineTo(40, -38);
        ctx.lineTo(-78, -38);
        ctx.closePath();
        ctx.fill();

        // Front glacis and side shadow.
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(40, -38);
        ctx.lineTo(82, -28);
        ctx.lineTo(88, -18);
        ctx.lineTo(58, -13);
        ctx.lineTo(36, -26);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.moveTo(-84, -26);
        ctx.lineTo(-84, -8);
        ctx.lineTo(66, -8);
        ctx.lineTo(58, -13);
        ctx.lineTo(0, -13);
        ctx.lineTo(-42, -16);
        ctx.lineTo(-72, -20);
        ctx.closePath();
        ctx.fill();

        // Side skirt panel lines.
        ctx.strokeStyle = shadow;
        ctx.lineWidth = 1.2;
        var panelXs = [-62, -38, -14, 10, 34, 58];
        for (var i = 0; i < panelXs.length; i++) {
            var x = panelXs[i];
            ctx.beginPath();
            ctx.moveTo(x, -32);
            ctx.lineTo(x, -8);
            ctx.stroke();
        }

        // Driver hatch and optics.
        ctx.fillStyle = dark;
        ctx.fillRect(20, -34, 16, 5);
        ctx.fillStyle = '#111';
        ctx.fillRect(22, -33, 12, 2.5);

        // Rear details.
        ctx.fillStyle = '#202020';
        ctx.fillRect(-84, -18, 8, 8);
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(-85, -20, 3, 6);

        if (enemyPattern) {
            // Desert fragments + red enemy marks.
            ctx.fillStyle = 'rgba(80,64,42,0.26)';
            ctx.fillRect(-62, -31, 20, 7);
            ctx.fillRect(-15, -25, 18, 6);
            ctx.fillRect(26, -20, 14, 5);

            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(18, -14);
            ctx.lineTo(42, -11);
            ctx.moveTo(16, -10);
            ctx.lineTo(40, -7);
            ctx.stroke();

            ctx.fillStyle = accent2;
            ctx.fillRect(-44, -10, 10, 3);
        }
    }

    globalScope.UnitRenderV2Body_apc = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
