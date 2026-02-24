// Body rendering for: blackhawk (UH-60)
(function attachUnitRenderV2Body_blackhawk(globalScope) {
    'use strict';

    var SCALE = 0.145;

    function sx(x) {
        return (x - 340) * SCALE;
    }

    function sy(y) {
        return (y - 235) * SCALE;
    }

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
        if (!ctx || !Array.isArray(pts) || pts.length < 6) return;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (var i = 2; i < pts.length; i += 2) {
            ctx.lineTo(pts[i], pts[i + 1]);
        }
        ctx.closePath();
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

        var roofStroke = 1.5 * SCALE;
        var panelStroke = 1.2 * SCALE;

        // Rear depth landing gear
        ctx.save();
        ctx.globalAlpha = 0.70;
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(255), sy(265));
        ctx.lineTo(sx(248), sy(305));
        ctx.stroke();
        ctx.fillStyle = tire;
        ctx.beginPath();
        ctx.arc(sx(248), sy(305), 9 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Main fuselage silhouette from source SVG (Gemini tail-corrected base)
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(sx(145), sy(235));
        ctx.bezierCurveTo(sx(145), sy(258), sx(155), sy(270), sx(190), sy(272));
        ctx.lineTo(sx(450), sy(272));
        ctx.lineTo(sx(640), sy(252));
        ctx.lineTo(sx(650), sy(265));
        ctx.lineTo(sx(665), sy(265));
        ctx.lineTo(sx(675), sy(245));
        ctx.lineTo(sx(710), sy(155));
        ctx.lineTo(sx(720), sy(145));
        ctx.lineTo(sx(710), sy(125));
        ctx.lineTo(sx(685), sy(125));
        ctx.lineTo(sx(640), sy(215));
        ctx.lineTo(sx(450), sy(215));
        ctx.bezierCurveTo(sx(430), sy(190), sx(410), sy(175), sx(380), sy(175));
        ctx.lineTo(sx(310), sy(175));
        ctx.lineTo(sx(270), sy(195));
        ctx.lineTo(sx(210), sy(195));
        ctx.lineTo(sx(180), sy(215));
        ctx.bezierCurveTo(sx(160), sy(215), sx(145), sy(220), sx(145), sy(235));
        ctx.closePath();
        ctx.fill();

        // Body panel/highlight lines
        ctx.strokeStyle = highlight;
        ctx.lineWidth = panelStroke;
        ctx.beginPath();
        ctx.moveTo(sx(190), sy(272));
        ctx.lineTo(sx(450), sy(272));
        ctx.lineTo(sx(640), sy(252));
        ctx.stroke();

        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(sx(450), sy(215));
        ctx.lineTo(sx(640), sy(215));
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(sx(450), sy(240));
        ctx.lineTo(sx(635), sy(235));
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(sx(310), sy(175));
        ctx.lineTo(sx(270), sy(195));
        ctx.lineTo(sx(210), sy(195));
        ctx.stroke();

        // Sponson
        ctx.fillStyle = dark;
        polySvg(ctx, [215, 260, 275, 260, 285, 260, 290, 248, 280, 245, 225, 245]);
        ctx.fill();

        // Cockpit windows
        ctx.fillStyle = windowColor;
        polySvg(ctx, [182, 216, 208, 198, 220, 198, 220, 230, 182, 226]);
        ctx.fill();
        ctx.strokeStyle = body;
        ctx.lineWidth = 2 * SCALE;
        polySvg(ctx, [182, 216, 208, 198, 220, 198, 220, 230, 182, 226]);
        ctx.stroke();

        ctx.fillStyle = windowColor;
        polySvg(ctx, [156, 237, 176, 230, 176, 252, 161, 257]);
        ctx.fill();

        // Crew window
        rr(ctx, sx(230), sy(202), 35 * SCALE, 35 * SCALE, 5 * SCALE);
        ctx.fillStyle = windowColor;
        ctx.fill();

        // Cargo door and windows
        rr(ctx, sx(275), sy(196), 85 * SCALE, 74 * SCALE, 3 * SCALE);
        ctx.strokeStyle = dark;
        ctx.lineWidth = roofStroke;
        ctx.stroke();

        rr(ctx, sx(285), sy(205), 28 * SCALE, 28 * SCALE, 4 * SCALE);
        ctx.fillStyle = windowColor;
        ctx.fill();
        rr(ctx, sx(322), sy(205), 28 * SCALE, 28 * SCALE, 4 * SCALE);
        ctx.fill();

        // Engine exhaust
        ctx.fillStyle = dark;
        polySvg(ctx, [380, 175, 420, 175, 415, 198, 390, 198]);
        ctx.fill();
        ctx.fillStyle = '#0f0f11';
        ctx.beginPath();
        ctx.ellipse(sx(417), sy(186), 6 * SCALE, 12 * SCALE, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stabilator
        ctx.fillStyle = dark;
        polySvg(ctx, [630, 240, 690, 230, 690, 242, 630, 250]);
        ctx.fill();

        // Sensors / mast details
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(sx(147), sy(245), 4 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(sx(255), sy(188), 5 * SCALE, 7 * SCALE);
        ctx.strokeStyle = dark;
        ctx.lineWidth = 2 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(425), sy(272));
        ctx.lineTo(sx(430), sy(283));
        ctx.lineTo(sx(435), sy(271));
        ctx.stroke();

        // Front landing gear
        ctx.strokeStyle = gear;
        ctx.lineCap = 'round';
        ctx.lineWidth = 5 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(235), sy(260));
        ctx.lineTo(sx(220), sy(310));
        ctx.stroke();

        ctx.lineWidth = 3 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(260), sy(262));
        ctx.lineTo(sx(220), sy(310));
        ctx.stroke();

        ctx.fillStyle = tire;
        ctx.beginPath();
        ctx.arc(sx(220), sy(310), 11 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(sx(220), sy(310), 4 * SCALE, 0, Math.PI * 2);
        ctx.fill();

        // Tail landing gear
        ctx.strokeStyle = gear;
        ctx.lineWidth = 3 * SCALE;
        ctx.beginPath();
        ctx.moveTo(sx(660), sy(265));
        ctx.lineTo(sx(670), sy(295));
        ctx.stroke();
        ctx.fillStyle = tire;
        ctx.beginPath();
        ctx.arc(sx(670), sy(295), 6 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(sx(670), sy(295), 2.5 * SCALE, 0, Math.PI * 2);
        ctx.fill();

        // Main rotor mast/hub static body pieces
        ctx.fillStyle = gear;
        ctx.fillRect(sx(333), sy(140), 14 * SCALE, 35 * SCALE);

        ctx.fillStyle = dark;
        polySvg(ctx, [320, 135, 360, 135, 355, 145, 325, 145]);
        ctx.fill();

        ctx.fillStyle = light;
        ctx.fillRect(sx(325), sy(145), 30 * SCALE, 5 * SCALE);
        ctx.fillStyle = gear;
        ctx.fillRect(sx(336), sy(129), 8 * SCALE, 5 * SCALE);

        // Team accent
        ctx.fillStyle = enemyPattern ? accent : accent2;
        ctx.fillRect(sx(275), sy(246), 78 * SCALE, 5 * SCALE);
        if (enemyPattern) {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.3 * SCALE;
            ctx.beginPath();
            ctx.moveTo(sx(362), sy(210));
            ctx.lineTo(sx(412), sy(228));
            ctx.moveTo(sx(360), sy(224));
            ctx.lineTo(sx(410), sy(239));
            ctx.stroke();
        }
    }

    globalScope.UnitRenderV2Body_blackhawk = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
