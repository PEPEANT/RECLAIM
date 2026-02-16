(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'skirmish_desert',
        theme: {
            name: '사막 도시 (Desert City)',
            sky: '#40a8c4',
            skyMid: '#dcedc1',
            ground: '#e3b768',
            groundDark: '#c69c55'
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
