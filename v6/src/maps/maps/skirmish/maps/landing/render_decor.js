(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    function renderDecor(ctx, env) {
        const maps = env && env.maps;
        if (!ctx || !maps) return false;

        const width = env.width;
        const groundY = env.groundY;
        const cameraX = env.cameraX || 0;
        const buffer = 200;

        const pX = cameraX * 0.15;
        ctx.save();
        ctx.translate(-pX, 0);
        maps.drawLandingSmokeClouds(ctx, pX - buffer, pX + width + buffer, groundY);
        ctx.restore();

        const pX2 = cameraX * 0.25;
        ctx.save();
        ctx.translate(-pX2, 0);
        maps.drawLandingRuins(ctx, pX2 - buffer, pX2 + width + buffer, groundY);
        ctx.restore();

        ctx.save();
        ctx.translate(-cameraX, 0);
        maps.drawLandingBeach(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        ctx.restore();
        return true;
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('landing', { hooks: { renderDecor } });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'landing',
            hooks: { renderDecor }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
