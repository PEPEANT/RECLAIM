(function (global) {
    'use strict';

    const AI = global.AI || (global.AI = {});

    Object.assign(AI, {
        difficulty: 'elite', // recruit, veteran, elite
        lastSpawn: 0,
        nextSpawnAt: 0,
        seqKey: '',
        seqIndex: 0,
        counterIndex: 0,
        armoredWaveTankCount: 0,
        spawnJitter: 18, // frames
        checkInterval: 60, // analysis tick (frames)
        settings: {},
        enableSafeAiV2: true,
        spawnControl: {
            recentWindow: 6,
            familyCooldownFrames: {}
        },
        recentSpawnIds: [],
        spawnFamilyCooldownUntil: {},
        globalAliveCaps: {},
        wave: {
            phase: 'HOLD',          // 'HOLD' | 'ENGAGE' | 'FALLBACK' | 'ASSAULT'
            wpIndex: 0,
            holdUntil: 0,
            retreatUntil: 0,
            lastCommandFrame: 0,
            lastThreatCheck: 0,
            phaseLockUntil: 0,
            stabilizeMeter: 0,
            advanceMeter: 0,
            fallbackMeter: 0,
            lastThreat: null
        },
        _totalWarIssued: false,
        special: null,
        massSpawnResponse: null,

    setDifficulty(diff) {
        try {
            this.difficulty = diff || 'elite';
            const s = this.settings[this.difficulty];
            if (!s) {
                console.warn(`[AI] Unknown difficulty '${diff}', falling back to 'elite'`);
                this.difficulty = 'elite';
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
            this.recentSpawnIds = [];
            this.spawnFamilyCooldownUntil = {};
            this.massSpawnResponse = null;

            // [NEW] 난이도 변경 시 즉시 저장
            if (typeof app !== 'undefined' && app.markDirty) {
                app.markDirty();
                app.saveNow();
            }
        } catch (e) {
            console.error('[AI] setDifficulty failed:', e);
            this.difficulty = 'elite';
            this._initSpecialState();
        }
    },

    _ensureMassSpawnResponseState(frame = 0) {
        const now = Math.max(0, Number(frame) || 0);
        const currentCount = Array.isArray(game?.players) ? game.players.length : 0;
        if (!this.massSpawnResponse || typeof this.massSpawnResponse !== 'object') {
            this.massSpawnResponse = {
                activeUntil: 0,
                lastTriggerFrame: -999999,
                lastSampleFrame: now,
                lastPlayerCount: currentCount,
                boostLevel: 0,
                samples: [{ frame: now, count: currentCount }]
            };
            return this.massSpawnResponse;
        }
        const state = this.massSpawnResponse;
        if (!Array.isArray(state.samples)) state.samples = [];
        if (!Number.isFinite(Number(state.activeUntil))) state.activeUntil = 0;
        if (!Number.isFinite(Number(state.lastTriggerFrame))) state.lastTriggerFrame = -999999;
        if (!Number.isFinite(Number(state.lastSampleFrame))) state.lastSampleFrame = now;
        if (!Number.isFinite(Number(state.lastPlayerCount))) state.lastPlayerCount = currentCount;
        if (!Number.isFinite(Number(state.boostLevel))) state.boostLevel = 0;
        if (state.samples.length <= 0) {
            state.samples.push({ frame: now, count: currentCount });
        }
        return state;
    },

    _getMassSpawnCountAgo(state, targetFrame) {
        if (!state || !Array.isArray(state.samples) || state.samples.length <= 0) return 0;
        for (let i = state.samples.length - 1; i >= 0; i--) {
            const row = state.samples[i];
            if (!row) continue;
            const f = Number(row.frame);
            if (!Number.isFinite(f)) continue;
            if (f <= targetFrame) return Math.max(0, Math.floor(Number(row.count) || 0));
        }
        return Math.max(0, Math.floor(Number(state.samples[0].count) || 0));
    },

    _getMassSpawnResponseBoost(frame = 0) {
        const state = this._ensureMassSpawnResponseState(frame);
        const now = Math.max(0, Number(frame) || 0);
        const activeUntil = Math.max(0, Number(state.activeUntil) || 0);
        const active = now <= activeUntil;
        const level = active
            ? Math.max(0, Math.min(1, Number(state.boostLevel) || 0))
            : 0;

        return {
            active,
            level,
            spawnRateMul: active ? (1 - (0.18 + (0.16 * level))) : 1,
            supportChanceBonus: active ? (0.14 + (0.16 * level)) : 0,
            supportDelayMul: active ? (0.76 - (0.18 * level)) : 1
        };
    },

    _isMassSpawnResponseActive(frame = 0) {
        const boost = this._getMassSpawnResponseBoost(frame);
        return !!(boost && boost.active);
    },

    _updateMassSpawnResponse(frame = 0) {
        const state = this._ensureMassSpawnResponseState(frame);
        const now = Math.max(0, Number(frame) || 0);
        const currentCount = Array.isArray(game?.players) ? game.players.length : 0;

        const sampleEvery = 15; // 0.25s at 60fps
        if (state.samples.length <= 0 || now >= (Number(state.lastSampleFrame) || 0) + sampleEvery) {
            state.samples.push({ frame: now, count: currentCount });
            state.lastSampleFrame = now;
        }

        const keepFrames = 60 * 12; // keep ~12s history
        const minFrame = now - keepFrames;
        while (state.samples.length > 1 && Number(state.samples[0]?.frame) < minFrame) {
            state.samples.shift();
        }

        const shortAgoCount = this._getMassSpawnCountAgo(state, now - (60 * 3));
        const longAgoCount = this._getMassSpawnCountAgo(state, now - (60 * 6));
        const shortDelta = Math.max(0, currentCount - shortAgoCount);
        const longDelta = Math.max(0, currentCount - longAgoCount);
        const burstDelta = Math.max(shortDelta, longDelta);

        const cooldownFrames = 60 * 6;
        const canTrigger = now >= ((Number(state.lastTriggerFrame) || -999999) + cooldownFrames);
        const detectedMassSpawn = (shortDelta >= 4) || (longDelta >= 6);
        if (canTrigger && detectedMassSpawn) {
            const duration = 60 * (10 + Math.floor(Math.random() * 11)); // 10~20 sec
            state.activeUntil = Math.max(Number(state.activeUntil) || 0, now + duration);
            state.lastTriggerFrame = now;
            state.boostLevel = Math.max(0.25, Math.min(1, (burstDelta - 3) / 6));
        }

        state.lastPlayerCount = currentCount;
        return this._getMassSpawnResponseBoost(now);
    },

    update(frame) {
        if (!game || !game.running) return;

        // safety: 게임 시작 후 setDifficulty를 안 탔다면
        if (!this.special) this._initSpecialState();
        if (!Array.isArray(this.recentSpawnIds)) this.recentSpawnIds = [];
        if (!this.spawnFamilyCooldownUntil || typeof this.spawnFamilyCooldownUntil !== 'object') {
            this.spawnFamilyCooldownUntil = {};
        }

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

        const massSpawnBoost = this._updateMassSpawnResponse(frame);
        if (massSpawnBoost && massSpawnBoost.active) {
            currentRate = Math.max(24, currentRate * Math.max(0.45, Number(massSpawnBoost.spawnRateMul) || 1));
            const soonerSpawnAt = frame + currentRate;
            if (Number.isFinite(this.nextSpawnAt) && this.nextSpawnAt > soonerSpawnAt) {
                this.nextSpawnAt = soonerSpawnAt;
            }
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
            const aliveTac = (game.projectiles || []).some(p =>
                p && !p.dead && (p._tactical || p.type === 'icbm_tactical_missile')
            );
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
    });
})(window);
