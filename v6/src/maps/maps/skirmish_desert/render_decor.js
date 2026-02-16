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

        const cityX = cameraX * 0.22;
        ctx.save();
        ctx.translate(-cityX, 0);
        maps.drawSkirmishDesertCity(ctx, cityX - buffer, cityX + width + buffer, groundY);
        ctx.restore();

        const duneX = cameraX * 0.12;
        ctx.save();
        ctx.translate(-duneX, 0);
        maps.drawSkirmishDesertDunes(ctx, duneX - buffer, duneX + width + buffer, groundY);
        ctx.restore();

        ctx.save();
        ctx.translate(-cameraX, 0);
        maps.drawSkirmishDesertProps(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        ctx.restore();

        maps.drawSkirmishDesertDust(ctx, width, height, cameraX);
        return true;
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('skirmish_desert', { hooks: { renderDecor } });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'skirmish_desert',
            hooks: { renderDecor }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
