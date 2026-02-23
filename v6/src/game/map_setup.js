// src/game/map_setup.js - Map-specific building placement
(function () {
    'use strict';

    window.GameMapSetup = {
        apply(game) {
            if (!game) return;

            const rearX = 78;
            const forwardShift = 120;
            const frontX = 520 + forwardShift;
            const towerX = frontX + 450;
            const gy = Number(game.groundY);
            const laneBaseY = (typeof game.getGroundLaneBaseY === 'function')
                ? Number(game.getGroundLaneBaseY())
                : NaN;
            const desiredHqY = Number.isFinite(laneBaseY)
                ? (laneBaseY + 38)
                : ((Number.isFinite(gy) ? gy : 0) + 110);
            const maxHqY = Number.isFinite(Number(game.height))
                ? (Number(game.height) - 12)
                : desiredHqY;
            const hqY = Math.max(
                (Number.isFinite(gy) ? gy : 0) + 24,
                Math.min(maxHqY, desiredHqY)
            );

            const hasPlayerHQ = ((typeof Maps !== 'undefined') ? Maps.getRule('playerHQ') : true);
            const hasEnemyHQ = ((typeof Maps !== 'undefined') ? Maps.getRule('enemyHQ') : true);
            const hasPlayerDefense = ((typeof Maps !== 'undefined') ? Maps.getRule('playerDefense') : true);
            const hasEnemyDefense = ((typeof Maps !== 'undefined') ? Maps.getRule('enemyDefense') : true);
            const hasBunkers = ((typeof Maps !== 'undefined') ? Maps.getRule('bunkers') : true);

            if (hasPlayerHQ) {
                game.buildings.push(new Building('hq_player', rearX, hqY, 'player'));
            }

            if (hasPlayerDefense && game.settings && game.settings.includeForwardDefense) {
                const fortressExtraX = 180;
                const fortressX = frontX + fortressExtraX;
                game.buildings.push(new Building('fortress_player', fortressX, game.groundY, 'player'));
                game.buildings.push(new Building('watchtower', towerX, game.groundY, 'player'));
            }

            if (hasEnemyHQ) {
                game.buildings.push(new Building('hq_enemy', CONFIG.mapWidth - rearX, hqY, 'enemy'));
            }

            if (hasEnemyDefense && game.settings && game.settings.includeForwardDefense) {
                const fortressExtraX = 180;
                const fortressX = frontX + fortressExtraX;
                game.buildings.push(new Building('fortress_enemy', CONFIG.mapWidth - fortressX, game.groundY, 'enemy'));
                game.buildings.push(new Building('watchtower', CONFIG.mapWidth - towerX, game.groundY, 'enemy'));
            }

            if (hasBunkers) {
                const bunkerRatios = [0.3, 0.5, 0.7];
                bunkerRatios.forEach((ratio) => {
                    game.buildings.push(new Building('bunker', CONFIG.mapWidth * ratio, game.groundY, 'neutral'));
                });
            }

            if (typeof NewsIntro !== 'undefined') NewsIntro.hide();
            if (typeof NewsOverlay !== 'undefined') NewsOverlay.hide();
        }
    };
})();
