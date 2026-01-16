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
            info.innerHTML = `
                <div class="hud-selection-item">
                    <span class="hud-selection-type">유닛</span>
                    <span class="hud-selection-name">${selection.name}</span>
                    <span class="hud-selection-count">${selection.count}개</span>
                </div>
            `;
        } else if (selection.kind === 'building') {
            // HQ (player base): minimal text to save space for production UI
            const isHQ = (selection.name === 'hq_player' && selection.team === 'player');
            const displayName = selection.displayName || selection.name;
            const constructionText = selection.underConstruction ? ' (건설중)' : '';
            const hpText = selection.hp !== undefined ? ` HP: ${Math.floor(selection.hp)}/${selection.hpMax}` : '';

            if (isHQ) {
                info.innerHTML = `<span class="hud-placeholder-text">총사령부${hpText}</span>`;
            } else {
                info.innerHTML = `
                    <div class="hud-selection-item">
                        <span class="hud-selection-type">건물${constructionText}</span>
                        <span class="hud-selection-name">${displayName}</span>
                        <span class="hud-selection-hp">${hpText}</span>
                    </div>
                `;
            }
        } else if (selection.kind === 'multi') {
            // Multiple units selected
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

        const shouldShowProduction =
            this.selection &&
            this.selection.kind === 'building' &&
            this.selection.name === 'hq_player' &&
            this.selection.team === 'player';

        if (shouldShowProduction) {
            // Move unit panel into HUD production area
            productionArea.innerHTML = '';
            productionArea.appendChild(unitPanel);
            unitPanel.style.display = 'block';

            // [FIX] Add state class to footer for hiding info area and showing building label
            if (footer) footer.classList.add('hud-show-production');
            if (buildingLabel) buildingLabel.textContent = '본부';
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
