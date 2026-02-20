(function (global) {
    const AUTH_MODAL_IDS = ['auth-login-modal', 'auth-signup-modal', 'auth-google-modal', 'auth-verify-modal'];
    const VERIFY_DURATION_MS = 3 * 60 * 1000;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const ACCOUNT_STORAGE_KEY = 'reclaim_auth_accounts_v1';
    const LOGIN_DEBUG_KEY = 'reclaim_login_debug';

    let activeGame = null;
    let initialized = false;
    let lastSyncedUid = '';
    let lastLoginQuestGrantUid = '';
    let guestSessionActive = false;
    let authBusy = false;
    let syncInFlight = null;
    let syncInFlightUid = '';
    let syncTicket = 0;
    let authFlowToken = 0;
    let forceSignOutArmedUntil = 0;
    const FORCE_SIGNOUT_ARM_MS = 10 * 1000;

    // Google pre-login verification state
    let googleVerificationCode = '';
    let googleVerificationExpiresAt = 0;
    let pendingGoogleEmail = '';
    let verifyTimerHandle = null;

    // Signup inline verification state
    let signupVerificationCode = '';
    let signupVerificationExpiresAt = 0;
    let signupEmailVerified = false;
    let signupVerifiedEmail = '';

    function byId(id) {
        return document.getElementById(id);
    }

    function isLoginDebugEnabled() {
        if (global && global.__RECLAIM_LOGIN_DEBUG__ === true) return true;
        try {
            return localStorage.getItem(LOGIN_DEBUG_KEY) === '1';
        } catch (_) {
            return false;
        }
    }

    function getAuthDebugState() {
        return {
            guestSessionActive: guestSessionActive === true,
            authBusy: authBusy === true,
            authTransitioning: isAuthTransitioning(),
            lastSyncedUid: String(lastSyncedUid || ''),
            lastLoginQuestGrantUid: String(lastLoginQuestGrantUid || ''),
            hasSyncInFlight: !!syncInFlight,
            syncInFlightUid: String(syncInFlightUid || ''),
            syncTicket: Math.max(0, Math.floor(Number(syncTicket) || 0)),
            authFlowToken: Math.max(0, Math.floor(Number(authFlowToken) || 0)),
            forceSignOutArmed: isForceSignOutArmed()
        };
    }

    function isAuthTransitioning() {
        return authBusy === true || !!syncInFlight;
    }

    function beginAuthFlow(reason) {
        authFlowToken += 1;
        const token = Math.max(1, Math.floor(Number(authFlowToken) || 1));
        logLoginDebug('flow.begin', {
            reason: String(reason || '').trim() || 'unknown',
            flowToken: token,
            state: getAuthDebugState()
        });
        return token;
    }

    function isAuthFlowTokenCurrent(flowToken) {
        const token = Math.max(0, Math.floor(Number(flowToken) || 0));
        if (token <= 0) return true;
        return token === authFlowToken;
    }

    function isForceSignOutArmed() {
        return forceSignOutArmedUntil > Date.now();
    }

    function armForceSignOut() {
        forceSignOutArmedUntil = Date.now() + FORCE_SIGNOUT_ARM_MS;
        return forceSignOutArmedUntil;
    }

    function clearForceSignOutArm() {
        forceSignOutArmedUntil = 0;
    }

    function logLoginDebug(eventName, payload) {
        if (!isLoginDebugEnabled()) return;
        try {
            console.info('[LoginDebug][Auth]', String(eventName || ''), payload || {});
        } catch (_) { }
    }

    function showToast(msg) {
        if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
            ui.showToast(msg);
        }
    }

    function enterCity(game) {
        if (game && typeof game.enterCityScreen === 'function') {
            game.enterCityScreen();
            return true;
        }
        return false;
    }

    function closeModal(id) {
        const el = byId(id);
        if (!el) return;
        el.classList.add('hidden');
        clearModalFit(el);
    }

    function openModal(id) {
        const el = byId(id);
        if (!el) return;
        el.classList.remove('hidden');
        setTimeout(() => fitModalPanel(el), 0);
    }

    function closeAllModals() {
        AUTH_MODAL_IDS.forEach(closeModal);
    }

    function isAnyModalOpen() {
        for (let i = 0; i < AUTH_MODAL_IDS.length; i += 1) {
            const modal = byId(AUTH_MODAL_IDS[i]);
            if (modal && !modal.classList.contains('hidden')) return true;
        }
        return false;
    }

    function getViewportSize() {
        const vv = global.visualViewport || null;
        const width = Math.max(0, Math.floor((vv && Number(vv.width)) || global.innerWidth || document.documentElement.clientWidth || 0));
        const height = Math.max(0, Math.floor((vv && Number(vv.height)) || global.innerHeight || document.documentElement.clientHeight || 0));
        return { width, height };
    }

    function isNarrowMobileViewport() {
        const size = getViewportSize();
        return size.width > 0 && size.width <= 640;
    }

    function clearModalFit(modalEl) {
        if (!modalEl || !modalEl.querySelector) return;
        const panel = modalEl.querySelector('.auth-modal-panel');
        if (!panel) return;
        panel.classList.remove('auth-fit-enabled');
        panel.style.removeProperty('--auth-modal-scale');
    }

    function fitModalPanel(modalEl) {
        if (!modalEl || !modalEl.querySelector || modalEl.classList.contains('hidden')) return;
        const panel = modalEl.querySelector('.auth-modal-panel');
        if (!panel) return;

        clearModalFit(modalEl);
        if (!isNarrowMobileViewport()) return;

        const size = getViewportSize();
        const viewportHeight = size.height;
        if (!viewportHeight) return;

        const availableHeight = Math.max(260, viewportHeight - 12);
        const naturalHeight = Math.max(panel.scrollHeight, panel.offsetHeight);
        if (!naturalHeight) return;

        let scale = availableHeight / naturalHeight;
        scale = Math.min(1, scale);
        scale = Math.max(0.72, scale);

        panel.style.setProperty('--auth-modal-scale', scale.toFixed(3));
        panel.classList.add('auth-fit-enabled');
    }

    function fitOpenModalPanel() {
        for (let i = 0; i < AUTH_MODAL_IDS.length; i += 1) {
            const modal = byId(AUTH_MODAL_IDS[i]);
            if (!modal || modal.classList.contains('hidden')) continue;
            fitModalPanel(modal);
            return;
        }
    }

    function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isValidEmail(value) {
        return EMAIL_REGEX.test(value);
    }

    function normalizeId(value) {
        return String(value || '').trim();
    }

    function accountKey(idValue) {
        return normalizeId(idValue).toLowerCase();
    }

    function readAccounts() {
        try {
            const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
            return parsed;
        } catch (_) {
            return {};
        }
    }

    function writeAccounts(accounts) {
        try {
            localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts || {}));
        } catch (_) { }
    }

    function findAccount(idValue) {
        const key = accountKey(idValue);
        if (!key) return null;
        const accounts = readAccounts();
        return accounts[key] || null;
    }

    function saveAccount(idValue, passwordValue, emailValue) {
        const key = accountKey(idValue);
        if (!key) return;

        const accounts = readAccounts();
        accounts[key] = {
            id: normalizeId(idValue),
            password: String(passwordValue || ''),
            email: normalizeEmail(emailValue),
            createdAt: Date.now()
        };
        writeAccounts(accounts);
    }

    function getFirebaseBridge() {
        const fb = global.RECLAIM_FB;
        if (!fb || typeof fb !== 'object') return null;
        if (typeof fb.isReady === 'function' && !fb.isReady()) return null;
        return fb;
    }

    function getSaveBridge() {
        const save = global.RECLAIM_SAVE;
        if (!save || typeof save !== 'object') return null;
        return save;
    }

    function getCurrentUser() {
        const fb = getFirebaseBridge();
        if (!fb || typeof fb.getUser !== 'function') return null;
        return fb.getUser();
    }

    function setSignupFirebaseMode(enabled) {
        const sendBtn = byId('auth-signup-send-code');
        const verifyBtn = byId('auth-signup-verify-code');
        const codeInput = byId('auth-signup-code');
        const demoEl = byId('auth-signup-demo');
        const statusEl = byId('auth-signup-verify-status');

        if (sendBtn) sendBtn.style.display = enabled ? 'none' : '';
        if (verifyBtn) verifyBtn.style.display = enabled ? 'none' : '';
        if (codeInput && codeInput.closest) {
            const row = codeInput.closest('.auth-field');
            if (row) row.style.display = enabled ? 'none' : '';
        }

        if (enabled) {
            setSignupVerifyStatus('회원가입 시 Firebase 인증 메일이 발송됩니다.', '');
            if (demoEl) demoEl.textContent = '';
        } else {
            if (statusEl) statusEl.classList.add('hidden');
        }
    }

    function setGoogleFirebaseMode(enabled) {
        const input = byId('auth-google-email');
        if (!input) return;
        if (enabled) {
            input.placeholder = 'Google 팝업에서 계정을 선택하세요';
        } else {
            input.placeholder = 'yourname@gmail.com';
        }
    }

    function setFriendFabState(allowed) {
        const btn = byId('city-fab-friend');
        if (!btn) return;
        const canUse = allowed === true;
        btn.classList.toggle('opacity-60', !canUse);
        btn.classList.toggle('grayscale', !canUse);
        btn.setAttribute('aria-disabled', canUse ? 'false' : 'true');
        btn.dataset.authRequired = canUse ? '0' : '1';
    }

    function isAnonymousUser(user) {
        const u = user || null;
        return !!(u && u.uid && u.isAnonymous === true);
    }

    function updateSessionUi(user) {
        const statusEl = byId('auth-session-status');
        const signOutBtn = byId('auth-signout-btn');
        if (!statusEl || !signOutBtn) return;

        if (user && user.uid && isAnonymousUser(user)) {
            statusEl.textContent = `게스트 플레이 중 (uid:${String(user.uid).slice(0, 8)}, 랭킹 임시 반영)`;
            signOutBtn.classList.remove('hidden');
            setFriendFabState(true);
            return;
        }

        if (user && user.uid) {
            const label = user.email ? String(user.email) : `uid:${String(user.uid).slice(0, 8)}`;
            statusEl.textContent = `로그인됨: ${label}`;
            signOutBtn.classList.remove('hidden');
            setFriendFabState(true);
            return;
        }

        if (guestSessionActive) {
            statusEl.textContent = '게스트 플레이 중 (저장 안 됨, 랭킹 임시 반영)';
            signOutBtn.classList.add('hidden');
            setFriendFabState(true);
            return;
        }

        statusEl.textContent = '로그아웃 상태';
        signOutBtn.classList.add('hidden');
        setFriendFabState(false);
    }

    function mapAuthError(error, fallbackMsg) {
        const code = String(error && error.code ? error.code : '');
        if (code === 'auth/invalid-email') return '이메일 형식이 올바르지 않습니다.';
        if (code === 'auth/user-not-found') return '가입되지 않은 계정입니다.';
        if (code === 'auth/wrong-password') return '비밀번호가 일치하지 않습니다.';
        if (code === 'auth/invalid-credential') return '이메일 또는 비밀번호를 확인해주세요.';
        if (code === 'auth/email-already-in-use') return '이미 사용 중인 이메일입니다.';
        if (code === 'auth/weak-password') return '비밀번호는 6자 이상이어야 합니다.';
        if (code === 'auth/popup-closed-by-user') return 'Google 로그인 창이 닫혔습니다.';
        if (code === 'auth/popup-blocked') return '팝업이 차단되었습니다. 리다이렉트 방식으로 전환합니다...';
        if (code === 'auth/unauthorized-domain') return '이 도메인은 Firebase에 등록되지 않았습니다. Firebase Console → Authentication → Settings → Authorized domains에 추가해주세요.';
        if (code === 'auth/operation-not-supported-in-this-environment') return 'file:// 에서는 Google 로그인이 불가능합니다. localhost 서버로 실행해주세요.';
        if (code === 'auth/too-many-requests') return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        if (code === 'auth/network-request-failed') return '네트워크 연결을 확인해주세요.';
        return fallbackMsg || '로그인 처리 중 오류가 발생했습니다.';
    }

    function getProviderId(user) {
        const u = user || null;
        const list = (u && Array.isArray(u.providerData)) ? u.providerData : [];
        for (let i = 0; i < list.length; i += 1) {
            const pid = String(list[i] && list[i].providerId ? list[i].providerId : '').trim();
            if (pid) return pid;
        }
        return '';
    }

    function isGoogleSession(user) {
        const u = user || null;
        const list = (u && Array.isArray(u.providerData)) ? u.providerData : [];
        for (let i = 0; i < list.length; i += 1) {
            const pid = String(list[i] && list[i].providerId ? list[i].providerId : '').trim();
            if (pid === 'google.com') return true;
        }
        return false;
    }

    function getSwitchBlockedMessage(user, targetMode) {
        const providerId = getProviderId(user);
        const mode = String(targetMode || '').trim().toLowerCase();

        if (mode === 'google') {
            if (providerId === 'google.com') return '이미 구글 로그인 상태입니다. 먼저 로그아웃해주세요.';
            return '현재 로그인 상태입니다. 구글로그인을 다시 하려면 먼저 로그아웃해주세요.';
        }

        if (mode === 'guest') {
            if (isAnonymousUser(user)) return '이미 게스트 로그인 상태입니다.';
            return '게스트로그인을 하려면 먼저 로그아웃해주세요.';
        }

        return '다른 로그인으로 전환하려면 먼저 로그아웃해주세요.';
    }

    function ensureLoggedOutForNewLogin(errorId, targetMode) {
        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.uid) return true;
        if (String(targetMode || '').trim().toLowerCase() === 'guest' && isAnonymousUser(currentUser)) {
            return true;
        }
        const msg = getSwitchBlockedMessage(currentUser, targetMode);
        if (errorId) setError(errorId, msg);
        showToast(msg);
        return false;
    }

    async function syncCommunityProfile(gameRef) {
        if (typeof CitySimChat === 'undefined' || !CitySimChat) return;
        if (typeof CitySimChat.syncMyProfile !== 'function') return;
        try {
            await CitySimChat.syncMyProfile(gameRef || activeGame || global.game || null);
        } catch (err) {
            console.warn('[CitySimAuth] 커뮤니티 프로필 동기화 실패:', err);
        }
    }

    async function removeGuestRankingEntry(uid) {
        const targetUid = String(uid || '').trim();
        if (!targetUid) return false;
        if (typeof CitySimChat === 'undefined' || !CitySimChat) return false;
        if (typeof CitySimChat.removeGuestRankingEntry !== 'function') return false;
        try {
            return (await CitySimChat.removeGuestRankingEntry(targetUid)) === true;
        } catch (err) {
            console.warn('[CitySimAuth] 게스트 랭킹 정리 실패:', err);
            return false;
        }
    }

    async function syncCloudState(uid, gameRef, force, reason, flowToken) {
        const syncReason = String(reason || '').trim() || 'unknown';
        const syncFlowToken = Math.max(0, Math.floor(Number(flowToken) || 0));
        const isStaleFlow = () => (syncFlowToken > 0 && !isAuthFlowTokenCurrent(syncFlowToken));
        const logStaleFlowAndAbort = (phase) => {
            if (!isStaleFlow()) return false;
            logLoginDebug('sync.skip.stale_flow', {
                phase: String(phase || 'unknown'),
                force: force === true,
                reason: syncReason,
                flowToken: syncFlowToken,
                currentAuthFlowToken: Math.max(0, Math.floor(Number(authFlowToken) || 0)),
                state: getAuthDebugState()
            });
            return true;
        };
        if (logStaleFlowAndAbort('before_start')) return;
        if (!uid) {
            logLoginDebug('sync.skip.no_uid', {
                force: force === true,
                reason: syncReason,
                flowToken: syncFlowToken,
                state: getAuthDebugState()
            });
            return;
        }
        const liveUser = getCurrentUser();
        if (guestSessionActive === true || isAnonymousUser(liveUser)) {
            logLoginDebug('sync.skip.guest_or_anon', {
                uid: String(uid || ''),
                force: force === true,
                reason: syncReason,
                flowToken: syncFlowToken,
                state: getAuthDebugState()
            });
            return;
        }
        if (!force && lastSyncedUid === uid) {
            logLoginDebug('sync.skip.already_synced', {
                uid: String(uid || ''),
                force: force === true,
                reason: syncReason,
                flowToken: syncFlowToken,
                state: getAuthDebugState()
            });
            return;
        }
        if (syncInFlight && syncInFlightUid === uid) {
            logLoginDebug('sync.wait.inflight', {
                uid: String(uid || ''),
                force: force === true,
                reason: syncReason,
                flowToken: syncFlowToken,
                state: getAuthDebugState()
            });
            await syncInFlight;
            if (logStaleFlowAndAbort('after_wait')) return;
            logLoginDebug('sync.wait.inflight.done', {
                uid: String(uid || ''),
                force: force === true,
                reason: syncReason,
                flowToken: syncFlowToken,
                state: getAuthDebugState()
            });
            return;
        }

        const targetGame = gameRef || activeGame || global.game;
        const save = getSaveBridge();
        const ticket = ++syncTicket;
        logLoginDebug('sync.start', {
            uid: String(uid || ''),
            force: force === true,
            reason: syncReason,
            ticket,
            flowToken: syncFlowToken,
            state: getAuthDebugState()
        });
        const task = (async () => {
            const shouldAbortByTicketOrFlow = (phase) => {
                if (ticket !== syncTicket) return true;
                if (logStaleFlowAndAbort(phase)) return true;
                return false;
            };
            if (!save || typeof save.migrateOnce !== 'function') {
                if (shouldAbortByTicketOrFlow('no_save_bridge.before_profile_sync')) return;
                await syncCommunityProfile(targetGame);
                if (shouldAbortByTicketOrFlow('no_save_bridge.after_profile_sync')) return;
                lastSyncedUid = uid;
                logLoginDebug('sync.done.no_save_bridge', {
                    uid: String(uid || ''),
                    force: force === true,
                    reason: syncReason,
                    ticket,
                    flowToken: syncFlowToken,
                    state: getAuthDebugState()
                });
                return;
            }

            try {
                await save.migrateOnce(uid, { seedFromLocal: false });
                if (shouldAbortByTicketOrFlow('after_migrate')) return;
                if (typeof app !== 'undefined' && app && typeof app.loadIntoGame === 'function') {
                    app.loadIntoGame();
                }

                if (targetGame && typeof targetGame.loadCitySimState === 'function') {
                    targetGame.loadCitySimState();
                }
                if (targetGame && typeof targetGame.renderCityScreen === 'function') {
                    targetGame.renderCityScreen();
                }
                await syncCommunityProfile(targetGame);
                if (shouldAbortByTicketOrFlow('after_profile_sync')) return;
                lastSyncedUid = uid;
                logLoginDebug('sync.done', {
                    uid: String(uid || ''),
                    force: force === true,
                    reason: syncReason,
                    ticket,
                    flowToken: syncFlowToken,
                    state: getAuthDebugState()
                });
            } catch (err) {
                console.warn('[CitySimAuth] 클라우드 상태 동기화 실패:', err);
                logLoginDebug('sync.fail', {
                    uid: String(uid || ''),
                    force: force === true,
                    reason: syncReason,
                    ticket,
                    flowToken: syncFlowToken,
                    code: String(err && err.code || ''),
                    message: String(err && err.message || ''),
                    state: getAuthDebugState()
                });
            }
        })();

        syncInFlight = task;
        syncInFlightUid = uid;
        try {
            await task;
        } finally {
            if (syncInFlight === task) {
                syncInFlight = null;
                syncInFlightUid = '';
            }
            logLoginDebug('sync.finally', {
                uid: String(uid || ''),
                force: force === true,
                reason: syncReason,
                ticket,
                flowToken: syncFlowToken,
                state: getAuthDebugState()
            });
        }
    }

    function resolveSyncUid(uid) {
        const raw = String(uid || '').trim();
        if (raw) return raw;
        const user = getCurrentUser();
        return (user && user.uid) ? String(user.uid) : '';
    }

    function isCloudSyncReady(uid) {
        const targetUid = resolveSyncUid(uid);
        if (!targetUid) return false;
        if (syncInFlight && syncInFlightUid === targetUid) return false;
        return lastSyncedUid === targetUid;
    }

    async function ensureCloudReadyForSave(uid, gameRef) {
        const targetUid = resolveSyncUid(uid);
        if (!targetUid) return false;
        const liveUser = getCurrentUser();
        if (guestSessionActive === true || isAnonymousUser(liveUser)) return false;
        if (isCloudSyncReady(targetUid)) return true;
        try {
            await syncCloudState(targetUid, gameRef || activeGame || global.game || null, false, 'ensureCloudReadyForSave');
        } catch (_) { }
        return isCloudSyncReady(targetUid);
    }

    function getTargetGameRef(gameRef) {
        return gameRef || activeGame || global.game || null;
    }

    async function finalizeAuthenticatedEntry(user, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const targetGame = getTargetGameRef(opts.game);
        const reason = String(opts.reason || '').trim() || 'finalizeAuthenticatedEntry';
        const successToast = String(opts.successToast || '').trim();
        const failureToast = opts.failureToast === false
            ? ''
            : String(opts.failureToast || '로그인에 성공했지만 시티 화면 진입에 실패했습니다.').trim();
        const forceSync = opts.forceSync !== false;
        const flowToken = Math.max(0, Math.floor(Number(opts.flowToken) || 0));
        const uid = (user && user.uid) ? String(user.uid) : '';
        if (!uid) return false;

        if (flowToken > 0 && !isAuthFlowTokenCurrent(flowToken)) {
            logLoginDebug('login.finalize.skip.stale_before_sync', {
                uid,
                reason,
                flowToken,
                currentAuthFlowToken: Math.max(0, Math.floor(Number(authFlowToken) || 0)),
                state: getAuthDebugState()
            });
            return false;
        }

        guestSessionActive = false;
        cancelAuth();
        await syncCloudState(uid, targetGame, forceSync, reason, flowToken);

        if (flowToken > 0 && !isAuthFlowTokenCurrent(flowToken)) {
            logLoginDebug('login.finalize.skip.stale_after_sync', {
                uid,
                reason,
                flowToken,
                currentAuthFlowToken: Math.max(0, Math.floor(Number(authFlowToken) || 0)),
                state: getAuthDebugState()
            });
            return false;
        }

        if (enterCity(targetGame)) {
            if (successToast) showToast(successToast);
            return true;
        }
        if (failureToast) showToast(failureToast);
        return false;
    }

    async function persistSessionProgress(gameRef) {
        const targetGame = getTargetGameRef(gameRef);
        const tasks = [];
        let citySaveEnqueued = false;
        let mainSaveEnqueued = false;

        if (targetGame && typeof targetGame.saveCitySimState === 'function') {
            citySaveEnqueued = true;
            try {
                const citySaveResult = targetGame.saveCitySimState({ requireCloud: true });
                tasks.push(
                    Promise.resolve(citySaveResult)
                        .then((ok) => ok !== false)
                        .catch((err) => {
                            console.warn('[CitySimAuth] 시티 저장 실패:', err);
                            return false;
                        })
                );
            } catch (err) {
                console.warn('[CitySimAuth] 시티 저장 호출 실패:', err);
                tasks.push(Promise.resolve(false));
            }
        }

        if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
            mainSaveEnqueued = true;
            try {
                const mainSaveResult = app.saveNow({ requireCloud: true });
                tasks.push(
                    Promise.resolve(mainSaveResult)
                        .then((ok) => ok !== false)
                        .catch((err) => {
                            console.warn('[CitySimAuth] 메인 저장 실패:', err);
                            return false;
                        })
                );
            } catch (err) {
                console.warn('[CitySimAuth] 메인 저장 호출 실패:', err);
                tasks.push(Promise.resolve(false));
            }
        }

        if (!tasks.length) {
            logLoginDebug('persist.skip', {
                citySaveEnqueued,
                mainSaveEnqueued,
                state: getAuthDebugState()
            });
            return true;
        }
        const settled = await Promise.allSettled(tasks);
        const okAll = settled.every((entry) => entry.status === 'fulfilled' && entry.value === true);
        logLoginDebug('persist.result', {
            citySaveEnqueued,
            mainSaveEnqueued,
            settled: settled.map((entry) => {
                if (entry.status === 'fulfilled') {
                    return { status: 'fulfilled', value: entry.value === true };
                }
                return { status: 'rejected' };
            }),
            okAll,
            state: getAuthDebugState()
        });
        return okAll;
    }

    function reloadSessionState(gameRef) {
        const targetGame = getTargetGameRef(gameRef);
        if (typeof app !== 'undefined' && app && typeof app.loadIntoGame === 'function') {
            try { app.loadIntoGame(); } catch (err) { console.warn('[CitySimAuth] 메인 상태 재로딩 실패:', err); }
        }
        if (targetGame && typeof targetGame.loadCitySimState === 'function') {
            try { targetGame.loadCitySimState(); } catch (err) { console.warn('[CitySimAuth] 시티 상태 재로딩 실패:', err); }
        }
        if (targetGame && typeof targetGame.renderCityScreen === 'function') {
            try { targetGame.renderCityScreen(); } catch (_) { }
        }
    }

    function clearGuestProgress() {
        const liveUser = getCurrentUser();
        const guestUid = (liveUser && liveUser.uid && isAnonymousUser(liveUser)) ? String(liveUser.uid) : '';
        if (guestUid) {
            removeGuestRankingEntry(guestUid);
        }

        const keys = new Set();
        keys.add('CT_STATE_V1');
        keys.add('CT_STATE_V1_BAK1');
        keys.add('CT_STATE_V1_BAK2');
        keys.add('reclaim_citysim_v1');
        keys.add('CT_STATE_V1__owner_uid');
        keys.add('reclaim_citysim_v1__owner_uid');

        if (typeof app !== 'undefined' && app) {
            if (app.STORAGE_KEY) keys.add(String(app.STORAGE_KEY));
            if (app.BACKUP_KEY_1) keys.add(String(app.BACKUP_KEY_1));
            if (app.BACKUP_KEY_2) keys.add(String(app.BACKUP_KEY_2));
        }
        if (typeof CitySimSave !== 'undefined' && CitySimSave && CitySimSave.STORAGE_KEY) {
            keys.add(String(CitySimSave.STORAGE_KEY));
        }

        keys.forEach((key) => {
            if (!key) return;
            try { localStorage.removeItem(key); } catch (_) { }
        });

        guestSessionActive = false;
        lastSyncedUid = '';
        syncTicket += 1;
        syncInFlight = null;
        syncInFlightUid = '';
        updateSessionUi(getCurrentUser());
    }

    function setError(errorId, message) {
        const el = byId(errorId);
        if (!el) return;
        if (!message) {
            el.textContent = '';
            el.classList.add('hidden');
            fitOpenModalPanel();
            return;
        }
        el.textContent = message;
        el.classList.remove('hidden');
        fitOpenModalPanel();
    }

    function clearAllErrors() {
        setError('auth-login-error', '');
        setError('auth-signup-error', '');
        setError('auth-google-error', '');
        setError('auth-verify-error', '');
    }

    function setSignupVerifyStatus(message, type) {
        const el = byId('auth-signup-verify-status');
        if (!el) return;

        if (!message) {
            el.textContent = '';
            el.classList.add('hidden');
            el.classList.remove('success');
            el.classList.remove('error');
            fitOpenModalPanel();
            return;
        }

        el.textContent = message;
        el.classList.remove('hidden');
        el.classList.remove('success');
        el.classList.remove('error');
        if (type === 'success') el.classList.add('success');
        if (type === 'error') el.classList.add('error');
        fitOpenModalPanel();
    }

    function clearVerifyTimer() {
        if (verifyTimerHandle) {
            clearInterval(verifyTimerHandle);
            verifyTimerHandle = null;
        }
    }

    function setVerifyTimerText(text) {
        const timerEl = byId('auth-verify-timer');
        if (timerEl) timerEl.textContent = text;
    }

    function updateGoogleVerifyTimer() {
        const remainingMs = Math.max(0, googleVerificationExpiresAt - Date.now());
        const totalSec = Math.ceil(remainingMs / 1000);
        const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const sec = String(totalSec % 60).padStart(2, '0');
        setVerifyTimerText(`${min}:${sec}`);

        if (remainingMs <= 0) {
            clearVerifyTimer();
            setError('auth-verify-error', '인증 코드가 만료되었습니다. 코드 재전송을 눌러주세요.');
        }
    }

    function generateCode() {
        return String(Math.floor(100000 + Math.random() * 900000));
    }

    function clearGoogleVerifyState() {
        pendingGoogleEmail = '';
        googleVerificationCode = '';
        googleVerificationExpiresAt = 0;
        clearVerifyTimer();
        setVerifyTimerText('03:00');
        const demoEl = byId('auth-verify-demo');
        if (demoEl) demoEl.textContent = '';
        const targetEl = byId('auth-verify-target');
        if (targetEl) targetEl.textContent = '-';
    }

    function resetSignupVerification() {
        signupVerificationCode = '';
        signupVerificationExpiresAt = 0;
        signupEmailVerified = false;
        signupVerifiedEmail = '';
        setSignupVerifyStatus('', '');

        const demoEl = byId('auth-signup-demo');
        if (demoEl) demoEl.textContent = '';

        const codeInput = byId('auth-signup-code');
        if (codeInput) codeInput.value = '';
    }

    function openLoginModal(game, prefillId) {
        if (game) activeGame = game;

        clearAllErrors();
        closeAllModals();
        clearGoogleVerifyState();
        openModal('auth-login-modal');

        const idInput = byId('auth-login-id');
        const pwInput = byId('auth-login-password');
        if (idInput) idInput.value = prefillId ? String(prefillId) : '';
        if (pwInput) pwInput.value = '';

        if (idInput) setTimeout(() => idInput.focus(), 0);
    }

    function openSignupModal() {
        clearAllErrors();
        closeModal('auth-login-modal');
        openModal('auth-signup-modal');

        ['auth-signup-id', 'auth-signup-password', 'auth-signup-password-confirm', 'auth-signup-email', 'auth-signup-code'].forEach((fieldId) => {
            const field = byId(fieldId);
            if (field) field.value = '';
        });

        resetSignupVerification();

        const idInput = byId('auth-signup-id');
        if (idInput) setTimeout(() => idInput.focus(), 0);
    }

    async function loginAndEnter(game) {
        if (authBusy) {
            showToast('로그인 처리 중입니다. 잠시만 기다려주세요.');
            return;
        }
        activeGame = game || null;
        const user = getCurrentUser();
        if (user && user.uid) {
            if (isGoogleSession(user)) {
                logLoginDebug('login.blocked.google_session', {
                    userUid: String(user.uid || ''),
                    email: String(user.email || ''),
                    state: getAuthDebugState()
                });
                showToast('이미 구글 로그인 상태입니다. 일반 로그인 전환은 먼저 로그아웃 후 진행해주세요.');
                updateSessionUi(user);
                return;
            }
            if (user.providerData && Array.isArray(user.providerData)) {
                const hasPasswordProvider = user.providerData.some((p) => p && p.providerId === 'password');
                if (hasPasswordProvider && !user.emailVerified) {
                    showToast('이메일 인증 후 로그인 가능합니다.');
                    openLoginModal(activeGame);
                    return;
                }
            }

            const flowToken = beginAuthFlow('loginAndEnter.existingSession');
            if (await finalizeAuthenticatedEntry(user, {
                game: activeGame,
                reason: 'loginAndEnter.existingSession',
                successToast: '진행사항을 불러왔습니다.',
                flowToken
            })) return;
        }
        openLoginModal(activeGame);
    }

    function openGoogleVerifyModal(email) {
        pendingGoogleEmail = email;
        googleVerificationCode = generateCode();
        googleVerificationExpiresAt = Date.now() + VERIFY_DURATION_MS;

        const targetEl = byId('auth-verify-target');
        if (targetEl) targetEl.textContent = email;

        const titleEl = byId('auth-verify-title');
        if (titleEl) titleEl.textContent = 'Google 이메일 인증';

        const codeInput = byId('auth-verify-code');
        if (codeInput) codeInput.value = '';

        const demoEl = byId('auth-verify-demo');
        if (demoEl) demoEl.textContent = `테스트 코드: ${googleVerificationCode}`;

        setError('auth-verify-error', '');
        closeModal('auth-google-modal');
        openModal('auth-verify-modal');

        clearVerifyTimer();
        updateGoogleVerifyTimer();
        verifyTimerHandle = setInterval(updateGoogleVerifyTimer, 1000);

        showToast(`[테스트] ${email} 인증 코드: ${googleVerificationCode}`);
        if (codeInput) setTimeout(() => codeInput.focus(), 0);
    }

    async function startGoogle(game, options) {
        if (authBusy) {
            showToast('로그인 처리 중입니다. 잠시만 기다려주세요.');
            return;
        }

        const currentUser = getCurrentUser();
        if (currentUser && currentUser.uid) {
            // 이미 구글 로그인된 세션이면 다시 로그인 절차를 막지 않고 바로 진입한다.
            if (isGoogleSession(currentUser)) {
                activeGame = game || activeGame || global.game || null;
                clearAllErrors();
                closeAllModals();
                clearGoogleVerifyState();

                const flowToken = beginAuthFlow('startGoogle.existingGoogleSession');
                await finalizeAuthenticatedEntry(currentUser, {
                    game: activeGame,
                    reason: 'startGoogle.existingGoogleSession',
                    successToast: '구글 로그인 세션으로 시티에 접속했습니다.',
                    failureToast: '로그인 상태지만 시티 화면 진입에 실패했습니다.',
                    flowToken
                });
                return;
            }

            if (!ensureLoggedOutForNewLogin(null, 'google')) {
                return;
            }
        }

        authBusy = true;
        try {
        activeGame = game || null;
        guestSessionActive = false;
        clearAllErrors();
        closeAllModals();
        clearGoogleVerifyState();

        // Firebase가 준비된 경우: 모달 없이 바로 Google 팝업 실행
        const fb = getFirebaseBridge();
        if (fb && typeof fb.googleSignIn === 'function') {
            try {
                console.log('[CitySimAuth] Google signIn 시도...');
                await fb.googleSignIn();
                const user = getCurrentUser();
                if (!user || !user.uid) {
                    console.warn('[CitySimAuth] Google signIn 후 user 없음');
                    showToast('Google 로그인에 실패했습니다.');
                    return;
                }

                const gameRef = activeGame || global.game || null;
                const flowToken = beginAuthFlow('startGoogle.firebaseSignIn');
                await finalizeAuthenticatedEntry(user, {
                    game: gameRef,
                    reason: 'startGoogle.firebaseSignIn',
                    successToast: 'Google 로그인 성공. 클라우드 저장 데이터를 불러왔습니다.',
                    flowToken
                });
                return;
            } catch (err) {
                const code = String(err && err.code || '');
                console.error('[CitySimAuth] Google signIn 에러:', code, err);
                // 리다이렉트로 전환된 경우 (팝업 차단) → 페이지 리로드 후 처리됨
                if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
                    showToast(mapAuthError(err));
                    return;
                }
                showToast(mapAuthError(err, 'Google 로그인에 실패했습니다.'));
                return;
            }
        }

        // Firebase 미사용 폴백: 이메일 입력 모달
        openModal('auth-google-modal');
        const emailInput = byId('auth-google-email');
        if (emailInput) {
            emailInput.value = '';
            setTimeout(() => emailInput.focus(), 0);
        }
        } finally {
            authBusy = false;
        }
    }

    async function startGuest(game) {
        if (authBusy) {
            showToast('로그인 처리 중입니다. 잠시만 기다려주세요.');
            return;
        }
        if (!ensureLoggedOutForNewLogin(null, 'guest')) {
            return;
        }
        authBusy = true;
        try {
            activeGame = game || null;

            guestSessionActive = true;
            lastSyncedUid = '';
            syncTicket += 1;
            syncInFlight = null;
            syncInFlightUid = '';
            updateSessionUi(null);
            cancelAuth();
            reloadSessionState(activeGame);

            let communityReady = false;
            const fb = getFirebaseBridge();
            if (fb && typeof fb.anonymousSignIn === 'function') {
                try {
                    await fb.anonymousSignIn();
                    const anon = getCurrentUser();
                    communityReady = !!(anon && anon.uid && isAnonymousUser(anon));
                } catch (err) {
                    console.warn('[CitySimAuth] anonymous sign-in failed:', err);
                    communityReady = false;
                }
            }
            updateSessionUi(getCurrentUser());

            if (enterCity(activeGame)) {
                if (communityReady) {
                    showToast('게스트 로그인으로 시티 화면에 입장했습니다. (채팅/방문 가능, 랭킹 임시 반영/로그아웃 시 제거)');
                } else {
                    showToast('게스트 로그인으로 시티 화면에 입장했습니다.');
                }
                return;
            }
            showToast('게스트 로그인에 실패했습니다.');
        } finally {
            authBusy = false;
        }
    }

    function cancelAuth() {
        closeAllModals();
        clearAllErrors();

        ['auth-login-id', 'auth-login-password', 'auth-signup-id', 'auth-signup-password', 'auth-signup-password-confirm', 'auth-signup-email', 'auth-signup-code', 'auth-google-email', 'auth-verify-code'].forEach((fieldId) => {
            const field = byId(fieldId);
            if (field) field.value = '';
        });

        resetSignupVerification();
        clearGoogleVerifyState();
    }

    async function onLoginSubmit(event) {
        event.preventDefault();
        if (authBusy) {
            setError('auth-login-error', '로그인 처리 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        if (!ensureLoggedOutForNewLogin('auth-login-error', 'login')) {
            return;
        }

        authBusy = true;
        try {

        const idValue = normalizeId(byId('auth-login-id')?.value);
        const passwordValue = String(byId('auth-login-password')?.value || '').trim();

        if (!idValue || !passwordValue) {
            setError('auth-login-error', '아이디와 비밀번호를 입력해주세요.');
            return;
        }

        const fb = getFirebaseBridge();
        if (fb && typeof fb.emailSignIn === 'function') {
            const alias = findAccount(idValue);
            const emailValue = isValidEmail(idValue) ? normalizeEmail(idValue) : normalizeEmail(alias && alias.email);
            if (!emailValue) {
                setError('auth-login-error', '이메일 형식으로 입력하거나, 회원가입 시 등록한 아이디를 입력해주세요.');
                return;
            }

            try {
                setError('auth-login-error', '');
                await fb.emailSignIn(emailValue, passwordValue);
                const user = getCurrentUser();
                if (!user || !user.uid) {
                    setError('auth-login-error', '로그인 처리에 실패했습니다. 다시 시도해주세요.');
                    return;
                }

                if (!user.emailVerified) {
                    if (typeof fb.signOut === 'function') {
                        try { await fb.signOut(); } catch (_) { }
                    }
                    setError('auth-login-error', '이메일 인증 후 로그인 가능합니다. 인증 메일을 확인해주세요.');
                    return;
                }

                const gameRef = activeGame || global.game || null;
                const flowToken = beginAuthFlow('onLoginSubmit.emailSignIn');
                await finalizeAuthenticatedEntry(user, {
                    game: gameRef,
                    reason: 'onLoginSubmit.emailSignIn',
                    successToast: '로그인 성공. 클라우드 저장 데이터를 불러왔습니다.',
                    flowToken
                });
                return;
            } catch (err) {
                setError('auth-login-error', mapAuthError(err, '로그인에 실패했습니다.'));
                return;
            }
        }

        const account = findAccount(idValue);
        if (!account) {
            setError('auth-login-error', '회원가입 후 로그인 가능합니다.');
            return;
        }

        if (String(account.password || '') !== passwordValue) {
            setError('auth-login-error', '비밀번호가 일치하지 않습니다.');
            return;
        }

        const gameRef = activeGame;
        guestSessionActive = false;
        cancelAuth();

        if (enterCity(gameRef)) {
            showToast('로그인 성공. 시티 화면으로 이동합니다.');
            return;
        }

        showToast('로그인에 성공했지만 시티 화면 진입에 실패했습니다.');
        } finally {
            authBusy = false;
        }
    }

    function onSignupSendCode() {
        if (getFirebaseBridge()) {
            setError('auth-signup-error', '');
            setSignupVerifyStatus('Firebase 인증 메일 방식이 활성화되어 코드 입력은 사용하지 않습니다.', '');
            return;
        }

        const emailValue = normalizeEmail(byId('auth-signup-email')?.value);
        if (!emailValue) {
            setError('auth-signup-error', '이메일을 입력해주세요.');
            return;
        }
        if (!isValidEmail(emailValue)) {
            setError('auth-signup-error', '유효한 이메일 형식으로 입력해주세요.');
            return;
        }

        setError('auth-signup-error', '');

        signupVerificationCode = generateCode();
        signupVerificationExpiresAt = Date.now() + VERIFY_DURATION_MS;
        signupEmailVerified = false;
        signupVerifiedEmail = '';

        const demoEl = byId('auth-signup-demo');
        if (demoEl) demoEl.textContent = `테스트 코드: ${signupVerificationCode}`;

        setSignupVerifyStatus('이메일로 코드를 전송했습니다. 코드 확인을 눌러주세요.', '');
        showToast(`[테스트] ${emailValue} 인증 코드: ${signupVerificationCode}`);
    }

    function onSignupVerifyCode() {
        if (getFirebaseBridge()) {
            setSignupVerifyStatus('Firebase 인증 메일 방식에서는 코드 확인이 필요하지 않습니다.', '');
            return;
        }

        const emailValue = normalizeEmail(byId('auth-signup-email')?.value);
        const codeValue = String(byId('auth-signup-code')?.value || '').trim();

        if (!signupVerificationCode) {
            setSignupVerifyStatus('먼저 이메일 인증 버튼을 눌러 코드를 받으세요.', 'error');
            return;
        }

        if (!isValidEmail(emailValue)) {
            setSignupVerifyStatus('유효한 이메일을 입력하세요.', 'error');
            return;
        }

        if (!/^\d{6}$/.test(codeValue)) {
            setSignupVerifyStatus('인증 코드는 6자리 숫자로 입력해주세요.', 'error');
            return;
        }

        if (Date.now() > signupVerificationExpiresAt) {
            setSignupVerifyStatus('인증 코드가 만료되었습니다. 다시 전송해주세요.', 'error');
            return;
        }

        if (codeValue !== signupVerificationCode) {
            setSignupVerifyStatus('인증 코드가 일치하지 않습니다.', 'error');
            return;
        }

        signupEmailVerified = true;
        signupVerifiedEmail = emailValue;
        setSignupVerifyStatus('이메일 인증이 완료되었습니다.', 'success');
    }

    async function onSignupSubmit(event) {
        event.preventDefault();

        const idValue = normalizeId(byId('auth-signup-id')?.value);
        const passwordValue = String(byId('auth-signup-password')?.value || '').trim();
        const passwordConfirmValue = String(byId('auth-signup-password-confirm')?.value || '').trim();
        const emailValue = normalizeEmail(byId('auth-signup-email')?.value);

        if (!idValue || !passwordValue || !passwordConfirmValue || !emailValue) {
            setError('auth-signup-error', '아이디/비밀번호/이메일을 모두 입력해주세요.');
            return;
        }

        if (passwordValue !== passwordConfirmValue) {
            setError('auth-signup-error', '비밀번호와 비밀번호 확인이 일치하지 않습니다.');
            return;
        }

        if (!isValidEmail(emailValue)) {
            setError('auth-signup-error', '유효한 이메일 형식으로 입력해주세요.');
            return;
        }

        const fb = getFirebaseBridge();
        if (fb && typeof fb.emailSignUp === 'function') {
            try {
                setError('auth-signup-error', '');
                await fb.emailSignUp(emailValue, passwordValue, idValue || '');
                if (idValue) {
                    saveAccount(idValue, '', emailValue);
                }
                showToast('회원가입 완료. 인증 메일을 확인하고 로그인해주세요.');
                openLoginModal(null, emailValue);
                return;
            } catch (err) {
                setError('auth-signup-error', mapAuthError(err, '회원가입에 실패했습니다.'));
                return;
            }
        }

        if (findAccount(idValue)) {
            setError('auth-signup-error', '이미 사용 중인 아이디입니다.');
            return;
        }

        if (!signupEmailVerified || signupVerifiedEmail !== emailValue) {
            setError('auth-signup-error', '이메일 인증을 완료해야 회원가입할 수 있습니다.');
            return;
        }

        saveAccount(idValue, passwordValue, emailValue);
        showToast('회원가입이 완료되었습니다. 로그인해주세요.');
        openLoginModal(null, idValue);
    }

    async function onGoogleSubmit(event) {
        event.preventDefault();
        if (authBusy) {
            setError('auth-google-error', '로그인 처리 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        if (!ensureLoggedOutForNewLogin('auth-google-error', 'google')) {
            return;
        }

        authBusy = true;
        try {

        const fb = getFirebaseBridge();
        if (fb && typeof fb.googleSignIn === 'function') {
            try {
                setError('auth-google-error', '');
                await fb.googleSignIn();
                const user = getCurrentUser();
                if (!user || !user.uid) {
                    setError('auth-google-error', 'Google 로그인에 실패했습니다.');
                    return;
                }

                const gameRef = activeGame || global.game || null;
                const flowToken = beginAuthFlow('onGoogleSubmit.googleSignIn');
                await finalizeAuthenticatedEntry(user, {
                    game: gameRef,
                    reason: 'onGoogleSubmit.googleSignIn',
                    successToast: 'Google 로그인 성공. 클라우드 저장 데이터를 불러왔습니다.',
                    flowToken
                });
                return;
            } catch (err) {
                console.error('[CitySimAuth] onGoogleSubmit 에러:', err && err.code, err);
                setError('auth-google-error', mapAuthError(err, 'Google 로그인에 실패했습니다.'));
                return;
            }
        }

        const emailValue = normalizeEmail(byId('auth-google-email')?.value);
        if (!emailValue) {
            setError('auth-google-error', 'Google 이메일을 입력해주세요.');
            return;
        }
        if (!isValidEmail(emailValue)) {
            setError('auth-google-error', '유효한 이메일 형식으로 입력해주세요.');
            return;
        }
        setError('auth-google-error', '');
        openGoogleVerifyModal(emailValue);
        } finally {
            authBusy = false;
        }
    }

    function onVerifySubmit(event) {
        event.preventDefault();

        if (!pendingGoogleEmail) {
            setError('auth-verify-error', '인증 세션이 없습니다. 다시 로그인해주세요.');
            return;
        }

        const codeValue = String(byId('auth-verify-code')?.value || '').trim();
        if (!/^\d{6}$/.test(codeValue)) {
            setError('auth-verify-error', '인증 코드는 6자리 숫자로 입력해주세요.');
            return;
        }

        if (Date.now() > googleVerificationExpiresAt) {
            setError('auth-verify-error', '인증 코드가 만료되었습니다. 코드 재전송을 눌러주세요.');
            return;
        }

        if (codeValue !== googleVerificationCode) {
            setError('auth-verify-error', '인증 코드가 일치하지 않습니다.');
            return;
        }

        const gameRef = activeGame;
        cancelAuth();

        if (enterCity(gameRef)) {
            showToast('구글로그인 인증 완료. 시티 화면으로 이동합니다.');
            return;
        }

        showToast('인증은 완료되었지만 시티 화면 진입에 실패했습니다.');
    }

    function onResendCode() {
        if (!pendingGoogleEmail) {
            setError('auth-verify-error', '재전송할 이메일 정보가 없습니다. 다시 로그인해주세요.');
            return;
        }

        setError('auth-verify-error', '');
        openGoogleVerifyModal(pendingGoogleEmail);
        showToast('인증 코드를 재전송했습니다.');
    }

    async function signOutSession(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const silent = opts.silent === true;
        const persist = opts.persist !== false;
        const force = opts.force === true;
        const targetGame = getTargetGameRef(opts.game);
        let signOutInvoked = false;
        let saveOk = null;

        const fb = getFirebaseBridge();
        if (!fb || typeof fb.signOut !== 'function') {
            logLoginDebug('signout.no_bridge', {
                silent,
                persist,
                force,
                state: getAuthDebugState()
            });
            if (!silent) showToast('현재 로그인 세션이 없습니다.');
            return false;
        }

        try {
            const user = getCurrentUser();
            logLoginDebug('signout.start', {
                silent,
                persist,
                force,
                userUid: user && user.uid ? String(user.uid) : '',
                state: getAuthDebugState()
            });
            if (!user || !user.uid) {
                clearForceSignOutArm();
                guestSessionActive = false;
                lastSyncedUid = '';
                lastLoginQuestGrantUid = '';
                syncTicket += 1;
                syncInFlight = null;
                syncInFlightUid = '';
                updateSessionUi(null);
                reloadSessionState(targetGame);
                logLoginDebug('signout.no_user', {
                    silent,
                    persist,
                    force,
                    signOutInvoked,
                    state: getAuthDebugState()
                });
                if (!silent) showToast('현재 로그인 세션이 없습니다.');
                return false;
            }

            if (persist) {
                logLoginDebug('signout.persist.begin', {
                    userUid: String(user.uid || ''),
                    state: getAuthDebugState()
                });
                saveOk = await persistSessionProgress(targetGame);
                logLoginDebug('signout.persist.result', {
                    userUid: String(user.uid || ''),
                    saveOk: saveOk === true,
                    force,
                    state: getAuthDebugState()
                });
                if (!saveOk) {
                    if (!force) {
                        const armedUntil = armForceSignOut();
                        logLoginDebug('signout.abort_save_failed', {
                            userUid: String(user.uid || ''),
                            signOutInvoked,
                            force,
                            armedUntil,
                            state: getAuthDebugState()
                        });
                        if (!silent) showToast('저장에 실패해 로그아웃을 중단했습니다. 10초 내에 다시 로그아웃을 누르면 강제 로그아웃합니다.');
                        return false;
                    }
                    clearForceSignOutArm();
                    logLoginDebug('signout.force_continue_after_save_fail', {
                        userUid: String(user.uid || ''),
                        signOutInvoked,
                        force,
                        state: getAuthDebugState()
                    });
                    if (!silent) showToast('저장에 실패했지만 강제 로그아웃을 진행합니다.');
                } else {
                    clearForceSignOutArm();
                }
            }

            if (isAnonymousUser(user) || guestSessionActive === true) {
                await removeGuestRankingEntry(String(user.uid));
            }

            signOutInvoked = true;
            logLoginDebug('signout.firebase_signout.call', {
                userUid: String(user.uid || ''),
                saveOk: saveOk === true,
                force,
                state: getAuthDebugState()
            });
            await fb.signOut();
            clearForceSignOutArm();
            lastSyncedUid = '';
            lastLoginQuestGrantUid = '';
            guestSessionActive = false;
            syncTicket += 1;
            syncInFlight = null;
            syncInFlightUid = '';
            updateSessionUi(null);
            reloadSessionState(targetGame);
            logLoginDebug('signout.success', {
                userUid: String(user.uid || ''),
                signOutInvoked,
                saveOk: saveOk === true || saveOk == null,
                force,
                state: getAuthDebugState()
            });
            if (!silent) showToast('로그아웃되었습니다.');
            return true;
        } catch (err) {
            logLoginDebug('signout.error', {
                signOutInvoked,
                saveOk: saveOk === true,
                force,
                code: String(err && err.code || ''),
                message: String(err && err.message || ''),
                state: getAuthDebugState()
            });
            if (!silent) showToast(mapAuthError(err, '로그아웃에 실패했습니다.'));
            return false;
        }
    }

    async function onSignOut() {
        if (authBusy) {
            showToast('로그인 처리 중입니다. 잠시만 기다려주세요.');
            return;
        }
        authBusy = true;
        try {
            const force = isForceSignOutArmed();
            await signOutSession({ silent: false, force });
        } finally {
            authBusy = false;
        }
    }

    function bindClick(id, handler) {
        const el = byId(id);
        if (!el) return;
        el.addEventListener('click', handler);
    }

    function bindSubmit(id, handler) {
        const form = byId(id);
        if (!form) return;
        form.addEventListener('submit', handler);
    }

    function initBindings() {
        if (initialized) return;
        initialized = true;

        const firebaseEnabled = !!getFirebaseBridge();
        setSignupFirebaseMode(firebaseEnabled);
        setGoogleFirebaseMode(firebaseEnabled);
        updateSessionUi(getCurrentUser());

        bindSubmit('auth-login-form', onLoginSubmit);
        bindSubmit('auth-signup-form', onSignupSubmit);
        bindSubmit('auth-google-form', onGoogleSubmit);
        bindSubmit('auth-verify-form', onVerifySubmit);

        bindClick('auth-login-cancel', cancelAuth);
        bindClick('auth-login-close', cancelAuth);
        bindClick('auth-google-cancel', cancelAuth);
        bindClick('auth-google-close', cancelAuth);
        bindClick('auth-verify-cancel', cancelAuth);
        bindClick('auth-verify-close', cancelAuth);
        bindClick('auth-signup-close', cancelAuth);

        bindClick('auth-open-signup', openSignupModal);
        bindClick('auth-signup-back', () => openLoginModal(null));
        bindClick('auth-signup-send-code', onSignupSendCode);
        bindClick('auth-signup-verify-code', onSignupVerifyCode);

        bindClick('auth-verify-resend', onResendCode);
        bindClick('auth-signout-btn', onSignOut);

        const verifyCodeInput = byId('auth-verify-code');
        if (verifyCodeInput) {
            verifyCodeInput.addEventListener('input', () => {
                verifyCodeInput.value = verifyCodeInput.value.replace(/\D/g, '').slice(0, 6);
            });
        }

        const signupCodeInput = byId('auth-signup-code');
        if (signupCodeInput) {
            signupCodeInput.addEventListener('input', () => {
                signupCodeInput.value = signupCodeInput.value.replace(/\D/g, '').slice(0, 6);
            });
        }

        AUTH_MODAL_IDS.forEach((modalId) => {
            const modal = byId(modalId);
            if (!modal) return;
            modal.addEventListener('click', (event) => {
                if (event.target === modal) cancelAuth();
            });
        });

        const onViewportResize = () => {
            if (!isAnyModalOpen()) return;
            fitOpenModalPanel();
        };
        global.addEventListener('resize', onViewportResize);
        if (global.visualViewport && typeof global.visualViewport.addEventListener === 'function') {
            global.visualViewport.addEventListener('resize', onViewportResize);
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && isAnyModalOpen()) {
                cancelAuth();
            }
        });

        const fb = getFirebaseBridge();

        // signInWithRedirect 결과 처리 (팝업 차단 후 리다이렉트로 돌아온 경우)
        if (fb && typeof fb.handleRedirectResult === 'function') {
            fb.handleRedirectResult().then(function (result) {
                if (result && result.user && result.user.uid) {
                    const flowToken = beginAuthFlow('redirectResult');
                    logLoginDebug('redirect.result', {
                        userUid: String(result.user.uid || ''),
                        email: String(result.user.email || ''),
                        flowToken
                    });
                    console.log('[CitySimAuth] Redirect 로그인 성공:', result.user.email);
                    const gameRef = activeGame || global.game || null;
                    finalizeAuthenticatedEntry(result.user, {
                        game: gameRef,
                        reason: 'redirectResult',
                        successToast: 'Google 로그인 성공. 클라우드 저장 데이터를 불러왔습니다.',
                        flowToken
                    }).catch(function (err) {
                        console.warn('[CitySimAuth] Redirect 후 상태 정리 실패:', err);
                    });
                }
            });
        }

        if (fb && typeof fb.onAuth === 'function') {
            fb.onAuth(async (user) => {
                const callbackUid = (user && user.uid) ? String(user.uid) : '';
                const liveUser = getCurrentUser();
                const liveUid = (liveUser && liveUser.uid) ? String(liveUser.uid) : '';
                logLoginDebug('onAuth.event', {
                    callbackUid,
                    liveUid,
                    isNullEvent: !(user && user.uid),
                    state: getAuthDebugState()
                });
                // 빠른 계정 전환 시 늦게 도착한 null 이벤트가 상태를 덮어쓰는 것을 방지.
                if ((!user || !user.uid)) {
                    if (liveUser && liveUser.uid) return;
                }

                const isGuestAuthUser = !!(user && user.uid && isAnonymousUser(user));
                if (user && user.uid) {
                    guestSessionActive = isGuestAuthUser;
                }
                updateSessionUi(user);
                if (user && user.uid) {
                    const authUid = String(user.uid);
                    const gameRef = activeGame || global.game || null;
                    const flowToken = Math.max(0, Math.floor(Number(authFlowToken) || 0));

                    if (isGuestAuthUser) {
                        lastSyncedUid = '';
                        lastLoginQuestGrantUid = '';
                        if (typeof CitySimChat !== 'undefined' && CitySimChat && typeof CitySimChat.syncMyProfile === 'function') {
                            try {
                                await CitySimChat.syncMyProfile(gameRef);
                            } catch (err) {
                                console.warn('[CitySimAuth] Guest profile sync failed:', err);
                            }
                        }
                        return;
                    }

                    await syncCloudState(authUid, gameRef, false, 'onAuth', flowToken);
                    if (flowToken > 0 && !isAuthFlowTokenCurrent(flowToken)) return;

                    // [FIX] 로그인 시 프로필 자동 동기화 (랭킹/방문 시스템용)
                    if (typeof CitySimChat !== 'undefined' && CitySimChat && typeof CitySimChat.syncMyProfile === 'function') {
                        try {
                            await CitySimChat.syncMyProfile(gameRef);
                        } catch (err) {
                            console.warn('[CitySimAuth] Profile sync failed:', err);
                        }
                    }
                    if (flowToken > 0 && !isAuthFlowTokenCurrent(flowToken)) return;

                    const grantLoginQuestReward = () => {
                        const targetGame = activeGame || global.game || null;
                        if (!targetGame || typeof targetGame.grantCityQuestReward !== 'function') return false;
                        if (typeof targetGame.getCityQuestProgress === 'function') {
                            try {
                                const rows = targetGame.getCityQuestProgress();
                                const loginRow = Array.isArray(rows)
                                    ? rows.find((row) => String(row?.id || '').trim() === 'login_supply_box')
                                    : null;
                                if (loginRow && String(loginRow.status || '').trim() === 'claimed') {
                                    return true;
                                }
                            } catch (_) { }
                        }
                        targetGame.grantCityQuestReward('login_supply_box');
                        return true;
                    };

                    if (lastLoginQuestGrantUid !== authUid) {
                        if (grantLoginQuestReward()) {
                            lastLoginQuestGrantUid = authUid;
                        } else {
                            setTimeout(() => {
                                if (grantLoginQuestReward()) {
                                    lastLoginQuestGrantUid = authUid;
                                }
                            }, 600);
                        }
                    }
                } else {
                    lastSyncedUid = '';
                    lastLoginQuestGrantUid = '';
                    syncTicket += 1;
                    syncInFlight = null;
                    syncInFlightUid = '';
                    if (typeof CitySimChat !== 'undefined' && CitySimChat && typeof CitySimChat.close === 'function') {
                        CitySimChat.close();
                    }
                    if (!guestSessionActive && !authBusy) {
                        reloadSessionState(activeGame || global.game || null);
                    }
                }
            });
        } else {
            updateSessionUi(null);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBindings);
    } else {
        initBindings();
    }

    global.CitySimAuth = {
        loginAndEnter,
        startGoogle,
        startGuest,
        signOut: function signOutPublic() {
            return signOutSession({ silent: false, force: isForceSignOutArmed() });
        },
        cancelAuth,
        getCurrentUser: function getCurrentUserPublic() { return getCurrentUser(); },
        isAuthenticated: function isAuthenticated() {
            const user = getCurrentUser();
            return !!(user && user.uid);
        },
        isCloudSyncReady: function isCloudSyncReadyPublic(uid) {
            return isCloudSyncReady(uid);
        },
        ensureCloudReadyForSave: function ensureCloudReadyForSavePublic(uid, gameRef) {
            return ensureCloudReadyForSave(uid, gameRef);
        },
        isAuthTransitioning: function isAuthTransitioningPublic() {
            return isAuthTransitioning();
        },
        isGuestSession: function isGuestSession() { return guestSessionActive === true; },
        clearGuestProgress
    };
})(window);
