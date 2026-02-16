(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'fortress',
        theme: {
            name: '요새 (Fortress)',
            sky: '#8b8589',
            skyMid: '#6b6569',
            ground: '#5a524e',
            groundDark: '#3d3533'
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
