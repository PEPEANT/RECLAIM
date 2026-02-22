(function (global) {
    function showToast(msg) {
        if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
            ui.showToast(msg);
        }
    }

    function showPurchaseCompleteModal(item, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const itemName = String(item?.name || '아이템').trim() || '아이템';
        const body = String(opts.body || `${itemName} 구입이 완료되었습니다.`).trim();
        const detail = String(opts.detail || '').trim();

        if (_game && typeof _game.openCityActionModal === 'function') {
            _game.openCityActionModal('구입 완료', body, { detail });
            return;
        }

        if (detail) {
            showToast(`${body} (${detail})`);
            return;
        }
        showToast(body);
    }

    function formatNumber(value) {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        try {
            return n.toLocaleString('ko-KR');
        } catch (_) {
            return String(n);
        }
    }

    function pickWeighted(entries) {
        const list = Array.isArray(entries) ? entries : [];
        const total = list.reduce((sum, item) => sum + Math.max(0, Number(item?.weight) || 0), 0);
        if (total <= 0 || list.length === 0) return null;
        let roll = Math.random() * total;
        for (let i = 0; i < list.length; i += 1) {
            const w = Math.max(0, Number(list[i]?.weight) || 0);
            if (roll < w) return list[i];
            roll -= w;
        }
        return list[list.length - 1];
    }

    let _game = null;
    let _activeTab = 'supply';
    let _openingLocked = false;
    const MISSILE_BLUEPRINT_ITEM_KEY = 'bp_missile';
    const BOX_LEVEL2_RARE_GOLD_CHANCE = 0.05;
    const BOX_LEVEL2_RARE_GOLD_AMOUNT = 10;

    const SHOP_TABS = [
        { id: 'supply', label: '보급상점' },
        { id: 'special', label: '교환소' }
    ];

    // 인플레이션 반영으로 보급/교환 가격을 상향 조정.
    const SHOP_ITEMS = {
        supply: [
            {
                id: 'box_level1',
                name: '일반 보급박스',
                desc: '소총·방탄복·연막탄 등 D/C등급 장비 1종을 획득합니다.',
                costMoney: 700,
                costGold: 0,
                assetClosed: 'png/store/BOX_Level1.png',
                assetOpen: 'png/store/BOX_Level1_open.png',
                rewardType: 'box_level1'
            },
            {
                id: 'box_level2',
                name: '특수 보급박스',
                desc: '드론·의료키트·미사일설계도 등 C/A등급 장비 1종을 획득합니다.',
                costMoney: 1350,
                costGold: 0,
                assetClosed: 'png/store/BOX_Level2.png',
                assetOpen: 'png/store/BOX_Level2_open.png',
                rewardType: 'box_level2'
            },
            {
                id: 'confidential_doc',
                name: '1급 기밀문서',
                desc: '무작위 후보 3종 중 원하는 장비 1개를 선택해 획득합니다.',
                costMoney: 2200,
                costGold: 0,
                assetClosed: 'png/store/1confidential.png',
                assetOpen: 'png/store/1confidential_open.png',
                rewardType: 'confidential'
            }
        ],
        special: [
            {
                id: 'exchange_money_to_gold',
                name: '머니 -> 골드 교환',
                desc: '머니 600을 골드 2개로 교환합니다.',
                costMoney: 600,
                costGold: 0,
                rewardType: 'exchange_money_to_gold',
                noOpenEffect: true,
                assetClosed: 'png/money.png',
                assetOpen: 'png/money.png'
            },
            {
                id: 'exchange_gold_to_money',
                name: '골드 -> 머니 교환',
                desc: '골드 2개를 머니 600으로 교환합니다.',
                costMoney: 0,
                costGold: 2,
                rewardType: 'exchange_gold_to_money',
                noOpenEffect: true,
                assetClosed: 'png/gold.png',
                assetOpen: 'png/gold.png'
            },
            {
                id: 'exchange_gold_to_honor_medal',
                name: '명예훈장 구매',
                desc: '골드 5개로 명예훈장 1개를 구매합니다.',
                costMoney: 0,
                costGold: 5,
                rewardType: 'exchange_gold_to_honor_medal',
                noOpenEffect: true,
                assetClosed: 'png/gold.png',
                assetOpen: 'png/gold.png'
            },
            {
                id: 'exchange_bp_to_tactical_missile',
                name: '설계도 -> 전술미사일',
                desc: '미사일 설계도 1개를 전술미사일 1기로 교환합니다.',
                costMoney: 0,
                costGold: 0,
                costItemKey: MISSILE_BLUEPRINT_ITEM_KEY,
                costItemCount: 1,
                rewardType: 'exchange_bp_to_tactical_missile',
                noOpenEffect: true,
                assetClosed: 'png/item/item_8.png',
                assetOpen: 'png/item/item_8.png'
            },
            {
                id: 'exchange_bp_to_emp_missile',
                name: '설계도 -> EMP미사일',
                desc: '미사일 설계도 2개를 EMP미사일 1기로 교환합니다.',
                costMoney: 0,
                costGold: 0,
                costItemKey: MISSILE_BLUEPRINT_ITEM_KEY,
                costItemCount: 2,
                rewardType: 'exchange_bp_to_emp_missile',
                noOpenEffect: true,
                assetClosed: 'png/item/item_8.png',
                assetOpen: 'png/item/item_8.png'
            },
            {
                id: 'exchange_bp_to_nuke_missile',
                name: '설계도 -> 핵미사일',
                desc: '미사일 설계도 4개를 핵미사일 1기로 교환합니다.',
                costMoney: 0,
                costGold: 0,
                costItemKey: MISSILE_BLUEPRINT_ITEM_KEY,
                costItemCount: 4,
                rewardType: 'exchange_bp_to_nuke_missile',
                noOpenEffect: true,
                assetClosed: 'png/item/item_8.png',
                assetOpen: 'png/item/item_8.png'
            }
        ]
    };

    const BOX_LEVEL1_REWARD_POOL = [
        { type: 'money', amount: 900, weight: 20 },
        { type: 'unit', unitKey: 'sniper', unitName: '저격수', amount: 1, weight: 16 },
        { type: 'unit', unitKey: 'special_ops', unitName: '특수부대', amount: 1, weight: 16 },
        { type: 'unit', unitKey: 'engineer', unitName: 'RPG병', amount: 1, weight: 16 },
        { type: 'unit', unitKey: 'infantry', unitName: '보병', amount: 2, weight: 20 },
        { type: 'unit', unitKey: 'drone_operator', unitName: '드론병', amount: 1, weight: 8 },
        { type: 'gold', amount: 3, weight: 4 }
    ];

    const BOX_LEVEL2_REWARD_POOL = [
        { type: 'unit', unitKey: 'spg', unitName: '자주포', amount: 1, weight: 18 },
        { type: 'unit', unitKey: 'humvee', unitName: '험비', amount: 1, weight: 23 },
        { type: 'unit', unitKey: 'apc', unitName: '장갑차', amount: 1, weight: 20 },
        { type: 'unit', unitKey: 'mbt', unitName: '주력전차', amount: 1, weight: 14 },
        { type: 'unit', unitKey: 'aa_tank', unitName: '대공전차', amount: 1, weight: 12 },
        { type: 'gold', amount: 6, weight: 13 }
    ];

    const CONFIDENTIAL_REWARD_POOL = [
        { type: 'unit', unitKey: 'tactical_missile', unitName: '전술미사일', amount: 1, weight: 40 },
        { type: 'unit', unitKey: 'emp', unitName: 'EMP미사일', amount: 1, weight: 35 },
        { type: 'unit', unitKey: 'nuke', unitName: '핵미사일', amount: 1, weight: 25 }
    ];

    function open(game) {
        _game = game;
        if (_game && typeof _game.openCityBuildPanel === 'function') _game.openCityBuildPanel(false);
        if (_game && typeof _game.openCityInventory === 'function') _game.openCityInventory(false);
        if (_game && typeof _game.toggleCityMissionPanel === 'function') _game.toggleCityMissionPanel(false);
        if (_game && typeof _game.closeCityActionModal === 'function') _game.closeCityActionModal();
        if (typeof CitySimState !== 'undefined' && CitySimState && typeof CitySimState.clearSelection === 'function' && _game) {
            CitySimState.clearSelection(_game);
        }
        if (_game && typeof _game.renderCityContextBar === 'function') {
            _game.renderCityContextBar();
        }

        const panel = document.getElementById('city-shop-panel');
        if (!panel) return;
        panel.classList.add('open');

        const screen = document.getElementById('city-screen');
        if (screen) screen.classList.add('city-shop-open');

        _activeTab = 'supply';
        _renderTabs();
        _renderCards();
    }

    function close() {
        const panel = document.getElementById('city-shop-panel');
        if (panel) panel.classList.remove('open');
        const screen = document.getElementById('city-screen');
        if (screen) screen.classList.remove('city-shop-open');
        _removeOpenOverlay();
        _openingLocked = false;
        _game = null;
    }

    function switchTab(tabId) {
        _activeTab = (tabId === 'special') ? 'special' : 'supply';
        _renderTabs();
        _renderCards();
    }

    function _renderTabs() {
        const tabsEl = document.getElementById('city-shop-tabs');
        if (!tabsEl) return;
        tabsEl.innerHTML = '';

        SHOP_TABS.forEach((tab) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-category flex-1 py-2 text-xs md:text-sm';
            if (tab.id === _activeTab) btn.classList.add('active');
            btn.textContent = tab.label;
            btn.addEventListener('click', () => switchTab(tab.id));
            tabsEl.appendChild(btn);
        });
    }

    function _getItemDisplayName(itemKey) {
        const key = String(itemKey || '').trim();
        if (!key) return '아이템';
        if (typeof CityItems !== 'undefined' && CityItems && CityItems.ITEM_DEFS && CityItems.ITEM_DEFS[key]?.name) {
            return String(CityItems.ITEM_DEFS[key].name || '아이템');
        }
        if (key === MISSILE_BLUEPRINT_ITEM_KEY) return '미사일 설계도';
        return key;
    }

    function _getOwnedItemCount(gameRef, itemKey) {
        const targetGame = gameRef || _game;
        const key = String(itemKey || '').trim();
        if (!targetGame || !key) return 0;
        if (typeof CityItems !== 'undefined' && CityItems && typeof CityItems.getItemCount === 'function') {
            try {
                return Math.max(0, Math.floor(Number(CityItems.getItemCount(targetGame, key)) || 0));
            } catch (_) { }
        }
        if (typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.ensure !== 'function') {
            return 0;
        }
        const state = CitySimState.ensure(targetGame);
        return Math.max(0, Math.floor(Number(state?.items?.[key]) || 0));
    }

    function _formatCostDisplay(cost, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const specialTab = opts.specialTab === true;
        const needMoney = Math.max(0, Math.floor(Number(cost?.costMoney) || 0));
        const needGold = Math.max(0, Math.floor(Number(cost?.costGold) || 0));
        const needItemCount = Math.max(0, Math.floor(Number(cost?.costItemCount) || 0));
        const needItemKey = String(cost?.costItemKey || '').trim();
        const parts = [];
        if (needMoney > 0) {
            parts.push(specialTab ? `머니 ${formatNumber(needMoney)}` : formatNumber(needMoney));
        }
        if (needGold > 0) {
            parts.push(specialTab ? `골드 ${formatNumber(needGold)}` : `${formatNumber(needGold)}G`);
        }
        if (needItemCount > 0 && needItemKey) {
            parts.push(`${_getItemDisplayName(needItemKey)} ${formatNumber(needItemCount)}개`);
        }
        if (parts.length <= 0) {
            return { text: '무료', color: '#22d3ee' };
        }

        const hasOnlyItems = needItemCount > 0 && needMoney <= 0 && needGold <= 0;
        const hasGold = needGold > 0;
        return {
            text: parts.join(' + '),
            color: hasOnlyItems ? '#60a5fa' : (hasGold ? '#fcd34d' : '')
        };
    }

    function _renderCards() {
        const cardsEl = document.getElementById('city-shop-cards');
        if (!cardsEl) return;
        cardsEl.innerHTML = '';

        const items = SHOP_ITEMS[_activeTab] || [];
        items.forEach((item) => {
            const affordable = item.comingSoon ? false : _canAfford(item);
            const effectiveCost = _getEffectiveCost(item, _game);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'btn-unit city-shop-card';
            card.dataset.cityShopItemId = String(item.id || '').trim();
            card.dataset.cityShopRewardType = String(item.rewardType || '').trim();
            if (!affordable) card.classList.add('cant-afford');
            if (item.comingSoon) card.classList.add('city-shop-card-coming');

            const artWrap = document.createElement('div');
            artWrap.className = 'city-shop-card-art-wrap';
            const art = document.createElement('img');
            art.className = 'city-shop-card-art';
            art.src = item.assetClosed;
            art.alt = item.name;
            art.loading = 'lazy';
            artWrap.appendChild(art);

            const name = document.createElement('div');
            name.className = 'city-build-card-name';
            name.textContent = item.name;

            const desc = document.createElement('div');
            desc.className = 'city-build-card-type';
            desc.textContent = item.desc;

            const cost = document.createElement('div');
            cost.className = 'city-build-card-cost count-text';
            if (item.comingSoon) {
                cost.textContent = '준비중';
                cost.style.color = '#94a3b8';
            } else {
                const costUi = _formatCostDisplay(effectiveCost, { specialTab: _activeTab === 'special' });
                cost.textContent = costUi.text;
                if (costUi.color) cost.style.color = costUi.color;
            }

            card.appendChild(artWrap);
            card.appendChild(name);
            card.appendChild(desc);
            card.appendChild(cost);

            card.addEventListener('click', () => buyItem(item.id));
            cardsEl.appendChild(card);
        });

        const hint = document.getElementById('city-shop-hint');
        if (!hint) return;
        if (_activeTab === 'special') {
            hint.textContent = '골드/머니 교환, 명예훈장 구매, 미사일 설계도 교환이 가능합니다.';
            return;
        }
        hint.textContent = '일반 보급박스 / 특수 보급박스 / 1급 기밀문서를 구매할 수 있습니다.';
    }

    function _renderStorage() {
        const cardsEl = document.getElementById('city-shop-cards');
        if (!cardsEl) return;
        cardsEl.innerHTML = '';

        const STORAGE_ITEMS = [
            { boxId: 'box_level1', rewardType: 'box_level1' },
            { boxId: 'box_level2', rewardType: 'box_level2' },
            { boxId: 'confidential', rewardType: 'confidential' }
        ];

        let hasAny = false;
        STORAGE_ITEMS.forEach((entry) => {
            const count = getBoxCount(_game, entry.boxId);
            const item = _findItemByRewardType(entry.rewardType) || _findItem(entry.boxId);
            if (!item) return;

            hasAny = hasAny || count > 0;

            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'btn-unit city-shop-card';
            if (count <= 0) card.classList.add('cant-afford');

            const artWrap = document.createElement('div');
            artWrap.className = 'city-shop-card-art-wrap';
            const art = document.createElement('img');
            art.className = 'city-shop-card-art';
            art.src = item.assetClosed;
            art.alt = item.name;
            art.loading = 'lazy';
            artWrap.appendChild(art);

            const name = document.createElement('div');
            name.className = 'city-build-card-name';
            name.textContent = item.name;

            const desc = document.createElement('div');
            desc.className = 'city-build-card-type';
            desc.textContent = count > 0 ? `보유: ${formatNumber(count)}개` : '보유 없음';

            const openBtn = document.createElement('div');
            openBtn.className = 'city-build-card-cost count-text';
            openBtn.textContent = count > 0 ? '개봉하기' : '-';
            if (count > 0) openBtn.style.color = '#22d3ee';

            card.appendChild(artWrap);
            card.appendChild(name);
            card.appendChild(desc);
            card.appendChild(openBtn);

            card.addEventListener('click', () => {
                if (_openingLocked) {
                    showToast('개봉 연출 진행 중입니다.');
                    return;
                }
                if (count <= 0) {
                    showToast('보관함에 해당 상자가 없습니다.');
                    return;
                }
                openBoxFromInventory(_game, entry.boxId);
                // 개봉 후 보관함 탭 새로고침
                setTimeout(() => _renderStorage(), 100);
            });

            cardsEl.appendChild(card);
        });

        const hint = document.getElementById('city-shop-hint');
        if (hint) {
            hint.textContent = hasAny
                ? '보관함의 상자를 터치하면 개봉합니다.'
                : '보관함이 비어있습니다. 상점이나 보급창고에서 상자를 획득하세요.';
        }
    }

    function _canAfford(item) {
        if (!_game) return false;
        const eligible = _isPurchaseEligible(item, _game);
        if (!eligible.ok) return false;
        const state = (typeof CitySimState !== 'undefined' && CitySimState && typeof CitySimState.ensure === 'function')
            ? CitySimState.ensure(_game)
            : {};
        const money = Number(state.res?.money) || 0;
        const gold = Number(state.res?.gold) || 0;
        const effectiveCost = _getEffectiveCost(item, _game);
        const needGold = Math.max(0, Math.floor(Number(effectiveCost.costGold) || 0));
        const needMoney = Math.max(0, Math.floor(Number(effectiveCost.costMoney) || 0));
        const needItemCount = Math.max(0, Math.floor(Number(effectiveCost.costItemCount) || 0));
        const needItemKey = String(effectiveCost.costItemKey || '').trim();
        if (needGold > gold) return false;
        if (needMoney > money) return false;
        if (needItemCount > 0 && needItemKey) {
            const ownedItemCount = _getOwnedItemCount(_game, needItemKey);
            if (ownedItemCount < needItemCount) return false;
        }
        return true;
    }

    function _findItem(itemId) {
        const tabs = Object.keys(SHOP_ITEMS);
        for (let i = 0; i < tabs.length; i += 1) {
            const tabItems = SHOP_ITEMS[tabs[i]] || [];
            const item = tabItems.find((entry) => entry.id === itemId);
            if (item) return item;
        }
        return null;
    }

    function _findItemByRewardType(rewardType) {
        const target = String(rewardType || '').trim();
        if (!target) return null;
        const tabs = Object.keys(SHOP_ITEMS);
        for (let i = 0; i < tabs.length; i += 1) {
            const tabItems = SHOP_ITEMS[tabs[i]] || [];
            const item = tabItems.find((entry) => String(entry?.rewardType || '') === target);
            if (item) return item;
        }
        return null;
    }

    function _getTutorialShopCostOverride(item, gameRef) {
        const targetGame = gameRef || _game;
        if (!targetGame) return null;
        const api = global.CitySimTutorialIntro;
        if (!api || typeof api.getShopCostOverride !== 'function') return null;
        let raw = null;
        try {
            raw = api.getShopCostOverride(targetGame, {
                itemId: String(item?.id || '').trim(),
                rewardType: String(item?.rewardType || '').trim(),
                tab: String(_activeTab || '').trim()
            });
        } catch (_) {
            raw = null;
        }
        if (!raw || typeof raw !== 'object') return null;

        const fallbackItemKey = String(item?.costItemKey || '').trim();
        const fallbackItemCount = Math.max(0, Math.floor(Number(item?.costItemCount) || 0));
        const hasItemKeyOverride = Object.prototype.hasOwnProperty.call(raw, 'costItemKey');
        const hasItemCountOverride = Object.prototype.hasOwnProperty.call(raw, 'costItemCount');
        const nextItemKey = hasItemKeyOverride ? String(raw.costItemKey || '').trim() : fallbackItemKey;
        const nextItemCount = hasItemCountOverride
            ? Math.max(0, Math.floor(Number(raw.costItemCount) || 0))
            : fallbackItemCount;

        return {
            costMoney: Math.max(0, Math.floor(Number(raw.costMoney) || 0)),
            costGold: Math.max(0, Math.floor(Number(raw.costGold) || 0)),
            costItemKey: nextItemCount > 0 ? nextItemKey : '',
            costItemCount: nextItemCount > 0 && nextItemKey ? nextItemCount : 0
        };
    }

    function _getEffectiveCost(item, gameRef) {
        const override = _getTutorialShopCostOverride(item, gameRef);
        if (override) return override;
        const costItemKey = String(item?.costItemKey || '').trim();
        const costItemCount = Math.max(0, Math.floor(Number(item?.costItemCount) || 0));
        return {
            costMoney: Math.max(0, Math.floor(Number(item?.costMoney) || 0)),
            costGold: Math.max(0, Math.floor(Number(item?.costGold) || 0)),
            costItemKey: costItemCount > 0 ? costItemKey : '',
            costItemCount: costItemCount > 0 && costItemKey ? costItemCount : 0
        };
    }

    function _consumeTutorialForcedItem(boxId, gameRef) {
        const targetGame = gameRef || _game;
        if (!targetGame) return '';
        const api = global.CitySimTutorialIntro;
        if (!api || typeof api.consumeForcedBoxItemReward !== 'function') return '';
        try {
            const itemKey = api.consumeForcedBoxItemReward(targetGame, { boxId: String(boxId || '').trim() });
            return String(itemKey || '').trim();
        } catch (_) {
            return '';
        }
    }

    function _deductCost(item) {
        if (!_game || typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.mutate !== 'function') {
            return;
        }
        const effectiveCost = _getEffectiveCost(item, _game);
        CitySimState.mutate(_game, (draft) => {
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            const needGold = Math.max(0, Math.floor(Number(effectiveCost.costGold) || 0));
            const needMoney = Math.max(0, Math.floor(Number(effectiveCost.costMoney) || 0));
            if (needGold > 0) {
                draft.res.gold = Math.max(0, (Number(draft.res.gold) || 0) - needGold);
            }
            if (needMoney > 0) {
                draft.res.money = Math.max(0, (Number(draft.res.money) || 0) - needMoney);
            }
            const needItemKey = String(effectiveCost.costItemKey || '').trim();
            const needItemCount = Math.max(0, Math.floor(Number(effectiveCost.costItemCount) || 0));
            if (needItemCount > 0 && needItemKey) {
                if (!draft.items || typeof draft.items !== 'object') draft.items = {};
                const current = Math.max(0, Math.floor(Number(draft.items[needItemKey]) || 0));
                draft.items[needItemKey] = Math.max(0, current - needItemCount);
            }
        });
    }

    function pickPoolReward(pool) {
        const pick = pickWeighted(pool) || (Array.isArray(pool) ? pool[0] : null);
        if (!pick || typeof pick !== 'object') return null;
        const reward = Object.assign({}, pick);
        delete reward.weight;
        return reward;
    }

    function _getUnitOwnedCount(gameRef, unitKey) {
        const targetGame = gameRef || _game;
        if (!targetGame || typeof CitySimState === 'undefined' || !CitySimState) return 0;
        const state = CitySimState.ensure(targetGame);
        return Math.max(0, Math.floor(Number(state?.units?.[unitKey]) || 0));
    }

    function _isRewardEligible(reward, gameRef) {
        if (!reward || reward.type !== 'unit' || !reward.unitKey) return true;
        const key = String(reward.unitKey || '').trim();
        if (!key) return false;
        if (key === 'nuke') {
            return _getUnitOwnedCount(gameRef, key) < 2;
        }
        return true;
    }

    function _isPurchaseEligible(item, gameRef) {
        const rewardType = String(item?.rewardType || '').trim();
        if (rewardType === 'exchange_bp_to_nuke_missile' && _getUnitOwnedCount(gameRef, 'nuke') >= 2) {
            return { ok: false, reason: '핵미사일은 최대 2기까지만 보유할 수 있습니다.' };
        }
        return { ok: true, reason: '' };
    }

    function _getInsufficientCostReason(item, gameRef) {
        const targetGame = gameRef || _game;
        if (!targetGame || typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.ensure !== 'function') {
            return '자원이 부족합니다.';
        }
        const state = CitySimState.ensure(targetGame);
        const money = Math.max(0, Math.floor(Number(state.res?.money) || 0));
        const gold = Math.max(0, Math.floor(Number(state.res?.gold) || 0));
        const effectiveCost = _getEffectiveCost(item, targetGame);
        const needMoney = Math.max(0, Math.floor(Number(effectiveCost.costMoney) || 0));
        const needGold = Math.max(0, Math.floor(Number(effectiveCost.costGold) || 0));
        const needItemCount = Math.max(0, Math.floor(Number(effectiveCost.costItemCount) || 0));
        const needItemKey = String(effectiveCost.costItemKey || '').trim();
        if (needItemCount > 0 && needItemKey) {
            const ownedItemCount = _getOwnedItemCount(targetGame, needItemKey);
            if (ownedItemCount < needItemCount) return `${_getItemDisplayName(needItemKey)}가 부족합니다.`;
        }
        if (needGold > gold) return '골드가 부족합니다.';
        if (needMoney > money) return '자금이 부족합니다.';
        return '자원이 부족합니다.';
    }

    function _rollRewards(item, gameRef) {
        const rewards = [];
        if (!item || !item.rewardType) return rewards;

        if (item.rewardType === 'box_level1') {
            const reward = pickPoolReward(BOX_LEVEL1_REWARD_POOL);
            if (reward) rewards.push(reward);
            return rewards;
        }

        if (item.rewardType === 'box_level2') {
            const reward = pickPoolReward(BOX_LEVEL2_REWARD_POOL);
            if (reward) rewards.push(reward);
            return rewards;
        }

        if (item.rewardType === 'confidential') {
            const eligiblePool = CONFIDENTIAL_REWARD_POOL.filter((entry) => _isRewardEligible(entry, gameRef));
            const reward = pickPoolReward(eligiblePool);
            if (reward) rewards.push(reward);
            return rewards;
        }

        if (item.rewardType === 'exchange_money_to_gold') {
            rewards.push({ type: 'gold', amount: 2 });
            return rewards;
        }

        if (item.rewardType === 'exchange_gold_to_money') {
            rewards.push({ type: 'money', amount: 600 });
            return rewards;
        }

        if (item.rewardType === 'exchange_gold_to_honor_medal') {
            rewards.push({ type: 'honor', amount: 1 });
            return rewards;
        }

        if (item.rewardType === 'exchange_bp_to_tactical_missile') {
            rewards.push({ type: 'unit', unitKey: 'tactical_missile', unitName: '전술미사일', amount: 1 });
            return rewards;
        }

        if (item.rewardType === 'exchange_bp_to_emp_missile') {
            rewards.push({ type: 'unit', unitKey: 'emp', unitName: 'EMP미사일', amount: 1 });
            return rewards;
        }

        if (item.rewardType === 'exchange_bp_to_nuke_missile') {
            const reward = { type: 'unit', unitKey: 'nuke', unitName: '핵미사일', amount: 1 };
            if (_isRewardEligible(reward, gameRef)) {
                rewards.push(reward);
            }
            return rewards;
        }

        return rewards;
    }

    function _applyRewards(rewards, gameRef) {
        const targetGame = gameRef || _game;
        if (!targetGame || typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.mutate !== 'function') {
            return;
        }
        CitySimState.mutate(targetGame, (draft) => {
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            if (!draft.units || typeof draft.units !== 'object') draft.units = {};
            if (!draft.veteranItems || typeof draft.veteranItems !== 'object') draft.veteranItems = {};
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
            const list = Array.isArray(rewards) ? rewards : [];
            for (let i = 0; i < list.length; i += 1) {
                const reward = list[i];
                if (!reward || !reward.type) continue;
                if (reward.type === 'money') {
                    draft.res.money = Math.max(0, Number(draft.res.money) || 0) + Math.max(0, Math.floor(Number(reward.amount) || 0));
                    continue;
                }
                if (reward.type === 'gold') {
                    draft.res.gold = Math.max(0, Number(draft.res.gold) || 0) + Math.max(0, Math.floor(Number(reward.amount) || 0));
                    continue;
                }
                if (reward.type === 'honor') {
                    draft.hud.honor = Math.max(0, Number(draft.hud.honor) || 0) + Math.max(0, Math.floor(Number(reward.amount) || 0));
                    continue;
                }
                if (reward.type === 'unit' && reward.unitKey) {
                    const key = String(reward.unitKey);
                    const current = Math.max(0, Math.floor(Number(draft.units[key]) || 0));
                    const addAmount = Math.max(0, Math.floor(Number(reward.amount) || 0));
                    if (key === 'nuke') {
                        const capped = Math.max(0, Math.min(addAmount, 2 - current));
                        if (capped <= 0) continue;
                        draft.units[key] = current + capped;
                        continue;
                    }
                    draft.units[key] = current + addAmount;
                    continue;
                }
                if (reward.type === 'veteran_item' && reward.itemKey) {
                    const key = String(reward.itemKey || '').trim();
                    if (!key) continue;
                    const current = Math.max(0, Math.floor(Number(draft.veteranItems[key]) || 0));
                    draft.veteranItems[key] = current + Math.max(0, Math.floor(Number(reward.amount) || 0));
                }
            }
        });
        if (typeof targetGame.recalcCityDerived === 'function') {
            targetGame.recalcCityDerived();
        }
    }

    function _rewardText(reward) {
        if (!reward || !reward.type) return '';
        if (reward.type === 'money') return `머니 +${formatNumber(reward.amount)}`;
        if (reward.type === 'gold') return `골드 +${formatNumber(reward.amount)}`;
        if (reward.type === 'honor') return `명예훈장 +${formatNumber(reward.amount)}`;
        if (reward.type === 'unit') return `${reward.unitName || reward.unitKey} +${formatNumber(reward.amount)}`;
        if (reward.type === 'veteran_item') return `${reward.itemName || reward.itemKey} +${formatNumber(reward.amount)}`;
        if (reward.type === 'item') return `[${reward.grade || '?'}] ${reward.itemName || reward.itemKey}`;
        return '';
    }

    function _removeOpenOverlay() {
        const overlay = document.getElementById('shop-open-overlay');
        if (overlay) overlay.remove();
    }

    function _showOpenEffect(item, rewards) {
        _removeOpenOverlay();

        const overlay = document.createElement('div');
        overlay.id = 'shop-open-overlay';
        overlay.className = 'shop-open-overlay';

        const rewardLines = (Array.isArray(rewards) ? rewards : [])
            .map((reward) => {
                let cls = 'money';
                let style = '';
                if (reward.type === 'unit') cls = 'unit';
                else if (reward.type === 'veteran_item') cls = 'item';
                else if (reward.type === 'gold') cls = 'gold';
                else if (reward.type === 'honor') cls = 'gold';
                else if (reward.type === 'item') {
                    cls = 'item';
                    // 등급 색상 적용
                    if (typeof CityItems !== 'undefined' && CityItems && reward.grade) {
                        const col = CityItems.GRADE_COLOR[reward.grade] || '';
                        if (col) style = ` style="color:${col}"`;
                    }
                }
                return `<div class="shop-open-reward ${cls}"${style}>${_rewardText(reward)}</div>`;
            })
            .join('');

        overlay.innerHTML = '' +
            '<div class="shop-open-panel" role="dialog" aria-modal="true" aria-label="보상 획득">' +
            `  <div class="shop-open-title">${item.name} 개봉</div>` +
            '  <div class="shop-open-box-wrap is-shaking" id="shop-open-box-wrap">' +
            `      <img id="shop-open-box-img" class="shop-open-box-img" src="${item.assetClosed}" alt="${item.name}">` +
            '  </div>' +
            '  <div id="shop-open-reward-list" class="shop-open-reward-list">' +
            `      ${rewardLines}` +
            '  </div>' +
            '  <button id="shop-open-confirm" type="button" class="shop-open-confirm" disabled>확인</button>' +
            '</div>';

        document.body.appendChild(overlay);

        const boxWrap = document.getElementById('shop-open-box-wrap');
        const boxImg = document.getElementById('shop-open-box-img');
        const rewardList = document.getElementById('shop-open-reward-list');
        const confirmBtn = document.getElementById('shop-open-confirm');
        let canClose = false;

        const closeOverlay = () => {
            if (!canClose) return;
            _removeOpenOverlay();
            _openingLocked = false;
        };

        if (confirmBtn) confirmBtn.addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeOverlay();
        });

        setTimeout(() => {
            if (boxWrap) boxWrap.classList.remove('is-shaking');
            if (boxImg) {
                boxImg.src = item.assetOpen || item.assetClosed;
                boxImg.classList.add('is-open');
            }
        }, 900);

        setTimeout(() => {
            if (rewardList) rewardList.classList.add('show');
            if (confirmBtn) confirmBtn.disabled = false;
            canClose = true;
        }, 1250);
    }

    // --- 보관함 시스템 ---
    const STORABLE_REWARD_TYPES = ['box_level1', 'box_level2', 'confidential'];

    function _isStorableItem(item) {
        return item && STORABLE_REWARD_TYPES.indexOf(item.rewardType) !== -1;
    }

    function addBoxToInventory(game, boxId, count) {
        const targetGame = game || _game;
        if (!targetGame || typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.mutate !== 'function') return;
        const n = Math.max(1, Math.floor(Number(count) || 1));
        CitySimState.mutate(targetGame, (draft) => {
            if (!draft.boxes || typeof draft.boxes !== 'object') draft.boxes = {};
            draft.boxes[boxId] = Math.max(0, Math.floor(Number(draft.boxes[boxId]) || 0)) + n;
        });
    }

    function getBoxCount(game, boxId) {
        const targetGame = game || _game;
        if (!targetGame || typeof CitySimState === 'undefined' || !CitySimState) return 0;
        const state = CitySimState.ensure(targetGame);
        return Math.max(0, Math.floor(Number(state.boxes?.[boxId]) || 0));
    }

    function openBoxFromInventory(game, boxId) {
        const targetGame = game || _game;
        if (!targetGame) return { ok: false, reason: 'game_not_ready' };
        const current = getBoxCount(targetGame, boxId);
        if (current <= 0) {
            showToast('보관함에 해당 상자가 없습니다.');
            return { ok: false, reason: 'no_box' };
        }

        const item = _findItemByRewardType(boxId) || _findItem(boxId);
        if (!item) return { ok: false, reason: 'unknown_box' };

        // 보관함에서 1개 차감
        CitySimState.mutate(targetGame, (draft) => {
            if (!draft.boxes || typeof draft.boxes !== 'object') draft.boxes = {};
            draft.boxes[boxId] = Math.max(0, Math.floor(Number(draft.boxes[boxId]) || 0) - 1);
        });

        // ── 기밀문서: 3-pick-1 모달 (유닛 드롭 없음) ──────────────
        if (boxId === 'confidential') {
            if (typeof targetGame.saveCitySimState === 'function') targetGame.saveCitySimState();
            _openingLocked = true;
            _showOpenEffect(item, []);
            if (typeof CityItems !== 'undefined' && CityItems) {
                setTimeout(function () {
                    CityItems.openConfidentialPick(targetGame, function () {
                        if (typeof targetGame.saveCitySimState === 'function') {
                            try { targetGame.saveCitySimState(); } catch (_) {}
                        }
                        if (typeof targetGame.renderCityInventory === 'function') {
                            try { targetGame.renderCityInventory(); } catch (_) {}
                        }
                    });
                }, 1400);
            }
            return { ok: true, rewards: [] };
        }

        // ── 일반/특수 보급상자: 아이템 1개 확정 지급 ───────────────
        const itemRewards = [];
        if (typeof CityItems !== 'undefined' && CityItems) {
            let pickedKey = _consumeTutorialForcedItem(boxId, targetGame);
            if (!pickedKey || !CityItems.ITEM_DEFS[pickedKey]) {
                let pool = null;
                if (boxId === 'box_level1') pool = CityItems.BOX1_ITEM_POOL;
                else if (boxId === 'box_level2') pool = CityItems.BOX2_ITEM_POOL;

                if (pool) {
                    // items.js의 pickWeighted와 동일한 로직
                    const total = pool.reduce(function (s, e) { return s + (Number(e.weight) || 0); }, 0);
                    let roll = Math.random() * total;
                    pickedKey = pool[pool.length - 1].itemKey;
                    for (let i = 0; i < pool.length; i++) {
                        roll -= pool[i].weight;
                        if (roll < 0) { pickedKey = pool[i].itemKey; break; }
                    }
                }
            }
            if (pickedKey) {
                CityItems.grantItem(targetGame, pickedKey, 1);
                const def = CityItems.ITEM_DEFS[pickedKey];
                if (def) {
                    itemRewards.push({ type: 'item', itemKey: pickedKey, itemName: def.name, grade: def.grade });
                }
            }
        }

        // 특수 보급상자 희귀 보너스: 낮은 확률로 골드 10개 추가 지급
        if (boxId === 'box_level2' && Math.random() < BOX_LEVEL2_RARE_GOLD_CHANCE) {
            if (typeof CitySimState !== 'undefined' && CitySimState && typeof CitySimState.mutate === 'function') {
                CitySimState.mutate(targetGame, (draft) => {
                    if (!draft.res || typeof draft.res !== 'object') draft.res = {};
                    draft.res.gold = Math.max(0, Number(draft.res.gold) || 0) + BOX_LEVEL2_RARE_GOLD_AMOUNT;
                });
            }
            itemRewards.push({ type: 'gold', amount: BOX_LEVEL2_RARE_GOLD_AMOUNT });
        }

        if (typeof targetGame.saveCitySimState === 'function') targetGame.saveCitySimState();
        if (typeof CitySimEconomy !== 'undefined' && CitySimEconomy && typeof CitySimEconomy.renderResources === 'function') {
            CitySimEconomy.renderResources(targetGame);
        }

        _openingLocked = true;
        _showOpenEffect(item, itemRewards);
        return { ok: true, rewards: itemRewards };
    }

    function buyItem(itemId) {
        if (!_game) return;
        if (_openingLocked) {
            showToast('개봉 연출 진행 중입니다.');
            return;
        }
        const item = _findItem(itemId);
        if (!item) return;

        if (item.comingSoon) {
            showToast('교환소는 준비중입니다.');
            return;
        }
        const eligible = _isPurchaseEligible(item, _game);
        if (!eligible.ok) {
            showToast(eligible.reason || '교환 조건을 만족하지 않습니다.');
            return;
        }
        if (!_canAfford(item)) {
            showToast(_getInsufficientCostReason(item, _game));
            return;
        }

        _deductCost(item);

        // 보관 가능 아이템이면 보관함에 저장
        if (_isStorableItem(item)) {
            addBoxToInventory(_game, item.rewardType, 1);
            if (typeof _game.saveCitySimState === 'function') _game.saveCitySimState();
            if (typeof CitySimEconomy !== 'undefined' && CitySimEconomy && typeof CitySimEconomy.renderResources === 'function') {
                CitySimEconomy.renderResources(_game);
            }
            _renderCards();
            const storedCount = getBoxCount(_game, item.rewardType);
            showPurchaseCompleteModal(item, {
                body: `${item.name} 구입 완료`,
                detail: `보관함 저장 완료 (보유 ${formatNumber(storedCount)}개)`
            });
            return;
        }

        // 즉시 교환 아이템 (금↔현금)
        const rewards = _rollRewards(item, _game);
        _applyRewards(rewards);

        if (typeof _game.saveCitySimState === 'function') _game.saveCitySimState();
        if (typeof CitySimEconomy !== 'undefined' && CitySimEconomy && typeof CitySimEconomy.renderResources === 'function') {
            CitySimEconomy.renderResources(_game);
        }

        _renderCards();
        if (item.noOpenEffect) {
            const summary = rewards.map((reward) => _rewardText(reward)).filter(Boolean).join(', ');
            showToast(`${item.name} 교환 완료${summary ? ` (${summary})` : ''}`);
            _openingLocked = false;
            return;
        }
        _openingLocked = true;
        _showOpenEffect(item, rewards);
    }

    function grantQuestReward(game, rewardType, options) {
        const targetGame = game || _game || null;
        if (!targetGame) {
            return { ok: false, reason: 'game_not_ready', rewards: [] };
        }

        const item = _findItemByRewardType(rewardType);
        if (!item) {
            return { ok: false, reason: 'unknown_reward_type', rewards: [] };
        }

        const opts = (options && typeof options === 'object') ? options : {};
        const source = String(opts.source || '보상').trim() || '보상';

        // 보관 가능 아이템이면 보관함에 저장
        if (_isStorableItem(item)) {
            addBoxToInventory(targetGame, item.rewardType, 1);
            if (typeof targetGame.saveCitySimState === 'function') {
                targetGame.saveCitySimState();
            }
            showToast(`${source}: ${item.name} → 보관함에 저장됨`);
            return { ok: true, reason: '', rewards: [], itemId: item.id };
        }

        // 즉시 지급 (교환 등)
        const rewards = _rollRewards(item, targetGame);
        _applyRewards(rewards, targetGame);

        if (typeof targetGame.saveCitySimState === 'function') {
            targetGame.saveCitySimState();
        }
        if (typeof CitySimEconomy !== 'undefined' && CitySimEconomy && typeof CitySimEconomy.renderResources === 'function') {
            CitySimEconomy.renderResources(targetGame);
        } else if (typeof targetGame.renderCityResources === 'function') {
            targetGame.renderCityResources();
        }

        const summary = rewards.map((reward) => _rewardText(reward)).filter(Boolean).join(', ');
        showToast(`${source}: ${item.name} 지급${summary ? ` (${summary})` : ''}`);

        if (opts.showEffect === true) {
            _openingLocked = true;
            _showOpenEffect(item, rewards);
        }

        return { ok: true, reason: '', rewards, itemId: item.id };
    }

    function _closeCrateResult() {
        _removeOpenOverlay();
        _openingLocked = false;
    }

    global.CitySimGacha = {
        open,
        close,
        switchTab,
        buyItem,
        grantQuestReward,
        addBoxToInventory,
        getBoxCount,
        openBoxFromInventory,
        _closeCrateResult
    };
})(window);
