// news_overlay.js - battle news overlay
(function () {
    'use strict';

    function drawRoundRect(ctx, x, y, w, h, r) {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, radius);
            ctx.fill();
            return;
        }
        const rr = radius;
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h - rr);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.fill();
    }

    function drawApache(ctx, x, y, rotor, scale, teamColor) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // Tail Boom
        ctx.fillStyle = '#334155';
        ctx.fillRect(-40, -5, 30, 8);

        // Tail Rotor
        ctx.save();
        ctx.translate(-40, -5);
        ctx.rotate(rotor * 3);
        ctx.fillStyle = '#000';
        ctx.fillRect(-2, -12, 4, 24);
        ctx.restore();

        // Main Body
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(20, 5);
        ctx.lineTo(25, -5);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-15, 5);
        ctx.fill();

        // Team marking
        ctx.fillStyle = teamColor;
        ctx.fillRect(-6, -2, 10, 2);

        // Windows
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(12, -5);
        ctx.lineTo(18, -5);
        ctx.lineTo(16, -8);
        ctx.lineTo(14, -8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, -8);
        ctx.lineTo(8, -8);
        ctx.lineTo(6, -11);
        ctx.lineTo(4, -11);
        ctx.fill();

        // Wing Stub & Weapons
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 10, 8);
        ctx.fillStyle = '#000';
        ctx.fillRect(2, 6, 6, 4);

        // Main Rotor
        ctx.fillStyle = '#000';
        ctx.fillRect(-30, -12, 60, 3);
        ctx.fillRect(-5, -15, 10, 5);

        ctx.restore();
    }

    class NewsCivilian {
        constructor(id, x, y, speed) {
            this.id = id;
            this.x = x;
            this.y = y;
            this.speed = speed;
            this.baseY = y;
        }

        update(width) {
            this.x -= this.speed;
            if (this.x < -120) this.x = width + 120;

            if (this.id === 'sedan' || this.id === 'suv' || this.id === 'bus') {
                this.y = this.baseY + Math.sin(performance.now() / 120) * 1.2;
            }
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);

            const neutralGrey = '#94a3b8';
            const darkGrey = '#475569';
            const windowColor = '#cbd5e1';

            if (this.id === 'sedan') {
                ctx.fillStyle = neutralGrey;
                drawRoundRect(ctx, -25, -12, 50, 10, 2);
                ctx.fillStyle = darkGrey;
                ctx.beginPath();
                ctx.moveTo(-15, -12);
                ctx.lineTo(-8, -20);
                ctx.lineTo(12, -20);
                ctx.lineTo(18, -12);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = windowColor;
                ctx.beginPath();
                ctx.moveTo(-12, -13);
                ctx.lineTo(-7, -18);
                ctx.lineTo(10, -18);
                ctx.lineTo(14, -13);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#1e293b';
                ctx.beginPath(); ctx.arc(-15, -2, 5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(15, -2, 5, 0, Math.PI * 2); ctx.fill();
            } else if (this.id === 'suv') {
                ctx.fillStyle = darkGrey;
                drawRoundRect(ctx, -28, -13, 56, 10, 3);
                ctx.fillStyle = neutralGrey;
                drawRoundRect(ctx, -20, -22, 38, 10, 5);
                ctx.fillStyle = windowColor;
                ctx.fillRect(-15, -20, 10, 6);
                ctx.fillRect(0, -20, 15, 6);
                ctx.fillStyle = '#0f172a';
                ctx.beginPath(); ctx.arc(-16, -3, 4.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(16, -3, 4.5, 0, Math.PI * 2); ctx.fill();
            } else if (this.id === 'bus') {
                ctx.fillStyle = '#cbd5e1';
                drawRoundRect(ctx, -40, -35, 80, 30, 4);
                ctx.fillStyle = darkGrey;
                ctx.fillRect(-40, -10, 80, 5);
                ctx.fillStyle = windowColor;
                for (let i = 0; i < 4; i++) ctx.fillRect(-35 + (i * 18), -30, 14, 12);
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(-25, -5, 6, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(20, -5, 6, 0, Math.PI * 2); ctx.fill();
            } else if (this.id === 'crowd') {
                const members = [
                    { x: -12, c: '#94a3b8' },
                    { x: 12, c: '#64748b' },
                    { x: 0, c: '#475569' }
                ];
                members.forEach(m => {
                    ctx.save();
                    ctx.translate(m.x, 0);
                    ctx.fillStyle = m.c;
                    ctx.fillRect(-5, -15, 10, 15);
                    ctx.fillStyle = '#e2e8f0';
                    ctx.beginPath(); ctx.arc(0, -19, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                });
            }

            ctx.restore();
        }
    }

    class NewsApache {
        constructor(x, y, speed) {
            this.x = x;
            this.y = y;
            this.speed = speed;
            this.rotor = 0;
        }

        update(width) {
            this.x += this.speed;
            this.rotor += 0.4;
            if (this.x > width + 120) this.x = -140;
        }

        draw(ctx) {
            drawApache(ctx, this.x, this.y, this.rotor, 0.8, '#ef4444');
        }
    }

    class NewsPlane {
        constructor(x, y, speed) {
            this.x = x;
            this.y = y;
            this.speed = speed;
        }

        update(width) {
            this.x += this.speed;
            if (this.x > width + 120) this.x = -140;
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.moveTo(40, -5);
            ctx.lineTo(-30, 5);
            ctx.lineTo(-30, -10);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(-10, -15, 40, 5);
            ctx.restore();
        }
    }

    const NewsOverlay = {
        container: null,
        canvas: null,
        ctx: null,
        width: 420,
        height: 240,
        units: [],
        running: false,
        rafId: 0,
        _lastTs: 0,
        _showTimer: null,
        _hideTimer: null,
        visible: false,
        useGameFeed: true,
        lockedFocusX: null,
        groundFocusRatio: 0.60,
        customText: null,
        _defaultText: null,

        init() {
            if (this.container) return;
            this.container = document.getElementById('news-widget');
            this.canvas = document.getElementById('news-canvas');
            if (!this.container || !this.canvas) return;
            this.ctx = this.canvas.getContext('2d');
            this._cacheDefaultText();
            this.resize();
            window.addEventListener('resize', () => this.resize());
            this.buildScene();
        },

        _cacheDefaultText() {
            if (this._defaultText) return;
            const locEl = document.getElementById('news-location');
            const titleEl = document.querySelector('#news-widget .news-title span');
            const headlineEl = document.querySelector('#news-widget .news-headline');
            const tickerEl = document.querySelector('#news-widget .news-ticker-track span');
            this._defaultText = {
                location: locEl ? locEl.textContent : '',
                title: titleEl ? titleEl.textContent : '',
                headline: headlineEl ? headlineEl.textContent : '',
                ticker: tickerEl ? tickerEl.textContent : ''
            };
        },

        setCustomText(custom) {
            this._cacheDefaultText();
            this.customText = custom || null;
            const locEl = document.getElementById('news-location');
            const titleEl = document.querySelector('#news-widget .news-title span');
            const headlineEl = document.querySelector('#news-widget .news-headline');
            const tickerEl = document.querySelector('#news-widget .news-ticker-track span');

            if (!custom) {
                if (this._defaultText) {
                    if (locEl) locEl.textContent = this._defaultText.location || '';
                    if (titleEl) titleEl.textContent = this._defaultText.title || '';
                    if (headlineEl) headlineEl.textContent = this._defaultText.headline || '';
                    if (tickerEl) tickerEl.textContent = this._defaultText.ticker || '';
                }
                return;
            }

            if (locEl && custom.location) locEl.textContent = custom.location;
            if (titleEl && custom.title) titleEl.textContent = custom.title;
            if (headlineEl && custom.headline) headlineEl.textContent = custom.headline;
            if (tickerEl && custom.ticker) tickerEl.textContent = custom.ticker;
        },

        clearCustomText() {
            this.setCustomText(null);
        },

        resize() {
            if (!this.canvas || !this.ctx) return;
            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.dpr = dpr; // [FIX] DPR 캐시
            this.canvas.width = Math.round(rect.width * dpr);
            this.canvas.height = Math.round(rect.height * dpr);
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.width = rect.width;
            this.height = rect.height;
            this.buildScene();
        },

        buildScene() {
            const w = this.width || 420;
            const h = this.height || 240;
            const roadY = Math.round(h * 0.68);

            this.units = [
                new NewsPlane(w * 0.1, h * 0.2, 0.35),
                new NewsApache(-120, h * 0.33, 0.9),
                new NewsApache(-220, h * 0.28, 0.7),
                new NewsCivilian('bus', w * 0.7, roadY + 18, 0.8),
                new NewsCivilian('suv', w * 0.85, roadY + 26, 1.0),
                new NewsCivilian('sedan', w * 0.55, roadY + 30, 1.1),
                new NewsCivilian('sedan', w * 0.95, roadY + 26, 1.05),
                new NewsCivilian('crowd', w * 0.62, roadY + 45, 0.5),
                new NewsCivilian('crowd', w * 0.78, roadY + 52, 0.6),
                new NewsCivilian('crowd', w * 0.45, roadY + 48, 0.45)
            ];
        },

        updateTime() {
            if (this.customText && this.customText.lockLocation) return;
            const el = document.getElementById('news-location');
            if (!el) return;
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            el.textContent = `접경지역 민간인 통제선 인근 | ${hh}:${mm}`;
        },

        show(durationMs) {
            this.init();
            if (!this.container) return;
            if (!this.customText || !this.customText.lockLocation) {
                this.updateTime();
            }
            this.container.classList.remove('hidden');
            this.visible = true;
            this.lockedFocusX = null;
            this.resize();
            if (!this.useGameFeed) {
                this.start();
            }

            if (Number.isFinite(durationMs) && durationMs > 0) {
                clearTimeout(this._hideTimer);
                this._hideTimer = setTimeout(() => this.hide(), durationMs);
            }
        },

        hide() {
            if (!this.container) return;
            this.container.classList.add('hidden');
            this.visible = false;
            this.lockedFocusX = null;
            this.stop();
        },

        schedule(delayMs, durationMs) {
            this.init();
            clearTimeout(this._showTimer);
            clearTimeout(this._hideTimer);
            this.hide();
            const delay = Math.max(0, Number(delayMs) || 0);
            this._showTimer = setTimeout(() => this.show(durationMs), delay);
        },

        start() {
            if (this.running) return;
            this.running = true;
            this._lastTs = performance.now();
            const loop = (ts) => {
                if (!this.running) return;
                const dt = Math.min(0.05, (ts - this._lastTs) / 1000);
                this._lastTs = ts;
                this.update(dt);
                this.draw();
                this.rafId = requestAnimationFrame(loop);
            };
            this.rafId = requestAnimationFrame(loop);
        },

        stop() {
            this.running = false;
            if (this.rafId) cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        },

        update() {
            const w = this.width || 420;
            this.units.forEach(u => u.update(w));
        },

        drawBackground() {
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;
            const roadY = Math.round(h * 0.68);

            const grad = ctx.createLinearGradient(0, 0, 0, h * 0.9);
            grad.addColorStop(0, '#334155');
            grad.addColorStop(1, '#94a3b8');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, roadY, w, h - roadY);

            ctx.strokeStyle = '#475569';
            ctx.setLineDash([24, 24]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, roadY + 12);
            ctx.lineTo(w, roadY + 12);
            ctx.stroke();
            ctx.setLineDash([]);
        },

        drawScanlines() {
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            for (let y = 0; y < h; y += 4) {
                ctx.fillRect(0, y, w, 1);
            }
        },

        draw() {
            if (!this.ctx) return;
            this.ctx.clearRect(0, 0, this.width, this.height);
            this.drawBackground();

            this.units.sort((a, b) => a.y - b.y);
            this.units.forEach(u => u.draw(this.ctx));
            this.drawScanlines();
        },

        renderFromGame(game) {
            if (!this.visible || !this.useGameFeed) return;
            if (!this.ctx || !this.canvas || !game) return;
            if (typeof Maps === 'undefined') return;
            this.drawGameFeed(game);
        },

        drawGameFeed(game) {
            const ctx = this.ctx;
            const w = this.width;   // 뉴스 캔버스 너비 (420)
            const h = this.height;  // 뉴스 캔버스 높이 (240)
            const dpr = this.dpr || 1;

            // === 1. 캔버스 초기화 ===
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // === 2. 카메라맨 위치 가져오기 ===
            const cameraman = (typeof game.getActiveCameraman === 'function')
                ? game.getActiveCameraman()
                : null;
            const manualX = (game && Number.isFinite(game.newsCameraX)) ? game.newsCameraX : null;
            const focusX = (manualX !== null)
                ? manualX
                : ((cameraman && !cameraman.dead) ? cameraman.x : (CONFIG.mapWidth * 0.5));

            // === 3. 줌 및 뷰포트 설정 ===
            const zoom = 1.5;  // 줌 레벨 (1.5배 확대)
            const viewW = w / zoom;  // 실제로 보이는 게임 월드 너비
            const viewH = h / zoom;  // 실제로 보이는 게임 월드 높이

            // === 4. 카메라 X 위치 (카메라맨이 중앙에 오도록) ===
            const cameraX = Math.max(0, Math.min(focusX - viewW / 2, CONFIG.mapWidth - viewW));

            // === 5. 지면이 화면 하단 75% 위치에 오도록 Y 오프셋 계산 ===
            const groundOnScreen = h * 0.75;  // 지면이 화면의 75% 위치
            const cameraY = game.groundY - (groundOnScreen / zoom);

            // === 6. 배경 그리기 (하늘 + 지면) ===
            ctx.save();

            // 하늘 (파란색 그라데이션)
            const skyGrad = ctx.createLinearGradient(0, 0, 0, groundOnScreen);
            skyGrad.addColorStop(0, '#1e3a5f');
            skyGrad.addColorStop(1, '#3b82f6');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, w, groundOnScreen);

            // 지면 (회색)
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(0, groundOnScreen, w, h - groundOnScreen);

            ctx.restore();

            // === 7. 게임 월드 렌더링 ===
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, w, h);
            ctx.clip();

            // 줌 & 카메라 오프셋 적용
            ctx.scale(zoom, zoom);
            ctx.translate(-cameraX, -cameraY);

            // 건물 그리기
            if (game.buildings) {
                game.buildings.forEach(b => {
                    if (b && !b.dead) b.draw(ctx);
                });
            }

            // 민간인 그리기
            if (game.civilians) {
                game.civilians.forEach(u => {
                    if (u && !u.dead) u.draw(ctx);
                });
            }

            // 적군 그리기
            if (game.enemies) {
                game.enemies.forEach(u => {
                    if (u && !u.dead) u.draw(ctx);
                });
            }

            // 아군 그리기
            if (game.players) {
                game.players.forEach(u => {
                    if (u && !u.dead) u.draw(ctx);
                });
            }

            // 투사체 & 파티클
            if (game.projectiles) {
                game.projectiles.forEach(p => {
                    if (p) p.draw(ctx);
                });
            }
            if (game.particles) {
                game.particles.forEach(p => {
                    if (p) p.draw(ctx);
                });
            }

            ctx.restore();

            // === 8. 스캔라인 효과 ===
            this.drawScanlines();

            // === 9. 현장 중계 캡션 ===
            if (cameraman && !cameraman.dead) {
                ctx.save();
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const text = '현장 중계';
                const textW = ctx.measureText(text).width + 16;
                const textH = 20;
                const boxX = w / 2 - textW / 2;
                const boxY = 8;

                // 빨간 배경
                ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
                ctx.fillRect(boxX, boxY, textW, textH);

                // 텍스트
                ctx.fillStyle = '#ffffff';
                ctx.fillText(text, w / 2, boxY + textH / 2);

                // REC 표시 (깜빡임)
                if (Math.floor(Date.now() / 500) % 2 === 0) {
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath();
                    ctx.arc(boxX - 10, boxY + textH / 2, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        }
    };

    window.NewsOverlay = NewsOverlay;
})();
