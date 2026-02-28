(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'skirmish_kabul',
        theme: {
            name: '카불 시가지 (Kabul)',
            sky: '#6E8594',
            skyMid: '#9e9789',
            ground: '#3b3d3f',
            groundDark: '#2a2b2d'
        },
        rules: {
            playerHQ: false,
            enemyHQ: false,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false,
            winCondition: 'annihilation'
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
