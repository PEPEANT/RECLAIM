// drone-commands.js
// Drone launch/recall command helpers injected into global `game`.
// [RULE] In-game status text should use ChatPanel.push only.
(function () {
    'use strict';

    Object.assign(game, {

        launchOperatorDroneFromCommand(droneKey) {
            if (droneKey !== 'drone_suicide' && droneKey !== 'drone_at') return false;

            const allOperators = this.getSelectedOperators ? this.getSelectedOperators() : [];
            const supportedOperators = this.getSelectedOperatorsForDrone
                ? this.getSelectedOperatorsForDrone(droneKey)
                : allOperators.filter((op) => this.operatorSupportsDroneKey(op, droneKey));
            const operators = this.getDeployableOperatorsForDrone
                ? this.getDeployableOperatorsForDrone(droneKey)
                : supportedOperators.filter((op) => {
                    if (typeof this._canOperatorLaunchDrone === 'function') {
                        return this._canOperatorLaunchDrone(op);
                    }
                    return (op.droneChargesLeft || 0) > 0;
                });

            if (allOperators.length === 0) {
                if (typeof ChatPanel !== 'undefined') {
                    ChatPanel.push('[발진 불가] 드론병 선택 필요', 'WARN');
                }
                return false;
            }

            if (supportedOperators.length === 0) {
                if (typeof ChatPanel !== 'undefined') {
                    if (droneKey === 'drone_at') {
                        ChatPanel.push('[발진 불가] AT 드론 사용 드론병 필요', 'WARN');
                    } else {
                        ChatPanel.push('[발진 불가] 사용 가능한 드론병이 없습니다.', 'WARN');
                    }
                }
                return false;
            }

            if (operators.length === 0) {
                if (typeof ChatPanel !== 'undefined') {
                    ChatPanel.push('[발진 불가] 드론 충전 없음 또는 이미 운용 중', 'WARN');
                }
                return false;
            }

            operators.forEach((op) => {
                op.commandState = 'stop';
                op.commandMode = 'stop';
                op.attackTarget = null;
            });

            let spawned = 0;
            operators.forEach((op) => {
                const drone = this.spawnDroneForOperator ? this.spawnDroneForOperator(op, droneKey) : null;
                if (drone) spawned++;
            });

            if (this.holdTimer) {
                clearInterval(this.holdTimer);
                this.holdTimer = null;
            }
            this.holdKey = null;

            if (typeof ChatPanel !== 'undefined' && spawned > 0) {
                const label = droneKey === 'drone_suicide' ? '자폭드론' : '대전차드론';
                ChatPanel.push(`[발진] ${label} ${spawned}기 즉시 발진`, 'ACTION');
            }

            if (spawned > 0 && typeof app !== 'undefined') {
                app.markUiDirty();
            }
            return spawned > 0;
        },

        spawnDroneForOperator(op, droneKey) {
            if (!op || op.dead || op.stats?.operator !== true) return null;
            const fixedDroneCharges = 2;
            const launchLimitRaw = Number(op.droneLaunchLimit);
            const launchLimit = Number.isFinite(launchLimitRaw)
                ? Math.max(1, Math.min(fixedDroneCharges, Math.floor(launchLimitRaw)))
                : fixedDroneCharges;
            op.droneLaunchLimit = launchLimit;
            op.maxDroneCharges = launchLimit;

            const launchCountRaw = Number(op.droneLaunchCount);
            const launchCount = Number.isFinite(launchCountRaw)
                ? Math.max(0, Math.min(launchLimit, Math.floor(launchCountRaw)))
                : 0;
            op.droneLaunchCount = launchCount;

            const remainingByCount = Math.max(0, launchLimit - launchCount);
            const chargesRaw = Number(op.droneChargesLeft);
            op.droneChargesLeft = Number.isFinite(chargesRaw)
                ? Math.max(0, Math.min(remainingByCount, Math.floor(chargesRaw)))
                : remainingByCount;
            if ((op.droneChargesLeft || 0) <= 0) return null;

            const aliveOwned = (typeof this.getAliveOperatorDrones === 'function')
                ? this.getAliveOperatorDrones(op).length
                : ((op.ownedDrone && !op.ownedDrone.dead) ? 1 : 0);
            if (aliveOwned > 0) return null;
            if (op.opState === 'laptop') return null;

            const opStats = op.stats || {};
            const frontSpawnOffsetRaw = Number((op.team === 'player') ? opStats.frontSpawnOffset : opStats.aiFrontSpawnOffset);
            const frontSpawnOffset = Number.isFinite(frontSpawnOffsetRaw)
                ? Math.max(20, Math.floor(frontSpawnOffsetRaw))
                : ((op.team === 'player') ? 80 : 100);
            const facing = (op.facing != null) ? op.facing : ((op.team === 'player') ? 1 : -1);
            const mapWidth = (typeof CONFIG !== 'undefined' && CONFIG && Number.isFinite(Number(CONFIG.mapWidth)))
                ? Number(CONFIG.mapWidth)
                : 6000;
            const spawnX = Math.max(16, Math.min(mapWidth - 16, op.x + facing * frontSpawnOffset));
            const spawnY = this.groundY;

            const drone = this.spawnUnitDirect(droneKey, spawnX, spawnY, op.team || 'player', true);
            if (!drone) return null;

            drone.ownerRef = op;
            drone.recallRequested = false;
            drone.recallTarget = null;
            drone.recallPhase = null;

            const mode = (typeof this.getDroneControlMode === 'function')
                ? this.getDroneControlMode()
                : (this.droneControlMode === 'manual' ? 'manual' : 'auto');

            // Launch state follows global drone control mode.
            const launchPrepFramesRaw = Number(opStats.launchPrepFrames);
            const launchPrepFrames = Number.isFinite(launchPrepFramesRaw)
                ? Math.max(1, Math.floor(launchPrepFramesRaw))
                : 90;
            const launchGroundHoldRaw = Number(opStats.launchGroundHoldFrames);
            const launchRiseRaw = Number(opStats.launchRiseFrames);
            const launchHoverRaw = Number(opStats.launchHoverFrames);
            const launchMaxRiseRaw = Number((op.team === 'player') ? opStats.launchMaxRisePerFrame : opStats.aiLaunchMaxRisePerFrame);
            const launchCruiseHeightRaw = Number(opStats.launchCruiseHeight);
            const attackCruiseHeightRaw = Number(opStats.attackCruiseHeight);
            const attackDiveTriggerRangeRaw = Number(opStats.attackDiveTriggerRange);
            const dynamicRetargetEnabled = opStats.dynamicRetargetEnabled !== false;
            const dynamicRetargetMarginRaw = Number(opStats.dynamicRetargetMargin);

            const launchGroundHoldFrames = Number.isFinite(launchGroundHoldRaw)
                ? Math.max(0, Math.floor(launchGroundHoldRaw))
                : Math.max(0, Math.floor(launchPrepFrames * 0.6));
            const launchRiseFrames = Number.isFinite(launchRiseRaw)
                ? Math.max(1, Math.floor(launchRiseRaw))
                : Math.max(1, launchPrepFrames - launchGroundHoldFrames);
            const launchHoverFrames = Number.isFinite(launchHoverRaw)
                ? Math.max(0, Math.floor(launchHoverRaw))
                : 25;
            const launchMaxRisePerFrame = Number.isFinite(launchMaxRiseRaw)
                ? Math.max(0.35, launchMaxRiseRaw)
                : ((op.team === 'player') ? 0.78 : 0.68);
            const launchCruiseHeight = Number.isFinite(launchCruiseHeightRaw)
                ? Math.max(110, launchCruiseHeightRaw)
                : 220;
            const attackCruiseHeight = Number.isFinite(attackCruiseHeightRaw)
                ? Math.max(260, attackCruiseHeightRaw)
                : Math.max(430, launchCruiseHeight + 180);
            const attackDiveTriggerRange = Number.isFinite(attackDiveTriggerRangeRaw)
                ? Math.max(140, Math.floor(attackDiveTriggerRangeRaw))
                : 260;
            const dynamicRetargetMargin = Number.isFinite(dynamicRetargetMarginRaw)
                ? Math.max(0, Math.floor(dynamicRetargetMarginRaw))
                : 60;

            drone.launchGroundHoldFrames = launchGroundHoldFrames;
            drone.launchRiseFrames = launchRiseFrames;
            drone.holdFrames = launchGroundHoldFrames + launchRiseFrames;
            drone.postLaunchHoverFrames = launchHoverFrames;
            drone.launchMaxRisePerFrame = launchMaxRisePerFrame;
            drone.launchInit = false;
            drone.launchTargetY = this.groundY - launchCruiseHeight;
            drone.attackCruiseY = this.groundY - attackCruiseHeight;
            drone.attackDiveTriggerRange = attackDiveTriggerRange;
            drone.dynamicRetargetEnabled = dynamicRetargetEnabled;
            drone.dynamicRetargetMargin = dynamicRetargetMargin;
            drone.autoSeekTarget = mode !== 'manual';
            drone.commandState = (mode === 'manual') ? 'standby' : 'attack';
            drone.y = this.groundY;
            drone.attackPhase = null;

            if (typeof this.addOperatorDrone === 'function') {
                this.addOperatorDrone(op, drone);
            } else {
                op.ownedDrone = drone;
                op.opState = 'laptop';
                drone.ownerRef = op;
            }

            const nextLaunchCount = Math.max(0, Math.min(launchLimit, launchCount + 1));
            op.droneLaunchCount = nextLaunchCount;
            op.droneChargesLeft = Math.max(0, launchLimit - nextLaunchCount);
            op.manualDeployRequested = false;
            op.manualDeployType = null;
            return drone;
        },

        getSelectedDroneForRecall() {
            if (!this.selectedUnits || this.selectedUnits.size !== 1) return null;
            const u = this.selectedUnits.values().next().value;
            if (!u || u.dead) return null;

            if (u.stats?.id === 'drone_operator') {
                const drones = (typeof this.getAliveOperatorDrones === 'function')
                    ? this.getAliveOperatorDrones(u)
                    : ((u.ownedDrone && !u.ownedDrone.dead) ? [u.ownedDrone] : []);
                if (drones.length === 0) return null;

                let pick = drones[0];
                let bestDist = Math.abs((pick.x || 0) - (u.x || 0));
                for (let i = 1; i < drones.length; i++) {
                    const d = drones[i];
                    const dist = Math.abs((d.x || 0) - (u.x || 0));
                    if (dist < bestDist) {
                        bestDist = dist;
                        pick = d;
                    }
                }
                if (!pick.ownerRef) pick.ownerRef = u;
                return pick;
            }

            const isDrone = (u.stats?.id === 'drone_suicide' || u.stats?.id === 'drone_at' || u.stats?.category === 'drone');
            if (!isDrone) return null;

            if (!u.ownerRef) {
                const owner = (typeof this.findDroneOwner === 'function') ? this.findDroneOwner(u, false) : null;
                if (owner) u.ownerRef = owner;
            }
            return u;
        },

        requestDroneRecall(drone) {
            if (!drone || drone.dead) return false;

            let owner = drone.ownerRef;
            if (!owner || owner.dead) {
                owner = (typeof this.findDroneOwner === 'function')
                    ? this.findDroneOwner(drone, false)
                    : null;
                if (owner) drone.ownerRef = owner;
            }

            // Do not force-bind orphan drones to nearest operator.
            if (!owner || owner.dead) {
                if (typeof ChatPanel !== 'undefined') {
                    ChatPanel.push('[복귀 불가] 드론 소유자 없음', 'WARN');
                }
                return false;
            }

            if (typeof this.addOperatorDrone === 'function') {
                this.addOperatorDrone(owner, drone);
            } else if (owner.ownedDrone !== drone) {
                owner.ownedDrone = drone;
            }

            const wasRequested = !!drone.recallRequested;
            drone.recallRequested = true;
            drone.recallTarget = owner;
            drone.recallPhase = 'approach';
            drone.commandState = 'recall';
            drone.commandMode = 'move';
            drone.commandTargetX = null;
            drone.commandTargetY = null;
            drone.targetX = null;
            drone.targetY = null;
            drone.lockedTarget = null;
            drone.attackTarget = null;
            drone.attackPhase = null;
            drone.swarmTarget = null;
            drone.holdFrames = 0;
            drone.launchInit = false;

            if (!wasRequested && typeof ChatPanel !== 'undefined') {
                ChatPanel.push('[복귀] 드론 회수 중', 'ACTION');
            }
            return true;
        },

        requestRecallFromSelection() {
            if (!this.selectedUnits || this.selectedUnits.size === 0) return 0;
            let recalled = 0;

            this.selectedUnits.forEach((u) => {
                if (!u || u.dead || !u.stats) return;

                if (u.stats.operator) {
                    const drones = (typeof this.getAliveOperatorDrones === 'function')
                        ? this.getAliveOperatorDrones(u)
                        : ((u.ownedDrone && !u.ownedDrone.dead) ? [u.ownedDrone] : []);
                    for (let i = 0; i < drones.length; i++) {
                        const d = drones[i];
                        if (!d) continue;
                        if (!d.ownerRef) d.ownerRef = u;
                        if (this.requestDroneRecall(d)) recalled++;
                    }
                    return;
                }

                const isDrone = (u.stats.category === 'drone' || (u.stats.id && u.stats.id.includes('drone')));
                if (!isDrone || u.stats.operator) return;

                if (!u.ownerRef) {
                    const owner = (typeof this.findDroneOwner === 'function') ? this.findDroneOwner(u, false) : null;
                    if (owner) u.ownerRef = owner;
                }
                if (this.requestDroneRecall(u)) recalled++;
            });

            return recalled;
        },

    });
})();
