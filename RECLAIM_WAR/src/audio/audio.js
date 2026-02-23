const AudioSystem = {
    ctx: null,
    bgmNodes: [],
    isPlayingBGM: false,
    volume: { master: 0.5, bgm: 0.4, sfx: 0.6 },
    nextNoteTime: 0,
    tempo: 100,
    timerID: null,
    scale: [55, 65.41, 73.42, 82.41, 98, 110, 130.81, 146.83],

    lastSFXTime: {}, // [New] Throttling

    init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            if (this.ctx && this.ctx.state !== 'closed') {
                this.updateVolumes();
                return;
            }
            this.ctx = new AudioContext();
            this.createNoiseBuffer();
            this.mainVolume = this.ctx.createGain();
            this.mainVolume.connect(this.ctx.destination);
            this.updateVolumes();
        } catch (e) { console.error("Web Audio API Error", e); }
    },

    createNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    },

    setVolume(type, val) {
        this.volume[type] = Math.max(0, Math.min(1, val));
        this.updateVolumes();
    },

    updateVolumes() {
        if (this.mainVolume) this.mainVolume.gain.value = this.volume.master;
    },

    // [New] MP3 BGM System
    bgmEl: null,
    currentBgmIndex: 0,
    bgmLockPath: '',

    async playBGM() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.playMP3(this.currentBgmIndex);
    },

    setBGMLock(path) {
        const next = String(path || '').trim();
        this.bgmLockPath = next;
        if (!next) return;
        if (!this.bgmEl || !this.bgmEl.dataset || this.bgmEl.dataset.src !== next || this.bgmEl.paused) {
            this.playBGMFile(next);
        }
    },

    playMP3(index) {
        const lockedPath = String(this.bgmLockPath || '').trim();
        if (lockedPath) {
            if (!this.bgmEl || !this.bgmEl.dataset || this.bgmEl.dataset.src !== lockedPath || this.bgmEl.paused) {
                this.playBGMFile(lockedPath);
            }
            return;
        }

        // Avoid rapid pause->play races (AbortError + sometimes silence)
        const nextPath = `bgm/bgm_${index}.mp3`;

        // Already playing same track -> just refresh volume
        if (this.bgmEl && this.bgmEl.dataset && this.bgmEl.dataset.src === nextPath && !this.bgmEl.paused) {
            this.currentBgmIndex = index;
            this.bgmEl.volume = this.volume.bgm * this.volume.master;
            return;
        }

        // Stop previous safely
        if (this.bgmEl) {
            try { this.bgmEl.pause(); } catch (e) { }
            try { this.bgmEl.currentTime = 0; } catch (e) { }
            this.bgmEl = null;
        }

        this.currentBgmIndex = index;

        const el = new Audio(nextPath);
        el.dataset.src = nextPath;
        el.loop = true;
        el.preload = 'auto';
        el.volume = this.volume.bgm * this.volume.master;

        // Store first, then play (prevents play() being interrupted by later pause())
        this.bgmEl = el;

        const p = el.play();
        if (p && typeof p.catch === 'function') {
            p.catch(e => console.warn("Audio Play Error:", e));
        }
    },

    playBGMFile(file) {
        if (!file) return;
        const nextPath = String(file);
        const lockedPath = String(this.bgmLockPath || '').trim();
        if (lockedPath && nextPath !== lockedPath) {
            if (!this.bgmEl || !this.bgmEl.dataset || this.bgmEl.dataset.src !== lockedPath || this.bgmEl.paused) {
                this.playBGMFile(lockedPath);
            }
            return;
        }

        if (this.bgmEl && this.bgmEl.dataset && this.bgmEl.dataset.src === nextPath && !this.bgmEl.paused) {
            this.bgmEl.volume = this.volume.bgm * this.volume.master;
            return;
        }

        if (this.bgmEl) {
            try { this.bgmEl.pause(); } catch (e) { }
            try { this.bgmEl.currentTime = 0; } catch (e) { }
            this.bgmEl = null;
        }

        const el = new Audio(nextPath);
        el.dataset.src = nextPath;
        el.loop = true;
        el.preload = 'auto';
        el.volume = this.volume.bgm * this.volume.master;
        this.bgmEl = el;

        const p = el.play();
        if (p && typeof p.catch === 'function') {
            p.catch(e => console.warn("Audio Play Error:", e));
        }
    },

    stopBGM() {
        if (this.bgmEl) {
            this.bgmEl.pause();
            this.bgmEl = null;
        }
    },

    setBGMVolume(val) {
        this.volume.bgm = Math.max(0, Math.min(1, val));
        if (this.bgmEl) this.bgmEl.volume = this.volume.bgm * this.volume.master;
    },

    playTone(time, vol, type, freq, dur) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const masterVol = this.volume.master;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol * this.volume.bgm * masterVol, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + dur);
    },

    playSFX(type, worldX = null) {
        if (!this.ctx || this.volume.sfx <= 0) return;

        // [FIX] Sound Spam Protection (Throttle 0.05s)
        const now = this.ctx.currentTime;
        if (this.lastSFXTime[type] && now - this.lastSFXTime[type] < 0.05) {
            return;
        }
        this.lastSFXTime[type] = now;

        const t = this.ctx.currentTime;
        const vol = this.volume.sfx * this.volume.master;

        if (type === 'explode') {
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, t);
            filter.frequency.exponentialRampToValueAtTime(10, t + 0.8);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol * 1.5, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

            const osc = this.ctx.createOscillator();
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.exponentialRampToValueAtTime(10, t + 0.5);
            const oscG = this.ctx.createGain();
            oscG.gain.setValueAtTime(vol, t);
            oscG.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
            osc.connect(oscG); oscG.connect(this.ctx.destination);

            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            src.start(t);
            src.stop(t + 0.8);
            osc.start(t); osc.stop(t + 0.5);
        }
        else if (type === 'shoot') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(Math.random() * 100 + 150, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
            gain.gain.setValueAtTime(0.15 * vol, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.connect(gain); gain.connect(this.ctx.destination); osc.start(t); osc.stop(t + 0.1);
        }
        else if (type === 'bomb_drop') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
            gain.gain.setValueAtTime(this.volume.sfx * this.volume.master, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.3);
        }
        else if (type === 'ui') {
            this.playTone(t, 0.1, 'sine', 1200, 0.1);
        }
        // [NEW] 공병 사운드
        else if (type === 'gun3') {
            this._playOneShot('bgm/gun3.mp3', vol * 0.6, 8, worldX);
        }
        else if (type === 'rocket_launcher') {
            this._playOneShot('bgm/rocket-launcher-301426.mp3', vol * 0.7, 4, worldX);
        }
        else if (type === 'engineer_explosion') {
            this._playOneShot('bgm/boom/death-exp.mp3', vol * 0.8, 6, worldX);
        }
        else if (type === 'tank_shell') {
            this._playOneShot('bgm/boom/boom-5.mp3', vol * 0.8, 6, worldX);
        }
        else if (type === 'apache_missile') {
            this._playOneShot('bgm/boom/boom-4.mp3', vol * 0.7, 6, worldX);
        }
        else if (type === 'helicopter_select') {
            this._playOneShot('bgm/helicopt.mp3', vol * 0.7, 4, worldX);
        }
        else if (type === 'icbm_launch') {
            this._playOneShot('bgm/ICBM.mp3', vol * 0.95, 3, worldX);
        }
    },

    // [NEW] Explosion MP3 Sound Effects
    // boom-1: 핵폭발 (가장 큰)
    // boom-2: 전술드론 및 기타 폭발
    // boom-3: 자주포, 폭격기, 스텔스드론, 전술미사일
    // boom-4: 일반 드론, 작은 폭발 (지상에서만)

    // [NEW] HTMLAudio one-shot pool (사운드 끊김 방지)
    _audioPool: {},
    _nukeWarningAudio: null,
    _airRaidAudio: null,
    _airRaidTimeout: null,
    _airRaidPlaying: false,
    _icbmRaiseAudio: null,
    _icbmRaiseActive: 0,
    _icbmRaiseWorldX: null,
    _icbmRaiseStopTimer: null,
    panicMuted: false,
    _battleMoveLoops: null,
    _battleMoveProbe: (typeof WeakMap !== 'undefined') ? new WeakMap() : null,
    _battleMoveLastDistantArmorMs: 0,
    _battleMoveHeliHoldUntilMs: 0,
    _battleMoveTankHoldUntilMs: 0,
    _battleMoveHumveeHoldUntilMs: 0,
    _battleMoveHeliIdMap: { apache: true, blackhawk: true, chinook: true, uh60: true },
    _battleMoveTankIdMap: { mbt: true, apc: true, aa_tank: true, spg: true },
    _battleMoveDistantArmorIdMap: { mbt: true, apc: true, aa_tank: true, spg: true },
    getWorldAudibility(worldX, pad = 220, fadeDistance = 280) {
        if (!Number.isFinite(worldX)) return 1;
        if (typeof game === 'undefined' || !game || !Number.isFinite(game.cameraX)) return 1;
        const viewW = (typeof Camera !== 'undefined' && Camera && typeof Camera.viewW === 'function')
            ? Camera.viewW(game)
            : game.width;
        if (!Number.isFinite(viewW) || viewW <= 0) return 1;

        const minX = (game.cameraX || 0) - pad;
        const maxX = (game.cameraX || 0) + viewW + pad;
        if (worldX >= minX && worldX <= maxX) return 1;

        const dist = (worldX < minX) ? (minX - worldX) : (worldX - maxX);
        if (dist >= fadeDistance) return 0;
        return Math.max(0, 1 - (dist / fadeDistance));
    },
    _playOneShot(file, volume, maxPool = 6, worldX = null) {
        try {
            const audibility = this.getWorldAudibility(worldX);
            if (audibility <= 0.02) return null;
            if (!this._audioPool[file]) this._audioPool[file] = [];
            const pool = this._audioPool[file];

            let a = pool.find(x => x.paused || x.ended);
            if (!a) {
                if (pool.length >= maxPool) a = pool[0];
                else {
                    a = new Audio(file);
                    a.preload = 'auto';
                    a.playsInline = true;
                    pool.push(a);
                }
            }

            a.volume = Math.max(0, Math.min(1, (Number(volume) || 0) * audibility));
            try { a.currentTime = 0; } catch (e) { }
            const p = a.play();
            if (p && p.catch) p.catch(() => { });
            return a;
        } catch (e) { }
        return null;
    },

    _ensureBattleMoveState() {
        if (!this._battleMoveLoops || typeof this._battleMoveLoops !== 'object') {
            this._battleMoveLoops = {
                helicopter: null,
                tank: null,
                humvee: null
            };
        }
        if (!this._battleMoveProbe || typeof this._battleMoveProbe.get !== 'function') {
            this._battleMoveProbe = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
        }
    },

    _clamp01(v) {
        return Math.max(0, Math.min(1, Number(v) || 0));
    },

    _getBattleViewRange(gameRef = null) {
        const g = gameRef || ((typeof game !== 'undefined') ? game : null);
        if (!g) return null;
        const viewW = (typeof Camera !== 'undefined' && Camera && typeof Camera.viewW === 'function')
            ? Number(Camera.viewW(g))
            : Number(g.width);
        if (!Number.isFinite(viewW) || viewW <= 0) return null;
        const minX = Number(g.cameraX) || 0;
        return { minX, maxX: minX + viewW };
    },

    _isWorldXVisible(worldX, margin = 0, gameRef = null) {
        const view = this._getBattleViewRange(gameRef);
        if (!view || !Number.isFinite(worldX)) return false;
        const m = Number.isFinite(margin) ? Math.max(0, Number(margin)) : 0;
        return worldX >= (view.minX - m) && worldX <= (view.maxX + m);
    },

    _trackUnitMoveDelta(unit) {
        if (!unit || !Number.isFinite(Number(unit.x))) return 0;
        const x = Number(unit.x);
        const probe = this._battleMoveProbe;
        if (probe && typeof probe.get === 'function' && typeof probe.set === 'function') {
            const hasPrev = typeof probe.has === 'function' ? probe.has(unit) : false;
            const prev = hasPrev ? Number(probe.get(unit)) : NaN;
            probe.set(unit, x);
            if (!Number.isFinite(prev)) return NaN;
            return Math.abs(x - prev);
        }
        const prev = Number(unit._audioPrevX);
        unit._audioPrevX = x;
        if (!Number.isFinite(prev)) return NaN;
        return Math.abs(x - prev);
    },

    _isUnitActivelyMoving(unit) {
        if (!unit || unit.dead) return false;
        const cmd = String(unit.commandMode || '').trim().toLowerCase();
        const delta = this._trackUnitMoveDelta(unit);
        const vx = Math.abs(Number(unit.vx) || 0);
        if (Number.isFinite(delta) && delta >= 0.14) return true;
        if (!Number.isFinite(delta)) return cmd === 'move' || cmd === 'retreat' || vx >= 0.05;
        if (cmd === 'move' || cmd === 'retreat') return delta >= 0.015 || vx >= 0.03;
        if (vx >= 0.09) return true;
        return false;
    },

    _updateBattleMoveLoop(slotKey, file, shouldPlay, volume) {
        this._ensureBattleMoveState();
        const loops = this._battleMoveLoops;
        if (!Object.prototype.hasOwnProperty.call(loops, slotKey)) return;
        let a = loops[slotKey];
        if (!a) {
            a = new Audio(file);
            a.preload = 'auto';
            a.playsInline = true;
            a.loop = true;
            loops[slotKey] = a;
        }
        const vol = this._clamp01(volume);
        if (!shouldPlay || vol <= 0.002) {
            try { a.pause(); } catch (e) { }
            try { a.currentTime = 0; } catch (e) { }
            return;
        }
        a.volume = vol;
        if (a.paused || a.ended) {
            if (a.ended) {
                try { a.currentTime = 0; } catch (e) { }
            }
            const p = a.play();
            if (p && p.catch) p.catch(() => { });
        }
    },

    _stopBattleMoveLoop(slotKey) {
        this._ensureBattleMoveState();
        const a = this._battleMoveLoops[slotKey];
        if (!a) return;
        try { a.pause(); } catch (e) { }
        try { a.currentTime = 0; } catch (e) { }
    },

    stopBattleMovementAmbience() {
        this._stopBattleMoveLoop('helicopter');
        this._stopBattleMoveLoop('tank');
        this._stopBattleMoveLoop('humvee');
    },

    updateBattleMovementAmbience(gameRef = null, opts = {}) {
        this._ensureBattleMoveState();
        const g = gameRef || ((typeof game !== 'undefined') ? game : null);
        const paused = !!opts.paused;
        if (!g || paused || g.running !== true || this.volume.sfx <= 0 || this.volume.master <= 0) {
            this.stopBattleMovementAmbience();
            return;
        }

        const HELI_IDS = this._battleMoveHeliIdMap || {};
        const TANK_IDS = this._battleMoveTankIdMap || {};
        const DISTANT_ARMOR_IDS = this._battleMoveDistantArmorIdMap || {};

        const allUnits = [];
        if (Array.isArray(g.players)) allUnits.push(...g.players);
        if (Array.isArray(g.enemies)) allUnits.push(...g.enemies);

        let heliAud = 0;
        let tankAud = 0;
        let humveeAud = 0;
        for (let i = 0; i < allUnits.length; i += 1) {
            const u = allUnits[i];
            if (!u || u.dead || !u.stats) continue;
            const id = String(u.stats.id || '').trim().toLowerCase();
            const worldX = Number(u.x);
            if (!Number.isFinite(worldX)) continue;
            const isVisible = this._isWorldXVisible(worldX, 24, g);
            if (!isVisible) continue;
            const audibility = this.getWorldAudibility(worldX);
            if (audibility <= 0.02) continue;

            if (HELI_IDS[id] === true) {
                heliAud = Math.max(heliAud, audibility);
                continue;
            }

            if (id === 'humvee') {
                if (this._isUnitActivelyMoving(u)) {
                    humveeAud = Math.max(humveeAud, audibility);
                }
                continue;
            }

            if (TANK_IDS[id] === true && this._isUnitActivelyMoving(u)) {
                tankAud = Math.max(tankAud, audibility);
            }
        }

        const nowMs = Date.now();
        if (heliAud > 0.02) this._battleMoveHeliHoldUntilMs = nowMs + 600;
        if (tankAud > 0.02) this._battleMoveTankHoldUntilMs = nowMs + 450;
        if (humveeAud > 0.02) this._battleMoveHumveeHoldUntilMs = nowMs + 400;

        const heliHeld = nowMs < (Number(this._battleMoveHeliHoldUntilMs) || 0);
        const tankHeld = nowMs < (Number(this._battleMoveTankHoldUntilMs) || 0);
        const humveeHeld = nowMs < (Number(this._battleMoveHumveeHoldUntilMs) || 0);

        const heliEffectiveAud = Math.max(heliAud, heliHeld ? 0.20 : 0);
        const tankEffectiveAud = Math.max(tankAud, tankHeld ? 0.22 : 0);
        const humveeEffectiveAud = Math.max(humveeAud, humveeHeld ? 0.20 : 0);

        const mix = this.volume.sfx * this.volume.master;
        this._updateBattleMoveLoop(
            'helicopter',
            'bgm/mov/helicopter-moving.mp3',
            heliEffectiveAud > 0.02,
            mix * 0.42 * heliEffectiveAud
        );
        this._updateBattleMoveLoop(
            'tank',
            'bgm/mov/tank_moving.mp3',
            tankEffectiveAud > 0.02,
            mix * 0.46 * tankEffectiveAud
        );
        this._updateBattleMoveLoop(
            'humvee',
            'bgm/mov/tank_moving2.mp3',
            humveeEffectiveAud > 0.02,
            mix * 0.34 * humveeEffectiveAud
        );

        // 화면 밖에서 들리는 적 기갑 포성(짧게 1회) 트리거.
        const frameNow = Math.max(0, Math.floor(Number(g.frame) || 0));
        let bestDistantAud = 0;
        let bestDistantX = null;
        const enemies = Array.isArray(g.enemies) ? g.enemies : [];
        for (let i = 0; i < enemies.length; i += 1) {
            const u = enemies[i];
            if (!u || u.dead || !u.stats) continue;
            const id = String(u.stats.id || '').trim().toLowerCase();
            if (DISTANT_ARMOR_IDS[id] !== true) continue;
            const worldX = Number(u.x);
            if (!Number.isFinite(worldX)) continue;
            if (this._isWorldXVisible(worldX, 12, g)) continue;
            const lastAttack = Math.max(0, Math.floor(Number(u.lastAttack) || 0));
            if ((frameNow - lastAttack) > 3) continue;
            const aud = this.getWorldAudibility(worldX);
            if (aud <= 0.02) continue;
            if (aud > bestDistantAud) {
                bestDistantAud = aud;
                bestDistantX = worldX;
            }
        }

        if (bestDistantAud > 0.02) {
            const nowMs = Date.now();
            if ((nowMs - (Number(this._battleMoveLastDistantArmorMs) || 0)) >= 950) {
                this._battleMoveLastDistantArmorMs = nowMs;
                this._playOneShot('bgm/mov/freesound_community.mp3', mix * 0.34, 1, bestDistantX);
            }
        }
    },

    startIcbmRaise(worldX = null) {
        if (this._icbmRaiseStopTimer) {
            clearTimeout(this._icbmRaiseStopTimer);
            this._icbmRaiseStopTimer = null;
        }
        this._icbmRaiseActive = Math.max(0, Number(this._icbmRaiseActive) || 0) + 1;
        if (Number.isFinite(worldX)) this._icbmRaiseWorldX = worldX;
        this.syncIcbmRaise(worldX);
    },

    syncIcbmRaise(worldX = null) {
        if (Number.isFinite(worldX)) this._icbmRaiseWorldX = worldX;
        if ((Number(this._icbmRaiseActive) || 0) <= 0) return;
        if (this.volume.sfx <= 0) return;

        try {
            const refX = Number.isFinite(this._icbmRaiseWorldX) ? this._icbmRaiseWorldX : worldX;
            const audibility = this.getWorldAudibility(refX);

            if (audibility <= 0.02) {
                if (this._icbmRaiseAudio && !this._icbmRaiseAudio.paused) {
                    try { this._icbmRaiseAudio.pause(); } catch (e) { }
                    try { this._icbmRaiseAudio.currentTime = 0; } catch (e) { }
                }
                return;
            }

            if (!this._icbmRaiseAudio) {
                const a = new Audio('bgm/ICBM.mp3');
                a.preload = 'auto';
                a.playsInline = true;
                a.loop = true;
                this._icbmRaiseAudio = a;
            }

            const a = this._icbmRaiseAudio;
            a.volume = Math.max(0, Math.min(1, this.volume.sfx * this.volume.master * 0.9 * audibility));
            if (a.paused || a.ended) {
                try { a.currentTime = 0; } catch (e) { }
                const p = a.play();
                if (p && p.catch) p.catch(() => { });
            }
        } catch (e) { }
    },

    stopIcbmRaise(force = false) {
        if (force) this._icbmRaiseActive = 0;
        else this._icbmRaiseActive = Math.max(0, (Number(this._icbmRaiseActive) || 0) - 1);
        if (this._icbmRaiseActive > 0) return;

        if (this._icbmRaiseStopTimer) {
            clearTimeout(this._icbmRaiseStopTimer);
            this._icbmRaiseStopTimer = null;
        }

        const stopDelayMs = force ? 0 : 650;
        this._icbmRaiseStopTimer = setTimeout(() => {
            this._icbmRaiseStopTimer = null;
            if ((Number(this._icbmRaiseActive) || 0) > 0) return;
            const a = this._icbmRaiseAudio;
            if (!a) return;
            try { a.pause(); } catch (e) { }
            try { a.currentTime = 0; } catch (e) { }
        }, stopDelayMs);
    },

    playBoom(type, worldX = null) {
        if (this.volume.sfx <= 0) return;

        // [NOTE] boom-4 제거 (소형 폭발 겹침 방지)
        if (type === 'drone' || type === 'small') return;

        let file = 'bgm/boom/boom-2.mp3'; // default: 중간 폭발
        if (type === 'death_exp') file = 'bgm/boom/death-exp.mp3';
        else if (type === 'death_exp2') file = 'bgm/boom/death-exp2.mp3';
        else if (type === 'death_exp3') file = 'bgm/boom/death-exp3.mp3';
        else if (type === 'nuke') file = 'bgm/boom/nuclear explosion .mp3';
        else if (type === 'emp') file = 'bgm/boom/emp.mp3';
        else if (type === 'tactical_drone' || type === 'other') file = 'bgm/boom/boom-2.mp3';
        else if (type === 'artillery' || type === 'bomb' || type === 'stealth' || type === 'tactical' || type === 'spg' || type === 'bomber') file = 'bgm/boom/boom-3.mp3';

        // [FIX] 오디오 풀 사용으로 사운드 끊김 방지
        this._playOneShot(file, this.volume.sfx * this.volume.master, 8, worldX);
    },

    // [NEW] Nuke Warning Sound (발사 전 경고음)
    playNukeWarning() {
        if (this.volume.sfx <= 0) return;

        // [FIX] 경고음 중복 재생 방지 (한 번에 하나만)
        try {
            if (!this._nukeWarningAudio) {
                const a = new Audio('bgm/sound_effect.mp3');
                a.preload = 'auto';
                a.playsInline = true;
                this._nukeWarningAudio = a;
            }
            const a = this._nukeWarningAudio;
            if (!a.paused && !a.ended) return; // 아직 재생 중이면 스킵
            a.volume = this.volume.sfx * this.volume.master;
            try { a.currentTime = 0; } catch (e) { }
            const p = a.play();
            if (p && p.catch) p.catch(() => { });
            if (typeof game !== 'undefined' && game.triggerCivilianPanic) {
                game.triggerCivilianPanic(300);
            }
        } catch (e) { }
    },

    playAirRaidAlarm(durationMs = 14000) {
        if (this.volume.sfx <= 0) return;
        if (this._airRaidPlaying) return;
        this._airRaidPlaying = true;
        const file = 'bgm/teho-ulvo-d1200-air-raid-277880.mp3';

        try {
            const a = new Audio(file);
            a.preload = 'auto';
            a.playsInline = true;
            a.volume = this.volume.sfx * this.volume.master;
            this._airRaidAudio = a;
            const p = a.play();
            if (p && p.catch) p.catch(() => { });
        } catch (e) { }

        if (this._airRaidTimeout) {
            clearTimeout(this._airRaidTimeout);
        }
        this._airRaidTimeout = setTimeout(() => {
            if (this._airRaidAudio) {
                try { this._airRaidAudio.pause(); } catch (e) { }
                try { this._airRaidAudio.currentTime = 0; } catch (e) { }
            }
            this._airRaidPlaying = false;
            if (typeof game !== 'undefined' && game.onAirRaidEnded) {
                game.onAirRaidEnded();
            }
        }, Math.max(0, Number(durationMs) || 0));
    },

    // [NEW] 전술미사일 발사 사운드 (9초, 터지면 중지됨)
    playTacticalMissileSound(worldX = null) {
        if (this.volume.sfx <= 0) return null;

        try {
            const audibility = this.getWorldAudibility(worldX);
            if (audibility <= 0.02) return null;
            const a = new Audio('bgm/rocketmp3-94928.mp3');
            a.volume = this.volume.sfx * this.volume.master * 0.7 * audibility;
            a.play().catch(() => {});
            return a; // 호출자가 중지할 수 있도록 반환
        } catch(e) { return null; }
    },

    // [NEW] Gun Sound Effects (총소리)
    // gun: 보병
    // gun2: 특수부대
    // sniper: 저격수
    // special_ops: 특수부대(K1)
    // machine_gun: 험비, 장갑차
    // flak: 대공포, 감시탑, 총사령부
    playGun(type, worldX = null) {
        if (this.volume.sfx <= 0) return;

        let file = 'bgm/gun.mp3'; // default: 보병
        if (type === 'special') file = 'bgm/gun2.mp3';
        else if (type === 'sniper') file = 'bgm/search.mp3';
        else if (type === 'special_ops') file = 'bgm/K1.mp3';
        else if (type === 'machine_gun') file = 'bgm/machine_gun.mp3';
        else if (type === 'self') file = 'bgm/self.mp3';
        else if (type === 'flak') file = 'bgm/flak.mp3';
        else if (type === 'rifle_d') file = 'bgm/gun4.mp3';

        const gunVolume = this.volume.sfx * this.volume.master * 0.5;
        if (type === 'special_ops') {
            const pool = this._audioPool[file];
            const playing = Array.isArray(pool)
                ? pool.some((a) => a && !a.paused && !a.ended)
                : false;
            if (!playing) {
                // K1 is monophonic: prevent overlapping layers from multiple simultaneous shooters.
                this._playOneShot(file, gunVolume, 1, worldX);
            }
        } else {
            // [FIX] 오디오 풀 사용 (총소리는 좀 더 작게)
            this._playOneShot(file, gunVolume, 10, worldX);
        }

        // Optional hook for game modes that need to react to first gunshot.
        try {
            if (typeof this.onGunShot === 'function') {
                this.onGunShot({ type, worldX, file });
            }
        } catch (_) { }
    },

    playPanicScream(worldX = null) {
        if (this.volume.sfx <= 0) return;
        if (this.panicMuted) return;
        const now = this.ctx ? this.ctx.currentTime : (Date.now() / 1000);
        const key = 'panic_scream';
        if (this.lastSFXTime[key] && now - this.lastSFXTime[key] < 0.6) return;
        this.lastSFXTime[key] = now;
        const file = 'bgm/crowd-panic-scream-1-390796.mp3';
        const a = this._playOneShot(file, this.volume.sfx * this.volume.master * 0.9, 4, worldX);
        if (!a) return;
        try {
            if (a._panicCutTimer) {
                clearTimeout(a._panicCutTimer);
                a._panicCutTimer = null;
            }
            a._panicCutTimer = setTimeout(() => {
                try { a.pause(); } catch (e) { }
                try { a.currentTime = 0; } catch (e) { }
                a._panicCutTimer = null;
            }, 5000);
        } catch (e) { }
    },

    stopPanicScream() {
        this.panicMuted = true;
        const key = 'bgm/crowd-panic-scream-1-390796.mp3';
        const pool = this._audioPool[key];
        if (Array.isArray(pool)) {
            pool.forEach(a => {
                if (!a) return;
                if (a._panicCutTimer) {
                    clearTimeout(a._panicCutTimer);
                    a._panicCutTimer = null;
                }
                try { a.pause(); } catch (e) { }
                try { a.currentTime = 0; } catch (e) { }
            });
        }
    }
};

