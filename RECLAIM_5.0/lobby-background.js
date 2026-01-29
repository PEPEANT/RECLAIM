/**
 * 로비 배경 렌더링 시스템 v2
 * - 시가지 확대컷 (Maps.drawCitySkyline 재사용)
 * - 실제 유닛 렌더링 (Unit.draw 재사용, 자동 업데이트 반영)
 * - 연기 파티클 (건물 뒤, 파티클 풀링)
 * - 스캔라인 애니메이션
 * - 30 FPS (time 기반)
 */

const LobbyBackground = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    frame: 0,
    loopId: null,
    lastFrameTime: 0,

    // 유닛 배열 (좌우 배치)
    units: [],

    // 유닛 렌더링 스케일
    baseUnitScale: 1.0,
    tankScale: 1.6,  // 탱크 크기 증가
    helicopterScale: 1.0,

    // 파티클 풀 (연기)
    particles: [],
    particlePool: [],
    maxParticles: 180,

    // 연기 emitters
    smokeEmitters: [],

    // 바람 (항상 오른쪽으로)
    windX: 0.35,

    /**
     * 초기화 - 로비 진입 시 한 번 호출
     */
    init() {
        this.canvas = document.getElementById('lobby-canvas');
        if (!this.canvas) {
            console.warn('LobbyBackground: lobby-canvas not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.resize();

        // 유닛 생성 (화면 크기 기준)
        this.createUnits();

        // 파티클 풀 초기화
        this.initParticlePool();

        // 연기 emitters 설정 (2-3개 고정)
        this.setupSmokeEmitters();

        // 윈도우 리사이즈 이벤트
        window.addEventListener('resize', () => this.resize());
    },

    /**
     * 캔버스 리사이즈 - 부모 크기에 맞춤
     */
    resize() {
        if (!this.canvas) return;

        this.width = this.canvas.parentElement.clientWidth;
        this.height = this.canvas.parentElement.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // 유닛 위치 재계산
        this.updateUnitPositions();

        // 연기 emitters 위치 재계산
        this.setupSmokeEmitters();

        // 리사이즈 후 즉시 다시 그리기
        if (this.loopId) {
            this.draw();
        }
    },

    /**
     * 실제 유닛 객체 생성 (Unit.draw 재사용)
     * 순서: 헬기(뒤/위) → 탱크(뒤/아래) → 보병(맨 앞)
     */
    createUnits() {
        if (typeof Unit === 'undefined' || typeof CONFIG === 'undefined') {
            console.warn('LobbyBackground: Unit or CONFIG not available');
            return;
        }

        this.units = [];
        const groundY = this.height * 0.75;

        // 좌측 진영 기준점 (안쪽으로 +90px)
        const leftBaseX = 170;
        // 우측 진영 기준점 (안쪽으로 -90px)
        const rightBaseX = this.width - 170;

        // === 좌측 파랑팀 (player) ===

        // 1. 헬기 (뒤/위) - 먼저 그려서 뒤에
        const apacheLeft = this.createUnit('apache', leftBaseX + 40, groundY - 140, 'player');
        if (apacheLeft) apacheLeft.rotorAngle = 0; // NaN 방지
        this.units.push(apacheLeft);

        // 2. 탱크 (뒤/아래)
        this.units.push(this.createUnit('mbt', leftBaseX - 24, groundY + 10, 'player'));

        // 3. 보병 3명 (맨 앞) - 버튼 쪽으로 이동, 간격 넓힘
        this.units.push(this.createUnit('infantry', leftBaseX + 26, groundY + 22, 'player'));
        this.units.push(this.createUnit('infantry', leftBaseX + 50, groundY + 20, 'player'));
        this.units.push(this.createUnit('infantry', leftBaseX + 74, groundY + 23, 'player'));

        // === 우측 빨강팀 (enemy) ===

        // 1. 헬기 (뒤/위)
        const apacheRight = this.createUnit('apache', rightBaseX - 40, groundY - 140, 'enemy');
        if (apacheRight) apacheRight.rotorAngle = 0; // NaN 방지
        this.units.push(apacheRight);

        // 2. 탱크 (뒤/아래)
        this.units.push(this.createUnit('mbt', rightBaseX + 24, groundY + 10, 'enemy'));

        // 3. 보병 3명 (맨 앞) - 버튼 쪽으로 이동, 간격 넓힘
        this.units.push(this.createUnit('infantry', rightBaseX - 74, groundY + 22, 'enemy'));
        this.units.push(this.createUnit('infantry', rightBaseX - 50, groundY + 20, 'enemy'));
        this.units.push(this.createUnit('infantry', rightBaseX - 26, groundY + 23, 'enemy'));
    },

    /**
     * 유닛 생성 헬퍼
     */
    createUnit(type, x, y, team) {
        if (!CONFIG.units[type]) {
            console.warn(`LobbyBackground: Unit type ${type} not found`);
            return null;
        }

        const data = CONFIG.units[type];
        const unit = new Unit(type, x, y, team, data.hp);

        // AI/전투 로직 비활성화 (렌더링 전용)
        unit.lobbyPreview = true;

        // 헬기는 로터 초기화
        if (type === 'apache' && unit.rotorAngle === undefined) {
            unit.rotorAngle = 0;
        }

        return unit;
    },

    /**
     * 유닛 위치 업데이트 (리사이즈 시)
     */
    updateUnitPositions() {
        if (this.units.length === 0) {
            this.createUnits();
            return;
        }

        const groundY = this.height * 0.75;
        const leftBaseX = 170;
        const rightBaseX = this.width - 170;

        // 좌측 5기 (헬기, 탱크, 보병x3)
        if (this.units[0]) { this.units[0].x = leftBaseX + 40; this.units[0].y = groundY - 140; } // 헬기
        if (this.units[1]) { this.units[1].x = leftBaseX - 24; this.units[1].y = groundY + 10; } // 탱크
        if (this.units[2]) { this.units[2].x = leftBaseX + 26; this.units[2].y = groundY + 22; } // 보병1
        if (this.units[3]) { this.units[3].x = leftBaseX + 50; this.units[3].y = groundY + 20; } // 보병2
        if (this.units[4]) { this.units[4].x = leftBaseX + 74; this.units[4].y = groundY + 23; } // 보병3

        // 우측 5기
        if (this.units[5]) { this.units[5].x = rightBaseX - 40; this.units[5].y = groundY - 140; } // 헬기
        if (this.units[6]) { this.units[6].x = rightBaseX + 24; this.units[6].y = groundY + 10; } // 탱크
        if (this.units[7]) { this.units[7].x = rightBaseX - 74; this.units[7].y = groundY + 22; } // 보병1
        if (this.units[8]) { this.units[8].x = rightBaseX - 50; this.units[8].y = groundY + 20; } // 보병2
        if (this.units[9]) { this.units[9].x = rightBaseX - 26; this.units[9].y = groundY + 23; } // 보병3
    },

    /**
     * 파티클 풀 초기화
     */
    initParticlePool() {
        this.particles = [];
        this.particlePool = [];

        for (let i = 0; i < this.maxParticles; i++) {
            this.particlePool.push({
                x: 0, y: 0,
                vx: 0, vy: 0,
                r: 10,
                alpha: 0,
                life: 0,
                maxLife: 0,
                active: false
            });
        }
    },

    /**
     * 연기 emitters 설정 (건물 사이 2-3개)
     */
    setupSmokeEmitters() {
        const groundY = this.height * 0.75;
        this.smokeEmitters = [
            { x: this.width * 0.3, y: groundY },
            { x: this.width * 0.5, y: groundY },
            { x: this.width * 0.7, y: groundY }
        ];
    },

    /**
     * 파티클 스폰 (풀에서 재사용)
     */
    spawnParticle(x, y) {
        // 풀에서 비활성 파티클 찾기
        let p = this.particlePool.find(p => !p.active);
        if (!p) return; // 풀 고갈 시 스폰 안 함

        p.active = true;
        p.x = x + (Math.random() - 0.5) * 30;
        p.y = y;
        p.vx = (Math.random() - 0.5) * 0.1; // 작은 흔들림만
        p.vy = -0.3 - Math.random() * 0.3; // 위로 천천히 상승
        p.r = 6 + Math.random() * 12; // 6~18px
        p.alpha = 0.2 + Math.random() * 0.15; // 0.2~0.35
        p.life = 0;
        p.maxLife = 240 + Math.random() * 180; // 4~7초 @ 30fps (2배 증가)

        this.particles.push(p);
    },

    /**
     * 파티클 업데이트
     */
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            p.life++;
            // 바람 효과 (항상 오른쪽으로)
            p.x += p.vx + this.windX;
            p.y += p.vy;

            // 천천히 확대 + 페이드아웃 (fadeRate 절반)
            p.r *= 1.004;
            p.alpha = (1 - p.life / p.maxLife) * 0.35;

            // 수명 끝 또는 화면 밖 -> 재사용
            if (p.life >= p.maxLife || p.y < -100 || p.alpha <= 0.01) {
                p.active = false;
                this.particles.splice(i, 1);
            }
        }
    },

    /**
     * 애니메이션 시작 - 로비 진입 시
     */
    start() {
        if (this.loopId) return; // 이미 실행 중

        this.frame = 0;
        this.lastFrameTime = performance.now();

        // 연기 prewarm (이미 중간쯤 올라온 상태로 시작)
        this.prewarmSmoke();

        this.loop(this.lastFrameTime);
    },

    /**
     * 연기 prewarm - 로비 진입 시 이미 연기가 피어있게
     */
    prewarmSmoke() {
        const prewarmSteps = 180; // 6초치 (30fps 기준)

        // 초기 파티클 생성
        for (let i = 0; i < 60; i++) {
            const emitter = this.smokeEmitters[i % this.smokeEmitters.length];
            this.spawnParticle(emitter.x, emitter.y);
        }

        // 시뮬레이션 돌리기 (이미 올라온 상태로)
        for (let step = 0; step < prewarmSteps; step++) {
            this.updateParticles();

            // 추가 스폰 (균일하게)
            if (this.particles.length < this.maxParticles && step % 3 === 0) {
                const emitter = this.smokeEmitters[step % this.smokeEmitters.length];
                this.spawnParticle(emitter.x, emitter.y);
            }
        }
    },

    /**
     * 애니메이션 정지 - 로비 이탈 시
     */
    stop() {
        if (this.loopId) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }
    },

    /**
     * 애니메이션 루프 (time 기반 30 FPS)
     */
    loop(timestamp) {
        const deltaTime = timestamp - this.lastFrameTime;

        // 33ms 기준 (30 FPS)
        if (deltaTime >= 33) {
            this.frame++;
            this.lastFrameTime = timestamp;

            // 헬기 로터 애니메이션 (연출용)
            this.units.forEach(u => {
                if (u && u.id === 'apache' && u.rotorAngle !== undefined) {
                    u.rotorAngle += 0.3; // 부드럽게 회전
                }
            });

            // 파티클 업데이트
            this.updateParticles();

            // 연기 스폰 (매 프레임 1~2개 균일 생성)
            if (this.particles.length < this.maxParticles) {
                // emitter 순환하며 균일 생성
                const emitterIdx = this.frame % this.smokeEmitters.length;
                const emitter = this.smokeEmitters[emitterIdx];
                this.spawnParticle(emitter.x, emitter.y);

                // 50% 확률로 추가 1개
                if (Math.random() < 0.5 && this.particles.length < this.maxParticles) {
                    const randomEmitter = this.smokeEmitters[Math.floor(Math.random() * this.smokeEmitters.length)];
                    this.spawnParticle(randomEmitter.x, randomEmitter.y);
                }
            }

            this.draw();
        }

        this.loopId = requestAnimationFrame((t) => this.loop(t));
    },

    /**
     * 메인 렌더링 함수
     */
    draw() {
        if (!this.ctx) return;

        const ctx = this.ctx;
        const groundY = this.height * 0.75;

        // 1. 하늘 그라데이션 (남색)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
        skyGrad.addColorStop(0, '#1a2744');  // 짙은 남색
        skyGrad.addColorStop(1, '#2d3a5c');  // 밝은 남색
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.width, groundY);

        // 2. 연기 파티클 (땅 아래에 먼저 그리기)
        this.drawSmoke();

        // 3. 땅 (콘크리트/도로)
        this.drawGround(groundY);

        // 4. 시가지 스카이라인 (Maps.drawCitySkyline 재사용)
        if (typeof Maps !== 'undefined' && Maps.drawCitySkyline) {
            ctx.save();

            // 화면 중앙 정렬을 위한 오프셋 계산
            const cityWidth = 1200;
            const startX = Math.max(0, (this.width - cityWidth) / 2);

            // 기존 Maps 함수 호출
            Maps.drawCitySkyline(ctx, startX, startX + cityWidth, groundY);

            ctx.restore();
        }

        // 5. 실제 유닛 렌더링 (Unit.draw 재사용)
        this.drawUnits();

        // 6. 스캔라인 애니메이션
        this.drawScanline(groundY);
    },

    /**
     * 땅 (어두운 회색 도로 + 차선)
     */
    drawGround(groundY) {
        const ctx = this.ctx;

        // 어두운 회색 도로
        ctx.fillStyle = '#1a1d24';
        ctx.fillRect(0, groundY, this.width, this.height - groundY);

        // 약간의 그라데이션 (깊이감)
        const groundGrad = ctx.createLinearGradient(0, groundY, 0, this.height);
        groundGrad.addColorStop(0, 'rgba(26, 29, 36, 0)');
        groundGrad.addColorStop(1, 'rgba(10, 12, 15, 0.4)');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, this.width, this.height - groundY);

        // 도로 차선 (점선 2줄)
        ctx.strokeStyle = 'rgba(200, 200, 150, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 15]);

        // 차선 1
        ctx.beginPath();
        ctx.moveTo(0, groundY + 40);
        ctx.lineTo(this.width, groundY + 40);
        ctx.stroke();

        // 차선 2
        ctx.beginPath();
        ctx.moveTo(0, groundY + 80);
        ctx.lineTo(this.width, groundY + 80);
        ctx.stroke();

        ctx.setLineDash([]); // 리셋
    },

    /**
     * 연기 파티클 렌더링
     */
    drawSmoke() {
        const ctx = this.ctx;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        for (const p of this.particles) {
            if (!p.active) continue;

            // 흰/회색 연기
            const gray = 180 + Math.random() * 40; // 180~220
            ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${p.alpha})`;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    /**
     * 실제 유닛 렌더링 (Unit.draw 재사용, 스케일 적용)
     */
    drawUnits() {
        const ctx = this.ctx;

        for (const unit of this.units) {
            if (!unit) continue;

            ctx.save();

            // 스케일 적용 (탱크만 크게, 나머지는 기본 크기)
            let scale = this.baseUnitScale;
            if (unit.id === 'mbt') scale = this.tankScale;
            else if (unit.id === 'apache') scale = this.helicopterScale;

            ctx.translate(unit.x, unit.y);
            ctx.scale(scale, scale);
            ctx.translate(-unit.x, -unit.y);

            // Unit.draw() 호출 (자동으로 팀 컬러 적용됨)
            unit.draw(ctx);

            ctx.restore();
        }
    },

    /**
     * 스캔라인 애니메이션 (3초 주기, 위→아래)
     */
    drawScanline(groundY) {
        const ctx = this.ctx;

        // 스캔라인 위치 계산 (3초 = 90프레임 @ 30fps)
        const scanDuration = 90;
        const progress = (this.frame % scanDuration) / scanDuration;
        const scanY = progress * groundY;

        // 스캔라인 그라데이션 (파란색 빛)
        const scanGrad = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
        scanGrad.addColorStop(0, 'rgba(59, 130, 246, 0)');
        scanGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
        scanGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');

        ctx.fillStyle = scanGrad;
        ctx.fillRect(0, scanY - 3, this.width, 6);
    }
};
