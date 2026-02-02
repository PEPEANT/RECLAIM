// src/game/victory.js - Victory/defeat checks
(function () {
    'use strict';

    window.GameVictory = {
        check(game, elapsedSeconds, playerHQ, alivePlayerUnits, aliveEnemyUnits) {
            if (!game) return;

            const winCondition = (typeof Maps !== 'undefined') ? Maps.getRule('winCondition') : 'hq_destroy';
            const survivalTime = (typeof Maps !== 'undefined') ? Maps.getRule('survivalTime') : 600;
            const currentMap = (typeof Maps !== 'undefined') ? Maps.currentMap : null;

            if (winCondition !== 'hq_destroy' && winCondition !== 'survival' && winCondition !== 'annihilation') {
                return;
            }

            const canCheck = game.frame > 180; // 초반 3초간은 승리/패배 조건 체크 안 함
            const playerHasHQ = !!playerHQ;
            const playerWiped = game.playerEverSeen && alivePlayerUnits === 0;

            const enemyHQAny = (game.buildings || []).find(b => b && b.type === 'hq_enemy');
            const enemyHQExists = !!enemyHQAny;
            const enemyHQDestroyed = enemyHQExists && (enemyHQAny.dead || enemyHQAny.destroying || enemyHQAny.hp <= 0);

            // [FIX] 적 전멸 조건 강화: 도시맵에서 540초(9분) 이전 + 총공세 미발동 시 전멸 승리 금지
            let enemyWiped = game.enemyEverSeen && aliveEnemyUnits === 0;
            if (currentMap === 'city') {
                // 총공세 전이면 아직 증원 예정이므로 전멸 승리 금지
                if (!game.totalWarTriggered && elapsedSeconds < 540) {
                    enemyWiped = false;
                }
            }
            const survived = elapsedSeconds >= survivalTime;

            const allowWipeWinWhenNoHQRule = (typeof Maps !== 'undefined' && Maps.getRule)
                ? Maps.getRule('allowWipeWinWhenNoHQ')
                : undefined;
            const allowWipeWinWhenNoHQ = (allowWipeWinWhenNoHQRule == null) ? true : !!allowWipeWinWhenNoHQRule;
            const allowEnemyWipeWin = (winCondition !== 'hq_destroy') || (!enemyHQExists && allowWipeWinWhenNoHQ);

            if (!canCheck) return;

            if (winCondition === 'hq_destroy' && enemyHQExists && enemyHQDestroyed) {
                game.endGame('win', '작전 성공', '적군 총사령부를 파괴했습니다.');
            } else if (allowEnemyWipeWin && enemyWiped) {
                game.endGame('win', '작전 성공', '적군을 모두 섬멸했습니다.');
            } else if (winCondition === 'survival' && survived) {
                game.endGame('win', '작전 성공', `${Math.floor(survivalTime / 60)}분간 방어에 성공했습니다.`);
            } else if (!playerHasHQ && playerWiped) {
                game.endGame('lose', '작전 실패', '아군이 전멸했습니다.');
            }
        }
    };
})();
