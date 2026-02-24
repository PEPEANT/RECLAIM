// [FILE] ui.js: ?? UI ??(??/??/???/?? ?? ??) ??.
// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
const ui = {
    toastTimer: null,
    toastFadeTimer: null,
    elementCache: {}, // [OPTIMIZATION] DOM 요소 캐싱
    lastValues: {},   // [OPTIMIZATION] 이전 프레임 데이터 저장 (값 변경 감지용)
    _optTabsBound: false,
    _optFullscreenBound: false,
    _optFullscreenDocBound: false,
    _optHitboxBound: false,
    _optActiveTab: 'general',
    _optContext: 'general',
    _exitAction: 'quit',
    _unitIconBgColor: '',

    init() {
        this.initUnitScroller();
        this.bindOptionFullscreenControl();
        this.bindOptionHitboxControl();
    },

    ensureGlobalToastElement() {
        let el = document.getElementById('global-toast-msg');
        if (el) return el;

        el = document.createElement('div');
        el.id = 'global-toast-msg';
        el.className = 'hidden';
        el.style.position = 'fixed';
        el.style.left = '50%';
        el.style.top = '11%';
        el.style.transform = 'translate(-50%, -6px)';
        el.style.zIndex = '200';
        el.style.maxWidth = 'min(88vw, 640px)';
        el.style.padding = '10px 16px';
        el.style.borderRadius = '10px';
        el.style.border = '1px solid rgba(251, 191, 36, 0.45)';
        el.style.background = 'linear-gradient(90deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.86))';
        el.style.color = '#f8fafc';
        el.style.fontWeight = '700';
        el.style.fontSize = '14px';
        el.style.letterSpacing = '0.3px';
        el.style.textAlign = 'center';
        el.style.boxShadow = '0 14px 34px rgba(2, 6, 23, 0.55)';
        el.style.pointerEvents = 'none';
        el.style.opacity = '0';
        el.style.transition = 'opacity 180ms ease, transform 180ms ease';
        document.body.appendChild(el);
        return el;
    },

    normalizeToastMessage(msg) {
        const text = String(msg || '').trim();
        if (!text) return '';

        if (/자금이 부족|자원\s*부족|자원\s*또는\s*재고\s*부족|금화가 부족|money is low|not enough money/i.test(text)) {
            return '돈이 부족합니다.';
        }
        if (/인구\s*한도|인구.*부족|population cap|max pop|인구가 가득/i.test(text)) {
            return '인구가 가득 찼습니다.';
        }
        return text;
    },

    initUnitScroller() {
        const container = document.getElementById('unit-list-container');
        const btnRight = document.getElementById('unit-scroll-right');
        if (!container || !btnRight) return;

        const scrollAmount = () => Math.max(160, Math.round(container.clientWidth * 0.6));
        const update = () => {
            const max = container.scrollWidth - container.clientWidth;
            const hasOverflow = container.scrollWidth > container.clientWidth + 2;
            btnRight.classList.toggle('hidden', !hasOverflow);
            btnRight.classList.toggle('disabled', container.scrollLeft >= max - 2);
        };

        btnRight.addEventListener('click', () => {
            container.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
        });
        container.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', () => setTimeout(update, 50));

        this._updateUnitScroller = update;
        update();
    },

    showToast(msg) {
        const normalized = this.normalizeToastMessage(msg);
        if (!normalized) return;

        // Keep log output in chat panel.
        if (typeof ChatPanel !== 'undefined' && ChatPanel._list) {
            ChatPanel.push(normalized, 'SYS');
        }

        const globalToast = this.ensureGlobalToastElement();
        if (globalToast) {
            globalToast.textContent = normalized;
            globalToast.classList.remove('hidden');
            globalToast.style.opacity = '1';
            globalToast.style.transform = 'translate(-50%, 0)';

            clearTimeout(this.toastTimer);
            clearTimeout(this.toastFadeTimer);
            this.toastTimer = setTimeout(() => {
                globalToast.style.opacity = '0';
                globalToast.style.transform = 'translate(-50%, -6px)';
                this.toastFadeTimer = setTimeout(() => {
                    globalToast.classList.add('hidden');
                }, 220);
            }, 1700);
        }

    },

    toggleBriefing() {
        document.getElementById('briefing-detail').classList.toggle('show');
    },

    getUnitCategoryForTab(unitKey, unitDef) {
        const key = String(unitKey || '').trim();
        const category = String(unitDef?.category || '').trim().toLowerCase();
        if (category === 'infantry' || category === 'armored' || category === 'air' || category === 'special' || category === 'drone') {
            return category;
        }
        if (key === 'recon') return 'air';

        const type = String(unitDef?.type || '').trim().toLowerCase();
        if (type === 'air') return 'air';
        if (type === 'mech') return 'armored';
        if (type === 'skill') return 'special';
        return 'infantry';
    },

    getPlayerUnitIconBgColor() {
        const fallback = '#4A8522';
        try {
            if (typeof TeamColors !== 'undefined' && TeamColors && typeof TeamColors.get === 'function') {
                const raw = String(TeamColors.get('player', 'primary') || '').trim();
                if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
                if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
                    const r = raw[1], g = raw[2], b = raw[3];
                    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
                }
            }
        } catch (_) { }
        return fallback;
    },

    drawUnitButtonIcon(canvas, unitKey, unitDef, bgColor = '#4A8522') {
        if (!canvas || !unitDef) return false;
        const ctx = (typeof canvas.getContext === 'function') ? canvas.getContext('2d') : null;
        if (!ctx) return false;

        const key = String(unitKey || '').trim();
        const u = unitDef;
        const svgIcons = (typeof UnitProfileIcons !== 'undefined') ? UnitProfileIcons : null;
        const drewSvg = !!(svgIcons && typeof svgIcons.drawToCanvas === 'function'
            && svgIcons.drawToCanvas(ctx, key, u, {
                bgColor,
                padX: 1,
                padY: 1
            }));

        const iconUtils = (typeof UnitRenderUtils !== 'undefined') ? UnitRenderUtils : null;
        const drew = drewSvg || !!(iconUtils && typeof iconUtils.drawUnitIconToCanvas === 'function'
            && iconUtils.drawUnitIconToCanvas(ctx, key, u, {
                centerX: 32,
                bottomY: 44,
                baseScale: 0.8,
                baseOffsetY: 0,
                drawFallback: false
            }));

        if (!drew) {
            const w = Math.max(10, Math.min(50, Math.round((Number(u.width) || 30) * 0.9)));
            const h = Math.max(6, Math.min(26, Math.round((Number(u.height) || 16) * 0.9)));
            ctx.clearRect(0, 0, Number(canvas.width) || 64, Number(canvas.height) || 48);
            ctx.fillStyle = u.color || '#38bdf8';
            ctx.globalAlpha = 0.9;
            ctx.fillRect((60 - w) / 2, (40 - h) / 2 + 6, w, h);
            ctx.globalAlpha = 1;
        }
        return true;
    },

    refreshUnitButtonIconTheme(force = false) {
        const nextBgColor = this.getPlayerUnitIconBgColor();
        if (!force && this._unitIconBgColor === nextBgColor) return;
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) {
            this._unitIconBgColor = nextBgColor;
            return;
        }

        Object.keys(this.elementCache || {}).forEach((key) => {
            const cache = this.elementCache[key];
            if (!cache || !cache.iconCvs) return;
            const unitDef = CONFIG.units[key];
            if (!unitDef) return;
            this.drawUnitButtonIcon(cache.iconCvs, key, unitDef, nextBgColor);
        });

        this._unitIconBgColor = nextBgColor;
    },

    // [OPTIMIZATION] 초기 1회 실행: 모든 유닛 버튼 생성 및 캐싱
    initUnitButtons(currentCategory) {
        const container = document.getElementById('unit-list-container');
        container.innerHTML = ''; // 초기화
        this.elementCache = {};
        this.lastValues = {};
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) {
            console.warn('[UI] CONFIG.units not available. Skipping unit button init.');
            return;
        }

        const icbmSkillKeys = new Set(['nuke', 'tactical_missile', 'emp']);
        const iconBgColor = this.getPlayerUnitIconBgColor();
        const rawUnitKeys = Object.keys(CONFIG.units);
        const unitOrderIndex = new Map(rawUnitKeys.map((unitKey, idx) => [unitKey, idx]));
        const infantryUiOrder = new Map([
            ['infantry', 0],
            ['engineer', 1],
            ['special_ops', 2],
            ['drone_operator', 3],
            ['sniper', 4],   // 5th in infantry row (1-based)
            ['bagpiper', 5]  // last in infantry row
        ]);
        const sortedUnitKeys = rawUnitKeys.slice().sort((a, b) => {
            const aDef = CONFIG.units[a];
            const bDef = CONFIG.units[b];
            const aCategory = this.getUnitCategoryForTab(a, aDef);
            const bCategory = this.getUnitCategoryForTab(b, bDef);

            // Infantry row fixed order:
            // infantry -> engineer -> special_ops -> drone_operator -> sniper -> bagpiper
            if (aCategory === 'infantry' && bCategory === 'infantry') {
                const aInfOrder = infantryUiOrder.has(a) ? infantryUiOrder.get(a) : null;
                const bInfOrder = infantryUiOrder.has(b) ? infantryUiOrder.get(b) : null;
                if (aInfOrder !== null && bInfOrder !== null) {
                    return aInfOrder - bInfOrder;
                }
                if (aInfOrder !== null) return -1;
                if (bInfOrder !== null) return 1;
            }

            return (unitOrderIndex.get(a) ?? 0) - (unitOrderIndex.get(b) ?? 0);
        });

        sortedUnitKeys.forEach(key => {
            const u = CONFIG.units[key];
            if (!u) {
                console.warn(`[UI] Missing unit config for key: ${key}`);
                return;
            }

            // [R 4.2] 생산바에서 숨김 처리된 유닛은 버튼 생성 스킵
            if (u.hideFromUnitBar === true) return;
            // [R 4.3] 드론병 전용 발진 드론은 생성바에서 제거 (명령 스킬 전용)
            if (u.droneLaunchOnly === true) return;
            // ICBM payload skills are command-key only (never shown in unit placement bar).
            if (icbmSkillKeys.has(key)) return;

            // 버튼 DOM 생성
            const btn = document.createElement('div');
            btn.id = `btn-${key}`;
            btn.className = 'btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg shrink-0 cursor-pointer select-none';
            btn.style.display = 'flex';

            // 캔버스 아이콘 (한 번만 그림)
            const iconCvs = document.createElement('canvas');
            iconCvs.width = 64; iconCvs.height = 48;
            this.drawUnitButtonIcon(iconCvs, key, u, iconBgColor);

            btn.appendChild(iconCvs);

            // 텍스트 및 오버레이 생성
            const nameSpan = document.createElement('span');
            nameSpan.className = 'font-bold text-[10px] z-10 absolute top-0 w-full text-center bg-black/30 text-white';
            // [Localization]
            nameSpan.setAttribute('data-lang', `unit_${key}_name`);
            nameSpan.innerText = (typeof Lang !== 'undefined') ? Lang.getText(`unit_${key}_name`) : u.name;
            // [R 4.2] 기본 라벨 보존(타겟팅 중 "취소" 토글용)
            nameSpan.dataset.defaultText = nameSpan.innerText;
            btn.appendChild(nameSpan);

            const countSpan = document.createElement('span');
            countSpan.className = 'count-text z-50 absolute bottom-1 right-1';
            countSpan.innerText = '--';
            btn.appendChild(countSpan);

            const cdDiv = document.createElement('div');
            cdDiv.className = 'cooldown-overlay h-0';
            btn.appendChild(cdDiv);

            const qBadge = document.createElement('div');
            qBadge.className = 'queue-badge hidden';
            qBadge.innerText = '0';
            btn.appendChild(qBadge);

            // 캐시에 저장 (매 프레임 검색 방지)
            this.elementCache[key] = { btn, nameSpan, countSpan, cdDiv, qBadge, iconCvs };
            this.lastValues[key] = { stock: -1, cdRatio: -1, queue: -1, active: null };

            // 이벤트 바인딩
            this.bindButtonEvents(btn, key);
            container.appendChild(btn);
        });

        this._unitIconBgColor = iconBgColor;

        if (typeof this._updateUnitScroller === 'function') {
            this._updateUnitScroller();
        }
    },

    bindButtonEvents(btn, key) {
        btn.addEventListener('mouseenter', (e) => this.showUnitInfo(key, e));
        btn.addEventListener('mouseleave', () => this.hideUnitInfo());

        const targetingKeys = new Set(['tactical_drone', 'stealth_drone', 'nuke', 'tactical_missile', 'emp']);

        const startAction = (e) => {
            e.preventDefault();
            if (targetingKeys.has(key) && game.targetingType === key) {
                game.cancelTargeting();
                return;
            }
            game.startHold(key);
        };
        const endAction = (e) => { e.preventDefault(); game.endHold(key); };

        btn.addEventListener('mousedown', startAction);
        btn.addEventListener('mouseup', endAction);
        btn.addEventListener('mouseleave', endAction);
        btn.addEventListener('touchstart', startAction, { passive: false });
        btn.addEventListener('touchend', endAction, { passive: false });
        btn.addEventListener('touchcancel', endAction, { passive: false }); // [Mobile] Safety
    },

    // [OPTIMIZATION] 매 프레임 호출: 값이 변했을 때만 DOM 수정
    showExitConfirmation(action) {
        const modal = document.getElementById('exit-modal');
        if (!modal) return;

        const titleEl = modal.querySelector('[data-lang="exit_confirm_title"]');
        const descEl = modal.querySelector('[data-lang="exit_confirm_desc"]');
        const inGame = !!(typeof game !== 'undefined' && game && game.running);
        const mode = String(action || '').trim().toLowerCase();
        const resolvedAction = (mode === 'retreat' || mode === 'quit')
            ? mode
            : (inGame ? 'retreat' : 'quit');
        this._exitAction = resolvedAction;

        let titleText = '게임 종료';
        let descText = '현재 진행 정보는 유지됩니다. 게임을 종료하시겠습니까?';
        if (resolvedAction === 'retreat') {
            titleText = '전투 후퇴';
            descText = '현재 진행 정보는 유지됩니다. 전투를 종료하고 맵 선택으로 복귀하시겠습니까?';
        }
        if (titleEl) titleEl.innerText = titleText;
        if (descEl) descEl.innerText = descText;

        modal.classList.remove('hidden');
    },

    openRetreatConfirmationFromOptions(event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();

        // Keep options open behind the confirmation so the retreat action button
        // does not appear to disappear immediately.
        const openDialog = () => this.showExitConfirmation('retreat');
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(openDialog);
        } else {
            setTimeout(openDialog, 0);
        }
    },

    confirmExit(yes) {
        const modal = document.getElementById('exit-modal');
        if (modal) modal.classList.add('hidden');
        if (!yes) {
            // Cancel -> Stay.
            // If we pushed state in popstate event, we are effectively "forward" again?
            // If user pressed Back (Popped) -> We Pushed (Returned to state).
            // So we are fine.
            return;
        }

        if (typeof game !== 'undefined' && game) {
            const inGame = !!game.running;
            const action = (this._exitAction === 'retreat' || this._exitAction === 'quit')
                ? this._exitAction
                : (inGame ? 'retreat' : 'quit');

            if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
                app.saveNow();
            }

            if (action === 'retreat' && inGame) {
                if (typeof game.backToLobby === 'function') {
                    game.backToLobby();
                }
                history.replaceState({ page: 'map-select' }, "MapSelect", "#map-select");
                this.showToast('전투를 종료하고 맵 선택으로 복귀했습니다.');
                return;
            }

            game.running = false;
            game.isGameOver = false;
            if (game.loopId) {
                cancelAnimationFrame(game.loopId);
                game.loopId = null;
            }
            if (typeof game._cleanupTimers === 'function') {
                game._cleanupTimers();
            }
            if (typeof game.cancelTargeting === 'function') {
                game.cancelTargeting();
            }
            if (typeof game.backToLobby === 'function') {
                game.backToLobby();
            }

            history.replaceState({ page: 'map-select' }, "MapSelect", "#map-select");

            this.showToast('게임을 종료했습니다.');

            // 브라우저 정책상 자동 창 닫기가 막힐 수 있어 로비 화면을 기본 종료 상태로 사용.
            try { window.close(); } catch (_) { }
        }
    },

    updateUnitButtons(cat, stock, cooldowns, supply, queue) {
        this.refreshUnitButtonIconTheme(false);
        const icbmSkillKeys = new Set(['nuke', 'tactical_missile', 'emp']);
        const normalizedCategory = (cat === 'infantry' || cat === 'armored' || cat === 'air')
            ? cat
            : 'infantry';
        const safeStock = (stock && typeof stock === 'object') ? stock : {};
        const safeCooldowns = (cooldowns && typeof cooldowns === 'object') ? cooldowns : {};
        const safeQueue = (queue && typeof queue === 'object') ? queue : {};
        const safeSkillCharges = (typeof game !== 'undefined' && game && typeof game.skillCharges === 'object')
            ? game.skillCharges
            : {};
        const safeSupply = Math.max(0, Number(supply) || 0);

        Object.keys(CONFIG.units).forEach(key => {
            const cache = this.elementCache[key];
            if (!cache) return;

            const u = CONFIG.units[key];
            const isDroneOnly = (u.droneLaunchOnly === true);
            if (isDroneOnly) {
                if (cache.btn.style.display !== 'none') cache.btn.style.display = 'none';
                return;
            }
            let currentCount = 0;
            if (u.isSkill) {
                currentCount = safeSkillCharges[u.chargeKey];
            } else {
                currentCount = safeStock[key];
            }
            currentCount = Math.max(0, Math.floor(Number(currentCount) || 0));

            const unitCategory = this.getUnitCategoryForTab(key, u);
            const isVisible = !icbmSkillKeys.has(key)
                && u.isSkill !== true
                && unitCategory === normalizedCategory;

            // 1. 카테고리 표시/숨김 최적화
            if (cache.btn.style.display !== (isVisible ? 'flex' : 'none')) {
                cache.btn.style.display = isVisible ? 'flex' : 'none';
            }
            if (!isVisible) return; // 안 보이면 업데이트 생략

            const last = this.lastValues[key];

            // [R 4.2] 타겟팅 토글 상태(버튼 라벨: 취소)
            if (cache.nameSpan) {
                const wantCancel = (game.targetingType === key);
                const defaultText = cache.nameSpan.dataset.defaultText || cache.nameSpan.innerText;
                const nextText = wantCancel ? '취소' : defaultText;
                if (cache.nameSpan.innerText !== nextText) {
                    cache.nameSpan.innerText = nextText;
                }
            }

            // 2. 재고/스킬 횟수 업데이트
            if (last.stock !== currentCount) {
                if (u.droneLaunchOnly) {
                    cache.countSpan.innerText = `${currentCount}기`;
                } else {
                    cache.countSpan.innerText = u.isSkill ? currentCount + '발' : currentCount;
                }
                last.stock = currentCount;
            }

            // 3. 쿨타임 업데이트
            const baseCooldown = Math.max(1, Number(u.cooldown) || 1);
            const currentCooldown = Math.max(0, Number(safeCooldowns[key]) || 0);
            const currentRatio = currentCooldown / baseCooldown;
            // 쿨타임이 0이거나 완료된 상태에서 불필요한 스타일 변경 방지
            if (Math.abs(last.cdRatio - currentRatio) > 0.01) {
                cache.cdDiv.style.height = `${currentRatio * 100}%`;
                last.cdRatio = currentRatio;
            }

            // 4. 대기열 뱃지
            const currentQ = Math.max(0, Number(safeQueue[key]) || 0);
            if (last.queue !== currentQ) {
                if (currentQ > 0) {
                    // 대기열 배지는 베테랑 아이템 배지(+n)와 구분되도록 Q 접두어를 사용.
                    cache.qBadge.innerText = `Q${currentQ}`;
                    cache.qBadge.classList.remove('hidden');
                } else {
                    cache.qBadge.classList.add('hidden');
                }
                last.queue = currentQ;
            }

            // 5. 버튼 활성/비활성 상태
            let isActive = true;
            if (u.isSkill) {
                if (currentCount <= 0) isActive = false;
                if (currentCooldown > 0) isActive = false;
                if (typeof game.hasReadyIcbmLauncher === 'function' && !game.hasReadyIcbmLauncher('player')) isActive = false;
            } else {
                if (safeSupply < u.cost || currentCount <= 0) isActive = false;
            }

            if (last.active !== isActive) {
                if (isActive) cache.btn.classList.remove('btn-disabled');
                else cache.btn.classList.add('btn-disabled');
                last.active = isActive;
            }
        });

        if (typeof this._updateUnitScroller === 'function') {
            this._updateUnitScroller();
        }
    },

    showUnitInfo(key) {
        const u = CONFIG.units[key];
        const panel = document.getElementById('unit-info-panel');
        if (!panel) return;
        if (!panel) return;

        let name = u.name;
        let desc = u.description || '...';

        // [Localization]
        if (typeof Lang !== 'undefined') {
            name = Lang.getText(`unit_${key}_name`);
            desc = Lang.getText(`unit_${key}_desc`);
        }

        document.getElementById('info-name').innerText = name;
        document.getElementById('info-name').style.color = u.color;
        document.getElementById('info-role').innerText = u.role || '유닛';
        document.getElementById('info-desc').innerText = desc;
        panel.classList.add('visible');
    },

    hideUnitInfo() {
        const panel = document.getElementById('unit-info-panel');
        if (panel) panel.classList.remove('visible');
    },

    updateCategoryTab(currentCategory) {
        const g = (typeof game !== 'undefined') ? game : null;
        const selected = (currentCategory === 'infantry' || currentCategory === 'armored' || currentCategory === 'air')
            ? currentCategory
            : 'infantry';
        if (g) g.currentCategory = selected;

        const tabs = [
            { id: 'tab-infantry', key: 'infantry' },
            { id: 'tab-armored', key: 'armored' },
            { id: 'tab-air', key: 'air' }
        ];
        tabs.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle('active', key === selected);
        });

        this.updateUnitButtons(
            selected,
            g?.playerStock || {},
            g?.cooldowns || {},
            g?.supply || 0,
            g?.spawnQueue || {}
        );
    },

    updateEnemyStatus(enemyStock) {
        const headRow = document.getElementById('enemy-status-head-row');
        const countRow = document.getElementById('enemy-status-count-row');
        const stateRow = document.getElementById('enemy-status-state-row');
        if (!headRow || !countRow || !stateRow) return;

        // 표시할 유닛만: "현재 존재하는 유닛" 위주로 보여서 컬럼 폭발 방지
        // (스크롤 없게 하려면 0개 유닛까지 전부 보여주면 화면이 무너짐)
        const entries = Object.entries(enemyStock || {})
            .filter(([k, c]) => CONFIG.units[k] && c > 0)
            .sort((a, b) => (b[1] - a[1])); // 수량 많은 순

        // 초기화
        headRow.innerHTML = '';
        countRow.innerHTML = '';
        stateRow.innerHTML = '';

        if (entries.length === 0) {
            headRow.innerHTML = `<th class="stub">유닛</th><th>없음</th>`;
            countRow.innerHTML = `<th class="stub">수량</th><td class="text-center text-gray-400">0</td>`;
            stateRow.innerHTML = `<th class="stub">상태</th><td class="text-center text-gray-400">-</td>`;
            return;
        }

        // 헤더(유닛명)
        headRow.innerHTML = `<th class="stub">유닛</th>` + entries.map(([k]) => {
            const u = CONFIG.units[k];
            return `<th title="${u.name}">${u.name}</th>`;
        }).join('');

        // 수량
        countRow.innerHTML = `<th class="stub">수량</th>` + entries.map(([k, c]) => {
            return `<td class="text-center num">${c}</td>`;
        }).join('');

        // 상태
        stateRow.innerHTML = `<th class="stub">상태</th>` + entries.map(([k, c]) => {
            let cls = 'ok', txt = '양호';
            if (c <= 0) { cls = 'dead'; txt = '전멸'; }
            else if (c < 3) { cls = 'warn'; txt = '위험'; }
            return `<td class="text-center state ${cls}">${txt}</td>`;
        }).join('');
    },

    setSkillCount(type, count) {
        const el = document.getElementById(`cnt-${type}`);
        if (el) el.innerText = count + "발";
        const btn = document.getElementById(`btn-${type}`);
        if (btn) {
            if (count <= 0) btn.classList.add('used');
            else btn.classList.remove('used');
        }
    },

    bindOptionTabs() {
        if (this._optTabsBound) return;
        const tabButtons = document.querySelectorAll('[data-opt-tab-btn]');
        if (!tabButtons || !tabButtons.length) return;
        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = String(btn.dataset.optTabBtn || '').trim();
                if (tab) this.setOptionTab(tab);
            });
        });
        this._optTabsBound = true;
    },

    setOptionTab(tab) {
        const requested = String(tab || '').trim();
        const tabButtons = Array.from(document.querySelectorAll('[data-opt-tab-btn]'));
        const tabPanels = document.querySelectorAll('.opt-tab-panel');
        if (!tabButtons.length) return;

        const visibleButtons = tabButtons.filter((btn) => !btn.classList.contains('hidden'));
        if (!visibleButtons.length) return;

        const requestedButton = visibleButtons.find((btn) => btn.dataset.optTabBtn === requested);
        const next = requestedButton ? requested : String(visibleButtons[0].dataset.optTabBtn || '').trim();
        if (!next) return;

        tabButtons.forEach((btn) => {
            const isActive = btn.dataset.optTabBtn === next;
            btn.classList.toggle('active', isActive);
        });
        tabPanels.forEach((panel) => {
            const isActive = panel.id === `opt-tab-${next}`;
            panel.classList.toggle('active', isActive);
        });
        this._optActiveTab = next;
    },

    isFullscreenAvailable() {
        const root = document.documentElement;
        const canEnter = !!(root && (
            root.requestFullscreen
            || root.webkitRequestFullscreen
            || root.msRequestFullscreen
        ));
        const canExit = !!(
            document.exitFullscreen
            || document.webkitExitFullscreen
            || document.msExitFullscreen
        );
        return canEnter || canExit;
    },

    isFullscreenActive() {
        return !!(
            document.fullscreenElement
            || document.webkitFullscreenElement
            || document.msFullscreenElement
        );
    },

    requestAppFullscreen() {
        const root = document.documentElement;
        if (!root) return Promise.reject(new Error('fullscreen_root_missing'));
        if (root.requestFullscreen) return root.requestFullscreen();
        if (root.webkitRequestFullscreen) {
            root.webkitRequestFullscreen();
            return Promise.resolve();
        }
        if (root.msRequestFullscreen) {
            root.msRequestFullscreen();
            return Promise.resolve();
        }
        return Promise.reject(new Error('fullscreen_not_supported'));
    },

    exitAppFullscreen() {
        if (document.exitFullscreen) return document.exitFullscreen();
        if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
            return Promise.resolve();
        }
        if (document.msExitFullscreen) {
            document.msExitFullscreen();
            return Promise.resolve();
        }
        return Promise.reject(new Error('fullscreen_exit_not_supported'));
    },

    syncOptionFullscreenState() {
        const btn = document.getElementById('opt-fullscreen-toggle');
        const state = document.getElementById('opt-fullscreen-state');
        if (!btn) return;

        const available = this.isFullscreenAvailable();
        const active = this.isFullscreenActive();

        btn.disabled = !available;
        if (!available) {
            btn.innerText = '전체화면 미지원';
            if (state) state.innerText = '현재 기기/브라우저는 전체화면 전환을 지원하지 않습니다.';
            return;
        }

        btn.innerText = active ? '전체화면 끄기' : '전체화면 켜기';
        if (state) state.innerText = active ? '현재: 전체화면 모드' : '현재: 창 모드';
    },

    async toggleOptionFullscreen() {
        if (!this.isFullscreenAvailable()) {
            this.syncOptionFullscreenState();
            this.showToast('이 브라우저는 전체화면을 지원하지 않습니다.');
            return;
        }

        try {
            if (this.isFullscreenActive()) await this.exitAppFullscreen();
            else await this.requestAppFullscreen();
        } catch (_) {
            this.showToast('전체화면 전환에 실패했습니다.');
        } finally {
            this.syncOptionFullscreenState();
        }
    },

    bindOptionFullscreenControl() {
        const toggleBtn = document.getElementById('opt-fullscreen-toggle');
        if (toggleBtn && !this._optFullscreenBound) {
            toggleBtn.addEventListener('click', () => {
                this.toggleOptionFullscreen();
            });
            this._optFullscreenBound = true;
        }

        if (!this._optFullscreenDocBound) {
            const onChange = () => this.syncOptionFullscreenState();
            document.addEventListener('fullscreenchange', onChange);
            document.addEventListener('webkitfullscreenchange', onChange);
            document.addEventListener('MSFullscreenChange', onChange);
            this._optFullscreenDocBound = true;
        }

        this.syncOptionFullscreenState();
    },

    isHitboxDebugEnabled() {
        const gameObj = (typeof game !== 'undefined') ? game : null;
        if (!gameObj) return false;
        if (!gameObj.debug || typeof gameObj.debug !== 'object') {
            gameObj.debug = {};
        }
        if (!Object.prototype.hasOwnProperty.call(gameObj.debug, 'showUnitHitboxes')) {
            gameObj.debug.showUnitHitboxes = false;
        }
        return gameObj.debug.showUnitHitboxes === true;
    },

    syncOptionHitboxState() {
        const btn = document.getElementById('opt-hitbox-toggle');
        const state = document.getElementById('opt-hitbox-state');
        if (!btn) return;
        const enabled = this.isHitboxDebugEnabled();
        btn.innerText = enabled ? '히트박스 끄기' : '히트박스 켜기';
        if (state) state.innerText = enabled ? '현재: 표시 중' : '현재: 숨김';
    },

    setHitboxDebugEnabled(enabled) {
        const gameObj = (typeof game !== 'undefined') ? game : null;
        if (!gameObj) return false;
        if (!gameObj.debug || typeof gameObj.debug !== 'object') {
            gameObj.debug = {};
        }
        gameObj.debug.showUnitHitboxes = !!enabled;
        this.syncOptionHitboxState();
        return true;
    },

    toggleOptionHitboxDebug() {
        const next = !this.isHitboxDebugEnabled();
        this.setHitboxDebugEnabled(next);
    },

    bindOptionHitboxControl() {
        const toggleBtn = document.getElementById('opt-hitbox-toggle');
        if (toggleBtn && !this._optHitboxBound) {
            toggleBtn.addEventListener('click', () => {
                this.toggleOptionHitboxDebug();
            });
            this._optHitboxBound = true;
        }
        this.syncOptionHitboxState();
    },

    isElementVisibleById(id) {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.classList.contains('hidden')) return false;
        const cs = window.getComputedStyle(el);
        if (!cs) return false;
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        return Number(cs.opacity || '1') > 0;
    },

    isAnyAuthModalOpen() {
        return false;
    },

    resolveOptionContext(gameRef) {
        const inGame = !!(gameRef && gameRef.running === true);
        if (inGame) return 'ingame';

        const inMapSelect = this.isElementVisibleById('map-select-screen');
        if (inMapSelect) return 'map-select';

        return 'general';
    },

    setOptionTabVisibility(tab, visible) {
        const tabKey = String(tab || '').trim();
        if (!tabKey) return;
        const btn = document.querySelector(`[data-opt-tab-btn="${tabKey}"]`);
        const panel = document.getElementById(`opt-tab-${tabKey}`);
        if (btn) btn.classList.toggle('hidden', !visible);
        if (panel && !visible) panel.classList.remove('active');
    },

    applyOptionContext(context) {
        const ctx = String(context || 'general').trim().toLowerCase() || 'general';
        this._optContext = ctx;

        const optionModal = document.getElementById('option-modal');
        if (optionModal) {
            optionModal.setAttribute('data-opt-context', ctx);
        }

        const titleEl = document.getElementById('opt-modal-title');
        const gameTitleEl = document.getElementById('opt-game-title');
        const gameDescEl = document.getElementById('opt-game-desc');
        const exitBtn = document.getElementById('opt-exit-btn');
        const quitBtn = document.getElementById('opt-quit-btn');
        const bgmSelectRow = document.getElementById('opt-bgm-select-row');

        const configByContext = {
            'map-select': {
                modalTitle: '맵 선택 설정',
                gameTitle: '맵 선택/종료',
                gameDesc: '맵 선택 화면에서 설정 변경 또는 게임 종료를 사용할 수 있습니다.',
                showRetreat: false,
                showQuit: true
            },
            ingame: {
                modalTitle: '인게임 설정',
                gameTitle: '전투/종료',
                gameDesc: '전투 중에는 철수 후 맵 선택 복귀 또는 게임 종료를 사용할 수 있습니다.',
                showRetreat: true,
                showQuit: true
            },
            general: {
                modalTitle: 'SETTINGS',
                gameTitle: '전투/종료',
                gameDesc: '전투 중에는 철수, 평시에는 종료 확인을 사용할 수 있습니다.',
                showRetreat: false,
                showQuit: true
            }
        };

        const cfg = configByContext[ctx] || configByContext.general;
        if (titleEl) titleEl.innerText = cfg.modalTitle;
        if (gameTitleEl) gameTitleEl.innerText = cfg.gameTitle;
        if (gameDescEl) gameDescEl.innerText = cfg.gameDesc;

        this.setOptionTabVisibility('gameplay', true);
        this.setOptionTabVisibility('general', true);
        this.setOptionTabVisibility('video', true);
        this.setOptionTabVisibility('audio', true);
        this.setOptionTabVisibility('language', true);
        this.setOptionTabVisibility('credits', true);

        if (exitBtn) exitBtn.style.display = cfg.showRetreat ? '' : 'none';
        if (quitBtn) quitBtn.style.display = cfg.showQuit ? '' : 'none';
        if (bgmSelectRow) bgmSelectRow.classList.add('hidden');
    },

    handleEscapeShortcut(event, gameRef) {
        if (!event || event.key !== 'Escape') return false;
        if (event.repeat) {
            event.preventDefault();
            event.stopPropagation();
            return true;
        }

        if (this.isAnyAuthModalOpen()) return false;

        const optionModal = document.getElementById('option-modal');
        if (optionModal && optionModal.classList.contains('active')) {
            this.closeOptions();
            event.preventDefault();
            event.stopPropagation();
            return true;
        }

        if (this.isElementVisibleById('exit-modal')) {
            this.confirmExit(false);
            event.preventDefault();
            event.stopPropagation();
            return true;
        }

        const gameObj = gameRef || ((typeof game !== 'undefined') ? game : null);
        const context = this.resolveOptionContext(gameObj);
        if (context === 'map-select' || context === 'ingame') {
            this.openOptions({ context, source: 'esc' });
            event.preventDefault();
            event.stopPropagation();
            return true;
        }

        return false;
    },

    // [New] Options Modal Logic
    openOptions(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const gameObj = (typeof game !== 'undefined') ? game : null;
        const requestedContext = String(opts.context || '').trim().toLowerCase();
        const context = requestedContext || this.resolveOptionContext(gameObj);
        const requestedTab = String(opts.tab || '').trim().toLowerCase();

        document.getElementById('option-modal').classList.add('active');
        this.bindOptionTabs();
        this.bindOptionFullscreenControl();
        this.bindOptionHitboxControl();
        this.applyOptionContext(context);

        let defaultTab = 'gameplay';
        if (context === 'ingame' || context === 'map-select') {
            defaultTab = 'general';
        }

        const nextTab = requestedTab || defaultTab;
        this.setOptionTab(nextTab);
        // Update slider values
        if (typeof AudioSystem !== 'undefined' && AudioSystem && AudioSystem.volume) {
            const syncVolumeUi = (type, fallback = 0.5) => {
                const raw = Number(AudioSystem.volume[type]);
                const normalized = Number.isFinite(raw) ? raw : fallback;
                const pct = Math.max(0, Math.min(100, Math.round(normalized * 100)));
                const valEl = document.getElementById(`vol-${type}-val`);
                if (valEl) valEl.innerText = `${pct}%`;
                const slider = document.querySelector(`input[data-volume='${type}']`)
                    || document.querySelector(`input[oninput*='${type}']`);
                if (slider) slider.value = pct;
            };

            // Audio tab is simplified to BGM/SFX, but keep master sync for backward compatibility.
            syncVolumeUi('master', 0.5);
            syncVolumeUi('bgm', 0.4);
            syncVolumeUi('sfx', 0.6);
        }

        const iogToggle = document.getElementById('opt-iog-always-open');
        if (iogToggle) {
            const keepOpen = !!(gameObj && gameObj.settings && gameObj.settings.iogAlwaysOpen === true);
            iogToggle.checked = keepOpen;
        }

        // Sync Speed Buttons
        if (gameObj) this.updateSpeedBtns(gameObj.speed);
    },

    closeOptions() {
        document.getElementById('option-modal').classList.remove('active');
    },

    setVolume(type, val) {
        const v = val / 100;
        if (typeof AudioSystem !== 'undefined') {
            if (type === 'bgm') AudioSystem.setBGMVolume(v);
            else AudioSystem.setVolume(type, v);
        }
        const labelEl = document.getElementById(`vol-${type}-val`);
        if (labelEl) labelEl.innerText = val + '%';
    },

    changeBGM(val) {
        if (typeof AudioSystem !== 'undefined') AudioSystem.playMP3(val);
    },

    setIogAlwaysOpen(enabled) {
        const keepOpen = !!enabled;
        const gameObj = (typeof game !== 'undefined') ? game : null;
        if (gameObj) {
            if (!gameObj.settings || typeof gameObj.settings !== 'object') {
                gameObj.settings = {};
            }
            gameObj.settings.iogAlwaysOpen = keepOpen;
        }

        if (typeof ChatPanel !== 'undefined' && ChatPanel) {
            if (keepOpen) {
                ChatPanel.show();
                ChatPanel.setOpen(true);
            } else {
                ChatPanel.setOpen(false);
            }
        }

        if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
            try { app.saveNow(); } catch (_) { }
        }
    },

    updateSpeedBtns(s) {
        // HUD Buttons only (options panel no longer has speed buttons)
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-speed-${s}`);
        if (activeBtn) activeBtn.classList.add('active');
    }
};

if (typeof window !== 'undefined') {
    window.ui = ui;
}


