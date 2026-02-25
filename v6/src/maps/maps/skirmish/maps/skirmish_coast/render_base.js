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

    function drawEdgeSeal(ctx, width, height, cameraX, mapWidth, skyBottomY, groundTopY) {
        const mapEndS = sx(mapWidth, cameraX);
        if (mapEndS >= width) return;

        const extra = width - mapEndS + 4;
        if (extra <= 0) return;

        ctx.fillStyle = '#5f8396';
        ctx.fillRect(mapEndS, 0, extra, skyBottomY);

        ctx.fillStyle = '#927456';
        ctx.fillRect(mapEndS, skyBottomY, extra, Math.max(0, height - skyBottomY));

        ctx.fillStyle = '#567246';
        ctx.fillRect(mapEndS, groundTopY, extra, Math.max(0, height - groundTopY));
    }

    function renderBase(ctx, env) {
        if (!ctx || !env) return false;

        const width = Math.max(1, Number(env.width) || 1);
        const height = Math.max(1, Number(env.height) || 1);
        const groundY = Math.max(0, Number(env.groundY) || 0);
        const cameraX = Number(env.cameraX) || 0;
        const mapWidth = getMapWidth(width);

        const skyBottomY = Math.max(52, Math.min(height - 120, groundY + 18));
        const groundTopY = Math.max(skyBottomY + 8, Math.min(height - 40, groundY + 22));

        const skyGrad = ctx.createLinearGradient(0, 0, 0, skyBottomY);
        skyGrad.addColorStop(0, '#3f647b');
        skyGrad.addColorStop(1, '#6e94ab');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, skyBottomY);

        const sandGrad = ctx.createLinearGradient(0, skyBottomY, 0, height);
        sandGrad.addColorStop(0, '#9c7f62');
        sandGrad.addColorStop(1, '#7e634b');
        ctx.fillStyle = sandGrad;
        ctx.fillRect(0, skyBottomY, width, Math.max(0, height - skyBottomY));

        const coastTopX = Math.max(640, Math.floor(mapWidth * 0.24));
        const coastBottomX = Math.max(120, Math.floor(mapWidth * 0.045));
        const seaGrad = ctx.createLinearGradient(0, skyBottomY, 0, height);
        seaGrad.addColorStop(0, '#275c7d');
        seaGrad.addColorStop(1, '#2b7188');
        ctx.fillStyle = seaGrad;
        ctx.beginPath();
        ctx.moveTo(sx(0, cameraX), skyBottomY);
        ctx.lineTo(sx(coastTopX, cameraX), skyBottomY);
        ctx.lineTo(sx(coastBottomX, cameraX), height);
        ctx.lineTo(sx(0, cameraX), height);
        ctx.closePath();
        ctx.fill();

        const grassStartW = Math.max(1700, Math.floor(mapWidth * 0.64));
        const grassStartS = sx(grassStartW, cameraX);
        const mapEndS = sx(mapWidth, cameraX);
        ctx.fillStyle = '#5f7f4b';
        ctx.beginPath();
        ctx.moveTo(grassStartS - 220, groundTopY);
        ctx.lineTo(mapEndS, groundTopY - 26);
        ctx.lineTo(mapEndS, height);
        ctx.lineTo(grassStartS - 280, height);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(20, 26, 34, 0.14)';
        ctx.fillRect(0, 0, width, height);

        drawEdgeSeal(ctx, width, height, cameraX, mapWidth, skyBottomY, groundTopY);
        return true;
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('skirmish_coast', { hooks: { renderBase } });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'skirmish_coast',
            hooks: { renderBase }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
