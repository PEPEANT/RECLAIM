(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    function renderBase(ctx, env) {
        const maps = env && env.maps;
        if (!ctx || !maps) return false;
        maps.drawKabulSky(ctx, env.width, env.height);
        maps.drawKabulGround(ctx, env.width, env.height, env.groundY);
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
