(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
    // ==========================
    // [NEW] AI 거점/웨이브 시스템
    // ==========================
    _getWaypoints() {
        // 적 본진 기준으로 “정지/정비”할 지점들
        const hq = game.buildings.find(b => b.type === 'hq_enemy' && !b.dead);
        const fort = game.buildings.find(b => b.type === 'fortress_enemy' && !b.dead);

        const baseX = hq ? hq.x : (CONFIG.mapWidth - 140);
        const fortX = fort ? fort.x : (CONFIG.mapWidth - 420);

        // 뒤쪽(본진 수비), 중간(정비), 전진(공세 시작) 3~4개
        return [
            { name: 'BASE', x: baseX - 40 },
            { name: 'FORT', x: fortX - 60 },
            { name: 'MID', x: Math.max(260, fortX - 420) },
            { name: 'FRONT', x: Math.max(340, fortX - 520) },
        ];
    },

    _hasEnemyAnchor() {
        const hq = game.buildings.find(b => b && !b.dead && b.type === 'hq_enemy');
        const fort = game.buildings.find(b => b && !b.dead && b.type === 'fortress_enemy');
        return !!(hq || fort);
    },

    _getAssaultTargetX() {
        const playerHQ = game.buildings.find(b => b && !b.dead && b.type === 'hq_player');
        if (playerHQ) return Math.max(220, Math.min(CONFIG.mapWidth - 180, playerHQ.x + 180));

        const playerFrontB = (game.playerBuildings || []).find(b => b && !b.dead && b.team === 'player');
        if (playerFrontB) return Math.max(220, Math.min(CONFIG.mapWidth - 180, playerFrontB.x + 140));

        const players = game.players || [];
        let sum = 0;
        let cnt = 0;
        for (let i = 0; i < players.length; i++) {
            const u = players[i];
            if (!u || u.dead) continue;
            sum += u.x;
            cnt++;
        }
        if (cnt > 0) {
            const avg = sum / cnt;
            return Math.max(220, Math.min(CONFIG.mapWidth - 180, avg + 120));
        }

        return Math.max(260, Math.floor((CONFIG.mapWidth || 6000) * 0.35));
    },

    _getUnitCommandOffset(u, bucket, spread = 80) {
        if (!u) return 0;
        if (!u._aiOffsets || typeof u._aiOffsets !== 'object') u._aiOffsets = {};
        const key = String(bucket || 'default');
        if (!Number.isFinite(u._aiOffsets[key])) {
            u._aiOffsets[key] = (Math.random() * spread) - (spread * 0.5);
        }
        return u._aiOffsets[key];
    },

    _orderAssaultTo(xTarget) {
        for (const u of game.enemies) {
            if (!u || u.dead) continue;
            if (u.stats && u.stats.id === 'icbm_enemy') {
                u.commandMode = 'stop';
                u.returnToBase = false;
                u.commandTargetX = null;
                u.targetX = null;
                continue;
            }
            // 거점 소실 이후에는 공세를 멈추지 않도록 지속 전진/교전 모드 유지
            u.commandMode = 'attack';
            u.returnToBase = false;
            u.commandTargetX = null;
            u.targetX = null;
        }
    },

    _assessThreat(wps) {
        // [BUGFIX] Guard against empty wps array
        if (!wps || wps.length === 0) return { playerPush: 0, enemyFront: 0, shouldRetreat: false };

        // 전선 기준(대충 FRONT 근처)에서 양측 병력 수 비교
        const frontX = wps[wps.length - 1].x;

        const countNear = (arr, xMin, xMax) => {
            let c = 0;
            for (const u of arr) {
                if (!u || u.dead) continue;
                if (u.x >= xMin && u.x <= xMax) c++;
            }
            return c;
        };

        // 플레이어가 적 진영 쪽으로 밀고 들어온 숫자
        const playerPush = countNear(game.players, frontX - 220, frontX + 280);
        // 적 전선 병력
        const enemyFront = countNear(game.enemies, frontX - 260, frontX + 320);

        // “몰려온다” 감지: 플레이어가 7명 이상이거나, 적 대비 1.6배 이상
        const outnumbered = (playerPush >= 7) || (playerPush >= Math.ceil(enemyFront * 1.6) && playerPush >= 4);

        // 초반이면 더 예민하게 후퇴
        const early = (game.frame < 60 * 70);
        const shouldStabilize = early ? (outnumbered || playerPush >= 6) : outnumbered;

        return { playerPush, enemyFront, shouldRetreat: shouldStabilize, shouldStabilize };
    },

    _orderHoldAt(x, radius = 300) {
        // 거점 주변에 모여서 stop(방어)
        for (const u of game.enemies) {
            if (!u || u.dead) continue;
            if (u.stats && u.stats.id === 'icbm_enemy') {
                u.commandMode = 'stop';
                u.targetX = null;
                u.commandTargetX = null;
                continue;
            }

            // 이미 전방으로 밀고 들어간 유닛은 뒤로 당기지 않는다 (교착/왕복 방지)
            if (u.x < x - 120) {
                u.commandMode = 'attack';
                u.targetX = null;
                u.commandTargetX = null;
                continue;
            }

            // 너무 멀리 떨어진 애들은 모이고, 근처 애들은 정지
            if (Math.abs(u.x - x) > radius) {
                const holdX = x + this._getUnitCommandOffset(u, 'hold', 100);
                u.commandMode = 'move';
                u.commandTargetX = holdX;
                u.targetX = u.commandTargetX;
            } else {
                u.commandMode = 'stop';
                u.targetX = null;
                u.commandTargetX = null;
            }
        }
    },

    _orderRetreatTo(xBack) {
        for (const u of game.enemies) {
            if (!u || u.dead) continue;
            if (u.stats && u.stats.id === 'icbm_enemy') {
                u.commandMode = 'stop';
                u.targetX = null;
                u.commandTargetX = null;
                continue;
            }

            // 전선에 있는 애들만 후퇴(너무 뒤에 있는 애는 유지)
            if (u.x > xBack - 220) continue;

            // 안전모드에서는 retreat 대신 후방 집결 move로 처리
            u.commandMode = 'move';
            u.returnToBase = false;

            u.targetX = xBack + this._getUnitCommandOffset(u, 'retreat', 70);
            u.commandTargetX = u.targetX;
        }
    },

    _orderPushTo(xNext, xHold) {
        // 거점 수비 비율: 초반엔 높게, 후반엔 낮게
        const early = (game.frame < 60 * 70);
        const keepRatio = early ? 0.45 : 0.25;

        // 적 유닛을 섞어서 남김(탱크/지상 우선 남기고 공중은 전진시키는 것도 가능)
        const units = game.enemies.filter(u => u && !u.dead);
        const keepCount = Math.floor(units.length * keepRatio);

        // 랜덤 셔플(간단)
        for (let i = units.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [units[i], units[j]] = [units[j], units[i]];
        }

        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (u.stats && u.stats.id === 'icbm_enemy') {
                u.commandMode = 'stop';
                u.targetX = null;
                u.commandTargetX = null;
                continue;
            }

            // 거점 수비조
            if (i < keepCount) {
                const holdX = xHold + this._getUnitCommandOffset(u, 'defend', 100);
                if (Math.abs(u.x - xHold) > 260) {
                    u.commandMode = 'move';
                    u.commandTargetX = holdX;
                    u.targetX = u.commandTargetX;
                } else {
                    u.commandMode = 'stop';
                    u.targetX = null;
                    u.commandTargetX = null;
                }
                continue;
            }

            // 전진조
            const pushX = xNext + this._getUnitCommandOffset(u, 'push', 140);
            if (u.x > pushX + 14) {
                u.commandMode = 'move';
                u.commandTargetX = pushX;
                u.targetX = u.commandTargetX;
            } else {
                u.commandMode = 'attack';
                u.targetX = null;
                u.commandTargetX = null;
            }
        }
    }
    });
})(window);
