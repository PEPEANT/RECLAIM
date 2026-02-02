// src/game/victory.js - Victory/defeat checks
(function () {
    'use strict';

    window.GameVictory = {
        check(game, elapsedSeconds, playerHQ, alivePlayerUnits, aliveEnemyUnits) {
            if (!game) return;

            const winCondition = (typeof Maps !== 'undefined') ? Maps.getRule('winCondition') : 'hq_destroy';
            const survivalTime = (typeof Maps !== 'undefined') ? Maps.getRule('survivalTime') : 600;

            if (winCondition !== 'hq_destroy' && winCondition !== 'survival' && winCondition !== 'annihilation') {
                return;
            }

            const canCheck = game.frame > 180; // 초반 3초간은 승리/패배 조건 체크 안 함
            const playerHasHQ = !!playerHQ;
            const playerWiped = game.playerEverSeen && alivePlayerUnits === 0;
            const enemyWiped = game.enemyEverSeen && aliveEnemyUnits === 0;
            const survived = elapsedSeconds >= survivalTime;

            if (!canCheck) return;

            if (enemyWiped) {
                game.endGame('win', '작전 성공', '적군을 모두 섬멸했습니다.');
            } else if (survived) {
                game.endGame('win', '작전 성공', `${Math.floor(survivalTime / 60)}분간 방어에 성공했습니다.`);
            } else if (!playerHasHQ && playerWiped) {
                game.endGame('lose', '작전 실패', '아군이 전멸했습니다.');
            }
        }
    };
})();
