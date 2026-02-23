(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    const RIDGE_FAR = [
        [0, 0], [260, -46], [540, -18], [900, -64], [1260, -24], [1540, -72],
        [1880, -22], [2220, -58], [2580, -20], [2940, -68], [3320, -30], [3680, -60],
        [4040, -24], [4400, -70], [4760, -26], [5120, -56], [5480, -20], [5860, -50], [6200, 0]
    ];

    const RIDGE_NEAR = [
        [0, 0], [210, -26], [420, -12], [700, -38], [980, -14], [1240, -44],
        [1520, -18], [1800, -34], [2080, -16], [2360, -40], [2660, -20], [2960, -32],
        [3280, -14], [3600, -36], [3920, -18], [4260, -30], [4620, -12], [5000, -34],
        [5400, -16], [5800, -28], [6200, 0]
    ];

    function getMapWidth(viewWidth) {
        const configured = Number(global.CONFIG && global.CONFIG.mapWidth);
        if (Number.isFinite(configured) && configured > 0) return configured;
        return Math.max(6200, Number(viewWidth) || 0);
    }

    function drawRidge(ctx, points, color, groundY, cameraX) {
        if (!Array.isArray(points) || points.length < 2) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[0][0] - cameraX, groundY + points[0][1]);
        for (let i = 1; i < points.length; i += 1) {
            ctx.lineTo(points[i][0] - cameraX, groundY + points[i][1]);
        }
        ctx.lineTo(points[points.length - 1][0] - cameraX, groundY);
        ctx.lineTo(points[0][0] - cameraX, groundY);
        ctx.closePath();
        ctx.fill();
    }

    function renderBase(ctx, env) {
        if (!ctx || !env) return false;

        const width = Math.max(1, Number(env.width) || 1);
        const height = Math.max(1, Number(env.height) || 1);
        const groundY = Math.max(0, Number(env.groundY) || 0);
        const cameraX = Number(env.cameraX) || 0;
        const mapWidth = getMapWidth(width);

        // Fixed sky.
        const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
        skyGrad.addColorStop(0, '#5f7486');
        skyGrad.addColorStop(0.62, '#8d8a81');
        skyGrad.addColorStop(1, '#b99f7e');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, groundY);

        // Fixed haze strip.
        ctx.fillStyle = 'rgba(210, 190, 160, 0.26)';
        ctx.fillRect(0, groundY - 56, width, 56);

        // Fixed mountain silhouettes (no procedural generation / no drift).
        drawRidge(ctx, RIDGE_FAR, '#5b605d', groundY, cameraX);
        drawRidge(ctx, RIDGE_NEAR, '#666865', groundY, cameraX);

        // Ground.
        const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
        groundGrad.addColorStop(0, '#3f4042');
        groundGrad.addColorStop(1, '#2a2b2d');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, width, height - groundY);

        // Fixed rubble speckles.
        const yPattern = [0, 2, 3, 1, 4, 2];
        const wPattern = [2, 3, 2, 4, 2, 3];
        ctx.fillStyle = 'rgba(180, 170, 145, 0.08)';
        for (let wx = 70, i = 0; wx < mapWidth - 20; wx += 74, i += 1) {
            const sx = wx - cameraX;
            if (sx < -12 || sx > width + 12) continue;
            const y = groundY + 8 + yPattern[i % yPattern.length];
            ctx.fillRect(sx, y, wPattern[i % wPattern.length], 2);
            if (i % 4 === 0) ctx.fillRect(sx + 10, y + 8, 3, 2);
        }

        return true;
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('skirmish_kabul', { hooks: { renderBase } });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'skirmish_kabul',
            hooks: { renderBase }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
