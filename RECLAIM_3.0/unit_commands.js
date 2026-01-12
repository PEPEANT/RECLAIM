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
    // B) Unit.prototype.update 紐쏀궎?⑥튂
    // ============================================
    const __origUpdate = Unit.prototype.update;

    Unit.prototype.update = function (enemies, buildings) {
        if (this.dead) return;

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

                game.selectedUnits.forEach(u => {
                    if (!u.dead) {
                        u.commandMode = cmd;
                        u.returnToBase = (cmd === 'retreat');
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

            const sx1 = this.selectStartX - this.cameraX;
            const sy1 = this.selectStartY;
            const sx2 = this.selectEndX - this.cameraX;
            const sy2 = this.selectEndY;

            const left = Math.min(sx1, sx2);
            const top = Math.min(sy1, sy2);
            const width = Math.abs(sx2 - sx1);
            const height = Math.abs(sy2 - sy1);

            ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
            ctx.fillRect(left, top, width, height);

            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(left, top, width, height);

            ctx.restore();
        }

        if (this.selectedUnits.size > 0) {
            ctx.save();
            ctx.translate(-Math.floor(this.cameraX), 0);

            this.selectedUnits.forEach(u => {
                if (u && !u.dead && u.isSelected) {
                    const sx = u.x;
                    const sy = u.y - u.height - 12;

                    ctx.fillStyle = '#22c55e';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            });

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

