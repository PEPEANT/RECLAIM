// src/game/input.js - Input handling
(function () {
    'use strict';

    window.GameInput = {
        setup() {
            // [R 2.4] ????썹땟??????얜????影??낄癲?????怨몄７ ??嶺?筌??
            const getScaledPos = (clientX, clientY) => {
                return Camera.screenToView(this, clientX, clientY);
            };

            const getClientScaleInfo = () => {
                const wrapper = document.getElementById('game-wrapper');
                const rect = wrapper
                    ? wrapper.getBoundingClientRect()
                    : this.canvas.getBoundingClientRect();
                const viewW = Math.max(1, Number(this.width) || 1);
                const viewH = Math.max(1, Number(this.height) || 1);
                const scaleX = Math.max(0.0001, rect.width / viewW);
                const scaleY = Math.max(0.0001, rect.height / viewH);
                return { rect, scaleX, scaleY };
            };

            // [NEW] Check if click/touch is inside HUD area (input blocking)
            // Note: HUD footer can become fullscreen in desktop split mode,
            // so Y-only checks cause false positives and block all canvas input.
            const isInsideHUD = (clientX, clientY) => {
                const hudFooter = document.getElementById('hud-footer');
                if (!hudFooter || hudFooter.classList.contains('hidden')) return false;

                // Prefer topmost hit-test first.
                // Only treat truly interactive HUD elements as blocking.
                let topEl = null;
                try {
                    topEl = document.elementFromPoint(clientX, clientY);
                } catch (_) { }
                const isHudActionElement = (el) => {
                    if (!el) return false;
                    const hardBlockRoot = [
                        '#map-modal',
                        '#scope-modal',
                        '#mission-objective-modal',
                        '#mobile-direct-ui',
                        '#mobile-direct-toggle-btn',
                        '#mobile-camera-tilt-control'
                    ].join(',');
                    if (typeof el.closest === 'function' && el.closest(hardBlockRoot)) return true;

                    // Guard: camera-tilt slider must only block input inside its visible control box.
                    // Without this, transformed slider hit-area can swallow unit taps around it.
                    const tiltSliderHit = !!(
                        (el.id === 'mobile-camera-tilt-slider')
                        || (typeof el.closest === 'function' && el.closest('#mobile-camera-tilt-slider'))
                    );
                    if (tiltSliderHit) {
                        const tiltRoot = document.getElementById('mobile-camera-tilt-control');
                        if (tiltRoot) {
                            const rr = tiltRoot.getBoundingClientRect();
                            const insideTiltRoot = (
                                clientX >= rr.left
                                && clientX <= rr.right
                                && clientY >= rr.top
                                && clientY <= rr.bottom
                            );
                            if (!insideTiltRoot) return false;
                        }
                    }

                    const actionSelector = [
                        'button',
                        'a[href]',
                        'input',
                        'select',
                        'textarea',
                        'label',
                        '[role="button"]',
                        '[data-hud-cmd]',
                        '[data-speed]',
                        '[data-unit-key]',
                        '.hud-cmd-btn',
                        '.hud-ctrl-btn',
                        '.btn-unit',
                        '.btn-category',
                        '.prod-btn',
                        '.mobile-direct-action-btn',
                        '#mobile-dc-stick-zone',
                        '#mobile-dc-attack',
                        '#mobile-camera-tilt-slider'
                    ].join(',');

                    if (typeof el.matches === 'function' && el.matches(actionSelector)) return true;
                    if (typeof el.closest === 'function' && el.closest(actionSelector)) return true;
                    if (typeof el.closest === 'function'
                        && el.closest('#hud-minimap-container, #hud-camera-btn, #hud-option-btn')) return true;
                    return false;
                };
                if (topEl && isHudActionElement(topEl)) {
                    return true;
                }

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

                // Explicit HUD interactive surfaces.
                // Keep this list tight: full-width wrappers (hud-left/right/footer) can block unit touches
                // even when the user taps transparent areas above the canvas.
                const hudInteractiveIds = [
                    'hud-camera-btn',
                    'hud-option-btn',
                    'hud-minimap-container',
                    'map-modal',
                    'scope-modal',
                    'mission-objective-modal',
                    'mobile-direct-ui',
                    'mobile-direct-toggle-btn',
                    'mobile-camera-tilt-control',
                    'mobile-camera-tilt-slider'
                ];
                for (let i = 0; i < hudInteractiveIds.length; i++) {
                    const el = document.getElementById(hudInteractiveIds[i]);
                    if (isPointInside(el)) return true;
                }

                // Do not block by full footer rect.
                // Footer wrappers can be wide/transparent and were swallowing infantry taps near ground.
                return false;
            };

            // Screen-space bounds check: independent from zoom/world conversion.
            // This keeps sky/top-area drag selectable when zoomed out.
            const isInsideCanvasClient = (clientX, clientY) => {
                const scaleInfo = getClientScaleInfo();
                const sx = (clientX - scaleInfo.rect.left) / scaleInfo.scaleX;
                const sy = (clientY - scaleInfo.rect.top) / scaleInfo.scaleY;
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
                ShiftLeft: 'shift',
                ShiftRight: 'shift',
                ArrowLeft: 'arrowLeft',
                ArrowRight: 'arrowRight',
                ArrowUp: 'arrowUp',
                ArrowDown: 'arrowDown'
            };

            const isFinePointer = () => {
                try {
                    return !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
                } catch (_) {
                    return false;
                }
            };

            const clearSelectionForPcEsc = () => {
                if (!isFinePointer()) return false;
                const hasUnitSelection = !!(this.selectedUnits && this.selectedUnits.size > 0);
                const hasBuildingSelection = !!this.selectedBuilding;
                if (!hasUnitSelection && !hasBuildingSelection) return false;
                if (typeof this.clearAllSelection === 'function') {
                    this.clearAllSelection();
                } else {
                    if (this.selectedUnits && typeof this.selectedUnits.clear === 'function') {
                        this.selectedUnits.clear();
                    }
                    this.selectedBuilding = null;
                    if (typeof this.updateHUDSelection === 'function') this.updateHUDSelection();
                }
                this.selectedBuilding = null;
                if (typeof this.updateHUDSelection === 'function') this.updateHUDSelection();
                return true;
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
            let pinchLastMidClientX = 0;

            let mobilePrimaryTouchId = null;
            let mobileLongPressTimer = 0;
            let mobileLongPressTriggered = false;
            let mobileTapSuppressed = false;
            let mobileTouchStartAt = 0;
            let lastTouchInputAt = 0;
            let mobileTouchStartedOnSelectable = false;

            let tapStartClientX = 0, tapStartClientY = 0;
            let tapLastClientX = 0, tapLastClientY = 0;
            // Mobile tap should be forgiving; small finger drift must still count as selection.
            const TAP_THRESHOLD_PX = 34;
            const MOBILE_PAN_DEADZONE_PX = 24;
            const MOBILE_PAN_DEADZONE_ON_SELECTABLE_PX = 36;
            const MOBILE_LONGPRESS_MS = 220;
            const GHOST_MOUSE_BLOCK_MS = 900;

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

            const detectCoarseLikePointer = () => {
                let coarsePointer = false;
                let touchCapable = false;
                try {
                    coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
                } catch (_) { }
                try {
                    touchCapable = (typeof navigator !== 'undefined')
                        ? ((Number(navigator.maxTouchPoints) || 0) > 0)
                        : false;
                } catch (_) { }
                return !!(coarsePointer || touchCapable);
            };

            const getUnitHitTestApi = () => {
                const api = this && this._unitHitTest;
                return (api && typeof api === 'object') ? api : null;
            };

            const isUnitHitAt = (u, wx, wy, opts = null) => {
                const hitApi = getUnitHitTestApi();
                const options = (opts && typeof opts === 'object') ? opts : {};
                const coarseLike = (typeof options.coarseLike === 'boolean')
                    ? options.coarseLike
                    : detectCoarseLikePointer();
                const nearPxRaw = Number(options.nearPx);
                const nearPx = (Number.isFinite(nearPxRaw) && nearPxRaw > 0)
                    ? nearPxRaw
                    : (coarseLike ? 20 : 16);

                if (hitApi && typeof hitApi.hit === 'function') {
                    if (hitApi.hit(u, wx, wy, false)) return true;
                    if (coarseLike && hitApi.hit(u, wx, wy, true)) return true;
                    if (typeof hitApi.near === 'function') return !!hitApi.near(u, wx, wy, nearPx);
                    return false;
                }

                if (!u || u.dead) return false;
                const halfW = Math.max(10, (Number(u.width) || 20) * 0.7);
                const bodyH = Math.max(12, (Number(u.height) || 20) * 1.0);
                const renderY = (typeof u.getRenderY === 'function')
                    ? Number(u.getRenderY())
                    : Number(u.y);
                const unitY = Number.isFinite(renderY) ? renderY : Number(u.y || 0);
                const left = (Number(u.x) || 0) - halfW;
                const right = (Number(u.x) || 0) + halfW;
                const top = unitY - bodyH;
                const bottom = unitY + 8;
                return (wx >= left && wx <= right && wy >= top && wy <= bottom);
            };

            const getOtherPlayerUnitAt = (wx, wy, ignoreUnit = null, opts = null) => {
                const hitApi = getUnitHitTestApi();
                const options = (opts && typeof opts === 'object') ? opts : {};
                const coarseLike = (typeof options.coarseLike === 'boolean')
                    ? options.coarseLike
                    : detectCoarseLikePointer();
                const clientX = Number(options.clientX);
                const clientY = Number(options.clientY);
                const hasClientPoint = Number.isFinite(clientX) && Number.isFinite(clientY);
                if (hitApi && typeof hitApi.getPlayerUnitAt === 'function') {
                    if (hasClientPoint && typeof hitApi.getPlayerUnitAtClient === 'function') {
                        const viaClient = hitApi.getPlayerUnitAtClient(clientX, clientY, {
                            ignoreUnit,
                            includeSoft: options.includeSoft !== false,
                            includeNear: options.includeNear !== false,
                            includeFarNear: options.includeFarNear !== false,
                            preferNearest: options.preferNearest !== false,
                            nearPx: Number.isFinite(Number(options.nearPx))
                                ? Number(options.nearPx)
                                : (coarseLike ? 20 : 16),
                            forceNearRadiusPx: Number.isFinite(Number(options.forceNearRadiusPx))
                                ? Number(options.forceNearRadiusPx)
                                : (coarseLike ? 92 : 62),
                            coarseLike
                        });
                        // Client-space picking is the authoritative path when client coordinates are known.
                        // Avoid world-space fallback (zoom-dependent) to keep hit behavior stable.
                        return viaClient || null;
                    }
                    return hitApi.getPlayerUnitAt(wx, wy, {
                        ignoreUnit,
                        includeSoft: options.includeSoft !== false,
                        includeNear: options.includeNear !== false,
                        includeFarNear: options.includeFarNear !== false,
                        preferNearest: options.preferNearest !== false,
                        nearPx: Number.isFinite(Number(options.nearPx))
                            ? Number(options.nearPx)
                            : (coarseLike ? 20 : 16),
                        forceNearRadiusPx: Number.isFinite(Number(options.forceNearRadiusPx))
                            ? Number(options.forceNearRadiusPx)
                            : (coarseLike ? 92 : 62),
                        coarseLike
                    });
                }

                if (!Array.isArray(this.players)) return null;
                for (let i = this.players.length - 1; i >= 0; i--) {
                    const u = this.players[i];
                    if (!u || u.dead || u === ignoreUnit) continue;
                    if (isUnitHitAt(u, wx, wy, { coarseLike })) return u;
                }
                return null;
            };

            const hasOtherPlayerUnitAt = (wx, wy, ignoreUnit, opts = null) => {
                return !!getOtherPlayerUnitAt(wx, wy, ignoreUnit, opts);
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
            const canStartMobilePinch = (touchList) => {
                if (!touchList || touchList.length < 2) return false;
                const t1 = touchList[0];
                const t2 = touchList[1];
                if (!t1 || !t2) return false;
                if (!isInsideCanvasClient(t1.clientX, t1.clientY) || !isInsideCanvasClient(t2.clientX, t2.clientY)) {
                    return false;
                }
                if (isInsideHUD(t1.clientX, t1.clientY) || isInsideHUD(t2.clientX, t2.clientY)) {
                    return false;
                }
                return true;
            };
            const beginMobilePinch = (t1, t2) => {
                if (!t1 || !t2) return false;
                const dist = getTouchDist(t1, t2);
                if (!Number.isFinite(dist) || dist <= 0.001) return false;
                const mid = getTouchMid(t1, t2);

                clearMobileLongPressTimer();
                mobilePrimaryTouchId = null;
                mobileTapSuppressed = true;

                isMobileSelecting = false;
                this.selectDragActive = false;
                isMobileSinglePan = false;
                isMobileCameraMove = true;

                pinchActive = true;
                pinchStartDist = dist;
                pinchLastDist = dist;
                pinchStartZoom = Camera.zoom;
                pinchAnchorClientX = mid.x;
                pinchAnchorClientY = mid.y;

                pinchLastMidClientX = mid.x;
                const pMid = getScaledPos(mid.x, mid.y);
                cameraLastX = pMid.x;
                return true;
            };

            const mobileDirectUi = (() => {
                const root = document.getElementById('mobile-direct-ui');
                const toggleBtn = document.getElementById('mobile-direct-toggle-btn');
                const toggleLabel = document.getElementById('mobile-direct-toggle-label');
                const statusEl = document.getElementById('mobile-direct-status');
                const stanceBtn = document.getElementById('mobile-dc-stance');
                const stanceLabel = document.getElementById('mobile-dc-stance-label');
                const attackBtn = document.getElementById('mobile-dc-attack');
                const skillWrap = document.querySelector('.mobile-direct-skill-wrap');
                const pcHintEl = document.getElementById('pc-direct-wasd-hint');
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
                    stickPointerId: null,
                    lastAutoStartUnit: null,
                    lastAutoStartAt: 0
                };
                const STICK_MAX_RADIUS = 21;
                const STICK_DEADZONE = 5;
                const STICK_AXIS_THRESHOLD = 0.32;
                const MOBILE_ATTACK_REPEAT_MS = 210;

                const isMobileViewport = () => {
                    const coarse = (typeof window.matchMedia === 'function')
                        ? window.matchMedia('(pointer: coarse)').matches
                        : false;
                    const touchCapable = (typeof navigator !== 'undefined')
                        ? ((Number(navigator.maxTouchPoints) || 0) > 0)
                        : false;
                    if (!coarse && !touchCapable) return false;
                    const w = Math.max(0, Number(window.innerWidth) || 0);
                    const h = Math.max(0, Number(window.innerHeight) || 0);
                    const shortestSide = Math.min(w, h);
                    return shortestSide <= 1366;
                };
                const isFinePointerViewport = () => {
                    try {
                        return !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
                    } catch (_) {
                        return false;
                    }
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
                        }, MOBILE_ATTACK_REPEAT_MS);
                    }
                };

                if (attackBtn) {
                    const onAttackStart = (e) => {
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

                const syncSkillButtons = (active) => {
                    let visibleCount = 0;
                    skillMap.forEach(({ id, hudId }) => {
                        const mobileBtn = document.getElementById(id);
                        const hudBtn = document.getElementById(hudId);
                        if (!mobileBtn) return;

                        const mappedCmd = String((hudBtn && hudBtn.dataset && hudBtn.dataset.hudResolvedCmd) || '').trim();
                        const hudHidden = !!(hudBtn && hudBtn.classList && hudBtn.classList.contains('hidden'));
                        const shouldShow = !!(active && hudBtn && mappedCmd && !hudHidden);

                        mobileBtn.classList.toggle('hidden', !shouldShow);
                        mobileBtn.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
                        mobileBtn.disabled = !shouldShow || !!(hudBtn && hudBtn.disabled);

                        if (!shouldShow) return;
                        visibleCount += 1;

                        const hudIcon = hudBtn.querySelector('.cmd-icon');
                        const hudLabelNode = hudBtn.querySelector('span:last-child');
                        const mobileIcon = mobileBtn.querySelector('.mobile-direct-action-icon');
                        const mobileLabel = mobileBtn.querySelector('.mobile-direct-action-label');
                        const hudLabel = hudLabelNode ? String(hudLabelNode.textContent || '').trim() : '';
                        if (mobileIcon && hudIcon) mobileIcon.innerHTML = hudIcon.innerHTML;
                        if (mobileLabel) mobileLabel.textContent = hudLabel;
                    });

                    if (skillWrap) {
                        skillWrap.classList.toggle('hidden', !active || visibleCount <= 0);
                        skillWrap.setAttribute('aria-hidden', (!active || visibleCount <= 0) ? 'true' : 'false');
                    }
                };

                const syncStanceButton = (active) => {
                    if (!stanceBtn) return;
                    const info = (typeof game.getDirectControlInfantryStanceInfo === 'function')
                        ? game.getDirectControlInfantryStanceInfo()
                        : null;
                    const enabled = !!(active && info && info.enabled);
                    stanceBtn.classList.toggle('hidden', !enabled);
                    stanceBtn.setAttribute('aria-hidden', enabled ? 'false' : 'true');
                    stanceBtn.disabled = !enabled;
                    if (!enabled) return;

                    const nextStance = String(info.next || '').trim().toLowerCase();
                    const currentStance = String(info.current || '').trim().toLowerCase();
                    if (stanceLabel) {
                        stanceLabel.textContent = (nextStance === 'crouching') ? '앉' : '서';
                    }
                    stanceBtn.classList.toggle('active', currentStance === 'crouching');
                    const nextLabel = String(info.nextLabel || '').trim();
                    const currentLabel = String(info.currentLabel || '').trim();
                    const title = nextLabel ? `${currentLabel} -> ${nextLabel}` : currentLabel;
                    stanceBtn.setAttribute('aria-label', title || 'Stance');
                    stanceBtn.title = title || 'Stance';
                };

                skillMap.forEach(({ id, hudId }) => {
                    const btn = document.getElementById(id);
                    if (!btn) return;
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof game.isDirectControlActive !== 'function' || !game.isDirectControlActive()) return;
                        if (btn.disabled || btn.classList.contains('hidden')) return;
                        const hudBtn = document.getElementById(hudId);
                        if (hudBtn && !hudBtn.disabled) {
                            hudBtn.click();
                        }
                    });
                });

                if (stanceBtn) {
                    stanceBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof game.isDirectControlActive !== 'function' || !game.isDirectControlActive()) return;
                        if (stanceBtn.disabled || stanceBtn.classList.contains('hidden')) return;
                        if (typeof game.toggleDirectControlInfantryStance === 'function') {
                            game.toggleDirectControlInfantryStance();
                        }
                    });
                }

                const refresh = () => {
                    const mobile = isMobileViewport();
                    const finePointer = isFinePointerViewport();
                    const pcViewport = !mobile && finePointer;
                    const canUseMobileDirect = (mobile || pcViewport)
                        && !!game.running
                        && !game.isGameOver;

                    if (canUseMobileDirect
                        && mobile
                        && typeof game.isDirectControlActive === 'function'
                        && !game.isDirectControlActive()
                        && !game.buildMode?.active
                        && !game.targetingType
                        && typeof game.getDirectControlSelectedCandidate === 'function'
                        && typeof game.startDirectControl === 'function') {
                        const dcState = (game.directControl && typeof game.directControl === 'object')
                            ? game.directControl
                            : null;
                        const candidate = game.getDirectControlSelectedCandidate();
                        if (!candidate) {
                            state.lastAutoStartUnit = null;
                            if (dcState && dcState.cancelSuppressedUnit) {
                                dcState.cancelSuppressedUnit = null;
                            }
                        } else {
                            const suppressedUnit = dcState ? dcState.cancelSuppressedUnit : null;
                            if (suppressedUnit && suppressedUnit === candidate) {
                                // User explicitly canceled direct control (X). Keep mobile controls hidden
                                // until selection changes.
                            } else {
                                if (dcState && suppressedUnit && suppressedUnit !== candidate) {
                                    dcState.cancelSuppressedUnit = null;
                                }
                            const now = (typeof performance !== 'undefined' && performance.now)
                                ? performance.now()
                                : Date.now();
                            const shouldAttempt = (
                                candidate !== state.lastAutoStartUnit
                                || (now - Number(state.lastAutoStartAt || 0)) > 900
                            );
                            if (shouldAttempt) {
                                state.lastAutoStartUnit = candidate;
                                state.lastAutoStartAt = now;
                                game.startDirectControl(candidate);
                            }
                            }
                        }
                    } else if (!canUseMobileDirect) {
                        state.lastAutoStartUnit = null;
                    }

                    const active = canUseMobileDirect
                        && (typeof game.isDirectControlActive === 'function')
                        && game.isDirectControlActive();
                    if (root) {
                        root.classList.toggle('hidden', !active);
                        root.setAttribute('aria-hidden', active ? 'false' : 'true');
                        root.classList.toggle('pc-mode', !!(active && pcViewport));
                    }
                    if (toggleBtn) {
                        toggleBtn.classList.add('hidden');
                        toggleBtn.classList.remove('active');
                        toggleBtn.setAttribute('aria-hidden', 'true');
                    }
                    if (toggleLabel) {
                        toggleLabel.textContent = '';
                    }
                    if (pcHintEl) {
                        const pcHintActive = !!(active && pcViewport);
                        pcHintEl.classList.toggle('hidden', !pcHintActive);
                        pcHintEl.setAttribute('aria-hidden', pcHintActive ? 'false' : 'true');
                    }

                    updateStatus(active);
                    syncStanceButton(active);
                    syncSkillButtons(active);

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

            const mobileCameraTiltUi = (() => {
                const root = document.getElementById('mobile-camera-tilt-control');
                const slider = document.getElementById('mobile-camera-tilt-slider');
                if (!root || !slider) {
                    return { refresh: () => { }, release: () => { } };
                }

                const isMobileViewport = () => {
                    const coarse = (typeof window.matchMedia === 'function')
                        ? window.matchMedia('(pointer: coarse)').matches
                        : false;
                    const touchCapable = (typeof navigator !== 'undefined')
                        ? ((Number(navigator.maxTouchPoints) || 0) > 0)
                        : false;
                    if (!coarse && !touchCapable) return false;
                    const w = Math.max(0, Number(window.innerWidth) || 0);
                    const h = Math.max(0, Number(window.innerHeight) || 0);
                    const shortestSide = Math.min(w, h);
                    return shortestSide <= 1366;
                };

                const syncSliderToGame = () => {
                    if (typeof game.getCameraPivotUserPercent !== 'function') return;
                    const pct = Math.round(Number(game.getCameraPivotUserPercent()) || 0);
                    const text = String(pct);
                    if (slider.value !== text) slider.value = text;
                };

                const applySliderToGame = () => {
                    if (typeof game.setCameraPivotUserPercent !== 'function') return;
                    const v = Number(slider.value);
                    game.setCameraPivotUserPercent(Number.isFinite(v) ? v : 0);
                };

                const stopPropagationOnly = (e) => {
                    if (!e) return;
                    e.stopPropagation();
                };

                slider.addEventListener('input', (e) => {
                    stopPropagationOnly(e);
                    applySliderToGame();
                });
                slider.addEventListener('change', (e) => {
                    stopPropagationOnly(e);
                    applySliderToGame();
                });
                slider.addEventListener('pointerdown', stopPropagationOnly, { passive: true });
                slider.addEventListener('pointerup', stopPropagationOnly, { passive: true });
                slider.addEventListener('touchstart', stopPropagationOnly, { passive: true });
                slider.addEventListener('touchmove', stopPropagationOnly, { passive: true });

                const refresh = () => {
                    const active = isMobileViewport()
                        && !!game.running
                        && !game.isGameOver;
                    root.classList.toggle('hidden', !active);
                    root.setAttribute('aria-hidden', active ? 'false' : 'true');
                    if (!active) return;
                    syncSliderToGame();
                };

                const onViewportChange = () => { setTimeout(refresh, 70); };
                window.addEventListener('resize', onViewportChange);
                window.addEventListener('orientationchange', onViewportChange);

                const syncTimer = window.setInterval(refresh, 200);
                root.__mobileCameraTiltSyncTimer = syncTimer;
                refresh();

                return {
                    refresh,
                    release: () => { refresh(); }
                };
            })();
            this.mobileCameraTiltUi = mobileCameraTiltUi;
            if (typeof window !== 'undefined') {
                window.MobileCameraTiltUI = mobileCameraTiltUi;
            }

            // ======== PC ?꿔꺂?????????嚥??========
            this.canvas.addEventListener('mousedown', e => {
                const nowMs = Date.now();
                if ((nowMs - lastTouchInputAt) < GHOST_MOUSE_BLOCK_MS) return;
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
                        const useAirFormation = (typeof this.isFeatureFlagEnabled === 'function')
                            ? this.isFeatureFlagEnabled('airFormation')
                            : false;
                        const unitList = Array.from(this.selectedUnits).filter(u => !!(u && !u.dead));
                        const formationPlan = (useAirFormation && typeof this.planAirFormationAssignments === 'function')
                            ? this.planAirFormationAssignments(unitList, worldX)
                            : null;
                        const mapW = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);

                        unitList.forEach(u => {
                            if (!u || u.dead) return;
                            if (typeof this.setDirectControlReleaseHold === 'function') {
                                this.setDirectControlReleaseHold(u, false);
                            }
                            u.commandMode = 'move';
                            const isAirUnit = !!(u.stats && u.stats.type === 'air');
                            if (useAirFormation && isAirUnit && formationPlan && formationPlan.has(u)) {
                                const info = formationPlan.get(u);
                                const formationTargetX = Number(info && info.targetX);
                                const safeFormationTargetX = Number.isFinite(formationTargetX)
                                    ? formationTargetX
                                    : (Number.isFinite(mapW) && mapW > 0
                                        ? Math.max(24, Math.min(mapW - 24, Number(worldX)))
                                        : Number(worldX));
                                u.commandTargetX = safeFormationTargetX;
                                u.targetX = safeFormationTargetX;
                                u.targetY = null;
                                u._airFormationOffsetY = Number(info && info.offsetY) || 0;
                                u._airFormationSlot = Number(info && info.slot) || 0;
                                u._airFormationDir = Number(info && info.dir) || 0;
                                u._airFormationAnchorX = Number(info && info.anchorX);
                            } else {
                                const clampedX = Number.isFinite(mapW) && mapW > 0
                                    ? Math.max(24, Math.min(mapW - 24, Number(worldX)))
                                    : Number(worldX);
                                u.commandTargetX = clampedX; // ???熬곣뫖利??レ벁?????醫딆┣???(facing??
                                u.targetX = clampedX;
                                u.targetY = isAirUnit ? null : moveTargetY;
                                if (typeof this.clearAirFormationState === 'function') {
                                    this.clearAirFormationState(u);
                                }
                            }
                            u.lockedTarget = null;
                            u.attackTarget = null;
                            if (u.stats && !u.stats.operator && (u.stats.category === 'drone' || (u.stats.id && u.stats.id.includes('drone')))) {
                                const droneTargetX = Number.isFinite(Number(u.commandTargetX))
                                    ? Number(u.commandTargetX)
                                    : Number(worldX);
                                u.swarmTarget = { x: droneTargetX, y: moveTargetY };
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
                    const clickedPlayerUnit = hasOtherPlayerUnitAt(worldX, worldY, null, {
                        clientX: e.clientX,
                        clientY: e.clientY
                    });
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
                        if (!e.shiftKey) {
                            updateManualTankAim(directControlUnit, worldX, worldY);
                            if (typeof this.directControlFireCurrentWeapon === 'function') {
                                this.directControlFireCurrentWeapon();
                            }
                        }
                        return;
                    }

                    const manualTank = getSingleSelectedPlayerMbt();
                    if (manualTank && !e.shiftKey) {
                        updateManualTankAim(manualTank, worldX, worldY);
                        const clickedAnotherPlayerUnit = hasOtherPlayerUnitAt(worldX, worldY, manualTank, {
                            clientX: e.clientX,
                            clientY: e.clientY
                        });
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
                        const clickedAnotherPlayerUnit = hasOtherPlayerUnitAt(worldX, worldY, manualSpg, {
                            clientX: e.clientX,
                            clientY: e.clientY
                        });
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
                const allowLegacyManualArmorAim = !!(
                    manualArmor
                    && manualArmor.manualMgHeld === true
                );
                if (allowLegacyManualArmorAim
                    && !this.buildMode.active
                    && !this.targetingType
                    && isInsideCanvasClient(e.clientX, e.clientY)) {
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
                const nowMs = Date.now();
                if ((nowMs - lastTouchInputAt) < GHOST_MOUSE_BLOCK_MS) return;
                if (e.button === 2) {
                    cameraDrag = false;
                    clearManualTankMgHold();
                } else if (e.button === 0 && pcLeftPointerDown) {
                    const wasPan = pcLeftPanActive;
                    pcLeftPointerDown = false;
                    pcLeftPanActive = false;
                    this.selectDragActive = false;
                    if (wasPan) return;

                    const pUp = getScaledPos(e.clientX, e.clientY);
                    const clickX = pUp.x + this.cameraX;
                    const clickY = pUp.y;
                    const movedPx = Math.hypot(e.clientX - pcLeftDownClientX, e.clientY - pcLeftDownClientY);
                    const clickedPlayerUnit = hasOtherPlayerUnitAt(clickX, clickY, null, {
                        clientX: e.clientX,
                        clientY: e.clientY
                    });
                    const clickedSelectableBuilding = hasSelectableBuildingAt(clickX, clickY);
                    if (!clickedPlayerUnit && !clickedSelectableBuilding) {
                        if (this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY)) return;
                    }
                    if (selectHQAt(clickX, clickY)) return;
                    const unitClicked = this.checkUnitClick && this.checkUnitClick(clickX, clickY, {
                        keepSelectedOnRepeatTap: true,
                        preferNearestHit: true,
                        singleSelect: !e.shiftKey,
                        clientX: e.clientX,
                        clientY: e.clientY
                    });
                    if (unitClicked) { this.selectedBuilding = null; return; }
                    if (movedPx < Math.max(14, PC_PAN_DEADZONE_PX + 4)) {
                        const startX = Number(this.selectStartX);
                        const startY = Number(this.selectStartY);
                        if (Number.isFinite(startX) && Number.isFinite(startY)) {
                            const startHit = this.checkUnitClick && this.checkUnitClick(startX, startY, {
                                keepSelectedOnRepeatTap: true,
                                preferNearestHit: true,
                                singleSelect: !e.shiftKey,
                                clientX: pcLeftDownClientX,
                                clientY: pcLeftDownClientY
                            });
                            if (startHit) { this.selectedBuilding = null; return; }
                        }
                    }
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
                const nowMs = Date.now();
                if ((nowMs - lastTouchInputAt) < GHOST_MOUSE_BLOCK_MS) {
                    e.preventDefault();
                    return;
                }
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
                const prevZoom = Camera.zoom;
                const step = (e.deltaY < 0 ? Camera.STEP : -Camera.STEP) * 2.0;
                const newZoom = prevZoom + step;
                const wrapper = document.getElementById('game-wrapper');
                const rect = wrapper ? wrapper.getBoundingClientRect() : null;
                const anchorX = rect ? (rect.left + rect.width / 2) : e.clientX;
                const anchorY = rect ? (rect.top + rect.height / 2) : e.clientY;
                // Keep current composition stable while using natural wheel zoom direction.
                Camera.applyZoomWithAnchor(this, newZoom, anchorX, anchorY);
                if (Camera.zoom !== prevZoom) this.updateZoomUI();
            }, { passive: false });

            // ======== Mobile Touch Gesture Handling ========
            const clearMobileLongPressTimer = () => {
                if (mobileLongPressTimer) {
                    window.clearTimeout(mobileLongPressTimer);
                    mobileLongPressTimer = 0;
                }
            };

            const trySelectUnitOrBuildingAtClient = (clientX, clientY) => {
                const pTap = getScaledPos(clientX, clientY);
                const clickX = pTap.x + this.cameraX;
                const clickY = pTap.y;
                let coarsePointer = false;
                let touchCapable = false;
                try {
                    coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
                } catch (_) { }
                try {
                    touchCapable = (typeof navigator !== 'undefined')
                        ? ((Number(navigator.maxTouchPoints) || 0) > 0)
                        : false;
                } catch (_) { }
                const coarseLike = !!(coarsePointer || touchCapable);

                const unitClicked = this.checkUnitClick
                    && this.checkUnitClick(clickX, clickY, {
                        keepSelectedOnRepeatTap: true,
                        preferNearestHit: true,
                        singleSelect: true,
                        forceNearRadiusPx: coarseLike ? 120 : 80,
                        clientX,
                        clientY
                    });
                if (unitClicked) {
                    this.selectedBuilding = null;
                    const clickedUnit = (unitClicked !== true) ? unitClicked : null;
                    if (coarseLike) {
                        const dcState = (this.directControl && typeof this.directControl === 'object')
                            ? this.directControl
                            : null;
                        if (dcState && dcState.cancelSuppressedUnit && clickedUnit && dcState.cancelSuppressedUnit === clickedUnit) {
                            dcState.cancelSuppressedUnit = null;
                        }
                    }
                    if (coarseLike
                        && typeof this.isDirectControlActive === 'function'
                        && !this.isDirectControlActive()
                        && !this.buildMode?.active
                        && !this.targetingType
                        && typeof this.getDirectControlSelectedCandidate === 'function'
                        && typeof this.startDirectControl === 'function') {
                        const candidate = (clickedUnit && !clickedUnit.dead) ? clickedUnit : this.getDirectControlSelectedCandidate();
                        if (candidate && !candidate.dead) {
                            this.startDirectControl(candidate);
                        }
                    }
                    if (this.mobileDirectUi && typeof this.mobileDirectUi.refresh === 'function') {
                        this.mobileDirectUi.refresh();
                    }
                    return true;
                }

                if (selectHQAt(clickX, clickY)) return true;
                if (this.checkBuildingClick && this.checkBuildingClick(clickX, clickY)) return true;
                return false;
            };

            const runTapSelectionAtClient = (clientX, clientY, opts = null) => {
                const clearOnMiss = !opts || opts.clearOnMiss !== false;
                const pTap = getScaledPos(clientX, clientY);
                const clickX = pTap.x + this.cameraX;
                const clickY = pTap.y;
                if (trySelectUnitOrBuildingAtClient(clientX, clientY)) return true;
                if (this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY)) return true;
                if (this.checkBuildingClick && this.checkBuildingClick(clickX, clickY)) return true;
                if (!clearOnMiss) return false;
                if (this.clearAllSelection) this.clearAllSelection();
                this.selectedBuilding = null;
                return false;
            };

            this.canvas.addEventListener('touchstart', e => {
                e.preventDefault();
                lastTouchInputAt = Date.now();

                if (e.touches.length >= 2) {
                    if (!canStartMobilePinch(e.touches)) return;
                    beginMobilePinch(e.touches[0], e.touches[1]);
                    return;
                }

                if (e.touches.length === 1) {
                    const t = e.touches[0];
                    if (isInsideHUD(t.clientX, t.clientY)) return;
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
                    mobileTouchStartedOnSelectable = false;
                    mobilePrimaryTouchId = t.identifier;
                    mobileTouchStartAt = (typeof performance !== 'undefined' && performance.now)
                        ? performance.now()
                        : Date.now();

                    tapStartClientX = tapLastClientX = t.clientX;
                    tapStartClientY = tapLastClientY = t.clientY;

                    const p = getScaledPos(t.clientX, t.clientY);
                    const touchWorldX = p.x + this.cameraX;
                    const touchWorldY = p.y;
                    mobileTouchStartedOnSelectable = (
                        hasOtherPlayerUnitAt(touchWorldX, touchWorldY, null, {
                            clientX: t.clientX,
                            clientY: t.clientY
                        })
                        || hasSelectableBuildingAt(touchWorldX, touchWorldY)
                    );

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

                    const directControlActive = !!(
                        typeof this.isDirectControlActive === 'function'
                        && this.isDirectControlActive()
                    );

                    if (directControlActive) {
                        if (trySelectUnitOrBuildingAtClient(t.clientX, t.clientY)) {
                            // Switch selection/control immediately on touch.
                            mobileTapSuppressed = true;
                            return;
                        }
                        updateDirectControlAimFromClient(t.clientX, t.clientY);
                        // Keep touchend tap-selection fallback active for non-operator direct control.
                        // (Do not suppress here: otherwise unit-switch taps can be dropped.)
                        return;
                    }

                    return;
                }
            }, { passive: false });

            window.addEventListener('touchstart', e => {
                lastTouchInputAt = Date.now();
                if (e.touches.length < 2) return;
                if (!canStartMobilePinch(e.touches)) return;
                if (pinchActive && isMobileCameraMove) return;
                if (!beginMobilePinch(e.touches[0], e.touches[1])) return;
                e.preventDefault();
            }, { passive: false });

            window.addEventListener('touchmove', e => {
                lastTouchInputAt = Date.now();
                if (e.touches.length === 1) {
                    const t = e.touches[0];
                    tapLastClientX = t.clientX;
                    tapLastClientY = t.clientY;
                    const directControlActive = !!(
                        !isMobileSelecting
                        && typeof this.isDirectControlActive === 'function'
                        && this.isDirectControlActive()
                    );

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
                    const panDeadzonePx = mobileTouchStartedOnSelectable
                        ? MOBILE_PAN_DEADZONE_ON_SELECTABLE_PX
                        : MOBILE_PAN_DEADZONE_PX;
                    if (!isMobileSinglePan && !mobileLongPressTriggered && movedPx >= panDeadzonePx) {
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
                        return;
                    }

                    // Direct-control aim touch follow (only when not panning).
                    if (directControlActive) {
                        e.preventDefault();
                        updateDirectControlAimFromClient(t.clientX, t.clientY);
                    }
                    return;
                }

                if (e.touches.length >= 2) {
                    if (!pinchActive && !canStartMobilePinch(e.touches)) return;
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

                    if (!pinchActive) {
                        beginMobilePinch(t1, t2);
                    }

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

                    // Two-finger pan by midpoint client delta.
                    // Use screen-space delta to decouple pan from zoom-step jitter.
                    const zoomNow = (typeof Camera !== 'undefined' && Number.isFinite(Number(Camera.zoom)) && Number(Camera.zoom) > 0)
                        ? Number(Camera.zoom)
                        : 1;
                    const scaleInfo = getClientScaleInfo();
                    const scaleX = Math.max(0.001, Number(scaleInfo.scaleX) || 1);
                    const dxClient = Number(mid.x) - Number(pinchLastMidClientX);
                    const dxView = dxClient / (scaleX * zoomNow);
                    this.cameraX -= dxView;
                    this.cameraX = Camera.clampCameraX(this, this.cameraX);
                    pinchLastMidClientX = mid.x;
                    return;
                }
            }, { passive: false });

            window.addEventListener('touchend', e => {
                lastTouchInputAt = Date.now();
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
                        const directControlActive = !!(
                            directControlUnit
                            && typeof this.isDirectControlActive === 'function'
                            && this.isDirectControlActive()
                        );
                        const isDirectControlOperator = !!(
                            directControlActive
                            && directControlId === 'drone_operator'
                        );
                        if (isDirectControlOperator) {
                            const pTap = getScaledPos(endClientX, endClientY);
                            const clickX = pTap.x + this.cameraX;
                            const clickY = pTap.y;
                            if (!trySelectUnitOrBuildingAtClient(endClientX, endClientY)) {
                                if (!(this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY))) {
                                    if (typeof this.directControlFireCurrentWeapon === 'function') {
                                        this.directControlFireCurrentWeapon();
                                    }
                                }
                            }
                        } else if (directControlActive) {
                            // Non-operator direct-control: prioritize unit switching taps.
                            // If no selectable unit/building is hit, keep current selection/control.
                            let switched = trySelectUnitOrBuildingAtClient(endClientX, endClientY);
                            if (!switched) {
                                switched = trySelectUnitOrBuildingAtClient(tapStartClientX, tapStartClientY);
                            }
                            if (!switched) {
                                updateDirectControlAimFromClient(endClientX, endClientY);
                            }
                        } else {
                            let handled = runTapSelectionAtClient(endClientX, endClientY, { clearOnMiss: false });
                            if (!handled) {
                                // Fallback to touch-start point to absorb finger jitter and moving-target drift.
                                handled = runTapSelectionAtClient(tapStartClientX, tapStartClientY, { clearOnMiss: false });
                            }
                            if (!handled) {
                                runTapSelectionAtClient(endClientX, endClientY, { clearOnMiss: true });
                            }
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
                    pinchLastMidClientX = 0;
                    mobilePrimaryTouchId = null;
                    mobileLongPressTriggered = false;
                    mobileTapSuppressed = false;
                    mobileTouchStartedOnSelectable = false;
                    this.selectDragActive = false;
                } else if (e.touches.length < 2) {
                    pinchActive = false;
                    pinchLastDist = 0;
                    pinchLastMidClientX = 0;
                    isMobileCameraMove = false;
                }
            });

            window.addEventListener('touchcancel', () => {
                lastTouchInputAt = Date.now();
                clearMobileLongPressTimer();
                isMobileCameraMove = false;
                isMobileSinglePan = false;
                isMobileSelecting = false;
                pinchActive = false;
                pinchLastDist = 0;
                pinchLastMidClientX = 0;
                mobilePrimaryTouchId = null;
                mobileLongPressTriggered = false;
                mobileTapSuppressed = false;
                mobileTouchStartedOnSelectable = false;
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
                        clearSelectionForPcEsc();
                        e.preventDefault();
                        return;
                    }
                    if (this.buildMode.active) {
                        this.cancelBuildMode();
                        ui.showToast('嫄댁꽕 痍⑥냼');
                        e.preventDefault();
                        return;
                    } else if (this.targetingType) {
                        this.cancelTargeting();
                        e.preventDefault();
                        return;
                    }
                    if (clearSelectionForPcEsc()) {
                        e.preventDefault();
                        return;
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


