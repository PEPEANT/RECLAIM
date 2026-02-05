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

    async playBGM() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.playMP3(this.currentBgmIndex);
    },

    playMP3(index) {
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

    playSFX(type) {
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
            this._playOneShot('bgm/gun3.mp3', vol * 0.6, 8);
        }
        else if (type === 'rocket_launcher') {
            this._playOneShot('bgm/rocket-launcher-301426.mp3', vol * 0.7, 4);
        }
        else if (type === 'engineer_explosion') {
            this._playOneShot('bgm/bad-explosion-6855.mp3', vol * 0.8, 6);
        }
        else if (type === 'tank_shell') {
            this._playOneShot('bgm/boom/boom-5.mp3', vol * 0.8, 6);
        }
        else if (type === 'apache_missile') {
            this._playOneShot('bgm/boom/boom-4.mp3', vol * 0.7, 6);
        }
        else if (type === 'helicopter_select') {
            this._playOneShot('bgm/helicopt.mp3', vol * 0.7, 4);
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
    panicMuted: false,
    _playOneShot(file, volume, maxPool = 6) {
        try {
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

            a.volume = volume;
            try { a.currentTime = 0; } catch (e) { }
            const p = a.play();
            if (p && p.catch) p.catch(() => { });
        } catch (e) { }
    },

    playBoom(type) {
        if (this.volume.sfx <= 0) return;

        // [NOTE] boom-4 제거 (소형 폭발 겹침 방지)
        if (type === 'drone' || type === 'small') return;

        let file = 'bgm/boom/boom-2.mp3'; // default: 중간 폭발
        if (type === 'death_exp') file = 'bgm/boom/death-exp.mp3';
        else if (type === 'death_exp2') file = 'bgm/boom/death-exp2.mp3';
        else if (type === 'death_exp3') file = 'bgm/boom/death-exp3.mp3';
        else if (type === 'nuke') file = 'bgm/boom/nuclear explosion .mp3';
        else if (type === 'tactical_drone' || type === 'other') file = 'bgm/boom/boom-2.mp3';
        else if (type === 'artillery' || type === 'bomb' || type === 'stealth' || type === 'tactical' || type === 'spg' || type === 'bomber') file = 'bgm/boom/boom-3.mp3';

        // [FIX] 오디오 풀 사용으로 사운드 끊김 방지
        this._playOneShot(file, this.volume.sfx * this.volume.master, 8);
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
    playTacticalMissileSound() {
        if (this.volume.sfx <= 0) return null;

        try {
            const a = new Audio('bgm/rocketmp3-94928.mp3');
            a.volume = this.volume.sfx * this.volume.master * 0.7;
            a.play().catch(() => {});
            return a; // 호출자가 중지할 수 있도록 반환
        } catch(e) { return null; }
    },

    // [NEW] Gun Sound Effects (총소리)
    // gun: 보병
    // gun2: 특수부대
    // machine_gun: 험비, 장갑차
    // flak: 대공포, 감시탑, 총사령부
    playGun(type) {
        if (this.volume.sfx <= 0) return;

        let file = 'bgm/gun.mp3'; // default: 보병
        if (type === 'special') file = 'bgm/gun2.mp3';
        else if (type === 'machine_gun') file = 'bgm/machine_gun.mp3';
        else if (type === 'self') file = 'bgm/self.mp3';
        else if (type === 'flak') file = 'bgm/flak.mp3';

        // [FIX] 오디오 풀 사용 (총소리는 좀 더 작게)
        this._playOneShot(file, this.volume.sfx * this.volume.master * 0.5, 10);
    },

    playPanicScream() {
        if (this.volume.sfx <= 0) return;
        if (this.panicMuted) return;
        const now = this.ctx ? this.ctx.currentTime : (Date.now() / 1000);
        const key = 'panic_scream';
        if (this.lastSFXTime[key] && now - this.lastSFXTime[key] < 0.6) return;
        this.lastSFXTime[key] = now;
        this._playOneShot('bgm/crowd-panic-scream-1-390796.mp3', this.volume.sfx * this.volume.master * 0.9, 4);
    },

    stopPanicScream() {
        this.panicMuted = true;
        const key = 'bgm/crowd-panic-scream-1-390796.mp3';
        const pool = this._audioPool[key];
        if (Array.isArray(pool)) {
            pool.forEach(a => {
                if (!a) return;
                try { a.pause(); } catch (e) { }
                try { a.currentTime = 0; } catch (e) { }
            });
        }
    }
};

