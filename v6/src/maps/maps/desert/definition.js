(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'desert',
        theme: {
            name: '사막 (Desert)',
            sky: '#f4a460',
            skyMid: '#daa06d',
            ground: '#c2b280',
            groundDark: '#a08c5a'
        },
        rules: {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: false,
            mapExpand: true,
            winCondition: 'annihilation'
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
