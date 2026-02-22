(function (global) {
    'use strict';

    const LOGIN_DEBUG_KEY = 'reclaim_login_debug';

    function isLoginDebugEnabled() {
        if (global && global.__RECLAIM_LOGIN_DEBUG__ === true) return true;
        try {
            return localStorage.getItem(LOGIN_DEBUG_KEY) === '1';
        } catch (_) {
            return false;
        }
    }

    function summarizeStagePack(pack) {
        const stages = Array.isArray(pack && pack.stages) ? pack.stages : [];
        let cleared = 0;
        let current = 0;
        let locked = 0;
        let other = 0;
        for (let i = 0; i < stages.length; i += 1) {
            const status = String(stages[i] && stages[i].status || '').trim();
            if (status === 'cleared') cleared += 1;
            else if (status === 'current') current += 1;
            else if (status === 'locked') locked += 1;
            else other += 1;
        }
        const selectedStageId = Number(pack && pack.selectedStageId);
        return {
            count: stages.length,
            selectedStageId: Number.isFinite(selectedStageId) ? Math.floor(selectedStageId) : null,
            status: { cleared, current, locked, other }
        };
    }

    function summarizeQuestMission(mission) {
        if (!mission || typeof mission !== 'object') {
            return { exists: false };
        }
        const quests = (mission.quests && typeof mission.quests === 'object') ? mission.quests : {};
        const ids = Object.keys(quests);
        let claimed = 0;
        let claimable = 0;
        let inProgress = 0;
        let other = 0;
        for (let i = 0; i < ids.length; i += 1) {
            const status = String(quests[ids[i]] && quests[ids[i]].status || '').trim();
            if (status === 'claimed') claimed += 1;
            else if (status === 'claimable') claimable += 1;
            else if (status === 'in_progress') inProgress += 1;
            else other += 1;
        }
        const counters = (mission.counters && typeof mission.counters === 'object') ? mission.counters : {};
        const meta = (mission.meta && typeof mission.meta === 'object') ? mission.meta : {};
        return {
            exists: true,
            questCount: ids.length,
            status: { claimed, claimable, inProgress, other },
            counters: {
                kill: Math.max(0, Math.floor(Number(counters.kill) || 0)),
                win: Math.max(0, Math.floor(Number(counters.win) || 0)),
                levelUp: Math.max(0, Math.floor(Number(counters.levelUp) || 0))
            },
            meta: {
                loginSupplyClaimed: meta.loginSupplyClaimed === true,
                skirmishFirstWinClaimed: meta.skirmishFirstWinClaimed === true
            }
        };
    }

    function summarizeProgress(progress) {
        const p = (progress && typeof progress === 'object') ? progress : {};
        const occupation = summarizeStagePack(p.campaignOccupation || {});
        const skirmish = summarizeStagePack(p.campaignSkirmish || {});
        const clearedMaps = Array.isArray(p.clearedMaps) ? p.clearedMaps : [];
        return {
            activeCampaignTab: String(p.activeCampaignTab || ''),
            clearedMapsCount: clearedMaps.length,
            campaignThreatLevel: Number.isFinite(Number(p.campaignThreatLevel))
                ? Math.max(1, Math.min(10, Math.floor(Number(p.campaignThreatLevel))))
                : null,
            occupation,
            skirmish,
            cityQuestMission: summarizeQuestMission(p.cityQuestMission)
        };
    }

    function summarizeGameProgress() {
        return summarizeProgress({
            activeCampaignTab: game.activeCampaignTab || 'skirmish',
            clearedMaps: Array.isArray(game.clearedMaps) ? game.clearedMaps : [],
            campaignThreatLevel: Number(game.campaignThreatLevel),
            campaignOccupation: game.campaignOccupation || {},
            campaignSkirmish: game.campaignSkirmish || {},
            cityQuestMission: (game.cityQuestMission && typeof game.cityQuestMission === 'object')
                ? game.cityQuestMission
                : null
        });
    }

    function logLoginDebug(eventName, payload) {
        if (!isLoginDebugEnabled()) return;
        try {
            console.info('[LoginDebug][MainSave]', String(eventName || ''), payload || {});
        } catch (_) { }
    }

    function readLocalOwnerUidForDebug(localKey) {
        const key = `${String(localKey || '').trim()}__owner_uid`;
        if (!key || key === '__owner_uid') return '';
        try {
            return String(localStorage.getItem(key) || '').trim();
        } catch (_) {
            return '';
        }
    }

    const appPersistence = {
    _makeState() {
        const diff = 'elite';
        const lastMapId = game.currentMapId || null;
        const questMissionState = (
            typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.serialize === 'function'
        ) ? CityQuestMission.serialize(game) : null;

        const serializeStages = (stages) => {
            if (!Array.isArray(stages)) return [];
            return stages.map((stage) => ({
                id: Math.floor(Number(stage?.id) || 0),
                status: String(stage?.status || 'locked'),
                stars: Math.max(0, Math.min(3, Math.floor(Number(stage?.stars) || 0)))
            })).filter((stage) => stage.id > 0);
        };

        const serializeView = (view) => ({
            x: Number(view?.x) || 0,
            y: Number(view?.y) || 0,
            scale: Math.max(0.8, Math.min(2.5, Number(view?.scale) || 1.2))
        });

        return {
            version: this.SCHEMA_VERSION,
            settings: {
                speed: Number(game.speed) || 1,
                difficulty: String(diff || 'elite'),
                lastMapId: lastMapId ? String(lastMapId) : null,
                iogAlwaysOpen: !!(game.settings && game.settings.iogAlwaysOpen === true),
            },
            stats: {
                killCount: Number(game.killCount) || 0,
            },
            progress: {
                clearedMaps: Array.isArray(game.clearedMaps) ? game.clearedMaps : [],
                firstRunDone: !!game.firstRunDone,
                devUnlockAllMaps: game.devUnlockAllMaps === true,
                activeCampaignTab: game.activeCampaignTab || 'skirmish',
                campaignOccupation: {
                    stages: serializeStages(game.campaignOccupation.stages),
                    selectedStageId: Number.isFinite(Number(game.campaignOccupation.selectedStageId))
                        ? Math.floor(Number(game.campaignOccupation.selectedStageId)) : null,
                    view: serializeView(game.campaignOccupation.view)
                },
                campaignSkirmish: {
                    stages: serializeStages(game.campaignSkirmish.stages),
                    selectedStageId: Number.isFinite(Number(game.campaignSkirmish.selectedStageId))
                        ? Math.floor(Number(game.campaignSkirmish.selectedStageId)) : null,
                    view: serializeView(game.campaignSkirmish.view)
                },
                cityQuestMission: questMissionState,
                // 하위 호환
                campaignStages: serializeStages(game.campaignOccupation.stages),
                campaignSelectedStageId: Number.isFinite(Number(game.campaignOccupation.selectedStageId))
                    ? Math.floor(Number(game.campaignOccupation.selectedStageId)) : null,
                campaignThreatLevel: Math.max(1, Math.min(10, Math.floor(Number(game.campaignThreatLevel) || 1))),
                campaignView: serializeView(game.campaignOccupation.view)
            }
        };
    },

    // ---- (2) 마이그레이션(자동 보정) ----

    migrate(raw) {
        // raw가 null/undefined면 새로 생성
        if (!raw || typeof raw !== 'object') raw = { version: 0 };

        const v = Number(raw.version) || 0;

        // v0 -> v1 보정
        if (v < 1) {
            raw.version = 1;
            raw.settings = raw.settings || {};
            raw.stats = raw.stats || {};
        }

        // 타입/누락 보정
        if (!raw.settings || typeof raw.settings !== 'object') raw.settings = {};
        if (!raw.stats || typeof raw.stats !== 'object') raw.stats = {};
        if (!raw.progress || typeof raw.progress !== 'object') raw.progress = {};

        const sp = Number(raw.settings.speed);
        raw.settings.speed = Number.isFinite(sp) ? sp : 1;

        raw.settings.difficulty = (typeof raw.settings.difficulty === 'string' && raw.settings.difficulty)
            ? raw.settings.difficulty
            : 'elite';
        if (raw.settings.difficulty !== 'elite') raw.settings.difficulty = 'elite';

        raw.settings.lastMapId = (raw.settings.lastMapId == null)
            ? null
            : String(raw.settings.lastMapId);
        raw.settings.iogAlwaysOpen = raw.settings.iogAlwaysOpen === true;

        const kc = Number(raw.stats.killCount);
        raw.stats.killCount = Number.isFinite(kc) ? kc : 0;

        if (!Array.isArray(raw.progress.clearedMaps)) raw.progress.clearedMaps = [];
        if (typeof raw.progress.firstRunDone !== 'boolean') {
            raw.progress.firstRunDone = raw.progress.clearedMaps.length > 0;
        }
        raw.progress.devUnlockAllMaps = raw.progress.devUnlockAllMaps === true;

        if (!Array.isArray(raw.progress.campaignStages)) raw.progress.campaignStages = [];

        const selectedStageId = Number(raw.progress.campaignSelectedStageId);
        raw.progress.campaignSelectedStageId = Number.isFinite(selectedStageId) && selectedStageId > 0
            ? Math.floor(selectedStageId)
            : null;

        const threat = Number(raw.progress.campaignThreatLevel);
        raw.progress.campaignThreatLevel = Number.isFinite(threat)
            ? Math.max(1, Math.min(10, Math.floor(threat)))
            : 1;

        const view = raw.progress.campaignView;
        if (!view || typeof view !== 'object') raw.progress.campaignView = {};
        const viewX = Number(raw.progress.campaignView.x);
        const viewY = Number(raw.progress.campaignView.y);
        const viewScale = Number(raw.progress.campaignView.scale);
        raw.progress.campaignView.x = Number.isFinite(viewX) ? viewX : 0;
        raw.progress.campaignView.y = Number.isFinite(viewY) ? viewY : 0;
        raw.progress.campaignView.scale = Number.isFinite(viewScale)
            ? Math.max(0.8, Math.min(2.5, viewScale))
            : 1.2;

        // 신규 캠페인 데이터 마이그레이션
        if (!raw.progress.activeCampaignTab) {
            raw.progress.activeCampaignTab = 'skirmish';
        }
        const activeTab = String(raw.progress.activeCampaignTab || '').trim();
        if (activeTab !== 'skirmish' && activeTab !== 'occupation' && activeTab !== 'custom') {
            raw.progress.activeCampaignTab = 'skirmish';
        }

        if (!raw.progress.cityQuest || typeof raw.progress.cityQuest !== 'object') {
            raw.progress.cityQuest = {};
        }
        raw.progress.cityQuest.buildBarracksRewardClaimed = raw.progress.cityQuest.buildBarracksRewardClaimed === true;
        raw.progress.cityQuest.loginSupplyRewardClaimed = raw.progress.cityQuest.loginSupplyRewardClaimed === true;
        raw.progress.cityQuest.skirmishFirstWinRewardClaimed = raw.progress.cityQuest.skirmishFirstWinRewardClaimed === true;
        if (!Object.prototype.hasOwnProperty.call(raw.progress, 'cityQuestMission')) {
            raw.progress.cityQuestMission = null;
        } else if (raw.progress.cityQuestMission != null && typeof raw.progress.cityQuestMission !== 'object') {
            raw.progress.cityQuestMission = null;
        }

        const migrateView = (v) => {
            if (!v || typeof v !== 'object') return { x: 0, y: 0, scale: 1.2 };
            return {
                x: Number.isFinite(Number(v.x)) ? Number(v.x) : 0,
                y: Number.isFinite(Number(v.y)) ? Number(v.y) : 0,
                scale: Number.isFinite(Number(v.scale)) ? Math.max(0.8, Math.min(2.5, Number(v.scale))) : 1.2
            };
        };

        // 기존 campaignLanding → campaignOccupation 마이그레이션
        if (!raw.progress.campaignOccupation) {
            if (raw.progress.campaignLanding) {
                // 기존 상륙전 데이터를 점령전으로 이관
                raw.progress.campaignOccupation = {
                    stages: Array.isArray(raw.progress.campaignLanding.stages) ? raw.progress.campaignLanding.stages.slice(0) : [],
                    selectedStageId: raw.progress.campaignLanding.selectedStageId || null,
                    view: migrateView(raw.progress.campaignLanding.view)
                };
            } else {
                raw.progress.campaignOccupation = {
                    stages: raw.progress.campaignStages ? raw.progress.campaignStages.slice(0) : [],
                    selectedStageId: raw.progress.campaignSelectedStageId || null,
                    view: migrateView(raw.progress.campaignView)
                };
            }
        } else {
            if (!Array.isArray(raw.progress.campaignOccupation.stages)) raw.progress.campaignOccupation.stages = [];
            raw.progress.campaignOccupation.view = migrateView(raw.progress.campaignOccupation.view);
        }

        if (!raw.progress.campaignSkirmish) {
            raw.progress.campaignSkirmish = {
                stages: [],
                selectedStageId: null,
                view: { x: 0, y: 0, scale: 1.2 }
            };
        } else {
            if (!Array.isArray(raw.progress.campaignSkirmish.stages)) raw.progress.campaignSkirmish.stages = [];
            raw.progress.campaignSkirmish.view = migrateView(raw.progress.campaignSkirmish.view);
        }

        raw.version = 1;
        return raw;
    },

    // ---- (3) 로드/세이브 ----

    load() {
        const tryParse = (key) => {
            try {
                const s = localStorage.getItem(key);
                if (!s) return null;
                const parsed = JSON.parse(s);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (e) { }
            return null;
        };

        const fb = (typeof RECLAIM_FB !== 'undefined' && RECLAIM_FB) ? RECLAIM_FB : null;
        const saveBridge = (typeof RECLAIM_SAVE !== 'undefined' && RECLAIM_SAVE) ? RECLAIM_SAVE : null;
        const authApi = (typeof CitySimAuth !== 'undefined' && CitySimAuth) ? CitySimAuth : null;
        const user = (fb && typeof fb.getUser === 'function') ? fb.getUser() : null;
        const isAnonAuthUser = !!(user && user.uid && user.isAnonymous === true);
        const rawGuestSession = !!(authApi && typeof authApi.isGuestSession === 'function' && authApi.isGuestSession());
        const guestSession = isAnonAuthUser || (rawGuestSession && !user);
        const uid = user && user.uid ? String(user.uid) : '';
        const hasUid = uid.length > 0;
        const authTransitioning = !!(authApi && typeof authApi.isAuthTransitioning === 'function' && authApi.isAuthTransitioning());
        const firebaseReady = !!(fb && typeof fb.isReady === 'function' && fb.isReady());
        const localOwnerUid = readLocalOwnerUidForDebug(this.STORAGE_KEY);
        const unresolvedUidBootFallbackAllowed = (!hasUid
            && !guestSession
            && !authTransitioning
            && (!firebaseReady || !localOwnerUid));
        const localOwnedByUid = guestSession
            ? false
            : ((!saveBridge || typeof saveBridge.isLocalOwnedBy !== 'function')
                ? true
                : (!hasUid ? unresolvedUidBootFallbackAllowed : !!saveBridge.isLocalOwnedBy('main', uid)));
        logLoginDebug('load.guard', {
            uid,
            hasUid,
            guestSession,
            storageKey: this.STORAGE_KEY,
            localOwnerUid,
            localOwnedByUid,
            authTransitioning,
            firebaseReady,
            unresolvedUidBootFallbackAllowed
        });

        if (uid && saveBridge && typeof saveBridge.getCachedMain === 'function') {
            const cachedMain = saveBridge.getCachedMain(uid);
            if (cachedMain && typeof cachedMain === 'object') {
                return this.migrate(cachedMain);
            }
        }

        if (!localOwnedByUid) {
            if (guestSession) {
                logLoginDebug('load.skip.guest_session', {
                    uid,
                    hasUid,
                    guestSession,
                    storageKey: this.STORAGE_KEY
                });
            }
            if (!hasUid) {
                logLoginDebug('load.skip.uid_unresolved_guard', {
                    uid,
                    hasUid,
                    guestSession,
                    storageKey: this.STORAGE_KEY,
                    localOwnerUid,
                    authTransitioning,
                    firebaseReady
                });
            }
            return this.migrate(null);
        }

        // 1. 메인 저장 시도
        let data = tryParse(this.STORAGE_KEY);
        if (data) return this.migrate(data);

        // 2. BAK1 복구 시도
        data = tryParse(this.BACKUP_KEY_1);
        if (data) {
            console.warn('[APP] Main save corrupted, restored from BAK1');
            return this.migrate(data);
        }

        // 3. BAK2 복구 시도
        data = tryParse(this.BACKUP_KEY_2);
        if (data) {
            console.warn('[APP] Main save corrupted, restored from BAK2');
            return this.migrate(data);
        }

        // 4. 전부 실패 → 초기화
        return this.migrate(null);
    },


    saveNow(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const requireCloud = opts.requireCloud === true;
        const state = this._makeState();
        const fb = (typeof RECLAIM_FB !== 'undefined' && RECLAIM_FB) ? RECLAIM_FB : null;
        const saveBridge = (typeof RECLAIM_SAVE !== 'undefined' && RECLAIM_SAVE) ? RECLAIM_SAVE : null;
        const user = (fb && typeof fb.getUser === 'function') ? fb.getUser() : null;
        const isAnonAuthUser = !!(user && user.uid && user.isAnonymous === true);
        const uid = user && user.uid ? String(user.uid) : '';
        const authApi = (typeof CitySimAuth !== 'undefined' && CitySimAuth) ? CitySimAuth : null;
        const rawGuestSession = !!(authApi && typeof authApi.isGuestSession === 'function' && authApi.isGuestSession());
        const guestSession = isAnonAuthUser || (rawGuestSession && !user);
        const authTransitioning = !!(authApi && typeof authApi.isAuthTransitioning === 'function' && authApi.isAuthTransitioning());
        const blockLocalWriteForUidTransition = (!guestSession && !uid && authTransitioning);
        let mainCloudMode = 'none';
        logLoginDebug('save.snapshot', {
            requireCloud,
            uid,
            hasUid: uid.length > 0,
            guestSession,
            authTransitioning,
            blockLocalWriteForUidTransition,
            summary: summarizeProgress(state.progress)
        });
        let cloudSavePromise = Promise.resolve(true);

        if (!guestSession && uid && saveBridge && typeof saveBridge.saveMain === 'function') {
            const isReady = (!authApi || typeof authApi.isCloudSyncReady !== 'function')
                ? true
                : !!authApi.isCloudSyncReady(uid);

            const enqueueCloudSave = () => {
                try {
                    return Promise.resolve(saveBridge.saveMain(uid, state))
                        .then(() => true)
                        .catch((err) => {
                            console.warn('[APP] cloud save failed(main):', err);
                            return false;
                        });
                } catch (err) {
                    console.warn('[APP] cloud save enqueue failed(main):', err);
                    return Promise.resolve(false);
                }
            };

            const ensureAndSaveMain = () => {
                if (authApi && typeof authApi.ensureCloudReadyForSave === 'function') {
                    return Promise.resolve(authApi.ensureCloudReadyForSave(uid, game))
                        .then((ready) => {
                            if (!ready) return false;
                            return enqueueCloudSave();
                        })
                        .catch((err) => {
                            console.warn('[APP] ensureCloudReadyForSave failed(main):', err);
                            return false;
                        });
                }
                return Promise.resolve(false);
            };

            if (isReady) {
                mainCloudMode = 'direct';
                cloudSavePromise = enqueueCloudSave();
            } else if (requireCloud) {
                if (this._pendingMainCloudSave && this._pendingMainCloudUid === uid) {
                    mainCloudMode = 'reuse_pending';
                    cloudSavePromise = this._pendingMainCloudSave;
                } else {
                    mainCloudMode = 'ensure_then_save';
                    cloudSavePromise = ensureAndSaveMain();
                }
            } else {
                // 로그인 직후에도 1개의 pending 작업으로 클라우드 저장을 끝까지 재시도한다.
                mainCloudMode = 'pending_background';
                this._dirty = true;
                if (!this._pendingMainCloudSave || this._pendingMainCloudUid !== uid) {
                    this._pendingMainCloudUid = uid;
                    this._pendingMainCloudSave = ensureAndSaveMain()
                        .then((ok) => {
                            if (!ok) this._dirty = true;
                            return ok;
                        })
                        .finally(() => {
                            if (this._pendingMainCloudUid === uid) {
                                this._pendingMainCloudUid = '';
                                this._pendingMainCloudSave = null;
                            }
                        });
                }
                cloudSavePromise = Promise.resolve(true);
            }
        }

        if (guestSession) {
            logLoginDebug('save.local.skip.guest_session', {
                uid,
                guestSession,
                requireCloud,
                authTransitioning,
                storageKey: this.STORAGE_KEY
            });
            return cloudSavePromise;
        }

        if (blockLocalWriteForUidTransition) {
            logLoginDebug('save.local.skip.transition_uid_unresolved', {
                uid,
                guestSession,
                requireCloud,
                authTransitioning,
                storageKey: this.STORAGE_KEY
            });
            return cloudSavePromise;
        }

        try {
            // 롤링 백업: 현재 BAK1 → BAK2로, 현재 STATE → BAK1으로
            const currentBak1 = localStorage.getItem(this.BACKUP_KEY_1);
            if (currentBak1) {
                localStorage.setItem(this.BACKUP_KEY_2, currentBak1);
            }
            const currentState = localStorage.getItem(this.STORAGE_KEY);
            if (currentState) {
                localStorage.setItem(this.BACKUP_KEY_1, currentState);
            }

            // 새 상태 저장
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
            if (saveBridge && typeof saveBridge.setLocalOwner === 'function') {
                saveBridge.setLocalOwner('main', guestSession ? '' : (uid || ''));
            }
            this._lastSaveAt = performance.now ? performance.now() : Date.now();
            logLoginDebug('save.local.done', {
                uid,
                guestSession,
                requireCloud,
                mainCloudMode,
                storageKey: this.STORAGE_KEY
            });
        } catch (e) {
            if (uid) {
                this._lastSaveAt = performance.now ? performance.now() : Date.now();
            }
            // localStorage 불가 환경이면 조용히 무시
            logLoginDebug('save.local.error', {
                uid,
                guestSession,
                requireCloud,
                mainCloudMode,
                message: String(e && e.message || '')
            });
        }
        logLoginDebug('save.return', {
            uid,
            guestSession,
            requireCloud,
            mainCloudMode
        });
        return cloudSavePromise;
    },

    // ---- (4) 게임에 적용(최소: speed/difficulty/lastMapId) ----

    loadIntoGame() {
        const st = this.load();
        logLoginDebug('load.snapshot', {
            summary: summarizeProgress(st && st.progress ? st.progress : null)
        });

        // speed 적용
        if (st.settings && Number.isFinite(st.settings.speed)) {
            game.setSpeed(st.settings.speed); // 내부에서 ui 버튼도 갱신됨
        }

        // difficulty는 AI가 가지고 있으면 반영
        if (typeof AI !== 'undefined') {
            if (typeof AI.setDifficulty === 'function') AI.setDifficulty('elite');
            else AI.difficulty = 'elite';
        }

        // lastMapId(있으면) 보관만 해둠 (현재 코드에서 map선택 로직이 있으면 연결 가능)
        if (st.settings && st.settings.lastMapId) {
            game.currentMapId = st.settings.lastMapId;
        }

        if (!game.settings || typeof game.settings !== 'object') game.settings = {};
        game.settings.iogAlwaysOpen = !!(st.settings && st.settings.iogAlwaysOpen === true);

        if (st.progress && Array.isArray(st.progress.clearedMaps)) {
            game.clearedMaps = st.progress.clearedMaps.slice(0);
        }
        game.firstRunDone = !!(st.progress && st.progress.firstRunDone);
        game.devUnlockAllMaps = !!(st.progress && st.progress.devUnlockAllMaps);

        // 캠페인 탭
        game.activeCampaignTab = st.progress?.activeCampaignTab || 'skirmish';

        // 점령전 데이터 로드
        const occupationData = st.progress?.campaignOccupation || {};
        game.campaignOccupation.stages = Array.isArray(occupationData.stages) ? occupationData.stages.slice(0) : [];
        game.campaignOccupation.selectedStageId = Number.isFinite(Number(occupationData.selectedStageId))
            ? Math.floor(Number(occupationData.selectedStageId)) : null;
        game.campaignOccupation.view = {
            x: Number(occupationData.view?.x) || 0,
            y: Number(occupationData.view?.y) || 0,
            scale: Math.max(0.8, Math.min(2.5, Number(occupationData.view?.scale) || 1.2))
        };

        // 국지전 데이터 로드
        const skirmishData = st.progress?.campaignSkirmish || {};
        game.campaignSkirmish.stages = Array.isArray(skirmishData.stages) ? skirmishData.stages.slice(0) : [];
        game.campaignSkirmish.selectedStageId = Number.isFinite(Number(skirmishData.selectedStageId))
            ? Math.floor(Number(skirmishData.selectedStageId)) : null;
        game.campaignSkirmish.view = {
            x: Number(skirmishData.view?.x) || 0,
            y: Number(skirmishData.view?.y) || 0,
            scale: Math.max(0.8, Math.min(2.5, Number(skirmishData.view?.scale) || 1.2))
        };

        // 하위 호환: 기존 campaignStages 필드
        if (st.progress && Array.isArray(st.progress.campaignStages)) {
            game.campaignStages = st.progress.campaignStages.slice(0);
        }
        game.campaignSelectedStageId = Number.isFinite(Number(st.progress?.campaignSelectedStageId))
            ? Math.floor(Number(st.progress.campaignSelectedStageId))
            : null;
        game.campaignThreatLevel = Number.isFinite(Number(st.progress?.campaignThreatLevel))
            ? Math.max(1, Math.min(10, Math.floor(Number(st.progress.campaignThreatLevel))))
            : 1;
        game.campaignView = {
            x: Number(st.progress?.campaignView?.x) || 0,
            y: Number(st.progress?.campaignView?.y) || 0,
            scale: Math.max(0.8, Math.min(2.5, Number(st.progress?.campaignView?.scale) || 1.2))
        };
        const pickQuestState = (primary, secondary) => {
            const toState = (value) => (value && typeof value === 'object') ? value : null;
            const cloneState = (value) => {
                if (!value || typeof value !== 'object') return null;
                try {
                    return JSON.parse(JSON.stringify(value));
                } catch (_) {
                    return value;
                }
            };
            const statusRank = (status) => {
                const key = String(status || '').trim();
                if (key === 'claimed') return 2;
                if (key === 'claimable') return 1;
                return 0;
            };
            const recurringQuestIdSet = new Set(['kill_contract', 'victory_contract']);
            const isRecurringQuestId = (questId) => recurringQuestIdSet.has(String(questId || '').trim());
            const mergeQuestState = (preferred, fallback) => {
                const base = cloneState(preferred) || {};
                const other = cloneState(fallback) || {};

                const baseQuests = (base.quests && typeof base.quests === 'object') ? base.quests : {};
                const otherQuests = (other.quests && typeof other.quests === 'object') ? other.quests : {};
                base.quests = baseQuests;

                Object.keys(otherQuests).forEach((id) => {
                    const src = otherQuests[id];
                    if (!src || typeof src !== 'object') return;

                    const dst = baseQuests[id];
                    if (!dst || typeof dst !== 'object') {
                        baseQuests[id] = src;
                        return;
                    }

                    const recurring = isRecurringQuestId(id);
                    const srcTier = Math.max(1, Math.floor(Number(src.tier) || 1));
                    const dstTier = Math.max(1, Math.floor(Number(dst.tier) || 1));
                    if (recurring && srcTier !== dstTier) {
                        if (srcTier > dstTier) {
                            dst.tier = srcTier;
                            const srcTarget = Math.max(0, Math.floor(Number(src.target) || 0));
                            const srcProgress = Math.max(0, Math.floor(Number(src.progress) || 0));
                            if (srcTarget > 0) dst.target = srcTarget;
                            dst.progress = srcProgress;
                            if (src.reward && typeof src.reward === 'object') {
                                dst.reward = cloneState(src.reward) || src.reward;
                            }
                            if (typeof src.missionName === 'string' && src.missionName.trim()) {
                                dst.missionName = src.missionName;
                            }
                            if (typeof src.actionName === 'string' && src.actionName.trim()) {
                                dst.actionName = src.actionName;
                            }
                            if (typeof src.status === 'string' && src.status.trim()) {
                                dst.status = src.status;
                            }
                        }
                        return;
                    }

                    const srcRank = statusRank(src.status);
                    const dstRank = statusRank(dst.status);
                    if (srcRank > dstRank) {
                        dst.status = src.status;
                    }

                    const srcProgress = Math.max(0, Math.floor(Number(src.progress) || 0));
                    const dstProgress = Math.max(0, Math.floor(Number(dst.progress) || 0));
                    dst.progress = Math.max(dstProgress, srcProgress);

                    const dstTarget = Math.max(0, Math.floor(Number(dst.target) || 0));
                    const srcTarget = Math.max(0, Math.floor(Number(src.target) || 0));
                    if (srcTarget > 0 && dstTarget <= 0) dst.target = srcTarget;

                    // One-time/legacy quests must never regress from claimed to other states.
                    if (!isRecurringQuestId(id) && (statusRank(dst.status) >= 2 || srcRank >= 2)) {
                        dst.status = 'claimed';
                        dst.progress = Math.max(dst.progress, dstTarget, srcTarget);
                    }
                });

                const baseTiers = (base.tiers && typeof base.tiers === 'object') ? base.tiers : {};
                const otherTiers = (other.tiers && typeof other.tiers === 'object') ? other.tiers : {};
                base.tiers = baseTiers;
                ['kill', 'win', 'level'].forEach((key) => {
                    const a = Math.max(1, Math.floor(Number(baseTiers[key]) || 1));
                    const b = Math.max(1, Math.floor(Number(otherTiers[key]) || 1));
                    baseTiers[key] = Math.max(a, b);
                });
                const mergedKillTier = Math.max(1, Math.floor(Number(baseQuests.kill_contract?.tier) || baseTiers.kill || 1));
                const mergedWinTier = Math.max(1, Math.floor(Number(baseQuests.victory_contract?.tier) || baseTiers.win || 1));
                baseTiers.kill = Math.max(baseTiers.kill, mergedKillTier);
                baseTiers.win = Math.max(baseTiers.win, mergedWinTier);

                const baseCounters = (base.counters && typeof base.counters === 'object') ? base.counters : {};
                const otherCounters = (other.counters && typeof other.counters === 'object') ? other.counters : {};
                base.counters = baseCounters;
                ['kill', 'win', 'levelUp'].forEach((key) => {
                    const a = Math.max(0, Math.floor(Number(baseCounters[key]) || 0));
                    const b = Math.max(0, Math.floor(Number(otherCounters[key]) || 0));
                    baseCounters[key] = Math.max(a, b);
                });

                const baseMeta = (base.meta && typeof base.meta === 'object') ? base.meta : {};
                const otherMeta = (other.meta && typeof other.meta === 'object') ? other.meta : {};
                base.meta = baseMeta;
                baseMeta.lastLevel = Math.max(
                    1,
                    Math.floor(Number(baseMeta.lastLevel) || 1),
                    Math.floor(Number(otherMeta.lastLevel) || 1)
                );
                baseMeta.loginSupplyClaimed = (baseMeta.loginSupplyClaimed === true) || (otherMeta.loginSupplyClaimed === true);
                baseMeta.skirmishFirstWinClaimed = (baseMeta.skirmishFirstWinClaimed === true) || (otherMeta.skirmishFirstWinClaimed === true);
                const permanentA = Array.isArray(baseMeta.permanentClaimed) ? baseMeta.permanentClaimed : [];
                const permanentB = Array.isArray(otherMeta.permanentClaimed) ? otherMeta.permanentClaimed : [];
                const permanentSet = new Set();
                permanentA.concat(permanentB).forEach((id) => {
                    const key = String(id || '').trim();
                    if (!key || isRecurringQuestId(key)) return;
                    permanentSet.add(key);
                });
                Object.keys(baseQuests).forEach((id) => {
                    const quest = baseQuests[id];
                    if (!quest || typeof quest !== 'object') return;
                    const key = String(id || '').trim();
                    if (!key || isRecurringQuestId(key)) return;
                    if (String(quest.status || '') !== 'claimed') return;
                    permanentSet.add(key);
                });
                baseMeta.permanentClaimed = Array.from(permanentSet);
                baseMeta.loginSupplyClaimed = baseMeta.loginSupplyClaimed === true || permanentSet.has('login_supply_box');
                baseMeta.skirmishFirstWinClaimed = baseMeta.skirmishFirstWinClaimed === true || permanentSet.has('skirmish_first_win_supply_box');

                return base;
            };
            const a = toState(primary);
            const b = toState(secondary);
            if (!a && !b) return null;
            if (a && !b) return a;
            if (!a && b) return b;

            const score = (state) => {
                if (!state || typeof state !== 'object') return 0;
                const counters = (state.counters && typeof state.counters === 'object') ? state.counters : {};
                const quests = (state.quests && typeof state.quests === 'object') ? state.quests : {};
                let claimed = 0;
                Object.keys(quests).forEach((id) => {
                    if (String(quests[id]?.status || '') === 'claimed') claimed += 1;
                });
                const kill = Math.max(0, Math.floor(Number(counters.kill) || 0));
                const win = Math.max(0, Math.floor(Number(counters.win) || 0));
                const levelUp = Math.max(0, Math.floor(Number(counters.levelUp) || 0));
                return (claimed * 1000000) + (kill * 1000) + (win * 100) + levelUp;
            };

            const aScore = score(a);
            const bScore = score(b);
            const preferred = (aScore >= bScore) ? a : b;
            const fallback = (preferred === a) ? b : a;
            return mergeQuestState(preferred, fallback);
        };
        const applyLegacyQuestClaims = (state, legacyFlags) => {
            if (!state || typeof state !== 'object') return state;
            const flags = (legacyFlags && typeof legacyFlags === 'object') ? legacyFlags : null;
            if (!flags) return state;

            const clone = (value) => {
                try {
                    return JSON.parse(JSON.stringify(value));
                } catch (_) {
                    return value;
                }
            };
            const next = clone(state) || {};
            const ensureQuestClaimed = (questId) => {
                if (!questId) return;
                if (!next.quests || typeof next.quests !== 'object') return;
                const quest = next.quests[questId];
                if (!quest || typeof quest !== 'object') return;
                const target = Math.max(1, Math.floor(Number(quest.target) || 1));
                quest.progress = Math.max(target, Math.floor(Number(quest.progress) || 0));
                quest.status = 'claimed';
            };
            const claimIds = [];
            if (flags.buildBarracksRewardClaimed === true) claimIds.push('build_barracks');
            if (flags.loginSupplyRewardClaimed === true) claimIds.push('login_supply_box');
            if (flags.skirmishFirstWinRewardClaimed === true) claimIds.push('skirmish_first_win_supply_box');
            if (claimIds.length <= 0) return next;

            const nextMeta = (next.meta && typeof next.meta === 'object') ? next.meta : {};
            next.meta = nextMeta;
            const permanentSet = new Set(
                (Array.isArray(nextMeta.permanentClaimed) ? nextMeta.permanentClaimed : [])
                    .map((id) => String(id || '').trim())
                    .filter(Boolean)
            );

            claimIds.forEach((id) => {
                permanentSet.add(id);
                ensureQuestClaimed(id);
            });

            nextMeta.permanentClaimed = Array.from(permanentSet);
            if (permanentSet.has('login_supply_box')) nextMeta.loginSupplyClaimed = true;
            if (permanentSet.has('skirmish_first_win_supply_box')) nextMeta.skirmishFirstWinClaimed = true;
            return next;
        };

        const mainQuestMission = (st.progress?.cityQuestMission && typeof st.progress.cityQuestMission === 'object')
            ? st.progress.cityQuestMission
            : null;
        const fb = (typeof RECLAIM_FB !== 'undefined' && RECLAIM_FB) ? RECLAIM_FB : null;
        const saveBridge = (typeof RECLAIM_SAVE !== 'undefined' && RECLAIM_SAVE) ? RECLAIM_SAVE : null;
        const authApi = (typeof CitySimAuth !== 'undefined' && CitySimAuth) ? CitySimAuth : null;
        const user = (fb && typeof fb.getUser === 'function') ? fb.getUser() : null;
        const isAnonAuthUser = !!(user && user.uid && user.isAnonymous === true);
        const rawGuestSession = !!(authApi && typeof authApi.isGuestSession === 'function' && authApi.isGuestSession());
        const guestSession = isAnonAuthUser || (rawGuestSession && !user);
        const uid = user && user.uid ? String(user.uid) : '';
        const hasUid = uid.length > 0;
        const authTransitioning = !!(authApi && typeof authApi.isAuthTransitioning === 'function' && authApi.isAuthTransitioning());
        const firebaseReady = !!(fb && typeof fb.isReady === 'function' && fb.isReady());
        const localOwnerUid = readLocalOwnerUidForDebug(this.STORAGE_KEY);
        const unresolvedUidBootFallbackAllowed = (!hasUid
            && !guestSession
            && !authTransitioning
            && (!firebaseReady || !localOwnerUid));
        const localOwnedByUid = guestSession
            ? false
            : ((!saveBridge || typeof saveBridge.isLocalOwnedBy !== 'function')
                ? true
                : (!hasUid ? unresolvedUidBootFallbackAllowed : !!saveBridge.isLocalOwnedBy('main', uid)));
        const allowRuntimeQuestFallback = (
            !guestSession
            && localOwnedByUid
            && !!mainQuestMission
        );
        const existingQuestMission = (allowRuntimeQuestFallback
            && game.cityQuestMission
            && typeof game.cityQuestMission === 'object')
            ? game.cityQuestMission
            : null;
        const questMissionPayload = pickQuestState(mainQuestMission, existingQuestMission);
        const questMissionWithLegacy = applyLegacyQuestClaims(questMissionPayload, st.progress?.cityQuest);

        if (typeof CityQuestMission !== 'undefined' && CityQuestMission && typeof CityQuestMission.hydrate === 'function') {
            CityQuestMission.hydrate(game, questMissionWithLegacy);
        } else {
            game.cityQuestMission = questMissionWithLegacy;
        }
        game.ensureCampaignProgress();
        if (typeof game.refreshCityQuestPanel === 'function') {
            game.refreshCityQuestPanel();
        }

        this._dirty = true;
        logLoginDebug('load.applied', {
            summary: summarizeGameProgress()
        });
    },

    };

    global.GameAppPersistence = appPersistence;
})(window);
