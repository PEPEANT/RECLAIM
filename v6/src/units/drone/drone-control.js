// drone-control.js
// Drone global control mode + manual lockdown assignment.
// [RULE] In-game status text should use ChatPanel.push only.
(function () {
    'use strict';

    const resolveGameApi = () => (typeof game !== 'undefined' && game)
        ? game
        : ((typeof window !== 'undefined' && window.game) ? window.game : null);
    const withGameApi = (label, installer) => {
        const runInstall = () => {
            const api = resolveGameApi();
            if (!api) return false;
            if (api[`__${label}Installed__`] === true) return true;
            installer(api);
            api[`__${label}Installed__`] = true;
            return true;
        };
        if (runInstall()) return;
        console.warn(`[${label}] game unavailable; waiting for late init.`);
        let retries = 0;
        const timer = setInterval(() => {
            retries += 1;
            if (runInstall() || retries >= 120) clearInterval(timer);
        }, 50);
        if (typeof window !== 'undefined') {
            window.addEventListener('reclaim:game-ready', () => {
                if (runInstall()) clearInterval(timer);
            }, { once: true });
        }
    };

    withGameApi('DroneControl', (game) => {
        const DRONE_IDS = new Set(['drone_suicide', 'drone_at']);

        Object.assign(game, {
        droneControlMode: 'auto', // 'auto' | 'manual'

        getDroneControlMode() {
            return this.droneControlMode === 'manual' ? 'manual' : 'auto';
        },

        _isControllablePlayerDrone(unit) {
            if (!unit || unit.dead || !unit.stats) return false;
            if (unit.team !== 'player') return false;
            return DRONE_IDS.has(unit.stats.id);
        },

        getPlayerControllableDrones() {
            const out = [];
            const seen = new Set();
            const pool = Array.isArray(this.players) ? this.players : [];
            for (let i = 0; i < pool.length; i++) {
                const d = pool[i];
                if (!this._isControllablePlayerDrone(d) || seen.has(d)) continue;
                seen.add(d);
                out.push(d);
            }
            return out;
        },

        getManualAssignableDrones() {
            const pool = this.getPlayerControllableDrones();
            const out = [];
            for (let i = 0; i < pool.length; i++) {
                const d = pool[i];
                if (!d || d.dead) continue;
                if (d.recallRequested) continue;
                if (d.lockedTarget && !d.lockedTarget.dead) continue;
                if (d.commandState !== 'standby') continue;
                out.push(d);
            }
            return out;
        },

        setDroneControlMode(mode) {
            const next = (mode === 'manual') ? 'manual' : 'auto';
            const prev = this.getDroneControlMode();
            if (prev === next) return true;

            this.droneControlMode = next;
            const drones = this.getPlayerControllableDrones();
            for (let i = 0; i < drones.length; i++) {
                const d = drones[i];
                if (!d || d.dead) continue;

                d.recallRequested = false;
                d.recallPhase = null;
                d.recallTarget = null;
                d.holdFrames = 0;
                d.launchInit = false;
                d.swarmTarget = null;
                d.lockedTarget = null;
                d.attackTarget = null;
                d.attackPhase = null;

                if (next === 'manual') {
                    d.autoSeekTarget = false;
                    d.commandState = 'standby';
                } else {
                    d.autoSeekTarget = true;
                    d.commandState = 'attack';
                }
            }

            if (typeof ChatPanel !== 'undefined') {
                ChatPanel.push(
                    next === 'manual'
                        ? '[드론 제어] 수동 모드'
                        : '[드론 제어] 자동 모드',
                    'ACTION'
                );
            }
            if (typeof app !== 'undefined') app.markUiDirty();
            return true;
        },

        assignDroneLocks(target, dronePool = null) {
            if (!target || target.dead) return false;

            const pool = Array.isArray(dronePool)
                ? dronePool
                : this.getManualAssignableDrones();
            if (!Array.isArray(pool) || pool.length === 0) return false;

            let chosen = null;
            for (let i = 0; i < pool.length; i++) {
                const d = pool[i];
                if (!d || d.dead) continue;
                if (d.recallRequested) continue;
                if (d.lockedTarget && !d.lockedTarget.dead) continue;
                if (d.commandState !== 'standby') continue;
                chosen = d;
                break;
            }
            if (!chosen) return false;

            chosen.lockedTarget = target;
            chosen.recallRequested = false;
            chosen.recallPhase = null;
            chosen.recallTarget = null;
            chosen.swarmTarget = null;
            chosen.attackTarget = null;
            chosen.holdFrames = 0;
            chosen.launchInit = false;
            chosen.autoSeekTarget = false;
            chosen.commandState = 'locked';
            chosen.attackPhase = null;

            if (typeof ChatPanel !== 'undefined') {
                ChatPanel.push('[락다운] 드론 1기 배정', 'ACTION');
            }
            return true;
        },

        tryDroneLockdown(wx, wy) {
            if (this.getDroneControlMode() !== 'manual') return false;

            const enemy = this.getEnemyAt(wx, wy, 96);
            if (!enemy) return false;

            const drones = this.getManualAssignableDrones();
            if (drones.length === 0) {
                if (typeof ChatPanel !== 'undefined') {
                    ChatPanel.push('[락다운] 배정 가능한 정지 드론이 없습니다.', 'WARN');
                }
                return true;
            }

            const assigned = this.assignDroneLocks(enemy, drones);
            if (!assigned && typeof ChatPanel !== 'undefined') {
                ChatPanel.push('[락다운] 배정 실패', 'WARN');
            }
            return true;
        },

        drawDroneLockTargets(ctx) {
            if (!ctx) return;

            const mode = this.getDroneControlMode();
            let pool = [];
            if (mode === 'manual') {
                pool = this.getPlayerControllableDrones();
            } else if (this.selectedUnits && this.selectedUnits.size > 0) {
                pool = Array.from(this.selectedUnits);
            }
            if (!Array.isArray(pool) || pool.length === 0) return;

            ctx.save();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2 / (Camera.zoom || 1);

            for (let i = 0; i < pool.length; i++) {
                const u = pool[i];
                if (!u || u.dead || !u.stats) continue;
                if (u.stats.operator) continue;
                const isDrone = (u.stats.category === 'drone' || (u.stats.id && u.stats.id.includes('drone')));
                if (!isDrone) continue;
                const t = u.lockedTarget;
                if (!t || t.dead) continue;
                const w = t.width || 32;
                const h = t.height || 32;
                ctx.strokeRect(t.x - w / 2, t.y - h, w, h);
            }

            ctx.restore();
        },
        });
    });
})();
