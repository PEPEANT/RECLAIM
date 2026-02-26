// src/game/victory.js - Victory/defeat checks
(function () {
    'use strict';

    const CAPTURE_MAX = 100;
    const CAPTURE_SHOW_HOLD_FRAMES = 120;
    const PLAYER_FORCE_MIN_FOR_DEFEAT = 5;
    const COAST_PLAYER_FORCE_MAX_FOR_DEFEAT = 10;
    const COAST_MAP_ID = 'skirmish_coast';
    const CAMERA_EDGE_MARGIN = 12;
    const MAP_EDGE_CAPTURE_MARGIN = 16;
    const CAPTURE_BREACH_STEP = 20;
    const COAST_CAPTURE_BREACH_STEP = 34;

    function getSkirmishState(game) {
        const enabled = !!(game && game._skirmishMode);
        const apiReady = enabled && typeof SkirmishMode !== 'undefined' && SkirmishMode;
        const active = !!(apiReady && SkirmishMode.isActive);
        const phase = active ? String(SkirmishMode.phase || '') : '';
        const battle = active && phase === 'battle';
        const frozen = active && (phase === 'placement' || phase === 'countdown');
        return { enabled, active, battle, frozen };
    }

    function sumPositiveReserve(obj) {
        if (!obj || typeof obj !== 'object') return 0;
        let total = 0;
        for (const k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
            const v = Number(obj[k]);
            if (!Number.isFinite(v) || v <= 0) continue;
            total += Math.floor(v);
        }
        return total;
    }

    function getPlayerReserveCount(game) {
        if (!game || typeof game !== 'object') return 0;
        return (
            sumPositiveReserve(game.playerStock)
            + sumPositiveReserve(game.spawnQueue)
            + sumPositiveReserve(game.playerVeteranStock)
        );
    }

    function getCurrentMapId(game) {
        const gameMapId = String((game && game.currentMapId) || '').trim();
        if (gameMapId) return gameMapId;
        const mapsMapId = (typeof Maps !== 'undefined' && Maps && Maps.currentMap)
            ? String(Maps.currentMap).trim()
            : '';
        return mapsMapId;
    }

    function isCoastMap(game) {
        return getCurrentMapId(game) === COAST_MAP_ID;
    }

    function getLandingCraftStatus(game) {
        let state = null;
        const ctrl = game && game.landingIntroController;
        if (ctrl && typeof ctrl.getDebugState === 'function') {
            try {
                state = ctrl.getDebugState();
            } catch (_) { }
        }
        if ((!state || !Array.isArray(state.crafts)) && typeof window !== 'undefined') {
            const fallback = window.__RECLAIM_LANDING_INTRO_STATE__;
            if (fallback && Array.isArray(fallback.crafts)) {
                state = fallback;
            }
        }
        const crafts = Array.isArray(state && state.crafts) ? state.crafts : [];
        let total = 0;
        let destroyed = 0;
        for (let i = 0; i < crafts.length; i++) {
            const c = crafts[i];
            if (!c) continue;
            total += 1;
            const hp = Number(c.hp);
            const maxHp = Number(c.maxHp);
            const failedReason = String(c.failedReason || '').trim().toLowerCase();
            const destroyedFlag = c.destroyed === true
                || failedReason === 'destroyed'
                || (Number.isFinite(maxHp) && maxHp > 0 && Number.isFinite(hp) && hp <= 0);
            if (destroyedFlag) destroyed += 1;
        }
        return { total, destroyed, alive: Math.max(0, total - destroyed) };
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function isCaptureCountUnit(u) {
        if (!u || u.dead) return false;
        if (u.isCameraman) return false;
        if (u.stats && u.stats.civilian) return false;
        const x = Number(u.x);
        if (!Number.isFinite(x)) return false;
        return true;
    }

    function getViewBounds(game) {
        const left = Number(game && game.cameraX) || 0;
        let viewW = Number(game && game.width) || 0;
        if (typeof Camera !== 'undefined' && Camera && typeof Camera.viewW === 'function') {
            const cameraViewW = Number(Camera.viewW(game));
            if (Number.isFinite(cameraViewW) && cameraViewW > 0) {
                viewW = cameraViewW;
            }
        }
        if (!Number.isFinite(viewW) || viewW <= 0) viewW = 1280;
        return { left, right: left + viewW };
    }

    function getCaptureEdgeLines(game) {
        const mapW = Number(
            (typeof CONFIG !== 'undefined' && CONFIG && Number.isFinite(Number(CONFIG.mapWidth)))
                ? CONFIG.mapWidth
                : NaN
        );
        if (Number.isFinite(mapW) && mapW > 0) {
            return {
                leftOutLine: MAP_EDGE_CAPTURE_MARGIN,
                rightOutLine: mapW - MAP_EDGE_CAPTURE_MARGIN
            };
        }
        const bounds = getViewBounds(game);
        return {
            leftOutLine: bounds.left - CAMERA_EDGE_MARGIN,
            rightOutLine: bounds.right + CAMERA_EDGE_MARGIN
        };
    }

    function ensureCaptureControlState(game) {
        const frame = Number(game && game.frame) || 0;
        const mapId = (typeof Maps !== 'undefined' && Maps && Maps.currentMap)
            ? String(Maps.currentMap)
            : '';

        let state = game && game._captureControlState;
        const needsReset = !state
            || typeof state !== 'object'
            || state._mapId !== mapId
            || frame <= 1;

        if (!needsReset) return state;

        state = {
            _mapId: mapId,
            threshold: 1,
            enemyRisk: 0,
            playerCapture: 0,
            enemyCount: 0,
            playerCount: 0,
            displayMode: 'none',
            showUntilFrame: 0
        };
        if (game && typeof game === 'object') {
            game._captureControlState = state;
        }
        return state;
    }

    function countUnits(units, filterFn) {
        if (!Array.isArray(units) || typeof filterFn !== 'function') return 0;
        let count = 0;
        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (!isCaptureCountUnit(u)) continue;
            const x = Number(u.x);
            if (filterFn(x, u)) count++;
        }
        return count;
    }

    function consumeCaptureEdgeBreach(game) {
        if (!game || typeof game !== 'object') return { enemy: 0, player: 0 };
        if (!game._captureEdgeBreach || typeof game._captureEdgeBreach !== 'object') {
            game._captureEdgeBreach = { enemy: 0, player: 0 };
            return { enemy: 0, player: 0 };
        }
        const bag = game._captureEdgeBreach;
        const enemy = Math.max(0, Math.floor(Number(bag.enemy) || 0));
        const player = Math.max(0, Math.floor(Number(bag.player) || 0));
        bag.enemy = 0;
        bag.player = 0;
        return { enemy, player };
    }

    function updateCaptureControlState(game) {
        const state = ensureCaptureControlState(game);
        const frame = Number(game && game.frame) || 0;
        const breach = consumeCaptureEdgeBreach(game);
        const breachStep = isCoastMap(game) ? COAST_CAPTURE_BREACH_STEP : CAPTURE_BREACH_STEP;

        const enemyCount = Math.max(0, Math.floor(Number(breach.enemy) || 0));
        const playerCount = Math.max(0, Math.floor(Number(breach.player) || 0));
        state.enemyCount = enemyCount;
        state.playerCount = playerCount;

        // Event-based capture only: one unit breach = +20%.
        if (breach.enemy > 0) {
            state.enemyRisk = clamp(
                Number(state.enemyRisk || 0) + (breach.enemy * breachStep),
                0,
                CAPTURE_MAX
            );
        }
        if (breach.player > 0) {
            state.playerCapture = clamp(
                Number(state.playerCapture || 0) + (breach.player * breachStep),
                0,
                CAPTURE_MAX
            );
        }

        // Overlay should pulse on new breach events only, then fade out.
        // Do not extend visibility every frame from accumulated percentage values.
        if (enemyCount > 0 || playerCount > 0) {
            state.showUntilFrame = frame + CAPTURE_SHOW_HOLD_FRAMES;
        }

        if (enemyCount > 0 && (playerCount <= 0 || enemyCount >= playerCount)) {
            state.displayMode = 'enemy';
        } else if (playerCount > 0) {
            state.displayMode = 'player';
        } else if (state.enemyRisk > state.playerCapture + 0.5) {
            state.displayMode = 'enemy';
        } else if (state.playerCapture > state.enemyRisk + 0.5) {
            state.displayMode = 'player';
        } else if (state.enemyRisk <= 0.1 && state.playerCapture <= 0.1) {
            state.displayMode = 'none';
        }

        return state;
    }

    function countCoastAliveEnemyCombatUnits(game) {
        const list = (game && Array.isArray(game.enemies)) ? game.enemies : [];
        const mapW = Number(
            (typeof CONFIG !== 'undefined' && CONFIG && Number.isFinite(Number(CONFIG.mapWidth)))
                ? CONFIG.mapWidth
                : NaN
        );
        let alive = 0;
        for (let i = 0; i < list.length; i++) {
            const u = list[i];
            if (!u || u.dead) continue;
            if (u.isCameraman) continue;
            const stats = u.stats || null;
            if (stats && stats.civilian === true) continue;
            const x = Number(u.x);
            if (!Number.isFinite(x)) continue;
            const isAir = !!(stats && stats.type === 'air');
            if (isAir && Number.isFinite(mapW) && mapW > 0) {
                if (x < -260 || x > (mapW + 260)) continue;
            }
            alive += 1;
        }
        return alive;
    }

    window.GameVictory = {
        check(game, elapsedSeconds, playerHQ, alivePlayerUnits, aliveEnemyUnits) {
            if (!game || game.isGameOver) return;
            ensureCaptureControlState(game);
            if (!Object.prototype.hasOwnProperty.call(game, '_enemyHQWasPresent')) {
                game._enemyHQWasPresent = false;
            }
            if (!Object.prototype.hasOwnProperty.call(game, '_skirmishObjectiveWatchtowerWasPresent')) {
                game._skirmishObjectiveWatchtowerWasPresent = false;
            }

            const mapApi = (typeof Maps !== 'undefined' && Maps) ? Maps : null;
            const rawWinCondition = (mapApi && typeof mapApi.getRule === 'function')
                ? mapApi.getRule('winCondition')
                : 'hq_destroy';
            const winCondition = (rawWinCondition === 'survival' || rawWinCondition === 'annihilation')
                ? rawWinCondition
                : 'hq_destroy';
            const survivalRule = (mapApi && typeof mapApi.getRule === 'function')
                ? mapApi.getRule('survivalTime')
                : 600;
            const survivalTime = Math.max(1, Number(survivalRule) || 600);

            const skirmish = getSkirmishState(game);
            const skirmishBattle = skirmish.battle;
            const skirmishData = (game._skirmishData && typeof game._skirmishData === 'object')
                ? game._skirmishData
                : null;
            const requireEnemyWatchtowerDestroyed = !!(
                skirmishBattle
                && skirmishData
                && skirmishData.requireEnemyWatchtowerDestroyed === true
            );

            // Placement/countdown phase에서는 승패 판정을 하지 않는다.
            if (skirmish.frozen) return;
            // Track whether enemy HQ ever existed before early-frame gate.
            const enemyHQAny = (game.buildings || []).find(b => b && b.type === 'hq_enemy');
            const enemyWatchtowerAny = (game.buildings || []).find(
                (b) => b && b.team === 'enemy' && b.type === 'watchtower'
            );
            if (enemyHQAny) {
                game._enemyHQWasPresent = true;
            }
            if (enemyWatchtowerAny) {
                game._skirmishObjectiveWatchtowerWasPresent = true;
            }

            const minFramesBeforeCheck = skirmishBattle ? 45 : 180;
            if ((Number(game.frame) || 0) <= minFramesBeforeCheck) return;

            const playerReserveCount = getPlayerReserveCount(game);
            const playerTotalRemaining = Math.max(0, Number(alivePlayerUnits) || 0) + playerReserveCount;
            const playerWiped = (alivePlayerUnits <= 0)
                && (game.playerEverSeen || skirmishBattle)
                && playerTotalRemaining < PLAYER_FORCE_MIN_FOR_DEFEAT;
            const coastMap = isCoastMap(game);
            const coastBattleStarted = !!(
                game.playerEverSeen
                || (Number(alivePlayerUnits) > 0)
            );
            const coastPlayerWiped = coastBattleStarted
                && playerTotalRemaining <= COAST_PLAYER_FORCE_MAX_FOR_DEFEAT;

            const enemyHQExists = !!enemyHQAny;
            const enemyHQDestroyed = enemyHQExists
                ? (enemyHQAny.dead || enemyHQAny.destroying || enemyHQAny.hp <= 0)
                : (winCondition === 'hq_destroy' && !!game._enemyHQWasPresent);

            const enemyWiped = (aliveEnemyUnits <= 0) && (game.enemyEverSeen || skirmishBattle);
            const coastEnemyAlive = coastMap ? countCoastAliveEnemyCombatUnits(game) : aliveEnemyUnits;
            const coastEnemyWiped = coastMap
                ? ((coastEnemyAlive <= 0) && (game.enemyEverSeen || skirmishBattle))
                : enemyWiped;
            const survived = elapsedSeconds >= survivalTime;

            const captureState = updateCaptureControlState(game);
            if (coastMap) {
                if (captureState && Number(captureState.playerCapture) >= CAPTURE_MAX) {
                    game.endGame('win', '작전 성공', '적 전선을 돌파해 점령도 100%를 달성했습니다.');
                    return;
                }
                if (coastEnemyWiped) {
                    game.endGame('win', '작전 성공', '적 부대를 모두 섬멸했습니다.');
                    return;
                }
                if (coastPlayerWiped) {
                    game.endGame(
                        'lose',
                        '작전 실패',
                        `아군 전력이 임계치 이하입니다. (잔여 전력 ${playerTotalRemaining}기)`
                    );
                    return;
                }
                return;
            }

            if (captureState) {
                const enemyCaptureDone = Number(captureState.enemyRisk) >= CAPTURE_MAX;
                const playerCaptureDone = Number(captureState.playerCapture) >= CAPTURE_MAX;
                if (enemyCaptureDone || playerCaptureDone) {
                    if (playerCaptureDone && (!enemyCaptureDone || captureState.playerCapture >= captureState.enemyRisk)) {
                        game.endGame('win', '작전 성공', '점령도 100% 달성으로 승리했습니다.');
                    } else {
                        game.endGame('lose', '작전 실패', '점령 위험도 100% 도달로 패배했습니다.');
                    }
                    return;
                }
            }

            if (winCondition === 'hq_destroy' && enemyHQDestroyed) {
                game.endGame('win', '작전 성공', '적 HQ를 파괴했습니다.');
            } else if (enemyWiped) {
                game.endGame('win', '작전 성공', '적 부대를 모두 섬멸했습니다.');
            } else if (winCondition === 'survival' && survived) {
                game.endGame('win', '작전 성공', `${Math.floor(survivalTime / 60)}분 방어에 성공했습니다.`);
            } else if (playerWiped) {
                game.endGame(
                    'lose',
                    '작전 실패',
                    `아군 전력이 고갈되었습니다. (잔여 전력 ${playerTotalRemaining}기)`
                );
            }
        }
    };
})();
