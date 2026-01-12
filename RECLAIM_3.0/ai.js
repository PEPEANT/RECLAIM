const AI = {
    difficulty: 'veteran', // recruit, veteran, elite
    lastSpawn: 0,
    checkInterval: 60, // analysis tick (frames)

    // Config: Spawn Rates (frames between spawns) & Resource Multipliers
    settings: {
        recruit: { rate: 200, supplyMult: 1.0, smart: false },
        veteran: { rate: 120, supplyMult: 2.0, smart: true },
        elite: { rate: 90, supplyMult: 3.0, smart: 'very' }
    },

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
            pending: []
        };
    },

    setDifficulty(diff) {
        this.difficulty = diff || 'veteran';
        const s = this.settings[this.difficulty];
        if (typeof game !== 'undefined') {
            game.enemySupplyRate = CONFIG.supplyRate * s.supplyMult;
        }
        // 특수무기 상태 초기화
        this._initSpecialState();
        console.log(`AI Set to ${this.difficulty}`);
    },

    update(frame) {
        if (!game || !game.running) return;

        // safety: 게임 시작 후 setDifficulty를 안 탔다면
        if (!this.special) this._initSpecialState();

        // [NEW] Dynamic Spawn Rate Logic
        let currentRate = this.settings[this.difficulty].rate;

        const playerUnitCount = game.players.length;
        if (playerUnitCount > 10) {
            const reduction = Math.min(currentRate * 0.5, (playerUnitCount - 10) * 2);
            currentRate -= reduction;
        }

        if (frame - this.lastSpawn > currentRate) {
            this.decideSpawn();
            this.lastSpawn = frame;
        }

        // ==========================
        // AI 특수무기 지능적 사용
        // ==========================
        this._updatePendingStrikes(frame);
        this._thinkSpecial(frame);
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

    _bestClusterTarget(list, radius) {
        if (!list || list.length === 0) return null;
        let best = null;

        for (let i = 0; i < list.length; i++) {
            const a = list[i];
            if (!a || a.dead) continue;

            let cnt = 0;
            let sx = 0, sy = 0;

            for (let j = 0; j < list.length; j++) {
                const b = list[j];
                if (!b || b.dead) continue;
                const dx = b.x - a.x;
                const dy = (b.y || game.groundY) - (a.y || game.groundY);
                if (dx * dx + dy * dy <= radius * radius) {
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

        // 핵폭발 VFX(지면 고정)
        if (typeof VFX !== 'undefined') {
            VFX.spawn(game, 'nuke', x, game.groundY, { anchorGround: true });
        } else if (game.createParticles) {
            game.createParticles(x, game.groundY, 120, '#ef4444');
        }

        // 광범위 초토화
        this._applyAreaDamageToPlayer(x, game.groundY, 420, 1200, 1400);

        // ✅ AI 핵폭발 사운드 (boom-1)
        if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('nuke');

        this.special.charges.nuke--;
        this.special.cd.nuke = 60 * 90; // 90초
        return true;
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

        const hq = this._getEnemyHQ();
        const startX = hq ? hq.x : (CONFIG.mapWidth - 120);
        const startY = hq ? (hq.y - (hq.height || 120) + 35) : (game.groundY - 120);

        // "본부에서 실제 발사" 느낌: 적 HQ 위치에서 목표로 탄도 투사(artillery 사용)
        if (typeof Projectile !== 'undefined' && game.projectiles) {
            const dummyTarget = { x: x, y: game.groundY, height: 0 }; // 안전 더미
            const p = new Projectile(startX, startY, dummyTarget, 350, 'enemy', 'artillery');
            // 전술미사일 식별(나중에 projectiles.js에서 분기할 때 사용 가능)
            p._tactical = true;
            game.projectiles.push(p);

            // artillery는 flightDuration(45)로 도착 -> 도착 프레임에 추가 폭발/추가 피해
            this.special.pending.push({
                at: (game.frame || 0) + 45,
                x: x,
                y: game.groundY
            });
        } else {
            // Projectile이 없으면 즉시 타격
            if (typeof VFX !== 'undefined') VFX.spawn(game, 'tactical', x, game.groundY, { anchorGround: true });
            this._applyAreaDamageToPlayer(x, game.groundY, 220, 420, 520);
        }

        this.special.charges.tactical--;
        this.special.cd.tactical = 60 * 25; // 25초
        return true;
    },

    _updatePendingStrikes(frame) {
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

        // 1) 방어요새(1차방어사령부)가 깨질 때 핵 사용(우선)
        const fortress = this._getPlayerFortress();
        const fortressAliveNow = !!fortress;

        if (this.special.fortressWasAlive && !fortressAliveNow && !this.special.nukeUsedOnFortressBreak) {
            // 본부/전방 라인 근처로 핵
            const hx = (game.buildings || []).find(b => b && !b.dead && b.type === 'hq_player')?.x ?? (CONFIG.mapWidth * 0.25);
            const tx = hx + this._rand(-80, 80);
            const ok = this._castNuke(tx, game.groundY);
            if (ok) this.special.nukeUsedOnFortressBreak = true;
        }
        this.special.fortressWasAlive = fortressAliveNow;

        // 2) 뭉쳐있으면 전술미사일/핵/EMP 선택
        const cluster = this._bestClusterTarget(players, 160);
        if (!cluster) return;

        const bx = cluster.x;
        const by = game.groundY;

        // buildings near cluster (방어 시설 밀집 판단)
        const bNear = this._countBuildingsNear(bx, by, 260);

        // 핵: 매우 큰 뭉침일 때만(초반부터 난사 금지)
        const wantNuke = (cluster.count >= 10 && frame > 60 * 70) || (cluster.count >= 8 && bNear >= 2 && frame > 60 * 90);

        // EMP: 중간중간(방어시설/병력 밀집) — 마비 위주
        const wantEMP = (cluster.count >= 5 && bNear >= 1) || (bNear >= 3);

        // 전술미사일: 자주 사용하는 정밀타격
        const wantTac = (cluster.count >= 4) || (bNear >= 2);

        // 우선순위: (조건 만족 시) 핵 > EMP > 전술미사일
        if (wantNuke && this.special.charges.nuke > 0 && this.special.cd.nuke <= 0) {
            this._castNuke(bx, by);
            return;
        }

        if (wantEMP && this.special.charges.emp > 0 && this.special.cd.emp <= 0) {
            this._castEMP(bx, by);
            return;
        }

        if (wantTac && this.special.charges.tactical > 0 && this.special.cd.tactical <= 0) {
            this._castTacticalMissile(bx, by);
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
        let choice = 'infantry';

        if (diff === 'recruit') {
            const r = Math.random();
            if (r < 0.5) choice = 'infantry';
            else if (r < 0.8) choice = 'rpg';
            else choice = 'humvee';
        }
        else if (diff === 'veteran') {
            choice = this.getCounterUnit(info, false);
        }
        else if (diff === 'elite') {
            choice = this.getCounterUnit(info, true);

            if (Math.random() < 0.05 && game.enemySupply > 1000) {
                this.useSpecial(info);
            }
        }

        // [NEW] Aggressive Spending
        const enemyUnitCount = game.enemies.length;

        if (game.enemySupply > 300) {
            game.spawnEnemy(choice);

            if (info.total > enemyUnitCount + 5 || game.enemySupply > 1000) {
                const support = Math.random() < 0.5 ? 'infantry' : 'rpg';
                setTimeout(() => game.spawnEnemy(support), 200);

                if (diff === 'elite' && game.enemySupply > 500) {
                    setTimeout(() => game.spawnEnemy(choice), 400);
                }
            }
        } else {
            game.spawnEnemy(choice);
        }
    },

    getCounterUnit(info, isElite) {
        const r = Math.random();

        // Priority 0: Bomber (High Resources or High Value Targets)
        if (isElite && (info.hasBunker || info.total > 10) && game.enemySupply >= 200) {
            if (Math.random() < 0.2) return 'bomber';
        }

        // 1. Counter Air Force
        if (info.air > 3) {
            if (isElite) return r < 0.6 ? 'aa_tank' : 'fighter';
            return r < 0.6 ? 'rpg' : 'aa_tank';
        }

        // 2. Counter Tanks
        if (info.tank > 2) {
            if (isElite) return r < 0.5 ? 'bomber' : (r < 0.8 ? 'drone_at' : 'mbt');
            return r < 0.5 ? 'rpg' : 'mbt';
        }

        // 3. Counter Infantry Swarm
        if (info.infantry > 8) {
            if (isElite) return r < 0.5 ? 'apache' : 'humvee';
            return 'humvee';
        }

        // 4. Bunker Breaker
        if (info.hasBunker) {
            if (isElite) return r < 0.4 ? 'stealth_drone' : 'spg';
            return 'spg';
        }

        // 5. Default Aggression
        if (isElite) {
            const pool = ['mbt', 'apache', 'tactical_drone', 'special_forces'];
            return pool[Math.floor(Math.random() * pool.length)];
        } else {
            const pool = ['infantry', 'rpg', 'mbt', 'humvee'];
            return pool[Math.floor(Math.random() * pool.length)];
        }
    },

    useSpecial(info) {
        // Elite AI capability (유닛 기반)
        if (Math.random() < 0.5) {
            // Spawn 3 suicide drones
            for (let i = 0; i < 3; i++) setTimeout(() => game.spawnEnemy('drone_suicide'), i * 500);
        } else {
            game.spawnEnemy('bomber');
        }
    }
};
