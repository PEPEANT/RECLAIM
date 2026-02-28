(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'landing',
        theme: {
            name: '상륙전 (Landing)',
            sky: '#465e75',
            skyMid: '#87ceeb',
            ground: '#3e342e',
            groundDark: '#2e2722'
        },
        rules: {
            playerHQ: false,
            enemyHQ: true,
            playerDefense: false,
            enemyDefense: true,
            bunkers: true,
            mapExpand: true,
            winCondition: 'hq_destroy'
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
