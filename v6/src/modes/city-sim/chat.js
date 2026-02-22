(function (global) {
    const PROFILE_COLLECTION = 'publicProfiles';
    const BASE_COLLECTION = 'publicBases';
    const CHAT_COLLECTION = 'globalChat';
    const CHAT_LIMIT = 80;
    const RANK_LIMIT = 50;
    const RANK_FETCH_LIMIT = 500;
    const RANK_ENTRY_MIN_LEVEL = 5;
    const RANK_ENTRY_MIN_POP = 10;
    const LEVEL_BADGE_BY_LEVEL = [
        null,
        'png/level.png/leftbar_level.1.png',
        'png/level.png/leftbar_level.2.png',
        'png/level.png/leftbar_level.3.png',
        'png/level.png/leftbar_level.4.png',
        'png/level.png/gold_level.5.png',
        'png/level.png/gold_level.6.png',
        'png/level.png/gold_level.7.png',
        'png/level.png/gold_level.8.png',
        'png/level.png/gold_gem_level.9.png',
        'png/level.png/gem_level.10.png',
        'png/level.png/gem_level.11.png',
        'png/level.png/gem_level.12.png',
        'png/level.png/flower_level.13.png',
        'png/level.png/flower_level.14.png',
        'png/level.png/flower_level.15.png',
        'png/level.png/star_level.16.png',
        'png/level.png/star_level.17.png',
        'png/level.png/star_level.18.png',
        'png/level.png/star_level.19.png'
    ];

    let _game = null;
    let _activeTab = 'chat';
    let _currentUid = '';
    let _myProfile = null;

    let _chatMessages = [];
    let _ranking = [];

    let _unsubChat = null;
    let _unsubRanking = null;
    let _presenceTimer = null;
    let _chatReadFailed = false;
    let _chatFallbackTried = false;
    let _chatReadErrorCode = '';
    let _permissionToastShown = false;

    function byId(id) {
        return document.getElementById(id);
    }

    function showToast(msg) {
        if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            ui.showToast(msg);
        }
    }

    function getErrorCode(err) {
        return String((err && err.code) || '').trim();
    }

    function logPermissionDenied(feature, err) {
        if (getErrorCode(err) !== 'permission-denied') return;
        const fb = global.RECLAIM_FB;
        const status = (fb && typeof fb.getStatus === 'function') ? fb.getStatus() : null;
        console.error('[CitySimChat] Firestore permission denied.', {
            feature: String(feature || 'unknown'),
            uid: getCurrentUid() || '',
            projectId: status && status.projectId ? status.projectId : null,
            configuredProjectId: status && status.configuredProjectId ? status.configuredProjectId : null,
            ready: !!(status && status.ready)
        });
        if (_permissionToastShown) return;
        _permissionToastShown = true;
        showToast('Firebase 권한 오류입니다. Firestore rules 배포/프로젝트를 확인해주세요.');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toNumber(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function formatNumber(value) {
        return Math.max(0, Math.floor(toNumber(value, 0))).toLocaleString();
    }

    function formatPopulation(pop, maxPop) {
        const now = Math.max(0, Math.floor(toNumber(pop, 0)));
        const cap = Math.max(now, Math.max(1, Math.floor(toNumber(maxPop, 1))));
        return `${now.toLocaleString()}/${cap.toLocaleString()}`;
    }

    function getLevelBadgePath(level) {
        const lv = Math.max(1, Math.min(19, Math.floor(toNumber(level, 1))));
        return LEVEL_BADGE_BY_LEVEL[lv] || LEVEL_BADGE_BY_LEVEL[1];
    }

    function isRankingEligibleLevel(level, pop) {
        const safeLevel = Math.max(1, Math.floor(toNumber(level, 1)));
        const safePop = Math.max(0, Math.floor(toNumber(pop, 0)));
        return safeLevel >= RANK_ENTRY_MIN_LEVEL && safePop >= RANK_ENTRY_MIN_POP;
    }

    function sortRankingRows(rows) {
        rows.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            if (b.money !== a.money) return b.money - a.money;
            if (b.gold !== a.gold) return b.gold - a.gold;
            if (b.pop !== a.pop) return b.pop - a.pop;
            return a.displayName.localeCompare(b.displayName);
        });
        return rows;
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

    function formatChatDateTime(value) {
        const ms = Math.max(0, Math.floor(toNumber(value, 0)));
        if (ms <= 0) return '';
        const date = new Date(ms);
        if (!Number.isFinite(date.getTime())) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d} ${hh}:${mm}`;
    }

    function initials(name) {
        const s = String(name || '').trim();
        if (!s) return '?';
        return s.charAt(0).toUpperCase();
    }

    function normalizeAvatarUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.length > 40000) return '';

        const lower = raw.toLowerCase();
        if (lower.startsWith('data:image/')) return raw;
        if (lower.startsWith('https://') || lower.startsWith('http://')) return raw;
        return '';
    }

    function getLocalAvatarUrl() {
        if (typeof ui === 'undefined' || !ui || typeof ui.getOptionProfileAvatar !== 'function') return '';
        try {
            return normalizeAvatarUrl(ui.getOptionProfileAvatar());
        } catch (_) {
            return '';
        }
    }

    function resolvePreferredAvatarUrl(user, currentProfile) {
        const localAvatar = getLocalAvatarUrl();
        const profileAvatar = normalizeAvatarUrl(currentProfile && currentProfile.avatarUrl);
        const userAvatar = normalizeAvatarUrl(user && user.photoURL);
        return localAvatar || profileAvatar || userAvatar || '';
    }

    function renderAvatarHtml(className, avatarUrl, displayName, altText) {
        const safeAvatar = normalizeAvatarUrl(avatarUrl);
        const fallback = initials(displayName);
        const cls = safeAvatar ? `${className} has-image` : className;
        if (safeAvatar) {
            return `<div class="${cls}"><img src="${escapeHtml(safeAvatar)}" alt="${escapeHtml(altText || 'avatar')}"></div>`;
        }
        return `<div class="${cls}">${escapeHtml(fallback)}</div>`;
    }

    function normalizeFriendCode(value) {
        return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    }

    function makeFriendCode(uid) {
        const core = String(uid || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
        return `RC-${core || '00000000'}`;
    }

    function getFirebaseBridge() {
        const fb = global.RECLAIM_FB;
        if (!fb || typeof fb !== 'object') return null;
        if (typeof fb.isReady === 'function' && !fb.isReady()) return null;
        return fb;
    }

    function getDb() {
        const fb = getFirebaseBridge();
        if (!fb || !fb.db) return null;
        return fb.db;
    }

    function getAuthUser() {
        if (typeof CitySimAuth !== 'undefined' && CitySimAuth && typeof CitySimAuth.getCurrentUser === 'function') {
            return CitySimAuth.getCurrentUser();
        }
        const fb = getFirebaseBridge();
        if (!fb || typeof fb.getUser !== 'function') return null;
        return fb.getUser();
    }

    function getAuthUid() {
        const user = getAuthUser();
        return (user && user.uid) ? String(user.uid) : '';
    }

    function getCurrentUid() {
        return getAuthUid() || _currentUid || '';
    }

    function isGuestSession() {
        if (typeof CitySimAuth !== 'undefined'
            && CitySimAuth
            && typeof CitySimAuth.isGuestSession === 'function') {
            try {
                return CitySimAuth.isGuestSession() === true;
            } catch (_) { }
        }
        return false;
    }

    function getGuestDisplayName(user, fallback) {
        const uid = String((user && user.uid) || '').trim();
        const tag = uid ? uid.slice(0, 6).toUpperCase() : 'USER';
        const base = String(fallback || '').trim();
        if (base && !base.includes('익명')) return base;
        return `게스트-${tag}`;
    }

    function isAnonymousAuthUser(user) {
        return !!(user && user.uid && user.isAnonymous === true);
    }

    function ensureAuthenticated(game, openLogin) {
        const user = getAuthUser();
        if (user && user.uid) return user;

        if (isGuestSession()
            && openLogin === true
            && typeof CitySimAuth !== 'undefined'
            && CitySimAuth
            && typeof CitySimAuth.startGuest === 'function') {
            showToast('게스트 커뮤니티 연결 중입니다. 잠시 후 다시 시도해주세요.');
            CitySimAuth.startGuest(game || _game || global.game || null);
            return null;
        }

        showToast('\ucee4\ubba4\ub2c8\ud2f0 \uae30\ub2a5\uc740 \ub85c\uadf8\uc778 \ud6c4 \uc774\uc6a9\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.');
        if (openLogin === true && typeof CitySimAuth !== 'undefined' && CitySimAuth && typeof CitySimAuth.loginAndEnter === 'function') {
            CitySimAuth.loginAndEnter(game || _game || global.game || null);
        }
        return null;
    }

    function getServerTs() {
        if (typeof firebase === 'undefined' || !firebase || !firebase.firestore || !firebase.firestore.FieldValue) {
            return Date.now();
        }
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    function readLocalCityPayload() {
        const key = (typeof CitySimSave !== 'undefined' && CitySimSave && CitySimSave.STORAGE_KEY)
            ? String(CitySimSave.STORAGE_KEY)
            : 'reclaim_citysim_v1';

        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
            return parsed;
        } catch (_) {
            return null;
        }
    }

    function collectStatsFromGame() {
        let level = 1;
        let honor = 0;
        let money = 0;
        let gold = 0;
        let pop = 0;
        let maxPop = 1;
        let kills = 0;

        const g = _game || global.game || null;
        if (g) {
            kills = Math.max(0, Math.floor(toNumber(g.killCount, 0)));
        }

        if (g && typeof CitySimState !== 'undefined' && CitySimState && typeof CitySimState.ensure === 'function') {
            const st = CitySimState.ensure(g) || {};
            const hud = st.hud || {};
            const res = st.res || {};
            level = Math.max(1, Math.floor(toNumber(hud.level, 1)));
            honor = Math.max(0, Math.floor(toNumber(hud.honor, 0)));
            money = Math.max(0, Math.floor(toNumber(res.money, 0)));
            gold = Math.max(0, Math.floor(toNumber(res.gold, 0)));
            maxPop = Math.max(1, Math.floor(toNumber(res.maxPop, 1)));
            pop = Math.max(0, Math.min(maxPop, Math.floor(toNumber(res.pop, 0))));
        }

        return { level, honor, money, gold, pop, maxPop, kills };
    }

    function buildBaseSummary(cityPayload) {
        const city = (cityPayload && typeof cityPayload === 'object') ? cityPayload : {};
        const grid = Array.isArray(city.grid) ? city.grid : [];
        const units = (city.units && typeof city.units === 'object') ? city.units : {};

        const buildingCount = grid.reduce((acc, tile) => {
            if (tile == null) return acc;
            return acc + 1;
        }, 0);

        const unitTotal = Object.keys(units).reduce((acc, key) => {
            return acc + Math.max(0, Math.floor(toNumber(units[key], 0)));
        }, 0);

        return {
            buildingCount,
            unitKinds: Object.keys(units).length,
            unitTotal,
            money: Math.max(0, Math.floor(toNumber(city.res && city.res.money, 0))),
            honor: Math.max(0, Math.floor(toNumber(city.hud && city.hud.honor, 0))),
            level: Math.max(1, Math.floor(toNumber(city.hud && city.hud.level, 1)))
        };
    }

    function stopPresenceLoop() {
        if (_presenceTimer) {
            clearInterval(_presenceTimer);
            _presenceTimer = null;
        }
    }

    function clearSubscriptions() {
        if (_unsubChat) {
            _unsubChat();
            _unsubChat = null;
        }
        if (_unsubRanking) {
            _unsubRanking();
            _unsubRanking = null;
        }
    }

    async function touchPresence(uid) {
        const db = getDb();
        const safeUid = String(uid || '').trim();
        if (!db || !safeUid) return;
        const guestSession = isGuestSession();
        const payload = {
            lastActiveAt: getServerTs(),
            updatedAt: getServerTs()
        };
        if (guestSession) {
            const user = getAuthUser();
            const stats = collectStatsFromGame();
            payload.isGuest = true;
            payload.displayName = String(
                (_myProfile && _myProfile.displayName)
                || getGuestDisplayName(user, '')
                || '익명관'
            ).trim();
            payload.avatarUrl = normalizeAvatarUrl((_myProfile && _myProfile.avatarUrl) || '');
            payload.level = Math.max(1, Math.floor(toNumber(stats.level, _myProfile && _myProfile.level)));
            payload.honor = Math.max(0, Math.floor(toNumber(stats.honor, _myProfile && _myProfile.honor)));
            payload.money = Math.max(0, Math.floor(toNumber(stats.money, _myProfile && _myProfile.money)));
            payload.gold = Math.max(0, Math.floor(toNumber(stats.gold, _myProfile && _myProfile.gold)));
            payload.pop = Math.max(0, Math.floor(toNumber(stats.pop, _myProfile && _myProfile.pop)));
            payload.maxPop = Math.max(1, Math.floor(toNumber(stats.maxPop, _myProfile && _myProfile.maxPop)));
            payload.kills = Math.max(0, Math.floor(toNumber(stats.kills, _myProfile && _myProfile.kills)));
        }
        try {
            await db.collection(PROFILE_COLLECTION).doc(safeUid).set(payload, { merge: true });
        } catch (_) { }
    }

    function startPresenceLoop(uid) {
        stopPresenceLoop();
        if (!uid) return;

        touchPresence(uid);
        _presenceTimer = setInterval(() => {
            const currentUid = getAuthUid();
            if (!currentUid || currentUid !== uid) {
                stopPresenceLoop();
                return;
            }
            touchPresence(uid);
        }, 60000);
    }

    async function upsertMyPublicData(user) {
        if (!user || !user.uid) return null;

        const guestSession = isGuestSession();
        const db = getDb();
        const uid = String(user.uid);
        const profileRef = db ? db.collection(PROFILE_COLLECTION).doc(uid) : null;

        let currentProfile = null;
        if (profileRef) {
            try {
                const snap = await profileRef.get();
                currentProfile = snap.exists ? (snap.data() || {}) : null;
            } catch (_) {
                currentProfile = null;
            }
        }

        const stats = collectStatsFromGame();
        const displayName = String(
            (guestSession ? getGuestDisplayName(user, '') : '')
            || (user.displayName && user.displayName.trim())
            || (currentProfile && currentProfile.displayName)
            || (user.email ? String(user.email).split('@')[0] : '')
            || '\uc775\uba85\uad00'
        ).trim();

        const friendCode = normalizeFriendCode(
            (currentProfile && currentProfile.friendCode)
            || makeFriendCode(uid)
        );
        const avatarUrl = resolvePreferredAvatarUrl(user, currentProfile);

        _myProfile = {
            uid,
            displayName,
            friendCode,
            avatarUrl,
            role: String((currentProfile && currentProfile.role) || ''),
            authRole: String((currentProfile && currentProfile.authRole) || ''),
            permission: String((currentProfile && currentProfile.permission) || ''),
            isAdmin: !!(currentProfile && (currentProfile.isAdmin === true || currentProfile.admin === true || currentProfile.superAdmin === true)),
            level: stats.level,
            honor: stats.honor,
            money: stats.money,
            gold: stats.gold,
            pop: stats.pop,
            maxPop: stats.maxPop,
            kills: stats.kills,
            isGuest: guestSession
        };

        if (!profileRef) {
            return _myProfile;
        }

        const payload = {
            uid,
            displayName,
            friendCode,
            avatarUrl,
            level: stats.level,
            honor: stats.honor,
            money: stats.money,
            gold: stats.gold,
            pop: stats.pop,
            maxPop: stats.maxPop,
            kills: stats.kills,
            isGuest: guestSession,
            updatedAt: getServerTs(),
            lastActiveAt: getServerTs()
        };

        try {
            await profileRef.set(payload, { merge: true });
        } catch (err) {
            console.warn('[CitySimChat] profile upsert failed:', getErrorCode(err), err);
            logPermissionDenied('publicProfiles.upsert', err);
            return null;
        }

        const g = _game || global.game || null;
        if (!guestSession && g && typeof g.saveCitySimState === 'function') {
            try { g.saveCitySimState(); } catch (_) { }
        }

        const cityPayload = readLocalCityPayload();
        const baseSummary = buildBaseSummary(cityPayload);

        try {
            await db.collection(BASE_COLLECTION).doc(uid).set({
                uid,
                displayName,
                friendCode,
                avatarUrl,
                level: stats.level,
                honor: stats.honor,
                summary: baseSummary,
                city: cityPayload,
                isGuest: guestSession,
                updatedAt: getServerTs(),
                lastActiveAt: getServerTs()
            }, { merge: true });
        } catch (err) {
            console.warn('[CitySimChat] base snapshot upsert failed:', getErrorCode(err), err);
            logPermissionDenied('publicBases.upsert', err);
        }

        return _myProfile;
    }

    function mapChatSnapshotDocs(snap) {
        return snap.docs.map((doc) => {
            const d = doc.data() || {};
            return {
                id: doc.id,
                uid: String(d.uid || ''),
                sender: String(d.senderName || '\uc774\ub984\uc5c6\uc74c'),
                avatarUrl: normalizeAvatarUrl(d.avatarUrl),
                text: String(d.text || ''),
                createdAtMs: tsToMs(d.createdAt) || toNumber(d.createdAtMs, Date.now())
            };
        });
    }

    function applyChatMessages(next) {
        next.sort((a, b) => a.createdAtMs - b.createdAtMs);
        _chatMessages = next.slice(-CHAT_LIMIT);
        _chatReadFailed = false;
        _chatReadErrorCode = '';
        if (_activeTab === 'chat') _renderChat();
    }

    function pushLocalChatMessage(message) {
        if (!message) return;
        _chatMessages.push(message);
        _chatMessages.sort((a, b) => a.createdAtMs - b.createdAtMs);
        if (_chatMessages.length > CHAT_LIMIT) {
            _chatMessages = _chatMessages.slice(-CHAT_LIMIT);
        }
        if (_activeTab === 'chat') _renderChat();
    }

    function pushSystemChatMessage(text) {
        const line = String(text || '').trim();
        if (!line) return;
        pushLocalChatMessage({
            id: `system-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            uid: 'system',
            sender: 'SYSTEM',
            text: line.slice(0, 200),
            createdAtMs: Date.now()
        });
    }

    function normalizeCommandText(text) {
        return String(text || '').replace(/\s+/g, '').trim().toLowerCase();
    }

    function isMoneyMoneyCommand(text) {
        return normalizeCommandText(text) === '머니머니';
    }

    function isTempUnlockCommand(text) {
        return normalizeCommandText(text) === '해금해금';
    }

    function hasAdminPermission(user) {
        const profile = (_myProfile && typeof _myProfile === 'object') ? _myProfile : {};
        const role = String(
            profile.role
            || profile.authRole
            || profile.permission
            || ''
        ).trim().toLowerCase();
        const g = _game || global.game || null;

        let isLocalRuntime = false;
        try {
            const loc = global.location || null;
            const host = String((loc && loc.hostname) || '').toLowerCase();
            const protocol = String((loc && loc.protocol) || '').toLowerCase();
            isLocalRuntime = (protocol === 'file:' || host === 'localhost' || host === '127.0.0.1');
        } catch (_) {
            isLocalRuntime = false;
        }

        if (profile.isAdmin === true || profile.admin === true || profile.superAdmin === true) return true;
        if (role === 'admin' || role === 'owner' || role === 'gm') return true;
        if (!isLocalRuntime) return false;
        if (g && g.devUnlockAllMaps === true) return true;

        try {
            const uid = String((user && user.uid) || '').trim();
            const adminUid = String(localStorage.getItem('reclaim_admin_uid') || '').trim();
            const adminMode = String(localStorage.getItem('reclaim_admin_mode') || '').trim().toLowerCase();
            if (uid && adminUid && uid === adminUid) return true;
            if (adminMode === '1' || adminMode === 'true' || adminMode === 'on') return true;
        } catch (_) { }

        if (isLocalRuntime) return true;

        return false;
    }

    function applyMoneyMoneyCommand(user) {
        const g = _game || global.game || null;
        if (!g) {
            return { ok: false, message: '게임 상태를 찾지 못했습니다.' };
        }

        const reward = 10000;
        if (typeof CitySimState !== 'undefined' && CitySimState && typeof CitySimState.mutate === 'function') {
            CitySimState.mutate(g, (draft) => {
                if (!draft.res || typeof draft.res !== 'object') draft.res = {};
                const moneyNow = Math.max(0, Math.floor(toNumber(draft.res.money, 0)));
                draft.res.money = moneyNow + reward;
            });
        } else if (g.citySim && g.citySim.res && typeof g.citySim.res === 'object') {
            const moneyNow = Math.max(0, Math.floor(toNumber(g.citySim.res.money, 0)));
            g.citySim.res.money = moneyNow + reward;
        }

        if (typeof g.enableDevUnlockAllMaps === 'function') {
            g.enableDevUnlockAllMaps();
        } else {
            g.devUnlockAllMaps = true;
            if (typeof g.updateMapSelectLocks === 'function') g.updateMapSelectLocks();
        }

        if (!Array.isArray(g.clearedMaps)) g.clearedMaps = [];
        if (Array.isArray(g.mapOrder)) {
            g.mapOrder.forEach((mapId) => {
                if (!mapId) return;
                if (!g.clearedMaps.includes(mapId)) g.clearedMaps.push(mapId);
            });
            g.firstRunDone = true;
        }
        const unlockCampaignPack = (pack) => {
            if (!pack || !Array.isArray(pack.stages) || pack.stages.length <= 0) return;
            pack.stages.forEach((stage) => {
                if (!stage || typeof stage !== 'object') return;
                stage.status = 'cleared';
                const stars = Math.floor(Number(stage.stars) || 0);
                stage.stars = Math.max(1, Math.min(3, stars > 0 ? stars : 3));
            });
            const firstId = Math.floor(Number(pack.stages[0]?.id) || 0);
            if (firstId > 0) pack.selectedStageId = firstId;
        };
        unlockCampaignPack(g.campaignSkirmish);
        unlockCampaignPack(g.campaignOccupation);
        if (g.campaignSkirmish && Array.isArray(g.campaignSkirmish.stages)) {
            g.activeCampaignTab = 'skirmish';
            g.campaignStages = g.campaignSkirmish.stages;
            g.campaignSelectedStageId = g.campaignSkirmish.selectedStageId;
        }
        if (typeof g.ensureCampaignProgress === 'function') {
            try { g.ensureCampaignProgress(); } catch (_) { }
        }
        if (typeof g.updateCampaignTabLockUi === 'function') {
            try { g.updateCampaignTabLockUi(); } catch (_) { }
        }
        if (typeof g.renderCampaignMap === 'function') {
            try {
                const campaignScreen = document.getElementById('campaign-screen');
                if (campaignScreen && !campaignScreen.classList.contains('hidden')) {
                    g.renderCampaignMap();
                }
            } catch (_) { }
        }

        if (typeof CitySimEconomy !== 'undefined' && CitySimEconomy && typeof CitySimEconomy.renderResources === 'function') {
            CitySimEconomy.renderResources(g);
        } else if (typeof g.renderCityResources === 'function') {
            g.renderCityResources();
        }

        if (typeof g.saveCitySimState === 'function') {
            try { g.saveCitySimState(); } catch (_) { }
        }
        if (typeof app !== 'undefined' && app && typeof app.markDirty === 'function') {
            try { app.markDirty(); } catch (_) { }
        }
        if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
            try { app.saveNow(); } catch (_) { }
        }

        return { ok: true, message: '관리자 명령 실행: 모든 맵 해금 + 자금 10,000 지급 완료' };
    }

    function applyTemporaryUnlockCommand(user) {
        const g = _game || global.game || null;
        if (!g) {
            return { ok: false, message: '게임 상태를 찾지 못했습니다.' };
        }

        const uid = String((user && user.uid) || '').trim();
        if (!uid) {
            return { ok: false, message: '로그인 계정 정보를 확인할 수 없습니다.' };
        }

        const wasActive = (typeof g.isTemporaryAdminUnlockActive === 'function')
            ? g.isTemporaryAdminUnlockActive()
            : (String(g._tempAdminUnlockUid || '').trim() === uid);

        let activated = false;
        if (typeof g.enableTemporaryAdminUnlockForUid === 'function') {
            activated = g.enableTemporaryAdminUnlockForUid(uid) === true;
        } else {
            g._tempAdminUnlockUid = uid;
            if (typeof g.updateMapSelectLocks === 'function') g.updateMapSelectLocks();
            if (typeof g.updateCampaignTabLockUi === 'function') g.updateCampaignTabLockUi();
            activated = true;
        }

        const isActiveNow = (typeof g.isTemporaryAdminUnlockActive === 'function')
            ? g.isTemporaryAdminUnlockActive()
            : (String(g._tempAdminUnlockUid || '').trim() === uid);

        if (!activated || !isActiveNow) {
            return { ok: false, message: '임시 해금 활성화에 실패했습니다.' };
        }

        if (wasActive) {
            return { ok: true, message: '관리자 임시 해금이 이미 활성화되어 있습니다. (현재 계정 세션 한정 / 저장 안 됨)' };
        }
        return { ok: true, message: '관리자 임시 해금 활성화: 현재 계정에서만 모든 맵 해금 (저장 안 됨)' };
    }

    function ensureChatSubscription(uid) {
        const db = getDb();
        if (!db || !uid) return;
        if (_unsubChat) return;

        const bindSnapshot = (query, fallbackMode) => {
            _unsubChat = query.onSnapshot((snap) => {
                const next = mapChatSnapshotDocs(snap);
                applyChatMessages(next);
            }, (err) => {
                const code = getErrorCode(err);
                console.warn(
                    '[CitySimChat] chat subscription failed:',
                    fallbackMode ? '(fallback)' : '(primary)',
                    code,
                    err
                );
                _chatReadFailed = true;
                _chatReadErrorCode = code;
                logPermissionDenied('globalChat.read', err);

                if (!fallbackMode && !_chatFallbackTried) {
                    _chatFallbackTried = true;
                    try {
                        if (_unsubChat) _unsubChat();
                    } catch (_) { }
                    _unsubChat = null;
                    try {
                        bindSnapshot(
                            db.collection(CHAT_COLLECTION).limit(CHAT_LIMIT),
                            true
                        );
                        return;
                    } catch (fallbackErr) {
                        console.warn('[CitySimChat] chat fallback subscription setup failed:', fallbackErr);
                    }
                }

                if (_activeTab === 'chat') {
                    _renderLoading('\ucc44\ud305\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.');
                }
            });
        };

        _chatReadFailed = false;
        _chatFallbackTried = false;
        _chatReadErrorCode = '';

        try {
            bindSnapshot(
                db.collection(CHAT_COLLECTION)
                    .orderBy('createdAtMs', 'desc')
                    .limit(CHAT_LIMIT),
                false
            );
        } catch (err) {
            console.warn('[CitySimChat] chat subscription setup failed:', getErrorCode(err), err);
            _chatReadFailed = true;
            _chatReadErrorCode = getErrorCode(err);
            logPermissionDenied('globalChat.read.setup', err);
            try {
                bindSnapshot(db.collection(CHAT_COLLECTION).limit(CHAT_LIMIT), true);
            } catch (fallbackErr) {
                console.warn('[CitySimChat] chat fallback setup failed:', getErrorCode(fallbackErr), fallbackErr);
            }
        }
    }

    function ensureRankingSubscription() {
        const db = getDb();
        if (!db) return;
        if (_unsubRanking) return;

        const buildRankingRows = (docs) => {
            const nowMs = Date.now();
            const next = docs.map((doc) => {
                const d = doc.data() || {};
                const lastActiveAtMs = tsToMs(d.lastActiveAt || d.updatedAt);
                return {
                    uid: doc.id,
                    displayName: String(d.displayName || '\uc775\uba85\uad00'),
                    avatarUrl: normalizeAvatarUrl(d.avatarUrl),
                    level: Math.max(1, Math.floor(toNumber(d.level, 1))),
                    money: Math.max(0, Math.floor(toNumber(d.money, 0))),
                    gold: Math.max(0, Math.floor(toNumber(d.gold, 0))),
                    pop: Math.max(0, Math.floor(toNumber(d.pop, 0))),
                    maxPop: Math.max(1, Math.floor(toNumber(d.maxPop, 1))),
                    honor: Math.max(0, Math.floor(toNumber(d.honor, 0))),
                    kills: Math.max(0, Math.floor(toNumber(d.kills, 0))),
                    isGuest: d.isGuest === true,
                    lastActiveAt: d.lastActiveAt || null,
                    lastActiveAtMs
                };
            });
            const filtered = next.filter((row) => row.isGuest !== true && isRankingEligibleLevel(row.level, row.pop));

            const myUid = getCurrentUid();
            if (myUid && !filtered.some((row) => row.uid === myUid)) {
                const user = getAuthUser();
                const guestUser = isGuestSession() || isAnonymousAuthUser(user);
                const myLevel = Math.max(1, Math.floor(toNumber(_myProfile && _myProfile.level, 1)));
                const myPop = Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.pop, 0)));
                if (!guestUser && isRankingEligibleLevel(myLevel, myPop)) {
                    filtered.push({
                        uid: myUid,
                        displayName: String(
                            (_myProfile && _myProfile.displayName)
                            || (guestUser ? getGuestDisplayName(user, '') : '')
                            || (user && user.displayName)
                            || (user && user.email ? String(user.email).split('@')[0] : '')
                            || '\uc775\uba85\uad00'
                        ),
                        avatarUrl: normalizeAvatarUrl(_myProfile && _myProfile.avatarUrl),
                        level: myLevel,
                        money: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.money, 0))),
                        gold: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.gold, 0))),
                        pop: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.pop, 0))),
                        maxPop: Math.max(1, Math.floor(toNumber(_myProfile && _myProfile.maxPop, 1))),
                        honor: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.honor, 0))),
                        kills: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.kills, 0))),
                        isGuest: guestUser,
                        lastActiveAt: null,
                        lastActiveAtMs: nowMs
                    });
                }
            }

            return sortRankingRows(filtered).slice(0, RANK_LIMIT);
        };

        const bindRanking = (query, fallbackMode) => {
            _unsubRanking = query.onSnapshot((snap) => {
                _ranking = buildRankingRows(snap.docs || []);
                if (_activeTab === 'ranking') _renderRanking();
            }, (err) => {
                const code = getErrorCode(err);
                console.warn(
                    '[CitySimChat] ranking subscription failed:',
                    fallbackMode ? '(fallback)' : '(primary)',
                    code,
                    err
                );
                logPermissionDenied('publicProfiles.read', err);

                if (!fallbackMode) {
                    if (_unsubRanking) {
                        _unsubRanking();
                        _unsubRanking = null;
                    }
                    try {
                        bindRanking(
                            db.collection(PROFILE_COLLECTION).limit(RANK_FETCH_LIMIT),
                            true
                        );
                        return;
                    } catch (fallbackErr) {
                        console.warn('[CitySimChat] ranking fallback setup failed:', getErrorCode(fallbackErr), fallbackErr);
                    }
                }

                if (code === 'permission-denied') {
                    _ranking = [];
                    if (_activeTab === 'ranking') {
                        _renderLoading('권한 오류로 랭킹을 불러오지 못했습니다.');
                    }
                    return;
                }

                const myUid = getCurrentUid();
                if (myUid) {
                    const user = getAuthUser();
                    const guestUser = isGuestSession() || isAnonymousAuthUser(user);
                    const myLevel = Math.max(1, Math.floor(toNumber(_myProfile && _myProfile.level, 1)));
                    const myPop = Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.pop, 0)));
                    _ranking = (!guestUser && isRankingEligibleLevel(myLevel, myPop)) ? [{
                        uid: myUid,
                        displayName: String(
                            (_myProfile && _myProfile.displayName)
                            || (guestUser ? getGuestDisplayName(user, '') : '')
                            || (user && user.displayName)
                            || (user && user.email ? String(user.email).split('@')[0] : '')
                            || '\uc775\uba85\uad00'
                        ),
                        avatarUrl: normalizeAvatarUrl(_myProfile && _myProfile.avatarUrl),
                        level: myLevel,
                        money: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.money, 0))),
                        gold: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.gold, 0))),
                        pop: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.pop, 0))),
                        maxPop: Math.max(1, Math.floor(toNumber(_myProfile && _myProfile.maxPop, 1))),
                        honor: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.honor, 0))),
                        kills: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.kills, 0))),
                        isGuest: guestUser,
                        lastActiveAt: null,
                        lastActiveAtMs: Date.now()
                    }] : [];
                    if (_activeTab === 'ranking') {
                        _renderRanking();
                        return;
                    }
                }
                if (_activeTab === 'ranking') {
                    _renderLoading('\ub7ad\ud0b9\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.');
                }
            });
        };

        try {
            bindRanking(
                db.collection(PROFILE_COLLECTION)
                    .orderBy('level', 'desc')
                    .limit(RANK_FETCH_LIMIT),
                false
            );
        } catch (err) {
            console.warn('[CitySimChat] ranking subscription setup failed:', getErrorCode(err), err);
            logPermissionDenied('publicProfiles.read.setup', err);
        }
    }

    async function syncMyProfile(game) {
        const user = getAuthUser();
        if (!user || !user.uid) return null;

        _game = game || _game || global.game || null;
        _currentUid = String(user.uid || '');

        const profile = await upsertMyPublicData(user);

        // [FIX] 프로필 동기화 시 온라인 상태 추적 시작
        startPresenceLoop(_currentUid);

        if (_unsubRanking || _activeTab === 'ranking') {
            ensureRankingSubscription();
            if (_activeTab === 'ranking') _renderRanking();
        }
        return profile;
    }

    async function openFriends(game) {
        const user = ensureAuthenticated(game, true);
        if (!user) return;

        _game = game || null;
        _currentUid = String(user.uid || '');

        const el = byId('city-friends-screen');
        if (!el) return;

        el.classList.remove('hidden');
        _activeTab = 'chat';
        _syncTabs();
        _renderLoading('\ucee4\ubba4\ub2c8\ud2f0 \ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\ub294 \uc911...');

        await upsertMyPublicData(user);
        if (typeof CitySimVisitActions !== 'undefined'
            && CitySimVisitActions
            && typeof CitySimVisitActions.syncIncomingGifts === 'function') {
            try {
                await CitySimVisitActions.syncIncomingGifts(_game || game || null, { silent: false });
            } catch (_) { }
        }
        ensureChatSubscription(_currentUid);
        ensureRankingSubscription();
        startPresenceLoop(_currentUid);

        _renderContent();
    }

    function close() {
        const el = byId('city-friends-screen');
        if (el) el.classList.add('hidden');

        stopPresenceLoop();
        clearSubscriptions();

        _game = null;
        _currentUid = '';
        _myProfile = null;
        _chatReadFailed = false;
        _chatFallbackTried = false;
        _chatReadErrorCode = '';
        _permissionToastShown = false;
    }

    async function removeGuestRankingEntry(uid) {
        const targetUid = String(uid || getCurrentUid() || '').trim();
        if (!targetUid) return false;

        const db = getDb();
        if (!db) return false;

        const user = getAuthUser();
        const guestAuth = isGuestSession() || isAnonymousAuthUser(user) || !!(_myProfile && _myProfile.uid === targetUid && _myProfile.isGuest === true);
        if (!guestAuth) return false;

        const results = await Promise.allSettled([
            db.collection(PROFILE_COLLECTION).doc(targetUid).delete(),
            db.collection(BASE_COLLECTION).doc(targetUid).delete()
        ]);

        const removed = results.some((entry) => entry.status === 'fulfilled');
        if (removed) {
            _ranking = _ranking.filter((row) => row.uid !== targetUid);
            if (_myProfile && _myProfile.uid === targetUid) {
                _myProfile = null;
            }
            if (_activeTab === 'ranking') _renderRanking();
        }
        return removed;
    }

    function switchTab(tabId) {
        const valid = new Set(['chat', 'ranking']);
        if (!valid.has(tabId)) return;

        const user = ensureAuthenticated(_game, false);
        if (!user) {
            close();
            return;
        }

        _activeTab = tabId;
        _syncTabs();

        if (tabId === 'chat') {
            ensureChatSubscription(_currentUid);
        }
        if (tabId === 'ranking') {
            syncMyProfile(_game);
            ensureRankingSubscription();
        }

        _renderContent();
    }

    function _syncTabs() {
        const tabs = document.querySelectorAll('#city-friends-tabs .city-panel-tab');
        tabs.forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === _activeTab);
        });
    }

    function _renderLoading(text) {
        const container = byId('city-friends-content');
        if (!container) return;
        container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:2rem;font-size:0.9rem;">${escapeHtml(text || '\ub85c\ub529 \uc911...')}</div>`;
    }

    function _renderContent() {
        switch (_activeTab) {
            case 'chat':
                _renderChat();
                break;
            case 'ranking':
                _renderRanking();
                break;
            default:
                _renderChat();
                break;
        }
    }

    function _renderChat() {
        const container = byId('city-friends-content');
        if (!container) return;

        const myUid = getCurrentUid();
        let msgsHtml = '';

        if (_chatMessages.length === 0) {
            msgsHtml = '<div class="chat-msg system">\uc544\uc9c1 \uba54\uc2dc\uc9c0\uac00 \uc5c6\uc2b5\ub2c8\ub2e4. \uccab \uba54\uc2dc\uc9c0\ub97c \ubcf4\ub0b4\ubcf4\uc138\uc694.</div>';
        } else {
            for (let i = 0; i < _chatMessages.length; i += 1) {
                const msg = _chatMessages[i];
                const mine = !!(myUid && msg.uid === myUid);
                const timeText = formatChatDateTime(msg.createdAtMs);
                const timeHtml = timeText ? `<span class="chat-msg-time">${escapeHtml(timeText)}</span>` : '';
                if (msg.uid === 'system') {
                    msgsHtml += `<div class="chat-msg system">${timeHtml}<div class="chat-msg-text">${escapeHtml(msg.text)}</div></div>`;
                } else if (mine) {
                    const avatarHtml = renderAvatarHtml('chat-avatar', msg.avatarUrl, msg.sender, `${msg.sender} avatar`);
                    msgsHtml += `<div class="chat-msg mine"><div class="chat-msg-head mine">${timeHtml}${avatarHtml}</div><div class="chat-msg-text">${escapeHtml(msg.text)}</div></div>`;
                } else {
                    const avatarHtml = renderAvatarHtml('chat-avatar', msg.avatarUrl, msg.sender, `${msg.sender} avatar`);
                    msgsHtml += `<div class="chat-msg other"><div class="chat-msg-head">${avatarHtml}<div class="chat-msg-sender">${escapeHtml(msg.sender)}</div>${timeHtml}</div><div class="chat-msg-text">${escapeHtml(msg.text)}</div></div>`;
                }
            }
        }

        container.innerHTML = `
            <div class="chat-area">
                <div class="chat-messages" id="chat-messages-list">${msgsHtml}</div>
                <div class="chat-input-bar">
                    <input type="text" class="chat-input" id="chat-input-field"
                        maxlength="200"
                        placeholder="\uba54\uc2dc\uc9c0\ub97c \uc785\ub825\ud558\uc138\uc694..."
                        onkeydown="if(event.key==='Enter')CitySimChat.sendMessage()">
                    <button class="chat-send-btn" onclick="CitySimChat.sendMessage()">\uc804\uc1a1</button>
                </div>
            </div>`;

        const msgList = byId('chat-messages-list');
        if (msgList) msgList.scrollTop = msgList.scrollHeight;
    }

    async function sendMessage() {
        const user = ensureAuthenticated(_game, false);
        if (!user) return;

        const input = byId('chat-input-field');
        if (!input) return;

        const text = String(input.value || '').trim();
        if (!text) return;

        input.value = '';

        if (isMoneyMoneyCommand(text)) {
            const result = applyMoneyMoneyCommand(user);
            pushSystemChatMessage(result.message);
            showToast(result.message);
            touchPresence(String(user.uid));
            return;
        }

        if (isTempUnlockCommand(text)) {
            const result = applyTemporaryUnlockCommand(user);
            pushSystemChatMessage(result.message);
            showToast(result.message);
            touchPresence(String(user.uid));
            return;
        }

        const db = getDb();
        if (!db) {
            showToast('Firebase \uc5f0\uacb0\uc744 \ud655\uc778\ud574\uc8fc\uc138\uc694.');
            return;
        }

        const senderName = (_myProfile && _myProfile.displayName)
            ? _myProfile.displayName
            : (user.displayName || (user.email ? String(user.email).split('@')[0] : '\uc775\uba85\uad00'));
        const senderAvatar = normalizeAvatarUrl(
            (_myProfile && _myProfile.avatarUrl)
            || (user && user.photoURL)
            || getLocalAvatarUrl()
        );

        const localMessage = {
            id: `local-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            uid: String(user.uid),
            sender: String(senderName || '\uc775\uba85\uad00'),
            avatarUrl: senderAvatar,
            text: text.slice(0, 200),
            createdAtMs: Date.now()
        };

        try {
            await db.collection(CHAT_COLLECTION).add({
                uid: String(user.uid),
                senderName: String(senderName || '\uc775\uba85\uad00'),
                avatarUrl: senderAvatar,
                text: text.slice(0, 200),
                createdAt: getServerTs(),
                createdAtMs: Date.now()
            });

            // 읽기 구독이 막혀 있는 경우에는 전송 성공 메시지를 로컬로라도 즉시 표시한다.
            if (_chatReadFailed) {
                if (_chatReadErrorCode === 'permission-denied') {
                    pushSystemChatMessage('권한 문제로 채팅 목록을 읽지 못하는 상태입니다.');
                } else {
                    pushLocalChatMessage(localMessage);
                }
            }
            touchPresence(String(user.uid));
        } catch (err) {
            const code = getErrorCode(err);
            console.warn('[CitySimChat] sendMessage failed:', code, err);
            logPermissionDenied('globalChat.write', err);
            if (code !== 'permission-denied') {
                pushLocalChatMessage(localMessage);
            }
            showToast('\uba54\uc2dc\uc9c0 \uc804\uc1a1\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.');
        }
    }

    function _renderRanking() {
        const container = byId('city-friends-content');
        if (!container) return;

        let rowsHtml = '';
        const myUid = getCurrentUid();
        const rankingRows = _ranking.filter((row) => row && row.isGuest !== true && isRankingEligibleLevel(row.level, row.pop)).slice();

        if (myUid && !rankingRows.some((row) => row.uid === myUid)) {
            const user = getAuthUser();
            const guestUser = isGuestSession() || isAnonymousAuthUser(user);
            const myLevel = Math.max(1, Math.floor(toNumber(_myProfile && _myProfile.level, 1)));
            const myPop = Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.pop, 0)));
            if (!guestUser && isRankingEligibleLevel(myLevel, myPop)) {
                rankingRows.push({
                    uid: myUid,
                    displayName: String(
                        (_myProfile && _myProfile.displayName)
                        || (guestUser ? getGuestDisplayName(user, '') : '')
                        || (user && user.displayName)
                        || (user && user.email ? String(user.email).split('@')[0] : '')
                        || '\uc775\uba85\uad00'
                    ),
                    level: myLevel,
                    money: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.money, 0))),
                    gold: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.gold, 0))),
                    pop: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.pop, 0))),
                    maxPop: Math.max(1, Math.floor(toNumber(_myProfile && _myProfile.maxPop, 1))),
                    honor: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.honor, 0))),
                    kills: Math.max(0, Math.floor(toNumber(_myProfile && _myProfile.kills, 0))),
                    isGuest: guestUser,
                    lastActiveAt: null,
                    lastActiveAtMs: Date.now()
                });
            }
        }

        sortRankingRows(rankingRows);

        for (let i = 0; i < rankingRows.length; i += 1) {
            const r = rankingRows[i];
            const rank = i + 1;
            const trClass = (r.uid === myUid) ? 'me' : '';
            const meLabel = (r.uid === myUid) ? ' (\ub098)' : '';
            const guestBadge = (r.isGuest === true) ? '<span class="ranking-user-badge guest">게스트</span>' : '';
            const visitBtn = (r.uid && r.uid !== myUid)
                ? `<button type="button" class="ranking-visit-btn" data-uid="${escapeHtml(r.uid)}" onclick="CitySimChat.visitBase(this.dataset.uid)">\ubc29\ubb38</button>`
                : '<span class="ranking-visit-muted">-</span>';

            rowsHtml += `
                <tr class="${trClass}">
                    <td><span class="ranking-rank">${rank}</span></td>
                    <td><span class="ranking-name-wrap">${escapeHtml(r.displayName)}${meLabel}${guestBadge}</span></td>
                    <td><span class="ranking-level-wrap"><img class="ranking-level-badge" src="${escapeHtml(getLevelBadgePath(r.level))}" alt="레벨 ${formatNumber(r.level)} 계급장">Lv.${formatNumber(r.level)}</span></td>
                    <td>${formatNumber(r.money)}</td>
                    <td>${formatNumber(r.gold)}</td>
                    <td>${formatPopulation(r.pop, r.maxPop)}</td>
                    <td>${visitBtn}</td>
                </tr>`;
        }

        if (!rowsHtml) {
            rowsHtml = `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:1.8rem;">레벨 ${RANK_ENTRY_MIN_LEVEL} · 인구 ${RANK_ENTRY_MIN_POP} 이상 랭킹 데이터가 없습니다.</td></tr>`;
        }

        container.innerHTML = `
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th>\uc21c\uc704</th>
                        <th>\uc774\ub984</th>
                        <th>\ub808\ubca8</th>
                        <th>\ud604\uae08</th>
                        <th>\uae08</th>
                        <th>\uc778\uad6c</th>
                        <th>\ubc29\ubb38</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>`;
    }

    function visitSummaryHtml(name, profile, base) {
        const summary = (base && typeof base.summary === 'object') ? base.summary : buildBaseSummary(base && base.city);
        const level = Math.max(1, Math.floor(toNumber(summary.level, profile && profile.level)));
        const honor = Math.max(0, Math.floor(toNumber(summary.honor, profile && profile.honor)));

        return `
            <div style="line-height:1.6;font-size:0.92rem;color:#e2e8f0;">
                <div><strong>${escapeHtml(name)}</strong> \uae30\uc9c0 \uc815\ubcf4</div>
                <div>\ub808\ubca8: <strong>${formatNumber(level)}</strong></div>
                <div>\uba85\uc608\ud6c8\uc7a5: <strong>${formatNumber(honor)}</strong></div>
                <div>\ub3c8: <strong>${formatNumber(summary.money)}</strong></div>
                <div>\uac74\ubb3c \uc218: <strong>${formatNumber(summary.buildingCount)}</strong></div>
                <div>\ubcf4\uc720 \uc720\ub2db: <strong>${formatNumber(summary.unitTotal)}</strong> (\uc885\ub958 ${formatNumber(summary.unitKinds)})</div>
                <div style="margin-top:0.5rem;color:#94a3b8;">\ubcf4\ud638\ub97c \uc704\ud574 \uc694\uc57d \uc815\ubcf4\ub9cc \ud45c\uc2dc\ub429\ub2c8\ub2e4.</div>
            </div>`;
    }

    async function visitBase(targetUid) {
        const user = ensureAuthenticated(_game, false);
        if (!user || !targetUid) return;

        const db = getDb();
        if (!db) {
            showToast('Firebase \uc5f0\uacb0\uc744 \ud655\uc778\ud574\uc8fc\uc138\uc694.');
            return;
        }

        const visitUid = String(targetUid);
        const p = _ranking.find((row) => row.uid === visitUid)
            || ((_myProfile && _myProfile.uid === visitUid) ? _myProfile : {})
            || {};
        const name = String(p.displayName || '\uc775\uba85\uad00');

        try {
            const snap = await db.collection(BASE_COLLECTION).doc(visitUid).get();
            if (!snap.exists) {
                showToast(`${name}\ub2d8\uc758 \uacf5\uac1c \uae30\uc9c0 \uc815\ubcf4\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.`);
                return;
            }

            const base = snap.data() || {};
            const ownerName = String(base.displayName || name || '\uc775\uba85\uad00');

            // [NEW] 맵 렌더링 뷰어 사용
            if (typeof CitySimVisitRenderer !== 'undefined' && CitySimVisitRenderer && typeof CitySimVisitRenderer.renderVisitorBase === 'function') {
                CitySimVisitRenderer.renderVisitorBase(visitUid, base);
            } else {
                // Fallback: 기존 텍스트 요약
                const html = visitSummaryHtml(ownerName, p, base);
                if (_game && typeof _game.openCityActionModal === 'function') {
                    _game.openCityActionModal(`${ownerName} \uae30\uc9c0 \ubc29\ubb38`, html, {
                        allowHtml: true,
                        detail: ''
                    });
                } else {
                    showToast(`${ownerName}\ub2d8\uc758 \uae30\uc9c0 \uc815\ubcf4\ub97c \ubd88\ub7ec\uc654\uc2b5\ub2c8\ub2e4.`);
                }
            }

            touchPresence(String(user.uid));
        } catch (err) {
            console.warn('[CitySimChat] visitBase failed:', err);
            showToast('\ubc29\ubb38 \uc815\ubcf4\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.');
        }
    }

    async function updateMyAvatar(avatarUrl) {
        const user = getAuthUser();
        if (!user || !user.uid) return false;

        const safeAvatar = normalizeAvatarUrl(avatarUrl);
        const db = getDb();
        const uid = String(user.uid);
        const nowTs = getServerTs();

        if (!_myProfile || _myProfile.uid !== uid) {
            _myProfile = {
                uid,
                displayName: String(user.displayName || (user.email ? String(user.email).split('@')[0] : '\uc775\uba85\uad00'))
            };
        }
        _myProfile.avatarUrl = safeAvatar;

        if (isGuestSession()) return true;

        if (!db) return true;

        try {
            await db.collection(PROFILE_COLLECTION).doc(uid).set({
                avatarUrl: safeAvatar,
                updatedAt: nowTs,
                lastActiveAt: nowTs
            }, { merge: true });

            await db.collection(BASE_COLLECTION).doc(uid).set({
                avatarUrl: safeAvatar,
                updatedAt: nowTs,
                lastActiveAt: nowTs
            }, { merge: true });
        } catch (err) {
            console.warn('[CitySimChat] updateMyAvatar failed:', getErrorCode(err), err);
            logPermissionDenied('publicProfiles.avatar.update', err);
            return false;
        }

        if (_activeTab === 'chat') _renderChat();
        if (_activeTab === 'ranking') _renderRanking();
        return true;
    }

    global.CitySimChat = {
        openFriends,
        close,
        switchTab,
        sendMessage,
        syncMyProfile,
        updateMyAvatar,
        visitBase,
        removeGuestRankingEntry
    };
})(window);
