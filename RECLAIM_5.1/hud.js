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
            // [3.8] Unit panel always visible from game start
            this.elements.unitPanel.style.display = 'flex';
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
            return !!t.closest('button, a, input, select, textarea, [data-hud-cmd], [data-speed], [data-zoom], .btn-unit');
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
     * Portrait mode detection and game pause
     */
    setupPortraitDetection() {
        const checkOrientation = () => {
            const isPortrait = window.innerHeight > window.innerWidth;

            if (isPortrait && !this.isPortrait) {
                // Entered portrait mode
                this.isPortrait = true;
                this.wasRunningBeforePortrait = game.running;

                // Pause game in portrait mode
                if (game.running) {
                    game.running = false;
                    console.log('[HUD] Game paused (portrait mode)');
                }
            } else if (!isPortrait && this.isPortrait) {
                // Returned to landscape
                this.isPortrait = false;

                // Resume game if it was running before
                if (this.wasRunningBeforePortrait && !game.isGameOver) {
                    game.running = true;
                    game.loop();
                    console.log('[HUD] Game resumed (landscape mode)');
                }
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
                } else if (cmd === 'recon') {
                    // Recon 전력 분석(스코프 모달) (정찰기 전용)
                    if (typeof game.toggleScope === 'function') {
                        game.toggleScope();
                        ui.showToast('적군 전력 분석');
                    } else {
                        ui.showToast('전력 분석 UI(scope-modal)가 없습니다');
                    }

                    cmdBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    game.updateHUDSelection();
                    return;
                } else if (cmd === 'move') {
                    // [ADD] move는 타겟팅 모드로 진입 (모바일 전용 흐름 포함)
                    if (game.prepareMoveCommand) game.prepareMoveCommand();

                    cmdBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    return;
                } else if (cmd === 'retreat') {
                    // [P0-3] 후퇴 = 드론 복귀(회수) 통합
                    // 1순위: 선택된 드론이 있으면 복귀
                    // 2순위: 선택된 드론병의 ownedDrone 복귀
                    // 3순위: 일반 유닛 후퇴
                    let droneRecalled = false;

                    // 선택된 유닛 중 드론 찾기
                    for (const u of game.selectedUnits) {
                        if (u && !u.dead && (u.stats?.id === 'drone_suicide' || u.stats?.id === 'drone_at' || u.stats?.category === 'drone')) {
                            if (typeof game.requestDroneRecall === 'function') {
                                game.requestDroneRecall(u);
                                droneRecalled = true;
                            }
                        }
                    }

                    // 드론이 없으면 드론병의 ownedDrone 복귀
                    if (!droneRecalled) {
                        for (const u of game.selectedUnits) {
                            if (u && !u.dead && u.stats?.operator && u.ownedDrone && !u.ownedDrone.dead) {
                                if (typeof game.requestDroneRecall === 'function') {
                                    game.requestDroneRecall(u.ownedDrone);
                                    droneRecalled = true;
                                }
                            }
                        }
                    }

                    // 드론 복귀가 없으면 일반 후퇴
                    if (!droneRecalled) {
                        game.selectedUnits.forEach(u => {
                            if (!u.dead) {
                                u.commandMode = 'retreat';
                                u.returnToBase = true;
                            }
                        });
                        ui.showToast(`${game.selectedUnits.size}개 유닛: 후퇴 명령`);
                    }

                    cmdBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    game.updateHUDSelection();
                    return;
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

        // Recon 버튼은 "정찰기 선택 시에만" 노출
        const reconBtn = document.querySelector('[data-hud-cmd="recon"]');
        let hasRecon = false;
        if (hasSelection) {
            for (const u of game.selectedUnits) {
                if (u && !u.dead && u.stats?.id === 'recon') { hasRecon = true; break; }
            }
        }
        if (reconBtn) {
            reconBtn.classList.toggle('is-hidden', !hasRecon);
            reconBtn.disabled = !hasRecon;
            reconBtn.classList.toggle('disabled', !hasRecon);
        }

        cmdBtns.forEach(btn => {
            const cmd = btn.dataset.hudCmd;
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
            info.innerHTML = '<span class="hud-placeholder-text">유닛/건물을 선택하세요</span>';
            this.updateProductionArea();
            this.updateCommandButtons();
            return;
        }

        if (selection.kind === 'unit') {
            info.innerHTML = `
                <div class="hud-selection-item">
                    <span class="hud-selection-type">유닛</span>
                    <span class="hud-selection-name">${selection.name}</span>
                    <span class="hud-selection-count">${selection.count}개</span>
                </div>
            `;
        } else if (selection.kind === 'building') {
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
            info.innerHTML = `<span style="color: #22c55e; font-weight: bold;">${selection.count}개 유닛 선택됨</span>`;
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

        // [3.8] HQ 선택 시 특수탭 처리
        const tabSpecial = document.getElementById('tab-special');
        const isHQSelected = game.selectedBuilding &&
            (game.selectedBuilding.type === 'hq_player' && game.selectedBuilding.team === 'player');
        const hasAnySelection = (game.selectedUnits && game.selectedUnits.size > 0) ||
            game.selectedBuilding || this.checkWorkerSelected();

        if (tabSpecial) {
            if (isHQSelected) {
                // HQ 선택 시: 특수탭 숨김
                tabSpecial.style.display = 'none';
                // 현재 카테고리가 special이면 infantry로 강제 전환
                if (game.currentCategory === 'special') {
                    game.setCategory('infantry');
                }
            } else if (!hasAnySelection) {
                // 아무것도 선택 안 됨 (배경 클릭): 특수탭 표시 + 활성화
                tabSpecial.style.display = '';
                game.setCategory('special');
            } else {
                // 다른 것(유닛, 작업자 등) 선택 시: 특수탭 표시만 (활성화는 안 함)
                tabSpecial.style.display = '';
            }
        }

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

        // [3.8] 항상 유닛탭 표시 (HQ 선택 여부와 관계없이)
        // 기존: HQ 선택 시에만 표시 → 변경: 항상 표시
        this.showHQProductionUI(productionArea, footer, buildingLabel);
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

    // [목표 C/D] HQ 선택 시 유닛탭 전체를 production area에 임베드
    // worker는 infantry 카테고리에 포함되어 유닛탭에서 생산 가능
    showHQProductionUI(productionArea, footer, buildingLabel) {
        if (!productionArea) return;

        const unitPanel = this.elements.unitPanel;
        if (!unitPanel) return;

        // 유닛 패널을 production area로 이동
        productionArea.innerHTML = '';
        productionArea.appendChild(unitPanel);
        unitPanel.style.display = 'flex';

        // 상태 표시
        if (footer) footer.classList.add('hud-show-production');
        if (buildingLabel) buildingLabel.textContent = '본부 - 유닛 생산';
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
                <span class="text-yellow-400 text-[10px]">${data.cost}💰</span>
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

    // [3.8] 작업자 선택 시 감시탑 건설 버튼 (유닛버튼 스타일로 통일)
    showBuildButtons(productionArea, footer, buildingLabel) {
        if (!productionArea) return;

        const buildings = CONFIG.constructable || {};
        const worker = this.getSelectedWorker();

        // 기존 내용 지우고 건물 버튼 생성
        productionArea.innerHTML = '';

        const btnContainer = document.createElement('div');
        btnContainer.className = 'flex gap-2 items-center overflow-x-auto hide-scrollbar';
        btnContainer.style.cssText = 'padding: 4px; height: 100%;';

        // [3.8] watchtower만 표시
        for (const key in buildings) {
            if (key !== 'watchtower') continue;

            const bData = buildings[key];
            const canAfford = game.supply >= bData.cost;
            const onCooldown = game.builderCooldown > 0;
            const alreadyBuilt = game.watchtowerBuilt;  // [3.8] 1회 건설 제한 체크
            const isDisabled = !canAfford || onCooldown || alreadyBuilt;

            // [3.8] btn-unit 스타일로 통일 (유닛버튼과 동일한 구조)
            const btn = document.createElement('div');
            btn.className = 'btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg shrink-0 cursor-pointer select-none flex flex-col items-center justify-center';
            if (isDisabled) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            // 캔버스 아이콘 (기존 감시탑 디자인 - 기둥+벙커 스타일)
            const iconCvs = document.createElement('canvas');
            iconCvs.width = 60;
            iconCvs.height = 40;
            iconCvs.className = 'absolute inset-0 m-auto';
            const ctx = iconCvs.getContext('2d');
            ctx.save();
            ctx.translate(30, 38);
            ctx.scale(0.16, 0.16);  // 스케일 조정
            // 기존 watchtower 디자인 렌더링 (buildings.js 참조)
            ctx.fillStyle = '#555';  // 기둥
            ctx.fillRect(-25, -150, 50, 150);
            ctx.fillStyle = '#444';  // 받침대
            ctx.fillRect(-45, -150, 90, 10);
            ctx.fillStyle = '#111';  // 기관총
            ctx.fillRect(25, -185, 35, 6);
            ctx.fillStyle = '#666';  // 벙커 본체
            ctx.fillRect(-40, -210, 80, 60);
            ctx.fillStyle = '#333';  // 오른쪽 방어벽
            ctx.fillRect(20, -220, 20, 70);
            ctx.fillStyle = '#444';  // 지붕
            ctx.fillRect(-45, -220, 90, 10);
            ctx.restore();
            btn.appendChild(iconCvs);

            // 이름 (언어 키 사용)
            const nameSpan = document.createElement('span');
            nameSpan.className = 'font-bold text-[10px] z-10 absolute top-0 w-full text-center bg-black/30 text-white';
            nameSpan.innerText = (typeof Lang !== 'undefined') ? Lang.getText('build_watchtower_name') : bData.name;
            btn.appendChild(nameSpan);

            // 비용 표시
            const costSpan = document.createElement('span');
            costSpan.className = 'text-yellow-400 text-[10px] z-10 absolute bottom-1 right-1';
            costSpan.innerText = bData.cost + '💰';
            // [REQ] watchtower만 비용표시 숨김
            if (key !== 'watchtower') {
                btn.appendChild(costSpan);
            }

            // [3.8] 이미 건설됨 오버레이
            if (alreadyBuilt) {
                const builtDiv = document.createElement('div');
                builtDiv.className = 'absolute inset-0 bg-gray-800/70 flex items-center justify-center z-20';
                builtDiv.innerHTML = '<span class="text-white text-[9px] font-bold">건설완료</span>';
                btn.appendChild(builtDiv);
            }
            // 쿨타임 오버레이
            else if (onCooldown) {
                const cdDiv = document.createElement('div');
                cdDiv.className = 'cooldown-overlay';
                cdDiv.style.height = '100%';
                btn.appendChild(cdDiv);
            }

            // 하단 컬러바
            const colorBar = document.createElement('div');
            colorBar.className = 'absolute bottom-0 w-full h-1 z-10';
            colorBar.style.backgroundColor = alreadyBuilt ? '#6b7280' : '#3b82f6';
            btn.appendChild(colorBar);

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (alreadyBuilt) {
                    ui.showToast('감시탑은 1회만 건설 가능합니다!');
                } else if (worker && canAfford && !onCooldown) {
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

        // 상태 표시 (언어 키 사용)
        if (footer) footer.classList.add('hud-show-production');
        const workerName = (typeof Lang !== 'undefined') ? Lang.getText('unit_worker_name') : '작업자';
        const towerName = (typeof Lang !== 'undefined') ? Lang.getText('build_watchtower_name') : '감시탑';
        if (buildingLabel) buildingLabel.textContent = `${workerName} - ${towerName} 건설`;
    },

    /**
     * Hide legacy UI elements (replaced by new HUD)
     */
    hideLegacyUI() {
        // [3.8] Hide old minimap/toggle/ctrl/cmd buttons (설정 버튼은 유지)
        ['hud-minimap-container', 'hud-minimap-toggle', 'hud-ctrl-wrapper', 'unit-cmd-wrapper']
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
