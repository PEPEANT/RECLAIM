// Additional part rendering (tracks/turret/radar) for: aa_tank (SPAAG)
(function attachUnitRenderV2Parts_aa_tank(globalScope) {
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

        ctx.fillStyle = track;
        ctx.beginPath();
        ctx.moveTo(-60, -10);
        ctx.lineTo(60, -10);
        ctx.arc(60, 2.5, 12.5, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-60, 15);
        ctx.arc(-60, 2.5, 12.5, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-60, -10);
        ctx.lineTo(60, -10);
        ctx.arc(60, 2.5, 12.5, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-60, 15);
        ctx.arc(-60, 2.5, 12.5, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.clip();
        for (var i = -80; i < 80; i += 15) {
            var xPos = i + (offset % 15);
            ctx.beginPath();
            ctx.moveTo(xPos, -15);
            ctx.lineTo(xPos, 20);
            ctx.stroke();
        }
        ctx.restore();

        var wheelCount = 7;
        var wheelSpacing = 16.5;
        var startX = -50;
        for (var w = 0; w < wheelCount; w++) {
            var wx = startX + (w * wheelSpacing);
            ctx.save();
            ctx.translate(wx, 2);
            ctx.rotate(offset * 0.15);
            ctx.fillStyle = wheelOuter;
            ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = wheelInner;
            ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = hub;
            ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(62, -2);
        ctx.rotate(offset * 0.2);
        ctx.fillStyle = sprocket;
        for (var t = 0; t < 8; t++) {
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-2, -10, 4, 20);
        }
        ctx.fillStyle = wheelInner;
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(-62, -2);
        ctx.rotate(offset * 0.15);
        ctx.fillStyle = wheelOuter;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = wheelInner;
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hub;
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawTurret(ctx, state, palette) {
        if (!ctx) return;
        var p = palette || {};
        var main = p.main || '#4E5B31';
        var dark = p.dark || '#3D4825';
        var shadow = p.shadow || '#2C3519';
        var accent = p.accent || '#8b1e1e';
        var accent2 = p.accent2 || '#b91c1c';
        var enemyPattern = p.enemyPattern === true;

        var angle = Number(state && state.turretAngle);
        if (!Number.isFinite(angle)) angle = -Math.PI / 4;
        var recoil = Math.max(0, Number(state && state.recoil) || 0);
        var radarAngle = Number(state && state.radarAngle) || 0;
        var autoFlash = Math.max(0, Number(state && state.autoFlash) || 0);
        var samFlash = Math.max(0, Number(state && state.samFlash) || 0);
        var barrelToggle = !!(state && state.barrelToggle);

        ctx.save();
        ctx.translate(0, -30);

        // Radar mast + dish (independent spin).
        ctx.save();
        ctx.translate(-15, -15);
        ctx.fillStyle = '#222';
        ctx.fillRect(-2, -12, 4, 12);

        ctx.translate(0, -12);
        var radarScale = Math.max(0.12, Math.abs(Math.cos(radarAngle)));
        ctx.scale(radarScale, 1);
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(-15, -6);
        ctx.quadraticCurveTo(0, -10, 15, -6);
        ctx.lineTo(12, 2);
        ctx.lineTo(-12, 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(-1, -6, 2, 8);
        ctx.restore();

        // Turret body and guns.
        ctx.rotate(angle);

        ctx.save();
        ctx.translate(-recoil, 0);
        ctx.fillStyle = '#111';
        ctx.fillRect(15, -6, 30, 2);
        ctx.fillRect(45, -6.5, 6, 3);
        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(15, 4, 30, 2.5);
        ctx.fillRect(45, 3.5, 6, 3.5);
        ctx.fillStyle = dark;
        ctx.fillRect(10, -8, 15, 16);
        ctx.restore();

        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(-20, -15);
        ctx.lineTo(10, -15);
        ctx.lineTo(15, 0);
        ctx.lineTo(10, 8);
        ctx.lineTo(-20, 8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.moveTo(10, -15);
        ctx.lineTo(15, 0);
        ctx.lineTo(10, 8);
        ctx.lineTo(-20, 8);
        ctx.lineTo(-25, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = shadow;
        ctx.fillRect(-5, -12, 20, 8);
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(15, -10, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(15, -6, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.strokeRect(-5, -12, 20, 8);

        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(15, -15, 4, 0, Math.PI * 2); ctx.fill();

        if (enemyPattern) {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-20, -8);
            ctx.lineTo(-4, -11);
            ctx.moveTo(-20, -4);
            ctx.lineTo(-4, -7);
            ctx.stroke();
            ctx.fillStyle = accent2;
            ctx.fillRect(8, -11, 6, 2.5);
        }

        if (autoFlash > 0.03) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, autoFlash);
            var flashY = barrelToggle ? -5 : 5;
            ctx.fillStyle = '#6aff3d';
            ctx.beginPath();
            ctx.moveTo(51, flashY);
            ctx.lineTo(62, flashY - 2.2);
            ctx.lineTo(62, flashY + 2.2);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fff7cc';
            ctx.beginPath();
            ctx.moveTo(51, flashY);
            ctx.lineTo(58, flashY - 1.2);
            ctx.lineTo(58, flashY + 1.2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        if (samFlash > 0.03) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, samFlash);
            ctx.fillStyle = '#9ad9ff';
            ctx.beginPath();
            ctx.moveTo(18, -8);
            ctx.lineTo(26, -10.5);
            ctx.lineTo(26, -5.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    globalScope.UnitRenderV2Parts_aa_tank = {
        drawTracksAndWheels: drawTracksAndWheels,
        drawTurret: drawTurret
    };
})(typeof window !== 'undefined' ? window : globalThis);
