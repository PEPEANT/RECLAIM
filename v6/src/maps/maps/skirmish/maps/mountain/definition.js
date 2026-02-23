(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'mountain',
        theme: {
            name: '산악 (Mountain)',
            sky: '#bae6fd',
            ground: '#a8a29e',
            groundDark: '#78716c'
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
