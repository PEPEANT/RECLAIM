// Additional part rendering (turret/tracks/rotor/etc) for: spg
(function attachUnitRenderV2Parts_spg(globalScope) {
    'use strict';

    function drawTracksAndWheels(ctx, state, palette) {
        if (!ctx) return;
        var p = palette || {};
        var track = p.track || '#1a1a1a';
        var wheelOuter = p.wheelOuter || '#151515';
        var wheelInner = p.wheelInner || '#324016';
        var hub = p.hub || '#111';
        var offset = Number(state && state.trackOffset) || 0;

        ctx.fillStyle = track;
        ctx.beginPath();
        ctx.moveTo(-65, -15);
        ctx.lineTo(65, -15);
        ctx.arc(65, 0, 15, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-65, 15);
        ctx.arc(-65, 0, 15, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.save();
        ctx.clip();
        for (var i = -90; i < 90; i += 15) {
            var xPos = i + (offset % 15);
            ctx.beginPath();
            ctx.moveTo(xPos, -20);
            ctx.lineTo(xPos, 15);
            ctx.stroke();
        }
        ctx.restore();

        var wheelCount = 6;
        var spacing = 22;
        var startX = -55;
        for (var idx = 0; idx < wheelCount; idx++) {
            ctx.save();
            ctx.translate(startX + (idx * spacing), 0);
            ctx.rotate(offset * 0.12);

            ctx.fillStyle = wheelOuter;
            ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = wheelInner;
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = hub;
            ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }
    }

    function drawTurret(ctx, state, palette) {
        if (!ctx) return;
        var p = palette || {};
        var base = p.base || '#4A5D23';
        var dark = p.dark || '#324016';
        var shadow = p.shadow || '#212B0E';
        var gunAngle = Number(state && state.gunAngle);
        if (!Number.isFinite(gunAngle)) gunAngle = -Math.PI / 12;
        var recoil = Math.max(0, Number(state && state.recoil) || 0);

        // Main gun first (drawn behind turret shell).
        ctx.save();
        ctx.translate(10, -61);
        ctx.rotate(gunAngle);
        ctx.translate(-recoil, 0);

        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.arc(0, 0, 10, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-20, 10);
        ctx.lineTo(-20, -10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = dark;
        ctx.fillRect(0, -4.5, 155, 9);
        ctx.fillStyle = base;
        ctx.fillRect(70, -6, 25, 12);

        ctx.fillStyle = '#222';
        ctx.fillRect(145, -7, 14, 14);
        ctx.fillStyle = '#555';
        ctx.fillRect(147, -8, 3, 16);
        ctx.fillRect(152, -8, 3, 16);
        ctx.restore();

        // Turret shell.
        ctx.save();
        ctx.translate(-35, -38);
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(-50, -35);
        ctx.lineTo(-50, 0);
        ctx.lineTo(40, 0);
        ctx.lineTo(45, -15);
        ctx.lineTo(30, -35);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.moveTo(45, -15);
        ctx.lineTo(40, 0);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-5, -15);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = dark;
        ctx.fillRect(-20, -40, 20, 5);
        ctx.fillRect(10, -38, 15, 3);
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-18, -39, 6, 2);

        ctx.restore();
    }

    globalScope.UnitRenderV2Parts_spg = {
        drawTracksAndWheels: drawTracksAndWheels,
        drawTurret: drawTurret
    };
})(typeof window !== 'undefined' ? window : globalThis);

