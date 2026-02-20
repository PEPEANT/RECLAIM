/**
 * hud.js - Fixed Bottom HUD (StarCraft-style)
 *
 * ???堉??????
 * - HUD??"??戮?뻣 + ?뺢퀗????筌뤾봇遊뷸ㅀ?嶺??????
 * - ???깆젷 ??怨뺤쭢?? ?リ옇?????戮?츩??game, unit_commands)????臾먮뺄
 * - ??ルㅎ臾????裕??game 1?? HUD????戮?뻣嶺?
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
        cameraBtn: null
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
        this.elements.cameraBtn = document.getElementById('hud-camera-btn');

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

        const cameraBtn = this.elements.cameraBtn;
        if (cameraBtn) {
            cameraBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof game.toggleCameraLock !== 'function') return;
                game.toggleCameraLock();
                this._lastCmdState = '';
                this.updateCommandButtons();
                if (typeof app !== 'undefined' && app && typeof app.markUiDirty === 'function') {
                    app.markUiDirty();
                }
            });
        }
    },

    /**
     * Setup command buttons (connect to existing command system)
     */
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
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            this._unitCommandIconCache[key] = '';
            return '';
        }

        let drew = false;
        if (typeof Unit !== 'undefined') {
            try {
                ctx.save();

                const centerX = 32;
                const bottomY = 42;
                let scale = 0.82;
                let offsetY = -2;

                if (key === 'drone_suicide') {
                    scale = 1.02;
                    offsetY = -4;
                } else if (key === 'drone_at') {
                    scale = 0.96;
                    offsetY = -4;
                } else if (unitDef.type === 'air') {
                    scale = 0.72;
                    offsetY = -8;
                }

                ctx.translate(centerX, bottomY + offsetY);
                ctx.scale(scale, scale);

                const dummy = new Unit(key, 0, 0, 'player');
                dummy.hideHp = true;
                dummy.disableFeetSnap = true;
                dummy.iconRenderBackTurret = true;
                if (dummy.stats?.type === 'air') dummy.y = 0;
                dummy.draw(ctx);
                ctx.restore();
                drew = true;
            } catch (_) {
                try { ctx.restore(); } catch (_) { }
            }
        }

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
            case 'drop':
                return { key: 'cmd_drop', fallback: 'DROP', icon: 'fa-solid fa-arrow-down', targetingType: '__drop__' };
            case 'missile':
                return { key: 'cmd_missile', fallback: 'MISSILE', icon: 'fa-solid fa-rocket', targetingType: '__missile__' };
            case 'news':
                return { key: 'cmd_news', fallback: 'BROADCAST', icon: 'fa-solid fa-tower-broadcast', targetingType: '__news__' };
            case 'camera':
                return { key: 'cmd_camera', fallback: 'CAMERA', icon: 'fa-solid fa-video' };
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
        let hasCameraman = false;
        let hasMedkitCharge = false;

        selectedUnits.forEach(u => {
            const stats = u.stats || {};
            const id = stats.id;

            if (id === 'recon') hasRecon = true;
            // [ITEM] 연막탄: special_forces 기본 제거, smokeChargesLeft > 0인 모든 유닛 지원
            if ((u.smokeChargesLeft || 0) > 0) hasSmokeCharge = true;
            // [ITEM] 의료 키트: medkitChargesLeft > 0인 베테랑 유닛
            if ((u.medkitChargesLeft || 0) > 0) hasMedkitCharge = true;
            if (id && ['blackhawk', 'chinook', 'apc', 'humvee'].includes(id) && (u.transportDropsLeft || 0) > 0) {
                canDrop = true;
            }

            const supportsMissile = (typeof game.unitHasMissileCommand === 'function')
                ? game.unitHasMissileCommand(u)
                : (id === 'fighter');
            if (supportsMissile && (u.missileChargesLeft || 0) > 0) {
                hasMissileCharge = true;
            }

            if (u.isCameraman || stats.isCameraman) hasCameraman = true;
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

        return {
            selectedUnits,
            hasSelection: selectedUnits.length > 0,
            hasRecon,
            hasSmokeCharge,
            hasMedkitCharge,
            canDrop,
            hasMissileCharge,
            hasCameraman,
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
            selectedBunker,
            cameraLocked,
            targetingType: game.targetingType || null,
            buildModeActive: !!(game.buildMode && game.buildMode.active) || commandLockedByMode,
            canMove: selectedUnits.length > 0,
            canCamera: selectedUnits.length > 0 || cameraLocked
        };
    },

    getCurrentStance(units) {
        if (!Array.isArray(units) || units.length === 0) return 'forward';

        let forward = 0;
        let hold = 0;
        let backward = 0;
        units.forEach(u => {
            const mode = (u && u.commandMode) || 'attack';
            if (mode === 'retreat') backward++;
            else if (mode === 'stop') hold++;
            else forward++;
        });

        if (backward >= hold && backward >= forward) return 'backward';
        if (hold >= backward && hold >= forward) return 'hold';
        return 'forward';
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
            case 'drop': return !!ctx.canDrop;
            case 'missile': return !!ctx.hasMissileCharge;
            case 'news': return !!ctx.hasCameraman;
            case 'camera': return !!ctx.canCamera;
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

        if (ctx.hasSelectedIcbm) {
            map.skill1 = pick(['icbm_tactical', 'icbm_emp', 'icbm_nuke']);
            map.skill2 = pick(['icbm_emp', 'icbm_nuke', 'icbm_tactical']);
            map.skill3 = pick(['icbm_nuke', 'icbm_tactical', 'icbm_emp']);
            map.interact = pick(['drop', 'eject', 'news', 'recon']);
            return map;
        }

        if (ctx.hasOperatorSelection) {
            map.skill1 = 'drone_suicide';
            used.add('drone_suicide');
            if (ctx.hasOperatorAtSkill) {
                map.skill2 = 'drone_at';
                used.add('drone_at');
            } else {
                map.skill2 = pick(['smoke', 'missile', 'recon', 'news']);
            }
            map.skill3 = pick(['smoke', 'missile', 'recon', 'news']);
            const mode = (typeof game.getDroneControlMode === 'function')
                ? game.getDroneControlMode()
                : (game.droneControlMode === 'manual' ? 'manual' : 'auto');
            map.interact = (mode === 'manual') ? 'drone_auto' : 'drone_manual';
            return map;
        }

        map.skill1 = pick(['missile', 'smoke', 'medkit', 'recon', 'news']);
        map.skill2 = pick(['smoke', 'medkit', 'missile', 'news', 'recon']);
        map.skill3 = pick(['medkit', 'recon', 'news', 'missile', 'smoke']);
        map.interact = pick(['drop', 'eject', 'news', 'recon', 'missile', 'smoke', 'medkit']);

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
        this.setHudCommandButtonVisual(
            btn,
            iconClass,
            this.getLangText(meta.key, meta.fallback),
            iconImageUrl,
            useImageIcon ? (meta.iconImageClass || '') : ''
        );
        this.setHudButtonEnabled(btn, this.isMappedCommandAvailable(mappedCmd, ctx));

        const isActive = (mappedCmd === 'camera')
            ? !!ctx.cameraLocked
            : (meta.targetingType ? ctx.targetingType === meta.targetingType : false);
        btn.classList.toggle('active', isActive);
        btn.dataset.hudResolvedCmd = mappedCmd;
    },

    handleCancelCommand() {
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

    executeRetreatWithDroneRecall(units) {
        let droneRecalled = false;

        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (!u || u.dead) continue;
            if (u.stats?.id === 'drone_suicide' || u.stats?.id === 'drone_at' || u.stats?.category === 'drone') {
                if (typeof game.requestDroneRecall === 'function') {
                    if (game.requestDroneRecall(u)) droneRecalled = true;
                }
            }
        }

        if (!droneRecalled) {
            for (let i = 0; i < units.length; i++) {
                const u = units[i];
                if (!u || u.dead) continue;
                if (u.stats?.operator && typeof game.requestDroneRecall === 'function') {
                    const owned = (typeof game.getAliveOperatorDrones === 'function')
                        ? game.getAliveOperatorDrones(u)
                        : ((u.ownedDrone && !u.ownedDrone.dead) ? [u.ownedDrone] : []);
                    for (let j = 0; j < owned.length; j++) {
                        if (game.requestDroneRecall(owned[j])) droneRecalled = true;
                    }
                }
            }
        }

        if (!droneRecalled) {
            units.forEach(u => {
                if (!u || u.dead) return;
                u.commandMode = 'retreat';
                u.returnToBase = true;
            });
        }
    },

    applyStance(stance, units) {
        if (!Array.isArray(units) || units.length === 0) {
            ui.showToast('Select a unit first.');
            return false;
        }

        if (stance === 'backward') {
            this.executeRetreatWithDroneRecall(units);
        } else {
            const commandMode = (stance === 'hold') ? 'stop' : 'attack';
            units.forEach(u => {
                if (!u || u.dead) return;
                u.commandMode = commandMode;
                u.returnToBase = false;
            });
        }

        const stanceKey = (stance === 'hold')
            ? 'cmd_hold'
            : (stance === 'backward' ? 'cmd_backward' : 'cmd_forward');
        ui.showToast(`${this.getLangText('cmd_stance', 'STANCE')}: ${this.getLangText(stanceKey, stance.toUpperCase())}`);

        if (typeof game.updateHUDSelection === 'function') {
            game.updateHUDSelection();
        }
        return true;
    },

    handleStanceCommand() {
        const ctx = this.getCommandContext();
        if (!ctx.hasSelection || ctx.targetingType || ctx.buildModeActive) {
            if (!ctx.hasSelection) ui.showToast('Select a unit first.');
            return false;
        }

        const current = this.getCurrentStance(ctx.selectedUnits);
        const next = (current === 'forward')
            ? 'hold'
            : (current === 'hold' ? 'backward' : 'forward');

        return this.applyStance(next, ctx.selectedUnits);
    },

    handleFixedStanceCommand(targetStance) {
        if (!['forward', 'hold', 'backward'].includes(targetStance)) return false;
        const ctx = this.getCommandContext();
        if (!ctx.hasSelection || ctx.targetingType || ctx.buildModeActive) {
            if (!ctx.hasSelection) ui.showToast('Select a unit first.');
            return false;
        }
        return this.applyStance(targetStance, ctx.selectedUnits);
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
            case 'news':
                if (typeof game.prepareNewsCommand === 'function') {
                    game.prepareNewsCommand();
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
                ui.showToast('雅뚯눖紐??醫딅뻺 ?袁⑷퍥 獄쏄퀣??');
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
                if (role === 'forward' || role === 'hold' || role === 'backward') {
                    handled = this.handleFixedStanceCommand(role);
                } else if (role === 'cancel') {
                    handled = this.handleCancelCommand();
                } else if (role === 'stance') {
                    // Compatibility fallback for old markup; no longer used in fixed 3-button stance UI.
                    handled = this.handleStanceCommand();
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
        const stance = this.getCurrentStance(ctx.selectedUnits);

        const stateKey = [
            `u:${ctx.selectedUnits.length}`,
            `b:${ctx.selectedBunker ? ctx.selectedBunker.garrisonUnits.length : 0}`,
            `cam:${ctx.cameraLocked ? 1 : 0}`,
            `t:${ctx.targetingType || '-'}`,
            `build:${ctx.buildModeActive ? 1 : 0}`,
            `recon:${ctx.hasRecon ? 1 : 0}`,
            `smoke:${ctx.hasSmokeCharge ? 1 : 0}`,
            `medkit:${ctx.hasMedkitCharge ? 1 : 0}`,
            `drop:${ctx.canDrop ? 1 : 0}`,
            `missile:${ctx.hasMissileCharge ? 1 : 0}`,
            `news:${ctx.hasCameraman ? 1 : 0}`,
            `eject:${ctx.canEject ? 1 : 0}`,
            `droneS:${ctx.canDroneSuicide ? 1 : 0}`,
            `droneA:${ctx.canDroneAt ? 1 : 0}`,
            `opAt:${ctx.hasOperatorAtSkill ? 1 : 0}`,
            `stance:${stance}`,
            `s1:${roleMap.skill1 || '-'}`,
            `s2:${roleMap.skill2 || '-'}`,
            `s3:${roleMap.skill3 || '-'}`,
            `i:${roleMap.interact || '-'}`
        ].join('|');

        if (stateKey === this._lastCmdState) return;
        this._lastCmdState = stateKey;
        this._resolvedCommandMap = roleMap;

        const canStance = !!(ctx.hasSelection && !ctx.targetingType && !ctx.buildModeActive);
        const fixedStanceButtons = [
            { role: 'backward', key: 'cmd_backward', fallback: 'BACKWARD', icon: 'fa-solid fa-angles-left' },
            { role: 'hold', key: 'cmd_hold', fallback: 'HOLD', icon: 'fa-solid fa-hand' },
            { role: 'forward', key: 'cmd_forward', fallback: 'FORWARD', icon: 'fa-solid fa-angles-right' }
        ];

        fixedStanceButtons.forEach(def => {
            const btn = this.getHudCommandButton(def.role);
            if (!btn) return;
            this.setHudCommandButtonVisual(
                btn,
                def.icon,
                this.getLangText(def.key, def.fallback)
            );
            this.setHudButtonEnabled(btn, canStance);
            btn.classList.toggle('active', canStance && stance === def.role);
            btn.dataset.hudResolvedCmd = def.role;
        });

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
        }
        this.setSkirmishRightSlotMode(false);
        this.updateSpeedButtons(game.speed);
        this.updateZoomDisplay();
        this.hideLegacyUI();
        this.hideProductionArea();
        this._lastCmdState = '';
        this.updateCommandButtons();
    },

    /**
     * Hide HUD (called when returning to lobby)
     */
    hide() {
        this.setSkirmishRightSlotMode(false);
        this.hideProductionArea();
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
                // [NEW] ?뺢퀣?욥뜮?濾곌쑬?囹? ??ルㅎ臾????낅슣?뽳쭗??곌랜????筌먲퐢沅???戮?뻣
                const b = selection.building;
                const garrisonCount = b.garrisonUnits ? b.garrisonUnits.length : 0;
                const maxGarrison = b.maxGarrison || 7;
                const defBonus = Math.min(35, garrisonCount * 5);
                const teamColor = b.team === 'neutral' ? '#64748b' : (b.team === 'player' ? '#3b82f6' : '#ef4444');
                const isDestroyed = b.isDestroyed || false;

                let statusHtml = '';
                if (!isDestroyed && garrisonCount > 0 && b.team === 'player') {
                    // [NEW] ?낅슣?뽳쭗??곌랜?????リ턁筌잛옊???잙갭梨띄쳥??
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

                    // ??リ턁筌잛옊???熬곣뫁夷??UI ??諛댁뎽
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

                // [NEW] ?띠룇裕???꾩룄????뺢퀗??????繹???꾩룆????
                info.querySelectorAll('[data-eject-type]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const unitType = btn.dataset.ejectType;
                        if (b.ejectOneByType) {
                            b.ejectOneByType(unitType);
                            ui.showToast(`${unitType} 1疫?獄쏄퀣??`);
                            game.updateHUDSelection();
                        }
                    });
                });

                // [NEW] ?熬곣뫕???꾩룄????뺢퀗??????繹???꾩룆????
                const ejectAllBtn = document.getElementById('hud-eject-all-btn');
                if (ejectAllBtn) {
                    ejectAllBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (b.ejectAllGarrison) {
                            b.ejectAllGarrison();
                            ui.showToast('雅뚯눖紐??醫딅뻺 ?袁⑷퍥 獄쏄퀣??');
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

        // Keep veteran/special tab behavior unchanged
        const tabSpecial = document.getElementById('tab-special');
        const hasAnySelection = (game.selectedUnits && game.selectedUnits.size > 0) || game.selectedBuilding || this.checkWorkerSelected();

        if (tabSpecial) {
            if (isHQSelected) {
                tabSpecial.style.display = 'none';
                if (game.currentCategory === 'special') {
                    game.setCategory('infantry');
                }
            } else if (!hasAnySelection) {
                tabSpecial.style.display = '';
                game.setCategory('special');
            } else {
                tabSpecial.style.display = '';
            }
        }

        // Worker selected: show build actions
        const hasWorkerSelected = this.checkWorkerSelected();
        if (hasWorkerSelected) {
            this.showBuildButtons(productionArea, footer, buildingLabel);
            return;
        }

        // Production building selected: show building production
        const selectedBuilding = this.getSelectedProductionBuilding();
        if (selectedBuilding) {
            this.showProductionBuildingUI(selectedBuilding, productionArea, footer, buildingLabel);
            return;
        }

        // HQ selected: show unit production sheet
        if (isHQSelected) {
            this.showHQProductionUI(productionArea, footer, buildingLabel);
            return;
        }

        // Default: close sheet in combat
        this.hideProductionArea();
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
    // [NEW] ??얜????濾곌쑬?삭땻??뺢퀗?????㉱????貫??
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
        this._forceHqRightSlotOpen = true;

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

        this.setContextRightSlotMode(true);
        if (this.elements.footer) this.elements.footer.classList.remove('hud-show-production');
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

    // [嶺뚮ㅄ維싷쭗?C/D] HQ ??ルㅎ臾?????ル봾六???熬곣뫕???production area???熬곣뫁???
    // worker??infantry ?곸궠??誘ㅒ?μ쪚????????琉우꽑 ??ル봾六???????諛댄뀰 ?띠럾???
    showHQProductionUI(productionArea, footer, buildingLabel) {
        if (!productionArea) return;

        const unitPanel = this.elements.unitPanel;
        if (!unitPanel) return;
        const selectedType = String(game?.selectedBuilding?.type || '').trim();
        const isSpawnFlag = selectedType === 'spawn_flag_player';
        const forceRightSlot = this._forceHqRightSlotOpen === true;

        if (isSpawnFlag || forceRightSlot) {
            this.setContextRightSlotMode(true);
            productionArea.innerHTML = '';
            if (footer) footer.classList.remove('hud-show-production');
            if (buildingLabel) {
                const name = isSpawnFlag ? 'SPAWN FLAG' : 'HQ';
                buildingLabel.textContent = `${name} - UNIT PRODUCTION`;
            }
            return;
        }

        this.setContextRightSlotMode(false);

        productionArea.innerHTML = '';
        productionArea.appendChild(unitPanel);
        unitPanel.classList.remove('hidden');
        unitPanel.style.display = 'flex';

        if (footer) footer.classList.add('hud-show-production');
        if (buildingLabel) buildingLabel.textContent = 'HQ - UNIT PRODUCTION';
    },

    // [NEW] ??ルㅎ臾????諛댄뀰 濾곌쑬?囹??띠럾??筌뤾쑴沅롧뼨?
    getSelectedProductionBuilding() {
        if (!this.selection || this.selection.kind !== 'building') return null;
        if (!game.selectedBuilding) return null;

        const b = game.selectedBuilding;
        // canProduce ????뗥윜諛멥늾? ???덈츎 濾곌쑬?囹븀춯?(?곌랜???얠춹?源껎뀬, ?熬곣뫕而㎫뼨轅명?)
        if (b.canProduce && b.productionTab && b.team === 'player') {
            return b;
        }
        return null;
    },

    // [NEW] ??諛댄뀰 濾곌쑬?囹?UI ??戮?뻣
    showProductionBuildingUI(building, productionArea, footer, buildingLabel) {
        if (!productionArea) return;
        this.setContextRightSlotMode(false);

        const tab = building.productionTab; // 'infantry' or 'armored'
        const bData = CONFIG.constructable[building.type];
        const buildingName = bData ? bData.name : building.type;

        // ???????????ル봾六?嶺뚮ㅄ維뽨빳??띠럾??筌뤾쑴沅롧뼨?
        const units = CONFIG.units;
        const tabUnits = [];

        for (const key in units) {
            const u = units[key];
            if (u.category === tab && !u.isBuilder && !u.isSkill) {
                tabUnits.push({ key, data: u });
            }
        }

        // ?リ옇?????怨몃뮔 嶺뚯솘???⑤슦????諛댄뀰 ?뺢퀗?????諛댁뎽
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
                    // 濾곌쑬?囹???????ル봾六????덌폕
                    this.spawnFromBuilding(building, key);
                } else if (onCooldown) {
                    ui.showToast('?묅뫂???餓?');
                } else if (!inStock) {
                    ui.showToast('??????곸벉!');
                } else {
                    ui.showToast('?癒?뜚 ?봔鈺?');
                }
            });

            btnContainer.appendChild(btn);
        }

        productionArea.appendChild(btnContainer);

        // ??⑤객臾???戮?뻣
        if (footer) footer.classList.add('hud-show-production');
        if (buildingLabel) buildingLabel.textContent = buildingName;
    },

    // [NEW] 濾곌쑬?囹???????ル봾六????덌폕
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

        // ????????嫄????????띠룆흮??
        game.supply -= uData.cost;
        game.playerStock[unitKey]--;
        game.cooldowns[unitKey] = uData.cooldown;

        // 濾곌쑬?囹???怨룻뱺?????덌폕 (濾곌쑬?囹????섎꿰춯?+ ??袁⑺뜟?????덈뒆??
        const spawnX = building.x + building.width / 2 + 30;
        const spawnY = game.groundY;

        game.spawnUnitDirect(unitKey, spawnX, spawnY, 'player');

        ui.showToast(`${uData.name} produced.`);
    },

    // [3.8] ??얜??????ルㅎ臾????띠룆흮???濾곌쑬?삭땻??뺢퀗???(??ル봾六븀뵓怨뚯뫓???????怨쀬Ŧ ???逾?
    showBuildButtons(productionArea, footer, buildingLabel) {
        if (!productionArea) return;
        this.setContextRightSlotMode(false);

        const buildings = CONFIG.constructable || {};
        const worker = this.getSelectedWorker();

        // ?リ옇?????怨몃뮔 嶺뚯솘???⑤슦??濾곌쑬?囹??뺢퀗?????諛댁뎽
        productionArea.innerHTML = '';

        const btnContainer = document.createElement('div');
        btnContainer.className = 'flex gap-2 items-center overflow-x-auto hide-scrollbar';
        btnContainer.style.cssText = 'padding: 4px; height: 100%;';

        // [3.8] watchtower嶺???戮?뻣
        for (const key in buildings) {
            if (key !== 'watchtower') continue;

            const bData = buildings[key];
            const canAfford = game.supply >= bData.cost;
            const onCooldown = game.builderCooldown > 0;
            const alreadyBuilt = game.watchtowerBuilt;  // [3.8] 1??濾곌쑬?삭땻????ル┰ 嶺뚳퐢?얍칰?
            const isDisabled = !canAfford || onCooldown || alreadyBuilt;

            // [3.8] btn-unit ?????怨쀬Ŧ ???逾?(??ル봾六븀뵓怨뚯뫓??ぢ????됰뎄????뚮벣??
            const btn = document.createElement('div');
            btn.className = 'btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg shrink-0 cursor-pointer select-none flex flex-col items-center justify-center';
            if (isDisabled) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            // 嶺??????熬곣뫗逾??(?リ옇????띠룆흮?????븐슦???- ?リ옇?←땟??뺢퀣?욥뜮??????
            const iconCvs = document.createElement('canvas');
            iconCvs.width = 60;
            iconCvs.height = 40;
            iconCvs.className = 'absolute inset-0 m-auto';
            const ctx = iconCvs.getContext('2d');
            ctx.save();
            ctx.translate(30, 38);
            ctx.scale(0.16, 0.16);  // ??????브퀗???
            // ?リ옇???watchtower ??븐슦????????춯?(buildings.js 嶺뚣볦굣??
            ctx.fillStyle = '#555';  // ?リ옇?←땟?
            ctx.fillRect(-25, -150, 50, 150);
            ctx.fillStyle = '#444';  // ?꾩룇猷뉓눧??
            ctx.fillRect(-45, -150, 90, 10);
            ctx.fillStyle = '#111';  // ?リ옇????
            ctx.fillRect(25, -185, 35, 6);
            ctx.fillStyle = '#666';  // ?뺢퀣?욥뜮??곌랜梨루뙼?
            ctx.fillRect(-40, -210, 80, 60);
            ctx.fillStyle = '#333';  // ???섎꿰춯??꾩렮維쀥젆源由?
            ctx.fillRect(20, -220, 20, 70);
            ctx.fillStyle = '#444';  // 嶺뚯솘???
            ctx.fillRect(-45, -220, 90, 10);
            ctx.restore();
            btn.appendChild(iconCvs);

            // ???藥?(?筌뤾쑬????????
            const nameSpan = document.createElement('span');
            nameSpan.className = 'font-bold text-[10px] z-10 absolute top-0 w-full text-center bg-black/30 text-white';
            nameSpan.innerText = (typeof Lang !== 'undefined') ? Lang.getText('build_watchtower_name') : bData.name;
            btn.appendChild(nameSpan);

            // ???????戮?뻣
            const costSpan = document.createElement('span');
            costSpan.className = 'text-yellow-400 text-[10px] z-10 absolute bottom-1 right-1';
            costSpan.innerText = String(bData.cost);
            // [REQ] watchtower嶺???????戮?뻣 ???
            if (key !== 'watchtower') {
                btn.appendChild(costSpan);
            }

            // [3.8] ???? 濾곌쑬?삭땻?????댁뮅???깅턄
            if (alreadyBuilt) {
                const builtDiv = document.createElement('div');
                builtDiv.className = 'absolute inset-0 bg-gray-800/70 flex items-center justify-center z-20';
                builtDiv.innerHTML = '<span class="text-white text-[9px] font-bold">BUILT</span>';
                btn.appendChild(builtDiv);
            }
            // ?臾낅쳜??????댁뮅???깅턄
            else if (onCooldown) {
                const cdDiv = document.createElement('div');
                cdDiv.className = 'cooldown-overlay';
                cdDiv.style.height = '100%';
                btn.appendChild(cdDiv);
            }

            // ??濡ル펺 ??롫맩?롧뛾?
            const colorBar = document.createElement('div');
            colorBar.className = 'absolute bottom-0 w-full h-1 z-10';
            colorBar.style.backgroundColor = alreadyBuilt ? '#6b7280' : '#3b82f6';
            btn.appendChild(colorBar);

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (alreadyBuilt) {
                    ui.showToast('揶쏅Ŋ??臾? 1???춸 椰꾨똻苑?揶쎛?館鍮??덈뼄!');
                } else if (worker && canAfford && !onCooldown) {
                    game.enterBuildMode(key, worker);
                } else if (onCooldown) {
                    ui.showToast('椰꾨똻苑??묅뫂???餓?');
                } else if (!canAfford) {
                    ui.showToast('?癒?뜚 ?봔鈺?');
                }
            });

            btnContainer.appendChild(btn);
        }

        // ???쳛???뺢퀗???(濾곌쑬?삭땻?嶺뚮ㅄ維獄?繞벿살탳?????異?
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

        // ??⑤객臾???戮?뻣 (?筌뤾쑬????????
        if (footer) footer.classList.add('hud-show-production');
        const workerName = (typeof Lang !== 'undefined') ? Lang.getText('unit_worker_name') : 'Worker';
        const towerName = (typeof Lang !== 'undefined') ? Lang.getText('build_watchtower_name') : 'Watchtower';
        if (buildingLabel) buildingLabel.textContent = `${workerName} - ${towerName} Build`;
    },

    /**
     * Hide legacy UI elements (replaced by new HUD)
     */
    hideLegacyUI() {
        // [3.8] Hide old minimap/toggle/ctrl/cmd buttons (???깆젧 ?뺢퀗???? ???)
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

