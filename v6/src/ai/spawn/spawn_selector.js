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
        if (['engineer', 'drone_operator', 'sniper', 'special_ops', 'special_forces'].includes(id)) return 'support';
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
        return {
            antiAir: air * 3 + (air >= 3 ? 2 : 0),
            antiArmor: tank * 3 + (tank >= 3 ? 2 : 0),
            antiInfantry: Math.max(0, infantry - 4) * 1.8,
            siege: (hasBunker ? 4 : 0) + (total >= 14 ? 2 : 0),
            pressure: Math.max(0, total - this._getAliveEnemyUnitCount())
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

    _getOccupationSpawnProfile(frame) {
        const stageId = this._getOccupationStageId();
        if (!stageId) return null;

        const all = (this.occupationSpawnProfiles && typeof this.occupationSpawnProfiles === 'object')
            ? this.occupationSpawnProfiles
            : {};
        const profile = all[stageId] || all.default || null;
        if (!profile) return null;

        const f = Math.max(0, Number(frame) || 0);
        const phase = (f < 60 * 90) ? 'early' : (f < 60 * 210 ? 'mid' : 'late');
        const list = profile[phase] || profile.late || [];
        return Array.isArray(list) ? list : null;
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
        const base = this._getOccupationSpawnProfile(frame) || this._getDefaultSpawnProfile(frame);
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
        return { key: '07:00+', sequence: ['bomber', 'fighter', 'apache', 'apc', 'mbt', 'spg', 'icbm_enemy', 'infantry', 'engineer', 'humvee', 'special_forces', 'rpg', 'drone_operator', 'aa_tank'] };
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
        const isOccupationFinalStage = (typeof this._getOccupationStageId === 'function')
            && this._getOccupationStageId() === 7;
        const occupationStageId = (typeof this._getOccupationStageId === 'function')
            ? this._getOccupationStageId()
            : 0;
        const isOccupationEarlyStage = occupationStageId > 0 && occupationStageId <= 2;
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
            if (!isEmergency && isOccupationEarlyStage) {
                earlyLimit = Math.max(4, aliveCap - 4);
            }
            if (enemyUnitCount >= earlyLimit) return;
        }

        const spawned = this._spawnEnemyWithArmoredRatio(choice, { ignoreArmoredRatio: useAntiAirResponse });
        if (!spawned) return;

        // 분산 보강 스폰: 한 프레임 폭주 대신 짧은 텀을 둔다.
        const supportNeed = (info.total > enemyUnitCount + 4) || (this.difficulty === 'elite' && game.enemySupply > 900);
        if (!supportNeed) return;

        let extraChance = (this.difficulty === 'elite') ? 0.32 : (this.difficulty === 'veteran' ? 0.2 : 0.1);
        if (isOccupationFinalStage) {
            extraChance = Math.min(0.68, extraChance + 0.16);
        } else if (isOccupationEarlyStage) {
            extraChance *= 0.55;
        }
        if (Math.random() > extraChance) return;

        const baseDelay = isEarly ? 420 : 260;
        const tunedBaseDelay = isOccupationFinalStage
            ? Math.max(140, Math.floor(baseDelay * 0.72))
            : baseDelay;
        const delay = tunedBaseDelay + Math.floor(Math.random() * 180);
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

        const bomberPressureStart = isOccupationFinalStage ? (60 * 300) : (60 * 420);
        const bomberPressureChance = isOccupationFinalStage ? 0.08 : 0.04;
        const bomberPressureSupply = isOccupationFinalStage ? 900 : 1200;
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
