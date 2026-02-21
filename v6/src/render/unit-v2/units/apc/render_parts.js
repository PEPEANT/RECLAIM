// Additional part rendering (tracks/turret) for: apc (M2 Bradley IFV)
(function attachUnitRenderV2Parts_apc(globalScope) {
    'use strict';

    function drawTracksAndWheels(ctx, state, palette) {
        if (!ctx) return;
        var p = palette || {};
        var track = p.track || '#1f1f1f';
        var wheelOuter = p.wheelOuter || '#151515';
        var wheelInner = p.wheelInner || '#3D4825';
        var hub = p.hub || '#222';
        var sprocket = p.sprocket || '#333';
        var offset = Number(state && state.trackOffset) || 0;

        // Track outer hull.
        ctx.fillStyle = track;
        ctx.beginPath();
        ctx.moveTo(-72, -15);
        ctx.lineTo(72, -15);
        ctx.arc(72, 0, 15, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-72, 15);
        ctx.arc(-72, 0, 15, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        // Track links motion.
        ctx.strokeStyle = '#0f0f0f';
        ctx.lineWidth = 1.9;
        ctx.save();
        ctx.clip();
        for (var i = -84; i < 86; i += 12) {
            var xPos = i + (offset % 12);
            ctx.beginPath();
            ctx.moveTo(xPos, -18);
            ctx.lineTo(xPos, 14);
            ctx.stroke();
        }
        ctx.restore();

        // 6 road wheels.
        var wheelXs = [-50, -30, -10, 10, 30, 50];
        for (var wi = 0; wi < wheelXs.length; wi++) {
            var wx = wheelXs[wi];
            ctx.save();
            ctx.translate(wx, 1);
            ctx.fillStyle = wheelOuter;
            ctx.beginPath();
            ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = wheelInner;
            ctx.beginPath();
            ctx.arc(0, 0, 7.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = hub;
            ctx.beginPath();
            ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Front idler.
        ctx.save();
        ctx.translate(72, -4);
        ctx.fillStyle = wheelOuter;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = wheelInner;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Rear drive sprocket.
        ctx.save();
        ctx.translate(-72, -4);
        ctx.fillStyle = sprocket;
        for (var t = 0; t < 8; t++) {
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-2, -12, 4, 24);
        }
        ctx.fillStyle = wheelInner;
        ctx.beginPath();
        ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hub;
        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
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
        var recoil = Math.max(0, Number(state && state.recoil) || 0);
        var autoFlash = Math.max(0, Number(state && state.autoFlash) || 0);
        var towFlash = Math.max(0, Number(state && state.towFlash) || 0);
        if (!Number.isFinite(angle)) angle = -0.08;

        ctx.save();
        ctx.translate(0, -35);
        ctx.rotate(angle);

        // Turret shell.
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(-32, -10);
        ctx.lineTo(-32, 4);
        ctx.lineTo(20, 6);
        ctx.lineTo(30, 0);
        ctx.lineTo(25, -9);
        ctx.lineTo(4, -14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.moveTo(6, -6);
        ctx.lineTo(28, -1);
        ctx.lineTo(20, 6);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fill();

        // 25mm cannon and mantlet.
        ctx.save();
        ctx.translate(-recoil, 0);
        ctx.fillStyle = shadow;
        ctx.fillRect(20, -5, 14, 10);
        ctx.fillStyle = dark;
        ctx.fillRect(34, -2.8, 48, 5.6);
        ctx.fillStyle = '#222';
        ctx.fillRect(79, -3.2, 7, 6.4);
        ctx.restore();

        // TOW launcher pod.
        ctx.save();
        ctx.translate(4, -11);
        ctx.fillStyle = dark;
        ctx.fillRect(-3, -6, 26, 12);
        ctx.fillStyle = '#222';
        ctx.fillRect(20, -6, 3, 12);
        ctx.fillStyle = '#111';
        ctx.fillRect(1, -6, 3, 12);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(16, -6, 2, 12);
        ctx.restore();

        // Optics.
        ctx.fillStyle = '#111';
        ctx.fillRect(-4, -16, 9, 5);
        ctx.fillStyle = enemyPattern ? '#fb7185' : '#7dd3fc';
        ctx.fillRect(1, -15, 2, 3);

        if (enemyPattern) {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-20, -7);
            ctx.lineTo(-3, -9);
            ctx.moveTo(-19, -3);
            ctx.lineTo(-2, -5);
            ctx.stroke();
            ctx.fillStyle = accent2;
            ctx.fillRect(-26, -4, 5, 2);
        }

        if (autoFlash > 0.03) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, autoFlash);
            ctx.fillStyle = '#ffcc55';
            ctx.beginPath();
            ctx.moveTo(86, -2.5);
            ctx.lineTo(96, -5.5);
            ctx.lineTo(96, 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff8a00';
            ctx.beginPath();
            ctx.moveTo(86, -2.2);
            ctx.lineTo(92, -4.3);
            ctx.lineTo(92, -0.1);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        if (towFlash > 0.03) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, towFlash);
            ctx.fillStyle = '#ffd27a';
            ctx.beginPath();
            ctx.moveTo(24, -12);
            ctx.lineTo(33, -14.5);
            ctx.lineTo(33, -9.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff8a00';
            ctx.beginPath();
            ctx.moveTo(24, -12);
            ctx.lineTo(30, -13.2);
            ctx.lineTo(30, -10.8);
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
