(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
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

    _getSpawnFamily(id) {
        const u = (CONFIG && CONFIG.units) ? CONFIG.units[id] : null;
        if (!u) return 'infantry';
        if (id === 'spg' || id === 'bomber' || id === 'icbm_enemy') return 'siege';
        if (u.type === 'air') return 'air';
        if (u.category === 'armored') return 'armored';
        if (['engineer', 'drone_operator', 'sniper', 'special_ops'].includes(id)) return 'support';
        return 'infantry';
    },

    _getFamilyCooldownFrames(family) {
        const table = this.spawnControl && this.spawnControl.familyCooldownFrames;
        const raw = table && Number.isFinite(Number(table[family])) ? Number(table[family]) : 0;
        return Math.max(0, Math.floor(raw));
    },

    _getRecentSpawnCount(id) {
        const arr = Array.isArray(this.recentSpawnIds) ? this.recentSpawnIds : [];
        let c = 0;
        for (let i = 0; i < arr.length; i++) if (arr[i] === id) c++;
        return c;
    },

    _registerSpawnDecision(id, frame) {
        if (!id) return;
        if (!Array.isArray(this.recentSpawnIds)) this.recentSpawnIds = [];
        if (!this.spawnFamilyCooldownUntil || typeof this.spawnFamilyCooldownUntil !== 'object') {
            this.spawnFamilyCooldownUntil = {};
        }

        this.recentSpawnIds.push(id);
        const maxRecent = Math.max(2, Math.floor(Number(this.spawnControl?.recentWindow) || 6));
        while (this.recentSpawnIds.length > maxRecent) this.recentSpawnIds.shift();

        const family = this._getSpawnFamily(id);
        const cd = this._getFamilyCooldownFrames(family);
        if (cd > 0) this.spawnFamilyCooldownUntil[family] = Math.max(Number(this.spawnFamilyCooldownUntil[family]) || 0, frame + cd);
    },

    _getThreatScores(info) {
        const air = Math.max(0, Number(info?.air) || 0);
        const tank = Math.max(0, Number(info?.tank) || 0);
        const infantry = Math.max(0, Number(info?.infantry) || 0);
        const total = Math.max(0, Number(info?.total) || 0);
        const hasBunker = !!info?.hasBunker;

        const players = Array.isArray(game?.players) ? game.players : [];
        let airPower = 0;
        let armorPower = 0;
        let infantryPower = 0;
        let overallPower = 0;

        const getUnitThreat = (u) => {
            if (!u || u.dead || !u.stats) return 0;
            const s = u.stats || {};
            if (s.invulnerable) return 0;
            const hpMax = Math.max(1, Number(u.maxHp) || Number(s.hp) || 1);
            const hpCur = Math.max(0, Number(u.hp));
            const hpRatio = Math.max(0.2, Math.min(1.1, hpCur / hpMax));
            const dmg = Math.max(
                Number(s.damage) || 0,
                Number(s.damageGround) || 0,
                Number(s.damageAir) || 0,
                Number(s.missileDamage) || 0
            );
            const range = Math.max(0, Number((typeof u.getEffectiveRange === 'function') ? u.getEffectiveRange() : s.range) || 0);
            const speed = Math.max(0, Number(s.speed) || 0);
            let score = 0.55
                + Math.min(2.5, hpMax / 520)
                + Math.min(2.4, dmg / 50)
                + Math.min(1.8, range / 560)
                + Math.min(0.7, speed / 1.9);
            const type = String(s.type || '');
            const category = String(s.category || '');
            const id = String(s.id || '');
            if (type === 'air') score *= 1.14;
            if (category === 'armored' || type === 'mech') score *= 1.17;
            if (id === 'spg' || id === 'bomber') score *= 1.18;
            return Math.max(0.15, score * hpRatio);
        };

        for (let i = 0; i < players.length; i++) {
            const u = players[i];
            const score = getUnitThreat(u);
            if (score <= 0) continue;
            overallPower += score;
            const type = String((u && u.stats && u.stats.type) || '');
            const category = String((u && u.stats && u.stats.category) || '');
            if (type === 'air') airPower += score;
            else if (category === 'armored' || type === 'mech') armorPower += score;
            else infantryPower += score;
        }

        const weightedAir = Math.max(air, airPower);
        const weightedArmor = Math.max(tank, armorPower);
        const weightedInf = Math.max(infantry, infantryPower);
        const weightedTotal = Math.max(total, overallPower);

        return {
            antiAir: (weightedAir * 1.9) + (weightedAir >= 5 ? 2 : 0),
            antiArmor: (weightedArmor * 1.7) + (weightedArmor >= 5 ? 2 : 0),
            antiInfantry: Math.max(0, weightedInf - 5) * 1.45,
            siege: (hasBunker ? 4 : 0) + (weightedTotal >= 18 ? 2 : 0),
            pressure: Math.max(0, weightedTotal - this._getAliveEnemyUnitCount())
        };
    },

    _getDefaultSpawnProfile(frame) {
        const seq = this._getTimeBasedSequence(frame)?.sequence || [];
        if (!seq.length) return [{ id: 'infantry', w: 1 }];
        const counts = {};
        for (let i = 0; i < seq.length; i++) {
            const id = seq[i];
            counts[id] = (counts[id] || 0) + 1;
        }
        return Object.keys(counts).map(id => ({ id, w: counts[id] }));
    },

    _applyThreatWeights(weightMap, threat) {
        if (!weightMap || typeof weightMap.get !== 'function') return;
        const add = (id, amount) => {
            if (!Number.isFinite(amount) || amount <= 0) return;
            weightMap.set(id, (weightMap.get(id) || 0) + amount);
        };

        add('aa_tank', threat.antiAir * 1.2);
        add('fighter', threat.antiAir * 1.1);
        add('engineer', threat.antiAir * 0.5);

        add('engineer', threat.antiArmor * 1.0);
        add('spg', threat.antiArmor * 0.9);
        add('mbt', threat.antiArmor * 0.6);
        add('drone_operator', threat.antiArmor * 0.7);

        add('humvee', threat.antiInfantry * 0.9);
        add('apache', threat.antiInfantry * 1.1);
        add('apc', threat.antiInfantry * 0.7);

        add('spg', threat.siege * 1.4);
        add('bomber', threat.siege * 0.8);

        if (threat.pressure >= 5) {
            add('infantry', 2);
            add('humvee', 1.4);
            add('apc', 1.2);
        }
    },

    _selectSpawnByThreatScore(info, frame) {
        const base = this._getDefaultSpawnProfile(frame);
        if (!Array.isArray(base) || base.length === 0) return this._getSequentialUnit(frame);

        const threat = this._getThreatScores(info);
        const weightMap = new Map();
        for (let i = 0; i < base.length; i++) {
            const row = base[i];
            if (!row || !row.id) continue;
            const id = String(row.id);
            const w = Math.max(0.1, Number(row.w) || 1);
            weightMap.set(id, (weightMap.get(id) || 0) + w);
        }
        this._applyThreatWeights(weightMap, threat);

        const ids = [];
        const ws = [];
        const entries = Array.from(weightMap.entries());
        for (let i = 0; i < entries.length; i++) {
            const [id, baseW] = entries[i];
            if (!this._canSpawnUnit(id)) continue;

            let w = Math.max(0, Number(baseW) || 0);
            const family = this._getSpawnFamily(id);
            const familyCdUntil = Number(this.spawnFamilyCooldownUntil?.[family]) || 0;
            if (frame < familyCdUntil) w *= 0.2;

            const recentCount = this._getRecentSpawnCount(id);
            if (recentCount > 0) w *= Math.pow(0.52, recentCount);
            if (recentCount >= 3) w *= 0.08;

            if (w <= 0.01) continue;
            ids.push(id);
            ws.push(w);
        }

        if (!ids.length) return this._getSequentialUnit(frame);
        const picked = this._pickWeighted(ids, ws);
        return picked || this._getSequentialUnit(frame);
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
            return { key: '05:00-07:00', sequence: ['fighter', 'apache', 'spg', 'icbm_enemy', 'fighter', 'spg'] };
        }
        return { key: '07:00+', sequence: ['bomber', 'fighter', 'apache', 'apc', 'mbt', 'spg', 'icbm_enemy', 'infantry', 'engineer', 'humvee', 'rpg', 'drone_operator', 'aa_tank'] };
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

    // ==========================
    // 기존 스폰 AI 로직 유지
    // ==========================
    decideSpawn() {
        if (game.enemySupply < 50) return;

        const info = this.analyze();
        const frame = game.frame || 0;
        const massSpawnBoost = (typeof this._getMassSpawnResponseBoost === 'function')
            ? this._getMassSpawnResponseBoost(frame)
            : null;
        const massResponseActive = !!(massSpawnBoost && massSpawnBoost.active);
        const enemyUnitCount = this._getAliveEnemyUnitCount();
        if (!this._canSpawnByWaveCap(1, frame)) return;
        const aliveCap = this._getGlobalAliveCap(frame);
        if (enemyUnitCount >= aliveCap) return;

        let choice = this.enableSafeAiV2
            ? this._selectSpawnByThreatScore(info, frame)
            : this._getSequentialUnit(frame);

        // [NEW] 폭격기/본진 위협 시 대공/전투기 위주 대응
        const enemyHQ = this._getEnemyHQ();
        const bomberThreat = (game.players || []).some(u => u && !u.dead && u.stats && u.stats.id === 'bomber');
        const hqThreat = enemyHQ && (game.players || []).some(u => u && !u.dead && Math.abs(u.x - enemyHQ.x) < 320);
        const useAntiAirResponse = (bomberThreat || hqThreat);
        if (useAntiAirResponse) {
            const antiAirChoice = this._getAntiAirResponse();
            if (this._canSpawnUnit(antiAirChoice)) choice = antiAirChoice;
        }

        if (!this._canSpawnUnit(choice)) {
            const fallback = this._getSequentialUnit(frame);
            if (!this._canSpawnUnit(fallback)) return;
            choice = fallback;
        }

        const EARLY_END = 60 * 90;   // 90초
        const isEarly = frame < EARLY_END;

        // 초반에는 보수적으로 유지 (긴급 상황은 일부 완화)
        if (isEarly) {
            const isEmergency = (info.air >= 4 || info.tank >= 4 || (info.hasBunker && info.infantry >= 6));
            let earlyLimit = isEmergency
                ? aliveCap
                : Math.max(6, aliveCap - 2);
            if (enemyUnitCount >= earlyLimit) return;
        }

        const spawned = this._spawnEnemyWithArmoredRatio(choice, { ignoreArmoredRatio: useAntiAirResponse });
        if (!spawned) return;

        // 분산 보강 스폰: 한 프레임 폭주 대신 짧은 텀을 둔다.
        const supportNeed = massResponseActive
            || (info.total > enemyUnitCount + 4)
            || (this.difficulty === 'elite' && game.enemySupply > 900);
        if (!supportNeed) return;

        let extraChance = (this.difficulty === 'elite') ? 0.32 : (this.difficulty === 'veteran' ? 0.2 : 0.1);
        if (massResponseActive) {
            const bonus = Math.max(0, Number(massSpawnBoost?.supportChanceBonus) || 0);
            extraChance = Math.min(0.9, extraChance + bonus);
        }
        if (Math.random() > extraChance) return;

        let baseDelay = isEarly ? 420 : 260;
        if (massResponseActive) {
            const delayMul = Math.max(0.45, Math.min(1, Number(massSpawnBoost?.supportDelayMul) || 1));
            baseDelay = Math.max(90, Math.floor(baseDelay * delayMul));
        }
        const delay = baseDelay + Math.floor(Math.random() * 180);
        setTimeout(() => {
            if (!game || !game.running || game.paused) return;
            const now = Number(game.frame) || 0;
            if (!this._canSpawnByWaveCap(1, now)) return;

            const supportInfo = this.analyze();
            let support = this.enableSafeAiV2
                ? this._selectSpawnByThreatScore(supportInfo, now)
                : this._getSequentialUnit(now);
            if (!this._canSpawnUnit(support)) {
                support = this._getSequentialUnit(now);
            }
            if (!this._canSpawnUnit(support)) return;
            this._spawnEnemyWithArmoredRatio(support, { ignoreArmoredRatio: false });
        }, delay);

        const bomberPressureStart = 60 * 420;
        const bomberPressureChance = 0.04;
        const bomberPressureSupply = 1200;
        if (!isEarly && this.difficulty === 'elite' && frame >= bomberPressureStart && Math.random() < bomberPressureChance && game.enemySupply > bomberPressureSupply) {
            if (this._canSpawnByWaveCap(1, frame) && this._canSpawnUnit('bomber')) {
                this._spawnEnemyWithArmoredRatio('bomber', { ignoreArmoredRatio: true });
            }
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
                const eliteMidPool = ['infantry', 'engineer', 'mbt', 'mbt', 'spg', 'aa_tank'];
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
            const pool = ['mbt', 'apache', 'drone_operator', 'infantry', 'fighter'];
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
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    if (!game || !game.running || game.paused) return;
                    game.spawnEnemy('drone_operator');
                }, i * 500);
            }
        } else {
            game.spawnEnemy('bomber');
        }
    },
    });
})(window);
