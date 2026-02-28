(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'forest',
        theme: {
            name: '숲 (Forest)',
            sky: '#4a7c59',
            skyMid: '#2d5a3d',
            ground: '#2d5a27',
            groundDark: '#1a3d15'
        },
        rules: {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: true,
            mapExpand: true,
            winCondition: 'annihilation'
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
