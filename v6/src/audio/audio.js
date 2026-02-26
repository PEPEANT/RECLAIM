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
    _pendingBgmPath: '',
    _gestureUnlockBound: false,

    _manifest() {
        try {
            if (typeof RECLAIM_AUDIO_MANIFEST !== 'undefined' && RECLAIM_AUDIO_MANIFEST) {
                return RECLAIM_AUDIO_MANIFEST;
            }
        } catch (_) { }
        try {
            if (typeof window !== 'undefined' && window && window.RECLAIM_AUDIO_MANIFEST) {
                return window.RECLAIM_AUDIO_MANIFEST;
            }
        } catch (_) { }
        return null;
    },

    _manifestGet(dotPath, fallbackPath = '') {
        const m = this._manifest();
        if (!m) return String(fallbackPath || '');
        const key = String(dotPath || '').trim();
        if (!key) return String(fallbackPath || '');
        const tokens = key.split('.');
        let cur = m;
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (!cur || typeof cur !== 'object' || !(t in cur)) {
                return String(fallbackPath || '');
            }
            cur = cur[t];
        }
        if (typeof cur === 'string' && cur.trim()) return cur.trim();
        return String(fallbackPath || '');
    },

    _manifestObj(dotPath) {
        const m = this._manifest();
        if (!m) return null;
        const key = String(dotPath || '').trim();
        if (!key) return null;
        const tokens = key.split('.');
        let cur = m;
        for (let i = 0; i < tokens.length; i += 1) {
            const t = tokens[i];
            if (!cur || typeof cur !== 'object' || !(t in cur)) return null;
            cur = cur[t];
        }
        return (cur && typeof cur === 'object') ? cur : null;
    },

    async playBGM() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.playMP3(this.currentBgmIndex);
    },

    _bindGestureUnlock() {
        if (this._gestureUnlockBound) return;
        this._gestureUnlockBound = true;
        const unlock = () => {
            try {
                if (!this.ctx) this.init();
                if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
                    this.ctx.resume().catch(() => { });
                }
            } catch (_) { }
            try {
                const pending = String(this._pendingBgmPath || '').trim();
                if (pending) {
                    this._pendingBgmPath = '';
                    this.playBGMFile(pending);
                }
            } catch (_) { }
        };
        try {
            window.addEventListener('pointerdown', unlock, { passive: true });
            window.addEventListener('touchstart', unlock, { passive: true });
            window.addEventListener('keydown', unlock, { passive: true });
        } catch (_) { }
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
        this._bindGestureUnlock();
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
            p.catch(e => {
                this._pendingBgmPath = nextPath;
                console.warn("Audio Play Error:", e);
            });
        }
    },

    playBGMFile(file) {
        this._bindGestureUnlock();
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
            p.catch(e => {
                this._pendingBgmPath = nextPath;
                console.warn("Audio Play Error:", e);
            });
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
        if (this.volume.sfx <= 0) return;
        this._bindGestureUnlock();
        if (!this.ctx) {
            try { this.init(); } catch (_) { }
        }
        if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
            try { this.ctx.resume().catch(() => { }); } catch (_) { }
        }
        if (!this.ctx) return;

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
            gain.gain.setValueAtTime(0.34 * vol, t);
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
            this._playOneShot(
                this._manifestGet('units.infantry.engineer_burst', 'bgm/units/infantry/engineer_burst.mp3'),
                vol * 0.8,
                8,
                worldX
            );
        }
        else if (type === 'rocket_launcher') {
            this._playOneShot(this._manifestGet('sfx.weapons.rocket_launcher', 'bgm/sfx/weapons/rocket_launcher.mp3'), vol * 0.7, 4, worldX);
        }
        else if (type === 'bullet_whizz') {
            const whizzFile = (Math.random() < 0.5)
                ? this._manifestGet('sfx.weapons.bullet_whizz', 'bgm/sfx/weapons/bullet_whizz.mp3')
                : this._manifestGet('sfx.weapons.bullet_whizz_alt', 'bgm/sfx/weapons/bullet_whizz_alt.mp3');
            this._playOneShot(whizzFile, vol * 0.44, 8, worldX);
        }
        else if (type === 'infantry_reload') {
            this._playOneShot(this._manifestGet('sfx.weapons.infantry_reload', 'bgm/sfx/weapons/infantry_reload.mp3'), vol * 0.62, 6, worldX);
        }
        else if (type === 'infantry_hit_voice') {
            const hitVoiceFile = (Math.random() < 0.5)
                ? this._manifestGet('sfx.ambient.infantry_hit_voice_1', 'bgm/sfx/ambient/infantry_hit_voice_1.mp3')
                : this._manifestGet('sfx.ambient.infantry_hit_voice_2', 'bgm/sfx/ambient/infantry_hit_voice_2.mp3');
            this._playOneShot(hitVoiceFile, vol * 0.52, 6, worldX);
        }
        else if (type === 'engineer_explosion') {
            this._playOneShot(this._manifestGet('sfx.boom.medium.death_exp', 'bgm/sfx/boom/medium/death_exp.mp3'), vol * 0.8, 6, worldX);
        }
        else if (type === 'tank_shell') {
            this._playOneShot(this._manifestGet('sfx.boom.heavy.boom_5', 'bgm/sfx/boom/heavy/boom_5.mp3'), vol * 1.42, 6, worldX);
        }
        else if (type === 'tank_fire') {
            this._playOneShot(this._manifestGet('units.armored.tank_fire', 'bgm/units/armored/tank_fire.mp3'), vol * 0.95, 5, worldX);
        }
        else if (type === 'apache_missile') {
            this._playOneShot(this._manifestGet('sfx.boom.small.apache_missile', 'bgm/sfx/boom/small/boom_4.mp3'), vol * 0.7, 6, worldX);
        }
        else if (type === 'drone_pre_attack_suicide') {
            this._playOneShot(this._manifestGet('units.drone.pre_attack_suicide', 'bgm/units/drone/pre_attack_suicide.mp3'), vol * 0.74, 4, worldX);
        }
        else if (type === 'drone_pre_attack_at') {
            this._playOneShot(this._manifestGet('units.drone.pre_attack', 'bgm/units/drone/pre_attack.mp3'), vol * 0.72, 4, worldX);
        }
        else if (type === 'drone_pre_attack') {
            this._playOneShot(this._manifestGet('units.drone.pre_attack', 'bgm/units/drone/pre_attack.mp3'), vol * 0.72, 4, worldX);
        }
        else if (type === 'infantry_step') {
            const aud = this.getWorldAudibility(worldX);
            if (aud <= 0.02) return;

            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const band = this.ctx.createBiquadFilter();
            band.type = 'bandpass';
            band.frequency.setValueAtTime(180 + Math.random() * 120, t);
            band.Q.setValueAtTime(0.9, t);

            const stepGain = this.ctx.createGain();
            const stepVol = Math.max(0.001, vol * aud * (0.12 + Math.random() * 0.08));
            stepGain.gain.setValueAtTime(stepVol, t);
            stepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
            src.connect(band);
            band.connect(stepGain);
            stepGain.connect(this.ctx.destination);
            src.start(t);
            src.stop(t + 0.09);

            const heel = this.ctx.createOscillator();
            const heelGain = this.ctx.createGain();
            heel.type = 'triangle';
            heel.frequency.setValueAtTime(96 + Math.random() * 18, t);
            heel.frequency.exponentialRampToValueAtTime(58, t + 0.055);
            heelGain.gain.setValueAtTime(stepVol * 0.52, t);
            heelGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            heel.connect(heelGain);
            heelGain.connect(this.ctx.destination);
            heel.start(t);
            heel.stop(t + 0.06);
        }
        else if (type === 'helicopter_select') {
            this._playOneShot(this._manifestGet('units.air.helicopter_select', 'bgm/units/air/helicopter_select.mp3'), vol * 0.7, 4, worldX);
        }
        else if (type === 'icbm_launch') {
            this._playOneShot(this._manifestGet('units.air.icbm_launch', 'bgm/units/air/icbm_launch.mp3'), vol * 0.95, 3, worldX);
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
    _battleMoveLastInfantryStepMs: 0,
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
        let infantryAud = 0;
        let infantryStepX = null;
        for (let i = 0; i < allUnits.length; i += 1) {
            const u = allUnits[i];
            if (!u || u.dead || !u.stats) continue;
            const id = String(u.stats.id || '').trim().toLowerCase();
            const category = String(u.stats.category || '').trim().toLowerCase();
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
                const cmd = String(u.commandMode || '').trim().toLowerCase();
                const vx = Math.abs(Number(u.vx) || 0);
                const directActive = !!(
                    g
                    && typeof g.isDirectControlActive === 'function'
                    && typeof g.getDirectControlUnit === 'function'
                    && g.isDirectControlActive()
                    && g.getDirectControlUnit() === u
                );
                if (this._isUnitActivelyMoving(u)
                    || cmd === 'move'
                    || cmd === 'retreat'
                    || vx >= 0.02
                    || directActive) {
                    humveeAud = Math.max(humveeAud, audibility);
                }
                continue;
            }

            if (category === 'infantry') {
                const cmd = String(u.commandMode || '').trim().toLowerCase();
                const vx = Math.abs(Number(u.vx) || 0);
                if (this._isUnitActivelyMoving(u) || cmd === 'move' || cmd === 'retreat' || vx >= 0.012) {
                    const aud = Math.min(1, audibility * 1.05);
                    if (aud > infantryAud) {
                        infantryAud = aud;
                        infantryStepX = worldX;
                    }
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
        if (humveeAud > 0.02) this._battleMoveHumveeHoldUntilMs = nowMs + 460;

        const heliHeld = nowMs < (Number(this._battleMoveHeliHoldUntilMs) || 0);
        const tankHeld = nowMs < (Number(this._battleMoveTankHoldUntilMs) || 0);
        const humveeHeld = nowMs < (Number(this._battleMoveHumveeHoldUntilMs) || 0);

        const heliEffectiveAud = Math.max(heliAud, heliHeld ? 0.20 : 0);
        const tankEffectiveAud = Math.max(tankAud, tankHeld ? 0.22 : 0);
        const humveeEffectiveAud = Math.max(humveeAud, humveeHeld ? 0.14 : 0);
        if (infantryAud > 0.1) {
            const lastStep = Number(this._battleMoveLastInfantryStepMs) || 0;
            const stepGap = (infantryAud > 0.58) ? 620 : 860;
            if ((nowMs - lastStep) >= stepGap && Math.random() < 0.72) {
                this._battleMoveLastInfantryStepMs = nowMs;
                this.playSFX('infantry_step', infantryStepX);
            }
        }

        const mix = this.volume.sfx * this.volume.master;
        this._updateBattleMoveLoop(
            'helicopter',
            this._manifestGet('sfx.movement.helicopter', 'bgm/sfx/movement/helicopter_moving.mp3'),
            heliEffectiveAud > 0.02,
            mix * 0.42 * heliEffectiveAud
        );
        this._updateBattleMoveLoop(
            'tank',
            this._manifestGet('sfx.movement.tank', 'bgm/sfx/movement/tank_moving.mp3'),
            tankEffectiveAud > 0.02,
            mix * 0.32 * tankEffectiveAud
        );
        this._updateBattleMoveLoop(
            'humvee',
            this._manifestGet('sfx.movement.humvee', 'bgm/sfx/movement/humvee_moving.mp3'),
            humveeEffectiveAud > 0.02,
            mix * 0.24 * humveeEffectiveAud
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
                this._playOneShot(
                    this._manifestGet('sfx.ambient.distant_armor', 'bgm/sfx/ambient/distant_armor.mp3'),
                    mix * 0.34,
                    1,
                    bestDistantX
                );
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
                const a = new Audio(this._manifestGet('units.air.icbm_launch', 'bgm/units/air/icbm_launch.mp3'));
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

        let file = this._manifestGet('sfx.boom.medium.default', 'bgm/sfx/boom/medium/death_exp.mp3');
        if (type === 'death_exp') file = this._manifestGet('sfx.boom.medium.death_exp', 'bgm/sfx/boom/medium/death_exp.mp3');
        else if (type === 'death_exp2') file = this._manifestGet('sfx.boom.medium.death_exp2', 'bgm/sfx/boom/medium/death_exp2.mp3');
        else if (type === 'death_exp3') file = this._manifestGet('sfx.boom.heavy.death_exp3', 'bgm/sfx/boom/heavy/death_exp3.mp3');
        else if (type === 'nuke') file = this._manifestGet('sfx.boom.special.nuke', 'bgm/sfx/boom/special/nuke.mp3');
        else if (type === 'emp') file = this._manifestGet('sfx.boom.special.emp', 'bgm/sfx/boom/special/emp.mp3');
        else if (type === 'tactical_drone' || type === 'other') file = this._manifestGet('sfx.boom.small.default', 'bgm/sfx/boom/small/boom_2.mp3');
        else if (type === 'artillery' || type === 'bomb' || type === 'stealth' || type === 'tactical' || type === 'spg' || type === 'bomber') {
            file = this._manifestGet('sfx.boom.heavy.boom_3', 'bgm/sfx/boom/heavy/boom_3.mp3');
        }

        // [FIX] 오디오 풀 사용으로 사운드 끊김 방지
        this._playOneShot(file, this.volume.sfx * this.volume.master, 8, worldX);
    },

    // [NEW] Nuke Warning Sound (발사 전 경고음)
    playNukeWarning() {
        if (this.volume.sfx <= 0) return;

        // [FIX] 경고음 중복 재생 방지 (한 번에 하나만)
        try {
            if (!this._nukeWarningAudio) {
                const a = new Audio(this._manifestGet('sfx.alerts.nuke_warning', 'bgm/sfx/alerts/nuke_warning.mp3'));
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
        const file = this._manifestGet('units.air.air_raid_warning', 'bgm/units/air/air_raid_warning.mp3');

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
            const a = new Audio(this._manifestGet('sfx.weapons.rocket_flyby', 'bgm/sfx/weapons/rocket_flyby.mp3'));
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
    playGun(type, worldX = null, options = null) {
        if (this.volume.sfx <= 0) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const unitId = String(opts.unitId || '').trim().toLowerCase();
        const kind = String(type || '').trim().toLowerCase();
        const byUnit = this._manifestObj(`gun_profiles.by_unit_id.${unitId}`);
        const byType = this._manifestObj(`gun_profiles.by_type.${kind}`);
        const prof = byUnit || byType || {
            sound: 'units.infantry.infantry_single',
            gain: 0.84,
            pool: 10
        };

        let manifestSoundPath = String(prof.sound || 'units.infantry.infantry_single').trim();
        const sourceUnit = (opts.sourceUnit && typeof opts.sourceUnit === 'object') ? opts.sourceUnit : null;
        if (sourceUnit) {
            const infantryUnitIds = {
                infantry: true,
                special_ops: true,
                sniper: true,
                engineer: true,
                rpg: true,
                worker: true,
                bagpiper: true,
                drone_operator: true
            };
            if (infantryUnitIds[unitId] === true) {
                const variants = [
                    'units.infantry.infantry_single',
                    'units.infantry.special_ops_burst',
                    'units.infantry.m4_burst'
                ];
                if (!sourceUnit._infantryGunSfxVariant || variants.indexOf(String(sourceUnit._infantryGunSfxVariant)) < 0) {
                    sourceUnit._infantryGunSfxVariant = variants[Math.floor(Math.random() * variants.length)];
                }
                manifestSoundPath = String(sourceUnit._infantryGunSfxVariant);
            }
            if (unitId === 'flak_turret') {
                const burstRoll = Math.random();
                if (burstRoll < 0.38) {
                    manifestSoundPath = 'units.armored.bunker_50cal_burst';
                } else {
                    manifestSoundPath = 'units.armored.bunker_50cal_shot';
                }
            }
            if (unitId === 'watchtower' && sourceUnit._coastEmplacement === true) {
                const coastBurstRoll = Math.random();
                if (coastBurstRoll < 0.34) {
                    manifestSoundPath = 'units.armored.bunker_50cal_burst';
                } else {
                    manifestSoundPath = 'units.armored.bunker_50cal_shot';
                }
            }
        }
        const fallbackSoundPath = this._manifestGet('units.infantry.infantry_single', 'bgm/units/infantry/infantry_single.mp3');
        const file = this._manifestGet(manifestSoundPath, fallbackSoundPath);
        const gunGain = Math.max(0.1, Number(prof.gain) || 0.84);
        const poolSize = Math.max(1, Math.floor(Number(prof.pool) || 10));
        const gunVolume = this.volume.sfx * this.volume.master * gunGain;
        this._playOneShot(file, gunVolume, poolSize, worldX);

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
        const file = this._manifestGet('sfx.ambient.panic_scream', 'bgm/sfx/ambient/panic_scream.mp3');
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
        const key = this._manifestGet('sfx.ambient.panic_scream', 'bgm/sfx/ambient/panic_scream.mp3');
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

try {
    if (typeof AudioSystem !== 'undefined' && AudioSystem && typeof AudioSystem._bindGestureUnlock === 'function') {
        AudioSystem._bindGestureUnlock();
    }
} catch (_) { }

