// Body rendering for: spg
(function attachUnitRenderV2Body_spg(globalScope) {
    'use strict';

    function drawBody(unit, ctx, palette) {
        if (!ctx) return;
        var p = palette || {};
        var base = p.base || '#4A5D23';
        var dark = p.dark || '#324016';
        var shadow = p.shadow || '#212B0E';

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

