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
            const currentMapId = String(
                game.currentMapId
                || ((typeof Maps !== 'undefined' && Maps) ? Maps.currentMap : '')
                || ''
            ).trim();

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

            if (currentMapId === 'skirmish_coast') {
                const coastEmplacements = ((typeof Maps !== 'undefined') ? Maps.getRule('coastEmplacements') : null);
                if (Array.isArray(coastEmplacements) && coastEmplacements.length > 0) {
                    const mapW = Math.max(1000, Number(CONFIG.mapWidth) || 6000);
                    coastEmplacements.forEach((entry) => {
                        if (!entry || typeof entry !== 'object') return;

                        const type = String(entry.type || '').trim();
                        if (!type || !CONFIG || !CONFIG.buildings || !CONFIG.buildings[type]) return;

                        const teamRaw = String(entry.team || 'enemy').trim().toLowerCase();
                        const team = (teamRaw === 'player' || teamRaw === 'enemy' || teamRaw === 'neutral')
                            ? teamRaw
                            : 'enemy';

                        const xAbs = Number(entry.x);
                        const xRatio = Number(entry.xRatio);
                        const yAbs = Number(entry.y);
                        const yOffset = Number(entry.yOffset);
                        let worldX = Number.isFinite(xAbs)
                            ? xAbs
                            : (Number.isFinite(xRatio) ? mapW * xRatio : NaN);
                        if (!Number.isFinite(worldX)) return;
                        worldX = Math.max(80, Math.min(mapW - 80, worldX));
                        const worldY = Number.isFinite(yAbs)
                            ? yAbs
                            : (Number(game.groundY) + (Number.isFinite(yOffset) ? yOffset : 0));

                        const building = new Building(type, worldX, worldY, team);
                        building._coastEmplacement = true;
                        if (type === 'watchtower') {
                            building.width = Math.max(132, Number(building.width) || 0);
                            building.height = Math.max(78, Number(building.height) || 0);
                            const hpBoost = Math.max(1, Number(building.maxHp) || 1);
                            building.maxHp = Math.round(hpBoost * 1.15);
                            building.hp = building.maxHp;
                        }
                        const entryRangeMul = Number(entry.rangeMul);
                        const defaultRangeMul = (type === 'bunker') ? 2.65 : 1.9;
                        const rangeMul = (Number.isFinite(entryRangeMul) && entryRangeMul > 0)
                            ? entryRangeMul
                            : defaultRangeMul;
                        if (Number.isFinite(Number(building.range)) && Number(building.range) > 0) {
                            building.range = Math.max(120, Math.round(Number(building.range) * rangeMul));
                        }
                        if (type === 'bunker') {
                            building._destroyOnBreak = (entry.destroyOnBreak !== false);
                        }

                        if (type === 'bunker'
                            && Array.isArray(entry.garrison)
                            && entry.garrison.length > 0
                            && typeof Unit !== 'undefined') {
                            const cap = Math.max(1, Math.floor(Number(building.maxGarrison) || 7));
                            const garrisonUnits = [];
                            for (let i = 0; i < entry.garrison.length && garrisonUnits.length < cap; i += 1) {
                                const unitKey = String(entry.garrison[i] || '').trim();
                                if (!unitKey || !CONFIG.units || !CONFIG.units[unitKey]) continue;
                                try {
                                    const unit = new Unit(unitKey, worldX, game.groundY, team);
                                    if (!unit || unit.dead) continue;
                                    unit.commandMode = 'stop';
                                    unit.attackTarget = null;
                                    garrisonUnits.push(unit);
                                } catch (_) { }
                            }
                            if (garrisonUnits.length > 0) {
                                building.garrisonUnits = garrisonUnits;
                                building.garrisonUnit = garrisonUnits[0];
                            }
                        }

                        if (type === 'bunker'
                            && team === 'enemy'
                            && entry.staticGuard !== false
                            && typeof Unit !== 'undefined') {
                            const guardInfMinRaw = Number(entry.guardInfantryMin);
                            const guardInfMaxRaw = Number(entry.guardInfantryMax);
                            const guardRpgRaw = Number(entry.guardRpgCount);
                            const guardSniperRaw = Number(entry.guardSniperCount);

                            const guardInfMin = Number.isFinite(guardInfMinRaw) ? Math.max(0, Math.floor(guardInfMinRaw)) : 6;
                            const guardInfMax = Number.isFinite(guardInfMaxRaw) ? Math.max(guardInfMin, Math.floor(guardInfMaxRaw)) : 10;
                            const guardInfCount = guardInfMin + Math.floor(Math.random() * (guardInfMax - guardInfMin + 1));
                            const guardRpgCount = Number.isFinite(guardRpgRaw) ? Math.max(0, Math.floor(guardRpgRaw)) : 2;
                            const guardSniperCount = Number.isFinite(guardSniperRaw) ? Math.max(0, Math.floor(guardSniperRaw)) : 1;

                            const guardRpgKey = (CONFIG.units && CONFIG.units.rpg) ? 'rpg' : 'engineer';
                            const total = guardSniperCount + guardRpgCount + guardInfCount;
                            if (total > 0) {
                                const spawnList = [];
                                for (let i = 0; i < guardSniperCount; i += 1) spawnList.push('sniper');
                                for (let i = 0; i < guardRpgCount; i += 1) spawnList.push(guardRpgKey);
                                for (let i = 0; i < guardInfCount; i += 1) spawnList.push('infantry');

                                const cols = 3;
                                const spacingX = 56;
                                const spacingY = 36;
                                const originX = worldX + 128;
                                const originY = worldY + 34;

                                for (let i = 0; i < spawnList.length; i += 1) {
                                    const unitKey = String(spawnList[i] || '').trim();
                                    if (!unitKey || !CONFIG.units || !CONFIG.units[unitKey]) continue;
                                    const col = i % cols;
                                    const row = Math.floor(i / cols);
                                    const jitterX = (Math.random() * 28) - 14;
                                    const jitterY = (Math.random() * 20) - 10;
                                    const sx = originX + (col * spacingX) + jitterX;
                                    const sy = originY + (row * spacingY) + jitterY;

                                    try {
                                        const guard = new Unit(unitKey, sx, game.groundY, team);
                                        if (!guard || guard.dead) continue;
                                        guard.x = sx;
                                        guard.y = sy;
                                        guard.commandMode = 'stop';
                                        guard.returnToBase = false;
                                        guard.targetX = null;
                                        guard.targetY = sy;
                                        guard.commandTargetX = null;
                                        guard.attackTarget = null;
                                        guard._coastStaticGuard = true;
                                        guard._coastStaticGuardAnchorX = sx;
                                        guard._coastStaticGuardAnchorY = sy;
                                        guard.stats = {
                                            ...(guard.stats || {}),
                                            speed: 0,
                                            cannotCapture: true
                                        };
                                        if (guard.stats && guard.stats.category === 'infantry') {
                                            const roll = Math.random();
                                            let introStance = 'prone';
                                            if (roll < 0.68) introStance = 'prone';
                                            else if (roll < 0.95) introStance = 'crouching';
                                            else introStance = 'standing';
                                            guard._forcedInfantryStance = introStance;
                                            guard._forcedInfantryStanceUntil = 0;
                                            guard._coverReactionForcedStop = (introStance !== 'standing');
                                            guard._coverReactionSavedMode = 'attack';
                                        }
                                        if (!Array.isArray(game.enemies)) game.enemies = [];
                                        if (!game.enemies.includes(guard)) game.enemies.push(guard);
                                    } catch (_) { }
                                }
                            }
                        }

                        game.buildings.push(building);
                    });
                }
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
