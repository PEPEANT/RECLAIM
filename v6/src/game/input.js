// src/game/input.js - Input handling
(function () {
    'use strict';

    window.GameInput = {
        setup() {
            // [R 2.4] ????썹땟??????얜????影??낄癲?????怨몄７ ??嶺?筌??
            const getScaledPos = (clientX, clientY) => {
                return Camera.screenToView(this, clientX, clientY);
            };

            // [NEW] Check if click/touch is inside HUD area (input blocking)
            // Note: HUD footer can become fullscreen in desktop split mode,
            // so Y-only checks cause false positives and block all canvas input.
            const isInsideHUD = (clientX, clientY) => {
                const hudFooter = document.getElementById('hud-footer');
                if (!hudFooter || hudFooter.classList.contains('hidden')) return false;

                const isPointInside = (el) => {
                    if (!el || el.classList.contains('hidden')) return false;
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
                        return false;
                    }
                    const rect = el.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0) return false;
                    return (
                        clientX >= rect.left &&
                        clientX <= rect.right &&
                        clientY >= rect.top &&
                        clientY <= rect.bottom
                    );
                };

                // Explicit HUD interactive surfaces
                const hudInteractiveIds = [
                    'hud-left',
                    'hud-right',
                    'hud-production-area',
                    'hud-top-actions',
                    'hud-camera-btn',
                    'hud-option-btn',
                    'hud-minimap-container',
                    'hud-ctrl-wrapper',
                    'unit-cmd-wrapper',
                    'map-modal',
                    'scope-modal',
                    'mission-objective-modal',
                    'mobile-direct-ui',
                    'mobile-direct-toggle-btn'
                ];
                for (let i = 0; i < hudInteractiveIds.length; i++) {
                    const el = document.getElementById(hudInteractiveIds[i]);
                    if (isPointInside(el)) return true;
                }

                // Fallback for legacy/non-split footer layouts
                const footerRect = hudFooter.getBoundingClientRect();
                const viewportH = Math.max(1, window.innerHeight || 1);
                const footerLooksLikeBottomBar = (
                    footerRect.height > 0
                    && footerRect.top >= (viewportH * 0.5)
                    && footerRect.height <= (viewportH * 0.45)
                );
                if (footerLooksLikeBottomBar && clientY >= footerRect.top) return true;
                return false;
            };

            // Screen-space bounds check: independent from zoom/world conversion.
            // This keeps sky/top-area drag selectable when zoomed out.
            const isInsideCanvasClient = (clientX, clientY) => {
                const wrapper = document.getElementById('game-wrapper');
                const rect = wrapper ? wrapper.getBoundingClientRect() : this.canvas.getBoundingClientRect();
                const sx = (clientX - rect.left) / (this.scaleRatio || 1);
                const sy = (clientY - rect.top) / (this.scaleRatio || 1);
                return sx >= 0 && sx <= this.width && sy >= 0 && sy <= this.height;
            };

            const isTypingInField = () => {
                const active = document.activeElement;
                if (!active) return false;
                const tag = String(active.tagName || '').toUpperCase();
                return !!active.isContentEditable
                    || tag === 'INPUT'
                    || tag === 'TEXTAREA'
                    || tag === 'SELECT';
            };

            const DIRECT_CONTROL_KEY_MAP = {
                KeyW: 'w',
                KeyA: 'a',
                KeyS: 's',
                KeyD: 'd',
                KeyR: 'r',
                KeyF: 'f',
                ArrowLeft: 'arrowLeft',
                ArrowRight: 'arrowRight',
                ArrowUp: 'arrowUp',
                ArrowDown: 'arrowDown'
            };

            // ======== ????븐뻤????⑤슢堉???========
            // ??⑤㈇??癲????嶺뚮Ĳ?됪뤃??(PC ???關履숂뭐??/ ?꿔꺂??袁ㅻ븶???????????
            let cameraDrag = false;
            let cameraLastX = 0;
            let pcLeftPointerDown = false;
            let pcLeftPanActive = false;
            let pcLeftDownClientX = 0;
            let pcLeftDownClientY = 0;
            const PC_PAN_DEADZONE_PX = 8;

            // ????ｋ???熬곣뫖利당뵓????嶺뚮Ĳ?됪뤃??(PC ????裕?濡ろ떟???/ ?꿔꺂??袁ㅻ븶???????????
            this.selectDragActive = false;
            this.selectStartX = 0;
            this.selectStartY = 0;
            this.selectEndX = 0;
            this.selectEndY = 0;

            // Mobile gesture state:
            // - 1 finger tap: single select/command
            // - 1 finger drag: camera pan
            // - 2 finger drag/pinch: camera pan + zoom
            let isMobileSelecting = false;
            let isMobileCameraMove = false; // two-finger gesture active
            let isMobileSinglePan = false;  // one-finger camera pan active

            let pinchActive = false;
            let pinchStartDist = 0;
            let pinchStartZoom = Camera.zoom;
            let pinchAnchorClientX = 0;
            let pinchAnchorClientY = 0;
            let pinchLastDist = 0;
            let pinchLastMidViewX = 0;

            let mobilePrimaryTouchId = null;
            let mobileLongPressTimer = 0;
            let mobileLongPressTriggered = false;
            let mobileTapSuppressed = false;
            let mobileTouchStartAt = 0;

            let tapStartClientX = 0, tapStartClientY = 0;
            let tapLastClientX = 0, tapLastClientY = 0;
            const TAP_THRESHOLD_PX = 14;
            const MOBILE_PAN_DEADZONE_PX = 12;
            const MOBILE_LONGPRESS_MS = 220;

            // [MODIFIED] ?꿸쑨?????????ｋ??(????????ㅿ폎???꿸쑨?????鍮??꿸쑨?????????
            const selectBuildingAt = (wx, wy) => {
                // ????ｋ????醫딆쓧??嚥싳쇎紐???꿸쑨???????????猿딅즴
                const selectableTypes = [
                    'hq_player', 'hq_enemy', 'fortress_player', 'fortress_enemy',
                    'watchtower',  // [3.8] ????????ㅿ폎???꿸쑨?????鍮???醫딆┫????
                    'spawn_flag_player'
                ];

                for (let b of this.buildings) {
                    if (b.dead) continue;
                    // ???뚯?????????????canProduce ?????關?븀뛾?끘?? ?????됲닓 ?꿸쑨????꿎뫖???????ｋ????醫딆쓧???
                    if (!selectableTypes.includes(b.type) && !b.canProduce && !b.canShoot) continue;
                    // [FIX] ??????筌??????癲? (????裕??+20px, ????브컯??+15px)
                    const padX = 20;
                    const padY = 15;
                    if (wx > b.x - b.width / 2 - padX && wx < b.x + b.width / 2 + padX &&
                        wy > b.y - b.height - padY && wy < b.y + padY) {
                        this.selectedBuilding = b;
                        b.hideHp = false;
                        b.hpVisibleUntil = this.frame + 180;
                        // [NEW] Update HUD
                        this.updateHUDSelection();
                        return true;
                    }
                }
                this.selectedBuilding = null;
                // [NEW] Update HUD
                this.updateHUDSelection();
                return false;
            };
            // Alias for backward compatibility
            const selectHQAt = selectBuildingAt;

            const getSingleSelectedPlayerMbt = () => {
                if (!this.selectedUnits || this.selectedUnits.size !== 1) return null;
                const it = this.selectedUnits.values().next();
                const u = (it && !it.done) ? it.value : null;
                if (!u || u.dead || !u.stats) return null;
                if (u.team !== 'player' || u.stats.id !== 'mbt') return null;
                return u;
            };

            const getSingleSelectedPlayerSpg = () => {
                if (!this.selectedUnits || this.selectedUnits.size !== 1) return null;
                const it = this.selectedUnits.values().next();
                const u = (it && !it.done) ? it.value : null;
                if (!u || u.dead || !u.stats) return null;
                if (u.team !== 'player' || u.stats.id !== 'spg') return null;
                return u;
            };

            const getSingleSelectedPlayerManualArmor = () => {
                if (!this.selectedUnits || this.selectedUnits.size !== 1) return null;
                const it = this.selectedUnits.values().next();
                const u = (it && !it.done) ? it.value : null;
                if (!u || u.dead || !u.stats) return null;
                if (u.team !== 'player') return null;
                if (u.stats.id !== 'mbt' && u.stats.id !== 'spg') return null;
                return u;
            };

            const isUnitHitAt = (u, wx, wy) => {
                if (!u || u.dead) return false;
                const renderY = (typeof u.getRenderY === 'function')
                    ? Number(u.getRenderY())
                    : Number(u.y);
                const unitY = Number.isFinite(renderY) ? renderY : Number(u.y || 0);
                const halfW = Number(u.width || 0) / 2;
                const left = u.x - halfW;
                const right = u.x + halfW;
                const top = unitY - Number(u.height || 0);
                const bottom = unitY;
                return wx >= left && wx <= right && wy >= top && wy <= bottom;
            };

            const hasOtherPlayerUnitAt = (wx, wy, ignoreUnit) => {
                if (!Array.isArray(this.players)) return false;
                for (let i = this.players.length - 1; i >= 0; i--) {
                    const u = this.players[i];
                    if (!u || u === ignoreUnit || u.dead) continue;
                    if (isUnitHitAt(u, wx, wy)) return true;
                }
                return false;
            };

            const hasSelectableBuildingAt = (wx, wy) => {
                const selectableTypes = ['hq_player', 'hq_enemy', 'fortress_player', 'fortress_enemy', 'watchtower', 'spawn_flag_player'];
                if (!Array.isArray(this.buildings)) return false;
                for (let i = 0; i < this.buildings.length; i++) {
                    const b = this.buildings[i];
                    if (!b || b.dead) continue;
                    if (b.team !== 'player' && b.team !== 'neutral') continue;
                    if (!selectableTypes.includes(b.type) && !b.canProduce && !b.canShoot) continue;
                    const padX = 20;
                    const padY = 15;
                    if (wx > b.x - b.width / 2 - padX && wx < b.x + b.width / 2 + padX
                        && wy > b.y - b.height - padY && wy < b.y + padY) {
                        return true;
                    }
                }
                return false;
            };

            const updateManualTankAim = (tank, worldX, worldY) => {
                if (!tank) return;
                tank.manualAimX = worldX;
                tank.manualAimY = worldY;
                if (Number.isFinite(this.frame)) tank.manualAimFrame = this.frame;
            };

            const updateDirectControlAimFromClient = (clientX, clientY) => {
                if (typeof this.getDirectControlUnit !== 'function') return false;
                const directUnit = this.getDirectControlUnit();
                if (!directUnit || directUnit.dead || !directUnit.stats) return false;
                if (this.buildMode.active || this.targetingType) return false;
                if (!isInsideCanvasClient(clientX, clientY)) return false;

                const pAim = getScaledPos(clientX, clientY);
                const worldX = pAim.x + this.cameraX;
                const worldY = pAim.y;
                updateManualTankAim(directUnit, worldX, worldY);

                const dx = worldX - Number(directUnit.x || 0);
                if (Math.abs(dx) > 4) {
                    directUnit.facing = (dx >= 0) ? 1 : -1;
                }
                return true;
            };

            const clearManualTankMgHold = () => {
                if (!this.selectedUnits || this.selectedUnits.size <= 0) return;
                this.selectedUnits.forEach(u => {
                    if (!u || u.dead || !u.stats) return;
                    if (u.team === 'player' && u.stats.id === 'mbt') {
                        if (typeof u.stopManualTankMG === 'function') {
                            u.stopManualTankMG(true);
                        } else {
                            u.manualMgHeld = false;
                            if (typeof u._stopTankMGSound === 'function') u._stopTankMGSound();
                        }
                    }
                });
            };

            const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const getTouchMid = (t1, t2) => ({
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
            });

            const mobileDirectUi = (() => {
                const root = document.getElementById('mobile-direct-ui');
                const toggleBtn = document.getElementById('mobile-direct-toggle-btn');
                const toggleLabel = document.getElementById('mobile-direct-toggle-label');
                const statusEl = document.getElementById('mobile-direct-status');
                const attackBtn = document.getElementById('mobile-dc-attack');
                const stickZone = document.getElementById('mobile-dc-stick-zone');
                const stickKnob = document.getElementById('mobile-dc-stick-knob');
                const skillMap = [
                    { id: 'mobile-dc-skill1', hudId: 'hud-cmd-skill1' },
                    { id: 'mobile-dc-skill2', hudId: 'hud-cmd-skill2' },
                    { id: 'mobile-dc-skill3', hudId: 'hud-cmd-skill3' }
                ];

                const state = {
                    fireTimer: 0,
                    lastActive: false,
                    stickPointerId: null
                };
                const STICK_MAX_RADIUS = 34;
                const STICK_DEADZONE = 8;
                const STICK_AXIS_THRESHOLD = 0.32;

                const isMobileViewport = () => {
                    const coarse = (typeof window.matchMedia === 'function')
                        ? window.matchMedia('(pointer: coarse)').matches
                        : false;
                    if (!coarse) return false;
                    return window.innerWidth <= 1024;
                };

                const setMoveKey = (key, pressed) => {
                    if (typeof game.setDirectControlKeyState !== 'function') return;
                    game.setDirectControlKeyState(key, !!pressed);
                };

                const releaseMoveKeys = () => {
                    setMoveKey('w', false);
                    setMoveKey('a', false);
                    setMoveKey('s', false);
                    setMoveKey('d', false);
                };

                const setStickVisual = (x, y, active) => {
                    if (stickKnob) {
                        const tx = Math.round(Number(x) || 0);
                        const ty = Math.round(Number(y) || 0);
                        stickKnob.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
                    }
                    if (stickZone) {
                        stickZone.classList.toggle('active', !!active);
                    }
                };

                const resetStickVisual = () => {
                    setStickVisual(0, 0, false);
                };

                const applyStickMoveFromClient = (clientX, clientY) => {
                    if (!stickZone) return;
                    const rect = stickZone.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const dx = clientX - centerX;
                    const dy = clientY - centerY;
                    const dist = Math.hypot(dx, dy);

                    if (dist < STICK_DEADZONE) {
                        releaseMoveKeys();
                        resetStickVisual();
                        return;
                    }

                    const clamp = dist > STICK_MAX_RADIUS ? (STICK_MAX_RADIUS / dist) : 1;
                    const clampedX = dx * clamp;
                    const clampedY = dy * clamp;
                    setStickVisual(clampedX, clampedY, true);

                    const nx = dx / dist;
                    const ny = dy / dist;
                    setMoveKey('a', nx <= -STICK_AXIS_THRESHOLD);
                    setMoveKey('d', nx >= STICK_AXIS_THRESHOLD);
                    setMoveKey('w', ny <= -STICK_AXIS_THRESHOLD);
                    setMoveKey('s', ny >= STICK_AXIS_THRESHOLD);
                };

                const endStickControl = (e = null) => {
                    if (state.stickPointerId === null) {
                        releaseMoveKeys();
                        resetStickVisual();
                        return;
                    }
                    if (e && typeof e.pointerId === 'number' && e.pointerId !== state.stickPointerId) return;
                    if (stickZone && typeof stickZone.hasPointerCapture === 'function' && state.stickPointerId !== null) {
                        try {
                            if (stickZone.hasPointerCapture(state.stickPointerId)) {
                                stickZone.releasePointerCapture(state.stickPointerId);
                            }
                        } catch (_) { }
                    }
                    state.stickPointerId = null;
                    releaseMoveKeys();
                    resetStickVisual();
                };

                const updateStatus = (active) => {
                    if (!statusEl) return;
                    if (!active) {
                        statusEl.textContent = '조종 대기';
                        return;
                    }
                    const info = (typeof game.getDirectControlWeaponToggleInfo === 'function')
                        ? game.getDirectControlWeaponToggleInfo()
                        : null;
                    const currentLabel = String((info && info.currentLabel) || '').trim();
                    statusEl.textContent = currentLabel ? `무기: ${currentLabel}` : '무기: 주무장';
                };

                const stopAttackHold = () => {
                    if (state.fireTimer) {
                        window.clearInterval(state.fireTimer);
                        state.fireTimer = 0;
                    }
                    if (attackBtn) attackBtn.classList.remove('active');
                };

                const startAttackHold = () => {
                    stopAttackHold();
                    if (attackBtn) attackBtn.classList.add('active');
                    if (typeof game.directControlFireCurrentWeapon === 'function') {
                        game.directControlFireCurrentWeapon();
                        state.fireTimer = window.setInterval(() => {
                            if (typeof game.isDirectControlActive === 'function' && !game.isDirectControlActive()) {
                                stopAttackHold();
                                return;
                            }
                            game.directControlFireCurrentWeapon();
                        }, 170);
                    }
                };

                if (attackBtn) {
                    const onAttackStart = (e) => {
                        if (!isMobileViewport()) return;
                        if (typeof game.isDirectControlActive !== 'function' || !game.isDirectControlActive()) return;
                        e.preventDefault();
                        e.stopPropagation();
                        startAttackHold();
                    };
                    const onAttackEnd = (e) => {
                        if (e) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        stopAttackHold();
                    };
                    attackBtn.addEventListener('pointerdown', onAttackStart, { passive: false });
                    attackBtn.addEventListener('pointerup', onAttackEnd, { passive: false });
                    attackBtn.addEventListener('pointercancel', onAttackEnd, { passive: false });
                    attackBtn.addEventListener('pointerleave', onAttackEnd, { passive: false });
                }

                if (stickZone) {
                    const onStickDown = (e) => {
                        if (!isMobileViewport()) return;
                        if (typeof game.isDirectControlActive !== 'function' || !game.isDirectControlActive()) return;
                        e.preventDefault();
                        e.stopPropagation();
                        state.stickPointerId = e.pointerId;
                        if (typeof stickZone.setPointerCapture === 'function') {
                            try { stickZone.setPointerCapture(e.pointerId); } catch (_) { }
                        }
                        applyStickMoveFromClient(e.clientX, e.clientY);
                    };
                    const onStickMove = (e) => {
                        if (state.stickPointerId === null) return;
                        if (typeof e.pointerId === 'number' && e.pointerId !== state.stickPointerId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        applyStickMoveFromClient(e.clientX, e.clientY);
                    };
                    const onStickEnd = (e) => {
                        if (state.stickPointerId === null) return;
                        if (typeof e.pointerId === 'number' && e.pointerId !== state.stickPointerId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        endStickControl(e);
                    };
                    stickZone.addEventListener('pointerdown', onStickDown, { passive: false });
                    stickZone.addEventListener('pointermove', onStickMove, { passive: false });
                    stickZone.addEventListener('pointerup', onStickEnd, { passive: false });
                    stickZone.addEventListener('pointercancel', onStickEnd, { passive: false });
                    stickZone.addEventListener('pointerleave', onStickEnd, { passive: false });
                }

                skillMap.forEach(({ id, hudId }) => {
                    const btn = document.getElementById(id);
                    if (!btn) return;
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isMobileViewport()) return;
                        if (typeof game.isDirectControlActive !== 'function' || !game.isDirectControlActive()) return;
                        const hudBtn = document.getElementById(hudId);
                        if (hudBtn && !hudBtn.disabled) {
                            hudBtn.click();
                        }
                    });
                });

                const refresh = () => {
                    const mobile = isMobileViewport();
                    const active = mobile
                        && !!game.running
                        && !game.isGameOver
                        && (typeof game.isDirectControlActive === 'function')
                        && game.isDirectControlActive();
                    if (root) {
                        root.classList.toggle('hidden', !active);
                        root.setAttribute('aria-hidden', active ? 'false' : 'true');
                    }
                    if (toggleBtn) {
                        toggleBtn.classList.add('hidden');
                        toggleBtn.classList.remove('active');
                        toggleBtn.setAttribute('aria-hidden', 'true');
                    }
                    if (toggleLabel) {
                        toggleLabel.textContent = '';
                    }

                    updateStatus(active);

                    if (!active) {
                        endStickControl();
                        stopAttackHold();
                    }

                    if (state.lastActive !== active) {
                        state.lastActive = active;
                        if (typeof game.updateHUDSelection === 'function') {
                            game.updateHUDSelection();
                        }
                    }
                };

                const onViewportChange = () => { refresh(); };
                window.addEventListener('resize', onViewportChange);
                window.addEventListener('orientationchange', () => { setTimeout(onViewportChange, 80); });

                const syncTimer = window.setInterval(refresh, 180);
                if (root) root.__mobileDirectSyncTimer = syncTimer;
                refresh();

                return {
                    refresh,
                    release: () => {
                        endStickControl();
                        stopAttackHold();
                        refresh();
                    }
                };
            })();
            this.mobileDirectUi = mobileDirectUi;
            if (typeof window !== 'undefined') {
                window.MobileDirectControlUI = mobileDirectUi;
            }

            // ======== PC ?꿔꺂?????????嚥??========
            this.canvas.addEventListener('mousedown', e => {
                // [NEW] Block if inside HUD area
                if (isInsideHUD(e.clientX, e.clientY)) return;

                const p = getScaledPos(e.clientX, e.clientY);
                if (!isInsideCanvasClient(e.clientX, e.clientY)) return;
                const worldX = p.x + this.cameraX;
                const worldY = p.y;

                if (e.button === 2) {
                    const manualTank = getSingleSelectedPlayerMbt();
                    if (manualTank && !this.buildMode.active && !this.targetingType && !e.shiftKey) {
                        manualTank.manualMgHeld = true;
                        updateManualTankAim(manualTank, worldX, worldY);
                        if (typeof manualTank.tryManualTankMGFire === 'function') {
                            manualTank.tryManualTankMGFire(worldX, worldY);
                        }
                        return;
                    }

                    // [NEW] PC ???關履숂뭐?? ????ｋ??????ル뒇嶺??????(???뚯????RTS ?熬곣뫖?삥납??
                    if (typeof this.isDirectControlActive === 'function' && this.isDirectControlActive()) {
                        const directControlUnit = (typeof this.getDirectControlUnit === 'function')
                            ? this.getDirectControlUnit()
                            : null;
                        const directId = String((directControlUnit && directControlUnit.stats && directControlUnit.stats.id) || '');
                        if (directControlUnit && !this.buildMode.active && !this.targetingType) {
                            updateManualTankAim(directControlUnit, worldX, worldY);
                        }
                        // Direct-control drone operator: right click enemy to lockdown first.
                        if (directId === 'drone_operator' && !e.shiftKey) {
                            if (this.tryDroneLockdown && this.tryDroneLockdown(worldX, worldY)) {
                                return;
                            }
                        }
                        return;
                    }

                    if (this.selectedUnits && this.selectedUnits.size > 0 && !this.buildMode.active && !this.targetingType) {
                        // Drone operator UX: in manual drone mode, right-click enemy should assign lockdown
                        // before falling back to normal move command.
                        let hasOperatorSelected = false;
                        this.selectedUnits.forEach((u) => {
                            if (hasOperatorSelected) return;
                            if (!u || u.dead || !u.stats) return;
                            if (u.stats.operator === true || String(u.stats.id || '') === 'drone_operator') {
                                hasOperatorSelected = true;
                            }
                        });
                        if (hasOperatorSelected && this.tryDroneLockdown && this.tryDroneLockdown(worldX, worldY)) {
                            return;
                        }

                        clearManualTankMgHold();

                        const moveTargetY = (typeof this.clampGroundLaneY === 'function')
                            ? this.clampGroundLaneY(worldY)
                            : worldY;

                        this.selectedUnits.forEach(u => {
                            if (!u || u.dead) return;
                            u.commandMode = 'move';
                            u.commandTargetX = worldX; // ???熬곣뫖利??レ벁?????醫딆┣???(facing??
                            u.targetX = worldX;
                            u.targetY = (u.stats && u.stats.type === 'air') ? null : moveTargetY;
                            u.lockedTarget = null;
                            u.attackTarget = null;
                            if (u.stats && !u.stats.operator && (u.stats.category === 'drone' || (u.stats.id && u.stats.id.includes('drone')))) {
                                u.swarmTarget = { x: worldX, y: moveTargetY };
                            }
                        });

                        // particles + move marker
                        this.createParticles(worldX, moveTargetY - 10, 10, '#22c55e');
                        this.moveEffects = this.moveEffects || [];
                        this.moveEffects.push({ x: p.x, y: p.y, radius: 22, life: 1.0 });

                        return;
                    }

                    // (????ｋ??????ル뒇嶺?????ㅼ굡?類㎮뵾? ???關履숂뭐?? ??⑤㈇??癲????嶺뚮Ĳ?됪뤃?????
                    cameraDrag = true;
                    cameraLastX = p.x;
                } else if (e.button === 0) {
                    // [NEW] ?꿸쑨?????鍮??꿔꺂??袁ㅻ븶???嚥싳쉶瑗??꾧틡???レ탳???熬곣뫖利????꿔꺂??節뉖き??
                    if (this.buildMode.active) {
                        this.handleBuildPlacement(p.x + this.cameraX);
                        return;
                    }
                    // ????裕?濡ろ떟??? ???嚥▲굧????嚥싳쉶瑗??꾧틡???レ탳?????嚥▲굧?????꿔꺂??節뉖き??
                    if (this.targetingType) {
                        this.handleTargeting(p.x + this.cameraX, p.y);
                        return;
                    }
                    // ????ｋ???熬곣뫖利당뵓????嶺뚮Ĳ?됪뤃????嶺뚮??ｆ뤃?
                    const directControlUnit = (typeof this.getDirectControlUnit === 'function')
                        ? this.getDirectControlUnit()
                        : null;
                    const clickedPlayerUnit = hasOtherPlayerUnitAt(worldX, worldY, null);
                    const clickedSelectableBuilding = hasSelectableBuildingAt(worldX, worldY);
                    const shouldPrioritizeSelection = clickedPlayerUnit || clickedSelectableBuilding;
                    if (directControlUnit && directControlUnit.stats && !shouldPrioritizeSelection) {
                        const directId = String(directControlUnit.stats.id || '');
                        if (directId === 'mbt' && !e.shiftKey) {
                            updateManualTankAim(directControlUnit, worldX, worldY);
                            if (typeof directControlUnit.tryManualTankMainFire === 'function') {
                                directControlUnit.tryManualTankMainFire(worldX, worldY);
                            }
                            return;
                        }
                        if (directId === 'spg' && !e.shiftKey) {
                            updateManualTankAim(directControlUnit, worldX, worldY);
                            if (typeof directControlUnit.tryManualSpgMainFire === 'function') {
                                directControlUnit.tryManualSpgMainFire(worldX, worldY);
                            }
                            return;
                        }
                        if (directId === 'drone_operator' && !e.shiftKey) {
                            // Direct-control drone operator: left click prioritizes lockdown assignment.
                            updateManualTankAim(directControlUnit, worldX, worldY);
                            if (this.tryDroneLockdown && this.tryDroneLockdown(worldX, worldY)) {
                                return;
                            }
                            if (typeof this.directControlFireCurrentWeapon === 'function') {
                                this.directControlFireCurrentWeapon();
                            }
                            return;
                        }
                        return;
                    }

                    const manualTank = getSingleSelectedPlayerMbt();
                    if (manualTank && !e.shiftKey) {
                        updateManualTankAim(manualTank, worldX, worldY);
                        const clickedAnotherPlayerUnit = hasOtherPlayerUnitAt(worldX, worldY, manualTank);
                        const clickedSelectableBuilding = hasSelectableBuildingAt(worldX, worldY);
                        if (!clickedAnotherPlayerUnit && !clickedSelectableBuilding) {
                            if (typeof manualTank.tryManualTankMainFire === 'function') {
                                manualTank.tryManualTankMainFire(worldX, worldY);
                            }
                            return;
                        }
                    }

                    const manualSpg = getSingleSelectedPlayerSpg();
                    if (manualSpg && !e.shiftKey) {
                        updateManualTankAim(manualSpg, worldX, worldY);
                        const clickedAnotherPlayerUnit = hasOtherPlayerUnitAt(worldX, worldY, manualSpg);
                        const clickedSelectableBuilding = hasSelectableBuildingAt(worldX, worldY);
                        if (!clickedAnotherPlayerUnit && !clickedSelectableBuilding) {
                            if (typeof manualSpg.tryManualSpgMainFire === 'function') {
                                manualSpg.tryManualSpgMainFire(worldX, worldY);
                            }
                            return;
                        }
                    }

                    pcLeftPointerDown = true;
                    pcLeftPanActive = false;
                    pcLeftDownClientX = e.clientX;
                    pcLeftDownClientY = e.clientY;
                    cameraLastX = p.x;
                    this.selectDragActive = false;
                    this.selectStartX = worldX;
                    this.selectStartY = p.y;
                }
            });

            window.addEventListener('mousemove', e => {
                const p = getScaledPos(e.clientX, e.clientY);
                const worldX = p.x + this.cameraX;
                const worldY = p.y;

                // [NEW] ?꿸쑨?????鍮??꿔꺂??袁ㅻ븶???????썼キ?κ괌???????욍걛???ш끽維??
                if (this.buildMode.active) {
                    this.updateBuildPreview(p.x + this.cameraX, p.y);
                }

                // ??⑤㈇??癲????嶺뚮Ĳ?됪뤃??(???關履숂뭐??
                const manualArmor = getSingleSelectedPlayerManualArmor();
                if (manualArmor && !this.buildMode.active && !this.targetingType && isInsideCanvasClient(e.clientX, e.clientY)) {
                    updateManualTankAim(manualArmor, worldX, worldY);
                }
                const directControlUnit = (typeof this.getDirectControlUnit === 'function')
                    ? this.getDirectControlUnit()
                    : null;
                if (directControlUnit && !this.buildMode.active && !this.targetingType && isInsideCanvasClient(e.clientX, e.clientY)) {
                    updateManualTankAim(directControlUnit, worldX, worldY);
                }

                if (cameraDrag) {
                    this.cameraX -= (p.x - cameraLastX);
                    this.cameraX = Camera.clampCameraX(this, this.cameraX);
                    cameraLastX = p.x;
                }

                if (pcLeftPointerDown) {
                    if (!pcLeftPanActive) {
                        const moved = Math.hypot(e.clientX - pcLeftDownClientX, e.clientY - pcLeftDownClientY);
                        if (moved >= PC_PAN_DEADZONE_PX) {
                            pcLeftPanActive = true;
                        }
                    }
                    if (pcLeftPanActive) {
                        this.cameraX -= (p.x - cameraLastX);
                        this.cameraX = Camera.clampCameraX(this, this.cameraX);
                        cameraLastX = p.x;
                    }
                }
            });

            window.addEventListener('mouseup', e => {
                if (e.button === 2) {
                    cameraDrag = false;
                    clearManualTankMgHold();
                } else if (e.button === 0 && pcLeftPointerDown) {
                    const wasPan = pcLeftPanActive;
                    pcLeftPointerDown = false;
                    pcLeftPanActive = false;
                    this.selectDragActive = false;
                    if (wasPan) return;

                    const clickX = this.selectStartX;
                    const clickY = this.selectStartY;
                    if (this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY)) return;
                    if (selectHQAt(clickX, clickY)) return;
                    const unitClicked = this.checkUnitClick && this.checkUnitClick(clickX, clickY);
                    if (unitClicked) { this.selectedBuilding = null; return; }
                    if (this.checkBuildingClick) this.checkBuildingClick(clickX, clickY);
                    if (this.clearAllSelection) this.clearAllSelection();
                    this.selectedBuilding = null;
                }
            });

            // ???關履숂뭐???꿔꺂???????꿔꺂?볟젆怨곷븶???+ ??嶺뚮Ĳ????꿔꺂??琉몃쨨???+ ?꿸쑨?????鍮???????
            window.addEventListener('blur', () => {
                cameraDrag = false;
                pcLeftPointerDown = false;
                pcLeftPanActive = false;
                this._cameraPanLeftKey = false;
                this._cameraPanRightKey = false;
                clearManualTankMgHold();
                if (typeof this.clearDirectControlKeys === 'function') {
                    this.clearDirectControlKeys();
                }
                if (this.mobileDirectUi && typeof this.mobileDirectUi.release === 'function') {
                    this.mobileDirectUi.release();
                }
            });

            this.canvas.addEventListener('contextmenu', e => {
                e.preventDefault();
                clearManualTankMgHold();
                // [NEW] Block if inside HUD area
                if (isInsideHUD(e.clientX, e.clientY)) return;

                // [NEW] ?꿸쑨?????鍮??꿔꺂??袁ㅻ븶?????????
                if (this.buildMode.active) {
                    this.cancelBuildMode();
                    ui.showToast('嫄댁꽕 痍⑥냼');
                    return;
                }

                // Right-click movement is already handled in mousedown(right button).
                // Do not issue extra drone orders here (prevents duplicate/global drone commands).
            });

            this.canvas.addEventListener('wheel', e => {
                e.preventDefault();
                const step = e.deltaY < 0 ? Camera.STEP : -Camera.STEP;
                const newZoom = Camera.zoom + step;
                const prevZoom = Camera.zoom;
                Camera.applyZoomWithAnchor(this, newZoom, e.clientX, e.clientY);
                if (Camera.zoom !== prevZoom) this.updateZoomUI();
            }, { passive: false });

            // ======== Mobile Touch Gesture Handling ========
            const clearMobileLongPressTimer = () => {
                if (mobileLongPressTimer) {
                    window.clearTimeout(mobileLongPressTimer);
                    mobileLongPressTimer = 0;
                }
            };

            const runTapSelectionAtClient = (clientX, clientY) => {
                const pTap = getScaledPos(clientX, clientY);
                const clickX = pTap.x + this.cameraX;
                const clickY = pTap.y;

                if (this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY)) return true;
                if (selectHQAt(clickX, clickY)) return true;

                const unitClicked = this.checkUnitClick
                    && this.checkUnitClick(clickX, clickY, { keepSelectedOnRepeatTap: true });
                if (unitClicked) {
                    this.selectedBuilding = null;
                    return true;
                }

                if (this.checkBuildingClick) this.checkBuildingClick(clickX, clickY);
                if (this.clearAllSelection) this.clearAllSelection();
                this.selectedBuilding = null;
                return true;
            };

            this.canvas.addEventListener('touchstart', e => {
                e.preventDefault();

                // Block if any touch starts inside HUD area.
                for (let i = 0; i < e.touches.length; i++) {
                    if (isInsideHUD(e.touches[i].clientX, e.touches[i].clientY)) return;
                }

                if (e.touches.length === 1) {
                    const t = e.touches[0];
                    if (!isInsideCanvasClient(t.clientX, t.clientY)) return;

                    clearMobileLongPressTimer();
                    isMobileCameraMove = false;
                    isMobileSinglePan = false;
                    isMobileSelecting = false;
                    this.selectDragActive = false;
                    pinchActive = false;
                    pinchLastDist = 0;
                    mobileLongPressTriggered = false;
                    mobileTapSuppressed = false;
                    mobilePrimaryTouchId = t.identifier;
                    mobileTouchStartAt = (typeof performance !== 'undefined' && performance.now)
                        ? performance.now()
                        : Date.now();

                    tapStartClientX = tapLastClientX = t.clientX;
                    tapStartClientY = tapLastClientY = t.clientY;

                    const p = getScaledPos(t.clientX, t.clientY);
                    const touchWorldX = p.x + this.cameraX;
                    const touchWorldY = p.y;

                    if (this.buildMode.active) {
                        this.updateBuildPreview(p.x + this.cameraX, p.y);
                        this.handleBuildPlacement(p.x + this.cameraX);
                        mobileTapSuppressed = true;
                        return;
                    }

                    if (this.targetingType) {
                        this.handleTargeting(p.x + this.cameraX, p.y);
                        mobileTapSuppressed = true;
                        return;
                    }

                    const directControlUnit = (typeof this.getDirectControlUnit === 'function')
                        ? this.getDirectControlUnit()
                        : null;
                    const directControlId = String((directControlUnit && directControlUnit.stats && directControlUnit.stats.id) || '');
                    const directControlActive = !!(
                        typeof this.isDirectControlActive === 'function'
                        && this.isDirectControlActive()
                    );

                    if (directControlActive) {
                        const tappedPlayerUnit = hasOtherPlayerUnitAt(touchWorldX, touchWorldY, null);
                        const tappedSelectableBuilding = hasSelectableBuildingAt(touchWorldX, touchWorldY);
                        if (tappedPlayerUnit || tappedSelectableBuilding) {
                            // Keep tap-selection path so touching a unit instantly switches control.
                            mobileTapSuppressed = false;
                            return;
                        }
                        updateDirectControlAimFromClient(t.clientX, t.clientY);
                        // Drone operator keeps tap-to-fire / lockdown on touchend.
                        if (directControlId !== 'drone_operator') {
                            mobileTapSuppressed = true;
                        }
                        return;
                    }

                    return;
                }

                if (e.touches.length >= 2) {
                    clearMobileLongPressTimer();
                    mobilePrimaryTouchId = null;
                    mobileTapSuppressed = true;

                    isMobileSelecting = false;
                    this.selectDragActive = false;
                    isMobileSinglePan = false;
                    isMobileCameraMove = true;

                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const mid = getTouchMid(t1, t2);

                    pinchActive = true;
                    pinchStartDist = getTouchDist(t1, t2);
                    pinchLastDist = pinchStartDist;
                    pinchStartZoom = Camera.zoom;
                    pinchAnchorClientX = mid.x;
                    pinchAnchorClientY = mid.y;

                    const pMid = getScaledPos(mid.x, mid.y);
                    pinchLastMidViewX = pMid.x;
                    cameraLastX = pMid.x;
                }
            }, { passive: false });

            window.addEventListener('touchmove', e => {
                if (e.touches.length === 1) {
                    const t = e.touches[0];
                    tapLastClientX = t.clientX;
                    tapLastClientY = t.clientY;

                    // Direct-control aim touch follow.
                    if (!isMobileSelecting
                        && typeof this.isDirectControlActive === 'function'
                        && this.isDirectControlActive()) {
                        e.preventDefault();
                        updateDirectControlAimFromClient(t.clientX, t.clientY);
                        return;
                    }

                    // If we just ended a two-finger gesture and one finger remains,
                    // continue with one-finger camera pan.
                    if (isMobileCameraMove) {
                        const p = getScaledPos(t.clientX, t.clientY);
                        isMobileCameraMove = false;
                        isMobileSinglePan = true;
                        mobileTapSuppressed = true;
                        cameraLastX = p.x;
                        return;
                    }

                    const movedPx = Math.hypot(t.clientX - tapStartClientX, t.clientY - tapStartClientY);
                    if (!isMobileSinglePan && !mobileLongPressTriggered && movedPx >= MOBILE_PAN_DEADZONE_PX) {
                        clearMobileLongPressTimer();
                        isMobileSinglePan = true;
                        mobileTapSuppressed = true;
                        const p = getScaledPos(t.clientX, t.clientY);
                        cameraLastX = p.x;
                    }

                    if (isMobileSinglePan) {
                        e.preventDefault();
                        const p = getScaledPos(t.clientX, t.clientY);
                        this.cameraX -= (p.x - cameraLastX);
                        this.cameraX = Camera.clampCameraX(this, this.cameraX);
                        cameraLastX = p.x;
                    }
                    return;
                }

                if (e.touches.length >= 2) {
                    clearMobileLongPressTimer();
                    mobileTapSuppressed = true;
                    mobilePrimaryTouchId = null;
                    isMobileCameraMove = true;
                    isMobileSinglePan = false;
                    isMobileSelecting = false;
                    this.selectDragActive = false;

                    e.preventDefault();
                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const dist = getTouchDist(t1, t2);
                    const mid = getTouchMid(t1, t2);

                    // Incremental pinch zoom (stable) around current midpoint.
                    if (pinchActive && pinchLastDist > 0) {
                        const scale = dist / pinchLastDist;
                        if (Number.isFinite(scale) && scale > 0) {
                            const prevZoom = Camera.zoom;
                            Camera.applyZoomWithAnchor(this, Camera.zoom * scale, mid.x, mid.y);
                            if (Camera.zoom !== prevZoom) this.updateZoomUI();
                        }
                    } else if (pinchStartDist > 0) {
                        const prevZoom = Camera.zoom;
                        const newZoom = pinchStartZoom * (dist / pinchStartDist);
                        Camera.applyZoomWithAnchor(this, newZoom, pinchAnchorClientX, pinchAnchorClientY);
                        if (Camera.zoom !== prevZoom) this.updateZoomUI();
                    }
                    pinchActive = true;
                    pinchLastDist = dist;

                    // Two-finger pan by midpoint delta (X-axis map pan).
                    const pMid = getScaledPos(mid.x, mid.y);
                    this.cameraX -= (pMid.x - pinchLastMidViewX);
                    this.cameraX = Camera.clampCameraX(this, this.cameraX);
                    pinchLastMidViewX = pMid.x;
                    return;
                }
            }, { passive: false });

            window.addEventListener('touchend', e => {
                clearMobileLongPressTimer();

                const ct = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
                const endClientX = ct ? ct.clientX : tapLastClientX;
                const endClientY = ct ? ct.clientY : tapLastClientY;
                const movedPx = Math.hypot(endClientX - tapStartClientX, endClientY - tapStartClientY);

                if (!isMobileSinglePan && !isMobileCameraMove && !mobileTapSuppressed) {
                    if (movedPx < TAP_THRESHOLD_PX) {
                        const directControlUnit = (typeof this.getDirectControlUnit === 'function')
                            ? this.getDirectControlUnit()
                            : null;
                        const directControlId = String((directControlUnit && directControlUnit.stats && directControlUnit.stats.id) || '');
                        const isDirectControlOperator = !!(
                            directControlUnit
                            && directControlId === 'drone_operator'
                            && typeof this.isDirectControlActive === 'function'
                            && this.isDirectControlActive()
                        );
                        if (isDirectControlOperator) {
                            const pTap = getScaledPos(endClientX, endClientY);
                            const clickX = pTap.x + this.cameraX;
                            const clickY = pTap.y;
                            const tappedPlayerUnit = hasOtherPlayerUnitAt(clickX, clickY, null);
                            const tappedSelectableBuilding = hasSelectableBuildingAt(clickX, clickY);
                            if (tappedPlayerUnit || tappedSelectableBuilding) {
                                runTapSelectionAtClient(endClientX, endClientY);
                            } else if (!(this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY))) {
                                if (typeof this.directControlFireCurrentWeapon === 'function') {
                                    this.directControlFireCurrentWeapon();
                                }
                            }
                        } else {
                            runTapSelectionAtClient(endClientX, endClientY);
                        }
                    }
                }

                if (e.touches.length === 0) {
                    isMobileCameraMove = false;
                    isMobileSinglePan = false;
                    isMobileSelecting = false;
                    cameraDrag = false;
                    pinchActive = false;
                    pinchLastDist = 0;
                    mobilePrimaryTouchId = null;
                    mobileLongPressTriggered = false;
                    mobileTapSuppressed = false;
                    this.selectDragActive = false;
                } else if (e.touches.length < 2) {
                    pinchActive = false;
                    pinchLastDist = 0;
                    isMobileCameraMove = false;
                }
            });

            window.addEventListener('touchcancel', () => {
                clearMobileLongPressTimer();
                isMobileCameraMove = false;
                isMobileSinglePan = false;
                isMobileSelecting = false;
                pinchActive = false;
                pinchLastDist = 0;
                mobilePrimaryTouchId = null;
                mobileLongPressTriggered = false;
                mobileTapSuppressed = false;
                this.selectDragActive = false;
            });

            // [NEW] ESC ????寃??꿸쑨?????鍮????嚥▲굧?????꿔꺂??袁ㅻ븶?????????
            window.addEventListener('keydown', e => {
                const typingInField = isTypingInField();
                const directMappedKey = DIRECT_CONTROL_KEY_MAP[e.code];
                if (!typingInField && directMappedKey && typeof this.setDirectControlKeyState === 'function') {
                    this.setDirectControlKeyState(directMappedKey, true);
                    if (typeof this.isDirectControlActive === 'function' && this.isDirectControlActive()) {
                        e.preventDefault();
                    }
                }

                if (!typingInField && e.code === 'KeyQ') {
                    this._cameraPanLeftKey = true;
                    e.preventDefault();
                    return;
                }
                if (!typingInField && e.code === 'KeyE') {
                    this._cameraPanRightKey = true;
                    e.preventDefault();
                    return;
                }

                if (typingInField && e.key !== 'Escape') return;

                if (e.key === 'Escape') {
                    if (typeof ui !== 'undefined'
                        && ui
                        && typeof ui.handleEscapeShortcut === 'function'
                        && ui.handleEscapeShortcut(e, this)) {
                        return;
                    }
                    if (typeof this.isDirectControlActive === 'function'
                        && this.isDirectControlActive()
                        && typeof this.stopDirectControl === 'function') {
                        this.stopDirectControl('escape');
                        if (this.mobileDirectUi && typeof this.mobileDirectUi.refresh === 'function') {
                            this.mobileDirectUi.refresh();
                        }
                        e.preventDefault();
                        return;
                    }
                    if (this.buildMode.active) {
                        this.cancelBuildMode();
                        ui.showToast('嫄댁꽕 痍⑥냼');
                    } else if (this.targetingType) {
                        this.cancelTargeting();
                    }
                    return;
                }

                if (e.key === 'p' || e.key === 'P') {
                    if (e.repeat) return;
                    const now = (performance.now ? performance.now() : Date.now());
                    const windowMs = 700;
                    if (now - (this._devLastPPressAt || 0) <= windowMs) {
                        this._devPPressCount = (this._devPPressCount || 0) + 1;
                    } else {
                        this._devPPressCount = 1;
                    }
                    this._devLastPPressAt = now;
                    if (this._devPPressCount >= 2) {
                        this._devPPressCount = 0;
                        this.enableDevUnlockAllMaps();
                    }
                }
            });

            window.addEventListener('keyup', e => {
                if (e.code === 'KeyQ') {
                    this._cameraPanLeftKey = false;
                    return;
                }
                if (e.code === 'KeyE') {
                    this._cameraPanRightKey = false;
                    return;
                }
                const directMappedKey = DIRECT_CONTROL_KEY_MAP[e.code];
                if (directMappedKey && typeof this.setDirectControlKeyState === 'function') {
                    this.setDirectControlKeyState(directMappedKey, false);
                }
            });
        }
    };
})();


