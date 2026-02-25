(function (global) {
    'use strict';

    if (!global || !global.MapRegistry || typeof global.MapRegistry.registerMapDefinition !== 'function') {
        return;
    }

    global.MapRegistry.registerMapDefinition({
        id: 'skirmish_coast',
        theme: {
            name: 'Coast',
            sky: '#6eaed2',
            skyMid: '#91c9df',
            ground: '#b58e63',
            groundDark: '#8c6a47'
        },
        rules: {
            playerHQ: false,
            enemyHQ: false,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false,
            winCondition: 'annihilation',
            mapWidth: 8200,
            groundLift: 140,
            landingIntro: {
                enabled: true,
                initialCrafts: 8,
                staggerSec: 0,
                arrivalRandomMinSec: 0,
                arrivalRandomMaxSec: 2.8,
                approachSpeed: 230,
                approachSec: 6.2,
                beachSec: 1.5,
                rampOpenSec: 1.7,
                holdSec: 12,
                timeoutSec: 25,
                startX: -110,
                beachStartX: 900,
                beachGapX: -132,
                beachGapY: 84,
                baseYOffset: 38,
                craftScale: 1,
                craftHp: 2200,
                enemyPressureDps: 17,
                damageRadiusX: 300,
                damageRadiusY: 180
            },
            playerSpawnX: 980,
            playerRetreatStopX: 800
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
