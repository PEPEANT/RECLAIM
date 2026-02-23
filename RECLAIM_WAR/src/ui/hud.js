// [FILE] hud.js: ?? HUD(?? ??/?? ??/?? ??) ??? ???? ??.
/**
 * hud.js - Fixed Bottom HUD (StarCraft-style)
 *
 * ??????????
 * - HUD??"??Ôß?Îª?+ ?Î∫?Ä????Á≠åÎ§æÎ¥áÈÅäÎ∑∏„??Ô¶??????
 * - ???ÍπÜÏ†∑ ???®Î∫§Ï≠?? ??™Ïòá?????Ôß?Ï∏??game, unit_commands)?????æÎ®ÆÎ∫?
 * - ???´„Öé?????Ë£??game 1?? HUD????Ôß?Îª£Ô¶´?
 */

const HUD = {
    // State
    initialized: false,
    isPortrait: false,
    wasRunningBeforePortrait: false,
    // When true, the HQ "embed unit panel into production area" behaviour
    // will be disabled on narrow screens to preserve bottom HUD space.
    disableHQEmbedOnMobile: false,
    // Screen width (px) under which HQ embed is prevented when the flag is set
    mobileEmbedBreakpoint: 480,

    // [P1] Dirty-checking state for optimized updates
    _lastMinimapHash: '',
    _lastCmdState: '',
    _resolvedCommandMap: null,
    _skirmishRightSlotPredeploy: false,
    _contextRightSlotUnitPanel: false,
    _forceHqRightSlotOpen: false,
    _icbmCommandIconCache: {},
    _unitCommandIconCache: {},

    // DOM References (cached)
    elements: {
        footer: null,
        portraitOverlay: null,
        minimapCanvas: null,
        minimapWrapper: null,
        selectionInfo: null,
        productionArea: null,
        commandGrid: null,
        rightPanel: null,
        zoomDisplay: null,
        topActions: null,
        allMoveBtn: null,
        allRetreatBtn: null,
        allDefenseBtn: null,
        cameraBtn: null,
        optionBtn: null,
        cancelBtn: null
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
        this.elements.rightPanel = document.getElementById('hud-right');
        this.elements.zoomDisplay = document.getElementById('hud-zoom-display');
        this.elements.topActions = document.getElementById('hud-top-actions');
        this.elements.allMoveBtn = document.getElementById('hud-all-move-btn');
        this.elements.allRetreatBtn = document.getElementById('hud-all-retreat-btn');
        this.elements.allDefenseBtn = document.getElementById('hud-all-defense-btn');
        this.elements.cameraBtn = document.getElementById('hud-camera-btn');
        this.elements.optionBtn = document.getElementById('hud-option-btn');
        this.elements.cancelBtn = document.getElementById('hud-cancel-btn');

        // Setup input blocking (critical for touch devices)
        this.setupInputBlocking();

        // Setup portrait mode detection
        this.setupPortraitDetection();

        // Setup HUD controls (speed, zoom)
        this.setupControls();
        this.setupTopActions();

        // Setup command buttons
        this.setupCommandButtons();


        // Setup minimap interaction
        this.setupMinimap();

        // Cache unit panel for HQ production embedding
        this.elements.unitPanel = document.getElementById('unit-panel-container');
        if (this.elements.unitPanel) {
            this.elements.unitPanelOriginalParent = this.elements.unitPanel.parentElement;
            this.elements.unitPanelOriginalNextSibling = this.elements.unitPanel.nextSibling;
            // Start hidden; show only when production sheet opens
            this.elements.unitPanel.style.display = 'none';
        }

        // Cache additional elements for building label feature
        this.elements.infoArea = document.getElementById('hud-info-area');
        this.elements.buildingLabel = document.getElementById('hud-building-label');

        // [FIX] Force hide production area on init
        this.updateProductionArea();

        this.initialized = true;
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
                }
            } else if (!isPortrait && this.isPortrait) {
                // Returned to landscape
                this.isPortrait = false;

                // Resume game if it was running before
                if (this.wasRunningBeforePortrait && !game.isGameOver) {
                    game.running = true;
                    game.loop();
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

        // Pause button
        const pauseBtn = document.getElementById('hud-btn-pause');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof game.togglePause === 'function') {
                    game.togglePause();
                } else {
                    game.paused = !game.paused;
                }
                this.updatePauseButton(game.paused);
            });
        }

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
    setupTopActions() {
        const topActions = this.elements.topActions || document.getElementById('hud-top-actions');
        if (!topActions) return;

        topActions.querySelectorAll('[data-hud-top-action]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = String(btn.dataset.hudTopAction || '').trim();
                if (!action) return;

                let changed = false;
                switch (action) {
                    case 'all_move':
                        changed = this.executeAllMoveCommand() === true;
                        break;
                    case 'all_retreat':
                        changed = this.executeAllRetreatCommand() === true;
                        break;
                    case 'all_defense':
                        changed = this.executeAllDefenseCommand() === true;
                        break;
                    case 'options':
                        if (typeof ui !== 'undefined' && ui && typeof ui.openOptions === 'function') {
                            ui.openOptions();
                        }
                        break;
                    case 'camera':
                        if (typeof game.toggleCameraLock === 'function') {
                            game.toggleCameraLock();
                            changed = true;
                        }
                        break;
                    case 'cancel':
                        changed = this.handleCancelCommand() === true;
                        break;
                    default:
                        break;
                }

                if (changed) {
                    this._lastCmdState = '';
                    this.updateCommandButtons();
                    if (typeof app !== 'undefined' && app && typeof app.markUiDirty === 'function') {
                        app.markUiDirty();
                    }
                }
            });
        });
    },

    getAllCommandablePlayerUnits() {
        if (!game || !Array.isArray(game.players)) return [];
        return game.players.filter((u) => (
            u
            && !u.dead
            && u.team === 'player'
            && u.stats
            && typeof u.commandMode === 'string'
        ));
    },

    executeAllMoveCommand() {
        if (typeof game.isDirectControlActive === 'function'
            && game.isDirectControlActive()
            && typeof game.stopDirectControl === 'function') {
            game.stopDirectControl('internal');
        }
        const units = this.getAllCommandablePlayerUnits();
        if (units.length === 0) {
            if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
                ui.showToast('¡ˆ»÷ ∞°¥…«— æ∆±∫ ¿Ø¥÷¿Ã æ¯Ω¿¥œ¥Ÿ.');
            }
            return false;
        }

        const mapWidth = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
        const targetX = (Number.isFinite(mapWidth) && mapWidth > 0) ? Math.max(200, mapWidth - 220) : null;
        let issued = 0;

        units.forEach((u) => {
            u.returnToBase = false;
            u.attackTarget = null;
            u.lockedTarget = null;
            if (targetX !== null) {
                u.commandMode = 'move';
                u.targetX = targetX;
                if (u.stats && u.stats.type !== 'air') {
                    const baseY = Number.isFinite(Number(u.y))
                        ? Number(u.y)
                        : (typeof game.getGroundLaneY === 'function' ? game.getGroundLaneY(u) : Number(game.groundY));
                    u.targetY = (typeof game.clampGroundLaneY === 'function')
                        ? game.clampGroundLaneY(baseY)
                        : baseY;
                } else {
                    u.targetY = null;
                }
            } else {
                u.commandMode = 'attack';
                u.targetY = null;
            }
            issued++;
        });

        if (issued > 0 && typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            ui.showToast(`¿¸±∫ ¿Ãµø ∏Ì∑… (${issued})`);
        }
        return issued > 0;
    },

    executeAllRetreatCommand() {
        if (typeof game.isDirectControlActive === 'function'
            && game.isDirectControlActive()
            && typeof game.stopDirectControl === 'function') {
            game.stopDirectControl('internal');
        }
        const units = this.getAllCommandablePlayerUnits();
        if (units.length === 0) {
            if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
                ui.showToast('¡ˆ»÷ ∞°¥…«— æ∆±∫ ¿Ø¥÷¿Ã æ¯Ω¿¥œ¥Ÿ.');
            }
            return false;
        }

        let issued = 0;
        let recalled = 0;

        units.forEach((u) => {
            const id = String(u.stats?.id || '').trim();
            const isDroneUnit = (id === 'drone_suicide' || id === 'drone_at' || String(u.stats?.category || '').trim() === 'drone');

            if (isDroneUnit && typeof game.requestDroneRecall === 'function') {
                if (game.requestDroneRecall(u)) {
                    recalled++;
                    issued++;
                    return;
                }
            }

            if (u.stats?.operator && typeof game.getAliveOperatorDrones === 'function' && typeof game.requestDroneRecall === 'function') {
                const drones = game.getAliveOperatorDrones(u);
                if (Array.isArray(drones)) {
                    drones.forEach((d) => {
                        if (game.requestDroneRecall(d)) recalled++;
                    });
                }
            }

            u.commandMode = 'retreat';
            u.returnToBase = true;
            u.targetX = null;
            u.targetY = null;
            u.attackTarget = null;
            issued++;
        });

        if (issued > 0 && typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            const recallSuffix = recalled > 0 ? ` / µÂ∑– ∫π±Õ ${recalled}` : '';
            ui.showToast(`¿¸±∫ »ƒ≈ ∏Ì∑… (${issued}${recallSuffix})`);
        }
        return issued > 0;
    },

    executeAllDefenseCommand() {
        if (typeof game.isDirectControlActive === 'function'
            && game.isDirectControlActive()
            && typeof game.stopDirectControl === 'function') {
            game.stopDirectControl('internal');
        }
        const units = this.getAllCommandablePlayerUnits();
        if (units.length === 0) {
            if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
                ui.showToast('¡ˆ»÷ ∞°¥…«— æ∆±∫ ¿Ø¥÷¿Ã æ¯Ω¿¥œ¥Ÿ.');
            }
            return false;
        }

        let issued = 0;
        units.forEach((u) => {
            u.commandMode = 'stop';
            u.returnToBase = false;
            u.targetX = null;
            u.targetY = null;
            issued++;
        });

        if (issued > 0 && typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            ui.showToast(`¿¸±∫ πÊæÓ ∏Ì∑… (${issued})`);
        }
        return issued > 0;
    },

    getLangText(key, fallback) {
        if (typeof Lang !== 'undefined' && Lang && typeof Lang.getText === 'function') {
            const text = Lang.getText(key);
            if (typeof text === 'string' && text.trim()) return text;
        }
        return fallback;
    },

    getHudCommandButton(role) {
        return document.querySelector(`[data-hud-cmd="${role}"]`);
    },

    setHudCommandButtonVisual(btn, iconClass, label, iconImageUrl = '', iconImageClass = '') {
        if (!btn) return;
        const iconNode = btn.querySelector('.cmd-icon');
        const labelNode = btn.querySelector('span:last-child');
        if (iconNode) {
            if (iconImageUrl) {
                iconNode.innerHTML = '';
                const img = document.createElement('img');
                img.className = String(iconImageClass || '').trim()
                    ? `cmd-icon-img ${String(iconImageClass || '').trim()}`
                    : 'cmd-icon-img';
                img.src = iconImageUrl;
                img.alt = '';
                img.setAttribute('aria-hidden', 'true');
                iconNode.appendChild(img);
            } else {
                iconNode.innerHTML = `<i class='${iconClass}'></i>`;
            }
        }
        if (labelNode) labelNode.textContent = label;
    },

    getIcbmPayloadPalette(payloadKey) {
        const key = String(payloadKey || '').trim();
        if (key === 'emp') {
            return { body: '#dbeafe', nose: '#60a5fa', band: '#2563eb', fin: '#334155', glow: 'rgba(59,130,246,0.24)' };
        }
        if (key === 'tactical_missile') {
            return { body: '#f3f4f6', nose: '#ef4444', band: '#f59e0b', fin: '#64748b', glow: 'rgba(239,68,68,0.20)' };
        }
        if (key === 'nuke') {
            return { body: '#e5e7eb', nose: '#ef4444', band: '#111827', fin: '#475569', glow: 'rgba(248,113,113,0.20)' };
        }
        return { body: '#e2e8f0', nose: '#cbd5e1', band: '#facc15', fin: '#475569', glow: 'rgba(250,204,21,0.22)' };
    },

    getIcbmPayloadCommandIcon(payloadKey) {
        const key = String(payloadKey || '').trim();
        if (!key) return '';
        if (!this._icbmCommandIconCache || typeof this._icbmCommandIconCache !== 'object') {
            this._icbmCommandIconCache = {};
        }
        if (Object.prototype.hasOwnProperty.call(this._icbmCommandIconCache, key)) {
            return this._icbmCommandIconCache[key] || '';
        }

        if (typeof document === 'undefined') {
            this._icbmCommandIconCache[key] = '';
            return '';
        }

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            this._icbmCommandIconCache[key] = '';
            return '';
        }

        const palette = this.getIcbmPayloadPalette(key);
        const bodyX = 12;
        const bodyY = 15;
        const bodyW = 34;
        const bodyH = 10;

        if (palette.glow) {
            ctx.fillStyle = palette.glow;
            ctx.beginPath();
            ctx.ellipse(30, 24, 24, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = palette.body;
        ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

        ctx.fillStyle = palette.nose;
        ctx.beginPath();
        ctx.moveTo(bodyX + bodyW, bodyY);
        ctx.lineTo(bodyX + bodyW + 8, bodyY + (bodyH / 2));
        ctx.lineTo(bodyX + bodyW, bodyY + bodyH);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.band;
        ctx.fillRect(bodyX + Math.round(bodyW * 0.55), bodyY, 5, bodyH);

        ctx.fillStyle = palette.fin;
        ctx.beginPath();
        ctx.moveTo(bodyX + 6, bodyY);
        ctx.lineTo(bodyX + 1, bodyY - 5);
        ctx.lineTo(bodyX + 1, bodyY);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bodyX + 6, bodyY + bodyH);
        ctx.lineTo(bodyX + 1, bodyY + bodyH + 5);
        ctx.lineTo(bodyX + 1, bodyY + bodyH);
        ctx.closePath();
        ctx.fill();

        if (key === 'emp') {
            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bodyX + 12, bodyY + 2);
            ctx.lineTo(bodyX + 17, bodyY + 2);
            ctx.lineTo(bodyX + 13, bodyY + 8);
            ctx.lineTo(bodyX + 20, bodyY + 8);
            ctx.stroke();
        } else if (key === 'nuke') {
            const cx = bodyX + 15;
            const cy = bodyY + 5;
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 3; i++) {
                const ang = (Math.PI * 2 * i) / 3;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(ang) * 5.2, cy + Math.sin(ang) * 5.2);
                ctx.stroke();
            }
        }

        const dataUrl = canvas.toDataURL('image/png');
        this._icbmCommandIconCache[key] = dataUrl;
        return dataUrl;
    },

    getUnitCommandIcon(unitKey) {
        const key = String(unitKey || '').trim();
        if (!key) return '';
        if (!this._unitCommandIconCache || typeof this._unitCommandIconCache !== 'object') {
            this._unitCommandIconCache = {};
        }
        if (Object.prototype.hasOwnProperty.call(this._unitCommandIconCache, key)) {
            return this._unitCommandIconCache[key] || '';
        }
        if (typeof document === 'undefined' || typeof CONFIG === 'undefined' || !CONFIG?.units?.[key]) {
            this._unitCommandIconCache[key] = '';
            return '';
        }

        const unitDef = CONFIG.units[key];
        const svgIcons = (typeof UnitProfileIcons !== 'undefined') ? UnitProfileIcons : null;
        if (svgIcons && typeof svgIcons.getDataUrl === 'function') {
            const svgDataUrl = svgIcons.getDataUrl(key, unitDef, { bgColor: '#4A8522' });
            if (svgDataUrl) {
                this._unitCommandIconCache[key] = svgDataUrl;
                return svgDataUrl;
            }
        }
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            this._unitCommandIconCache[key] = '';
            return '';
        }

        const iconUtils = (typeof UnitRenderUtils !== 'undefined') ? UnitRenderUtils : null;
        const drew = !!(iconUtils && typeof iconUtils.drawUnitIconToCanvas === 'function'
            && iconUtils.drawUnitIconToCanvas(ctx, key, unitDef, {
                centerX: 32,
                bottomY: 42,
                baseScale: 0.82,
                baseOffsetY: -2,
                drawFallback: false
            }));

        if (!drew) {
            const w = Math.max(12, Math.min(50, Math.round((Number(unitDef.width) || 24) * 1.2)));
            const h = Math.max(8, Math.min(26, Math.round((Number(unitDef.height) || 12) * 1.1)));
            ctx.fillStyle = unitDef.color || '#38bdf8';
            ctx.globalAlpha = 0.95;
            ctx.fillRect((64 - w) / 2, (48 - h) / 2, w, h);
            ctx.globalAlpha = 1;
        }

        const dataUrl = canvas.toDataURL('image/png');
        this._unitCommandIconCache[key] = dataUrl;
        return dataUrl;
    },

    setHudButtonEnabled(btn, enabled) {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle('disabled', !enabled);
    },

    updateTopCameraButton(lockedOverride) {
        const btn = this.elements.cameraBtn || document.getElementById('hud-camera-btn');
        if (!btn) return;
        const locked = (typeof lockedOverride === 'boolean')
            ? lockedOverride
            : ((typeof game.isCameraLocked === 'function') ? !!game.isCameraLocked() : !!game.cameraLockActive);
        btn.classList.toggle('active', locked);
        btn.setAttribute('aria-pressed', locked ? 'true' : 'false');
    },

    getSkirmishPhase() {
        if (typeof SkirmishMode !== 'undefined' && SkirmishMode && SkirmishMode.isActive) {
            return String(SkirmishMode.phase || '').trim().toLowerCase();
        }
        return '';
    },

    isMobileControlViewport() {
        if (typeof window === 'undefined') return false;
        const coarse = (typeof window.matchMedia === 'function')
            ? window.matchMedia('(pointer: coarse)').matches
            : false;
        if (!coarse) return false;
        return window.innerWidth <= 1024;
    },

    isMobileDirectControlActive() {
        return this.isMobileControlViewport()
            && !!(game && typeof game.isDirectControlActive === 'function' && game.isDirectControlActive());
    },

    isCommandLockedByMode() {
        const phase = this.getSkirmishPhase();
        return phase === 'placement' || phase === 'countdown';
    },

    isIcbmPayloadReady(payloadKey) {
        if (!payloadKey || typeof game.isIcbmSkillKey !== 'function' || !game.isIcbmSkillKey(payloadKey)) {
            return false;
        }
        if (typeof game.shouldShowIcbmSkills !== 'function' || !game.shouldShowIcbmSkills()) return false;
        if (typeof game.hasReadyIcbmLauncher !== 'function' || !game.hasReadyIcbmLauncher('player')) return false;

        const cfg = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units) ? CONFIG.units[payloadKey] : null;
        if (!cfg || !cfg.chargeKey) return false;
        const charges = Math.max(0, Number(game.skillCharges?.[cfg.chargeKey]) || 0);
        const cooldown = Math.max(0, Number(game.cooldowns?.[payloadKey]) || 0);
        return charges > 0 && cooldown <= 0;
    },

    getMappedCommandMeta(cmd) {
        switch (cmd) {
            case 'move':
                return { key: 'cmd_move', fallback: 'MOVE', icon: 'fa-solid fa-up-down-left-right', targetingType: '__move__' };
            case 'recon':
                return { key: 'cmd_recon', fallback: 'RECON', icon: 'fa-solid fa-binoculars' };
            case 'smoke':
                return { key: 'cmd_smoke', fallback: 'SMOKE', icon: 'fa-solid fa-smog', targetingType: '__smoke__' };
            case 'medkit':
                return { key: 'cmd_medkit', fallback: 'MEDKIT', icon: 'fa-solid fa-kit-medical' };
            case 'bagpipe':
                return { key: 'cmd_bagpipe', fallback: 'BAGPIPE', icon: 'fa-solid fa-music' };
            case 'drop':
                return { key: 'cmd_drop', fallback: 'DROP', icon: 'fa-solid fa-arrow-down', targetingType: '__drop__' };
            case 'missile':
                return { key: 'cmd_missile', fallback: 'MISSILE', icon: 'fa-solid fa-rocket', targetingType: '__missile__' };
            case 'camera':
                return { key: 'cmd_camera', fallback: 'CAMERA', icon: 'fa-solid fa-video' };
            case 'control_start':
                return { key: 'cmd_control_start', fallback: 'CONTROL ON', icon: 'fa-solid fa-gamepad' };
            case 'control_cancel':
                return { key: 'cmd_control_cancel', fallback: 'CONTROL OFF', icon: 'fa-solid fa-circle-stop' };
            case 'direct_fire':
                return { key: 'cmd_fire', fallback: 'FIRE', icon: 'fa-solid fa-crosshairs' };
            case 'weapon_toggle':
                return { key: 'cmd_weapon_toggle', fallback: 'WEAPON', icon: 'fa-solid fa-gun' };
            case 'eject':
                return { key: 'cmd_eject', fallback: 'EJECT', icon: 'fa-solid fa-right-from-bracket' };
            case 'drone_suicide':
                return {
                    key: 'cmd_drone_suicide',
                    fallback: 'SUICIDE DRONE',
                    icon: 'fa-solid fa-skull-crossbones',
                    iconImageUnitKey: 'drone_suicide',
                    iconImageClass: 'cmd-icon-img-drone'
                };
            case 'drone_at':
                return {
                    key: 'cmd_drone_at',
                    fallback: 'AT DRONE',
                    icon: 'fa-solid fa-shield-halved',
                    iconImageUnitKey: 'drone_at',
                    iconImageClass: 'cmd-icon-img-drone'
                };
            case 'drone_manual':
                return {
                    key: 'cmd_drone_manual',
                    fallback: 'MANUAL',
                    icon: 'fa-solid fa-hand-pointer'
                };
            case 'drone_auto':
                return {
                    key: 'cmd_drone_auto',
                    fallback: 'AUTO',
                    icon: 'fa-solid fa-robot'
                };
            case 'icbm_tactical':
                return {
                    key: 'cmd_icbm_tactical',
                    fallback: 'TACTICAL',
                    icon: 'fa-solid fa-bullseye',
                    iconImageKey: 'tactical_missile',
                    targetingType: 'tactical_missile'
                };
            case 'icbm_emp':
                return {
                    key: 'cmd_icbm_emp',
                    fallback: 'EMP',
                    icon: 'fa-solid fa-bolt-lightning',
                    iconImageKey: 'emp',
                    targetingType: 'emp'
                };
            case 'icbm_nuke':
                return {
                    key: 'cmd_icbm_nuke',
                    fallback: 'NUKE',
                    icon: 'fa-solid fa-radiation',
                    iconImageKey: 'nuke',
                    targetingType: 'nuke'
                };
            default:
                return { key: 'cmd_more', fallback: 'MORE', icon: 'fa-solid fa-ellipsis' };
        }
    },

    getRoleDefaultMeta(role) {
        switch (role) {
            case 'skill1':
                return { key: 'cmd_skill1', fallback: 'SKILL 1', icon: 'fa-solid fa-bolt' };
            case 'skill2':
                return { key: 'cmd_skill2', fallback: 'SKILL 2', icon: 'fa-solid fa-bolt' };
            case 'skill3':
                return { key: 'cmd_skill3', fallback: 'SKILL 3', icon: 'fa-solid fa-bolt' };
            case 'interact':
                return { key: 'cmd_interact', fallback: 'INTERACT', icon: 'fa-solid fa-hand-pointer' };
            case 'more':
            default:
                return { key: 'cmd_more', fallback: 'MORE', icon: 'fa-solid fa-ellipsis' };
        }
    },

    getCommandContext() {
        const selectedUnits = [];
        if (game.selectedUnits && typeof game.selectedUnits.forEach === 'function') {
            game.selectedUnits.forEach(u => {
                if (u && !u.dead) selectedUnits.push(u);
            });
        }

        let hasRecon = false;
        let hasSmokeCharge = false;
        let canDrop = false;
        let hasMissileCharge = false;
        let hasMedkitCharge = false;
        let hasBagpiperSelection = false;
        let bagpiperSelectionCount = 0;
        let bagpiperInactiveCount = 0;
        let bagpipeSongActive = false;

        selectedUnits.forEach(u => {
            const stats = u.stats || {};
            const id = stats.id;

            if (id === 'recon') hasRecon = true;
            // [ITEM] ?∞Îßâ?? special_forces Í∏∞Î≥∏ ?úÍ±∞, smokeChargesLeft > 0??Î™®Îì† ?†Îãõ ÏßÄ??
            if ((u.smokeChargesLeft || 0) > 0) hasSmokeCharge = true;
            // [ITEM] ?òÎ£å ?§Ìä∏: medkitChargesLeft > 0??Î≤†ÌÖå???†Îãõ
            if ((u.medkitChargesLeft || 0) > 0) hasMedkitCharge = true;
            if (id === 'bagpiper') {
                hasBagpiperSelection = true;
                bagpiperSelectionCount += 1;
                if (u.bagpipeActive === true) bagpipeSongActive = true;
                else bagpiperInactiveCount += 1;
            }
            if (id && ['blackhawk', 'chinook', 'apc', 'humvee'].includes(id) && (u.transportDropsLeft || 0) > 0) {
                canDrop = true;
            }

            const supportsMissile = (typeof game.unitHasMissileCommand === 'function')
                ? game.unitHasMissileCommand(u)
                : (id === 'fighter');
            if (supportsMissile && (u.missileChargesLeft || 0) > 0) {
                hasMissileCharge = true;
            }
        });

        const skirmishPhase = this.getSkirmishPhase();
        const skirmishPredeploy = skirmishPhase === 'placement' || skirmishPhase === 'countdown';
        const skirmishBattle = skirmishPhase === 'battle';
        const commandLockedByMode = this.isCommandLockedByMode();

        const selectedOperators = (typeof game.getSelectedOperators === 'function')
            ? game.getSelectedOperators()
            : selectedUnits.filter(u => u && u.stats?.operator === true);
        const selectedOperatorsForAt = (typeof game.getSelectedOperatorsForDrone === 'function')
            ? game.getSelectedOperatorsForDrone('drone_at')
            : selectedOperators.filter((u) => {
                if (Array.isArray(u?.veteranLoadoutSkillItemKeys)
                    && u.veteranLoadoutSkillItemKeys.some((key) => String(key || '').trim() === 'drone_at_item')) {
                    return true;
                }
                return String(u?.veteranLoadoutItemKey || '').trim() === 'drone_at_item';
            });
        const deployableOperators = (typeof game.getDeployableOperators === 'function')
            ? game.getDeployableOperators()
            : selectedOperators.filter(u => (u.droneChargesLeft || 0) > 0);
        const deployableOperatorsForSuicide = (typeof game.getDeployableOperatorsForDrone === 'function')
            ? game.getDeployableOperatorsForDrone('drone_suicide')
            : deployableOperators;
        const deployableOperatorsForAt = (typeof game.getDeployableOperatorsForDrone === 'function')
            ? game.getDeployableOperatorsForDrone('drone_at')
            : selectedOperatorsForAt.filter(u => (u.droneChargesLeft || 0) > 0);

        const selectedIcbm = (typeof game.getSelectedIcbmLaunchers === 'function')
            ? game.getSelectedIcbmLaunchers()
            : selectedUnits.filter(u => u && u.stats?.id === 'icbm');

        const canIcbmTactical = this.isIcbmPayloadReady('tactical_missile');
        const canIcbmEmp = this.isIcbmPayloadReady('emp');
        const canIcbmNuke = this.isIcbmPayloadReady('nuke');
        const bagpipeCooldownFrames = Math.max(0, Number(game.cooldowns?.bagpipe_skill) || 0);
        // Battle-only policy: bagpipe can be retriggered whenever bagpiper is selected.
        const canUseBagpipe = hasBagpiperSelection;

        const cameraLocked = (typeof game.isCameraLocked === 'function') ? game.isCameraLocked() : false;

        const selectedBunker = (game.selectedBuilding && game.selectedBuilding.type === 'bunker')
            ? game.selectedBuilding
            : null;
        const canEject = !!(
            selectedBunker &&
            selectedBunker.team === 'player' &&
            Array.isArray(selectedBunker.garrisonUnits) &&
            selectedBunker.garrisonUnits.length > 0
        );

        const directControlActive = (typeof game.isDirectControlActive === 'function')
            ? game.isDirectControlActive()
            : false;
        const directControlUnit = (typeof game.getDirectControlUnit === 'function')
            ? game.getDirectControlUnit()
            : null;
        const directWeaponToggleInfo = (typeof game.getDirectControlWeaponToggleInfo === 'function')
            ? game.getDirectControlWeaponToggleInfo()
            : null;
        const canDirectWeaponToggle = !!(directWeaponToggleInfo && directWeaponToggleInfo.enabled);
        let canDirectControlStart = false;
        if (selectedUnits.length > 0) {
            if (typeof game.getDirectControlSelectedCandidate === 'function') {
                canDirectControlStart = !!game.getDirectControlSelectedCandidate();
            } else if (typeof game.isDirectControlEligible === 'function') {
                canDirectControlStart = selectedUnits.some(u => game.isDirectControlEligible(u));
            }
        }

        return {
            selectedUnits,
            hasSelection: selectedUnits.length > 0,
            hasRecon,
            hasSmokeCharge,
            hasMedkitCharge,
            hasBagpiperSelection,
            hasBagpipeSkill: hasBagpiperSelection,
            bagpipeSongActive,
            bagpipeCooldownFrames,
            canUseBagpipe,
            canDrop,
            hasMissileCharge,
            skirmishPhase,
            skirmishPredeploy,
            skirmishBattle,
            commandLockedByMode,
            hasOperatorSelection: selectedOperators.length > 0,
            hasOperatorAtSkill: selectedOperatorsForAt.length > 0,
            hasDeployableOperator: deployableOperators.length > 0,
            hasSelectedIcbm: selectedIcbm.length > 0,
            canDroneSuicide: (!commandLockedByMode) && deployableOperatorsForSuicide.length > 0,
            canDroneAt: (!commandLockedByMode) && deployableOperatorsForAt.length > 0,
            canIcbmTactical,
            canIcbmEmp,
            canIcbmNuke,
            canEject,
            directControlActive,
            directControlUnit,
            canDirectControlStart,
            directWeaponToggleInfo,
            canDirectWeaponToggle,
            selectedBunker,
            cameraLocked,
            mobileControlViewport: this.isMobileControlViewport(),
            targetingType: game.targetingType || null,
            buildModeActive: !!(game.buildMode && game.buildMode.active) || commandLockedByMode,
            canMove: selectedUnits.length > 0,
            canCamera: selectedUnits.length > 0 || cameraLocked
        };
    },

    isMappedCommandAvailable(cmd, ctx) {
        if (!ctx) return false;

        if (ctx.buildModeActive) return false;
        if (ctx.targetingType) {
            const meta = this.getMappedCommandMeta(cmd);
            if (!meta || !meta.targetingType) return false;
            return ctx.targetingType === meta.targetingType;
        }

        switch (cmd) {
            case 'move': return !!ctx.canMove;
            case 'recon': return !!ctx.hasRecon;
            case 'smoke': return !!ctx.hasSmokeCharge;
            case 'medkit': return !!ctx.hasMedkitCharge;
            case 'bagpipe': return !!ctx.hasBagpiperSelection && !!ctx.canUseBagpipe;
            case 'drop': return !!ctx.canDrop;
            case 'missile': return !!ctx.hasMissileCharge;
            case 'camera': return !!ctx.canCamera;
            case 'control_start': return false;
            case 'control_cancel': return false;
            case 'direct_fire': return !!ctx.directControlActive && !!ctx.directControlUnit && !ctx.directControlUnit.dead;
            case 'weapon_toggle': return !!ctx.directControlActive && !!ctx.canDirectWeaponToggle;
            case 'eject': return !!ctx.canEject;
            case 'drone_suicide': return !!ctx.canDroneSuicide;
            case 'drone_at': return !!ctx.canDroneAt;
            case 'drone_manual': {
                if (!ctx.hasOperatorSelection) return false;
                const mode = (typeof game.getDroneControlMode === 'function')
                    ? game.getDroneControlMode()
                    : (game.droneControlMode === 'manual' ? 'manual' : 'auto');
                return mode !== 'manual';
            }
            case 'drone_auto': {
                if (!ctx.hasOperatorSelection) return false;
                const mode = (typeof game.getDroneControlMode === 'function')
                    ? game.getDroneControlMode()
                    : (game.droneControlMode === 'manual' ? 'manual' : 'auto');
                return mode === 'manual';
            }
            case 'icbm_tactical': return !!ctx.canIcbmTactical;
            case 'icbm_emp': return !!ctx.canIcbmEmp;
            case 'icbm_nuke': return !!ctx.canIcbmNuke;
            default: return false;
        }
    },

    resolveCommandRoleMap(ctx) {
        const map = {
            cancel: 'cancel',
            stance: 'stance',
            skill1: null,
            skill2: null,
            skill3: null,
            interact: null
        };

        const used = new Set();
        const pick = (candidates) => {
            for (let i = 0; i < candidates.length; i++) {
                const cmd = candidates[i];
                if (used.has(cmd)) continue;
                if (!this.isMappedCommandAvailable(cmd, ctx)) continue;
                used.add(cmd);
                return cmd;
            }
            return null;
        };
        const placeSkill = (cmd, preferredSlots = ['skill1', 'skill2', 'skill3']) => {
            if (!cmd || used.has(cmd)) return false;
            if (!this.isMappedCommandAvailable(cmd, ctx)) return false;
            for (let i = 0; i < preferredSlots.length; i += 1) {
                const slot = preferredSlots[i];
                if (!slot || !Object.prototype.hasOwnProperty.call(map, slot)) continue;
                if (!map[slot]) {
                    map[slot] = cmd;
                    used.add(cmd);
                    return true;
                }
            }
            return false;
        };
        const directControlUnitId = String((ctx.directControlUnit && ctx.directControlUnit.stats && ctx.directControlUnit.stats.id) || '').trim();
        const isDirectControlOperator = ctx.directControlActive && directControlUnitId === 'drone_operator';
        let directControlInteract = null;
        if (ctx.directControlActive && !isDirectControlOperator) {
            directControlInteract = 'direct_fire';
        }
        if (ctx.directControlActive && ctx.canDirectWeaponToggle) {
            map.skill1 = 'weapon_toggle';
            used.add('weapon_toggle');
        }

        if (ctx.hasSelectedIcbm) {
            map.skill1 = pick(['icbm_tactical', 'icbm_emp', 'icbm_nuke']);
            map.skill2 = pick(['icbm_emp', 'icbm_nuke', 'icbm_tactical']);
            map.skill3 = pick(['icbm_nuke', 'icbm_tactical', 'icbm_emp']);
            map.interact = directControlInteract || pick(['drop', 'eject', 'recon']);
            return map;
        }

        if (ctx.hasBagpiperSelection) {
            placeSkill('bagpipe', ['skill1', 'skill2', 'skill3']);
        }

        if (ctx.hasOperatorSelection) {
            placeSkill('drone_suicide', ['skill1', 'skill2', 'skill3']);
            if (ctx.hasOperatorAtSkill) {
                placeSkill('drone_at', ['skill2', 'skill3', 'skill1']);
            } else {
                if (!map.skill2) map.skill2 = pick(['smoke', 'missile', 'recon']);
            }
            if (!map.skill3) map.skill3 = pick(['smoke', 'missile', 'recon']);
            const mode = (typeof game.getDroneControlMode === 'function')
                ? game.getDroneControlMode()
                : (game.droneControlMode === 'manual' ? 'manual' : 'auto');
            // For drone operators, interact slot stays dedicated to drone mode toggle
            // so lockdown/manual flow remains usable even during direct control.
            map.interact = (mode === 'manual') ? 'drone_auto' : 'drone_manual';
            return map;
        }

        if (ctx.hasBagpiperSelection) {
            if (!map.skill2) map.skill2 = pick(['smoke', 'medkit', 'missile', 'recon']);
            if (!map.skill3) map.skill3 = pick(['medkit', 'smoke', 'recon', 'missile']);
            map.interact = directControlInteract || pick(['drop', 'eject', 'recon']);
            return map;
        }

        if (!map.skill1) {
            map.skill1 = pick(['missile', 'smoke', 'medkit', 'recon']);
        }
        map.skill2 = pick(['smoke', 'medkit', 'missile', 'recon']);
        map.skill3 = pick(['medkit', 'recon', 'missile', 'smoke']);
        map.interact = directControlInteract || pick(['drop', 'eject', 'recon', 'missile', 'smoke', 'medkit']);

        return map;
    },

    renderMappedRoleButton(role, mappedCmd, ctx) {
        const btn = this.getHudCommandButton(role);
        if (!btn) return;
        const isSkillRole = role === 'skill1' || role === 'skill2' || role === 'skill3';

        if (!mappedCmd) {
            const fallbackMeta = this.getRoleDefaultMeta(role);
            this.setHudCommandButtonVisual(
                btn,
                fallbackMeta.icon,
                this.getLangText(fallbackMeta.key, fallbackMeta.fallback)
            );
            this.setHudButtonEnabled(btn, false);
            btn.classList.remove('active');
            btn.dataset.hudResolvedCmd = '';
            return;
        }

        if (mappedCmd === 'weapon_toggle') {
            const info = (typeof game.getDirectControlWeaponToggleInfo === 'function')
                ? game.getDirectControlWeaponToggleInfo()
                : null;
            const label = (info && info.nextLabel) ? String(info.nextLabel) : this.getLangText('cmd_weapon_toggle', 'WEAPON');
            this.setHudCommandButtonVisual(
                btn,
                'fa-solid fa-gun',
                label
            );
            this.setHudButtonEnabled(btn, !!(info && info.enabled));
            btn.classList.remove('active');
            btn.dataset.hudResolvedCmd = mappedCmd;
            return;
        }

        const meta = this.getMappedCommandMeta(mappedCmd);
        const isIcbmCmd = mappedCmd === 'icbm_tactical' || mappedCmd === 'icbm_emp' || mappedCmd === 'icbm_nuke';
        const useImageIcon = !isSkillRole || isIcbmCmd;
        const iconImageUrl = useImageIcon
            ? (
                meta.iconImageKey
                    ? this.getIcbmPayloadCommandIcon(meta.iconImageKey)
                    : (meta.iconImageUnitKey ? this.getUnitCommandIcon(meta.iconImageUnitKey) : '')
            )
            : '';
        const iconClass = (isSkillRole && !isIcbmCmd) ? 'fa-solid fa-bolt' : meta.icon;
        const baseLabel = this.getLangText(meta.key, meta.fallback);
        let buttonLabel = baseLabel;
        if (mappedCmd === 'bagpipe') {
            const cdFrames = Math.max(0, Number(ctx?.bagpipeCooldownFrames) || 0);
            if (cdFrames > 0) {
                buttonLabel = `${baseLabel} ${Math.max(1, Math.ceil(cdFrames / 60))}s`;
            } else if (ctx?.bagpipeSongActive) {
                buttonLabel = `${baseLabel} ON`;
            }
        }
        this.setHudCommandButtonVisual(
            btn,
            iconClass,
            buttonLabel,
            iconImageUrl,
            useImageIcon ? (meta.iconImageClass || '') : ''
        );
        this.setHudButtonEnabled(btn, this.isMappedCommandAvailable(mappedCmd, ctx));

        const isActive = (mappedCmd === 'camera')
            ? !!ctx.cameraLocked
            : (mappedCmd === 'bagpipe')
                ? !!ctx.bagpipeSongActive
                : (meta.targetingType ? ctx.targetingType === meta.targetingType : false);
        btn.classList.toggle('active', isActive);
        btn.dataset.hudResolvedCmd = mappedCmd;
    },

    handleCancelCommand() {
        if (typeof game.isDirectControlActive === 'function'
            && game.isDirectControlActive()
            && typeof game.stopDirectControl === 'function') {
            game.stopDirectControl('cancel');
            return true;
        }

        if (game.targetingType && typeof game.cancelTargeting === 'function') {
            game.cancelTargeting();
            return true;
        }

        if (game.buildMode && game.buildMode.active && typeof game.cancelBuildMode === 'function') {
            game.cancelBuildMode();
            return true;
        }

        let changed = false;
        if (game.selectedUnits && game.selectedUnits.size > 0 && typeof game.clearAllSelection === 'function') {
            game.clearAllSelection();
            changed = true;
        }
        if (game.selectedBuilding) {
            game.selectedBuilding = null;
            changed = true;
        }
        if (!changed && typeof game.isCameraLocked === 'function' && game.isCameraLocked() && typeof game.toggleCameraLock === 'function') {
            game.toggleCameraLock();
            changed = true;
        }

        if (changed && typeof game.updateHUDSelection === 'function') {
            game.updateHUDSelection();
        }

        return changed;
    },
    executeMappedCommand(cmd) {
        switch (cmd) {
            case 'move':
                if (typeof game.prepareMoveCommand === 'function') {
                    game.prepareMoveCommand();
                    return true;
                }
                return false;
            case 'recon':
                if (typeof game.toggleScope === 'function') {
                    game.toggleScope();
                    ui.showToast('Enemy force analysis.');
                    return true;
                }
                return false;
            case 'smoke':
                if (typeof game.prepareSmokeCommand === 'function') {
                    game.prepareSmokeCommand();
                    return true;
                }
                return false;
            case 'medkit':
                if (typeof game.useMedkitCommand === 'function') {
                    return game.useMedkitCommand() === true;
                }
                return false;
            case 'bagpipe':
                if (typeof game.useBagpipeCommand === 'function') {
                    return game.useBagpipeCommand() === true;
                }
                return false;
            case 'drop':
                if (typeof game.prepareDropCommand === 'function') {
                    game.prepareDropCommand();
                    return true;
                }
                return false;
            case 'missile':
                if (typeof game.prepareMissileCommand === 'function') {
                    game.prepareMissileCommand();
                    return true;
                }
                return false;
            case 'drone_suicide':
                if (typeof game.launchOperatorDroneFromCommand === 'function') {
                    return game.launchOperatorDroneFromCommand('drone_suicide') === true;
                }
                return false;
            case 'drone_at':
                if (typeof game.launchOperatorDroneFromCommand === 'function') {
                    return game.launchOperatorDroneFromCommand('drone_at') === true;
                }
                return false;
            case 'drone_manual':
                if (typeof game.setDroneControlMode === 'function') {
                    return game.setDroneControlMode('manual') === true;
                }
                return false;
            case 'drone_auto':
                if (typeof game.setDroneControlMode === 'function') {
                    return game.setDroneControlMode('auto') === true;
                }
                return false;
            case 'icbm_tactical':
                if (typeof game.triggerIcbmSkillFromCommand === 'function') {
                    return game.triggerIcbmSkillFromCommand('tactical_missile') === true;
                }
                return false;
            case 'icbm_emp':
                if (typeof game.triggerIcbmSkillFromCommand === 'function') {
                    return game.triggerIcbmSkillFromCommand('emp') === true;
                }
                return false;
            case 'icbm_nuke':
                if (typeof game.triggerIcbmSkillFromCommand === 'function') {
                    return game.triggerIcbmSkillFromCommand('nuke') === true;
                }
                return false;
            case 'camera':
                if (typeof game.toggleCameraLock === 'function') {
                    game.toggleCameraLock();
                    if (typeof game.updateHUDSelection === 'function') game.updateHUDSelection();
                    return true;
                }
                return false;
            case 'control_start':
                if (typeof game.startDirectControl === 'function') {
                    return game.startDirectControl() === true;
                }
                return false;
            case 'control_cancel':
                if (typeof game.stopDirectControl === 'function') {
                    return game.stopDirectControl('hud') === true;
                }
                return false;
            case 'direct_fire':
                if (typeof game.directControlFireCurrentWeapon === 'function') {
                    return game.directControlFireCurrentWeapon() === true;
                }
                if (typeof game.mobileDirectMainFire === 'function') {
                    return game.mobileDirectMainFire() === true;
                }
                return false;
            case 'weapon_toggle':
                if (typeof game.toggleDirectControlWeaponMode === 'function') {
                    return game.toggleDirectControlWeaponMode() === true;
                }
                return false;
            case 'eject': {
                const b = game.selectedBuilding;
                const canEject = !!(
                    b &&
                    b.type === 'bunker' &&
                    b.team === 'player' &&
                    Array.isArray(b.garrisonUnits) &&
                    b.garrisonUnits.length > 0
                );
                if (!canEject || typeof b.ejectAllGarrison !== 'function') return false;
                b.ejectAllGarrison();
                ui.showToast('?ÖÎöØ?ñÔßè???´ÎîÖÎª??Ë¢Å‚ë∑???ÑÏèÑ???');
                if (typeof game.updateHUDSelection === 'function') game.updateHUDSelection();
                return true;
            }
            default:
                return false;
        }
    },

    setupCommandButtons() {
        const cmdBtns = document.querySelectorAll('[data-hud-cmd]');
        cmdBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (btn.disabled) return;

                const role = btn.dataset.hudCmd;
                if (!role) return;

                let handled = false;
                if (role === 'cancel') {
                    handled = this.handleCancelCommand();
                } else {
                    const roleMap = this._resolvedCommandMap || this.resolveCommandRoleMap(this.getCommandContext());
                    const mapped = roleMap[role] || null;
                    if (mapped) handled = this.executeMappedCommand(mapped);
                }

                if (handled && typeof app !== 'undefined' && app && typeof app.markUiDirty === 'function') {
                    app.markUiDirty();
                }

                this._lastCmdState = '';
                this.updateCommandButtons();
            });
        });
    },

    updateCommandButtons() {
        const ctx = this.getCommandContext();
        this.updateTopCameraButton(ctx.cameraLocked);
        const roleMap = this.resolveCommandRoleMap(ctx);

        const stateKey = [
            `u:${ctx.selectedUnits.length}`,
            `b:${ctx.selectedBunker ? ctx.selectedBunker.garrisonUnits.length : 0}`,
            `cam:${ctx.cameraLocked ? 1 : 0}`,
            `t:${ctx.targetingType || '-'}`,
            `build:${ctx.buildModeActive ? 1 : 0}`,
            `recon:${ctx.hasRecon ? 1 : 0}`,
            `smoke:${ctx.hasSmokeCharge ? 1 : 0}`,
            `medkit:${ctx.hasMedkitCharge ? 1 : 0}`,
            `bagSel:${ctx.hasBagpiperSelection ? 1 : 0}`,
            `bagOn:${ctx.bagpipeSongActive ? 1 : 0}`,
            `bagCd:${Math.max(0, Number(ctx.bagpipeCooldownFrames) || 0)}`,
            `drop:${ctx.canDrop ? 1 : 0}`,
            `missile:${ctx.hasMissileCharge ? 1 : 0}`,
            `eject:${ctx.canEject ? 1 : 0}`,
            `dcA:${ctx.directControlActive ? 1 : 0}`,
            `dcS:${ctx.canDirectControlStart ? 1 : 0}`,
            `dcW:${ctx.directWeaponToggleInfo ? (ctx.directWeaponToggleInfo.currentMode || '-') : '-'}`,
            `mctrl:${ctx.mobileControlViewport ? 1 : 0}`,
            `droneS:${ctx.canDroneSuicide ? 1 : 0}`,
            `droneA:${ctx.canDroneAt ? 1 : 0}`,
            `opAt:${ctx.hasOperatorAtSkill ? 1 : 0}`,
            `s1:${roleMap.skill1 || '-'}`,
            `s2:${roleMap.skill2 || '-'}`,
            `s3:${roleMap.skill3 || '-'}`,
            `i:${roleMap.interact || '-'}`
        ].join('|');

        if (stateKey === this._lastCmdState) return;
        this._lastCmdState = stateKey;
        this._resolvedCommandMap = roleMap;

        this.renderMappedRoleButton('skill1', roleMap.skill1, ctx);
        this.renderMappedRoleButton('skill2', roleMap.skill2, ctx);
        this.renderMappedRoleButton('skill3', roleMap.skill3, ctx);
        this.renderMappedRoleButton('interact', roleMap.interact, ctx);
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
            this.elements.footer.classList.remove('hud-mobile-direct-active');
        }
        const topActions = this.elements.topActions || document.getElementById('hud-top-actions');
        if (topActions) topActions.classList.remove('hidden');
        [
            this.elements.allMoveBtn,
            this.elements.allRetreatBtn,
            this.elements.allDefenseBtn,
            this.elements.optionBtn,
            this.elements.cameraBtn,
            this.elements.cancelBtn
        ].forEach((btn) => {
            if (btn) btn.classList.remove('hidden');
        });
        this.setSkirmishRightSlotMode(false);
        this.updateSpeedButtons(game.speed);
        this.updateZoomDisplay();
        this.hideLegacyUI();
        this.updateProductionArea();
        this._lastCmdState = '';
        this.updateCommandButtons();
    },

    /**
     * Hide HUD (called when returning to map select)
     */
    hide() {
        this.setSkirmishRightSlotMode(false);
        this.hideProductionArea();
        if (this.elements.footer) {
            this.elements.footer.classList.remove('hud-mobile-direct-active');
            this.elements.footer.classList.add('hidden');
        }
        const topActions = this.elements.topActions || document.getElementById('hud-top-actions');
        if (topActions) topActions.classList.add('hidden');
        [
            this.elements.allMoveBtn,
            this.elements.allRetreatBtn,
            this.elements.allDefenseBtn,
            this.elements.optionBtn,
            this.elements.cameraBtn,
            this.elements.cancelBtn
        ].forEach((btn) => {
            if (btn) btn.classList.add('hidden');
        });
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
        const isHqLikeSelection = !!(
            selection &&
            selection.kind === 'building' &&
            (selection.buildingType === 'hq_player' || selection.buildingType === 'spawn_flag_player')
        );
        if (!isHqLikeSelection) {
            this._forceHqRightSlotOpen = false;
        }

        if (!selection) {
            info.innerHTML = '<span class="hud-placeholder-text">SELECT A UNIT/BUILDING</span>';
            this.updateProductionArea();
            this.updateCommandButtons();
            return;
        }

        if (selection.kind === 'unit') {
            info.innerHTML = `
                <div class="hud-selection-item">
                    <span class="hud-selection-type">UNIT</span>
                    <span class="hud-selection-name">${selection.name}</span>
                    <span class="hud-selection-count">${selection.count || 1}</span>
                </div>
            `;
        } else if (selection.kind === 'building') {
            const isHQ = (
                selection.team === 'player'
                && (selection.buildingType === 'hq_player' || selection.buildingType === 'spawn_flag_player')
            );
            const isBunker = (selection.buildingType === 'bunker');

            if (isHQ) {
                const label = (selection.buildingType === 'spawn_flag_player') ? 'SPAWN FLAG' : 'HQ';
                info.innerHTML = `<span class="hud-placeholder-text">${label}</span>`;
            } else if (isBunker && selection.building) {
                // [NEW] ?Î∫?Ä??•ÎúÆ?Ô¶ÑÍ≥å??Ô¶? ???´„Öé??????ÖÏä£?ÎΩ≥Ï≠ó??Í≥åÎûú????Á≠åÎ®≤?¢Ê≤Ö???Ôß?Îª?
                const b = selection.building;
                const garrisonCount = b.garrisonUnits ? b.garrisonUnits.length : 0;
                const maxGarrison = b.maxGarrison || 7;
                const defBonus = Math.min(35, garrisonCount * 5);
                const teamColor = b.team === 'neutral' ? '#64748b' : (b.team === 'player' ? '#3b82f6' : '#ef4444');
                const isDestroyed = b.isDestroyed || false;

                let statusHtml = '';
                if (!isDestroyed && garrisonCount > 0 && b.team === 'player') {
                    // [NEW] ??ÖÏä£?ÎΩ≥Ï≠ó??Í≥åÎûú??????™ÌÑÅÁ≠åÏûõ?????ôÍ∞≠Ôß?ùÑÏ≥??
                    const unitGroups = {};
                    b.garrisonUnits.forEach((u, idx) => {
                        if (!u || u.dead) return;
                        const id = u.stats?.id || 'unknown';
                        if (!unitGroups[id]) {
                            unitGroups[id] = { name: u.stats?.name || 'Unit', color: u.stats?.color || '#fff', count: 0, indices: [] };
                        }
                        unitGroups[id].count++;
                        unitGroups[id].indices.push(idx);
                    });

                    // ???™ÌÑÅÁ≠åÏûõ?????¨Í≥£Î´ÅÂ§∑??UI ??Ë´õÎåÅ??
                    let profileHtml = '';
                    for (const [id, group] of Object.entries(unitGroups)) {
                        profileHtml += `
                            <div class="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded">
                                <span style="color:${group.color}" class="text-xs font-bold">${group.name}</span>
                                <span class="text-white text-xs">x${group.count}</span>
                                <button data-eject-type="${id}" class="ml-1 px-1 bg-orange-600 hover:bg-orange-500 text-white text-[10px] rounded">-1</button>
                            </div>
                        `;
                    }

                    statusHtml = `
                        <div class="flex items-center gap-3">
                            <span class="hud-selection-type" style="background: ${teamColor}">BUILDING</span>
                            <span class="hud-selection-name">${selection.name}</span>
                            <span class="text-green-400 text-xs">+${defBonus}% DEF</span>
                        </div>
                        <div class="flex items-center gap-1 mt-1 flex-wrap">
                            ${profileHtml}
                            <button id="hud-eject-all-btn" class="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded">ALL EJECT</button>
                        </div>
                    `;
                } else {
                    statusHtml = `
                        <div class="flex items-center gap-3">
                            <span class="hud-selection-type" style="background: ${teamColor}">BUILDING</span>
                            <span class="hud-selection-name">${selection.name}</span>
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-white">GARRISON ${garrisonCount}/${maxGarrison}</span>
                        </div>
                    `;
                }

                info.innerHTML = `<div class="hud-selection-item">${statusHtml}</div>`;

                // [NEW] ??†Î£áË£???Íæ©Î£Ñ????Î∫?Ä??????Áπ???Íæ©Î£Ü????
                info.querySelectorAll('[data-eject-type]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const unitType = btn.dataset.ejectType;
                        if (b.ejectOneByType) {
                            b.ejectOneByType(unitType);
                            ui.showToast(`${unitType} 1???ÑÏèÑ???`);
                            game.updateHUDSelection();
                        }
                    });
                });

                // [NEW] ??¨Í≥£Î´???Íæ©Î£Ñ????Î∫?Ä??????Áπ???Íæ©Î£Ü????
                const ejectAllBtn = document.getElementById('hud-eject-all-btn');
                if (ejectAllBtn) {
                    ejectAllBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (b.ejectAllGarrison) {
                            b.ejectAllGarrison();
                            ui.showToast('?ÖÎöØ?ñÔßè???´ÎîÖÎª??Ë¢Å‚ë∑???ÑÏèÑ???');
                            game.updateHUDSelection();
                        }
                    });
                }
            } else {
                info.innerHTML = `
                    <div class="hud-selection-item">
                        <span class="hud-selection-type">BUILDING</span>
                        <span class="hud-selection-name">${selection.name}</span>
                    </div>
                `;
            }
        } else if (selection.kind === 'multi') {
            info.innerHTML = `<span style="color: #22c55e; font-weight: bold;">${selection.count} UNITS SELECTED</span>`;
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
        const buildingLabel = this.elements.buildingLabel;
        if (!productionArea || !unitPanel) return;

        const mobileDirectControlActive = this.isMobileDirectControlActive();
        if (footer) footer.classList.toggle('hud-mobile-direct-active', mobileDirectControlActive);

        if (typeof SkirmishMode !== 'undefined' && SkirmishMode && SkirmishMode.isActive) {
            const phase = String(SkirmishMode.phase || '').trim().toLowerCase();
            this.setSkirmishRightSlotMode(phase === 'placement' || phase === 'countdown');
            this.hideProductionArea();
            return;
        }

        const isHQSelected = !!(
            game.selectedBuilding &&
            (game.selectedBuilding.type === 'hq_player' || game.selectedBuilding.type === 'spawn_flag_player') &&
            game.selectedBuilding.team === 'player'
        );

        // Special tab is removed from combat UI.
        const tabSpecial = document.getElementById('tab-special');
        if (tabSpecial) {
            tabSpecial.style.display = 'none';
            tabSpecial.classList.add('hidden');
            if (game.currentCategory === 'special') {
                game.setCategory('infantry');
            }
        }

        // Mobile direct-control layout: hide unit production bar and expose command grid.
        if (mobileDirectControlActive) {
            this.hideProductionArea();
            return;
        }

        // Battle-only simplified layout:
        // keep unit production bar pinned at top-left by default.
        this.showHQProductionUI(productionArea, footer, buildingLabel, { dockToRight: false, forceBasicLabel: !isHQSelected });
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
     * Update pause button state
     */
    updatePauseButton(isPaused) {
        const btn = document.getElementById('hud-btn-pause');
        if (!btn) return;
        btn.classList.toggle('active', !!isPaused);
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
     * [P1] Uses dirty-checking to skip redundant draws
     */
    drawMinimap() {
        const cvs = this.elements.minimapCanvas;
        if (!cvs || !game.running) return;

        // Keep backing canvas size in sync with CSS size before dirty-check.
        // Without this, mobile resize/rotation can leave the minimap visually clipped.
        const rect = cvs.getBoundingClientRect();
        const clientW = Math.max(0, Math.round(rect.width));
        const clientH = Math.max(0, Math.round(rect.height));
        if (clientW === 0 || clientH === 0) return;

        const resized = (cvs.width !== clientW || cvs.height !== clientH);
        if (resized) {
            cvs.width = clientW;
            cvs.height = clientH;
        }

        // [P1] Build lightweight hash from entity counts + camera position
        // (full position hashing is too expensive)
        const camX = Math.round(game.cameraX / 50);
        const hash = `${game.buildings.length}|${game.players.length}|${game.enemies.length}|${camX}|${clientW}x${clientH}`;
        if (!resized && hash === this._lastMinimapHash) return;
        this._lastMinimapHash = hash;

        const ctx = cvs.getContext('2d');

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
    // [NEW] ???????Ô¶ÑÍ≥å????ïª??Î∫?Ä??????±¬Ä????Ë≤??
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

    getQuickHQProductionBuilding() {
        const buildings = Array.isArray(game?.buildings) ? game.buildings : [];
        const isValidPlayerBuilding = (b) => !!(b && !b.dead && b.team === 'player');

        // Prefer real HQ first.
        const hq = buildings.find((b) => isValidPlayerBuilding(b) && b.type === 'hq_player');
        if (hq) return hq;

        // Fallback to spawn flag (capture/special maps).
        const spawnFlag = buildings.find((b) => isValidPlayerBuilding(b) && b.type === 'spawn_flag_player');
        if (spawnFlag) return spawnFlag;
        return null;
    },

    openQuickHQProduction() {
        if (!game || !game.running || game.isGameOver) return false;

        const building = this.getQuickHQProductionBuilding();
        if (!building) return false;

        if (game.targetingType && typeof game.cancelTargeting === 'function') {
            game.cancelTargeting();
        }
        if (game.buildMode && game.buildMode.active && typeof game.cancelBuildMode === 'function') {
            game.cancelBuildMode();
        }

        if (typeof game.clearAllSelection === 'function') {
            game.clearAllSelection();
        } else if (game.selectedUnits && typeof game.selectedUnits.clear === 'function') {
            game.selectedUnits.clear();
        }

        game.selectedBuilding = building;
        this._forceHqRightSlotOpen = false;

        if (typeof game.updateHUDSelection === 'function') {
            game.updateHUDSelection();
        } else {
            this.setSelection({
                kind: 'building',
                name: building.name || building.type || 'Building',
                buildingType: building.type,
                building,
                hp: building.hp || 0,
                hpMax: building.maxHp || 100,
                team: building.team || 'player'
            });
        }

        this.setContextRightSlotMode(false);
        if (this.elements.footer) this.elements.footer.classList.add('hud-show-production');
        if (this.elements.unitPanel) {
            this.elements.unitPanel.classList.remove('hidden');
            this.elements.unitPanel.style.display = 'flex';
        }

        if (typeof app !== 'undefined' && app && typeof app.markUiDirty === 'function') {
            app.markUiDirty();
        }

        return true;
    },

    _applyRightSlotLayout() {
        const footer = this.elements.footer;
        const rightPanel = this.elements.rightPanel || document.getElementById('hud-right');
        const commandGrid = this.elements.commandGrid || document.getElementById('hud-command-grid');
        const unitPanel = this.elements.unitPanel;
        const originalParent = this.elements.unitPanelOriginalParent;

        const showUnitPanelInRight = !!(this._skirmishRightSlotPredeploy || this._contextRightSlotUnitPanel);
        if (footer) {
            footer.classList.toggle('hud-right-unitpanel-active', showUnitPanelInRight);
        }
        if (!rightPanel || !commandGrid || !unitPanel) return;

        if (showUnitPanelInRight) {
            if (!rightPanel.contains(unitPanel)) {
                rightPanel.appendChild(unitPanel);
            }
            commandGrid.classList.add('hidden');
            commandGrid.style.display = 'none';
            unitPanel.classList.remove('hidden');
            unitPanel.style.display = 'flex';
            return;
        }

        commandGrid.classList.remove('hidden');
        commandGrid.style.removeProperty('display');
        if (originalParent && !originalParent.contains(unitPanel)) {
            originalParent.insertBefore(
                unitPanel,
                this.elements.unitPanelOriginalNextSibling
            );
        }
        unitPanel.classList.add('hidden');
        unitPanel.style.display = 'none';
    },

    setSkirmishRightSlotMode(enabled) {
        this._skirmishRightSlotPredeploy = enabled === true;
        if (this.elements.footer) {
            this.elements.footer.classList.toggle('hud-skirmish-predeploy', this._skirmishRightSlotPredeploy);
        }
        this._applyRightSlotLayout();
    },

    setContextRightSlotMode(enabled) {
        this._contextRightSlotUnitPanel = enabled === true;
        this._applyRightSlotLayout();
    },

    hideProductionArea() {
        const productionArea = this.elements.productionArea;
        const footer = this.elements.footer;
        const buildingLabel = this.elements.buildingLabel;
        const unitPanel = this.elements.unitPanel;
        const keepRightSlotPanel = !!this._skirmishRightSlotPredeploy;
        this._forceHqRightSlotOpen = false;

        this.setContextRightSlotMode(false);

        if (productionArea) productionArea.innerHTML = '';

        if (!keepRightSlotPanel && unitPanel && this.elements.unitPanelOriginalParent) {
            if (!this.elements.unitPanelOriginalParent.contains(unitPanel)) {
                this.elements.unitPanelOriginalParent.insertBefore(
                    unitPanel,
                    this.elements.unitPanelOriginalNextSibling
                );
            }
            unitPanel.classList.add('hidden');
            unitPanel.style.display = 'none';
        }

        if (footer) footer.classList.remove('hud-show-production');
        if (buildingLabel) buildingLabel.textContent = '';
    },

    // [Ô¶´ÎöÆ?ÑÁ∂≠?∑Ï≠ó?C/D] HQ ???´„Öé???????´Î¥æÔß????¨Í≥£Î´???production area????¨Í≥£Î´???
    // worker??infantry ?Í≥∏Í∂†??Ë™ò„Öí??ŒºÏ™????????ÔßåÏö∞ÍΩ????´Î¥æÔß???????Ë´õÎåÑ????†Îüæ???
    showHQProductionUI(productionArea, footer, buildingLabel, options = null) {
        if (!productionArea) return;

        const unitPanel = this.elements.unitPanel;
        if (!unitPanel) return;
        const selectedType = String(game?.selectedBuilding?.type || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const dockToRight = opts.dockToRight === true;
        const forceBasicLabel = opts.forceBasicLabel === true;

        this.setContextRightSlotMode(dockToRight);

        productionArea.innerHTML = '';
        if (!dockToRight) {
            productionArea.appendChild(unitPanel);
            unitPanel.classList.remove('hidden');
            unitPanel.style.display = 'flex';
        }

        if (footer) footer.classList.toggle('hud-show-production', !dockToRight);
        if (buildingLabel) {
            const hasHqLike = selectedType === 'hq_player' || selectedType === 'spawn_flag_player';
            if (forceBasicLabel) {
                buildingLabel.textContent = 'UNIT PRODUCTION';
            } else {
                buildingLabel.textContent = hasHqLike ? 'HQ - UNIT PRODUCTION' : 'UNIT PRODUCTION';
            }
        }
    },

    // [NEW] ???´„Öé?????Ë´õÎåÑ??Ô¶ÑÍ≥å??Ô¶???†Îüæ??Á≠åÎ§æ?¥Ê≤ÖÎ°ßÎº®?
    getSelectedProductionBuilding() {
        if (!this.selection || this.selection.kind !== 'building') return null;
        if (!game.selectedBuilding) return null;

        const b = game.selectedBuilding;
        // canProduce ?????•ÏúúË´õÎ©•?? ????àÏ∏é Ô¶ÑÍ≥å??Ô¶©Î?Ï∂?(?Í≥åÎûú????†Ï∂π?Ê∫êÍªé?? ??¨Í≥£Î´ïËÄå„é´Îº®ËΩÖÎ™Ö¬Ä?)
        if (b.canProduce && b.productionTab && b.team === 'player') {
            return b;
        }
        return null;
    },

    // [NEW] ??Ë´õÎåÑ??Ô¶ÑÍ≥å??Ô¶?UI ??Ôß?Îª?
    showProductionBuildingUI(building, productionArea, footer, buildingLabel) {
        if (!productionArea) return;
        this.setContextRightSlotMode(false);

        const tab = building.productionTab; // 'infantry' or 'armored'
        const bData = CONFIG.constructable[building.type];
        const buildingName = bData ? bData.name : building.type;

        // ????????????´Î¥æÔß?Ô¶´ÎöÆ?ÑÁ∂≠ÎΩ®Îπ≥???†Îüæ??Á≠åÎ§æ?¥Ê≤ÖÎ°ßÎº®?
        const units = CONFIG.units;
        const tabUnits = [];

        for (const key in units) {
            const u = units[key];
            if (u.category === tab && !u.isBuilder && !u.isSkill) {
                tabUnits.push({ key, data: u });
            }
        }

        // ??™Ïòá??????®Î™ÉÎÆ?Ô¶´ÎöØ?????§Ïä¶????Ë´õÎåÑ???Î∫?Ä?????Ë´õÎåÅ??
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
                <span class="text-yellow-400 text-[10px]">SUP ${data.cost}</span>
                <span class="text-gray-300 text-[10px]">STK ${stockCount}</span>
            `;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (canAfford && inStock && !onCooldown) {
                    // Ô¶ÑÍ≥å??Ô¶????????´Î¥æÔß?????åÌèï
                    this.spawnFromBuilding(building, key);
                } else if (onCooldown) {
                    ui.showToast('?Î¨ÖÎ´Ç???È§?');
                } else if (!inStock) {
                    ui.showToast('??????Í≥∏Î≤â!');
                } else {
                    ui.showToast('??????Î¥î¬Ä??');
                }
            });

            btnContainer.appendChild(btn);
        }

        productionArea.appendChild(btnContainer);

        // ???§Í∞ù????Ôß?Îª?
        if (footer) footer.classList.add('hud-show-production');
        if (buildingLabel) buildingLabel.textContent = buildingName;
    },

    // [NEW] Ô¶ÑÍ≥å??Ô¶????????´Î¥æÔß?????åÌèï
    spawnFromBuilding(building, unitKey) {
        const uData = CONFIG.units[unitKey];
        if (!uData) return;

        // Check stock and resources
        if ((game.playerStock[unitKey] || 0) <= 0) {
            ui.showToast('No stock.');
            return;
        }
        if (game.supply < uData.cost) {
            ui.showToast('Not enough supply.');
            return;
        }
        if ((game.cooldowns[unitKey] || 0) > 0) {
            ui.showToast('On cooldown.');
            return;
        }

        // ????????Â´?????????†Î£Ü???
        game.supply -= uData.cost;
        game.playerStock[unitKey]--;
        game.cooldowns[unitKey] = uData.cooldown;

        // Ô¶ÑÍ≥å??Ô¶????®Î£ªÎ±??????åÌèï (Ô¶ÑÍ≥å??Ô¶?????é¬ÄÍø∞Ï∂Ø?+ ??Ë¢Å‚ë∫???????àÎíÜ??
        const spawnX = building.x + building.width / 2 + 30;
        const spawnY = game.groundY;

        game.spawnUnitDirect(unitKey, spawnX, spawnY, 'player');

        ui.showToast(`${uData.name} produced.`);
    },

    // [3.8] ??????????´„Öé??????†Î£Ü????Ô¶ÑÍ≥å????ïª??Î∫?Ä???(???´Î¥æÔßëÎ?ÎµìÊÄ®ÎöØÎ´????????®ÏÄ???????
    showBuildButtons(productionArea, footer, buildingLabel) {
        if (!productionArea) return;
        this.setContextRightSlotMode(false);

        const buildings = CONFIG.constructable || {};
        const worker = this.getSelectedWorker();

        // ??™Ïòá??????®Î™ÉÎÆ?Ô¶´ÎöØ?????§Ïä¶??Ô¶ÑÍ≥å??Ô¶??Î∫?Ä?????Ë´õÎåÅ??
        productionArea.innerHTML = '';

        const btnContainer = document.createElement('div');
        btnContainer.className = 'flex gap-2 items-center overflow-x-auto hide-scrollbar';
        btnContainer.style.cssText = 'padding: 4px; height: 100%;';

        // [3.8] watchtowerÔ¶???Ôß?Îª?
        for (const key in buildings) {
            if (key !== 'watchtower') continue;

            const bData = buildings[key];
            const canAfford = game.supply >= bData.cost;
            const onCooldown = game.builderCooldown > 0;
            const alreadyBuilt = game.watchtowerBuilt;  // [3.8] 1??Ô¶ÑÍ≥å????ïª?????´‚î∞ Ô¶´Îö≥???çÏπ∞?
            const isDisabled = !canAfford || onCooldown || alreadyBuilt;

            // [3.8] btn-unit ??????®ÏÄ???????(???´Î¥æÔßëÎ?ÎµìÊÄ®ÎöØÎ´???¢¬Ä?????∞ÎéÑ??????≤£??
            const btn = document.createElement('div');
            btn.className = 'btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg shrink-0 cursor-pointer select-none flex flex-col items-center justify-center';
            if (isDisabled) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            // Ô¶????????¨Í≥£Î´óÈÄ??(??™Ïòá?????†Î£Ü??????Î∏êÏä¶???- ??™Ïòá??êÎïü??Î∫?Ä??•ÎúÆ??????
            const iconCvs = document.createElement('canvas');
            iconCvs.width = 60;
            iconCvs.height = 40;
            iconCvs.className = 'absolute inset-0 m-auto';
            const ctx = iconCvs.getContext('2d');
            ctx.save();
            ctx.translate(30, 38);
            ctx.scale(0.16, 0.16);  // ??????Î∏åÌÄ???
            // ??™Ïòá???watchtower ??Î∏êÏä¶????????Ï∂?(buildings.js Ô¶´Îö£?Î≥?µ£??
            ctx.fillStyle = '#555';  // ??™Ïòá??êÎïü?
            ctx.fillRect(-25, -150, 50, 150);
            ctx.fillStyle = '#444';  // ?Íæ©Î£á?∑Îâì???
            ctx.fillRect(-45, -150, 90, 10);
            ctx.fillStyle = '#111';  // ??™Ïòá????
            ctx.fillRect(25, -185, 35, 6);
            ctx.fillStyle = '#666';  // ?Î∫?Ä??•ÎúÆ??Í≥åÎûúÔß?£®??
            ctx.fillRect(-40, -210, 80, 60);
            ctx.fillStyle = '#333';  // ????é¬ÄÍø∞Ï∂Ø??Íæ©Î†ÆÁ∂?Ä•Ï†ÜÊ∫ê¬Ä??
            ctx.fillRect(20, -220, 20, 70);
            ctx.fillStyle = '#444';  // Ô¶´ÎöØ????
            ctx.fillRect(-45, -220, 90, 10);
            ctx.restore();
            btn.appendChild(iconCvs);

            // ?????(?Á≠åÎ§æ?????????
            const nameSpan = document.createElement('span');
            nameSpan.className = 'font-bold text-[10px] z-10 absolute top-0 w-full text-center bg-black/30 text-white';
            nameSpan.innerText = (typeof Lang !== 'undefined') ? Lang.getText('build_watchtower_name') : bData.name;
            btn.appendChild(nameSpan);

            // ???????Ôß?Îª?
            const costSpan = document.createElement('span');
            costSpan.className = 'text-yellow-400 text-[10px] z-10 absolute bottom-1 right-1';
            costSpan.innerText = String(bData.cost);
            // [REQ] watchtowerÔ¶???????Ôß?Îª????
            if (key !== 'watchtower') {
                btn.appendChild(costSpan);
            }

            // [3.8] ???? Ô¶ÑÍ≥å????ïª??????ÅÎÆÖ???ÍπÖÌÑÑ
            if (alreadyBuilt) {
                const builtDiv = document.createElement('div');
                builtDiv.className = 'absolute inset-0 bg-gray-800/70 flex items-center justify-center z-20';
                builtDiv.innerHTML = '<span class="text-white text-[9px] font-bold">BUILT</span>';
                btn.appendChild(builtDiv);
            }
            // ??æÎÇÖÏ≥???????ÅÎÆÖ???ÍπÖÌÑÑ
            else if (onCooldown) {
                const cdDiv = document.createElement('div');
                cdDiv.className = 'cooldown-overlay';
                cdDiv.style.height = '100%';
                btn.appendChild(cdDiv);
            }

            // ??Êø°„É´????Î°´Îß©?Î°ßÎõæ?
            const colorBar = document.createElement('div');
            colorBar.className = 'absolute bottom-0 w-full h-1 z-10';
            colorBar.style.backgroundColor = alreadyBuilt ? '#6b7280' : '#3b82f6';
            btn.appendChild(colorBar);

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (alreadyBuilt) {
                    ui.showToast('?∂ÏèÖ≈ä???? 1???Ï∂?Ê§∞Íæ®?ªËãë??∂Ïéõ??È§®ÈçÆ????àÎºÑ!');
                } else if (worker && canAfford && !onCooldown) {
                    game.enterBuildMode(key, worker);
                } else if (onCooldown) {
                    ui.showToast('Ê§∞Íæ®?ªËãë??Î¨ÖÎ´Ç???È§?');
                } else if (!canAfford) {
                    ui.showToast('??????Î¥î¬Ä??');
                }
            });

            btnContainer.appendChild(btn);
        }

        // ???Ï≥???Î∫?Ä???(Ô¶ÑÍ≥å????ïª?Ô¶´ÎöÆ?ÑÁ∂≠???ÁπûÎ≤ø?¥ÌÉ≥???????
        if (game.buildMode && game.buildMode.active) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'px-3 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold';
            cancelBtn.innerText = 'Cancel';
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                game.cancelBuildMode();
            });
            btnContainer.appendChild(cancelBtn);
        }

        productionArea.appendChild(btnContainer);

        // ???§Í∞ù????Ôß?Îª?(?Á≠åÎ§æ?????????
        if (footer) footer.classList.add('hud-show-production');
        const workerName = (typeof Lang !== 'undefined') ? Lang.getText('unit_worker_name') : 'Worker';
        const towerName = (typeof Lang !== 'undefined') ? Lang.getText('build_watchtower_name') : 'Watchtower';
        if (buildingLabel) buildingLabel.textContent = `${workerName} - ${towerName} Build`;
    },

    /**
     * Hide legacy UI elements (replaced by new HUD)
     */
    hideLegacyUI() {
        // [3.8] Hide old minimap/toggle/ctrl/cmd buttons (???ÍπÜÏ†ß ?Î∫?Ä???? ???)
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

