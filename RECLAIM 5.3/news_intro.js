// news_intro.js - News intro animation + sound for city map
(function () {
    'use strict';

    function clamp(value, min, max) {
        return Math.max(min, Math.min(value, max));
    }

    function drawGlobe(ctx, centerX, centerY, timeMs, radius) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = clamp(radius * 0.012, 1, 2);

        const latStep = radius * 0.17;
        const latHeight = radius * 0.06;
        for (let i = -4; i <= 4; i++) {
            const y = i * latStep;
            const w = Math.sqrt(Math.max(0, (radius * radius) - (y * y)));
            ctx.beginPath();
            ctx.ellipse(0, y, w, latHeight, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        const rotationSpeed = 0.003;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            const widthScale = Math.sin(timeMs * rotationSpeed + (i * Math.PI / 3));
            ctx.ellipse(0, 0, Math.abs(widthScale * radius), radius, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = clamp(radius * 0.014, 1.5, 3);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    const NewsIntro = {
        container: null,
        canvas: null,
        ctx: null,
        width: 0,
        height: 0,
        dpr: 1,
        visible: false,
        running: false,
        rafId: 0,
        startTime: 0,
        durationMs: 3000,
        _showTimer: null,
        _finishTimer: null,
        _playedSound: false,
        onDone: null,

        init() {
            if (this.container) return;
            this.container = document.getElementById('news-intro-widget');
            this.canvas = document.getElementById('news-intro-canvas');
            if (!this.container || !this.canvas) return;
            this.ctx = this.canvas.getContext('2d');
            window.addEventListener('resize', () => this.resize());
        },

        resize() {
            if (!this.canvas || !this.ctx) return;
            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.dpr = dpr;
            this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
            this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.width = rect.width;
            this.height = rect.height;
        },

        playSound() {
            if (this._playedSound) return;
            this._playedSound = true;
            const file = 'bgm/news-intro-344332.mp3';
            const master = (typeof AudioSystem !== 'undefined' && AudioSystem.volume)
                ? (AudioSystem.volume.master || 1)
                : 1;
            const sfx = (typeof AudioSystem !== 'undefined' && AudioSystem.volume)
                ? (AudioSystem.volume.sfx || 0.6)
                : 0.6;
            const vol = clamp(sfx * master * 0.9, 0, 1);

            if (typeof AudioSystem !== 'undefined' && typeof AudioSystem._playOneShot === 'function') {
                AudioSystem._playOneShot(file, vol, 2);
                return;
            }

            try {
                const a = new Audio(file);
                a.preload = 'auto';
                a.playsInline = true;
                a.volume = vol;
                const p = a.play();
                if (p && p.catch) p.catch(() => { });
            } catch (e) { }
        },

        show(durationMs, onDone) {
            this.init();
            if (!this.container || !this.canvas || !this.ctx) return;
            if (typeof NewsOverlay !== 'undefined') NewsOverlay.hide();

            this.durationMs = Math.max(500, Number(durationMs) || 3000);
            this.onDone = (typeof onDone === 'function') ? onDone : null;
            this.visible = true;
            this._playedSound = false;
            this.container.classList.remove('hidden');
            this.resize();
            this.playSound();
            this.start();
        },

        hide() {
            if (!this.container) return;
            this.container.classList.add('hidden');
            this.visible = false;
            this.stop();
            clearTimeout(this._finishTimer);
            this._finishTimer = null;
        },

        schedule(delayMs, durationMs, onDone) {
            this.init();
            clearTimeout(this._showTimer);
            this.hide();
            const delay = Math.max(0, Number(delayMs) || 0);
            this._showTimer = setTimeout(() => this.show(durationMs, onDone), delay);
        },

        start() {
            if (this.running) return;
            this.running = true;
            this.startTime = performance.now();
            const loop = (ts) => {
                if (!this.running) return;
                const elapsed = ts - this.startTime;
                if (elapsed < this.durationMs) {
                    this.draw(elapsed);
                    this.rafId = requestAnimationFrame(loop);
                } else {
                    this.finish();
                }
            };
            this.rafId = requestAnimationFrame(loop);
        },

        stop() {
            this.running = false;
            if (this.rafId) cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        },

        finish() {
            if (!this.ctx) return;
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.stop();
            clearTimeout(this._finishTimer);
            this._finishTimer = setTimeout(() => {
                this.hide();
                if (this.onDone) {
                    const cb = this.onDone;
                    this.onDone = null;
                    cb();
                }
            }, 80);
        },

        draw(elapsed) {
            if (!this.ctx) return;
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;

            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#0f172a');
            grad.addColorStop(0.5, '#1e3a8a');
            grad.addColorStop(1, '#450a0a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            const cx = w / 2;
            const cy = h / 2;
            const scale = Math.min(w / 900, h / 500);
            const radius = Math.min(w, h) * 0.36;

            drawGlobe(ctx, cx, cy, elapsed, radius);

            const pulse = 1 + Math.sin(elapsed * 0.005) * 0.05;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(pulse, pulse);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const boxW = 320 * scale;
            const boxH = 30 * scale;
            ctx.fillStyle = '#dc2626';
            ctx.save();
            ctx.transform(1, 0, -0.2, 1, 0, 0);
            ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
            ctx.restore();

            ctx.fillStyle = '#fff';
            ctx.font = `900 ${Math.round(24 * scale)}px Arial`;
            ctx.fillText('BREAKING NEWS', 0, 0);

            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 12 * scale;
            ctx.font = `900 ${Math.round(80 * scale)}px 'Malgun Gothic', sans-serif`;
            ctx.fillText('뉴스특보', 0, Math.round(70 * scale));
            ctx.restore();

            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            for (let y = 0; y < h; y += 4) {
                ctx.fillRect(0, y, w, 2);
            }
        }
    };

    window.NewsIntro = NewsIntro;
})();
