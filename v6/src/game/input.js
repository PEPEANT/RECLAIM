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
                    'hud-camera-btn',
                    'hud-option-btn',
                    'hud-minimap-container',
                    'hud-ctrl-wrapper',
                    'unit-cmd-wrapper',
                    'map-modal',
                    'scope-modal',
                    'mission-objective-modal',
                    'mobile-direct-ui'
                ];
                for (let i = 0; i < hudInteractiveIds.length; i++) {
                    const el = document.getElementById(hudInteractiveIds[i]);
                    if (isPointInside(el)) return true;
                }

                // Fallback for legacy/non-split footer layouts
                const footerRect = hudFooter.getBoundingClientRect();
                const footerLooksLikeBottomBar = footerRect.height > 0 && footerRect.top > 0;
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
                ArrowLeft: 'arrowLeft',
                ArrowRight: 'arrowRight'
            };

            // ======== ????븐뻤????⑤슢堉???========
            // ??⑤㈇??癲????嶺뚮Ĳ?됪뤃??(PC ???關履숂뭐??/ ?꿔꺂??袁ㅻ븶???????????
            let cameraDrag = false;
            let cameraLastX = 0;

            // ????ｋ???熬곣뫖利당뵓????嶺뚮Ĳ?됪뤃??(PC ????裕?濡ろ떟???/ ?꿔꺂??袁ㅻ븶???????????
            this.selectDragActive = false;
            this.selectStartX = 0;
            this.selectStartY = 0;
            this.selectEndX = 0;
            this.selectEndY = 0;

            // ?꿔꺂??袁ㅻ븶????????썹땟??????븐뻤??
            let isMobileSelecting = false;
            let isMobileCameraMove = false;
            let pinchActive = false;
            let pinchStartDist = 0;
            let pinchStartZoom = Camera.zoom;
            let pinchAnchorClientX = 0;
            let pinchAnchorClientY = 0;

            // [MOBILE TAP FIX] ????嶺뚮Ĳ?됪뤃???????? ???됰Ŧ??????裕∽┼??뀖?節뤵럸? ????썹땟????"???" ???뚯???????Β????嶺뚮㉡???
            let tapStartClientX = 0, tapStartClientY = 0;
            let tapLastClientX = 0, tapLastClientY = 0;
            const TAP_THRESHOLD_PX = 14; // 12~18 ?????????? 14 ???ㅻ쿋驪??

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
                const halfW = Number(u.width || 0) / 2;
                const left = u.x - halfW;
                const right = u.x + halfW;
                const top = u.y - Number(u.height || 0);
                const bottom = u.y;
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
                const footer = document.getElementById('hud-footer');

                const isMobileViewport = () => {
                    const coarse = (typeof window.matchMedia === 'function')
                        ? window.matchMedia('(pointer: coarse)').matches
                        : false;
                    if (!coarse) return false;
                    return window.innerWidth <= 1024;
                };

                const refresh = () => {
                    const active = isMobileViewport()
                        && !!game.running
                        && !game.isGameOver
                        && (typeof game.isDirectControlActive === 'function')
                        && game.isDirectControlActive();

                    if (root) {
                        // Fire is now HUD-skill-only during direct control.
                        root.classList.add('hidden');
                        root.setAttribute('aria-hidden', 'true');
                    }
                    if (footer) footer.classList.remove('hud-mobile-direct-active');
                };

                const onViewportChange = () => { refresh(); };
                window.addEventListener('resize', onViewportChange);
                window.addEventListener('orientationchange', () => { setTimeout(onViewportChange, 80); });

                const syncTimer = window.setInterval(refresh, 180);
                if (root) root.__mobileDirectSyncTimer = syncTimer;
                refresh();

                return {
                    refresh,
                    release: () => { }
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

                        this.selectedUnits.forEach(u => {
                            if (!u || u.dead) return;
                            u.commandMode = 'move';
                            u.commandTargetX = worldX; // ???熬곣뫖利??レ벁?????醫딆┣???(facing??
                            u.targetX = worldX;
                            u.targetY = null;
                            u.lockedTarget = null;
                            u.attackTarget = null;
                            if (u.stats && !u.stats.operator && (u.stats.category === 'drone' || (u.stats.id && u.stats.id.includes('drone')))) {
                                u.swarmTarget = { x: worldX, y: worldY };
                            }
                        });

                        // particles + move marker
                        this.createParticles(worldX, this.groundY - 10, 10, '#22c55e');
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
                    if (directControlUnit && directControlUnit.stats) {
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

                    this.selectDragActive = true;
                    this.selectStartX = worldX;
                    this.selectStartY = p.y;
                    this.selectEndX = this.selectStartX;
                    this.selectEndY = this.selectStartY;
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

                if (cameraDrag && !this.selectDragActive) {
                    this.cameraX -= (p.x - cameraLastX);
                    this.cameraX = Camera.clampCameraX(this, this.cameraX);
                    cameraLastX = p.x;
                }

                // ????ｋ???熬곣뫖利당뵓????醫딆┣???(????裕?濡ろ떟???
                if (this.selectDragActive) {
                    this.selectEndX = p.x + this.cameraX;
                    this.selectEndY = p.y;
                }
            });

            window.addEventListener('mouseup', e => {
                if (e.button === 2) {
                    cameraDrag = false;
                    clearManualTankMgHold();
                } else if (e.button === 0 && this.selectDragActive) {
                    this.selectDragActive = false;
                    // ????ｋ???熬곣뫖利당뵓????곸?? ????????嶺뚮ㅏ諭븀빊?????뮻?????????Β???꿔꺂??節뉖き??
                    const dx = Math.abs(this.selectEndX - this.selectStartX);
                    const dy = Math.abs(this.selectEndY - this.selectStartY);
                    if (dx < 10 && dy < 10) {
                        // ????뮻?????? ???뚯??????????汝??吏?癒곕㎦?
                        const clickX = this.selectStartX;
                        const clickY = this.selectStartY;
                        if (this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY)) return;
                        if (selectHQAt(clickX, clickY)) return;
                        const unitClicked = this.checkUnitClick && this.checkUnitClick(clickX, clickY);
                        if (unitClicked) { this.selectedBuilding = null; return; }
                        if (this.checkBuildingClick) this.checkBuildingClick(clickX, clickY);
                        if (this.clearAllSelection) this.clearAllSelection();
                        this.selectedBuilding = null;
                    } else {
                        // ??嶺뚮Ĳ?됪뤃??????ｋ?? ?熬곣뫖利당뵓????????ル뒇嶺?????ｋ??
                        if (this.selectUnitsInRect) this.selectUnitsInRect();
                        this._tutorialLastDragSelectAt = Date.now();
                        this._tutorialLastDragSelectCount = (this.selectedUnits && typeof this.selectedUnits.size === 'number')
                            ? this.selectedUnits.size
                            : 0;
                        this.selectedBuilding = null;
                    }
                }
            });

            // ???關履숂뭐???꿔꺂???????꿔꺂?볟젆怨곷븶???+ ??嶺뚮Ĳ????꿔꺂??琉몃쨨???+ ?꿸쑨?????鍮???????
            window.addEventListener('blur', () => {
                cameraDrag = false;
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

            // ======== ?꿔꺂??袁ㅻ븶???????????????嚥??========
            this.canvas.addEventListener('touchstart', e => {
                e.preventDefault();

                // [NEW] Block if any touch is inside HUD area
                for (let i = 0; i < e.touches.length; i++) {
                    if (isInsideHUD(e.touches[i].clientX, e.touches[i].clientY)) return;
                }

                if (e.touches.length === 1) {
                    // ????뮻????????? ????ル뒇嶺?????ｋ???꿔꺂??袁ㅻ븶???(??⑤㈇??癲??????????궰???)
                    isMobileSelecting = true;
                    isMobileCameraMove = false;
                    pinchActive = false;

                    const p = getScaledPos(e.touches[0].clientX, e.touches[0].clientY);
                    if (!isInsideCanvasClient(e.touches[0].clientX, e.touches[0].clientY)) return;

                    // [NEW] ?꿸쑨?????鍮??꿔꺂??袁ㅻ븶???嚥싳쉶瑗??꾧틡???レ탳???熬곣뫖利????꿔꺂??節뉖き??
                    if (this.buildMode.active) {
                        this.updateBuildPreview(p.x + this.cameraX, p.y);
                        this.handleBuildPlacement(p.x + this.cameraX);
                        isMobileSelecting = false;
                        return;
                    }

                    // ???嚥▲굧????嚥싳쉶瑗??꾧틡???レ탳?????嚥▲굧?????꿔꺂??節뉖き??
                    if (this.targetingType) {
                        this.handleTargeting(p.x + this.cameraX, p.y);
                        isMobileSelecting = false;
                        return;
                    }

                    const directControlUnit = (typeof this.getDirectControlUnit === 'function')
                        ? this.getDirectControlUnit()
                        : null;
                    const directControlId = String((directControlUnit && directControlUnit.stats && directControlUnit.stats.id) || '');
                    if (directControlUnit && directControlId === 'drone_operator') {
                        // Keep touch tap path alive so lockdown assignment can trigger on touchend.
                        updateDirectControlAimFromClient(e.touches[0].clientX, e.touches[0].clientY);
                    } else if (typeof this.isDirectControlActive === 'function' && this.isDirectControlActive()) {
                        updateDirectControlAimFromClient(e.touches[0].clientX, e.touches[0].clientY);
                        isMobileSelecting = false;
                        this.selectDragActive = false;
                        return;
                    }

                    // ????ｋ???熬곣뫖利당뵓????嶺뚮??ｆ뤃?
                    this.selectDragActive = true;
                    this.selectStartX = p.x + this.cameraX;
                    this.selectStartY = p.y;
                    this.selectEndX = this.selectStartX;
                    this.selectEndY = this.selectStartY;

                    // [MOBILE TAP FIX] ??????????? ????裕∽┼????뚯????덈춣?
                    tapStartClientX = tapLastClientX = e.touches[0].clientX;
                    tapStartClientY = tapLastClientY = e.touches[0].clientY;

                } else if (e.touches.length >= 2) {
                    // ??????? ??⑤㈇??癲????????꿔꺂??袁ㅻ븶???
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
                if (e.touches.length === 1
                    && typeof this.isDirectControlActive === 'function'
                    && this.isDirectControlActive()) {
                    e.preventDefault();
                    updateDirectControlAimFromClient(e.touches[0].clientX, e.touches[0].clientY);
                    return;
                }

                // mobile select drag
                if (isMobileSelecting && this.selectDragActive) {
                    e.preventDefault();
                    const p = getScaledPos(e.touches[0].clientX, e.touches[0].clientY);
                    this.selectEndX = p.x + this.cameraX;
                    this.selectEndY = p.y;

                    // [MOBILE TAP FIX] ?꿔꺂????????? ????裕∽┼???醫딆┣???
                    tapLastClientX = e.touches[0].clientX;
                    tapLastClientY = e.touches[0].clientY;

                    return; // ??⑤㈇??癲???汝??吏?癒곕㎦??癲ル슢???????궰???
                }

                // ?????????⑤㈇??癲???????
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

                    // [MOBILE TAP FIX] ???됰Ŧ??????裕∽┼?dx,dy)???????????????꿔꺂??袁ㅻ븶????濚밸Ŧ援잒キ???꿸쑨???????????嶺뚮Ĳ?됪뤃???녾컯嶺??숅뜮????繹먮굝???
                    // ??? ???뚯???????Β??????嶺뚮Ĳ?됪뤃???????
                    const ct = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
                    const endClientX = ct ? ct.clientX : tapLastClientX;
                    const endClientY = ct ? ct.clientY : tapLastClientY;
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
                        if (this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY)) return;
                        if (typeof this.directControlFireCurrentWeapon === 'function') {
                            this.directControlFireCurrentWeapon();
                            return;
                        }
                    }

                    const movedPx = Math.hypot(endClientX - tapStartClientX, endClientY - tapStartClientY);

                    if (movedPx < TAP_THRESHOLD_PX) {
                        // ????뮻??? "??????裕∽┼??????뚯???????Β????????꿔꺂??節뉖き?????癲ル슢怡?怨뚯꼫)
                        const pTap = getScaledPos(endClientX, endClientY);
                        const clickX = pTap.x + this.cameraX;
                        const clickY = pTap.y;

                        if (this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY)) return;
                        if (selectHQAt(clickX, clickY)) return;
                        const unitClicked = this.checkUnitClick && this.checkUnitClick(clickX, clickY);
                        if (unitClicked) { this.selectedBuilding = null; return; }
                        if (this.checkBuildingClick) this.checkBuildingClick(clickX, clickY);
                        if (this.clearAllSelection) this.clearAllSelection();
                        this.selectedBuilding = null;
                    } else {
                        // ??嶺뚮Ĳ?됪뤃??????ｋ??
                        if (this.selectUnitsInRect) this.selectUnitsInRect();
                        this._tutorialLastDragSelectAt = Date.now();
                        this._tutorialLastDragSelectCount = (this.selectedUnits && typeof this.selectedUnits.size === 'number')
                            ? this.selectedUnits.size
                            : 0;
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
                if (typingInField && e.key !== 'Escape') return;

                if (e.code === 'KeyE') {
                    if (typingInField) return;
                    if (e.repeat) return;
                    if (typeof this.toggleDirectControl === 'function') {
                        const changed = this.toggleDirectControl();
                        if (changed) {
                            e.preventDefault();
                            if (this.mobileDirectUi && typeof this.mobileDirectUi.refresh === 'function') {
                                this.mobileDirectUi.refresh();
                            }
                        }
                    }
                    return;
                }

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
                const directMappedKey = DIRECT_CONTROL_KEY_MAP[e.code];
                if (directMappedKey && typeof this.setDirectControlKeyState === 'function') {
                    this.setDirectControlKeyState(directMappedKey, false);
                }
            });
        }
    };
})();


