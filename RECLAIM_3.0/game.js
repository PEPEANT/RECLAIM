const LOGICAL_HEIGHT = 720;

const game = {
    canvas: document.getElementById('game-canvas'),
    ctx: null, width: 0, height: 0, groundY: 0,
    frame: 0, running: false, cameraX: 0,

    // [VFX] Screen Shake / Flash (screen-space)
    shake: 0,
    shakeDecay: 0.90,
    flash: 0,
    flashDecay: 0.85,
    yellowFlash: 0, // ✅ 핵 경고용 노란색 플래시
    yellowFlashDecay: 0.88,

    addShake(amount) {
        // amount: 대략 0~30
        const a = Math.max(0, Number(amount) || 0);
        this.shake = Math.max(this.shake || 0, a);
    },

    addFlash(amount) {
        // amount: 0~1
        const a = Math.max(0, Math.min(1, Number(amount) || 0));
        this.flash = Math.max(this.flash || 0, a);
    },

    // ✅ 핵 경고용 노란색 플래시
    addYellowFlash(amount) {
        const a = Math.max(0, Math.min(1, Number(amount) || 0));
        this.yellowFlash = Math.max(this.yellowFlash || 0, a);
    },

    scaleRatio: 1,
    logicalWidth: 1280, // Note: This might be less relevant if we calc width dynamically, but keeping for legacy refs or init
    logicalHeight: LOGICAL_HEIGHT,

    // [NEW] Total War Trigger Flag
    totalWarTriggered: false,

    // [NEW] 프리게임 커스텀 옵션
    settings: {
        includeForwardDefense: false,
    },

    players: [], enemies: [], projectiles: [], particles: [], buildings: [],
    supply: CONFIG.startSupply, enemySupply: CONFIG.startSupply,
    cooldowns: {}, playerStock: {}, enemyStock: {}, enemyCooldowns: {},
    skillCharges: { emp: 5, nuke: 1, tactical: 3 },
    empTimer: 0, targetingType: null, killCount: 0,
    playerBuildings: [], enemyBuildings: [],
    selectedBuilding: null,

    // [Queue System]
    spawnQueue: {},
    holdTimer: null, holdKey: null,

    // [Category & Spawn]
    currentCategory: 'infantry',

    // Toast Wrapper
    showToast(msg) { ui.showToast(msg); },

    init() {
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize()); // 회전 시 즉시 반응
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 50));

        this.setupInputs();
        this.initGameObjects();

        // UI 초기화
        ui.init();
        ui.initUnitButtons(this.currentCategory);
        if (typeof Lang !== 'undefined') Lang.updateDOM();
        this.updateZoomUI();

        // [ADD][APP] 저장된 설정/스키마를 로드해서 게임에 적용
        if (typeof app !== 'undefined') {
            app.loadIntoGame();      // speed/difficulty/lastMapId 등 반영
            app.commit('init');      // UI 1회 정렬 + 저장 포맷 정리
        }

        // [NEW] History API Handle for Back Button
        window.addEventListener('popstate', (event) => {
            if (this.running) {
                history.pushState({ page: 'game' }, "Game", "#game");
                ui.showExitConfirmation();
            } else if (!document.getElementById('map-select-screen').classList.contains('hidden')) {
                this.backToLobby();
            } else {
                history.pushState({ page: 'lobby' }, "Lobby", "#lobby"); // Keep in page
                ui.showExitConfirmation();
            }
        });

        // Push initial state
        history.replaceState({ page: 'lobby' }, "Lobby", "#lobby");

        // Loading Sim
        this.simulateLoading();

        // Minimap Inputs
        const miniCvs = document.getElementById('hud-minimap');
        if (miniCvs) {
            const handleMinimap = (mx, my) => {
                const rect = miniCvs.getBoundingClientRect();
                const x = mx - rect.left;
                const ratio = x / rect.width;
                this.cameraX = (ratio * CONFIG.mapWidth) - (Camera.viewW(this) / 2);
                this.cameraX = Camera.clampCameraX(this, this.cameraX);
            };
            let miniDrag = false;
            miniCvs.addEventListener('mousedown', e => { miniDrag = true; handleMinimap(e.clientX, e.clientY); });
            window.addEventListener('mousemove', e => { if (miniDrag) handleMinimap(e.clientX, e.clientY); });
            window.addEventListener('mouseup', () => miniDrag = false);
        }

        // Visibility / Freeze Prevention
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (typeof AudioSystem !== 'undefined' && AudioSystem.ctx) AudioSystem.ctx.suspend();
                this.running = false;
                if (this.loopId) {
                    cancelAnimationFrame(this.loopId);
                    this.loopId = null;
                }
            } else {
                if (typeof AudioSystem !== 'undefined' && AudioSystem.ctx) AudioSystem.ctx.resume();
                // Resume if game was active
                if (!document.getElementById('lobby-screen').classList.contains('hidden') === false) {
                    if (this.players.length > 0 || this.buildings.length > 0) {
                        this.running = true;
                        this.loop();
                    }
                }
            }
        });
    },

    simulateLoading() {
        const bar = document.getElementById('loading-bar');
        const text = document.getElementById('loading-text');
        const btn = document.getElementById('btn-start-game');
        let progress = 0;

        const interval = setInterval(() => {
            progress += Math.random() * 5;
            if (progress > 100) progress = 100;
            if (bar) bar.style.width = `${progress}%`;

            if (progress < 30) { if (text) text.innerText = (typeof Lang !== 'undefined') ? Lang.getText('loading_system') : "System Initializing..."; }
            else if (progress < 80) { if (text) text.innerText = (typeof Lang !== 'undefined') ? Lang.getText('loading_assets') : "Loading Data..."; }
            else { if (text) text.innerText = (typeof Lang !== 'undefined') ? Lang.getText('loading_complete') : "Ready."; }

            if (progress >= 100) {
                clearInterval(interval);
                // [변경] 로딩 끝나면 바로 시작 버튼 표시
                if (btn) btn.classList.remove('hidden');
                if (text) text.classList.remove('animate-pulse');
            }
        }, 30);
    },

    completeLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');

        // [New] Play Lobby BGM (BGM 1)
        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.init();
            AudioSystem.playMP3(0);
        }
    },

    openMapSelect(mode) {
        if (mode === 'online') {
            ui.showToast(Lang.getText('online_desc'));
            return;
        }
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('map-select-screen').classList.remove('hidden');
    },

    showMapSelect() {
        // [FIX] Proper transition from loading to map selection
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('map-select-screen').classList.remove('hidden');

        // Initialize audio on first user interaction
        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.init();
            AudioSystem.playMP3(0); // Play lobby BGM
        }
    },

    backToLobby() {
        this.running = false;
        this.isGameOver = false;
        if (this.loopId) cancelAnimationFrame(this.loopId);

        const endScreen = document.getElementById('end-screen');
        if (endScreen) { endScreen.classList.add('hidden'); endScreen.style.display = 'none'; }
        document.getElementById('hud-minimap-container').classList.add('hidden');
        document.getElementById('hud-minimap-toggle')?.classList.add('hidden');
        document.getElementById('hud-ctrl-wrapper')?.classList.add('hidden');
        document.getElementById('hud-option-btn').classList.add('hidden');
        document.getElementById('map-select-screen').classList.add('hidden');
        document.getElementById('unit-cmd-wrapper')?.classList.add('hidden');
        document.getElementById('unit-cmd-panel')?.classList.add('hidden');

        // [FIX] 로비로 복귀
        document.getElementById('lobby-screen').classList.remove('hidden');

        // Switch back to Lobby BGM
        if (typeof AudioSystem !== 'undefined') AudioSystem.playMP3(0);
    },

    // [R 2.2] 유닛 도감 열기
    openUnitDex() {
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('unitdex-screen').classList.remove('hidden');
        if (typeof UnitDex !== 'undefined') UnitDex.render();
    },

    // [R 2.2] 유닛 도감 닫기
    closeUnitDex() {
        document.getElementById('unitdex-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
    },

    startGame(mapType) {
        document.getElementById('map-select-screen').classList.add('hidden');
        Maps.currentMap = mapType || 'plain';

        // [NEW] 커스텀 옵션 읽기
        const optDefense = document.getElementById('opt-forward-defense');
        this.settings.includeForwardDefense = optDefense ? !!optDefense.checked : false;

        // [NEW] 맵 가로폭 동적 확장
        const baseW = CONFIG.baseMapWidth || CONFIG.mapWidth || 6000;
        const extraW = this.settings.includeForwardDefense ? (CONFIG.defenseExtraWidth || 0) : 0;
        CONFIG.mapWidth = baseW + extraW;

        this.start();
    },

    // [핵심] 흔들림 없는 리사이즈 로직
    resize() {
        const wrapper = document.getElementById('game-wrapper');
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const prevViewW = Camera.viewW(this);

        // 1. 배율 계산 (세로 높이를 720px에 맞춤)
        // 화면이 작으면 알아서 축소(Zoom Out)되고, 크면 확대됩니다.
        this.scaleRatio = winH / LOGICAL_HEIGHT;

        // 2. 가로 길이 계산 (화면 비율에 따라 유동적으로 넓어짐)
        // 예: 가로 모드면 width가 1400px 이상으로 늘어나서 PC처럼 보임
        this.width = winW / this.scaleRatio;
        this.height = LOGICAL_HEIGHT; // 높이는 무조건 720 고정!

        // 3. 캔버스 크기 적용
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // 4. 땅 높이 고정 (절대 변하지 않음)
        // 화면을 돌려도 groundY는 항상 470px (720 - 250) 입니다.
        this.groundY = this.height - CONFIG.groundHeight;

        // 5. CSS 스타일 적용 (화면 꽉 채우기)
        if (wrapper) {
            wrapper.style.width = `${winW}px`;
            wrapper.style.height = `${winH}px`;
            // wrapper 자체를 scale로 줄이거나 늘려서 딱 맞춤
            // transform 대신 캔버스 내부 해상도를 조절했으므로 여기선 크기만 맞춤
            wrapper.style.transform = 'none';

            // 캔버스 스타일 강제 지정 (중요)
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
        }

        Camera.preserveCenterOnResize(this, prevViewW);
    },

    initGameObjects() {
        // [NEW] Difficulty Stock Logic
        let stockMult = 1.0;
        let diff = 'veteran';
        if (typeof AI !== 'undefined' && AI.difficulty) diff = AI.difficulty;

        if (diff === 'recruit') {
            stockMult = 1.2; // 120%
        } else if (diff === 'elite') {
            stockMult = 0.6; // 60%
            console.log("Elite Difficulty: Player Stock Reduced to 60%");
        }

        for (let k in CONFIG.units) {
            this.cooldowns[k] = 0; this.enemyCooldowns[k] = 0;
            const isDroneKey = k.includes('drone');

            // [SPECIAL] 스텔스드론: 아군/적군 모두 5기 고정
            if (k === 'stealth_drone') {
                const fixedCount = Math.ceil(5 * 1.1);
                this.playerStock[k] = fixedCount;
                this.enemyStock[k] = fixedCount;
                this.spawnQueue[k] = 0;
                continue;
            }

            // Apply Multiplier
            let finalCount = Math.ceil(CONFIG.units[k].maxCount * stockMult);

            // [BUFF] Elite 난이도: 아군 드론 재고 보정
            if (diff === 'elite' && CONFIG.units[k].category === 'drone') {
                finalCount = Math.max(finalCount, Math.ceil(CONFIG.units[k].maxCount * 1.0) + 1);
            }

            // [NERF] Elite SPG Cap
            if (diff === 'elite' && k === 'spg') {
                finalCount = Math.min(finalCount, 3); // Max 3 SPGs on Elite
            }

            if (isDroneKey) {
                finalCount = Math.ceil(finalCount * 1.1);
            }

            this.playerStock[k] = finalCount;
            let enemyCount = Math.ceil(CONFIG.units[k].maxCount * 1.5);
            if (k === 'drone_suicide' || k === 'drone_at') {
                enemyCount = Math.ceil(enemyCount * 0.5);
            }
            if (isDroneKey) {
                enemyCount = Math.ceil(enemyCount * 1.1);
            }
            this.enemyStock[k] = enemyCount;
            this.spawnQueue[k] = 0;
        }

        this.totalWarTriggered = false; // Reset Total War
    },

    // [NEW] 적군 총력전 (Total War) 트리거
    triggerTotalWar() {
        if (this.totalWarTriggered || !this.running) return;
        this.totalWarTriggered = true;

        let delayCount = 0;
        const enemyHQ = this.buildings.find(b => b.type === 'hq_enemy');
        const spawnX = enemyHQ ? enemyHQ.x : CONFIG.mapWidth;

        for (let key in this.enemyStock) {
            const count = this.enemyStock[key];
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (this.running) {
                        this.spawnUnitDirect(key, spawnX - 50 + (Math.random() * 60 - 30), this.groundY, 'enemy');
                    }
                }, delayCount * 150);
                delayCount++;
            }
            this.enemyStock[key] = 0;
        }
    },

    start() {
        // [FIX] ID 수정: start-screen은 존재하지 않으므로 loading-screen을 숨김
        document.getElementById('loading-screen')?.classList.add('hidden');
        document.getElementById('lobby-screen')?.classList.add('hidden');
        document.getElementById('end-screen').classList.add('hidden');

        // [New] Push history state when game starts
        history.pushState({ page: 'game' }, "Game", "#game");

        this.players = []; this.enemies = []; this.projectiles = []; this.particles = [];
        this.buildings = [];
        this.supply = CONFIG.startSupply; this.enemySupply = CONFIG.startSupply;
        this.empTimer = 0;
        this.skillCharges = { emp: 5, nuke: 1, tactical: 3 };
        this.killCount = 0;
        this.isGameOver = false;

        // Recalculate groundY fresh to be sure
        this.resize();

        // [Safety] Ensure Map is selected
        if (typeof Maps !== 'undefined' && !Maps.currentMap) Maps.currentMap = 'plain';

        this.initGameObjects();
        this.running = true;
        this.cameraX = 0;

        // HUD
        this.minimapVisible = true;
        document.getElementById('hud-minimap-container').classList.remove('hidden');
        document.getElementById('hud-minimap-toggle')?.classList.remove('hidden');
        document.getElementById('hud-ctrl-wrapper')?.classList.remove('hidden');
        document.getElementById('hud-option-btn').classList.remove('hidden');
        document.getElementById('unit-cmd-wrapper')?.classList.remove('hidden');
        if (typeof ui !== 'undefined') ui.updateSpeedBtns(this.speed);

        // In-game BGM OFF
        if (typeof AudioSystem !== 'undefined') {
            if (AudioSystem.stopBGM) AudioSystem.stopBGM();
        }

        // AI
        if (typeof AI !== 'undefined') AI.lastSpawn = 0;

        // Map Setup
        const rearX = 120;  // HQ(후방)

        // 전방 방어 라인(요새+감시탑) 오른쪽으로 더 이동
        const forwardShift = 120;
        const frontX = 520 + forwardShift;
        const towerX = frontX + 450; // 기존 간격 유지

        this.buildings.push(new Building('hq_player', rearX, this.groundY, 'player'));
        if (this.settings.includeForwardDefense) {
            const fortressExtraX = 180;
            const fortressX = frontX + fortressExtraX;
            this.buildings.push(new Building('fortress_player', fortressX, this.groundY, 'player'));
            this.buildings.push(new Building('watchtower', towerX, this.groundY, 'player'));
        }

        this.buildings.push(new Building('hq_enemy', CONFIG.mapWidth - rearX, this.groundY, 'enemy'));
        if (this.settings.includeForwardDefense) {
            const fortressExtraX = 180;
            const fortressX = frontX + fortressExtraX;
            this.buildings.push(new Building('fortress_enemy', CONFIG.mapWidth - fortressX, this.groundY, 'enemy'));
            this.buildings.push(new Building('watchtower', CONFIG.mapWidth - towerX, this.groundY, 'enemy'));
        }

        // Neutral Bunkers
        [0.3, 0.5, 0.7].forEach(ratio => {
            this.buildings.push(new Building('bunker', CONFIG.mapWidth * ratio, this.groundY, 'neutral'));
        });

        this.loop();
    },

    setupInputs() {
        // [R 2.4] 완전 재설계된 입력 시스템
        const getScaledPos = (clientX, clientY) => {
            return Camera.screenToView(this, clientX, clientY);
        };

        // ======== 상태 변수 ========
        // 카메라 드래그 (PC 우클릭 / 모바일 두 손가락)
        let cameraDrag = false;
        let cameraLastX = 0;

        // 선택 박스 드래그 (PC 좌클릭 / 모바일 한 손가락)
        this.selectDragActive = false;
        this.selectStartX = 0;
        this.selectStartY = 0;
        this.selectEndX = 0;
        this.selectEndY = 0;

        // 모바일 전용 상태
        let isMobileSelecting = false;
        let isMobileCameraMove = false;
        let pinchActive = false;
        let pinchStartDist = 0;
        let pinchStartZoom = Camera.zoom;
        let pinchAnchorClientX = 0;
        let pinchAnchorClientY = 0;

        const selectHQAt = (wx, wy) => {
            for (let b of this.buildings) {
                if (b.dead) continue;
                if (b.type !== 'hq_player' && b.type !== 'hq_enemy' &&
                    b.type !== 'fortress_player' && b.type !== 'fortress_enemy') continue;
                if (wx > b.x - b.width / 2 && wx < b.x + b.width / 2 &&
                    wy > b.y - b.height && wy < b.y) {
                    this.selectedBuilding = b;
                    b.hideHp = false;
                    b.hpVisibleUntil = game.frame + 180;
                    return true;
                }
            }
            this.selectedBuilding = null;
            return false;
        };

        const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const getTouchMid = (t1, t2) => ({
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        });

        // ======== PC 마우스 이벤트 ========
        this.canvas.addEventListener('mousedown', e => {
            const p = getScaledPos(e.clientX, e.clientY);
            if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) return;

            if (e.button === 2) {
                // 우클릭: 카메라 드래그 시작
                cameraDrag = true;
                cameraLastX = p.x;
            } else if (e.button === 0) {
                // 좌클릭: 타겟팅 중이면 타겟팅 처리
                if (this.targetingType) {
                    this.handleTargeting(p.x + this.cameraX, p.y);
                    return;
                }
                // 선택 박스 드래그 시작
                this.selectDragActive = true;
                this.selectStartX = p.x + this.cameraX;
                this.selectStartY = p.y;
                this.selectEndX = this.selectStartX;
                this.selectEndY = this.selectStartY;
            }
        });

        window.addEventListener('mousemove', e => {
            const p = getScaledPos(e.clientX, e.clientY);

            // 카메라 드래그 (우클릭)
            if (cameraDrag && !this.selectDragActive) {
                this.cameraX -= (p.x - cameraLastX);
                this.cameraX = Camera.clampCameraX(this, this.cameraX);
                cameraLastX = p.x;
            }

            // 선택 박스 갱신 (좌클릭)
            if (this.selectDragActive) {
                this.selectEndX = p.x + this.cameraX;
                this.selectEndY = p.y;
            }
        });

        window.addEventListener('mouseup', e => {
            if (e.button === 2) {
                cameraDrag = false;
            } else if (e.button === 0 && this.selectDragActive) {
                this.selectDragActive = false;
                // 선택 박스가 너무 작으면 단일 클릭으로 처리
                const dx = Math.abs(this.selectEndX - this.selectStartX);
                const dy = Math.abs(this.selectEndY - this.selectStartY);
                if (dx < 10 && dy < 10) {
                    // 단일 클릭: 기존 클릭 로직
                    const clickX = this.selectStartX;
                    const clickY = this.selectStartY;
                    if (selectHQAt(clickX, clickY)) return;
                    const unitClicked = this.checkUnitClick && this.checkUnitClick(clickX, clickY);
                    if (unitClicked) { this.selectedBuilding = null; return; }
                    if (this.checkBuildingClick) this.checkBuildingClick(clickX, clickY);
                    if (this.clearAllSelection) this.clearAllSelection();
                    this.selectedBuilding = null;
                } else {
                    // 드래그 선택: 박스 내 유닛 선택
                    if (this.selectUnitsInRect) this.selectUnitsInRect();
                    this.selectedBuilding = null;
                }
            }
        });

        // 우클릭 메뉴 차단 + 드론 명령
        this.canvas.addEventListener('contextmenu', e => {
            e.preventDefault();
            const p = getScaledPos(e.clientX, e.clientY);
            this.commandDrones(p.x + this.cameraX, p.y);
        });

        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const step = e.deltaY < 0 ? Camera.STEP : -Camera.STEP;
            const newZoom = Camera.zoom + step;
            const prevZoom = Camera.zoom;
            Camera.applyZoomWithAnchor(this, newZoom, e.clientX, e.clientY);
            if (Camera.zoom !== prevZoom) this.updateZoomUI();
        }, { passive: false });

        // ======== 모바일 터치 이벤트 ========
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();

            if (e.touches.length === 1) {
                // 단일 터치: 유닛 선택 모드 (카메라 이동 금지)
                isMobileSelecting = true;
                isMobileCameraMove = false;
                pinchActive = false;

                const p = getScaledPos(e.touches[0].clientX, e.touches[0].clientY);
                if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) return;

                // 타겟팅 중이면 타겟팅 처리
                if (this.targetingType) {
                    this.handleTargeting(p.x + this.cameraX, p.y);
                    isMobileSelecting = false;
                    return;
                }

                // 선택 박스 시작
                this.selectDragActive = true;
                this.selectStartX = p.x + this.cameraX;
                this.selectStartY = p.y;
                this.selectEndX = this.selectStartX;
                this.selectEndY = this.selectStartY;

            } else if (e.touches.length >= 2) {
                // 두 손가락: 카메라 이동 모드
                isMobileCameraMove = true;
                isMobileSelecting = false;
                this.selectDragActive = false;

                const t1 = e.touches[0];
                const t2 = e.touches[1];
                pinchActive = true;
                pinchStartDist = getTouchDist(t1, t2);
                pinchStartZoom = Camera.zoom;
                const mid = getTouchMid(t1, t2);
                pinchAnchorClientX = mid.x;
                pinchAnchorClientY = mid.y;

                const p = getScaledPos(t1.clientX, t1.clientY);
                cameraLastX = p.x;
            }
        }, { passive: false });

        window.addEventListener('touchmove', e => {
            // 모바일 선택 중: 카메라 이동 완전 차단
            if (isMobileSelecting && this.selectDragActive) {
                e.preventDefault();
                const p = getScaledPos(e.touches[0].clientX, e.touches[0].clientY);
                this.selectEndX = p.x + this.cameraX;
                this.selectEndY = p.y;
                return; // 카메라 로직 호출 금지
            }

            // 두 손가락 카메라 이동
            if (isMobileCameraMove && e.touches.length >= 2) {
                if (pinchActive) {
                    e.preventDefault();
                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const dist = getTouchDist(t1, t2);
                    if (pinchStartDist > 0) {
                        const newZoom = pinchStartZoom * (dist / pinchStartDist);
                        const prevZoom = Camera.zoom;
                        Camera.applyZoomWithAnchor(this, newZoom, pinchAnchorClientX, pinchAnchorClientY);
                        if (Camera.zoom !== prevZoom) this.updateZoomUI();
                    }
                    return;
                }

                const p = getScaledPos(e.touches[0].clientX, e.touches[0].clientY);
                this.cameraX -= (p.x - cameraLastX);
                this.cameraX = Camera.clampCameraX(this, this.cameraX);
                cameraLastX = p.x;
            }
        }, { passive: false });

        window.addEventListener('touchend', e => {
            if (isMobileSelecting && this.selectDragActive) {
                this.selectDragActive = false;
                isMobileSelecting = false;

                // 선택 박스 크기 체크
                const dx = Math.abs(this.selectEndX - this.selectStartX);
                const dy = Math.abs(this.selectEndY - this.selectStartY);
                if (dx < 10 && dy < 10) {
                    // 단일 탭: 클릭 처리
                    const clickX = this.selectStartX;
                    const clickY = this.selectStartY;
                    if (selectHQAt(clickX, clickY)) return;
                    const unitClicked = this.checkUnitClick && this.checkUnitClick(clickX, clickY);
                    if (unitClicked) { this.selectedBuilding = null; return; }
                    if (this.checkBuildingClick) this.checkBuildingClick(clickX, clickY);
                    if (this.clearAllSelection) this.clearAllSelection();
                    this.selectedBuilding = null;
                } else {
                    // 드래그 선택
                    if (this.selectUnitsInRect) this.selectUnitsInRect();
                    this.selectedBuilding = null;
                }
            }

            if (e.touches.length === 0) {
                isMobileCameraMove = false;
                cameraDrag = false;
                pinchActive = false;
            } else if (e.touches.length < 2) {
                pinchActive = false;
            }
        });
    },

    setCategory(cat) {
        this.currentCategory = cat;
        // UI 갱신은 commit에서 처리
        if (typeof app !== 'undefined') app.markUiDirty();
    },

    // [FIX] Bunker Spawn Selection Stub (Prevent Crash)
    selectSpawn(bunker) {
        // Feature removed, but keeping method to prevent buildings.js crash
        this.selectedSpawn = bunker;
    },

    spawnUnitExecution(key) {
        const hq = this.buildings.find(b => b.type === 'hq_player');
        if (!hq) return;
        this.spawnUnitDirect(key, hq.x + 50, this.groundY, 'player');
    },

    prepareTargeting(key) {
        if (this.targetingType) return;
        const u = CONFIG.units[key];
        if (u.isSkill) {
            if (this.skillCharges[u.chargeKey] <= 0) { ui.showToast("사용 가능 횟수 부족!"); return; }
        } else {
            if (this.supply < u.cost || this.playerStock[key] <= 0) { ui.showToast("자원 또는 재고 부족!"); return; }
        }
        this.targetingType = key;
        document.getElementById('targeting-overlay').classList.remove('hidden');
        document.getElementById('target-msg').innerText =
            key === 'nuke' ? "전술핵 투하 지점 선택" :
                (key === 'emp' ? "EMP 투하 지점 선택" :
                    (key === 'tactical_missile' ? "전술미사일 타격 지점 선택" :
                        (key === 'stealth_drone' ? "스텔스드론 폭발 지점 선택" : `${u.name} 목표 지정`)));
    },

    handleTargeting(x, y) {
        if (!this.targetingType) return;
        const key = this.targetingType;
        const u = CONFIG.units[key];

        if (key === 'nuke') {
            if (this.skillCharges.nuke > 0) {
                this.skillCharges.nuke--;
                // (옵션) 쿨타임이 있다면 반영
                if (u.cooldown && u.cooldown > 0) this.cooldowns.nuke = u.cooldown;

                // ✅ [NEW] 핵 발사 전 경고음 + 5초 지연
                ui.showToast("⚠️ 전술핵 발사 승인! 5초 후 투하!");

                // 경고음 재생 (5초간 사이렌)
                if (typeof AudioSystem !== 'undefined') AudioSystem.playNukeWarning();

                // 5초 후 실제 핵 발사
                const targetX = x;
                const groundY = this.groundY;
                setTimeout(() => {
                    const nuke = new Projectile(targetX, -500, null, 1000, 'player', 'nuke');
                    nuke.targetX = targetX;
                    nuke.targetY = groundY;
                    this.projectiles.push(nuke);

                    ui.showToast("☢️ 전술핵 투하!");
                }, 5000);

                // [FIX] 스킬은 큐/쿨타임이 없으면 uiDirty가 안 떠서 숫자 갱신이 안 됨
                if (typeof app !== 'undefined') { app.markDirty(); app.markUiDirty(); }
            }
        } else if (key === 'emp') {
            if (this.skillCharges.emp > 0) {
                this.skillCharges.emp--;
                if (u.cooldown && u.cooldown > 0) this.cooldowns.emp = u.cooldown;
                ui.showToast("EMP 충격파 발생!");
                const targets = [...this.enemies, ...this.enemyBuildings];
                targets.forEach(e => { if (!e.dead && Math.abs(e.x - x) < 300 && (e.stats.type === 'mech' || e.stats.type === 'building')) e.stunTimer = 600; });
                this.createParticles(x, y, 20, '#ffffff');

                if (typeof app !== 'undefined') { app.markDirty(); app.markUiDirty(); }
            }
        } else if (key === 'tactical_missile') {
            if (this.skillCharges.tactical > 0) {
                this.skillCharges.tactical--;
                if (u.cooldown && u.cooldown > 0) this.cooldowns.tactical_missile = u.cooldown;

                // 타겟이 지면 아래면 보정
                const ty = Math.min(y, this.groundY);

                // ✅ 본부에서 발사
                const hq = this.buildings.find(b => b.type === 'hq_player');
                const sx = hq ? (hq.x + hq.width * 0.55) : 80;
                const sy = hq ? (this.groundY - (hq.height * 0.85)) : (this.groundY - 260);

                const m = new Projectile(sx, sy, null, 0, 'player', 'tactical_missile', { targetX: x, targetY: ty });
                this.projectiles.push(m);

                ui.showToast("전술미사일 발사!");

                if (typeof app !== 'undefined') { app.markDirty(); app.markUiDirty(); }
            }
        } else if (key === 'stealth_drone') {
            // 위치 지정형 (락온 없음): 지정 지점으로 침투 후 급강하 폭발
            this.supply -= u.cost;
            this.cooldowns[key] = u.cooldown;
            this.playerStock[key]--;

            const drone = new Unit(key, 50, this.groundY, 'player', null);
            drone.x = 50;
            drone.y = this.groundY - 420;
            drone.targetX = x;
            this.players.push(drone);
            ui.showToast(`${u.name} 출격!`);

            // [FIX] 재고/공급/쿨타임 UI 즉시 반영
            if (typeof app !== 'undefined') { app.markDirty(); app.markUiDirty(); }
        } else {
            let target = null;
            let minDist = 300;
            const validTargets = [...this.enemies, ...this.enemyBuildings];
            validTargets.forEach(e => {
                const dy = e.y - (e.height ? e.height / 2 : 0) - y;
                const dx = e.x - x;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < minDist) { minDist = d; target = e; }
            });

            if (u.lockOn && !target) { ui.showToast("타겟을 찾을 수 없습니다!"); return; }

            this.supply -= u.cost;
            this.cooldowns[key] = u.cooldown;
            this.playerStock[key]--;

            const drone = new Unit(key, 50, this.groundY, 'player', target);
            if (key === 'blackhawk' || key === 'chinook') {
                drone.x = 40;
                drone.y = this.groundY - 190;
                drone.targetX = x;
                drone.targetY = this.groundY - 190;
            } else if (!target) {
                drone.x = x; drone.y = y;
            }
            this.players.push(drone);
            ui.showToast(`${u.name} 출격!`);

            // [FIX] 재고/공급/쿨타임 UI 즉시 반영
            if (typeof app !== 'undefined') { app.markDirty(); app.markUiDirty(); }
        }
        this.cancelTargeting();
    },

    cancelTargeting() {
        this.targetingType = null;
        document.getElementById('targeting-overlay').classList.add('hidden');
    },

    commandDrones(x, y) {
        let count = 0;
        this.players.forEach(u => {
            if (u.stats.category === 'drone' || u.stats.id.startsWith('drone')) {
                if (['drone_suicide', 'drone_at'].includes(u.stats.id)) {
                    u.swarmTarget = { x: x, y: y };
                    u.lockedTarget = null;
                    count++;
                }
            }
        });
        if (count > 0) {
            ui.showToast(`드론 ${count}기 이동 명령!`);
            this.createParticles(x, y, 10, '#facc15');
        }
    },

    createParticles(x, y, count, color) {
        if (this.particles.length > 200) this.particles.splice(0, count);
        for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
    },

    // [NEW] Building destruction FX + SFX
    spawnBuildingDestructionFX(b) {
        try {
            const kind = (b && String(b.type || '').includes('hq')) ? 'hq' : 'defense';

            // add FX (rendered in world-space via game.particles pipeline)
            if (typeof BuildingDestructionFX !== 'undefined') {
                this.particles.push(new BuildingDestructionFX(b.x, b.y, b.width, b.height, b.team, kind));
            } else {
                // fallback particles
                this.createParticles(b.x, b.y - (b.height || 80) * 0.5, kind === 'hq' ? 40 : 18, '#111');
                this.createParticles(b.x, b.y - (b.height || 80) * 0.5, kind === 'hq' ? 18 : 8, '#fff');
            }

            // small extra sparks
            this.createParticles(b.x, b.y - (b.height || 80) * 0.5, kind === 'hq' ? 12 : 6, '#facc15');

            // sound - building destruction uses boom-2
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('other');
        } catch (e) {
            console.warn('spawnBuildingDestructionFX failed', e);
        }
    },

    // Queue System
    startHold(key) {
        if (!this.running || this.holdTimer) return;
        this.holdKey = key;
        this.queueUnit(key);
        this.holdTimer = setInterval(() => { this.queueUnit(key); }, 150);
    },

    endHold(key) {
        if (this.holdKey !== key) return;
        if (this.holdTimer) { clearInterval(this.holdTimer); this.holdTimer = null; }
        this.holdKey = null;
    },

    queueUnit(key) {
        const u = CONFIG.units[key];

        // Special logic for targeting
        const needsTargeting = ['tactical_drone', 'stealth_drone', 'blackhawk', 'chinook', 'emp', 'nuke', 'tactical_missile'].includes(key);
        if (needsTargeting) {
            // [FIX] Clear holdTimer value so startHold can run again.
            if (this.holdTimer) {
                clearInterval(this.holdTimer);
                this.holdTimer = null;
            }
            this.holdKey = null;

            this.prepareTargeting(key);
            return;
        }

        if (this.supply >= u.cost && this.playerStock[key] > 0) {
            this.supply -= u.cost;
            this.playerStock[key]--;
            this.spawnQueue[key]++;
            // [FIX] 클릭 즉시 UI 갱신
            if (typeof app !== 'undefined') {
                app.markUiDirty();
                app.commit('queueUnit');
            }
        }
    },

    processQueue() {
        for (let key in this.spawnQueue) {
            if (this.spawnQueue[key] > 0) {
                if (this.cooldowns[key] <= 0) {
                    this.spawnUnitExecution(key);
                    this.spawnQueue[key]--;
                    this.cooldowns[key] = CONFIG.units[key].cooldown;
                }
            }
        }
    },

    spawnUnitDirect(key, x, y, team) {
        const unit = new Unit(key, x, y, team);
        if (team === 'player') this.players.push(unit);
        else this.enemies.push(unit);
    },

    spawnEnemy(key) {
        const u = CONFIG.units[key];
        if (this.enemySupply < u.cost || this.enemyCooldowns[key] > 0 || this.enemyStock[key] <= 0) return;
        const hq = this.buildings.find(b => b.type === 'hq_enemy');
        if (!hq) return;

        this.enemySupply -= u.cost;
        this.enemyCooldowns[key] = u.cooldown;
        this.enemyStock[key]--;
        this.spawnUnitDirect(key, hq.x - 50, this.groundY, 'enemy');
    },

    // [New] Speed Control
    speed: 1,
    // HUD
    minimapVisible: true,

    setSpeed(s) {
        this.speed = s;
        // 즉시 UI 갱신(미니맵 아래 버튼 상태)
        if (typeof ui !== 'undefined') ui.updateSpeedBtns(this.speed);
    },

    updateZoomUI() {
        const el = document.getElementById('hud-zoom-text');
        if (el) el.textContent = `${Math.round(Camera.zoom * 100)}%`;
    },

    zoomIn() {
        const wrapper = document.getElementById('game-wrapper');
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const prevZoom = Camera.zoom;
        const newZoom = Camera.zoom + Camera.STEP;
        Camera.applyZoomWithAnchor(this, newZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (Camera.zoom !== prevZoom) this.updateZoomUI();
    },

    zoomOut() {
        const wrapper = document.getElementById('game-wrapper');
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const prevZoom = Camera.zoom;
        const newZoom = Camera.zoom - Camera.STEP;
        Camera.applyZoomWithAnchor(this, newZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (Camera.zoom !== prevZoom) this.updateZoomUI();
    },

    // Minimap open/close
    toggleMinimap() {
        this.minimapVisible = !this.minimapVisible;
        const el = document.getElementById('hud-minimap-container');
        if (el) el.classList.toggle('hidden', !this.minimapVisible);
    },

    loop() {
        if (!this.running) return;

        // [New] Speed Logic
        // 1x: Update once
        // 2x: Update twice
        // 0.5x: Update every other frame

        // [FIX] Use engineFrame to prevent freeze (game.frame only updates inside this.update)
        this.engineFrame = (this.engineFrame || 0) + 1;

        let updates = 1;
        if (this.speed === 2) updates = 2;
        else if (this.speed === 0.5 && this.engineFrame % 2 !== 0) updates = 0;

        try {
            for (let i = 0; i < updates; i++) {
                this.update();
            }
            this.draw();
        } catch (e) {
            console.error("Game Loop Error (Recovered):", e);
        }

        this.loopId = requestAnimationFrame(() => this.loop());
    },

    update() {
        if (this.isGameOver) return;
        this.frame++; // Always increment frame internally? No, frame should track logic ticks.
        // Actually, if we skip update, frame doesn't increment.
        // If we double update, frame increments twice.
        // This is correct for game logic time.

        if (this.supply < CONFIG.maxSupply) this.supply += CONFIG.supplyRate;
        if (this.enemySupply < CONFIG.maxSupply) this.enemySupply += CONFIG.supplyRate;

        this.processQueue();

        for (let k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k]--;
        for (let k in this.enemyCooldowns) if (this.enemyCooldowns[k] > 0) this.enemyCooldowns[k]--;
        if (this.empTimer > 0) {
            this.empTimer--;
            document.getElementById('emp-flash').classList.toggle('active', this.empTimer > 0);
        } else {
            document.getElementById('emp-flash').classList.remove('active');
        }

        this.buildings = this.buildings.filter(b => !b.dead);
        this.playerBuildings = this.buildings.filter(b => b.team === 'player');
        this.enemyBuildings = this.buildings.filter(b => b.team === 'enemy');

        const playerHQ = this.buildings.find(b => b.type === 'hq_player');
        const enemyHQ = this.buildings.find(b => b.type === 'hq_enemy');
        if (!playerHQ) this.endGame('lose', '작전 실패', '아군 본부가 파괴되었습니다.');
        else if (!enemyHQ) this.endGame('win', '작전 성공', '적군 본부를 파괴하고 지역을 장악했습니다.');
        if (this.isGameOver) return;

        this.players.forEach(u => u.update(this.enemies, this.enemyBuildings));
        this.enemies.forEach(u => u.update(this.players, this.playerBuildings));
        this.buildings.forEach(b => b.update(this.enemies, this.players));
        this.projectiles.forEach(p => p.update());
        this.particles.forEach(p => p.update());

        this.players = this.players.filter(u => !u.dead);
        this.enemies = this.enemies.filter(u => !u.dead);
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.particles = this.particles.filter(p => p.life > 0);

        // [VFX] decay
        if (this.shake > 0.01) {
            this.shake *= this.shakeDecay;
            if (this.shake < 0.15) this.shake = 0;
        } else {
            this.shake = 0;
        }
        if (this.flash > 0.01) {
            this.flash *= this.flashDecay;
            if (this.flash < 0.02) this.flash = 0;
        } else {
            this.flash = 0;
        }
        // ✅ 노란색 플래시 decay
        if (this.yellowFlash > 0.01) {
            this.yellowFlash *= this.yellowFlashDecay;
            if (this.yellowFlash < 0.02) this.yellowFlash = 0;
        } else {
            this.yellowFlash = 0;
        }

        if (typeof AI !== 'undefined') AI.update(this.frame);

        // [FIX] 쿨타임/큐가 진행 중이면 매 프레임 UI 갱신 필요
        if (typeof app !== 'undefined') {
            // 쿨타임이 진행 중이거나 큐가 있으면 uiDirty
            const hasCooldown = Object.values(this.cooldowns).some(v => v > 0);
            const hasQueue = Object.values(this.spawnQueue).some(v => v > 0);
            if (hasCooldown || hasQueue) {
                app.markUiDirty();
            }
        }

        if (this.frame % 5 === 0) {
            this.renderUI();
            this.drawHUDMinimap();
        }
    },

    renderUI() {
        // [CHANGE][APP] UI 갱신 경로 단일화
        // - 기존: ui.updateUnitButtons(), ui.setSkillCount() ... 분산 호출
        // - 변경: app.commit() 한 번에서만 UI + 저장 처리
        if (typeof app !== 'undefined') app.commit('tick');
    },

    draw() {
        const ctx = this.ctx;
        // [FIX][ZOOM-ARTIFACT] always clear whole screen in screen-space
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(0, 0, this.width, this.height);

        if (typeof Maps !== 'undefined') {
            // 1) Base sky/ground stays in screen space
            Maps.drawBase(ctx, this.width, this.height, this.groundY);

            // 2) Decorations draw in zoomed world space
            ctx.save();
            ctx.translate(0, this.groundY);
            ctx.scale(Camera.zoom, Camera.zoom);
            ctx.translate(0, -this.groundY);

            Maps.drawDecorations(
                ctx,
                this.width / Camera.zoom,
                this.height / Camera.zoom,
                this.groundY,
                this.cameraX
            );

            ctx.restore();
        }

        ctx.save();
        ctx.translate(0, this.groundY);
        ctx.scale(Camera.zoom, Camera.zoom);
        ctx.translate(0, -this.groundY);
        ctx.translate(-Math.floor(this.cameraX), 0);

        // [VFX] world-layer shake (screen 기준 고정)
        if (this.shake > 0.01) {
            const j = this.shake / Math.max(0.01, Camera.zoom);
            ctx.translate((Math.random() - 0.5) * j * 2, (Math.random() - 0.5) * j * 2);
        }
        this.buildings.forEach(b => b.draw(ctx));
        this.enemies.forEach(u => u.draw(ctx));
        this.players.forEach(u => u.draw(ctx));
        this.projectiles.forEach(p => p.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        ctx.restore();

        // [VFX] screen flash (screen-space)
        if (this.flash > 0.01) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = `rgba(255,255,255,${this.flash})`;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
        }

        // ✅ 노란색 플래시 (핵 경고용)
        if (this.yellowFlash > 0.01) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = `rgba(255,220,0,${this.yellowFlash})`;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
        }


        if (!document.getElementById('map-modal').classList.contains('hidden')) this.drawHUDMinimap(); // Legacy support
    },

    toggleScope() {
        const modal = document.getElementById('scope-modal');
        modal.classList.toggle('hidden');
        ui.updateEnemyStatus(this.enemyStock);
    },

    toggleMap() {
        // Replaced by HUD
    },

    drawHUD() {
        const ctx = this.ctx;
        // 모바일 가로 모드인지 체크
        const isMobileLandscape = window.innerHeight < 600 && window.innerWidth > window.innerHeight;

        const fontSize = (this.width < 800) ? 16 : 24;
        const padding = (this.width < 800) ? 10 : 20;

        ctx.save();
        ctx.font = `bold ${fontSize}px "Orbitron", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;

        // [변경] 자원(SUPPLY) 표시 위치
        // 모바일 가로 모드면 -> 왼쪽 하단 (Bottom Left)
        // 그 외(PC/세로) -> 왼쪽 상단 (Top Left)
        let supplyX = padding;
        let supplyY = padding;

        if (isMobileLandscape) {
            supplyX = padding;
            supplyY = this.height - padding - 40; // 바닥에서 조금 위
        }

        // 1. Supply Text
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'left';
        ctx.fillText(`SUPPLY: ${Math.floor(this.supply)}`, supplyX, supplyY);

        // Supply Bar (Text 아래에)
        const barW = (this.width < 800) ? 100 : 150;
        const barH = (this.width < 800) ? 4 : 6;
        const ratio = Math.min(1, this.supply / CONFIG.maxSupply);

        ctx.fillStyle = '#4b5563';
        ctx.fillRect(supplyX, supplyY + fontSize + 5, barW, barH);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(supplyX, supplyY + fontSize + 5, barW * ratio, barH);

        // 2. Kill Count (오른쪽 상단 유지)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`KILLS: ${this.killCount || 0}`, this.width - padding, padding);

        // 3. Time (중앙 상단 유지)
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        const time = Math.floor(this.frame / 60);
        const min = Math.floor(time / 60).toString().padStart(2, '0');
        const sec = (time % 60).toString().padStart(2, '0');
        ctx.fillText(`${min}:${sec}`, this.width / 2, padding);

        ctx.restore();
    },

    drawHUDMinimap() {
        const cvs = document.getElementById('hud-minimap');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (cvs.width !== cvs.clientWidth) { cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight; }

        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, cvs.width, cvs.height);
        const scale = cvs.width / CONFIG.mapWidth;
        const groundY = cvs.height * 0.7;

        ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(cvs.width, groundY); ctx.stroke();

        this.buildings.forEach(b => {
            ctx.fillStyle = b.team === 'player' ? '#3b82f6' : (b.team === 'enemy' ? '#ef4444' : '#eab308');
            const w = Math.max(2, b.width * scale);
            const h = Math.max(2, b.height * scale);
            ctx.fillRect(b.x * scale - w / 2, groundY - h, w, h);
        });

        ctx.fillStyle = '#60a5fa'; this.players.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));
        ctx.fillStyle = '#f87171'; this.enemies.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));

        const cw = (Camera.viewW(this) / CONFIG.mapWidth) * cvs.width;
        const cx = (this.cameraX / CONFIG.mapWidth) * cvs.width;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.strokeRect(cx, 0, cw, cvs.height);
    },

    endGame(result, title, desc) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        const s = document.getElementById('end-screen');
        s.classList.remove('hidden'); s.style.display = 'flex';
        document.getElementById('end-title').innerText = title;
        document.getElementById('end-title').className = `text-5xl font-bold mb-4 ${result === 'win' ? 'text-blue-500' : 'text-red-500'}`;
        document.getElementById('end-desc').innerText = desc;
    }
};

// ================================
// [ADD][APP] Minimal App Layer
// - commit() = 단일 갱신(저장 + UI)
// - migrate() = 스키마 고정 + 자동 보정
// - API = 앞으로 상태 변경은 app.* 로만 통과시키는 "확증형 슬롯"
// ================================
const app = {
    STORAGE_KEY: 'CT_STATE_V1',
    BACKUP_KEY_1: 'CT_STATE_V1_BAK1',
    BACKUP_KEY_2: 'CT_STATE_V1_BAK2',
    SCHEMA_VERSION: 1,

    _dirty: true,
    _uiDirty: true,
    _lastSaveAt: 0,

    // ---- (1) 스냅샷 생성 (최소: 설정/통계만) ----
    _makeState() {
        const diff = (typeof AI !== 'undefined' && AI.difficulty) ? AI.difficulty : 'veteran';
        // lastMapId는 현재 코드에 "선택한 맵 id" 변수가 있으면 연결하고, 없으면 null
        const lastMapId = game.currentMapId || null;

        return {
            version: this.SCHEMA_VERSION,
            settings: {
                speed: Number(game.speed) || 1,
                difficulty: String(diff || 'veteran'),
                lastMapId: lastMapId ? String(lastMapId) : null,
            },
            stats: {
                killCount: Number(game.killCount) || 0,
            }
        };
    },

    // ---- (2) 마이그레이션(자동 보정) ----
    migrate(raw) {
        // raw가 null/undefined면 새로 생성
        if (!raw || typeof raw !== 'object') raw = { version: 0 };

        const v = Number(raw.version) || 0;

        // v0 -> v1 보정
        if (v < 1) {
            raw.version = 1;
            raw.settings = raw.settings || {};
            raw.stats = raw.stats || {};
        }

        // 타입/누락 보정
        if (!raw.settings || typeof raw.settings !== 'object') raw.settings = {};
        if (!raw.stats || typeof raw.stats !== 'object') raw.stats = {};

        const sp = Number(raw.settings.speed);
        raw.settings.speed = Number.isFinite(sp) ? sp : 1;

        raw.settings.difficulty = (typeof raw.settings.difficulty === 'string' && raw.settings.difficulty)
            ? raw.settings.difficulty
            : 'veteran';

        raw.settings.lastMapId = (raw.settings.lastMapId == null)
            ? null
            : String(raw.settings.lastMapId);

        const kc = Number(raw.stats.killCount);
        raw.stats.killCount = Number.isFinite(kc) ? kc : 0;

        raw.version = 1;
        return raw;
    },

    // ---- (3) 로드/세이브 ----
    load() {
        const tryParse = (key) => {
            try {
                const s = localStorage.getItem(key);
                if (!s) return null;
                const parsed = JSON.parse(s);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (e) { }
            return null;
        };

        // 1. 메인 저장 시도
        let data = tryParse(this.STORAGE_KEY);
        if (data) return this.migrate(data);

        // 2. BAK1 복구 시도
        data = tryParse(this.BACKUP_KEY_1);
        if (data) {
            console.warn('[APP] Main save corrupted, restored from BAK1');
            return this.migrate(data);
        }

        // 3. BAK2 복구 시도
        data = tryParse(this.BACKUP_KEY_2);
        if (data) {
            console.warn('[APP] Main save corrupted, restored from BAK2');
            return this.migrate(data);
        }

        // 4. 전부 실패 → 초기화
        return this.migrate(null);
    },

    saveNow() {
        try {
            // 롤링 백업: 현재 BAK1 → BAK2로, 현재 STATE → BAK1으로
            const currentBak1 = localStorage.getItem(this.BACKUP_KEY_1);
            if (currentBak1) {
                localStorage.setItem(this.BACKUP_KEY_2, currentBak1);
            }
            const currentState = localStorage.getItem(this.STORAGE_KEY);
            if (currentState) {
                localStorage.setItem(this.BACKUP_KEY_1, currentState);
            }

            // 새 상태 저장
            const state = this._makeState();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
            this._lastSaveAt = performance.now ? performance.now() : Date.now();
        } catch (e) {
            // localStorage 불가 환경이면 조용히 무시
        }
    },

    // ---- (4) 게임에 적용(최소: speed/difficulty/lastMapId) ----
    loadIntoGame() {
        const st = this.load();

        // speed 적용
        if (st.settings && Number.isFinite(st.settings.speed)) {
            game.setSpeed(st.settings.speed); // 내부에서 ui 버튼도 갱신됨
        }

        // difficulty는 AI가 가지고 있으면 반영
        if (typeof AI !== 'undefined' && st.settings && typeof st.settings.difficulty === 'string') {
            AI.difficulty = st.settings.difficulty;
        }

        // lastMapId(있으면) 보관만 해둠 (현재 코드에서 map선택 로직이 있으면 연결 가능)
        if (st.settings && st.settings.lastMapId) {
            game.currentMapId = st.settings.lastMapId;
        }

        this._dirty = true;
    },

    // ---- (5) Dirty + 단일 갱신(commit) ----
    markDirty() { this._dirty = true; },
    markUiDirty() { this._uiDirty = true; },

    commit(reason = '') {
        const wasDirty = this._dirty;
        const wasUiDirty = this._uiDirty;
        this._dirty = false;
        this._uiDirty = false;

        // UI 갱신은 uiDirty일 때만
        if (wasUiDirty) {
            ui.updateCategoryTab(game.currentCategory);
            ui.updateUnitButtons(game.currentCategory, game.playerStock, game.cooldowns, game.supply, game.spawnQueue);
            ui.setSkillCount('emp', game.skillCharges.emp);
            ui.setSkillCount('nuke', game.skillCharges.nuke);
            ui.updateSpeedBtns(game.speed);
        }

        if (!wasDirty) return;

        // Save state at most once per second
        const now = performance.now ? performance.now() : Date.now();
        if (now - this._lastSaveAt > 1000) this.saveNow();
    },

    // ---- (6) 확증형 슬롯(App API) 최소 제공 ----
    setSpeed(s) {
        game.setSpeed(s);
        this.markDirty();
        this.markUiDirty();
    },
    addSupply(n) {
        const v = Number(n) || 0;
        game.supply = Math.max(0, (Number(game.supply) || 0) + v);
        this.markDirty();
        this.markUiDirty();
    },
    spendSupply(n) {
        const v = Number(n) || 0;
        game.supply = Math.max(0, (Number(game.supply) || 0) - v);
        this.markDirty();
        this.markUiDirty();
    },
    spawnUnitDirect(key, x, team) {
        // 앞으로는 game.spawnUnitDirect 직접 호출 대신 이걸로 통과시키면 됨
        game.spawnUnitDirect(key, x, game.groundY, team);
        this.markDirty();
    }
};

window.onload = () => game.init();

