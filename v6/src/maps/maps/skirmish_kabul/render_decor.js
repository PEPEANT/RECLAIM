(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    function renderDecor(ctx, env) {
        const maps = env && env.maps;
        if (!ctx || !maps) return false;

        const width = env.width;
        const height = env.height;
        const groundY = env.groundY;
        const cameraX = env.cameraX || 0;
        const buffer = 200;

        const farX = cameraX * 0.1;
        ctx.save();
        ctx.translate(-farX, 0);
        maps.drawKabulMountains(ctx, farX - buffer, farX + width + buffer, groundY);
        ctx.restore();

        const cityX = cameraX * 0.3;
        ctx.save();
        ctx.translate(-cityX, 0);
        maps.drawKabulCity(ctx, cityX - buffer, cityX + width + buffer, groundY);
        ctx.restore();

        ctx.save();
        ctx.translate(-cameraX, 0);
        maps.drawKabulRoad(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        maps.drawKabulProps(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        ctx.restore();

        maps.drawKabulDust(ctx, width, height, cameraX);
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
