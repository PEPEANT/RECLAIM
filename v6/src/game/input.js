// src/game/input.js - Input handling
(function () {
    'use strict';

    window.GameInput = {
        setup() {
            // [R 2.4] ?袁⑹읈 ??苑뺞④쑬留???낆젾 ??뽯뮞??
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

            // ======== ?怨밴묶 癰궰??========
            // 燁삳?李????뺤삋域?(PC ?怨좉깻??/ 筌뤴뫀而?????癒???
            let cameraDrag = false;
            let cameraLastX = 0;

            // ?醫뤾문 獄쏅벡????뺤삋域?(PC ?ル슦寃®뵳?/ 筌뤴뫀而?????癒???
            this.selectDragActive = false;
            this.selectStartX = 0;
            this.selectStartY = 0;
            this.selectEndX = 0;
            this.selectEndY = 0;

            // 筌뤴뫀而???袁⑹뒠 ?怨밴묶
            let isMobileSelecting = false;
            let isMobileCameraMove = false;
            let pinchActive = false;
            let pinchStartDist = 0;
            let pinchStartZoom = Camera.zoom;
            let pinchAnchorClientX = 0;
            let pinchAnchorClientY = 0;

            // [MOBILE TAP FIX] ????뺤삋域??癒?젟?? ?遺얜굡?ル슦紐닷첎? ?袁⑤빍??"???" 疫꿸퀣???곗쨮 ??뺣뼄
            let tapStartClientX = 0, tapStartClientY = 0;
            let tapLastClientX = 0, tapLastClientY = 0;
            const TAP_THRESHOLD_PX = 14; // 12~18 ?????띯뫂堉? 14 ?곕뗄荑?

            // [MODIFIED] 椰꾨?窺 ?醫뤾문 (???쟿??곷선 椰꾨똻苑?椰꾨?窺 ??釉?
            const selectBuildingAt = (wx, wy) => {
                // ?醫뤾문 揶쎛?館釉?椰꾨?窺 ????낅굶
                const selectableTypes = [
                    'hq_player', 'hq_enemy', 'fortress_player', 'fortress_enemy',
                    'watchtower',  // [3.8] ???쟿??곷선 椰꾨똻苑?揶쏅Ŋ???
                    'spawn_flag_player'
                ];

                for (let b of this.buildings) {
                    if (b.dead) continue;
                    // 疫꿸퀣???????癒?뮉 canProduce ???삋域밸㈇? ??덈뮉 椰꾨?窺筌??醫뤾문 揶쎛??
                    if (!selectableTypes.includes(b.type) && !b.canProduce && !b.canShoot) continue;
                    // [FIX] ????甕곕뗄???類? (?ル슣??+20px, ?怨밸릭 +15px)
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
                const stickZone = document.getElementById('mobile-direct-stick-zone');
                const stick = document.getElementById('mobile-direct-stick');
                const statusEl = document.getElementById('mobile-direct-status');
                const footer = document.getElementById('hud-footer');
                if (!root || !stickZone || !stick) {
                    return {
                        refresh() { },
                        release() { }
                    };
                }

                let stickPointerId = null;
                let centerX = 0;
                let centerY = 0;
                let radius = 1;
                let fireTimer = 0;
                let firing = false;
                let subActive = false;
                let aimNx = 1;
                let aimNy = -0.2;

                const isMobileViewport = () => {
                    const coarse = (typeof window.matchMedia === 'function')
                        ? window.matchMedia('(pointer: coarse)').matches
                        : false;
                    if (!coarse) return false;
                    return window.innerWidth <= 1024;
                };

                const getDirectUnit = () => {
                    if (typeof game.getDirectControlUnit !== 'function') return null;
                    return game.getDirectControlUnit();
                };

                const getMobileProfile = (unit) => {
                    if (typeof game.getDirectControlMobileProfile !== 'function') return null;
                    return game.getDirectControlMobileProfile(unit);
                };

                const setStatus = (text) => {
                    if (!statusEl) return;
                    statusEl.textContent = text;
                };

                const stopSubFire = () => {
                    if (typeof game.mobileDirectSubFireStop === 'function') {
                        game.mobileDirectSubFireStop();
                    }
                };

                const clearFireTimer = () => {
                    if (!fireTimer) return;
                    window.clearInterval(fireTimer);
                    fireTimer = 0;
                };

                const stopFiring = () => {
                    firing = false;
                    clearFireTimer();
                    stopSubFire();
                    subActive = false;
                };

                const getAimRange = (unit) => {
                    const raw = Number(unit && unit.getEffectiveRange ? unit.getEffectiveRange() : (unit && unit.stats && unit.stats.range));
                    if (!Number.isFinite(raw) || raw <= 0) return 520;
                    return Math.max(260, Math.min(1400, raw * 0.95));
                };

                const updateUnitAim = (unit) => {
                    if (!unit || unit.dead) return;
                    let nx = Number(aimNx);
                    let ny = Number(aimNy);
                    const mag = Math.hypot(nx, ny);
                    if (!Number.isFinite(nx) || !Number.isFinite(ny) || mag < 0.02) {
                        const facingRaw = Number(unit.facing);
                        const facing = Number.isFinite(facingRaw) && facingRaw < 0 ? -1 : 1;
                        nx = facing;
                        ny = -0.2;
                    } else {
                        nx /= mag;
                        ny /= mag;
                    }
                    const range = getAimRange(unit);
                    unit.manualAimX = Number(unit.x) + (nx * range);
                    unit.manualAimY = Number(unit.y) + (ny * range);
                    if (Number.isFinite(game.frame)) unit.manualAimFrame = game.frame;
                };

                const updateFireStatus = (unit, mode) => {
                    const unitLabel = String((unit && unit.stats && (unit.stats.name || unit.stats.id)) || 'UNIT');
                    const weaponLabel = (mode === 'sub') ? '기관총' : '포탑';
                    setStatus(`${unitLabel} | ${weaponLabel}`);
                };

                const fireTick = () => {
                    const unit = getDirectUnit();
                    if (!unit || unit.dead) {
                        stopFiring();
                        return;
                    }

                    updateUnitAim(unit);
                    const profile = getMobileProfile(unit);
                    const selectedMode = (typeof game.getDirectControlWeaponMode === 'function')
                        ? game.getDirectControlWeaponMode()
                        : 'main';
                    const mode = (selectedMode === 'sub') ? 'sub' : 'main';
                    updateFireStatus(unit, mode);

                    if (mode === 'sub' && profile && profile.hasSub && typeof game.mobileDirectSubFireStart === 'function') {
                        if (profile.subHold) {
                            if (!subActive) {
                                game.mobileDirectSubFireStart();
                                subActive = true;
                            }
                        } else {
                            game.mobileDirectSubFireStart();
                        }
                        return;
                    }

                    if (subActive) {
                        stopSubFire();
                        subActive = false;
                    }
                    if (typeof game.mobileDirectMainFire === 'function') {
                        game.mobileDirectMainFire();
                    }
                };

                const startFiring = () => {
                    if (firing) return;
                    firing = true;
                    fireTick();
                    fireTimer = window.setInterval(fireTick, 95);
                };

                const updateStickGeometry = () => {
                    const rect = stickZone.getBoundingClientRect();
                    centerX = rect.left + (rect.width / 2);
                    centerY = rect.top + (rect.height / 2);
                    radius = Math.max(20, (Math.min(rect.width, rect.height) * 0.5) - 16);
                };

                const updateStickByPointer = (clientX, clientY) => {
                    updateStickGeometry();
                    const dx = clientX - centerX;
                    const dy = clientY - centerY;
                    const dist = Math.hypot(dx, dy) || 0;
                    const clamped = Math.min(radius, dist);
                    const nx = dist > 0 ? (dx / dist) : 0;
                    const ny = dist > 0 ? (dy / dist) : 0;
                    const sx = nx * clamped;
                    const sy = ny * clamped;

                    stick.style.transform = `translate(${sx}px, ${sy}px)`;
                    aimNx = nx;
                    aimNy = ny;
                };

                const releaseStick = () => {
                    if (stickPointerId !== null) {
                        try { stickZone.releasePointerCapture(stickPointerId); } catch (_) { }
                    }
                    stickPointerId = null;
                    stick.style.transform = 'translate(0px, 0px)';
                    aimNx = 0;
                    aimNy = 0;
                    stopFiring();
                };

                const refresh = () => {
                    const active = isMobileViewport()
                        && !!game.running
                        && !game.isGameOver
                        && (typeof game.isDirectControlActive === 'function')
                        && game.isDirectControlActive();

                    root.classList.toggle('hidden', !active);
                    root.setAttribute('aria-hidden', active ? 'false' : 'true');
                    if (footer) footer.classList.toggle('hud-mobile-direct-active', active);

                    if (!active) {
                        releaseStick();
                        return;
                    }

                    const unit = getDirectUnit();
                    if (!unit || unit.dead || !unit.stats) {
                        setStatus('조종 유닛 없음');
                        return;
                    }
                    const mode = (typeof game.getDirectControlWeaponMode === 'function')
                        ? game.getDirectControlWeaponMode()
                        : 'main';
                    updateFireStatus(unit, mode);
                };

                const onStickPointerDown = (e) => {
                    if (e.button !== undefined && e.button !== 0) return;
                    if (stickPointerId !== null) return;
                    e.preventDefault();
                    e.stopPropagation();
                    stickPointerId = e.pointerId;
                    try { stickZone.setPointerCapture(e.pointerId); } catch (_) { }
                    updateStickByPointer(e.clientX, e.clientY);
                    startFiring();
                };

                const onGlobalPointerMove = (e) => {
                    if (stickPointerId === null || e.pointerId !== stickPointerId) return;
                    e.preventDefault();
                    updateStickByPointer(e.clientX, e.clientY);
                };

                const onGlobalPointerUp = (e) => {
                    if (stickPointerId === null || e.pointerId !== stickPointerId) return;
                    e.preventDefault();
                    releaseStick();
                };

                root.addEventListener('contextmenu', (e) => e.preventDefault());
                stickZone.addEventListener('pointerdown', onStickPointerDown, { passive: false });
                window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
                window.addEventListener('pointerup', onGlobalPointerUp, { passive: false });
                window.addEventListener('pointercancel', onGlobalPointerUp, { passive: false });
                window.addEventListener('blur', () => {
                    releaseStick();
                });

                const onViewportChange = () => { refresh(); };
                window.addEventListener('resize', onViewportChange);
                window.addEventListener('orientationchange', () => { setTimeout(onViewportChange, 80); });

                const syncTimer = window.setInterval(refresh, 180);
                root.__mobileDirectSyncTimer = syncTimer;
                refresh();

                return {
                    refresh,
                    release: () => {
                        releaseStick();
                    }
                };
            })();
            this.mobileDirectUi = mobileDirectUi;
            if (typeof window !== 'undefined') {
                window.MobileDirectControlUI = mobileDirectUi;
            }

            // ======== PC 筌띾뜆?????源??========
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

                    // [NEW] PC ?怨좉깻?? ?醫뤾문 ?醫딅뻺 ??猷?(疫꿸퀡??RTS 獄쎻뫗??
                    if (typeof this.isDirectControlActive === 'function' && this.isDirectControlActive()) {
                        return;
                    }

                    if (this.selectedUnits && this.selectedUnits.size > 0 && !this.buildMode.active && !this.targetingType) {
                        clearManualTankMgHold();

                        this.selectedUnits.forEach(u => {
                            if (!u || u.dead) return;
                            u.commandMode = 'move';
                            u.commandTargetX = worldX; // ??獄쏆꼶諭??揶쏄퉮??(facing??
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

                    // (?醫뤾문 ?醫딅뻺 ??곸몵筌? ?怨좉깻?? 燁삳?李????뺤삋域??醫?
                    cameraDrag = true;
                    cameraLastX = p.x;
                } else if (e.button === 0) {
                    // [NEW] 椰꾨똻苑?筌뤴뫀諭?餓λ쵐?좑쭖?獄쏄퀣??筌ｌ꼶??
                    if (this.buildMode.active) {
                        this.handleBuildPlacement(p.x + this.cameraX);
                        return;
                    }
                    // ?ル슦寃®뵳? ??野껋옖??餓λ쵐?좑쭖???野껋옖??筌ｌ꼶??
                    if (this.targetingType) {
                        this.handleTargeting(p.x + this.cameraX, p.y);
                        return;
                    }
                    // ?醫뤾문 獄쏅벡????뺤삋域???뽰삂
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

                // [NEW] 椰꾨똻苑?筌뤴뫀諭??袁ⓥ봺????낅쑓??꾨뱜
                if (this.buildMode.active) {
                    this.updateBuildPreview(p.x + this.cameraX, p.y);
                }

                // 燁삳?李????뺤삋域?(?怨좉깻??
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

                // ?醫뤾문 獄쏅벡??揶쏄퉮??(?ル슦寃®뵳?
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
                    // ?醫뤾문 獄쏅벡?ゅ첎? ??댭??臾믪몵筌???μ뵬 ?????곗쨮 筌ｌ꼶??
                    const dx = Math.abs(this.selectEndX - this.selectStartX);
                    const dy = Math.abs(this.selectEndY - this.selectStartY);
                    if (dx < 10 && dy < 10) {
                        // ??μ뵬 ???? 疫꿸퀣??????嚥≪뮇彛?
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
                        // ??뺤삋域??醫뤾문: 獄쏅벡?????醫딅뻺 ?醫뤾문
                        if (this.selectUnitsInRect) this.selectUnitsInRect();
                        this.selectedBuilding = null;
                    }
                }
            });

            // ?怨좉깻??筌롫뗀??筌△뫀??+ ??뺤쨴 筌뤿굝議?+ 椰꾨똻苑??띯뫁??
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

                // [NEW] 椰꾨똻苑?筌뤴뫀諭??띯뫁??
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

            // ======== 筌뤴뫀而???怨쀭뒄 ??源??========
            this.canvas.addEventListener('touchstart', e => {
                e.preventDefault();

                // [NEW] Block if any touch is inside HUD area
                for (let i = 0; i < e.touches.length; i++) {
                    if (isInsideHUD(e.touches[i].clientX, e.touches[i].clientY)) return;
                }

                if (e.touches.length === 1) {
                    // ??μ뵬 ?怨쀭뒄: ?醫딅뻺 ?醫뤾문 筌뤴뫀諭?(燁삳?李????猷?疫뀀뜆?)
                    isMobileSelecting = true;
                    isMobileCameraMove = false;
                    pinchActive = false;

                    const p = getScaledPos(e.touches[0].clientX, e.touches[0].clientY);
                    if (!isInsideCanvasClient(e.touches[0].clientX, e.touches[0].clientY)) return;

                    // [NEW] 椰꾨똻苑?筌뤴뫀諭?餓λ쵐?좑쭖?獄쏄퀣??筌ｌ꼶??
                    if (this.buildMode.active) {
                        this.updateBuildPreview(p.x + this.cameraX, p.y);
                        this.handleBuildPlacement(p.x + this.cameraX);
                        isMobileSelecting = false;
                        return;
                    }

                    // ??野껋옖??餓λ쵐?좑쭖???野껋옖??筌ｌ꼶??
                    if (this.targetingType) {
                        this.handleTargeting(p.x + this.cameraX, p.y);
                        isMobileSelecting = false;
                        return;
                    }

                    // ?醫뤾문 獄쏅벡????뽰삂
                    this.selectDragActive = true;
                    this.selectStartX = p.x + this.cameraX;
                    this.selectStartY = p.y;
                    this.selectEndX = this.selectStartX;
                    this.selectEndY = this.selectStartY;

                    // [MOBILE TAP FIX] ???癒?젟????? ?ル슦紐?疫꿸퀡以?
                    tapStartClientX = tapLastClientX = e.touches[0].clientX;
                    tapStartClientY = tapLastClientY = e.touches[0].clientY;

                } else if (e.touches.length >= 2) {
                    // ???癒??? 燁삳?李????猷?筌뤴뫀諭?
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
                // 筌뤴뫀而???醫뤾문 餓? 燁삳?李????猷??袁⑹읈 筌△뫀??
                if (isMobileSelecting && this.selectDragActive) {
                    e.preventDefault();
                    const p = getScaledPos(e.touches[0].clientX, e.touches[0].clientY);
                    this.selectEndX = p.x + this.cameraX;
                    this.selectEndY = p.y;

                    // [MOBILE TAP FIX] 筌띾뜆?筌???? ?ル슦紐?揶쏄퉮??
                    tapLastClientX = e.touches[0].clientX;
                    tapLastClientY = e.touches[0].clientY;

                    return; // 燁삳?李??嚥≪뮇彛??紐꾪뀱 疫뀀뜆?
                }

                // ???癒???燁삳?李????猷?
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

                    // [MOBILE TAP FIX] ?遺얜굡?ル슦紐?dx,dy)嚥????癒?젟??롢늺 筌뤴뫀而??깅퓠??椰꾧퀣????湲???뺤삋域밸챶以???쇱뵥??
                    // ??? 疫꿸퀣???곗쨮 ????뺤삋域??癒?젟
                    const ct = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
                    const endClientX = ct ? ct.clientX : tapLastClientX;
                    const endClientY = ct ? ct.clientY : tapLastClientY;
                    const movedPx = Math.hypot(endClientX - tapStartClientX, endClientY - tapStartClientY);

                    if (movedPx < TAP_THRESHOLD_PX) {
                        // ??μ뵬 ?? "???ル슦紐???疫꿸퀣???곗쨮 ????筌ｌ꼶?????類μ넇)
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
                        // ??뺤삋域??醫뤾문
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

            // [NEW] ESC ??살쨮 椰꾨똻苑???野껋옖??筌뤴뫀諭??띯뫁??
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

