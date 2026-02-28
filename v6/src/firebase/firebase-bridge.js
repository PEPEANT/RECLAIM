(function (global) {
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyDDh5Fw0STfKJeenha2Js6o4pdzkWFM6lI",
        authDomain: "reclaim-4c4af.firebaseapp.com",
        projectId: "reclaim-4c4af",
        storageBucket: "reclaim-4c4af.firebasestorage.app",
        messagingSenderId: "94560630503",
        appId: "1:94560630503:web:1322a777debf7bedcb5442",
        measurementId: "G-ESDZ3REQCY"
    };

    const MAIN_LOCAL_KEY = 'CT_STATE_V1';
    const CITY_LOCAL_KEY = 'reclaim_citysim_v1';
    const LOCAL_OWNER_SUFFIX = '__owner_uid';
    const migratedLocks = {};
    const cacheMain = {};
    const cacheCity = {};

    let auth = null;
    let db = null;
    let ready = false;
    let initAttempts = 0;
    let initTimer = null;
    let missingSdkLogged = false;
    const deferredAuthListeners = [];
    const INIT_RETRY_MS = 250;
    const INIT_MAX_ATTEMPTS = 40;

    function cloneData(value) {
        if (!value || typeof value !== 'object') return null;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return null;
        }
    }

    function readLocalJson(key) {
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

    function ownerKeyFor(localKey) {
        return `${String(localKey || '').trim()}${LOCAL_OWNER_SUFFIX}`;
    }

    function readLocalOwner(localKey) {
        const ownerKey = ownerKeyFor(localKey);
        if (!ownerKey || ownerKey === LOCAL_OWNER_SUFFIX) return null;
        try {
            const raw = localStorage.getItem(ownerKey);
            if (raw == null) return null;
            return String(raw).trim();
        } catch (_) {
            return null;
        }
    }

    function writeLocalOwner(localKey, uid) {
        const ownerKey = ownerKeyFor(localKey);
        if (!ownerKey || ownerKey === LOCAL_OWNER_SUFFIX) return;
        const nextUid = String(uid || '').trim();
        try {
            localStorage.setItem(ownerKey, nextUid);
        } catch (_) { }
    }

    function localKeyForKind(kind) {
        return kind === 'city' ? CITY_LOCAL_KEY : MAIN_LOCAL_KEY;
    }

    function writeLocalJson(key, payload, uid) {
        if (!payload || typeof payload !== 'object') return;
        try {
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (_) { }
        if (uid != null) {
            writeLocalOwner(key, uid);
        }
    }

    function setCache(type, uid, payload) {
        if (!uid || !payload || typeof payload !== 'object') return;
        const target = type === 'main' ? cacheMain : cacheCity;
        target[uid] = cloneData(payload);
    }

    function getCached(type, uid) {
        if (!uid) return null;
        const target = type === 'main' ? cacheMain : cacheCity;
        return cloneData(target[uid] || null);
    }

    function getDocRef(uid, kind) {
        if (!db || !uid) return null;
        return db.collection('users').doc(uid).collection('state').doc(kind);
    }

    function ensureReady() {
        if (!ready || !auth || !db) {
            scheduleFirebaseInit('ensureReady');
            throw new Error('Firebase is not initialized.');
        }
    }

    async function loadState(uid, kind) {
        ensureReady();
        const ref = getDocRef(uid, kind);
        if (!ref) return null;
        const snap = await ref.get();
        if (!snap.exists) return null;

        const data = snap.data();
        if (!data || typeof data !== 'object') return null;
        if (Object.prototype.hasOwnProperty.call(data, '_updatedAt')) {
            delete data._updatedAt;
        }
        setCache(kind, uid, data);
        return cloneData(data);
    }

    async function saveState(uid, kind, payload) {
        ensureReady();
        if (!uid || !payload || typeof payload !== 'object') return;
        const ref = getDocRef(uid, kind);
        if (!ref) return;

        const next = cloneData(payload) || {};
        next._updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        await ref.set(next, { merge: false });

        if (Object.prototype.hasOwnProperty.call(next, '_updatedAt')) {
            delete next._updatedAt;
        }
        setCache(kind, uid, next);
    }

    async function migrateType(uid, kind, localKey, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const seedFromLocal = opts.seedFromLocal === true;
        const remoteData = await loadState(uid, kind);
        if (remoteData) {
            writeLocalJson(localKey, remoteData, uid);
            return { source: 'remote', data: remoteData };
        }

        const localOwner = readLocalOwner(localKey);
        const localOwnedByUid = !!localOwner && localOwner === uid;

        if (seedFromLocal && localOwnedByUid) {
            const localData = readLocalJson(localKey);
            if (localData) {
                await saveState(uid, kind, localData);
                writeLocalOwner(localKey, uid);
                return { source: 'local', data: localData };
            }
        }

        // 계정 분리 보장: 원격 데이터가 없으면 캐시에 빈 상태를 고정해
        // 로컬(다른 계정) 데이터로의 폴백을 막는다.
        setCache(kind, uid, {});
        return { source: 'empty', data: {} };
    }

    async function migrateOnce(uid, options) {
        ensureReady();
        if (!uid) return { main: null, city: null };
        if (migratedLocks[uid]) return migratedLocks[uid];

        const task = (async () => {
            const main = await migrateType(uid, 'main', MAIN_LOCAL_KEY, options);
            const city = await migrateType(uid, 'city', CITY_LOCAL_KEY, options);
            return { main, city };
        })();

        migratedLocks[uid] = task;
        try {
            return await task;
        } finally {
            delete migratedLocks[uid];
        }
    }

    function getUser() {
        if (!auth) return null;
        return auth.currentUser || null;
    }

    function onAuth(cb) {
        if (typeof cb !== 'function') {
            return function noop() { };
        }
        if (auth) {
            return auth.onAuthStateChanged((user) => cb(user || null));
        }

        cb(null);
        const entry = { cb, unsub: null };
        deferredAuthListeners.push(entry);
        scheduleFirebaseInit('onAuth');

        return function unsubscribeDeferredAuth() {
            const idx = deferredAuthListeners.indexOf(entry);
            if (idx >= 0) deferredAuthListeners.splice(idx, 1);
            if (typeof entry.unsub === 'function') {
                try { entry.unsub(); } catch (_) { }
            }
            entry.unsub = null;
        };
    }

    async function emailSignUp(email, password, displayName) {
        ensureReady();
        const cred = await auth.createUserWithEmailAndPassword(String(email || '').trim(), String(password || ''));
        const user = cred && cred.user ? cred.user : null;
        if (user && displayName) {
            try {
                await user.updateProfile({ displayName: String(displayName).trim() });
            } catch (_) { }
        }
        if (user) {
            await user.sendEmailVerification();
        }
        await auth.signOut();
        return cred;
    }

    async function emailSignIn(email, password) {
        ensureReady();
        return auth.signInWithEmailAndPassword(String(email || '').trim(), String(password || ''));
    }

    async function googleSignIn() {
        ensureReady();

        // file:// 프로토콜 감지
        if (global.location && global.location.protocol === 'file:') {
            throw { code: 'auth/operation-not-supported-in-this-environment', message: 'file:// 프로토콜에서는 Google 로그인이 불가능합니다. localhost 서버로 실행해주세요.' };
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
            return await auth.signInWithPopup(provider);
        } catch (popupErr) {
            const code = String(popupErr && popupErr.code || '');
            console.warn('[FirebaseBridge] signInWithPopup failed:', code, popupErr);

            // 팝업 차단/환경 미지원 시 리다이렉트로 폴백
            if (code === 'auth/popup-blocked' ||
                code === 'auth/popup-closed-by-user' ||
                code === 'auth/operation-not-supported-in-this-environment') {
                console.log('[FirebaseBridge] Falling back to signInWithRedirect');
                return auth.signInWithRedirect(provider);
            }
            throw popupErr;
        }
    }

    async function anonymousSignIn() {
        ensureReady();
        if (!auth || typeof auth.signInAnonymously !== 'function') {
            throw new Error('Anonymous auth is not available.');
        }
        return auth.signInAnonymously();
    }

    async function handleRedirectResult() {
        if (!ready || !auth) return null;
        try {
            const result = await auth.getRedirectResult();
            return result;
        } catch (err) {
            console.warn('[FirebaseBridge] getRedirectResult error:', err);
            return null;
        }
    }

    async function signOut() {
        ensureReady();
        return auth.signOut();
    }

    function getSdkStatus() {
        const hasFirebase = typeof firebase !== 'undefined' && !!firebase;
        const hasAppsArray = hasFirebase && Array.isArray(firebase.apps);
        const hasInitializeApp = hasFirebase && typeof firebase.initializeApp === 'function';
        const hasAuth = hasFirebase && typeof firebase.auth === 'function';
        const hasFirestore = hasFirebase && typeof firebase.firestore === 'function';
        return {
            hasFirebase,
            hasAppsArray,
            hasInitializeApp,
            hasAuth,
            hasFirestore
        };
    }

    function getBridgeStatus() {
        const sdk = getSdkStatus();
        const apps = (sdk.hasAppsArray && firebase.apps) ? firebase.apps : [];
        const firstApp = Array.isArray(apps) && apps.length > 0 ? apps[0] : null;
        const projectId = firstApp && firstApp.options ? firstApp.options.projectId : null;
        return {
            ready: ready === true,
            attempts: initAttempts,
            configuredProjectId: FIREBASE_CONFIG.projectId,
            projectId: projectId || null,
            appCount: Array.isArray(apps) ? apps.length : 0,
            protocol: (global.location && global.location.protocol) ? String(global.location.protocol) : 'unknown',
            sdk
        };
    }

    function bindDeferredAuthListeners() {
        if (!auth) return;
        for (let i = 0; i < deferredAuthListeners.length; i += 1) {
            const entry = deferredAuthListeners[i];
            if (!entry || typeof entry.cb !== 'function') continue;
            if (typeof entry.unsub === 'function') continue;
            try {
                entry.unsub = auth.onAuthStateChanged((user) => entry.cb(user || null));
            } catch (_) {
                entry.unsub = null;
            }
        }
    }

    function initFirebaseAttempt(reason) {
        initAttempts += 1;
        const sdk = getSdkStatus();
        const reasonText = String(reason || 'unknown');

        if (!sdk.hasFirebase || !sdk.hasAppsArray || !sdk.hasInitializeApp || !sdk.hasAuth || !sdk.hasFirestore) {
            if (!missingSdkLogged || (initAttempts % 5) === 0) {
                console.warn(
                    `[FirebaseBridge] Firebase SDK not ready (${initAttempts}/${INIT_MAX_ATTEMPTS}, reason=${reasonText})`,
                    getBridgeStatus()
                );
            }
            missingSdkLogged = true;
            return false;
        }

        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(FIREBASE_CONFIG);
                console.info('[FirebaseBridge] firebase.initializeApp() called', {
                    projectId: FIREBASE_CONFIG.projectId,
                    reason: reasonText
                });
            }

            const liveProjectId = firebase.apps[0] && firebase.apps[0].options
                ? firebase.apps[0].options.projectId
                : null;
            if (liveProjectId && liveProjectId !== FIREBASE_CONFIG.projectId) {
                console.error('[FirebaseBridge] Firebase project mismatch detected.', {
                    expected: FIREBASE_CONFIG.projectId,
                    actual: liveProjectId
                });
            }

            auth = firebase.auth();
            db = firebase.firestore();
            ready = !!auth && !!db;
            if (!ready) {
                throw new Error('auth/firestore initialization returned empty handles.');
            }

            missingSdkLogged = false;
            bindDeferredAuthListeners();
            console.info('[FirebaseBridge] Firebase initialized.', getBridgeStatus());
            return true;
        } catch (err) {
            ready = false;
            auth = null;
            db = null;
            console.error(
                `[FirebaseBridge] Initialization failed (${initAttempts}/${INIT_MAX_ATTEMPTS}, reason=${reasonText}).`,
                err,
                getBridgeStatus()
            );
            return false;
        }
    }

    function scheduleFirebaseInit(reason) {
        if (ready) return;
        if (initTimer) return;

        const reasonText = String(reason || 'unknown');
        const run = () => {
            initTimer = null;
            const ok = initFirebaseAttempt(reasonText);
            if (ok) return;

            if (initAttempts >= INIT_MAX_ATTEMPTS) {
                console.error(
                    `[FirebaseBridge] Initialization aborted after ${INIT_MAX_ATTEMPTS} attempts.`,
                    getBridgeStatus()
                );
                return;
            }

            initTimer = setTimeout(run, INIT_RETRY_MS);
        };
        run();
    }

    // Legacy compatibility entry point.
    function initFirebase() {
        scheduleFirebaseInit('legacy-init');
    }

    console.info('[FirebaseBridge] bootstrap start', {
        configuredProjectId: FIREBASE_CONFIG.projectId,
        protocol: (global.location && global.location.protocol) ? String(global.location.protocol) : 'unknown'
    });
    scheduleFirebaseInit('module-load');
    if (global && typeof global.addEventListener === 'function') {
        global.addEventListener('DOMContentLoaded', () => {
            if (!ready) scheduleFirebaseInit('dom-content-loaded');
        }, { once: true });
        global.addEventListener('load', () => {
            if (!ready) scheduleFirebaseInit('window-load');
        }, { once: true });
    }

    global.RECLAIM_FB = {
        get auth() { return auth; },
        get db() { return db; },
        isReady: function isReady() { return ready === true; },
        ensureInit: function ensureInit(reason) {
            scheduleFirebaseInit(reason || 'manual');
            return this.getStatus();
        },
        getStatus: function getStatus() {
            return getBridgeStatus();
        },
        getUser,
        onAuth,
        emailSignUp,
        emailSignIn,
        googleSignIn,
        anonymousSignIn,
        handleRedirectResult,
        signOut
    };

    global.RECLAIM_SAVE = {
        loadMain: function loadMain(uid) { return loadState(uid, 'main'); },
        saveMain: function saveMain(uid, data) { return saveState(uid, 'main', data); },
        loadCity: function loadCity(uid) { return loadState(uid, 'city'); },
        saveCity: function saveCity(uid, data) { return saveState(uid, 'city', data); },
        migrateOnce,
        isLocalOwnedBy: function isLocalOwnedBy(kind, uid) {
            const owner = readLocalOwner(localKeyForKind(kind));
            const targetUid = String(uid || '').trim();
            if (!targetUid) return owner === '';
            return owner === targetUid;
        },
        setLocalOwner: function setLocalOwner(kind, uid) {
            writeLocalOwner(localKeyForKind(kind), uid);
        },
        getCachedMain: function getCachedMain(uid) { return getCached('main', uid); },
        getCachedCity: function getCachedCity(uid) { return getCached('city', uid); }
    };
})(window);
