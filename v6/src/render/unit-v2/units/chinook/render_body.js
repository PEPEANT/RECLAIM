// Body rendering for: chinook
(function attachUnitRenderV2Body_chinook(globalScope) {
    'use strict';

    var SCALE = 0.128;

    function sx(x) {
        return (x - 410) * SCALE;
    }

    function sy(y) {
        return (y - 220) * SCALE;
    }

    function polySvg(ctx, pts) {
        if (!ctx || !Array.isArray(pts) || pts.length < 6) return;
        ctx.beginPath();
        ctx.moveTo(sx(pts[0]), sy(pts[1]));
        for (var i = 2; i < pts.length; i += 2) {
            ctx.lineTo(sx(pts[i]), sy(pts[i + 1]));
        }
        ctx.closePath();
    }

    function drawBody(unit, ctx, state, palette) {
        if (!ctx || !palette) return;

        var body = palette.body;
        var dark = palette.dark;
        var light = palette.light;
        var windowColor = palette.window;
        var gear = palette.gear;
        var tire = palette.tire;
        var highlight = palette.highlight;
        var accent = palette.accent;
        var accent2 = palette.accent2;
        var enemyPattern = palette.enemyPattern === true;

        // Rear depth gear set.
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.translate(sx(8), sy(-3));
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 4 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(265), sy(260));
        ctx.lineTo(sx(265), sy(280));
        ctx.moveTo(sx(575), sy(260));
        ctx.lineTo(sx(575), sy(280));
        ctx.stroke();
        ctx.fillStyle = tire;
        ctx.beginPath();
        ctx.arc(sx(265), sy(280), 10 * SCALE, 0, Math.PI * 2);
        ctx.arc(sx(575), sy(280), 10 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Main fuselage from source profile.
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(sx(135), sy(235));
        ctx.lineTo(sx(135), sy(205));
        ctx.lineTo(sx(165), sy(185));
        ctx.lineTo(sx(185), sy(185));
        ctx.lineTo(sx(205), sy(155));
        ctx.lineTo(sx(235), sy(155));
        ctx.lineTo(sx(255), sy(185));
        ctx.lineTo(sx(550), sy(185));
        ctx.lineTo(sx(590), sy(100));
        ctx.lineTo(sx(650), sy(100));
        ctx.lineTo(sx(680), sy(140));
        ctx.lineTo(sx(680), sy(210));
        ctx.lineTo(sx(620), sy(260));
        ctx.lineTo(sx(190), sy(260));
        ctx.bezierCurveTo(sx(160), sy(260), sx(140), sy(255), sx(135), sy(235));
        ctx.closePath();
        ctx.fill();

        // Panel lines and highlight cuts.
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 1.5 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(185), sy(185));
        ctx.lineTo(sx(550), sy(185));
        ctx.moveTo(sx(610), sy(260));
        ctx.lineTo(sx(680), sy(210));
        ctx.stroke();

        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(sx(255), sy(185));
        ctx.lineTo(sx(255), sy(260));
        ctx.moveTo(sx(550), sy(185));
        ctx.lineTo(sx(550), sy(260));
        ctx.stroke();
        ctx.restore();

        // Lower sponson.
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(sx(200), sy(245));
        ctx.lineTo(sx(610), sy(245));
        ctx.bezierCurveTo(sx(625), sy(245), sx(630), sy(265), sx(610), sy(270));
        ctx.lineTo(sx(210), sy(270));
        ctx.bezierCurveTo(sx(195), sy(270), sx(190), sy(245), sx(200), sy(245));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = gear;
        ctx.lineWidth = 2 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(205), sy(247));
        ctx.lineTo(sx(605), sy(247));
        ctx.stroke();

        // Engine pod.
        ctx.fillStyle = '#24262a';
        ctx.beginPath();
        ctx.moveTo(sx(540), sy(185));
        ctx.lineTo(sx(660), sy(185));
        ctx.bezierCurveTo(sx(675), sy(185), sx(680), sy(195), sx(660), sy(215));
        ctx.lineTo(sx(540), sy(215));
        ctx.bezierCurveTo(sx(525), sy(215), sx(530), sy(185), sx(540), sy(185));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = light;
        ctx.lineWidth = 2 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(550), sy(195));
        ctx.lineTo(sx(650), sy(195));
        ctx.stroke();
        ctx.fillStyle = tire;
        ctx.beginPath();
        ctx.ellipse(sx(540), sy(200), 4 * SCALE, 12 * SCALE, 0, 0, Math.PI * 2);
        ctx.fill();
        polySvg(ctx, [660, 192, 675, 195, 675, 205, 660, 208]);
        ctx.fill();

        // Cockpit windows.
        polySvg(ctx, [138, 225, 138, 206, 164, 188, 178, 188, 182, 225]);
        ctx.fillStyle = windowColor;
        ctx.fill();
        ctx.strokeStyle = body;
        ctx.lineWidth = 3 * SCALE;
        polySvg(ctx, [138, 225, 138, 206, 164, 188, 178, 188, 182, 225]);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx(158), sy(192));
        ctx.lineTo(sx(162), sy(225));
        ctx.stroke();

        ctx.fillStyle = windowColor;
        ctx.beginPath();
        ctx.roundRect(sx(188), sy(195), (18 * SCALE), (30 * SCALE), 3 * SCALE);
        ctx.fill();
        ctx.strokeStyle = body;
        ctx.lineWidth = 2 * SCALE;
        ctx.stroke();

        // Cargo round windows.
        var portholes = [280, 330, 380, 430, 480, 530];
        for (var i = 0; i < portholes.length; i++) {
            ctx.fillStyle = windowColor;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(sx(portholes[i]), sy(210), 9 * SCALE, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = dark;
            ctx.lineWidth = 2 * SCALE;
            ctx.stroke();
        }

        // Nose probe and antennas.
        ctx.strokeStyle = dark;
        ctx.lineWidth = 2 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(135), sy(235));
        ctx.lineTo(sx(110), sy(235));
        ctx.moveTo(sx(280), sy(270));
        ctx.lineTo(sx(270), sy(285));
        ctx.moveTo(sx(450), sy(185));
        ctx.lineTo(sx(445), sy(170));
        ctx.stroke();

        // Front and rear landing gear foreground.
        ctx.strokeStyle = gear;
        ctx.lineWidth = 5 * SCALE;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx(245), sy(260));
        ctx.lineTo(sx(245), sy(290));
        ctx.moveTo(sx(560), sy(260));
        ctx.lineTo(sx(560), sy(290));
        ctx.stroke();

        ctx.fillStyle = tire;
        ctx.beginPath();
        ctx.arc(sx(245), sy(290), 12 * SCALE, 0, Math.PI * 2);
        ctx.arc(sx(560), sy(290), 12 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(sx(245), sy(290), 4 * SCALE, 0, Math.PI * 2);
        ctx.arc(sx(560), sy(290), 4 * SCALE, 0, Math.PI * 2);
        ctx.fill();

        // Rotor mast top markers intentionally removed.
        // These read as two dark dots at gameplay zoom.

        // Team accent.
        ctx.fillStyle = enemyPattern ? accent : accent2;
        ctx.fillRect(sx(340), sy(246), 110 * SCALE, 5 * SCALE);
        if (enemyPattern) {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.4 * SCALE;
            ctx.beginPath();
            ctx.moveTo(sx(475), sy(215));
            ctx.lineTo(sx(510), sy(228));
            ctx.moveTo(sx(470), sy(228));
            ctx.lineTo(sx(508), sy(240));
            ctx.stroke();
        }
    }

    globalScope.UnitRenderV2Body_chinook = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
