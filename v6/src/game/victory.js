// src/game/victory.js - Victory/defeat checks
(function () {
    'use strict';

    function getSkirmishState(game) {
        const enabled = !!(game && game._skirmishMode);
        const apiReady = enabled && typeof SkirmishMode !== 'undefined' && SkirmishMode;
        const active = !!(apiReady && SkirmishMode.isActive);
        const phase = active ? String(SkirmishMode.phase || '') : '';
        const battle = active && phase === 'battle';
        const frozen = active && (phase === 'placement' || phase === 'countdown');
        return { enabled, active, battle, frozen };
    }

    window.GameVictory = {
        check(game, elapsedSeconds, playerHQ, alivePlayerUnits, aliveEnemyUnits) {
            if (!game || game.isGameOver) return;
            if (!Object.prototype.hasOwnProperty.call(game, '_enemyHQWasPresent')) {
                game._enemyHQWasPresent = false;
            }
            if (!Object.prototype.hasOwnProperty.call(game, '_skirmishObjectiveWatchtowerWasPresent')) {
                game._skirmishObjectiveWatchtowerWasPresent = false;
            }

            const mapApi = (typeof Maps !== 'undefined' && Maps) ? Maps : null;
            const currentMap = mapApi ? Maps.currentMap : null;
            const campaignBattleTab = String(game._campaignBattleTab || '').trim().toLowerCase();
            const stageId = Math.floor(Number(game.activeCampaignStageId) || 0);
            const isOccupationFinalStage = (campaignBattleTab === 'occupation' && stageId === 7);
            const rawWinCondition = (mapApi && typeof mapApi.getRule === 'function')
                ? mapApi.getRule('winCondition')
                : 'hq_destroy';
            // Occupation campaign generally uses HQ destroy, except final command stage (id: 7).
            const effectiveRawWinCondition = (
                isOccupationFinalStage
            )
                ? 'survival'
                : (
                    campaignBattleTab === 'occupation'
                && (rawWinCondition === 'annihilation' || rawWinCondition === 'survival')
            )
                ? 'hq_destroy'
                : rawWinCondition;
            const winCondition = (effectiveRawWinCondition === 'survival' || effectiveRawWinCondition === 'annihilation')
                ? effectiveRawWinCondition
                : 'hq_destroy';
            const survivalRule = (mapApi && typeof mapApi.getRule === 'function')
                ? mapApi.getRule('survivalTime')
                : 600;
            const survivalTime = isOccupationFinalStage
                ? 600
                : Math.max(1, Number(survivalRule) || 600);

            const skirmish = getSkirmishState(game);
            const skirmishBattle = skirmish.battle;
            const skirmishData = (game._skirmishData && typeof game._skirmishData === 'object')
                ? game._skirmishData
                : null;
            const requireEnemyWatchtowerDestroyed = !!(
                skirmishBattle
                && campaignBattleTab === 'skirmish'
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

            const playerHasHQ = !!playerHQ;
            const playerWiped = (alivePlayerUnits <= 0) && (game.playerEverSeen || skirmishBattle);

            const enemyHQExists = !!enemyHQAny;
            const enemyHQDestroyed = enemyHQExists
                ? (enemyHQAny.dead || enemyHQAny.destroying || enemyHQAny.hp <= 0)
                : (winCondition === 'hq_destroy' && !!game._enemyHQWasPresent);
            const watchtowerObjectiveCleared = !requireEnemyWatchtowerDestroyed
                || (
                    game._skirmishObjectiveWatchtowerWasPresent === true
                    && !enemyWatchtowerAny
                );

            let enemyWiped = (aliveEnemyUnits <= 0) && (game.enemyEverSeen || skirmishBattle);
            if (currentMap === 'city' && !game.totalWarTriggered && elapsedSeconds < 540) {
                enemyWiped = false;
            }
            const survived = elapsedSeconds >= survivalTime;

            const allowWipeWinWhenNoHQRule = (mapApi && typeof mapApi.getRule === 'function')
                ? mapApi.getRule('allowWipeWinWhenNoHQ')
                : undefined;
            const allowWipeWinWhenNoHQ = (allowWipeWinWhenNoHQRule == null) ? true : !!allowWipeWinWhenNoHQRule;
            const allowEnemyWipeWin = !isOccupationFinalStage && (
                (campaignBattleTab === 'occupation')
                || (winCondition !== 'hq_destroy')
                || (!enemyHQExists && allowWipeWinWhenNoHQ)
            );

            if (skirmishBattle) {
                let breachedCount = 0;
                const breachLine = 50;
                (game.enemies || []).forEach(u => {
                    if (u && !u.dead && u.x <= breachLine) breachedCount++;
                });
                if (breachedCount >= 2) {
                    game.endGame('lose', '작전 실패', '적 유닛이 방어선을 돌파했습니다!');
                    return;
                }
            }

            if (winCondition === 'hq_destroy' && enemyHQDestroyed) {
                game.endGame('win', '작전 성공', '적 HQ를 파괴했습니다.');
            } else if (allowEnemyWipeWin && enemyWiped && watchtowerObjectiveCleared) {
                game.endGame('win', '작전 성공', '적 부대를 모두 섬멸했습니다.');
            } else if (winCondition === 'survival' && survived) {
                game.endGame('win', '작전 성공', `${Math.floor(survivalTime / 60)}분 방어에 성공했습니다.`);
            } else if (!playerHasHQ && playerWiped) {
                game.endGame('lose', '작전 실패', '아군 부대가 전멸했습니다.');
            }
        }
    };
})();
