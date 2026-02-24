// Body rendering for: bomber
(function attachUnitRenderV2Body_bomber(globalScope) {
    'use strict';

    function poly(ctx, points) {
        if (!ctx || !Array.isArray(points) || points.length < 6) return;
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (var i = 2; i < points.length; i += 2) {
            ctx.lineTo(points[i], points[i + 1]);
        }
        ctx.closePath();
    }

    function drawBody(unit, ctx, state, palette, options) {
        if (!ctx || !palette) return;
        var iconMode = !!(options && options.iconMode === true);

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Upper tail root / vertical stabilizer base.
        ctx.fillStyle = palette.bodyDark;
        poly(ctx, [-41, -13, -52, -37, -61, -37, -53, -10]);
        ctx.fill();

        // Main fuselage.
        ctx.fillStyle = palette.bodyBase;
        ctx.beginPath();
        ctx.moveTo(72, 0);
        ctx.bezierCurveTo(64, -7, 46, -13, 27, -15);
        ctx.lineTo(10, -15);
        ctx.bezierCurveTo(-5, -15, -25, -14, -42, -10);
        ctx.lineTo(-55, -36);
        ctx.lineTo(-64, -36);
        ctx.lineTo(-55, -10);
        ctx.lineTo(-74, -7);
        ctx.lineTo(-77, 0);
        ctx.lineTo(-74, 7);
        ctx.lineTo(-57, 9);
        ctx.lineTo(-22, 10);
        ctx.bezierCurveTo(8, 10, 35, 8, 58, 4);
        ctx.closePath();
        ctx.fill();

        // Fuselage top lighting.
        ctx.save();
        ctx.globalAlpha = 0.46;
        ctx.fillStyle = palette.bodyLight;
        ctx.beginPath();
        ctx.moveTo(58, -3);
        ctx.bezierCurveTo(40, -8, 13, -10, -21, -9);
        ctx.lineTo(-14, -5);
        ctx.bezierCurveTo(11, -6, 37, -5, 55, -1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Cockpit window blocks.
        ctx.fillStyle = palette.canopy;
        poly(ctx, [48, -10, 59, -5, 56, -1, 44, -4]);
        ctx.fill();
        ctx.fillStyle = palette.canopyDark;
        poly(ctx, [42, -4, 51, -1, 48, 2, 38, 0]);
        ctx.fill();

        // Nose vanes and probe.
        ctx.fillStyle = palette.bodyDark;
        poly(ctx, [31, 2, 20, 8, 35, 8, 37, 3]);
        ctx.fill();
        ctx.strokeStyle = palette.bodyDark;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(72, 0);
        ctx.lineTo(82, 0);
        ctx.stroke();

        // Horizontal tailplane hint.
        ctx.fillStyle = palette.bodyDark;
        poly(ctx, [-52, -3, -64, -1, -58, 2, -45, 1]);
        ctx.fill();

        // Engine nacelles / intake / nozzle.
        ctx.fillStyle = palette.nacelle;
        ctx.beginPath();
        ctx.moveTo(-10, 10);
        ctx.lineTo(-25, 20);
        ctx.lineTo(-60, 20);
        ctx.lineTo(-72, 15);
        ctx.lineTo(-69, 9);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.intake;
        poly(ctx, [-9, 10, -19, 8, -26, 14, -14, 15]);
        ctx.fill();

        ctx.fillStyle = palette.nozzle;
        ctx.fillRect(-78, -2.8, 10, 5.6);
        ctx.strokeStyle = palette.bodyLight;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25;
        ctx.strokeRect(-78, -2.8, 10, 5.6);
        ctx.globalAlpha = 1;

        // Team accent.
        var accentTeam = String(unit && unit.team ? unit.team : 'player').trim().toLowerCase();
        if (globalScope.UnitRenderV2Palettes && typeof globalScope.UnitRenderV2Palettes.resolveLegacyTeam === 'function') {
            accentTeam = globalScope.UnitRenderV2Palettes.resolveLegacyTeam(accentTeam);
        }
        ctx.fillStyle = (accentTeam === 'enemy') ? palette.accentEnemy : palette.accent;
        ctx.fillRect(-5, -4, 13, 2.6);
        ctx.fillRect(-22, -1, 8, 1.9);

        // Panel lines.
        ctx.save();
        ctx.strokeStyle = palette.highlight;
        ctx.globalAlpha = iconMode ? 0.16 : 0.34;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(44, -4);
        ctx.lineTo(-36, -8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(25, 9);
        ctx.lineTo(-23, 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-52, -35);
        ctx.lineTo(-47, -10);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    globalScope['UnitRenderV2Body_bomber'] = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
