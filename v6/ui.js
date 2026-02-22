// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
const ui = {
    toastTimer: null,
    toastFadeTimer: null,
    elementCache: {}, // [OPTIMIZATION] DOM 요소 캐싱
    lastValues: {},   // [OPTIMIZATION] 이전 프레임 데이터 저장 (값 변경 감지용)
    _optProfileBound: false,
    _optProfileRenameOpen: false,
    _optProfileAliasKey: 'reclaim_profile_alias_v1',
    _optProfileAvatarKey: 'reclaim_profile_avatar_v1',
    _optTabsBound: false,
    _optFullscreenBound: false,
    _optFullscreenDocBound: false,
    _optActiveTab: 'general',
    _optContext: 'general',
    _exitAction: 'quit',
    _veteranTabSignature: '',
    _veteranMode: false,
    _veteranToggleBound: false,

    init() {
        this.initUnitScroller();
        this.bindVeteranToggle();
        this.bindOptionProfileActions();
        this.bindOptionFullscreenControl();
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

    bindVeteranToggle() {
        if (this._veteranToggleBound) {
            this.updateVeteranToggleButton();
            return;
        }
        const btn = document.getElementById('unit-veteran-toggle');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.setVeteranMode(!this._veteranMode);
        });
        this._veteranToggleBound = true;
        this.updateVeteranToggleButton();
    },

    setVeteranMode(enabled, options = {}) {
        const next = enabled === true;
        const prev = this._veteranMode === true;
        this._veteranMode = next;
        this.updateVeteranToggleButton();
        if (prev === next && options.forceRefresh !== true) return;

        this._veteranTabSignature = '';

        if (typeof app !== 'undefined' && app && typeof app.markUiDirty === 'function') {
            app.markUiDirty();
            return;
        }

        const g = (typeof game !== 'undefined') ? game : null;
        if (!g) return;
        this.updateUnitButtons(
            g.currentCategory,
            g.playerStock || {},
            g.cooldowns || {},
            g.supply || 0,
            g.spawnQueue || {}
        );
    },

    updateVeteranToggleButton() {
        const btn = document.getElementById('unit-veteran-toggle');
        if (!btn) return;
        const isOpen = this._veteranMode === true;
        btn.classList.toggle('is-open', isOpen);
        btn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
        const label = isOpen ? '일반 생산 보기' : '베테랑 생산 보기';
        btn.setAttribute('aria-label', label);
        btn.title = label;
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

        // Defensive mapping: recon should always be treated as an air unit tab entry.
        if (key === 'recon') return 'air';

        const type = String(unitDef?.type || '').trim().toLowerCase();
        if (type === 'air') return 'air';
        if (type === 'mech') return 'armored';
        if (type === 'skill') return 'special';
        return 'infantry';
    },

    // [OPTIMIZATION] 초기 1회 실행: 모든 유닛 버튼 생성 및 캐싱
    initUnitButtons(currentCategory) {
        const container = document.getElementById('unit-list-container');
        container.innerHTML = ''; // 초기화
        this.elementCache = {};
        this.lastValues = {};
        this._veteranTabSignature = '';
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) {
            console.warn('[UI] CONFIG.units not available. Skipping unit button init.');
            return;
        }

        const icbmSkillKeys = new Set(['nuke', 'tactical_missile', 'emp']);

        Object.keys(CONFIG.units).forEach(key => {
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
            let isVisible = false;
            if (icbmSkillKeys.has(key)) {
                isVisible = false;
            } else {
                const unitCategory = this.getUnitCategoryForTab(key, u);
                isVisible = unitCategory === currentCategory;
            }
            btn.style.display = isVisible ? 'flex' : 'none';

            // 캔버스 아이콘 (한 번만 그림)
            const iconCvs = document.createElement('canvas');
            iconCvs.width = 64; iconCvs.height = 48;
            const ctx = iconCvs.getContext('2d');

            const iconUtils = (typeof UnitRenderUtils !== 'undefined') ? UnitRenderUtils : null;
            const drew = !!(iconUtils && typeof iconUtils.drawUnitIconToCanvas === 'function'
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
                ctx.fillStyle = u.color || '#38bdf8';
                ctx.globalAlpha = 0.9;
                ctx.fillRect((60 - w) / 2, (40 - h) / 2 + 6, w, h);
                ctx.globalAlpha = 1;
            }

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

            const veteranBadge = document.createElement('span');
            veteranBadge.className = 'unit-veteran-link-badge hidden';
            veteranBadge.innerText = 'V0';
            veteranBadge.setAttribute('aria-hidden', 'true');
            btn.appendChild(veteranBadge);

            const cdDiv = document.createElement('div');
            cdDiv.className = 'cooldown-overlay h-0';
            btn.appendChild(cdDiv);

            const qBadge = document.createElement('div');
            qBadge.className = 'queue-badge hidden';
            qBadge.innerText = '0';
            btn.appendChild(qBadge);

            const colorBar = document.createElement('div');
            colorBar.className = 'absolute bottom-0 w-full h-1 z-10';
            colorBar.style.backgroundColor = u.color;
            btn.appendChild(colorBar);

            // 캐시에 저장 (매 프레임 검색 방지)
            this.elementCache[key] = { btn, nameSpan, countSpan, veteranBadge, cdDiv, qBadge };
            this.lastValues[key] = { stock: -1, veteranCount: -1, cdRatio: -1, queue: -1, active: null };

            // 이벤트 바인딩
            this.bindButtonEvents(btn, key);
            container.appendChild(btn);
        });

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
        const isGuestSession = !!(
            typeof CitySimAuth !== 'undefined'
            && CitySimAuth
            && typeof CitySimAuth.isGuestSession === 'function'
            && CitySimAuth.isGuestSession()
        );
        const mode = String(action || '').trim().toLowerCase();
        const resolvedAction = (mode === 'retreat' || mode === 'quit')
            ? mode
            : (inGame ? 'retreat' : 'quit');
        this._exitAction = resolvedAction;

        let titleText = '게임 종료';
        let descText = '현재 진행 정보는 유지됩니다. 게임을 종료하시겠습니까?';
        if (resolvedAction === 'retreat') {
            titleText = '전투 후퇴';
            descText = '현재 진행 정보는 유지됩니다. 전투를 종료하고 시티로 복귀하시겠습니까?';
        } else if (isGuestSession) {
            descText = inGame
                ? '게스트 진행 정보는 저장되지 않습니다. 종료 시 초기화됩니다. 계속할까요?'
                : '게스트 진행 정보는 저장되지 않고 초기화됩니다. 게임을 종료할까요?';
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
            const isGuestSession = !!(
                typeof CitySimAuth !== 'undefined'
                && CitySimAuth
                && typeof CitySimAuth.isGuestSession === 'function'
                && CitySimAuth.isGuestSession()
            );

            if (!isGuestSession && typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
                app.saveNow();
            }

            if (typeof CitySimAuth !== 'undefined' && CitySimAuth && typeof CitySimAuth.cancelAuth === 'function') {
                CitySimAuth.cancelAuth();
            }
            if (action === 'retreat' && inGame) {
                if (typeof game.retreatToCity === 'function') {
                    game.retreatToCity();
                } else if (typeof game.enterCityScreen === 'function') {
                    game.enterCityScreen();
                } else if (typeof game.backToLobby === 'function') {
                    game.backToLobby();
                }
                history.replaceState({ page: 'city' }, "City", "#city");
                this.showToast('전투를 종료하고 시티로 복귀했습니다.');
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
            if (isGuestSession
                && typeof CitySimAuth !== 'undefined'
                && CitySimAuth
                && typeof CitySimAuth.clearGuestProgress === 'function') {
                CitySimAuth.clearGuestProgress();
            }

            if (typeof game.backToLobby === 'function') {
                game.backToLobby();
            } else if (typeof game.hideCityScreen === 'function') {
                game.hideCityScreen();
            }

            history.replaceState({ page: 'lobby' }, "Lobby", "#lobby");
            if (isGuestSession) {
                this.showToast('게스트 진행 정보는 저장되지 않고 초기화되었습니다.');
                try {
                    window.location.hash = '#lobby';
                    window.location.reload();
                } catch (_) { }
                return;
            }

            this.showToast('게임을 종료했습니다.');

            // 브라우저 정책상 자동 창 닫기가 막힐 수 있어 로비 화면을 기본 종료 상태로 사용.
            try { window.close(); } catch (_) { }
        }
    },

    updateUnitButtons(cat, stock, cooldowns, supply, queue) {
        const icbmSkillKeys = new Set(['nuke', 'tactical_missile', 'emp']);
        const safeStock = (stock && typeof stock === 'object') ? stock : {};
        const safeCooldowns = (cooldowns && typeof cooldowns === 'object') ? cooldowns : {};
        const safeQueue = (queue && typeof queue === 'object') ? queue : {};
        const safeSkillCharges = (typeof game !== 'undefined' && game && typeof game.skillCharges === 'object')
            ? game.skillCharges
            : {};
        const safeSupply = Math.max(0, Number(supply) || 0);
        const veteranEntries = (typeof game !== 'undefined'
            && game
            && typeof game.getVeteranSpawnEntries === 'function')
            ? game.getVeteranSpawnEntries()
            : [];
        const veteranCountsByUnit = {};
        const veteranItemCountByUnit = {};
        if (Array.isArray(veteranEntries)) {
            veteranEntries.forEach((entry) => {
                const unitKey = String(entry?.unitKey || '').trim();
                if (!unitKey) return;
                veteranCountsByUnit[unitKey] = Math.max(0, Math.floor(Number(veteranCountsByUnit[unitKey]) || 0)) + 1;
                const itemCount = Math.max(0, Math.floor(Number(entry?.itemCount) || 0));
                const currentItemCount = Math.max(0, Math.floor(Number(veteranItemCountByUnit[unitKey]) || 0));
                veteranItemCountByUnit[unitKey] = currentItemCount + itemCount;
            });
        }

        const normalizedCategory = (cat === 'infantry' || cat === 'armored' || cat === 'air')
            ? cat
            : 'infantry';
        const veteranRows = this._buildVeteranRows(veteranEntries, safeCooldowns, safeSupply);
        const veteranTabActive = (cat === 'veteran');
        const veteranModeActive = (this._veteranMode === true);
        if (veteranModeActive || veteranTabActive) {
            const rowsForRender = veteranModeActive
                ? veteranRows.filter((row) => row.category === normalizedCategory)
                : veteranRows;
            Object.keys(CONFIG.units).forEach((key) => {
                const cache = this.elementCache[key];
                if (!cache || !cache.btn) return;
                if (cache.btn.style.display !== 'none') cache.btn.style.display = 'none';
            });
            this._renderVeteranCategoryButtons(rowsForRender, {
                veteranMode: veteranModeActive,
                category: veteranModeActive ? normalizedCategory : ''
            });
            if (typeof this._updateUnitScroller === 'function') {
                this._updateUnitScroller();
            }
            return;
        }

        this._clearVeteranCategoryButtons(true);

        Object.keys(CONFIG.units).forEach(key => {
            const cache = this.elementCache[key];
            if (!cache) return;

            const u = CONFIG.units[key];
            const veteranCount = Math.max(0, Math.floor(Number(veteranCountsByUnit[key]) || 0));
            if (cache.veteranBadge) {
                if (!u.isSkill && u.droneLaunchOnly !== true && veteranCount > 0) {
                    const itemCount = Math.max(0, Math.floor(Number(veteranItemCountByUnit[key]) || 0));
                    const badgeText = `+${itemCount}`;
                    if (this.lastValues[key].veteranCount !== veteranCount || cache.veteranBadge.innerText !== badgeText) {
                        cache.veteranBadge.innerText = badgeText;
                    }
                    cache.veteranBadge.classList.remove('hidden');
                } else {
                    cache.veteranBadge.classList.add('hidden');
                }
                this.lastValues[key].veteranCount = veteranCount;
            }
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

            let isVisible = false;
            if (icbmSkillKeys.has(key)) {
                isVisible = false;
            } else {
                const unitCategory = this.getUnitCategoryForTab(key, u);
                isVisible = unitCategory === cat;
            }
            isVisible = isVisible && currentCount > 0;

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
                    cache.qBadge.innerText = `+${currentQ}`;
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

    _buildVeteranRows(veteranEntries, cooldowns, supply) {
        const entries = Array.isArray(veteranEntries) ? veteranEntries : [];
        const safeCooldowns = (cooldowns && typeof cooldowns === 'object') ? cooldowns : {};
        const safeSupply = Math.max(0, Number(supply) || 0);
        return entries.map((entry) => {
            const unit = entry && entry.unit ? entry.unit : null;
            const cost = Math.max(0, Number(unit?.cost) || 0);
            const cd = Math.max(0, Number(safeCooldowns[entry.unitKey]) || 0);
            const stock = Math.max(0, Math.floor(Number(entry.stock) || 0));
            const enabled = stock > 0 && cd <= 0 && safeSupply >= cost;
            const category = this.getUnitCategoryForTab(entry.unitKey, unit);
            return {
                id: String(entry.id || ''),
                unitKey: String(entry.unitKey || ''),
                category,
                name: String(entry.displayName || unit?.name || entry.unitKey || ''),
                itemCount: Math.max(0, Math.floor(Number(entry.itemCount) || 0)),
                stock,
                enabled
            };
        }).filter((entry) => !!entry.id && !!entry.unitKey);
    },

    _clearVeteranCategoryButtons(resetSignature = true) {
        const container = document.getElementById('unit-list-container');
        if (!container) return;
        container.querySelectorAll('.veteran-tab-unit-btn, .veteran-tab-empty').forEach((el) => {
            if (el && el.parentNode === container) container.removeChild(el);
        });
        if (resetSignature) this._veteranTabSignature = '';
    },

    _createVeteranTabIconCanvas(unitKey) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        canvas.className = 'veteran-tab-unit-icon';

        const ctx = canvas.getContext('2d');
        const hasConfig = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units);
        const unitCfg = hasConfig ? CONFIG.units[unitKey] : null;
        if (!ctx || !unitCfg || typeof Unit === 'undefined') {
            if (ctx) {
                const w = Math.max(10, Math.min(50, Math.round((Number(unitCfg?.width) || 30) * 0.9)));
                const h = Math.max(6, Math.min(26, Math.round((Number(unitCfg?.height) || 16) * 0.9)));
                ctx.fillStyle = unitCfg?.color || '#facc15';
                ctx.globalAlpha = 0.9;
                ctx.fillRect((60 - w) / 2, (40 - h) / 2 + 6, w, h);
                ctx.globalAlpha = 1;
            }
            return canvas;
        }

        const iconUtils = (typeof UnitRenderUtils !== 'undefined') ? UnitRenderUtils : null;
        const drew = !!(iconUtils && typeof iconUtils.drawUnitIconToCanvas === 'function'
            && iconUtils.drawUnitIconToCanvas(ctx, unitKey, unitCfg, {
                centerX: 32,
                bottomY: 44,
                baseScale: 0.8,
                baseOffsetY: 0,
                drawFallback: false
            }));

        if (!drew) {
            const w = Math.max(10, Math.min(50, Math.round((Number(unitCfg.width) || 30) * 0.9)));
            const h = Math.max(6, Math.min(26, Math.round((Number(unitCfg.height) || 16) * 0.9)));
            ctx.fillStyle = unitCfg.color || '#facc15';
            ctx.globalAlpha = 0.9;
            ctx.fillRect((60 - w) / 2, (40 - h) / 2 + 6, w, h);
            ctx.globalAlpha = 1;
        }

        return canvas;
    },

    _renderVeteranCategoryButtons(rows, options = {}) {
        const container = document.getElementById('unit-list-container');
        if (!container) return;

        const safeRows = Array.isArray(rows) ? rows : [];
        const veteranMode = options && options.veteranMode === true;
        const category = String(options?.category || '').trim().toLowerCase();
        const signature = `${veteranMode ? 'veteran-mode' : 'legacy'}|${category || 'all'}|${safeRows.map((row) => (
            `${row.id}|${row.unitKey}|${row.name}|${row.itemCount}|${row.stock}|${row.enabled ? 1 : 0}`
        )).join('||') || 'empty'}`;
        if (signature === this._veteranTabSignature) return;
        this._veteranTabSignature = signature;

        this._clearVeteranCategoryButtons(false);
        if (safeRows.length <= 0) {
            const empty = document.createElement('div');
            empty.className = 'veteran-tab-empty';
            if (veteranMode) {
                const categoryLabel = (category === 'armored')
                    ? '기갑'
                    : ((category === 'air') ? '공중' : '보병');
                empty.textContent = `${categoryLabel} 베테랑 유닛이 없습니다.`;
            } else {
                empty.textContent = '출격 가능한 베테랑이 없습니다.';
            }
            container.appendChild(empty);
            return;
        }

        const g = (typeof game !== 'undefined') ? game : null;
        safeRows.forEach((row) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'veteran-tab-unit-btn';
            if (!row.enabled) btn.classList.add('disabled');
            btn.disabled = !row.enabled;
            btn.title = `${row.name}`;

            const iconCanvas = this._createVeteranTabIconCanvas(row.unitKey);
            btn.appendChild(iconCanvas);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'veteran-tab-unit-name';
            nameSpan.textContent = row.name;
            btn.appendChild(nameSpan);

            if (row.itemCount > 0) {
                const itemBadge = document.createElement('span');
                itemBadge.className = 'veteran-tab-item-badge';
                itemBadge.textContent = `+${row.itemCount}`;
                btn.appendChild(itemBadge);
            }

            const footerRow = document.createElement('div');
            footerRow.className = 'veteran-tab-unit-footer';

            const lvSpan = document.createElement('span');
            lvSpan.className = 'veteran-tab-unit-lv';
            lvSpan.textContent = row.itemCount > 0 ? `+${row.itemCount}` : '';
            footerRow.appendChild(lvSpan);

            const stockSpan = document.createElement('span');
            stockSpan.className = 'veteran-tab-unit-count';
            stockSpan.textContent = `x${row.stock}`;
            footerRow.appendChild(stockSpan);
            btn.appendChild(footerRow);

            btn.addEventListener('click', () => {
                if (!row.enabled) return;
                if (g && typeof g.queueVeteranUnit === 'function') {
                    g.queueVeteranUnit(row.id);
                }
            });
            container.appendChild(btn);
        });
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
        if (currentCategory === 'special' || currentCategory === 'veteran' || currentCategory === 'drone') {
            currentCategory = 'infantry';
        }
        const g = (typeof game !== 'undefined') ? game : null;
        const normalizedCategory = (currentCategory === 'infantry'
            || currentCategory === 'armored'
            || currentCategory === 'air')
            ? currentCategory
            : 'infantry';
        const normalTabs = ['infantry', 'armored', 'air']
            .map((id) => ({ id, el: document.getElementById(`tab-${id}`) }))
            .filter((entry) => !!entry.el);

        const hideTab = (el) => {
            if (!el) return;
            el.classList.add('hidden');
            el.classList.remove('active');
        };
        const showTab = (el) => {
            if (!el) return;
            el.classList.remove('hidden');
            el.classList.remove('active');
        };

        // Keep only infantry/armored/air tabs visible.
        normalTabs.forEach(({ el }) => showTab(el));
        const droneOnlyTab = document.getElementById('tab-drone-only');
        const veteranTab = document.getElementById('tab-veteran');
        if (droneOnlyTab) hideTab(droneOnlyTab);
        if (veteranTab) hideTab(veteranTab);

        const availableTabs = ['infantry', 'armored', 'air'];
        let nextCategory = normalizedCategory;
        if (!availableTabs.includes(nextCategory)) {
            nextCategory = availableTabs[0];
        }
        if (g && g.currentCategory !== nextCategory) {
            g.currentCategory = nextCategory;
        }
        const tab = document.getElementById(`tab-${nextCategory}`);
        if (tab && !tab.classList.contains('hidden')) tab.classList.add('active');
        this.updateVeteranToggleButton();
        currentCategory = nextCategory;

        // 카테고리가 바뀌면 즉시 버튼 갱신 트리거
        this.updateUnitButtons(
            currentCategory,
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

    bindOptionProfileActions() {
        if (this._optProfileBound) return;

        const renameBtn = document.getElementById('opt-rename-btn');
        const loginBtn = document.getElementById('opt-login-btn');
        const logoutBtn = document.getElementById('opt-logout-btn');
        const deleteBtn = document.getElementById('opt-delete-btn');
        const avatarBtn = document.getElementById('opt-avatar-btn');
        const avatarResetBtn = document.getElementById('opt-avatar-reset-btn');
        const avatarInput = document.getElementById('opt-avatar-input');
        const renameConfirmBtn = document.getElementById('opt-rename-confirm');
        const renameCancelBtn = document.getElementById('opt-rename-cancel');
        const renameInput = document.getElementById('opt-rename-input');

        if (!renameBtn && !loginBtn && !logoutBtn && !deleteBtn && !avatarBtn && !avatarResetBtn && !avatarInput) return;

        if (renameBtn) {
            renameBtn.addEventListener('click', () => {
                this.toggleOptionRenameRow(true);
            });
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.closeOptions();
                if (typeof game !== 'undefined' && game && typeof game.loginAndEnterCity === 'function') {
                    game.loginAndEnterCity();
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    if (typeof CitySimAuth !== 'undefined' && CitySimAuth && typeof CitySimAuth.signOut === 'function') {
                        await CitySimAuth.signOut();
                        this.showToast('로그아웃되었습니다.');
                    }
                } catch (_) {
                    this.showToast('로그아웃 처리에 실패했습니다.');
                } finally {
                    this.toggleOptionRenameRow(false);
                    this.syncOptionProfile();
                }
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const ok = window.confirm('진행 데이터를 초기화하시겠습니까?');
                if (!ok) return;
                if (typeof game !== 'undefined' && game && typeof game.resetProgress === 'function') {
                    game.resetProgress();
                }
                this.showToast('진행 데이터가 초기화되었습니다.');
                this.toggleOptionRenameRow(false);
                this.syncOptionProfile();
            });
        }

        if (avatarBtn && avatarInput) {
            avatarBtn.addEventListener('click', () => {
                avatarInput.click();
            });
        }

        if (avatarInput) {
            avatarInput.addEventListener('change', async () => {
                const file = avatarInput.files && avatarInput.files[0];
                avatarInput.value = '';
                if (!file) return;
                await this.applyOptionProfileAvatarFile(file);
            });
        }

        if (avatarResetBtn) {
            avatarResetBtn.addEventListener('click', async () => {
                await this.clearOptionProfileAvatar();
            });
        }

        if (renameConfirmBtn) {
            renameConfirmBtn.addEventListener('click', () => {
                this.applyOptionProfileRename();
            });
        }

        if (renameCancelBtn) {
            renameCancelBtn.addEventListener('click', () => {
                this.toggleOptionRenameRow(false);
            });
        }

        if (renameInput) {
            renameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.applyOptionProfileRename();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleOptionRenameRow(false);
                }
            });
        }

        this._optProfileBound = true;
    },

    getOptionProfileAlias() {
        try {
            return String(localStorage.getItem(this._optProfileAliasKey) || '').trim();
        } catch (_) {
            return '';
        }
    },

    setOptionProfileAlias(name) {
        const next = String(name || '').trim();
        try {
            if (next) localStorage.setItem(this._optProfileAliasKey, next);
            else localStorage.removeItem(this._optProfileAliasKey);
        } catch (_) { }
    },

    sanitizeOptionProfileAvatarDataUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.length > 40000) return '';

        const lower = raw.toLowerCase();
        const isDataImage = lower.startsWith('data:image/');
        const isHttp = lower.startsWith('https://') || lower.startsWith('http://');
        if (!isDataImage && !isHttp) return '';

        return raw;
    },

    getOptionProfileAvatar() {
        try {
            const raw = localStorage.getItem(this._optProfileAvatarKey);
            return this.sanitizeOptionProfileAvatarDataUrl(raw);
        } catch (_) {
            return '';
        }
    },

    setOptionProfileAvatar(dataUrl) {
        const next = this.sanitizeOptionProfileAvatarDataUrl(dataUrl);
        try {
            if (next) localStorage.setItem(this._optProfileAvatarKey, next);
            else localStorage.removeItem(this._optProfileAvatarKey);
        } catch (_) { }
    },

    applyOptionProfileAvatarNode(avatarEl, avatarUrl, displayName) {
        if (!avatarEl) return;
        const safeAvatar = this.sanitizeOptionProfileAvatarDataUrl(avatarUrl);
        const fallbackText = String(displayName || '').trim().charAt(0).toUpperCase() || '?';

        if (safeAvatar) {
            avatarEl.classList.add('has-image');
            avatarEl.style.backgroundImage = `url("${safeAvatar}")`;
            avatarEl.innerText = '';
            return;
        }

        avatarEl.classList.remove('has-image');
        avatarEl.style.backgroundImage = '';
        avatarEl.innerText = fallbackText;
    },

    _drawAvatarCrop(ctx, img, size, state) {
        if (!ctx || !img) return;
        const cropSize = Math.max(1, Math.floor(Number(size) || 1));
        const iw = Math.max(1, img.naturalWidth || img.width || 1);
        const ih = Math.max(1, img.naturalHeight || img.height || 1);
        const zoom = Math.max(1, Math.min(3, Number(state && state.zoom) || 1));
        const offsetXNorm = Math.max(-1, Math.min(1, Number(state && state.offsetX) || 0));
        const offsetYNorm = Math.max(-1, Math.min(1, Number(state && state.offsetY) || 0));

        const baseScale = Math.max(cropSize / iw, cropSize / ih);
        const scale = baseScale * zoom;
        const drawW = iw * scale;
        const drawH = ih * scale;
        const maxOffsetX = Math.max(0, (drawW - cropSize) * 0.5);
        const maxOffsetY = Math.max(0, (drawH - cropSize) * 0.5);

        const dx = ((cropSize - drawW) * 0.5) + (offsetXNorm * maxOffsetX);
        const dy = ((cropSize - drawH) * 0.5) + (offsetYNorm * maxOffsetY);

        ctx.clearRect(0, 0, cropSize, cropSize);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cropSize, cropSize);
        ctx.imageSmoothingEnabled = true;
        if (typeof ctx.imageSmoothingQuality === 'string') ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, dx, dy, drawW, drawH);
    },

    _encodeAvatarCanvas(canvas, maxLen = 40000) {
        if (!canvas || typeof canvas.toDataURL !== 'function') return '';

        const tryEncode = (format, quality) => {
            try {
                if (typeof quality === 'number') return String(canvas.toDataURL(format, quality) || '');
                return String(canvas.toDataURL(format) || '');
            } catch (_) {
                return '';
            }
        };

        let encoded = tryEncode('image/jpeg', 0.88);
        for (let q = 0.82; encoded && encoded.length > maxLen && q >= 0.36; q -= 0.08) {
            encoded = tryEncode('image/jpeg', q);
        }
        if (encoded && encoded.length <= maxLen) return encoded;

        encoded = tryEncode('image/webp', 0.82);
        for (let q = 0.76; encoded && encoded.length > maxLen && q >= 0.30; q -= 0.08) {
            encoded = tryEncode('image/webp', q);
        }
        if (encoded && encoded.length <= maxLen) return encoded;

        encoded = tryEncode('image/png');
        if (encoded && encoded.length <= maxLen) return encoded;
        return '';
    },

    async openAvatarCropperFromFile(file, options = {}) {
        if (!file || !String(file.type || '').startsWith('image/')) {
            this.showToast('이미지 파일만 선택할 수 있습니다.');
            return '';
        }

        const maxFileBytes = 8 * 1024 * 1024;
        if (Number(file.size || 0) > maxFileBytes) {
            this.showToast('이미지 파일 용량이 너무 큽니다. (최대 8MB)');
            return '';
        }

        const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('avatar_file_read_failed'));
            reader.readAsDataURL(blob);
        });

        const loadImage = (src) => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('avatar_image_decode_failed'));
            img.src = src;
        });

        let image = null;
        try {
            const rawDataUrl = await readAsDataUrl(file);
            image = await loadImage(rawDataUrl);
        } catch (_) {
            this.showToast('이미지를 불러오지 못했습니다.');
            return '';
        }

        const vv = global.visualViewport || null;
        const viewportWidth = Math.max(0, Math.floor((vv && Number(vv.width)) || global.innerWidth || document.documentElement.clientWidth || 0));
        const hasCoarsePointer = !!(global.matchMedia && typeof global.matchMedia === 'function' && global.matchMedia('(pointer: coarse)').matches);
        const hasTouch = hasCoarsePointer || ('ontouchstart' in global);
        const isMobileCropLayout = hasTouch && viewportWidth > 0 && viewportWidth <= 960;

        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.zIndex = '400';
        modal.style.display = 'flex';
        modal.style.alignItems = isMobileCropLayout ? 'stretch' : 'center';
        modal.style.justifyContent = isMobileCropLayout ? 'stretch' : 'center';
        modal.style.background = 'rgba(2, 6, 23, 0.86)';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.padding = isMobileCropLayout ? '0' : '12px';

        const panel = document.createElement('div');
        panel.style.width = isMobileCropLayout ? '100vw' : 'min(94vw, 420px)';
        panel.style.maxHeight = isMobileCropLayout ? '100dvh' : 'min(94dvh, 680px)';
        panel.style.height = isMobileCropLayout ? '100dvh' : 'auto';
        panel.style.overflow = isMobileCropLayout ? 'hidden' : 'auto';
        panel.style.background = 'linear-gradient(180deg, #0b1223 0%, #111827 100%)';
        panel.style.border = '1px solid rgba(100, 116, 139, 0.5)';
        panel.style.borderRadius = isMobileCropLayout ? '0' : '12px';
        panel.style.padding = isMobileCropLayout
            ? 'calc(env(safe-area-inset-top, 0px) + 12px) 12px 8px'
            : '12px';
        panel.style.boxShadow = isMobileCropLayout ? 'none' : '0 24px 48px rgba(0, 0, 0, 0.5)';
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.gap = '0';

        const title = document.createElement('h3');
        title.textContent = String(options.title || '프로필 이미지 조정');
        title.style.margin = '0 0 10px';
        title.style.color = '#f8fafc';
        title.style.fontSize = isMobileCropLayout ? '0.96rem' : '1rem';
        title.style.fontWeight = '700';

        const editorBody = document.createElement('div');
        editorBody.style.display = 'flex';
        editorBody.style.flexDirection = isMobileCropLayout ? 'row' : 'column';
        editorBody.style.gap = '10px';
        editorBody.style.flex = '1 1 auto';
        editorBody.style.minHeight = '0';
        editorBody.style.overflow = isMobileCropLayout ? 'hidden' : 'visible';

        const previewPane = document.createElement('div');
        previewPane.style.display = 'flex';
        previewPane.style.flexDirection = 'column';
        previewPane.style.alignItems = 'center';
        previewPane.style.justifyContent = 'flex-start';
        previewPane.style.flex = isMobileCropLayout ? '0 0 46%' : '1 1 auto';
        previewPane.style.minWidth = '0';

        const controlPane = document.createElement('div');
        controlPane.style.display = 'flex';
        controlPane.style.flexDirection = 'column';
        controlPane.style.gap = '8px';
        controlPane.style.flex = isMobileCropLayout ? '1 1 0' : '1 1 auto';
        controlPane.style.minWidth = '0';
        controlPane.style.overflowY = isMobileCropLayout ? 'auto' : 'visible';
        controlPane.style.paddingRight = isMobileCropLayout ? '2px' : '0';

        const previewWrap = document.createElement('div');
        previewWrap.style.width = isMobileCropLayout ? '100%' : '100%';
        previewWrap.style.display = 'flex';
        previewWrap.style.justifyContent = 'center';
        previewWrap.style.alignItems = 'flex-start';
        previewWrap.style.marginBottom = '0';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 240;
        previewCanvas.height = 240;
        previewCanvas.style.width = isMobileCropLayout ? '100%' : 'min(76vw, 240px)';
        previewCanvas.style.maxWidth = isMobileCropLayout ? '300px' : '240px';
        previewCanvas.style.height = 'auto';
        previewCanvas.style.borderRadius = '10px';
        previewCanvas.style.border = '1px solid rgba(148, 163, 184, 0.45)';
        previewCanvas.style.background = '#0f172a';
        previewCanvas.style.touchAction = 'none';

        const status = document.createElement('p');
        status.style.margin = isMobileCropLayout ? '0' : '8px 0 0';
        status.style.fontSize = isMobileCropLayout ? '0.72rem' : '0.76rem';
        status.style.lineHeight = '1.35';
        status.style.color = '#93c5fd';
        status.textContent = '이동/확대해서 원하는 영역을 맞추세요.';

        const controls = document.createElement('div');
        controls.style.display = 'grid';
        controls.style.gap = '8px';
        controls.style.marginTop = isMobileCropLayout ? '0' : '10px';

        const makeSliderRow = (labelText, min, max, value, step = '1') => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gap = '4px';

            const label = document.createElement('div');
            label.style.display = 'flex';
            label.style.justifyContent = 'space-between';
            label.style.fontSize = '0.75rem';
            label.style.color = '#cbd5e1';

            const name = document.createElement('span');
            name.textContent = labelText;
            const valueEl = document.createElement('span');
            valueEl.textContent = String(value);
            label.appendChild(name);
            label.appendChild(valueEl);

            const input = document.createElement('input');
            input.type = 'range';
            input.min = String(min);
            input.max = String(max);
            input.step = String(step);
            input.value = String(value);
            input.style.width = '100%';

            row.appendChild(label);
            row.appendChild(input);
            return { row, input, valueEl };
        };

        const zoomRow = makeSliderRow('확대', 100, 300, 100);
        const xRow = makeSliderRow('좌우', -100, 100, 0);
        const yRow = makeSliderRow('상하', -100, 100, 0);

        const actions = document.createElement('div');
        actions.style.display = isMobileCropLayout ? 'grid' : 'flex';
        if (isMobileCropLayout) actions.style.gridTemplateColumns = '1fr 1fr';
        actions.style.gap = '8px';
        actions.style.justifyContent = isMobileCropLayout ? 'stretch' : 'flex-end';
        actions.style.marginTop = '12px';
        if (isMobileCropLayout) {
            actions.style.position = 'sticky';
            actions.style.bottom = '0';
            actions.style.zIndex = '3';
            actions.style.padding = '10px 0 calc(env(safe-area-inset-bottom, 0px) + 6px)';
            actions.style.background = 'linear-gradient(180deg, rgba(11, 18, 35, 0) 0%, rgba(11, 18, 35, 0.95) 34%, rgba(11, 18, 35, 0.99) 100%)';
            actions.style.borderTop = '1px solid rgba(51, 65, 85, 0.55)';
        }

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = '취소';
        cancelBtn.style.height = isMobileCropLayout ? '40px' : '36px';
        cancelBtn.style.minHeight = isMobileCropLayout ? '40px' : '36px';
        cancelBtn.style.padding = '0 12px';
        cancelBtn.style.borderRadius = '8px';
        cancelBtn.style.border = '1px solid rgba(100, 116, 139, 0.7)';
        cancelBtn.style.background = 'rgba(15, 23, 42, 0.92)';
        cancelBtn.style.color = '#cbd5e1';
        cancelBtn.style.fontWeight = '700';
        cancelBtn.style.fontSize = isMobileCropLayout ? '0.84rem' : '0.8rem';
        cancelBtn.style.cursor = 'pointer';
        if (isMobileCropLayout) cancelBtn.style.width = '100%';

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.textContent = '적용';
        applyBtn.style.height = isMobileCropLayout ? '40px' : '36px';
        applyBtn.style.minHeight = isMobileCropLayout ? '40px' : '36px';
        applyBtn.style.padding = '0 14px';
        applyBtn.style.borderRadius = '8px';
        applyBtn.style.border = '1px solid #3b82f6';
        applyBtn.style.background = '#2563eb';
        applyBtn.style.color = '#f8fafc';
        applyBtn.style.fontWeight = '700';
        applyBtn.style.fontSize = isMobileCropLayout ? '0.84rem' : '0.8rem';
        applyBtn.style.cursor = 'pointer';
        if (isMobileCropLayout) applyBtn.style.width = '100%';

        previewWrap.appendChild(previewCanvas);
        controls.appendChild(zoomRow.row);
        controls.appendChild(xRow.row);
        controls.appendChild(yRow.row);
        actions.appendChild(cancelBtn);
        actions.appendChild(applyBtn);
        previewPane.appendChild(previewWrap);
        controlPane.appendChild(status);
        controlPane.appendChild(controls);
        editorBody.appendChild(previewPane);
        editorBody.appendChild(controlPane);
        panel.appendChild(title);
        panel.appendChild(editorBody);
        panel.appendChild(actions);
        modal.appendChild(panel);
        document.body.appendChild(modal);

        const previewCtx = previewCanvas.getContext('2d');
        if (!previewCtx) {
            modal.remove();
            this.showToast('이미지 편집 도구를 열 수 없습니다.');
            return '';
        }

        const state = { zoom: 1, offsetX: 0, offsetY: 0 };
        const drawPreview = () => {
            this._drawAvatarCrop(previewCtx, image, previewCanvas.width, state);
        };
        drawPreview();

        let dragActive = false;
        let lastX = 0;
        let lastY = 0;
        const updateByDrag = (clientX, clientY) => {
            const dx = Number(clientX) - lastX;
            const dy = Number(clientY) - lastY;
            lastX = Number(clientX);
            lastY = Number(clientY);
            const factor = 0.006;
            state.offsetX = Math.max(-1, Math.min(1, state.offsetX + (dx * factor)));
            state.offsetY = Math.max(-1, Math.min(1, state.offsetY + (dy * factor)));
            xRow.input.value = String(Math.round(state.offsetX * 100));
            yRow.input.value = String(Math.round(state.offsetY * 100));
            xRow.valueEl.textContent = xRow.input.value;
            yRow.valueEl.textContent = yRow.input.value;
            drawPreview();
        };

        previewCanvas.addEventListener('pointerdown', (event) => {
            dragActive = true;
            lastX = Number(event.clientX || 0);
            lastY = Number(event.clientY || 0);
            try { previewCanvas.setPointerCapture(event.pointerId); } catch (_) { }
        });
        previewCanvas.addEventListener('pointermove', (event) => {
            if (!dragActive) return;
            updateByDrag(event.clientX, event.clientY);
        });
        const endDrag = () => { dragActive = false; };
        previewCanvas.addEventListener('pointerup', endDrag);
        previewCanvas.addEventListener('pointercancel', endDrag);

        const bindSlider = (entry, applyFn) => {
            entry.input.addEventListener('input', () => {
                entry.valueEl.textContent = entry.input.value;
                applyFn(Number(entry.input.value || 0));
                drawPreview();
            });
        };

        bindSlider(zoomRow, (value) => {
            state.zoom = Math.max(1, Math.min(3, value / 100));
        });
        bindSlider(xRow, (value) => {
            state.offsetX = Math.max(-1, Math.min(1, value / 100));
        });
        bindSlider(yRow, (value) => {
            state.offsetY = Math.max(-1, Math.min(1, value / 100));
        });

        const closeWith = (result) => {
            try {
                document.removeEventListener('keydown', onKeyDown, true);
            } catch (_) { }
            modal.remove();
            resolver(result || '');
        };

        const onKeyDown = (event) => {
            if (!event || event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            closeWith('');
        };
        document.addEventListener('keydown', onKeyDown, true);

        const createCroppedAvatar = () => {
            // Some devices may ignore JPEG/WebP quality hints.
            // Fallback through smaller output sizes to stay within storage cap.
            const outputSizes = [128, 112, 96, 80, 64];
            for (let i = 0; i < outputSizes.length; i += 1) {
                const size = outputSizes[i];
                const out = document.createElement('canvas');
                out.width = size;
                out.height = size;
                const outCtx = out.getContext('2d');
                if (!outCtx) continue;
                this._drawAvatarCrop(outCtx, image, size, state);
                const encoded = this._encodeAvatarCanvas(out, 40000);
                if (encoded) return encoded;
            }
            return '';
        };

        let resolver = () => { };
        const done = new Promise((resolve) => {
            resolver = resolve;
        });

        modal.addEventListener('pointerdown', (event) => {
            if (event.target === modal) closeWith('');
        });
        cancelBtn.addEventListener('click', () => closeWith(''));
        applyBtn.addEventListener('click', () => {
            const encoded = createCroppedAvatar();
            if (!encoded) {
                status.textContent = '이미지 용량이 큽니다. 확대/이동을 조정해 주세요.';
                status.style.color = '#fecaca';
                return;
            }
            closeWith(encoded);
        });

        return done;
    },

    async applyOptionProfileAvatarFile(file) {
        try {
            const cropped = await this.openAvatarCropperFromFile(file, { title: '프로필 사진 조정' });
            if (!cropped) return;

            const safeAvatar = this.sanitizeOptionProfileAvatarDataUrl(cropped);
            if (!safeAvatar) {
                this.showToast('이미지를 처리할 수 없습니다. 다른 이미지를 선택해주세요.');
                return;
            }

            this.setOptionProfileAvatar(safeAvatar);

            if (typeof CitySimChat !== 'undefined'
                && CitySimChat
                && typeof CitySimChat.updateMyAvatar === 'function') {
                try {
                    await CitySimChat.updateMyAvatar(safeAvatar);
                } catch (_) { }
            }

            this.syncOptionProfile();
            this.showToast('프로필 사진이 변경되었습니다.');
        } catch (_) {
            this.showToast('프로필 사진 적용에 실패했습니다.');
        }
    },

    async clearOptionProfileAvatar() {
        this.setOptionProfileAvatar('');

        if (typeof CitySimChat !== 'undefined'
            && CitySimChat
            && typeof CitySimChat.updateMyAvatar === 'function') {
            try {
                await CitySimChat.updateMyAvatar('');
            } catch (_) { }
        }

        this.syncOptionProfile();
        this.showToast('프로필 사진을 삭제했습니다.');
    },

    toggleOptionRenameRow(open) {
        const row = document.getElementById('opt-rename-row');
        const input = document.getElementById('opt-rename-input');
        if (!row) return;
        this._optProfileRenameOpen = !!open;
        row.classList.toggle('hidden', !this._optProfileRenameOpen);
        if (this._optProfileRenameOpen && input) {
            const currentName = document.getElementById('opt-profile-name')?.innerText || '';
            input.value = String(currentName || '').trim();
            setTimeout(() => {
                input.focus();
                input.select();
            }, 0);
        }
    },

    async applyOptionProfileRename() {
        const input = document.getElementById('opt-rename-input');
        if (!input) return;
        const nextName = String(input.value || '').trim();
        if (!nextName) {
            this.showToast('새 이름을 입력해주세요.');
            return;
        }

        const user = (typeof CitySimAuth !== 'undefined'
            && CitySimAuth
            && typeof CitySimAuth.getCurrentUser === 'function')
            ? CitySimAuth.getCurrentUser()
            : null;

        let updatedRemote = false;
        if (user && typeof user.updateProfile === 'function') {
            try {
                await user.updateProfile({ displayName: nextName });
                updatedRemote = true;
            } catch (_) {
                updatedRemote = false;
            }
        }

        if (!updatedRemote) {
            this.setOptionProfileAlias(nextName);
        }

        if (updatedRemote
            && typeof CitySimChat !== 'undefined'
            && CitySimChat
            && typeof CitySimChat.syncMyProfile === 'function') {
            try {
                await CitySimChat.syncMyProfile((typeof game !== 'undefined') ? game : null);
            } catch (_) { }
        }

        this.toggleOptionRenameRow(false);
        this.syncOptionProfile();
        this.showToast('이름이 변경되었습니다.');
    },

    syncOptionProfile() {
        const avatarEl = document.getElementById('opt-profile-avatar');
        const nameEl = document.getElementById('opt-profile-name');
        const statusEl = document.getElementById('opt-profile-status');
        const loginBtn = document.getElementById('opt-login-btn');
        const logoutBtn = document.getElementById('opt-logout-btn');
        const renameBtn = document.getElementById('opt-rename-btn');
        if (!avatarEl || !nameEl || !statusEl) return;

        const hasAuthApi = (typeof CitySimAuth !== 'undefined' && CitySimAuth);
        const user = (hasAuthApi && typeof CitySimAuth.getCurrentUser === 'function')
            ? CitySimAuth.getCurrentUser()
            : null;
        const authed = !!(hasAuthApi && typeof CitySimAuth.isAuthenticated === 'function' && CitySimAuth.isAuthenticated());
        const guest = !!(hasAuthApi && typeof CitySimAuth.isGuestSession === 'function' && CitySimAuth.isGuestSession());
        const anonUser = !!(user && user.uid && user.isAnonymous === true);
        const guestLikeSession = guest || anonUser;
        const localAlias = this.getOptionProfileAlias();
        const localAvatar = this.getOptionProfileAvatar();

        let displayName = '로그인 필요';
        let statusText = '로그아웃 상태';
        let profileAvatar = localAvatar;

        if (guestLikeSession) {
            displayName = localAlias || '게스트';
            statusText = '게스트 세션';
        } else if (authed && user) {
            const emailName = user.email ? String(user.email).split('@')[0] : '';
            displayName = String(user.displayName || emailName || localAlias || '지휘관');
            statusText = user.email ? `로그인됨 (${user.email})` : '로그인됨';
            if (!profileAvatar) {
                profileAvatar = this.sanitizeOptionProfileAvatarDataUrl(user.photoURL || '');
            }
        } else if (localAlias) {
            displayName = localAlias;
            statusText = '로컬 프로필';
        }

        nameEl.innerText = displayName;
        statusEl.innerText = statusText;
        this.applyOptionProfileAvatarNode(avatarEl, profileAvatar, displayName);

        if (loginBtn) loginBtn.classList.toggle('hidden', authed);
        if (logoutBtn) logoutBtn.classList.toggle('hidden', !authed);
        if (renameBtn) renameBtn.disabled = false;
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
        const authModalIds = [
            'auth-login-modal',
            'auth-signup-modal',
            'auth-google-modal',
            'auth-verify-modal'
        ];
        return authModalIds.some((id) => this.isElementVisibleById(id));
    },

    resolveOptionContext(gameRef) {
        const inCity = this.isElementVisibleById('city-screen');
        if (inCity) return 'city';

        const inGame = !!(gameRef && gameRef.running === true);
        if (inGame) return 'ingame';

        const inMapSelect = this.isElementVisibleById('map-select-screen')
            || this.isElementVisibleById('campaign-screen')
            || this.isElementVisibleById('custom-battle-screen');
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
        const lobbyBtn = document.getElementById('opt-lobby-btn');
        const bgmSelectRow = document.getElementById('opt-bgm-select-row');

        const configByContext = {
            city: {
                modalTitle: '시티 설정',
                gameTitle: '시티/종료',
                gameDesc: '시티에서는 로비 이동 또는 게임 종료를 사용할 수 있습니다.',
                showAccountTab: true,
                showRetreat: false,
                showQuit: true,
                showLobby: true
            },
            'map-select': {
                modalTitle: '맵 선택 설정',
                gameTitle: '맵 선택/종료',
                gameDesc: '맵 선택 화면에서는 로비 이동 또는 게임 종료를 사용할 수 있습니다.',
                showAccountTab: false,
                showRetreat: false,
                showQuit: true,
                showLobby: true
            },
            ingame: {
                modalTitle: '인게임 설정',
                gameTitle: '전투/종료',
                gameDesc: '전투 중에는 후퇴로 시티 복귀, 종료 확인을 사용할 수 있습니다.',
                showAccountTab: false,
                showRetreat: true,
                showQuit: true,
                showLobby: true
            },
            general: {
                modalTitle: 'SETTINGS',
                gameTitle: '전투/종료',
                gameDesc: '전투 중에는 후퇴로 시티 복귀, 평시에는 종료 확인을 사용할 수 있습니다.',
                showAccountTab: true,
                showRetreat: false,
                showQuit: true,
                showLobby: true
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
        this.setOptionTabVisibility('account', cfg.showAccountTab);
        this.setOptionTabVisibility('language', true);
        this.setOptionTabVisibility('credits', true);

        if (exitBtn) exitBtn.style.display = cfg.showRetreat ? '' : 'none';
        if (quitBtn) quitBtn.style.display = cfg.showQuit ? '' : 'none';
        if (lobbyBtn) lobbyBtn.style.display = cfg.showLobby ? '' : 'none';
        if (bgmSelectRow) bgmSelectRow.classList.toggle('hidden', ctx !== 'city');
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
        if (context === 'city' || context === 'map-select' || context === 'ingame') {
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
        this.bindOptionProfileActions();
        this.bindOptionFullscreenControl();
        this.syncOptionProfile();
        this.applyOptionContext(context);

        let defaultTab = 'gameplay';
        if (context === 'ingame' || context === 'city' || context === 'map-select') {
            defaultTab = 'general';
        }

        const nextTab = requestedTab || defaultTab;
        this.setOptionTab(nextTab);
        // Update slider values
        if (typeof AudioSystem !== 'undefined') {
            document.getElementById('vol-master-val').innerText = parseInt(AudioSystem.volume.master * 100) + '%';
            document.querySelector("input[oninput*='master']").value = AudioSystem.volume.master * 100;

            document.getElementById('vol-bgm-val').innerText = parseInt(AudioSystem.volume.bgm * 100) + '%';
            document.querySelector("input[oninput*='bgm']").value = AudioSystem.volume.bgm * 100;

            document.getElementById('vol-sfx-val').innerText = parseInt(AudioSystem.volume.sfx * 100) + '%';
            document.querySelector("input[oninput*='sfx']").value = AudioSystem.volume.sfx * 100;
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
        this.toggleOptionRenameRow(false);
    },

    setVolume(type, val) {
        const v = val / 100;
        if (typeof AudioSystem !== 'undefined') {
            if (type === 'bgm') AudioSystem.setBGMVolume(v);
            else AudioSystem.setVolume(type, v);
        }
        document.getElementById(`vol-${type}-val`).innerText = val + '%';
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

    updateDiffBtn(btn) {
        const allBtns = document.querySelectorAll('.btn-diff');

        // 1. Reset ALL buttons to "Dimmed" state
        allBtns.forEach(b => {
            // Remove ALL color/active classes
            b.classList.remove(
                'active', 'scale-105', 'scale-110', 'opacity-100', 'z-10', 'ring-2', 'ring-4', 'ring-offset-2', 'ring-offset-slate-950',
                'border-green-500', 'border-blue-500', 'border-red-500',
                'ring-green-500', 'ring-blue-500', 'ring-red-500',
                'bg-green-900', 'bg-blue-900', 'bg-red-900'
            );

            // Add "Inactive" styling
            b.classList.add('border-slate-800', 'bg-slate-900', 'opacity-40', 'scale-95');

            // Reset text/icons to gray
            const icon = b.querySelector('i');
            const text = b.querySelector('span[data-lang]');
            if (icon) icon.className = icon.className.replace(/text-\w+-\d+/g, 'text-gray-600');
            if (text) { text.classList.remove('text-white'); text.classList.add('text-gray-600'); }
        });

        // 2. Highlight SELECTED button
        const diff = btn.getAttribute('data-diff');
        btn.classList.remove('border-slate-800', 'bg-slate-900', 'opacity-40', 'scale-95');
        btn.classList.add('active', 'bg-slate-800', 'scale-110', 'opacity-100', 'z-10', 'ring-4', 'ring-offset-2', 'ring-offset-slate-950');

        const icon = btn.querySelector('i');
        const text = btn.querySelector('span[data-lang]');
        const statusEl = document.getElementById('diff-status-text');

        let diffName = "";
        let colorClass = "";

        if (diff === 'recruit') {
            btn.classList.add('border-green-500', 'ring-green-500');
            if (icon) { icon.classList.remove('text-gray-600'); icon.classList.add('text-green-500'); }
            diffName = "RECRUIT (EASY)";
            colorClass = "text-green-400";
        } else if (diff === 'veteran') {
            btn.classList.add('border-blue-500', 'ring-blue-500');
            if (icon) { icon.classList.remove('text-gray-600'); icon.classList.add('text-blue-500'); }
            diffName = "VETERAN (NORMAL)";
            colorClass = "text-blue-400";
        } else if (diff === 'elite') {
            btn.classList.add('border-red-500', 'ring-red-500');
            if (icon) { icon.classList.remove('text-gray-600'); icon.classList.add('text-red-500'); }
            diffName = "ELITE (HARD)";
            colorClass = "text-red-500";
        }

        if (text) { text.classList.remove('text-gray-600'); text.classList.add('text-white'); }

        // [REMOVED] Status Text update as per request
    },

    updateSpeedBtns(s) {
        // HUD Buttons only (options panel no longer has speed buttons)
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-speed-${s}`);
        if (activeBtn) activeBtn.classList.add('active');
    }
};


