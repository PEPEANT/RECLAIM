const AI = {
    difficulty: 'veteran', // recruit, veteran, elite
    lastSpawn: 0,
    nextSpawnAt: 0,
    seqKey: '',
    seqIndex: 0,
    counterIndex: 0,
    armoredWaveTankCount: 0,
    spawnJitter: 18, // frames
    checkInterval: 60, // analysis tick (frames)

    // Config: Spawn Rates (frames between spawns) & Resource Multipliers
    settings: {
        recruit: { rate: 200, supplyMult: 1.0, smart: false },
        veteran: { rate: 120, supplyMult: 2.0, smart: true },
        elite: { rate: 90, supplyMult: 3.0, smart: 'very' }
    },

    // ===== Regroup / Hold / Retreat layer =====
    wave: {
        phase: 'HOLD',          // 'HOLD' | 'PUSH' | 'RETREAT'
        wpIndex: 0,
        holdUntil: 0,
        retreatUntil: 0,
        lastCommandFrame: 0,
        lastThreatCheck: 0
    },
    _totalWarIssued: false,

    // ==========================
    // 특수무기 AI 운용 상태
    // ==========================
    special: null,


    _initSpecialState() {
        // 3회 사용(핵/EMP/전술미사일)
        this.special = {
            charges: { nuke: 3, emp: 3, tactical: 3 },
            cd: { nuke: 0, emp: 0, tactical: 0 },
            // 시작 후 바로 안 씀 (지능적 사용)
            graceUntil: 60 * 25, // 약 25초
            lastThink: 0,
            thinkEvery: 20, // 매 20프레임 체크
            // 방어요새(1차방어사령부 대체) 파괴 감지
            fortressWasAlive: true,
            nukeUsedOnFortressBreak: false,
            // 전술미사일: 도착 프레임에 추가 폭발/추가 피해 트리거
            pending: [],
            // [NEW] 전술미사일 전용 설정
            tacticalGraceUntil: 60 * 90,  // 90초 후부터 사용 가능
            tacticalInFlight: false,      // 한 발 비행 중이면 다음 발 금지
            pendingLaunch: [],            // 발사 예약 큐
            // [NEW] 공습경보 시스템
            pendingNukeWarning: null,     // { at: frame, x, y } - 핵 경고 후 발사 예약
            pendingTacticalWarning: null  // { at: frame, x, y } - 전술미사일 경고 후 발사 예약
        };
    },

    setDifficulty(diff) {
        try {
            this.difficulty = diff || 'veteran';
            const s = this.settings[this.difficulty];
            if (!s) {
                console.warn(`[AI] Unknown difficulty '${diff}', falling back to 'veteran'`);
                this.difficulty = 'veteran';
            }
            const settings = this.settings[this.difficulty];
            if (typeof game !== 'undefined') {
                game.enemySupplyRate = CONFIG.supplyRate * settings.supplyMult;
            }
            // 특수무기 상태 초기화
            this._initSpecialState();
            this._totalWarIssued = false;
            this.nextSpawnAt = 0;
            this.seqKey = '';
            this.seqIndex = 0;
            this.counterIndex = 0;
            this.armoredWaveTankCount = 0;

            // [NEW] 난이도 변경 시 즉시 저장
            if (typeof app !== 'undefined' && app.markDirty) {
                app.markDirty();
                app.saveNow();
            }
        } catch (e) {
            console.error('[AI] setDifficulty failed:', e);
            this.difficulty = 'veteran';
            this._initSpecialState();
        }
    },

    update(frame) {
        if (!game || !game.running) return;

        // safety: 게임 시작 후 setDifficulty를 안 탔다면
        if (!this.special) this._initSpecialState();

        // [UPDATED] Dynamic Spawn Rate Logic - 초반 물량 완화
        let currentRate = this.settings[this.difficulty].rate;

        // [NEW] 모든 난이도 초반 스폰 속도 완화 (90초까지)
        const EARLY_END = 60 * 90; // 90초
        if (frame < EARLY_END) {
            // 초반에는 스폰 간격을 1.5배로 늘림
            currentRate = Math.max(currentRate * 1.5, 180);
        }

        // Elite 난이도 추가 조정
        if (this.difficulty === 'elite') {
            if (frame < 60 * 40) currentRate = Math.max(currentRate, 200);
            else if (frame < 60 * 70) currentRate = Math.max(currentRate, 160);
            else if (frame < EARLY_END) currentRate = Math.max(currentRate, 140);
        }

        const playerUnitCount = game.players.length;
        if (playerUnitCount > 10) {
            const reduction = Math.min(currentRate * 0.5, (playerUnitCount - 10) * 2);
            currentRate -= reduction;
        }

        if (!Number.isFinite(this.nextSpawnAt) || this.nextSpawnAt <= 0) {
            this.nextSpawnAt = frame + currentRate;
        }
        if (frame >= this.nextSpawnAt) {
            this.decideSpawn();
            this.lastSpawn = frame;
            const jitter = Math.floor((Math.random() * (this.spawnJitter * 2 + 1)) - this.spawnJitter);
            const next = Math.max(30, currentRate + jitter);
            this.nextSpawnAt = frame + next;
        }

        // ==========================
        // AI 특수무기 지능적 사용
        // ==========================
        this._updatePendingStrikes(frame);
        this._thinkSpecial(frame);

        // [NEW] 비행 끝나면 tacticalInFlight 해제
        if (this.special && this.special.tacticalInFlight) {
            const aliveTac = (game.projectiles || []).some(p => p && !p.dead && p._tactical);
            if (!aliveTac) this.special.tacticalInFlight = false;
        }

        // [NEW] 웨이브/거점 관리
        this._updateWaveController(frame);

        // [NEW] HQ 임계치 도달 시 남은 재고 전부 투입 (Total War)
        if (!this._totalWarIssued) {
            const hq = game.buildings.find(b => b.type === 'hq_enemy' && !b.dead);
            if (hq) {
                const max = hq.maxHp || (CONFIG.buildings[hq.type]?.hp ?? hq.hp);
                if (hq.hp <= max * 0.25) {
                    game.triggerTotalWar();
                    this._totalWarIssued = true;
                }
            }
        }
    },

    analyze() {
        const players = game.players || [];
        const analysis = {
            air: 0,
            tank: 0,
            infantry: 0,
            total: players.length,
            hasBunker: game.buildings.some(b => b.type === 'bunker' && b.team === 'player')
        };

        players.forEach(u => {
            if (!u || u.dead) return;
            if (u.stats && u.stats.type === 'air') analysis.air++;
            else if (u.stats && u.stats.category === 'armored') analysis.tank++;
            else analysis.infantry++;
        });

        return analysis;
    },

    // ==========================
    // Special Weapon Logic
    // ==========================
    _rand(min, max) { return Math.random() * (max - min) + min; },

    // [OPTIMIZED] SpatialGrid를 사용한 클러스터 검색 (O(N²) → O(N×K))
    _createClusterGrid(list, cellSize) {
        if (typeof SpatialGrid === 'undefined') return null;
        const grid = new SpatialGrid(CONFIG.mapWidth || 2400, 600, cellSize);
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (e && !e.dead) grid.insert(e);
        }
        return grid;
    },

    _bestClusterTarget(list, radius) {
        if (!list || list.length === 0) return null;

        // SpatialGrid 사용 시 O(N×K), 없으면 O(N²) 폴백
        const cellSize = Math.max(radius, 150);
        const grid = this._createClusterGrid(list, cellSize);

        let best = null;
        const r2 = radius * radius;

        for (let i = 0; i < list.length; i++) {
            const a = list[i];
            if (!a || a.dead) continue;

            let cnt = 0;
            let sx = 0, sy = 0;

            // SpatialGrid로 주변 셀만 검색 (평균 O(K) where K << N)
            const candidates = grid ? grid.retrieve(a) : list;
            const ay = a.y || game.groundY;

            for (let j = 0; j < candidates.length; j++) {
                const b = candidates[j];
                if (!b || b.dead) continue;
                const dx = b.x - a.x;
                const dy = (b.y || game.groundY) - ay;
                if (dx * dx + dy * dy <= r2) {
                    cnt++;
                    sx += b.x;
                    sy += (b.y || game.groundY);
                }
            }

            if (!best || cnt > best.count) {
                best = {
                    x: sx / Math.max(1, cnt),
                    y: sy / Math.max(1, cnt),
                    count: cnt
                };
            }
        }
        return best;
    },

    _countBuildingsNear(x, y, r) {
        const list = game.playerBuildings || [];
        let c = 0;
        for (const b of list) {
            if (!b || b.dead) continue;
            const dx = b.x - x;
            const dy = (b.y || game.groundY) - y;
            if (dx * dx + dy * dy <= r * r) c++;
        }
        return c;
    },

    _pickWeighted(pool, weights) {
        if (!pool || pool.length === 0) return null;
        if (!weights || weights.length !== pool.length) {
            return pool[Math.floor(Math.random() * pool.length)];
        }
        let total = 0;
        for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i]);
        if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
        let r = Math.random() * total;
        for (let i = 0; i < pool.length; i++) {
            r -= Math.max(0, weights[i]);
            if (r <= 0) return pool[i];
        }
        return pool[pool.length - 1];
    },

    _canSpawnUnit(id) {
        const u = CONFIG.units[id];
        if (!u) return false;
        if (game.enemySupply < u.cost) return false;
        if (game.enemyCooldowns && game.enemyCooldowns[id] > 0) return false;
        if (game.enemyStock && game.enemyStock[id] <= 0) return false;
        return true;
    },

    _spawnEnemyWithArmoredRatio(id, opts = {}) {
        const ignoreRatio = !!opts.ignoreArmoredRatio;
        let finalId = id;
        if (!ignoreRatio && id === 'aa_tank') {
            if (this.armoredWaveTankCount < 6 && this._canSpawnUnit('mbt')) {
                finalId = 'mbt';
            }
        }
        if (!this._canSpawnUnit(finalId)) {
            // Fallback: allow AA if MBT isn't available
            if (finalId !== id && this._canSpawnUnit(id)) {
                finalId = id;
            } else {
                return false;
            }
        }
        const spawned = (typeof game.spawnEnemy === 'function') ? game.spawnEnemy(finalId) : false;
        if (spawned) {
            if (finalId === 'mbt') this.armoredWaveTankCount++;
            else if (finalId === 'aa_tank') this.armoredWaveTankCount = 0;
        }
        return spawned;
    },

    _getTimeBasedSequence(frame) {
        const sec = (Number(frame) || 0) / 60;
        // [NEW] 시간 기반 스폰 계획 (순차적 + 약간의 편차)
        if (sec < 30) {
            return { key: '00:00-00:30', sequence: ['infantry', 'humvee', 'infantry'] };
        }
        if (sec < 60) {
            return { key: '00:30-01:00', sequence: ['infantry', 'humvee', 'engineer', 'drone_operator', 'rpg', 'infantry'] };
        }
        if (sec < 180) {
            return { key: '01:00-03:00', sequence: ['infantry', 'mbt', 'infantry', 'mbt', 'aa_tank'] };
        }
        if (sec < 300) {
            return { key: '03:00-05:00', sequence: ['apc', 'apache', 'humvee', 'infantry', 'apc'] };
        }
        if (sec < 420) {
            return { key: '05:00-07:00', sequence: ['fighter', 'apache', 'spg', 'fighter', 'spg'] };
        }
        return { key: '07:00+', sequence: ['bomber', 'fighter', 'apache', 'apc', 'mbt', 'spg', 'infantry', 'engineer', 'humvee', 'special_forces', 'rpg', 'drone_operator', 'aa_tank'] };
    },

    _getSequentialUnit(frame) {
        const phase = this._getTimeBasedSequence(frame);
        const seq = phase.sequence || [];
        if (this.seqKey !== phase.key) {
            this.seqKey = phase.key;
            this.seqIndex = 0;
        }
        if (seq.length === 0) return 'infantry';
        for (let i = 0; i < seq.length; i++) {
            const idx = (this.seqIndex + i) % seq.length;
            const id = seq[idx];
            if (this._canSpawnUnit(id)) {
                this.seqIndex = (idx + 1) % seq.length;
                return id;
            }
        }
        return 'infantry';
    },

    _getAntiAirResponse() {
        const seq = ['aa_tank', 'fighter', 'aa_tank', 'fighter', 'engineer'];
        for (let i = 0; i < seq.length; i++) {
            const idx = (this.counterIndex + i) % seq.length;
            const id = seq[idx];
            if (this._canSpawnUnit(id)) {
                this.counterIndex = (idx + 1) % seq.length;
                return id;
            }
        }
        return 'aa_tank';
    },

    _getEnemyHQ() {
        const b = (game.enemyBuildings || []).find(v => v && !v.dead && v.type === 'hq_enemy');
        if (b) return b;
        const any = (game.buildings || []).find(v => v && !v.dead && v.type === 'hq_enemy');
        return any || null;
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
        // 이미 경고 중이면 중복 방지
        if (this.special.pendingNukeWarning) return false;

        // [NEW] 공습경보 발동 - 3초 후 핵 발사
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
        this.special.cd.nuke = 60 * 90; // 90초
        return true;
    },

    // [NEW] 실제 핵 발사 (경고 후 실행)
    _executeNuke(x, y) {
        // 핵폭발 VFX(지면 고정)
        if (typeof VFX !== 'undefined') {
            VFX.spawn(game, 'nuke', x, game.groundY, { anchorGround: true });
        } else if (game.createParticles) {
            game.createParticles(x, game.groundY, 120, '#ef4444');
        }

        // 광범위 초토화
        this._applyAreaDamageToPlayer(x, game.groundY, 420, 1200, 1400);

        // AI 핵폭발 사운드 (boom-1)
        if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('nuke');
    },

    _castEMP(x, y) {
        if (!this.special || this.special.charges.emp <= 0 || this.special.cd.emp > 0) return false;

        // EMP는 "마비" 중심(플레이어 유닛/건물 스턴)
        // (플레이어 팀 전용 empTimer 구조가 없어서, 유닛/건물 stunTimer로 구현)
        const radius = 260;
        const r2 = radius * radius;

        // VFX: emp 프리셋이 없을 수도 있으니 안전 처리
        if (typeof VFX !== 'undefined' && VFX.PRESETS && VFX.PRESETS.emp) {
            VFX.spawn(game, 'emp', x, game.groundY, { anchorGround: true });
        } else if (game.createParticles) {
            game.createParticles(x, game.groundY, 35, '#3b82f6');
        }

        for (const u of (game.players || [])) {
            if (!u || u.dead) continue;
            const dx = u.x - x;
            const dy = (u.y || game.groundY) - game.groundY;
            if (dx * dx + dy * dy <= r2) {
                // Unit class는 stunTimer 체크가 존재함
                u.stunTimer = Math.max(u.stunTimer || 0, 180); // 약 3초
                // 공격 타겟 풀기
                u.attackTarget = null;
                // 다음 공격 지연(안전 보강)
                if (typeof u.lastAttack === 'number') u.lastAttack = (game.frame || 0) + 180;
                if (typeof u.lastBomb === 'number') u.lastBomb = (game.frame || 0) + 180;
            }
        }

        for (const b of (game.playerBuildings || [])) {
            if (!b || b.dead) continue;
            const dx = b.x - x;
            const dy = (b.y || game.groundY) - game.groundY;
            if (dx * dx + dy * dy <= r2) {
                // Building class는 stunTimer 체크가 존재함
                b.stunTimer = Math.max(b.stunTimer || 0, 240); // 약 4초
            }
        }

        if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('emp');

        this.special.charges.emp--;
        this.special.cd.emp = 60 * 45; // 45초
        return true;
    },

    _castTacticalMissile(x, y) {
        if (!this.special || this.special.charges.tactical <= 0 || this.special.cd.tactical > 0) return false;
        // [NEW] 90초 유예기간 체크
        if ((game.frame || 0) < this.special.tacticalGraceUntil) return false;
        // [NEW] 한 발 비행 중이면 다음 발 금지
        if (this.special.tacticalInFlight) return false;
        // 이미 경고 중이면 중복 방지
        if (this.special.pendingTacticalWarning) return false;

        // [NEW] 공습경보 발동 - 3초 후 전술미사일 발사
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
        this.special.cd.tactical = 60 * 45; // 45초
        return true;
    },

    // [NEW] 실제 전술미사일 발사 예약 (경고 후 실행)
    _executeTacticalMissile(x, y) {
        // 즉시 발사가 아닌 2~4초 딜레이 후 발사 예약
        const delay = Math.floor(this._rand(60 * 2, 60 * 4)); // 2~4초 딜레이
        this.special.pendingLaunch.push({
            at: (game.frame || 0) + delay,
            x,
            y: game.groundY
        });
    },

    _updatePendingStrikes(frame) {
        // [NEW] 공습경보 후 핵 발사 처리
        if (this.special && this.special.pendingNukeWarning) {
            const w = this.special.pendingNukeWarning;
            if (frame >= w.at) {
                // 경고 끝 - 실제 핵 발사
                this._executeNuke(w.x, w.y);
                this.special.pendingNukeWarning = null;
                // 경고 상태 해제
                if (typeof game !== 'undefined') game.airRaidWarning = null;
            }
        }

        // [NEW] 공습경보 후 전술미사일 발사 처리
        if (this.special && this.special.pendingTacticalWarning) {
            const w = this.special.pendingTacticalWarning;
            if (frame >= w.at) {
                // 경고 끝 - 실제 전술미사일 발사 예약
                this._executeTacticalMissile(w.x, w.y);
                this.special.pendingTacticalWarning = null;
                // 경고 상태 해제
                if (typeof game !== 'undefined') game.airRaidWarning = null;
            }
        }

        // [NEW] pending tactical launch 처리
        if (this.special && this.special.pendingLaunch && this.special.pendingLaunch.length) {
            for (let i = this.special.pendingLaunch.length - 1; i >= 0; i--) {
                const s = this.special.pendingLaunch[i];
                if (frame < s.at) continue;

                const hq = this._getEnemyHQ();
                const startX = hq ? hq.x : (CONFIG.mapWidth - 120);
                const startY = hq ? (hq.y - (hq.height || 120) + 35) : (game.groundY - 120);

                if (typeof Projectile !== 'undefined' && game.projectiles) {
                    const p = new Projectile(startX, startY, null, 350, 'enemy', 'tactical_missile', { targetX: s.x, targetY: game.groundY });
                    p._tactical = true;

                    game.projectiles.push(p);
                    this.special.tacticalInFlight = true;
                }
                this.special.pendingLaunch.splice(i, 1);
            }
        }

        if (!this.special || !this.special.pending || this.special.pending.length === 0) return;

        for (let i = this.special.pending.length - 1; i >= 0; i--) {
            const s = this.special.pending[i];
            if (frame < s.at) continue;

            // 도착 후 "전술급 폭발" (핵처럼 화면 플래시/고리는 나중에 폭발 모듈에서 제거 예정)
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'tactical', s.x, s.y, { anchorGround: true });
            } else if (game.createParticles) {
                game.createParticles(s.x, s.y, 60, '#ff3333');
            }

            // 전술급 피해
            this._applyAreaDamageToPlayer(s.x, s.y, 260, 520, 720);

            // ✅ AI 전술미사일 폭발 사운드 (boom-3)
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('tactical');

            this.special.pending.splice(i, 1);
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
        const wantTac = !!unitCluster && enoughTime && (
            (unitCount >= 10) ||
            (unitCount >= 8 && bNearUnits >= 3) ||
            (unitCount >= 7 && bNearUnits >= 4 && frame > 60 * 180)
        );

        // 우선순위: (조건 만족 시) 핵 > EMP > 전술미사일
        if (wantNuke && this.special.charges.nuke > 0 && this.special.cd.nuke <= 0) {
            this._castNuke(unitX, by);
            return;
        }

        if (wantEMP && this.special.charges.emp > 0 && this.special.cd.emp <= 0) {
            this._castEMP(bx, by);
            return;
        }

        // [NEW] 비행 중이면 전술미사일 발사 금지
        if (this.special.tacticalInFlight) return;

        if (wantTac && this.special.charges.tactical > 0 && this.special.cd.tactical <= 0) {
            this._castTacticalMissile(unitX, by);
            return;
        }
    },

    // ==========================
    // 기존 스폰 AI 로직 유지
    // ==========================
    decideSpawn() {
        if (game.enemySupply < 50) return;

        const info = this.analyze();
        const diff = this.difficulty;
        const frame = game.frame || 0;
        let choice = this._getSequentialUnit(frame);

        // [NEW] 폭격기/본진 위협 시 대공/전투기 위주 대응
        const enemyHQ = this._getEnemyHQ();
        const bomberThreat = (game.players || []).some(u => u && !u.dead && u.stats && u.stats.id === 'bomber');
        const hqThreat = enemyHQ && (game.players || []).some(u => u && !u.dead && Math.abs(u.x - enemyHQ.x) < 320);
        const useAntiAirResponse = (bomberThreat || hqThreat);
        if (useAntiAirResponse) {
            choice = this._getAntiAirResponse();
        }

        // [NEW] 게임 단계 정의
        const EARLY_END = 60 * 90;   // 90초
        const isEarly = frame < EARLY_END;

        if (diff === 'elite') {
            // 후반(07:00+)에만 보너스 스폰 허용
            if (!isEarly && frame >= 60 * 420 && Math.random() < 0.05 && game.enemySupply > 1000) {
                game.spawnEnemy('bomber');
            }
        }

        // [NEW] Aggressive Spending
        const enemyUnitCount = game.enemies.length;

        // 요새 살아있는지 체크
        const fort = game.buildings.find(b => b.type === 'fortress_enemy');
        const fortAlive = fort && !fort.dead;

        // [UPDATED] 초반에는 물량 공세 완화 (긴급 상황 예외)
        if (isEarly) {
            // 긴급 상황 체크: 플레이어가 압도적 전력 운용 시 제한 완화
            const isEmergency = (info.air >= 4 || info.tank >= 4 || (info.hasBunker && info.infantry >= 6));

            // 긴급 상황이면 12기까지 허용, 아니면 8기 제한
            const earlyLimit = isEmergency ? 12 : 8;
            if (enemyUnitCount >= earlyLimit) return;

            this._spawnEnemyWithArmoredRatio(choice, { ignoreArmoredRatio: useAntiAirResponse });
            return;
        }

        // 중반/후반: 기존 로직 유지
        if (game.enemySupply > 300) {
            this._spawnEnemyWithArmoredRatio(choice, { ignoreArmoredRatio: useAntiAirResponse });

            if (info.total > enemyUnitCount + 5 || game.enemySupply > 1000) {
                const support = this._getSequentialUnit(frame);
                // [NEW] 분산 스폰 (모아서 안 뽑고 텀 두고 계속)
                const d1 = fortAlive ? 350 : 220;
                const d2 = fortAlive ? 800 : 450;

                setTimeout(() => this._spawnEnemyWithArmoredRatio(support, { ignoreArmoredRatio: false }), d1 + Math.random() * 150);

                if (diff === 'elite' && game.enemySupply > 500) {
                    setTimeout(() => this._spawnEnemyWithArmoredRatio(choice, { ignoreArmoredRatio: useAntiAirResponse }), d2 + Math.random() * 250);
                }
            }
        } else {
            this._spawnEnemyWithArmoredRatio(choice, { ignoreArmoredRatio: useAntiAirResponse });
        }
    },

    getCounterUnit(info, isElite) {
        const r = Math.random();
        const frame = game.frame || 0;

        // [NEW] 게임 단계 정의
        // 초반 (0~90초): 보병, RPG, 험비 위주
        // 중반 (90~180초): 기갑 유닛 추가 (MBT, AA탱크, 자주포)
        // 후반 (180초+): 공중 유닛 추가 (아파치, 전투기, 폭격기)
        const EARLY_END = 60 * 90;   // 90초
        const MID_END = 60 * 180;    // 180초

        const isEarly = frame < EARLY_END;
        const isMid = frame >= EARLY_END && frame < MID_END;

        // ===== 긴급 상성 예외 (단계 무시) =====
        // 플레이어가 특정 유닛을 과도하게 운용 시 상성 유닛 긴급 투입

        // 예외 1: 공중 유닛이 4기 이상이면 대공 유닛 긴급 스폰
        if (info.air >= 4) {
            if (isElite) return r < 0.5 ? 'aa_tank' : 'fighter';
            return r < 0.7 ? 'aa_tank' : 'engineer';
        }

        // 예외 2: 기갑 유닛이 4기 이상이면 대전차 유닛 긴급 스폰
        if (info.tank >= 4) {
            if (isElite) return r < 0.4 ? 'spg' : (r < 0.7 ? 'drone_operator' : 'engineer');
            return r < 0.5 ? 'spg' : 'engineer';
        }

        // 예외 3: 벙커가 있고 보병이 많으면 자주포/폭격기 긴급 스폰
        if (info.hasBunker && info.infantry >= 6) {
            if (isElite && frame > 60 * 60) return r < 0.4 ? 'bomber' : 'spg';
            return 'spg';
        }

        // ===== 초반: 지상 경보병 위주 =====
        if (isEarly) {
            const earlyPool = ['infantry', 'infantry', 'engineer', 'humvee'];
            return earlyPool[Math.floor(Math.random() * earlyPool.length)];
        }

        // ===== 중반: 기갑 유닛 추가 =====
        if (isMid) {
            // 카운터 로직 적용하되 공중 유닛 제외
            if (info.tank > 2) {
                return r < 0.6 ? 'engineer' : 'mbt';
            }
            if (info.infantry > 8) {
                return 'humvee';
            }
            if (info.hasBunker) {
                return 'spg';
            }

            // 기본 중반 풀 (기갑 포함, 공중 제외)
            const midPool = ['infantry', 'engineer', 'humvee', 'mbt', 'mbt', 'aa_tank'];
            if (isElite) {
                const eliteMidPool = ['infantry', 'engineer', 'mbt', 'mbt', 'spg', 'special_forces', 'aa_tank'];
                return eliteMidPool[Math.floor(Math.random() * eliteMidPool.length)];
            }
            return midPool[Math.floor(Math.random() * midPool.length)];
        }

        // ===== 후반: 전체 유닛 사용 가능 (공중 포함) =====
        // Priority 0: Bomber (High Resources or High Value Targets)
        if (isElite && (info.hasBunker || info.total > 10) && game.enemySupply >= 200) {
            if (Math.random() < 0.2) return 'bomber';
        }

        // 1. Counter Air Force
        if (info.air > 3) {
            if (isElite) return r < 0.6 ? 'aa_tank' : 'fighter';
            return r < 0.6 ? 'engineer' : 'aa_tank';
        }

        // 2. Counter Tanks
        if (info.tank > 2) {
            if (isElite) return r < 0.5 ? 'bomber' : (r < 0.8 ? 'drone_operator' : 'mbt');
            return r < 0.5 ? 'engineer' : 'mbt';
        }

        // 3. Counter Infantry Swarm
        if (info.infantry > 8) {
            if (isElite) return r < 0.5 ? 'apache' : 'humvee';
            return 'humvee';
        }

        // 4. Bunker Breaker
        if (info.hasBunker) {
            if (isElite) return r < 0.4 ? 'drone_operator' : 'spg';
            return 'spg';
        }

        // 5. Default Aggression (후반)
        if (isElite) {
            const pool = ['mbt', 'apache', 'drone_operator', 'special_forces', 'fighter'];
            return pool[Math.floor(Math.random() * pool.length)];
        } else {
            const pool = ['infantry', 'engineer', 'mbt', 'humvee', 'apache'];
            return pool[Math.floor(Math.random() * pool.length)];
        }
    },

    useSpecial(info) {
        // Elite AI capability (유닛 기반)
        if (Math.random() < 0.5) {
            // [R 4.2] 드론병 3명 스폰 (구 드론 직접 스폰 제거)
            for (let i = 0; i < 3; i++) setTimeout(() => game.spawnEnemy('drone_operator'), i * 500);
        } else {
            game.spawnEnemy('bomber');
        }
    },

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

    _updateWaveController(frame) {
        const wps = this._getWaypoints();
        if (!wps || wps.length < 2) return;

        // 너무 자주 명령 내리면 난장판 => 0.8~1.2초 간격
        if (frame - this.wave.lastCommandFrame < 60) return;

        // 위협 체크는 조금 더 천천히(0.5초~1초)
        const doThreatCheck = (frame - this.wave.lastThreatCheck > 40);

        // 초기/초반일수록 HOLD 시간을 길게
        const early = frame < 60 * 70; // 약 70초까지는 신중하게
        const baseHold = early ? (60 * 4) : (60 * 2);   // 4초 vs 2초

        // 현재 웨이포인트 목표
        const wp = wps[Math.max(0, Math.min(this.wave.wpIndex, wps.length - 1))];

        // 위협 평가
        let threat = null;
        if (doThreatCheck) {
            threat = this._assessThreat(wps);
            this.wave.lastThreatCheck = frame;
        }

        // ===== 상태 전이 규칙 =====
        // (1) 아군이 많거나 몰려오면 -> RETREAT(잠깐 뒤로)
        if (threat && threat.shouldRetreat) {
            this.wave.phase = 'RETREAT';
            this.wave.retreatUntil = frame + (early ? 60 * 6 : 60 * 4); // 6초/4초
            this.wave.wpIndex = 0; // BASE로
            this._orderRetreatTo(wps[0].x);
            this.wave.lastCommandFrame = frame;
            return;
        }

        // RETREAT 상태 지속
        if (this.wave.phase === 'RETREAT') {
            if (frame < this.wave.retreatUntil) {
                // 수비 재정비: BASE/FORT 근처로 모으고 정지
                this._orderHoldAt(wps[1]?.x ?? wps[0].x, 280);
                this.wave.lastCommandFrame = frame;
                return;
            } else {
                // 후퇴 끝 → HOLD로 복귀
                this.wave.phase = 'HOLD';
                this.wave.wpIndex = 1; // FORT부터 재정비
                this.wave.holdUntil = frame + baseHold;
            }
        }

        // (2) HOLD: 거점에서 잠시 정지(대열 정비) + 거점 방어 우선
        if (this.wave.phase === 'HOLD') {
            if (frame < this.wave.holdUntil) {
                this._orderHoldAt(wp.x, 320);
                this.wave.lastCommandFrame = frame;
                return;
            }

            // HOLD 종료 → PUSH
            this.wave.phase = 'PUSH';
        }

        // (3) PUSH: 다음 거점으로 이동시키되, 일부는 거점 수비로 남김
        if (this.wave.phase === 'PUSH') {
            // 다음 거점으로 단계적으로 전진
            const nextIndex = Math.min(this.wave.wpIndex + 1, wps.length - 1);
            const nextWp = wps[nextIndex];

            this._orderPushTo(nextWp.x, wp.x);
            this.wave.wpIndex = nextIndex;

            // 다음 거점 도착 전 정지 준비
            this.wave.phase = 'HOLD';
            this.wave.holdUntil = frame + baseHold + Math.floor(Math.random() * 60);

            this.wave.lastCommandFrame = frame;
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
        const shouldRetreat = early ? (outnumbered || playerPush >= 6) : outnumbered;

        return { playerPush, enemyFront, shouldRetreat };
    },

    _orderHoldAt(x, radius = 300) {
        // 거점 주변에 모여서 stop(방어)
        for (const u of game.enemies) {
            if (!u || u.dead) continue;

            // 너무 멀리 떨어진 애들은 모이고, 근처 애들은 정지
            if (Math.abs(u.x - x) > radius) {
                u.commandMode = 'move';
                u.commandTargetX = x + (Math.random() * 120 - 60);
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

            // 전선에 있는 애들만 후퇴(너무 뒤에 있는 애는 유지)
            if (u.x < xBack + 220) continue;

            u.commandMode = 'retreat';
            u.returnToBase = true;

            // 혹시 retreat가 returnToBase 기반이면, targetX도 같이
            u.targetX = xBack + (Math.random() * 80 - 40);
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

            // 거점 수비조
            if (i < keepCount) {
                if (Math.abs(u.x - xHold) > 260) {
                    u.commandMode = 'move';
                    u.commandTargetX = xHold + (Math.random() * 120 - 60);
                    u.targetX = u.commandTargetX;
                } else {
                    u.commandMode = 'stop';
                    u.targetX = null;
                    u.commandTargetX = null;
                }
                continue;
            }

            // 전진조
            u.commandMode = 'move';
            u.commandTargetX = xNext + (Math.random() * 160 - 80);
            u.targetX = u.commandTargetX;
        }
    }
};






