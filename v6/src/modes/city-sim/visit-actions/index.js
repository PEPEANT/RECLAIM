(function (global) {
    const INTERACTION_COLLECTION = 'cityInteractions';
    const GIFT_KIND_UNIT = 'unit';
    const GIFT_KIND_HONOR = 'honor_medal';
    const PUBLIC_BASE_COLLECTION = 'publicBases';
    const SIGN_TEXT_MAX = 60;
    const MAX_SIGN_FETCH = 120;
    const MAX_GIFT_FETCH = 40;
    let _giftSyncInFlight = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function toNumber(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function formatNumber(value) {
        const n = Math.max(0, Math.floor(toNumber(value, 0)));
        try {
            return n.toLocaleString('ko-KR');
        } catch (_) {
            return String(n);
        }
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function tsToMs(ts) {
        if (!ts) return 0;
        if (typeof ts === 'number') return ts;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts.seconds === 'number') {
            return (ts.seconds * 1000) + Math.floor((ts.nanoseconds || 0) / 1000000);
        }
        return 0;
    }

    function showToast(message) {
        const msg = String(message || '').trim();
        if (!msg) return;

        if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            ui.showToast(msg);
            return;
        }
        if (typeof game !== 'undefined' && game && typeof game.showToast === 'function') {
            game.showToast(msg);
            return;
        }
        if (global.ui && typeof global.ui.showToast === 'function') {
            global.ui.showToast(msg);
            return;
        }
        if (global.game && typeof global.game.showToast === 'function') {
            global.game.showToast(msg);
            return;
        }

        console.info('[CitySimVisitActions] toast:', msg);
    }

    function getGameRef() {
        if (typeof game !== 'undefined' && game) return game;
        if (global.game) return global.game;
        return null;
    }

    function getDb() {
        const fb = global.RECLAIM_FB;
        if (!fb || typeof fb !== 'object') return null;
        if (typeof fb.isReady === 'function' && !fb.isReady()) return null;
        return fb.db || null;
    }

    function getAuthUser() {
        if (typeof CitySimAuth !== 'undefined' && CitySimAuth && typeof CitySimAuth.getCurrentUser === 'function') {
            return CitySimAuth.getCurrentUser();
        }
        const fb = global.RECLAIM_FB;
        if (!fb || typeof fb.getUser !== 'function') return null;
        return fb.getUser();
    }

    function getCurrentDisplayName(user) {
        const u = user || getAuthUser();
        if (u && String(u.displayName || '').trim()) {
            return String(u.displayName).trim().slice(0, 40);
        }
        if (u && String(u.email || '').includes('@')) {
            return String(u.email).split('@')[0].trim().slice(0, 40) || '익명관';
        }
        return '익명관';
    }

    function getServerTs() {
        if (typeof firebase === 'undefined'
            || !firebase
            || !firebase.firestore
            || !firebase.firestore.FieldValue
            || typeof firebase.firestore.FieldValue.serverTimestamp !== 'function') {
            return Date.now();
        }
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    function getUnitDisplayName(unitKey) {
        const key = String(unitKey || '').trim();
        if (!key) return '유닛';

        if (typeof Lang !== 'undefined' && Lang && typeof Lang.getText === 'function') {
            const localized = String(Lang.getText(`unit_${key}_name`) || '').trim();
            if (localized && localized !== `unit_${key}_name`) return localized;
        }

        if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units && CONFIG.units[key]) {
            return String(CONFIG.units[key].name || key);
        }

        return key;
    }

    function getGiftableEntries(game) {
        if (!game || typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.ensure !== 'function') {
            return [];
        }

        const state = CitySimState.ensure(game);
        const units = (state.units && typeof state.units === 'object') ? state.units : {};
        const entries = [];

        Object.keys(units).forEach((unitKey) => {
            const key = String(unitKey || '').trim();
            if (!key || key === 'icbm_enemy') return;
            const count = Math.max(0, Math.floor(toNumber(units[key], 0)));
            if (count <= 0) return;

            entries.push({
                kind: GIFT_KIND_UNIT,
                itemKey: key,
                count,
                name: getUnitDisplayName(key)
            });
        });

        const honor = Math.max(0, Math.floor(toNumber(state.hud?.honor, 0)));
        if (honor > 0) {
            entries.push({
                kind: GIFT_KIND_HONOR,
                itemKey: 'honor_medal',
                count: honor,
                name: '명예훈장'
            });
        }

        entries.sort((a, b) => {
            if (a.kind !== b.kind) {
                if (a.kind === GIFT_KIND_UNIT) return -1;
                if (b.kind === GIFT_KIND_UNIT) return 1;
            }
            if (b.count !== a.count) return b.count - a.count;
            return String(a.name).localeCompare(String(b.name), 'ko-KR');
        });

        return entries;
    }

    function applyGiftDelta(game, giftEntry, deltaCount) {
        if (!game || !giftEntry) return false;
        if (typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.mutate !== 'function') {
            return false;
        }

        const delta = Math.floor(toNumber(deltaCount, 0));
        if (!Number.isFinite(delta) || delta === 0) return true;

        const kind = String(giftEntry.kind || '').trim();
        const key = String(giftEntry.itemKey || '').trim();
        let ok = true;

        CitySimState.mutate(game, (draft) => {
            if (kind === GIFT_KIND_UNIT) {
                if (!draft.units || typeof draft.units !== 'object') draft.units = {};
                const current = Math.max(0, Math.floor(toNumber(draft.units[key], 0)));
                const next = current + delta;
                if (next < 0) {
                    ok = false;
                    return;
                }
                draft.units[key] = next;
                return;
            }

            if (kind === GIFT_KIND_HONOR) {
                if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
                const current = Math.max(0, Math.floor(toNumber(draft.hud.honor, 0)));
                const next = current + delta;
                if (next < 0) {
                    ok = false;
                    return;
                }
                draft.hud.honor = next;
                return;
            }

            ok = false;
        });

        return ok;
    }

    function getGiftOwnedCount(game, giftEntry) {
        if (!game || !giftEntry) return 0;
        if (typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.ensure !== 'function') {
            return 0;
        }
        const state = CitySimState.ensure(game);
        const kind = String(giftEntry.kind || '').trim();
        const key = String(giftEntry.itemKey || '').trim();
        if (kind === GIFT_KIND_UNIT) {
            return Math.max(0, Math.floor(toNumber(state.units?.[key], 0)));
        }
        if (kind === GIFT_KIND_HONOR) {
            return Math.max(0, Math.floor(toNumber(state.hud?.honor, 0)));
        }
        return 0;
    }

    function setGiftOwnedCount(game, giftEntry, nextCount) {
        if (!game || !giftEntry) return false;
        if (typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.mutate !== 'function') {
            return false;
        }
        const safeCount = Math.max(0, Math.floor(toNumber(nextCount, 0)));
        const kind = String(giftEntry.kind || '').trim();
        const key = String(giftEntry.itemKey || '').trim();
        let ok = true;

        CitySimState.mutate(game, (draft) => {
            if (kind === GIFT_KIND_UNIT) {
                if (!draft.units || typeof draft.units !== 'object') draft.units = {};
                draft.units[key] = safeCount;
                return;
            }
            if (kind === GIFT_KIND_HONOR) {
                if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
                draft.hud.honor = safeCount;
                return;
            }
            ok = false;
        });

        return ok;
    }

    function syncGiftStateUi(game) {
        if (!game || typeof game !== 'object') return;

        if (typeof game.recalcCityDerived === 'function') {
            try { game.recalcCityDerived(); } catch (_) { }
        }
        if (typeof game.renderCityResources === 'function') {
            try { game.renderCityResources(); } catch (_) { }
        }
        if (typeof game.renderCityUnits === 'function') {
            try { game.renderCityUnits(); } catch (_) { }
        }
        if (typeof game.renderCityInventoryPanel === 'function') {
            try { game.renderCityInventoryPanel(); } catch (_) { }
        }
        if (typeof game.renderCityContextBar === 'function') {
            try { game.renderCityContextBar(); } catch (_) { }
        }
        if (typeof game.applyCityUnitsToBattleStock === 'function') {
            try { game.applyCityUnitsToBattleStock(); } catch (_) { }
        }
    }

    async function persistCityState(game) {
        if (!game || typeof game.saveCitySimState !== 'function') return true;
        try {
            const result = game.saveCitySimState();
            await Promise.resolve(result);
            return true;
        } catch (_) {
            return false;
        }
    }

    async function sendGiftEntry(context, giftEntry) {
        const ctx = (context && typeof context === 'object') ? context : {};
        const game = ctx.game || getGameRef();
        const targetUid = String(ctx.targetUid || '').trim();
        const targetName = String(ctx.targetName || '상대 지휘관');

        const user = getAuthUser();
        const senderUid = (user && user.uid) ? String(user.uid) : '';
        const senderName = getCurrentDisplayName(user);

        if (!user || !senderUid) {
            showToast('로그인 후 사용할 수 있습니다.');
            return { ok: false, reason: 'unauthenticated' };
        }
        if (!targetUid) {
            showToast('대상 플레이어를 찾지 못했습니다.');
            return { ok: false, reason: 'missing_target' };
        }
        if (targetUid === senderUid) {
            showToast('자기 자신에게는 선물할 수 없습니다.');
            return { ok: false, reason: 'self_target' };
        }

        const db = getDb();
        if (!db) {
            showToast('Firebase 연결을 확인해주세요.');
            return { ok: false, reason: 'db_unavailable' };
        }

        const entry = (giftEntry && typeof giftEntry === 'object') ? giftEntry : null;
        if (!entry) {
            showToast('선물 아이템을 선택해주세요.');
            return { ok: false, reason: 'missing_item' };
        }

        const beforeCount = getGiftOwnedCount(game, entry);
        if (beforeCount <= 0) {
            showToast('선물 가능한 수량이 부족합니다.');
            return { ok: false, reason: 'insufficient_item' };
        }

        if (!applyGiftDelta(game, entry, -1)) {
            showToast('선물 가능한 수량이 부족합니다.');
            return { ok: false, reason: 'insufficient_item' };
        }

        const expectedAfterDeduct = Math.max(0, beforeCount - 1);
        const afterDeductCount = getGiftOwnedCount(game, entry);
        if (afterDeductCount !== expectedAfterDeduct) {
            setGiftOwnedCount(game, entry, expectedAfterDeduct);
        }
        syncGiftStateUi(game);

        const savedAfterDeduct = await persistCityState(game);
        if (!savedAfterDeduct) {
            setGiftOwnedCount(game, entry, beforeCount);
            await persistCityState(game);
            syncGiftStateUi(game);
            showToast('저장에 실패하여 선물을 취소했습니다.');
            return { ok: false, reason: 'save_failed' };
        }

        const payload = {
            type: 'gift',
            status: 'active',
            toUid: targetUid,
            toName: targetName.slice(0, 40),
            fromUid: senderUid,
            fromName: senderName,
            giftKind: String(entry.kind || ''),
            itemKey: String(entry.itemKey || ''),
            itemName: String(entry.name || ''),
            count: 1,
            createdAt: getServerTs(),
            createdAtMs: Date.now(),
            updatedAt: getServerTs()
        };

        try {
            await db.collection(INTERACTION_COLLECTION).add(payload);
            const verifiedCount = getGiftOwnedCount(game, entry);
            if (verifiedCount !== expectedAfterDeduct) {
                setGiftOwnedCount(game, entry, expectedAfterDeduct);
                await persistCityState(game);
            }
            syncGiftStateUi(game);
            showToast(`${targetName}님에게 ${entry.name} 1개를 선물했습니다. (남은 ${formatNumber(expectedAfterDeduct)})`);
            return { ok: true };
        } catch (err) {
            setGiftOwnedCount(game, entry, beforeCount);
            await persistCityState(game);
            syncGiftStateUi(game);
            console.warn('[CitySimVisitActions] sendGift failed:', err);
            showToast('선물 전송에 실패했습니다.');
            return { ok: false, reason: 'write_failed' };
        }
    }

    function openGiftComposer(context) {
        const ctx = (context && typeof context === 'object') ? context : {};
        const game = ctx.game || getGameRef();
        const targetName = String(ctx.targetName || '상대 지휘관');

        if (!game || typeof game.openCityActionModal !== 'function') {
            showToast('선물 UI를 열 수 없습니다.');
            return;
        }

        const entries = getGiftableEntries(game);
        if (entries.length <= 0) {
            showToast('선물할 수 있는 아이템이 없습니다.');
            return;
        }

        const rowsHtml = entries.map((entry, index) => {
            const count = formatNumber(entry.count);
            const giftLabel = escapeHtml(entry.name);
            return (
                `<button type="button" class="city-visit-modal-btn" data-visit-gift-idx="${index}">` +
                `<span>${giftLabel}</span>` +
                `<span>x${count}</span>` +
                `</button>`
            );
        }).join('');

        const html = (
            `<div class="city-visit-modal-wrap">` +
            `<div class="city-visit-modal-desc">${escapeHtml(targetName)}님에게 보관함 아이템 1개를 선물하세요.</div>` +
            `<div class="city-visit-modal-list">${rowsHtml}</div>` +
            `</div>`
        );

        game.openCityActionModal('선물하기', html, {
            allowHtml: true,
            detail: ''
        });

        const msgEl = byId('city-action-msg');
        if (!msgEl) return;

        const buttons = Array.from(msgEl.querySelectorAll('[data-visit-gift-idx]'));
        if (buttons.length <= 0) return;

        let busy = false;
        const setBusy = (value) => {
            busy = value === true;
            buttons.forEach((btn) => {
                btn.disabled = busy;
            });
        };

        buttons.forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (busy) return;

                const idx = Math.floor(toNumber(btn.getAttribute('data-visit-gift-idx'), -1));
                if (idx < 0 || idx >= entries.length) return;

                const entry = entries[idx];
                setBusy(true);
                const result = await sendGiftEntry(ctx, entry);
                setBusy(false);

                if (!result || result.ok !== true) return;

                if (typeof game.closeCityActionModal === 'function') {
                    game.closeCityActionModal();
                }
                if (typeof ctx.onSuccess === 'function') {
                    ctx.onSuccess({ kind: 'gift', entry });
                }
            });
        });
    }

    function normalizeSignText(value) {
        const normalized = String(value || '').replace(/\s+/g, ' ').trim();
        return normalized.slice(0, SIGN_TEXT_MAX);
    }

    function resolveSignAnchors(grid, cols) {
        if (!Array.isArray(grid) || grid.length <= 0) return [];
        const anchors = [];
        for (let i = 0; i < grid.length; i += 1) {
            if (grid[i] !== 'hq') continue;
            anchors.push({
                x: i % cols,
                y: Math.floor(i / cols)
            });
        }
        return anchors;
    }

    function normalizeSignGrid(cityPayload) {
        const city = (cityPayload && typeof cityPayload === 'object') ? cityPayload : {};
        const rawGrid = Array.isArray(city.grid) ? city.grid : [];
        if (rawGrid.length <= 0) {
            return { grid: [], cols: 0, rows: 0, total: 0 };
        }

        let cols = Math.floor(toNumber(city.cols, 0));
        if (!Number.isFinite(cols) || cols <= 0) {
            cols = rawGrid.length >= 24 ? 24 : Math.max(1, Math.floor(Math.sqrt(rawGrid.length)));
        }

        let rows = Math.floor(toNumber(city.rows, 0));
        if (!Number.isFinite(rows) || rows <= 0) {
            rows = Math.max(1, Math.ceil(rawGrid.length / cols));
        }

        let total = cols * rows;
        if (total < rawGrid.length) {
            rows = Math.max(rows, Math.ceil(rawGrid.length / cols));
            total = cols * rows;
        }

        const grid = rawGrid.slice(0, total);
        while (grid.length < total) {
            grid.push(null);
        }

        return { grid, cols, rows, total };
    }

    function isSignPlacementTileEmpty(tileValue) {
        if (tileValue == null) return true;
        const normalized = String(tileValue).trim().toLowerCase();
        return normalized === '' || normalized === 'empty' || normalized === 'none' || normalized === 'null';
    }

    function chooseSignCellIndex(cityPayload, existingSigns) {
        const normalized = normalizeSignGrid(cityPayload);
        const grid = normalized.grid;
        const cols = normalized.cols;
        const rows = normalized.rows;
        const total = normalized.total;
        if (!Array.isArray(grid) || grid.length <= 0 || total <= 0 || cols <= 0 || rows <= 0) return -1;

        const occupied = new Set();
        (Array.isArray(existingSigns) ? existingSigns : []).forEach((entry) => {
            const idx = Math.floor(toNumber(entry?.targetCellIndex, -1));
            if (idx >= 0 && idx < total) occupied.add(idx);
        });

        const isEmptyTile = (idx) => {
            if (!Number.isInteger(idx) || idx < 0 || idx >= total) return false;
            return isSignPlacementTileEmpty(grid[idx]);
        };

        const inBounds = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
        const anchors = resolveSignAnchors(grid, cols);
        if (anchors.length <= 0) {
            anchors.push({ x: Math.floor(cols / 2), y: Math.floor(rows / 2) });
        }

        const seen = new Set();
        for (let a = 0; a < anchors.length; a += 1) {
            const anchor = anchors[a];
            for (let r = 1; r <= 6; r += 1) {
                for (let dy = -r; dy <= r; dy += 1) {
                    for (let dx = -r; dx <= r; dx += 1) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                        const x = anchor.x + dx;
                        const y = anchor.y + dy;
                        if (!inBounds(x, y)) continue;

                        const idx = (y * cols) + x;
                        if (seen.has(idx)) continue;
                        seen.add(idx);

                        if (!isEmptyTile(idx)) continue;
                        if (occupied.has(idx)) continue;
                        return idx;
                    }
                }
            }
        }

        const centerX = Math.floor(cols / 2);
        const centerY = Math.floor(rows / 2);
        const fallback = [];

        for (let idx = 0; idx < total; idx += 1) {
            if (!isEmptyTile(idx)) continue;
            if (occupied.has(idx)) continue;

            const x = idx % cols;
            const y = Math.floor(idx / cols);
            const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
            fallback.push({ idx, dist });
        }

        fallback.sort((a, b) => a.dist - b.dist);
        return fallback.length > 0 ? fallback[0].idx : -1;
    }

    function collectSignPlaceableIndexes(cityPayload, existingSigns) {
        const normalized = normalizeSignGrid(cityPayload);
        const grid = normalized.grid;
        const total = normalized.total;
        if (!Array.isArray(grid) || grid.length <= 0 || total <= 0) {
            return { normalized, indexes: [] };
        }

        const occupied = new Set();
        (Array.isArray(existingSigns) ? existingSigns : []).forEach((entry) => {
            const idx = Math.floor(toNumber(entry?.targetCellIndex, -1));
            if (idx >= 0 && idx < total) occupied.add(idx);
        });

        const indexes = [];
        for (let idx = 0; idx < total; idx += 1) {
            if (!isSignPlacementTileEmpty(grid[idx])) continue;
            if (occupied.has(idx)) continue;
            indexes.push(idx);
        }

        return { normalized, indexes };
    }

    async function fetchActiveSigns(targetUid) {
        const uid = String(targetUid || '').trim();
        if (!uid) return [];

        const db = getDb();
        if (!db) return [];

        try {
            const snap = await db.collection(INTERACTION_COLLECTION)
                .where('type', '==', 'sign')
                .where('toUid', '==', uid)
                .where('status', '==', 'active')
                .limit(MAX_SIGN_FETCH)
                .get();

            const entries = [];
            snap.docs.forEach((doc) => {
                const data = doc.data() || {};
                const text = normalizeSignText(data.text || '');
                const targetCellIndex = Math.floor(toNumber(data.targetCellIndex, -1));
                if (!text || targetCellIndex < 0) return;

                entries.push({
                    id: doc.id,
                    type: 'sign',
                    status: 'active',
                    toUid: String(data.toUid || ''),
                    fromUid: String(data.fromUid || ''),
                    fromName: String(data.fromName || '익명관').slice(0, 40),
                    text,
                    targetCellIndex,
                    createdAtMs: Math.max(0, tsToMs(data.createdAt) || toNumber(data.createdAtMs, 0))
                });
            });

            entries.sort((a, b) => {
                if (a.targetCellIndex !== b.targetCellIndex) return a.targetCellIndex - b.targetCellIndex;
                return a.createdAtMs - b.createdAtMs;
            });

            return entries;
        } catch (err) {
            console.warn('[CitySimVisitActions] fetchActiveSigns failed:', err);
            return [];
        }
    }

    async function resolveSignDraft(context, rawText) {
        const ctx = (context && typeof context === 'object') ? context : {};
        const targetUid = String(ctx.targetUid || '').trim();
        const targetName = String(ctx.targetName || '상대 지휘관');
        let cityPayload = (ctx.cityPayload && typeof ctx.cityPayload === 'object') ? ctx.cityPayload : null;

        const user = getAuthUser();
        const senderUid = (user && user.uid) ? String(user.uid) : '';
        const senderName = getCurrentDisplayName(user);
        const text = normalizeSignText(rawText);

        if (!user || !senderUid) {
            showToast('로그인 후 표지판을 설치할 수 있습니다.');
            return { ok: false, reason: 'unauthenticated', draft: null };
        }
        if (!targetUid) {
            showToast('대상 플레이어를 찾지 못했습니다.');
            return { ok: false, reason: 'missing_target', draft: null };
        }
        if (targetUid === senderUid) {
            showToast('자기 기지에는 표지판을 설치할 수 없습니다.');
            return { ok: false, reason: 'self_target', draft: null };
        }
        if (!text) {
            showToast('표지판 문구를 입력해주세요.');
            return { ok: false, reason: 'missing_text', draft: null };
        }

        const db = getDb();
        if (!db) {
            showToast('Firebase 연결을 확인해주세요.');
            return { ok: false, reason: 'db_unavailable', draft: null };
        }

        const hasLocalCityGrid = !!(cityPayload && Array.isArray(cityPayload.grid) && cityPayload.grid.length > 0);
        if (!hasLocalCityGrid && targetUid) {
            try {
                const remoteSnap = await db.collection(PUBLIC_BASE_COLLECTION).doc(targetUid).get();
                if (remoteSnap.exists) {
                    const remoteBase = remoteSnap.data() || {};
                    const remoteCity = (remoteBase.city && typeof remoteBase.city === 'object') ? remoteBase.city : null;
                    if (remoteCity && Array.isArray(remoteCity.grid) && remoteCity.grid.length > 0) {
                        cityPayload = remoteCity;
                    }
                }
            } catch (err) {
                console.warn('[CitySimVisitActions] createSignEntry fallback city fetch failed:', err);
            }
        }

        const existingSigns = await fetchActiveSigns(targetUid);
        const alreadyMine = existingSigns.some((entry) => String(entry.fromUid || '') === senderUid);
        if (alreadyMine) {
            showToast('이미 해당 기지에 내 표지판이 있습니다.');
            return { ok: false, reason: 'already_exists', draft: null };
        }

        return {
            ok: true,
            reason: '',
            draft: {
                db,
                targetUid,
                targetName: targetName.slice(0, 40),
                cityPayload,
                senderUid,
                senderName,
                text,
                existingSigns
            }
        };
    }

    async function prepareSignPlacement(context, rawText) {
        const resolved = await resolveSignDraft(context, rawText);
        if (!resolved || resolved.ok !== true || !resolved.draft) {
            return {
                ok: false,
                reason: String(resolved?.reason || 'invalid_state')
            };
        }

        const draft = resolved.draft;
        const placement = collectSignPlaceableIndexes(draft.cityPayload, draft.existingSigns);
        const availableCellIndexes = placement.indexes;
        if (!Array.isArray(availableCellIndexes) || availableCellIndexes.length <= 0) {
            showToast('표지판 설치 가능한 빈자리를 찾지 못했습니다.');
            return { ok: false, reason: 'no_slot' };
        }

        const suggestedCellIndex = chooseSignCellIndex(draft.cityPayload, draft.existingSigns);
        return {
            ok: true,
            reason: '',
            text: draft.text,
            targetUid: draft.targetUid,
            targetName: draft.targetName,
            cityPayload: draft.cityPayload,
            availableCellIndexes,
            suggestedCellIndex
        };
    }

    async function createSignEntry(context, rawText, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const resolved = await resolveSignDraft(context, rawText);
        if (!resolved || resolved.ok !== true || !resolved.draft) {
            return {
                ok: false,
                reason: String(resolved?.reason || 'invalid_state')
            };
        }

        const draft = resolved.draft;
        const requestedIndex = Math.floor(toNumber(opts.targetCellIndex, -1));
        let targetCellIndex = -1;
        const skipSlotValidation = opts.skipSlotValidation === true;

        if (requestedIndex >= 0) {
            if (!skipSlotValidation) {
                const placement = collectSignPlaceableIndexes(draft.cityPayload, draft.existingSigns);
                const allowed = new Set(placement.indexes);
                if (!allowed.has(requestedIndex)) {
                    showToast('해당 위치에는 표지판을 설치할 수 없습니다.');
                    return { ok: false, reason: 'invalid_slot' };
                }
            }
            targetCellIndex = requestedIndex;
        } else {
            targetCellIndex = chooseSignCellIndex(draft.cityPayload, draft.existingSigns);
            if (targetCellIndex < 0) {
                showToast('표지판 설치 가능한 빈자리를 찾지 못했습니다.');
                return { ok: false, reason: 'no_slot' };
            }
        }

        const payload = {
            type: 'sign',
            status: 'active',
            toUid: draft.targetUid,
            toName: draft.targetName,
            fromUid: draft.senderUid,
            fromName: draft.senderName,
            text: draft.text,
            targetCellIndex,
            createdAt: getServerTs(),
            createdAtMs: Date.now(),
            updatedAt: getServerTs()
        };

        try {
            const docRef = await draft.db.collection(INTERACTION_COLLECTION).add(payload);
            showToast('표지판을 설치했습니다.');
            return {
                ok: true,
                entry: {
                    id: docRef.id,
                    ...payload
                }
            };
        } catch (err) {
            console.warn('[CitySimVisitActions] createSignEntry failed:', err);
            return {
                ok: false,
                reason: 'write_failed',
                errorCode: String(err?.code || '').trim(),
                errorMessage: String(err?.message || '').trim()
            };
        }
    }

    function openSignComposer(context) {
        const ctx = (context && typeof context === 'object') ? context : {};
        const game = ctx.game || getGameRef();
        const targetName = String(ctx.targetName || '상대 지휘관');
        const initialText = normalizeSignText(ctx.initialText || '');
        const submitLabel = String(ctx.submitLabel || '').trim() || '설치';
        const modalTitle = String(ctx.modalTitle || '').trim() || '표지판설치';

        if (!game || typeof game.openCityActionModal !== 'function') {
            showToast('표지판 입력 UI를 열 수 없습니다.');
            return;
        }

        const html = (
            `<div class="city-visit-modal-wrap">` +
            `<div class="city-visit-modal-desc">문구 입력 후 설치를 누르면 ${escapeHtml(targetName)}님 맵에서 설치할 칸을 직접 선택합니다.</div>` +
            `<textarea id="city-visit-sign-input" class="city-visit-textarea" maxlength="${SIGN_TEXT_MAX}" placeholder="표지판 문구를 입력하세요 (최대 ${SIGN_TEXT_MAX}자)"></textarea>` +
            `<div class="city-visit-modal-actions">` +
            `<button type="button" class="city-visit-modal-submit" data-visit-sign-submit>${escapeHtml(submitLabel)}</button>` +
            `</div>` +
            `</div>`
        );

        game.openCityActionModal(modalTitle, html, {
            allowHtml: true,
            detail: ''
        });

        const msgEl = byId('city-action-msg');
        if (!msgEl) return;

        const inputEl = msgEl.querySelector('#city-visit-sign-input');
        const submitBtn = msgEl.querySelector('[data-visit-sign-submit]');
        if (!inputEl || !submitBtn) return;
        if (initialText) inputEl.value = initialText;

        let busy = false;
        const submit = async () => {
            if (busy) return;

            busy = true;
            submitBtn.disabled = true;

            let result = null;
            const useManualPlacement = ctx.enableManualPlacement === true
                && typeof ctx.onRequestPlacement === 'function';

            if (useManualPlacement) {
                const plan = await prepareSignPlacement(ctx, inputEl.value);
                if (plan && plan.ok === true) {
                    result = {
                        ok: true,
                        mode: 'manual',
                        plan
                    };
                } else {
                    result = plan || { ok: false, reason: 'invalid_state' };
                }
            } else {
                result = await createSignEntry(ctx, inputEl.value);
            }

            busy = false;
            submitBtn.disabled = false;

            if (!result || result.ok !== true) return;

            if (typeof game.closeCityActionModal === 'function') game.closeCityActionModal();
            if (result.mode === 'manual') {
                try {
                    ctx.onRequestPlacement(result.plan || null);
                } catch (err) {
                    console.warn('[CitySimVisitActions] onRequestPlacement failed:', err);
                }
                return;
            }
            if (typeof ctx.onSuccess === 'function') {
                ctx.onSuccess(result.entry || null);
            }
        };

        submitBtn.addEventListener('click', submit);
        inputEl.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.keyCode === 13) && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
            }
        });

        try {
            inputEl.focus({ preventScroll: true });
        } catch (_) {
            try { inputEl.focus(); } catch (_) { }
        }
    }

    async function deleteSign(signId, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const silent = opts.silent === true;
        const id = String(signId || '').trim();
        if (!id) return { ok: false, reason: 'missing_sign_id' };

        const user = getAuthUser();
        const uid = (user && user.uid) ? String(user.uid) : '';
        if (!uid) {
            if (!silent) showToast('로그인 후 사용할 수 있습니다.');
            return { ok: false, reason: 'unauthenticated' };
        }

        const db = getDb();
        if (!db) {
            if (!silent) showToast('Firebase 연결을 확인해주세요.');
            return { ok: false, reason: 'db_unavailable' };
        }

        try {
            const ref = db.collection(INTERACTION_COLLECTION).doc(id);
            const snap = await ref.get();
            if (!snap.exists) {
                if (!silent) showToast('표지판을 찾을 수 없습니다.');
                return { ok: false, reason: 'not_found' };
            }

            const data = snap.data() || {};
            if (String(data.type || '') !== 'sign') {
                if (!silent) showToast('표지판 데이터가 아닙니다.');
                return { ok: false, reason: 'invalid_type' };
            }
            const toUid = String(data.toUid || '');
            const fromUid = String(data.fromUid || '');
            const isOwner = toUid === uid;
            const isInstaller = fromUid === uid;
            if (!isOwner && !isInstaller) {
                if (!silent) showToast('내가 설치했거나 내 기지의 표지판만 제거할 수 있습니다.');
                return { ok: false, reason: 'forbidden' };
            }
            if (String(data.status || '') !== 'active') {
                if (!silent) showToast('이미 제거된 표지판입니다.');
                return { ok: false, reason: 'already_removed' };
            }

            await ref.update({
                status: 'removed',
                removedAt: getServerTs(),
                removedBy: uid,
                updatedAt: getServerTs()
            });

            if (!silent) showToast('표지판을 제거했습니다.');
            return { ok: true };
        } catch (err) {
            console.warn('[CitySimVisitActions] deleteSign failed:', err);
            if (!silent) showToast('표지판 제거에 실패했습니다.');
            return { ok: false, reason: 'update_failed' };
        }
    }

    function parseGiftDoc(doc) {
        if (!doc || typeof doc.data !== 'function') return null;

        const data = doc.data() || {};
        if (String(data.type || '') !== 'gift') return null;
        if (String(data.status || '') !== 'active') return null;

        const giftKind = String(data.giftKind || data.itemKind || '').trim();
        const itemKey = String(data.itemKey || '').trim();
        const itemName = String(data.itemName || '').trim();
        const count = Math.max(1, Math.floor(toNumber(data.count, 1)));

        if (giftKind === GIFT_KIND_UNIT) {
            if (!itemKey) return null;
            return {
                id: doc.id,
                gift: {
                    kind: GIFT_KIND_UNIT,
                    itemKey,
                    name: itemName || getUnitDisplayName(itemKey),
                    count
                },
                fromName: String(data.fromName || '익명관').slice(0, 40)
            };
        }

        if (giftKind === GIFT_KIND_HONOR) {
            return {
                id: doc.id,
                gift: {
                    kind: GIFT_KIND_HONOR,
                    itemKey: 'honor_medal',
                    name: itemName || '명예훈장',
                    count
                },
                fromName: String(data.fromName || '익명관').slice(0, 40)
            };
        }

        return null;
    }

    async function syncIncomingGifts(game, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const silent = opts.silent === true;

        if (_giftSyncInFlight) return _giftSyncInFlight;

        const job = (async () => {
            const user = getAuthUser();
            const uid = (user && user.uid) ? String(user.uid) : '';
            if (!uid) return { ok: false, claimed: 0 };

            const db = getDb();
            if (!db) return { ok: false, claimed: 0 };

            let snap;
            try {
                snap = await db.collection(INTERACTION_COLLECTION)
                    .where('type', '==', 'gift')
                    .where('toUid', '==', uid)
                    .where('status', '==', 'active')
                    .limit(MAX_GIFT_FETCH)
                    .get();
            } catch (err) {
                console.warn('[CitySimVisitActions] syncIncomingGifts query failed:', err);
                return { ok: false, claimed: 0 };
            }

            const docs = Array.isArray(snap?.docs) ? snap.docs : [];
            if (docs.length <= 0) return { ok: true, claimed: 0 };

            const claimTargets = [];
            const summaryLines = [];
            const appliedGifts = [];
            let appliedAny = false;

            docs.forEach((doc) => {
                const parsed = parseGiftDoc(doc);
                if (!parsed) return;

                const gift = parsed.gift;
                const ok = applyGiftDelta(game, gift, gift.count);
                if (!ok) {
                    console.warn('[CitySimVisitActions] gift apply failed:', parsed.id, gift);
                    return;
                }

                appliedAny = true;
                appliedGifts.push(gift);
                claimTargets.push(doc.ref);
                summaryLines.push(`${parsed.fromName}: ${gift.name} x${formatNumber(gift.count)}`);
            });

            if (!appliedAny || claimTargets.length <= 0) {
                return { ok: true, claimed: 0 };
            }

            const saved = await persistCityState(game);
            if (!saved) {
                appliedGifts.forEach((gift) => {
                    applyGiftDelta(game, gift, -gift.count);
                });
                await persistCityState(game);
                syncGiftStateUi(game);
                console.warn('[CitySimVisitActions] syncIncomingGifts save failed after apply');
                return { ok: false, claimed: 0 };
            }
            syncGiftStateUi(game);

            await Promise.all(claimTargets.map((ref) => {
                return ref.update({
                    status: 'claimed',
                    claimedAt: getServerTs(),
                    claimedBy: uid,
                    updatedAt: getServerTs()
                }).catch((err) => {
                    console.warn('[CitySimVisitActions] gift claim update failed:', err);
                });
            }));

            if (!silent) {
                showToast('선물이 도착했습니다 확인해보세요');
                if (summaryLines.length > 0 && game && typeof game.openCityActionModal === 'function') {
                    const detail = summaryLines.slice(0, 8).join('\n');
                    game.openCityActionModal('선물 도착', '선물이 도착했습니다 확인해보세요', {
                        detail
                    });
                }
            }

            return {
                ok: true,
                claimed: claimTargets.length
            };
        })();

        _giftSyncInFlight = job.finally(() => {
            _giftSyncInFlight = null;
        });

        return _giftSyncInFlight;
    }

    global.CitySimVisitActions = {
        getGiftableEntries,
        openGiftComposer,
        fetchActiveSigns,
        prepareSignPlacement,
        createSignEntry,
        openSignComposer,
        deleteSign,
        syncIncomingGifts
    };
})(window);
