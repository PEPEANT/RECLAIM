(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    const MIN_COAST_MAP_WIDTH = 8200;

    function getMapWidth(viewWidth) {
        const configured = Number(global.CONFIG && global.CONFIG.mapWidth);
        if (Number.isFinite(configured) && configured > 0) return configured;
        return Math.max(MIN_COAST_MAP_WIDTH, Number(viewWidth) || 0);
    }

    function sx(worldX, cameraX) {
        return worldX - cameraX;
    }

    function drawSimpleBlocks(ctx, width, groundY, cameraX, mapWidth) {
        const start = Math.max(980, Math.floor(mapWidth * 0.32));
        const end = Math.max(start + 700, Math.floor(mapWidth * 0.56));

        for (let wx = start, i = 0; wx < end; wx += 520, i += 1) {
            const x = sx(wx, cameraX);
            if (x < -150 || x > width + 150) continue;

            const w = (i % 2 === 0) ? 120 : 100;
            const h = (i % 2 === 0) ? 74 : 62;
            const yOffset = 18;

            ctx.fillStyle = '#5a656c';
            ctx.fillRect(x, groundY - h + yOffset, w, h);

            ctx.fillStyle = 'rgba(228, 235, 238, 0.30)';
            ctx.fillRect(x + 12, groundY - h + 16 + yOffset, 12, 6);
            ctx.fillRect(x + 38, groundY - h + 22 + yOffset, 12, 6);
            ctx.fillRect(x + 64, groundY - h + 16 + yOffset, 12, 6);
        }
    }

    function drawSimpleTrees(ctx, width, groundY, cameraX, mapWidth) {
        const start = Math.max(1700, Math.floor(mapWidth * 0.66));
        for (let wx = start, i = 0; wx < mapWidth - 40; wx += 420, i += 1) {
            const x = sx(wx, cameraX);
            if (x < -80 || x > width + 80) continue;

            const crownW = 18 + (i % 3) * 6;
            const crownH = 11 + (i % 2) * 4;
            const yJitter = (i % 2 === 0) ? -4 : 2;
            const yOffset = 16;

            ctx.fillStyle = '#6d543c';
            ctx.fillRect(x - 2, groundY - 24 + yJitter + yOffset, 4, 24);

            ctx.fillStyle = '#5ea05a';
            ctx.beginPath();
            ctx.ellipse(x, groundY - 30 + yJitter + yOffset, crownW, crownH, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function renderDecor(ctx, env) {
        if (!ctx || !env) return false;

        const width = Math.max(1, Number(env.width) || 1);
        const groundY = Math.max(0, Number(env.groundY) || 0);
        const cameraX = Number(env.cameraX) || 0;
        const mapWidth = getMapWidth(width);

        drawSimpleBlocks(ctx, width, groundY, cameraX, mapWidth);
        drawSimpleTrees(ctx, width, groundY, cameraX, mapWidth);
        return true;
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('skirmish_coast', { hooks: { renderDecor } });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'skirmish_coast',
            hooks: { renderDecor }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
