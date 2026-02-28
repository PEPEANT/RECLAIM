// src/game/map_setup.js - Map-specific building placement and city setup
(function () {
    'use strict';

    window.GameMapSetup = {
        apply(game) {
            if (!game) return;

            const rearX = 120;  // HQ(?꾨갑)
            const forwardShift = 120;
            const frontX = 520 + forwardShift;
            const towerX = frontX + 450;

            const skirmishBattle = !!game._skirmishMode;
            const hasPlayerHQ = skirmishBattle
                ? false
                : ((typeof Maps !== 'undefined') ? Maps.getRule('playerHQ') : true);
            const hasEnemyHQ = skirmishBattle
                ? false
                : ((typeof Maps !== 'undefined') ? Maps.getRule('enemyHQ') : true);
            const hasPlayerDefense = skirmishBattle
                ? false
                : ((typeof Maps !== 'undefined') ? Maps.getRule('playerDefense') : true);
            const hasEnemyDefense = skirmishBattle
                ? false
                : ((typeof Maps !== 'undefined') ? Maps.getRule('enemyDefense') : true);
            const hasBunkers = skirmishBattle
                ? false
                : ((typeof Maps !== 'undefined') ? Maps.getRule('bunkers') : true);

            // ?꾧뎔 HQ
            if (hasPlayerHQ) {
                game.buildings.push(new Building('hq_player', rearX, game.groundY, 'player'));
            }

            // Player-side forward defenses
            if (hasPlayerDefense && game.settings && game.settings.includeForwardDefense) {
                const fortressExtraX = 180;
                const fortressX = frontX + fortressExtraX;
                game.buildings.push(new Building('fortress_player', fortressX, game.groundY, 'player'));
                game.buildings.push(new Building('watchtower', towerX, game.groundY, 'player'));
            }

            // ?곴뎔 HQ
            if (hasEnemyHQ) {
                game.buildings.push(new Building('hq_enemy', CONFIG.mapWidth - rearX, game.groundY, 'enemy'));
            }

            // Enemy-side forward defenses
            if (hasEnemyDefense && game.settings && game.settings.includeForwardDefense) {
                const fortressExtraX = 180;
                const fortressX = frontX + fortressExtraX;
                game.buildings.push(new Building('fortress_enemy', CONFIG.mapWidth - fortressX, game.groundY, 'enemy'));
                game.buildings.push(new Building('watchtower', CONFIG.mapWidth - towerX, game.groundY, 'enemy'));
            }

            // Neutral bunker placements
            if (hasBunkers) {
                const bunkerRatios = [0.3, 0.5, 0.7];
                bunkerRatios.forEach(ratio => {
                    const bunker = new Building('bunker', CONFIG.mapWidth * ratio, game.groundY, 'neutral');
                    if (typeof Maps !== 'undefined' && Maps.currentMap === 'city') {
                        if (Math.abs(ratio - 0.5) < 0.0001) {
                            bunker.variant = 'luxury';
                        } else if (Math.abs(ratio - 0.3) < 0.0001) {
                            bunker.variant = 'legacy';
                        } else if (Math.abs(ratio - 0.7) < 0.0001) {
                            bunker.variant = 'legacy';
                        }
                    }
                    game.buildings.push(bunker);
                });
            }

            // [CITY] Right-side defense line in front of the far bunker (player only)
            if (typeof Maps !== 'undefined' && Maps.currentMap === 'city') {
                const rightBunkerX = CONFIG.mapWidth * 0.7;
                const defenseOffset = 260;
                const defenseX = Math.min(CONFIG.mapWidth - 200, rightBunkerX + defenseOffset);
                const defense = new Building('defense_line', defenseX, game.groundY, 'player');

                const diff = (typeof AI !== 'undefined' && AI.difficulty) ? AI.difficulty : 'veteran';
                let hpScale = 1.0;
                let dmgScale = 1.0;
                if (diff === 'recruit') {
                    hpScale = 1.6;
                    dmgScale = 1.2;
                } else if (diff === 'elite') {
                    hpScale = 0.7;
                    dmgScale = 0.7;
                }
                defense.maxHp = Math.round(defense.maxHp * hpScale);
                defense.hp = defense.maxHp;
                defense.damage = Math.round(defense.damage * dmgScale);

                game.buildings.push(defense);
            }

            // City map civilians (manual spawn only)
            if (typeof Maps !== 'undefined' && Maps.currentMap === 'city') {
                if (typeof game.spawnCityCivilians === 'function') {
                    game.spawnCityCivilians();
                }
                // Ensure city news overlays are reset
                if (typeof NewsOverlay !== 'undefined') NewsOverlay.hide();
                if (typeof NewsIntro !== 'undefined') NewsIntro.hide();
            } else {
                if (typeof NewsIntro !== 'undefined') NewsIntro.hide();
                if (typeof NewsOverlay !== 'undefined') NewsOverlay.hide();
            }
        }
    };
})();
