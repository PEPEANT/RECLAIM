(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    const BLOCK_PATTERN = [
        { w: 58, h: 36, gap: 24 },
        { w: 72, h: 54, gap: 22 },
        { w: 64, h: 46, gap: 26 },
        { w: 52, h: 62, gap: 20 },
        { w: 86, h: 40, gap: 28 },
        { w: 60, h: 52, gap: 24 },
        { w: 76, h: 44, gap: 24 }
    ];

    function getMapWidth(viewWidth) {
        const configured = Number(global.CONFIG && global.CONFIG.mapWidth);
        if (Number.isFinite(configured) && configured > 0) return configured;
        return Math.max(6200, Number(viewWidth) || 0);
    }

    function drawCitySilhouette(ctx, width, groundY, cameraX, mapWidth) {
        ctx.fillStyle = '#4a4d4f';

        let wx = 120;
        let idx = 0;
        while (wx < mapWidth - 140) {
            const shape = BLOCK_PATTERN[idx % BLOCK_PATTERN.length];
            const sx = wx - cameraX;
            if (sx + shape.w >= -40 && sx <= width + 40) {
                ctx.fillRect(sx, groundY - shape.h, shape.w, shape.h);

                ctx.fillStyle = 'rgba(230, 220, 180, 0.25)';
                ctx.fillRect(sx + 7, groundY - shape.h + 10, 3, 3);
                ctx.fillRect(sx + 18, groundY - shape.h + 15, 3, 3);
                if (shape.w > 66) ctx.fillRect(sx + shape.w - 15, groundY - shape.h + 12, 3, 3);
                ctx.fillStyle = '#4a4d4f';
            }

            wx += shape.w + shape.gap;
            idx += 1;
        }
    }

    function drawRoadAndProps(ctx, width, groundY, cameraX, mapWidth) {
        // Road band.
        ctx.fillStyle = '#323336';
        ctx.fillRect(0, groundY + 22, width, 30);

        // Fixed dashed lane marks.
        ctx.fillStyle = 'rgba(210, 205, 170, 0.45)';
        for (let wx = 110; wx < mapWidth - 40; wx += 110) {
            const sx = wx - cameraX;
            if (sx < -50 || sx > width + 20) continue;
            ctx.fillRect(sx, groundY + 36, 36, 3);
        }

        // Fixed street poles.
        ctx.strokeStyle = '#2a2b2d';
        ctx.lineWidth = 2;
        for (let wx = 240, i = 0; wx < mapWidth - 100; wx += 210, i += 1) {
            const sx = wx - cameraX;
            if (sx < -20 || sx > width + 20) continue;
            const h = (i % 2 === 0) ? 36 : 24;
            ctx.beginPath();
            ctx.moveTo(sx, groundY + 22);
            ctx.lineTo(sx, groundY + 22 - h);
            ctx.stroke();
            ctx.fillStyle = '#3a3b3d';
            ctx.fillRect(sx - 8, groundY + 20, 16, 4);
        }

        // Fixed roadside barriers.
        ctx.fillStyle = '#3e3f41';
        for (let wx = 180, i = 0; wx < mapWidth - 80; wx += 300, i += 1) {
            const sx = wx - cameraX;
            if (sx < -28 || sx > width + 28) continue;
            const top = groundY + 18;
            const h = (i % 3 === 0) ? 6 : 5;
            ctx.fillRect(sx - 14, top, 28, h);
        }
    }

    function renderDecor(ctx, env) {
        if (!ctx || !env) return false;

        const width = Math.max(1, Number(env.width) || 1);
        const groundY = Math.max(0, Number(env.groundY) || 0);
        const cameraX = Number(env.cameraX) || 0;
        const mapWidth = getMapWidth(width);

        drawCitySilhouette(ctx, width, groundY, cameraX, mapWidth);
        drawRoadAndProps(ctx, width, groundY, cameraX, mapWidth);
        return true;
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('skirmish_kabul', { hooks: { renderDecor } });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'skirmish_kabul',
            hooks: { renderDecor }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
