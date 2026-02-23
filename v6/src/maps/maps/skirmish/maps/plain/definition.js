(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'plain',
        theme: {
            name: '평원 (Plains)',
            sky: '#87CEEB',
            ground: '#4ade80',
            groundDark: '#16a34a'
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
