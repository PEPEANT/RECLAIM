(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'city',
        theme: {
            name: '도시 (City)',
            sky: '#cbd5e1',
            skyMid: '#8fb7e0',
            ground: '#475569',
            groundDark: '#334155'
        },
        rules: {
            playerHQ: true,
            enemyHQ: false,
            playerDefense: true,
            enemyDefense: false,
            bunkers: true,
            mapExpand: true,
            winCondition: 'survival',
            survivalTime: 720
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
