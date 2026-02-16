(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    function renderBase(ctx, env) {
        const maps = env && env.maps;
        if (!ctx || !maps) return false;
        maps.drawLandingSky(ctx, env.width, env.height);
        maps.drawLandingOcean(ctx, env.width, env.height, env.groundY, env.cameraX || 0);
        return true;
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('landing', { hooks: { renderBase } });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'landing',
            hooks: { renderBase }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
