// Body rendering for: mbt
(function attachUnitRenderV2Body_mbt(globalScope) {
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

    function drawBody(unit, ctx, palette) {
        if (!ctx) return;
        var p = palette || {};
        var main = p.main || '#4E5B31';
        var dark = p.dark || '#3D4825';
        var shadow = p.shadow || '#2C3519';
        var track = p.track || '#222';

        // Tracks
        ctx.fillStyle = track;
        rr(ctx, -80, -15, 160, 30, 15);
        ctx.fill();

        // Hull
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.moveTo(-82, -25);
        ctx.lineTo(-82, -10);
        ctx.lineTo(-65, -10);
        ctx.lineTo(-65, -5);
        ctx.lineTo(60, -5);
        ctx.lineTo(82, -15);
        ctx.lineTo(80, -25);
        ctx.lineTo(40, -35);
        ctx.lineTo(-80, -35);
        ctx.closePath();
        ctx.fill();

        // Side skirt panels
        ctx.strokeStyle = shadow;
        ctx.lineWidth = 1.4;
        var panelLines = [-65, -45, -25, -5, 15, 35, 55];
        for (var i = 0; i < panelLines.length; i++) {
            var x = panelLines[i];
            ctx.beginPath();
            ctx.moveTo(x, -30);
            ctx.lineTo(x, -5);
            ctx.stroke();
        }

        // Rear deck
        ctx.fillStyle = shadow;
        ctx.fillRect(-80, -35, 30, 4);

        // Front upper glacis
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(40, -35);
        ctx.lineTo(75, -25);
        ctx.lineTo(80, -20);
        ctx.lineTo(45, -30);
        ctx.closePath();
        ctx.fill();

        // Rear light
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(-82, -22, 3, 5);
    }

    globalScope.UnitRenderV2Body_mbt = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
