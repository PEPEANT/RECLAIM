(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    function renderBase(ctx, env) {
        const maps = env && env.maps;
        if (!ctx || !maps) return false;
        maps.drawSkirmishDesertSky(ctx, env.width, env.height, env.cameraX || 0);
        maps.drawSkirmishDesertGround(ctx, env.width, env.height, env.groundY);
        return true;
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('skirmish_desert', { hooks: { renderBase } });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'skirmish_desert',
            hooks: { renderBase }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
