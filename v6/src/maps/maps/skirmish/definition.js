(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'skirmish',
        theme: {
            name: '국지전 (Skirmish)',
            sky: '#87CEEB',
            skyMid: '#b0d4e8',
            ground: '#4ade80',
            groundDark: '#16a34a'
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
