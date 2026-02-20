(function (global) {
    'use strict';

    var GRADE_COLOR = {
        D: '#9ca3af',
        C: '#4ade80',
        A: '#60a5fa'
    };

    // Item numbering and profile art mapping
    // #01 M249, #02 body armor, #03 scope, #04 smoke, #05 medkit,
    // #06 suicide drone, #07 AT drone, #08 missile blueprint.
    var ITEM_DEFS = {
        rifle_d: {
            id: 'rifle_d',
            name: 'M249 기관총',
            grade: 'D',
            color: GRADE_COLOR.D,
            icon: '🔫',
            itemNo: 1,
            asset: 'png/item/item_1.png'
        },
        body_armor_d: {
            id: 'body_armor_d',
            name: '방탄복',
            grade: 'D',
            color: GRADE_COLOR.D,
            icon: '🛡️',
            itemNo: 2,
            asset: 'png/item/item_2.png'
        },
        scope_d: {
            id: 'scope_d',
            name: '조준경',
            grade: 'D',
            color: GRADE_COLOR.D,
            icon: '🎯',
            itemNo: 3,
            asset: 'png/item/item_3.png'
        },
        smoke_grenade: {
            id: 'smoke_grenade',
            name: '연막탄',
            grade: 'C',
            color: GRADE_COLOR.C,
            icon: '💨',
            itemNo: 4,
            asset: 'png/item/item_4.png'
        },
        medkit_c: {
            id: 'medkit_c',
            name: '의료 키트',
            grade: 'C',
            color: GRADE_COLOR.C,
            icon: '🩹',
            itemNo: 5,
            asset: 'png/item/item_5.png'
        },
        drone_suicide_item: {
            id: 'drone_suicide_item',
            name: '자폭드론',
            grade: 'C',
            color: GRADE_COLOR.C,
            icon: null,
            unitIconKey: 'drone_suicide',
            itemNo: 6,
            asset: 'png/item/item_6.png'
        },
        drone_at_item: {
            id: 'drone_at_item',
            name: 'AT드론',
            grade: 'C',
            color: GRADE_COLOR.C,
            icon: null,
            unitIconKey: 'drone_at',
            itemNo: 7,
            asset: 'png/item/item_7.png'
        },
        bp_missile: {
            id: 'bp_missile',
            name: '미사일 설계도',
            grade: 'A',
            color: GRADE_COLOR.A,
            icon: '📘',
            itemNo: 8,
            asset: 'png/item/item_8.png'
        }
    };

    var BOX1_ITEM_POOL = [
        { itemKey: 'rifle_d', weight: 5 },
        { itemKey: 'body_armor_d', weight: 5 },
        { itemKey: 'scope_d', weight: 4 },
        { itemKey: 'smoke_grenade', weight: 3 },
        { itemKey: 'medkit_c', weight: 2 },
        { itemKey: 'drone_suicide_item', weight: 1 }
    ];

    var BOX2_ITEM_POOL = [
        { itemKey: 'body_armor_d', weight: 4 },
        { itemKey: 'scope_d', weight: 3 },
        { itemKey: 'smoke_grenade', weight: 4 },
        { itemKey: 'medkit_c', weight: 3 },
        { itemKey: 'drone_suicide_item', weight: 3 },
        { itemKey: 'drone_at_item', weight: 2 },
        { itemKey: 'bp_missile', weight: 1 }
    ];

    var CONFIDENTIAL_ITEM_POOL = [
        { itemKey: 'smoke_grenade', weight: 5 },
        { itemKey: 'medkit_c', weight: 5 },
        { itemKey: 'drone_suicide_item', weight: 5 },
        { itemKey: 'drone_at_item', weight: 5 },
        { itemKey: 'bp_missile', weight: 8 },
        { itemKey: 'body_armor_d', weight: 4 },
        { itemKey: 'scope_d', weight: 3 }
    ];

    function pickWeighted(pool) {
        var list = Array.isArray(pool) ? pool.slice() : [];
        var total = list.reduce(function (sum, entry) {
            return sum + Math.max(0, Number(entry && entry.weight) || 0);
        }, 0);
        if (total <= 0 || list.length <= 0) return null;

        var roll = Math.random() * total;
        for (var i = 0; i < list.length; i += 1) {
            roll -= Math.max(0, Number(list[i] && list[i].weight) || 0);
            if (roll < 0) return String(list[i].itemKey || '').trim();
        }
        return String(list[list.length - 1].itemKey || '').trim();
    }

    function pick3Distinct(pool) {
        var available = Array.isArray(pool) ? pool.slice() : [];
        var result = [];
        for (var i = 0; i < 3 && available.length > 0; i += 1) {
            var key = pickWeighted(available);
            if (!key) break;
            result.push(key);
            available = available.filter(function (entry) {
                return String(entry && entry.itemKey || '').trim() !== key;
            });
        }
        return result;
    }

    function ensureItemsStore(game) {
        if (typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.ensure !== 'function') {
            return null;
        }
        var state = CitySimState.ensure(game);
        if (!state || typeof state !== 'object') return null;
        if (!state.items || typeof state.items !== 'object') {
            state.items = {};
        }
        return state.items;
    }

    function grantItem(game, itemKey, amount) {
        var key = String(itemKey || '').trim();
        if (!key || !ITEM_DEFS[key]) return false;
        var qty = Math.max(1, Math.floor(Number(amount) || 1));

        if (typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.mutate !== 'function') {
            return false;
        }

        CitySimState.mutate(game, function (draft) {
            if (!draft.items || typeof draft.items !== 'object') draft.items = {};
            draft.items[key] = Math.max(0, Math.floor(Number(draft.items[key]) || 0)) + qty;
        });
        return true;
    }

    function getItemCount(game, itemKey) {
        var key = String(itemKey || '').trim();
        if (!key) return 0;
        var items = ensureItemsStore(game);
        if (!items) return 0;
        return Math.max(0, Math.floor(Number(items[key]) || 0));
    }

    function getAllItems(game) {
        var items = ensureItemsStore(game);
        if (!items) return {};
        return items;
    }

    function tryDropFromBox1(game) {
        if (Math.random() > 0.20) return null;
        var key = pickWeighted(BOX1_ITEM_POOL);
        if (!key) return null;
        grantItem(game, key, 1);
        return key;
    }

    function tryDropFromBox2(game) {
        if (Math.random() > 0.30) return null;
        var key = pickWeighted(BOX2_ITEM_POOL);
        if (!key) return null;
        grantItem(game, key, 1);
        return key;
    }

    function _showItemToast(def, source) {
        var msg = (source ? '[' + source + '] ' : '') + '획득: ' + def.name + ' [' + def.grade + ']';
        if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            ui.showToast(msg);
            return;
        }
        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast(msg);
        }
    }

    function showItemToast(itemKey, source) {
        var def = ITEM_DEFS[String(itemKey || '').trim()];
        if (def) _showItemToast(def, source || '보급상자');
    }

    function buildItemIconHtml(def) {
        if (!def || typeof def !== 'object') return '<span>??</span>';
        if (def.asset) {
            return '<img src="' + def.asset + '" alt="' + def.name + '" class="item-pick-unit-icon">';
        }
        if (def.unitIconKey && typeof drawInventoryUnitIcon === 'function') {
            try {
                var iconUrl = drawInventoryUnitIcon(def.unitIconKey);
                if (iconUrl) {
                    return '<img src="' + iconUrl + '" alt="' + def.name + '" class="item-pick-unit-icon">';
                }
            } catch (_) { }
        }
        return '<span>' + (def.icon || String(def.name || '').slice(0, 2) || '??') + '</span>';
    }

    function openConfidentialPick(game, onDone) {
        var candidates = pick3Distinct(CONFIDENTIAL_ITEM_POOL);
        if (candidates.length <= 0) {
            if (typeof onDone === 'function') onDone(null);
            return;
        }

        var existingModal = document.getElementById('item-pick-modal');
        if (existingModal) existingModal.remove();

        var modal = document.createElement('div');
        modal.id = 'item-pick-modal';
        modal.className = 'item-pick-modal';

        var title = document.createElement('div');
        title.className = 'item-pick-title';
        title.textContent = '기밀문서 보상: 아이템 1개를 선택하세요';
        modal.appendChild(title);

        var cards = document.createElement('div');
        cards.className = 'item-pick-cards';

        candidates.forEach(function (key) {
            var def = ITEM_DEFS[key];
            if (!def) return;

            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'item-pick-card item-grade-' + String(def.grade || '').toLowerCase();
            card.style.borderColor = def.color;
            card.innerHTML =
                '<div class="item-pick-icon">' + buildItemIconHtml(def) + '</div>' +
                '<div class="item-pick-grade" style="color:' + def.color + '">[' + def.grade + ']</div>' +
                '<div class="item-pick-name">' + def.name + '</div>';

            card.addEventListener('click', function () {
                grantItem(game, key, 1);
                if (game && typeof game.saveCitySimState === 'function') {
                    try { game.saveCitySimState(); } catch (_) { }
                }
                if (game && typeof game.renderCityInventoryPanel === 'function') {
                    try { game.renderCityInventoryPanel(); } catch (_) { }
                }
                _showItemToast(def, '기밀문서');
                modal.remove();
                if (typeof onDone === 'function') onDone(key);
            });

            cards.appendChild(card);
        });

        modal.appendChild(cards);
        document.body.appendChild(modal);
    }

    function renderItemEntries(game) {
        var items = getAllItems(game);
        var entries = [];

        Object.keys(items).forEach(function (key) {
            var count = Math.max(0, Math.floor(Number(items[key]) || 0));
            if (count <= 0) return;
            var def = ITEM_DEFS[key];
            if (!def) return;

            entries.push({
                kind: 'item',
                itemKey: key,
                name: def.name,
                grade: def.grade,
                color: def.color,
                asset: def.asset || '',
                icon: def.icon,
                unitIconKey: def.unitIconKey || null,
                itemNo: Math.max(0, Math.floor(Number(def.itemNo) || 0)),
                count: count
            });
        });

        var gradeOrder = { D: 0, C: 1, A: 2 };
        entries.sort(function (a, b) {
            var gd = (gradeOrder[a.grade] || 0) - (gradeOrder[b.grade] || 0);
            if (gd !== 0) return gd;
            var an = String(a.name || '');
            var bn = String(b.name || '');
            return an.localeCompare(bn, 'ko-KR');
        });

        return entries;
    }

    global.CityItems = {
        ITEM_DEFS: ITEM_DEFS,
        GRADE_COLOR: GRADE_COLOR,
        BOX1_ITEM_POOL: BOX1_ITEM_POOL,
        BOX2_ITEM_POOL: BOX2_ITEM_POOL,
        CONFIDENTIAL_ITEM_POOL: CONFIDENTIAL_ITEM_POOL,
        grantItem: grantItem,
        getItemCount: getItemCount,
        getAllItems: getAllItems,
        tryDropFromBox1: tryDropFromBox1,
        tryDropFromBox2: tryDropFromBox2,
        openConfidentialPick: openConfidentialPick,
        showItemToast: showItemToast,
        renderItemEntries: renderItemEntries
    };
})(window);
