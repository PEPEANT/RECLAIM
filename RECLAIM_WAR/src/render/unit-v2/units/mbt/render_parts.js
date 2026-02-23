// Additional part rendering (turret/tracks/rotor/etc) for: mbt
(function attachUnitRenderV2Parts_mbt(globalScope) {
    'use strict';

    function drawTracksAndWheels(ctx, state, palette) {
        if (!ctx) return;
        var p = palette || {};
        var track = p.track || '#222';
        var wheelOuter = p.wheelOuter || '#151515';
        var wheelInner = p.wheelInner || '#3D4825';
        var hub = p.hub || '#222';
        var sprocket = p.sprocket || '#333';
        var offset = Number(state && state.trackOffset) || 0;

        // Track outer silhouette.
        ctx.fillStyle = track;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-80, -15, 160, 30, 15);
        } else {
            ctx.moveTo(-65, -15);
            ctx.lineTo(65, -15);
            ctx.arc(65, 0, 15, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(-65, 15);
            ctx.arc(-65, 0, 15, Math.PI / 2, -Math.PI / 2);
        }
        ctx.fill();

        // Track tread lines.
        ctx.save();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-80, -15, 160, 30, 15);
        } else {
            ctx.moveTo(-65, -15);
            ctx.lineTo(65, -15);
            ctx.arc(65, 0, 15, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(-65, 15);
            ctx.arc(-65, 0, 15, Math.PI / 2, -Math.PI / 2);
        }
        ctx.clip();
        for (var i = -90; i < 90; i += 12) {
            var xPos = i + (offset % 12);
            ctx.beginPath();
            ctx.moveTo(xPos, -20);
            ctx.lineTo(xPos, 15);
            ctx.stroke();
        }
        ctx.restore();

        // Road wheels
        var wheelCount = 7;
        var spacing = 18.5;
        var startX = -58;
        for (var idx = 0; idx < wheelCount; idx++) {
            var extra = idx > 0 ? 3 : 0;
            var wx = startX + (idx * spacing) + extra;
            ctx.save();
            ctx.translate(wx, 0);
            ctx.rotate(offset * 0.12);
            ctx.fillStyle = wheelOuter;
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = wheelInner;
            ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = hub;
            ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
            // Rotation marker so wheel motion is visible.
            ctx.fillStyle = '#101010';
            for (var b = 0; b < 4; b++) {
                ctx.rotate(Math.PI / 2);
                ctx.beginPath();
                ctx.arc(5.3, 0, 0.9, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Rear drive sprocket
        ctx.save();
        ctx.translate(-72, -5);
        ctx.rotate(offset * 0.15);
        ctx.fillStyle = sprocket;
        for (var t = 0; t < 8; t++) {
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-2, -12, 4, 24);
        }
        ctx.fillStyle = wheelInner;
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Front idler wheel
        ctx.save();
        ctx.translate(72, -5);
        ctx.rotate(offset * 0.12);
        ctx.fillStyle = wheelOuter;
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = wheelInner;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hub;
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawTurret(ctx, state, palette, options) {
        if (!ctx) return;
        var p = palette || {};
        var opts = options || {};
        var angle = Number(state && state.turretAngle);
        if (!Number.isFinite(angle)) angle = -0.1;
        var recoil = Math.max(0, Number(state && state.recoil) || 0);

        var main = p.main || '#4E5B31';
        var dark = p.dark || '#3D4825';
        var shadow = p.shadow || '#2C3519';
        var accent = p.accent || '#8b1e1e';
        var accent2 = p.accent2 || '#b91c1c';
        var enemyPattern = p.enemyPattern === true;

        ctx.save();
        ctx.translate(5, -30);
        ctx.rotate(angle);

        // Main gun (recoil)
        ctx.save();
        ctx.translate(-recoil, 0);
        ctx.fillStyle = shadow;
        ctx.fillRect(25, -6, 15, 12);

        ctx.fillStyle = dark;
        ctx.fillRect(40, -4, 70, 8);

        ctx.fillStyle = main;
        ctx.fillRect(60, -5.5, 20, 11);

        ctx.fillStyle = '#333';
        ctx.fillRect(105, -7, 4, 4);

        ctx.fillStyle = '#444';
        ctx.fillRect(108, -4.5, 4, 9);

        if (enemyPattern) {
            ctx.fillStyle = accent2;
            ctx.fillRect(78, -6.2, 5, 1.6);
            ctx.fillRect(86, -6.2, 5, 1.6);
        }
        ctx.restore();

        // Turret body
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.moveTo(-65, -12);
        ctx.lineTo(-65, 2);
        ctx.lineTo(-10, 8);
        ctx.lineTo(30, 8);
        ctx.lineTo(40, -2);
        ctx.lineTo(35, -8);
        ctx.lineTo(5, -15);
        ctx.lineTo(-60, -15);
        ctx.closePath();
        ctx.fill();

        if (enemyPattern) {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-52, -8);
            ctx.lineTo(-26, -12);
            ctx.moveTo(-48, -4);
            ctx.lineTo(-22, -8);
            ctx.stroke();
            ctx.fillStyle = accent2;
            ctx.fillRect(20, -7, 8, 2.5);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.moveTo(35, -8);
        ctx.lineTo(40, -2);
        ctx.lineTo(30, 8);
        ctx.lineTo(-10, 8);
        ctx.lineTo(5, -2);
        ctx.closePath();
        ctx.fill();

        // Bustle rack
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-65, -10); ctx.lineTo(-75, -10);
        ctx.moveTo(-65, -2); ctx.lineTo(-75, -2);
        ctx.moveTo(-75, -10); ctx.lineTo(-75, -2);
        for (var by = -10; by <= -2; by += 3) {
            ctx.moveTo(-65, by); ctx.lineTo(-75, by);
        }
        ctx.stroke();

        ctx.strokeStyle = shadow;
        ctx.beginPath();
        ctx.moveTo(-20, -15); ctx.lineTo(-20, 5);
        ctx.moveTo(-40, -14); ctx.lineTo(-40, 3);
        ctx.stroke();

        // Cupola and MG
        ctx.fillStyle = dark;
        ctx.fillRect(-5, -20, 14, 5);
        ctx.fillStyle = '#111';
        ctx.fillRect(-3, -19, 10, 2);

        ctx.fillStyle = '#222';
        ctx.fillRect(2, -24, 18, 2);
        ctx.fillRect(-2, -26, 8, 6);
        ctx.fillRect(-6, -24, 4, 2);
        ctx.fillRect(0, -28, 6, 2);

        if ((Number(state && state.mgFlash) || 0) > 0.05) {
            var flashAlpha = Math.min(1, Math.max(0, Number(state.mgFlash)));
            ctx.save();
            ctx.globalAlpha = flashAlpha;
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(20, -23);
            ctx.lineTo(30, -25);
            ctx.lineTo(30, -21);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Rear sensor and antennas
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-45, -15);
        ctx.lineTo(-45, -28);
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.fillRect(-47, -30, 4, 3);

        ctx.fillStyle = '#333';
        ctx.fillRect(-25, -18, 8, 3);
        ctx.fillRect(-20, -19, 10, 1.5);

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-55, -15); ctx.lineTo(-65, -45);
        ctx.moveTo(-60, -15); ctx.lineTo(-50, -40);
        ctx.stroke();

        ctx.restore();
    }

    globalScope.UnitRenderV2Parts_mbt = {
        drawTracksAndWheels: drawTracksAndWheels,
        drawTurret: drawTurret
    };
})(typeof window !== 'undefined' ? window : globalThis);
