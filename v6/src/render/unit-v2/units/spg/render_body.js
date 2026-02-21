// Body rendering for: spg
(function attachUnitRenderV2Body_spg(globalScope) {
    'use strict';

    function drawBody(unit, ctx, palette) {
        if (!ctx) return;
        var p = palette || {};
        var base = p.base || '#4A5D23';
        var dark = p.dark || '#324016';
        var shadow = p.shadow || '#212B0E';
        var accent = p.accent || '#8b1e1e';
        var accent2 = p.accent2 || '#b91c1c';
        var enemyPattern = p.enemyPattern === true;

        // K9 hull silhouette: long glacis and high side profile.
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(-85, -25);
        ctx.lineTo(-85, -5);
        ctx.lineTo(80, -5);
        ctx.lineTo(90, -18);
        ctx.lineTo(60, -38);
        ctx.lineTo(-85, -38);
        ctx.closePath();
        ctx.fill();

        if (enemyPattern) {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(14, -28);
            ctx.lineTo(42, -22);
            ctx.moveTo(10, -23);
            ctx.lineTo(38, -17);
            ctx.stroke();

            ctx.fillStyle = accent2;
            ctx.fillRect(-71, -12, 8, 3);

            ctx.fillStyle = 'rgba(67,52,34,0.24)';
            ctx.fillRect(-78, -34, 20, 7);
            ctx.fillRect(-14, -30, 18, 6);
            ctx.fillRect(34, -24, 16, 5);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.moveTo(-85, -25);
        ctx.lineTo(-85, -38);
        ctx.lineTo(60, -38);
        ctx.lineTo(90, -18);
        ctx.lineTo(80, -5);
        ctx.lineTo(-85, -5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = shadow;
        ctx.lineWidth = 1;
        var lines = [-55, -20, 15, 50];
        for (var i = 0; i < lines.length; i++) {
            var x = lines[i];
            ctx.beginPath();
            ctx.moveTo(x, -38);
            ctx.lineTo(x, -5);
            ctx.stroke();
        }

        ctx.fillStyle = dark;
        ctx.fillRect(-84, -33, 26, 3);
    }

    globalScope.UnitRenderV2Body_spg = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
