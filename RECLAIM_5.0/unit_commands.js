/**
 * unit_commands.js - R 2.4 유닛 명령 패널/다중 선택/드래그 선택
 */

(function () {
    'use strict';

    // ============================================
    // A) ?곹깭 蹂??珥덇린??(?ㅼ쨷 ?좏깮)
    // ============================================
    game.selectedUnits = new Set();

    // ============================================
    // [NEW] Custom cursor + move marker (PC)
    //  - system cursor is hidden via CSS (#game-canvas{cursor:none;})
    //  - we draw cursor + right-click move marker in-canvas
    // ============================================
    game.moveEffects = game.moveEffects || [];
    game.__cursor = game.__cursor || {
        clientX: 0,
        clientY: 0,
        x: 0,
        y: 0,
        down: false,
        button: 0,
        inCanvas: false
    };

    function __clientToCanvas(clientX, clientY) {
        const wrapper = document.getElementById('game-wrapper');
        const rect = wrapper ? wrapper.getBoundingClientRect() : { left: 0, top: 0 };
        return {
            x: (clientX - rect.left) / (game.scaleRatio || 1),
            y: (clientY - rect.top) / (game.scaleRatio || 1)
        };
    }

    function __updateCursor(clientX, clientY) {
        const p = __clientToCanvas(clientX, clientY);
        game.__cursor.clientX = clientX;
        game.__cursor.clientY = clientY;
        game.__cursor.x = p.x;
        game.__cursor.y = p.y;
    }

    if (!game.__cursorListenersBound) {
        game.__cursorListenersBound = true;

        window.addEventListener('mousemove', (e) => __updateCursor(e.clientX, e.clientY));
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 || e.button === 2) {
                game.__cursor.down = true;
                game.__cursor.button = e.button;
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0 || e.button === 2) {
                game.__cursor.down = false;
            }
        });

        if (game.canvas) {
            game.canvas.addEventListener('mouseenter', () => { game.__cursor.inCanvas = true; });
            game.canvas.addEventListener('mouseleave', () => { game.__cursor.inCanvas = false; });
        }
    }

    // ============================================
    // B) Unit.prototype.update 紐쏀궎?⑥튂
    // ============================================
    const __origUpdate = Unit.prototype.update;

    Unit.prototype.update = function (enemies, buildings) {
        if (this.dead) return;

        // [FIX] Builder buildTask priority: allow construction movement even when selected
        if (this.stats.isBuilder && this.buildTask) {
            __origUpdate.call(this, enemies, buildings);
            return;
        }

        // [NEW] Move mode processing
        if (this.team === 'player' && this.commandMode === 'move') {
            if (this.stats.type === 'air') this.rotorAngle += 0.8;
            if (this.lastDamagedFrame && game.frame - this.lastDamagedFrame < 10) {
                this.commandMode = 'stop'; this.targetX = null; return;
            }
            const enemy = this.findNearestEnemy(enemies, buildings);
            if (enemy && Math.abs(enemy.x - this.x) <= (this.stats.range || 0)) {
                this.commandMode = 'stop'; this.targetX = null; return;
            }
            if (this.targetX !== null && this.targetX !== undefined) {
                const dx = this.targetX - this.x;
                if (Math.abs(dx) < 10) { this.commandMode = 'stop'; this.targetX = null; }
                else { this.x += this.stats.speed * Math.sign(dx); }
            } else { this.commandMode = 'stop'; }
            return;
        }

        // ?뚮젅?댁뼱 ?좊떅??而ㅻ㎤??紐⑤뱶 泥섎━
        if (this.team === 'player' && this.commandMode) {
            if (this.commandMode === 'stop') {
                // 공중은 제자리 유지
                if (this.stats.type === 'air') { this.rotorAngle += 0.8; return; }

                // 지상: 제자리 유지 + 사거리 내 자동 공격만 수행
                const target = this.findNearestEnemy(enemies, buildings);
                const canAttack = (target && Math.abs(target.x - this.x) <= (this.stats.range || 0));
                if (canAttack) {
                    let rate = 60;
                    if (['humvee', 'apc', 'aa_tank', 'turret', 'blackhawk'].includes(this.stats.id)) rate = 15;
                    else if (this.stats.id === 'spg') rate = 300;

                    if (game.frame - this.lastAttack > rate) {
                        this.attack(target);
                        this.lastAttack = game.frame;
                    }
                }
                return;
            }

            if (this.commandMode === 'retreat') {
                // ?꾪눜: 湲곗? ??baseX + 100)源뚯?留??대룞 ???뺤?
                const playerHQ = game.buildings.find(b => b.type === 'hq_player');
                const baseX = playerHQ ? playerHQ.x : 150;
                const stopX = baseX + 100;

                if (this.x > stopX) {
                    this.attackTarget = null;
                    const speed = this.stats.speed || 0.5;
                    this.x -= speed;
                    this.updateFacing();
                } else {
                    // 湲곗? ???꾨떖: ?먮룞 ?뺤?
                    this.commandMode = 'stop';
                    this.returnToBase = false;
                }

                if (this.stats.type === 'air') this.rotorAngle += 0.8;
                return;
            }
            // commandMode === 'attack'?대㈃ 湲곕낯 AI濡?吏꾪뻾
        }

        // 湲곕낯 update ?ㅽ뻾
        __origUpdate.call(this, enemies, buildings);
    };

    // ============================================
    // C) ?좊떅 ?덊듃?뚯뒪??
    // ============================================
    function isUnitHit(u, wx, wy) {
        if (!u || u.dead) return false;

        const halfW = u.width / 2;
        const left = u.x - halfW;
        const right = u.x + halfW;
        const top = u.y - u.height;
        const bottom = u.y;

        return wx >= left && wx <= right && wy >= top && wy <= bottom;
    }

    // ============================================
    // D) ?좊떅???ш컖???댁뿉 ?덈뒗吏 泥댄겕
    // ============================================
    function isUnitInRect(u, x1, y1, x2, y2) {
        if (!u || u.dead) return false;

        // ?ш컖???뺢퇋??
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);

        // ?좊떅 諛붿슫??諛뺤뒪
        const uLeft = u.x - u.width / 2;
        const uRight = u.x + u.width / 2;
        const uTop = u.y - u.height;
        const uBottom = u.y;

        // 援먯쭛??泥댄겕
        return !(uRight < left || uLeft > right || uBottom < top || uTop > bottom);
    }

    // ============================================
    // E) 紐⑺몴 吏???좊떅 泥댄겕 (?좏깮 遺덇? ?좊떅)
    // ============================================
    function isLockedUnit(u) {
        if (!u || !u.stats) return false;

        const lockedTypes = ['tactical_drone', 'stealth_drone', 'blackhawk', 'chinook'];
        if (lockedTypes.includes(u.stats.id)) {
            if (u.targetX !== null && u.targetX !== undefined) return true;
            if (u.lockedTarget) return true;
        }

        return false;
    }

    // ============================================
    // F) game.checkUnitClick 援ы쁽 (?⑥씪 ?대┃ ?좉?)
    // ============================================
    game.checkUnitClick = function (wx, wy) {
        for (let i = this.players.length - 1; i >= 0; i--) {
            const u = this.players[i];
            if (!isUnitHit(u, wx, wy)) continue;

            if (isLockedUnit(u)) {
                ui.showToast('목표가 지정된 유닛은 조작할 수 없습니다.');
                return true;
            }

            const panel = document.getElementById('unit-cmd-panel');

            // ?좉?: ?좏깮/?댁젣
            if (this.selectedUnits.has(u)) {
                this.selectedUnits.delete(u);
                u.isSelected = false;
                u.commandMode = 'attack'; // ?댁젣 ??怨듦꺽 紐⑤뱶 蹂듦?
                u.returnToBase = false;
            } else {
                this.selectedUnits.add(u);
                u.isSelected = true;
                u.commandMode = 'stop'; // ?좏깮 ??利됱떆 ?뺤?
                u.returnToBase = false;
            }

            // [NEW] Update HUD selection display
            if (typeof this.updateHUDSelection === 'function') {
                this.updateHUDSelection();
            }

            return true;
        }

        return false;
    };

    // ============================================
    // G) game.selectUnitsInRect 援ы쁽 (?쒕옒洹?諛뺤뒪 ?좏깮)
    // ============================================
    game.selectUnitsInRect = function () {
        const x1 = this.selectStartX;
        const y1 = this.selectStartY;
        const x2 = this.selectEndX;
        const y2 = this.selectEndY;

        // 기존 선택 해제
        this.selectedUnits.forEach(u => {
            u.isSelected = false;
            u.commandMode = 'attack';
            u.returnToBase = false;
        });
        this.selectedUnits.clear();

        // 박스 내 유닛 선택
        for (const u of this.players) {
            if (isLockedUnit(u)) continue;
            if (isUnitInRect(u, x1, y1, x2, y2)) {
                this.selectedUnits.add(u);
                u.isSelected = true;
                u.commandMode = 'stop'; // 선택 즉시 정지
                u.returnToBase = false;
            }
        }

        if (this.selectedUnits.size > 0) {
            ui.showToast(`${this.selectedUnits.size}개 유닛 선택 (정지)`);
        }

        // [NEW] Update HUD selection display
        if (typeof this.updateHUDSelection === 'function') {
            this.updateHUDSelection();
        }
    };

    // ============================================
    // H) game.clearAllSelection 援ы쁽 (?꾩껜 ?좏깮 痍⑥냼)
    // ============================================
    game.clearAllSelection = function () {
        this.selectedUnits.forEach(u => {
            u.isSelected = false;
            // commandMode ?좎? (?뺤? ?곹깭硫??뺤? ?좎?)
        });
        this.selectedUnits.clear();

        // [NEW] Update HUD selection display
        if (typeof this.updateHUDSelection === 'function') {
            this.updateHUDSelection();
        }
    };

    // ============================================
    // H-2) game.toggleCmdPanel 援ы쁽 (?⑤꼸 ?닿퀬 ?リ린)
    // ============================================
    game.toggleCmdPanel = function (e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        const cmdActions = document.getElementById('cmd-actions');
        if (!cmdActions) return;
        cmdActions.classList.toggle('hidden');
    };

    // ============================================
    // I) Command panel button wiring (multi-select apply)
    // ============================================
    function setupCommandPanel() {
        const panel = document.getElementById('unit-cmd-panel');
        if (!panel) return;

        const btns = panel.querySelectorAll('button[data-cmd]');
        btns.forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const cmd = this.dataset.cmd;

                // [RECON] 정찰: 전력 분석 모달 열기 (명령모드로 흘리지 않음)
                if (cmd === 'recon') {
                    if (typeof game.toggleScope === 'function') game.toggleScope();
                    if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
                        ui.showToast('적군 전력 분석');
                    }
                    btns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    return;
                }

                // [FIX] move command enters targeting mode (click ground to set destination)
                if (cmd === 'move') {
                    if (typeof game.prepareMoveCommand === 'function') {
                        game.prepareMoveCommand();
                    }
                    btns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    return;
                }

                // [NEW] disband command clears selection
                if (cmd === 'disband') {
                    game.clearAllSelection();
                    return;
                }

                // [P0-3] retreat = 드론 복귀(회수) 통합
                if (cmd === 'retreat') {
                    let droneRecalled = false;

                    // 1순위: 선택된 드론 복귀
                    game.selectedUnits.forEach(u => {
                        if (u && !u.dead && (u.stats?.id === 'drone_suicide' || u.stats?.id === 'drone_at' || u.stats?.category === 'drone')) {
                            if (typeof game.requestDroneRecall === 'function') {
                                game.requestDroneRecall(u);
                                droneRecalled = true;
                            }
                        }
                    });

                    // 2순위: 선택된 드론병의 ownedDrone 복귀
                    if (!droneRecalled) {
                        game.selectedUnits.forEach(u => {
                            if (u && !u.dead && u.stats?.operator && u.ownedDrone && !u.ownedDrone.dead) {
                                if (typeof game.requestDroneRecall === 'function') {
                                    game.requestDroneRecall(u.ownedDrone);
                                    droneRecalled = true;
                                }
                            }
                        });
                    }

                    // 3순위: 일반 유닛 후퇴
                    if (!droneRecalled) {
                        game.selectedUnits.forEach(u => {
                            if (!u.dead) {
                                u.commandMode = 'retreat';
                                u.returnToBase = true;
                            }
                        });
                    }

                    btns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    return;
                }

                // (기존: stop/attack 등은 바로 적용)
                game.selectedUnits.forEach(u => {
                    if (!u.dead) {
                        u.commandMode = cmd;
                    }
                });

                btns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });

        const clearBtn = document.getElementById('clear-units-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                game.clearAllSelection();
            });
        }

        const layoutToggle = document.getElementById('cmd-layout-toggle');
        const cmdActions = document.getElementById('cmd-actions');
        const cmdPanel = document.getElementById('unit-cmd-panel');
        if (layoutToggle && cmdActions && cmdPanel) {
            layoutToggle.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const isRow = cmdActions.classList.toggle('is-row');
                cmdPanel.classList.toggle('is-horizontal', isRow);
                layoutToggle.textContent = isRow ? '\u2194' : '\u2195';
            });
        }

        const wrapper = document.getElementById('unit-cmd-wrapper');
        const handle = document.getElementById('cmd-panel-toggle');
        if (!wrapper || !handle) return;

        let dragging = false;
        let dragMoved = false;
        let startX = 0;
        let startY = 0;
        let baseLeft = 0;
        let baseTop = 0;

        const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

        const beginDrag = (clientX, clientY) => {
            const rect = wrapper.getBoundingClientRect();
            wrapper.style.left = `${rect.left}px`;
            wrapper.style.top = `${rect.top}px`;
            wrapper.style.right = 'auto';
            wrapper.style.bottom = 'auto';
            wrapper.style.position = 'fixed';
            baseLeft = rect.left;
            baseTop = rect.top;
            startX = clientX;
            startY = clientY;
            dragging = true;
            dragMoved = false;
        };

        const updateDrag = (clientX, clientY) => {
            if (!dragging) return;
            const dx = clientX - startX;
            const dy = clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
            const rect = wrapper.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width;
            const maxTop = window.innerHeight - rect.height;
            const nextLeft = clamp(baseLeft + dx, 0, maxLeft);
            const nextTop = clamp(baseTop + dy, 0, maxTop);
            wrapper.style.left = `${nextLeft}px`;
            wrapper.style.top = `${nextTop}px`;
        };

        const endDrag = () => {
            dragging = false;
        };

        handle.addEventListener('mousedown', (e) => {
            if (!e.target.closest('#cmd-panel-toggle')) return;
            beginDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            updateDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            endDrag();
        });

        handle.addEventListener('touchstart', (e) => {
            if (!e.touches[0]) return;
            if (!e.target.closest('#cmd-panel-toggle')) return;
            e.preventDefault();
            beginDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            if (!e.touches[0]) return;
            e.preventDefault();
            updateDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        window.addEventListener('touchend', () => {
            if (!dragging) return;
            if (!dragMoved) handle.click();
            endDrag();
        });

        handle.addEventListener('click', (e) => {
            if (dragMoved) {
                e.preventDefault();
                e.stopPropagation();
                dragMoved = false;
            }
        });
    }

    function setupHudCtrlPanel() {
        const wrapper = document.getElementById('hud-ctrl-wrapper');
        const handle = document.getElementById('hud-ctrl-toggle');
        const controls = document.getElementById('hud-ctrl-body');
        if (!wrapper || !handle || !controls) return;

        let dragging = false;
        let dragMoved = false;
        let startX = 0;
        let startY = 0;
        let baseLeft = 0;
        let baseTop = 0;

        const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

        const beginDrag = (clientX, clientY) => {
            const rect = wrapper.getBoundingClientRect();
            wrapper.style.left = `${rect.left}px`;
            wrapper.style.top = `${rect.top}px`;
            wrapper.style.right = 'auto';
            wrapper.style.bottom = 'auto';
            wrapper.style.position = 'fixed';
            baseLeft = rect.left;
            baseTop = rect.top;
            startX = clientX;
            startY = clientY;
            dragging = true;
            dragMoved = false;
        };

        const updateDrag = (clientX, clientY) => {
            if (!dragging) return;
            const dx = clientX - startX;
            const dy = clientY - startY;
            if (!dragMoved && Math.abs(dx) + Math.abs(dy) <= 6) return;
            if (Math.abs(dx) + Math.abs(dy) > 6) dragMoved = true;
            const rect = wrapper.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width;
            const maxTop = window.innerHeight - rect.height;
            const nextLeft = clamp(baseLeft + dx, 0, maxLeft);
            const nextTop = clamp(baseTop + dy, 0, maxTop);
            wrapper.style.left = `${nextLeft}px`;
            wrapper.style.top = `${nextTop}px`;
        };

        const endDrag = () => { dragging = false; };

        const toggleControls = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            const isHidden = controls.classList.toggle('hidden');
            handle.textContent = isHidden ? '\u2795' : '\uD83C\uDF9B';
        };

        handle.addEventListener('click', (e) => {
            if (dragMoved) {
                e.preventDefault();
                e.stopPropagation();
                dragMoved = false;
                return;
            }
            toggleControls(e);
        });

        handle.addEventListener('mousedown', (e) => {
            beginDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            updateDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            endDrag();
        });

        handle.addEventListener('touchstart', (e) => {
            if (!e.touches[0]) return;
            e.preventDefault();
            beginDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            if (!e.touches[0]) return;
            e.preventDefault();
            updateDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        window.addEventListener('touchend', () => {
            if (!dragging) return;
            if (!dragMoved) toggleControls();
            endDrag();
        });
    }

    // ============================================
    // J) Selection box + highlight rendering (game.draw wrap)
    // ============================================
    const __origDraw = game.draw.bind(game);

    game.draw = function () {
        __origDraw();

        const ctx = this.ctx;

        if (this.selectDragActive) {
            ctx.save();

            // [FIX] 줌 레벨 적용 - 선택 박스가 커서와 정확히 일치하도록
            const z = (typeof Camera !== 'undefined' && Camera.zoom) ? Camera.zoom : 1;
            const gy = this.groundY;

            // 월드(view) → 스크린 변환(렌더와 동일: groundY 기준 스케일)
            const toSX = (worldX) => (worldX - this.cameraX) * z;
            const toSY = (viewY) => gy + (viewY - gy) * z;

            const x1 = toSX(this.selectStartX);
            const y1 = toSY(this.selectStartY);
            const x2 = toSX(this.selectEndX);
            const y2 = toSY(this.selectEndY);

            const left = Math.min(x1, x2);
            const top = Math.min(y1, y2);
            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);

            ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
            ctx.fillRect(left, top, width, height);

            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(left, top, width, height);

            ctx.restore();
        }

        /*
        // Selected unit marker: HP bar under the unit (replaces green dot)
        if (this.selectedUnits.size > 0) {
            ctx.save();

            // [FIX] 줌 레벨 적용 - HP바가 유닛 아래에 정확히 붙도록
            const z = (typeof Camera !== 'undefined' && Camera.zoom) ? Camera.zoom : 1;
            const gy = this.groundY;

            this.selectedUnits.forEach(u => {
                if (!u || u.dead || !u.isSelected) return;

                const hp = (typeof u.hp === 'number') ? u.hp : 0;
                const maxHp = (typeof u.maxHp === 'number' && u.maxHp > 0) ? u.maxHp : 1;
                const ratio = Math.max(0, Math.min(1, hp / maxHp));

                const barW = 34 * z;
                const barH = 5 * z;

                // 월드 좌표를 스크린 좌표로 변환
                const screenX = (u.x - this.cameraX) * z - barW / 2;
                const screenY = gy + (u.y + 12 - gy) * z;

                ctx.fillStyle = 'rgba(15, 18, 21, 0.85)';
                ctx.fillRect(screenX, screenY, barW, barH);

                ctx.fillStyle = '#22c55e';
                ctx.fillRect(screenX, screenY, Math.floor(barW * ratio), barH);

                ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                ctx.lineWidth = 1;
                ctx.strokeRect(screenX - 0.5, screenY - 0.5, barW + 1, barH + 1);
            });

            ctx.restore();
        }
        */

        // Move marker effects (screen-space)
        if (this.moveEffects && this.moveEffects.length) {
            for (let i = 0; i < this.moveEffects.length; i++) {
                const eff = this.moveEffects[i];
                eff.life -= 0.05;
                eff.radius -= 0.6;

                if (eff.life <= 0) {
                    this.moveEffects.splice(i, 1);
                    i--;
                    continue;
                }

                ctx.save();
                ctx.translate(eff.x, eff.y);

                const color = `rgba(50, 255, 100, ${eff.life})`;
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.arc(0, 0, Math.max(0, eff.radius), 0, Math.PI * 2);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI * 2);
                ctx.fill();

                const innerR = Math.max(6, eff.radius - 6);
                ctx.beginPath();
                ctx.moveTo(0, -innerR); ctx.lineTo(0, -3);
                ctx.moveTo(0, innerR); ctx.lineTo(0, 3);
                ctx.moveTo(-innerR, 0); ctx.lineTo(-3, 0);
                ctx.moveTo(innerR, 0); ctx.lineTo(3, 0);
                ctx.stroke();

                ctx.restore();
            }
        }

        // Custom cursor (screen-space)
        if (this.__cursor && this.__cursor.inCanvas) {
            let isHovering = false;
            let hoverType = null;

            if (!this.__cursor.down) {
                const p = Camera.screenToView ? Camera.screenToView(this, this.__cursor.clientX, this.__cursor.clientY) : { x: this.__cursor.x, y: this.__cursor.y };
                const wx = p.x + this.cameraX;
                const wy = p.y;

                if (Array.isArray(this.players)) {
                    for (let i = this.players.length - 1; i >= 0; i--) {
                        const u = this.players[i];
                        if (u && !u.dead && u.stats && u.stats.team === 'player' && isUnitHit(u, wx, wy)) {
                            isHovering = true;
                            hoverType = 'ally';
                            break;
                        }
                    }
                }
                if (!isHovering && Array.isArray(this.enemies)) {
                    for (let i = this.enemies.length - 1; i >= 0; i--) {
                        const u = this.enemies[i];
                        if (u && !u.dead && u.stats && u.stats.team === 'enemy' && isUnitHit(u, wx, wy)) {
                            isHovering = true;
                            hoverType = 'enemy';
                            break;
                        }
                    }
                }
            }

            const mx = this.__cursor.x;
            const my = this.__cursor.y;

            ctx.save();
            ctx.translate(mx, my);

            if (this.__cursor.down && this.__cursor.button === 0 && this.selectDragActive) {
                // Drag-select cursor
                ctx.strokeStyle = '#ffcc00';
                ctx.lineWidth = 2;
                const size = 15;
                const gap = 5;

                ctx.beginPath();
                ctx.moveTo(-size, -gap); ctx.lineTo(-size, -size); ctx.lineTo(-gap, -size);
                ctx.moveTo(gap, -size); ctx.lineTo(size, -size); ctx.lineTo(size, -gap);
                ctx.moveTo(size, gap); ctx.lineTo(size, size); ctx.lineTo(gap, size);
                ctx.moveTo(-gap, size); ctx.lineTo(-size, size); ctx.lineTo(-size, gap);
                ctx.stroke();

                ctx.fillStyle = '#ffcc00';
                ctx.beginPath();
                ctx.arc(0, 0, 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (isHovering) {
                // Hover cursor (ally/enemy)
                const targetColor = (hoverType === 'ally') ? '#00ff00' : '#ff3333';
                ctx.strokeStyle = targetColor;
                ctx.lineWidth = 2;
                const size = 12;

                ctx.beginPath();
                ctx.moveTo(0, -size); ctx.lineTo(size, 0);
                ctx.lineTo(0, size); ctx.lineTo(-size, 0);
                ctx.closePath();
                ctx.stroke();

                const tickLen = 6;
                ctx.beginPath();
                ctx.moveTo(0, -size - tickLen); ctx.lineTo(0, -size);
                ctx.moveTo(0, size + tickLen); ctx.lineTo(0, size);
                ctx.moveTo(-size - tickLen, 0); ctx.lineTo(-size, 0);
                ctx.moveTo(size + tickLen, 0); ctx.lineTo(size, 0);
                ctx.stroke();

                ctx.fillStyle = targetColor;
                ctx.beginPath();
                ctx.arc(0, 0, 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Default cursor
                ctx.strokeStyle = '#00ffcc';
                ctx.lineWidth = 3;
                const size = 12;
                const gap = 4;

                ctx.beginPath();
                ctx.moveTo(0, -size); ctx.lineTo(0, -gap);
                ctx.moveTo(0, gap); ctx.lineTo(0, size);
                ctx.moveTo(-size, 0); ctx.lineTo(-gap, 0);
                ctx.moveTo(gap, 0); ctx.lineTo(size, 0);
                ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, 1, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    };

    // ============================================
    // K) Remove dead units from selection (game.update wrap)
    // ============================================
    const __origGameUpdate = game.update.bind(game);

    game.update = function () {
        __origGameUpdate();

        this.selectedUnits.forEach(u => {
            if (u.dead) {
                this.selectedUnits.delete(u);
            }
        });
    };

    // [RECON] 선택 유닛에 recon이 있을 때만 정찰 버튼 노출
    (function hookReconButtonVisibility() {
        if (!game || typeof game.updateHUDSelection !== 'function') return;
        const _orig = game.updateHUDSelection.bind(game);
        game.updateHUDSelection = function () {
            _orig();
            const btn = document.getElementById('cmd-recon-btn');
            if (!btn) return;
            const hasRecon = this.selectedUnits && [...this.selectedUnits].some(u => u && !u.dead && u.stats && u.stats.id === 'recon');
            btn.classList.toggle('hidden', !hasRecon);
        };
    })();

    // ============================================
    // Init
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupCommandPanel();
            setupHudCtrlPanel();
        });
    } else {
        setupCommandPanel();
        setupHudCtrlPanel();
    }

})();
