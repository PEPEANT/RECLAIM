// Additional part rendering (tracks/turret) for: apc (M2 Bradley IFV)
(function attachUnitRenderV2Parts_apc(globalScope) {
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

    function drawSingleWheel(ctx, x, y, radius, angle, wheelOuter, wheelInner, hub) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.fillStyle = wheelOuter;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = wheelInner;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, radius - 2), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = hub;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        for (var j = 0; j < 4; j++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.arc(Math.max(1, radius - 5), 0, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawTracksAndWheels(ctx, state, palette) {
        if (!ctx) return;
        var p = palette || {};
        var track = p.track || '#1a1a1a';
        var wheelOuter = p.wheelOuter || '#151515';
        var wheelInner = p.wheelInner || '#3D4825';
        var hub = p.hub || '#222';
        var sprocket = p.sprocket || '#333';
        var offset = Number(state && state.trackOffset) || 0;

        // Reference model baseline converted to V2 feet baseline (y - 15).
        var trackX = -70;
        var trackY = -12;
        var trackWidth = 140;
        var trackHeight = 28;

        // Track inner volume.
        ctx.fillStyle = '#0a0a0a';
        rr(ctx, trackX, trackY, trackWidth, trackHeight, 13);
        ctx.fill();

        // Idler/drive + road wheels.
        drawSingleWheel(ctx, trackX + 12, trackY + 13, 8.5, offset * 0.15, wheelOuter, wheelInner, hub);
        drawSingleWheel(ctx, trackX + trackWidth - 12, trackY + 11, 9.5, offset * 0.15, wheelOuter, wheelInner, hub);

        var wheelY = trackY + trackHeight - 10.5 - 3;
        for (var i = 0; i < 5; i++) {
            var wx = trackX + 32 + i * 19;
            drawSingleWheel(ctx, wx, wheelY, 10.5, offset * 0.2, wheelOuter, wheelInner, hub);
        }

        // Track link texture.
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);
        ctx.lineDashOffset = -offset;
        rr(ctx, trackX, trackY, trackWidth, trackHeight, 13);
        ctx.stroke();
        ctx.setLineDash([]);

        // Front drive gear teeth highlight.
        ctx.save();
        ctx.translate(trackX + trackWidth - 12, trackY + 11);
        ctx.rotate(offset * 0.15);
        ctx.fillStyle = sprocket;
        for (var t = 0; t < 8; t++) {
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-1.4, -11, 2.8, 22);
        }
        ctx.restore();
    }

    function drawTurret(ctx, state, palette) {
        if (!ctx) return;
        var p = palette || {};
        var base = p.base || '#4E5B31';
        var dark = p.dark || '#3D4825';
        var shadow = p.shadow || '#2C3519';
        var accent = p.accent || '#8b1e1e';
        var accent2 = p.accent2 || '#b91c1c';
        var enemyPattern = p.enemyPattern === true;

        var angle = Number(state && state.turretAngle);
        if (!Number.isFinite(angle)) angle = -0.08;
        var recoil = Math.max(0, Number(state && state.recoil) || 0);
        var autoFlash = Math.max(0, Number(state && state.autoFlash) || 0);
        var towFlash = Math.max(0, Number(state && state.towFlash) || 0);

        ctx.save();
        ctx.translate(-5, -27);
        ctx.rotate(angle);

        // Main 25mm gun with recoil.
        ctx.save();
        ctx.translate(-recoil, 0);
        ctx.fillStyle = '#333';
        ctx.fillRect(0, -3, 65, 6);
        ctx.fillStyle = '#222';
        ctx.fillRect(10, -4, 25, 8);
        ctx.fillRect(60, -4, 6, 8);
        ctx.restore();

        // Turret shell.
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(25, 8);
        ctx.lineTo(15, -12);
        ctx.lineTo(-20, -12);
        ctx.lineTo(-30, 0);
        ctx.lineTo(-25, 10);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = shadow;
        ctx.lineWidth = 1;
        ctx.strokeRect(-15, -10, 15, 8);

        // Sight.
        ctx.fillStyle = '#111';
        ctx.fillRect(12, -15, 8, 6);
        ctx.fillStyle = enemyPattern ? '#fb7185' : '#5599ff';
        ctx.fillRect(18, -14, 2, 4);

        // Antenna.
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-20, -12);
        ctx.lineTo(-35, -45);
        ctx.stroke();

        // TOW launcher pod.
        ctx.save();
        ctx.translate(-10, -16);
        ctx.fillStyle = '#6E5C47';
        rr(ctx, -15, -8, 32, 14, 2);
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#333';
        rr(ctx, -15, -8, 32, 14, 2);
        ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.fillRect(15, -6, 3, 10);
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(12, -7, 2, 12);
        ctx.restore();

        if (enemyPattern) {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-22, -8);
            ctx.lineTo(-6, -10);
            ctx.moveTo(-21, -4);
            ctx.lineTo(-5, -6);
            ctx.stroke();
            ctx.fillStyle = accent2;
            ctx.fillRect(-25, -2, 5, 2);
        }

        if (autoFlash > 0.03) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, autoFlash);
            ctx.fillStyle = '#ffcc55';
            ctx.beginPath();
            ctx.moveTo(66, -3);
            ctx.lineTo(76, -6);
            ctx.lineTo(76, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff8a00';
            ctx.beginPath();
            ctx.moveTo(66, -2.6);
            ctx.lineTo(72, -4.5);
            ctx.lineTo(72, -0.7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        if (towFlash > 0.03) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, towFlash);
            ctx.fillStyle = '#ffd27a';
            ctx.beginPath();
            ctx.moveTo(8, -22);
            ctx.lineTo(16, -24.5);
            ctx.lineTo(16, -19.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff8a00';
            ctx.beginPath();
            ctx.moveTo(8, -22);
            ctx.lineTo(13, -23.2);
            ctx.lineTo(13, -20.8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    globalScope.UnitRenderV2Parts_apc = {
        drawTracksAndWheels: drawTracksAndWheels,
        drawTurret: drawTurret
    };
})(typeof window !== 'undefined' ? window : globalThis);
