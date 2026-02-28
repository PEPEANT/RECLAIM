(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'village',
        theme: {
            name: '마을 (Village)',
            sky: '#f0f9ff',
            ground: '#d97706',
            groundDark: '#b45309'
        },
        rules: {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: true,
            mapExpand: true,
            winCondition: 'hq_destroy'
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
