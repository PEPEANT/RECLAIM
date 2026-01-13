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
            try { this.bgmEl.pause(); } catch (e) {}
            try { this.bgmEl.currentTime = 0; } catch (e) {}
            this.bgmEl = null;
        }

        this.currentBgmIndex = index;
        console.log("Playing BGM:", nextPath);

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
        else if (type === 'machinegun') {
            // 미니건/기관총 발사음
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(Math.random() * 140 + 220, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
            gain.gain.setValueAtTime(0.12 * vol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.06);
        }
        else if (type === 'tank_fire') {
            // 탱크/자주포 포탄 발사음 (저음 펑 + 노이즈)
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, t);
            filter.frequency.exponentialRampToValueAtTime(40, t + 0.25);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol * 1.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(90, t);
            osc.frequency.exponentialRampToValueAtTime(30, t + 0.18);

            const og = this.ctx.createGain();
            og.gain.setValueAtTime(vol * 0.7, t);
            og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

            src.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            osc.connect(og); og.connect(this.ctx.destination);

            src.start(t); src.stop(t + 0.25);
            osc.start(t); osc.stop(t + 0.18);
        }
        else if (type === 'rocket' || type === 'rpg') {
            // 로켓/RPG/공격헬기 로켓 발사음
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(type === 'rocket' ? 180 : 220, t);
            osc.frequency.exponentialRampToValueAtTime(type === 'rocket' ? 520 : 460, t + 0.12);
            gain.gain.setValueAtTime(vol * (type === 'rocket' ? 0.35 : 0.28), t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.12);
        }
        else if (type === 'sniper') {
            // 저격수 발사음 (짧고 날카로운 한 발)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200, t);
            osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);
            gain.gain.setValueAtTime(vol * 0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.04);
        }
        else if (type === 'drone_Explosion') {
            // 드론 전용 폭발음 (짧고 건조한 폭발)
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(900, t);
            filter.frequency.exponentialRampToValueAtTime(120, t + 0.18);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol * 0.9, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

            src.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            src.start(t); src.stop(t + 0.18);
        }
    }
};

