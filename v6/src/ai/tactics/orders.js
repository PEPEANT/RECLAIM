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
            if (u._coastStaticGuard === true) {
                u.commandMode = 'stop';
                u.returnToBase = false;
                u.targetX = null;
                u.targetY = (Number.isFinite(Number(u._coastStaticGuardAnchorY)) ? Number(u._coastStaticGuardAnchorY) : u.targetY);
                u.commandTargetX = null;
                continue;
            }
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

    _getUnitThreatValue(u) {
        if (!u || u.dead || !u.stats) return 0;
        if (u.stats.invulnerable) return 0;

        const s = u.stats || {};
        const hpMax = Math.max(1, Number(u.maxHp) || Number(s.hp) || 1);
        const hpCur = Math.max(0, Number(u.hp));
        const hpRatio = Math.max(0.15, Math.min(1.15, hpCur / hpMax));

        const rawDamage = Math.max(
            Number(s.damage) || 0,
            Number(s.damageGround) || 0,
            Number(s.damageAir) || 0,
            Number(s.missileDamage) || 0
        );
        const damageScore = Math.min(2.8, rawDamage / 48);
        const rangeRaw = Number((typeof u.getEffectiveRange === 'function') ? u.getEffectiveRange() : s.range) || 0;
        const rangeScore = Math.min(2.0, Math.max(0, rangeRaw) / 520);
        const hpScore = Math.min(2.7, hpMax / 520);
        const speedScore = Math.min(0.9, Math.max(0, Number(s.speed) || 0) / 1.8);

        let base = 0.75 + hpScore + damageScore + rangeScore + speedScore;
        const id = String(s.id || '');
        const category = String(s.category || '');
        const unitType = String(s.type || '');

        if (unitType === 'air') base *= 1.16;
        if (category === 'armored' || unitType === 'mech') base *= 1.18;
        if (id === 'spg' || id === 'bomber') base *= 1.22;
        if (id === 'aa_tank') base *= 1.08;
        if (id === 'icbm' || id === 'icbm_enemy') base *= 1.40;

        return Math.max(0.2, base * hpRatio);
    },

    _getBuildingThreatValue(b) {
        if (!b || b.dead) return 0;
        if (b.stats && b.stats.invulnerable) return 0;

        const type = String(b.type || '');
        const hpMax = Math.max(1, Number(b.maxHp) || Number(b.hp) || 1);
        const hpCur = Math.max(0, Number(b.hp) || 0);
        const hpRatio = Math.max(0.2, Math.min(1.0, hpCur / hpMax));

        let base = 1.0 + Math.min(4.0, hpMax / 2200);
        if (type === 'turret') base += 1.2;
        if (type === 'bunker') base += 1.7;
        if (type === 'fortress_enemy' || type === 'fortress_player') base += 2.2;
        if (type === 'hq_enemy' || type === 'hq_player') base += 2.8;

        return Math.max(0.3, base * hpRatio);
    },

    _scanThreatBand(units, xMin, xMax) {
        let count = 0;
        let power = 0;
        let weightedXSum = 0;
        let weightedXDen = 0;
        if (!Array.isArray(units)) return { count, power, weightedX: NaN };

        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (!u || u.dead) continue;
            const ux = Number(u.x);
            if (!Number.isFinite(ux)) continue;
            if (ux < xMin || ux > xMax) continue;
            const threat = this._getUnitThreatValue(u);
            count += 1;
            power += threat;
            weightedXSum += ux * threat;
            weightedXDen += threat;
        }

        return {
            count,
            power,
            weightedX: (weightedXDen > 0) ? (weightedXSum / weightedXDen) : NaN
        };
    },

    _scanBuildingThreatBand(buildings, xMin, xMax, team) {
        let count = 0;
        let power = 0;
        if (!Array.isArray(buildings)) return { count, power };

        for (let i = 0; i < buildings.length; i++) {
            const b = buildings[i];
            if (!b || b.dead) continue;
            if (team && b.team && b.team !== team) continue;
            const bx = Number(b.x);
            if (!Number.isFinite(bx)) continue;
            if (bx < xMin || bx > xMax) continue;
            count += 1;
            power += this._getBuildingThreatValue(b);
        }
        return { count, power };
    },

    _assessThreat(wps) {
        // [BUGFIX] Guard against empty wps array
        if (!wps || wps.length === 0) {
            return {
                playerPush: 0,
                enemyFront: 0,
                shouldRetreat: false,
                shouldStabilize: false,
                shouldFallback: false,
                shouldAdvance: false,
                stabilizePressure: 0,
                fallbackPressure: 0,
                advancePressure: 0,
                emergency: false
            };
        }

        const frontX = Number(wps[wps.length - 1].x) || 0;
        const xMinFront = frontX - 360;
        const xMaxFront = frontX + 340;
        const xMinSupport = frontX - 760;
        const xMaxSupport = frontX + 440;

        const playerFront = this._scanThreatBand(game.players || [], xMinFront, xMaxFront);
        const enemyFront = this._scanThreatBand(game.enemies || [], xMinFront, xMaxFront);
        const playerSupport = this._scanThreatBand(game.players || [], xMinSupport, xMaxSupport);
        const enemySupport = this._scanThreatBand(game.enemies || [], xMinSupport, xMaxSupport);

        const playerBuildings = this._scanBuildingThreatBand(game.playerBuildings || [], xMinSupport, xMaxSupport, 'player');
        const enemyBuildings = this._scanBuildingThreatBand(game.enemyBuildings || [], xMinSupport, xMaxSupport, 'enemy');

        const playerPower = playerFront.power + (playerSupport.power * 0.38) + (playerBuildings.power * 0.55);
        const enemyPower = enemyFront.power + (enemySupport.power * 0.42) + (enemyBuildings.power * 0.62);
        const powerRatio = (playerPower + 2) / (enemyPower + 2); // >1: player pressure

        const playerDepthRef = frontX - 260;
        const playerDepth = Number.isFinite(playerFront.weightedX)
            ? Math.max(-1.1, Math.min(2.2, (playerFront.weightedX - playerDepthRef) / 420))
            : 0;
        const enemyDepth = Number.isFinite(enemyFront.weightedX)
            ? Math.max(-1.1, Math.min(2.2, ((frontX + 140) - enemyFront.weightedX) / 420))
            : 0;

        const frontCountGap = (playerFront.count - enemyFront.count);
        const stabilizePressure = Math.max(
            0,
            ((powerRatio - 1.0) * 1.25)
            + (playerDepth * 0.58)
            + (Math.max(0, frontCountGap) * 0.08)
            + ((enemyFront.power < playerFront.power * 0.70) ? 0.22 : 0)
        );
        const fallbackPressure = Math.max(
            0,
            ((powerRatio - 1.22) * 1.30)
            + (playerDepth * 0.75)
            + ((playerFront.count >= 8) ? 0.20 : 0)
            + ((enemyDepth > 0.55) ? 0.20 : 0)
        );
        const advancePressure = Math.max(
            0,
            ((1.0 - powerRatio) * 1.05)
            + (Math.max(0, -frontCountGap) * 0.07)
            + (Math.max(0, -playerDepth) * 0.35)
            + ((enemyPower > playerPower * 1.22) ? 0.18 : 0)
        );

        const shouldStabilize = stabilizePressure >= 1.00;
        const shouldFallback = fallbackPressure >= 1.05;
        const shouldAdvance = advancePressure >= 0.78;
        const emergency = (
            (powerRatio >= 1.95 && playerFront.count >= 6)
            || (playerFront.power >= enemyFront.power * 2.15 && playerFront.count >= 5)
        );

        return {
            playerPush: playerFront.count,
            enemyFront: enemyFront.count,
            playerPower,
            enemyPower,
            powerRatio,
            playerDepth,
            enemyDepth,
            stabilizePressure,
            fallbackPressure,
            advancePressure,
            emergency,
            shouldRetreat: shouldStabilize,
            shouldStabilize,
            shouldFallback,
            shouldAdvance
        };
    },

    _orderHoldAt(x, radius = 300) {
        // 거점 주변에 모여서 stop(방어)
        for (const u of game.enemies) {
            if (!u || u.dead) continue;
            if (u._coastStaticGuard === true) {
                u.commandMode = 'stop';
                u.targetX = null;
                u.targetY = (Number.isFinite(Number(u._coastStaticGuardAnchorY)) ? Number(u._coastStaticGuardAnchorY) : u.targetY);
                u.commandTargetX = null;
                continue;
            }
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
            if (u._coastStaticGuard === true) {
                u.commandMode = 'stop';
                u.targetX = null;
                u.targetY = (Number.isFinite(Number(u._coastStaticGuardAnchorY)) ? Number(u._coastStaticGuardAnchorY) : u.targetY);
                u.commandTargetX = null;
                continue;
            }
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

    _orderPushTo(xNext, xHold, threat = null) {
        // 거점 수비 비율: 초반엔 높게, 후반엔 낮게
        const early = (game.frame < 60 * 70);
        const keepRatio = early ? 0.45 : 0.25;
        let dynamicKeepRatio = keepRatio;
        if (threat && typeof threat === 'object') {
            const stabilizeP = Math.max(0, Number(threat.stabilizePressure) || 0);
            const advanceP = Math.max(0, Number(threat.advancePressure) || 0);
            dynamicKeepRatio += Math.min(0.22, stabilizeP * 0.10);
            dynamicKeepRatio -= Math.min(0.10, advanceP * 0.07);
            dynamicKeepRatio = Math.max(0.15, Math.min(0.70, dynamicKeepRatio));
        }

        // 적 유닛을 섞어서 남김(탱크/지상 우선 남기고 공중은 전진시키는 것도 가능)
        const units = game.enemies.filter(u => u && !u.dead && u._coastStaticGuard !== true);
        const keepCount = Math.floor(units.length * dynamicKeepRatio);

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
