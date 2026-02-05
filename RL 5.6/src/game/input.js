// src/game/input.js - Input handling
(function () {
    'use strict';

    window.GameInput = {
        setup() {
            // [R 2.4] 완전 재설계된 입력 시스템
            const getScaledPos = (clientX, clientY) => {
                return Camera.screenToView(this, clientX, clientY);
            };

            // [NEW] Check if click/touch is inside HUD area (input blocking)
            const isInsideHUD = (clientY) => {
                const hudFooter = document.getElementById('hud-footer');
                if (!hudFooter || hudFooter.classList.contains('hidden')) return false;
                const rect = hudFooter.getBoundingClientRect();
                return clientY >= rect.top;
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

            // [MOBILE TAP FIX] 탭/드래그 판정은 월드좌표가 아니라 "픽셀" 기준으로 한다
            let tapStartClientX = 0, tapStartClientY = 0;
            let tapLastClientX = 0, tapLastClientY = 0;
            const TAP_THRESHOLD_PX = 14; // 12~18 사이 취향, 14 추천

            // [MODIFIED] 건물 선택 (플레이어 건설 건물 포함)
            const selectBuildingAt = (wx, wy) => {
                // 선택 가능한 건물 타입들
                const selectableTypes = [
                    'hq_player', 'hq_enemy', 'fortress_player', 'fortress_enemy',
                    'watchtower'  // [3.8] 플레이어 건설 감시탑
                ];

                for (let b of this.buildings) {
                    if (b.dead) continue;
                    // 기존 타입 또는 canProduce 플래그가 있는 건물만 선택 가능
                    if (!selectableTypes.includes(b.type) && !b.canProduce && !b.canShoot) continue;
                    // [FIX] 클릭 범위 확대 (좌우 +20px, 상하 +15px)
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

            const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const getTouchMid = (t1, t2) => ({
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
            });

            // ======== PC 마우스 이벤트 ========
            this.canvas.addEventListener('mousedown', e => {
                // [NEW] Block if inside HUD area
                if (isInsideHUD(e.clientY)) return;

                const p = getScaledPos(e.clientX, e.clientY);
                if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) return;

                if (e.button === 2) {
                    // [NEW] PC 우클릭: 선택 유닛 이동 (기본 RTS 방식)
                    if (this.selectedUnits && this.selectedUnits.size > 0 && !this.buildMode.active && !this.targetingType) {
                        const worldX = p.x + this.cameraX;
                        const worldY = p.y;

                        this.selectedUnits.forEach(u => {
                            if (!u || u.dead) return;
                            u.commandMode = 'move';
                            u.commandTargetX = worldX; // ★ 반드시 갱신 (facing용)
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

                    // (선택 유닛 없으면) 우클릭: 카메라 드래그 유지
                    cameraDrag = true;
                    cameraLastX = p.x;
                } else if (e.button === 0) {
                    // [NEW] 건설 모드 중이면 배치 처리
                    if (this.buildMode.active) {
                        this.handleBuildPlacement(p.x + this.cameraX);
                        return;
                    }
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

                // [NEW] 건설 모드 프리뷰 업데이트
                if (this.buildMode.active) {
                    this.updateBuildPreview(p.x + this.cameraX, p.y);
                }

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
                        if (this.tryDroneLockdown && this.tryDroneLockdown(clickX, clickY)) return;
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

            // 우클릭 메뉴 차단 + 드론 명령 + 건설 취소
            this.canvas.addEventListener('contextmenu', e => {
                e.preventDefault();
                // [NEW] Block if inside HUD area
                if (isInsideHUD(e.clientY)) return;

                // [NEW] 건설 모드 취소
                if (this.buildMode.active) {
                    this.cancelBuildMode();
                    ui.showToast('건설 취소');
                    return;
                }

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

                // [NEW] Block if any touch is inside HUD area
                for (let i = 0; i < e.touches.length; i++) {
                    if (isInsideHUD(e.touches[i].clientY)) return;
                }

                if (e.touches.length === 1) {
                    // 단일 터치: 유닛 선택 모드 (카메라 이동 금지)
                    isMobileSelecting = true;
                    isMobileCameraMove = false;
                    pinchActive = false;

                    const p = getScaledPos(e.touches[0].clientX, e.touches[0].clientY);
                    if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) return;

                    // [NEW] 건설 모드 중이면 배치 처리
                    if (this.buildMode.active) {
                        this.updateBuildPreview(p.x + this.cameraX, p.y);
                        this.handleBuildPlacement(p.x + this.cameraX);
                        isMobileSelecting = false;
                        return;
                    }

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

                    // [MOBILE TAP FIX] 탭 판정용 픽셀 좌표 기록
                    tapStartClientX = tapLastClientX = e.touches[0].clientX;
                    tapStartClientY = tapLastClientY = e.touches[0].clientY;

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

                    // [MOBILE TAP FIX] 마지막 픽셀 좌표 갱신
                    tapLastClientX = e.touches[0].clientX;
                    tapLastClientY = e.touches[0].clientY;

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

                    // [MOBILE TAP FIX] 월드좌표(dx,dy)로 탭 판정하면 모바일에서 거의 항상 드래그로 오인됨
                    // 픽셀 기준으로 탭/드래그 판정
                    const ct = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
                    const endClientX = ct ? ct.clientX : tapLastClientX;
                    const endClientY = ct ? ct.clientY : tapLastClientY;
                    const movedPx = Math.hypot(endClientX - tapStartClientX, endClientY - tapStartClientY);

                    if (movedPx < TAP_THRESHOLD_PX) {
                        // 단일 탭: "끝 좌표"를 기준으로 클릭 처리(더 정확)
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

            // [NEW] ESC 키로 건설/타겟팅 모드 취소
            window.addEventListener('keydown', e => {
                if (e.key === 'Escape') {
                    if (this.buildMode.active) {
                        this.cancelBuildMode();
                        ui.showToast('건설 취소');
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
        }
    };
})();
