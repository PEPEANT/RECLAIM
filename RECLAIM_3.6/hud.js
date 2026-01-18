/**
 * hud.js - Fixed Bottom HUD (StarCraft-style)
 *
 * 핵심 원칙:
 * - HUD는 "표시 + 버튼 트리거"만 담당
 * - 실제 행동은 기존 시스템(game, unit_commands)이 수행
 * - 선택 소스는 game 1개, HUD는 표시만
 */

const HUD = {
    // State
    initialized: false,
    isPortrait: false,
    wasRunningBeforePortrait: false,

    // DOM References (cached)
    elements: {
        footer: null,
        portraitOverlay: null,
        minimapCanvas: null,
        minimapWrapper: null,
        selectionInfo: null,
        productionArea: null,
        commandGrid: null,
        zoomDisplay: null
    },

    /**
     * Initialize HUD
     * Called from game.init() after ui.init()
     */
    init() {
        if (this.initialized) return;

        // Cache DOM elements
        this.elements.footer = document.getElementById('hud-footer');
        this.elements.portraitOverlay = document.getElementById('portrait-overlay');
        this.elements.minimapCanvas = document.getElementById('hud-minimap-new');
        this.elements.minimapWrapper = document.getElementById('hud-minimap-wrapper');
        this.elements.selectionInfo = document.getElementById('hud-selection-info');
        this.elements.productionArea = document.getElementById('hud-production-area');
        this.elements.commandGrid = document.getElementById('hud-command-grid');
        this.elements.zoomDisplay = document.getElementById('hud-zoom-display');

        // Setup input blocking (critical for touch devices)
        this.setupInputBlocking();

        // Setup portrait mode detection
        this.setupPortraitDetection();

        // Setup HUD controls (speed, zoom)
        this.setupControls();

        // Setup command buttons
        this.setupCommandButtons();

        // Setup minimap interaction
        this.setupMinimap();

        // Cache unit panel for HQ production embedding
        this.elements.unitPanel = document.getElementById('unit-panel-container');
        if (this.elements.unitPanel) {
            this.elements.unitPanelOriginalParent = this.elements.unitPanel.parentElement;
            this.elements.unitPanelOriginalNextSibling = this.elements.unitPanel.nextSibling;
            // [FIX] Hide production UI on boot to prevent it from showing before HQ is selected
            this.elements.unitPanel.style.display = 'none';
        }

        // Cache additional elements for building label feature
        this.elements.infoArea = document.getElementById('hud-info-area');
        this.elements.buildingLabel = document.getElementById('hud-building-label');

        // [FIX] Force hide production area on init
        this.updateProductionArea();

        this.initialized = true;
        console.log('[HUD] Initialized');
    },

    /**
     * CRITICAL: Block HUD input from reaching game canvas
     * - Bubble phase only (no capture) so buttons receive events first
     * - Interactive elements (buttons, inputs) are not blocked
     */
    setupInputBlocking() {
        const footer = this.elements.footer;
        if (!footer) return;

        const isInteractiveTarget = (e) => {
            const t = e.target;
            if (!t || !t.closest) return false;
            return !!t.closest('button, a, input, select, textarea, [data-hud-cmd], [data-speed], [data-zoom]');
        };

        const blockEvent = (e) => {
            // Bubble phase only - stop propagation to game canvas
            e.stopPropagation();
        };

        const blockAndPrevent = (e) => {
            e.stopPropagation();
            // Don't preventDefault on interactive elements (prevents mobile button clicks)
            if (!isInteractiveTarget(e)) e.preventDefault();
        };

        // Touch events (passive:false required for preventDefault)
        footer.addEventListener('touchstart', blockAndPrevent, { passive: false });
        footer.addEventListener('touchmove', blockAndPrevent, { passive: false });
        footer.addEventListener('touchend', blockAndPrevent, { passive: false });

        // Mouse / Pointer events (no capture - bubble phase only)
        footer.addEventListener('mousedown', blockEvent);
        footer.addEventListener('mousemove', blockEvent);
        footer.addEventListener('mouseup', blockEvent);
        footer.addEventListener('pointerdown', blockEvent);
        footer.addEventListener('pointermove', blockEvent);
        footer.addEventListener('pointerup', blockEvent);
        footer.addEventListener('wheel', blockAndPrevent, { passive: false });
        footer.addEventListener('contextmenu', blockAndPrevent, { passive: false });

        // Click doesn't need blocking - canvas is sibling, not ancestor
        console.log('[HUD] Input blocking enabled');
    },

    /**
     * [MODIFIED] Portrait mode detection - NO LONGER PAUSES GAME
     * Game continues to run in both portrait and landscape modes
     */
    setupPortraitDetection() {
        const checkOrientation = () => {
            const isPortrait = window.innerHeight > window.innerWidth;
            this.isPortrait = isPortrait;

            // [REMOVED] No longer pause/resume game based on orientation
            // Game runs in both modes now

            // Just log for debugging
            if (isPortrait) {
                console.log('[HUD] Portrait mode detected - game continues');
            }
        };

        // Check on resize and orientation change
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', () => {
            setTimeout(checkOrientation, 100);
        });

        // Initial check
        checkOrientation();
    },

    /**
     * Setup speed and zoom controls
     */
    setupControls() {
        // Speed buttons
        const speedBtns = document.querySelectorAll('[data-speed]');
        speedBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const speed = parseFloat(btn.dataset.speed);
                game.setSpeed(speed);
                this.updateSpeedButtons(speed);
            });
        });

        // Zoom buttons
        const zoomIn = document.getElementById('hud-btn-zoom-in');
        const zoomOut = document.getElementById('hud-btn-zoom-out');

        if (zoomIn) {
            zoomIn.addEventListener('click', (e) => {
                e.stopPropagation();
                game.zoomIn();
                this.updateZoomDisplay();
            });
        }

        if (zoomOut) {
            zoomOut.addEventListener('click', (e) => {
                e.stopPropagation();
                game.zoomOut();
                this.updateZoomDisplay();
            });
        }
    },

    /**
     * Setup command buttons (connect to existing command system)
     */
    setupCommandButtons() {
        const cmdBtns = document.querySelectorAll('[data-hud-cmd]');

        cmdBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cmd = btn.dataset.hudCmd;

                // Check if any units are selected
                if (!game.selectedUnits || game.selectedUnits.size === 0) {
                    if (cmd !== 'clear') {
                        ui.showToast('유닛을 먼저 선택하세요');
                        return;
                    }
                }

                // Use existing command system from unit_commands.js
                if (cmd === 'clear') {
                    if (game.clearAllSelection) {
                        game.clearAllSelection();
                    }
                } else {
                    // Apply command to selected units
                    game.selectedUnits.forEach(u => {
                        if (!u.dead) {
                            u.commandMode = cmd;
                            u.returnToBase = (cmd === 'retreat');
                        }
                    });

                    // Show feedback
                    const cmdNames = { stop: '정지', attack: '공격', retreat: '후퇴' };
                    ui.showToast(`${game.selectedUnits.size}개 유닛: ${cmdNames[cmd] || cmd} 명령`);
                }

                // Visual feedback
                cmdBtns.forEach(b => b.classList.remove('active'));
                if (cmd !== 'clear') {
                    btn.classList.add('active');
                }

                // Update HUD selection display (may change after clear)
                game.updateHUDSelection();
            });
        });
    },

    /**
     * Update command button states based on selection
     */
    updateCommandButtons() {
        const cmdBtns = document.querySelectorAll('[data-hud-cmd]');
        const hasSelection = game.selectedUnits && game.selectedUnits.size > 0;

        cmdBtns.forEach(btn => {
            const cmd = btn.dataset.hudCmd;
            // Clear button always enabled, others depend on selection
            if (cmd === 'clear') {
                btn.disabled = false;
                btn.classList.remove('disabled');
            } else {
                btn.disabled = !hasSelection;
                btn.classList.toggle('disabled', !hasSelection);
            }
        });
    },

    /**
     * Setup minimap click-to-move (with pointer capture to prevent drag leak)
     */
    setupMinimap() {
        const minimap = this.elements.minimapCanvas;
        const wrapper = this.elements.minimapWrapper;
        if (!minimap || !wrapper) return;

        let isDragging = false;
        let miniPointerId = null;

        const handleMinimapClick = (clientX, clientY) => {
            const rect = minimap.getBoundingClientRect();
            const x = clientX - rect.left;
            const ratio = x / rect.width;
            game.cameraX = (ratio * CONFIG.mapWidth) - (Camera.viewW(game) / 2);
            game.cameraX = Camera.clampCameraX(game, game.cameraX);
        };

        const endMiniDrag = (e) => {
            if (!isDragging) return;
            isDragging = false;
            if (miniPointerId !== null) {
                try { wrapper.releasePointerCapture(miniPointerId); } catch { }
            }
            miniPointerId = null;
        };

        // Pointer events (unified mouse + touch with capture)
        wrapper.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
            miniPointerId = e.pointerId;
            wrapper.setPointerCapture(e.pointerId);
            handleMinimapClick(e.clientX, e.clientY);
        });

        wrapper.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            if (miniPointerId !== null && e.pointerId !== miniPointerId) return;
            handleMinimapClick(e.clientX, e.clientY);
            e.preventDefault();
        });

        wrapper.addEventListener('pointerup', endMiniDrag);
        wrapper.addEventListener('pointercancel', endMiniDrag);
        wrapper.addEventListener('pointerleave', endMiniDrag);
    },

    /**
     * Show HUD (called when game starts)
     */
    show() {
        if (this.elements.footer) {
            this.elements.footer.classList.remove('hidden');
        }
        this.updateSpeedButtons(game.speed);
        this.updateZoomDisplay();
        this.hideLegacyUI();
    },

    /**
     * Hide HUD (called when returning to lobby)
     */
    hide() {
        if (this.elements.footer) {
            this.elements.footer.classList.add('hidden');
        }
    },

    /**
     * Update selection display
     * Called from game when selection changes
     *
     * @param {Object|null} selection - { kind: 'unit'|'building'|'multi', data: ... }
     */
    setSelection(selection) {
        const info = this.elements.selectionInfo;
        if (!info) return;

        this.selection = selection;

        if (!selection) {
            // No selection
            info.innerHTML = '<span class="hud-placeholder-text">유닛/건물을 선택</span>';
            this.updateProductionArea();
            this.updateCommandButtons();
            return;
        }

        if (selection.kind === 'unit') {
            // [NEW] 작업자 선택 시 프로필 박스 + 라벨 표시
            if (this.checkWorkerSelected()) {
                info.innerHTML = `
                    <div class="hud-worker-profile" style="display: flex; align-items: center; gap: 8px;">
                        <div class="hud-worker-avatar" style="width: 36px; height: 36px; border: 2px solid #facc15; border-radius: 4px; background: #1e293b; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 18px; color: #facc15;">👷</span>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: bold; color: #facc15; font-size: 13px;">작업자</span>
                            <span style="color: #94a3b8; font-size: 10px;">건설</span>
                        </div>
                    </div>
                `;
            } else {
                info.innerHTML = `
                    <div class="hud-selection-item">
                        <span class="hud-selection-type">유닛</span>
                        <span class="hud-selection-name">${selection.name}</span>
                    </div>
                `;
            }
        } else if (selection.kind === 'building') {
            // HQ (player base): minimal text to save space for production UI
            const isHQ = (selection.name === 'hq_player' && selection.team === 'player');
            if (isHQ) {
                info.innerHTML = '<span class="hud-placeholder-text">본부</span>';
            } else {
                info.innerHTML = `
                    <div class="hud-selection-item">
                        <span class="hud-selection-type">건물</span>
                        <span class="hud-selection-name">${selection.name}</span>
                    </div>
                `;
            }
        } else if (selection.kind === 'multi') {
            // [NEW] 다중 선택 시 작업자 포함 여부 확인
            if (this.checkWorkerSelected()) {
                info.innerHTML = `
                    <div class="hud-worker-profile" style="display: flex; align-items: center; gap: 8px;">
                        <div class="hud-worker-avatar" style="width: 36px; height: 36px; border: 2px solid #facc15; border-radius: 4px; background: #1e293b; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 18px; color: #facc15;">👷</span>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: bold; color: #facc15; font-size: 13px;">작업자</span>
                            <span style="color: #94a3b8; font-size: 10px;">건설</span>
                        </div>
                    </div>
                `;
            } else {
                info.innerHTML = `<span style="color: #22c55e; font-weight: bold;">${selection.count}개 유닛 선택됨</span>`;
            }
        }

        this.updateProductionArea();
        this.updateCommandButtons();
    },

    /**
     * Update production area (embed legacy unit panel when HQ is selected)
     */
    updateProductionArea() {
        const productionArea = this.elements.productionArea;
        const unitPanel = this.elements.unitPanel;
        const footer = this.elements.footer;
        const infoArea = this.elements.infoArea;
        const buildingLabel = this.elements.buildingLabel;
        if (!productionArea || !unitPanel) return;

        // [NEW] 작업자 선택 시 건물 버튼 표시
        const hasWorkerSelected = this.checkWorkerSelected();
        if (hasWorkerSelected) {
            this.showBuildButtons(productionArea, footer, buildingLabel);
            return;
        }

        // [NEW] 건물 선택 시 해당 건물의 생산 탭 표시
        const selectedBuilding = this.getSelectedProductionBuilding();
        if (selectedBuilding) {
            this.showProductionBuildingUI(selectedBuilding, productionArea, footer, buildingLabel);
            return;
        }

        // HQ는 작업자만 생산 가능 (보병/전차 탭은 건물로 이동)
        const isHQ = this.selection &&
            this.selection.kind === 'building' &&
            this.selection.name === 'hq_player' &&
            this.selection.team === 'player';

        if (isHQ) {
            // HQ 선택: 작업자 생산 버튼만 표시
            this.showHQWorkerButton(productionArea, footer, buildingLabel);
        } else {
            // Return unit panel to original location and hide
            const parent = this.elements.unitPanelOriginalParent;
            const next = this.elements.unitPanelOriginalNextSibling;
            if (parent && !parent.contains(unitPanel)) {
                if (next && next.parentNode === parent) {
                    parent.insertBefore(unitPanel, next);
                } else {
                    parent.appendChild(unitPanel);
                }
            }
            unitPanel.style.display = 'none';

            // [FIX] Remove state class from footer
            if (footer) footer.classList.remove('hud-show-production');
            if (buildingLabel) buildingLabel.textContent = '';
        }
    },

    /**
     * Update speed button states
     */
    updateSpeedButtons(speed) {
        document.querySelectorAll('[data-speed]').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
        });
    },

    /**
     * Update zoom display
     */
    updateZoomDisplay() {
        if (this.elements.zoomDisplay) {
            this.elements.zoomDisplay.textContent = `${Math.round(Camera.zoom * 100)}%`;
        }
    },

    /**
     * Draw minimap (called from game.update)
     * Uses the new HUD minimap canvas
     */
    drawMinimap() {
        const cvs = this.elements.minimapCanvas;
        if (!cvs || !game.running) return;

        const ctx = cvs.getContext('2d');
        if (cvs.width !== cvs.clientWidth || cvs.height !== cvs.clientHeight) {
            cvs.width = cvs.clientWidth;
            cvs.height = cvs.clientHeight;
        }

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cvs.width, cvs.height);

        const scale = cvs.width / CONFIG.mapWidth;
        const groundY = cvs.height * 0.7;

        // Ground line
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(cvs.width, groundY);
        ctx.stroke();

        // Buildings
        game.buildings.forEach(b => {
            ctx.fillStyle = b.team === 'player' ? '#3b82f6' : (b.team === 'enemy' ? '#ef4444' : '#eab308');
            const w = Math.max(2, b.width * scale);
            const h = Math.max(2, b.height * scale);
            ctx.fillRect(b.x * scale - w / 2, groundY - h, w, h);
        });

        // Units
        ctx.fillStyle = '#60a5fa';
        game.players.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));

        ctx.fillStyle = '#f87171';
        game.enemies.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));

        // Camera viewport
        const cw = (Camera.viewW(game) / CONFIG.mapWidth) * cvs.width;
        const cx = (game.cameraX / CONFIG.mapWidth) * cvs.width;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, 0, cw, cvs.height);
    },

    // ============================================
    // [NEW] 작업자 건설 버튼 관련 함수
    // ============================================
    checkWorkerSelected() {
        if (!game.selectedUnits || game.selectedUnits.size === 0) return false;
        for (const u of game.selectedUnits) {
            if (u.stats && u.stats.isBuilder && u.team === 'player' && !u.dead) {
                return true;
            }
        }
        return false;
    },

    getSelectedWorker() {
        if (!game.selectedUnits) return null;
        for (const u of game.selectedUnits) {
            if (u.stats && u.stats.isBuilder && u.team === 'player' && !u.dead) {
                return u;
            }
        }
        return null;
    },

    // [NEW] HQ에서 작업자 생산 버튼 표시
    showHQWorkerButton(productionArea, footer, buildingLabel) {
        if (!productionArea) return;

        const workerData = CONFIG.units.worker;
        if (!workerData) return;

        productionArea.innerHTML = '';

        const btnContainer = document.createElement('div');
        btnContainer.className = 'flex gap-2 items-center';
        btnContainer.style.cssText = 'padding: 4px;';

        // 작업자 생산 버튼
        const btn = document.createElement('button');
        btn.className = 'prod-btn flex flex-col items-center justify-center px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white text-xs transition-all';
        btn.style.cssText = 'min-width: 80px;';

        const canAfford = game.supply >= workerData.cost;
        const inStock = (game.playerStock.worker || 0) > 0;
        const onCooldown = (game.cooldowns.worker || 0) > 0;

        if (!canAfford || !inStock || onCooldown) {
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        const stockCount = game.playerStock.worker || 0;
        btn.innerHTML = `
            <span class="font-bold text-sm" style="color: ${workerData.color}">${workerData.name}</span>
            <span class="text-yellow-400">${workerData.cost}</span>
            <span class="text-gray-300 text-xs">${stockCount}명</span>
        `;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (canAfford && inStock && !onCooldown) {
                // HQ에서 작업자 스폰
                const hq = game.buildings.find(b => b.type === 'hq_player');
                if (hq) {
                    game.supply -= workerData.cost;
                    game.playerStock.worker--;
                    game.cooldowns.worker = workerData.cooldown;
                    game.spawnUnitDirect('worker', hq.x + 60, game.groundY, 'player');
                    ui.showToast('작업자 생산!');
                }
            } else if (onCooldown) {
                ui.showToast('쿨타임 중!');
            } else if (!inStock) {
                ui.showToast('재고 없음!');
            } else {
                ui.showToast('자원 부족!');
            }
        });

        btnContainer.appendChild(btn);

        // 안내 텍스트
        const hint = document.createElement('span');
        hint.className = 'text-gray-400 text-xs ml-2';
        hint.textContent = '작업자로 건물 건설';
        btnContainer.appendChild(hint);

        productionArea.appendChild(btnContainer);

        if (footer) footer.classList.add('hud-show-production');
        if (buildingLabel) buildingLabel.textContent = '본부';
    },

    // [NEW] 선택된 생산 건물 가져오기
    getSelectedProductionBuilding() {
        if (!this.selection || this.selection.kind !== 'building') return null;
        if (!game.selectedBuilding) return null;

        const b = game.selectedBuilding;
        // canProduce 플래그가 있는 건물만 (보병막사, 전차기지)
        if (b.canProduce && b.productionTab && b.team === 'player') {
            return b;
        }
        return null;
    },

    // [NEW] 생산 건물 UI 표시
    showProductionBuildingUI(building, productionArea, footer, buildingLabel) {
        if (!productionArea) return;

        const tab = building.productionTab; // 'infantry' or 'armored'
        const bData = CONFIG.constructable[building.type];
        const buildingName = bData ? bData.name : building.type;

        // 해당 탭의 유닛 목록 가져오기
        const units = CONFIG.units;
        const tabUnits = [];

        for (const key in units) {
            const u = units[key];
            if (u.category === tab && !u.isBuilder && !u.isSkill) {
                tabUnits.push({ key, data: u });
            }
        }

        // 기존 내용 지우고 생산 버튼 생성
        productionArea.innerHTML = '';

        const btnContainer = document.createElement('div');
        btnContainer.className = 'flex gap-2 items-center overflow-x-auto';
        btnContainer.style.cssText = 'padding: 4px; max-width: 100%;';

        for (const { key, data } of tabUnits) {
            const btn = document.createElement('button');
            btn.className = 'prod-btn flex flex-col items-center justify-center px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white text-xs transition-all';
            btn.style.cssText = 'min-width: 60px;';

            const canAfford = game.supply >= data.cost;
            const inStock = (game.playerStock[key] || 0) > 0;
            const onCooldown = (game.cooldowns[key] || 0) > 0;

            if (!canAfford || !inStock || onCooldown) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            const stockCount = game.playerStock[key] || 0;
            btn.innerHTML = `
                <span class="font-bold text-xs" style="color: ${data.color}">${data.name}</span>
                <span class="text-yellow-400 text-[10px]">${data.cost}</span>
                <span class="text-gray-300 text-[10px]">${stockCount}대</span>
            `;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (canAfford && inStock && !onCooldown) {
                    // 건물에서 유닛 스폰
                    this.spawnFromBuilding(building, key);
                } else if (onCooldown) {
                    ui.showToast('쿨타임 중!');
                } else if (!inStock) {
                    ui.showToast('재고 없음!');
                } else {
                    ui.showToast('자원 부족!');
                }
            });

            btnContainer.appendChild(btn);
        }

        productionArea.appendChild(btnContainer);

        // 상태 표시
        if (footer) footer.classList.add('hud-show-production');
        if (buildingLabel) buildingLabel.textContent = buildingName;
    },

    // [NEW] 건물에서 유닛 스폰
    spawnFromBuilding(building, unitKey) {
        const uData = CONFIG.units[unitKey];
        if (!uData) return;

        // 재고 및 자원 확인
        if ((game.playerStock[unitKey] || 0) <= 0) {
            ui.showToast('재고 없음!');
            return;
        }
        if (game.supply < uData.cost) {
            ui.showToast('자원 부족!');
            return;
        }
        if ((game.cooldowns[unitKey] || 0) > 0) {
            ui.showToast('쿨타임 중!');
            return;
        }

        // 자원 소모 및 재고 감소
        game.supply -= uData.cost;
        game.playerStock[unitKey]--;
        game.cooldowns[unitKey] = uData.cooldown;

        // 건물 옆에서 스폰 (건물 오른쪽 + 약간의 오프셋)
        const spawnX = building.x + building.width / 2 + 30;
        const spawnY = game.groundY;

        game.spawnUnitDirect(unitKey, spawnX, spawnY, 'player');

        ui.showToast(`${uData.name} 생산!`);
    },

    showBuildButtons(productionArea, footer, buildingLabel) {
        if (!productionArea) return;

        // 건설 가능한 건물 목록
        const buildings = CONFIG.constructable || {};
        const worker = this.getSelectedWorker();

        // 기존 내용 지우고 건물 버튼 생성
        productionArea.innerHTML = '';

        const btnContainer = document.createElement('div');
        btnContainer.className = 'flex gap-2 items-center';
        btnContainer.style.cssText = 'padding: 4px;';

        for (const key in buildings) {
            const bData = buildings[key];

            const btn = document.createElement('button');
            btn.className = 'build-btn flex flex-col items-center justify-center px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white text-xs transition-all';
            btn.style.cssText = 'min-width: 70px;';

            const canAfford = game.supply >= bData.cost;
            const onCooldown = game.builderCooldown > 0;

            if (!canAfford || onCooldown) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            // [FIX] 돈 이모티콘 제거, 텍스트만 표시
            btn.innerHTML = `
                <span class="font-bold text-sm">${bData.name}</span>
                <span class="text-yellow-400">${bData.cost}</span>
            `;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (worker && canAfford && !onCooldown) {
                    game.enterBuildMode(key, worker);
                } else if (onCooldown) {
                    ui.showToast('건설 쿨타임 중!');
                } else if (!canAfford) {
                    ui.showToast('자원 부족!');
                }
            });

            btnContainer.appendChild(btn);
        }

        // 취소 버튼 (건설 모드 중일 때만)
        if (game.buildMode && game.buildMode.active) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'px-3 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold';
            cancelBtn.innerText = '취소';
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                game.cancelBuildMode();
            });
            btnContainer.appendChild(cancelBtn);
        }

        productionArea.appendChild(btnContainer);

        // 상태 표시
        if (footer) footer.classList.add('hud-show-production');
        if (buildingLabel) buildingLabel.textContent = '작업자 - 건설';
    },

    /**
     * Hide legacy UI elements (replaced by new HUD)
     */
    hideLegacyUI() {
        // Hide old minimap/toggle/ctrl/cmd/options buttons
        ['hud-minimap-container', 'hud-minimap-toggle', 'hud-ctrl-wrapper', 'unit-cmd-wrapper', 'hud-option-btn']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });

        // Hide old top-left buttons row (enemy analysis button etc.) but keep toast
        const overlay = document.getElementById('hud-overlay');
        if (overlay) {
            const legacyRow = overlay.querySelector(':scope > .flex.justify-between');
            if (legacyRow) legacyRow.style.display = 'none';
        }
    }
};

// Export for global access
window.HUD = HUD;
