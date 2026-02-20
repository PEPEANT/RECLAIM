(function (global) {
    function isFn(value) {
        return typeof value === 'function';
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

        if (listEl) {
            listEl.innerHTML = '';
            rows.forEach((item) => {
                const li = document.createElement('li');
                li.className = 'city-mission-item';
                const itemId = String(item?.id || '').trim();
                if (itemId) li.setAttribute('data-city-mission-id', itemId);
                if (item.status === 'claimed') li.classList.add('claimed');
                if (item.status === 'claimable') li.classList.add('claimable');

                const line = document.createElement('div');
                line.className = 'city-mission-line';
                const lineText = String(item.text || '').trim();
                line.textContent = lineText;
                if (lineText) line.title = lineText;
                li.appendChild(line);

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
        renderPanel
    };
})(window);
