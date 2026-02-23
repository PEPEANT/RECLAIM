(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
    _ensureEnemyIcbmLauncher() {
        if (typeof game === 'undefined' || !game) return false;
        if (typeof game.hasReadyIcbmLauncher === 'function' && game.hasReadyIcbmLauncher('enemy')) {
            return true;
        }

        const hasAnyIcbm = (game.enemies || []).some(u => u && !u.dead && u.stats && u.stats.id === 'icbm_enemy');
        if (hasAnyIcbm) return false;

        if (typeof game.spawnEnemy === 'function') {
            return !!game.spawnEnemy('icbm_enemy');
        }
        return false;
    },

    _getPlayerFortress() {
        // 1차방어사령부 역할(전방 방어요새)
        const b = (game.playerBuildings || []).find(v => v && !v.dead && v.type === 'fortress_player');
        return b || null;
    },

    _applyAreaDamageToPlayer(x, y, radius, dmgUnits, dmgBldg) {
        const r2 = radius * radius;

        for (const u of (game.players || [])) {
            if (!u || u.dead) continue;
            const dx = u.x - x;
            const dy = (u.y || game.groundY) - y;
            if (dx * dx + dy * dy <= r2) {
                try { u.takeDamage(dmgUnits); } catch (e) { }
            }
        }

        for (const b of (game.playerBuildings || [])) {
            if (!b || b.dead) continue;
            const dx = b.x - x;
            const dy = (b.y || game.groundY) - y;
            if (dx * dx + dy * dy <= r2) {
                try { b.takeDamage(dmgBldg); } catch (e) { }
            }
        }
    },

    _castNuke(x, y) {
        if (!this.special || this.special.charges.nuke <= 0 || this.special.cd.nuke > 0) return false;
        if (this.special.pendingNukeWarning) return false;
        if (!this._ensureEnemyIcbmLauncher() && !(typeof game.hasReadyIcbmLauncher === 'function' && game.hasReadyIcbmLauncher('enemy'))) return false;

        const warningDelay = 60 * 3; // 3초
        this.special.pendingNukeWarning = {
            at: (game.frame || 0) + warningDelay,
            x: x,
            y: game.groundY
        };

        // 경고 사운드 재생
        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.playNukeWarning();
        }

        // 게임에 경고 상태 전달 (UI 표시용)
        if (typeof game !== 'undefined') {
            game.airRaidWarning = {
                type: 'nuke',
                startFrame: game.frame || 0,
                endFrame: (game.frame || 0) + warningDelay
            };
        }

        this.special.charges.nuke--;
        this.special.cd.nuke = 60 * 90;
        return true;
    },

    _executeNuke(x, y) {
        if (typeof game === 'undefined' || typeof game.requestIcbmLaunch !== 'function') return false;
        return !!game.requestIcbmLaunch('enemy', 'nuke', x, y, {
            bypassCharge: true,
            skipCooldown: true
        });
    },

    _castEMP(x, y) {
        if (!this.special || this.special.charges.emp <= 0 || this.special.cd.emp > 0) return false;
        if (!this._ensureEnemyIcbmLauncher() && !(typeof game.hasReadyIcbmLauncher === 'function' && game.hasReadyIcbmLauncher('enemy'))) return false;
        if (typeof game === 'undefined' || typeof game.requestIcbmLaunch !== 'function') return false;

        const launched = game.requestIcbmLaunch('enemy', 'emp', x, y, {
            bypassCharge: true,
            skipCooldown: true
        });
        if (!launched) return false;

        this.special.charges.emp--;
        this.special.cd.emp = 60 * 45;
        this.special.lastEmpFrame = Number(game.frame) || 0;
        return true;
    },

    _castTacticalMissile(x, y) {
        if (!this.special || this.special.charges.tactical <= 0 || this.special.cd.tactical > 0) return false;
        if ((game.frame || 0) < this.special.tacticalGraceUntil) return false;
        if (this.special.tacticalInFlight) return false;
        if (this.special.pendingTacticalWarning) return false;
        if (!this._ensureEnemyIcbmLauncher() && !(typeof game.hasReadyIcbmLauncher === 'function' && game.hasReadyIcbmLauncher('enemy'))) return false;

        const warningDelay = 60 * 3; // 3초
        this.special.pendingTacticalWarning = {
            at: (game.frame || 0) + warningDelay,
            x: x,
            y: game.groundY
        };

        // 경고 사운드 재생
        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.playNukeWarning();
        }

        // 게임에 경고 상태 전달 (UI 표시용)
        if (typeof game !== 'undefined') {
            game.airRaidWarning = {
                type: 'tactical',
                startFrame: game.frame || 0,
                endFrame: (game.frame || 0) + warningDelay
            };
        }

        this.special.charges.tactical--;
        const tacticalCd = (this.difficulty === 'elite') ? (60 * 18) : (60 * 24);
        this.special.cd.tactical = tacticalCd;
        return true;
    },

    _executeTacticalMissile(x, y) {
        if (typeof game === 'undefined' || typeof game.requestIcbmLaunch !== 'function') return false;
        const launched = game.requestIcbmLaunch('enemy', 'tactical_missile', x, y, {
            bypassCharge: true,
            skipCooldown: true
        });
        if (launched) this.special.tacticalInFlight = true;
        return !!launched;
    },

    _updatePendingStrikes(frame) {
        if (this.special && this.special.pendingNukeWarning) {
            const w = this.special.pendingNukeWarning;
            if (frame >= w.at) {
                const launched = this._executeNuke(w.x, w.y);
                if (launched) {
                    this.special.pendingNukeWarning = null;
                    if (typeof game !== 'undefined') game.airRaidWarning = null;
                } else {
                    w.at = frame + 60;
                    if (typeof game !== 'undefined' && game.airRaidWarning) {
                        game.airRaidWarning.startFrame = frame;
                        game.airRaidWarning.endFrame = frame + 60;
                    }
                }
            }
        }

        if (this.special && this.special.pendingTacticalWarning) {
            const w = this.special.pendingTacticalWarning;
            if (frame >= w.at) {
                const launched = this._executeTacticalMissile(w.x, w.y);
                if (launched) {
                    this.special.pendingTacticalWarning = null;
                    if (typeof game !== 'undefined') game.airRaidWarning = null;
                } else {
                    w.at = frame + 60;
                    if (typeof game !== 'undefined' && game.airRaidWarning) {
                        game.airRaidWarning.startFrame = frame;
                        game.airRaidWarning.endFrame = frame + 60;
                    }
                }
            }
        }
    },

    _thinkSpecial(frame) {
        // 난이도 recruit는 특수무기 거의 안씀
        if (this.difficulty === 'recruit') return;
        if (!this.special) return;

        // cooldown tick
        for (const k of Object.keys(this.special.cd)) {
            if (this.special.cd[k] > 0) this.special.cd[k]--;
        }

        // grace time
        if (frame < this.special.graceUntil) return;

        // think interval
        if (frame - this.special.lastThink < this.special.thinkEvery) return;
        this.special.lastThink = frame;

        const players = game.players || [];
        const bldgs = game.playerBuildings || [];

        if (players.length === 0 && bldgs.length === 0) return;

        // [NEW] 타격 대상 우선순위: 아군 유닛만 (미사일 전용)
        const unitCluster = this._bestClusterTarget(players, 120);
        const buildingCluster = this._bestClusterTarget(bldgs, 120);
        const empCluster = unitCluster || buildingCluster;

        // 1) 방어요새(1차방어사령부)가 깨질 때 핵 사용(우선)
        const fortress = this._getPlayerFortress();
        const fortressAliveNow = !!fortress;

        if (this.special.fortressWasAlive && !fortressAliveNow && !this.special.nukeUsedOnFortressBreak) {
            // 본부 파괴 트리거도 "아군 유닛"이 있을 때만 미사일 사용
            if (unitCluster) {
                const ok = this._castNuke(unitCluster.x, game.groundY);
                if (ok) this.special.nukeUsedOnFortressBreak = true;
            }
        }
        this.special.fortressWasAlive = fortressAliveNow;

        // 2) 뭉쳐있으면 전술미사일/핵/EMP 선택
        const cluster = empCluster;
        if (!cluster) return;

        const bx = cluster.x;
        const by = game.groundY;

        // buildings near cluster (방어 시설 밀집 판단)
        const bNear = this._countBuildingsNear(bx, by, 260);
        const unitCount = unitCluster ? unitCluster.count : 0;
        const unitX = unitCluster ? unitCluster.x : null;
        const bNearUnits = unitCluster ? this._countBuildingsNear(unitX, by, 260) : 0;

        // [UPDATED] 핵: 유닛 10명 이상 밀집 시 사용
        const wantNuke = (unitCluster && unitCount >= 10 && frame > 60 * 70);

        // EMP: 중간중간(방어시설/병력 밀집) — 마비 위주
        const wantEMP = (cluster.count >= 5 && bNear >= 1) || (bNear >= 3);

        // [NEW] 전술미사일: "필요할 때만" 조건 강화
        const enoughTime = frame > this.special.tacticalGraceUntil;
        const tacX = unitCluster ? unitX : bx;
        const wantTac = enoughTime && (
            (!!unitCluster && unitCount >= 7) ||
            (!!unitCluster && unitCount >= 4 && bNearUnits >= 2) ||
            (cluster.count >= 5 && bNear >= 1) ||
            (cluster.count >= 5 && bNear >= 2 && frame > 60 * 140)
        );

        const empForceEvery = Math.max(60 * 60, Number(this.special.empForceInterval) || (60 * 100));
        const lastEmpFrame = Number(this.special.lastEmpFrame) || -999999;
        const empOverdue = (frame - lastEmpFrame) >= empForceEvery;

        // EMP 강제 주기: 너무 오래 EMP가 없으면 우선 발사
        if (empOverdue && this.special.charges.emp > 0 && this.special.cd.emp <= 0) {
            if (this._castEMP(bx, by)) return;
        }

        // 우선순위: (조건 만족 시) 핵 > EMP > 전술미사일
        if (wantNuke && this.special.charges.nuke > 0 && this.special.cd.nuke <= 0) {
            if (this._castNuke(unitX, by)) return;
        }

        if (wantEMP && this.special.charges.emp > 0 && this.special.cd.emp <= 0) {
            if (this._castEMP(bx, by)) return;
        }

        // [NEW] 비행 중이면 전술미사일 발사 금지
        if (this.special.tacticalInFlight) return;

        if (wantTac && this.special.charges.tactical > 0 && this.special.cd.tactical <= 0) {
            if (this._castTacticalMissile(tacX, by)) return;
        }
    },
    });
})(window);
