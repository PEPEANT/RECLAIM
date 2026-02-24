(function (global) {
    const ATTENDANCE_MODAL_ID = 'city-attendance-modal';

    function isFn(value) {
        return typeof value === 'function';
    }

    function clampInt(value, fallback, min, max) {
        const parsed = Math.floor(Number(value));
        const base = Number.isFinite(parsed) ? parsed : Math.floor(Number(fallback) || 0);
        const lo = Number.isFinite(min) ? min : Number.MIN_SAFE_INTEGER;
        const hi = Number.isFinite(max) ? max : Number.MAX_SAFE_INTEGER;
        return Math.max(lo, Math.min(hi, base));
    }

    function bindTapAction(element, action) {
        if (!element || !isFn(action)) return;
        element.__cityTapAction = action;
        if (element.__cityTapBound === true) return;
        element.__cityTapBound = true;

        const invoke = (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();

            const now = Date.now();
            const last = Number(element.__cityTapActionAt) || 0;
            if (now - last < 260) return;
            element.__cityTapActionAt = now;

            const fn = element.__cityTapAction;
            if (isFn(fn)) fn();
        };

        const markTouch = () => {
            element.__cityLastTouchAt = Date.now();
        };

        element.addEventListener('pointerup', (event) => {
            if (event && event.pointerType === 'mouse' && event.button !== 0) return;
            if (event && (event.pointerType === 'touch' || event.pointerType === 'pen')) markTouch();
            invoke(event);
        }, { passive: false });

        element.addEventListener('touchend', (event) => {
            markTouch();
            invoke(event);
        }, { passive: false });

        element.addEventListener('click', (event) => {
            const lastTouchAt = Number(element.__cityLastTouchAt) || 0;
            if (lastTouchAt > 0 && (Date.now() - lastTouchAt) < 700) return;
            invoke(event);
        });
    }

    function getAttendanceApi() {
        const api = global.CityQuestMissionAttendance;
        if (!api || typeof api !== 'object') return null;
        return api;
    }

    function getAttendanceState(game) {
        if (!game || typeof game !== 'object') return null;
        const state = game.cityQuestMission;
        if (!state || typeof state !== 'object') return null;
        return state;
    }

    function getAttendanceInfo(game) {
        const attendanceApi = getAttendanceApi();
        if (!attendanceApi || !isFn(attendanceApi.getProgressInfo)) return null;
        try {
            const state = getAttendanceState(game);
            return attendanceApi.getProgressInfo(state) || null;
        } catch (_) {
            return null;
        }
    }

    function getAttendancePlan() {
        const attendanceApi = getAttendanceApi();
        const rawPlan = Array.isArray(attendanceApi && attendanceApi.REWARD_PLAN)
            ? attendanceApi.REWARD_PLAN
            : [];
        const plan = rawPlan.map((entry, index) => {
            const day = clampInt(entry && entry.day, index + 1, 1, 99);
            const reward = (entry && typeof entry.reward === 'object') ? entry.reward : {};
            return { day, reward };
        });
        plan.sort((a, b) => a.day - b.day);
        return plan;
    }

    function formatRewardLabel(rewardRaw) {
        const reward = (rewardRaw && typeof rewardRaw === 'object') ? rewardRaw : {};
        const parts = [];
        const money = Math.max(0, Math.floor(Number(reward.money) || 0));
        const gold = Math.max(0, Math.floor(Number(reward.gold) || 0));
        const honor = Math.max(0, Math.floor(Number(reward.honor) || 0));
        const exp = Math.max(0, Math.floor(Number(reward.exp) || 0));
        const box = String(reward.box || '').trim();
        let boxType = String(reward.boxType || '').trim();

        if (!box && boxType === 'box_level1') boxType = '일반 보급상자 x1';
        if (!box && boxType === 'box_level2') boxType = '특수 보급박스 x1';
        if (!box && boxType === 'confidential') boxType = '1급 기밀문서 x1';

        if (money > 0) parts.push(`자금 ${money.toLocaleString('ko-KR')}`);
        if (gold > 0) parts.push(`금 ${gold}`);
        if (honor > 0) parts.push(`명예훈장 ${honor}`);
        if (exp > 0) parts.push(`EXP ${exp}`);
        if (box) parts.push(box);
        else if (boxType) parts.push(boxType);

        return parts.join(' · ') || '보상 없음';
    }

    function closeAttendanceModal() {
        const existing = document.getElementById(ATTENDANCE_MODAL_ID);
        if (!existing) return;
        const onKeyDown = existing.__cityAttendanceOnKeyDown;
        if (isFn(onKeyDown)) {
            document.removeEventListener('keydown', onKeyDown);
        }
        existing.remove();
    }

    function openAttendanceModal(game) {
        closeAttendanceModal();

        const info = getAttendanceInfo(game) || {};
        const plan = getAttendancePlan();
        const maxDay = Math.max(1, clampInt(info.maxDay, plan.length || 7, 1, 99));
        const claimedDays = Math.max(0, clampInt(info.claimedDays, 0, 0, maxDay));
        const currentDay = Math.max(1, clampInt(info.day, 1, 1, maxDay));
        const completed = info.completed === true || claimedDays >= maxDay;
        const todayClaimed = info.todayClaimed === true;

        const modal = document.createElement('div');
        modal.id = ATTENDANCE_MODAL_ID;
        modal.className = 'city-attendance-modal';

        const panel = document.createElement('section');
        panel.className = 'city-attendance-panel';
        modal.appendChild(panel);

        const head = document.createElement('header');
        head.className = 'city-attendance-head';
        panel.appendChild(head);

        const titleWrap = document.createElement('div');
        titleWrap.className = 'city-attendance-title-wrap';
        head.appendChild(titleWrap);

        const title = document.createElement('h3');
        title.className = 'city-attendance-title';
        title.textContent = '출석 보급 보상표';
        titleWrap.appendChild(title);

        const summary = document.createElement('p');
        summary.className = 'city-attendance-summary';
        if (completed) {
            summary.textContent = `완료 ${maxDay}/${maxDay}일차`;
        } else if (todayClaimed) {
            summary.textContent = `오늘 수령 완료 · 다음 ${currentDay}일차`;
        } else {
            summary.textContent = `진행 ${currentDay}/${maxDay}일차`;
        }
        titleWrap.appendChild(summary);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'city-attendance-close';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', '출석 보상표 닫기');
        head.appendChild(closeBtn);
        bindTapAction(closeBtn, closeAttendanceModal);

        const list = document.createElement('ol');
        list.className = 'city-attendance-list';
        panel.appendChild(list);

        const safePlan = plan.length > 0
            ? plan
            : Array.from({ length: maxDay }, (_, index) => ({ day: index + 1, reward: {} }));

        safePlan.forEach((entry) => {
            const day = Math.max(1, clampInt(entry.day, 1, 1, maxDay));
            const item = document.createElement('li');
            item.className = 'city-attendance-item';

            let status = 'pending';
            let statusText = '대기';
            if (completed || day <= claimedDays) {
                status = 'claimed';
                statusText = '수령 완료';
            } else if (!todayClaimed && day === currentDay) {
                status = 'claimable';
                statusText = '수령 가능';
            }
            item.classList.add(`status-${status}`);

            const dayEl = document.createElement('div');
            dayEl.className = 'city-attendance-day';
            dayEl.textContent = `${day}일차`;
            item.appendChild(dayEl);

            const rewardEl = document.createElement('div');
            rewardEl.className = 'city-attendance-reward';
            rewardEl.textContent = formatRewardLabel(entry.reward);
            item.appendChild(rewardEl);

            const statusEl = document.createElement('span');
            statusEl.className = `city-attendance-status status-${status}`;
            statusEl.textContent = statusText;
            item.appendChild(statusEl);

            list.appendChild(item);
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeAttendanceModal();
        });

        const onKeyDown = (event) => {
            if (event && event.key === 'Escape') closeAttendanceModal();
        };
        modal.__cityAttendanceOnKeyDown = onKeyDown;
        document.addEventListener('keydown', onKeyDown);

        document.body.appendChild(modal);
    }

    function ensureAttendanceButton(card, game) {
        if (!card) return;
        const subtitleEl = card.querySelector('.city-mission-subtitle');
        if (!subtitleEl) return;

        let toolbar = card.querySelector('.city-mission-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'city-mission-toolbar';
            subtitleEl.insertAdjacentElement('afterend', toolbar);
        }

        let button = toolbar.querySelector('.city-mission-attendance-btn');
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'city-mission-attendance-btn';
            toolbar.appendChild(button);
        }

        const info = getAttendanceInfo(game);
        const maxDay = Math.max(1, clampInt(info?.maxDay, 7, 1, 99));
        const claimedDays = Math.max(0, clampInt(info?.claimedDays, 0, 0, maxDay));
        button.textContent = `출석 보급 ${claimedDays}/${maxDay}`;
        button.title = '1일차부터 7일차까지 출석 보상을 확인합니다.';
        bindTapAction(button, () => openAttendanceModal(game));
    }

    function renderPanel(game) {
        const card = document.getElementById('city-mission-card');
        if (!card) return;

        const engine = global.CityQuestMissionEngine;
        const rows = (engine && isFn(engine.getProgressRows)) ? engine.getProgressRows(game) : [];

        const titleEl = card.querySelector('.city-mission-title');
        const subtitleEl = card.querySelector('.city-mission-subtitle');
        const listEl = card.querySelector('.city-mission-list');
        const rewardEl = card.querySelector('.city-mission-reward');

        const totalCount = rows.length;
        const claimedCount = rows.filter((item) => item.status === 'claimed').length;
        const claimableCount = rows.filter((item) => item.status === 'claimable').length;
        const inProgressCount = Math.max(0, totalCount - claimableCount - claimedCount);

        if (titleEl) titleEl.textContent = '작전 퀘스트 체크리스트';
        if (subtitleEl) {
            subtitleEl.textContent = `진행 중 ${inProgressCount}개 · 지급 가능 ${claimableCount}개 · 지급 완료 ${claimedCount}개`;
        }
        ensureAttendanceButton(card, game);

        if (listEl) {
            listEl.innerHTML = '';
            rows.forEach((item) => {
                const li = document.createElement('li');
                li.className = 'city-mission-item';
                const itemId = String(item?.id || '').trim();
                if (itemId) li.setAttribute('data-city-mission-id', itemId);
                if (item.status === 'claimed') li.classList.add('claimed');
                if (item.status === 'claimable') li.classList.add('claimable');

                const content = document.createElement('div');
                content.className = 'city-mission-content';

                const line = document.createElement('div');
                line.className = 'city-mission-line';
                const lineText = String(item.text || '').trim();
                line.textContent = lineText;
                if (lineText) line.title = lineText;
                content.appendChild(line);

                const attendanceInfo = (item && item.attendanceInfo && typeof item.attendanceInfo === 'object')
                    ? item.attendanceInfo
                    : null;
                const attendanceLabel = String(attendanceInfo?.label || '').trim();
                if (attendanceLabel) {
                    const hint = document.createElement('div');
                    hint.className = 'city-mission-hint';
                    hint.textContent = attendanceLabel;
                    hint.title = attendanceLabel;
                    content.appendChild(hint);
                }
                li.appendChild(content);

                const meta = document.createElement('div');
                meta.className = 'city-mission-meta';
                const rewardParts = Array.isArray(item.rewardParts)
                    ? item.rewardParts.map((part) => String(part || '').trim()).filter(Boolean)
                    : [];
                if (rewardParts.length > 0) {
                    const rewardPartsEl = document.createElement('div');
                    rewardPartsEl.className = 'city-mission-reward-parts';
                    rewardPartsEl.title = rewardParts.join(' · ');
                    rewardParts.forEach((part) => {
                        const partEl = document.createElement('span');
                        partEl.className = 'city-mission-reward-part';
                        partEl.textContent = part;
                        rewardPartsEl.appendChild(partEl);
                    });
                    meta.appendChild(rewardPartsEl);
                }

                if (item.canClaim) {
                    const claimBtn = document.createElement('button');
                    claimBtn.type = 'button';
                    claimBtn.className = 'city-mission-claim-btn';
                    claimBtn.textContent = '지급받기';
                    if (itemId) claimBtn.setAttribute('data-city-mission-claim', itemId);
                    claimBtn.disabled = false;
                    bindTapAction(claimBtn, () => {
                        if (game && isFn(game.claimCityQuest)) {
                            game.claimCityQuest(item.id);
                        }
                    });
                    meta.appendChild(claimBtn);
                } else {
                    const statusChip = document.createElement('span');
                    statusChip.className = `city-mission-status status-${item.status}`;
                    statusChip.textContent = item.statusLabel || '';
                    if (itemId) statusChip.setAttribute('data-city-mission-status', itemId);
                    meta.appendChild(statusChip);
                }

                li.appendChild(meta);
                listEl.appendChild(li);
            });
        }

        if (rewardEl) {
            rewardEl.textContent = claimableCount > 0
                ? `지급 가능 ${claimableCount}개: 각 항목에서 보상을 수령하세요.`
                : `지급 완료 ${claimedCount}/${totalCount}개: 남은 미션을 완료하면 추가 보상을 획득할 수 있습니다.`;
        }
    }

    global.CityQuestMissionUI = {
        renderPanel,
        openAttendanceModal,
        closeAttendanceModal
    };
})(window);
