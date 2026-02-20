// Lobby background renderer for the main menu.
const LobbyBackground = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    frame: 0,
    loopId: null,
    lastFrameTime: 0,

    units: [],

    baseUnitScale: 1.0,
    tankScale: 1.6,
    humveeScale: 1.24,
    helicopterScale: 1.0,
    backdropScaleDesktop: 1.16,
    backdropScaleMobile: 0.9,
    backdropMobileYOffset: 34,
    cityScaleMobile: 0.68,
    cityYOffsetMobile: 54,
    cityExtraRangeMobile: 760,
    roadScaleYMobile: 1.62,
    helicopterYOffset: -55,
    tankYOffset: 38,
    infantryYOffsets: [56, 54, 57],

    particles: [],
    particlePool: [],
    maxParticles: 180,

    smokeEmitters: [],
    windX: 0.35,

    init() {
        this.canvas = document.getElementById('lobby-canvas');
        if (!this.canvas) {
            console.warn('LobbyBackground: lobby-canvas not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.createUnits();
        this.initParticlePool();
        this.setupSmokeEmitters();
        window.addEventListener('resize', () => this.resize());
    },

    resize() {
        if (!this.canvas) return;

        const parent = this.canvas.parentElement;
        const viewport = (typeof window !== 'undefined' && window.visualViewport) ? window.visualViewport : null;
        const fallbackWidth = Math.max(1, Math.round((viewport && Number.isFinite(viewport.width) ? viewport.width : window.innerWidth) || 1));
        const fallbackHeight = Math.max(1, Math.round((viewport && Number.isFinite(viewport.height) ? viewport.height : window.innerHeight) || 1));
        const parentWidth = parent ? Math.round(Number(parent.clientWidth) || 0) : 0;
        const parentHeight = parent ? Math.round(Number(parent.clientHeight) || 0) : 0;

        // Hidden lobby screens can report 0x0; keep canvas at viewport size instead of shrinking to 1x1.
        this.width = Math.max(1, parentWidth > 0 ? parentWidth : fallbackWidth);
        this.height = Math.max(1, parentHeight > 0 ? parentHeight : fallbackHeight);
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.updateUnitPositions();
        this.setupSmokeEmitters();

        if (this.loopId) this.draw();
    },

    getGroundY() {
        const minGroundHeight = 180;
        const groundHeight = Math.max(minGroundHeight, Math.round(this.height * 0.35));
        return Math.max(0, this.height - groundHeight);
    },

    createUnits() {
        // Decorative lobby units are intentionally disabled.
        this.units = [];
    },

    createUnit(type, x, y, team) {
        if (!CONFIG.units || !CONFIG.units[type]) {
            console.warn(`LobbyBackground: Unit type ${type} not found`);
            return null;
        }

        const data = CONFIG.units[type];
        const unit = new Unit(type, x, y, team, data.hp);
        unit.lobbyPreview = true;

        if (type === 'apache' && unit.rotorAngle === undefined) {
            unit.rotorAngle = 0;
        }

        return unit;
    },

    updateUnitPositions() {
        if (this.units.length === 0) return;

        const groundY = this.getGroundY();
        const leftBaseX = 170;
        const rightBaseX = this.width - 170;

        if (this.units[0]) { this.units[0].x = leftBaseX + 40; this.units[0].y = groundY + this.helicopterYOffset; }
        if (this.units[1]) { this.units[1].x = leftBaseX - 24; this.units[1].y = groundY + this.tankYOffset; }
        if (this.units[2]) { this.units[2].x = leftBaseX + 26; this.units[2].y = groundY + this.infantryYOffsets[0]; }
        if (this.units[3]) { this.units[3].x = leftBaseX + 50; this.units[3].y = groundY + this.infantryYOffsets[1]; }
        if (this.units[4]) { this.units[4].x = leftBaseX + 74; this.units[4].y = groundY + this.infantryYOffsets[2]; }

        if (this.units[5]) { this.units[5].x = rightBaseX - 40; this.units[5].y = groundY + this.helicopterYOffset; }
        if (this.units[6]) { this.units[6].x = rightBaseX + 24; this.units[6].y = groundY + this.tankYOffset; }
        if (this.units[7]) { this.units[7].x = rightBaseX - 74; this.units[7].y = groundY + this.infantryYOffsets[0]; }
        if (this.units[8]) { this.units[8].x = rightBaseX - 50; this.units[8].y = groundY + this.infantryYOffsets[1]; }
        if (this.units[9]) { this.units[9].x = rightBaseX - 26; this.units[9].y = groundY + this.infantryYOffsets[2]; }
    },

    initParticlePool() {
        this.particles = [];
        this.particlePool = [];

        for (let i = 0; i < this.maxParticles; i += 1) {
            this.particlePool.push({
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                r: 10,
                alpha: 0,
                life: 0,
                maxLife: 0,
                active: false
            });
        }
    },

    setupSmokeEmitters() {
        const groundY = this.getGroundY();
        this.smokeEmitters = [
            { x: this.width * 0.3, y: groundY },
            { x: this.width * 0.5, y: groundY },
            { x: this.width * 0.7, y: groundY }
        ];
    },

    spawnParticle(x, y) {
        const p = this.particlePool.find((item) => !item.active);
        if (!p) return;

        p.active = true;
        p.x = x + (Math.random() - 0.5) * 30;
        p.y = y;
        p.vx = (Math.random() - 0.5) * 0.1;
        p.vy = -0.3 - Math.random() * 0.3;
        p.r = 6 + Math.random() * 12;
        p.alpha = 0.2 + Math.random() * 0.15;
        p.life = 0;
        p.maxLife = 240 + Math.random() * 180;

        this.particles.push(p);
    },

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i -= 1) {
            const p = this.particles[i];

            p.life += 1;
            p.x += p.vx + this.windX;
            p.y += p.vy;
            p.r *= 1.004;
            p.alpha = (1 - p.life / p.maxLife) * 0.35;

            if (p.life >= p.maxLife || p.y < -100 || p.alpha <= 0.01) {
                p.active = false;
                this.particles.splice(i, 1);
            }
        }
    },

    start() {
        if (!this.canvas || !this.ctx) {
            this.init();
        }
        if (!this.canvas || !this.ctx) return;

        // Ensure full-size canvas after returning from hidden states (city/map screens).
        this.resize();

        if (this.loopId) return;

        this.frame = 0;
        this.lastFrameTime = performance.now();
        this.prewarmSmoke();
        this.loop(this.lastFrameTime);
    },

    prewarmSmoke() {
        const prewarmSteps = 180;

        for (let i = 0; i < 60; i += 1) {
            const emitter = this.smokeEmitters[i % this.smokeEmitters.length];
            this.spawnParticle(emitter.x, emitter.y);
        }

        for (let step = 0; step < prewarmSteps; step += 1) {
            this.updateParticles();
            if (this.particles.length < this.maxParticles && step % 3 === 0) {
                const emitter = this.smokeEmitters[step % this.smokeEmitters.length];
                this.spawnParticle(emitter.x, emitter.y);
            }
        }
    },

    stop() {
        if (this.loopId) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }
    },

    loop(timestamp) {
        const deltaTime = timestamp - this.lastFrameTime;

        if (deltaTime >= 33) {
            this.frame += 1;
            this.lastFrameTime = timestamp;

            this.units.forEach((u) => {
                if (u && u.id === 'apache' && u.rotorAngle !== undefined) {
                    u.rotorAngle += 0.3;
                }
            });

            this.updateParticles();

            if (this.particles.length < this.maxParticles && this.smokeEmitters.length > 0) {
                const emitterIdx = this.frame % this.smokeEmitters.length;
                const emitter = this.smokeEmitters[emitterIdx];
                this.spawnParticle(emitter.x, emitter.y);

                if (Math.random() < 0.5 && this.particles.length < this.maxParticles) {
                    const randomEmitter = this.smokeEmitters[Math.floor(Math.random() * this.smokeEmitters.length)];
                    this.spawnParticle(randomEmitter.x, randomEmitter.y);
                }
            }

            this.draw();
        }

        this.loopId = requestAnimationFrame((t) => this.loop(t));
    },

    draw() {
        if (!this.ctx) return;

        const ctx = this.ctx;
        const groundY = this.getGroundY();
        this.drawKabulBackdrop(groundY);
        this.drawUnits();
        this.drawScanline(groundY);
    },

    drawKabulBackdrop(groundY) {
        const ctx = this.ctx;
        const isMobileViewport = this.width <= 768;
        const sceneScaleRaw = Number(isMobileViewport ? this.backdropScaleMobile : this.backdropScaleDesktop);
        const sceneScale = (Number.isFinite(sceneScaleRaw) && sceneScaleRaw > 0) ? sceneScaleRaw : 1;
        const sceneOffsetRaw = Number(this.backdropMobileYOffset);
        const sceneOffsetY = (isMobileViewport && Number.isFinite(sceneOffsetRaw)) ? sceneOffsetRaw : 0;
        const cityScaleRaw = Number(this.cityScaleMobile);
        const cityScaleMobile = (Number.isFinite(cityScaleRaw) && cityScaleRaw > 0) ? cityScaleRaw : 1;
        const cityScale = isMobileViewport ? cityScaleMobile : 1;
        const cityYOffsetRaw = Number(this.cityYOffsetMobile);
        const cityOffsetY = (isMobileViewport && Number.isFinite(cityYOffsetRaw)) ? cityYOffsetRaw : 0;
        const cityExtraRangeRaw = Number(this.cityExtraRangeMobile);
        const cityExtraRange = (isMobileViewport && Number.isFinite(cityExtraRangeRaw))
            ? Math.max(0, Math.floor(cityExtraRangeRaw))
            : 0;
        const applyLayerTransform = (scale = 1, yOffset = 0) => {
            if (Math.abs(scale - 1) <= 0.0001 && Math.abs(yOffset) <= 0.0001) return;
            const pivotX = this.width * 0.5;
            const pivotY = groundY + yOffset;
            ctx.translate(pivotX, pivotY);
            ctx.scale(scale, scale);
            ctx.translate(-pivotX, -pivotY);
        };
        const maps = (typeof Maps !== 'undefined' && Maps) ? Maps : null;
        const hasKabul = !!(maps
            && typeof maps.drawKabulSky === 'function'
            && typeof maps.drawKabulMountains === 'function'
            && typeof maps.drawKabulCity === 'function'
            && typeof maps.drawKabulGround === 'function'
            && typeof maps.drawKabulRoad === 'function'
            && typeof maps.drawKabulProps === 'function');

        if (!hasKabul) {
            const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
            skyGrad.addColorStop(0, '#1a2744');
            skyGrad.addColorStop(1, '#2d3a5c');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, this.width, groundY);
            this.drawGround(groundY);
            ctx.save();
            applyLayerTransform(sceneScale, sceneOffsetY);
            // Keep smoke behind skyline/objects in lobby preview.
            this.drawSmoke();
            if (maps && typeof maps.drawCitySkyline === 'function') {
                ctx.save();
                const cityWidth = 1200;
                const startX = Math.max(0, (this.width - cityWidth) / 2);
                maps.drawCitySkyline(ctx, startX, startX + cityWidth, groundY);
                ctx.restore();
            }
            ctx.restore();
            return;
        }

        // Full-size base first to avoid any black band when mobile transforms are applied.
        maps.drawKabulSky(ctx, this.width, this.height);

        const startX = -220;
        const endX = this.width + 220;

        ctx.save();
        applyLayerTransform(sceneScale, sceneOffsetY);
        maps.drawKabulMountains(ctx, startX - 260, endX + 260, groundY);
        // Draw smoke before city/ground layers so it stays behind buildings.
        this.drawSmoke();
        ctx.restore();

        ctx.save();
        applyLayerTransform(sceneScale * cityScale, sceneOffsetY + cityOffsetY);
        maps.drawKabulCity(ctx, startX - cityExtraRange, endX + cityExtraRange, groundY);
        ctx.restore();

        maps.drawKabulGround(ctx, this.width, this.height, groundY);

        ctx.save();
        applyLayerTransform(sceneScale, sceneOffsetY);
        const roadScaleYRaw = Number(this.roadScaleYMobile);
        const roadScaleY = (isMobileViewport && Number.isFinite(roadScaleYRaw) && roadScaleYRaw > 0)
            ? roadScaleYRaw
            : 1;
        if (Math.abs(roadScaleY - 1) > 0.0001) {
            const roadPivotY = groundY + sceneOffsetY;
            ctx.translate(0, roadPivotY);
            ctx.scale(1, roadScaleY);
            ctx.translate(0, -roadPivotY);
        }
        maps.drawKabulRoad(ctx, startX - 200, endX + 200, groundY);
        ctx.restore();

        ctx.save();
        applyLayerTransform(sceneScale, sceneOffsetY);
        maps.drawKabulProps(ctx, startX, endX, groundY);
        if (typeof maps.drawKabulDust === 'function') {
            maps.drawKabulDust(ctx, this.width, this.height, this.frame * 1.25);
        }
        ctx.restore();

    },

    drawGround(groundY) {
        const ctx = this.ctx;

        ctx.fillStyle = '#1a1d24';
        ctx.fillRect(0, groundY, this.width, this.height - groundY);

        const groundGrad = ctx.createLinearGradient(0, groundY, 0, this.height);
        groundGrad.addColorStop(0, 'rgba(26, 29, 36, 0)');
        groundGrad.addColorStop(1, 'rgba(10, 12, 15, 0.4)');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, this.width, this.height - groundY);

        ctx.strokeStyle = 'rgba(200, 200, 150, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 15]);

        ctx.beginPath();
        ctx.moveTo(0, groundY + 40);
        ctx.lineTo(this.width, groundY + 40);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, groundY + 80);
        ctx.lineTo(this.width, groundY + 80);
        ctx.stroke();

        ctx.setLineDash([]);
    },

    drawSmoke() {
        const ctx = this.ctx;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        for (const p of this.particles) {
            if (!p.active) continue;

            const gray = 180 + Math.random() * 40;
            ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    drawUnits() {
        const ctx = this.ctx;

        for (const unit of this.units) {
            if (!unit) continue;

            ctx.save();

            let scale = this.baseUnitScale;
            if (unit.id === 'mbt') scale = this.tankScale;
            else if (unit.id === 'humvee') scale = this.humveeScale;
            else if (unit.id === 'apache') scale = this.helicopterScale;
            if (!Number.isFinite(scale) || scale <= 0) scale = 1;

            ctx.translate(unit.x, unit.y);
            ctx.scale(scale, scale);
            ctx.translate(-unit.x, -unit.y);

            try {
                unit.draw(ctx);
            } catch (_) {
                // Keep lobby rendering alive even if a unit draw fails.
            }

            ctx.restore();
        }
    },

    drawScanline(groundY) {
        const ctx = this.ctx;

        const scanDuration = 90;
        const progress = (this.frame % scanDuration) / scanDuration;
        const scanY = (1 - progress) * groundY;

        const scanGrad = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
        scanGrad.addColorStop(0, 'rgba(59, 130, 246, 0)');
        scanGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
        scanGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');

        ctx.fillStyle = scanGrad;
        ctx.fillRect(0, scanY - 3, this.width, 6);
    }
};
