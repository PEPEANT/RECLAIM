// drone-manager.js
// 드론 소유권 및 상태 관리 함수 모음
// game.js에서 추출 — game 객체 정의 후 로드할 것
// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
(function () {
    'use strict';

    Object.assign(game, {

        getSelectedOperators() {
            if (!this.selectedUnits || this.selectedUnits.size === 0) return [];
            return Array.from(this.selectedUnits).filter(u =>
                u && !u.dead && u.stats?.operator === true
            );
        },

        getSelectedDrones() {
            if (!this.selectedUnits || this.selectedUnits.size === 0) return [];
            return Array.from(this.selectedUnits).filter(u => {
                if (!u || u.dead || !u.stats) return false;
                if (u.stats.operator) return false;
                if (u.stats.category === 'drone') return true;
                return (typeof u.stats.id === 'string' && u.stats.id.includes('drone'));
            });
        },

        _ensureOperatorDroneList(operator) {
            if (!operator || operator.stats?.operator !== true) return [];
            if (!Array.isArray(operator.ownedDrones)) {
                const seeded = [];
                if (operator.ownedDrone && !operator.ownedDrone.dead) seeded.push(operator.ownedDrone);
                operator.ownedDrones = seeded;
            }
            return operator.ownedDrones;
        },

        getAliveOperatorDrones(operator) {
            const list = this._ensureOperatorDroneList(operator);
            if (!list || list.length === 0) {
                if (operator) operator.ownedDrone = null;
                return [];
            }
            const alive = [];
            const seen = new Set();
            for (let i = 0; i < list.length; i++) {
                const d = list[i];
                if (!d || d.dead || seen.has(d)) continue;
                seen.add(d);
                alive.push(d);
            }
            operator.ownedDrones = alive;
            operator.ownedDrone = alive.length > 0 ? alive[alive.length - 1] : null;
            return alive;
        },

        addOperatorDrone(operator, drone) {
            if (!operator || operator.dead || operator.stats?.operator !== true || !drone || drone.dead) return;
            const alive = this.getAliveOperatorDrones(operator);
            if (!alive.includes(drone)) alive.push(drone);
            operator.ownedDrones = alive;
            operator.ownedDrone = drone;
            operator.opState = 'laptop';
            drone.ownerRef = operator;
        },

        removeOperatorDrone(operator, drone) {
            if (!operator || operator.stats?.operator !== true) return;
            const alive = this.getAliveOperatorDrones(operator).filter(d => d && !d.dead && d !== drone);
            operator.ownedDrones = alive;
            operator.ownedDrone = alive.length > 0 ? alive[alive.length - 1] : null;
            if (alive.length === 0 && operator.opState === 'laptop') {
                operator.opState = 'rifle';
            }
        },

        findDroneOwner(drone, includeEnemy = true) {
            if (!drone || drone.dead) return null;
            const pools = [this.players || []];
            if (includeEnemy) pools.push(this.enemies || []);
            for (let pi = 0; pi < pools.length; pi++) {
                const arr = pools[pi];
                for (let i = 0; i < arr.length; i++) {
                    const op = arr[i];
                    if (!op || op.dead || op.stats?.operator !== true) continue;
                    const drones = this.getAliveOperatorDrones(op);
                    if (drones.includes(drone)) {
                        drone.ownerRef = op;
                        return op;
                    }
                }
            }
            return null;
        },

        getSelectedDronesForLockdown() {
            const selected = this.getSelectedDrones();
            if (selected.length > 0) return selected;
            const out = [];
            const seen = new Set();
            const operators = this.getSelectedOperators ? this.getSelectedOperators() : [];
            for (let i = 0; i < operators.length; i++) {
                const drones = this.getAliveOperatorDrones(operators[i]);
                for (let j = 0; j < drones.length; j++) {
                    const d = drones[j];
                    if (!d || d.dead || seen.has(d)) continue;
                    seen.add(d);
                    out.push(d);
                }
            }
            return out;
        },

        _canOperatorLaunchDrone(operator) {
            if (!operator || operator.dead || operator.stats?.operator !== true) return false;
            if ((operator.droneChargesLeft || 0) <= 0) return false;

            const aliveCount = (typeof this.getAliveOperatorDrones === 'function')
                ? this.getAliveOperatorDrones(operator).length
                : ((operator.ownedDrone && !operator.ownedDrone.dead) ? 1 : 0);
            if (aliveCount > 0) return false;

            if (operator.opState === 'laptop') {
                operator.opState = 'rifle';
            }
            return operator.opState !== 'laptop';
        },

        getDeployableOperators() {
            return this.getSelectedOperators().filter((u) => this._canOperatorLaunchDrone(u));
        },

        operatorSupportsDroneKey(operator, droneKey) {
            if (!operator || operator.dead || operator.stats?.operator !== true) return false;
            if (droneKey === 'drone_suicide') return true;
            if (droneKey === 'drone_at') {
                const skillItemKeys = Array.isArray(operator.veteranLoadoutSkillItemKeys)
                    ? operator.veteranLoadoutSkillItemKeys
                    : [];
                if (skillItemKeys.some((key) => String(key || '').trim() === 'drone_at_item')) return true;
                return String(operator.veteranLoadoutItemKey || '').trim() === 'drone_at_item';
            }
            return false;
        },

        getSelectedOperatorsForDrone(droneKey) {
            const operators = this.getSelectedOperators ? this.getSelectedOperators() : [];
            return operators.filter(op => this.operatorSupportsDroneKey(op, droneKey));
        },

        getDeployableOperatorsForDrone(droneKey) {
            const operators = this.getSelectedOperatorsForDrone
                ? this.getSelectedOperatorsForDrone(droneKey)
                : [];
            return operators.filter((op) => this._canOperatorLaunchDrone(op));
        },

    });
})();
