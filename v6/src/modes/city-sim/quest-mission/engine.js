(function (global) {
    const C = global.CityQuestMissionConstants || {};
    const Schema = global.CityQuestMissionSchema || {};

    const QUEST_STATUS = C.QUEST_STATUS || Schema.QUEST_STATUS || {
        IN_PROGRESS: 'in_progress',
        CLAIMABLE: 'claimable',
        CLAIMED: 'claimed'
    };

    const QUEST_STATUS_LABELS = C.QUEST_STATUS_LABELS || {
        [QUEST_STATUS.IN_PROGRESS]: '진행 중',
        [QUEST_STATUS.CLAIMABLE]: '지급 가능',
        [QUEST_STATUS.CLAIMED]: '지급 완료'
    };

    const FALLBACK_QUEST_IDS = {
        BUILD_BARRACKS: 'build_barracks',
        BUILD_FACTORY: 'build_factory',
        BUILD_POWERPLANT: 'build_powerplant',
        BUILD_HOUSE_3: 'build_house_3',
        BUILD_OILRIG: 'build_oilrig',
        BUILD_AIRPORT: 'build_airport',
        PLANT_TREE_5: 'plant_tree_5',
        LOGIN_SUPPLY_BOX: 'login_supply_box',
        SKIRMISH_FIRST_WIN_SUPPLY_BOX: 'skirmish_first_win_supply_box',
        KILL_CONTRACT: 'kill_contract',
        VICTORY_CONTRACT: 'victory_contract',
        LEVEL_BONUS_PRIVATE: 'level_bonus_private',
        LEVEL_BONUS_SERGEANT: 'level_bonus_sergeant',
        LEVEL_BONUS_STAFF_SERGEANT: 'level_bonus_staff_sergeant',
        LEVEL_BONUS_SECOND_LIEUTENANT: 'level_bonus_second_lieutenant',
        LEVEL_BONUS_LIEUTENANT_COLONEL: 'level_bonus_lieutenant_colonel',
        LEVEL_CONTRACT: 'level_contract'
    };

    const RAW_QUEST_IDS = (C.QUEST_IDS && typeof C.QUEST_IDS === 'object')
        ? C.QUEST_IDS
        : ((Schema.QUEST_IDS && typeof Schema.QUEST_IDS === 'object') ? Schema.QUEST_IDS : {});

    const QUEST_IDS = {
        BUILD_BARRACKS: String(RAW_QUEST_IDS.BUILD_BARRACKS || FALLBACK_QUEST_IDS.BUILD_BARRACKS),
        BUILD_FACTORY: String(RAW_QUEST_IDS.BUILD_FACTORY || FALLBACK_QUEST_IDS.BUILD_FACTORY),
        BUILD_POWERPLANT: String(RAW_QUEST_IDS.BUILD_POWERPLANT || FALLBACK_QUEST_IDS.BUILD_POWERPLANT),
        BUILD_HOUSE_3: String(RAW_QUEST_IDS.BUILD_HOUSE_3 || FALLBACK_QUEST_IDS.BUILD_HOUSE_3),
        BUILD_OILRIG: String(RAW_QUEST_IDS.BUILD_OILRIG || FALLBACK_QUEST_IDS.BUILD_OILRIG),
        BUILD_AIRPORT: String(RAW_QUEST_IDS.BUILD_AIRPORT || FALLBACK_QUEST_IDS.BUILD_AIRPORT),
        PLANT_TREE_5: String(RAW_QUEST_IDS.PLANT_TREE_5 || FALLBACK_QUEST_IDS.PLANT_TREE_5),
        LOGIN_SUPPLY_BOX: String(RAW_QUEST_IDS.LOGIN_SUPPLY_BOX || FALLBACK_QUEST_IDS.LOGIN_SUPPLY_BOX),
        SKIRMISH_FIRST_WIN_SUPPLY_BOX: String(RAW_QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX || FALLBACK_QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX),
        KILL_CONTRACT: String(RAW_QUEST_IDS.KILL_CONTRACT || FALLBACK_QUEST_IDS.KILL_CONTRACT),
        VICTORY_CONTRACT: String(RAW_QUEST_IDS.VICTORY_CONTRACT || FALLBACK_QUEST_IDS.VICTORY_CONTRACT),
        LEVEL_BONUS_PRIVATE: String(RAW_QUEST_IDS.LEVEL_BONUS_PRIVATE || FALLBACK_QUEST_IDS.LEVEL_BONUS_PRIVATE),
        LEVEL_BONUS_SERGEANT: String(RAW_QUEST_IDS.LEVEL_BONUS_SERGEANT || FALLBACK_QUEST_IDS.LEVEL_BONUS_SERGEANT),
        LEVEL_BONUS_STAFF_SERGEANT: String(RAW_QUEST_IDS.LEVEL_BONUS_STAFF_SERGEANT || FALLBACK_QUEST_IDS.LEVEL_BONUS_STAFF_SERGEANT),
        LEVEL_BONUS_SECOND_LIEUTENANT: String(RAW_QUEST_IDS.LEVEL_BONUS_SECOND_LIEUTENANT || FALLBACK_QUEST_IDS.LEVEL_BONUS_SECOND_LIEUTENANT),
        LEVEL_BONUS_LIEUTENANT_COLONEL: String(RAW_QUEST_IDS.LEVEL_BONUS_LIEUTENANT_COLONEL || FALLBACK_QUEST_IDS.LEVEL_BONUS_LIEUTENANT_COLONEL),
        LEVEL_CONTRACT: String(RAW_QUEST_IDS.LEVEL_CONTRACT || FALLBACK_QUEST_IDS.LEVEL_CONTRACT)
    };

    const LEVEL_BONUS_IDS = (Array.isArray(C.LEVEL_BONUS_IDS) ? C.LEVEL_BONUS_IDS : [
        QUEST_IDS.LEVEL_BONUS_PRIVATE,
        QUEST_IDS.LEVEL_BONUS_SERGEANT,
        QUEST_IDS.LEVEL_BONUS_STAFF_SERGEANT,
        QUEST_IDS.LEVEL_BONUS_SECOND_LIEUTENANT,
        QUEST_IDS.LEVEL_BONUS_LIEUTENANT_COLONEL
    ]).map((id) => String(id || '').trim()).filter(Boolean);

    const QUEST_ORDER_BASE = Array.isArray(C.QUEST_ORDER) ? C.QUEST_ORDER.slice() : [
        QUEST_IDS.BUILD_BARRACKS,
        QUEST_IDS.BUILD_FACTORY,
        QUEST_IDS.BUILD_POWERPLANT,
        QUEST_IDS.BUILD_HOUSE_3,
        QUEST_IDS.BUILD_OILRIG,
        QUEST_IDS.BUILD_AIRPORT,
        QUEST_IDS.PLANT_TREE_5,
        QUEST_IDS.LOGIN_SUPPLY_BOX,
        QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX,
        QUEST_IDS.KILL_CONTRACT,
        QUEST_IDS.VICTORY_CONTRACT,
        ...LEVEL_BONUS_IDS
    ];

    const QUEST_ORDER = [];
    const questOrderSeen = new Set();
    const pushQuestOrder = (value) => {
        const id = String(value == null ? '' : value).trim();
        if (!id || questOrderSeen.has(id)) return;
        questOrderSeen.add(id);
        QUEST_ORDER.push(id);
    };

    QUEST_ORDER_BASE.forEach(pushQuestOrder);
    [
        QUEST_IDS.BUILD_BARRACKS,
        QUEST_IDS.BUILD_FACTORY,
        QUEST_IDS.BUILD_POWERPLANT,
        QUEST_IDS.BUILD_HOUSE_3,
        QUEST_IDS.BUILD_OILRIG,
        QUEST_IDS.BUILD_AIRPORT,
        QUEST_IDS.PLANT_TREE_5,
        QUEST_IDS.LOGIN_SUPPLY_BOX,
        QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX,
        QUEST_IDS.KILL_CONTRACT,
        QUEST_IDS.VICTORY_CONTRACT,
        ...LEVEL_BONUS_IDS
    ].forEach(pushQuestOrder);

    const BUILD_QUEST_SPECS = (
        Array.isArray(Schema.BUILD_QUEST_SPECS)
            ? Schema.BUILD_QUEST_SPECS
            : [
                { id: QUEST_IDS.BUILD_BARRACKS, tools: ['barracks'], target: 1 },
                { id: QUEST_IDS.BUILD_FACTORY, tools: ['factory'], target: 1 },
                { id: QUEST_IDS.BUILD_POWERPLANT, tools: ['powerplant'], target: 1 },
                { id: QUEST_IDS.BUILD_HOUSE_3, tools: ['house'], target: 3 },
                { id: QUEST_IDS.BUILD_OILRIG, tools: ['oilrig'], target: 1 },
                { id: QUEST_IDS.BUILD_AIRPORT, tools: ['airport'], target: 1 },
                { id: QUEST_IDS.PLANT_TREE_5, tools: ['tree'], target: 5 }
            ]
    )
        .map((raw) => {
            const id = String(raw?.id || '').trim();
            const tools = Array.isArray(raw?.tools)
                ? raw.tools.map((tool) => String(tool || '').trim()).filter(Boolean)
                : [];
            const target = Math.max(1, Math.floor(Number(raw?.target) || 1));
            if (!id || tools.length <= 0) return null;
            return {
                id,
                target,
                tools,
                toolSet: new Set(tools)
            };
        })
        .filter(Boolean);
    const BUILD_QUEST_CHAIN_IDS = BUILD_QUEST_SPECS
        .map((spec) => String(spec?.id || '').trim())
        .filter(Boolean);
    const BUILD_QUEST_CHAIN_ID_SET = new Set(BUILD_QUEST_CHAIN_IDS);
    const RECURRING_QUEST_ID_SET = new Set([
        QUEST_IDS.KILL_CONTRACT,
        QUEST_IDS.VICTORY_CONTRACT
    ]);
    const QUEST_CLAIM_LEDGER_STORAGE_KEY = 'reclaim_city_quest_claim_ledger_v1';
    const GUEST_LEDGER_UID = '__guest__';
    let questClaimLedgerCache = null;

    function isFn(value) {
        return typeof value === 'function';
    }

    function isRecurringQuestId(questId) {
        const id = String(questId || '').trim();
        if (!id) return false;
        return RECURRING_QUEST_ID_SET.has(id);
    }

    function isOneTimeQuestId(questId) {
        const id = String(questId || '').trim();
        if (!id) return false;
        return !isRecurringQuestId(id);
    }

    function getAuthUid() {
        if (typeof CitySimAuth !== 'undefined' && CitySimAuth && isFn(CitySimAuth.getCurrentUser)) {
            const user = CitySimAuth.getCurrentUser();
            if (user && user.uid) return String(user.uid);
        }
        if (typeof RECLAIM_FB !== 'undefined' && RECLAIM_FB && isFn(RECLAIM_FB.getUser)) {
            const user = RECLAIM_FB.getUser();
            if (user && user.uid) return String(user.uid);
        }
        return '';
    }

    function getQuestLedgerUid() {
        const uid = String(getAuthUid() || '').trim();
        return uid || GUEST_LEDGER_UID;
    }

    function parseQuestClaimLedger(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        const out = {};
        Object.keys(raw).forEach((uidKey) => {
            const uid = String(uidKey || '').trim();
            if (!uid) return;
            const list = Array.isArray(raw[uidKey]) ? raw[uidKey] : [];
            const set = new Set();
            list.forEach((value) => {
                const id = String(value || '').trim();
                if (!id || !isOneTimeQuestId(id)) return;
                set.add(id);
            });
            if (set.size > 0) {
                out[uid] = Array.from(set);
            }
        });
        return out;
    }

    function readQuestClaimLedger() {
        if (questClaimLedgerCache && typeof questClaimLedgerCache === 'object') {
            return questClaimLedgerCache;
        }
        let parsed = {};
        try {
            const raw = localStorage.getItem(QUEST_CLAIM_LEDGER_STORAGE_KEY);
            if (raw) parsed = JSON.parse(raw);
        } catch (_) {
            parsed = {};
        }
        questClaimLedgerCache = parseQuestClaimLedger(parsed);
        return questClaimLedgerCache;
    }

    function writeQuestClaimLedger(nextLedger) {
        const safe = parseQuestClaimLedger(nextLedger);
        questClaimLedgerCache = safe;
        try {
            localStorage.setItem(QUEST_CLAIM_LEDGER_STORAGE_KEY, JSON.stringify(safe));
        } catch (_) { }
    }

    function getClaimedQuestIdSetFromLedger(uid) {
        const key = String(uid || '').trim();
        if (!key) return new Set();
        const ledger = readQuestClaimLedger();
        const list = Array.isArray(ledger[key]) ? ledger[key] : [];
        const set = new Set();
        list.forEach((value) => {
            const id = String(value || '').trim();
            if (!id || !isOneTimeQuestId(id)) return;
            set.add(id);
        });
        return set;
    }

    function hasQuestBeenClaimedInLedger(uid, questId) {
        const id = String(questId || '').trim();
        if (!id || !isOneTimeQuestId(id)) return false;
        const set = getClaimedQuestIdSetFromLedger(uid);
        return set.has(id);
    }

    function markQuestClaimedInLedger(uid, questId) {
        const key = String(uid || '').trim();
        const id = String(questId || '').trim();
        if (!key || !id || !isOneTimeQuestId(id)) return false;

        const ledger = readQuestClaimLedger();
        const set = new Set(Array.isArray(ledger[key]) ? ledger[key] : []);
        if (set.has(id)) return false;
        set.add(id);
        ledger[key] = Array.from(set);
        writeQuestClaimLedger(ledger);
        return true;
    }

    function getPermanentClaimedSetFromState(state) {
        const set = new Set();
        const meta = (state && state.meta && typeof state.meta === 'object') ? state.meta : {};
        const permanent = Array.isArray(meta.permanentClaimed) ? meta.permanentClaimed : [];
        permanent.forEach((value) => {
            const id = String(value || '').trim();
            if (!id || !isOneTimeQuestId(id)) return;
            set.add(id);
        });
        if (meta.loginSupplyClaimed === true) set.add(QUEST_IDS.LOGIN_SUPPLY_BOX);
        if (meta.skirmishFirstWinClaimed === true) set.add(QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX);
        return set;
    }

    function applyPermanentClaimSetToState(state, claimedSet) {
        if (!state || typeof state !== 'object') return false;
        const set = (claimedSet instanceof Set) ? claimedSet : new Set();
        if (!state.meta || typeof state.meta !== 'object') state.meta = {};

        const current = getPermanentClaimedSetFromState(state);
        set.forEach((id) => {
            const key = String(id || '').trim();
            if (!key || !isOneTimeQuestId(key)) return;
            current.add(key);
        });

        let changed = false;
        const nextPermanent = Array.from(current);
        const prevPermanent = Array.isArray(state.meta.permanentClaimed) ? state.meta.permanentClaimed : [];
        if (nextPermanent.length !== prevPermanent.length
            || nextPermanent.some((id) => !prevPermanent.includes(id))) {
            state.meta.permanentClaimed = nextPermanent;
            changed = true;
        }

        if (current.has(QUEST_IDS.LOGIN_SUPPLY_BOX) && state.meta.loginSupplyClaimed !== true) {
            state.meta.loginSupplyClaimed = true;
            changed = true;
        }
        if (current.has(QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX) && state.meta.skirmishFirstWinClaimed !== true) {
            state.meta.skirmishFirstWinClaimed = true;
            changed = true;
        }

        const quests = (state.quests && typeof state.quests === 'object') ? state.quests : {};
        Object.keys(quests).forEach((id) => {
            const key = String(id || '').trim();
            if (!key || !current.has(key) || !isOneTimeQuestId(key)) return;
            const quest = quests[key];
            if (!quest || typeof quest !== 'object') return;
            const target = Math.max(1, Math.floor(Number(quest.target) || 1));
            const nextProgress = Math.max(target, Math.floor(Number(quest.progress) || 0));
            if (quest.progress !== nextProgress) {
                quest.progress = nextProgress;
                changed = true;
            }
            if (quest.status !== QUEST_STATUS.CLAIMED) {
                quest.status = QUEST_STATUS.CLAIMED;
                changed = true;
            }
        });

        return changed;
    }

    function isQuestPermanentlyClaimed(state, questId, uid) {
        const id = String(questId || '').trim();
        if (!id || !isOneTimeQuestId(id)) return false;
        const permanentSet = getPermanentClaimedSetFromState(state);
        if (permanentSet.has(id)) return true;
        if (hasQuestBeenClaimedInLedger(uid, id)) return true;
        const quest = (state && state.quests && typeof state.quests === 'object') ? state.quests[id] : null;
        if (quest && typeof quest === 'object' && String(quest.status || '') === QUEST_STATUS.CLAIMED) return true;
        return false;
    }

    function syncClaimLedgerFromState(state, uid) {
        const key = String(uid || '').trim();
        if (!key || !state || typeof state !== 'object') return false;

        const questIds = new Set();
        const permanentSet = getPermanentClaimedSetFromState(state);
        permanentSet.forEach((id) => {
            const questId = String(id || '').trim();
            if (!questId || !isOneTimeQuestId(questId)) return;
            questIds.add(questId);
        });

        const quests = (state.quests && typeof state.quests === 'object') ? state.quests : {};
        Object.keys(quests).forEach((id) => {
            const questId = String(id || '').trim();
            if (!questId || !isOneTimeQuestId(questId)) return;
            const quest = quests[questId];
            if (!quest || typeof quest !== 'object') return;
            if (String(quest.status || '') !== QUEST_STATUS.CLAIMED) return;
            questIds.add(questId);
        });

        let changed = false;
        questIds.forEach((id) => {
            if (markQuestClaimedInLedger(key, id)) changed = true;
        });
        return changed;
    }

    function showToast(message, silent) {
        if (silent === true) return;
        const text = String(message || '').trim();
        if (!text) return;
        if (typeof ui !== 'undefined' && ui && isFn(ui.showToast)) {
            ui.showToast(text);
        }
    }

    function persistQuestState(game, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const saveOpts = opts.requireCloud === true ? { requireCloud: true } : undefined;

        if (opts.renderResources === true && game && isFn(game.renderCityResources)) {
            game.renderCityResources();
        }
        if (opts.save === true && game && isFn(game.saveCitySimState)) {
            game.saveCitySimState(saveOpts);
        }
        if (opts.markDirty !== false && typeof app !== 'undefined' && app && isFn(app.markDirty)) {
            app.markDirty();
        }
        if (opts.saveNow === true && typeof app !== 'undefined' && app && isFn(app.saveNow)) {
            app.saveNow(saveOpts);
        }
        if (opts.refreshPanel !== false
            && typeof global.CityQuestMissionUI !== 'undefined'
            && global.CityQuestMissionUI
            && isFn(global.CityQuestMissionUI.renderPanel)) {
            global.CityQuestMissionUI.renderPanel(game);
        }

        showToast(opts.toast, opts.silent === true);
    }

    function ensureState(game) {
        if (!game || typeof game !== 'object') {
            return isFn(Schema.createDefaultState) ? Schema.createDefaultState(null) : null;
        }
        if (!isFn(Schema.normalizeState) || !isFn(Schema.createDefaultState)) {
            if (!game.cityQuestMission || typeof game.cityQuestMission !== 'object') {
                game.cityQuestMission = {};
            }
            return game.cityQuestMission;
        }
        game.cityQuestMission = Schema.normalizeState(game, game.cityQuestMission);
        const ledgerUid = getQuestLedgerUid();
        const ledgerSet = getClaimedQuestIdSetFromLedger(ledgerUid);
        const locked = applyPermanentClaimSetToState(game.cityQuestMission, ledgerSet);
        if (locked && isFn(Schema.syncDerivedFields)) {
            Schema.syncDerivedFields(game.cityQuestMission, game);
        }
        syncClaimLedgerFromState(game.cityQuestMission, ledgerUid);
        return game.cityQuestMission;
    }

    function getQuestById(state, questId) {
        if (!state || typeof state !== 'object') return null;
        if (!state.quests || typeof state.quests !== 'object') return null;
        const id = String(questId || '').trim();
        if (!id) return null;
        const quest = state.quests[id];
        if (!quest || typeof quest !== 'object') return null;
        return quest;
    }

    function getActiveBuildQuestSpec(state) {
        for (let i = 0; i < BUILD_QUEST_SPECS.length; i += 1) {
            const spec = BUILD_QUEST_SPECS[i];
            if (!spec) continue;
            const quest = getQuestById(state, spec.id);
            if (!quest) continue;
            if (quest.status !== QUEST_STATUS.CLAIMED) return spec;
        }
        return null;
    }

    function getLegacyQuestId(questKey) {
        const key = String(questKey || '').trim();
        if (key === QUEST_IDS.BUILD_BARRACKS) return QUEST_IDS.BUILD_BARRACKS;
        if (key === QUEST_IDS.LOGIN_SUPPLY_BOX) return QUEST_IDS.LOGIN_SUPPLY_BOX;
        if (key === QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX) return QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX;
        return '';
    }

    function markLegacyQuest(game, questKey, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const state = ensureState(game);
        const id = getLegacyQuestId(questKey);
        const ledgerUid = getQuestLedgerUid();
        if (!id) {
            persistQuestState(game, { refreshPanel: true, silent: true, markDirty: false });
            return false;
        }

        const locked = applyPermanentClaimSetToState(state, getClaimedQuestIdSetFromLedger(ledgerUid));
        if (locked && isFn(Schema.syncDerivedFields)) {
            Schema.syncDerivedFields(state, game);
        }

        if (isFn(Schema.syncDerivedFields)) {
            Schema.syncDerivedFields(state, game);
        }

        const quest = getQuestById(state, id);
        if (!quest) return false;

        if (isQuestPermanentlyClaimed(state, id, ledgerUid)) {
            const target = Math.max(1, Math.floor(Number(quest.target) || 1));
            quest.progress = Math.max(target, Math.floor(Number(quest.progress) || 0));
            quest.status = QUEST_STATUS.CLAIMED;
            markQuestClaimedInLedger(ledgerUid, id);
            if (isFn(Schema.syncDerivedFields)) {
                Schema.syncDerivedFields(state, game);
            }
            persistQuestState(game, {
                refreshPanel: true,
                save: true,
                markDirty: true,
                saveNow: true,
                requireCloud: true,
                silent: true
            });
            return false;
        }

        let changed = false;
        if (quest.status === QUEST_STATUS.IN_PROGRESS) {
            quest.progress = Math.max(quest.progress, quest.target);
            quest.status = QUEST_STATUS.CLAIMABLE;
            changed = true;
        }

        if (isFn(Schema.syncDerivedFields)) {
            Schema.syncDerivedFields(state, game);
        }

        if (changed) {
            const name = String(quest.missionName || '작전 퀘스트').trim();
            persistQuestState(game, {
                refreshPanel: true,
                save: true,
                markDirty: true,
                saveNow: true,
                requireCloud: true,
                toast: `[퀘스트] ${name} 보상이 지급 가능한 상태입니다.`,
                silent: opts.silent === true
            });
        } else {
            persistQuestState(game, {
                refreshPanel: true,
                markDirty: false,
                silent: true
            });
        }

        return changed;
    }

    function markEvent(game, eventType, payload) {
        const state = ensureState(game);
        const type = String(eventType || '').trim();
        const data = (payload && typeof payload === 'object') ? payload : {};
        let changed = false;
        const notices = [];
        const levelBeforeReady = new Set();

        if (type === 'level_up') {
            LEVEL_BONUS_IDS.forEach((id) => {
                const quest = getQuestById(state, id);
                if (!quest) return;
                if (quest.status === QUEST_STATUS.CLAIMABLE || quest.status === QUEST_STATUS.CLAIMED) {
                    levelBeforeReady.add(id);
                }
            });
        }

        if (type === 'kill') {
            const add = Math.max(0, Schema.clampInt(data.count, 1, 0, 999999));
            if (add <= 0) return false;
            const quest = getQuestById(state, QUEST_IDS.KILL_CONTRACT);
            if (quest) {
                const wasClaimable = quest.progress >= quest.target;
                quest.progress += add;
                state.counters.kill = Math.max(0, Math.floor(Number(state.counters?.kill) || 0) + add);
                const isClaimable = quest.progress >= quest.target;
                if (!wasClaimable && isClaimable) {
                    notices.push('[퀘스트] 섬멸 지령 보상을 수령할 수 있습니다.');
                }
                changed = true;
            }
        } else if (type === 'win') {
            const mode = String(data.mode || '').trim().toLowerCase();
            if (mode !== 'occupation') return false;
            const add = Math.max(0, Schema.clampInt(data.count, 1, 0, 999999));
            if (add <= 0) return false;
            const quest = getQuestById(state, QUEST_IDS.VICTORY_CONTRACT);
            if (quest) {
                const wasClaimable = quest.progress >= quest.target;
                quest.progress += add;
                state.counters.win = Math.max(0, Math.floor(Number(state.counters?.win) || 0) + add);
                const isClaimable = quest.progress >= quest.target;
                if (!wasClaimable && isClaimable) {
                    notices.push('[퀘스트] 점령 보고 보상을 수령할 수 있습니다.');
                }
                changed = true;
            }
        } else if (type === 'build') {
            const tool = String(data.tool || '').trim();
            if (!tool) return false;
            const activeSpec = getActiveBuildQuestSpec(state);
            if (!activeSpec || !activeSpec.toolSet || !activeSpec.toolSet.has(tool)) {
                return false;
            }
            const quest = getQuestById(state, activeSpec.id);
            if (!quest) return false;
            if (quest.status === QUEST_STATUS.CLAIMED || quest.status === QUEST_STATUS.CLAIMABLE) return false;

            const target = Math.max(1, Math.floor(Number(quest.target) || activeSpec.target || 1));
            const before = Math.max(0, Math.floor(Number(quest.progress) || 0));
            if (before >= target) return false;

            const next = Math.min(target, before + 1);
            if (next <= before) return false;
            quest.progress = next;
            changed = true;

            if (before < target && next >= target) {
                const mission = String(quest.missionName || '건설 퀘스트').trim() || '건설 퀘스트';
                notices.push(`[퀘스트] ${mission} 보상을 수령할 수 있습니다.`);
            }
        } else if (type === 'level_up') {
            const add = Math.max(0, Schema.clampInt(data.count, 1, 0, 999999));
            if (add <= 0) return false;
            state.counters.levelUp = Math.max(0, Math.floor(Number(state.counters?.levelUp) || 0) + add);
            changed = true;
        }

        if (changed && isFn(Schema.syncDerivedFields)) {
            Schema.syncDerivedFields(state, game);
        }

        if (changed && type === 'level_up') {
            LEVEL_BONUS_IDS.forEach((id) => {
                if (levelBeforeReady.has(id)) return;
                const quest = getQuestById(state, id);
                if (!quest) return;
                if (quest.status === QUEST_STATUS.CLAIMABLE) {
                    notices.push(`[퀘스트] ${quest.missionName} 보상을 수령할 수 있습니다.`);
                }
            });
        }

        if (changed) {
            persistQuestState(game, {
                refreshPanel: true,
                save: type !== 'kill',
                markDirty: true,
                saveNow: type !== 'kill',
                toast: notices.join(' / '),
                silent: notices.length <= 0
            });
        }
        return changed;
    }

    function applyQuestReward(game, quest, reward) {
        const safeReward = isFn(Schema.normalizeReward) ? Schema.normalizeReward(reward, {}) : reward;
        const money = Math.max(0, Math.floor(Number(safeReward?.money) || 0));
        const gold = Math.max(0, Math.floor(Number(safeReward?.gold) || 0));
        const exp = Math.max(0, Math.floor(Number(safeReward?.exp) || 0));
        const boxType = String(safeReward?.boxType || '').trim();
        const sourceName = String(quest?.missionName || '퀘스트 보상').trim() || '퀘스트 보상';
        let expResult = null;

        if (boxType) {
            let rewardOk = false;
            if (typeof CitySimGacha !== 'undefined' && CitySimGacha && isFn(CitySimGacha.grantQuestReward)) {
                const result = CitySimGacha.grantQuestReward(game, boxType, { source: sourceName });
                rewardOk = !!(result && result.ok === true);
            }
            if (!rewardOk) return { ok: false, expResult: null };
        }

        if ((money > 0 || gold > 0) && typeof CitySimState !== 'undefined' && CitySimState && isFn(CitySimState.mutate)) {
            CitySimState.mutate(game, (draft) => {
                if (!draft.res || typeof draft.res !== 'object') draft.res = {};
                if (money > 0) draft.res.money = Math.max(0, Number(draft.res.money) || 0) + money;
                if (gold > 0) draft.res.gold = Math.max(0, Number(draft.res.gold) || 0) + gold;
            });
        }

        if (exp > 0 && typeof CitySimEconomy !== 'undefined' && CitySimEconomy && isFn(CitySimEconomy.addExp)) {
            expResult = CitySimEconomy.addExp(game, exp, { render: false, save: false });
        }

        return { ok: true, expResult };
    }

    function advanceRecurringQuest(state, questId, game) {
        const level = isFn(Schema.getCityQuestLevel) ? Schema.getCityQuestLevel(game) : 1;

        if (questId === QUEST_IDS.KILL_CONTRACT) {
            const quest = getQuestById(state, QUEST_IDS.KILL_CONTRACT);
            if (!quest) return;
            const overflow = Math.max(0, quest.progress - quest.target);
            quest.tier = Math.max(1, Math.floor(Number(quest.tier) || 1) + 1);
            state.tiers.kill = quest.tier;
            const spec = isFn(Schema.buildKillQuestSpec) ? Schema.buildKillQuestSpec(level, quest.tier) : {
                target: 10,
                rewardMoney: 0,
                rewardGold: 0,
                rewardExp: 0
            };
            quest.target = Math.max(1, Math.floor(Number(spec.target) || 1));
            quest.progress = Math.min(quest.target, overflow);
            quest.reward = isFn(Schema.normalizeReward)
                ? Schema.normalizeReward({
                    money: spec.rewardMoney,
                    gold: spec.rewardGold,
                    exp: spec.rewardExp
                }, quest.reward)
                : quest.reward;
            return;
        }

        if (questId === QUEST_IDS.VICTORY_CONTRACT) {
            const quest = getQuestById(state, QUEST_IDS.VICTORY_CONTRACT);
            if (!quest) return;
            const overflow = Math.max(0, quest.progress - quest.target);
            quest.tier = Math.max(1, Math.floor(Number(quest.tier) || 1) + 1);
            state.tiers.win = quest.tier;
            const spec = isFn(Schema.buildVictoryQuestSpec) ? Schema.buildVictoryQuestSpec(level, quest.tier) : {
                target: 1,
                rewardMoney: 0,
                rewardGold: 0,
                rewardExp: 0
            };
            quest.target = Math.max(1, Math.floor(Number(spec.target) || 1));
            quest.progress = Math.min(quest.target, overflow);
            quest.reward = isFn(Schema.normalizeReward)
                ? Schema.normalizeReward({
                    money: spec.rewardMoney,
                    gold: spec.rewardGold,
                    exp: spec.rewardExp
                }, quest.reward)
                : quest.reward;
            return;
        }
    }

    function claimQuest(game, questId, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const state = ensureState(game);
        const id = String(questId || '').trim();
        const ledgerUid = getQuestLedgerUid();

        const preLocked = applyPermanentClaimSetToState(state, getClaimedQuestIdSetFromLedger(ledgerUid));
        if (preLocked && isFn(Schema.syncDerivedFields)) {
            Schema.syncDerivedFields(state, game);
        }

        if (isFn(Schema.syncDerivedFields)) {
            Schema.syncDerivedFields(state, game);
        }
        const quest = getQuestById(state, id);
        if (!quest) {
            persistQuestState(game, { refreshPanel: true, silent: true, markDirty: false });
            return false;
        }

        if (isOneTimeQuestId(id) && isQuestPermanentlyClaimed(state, id, ledgerUid)) {
            const target = Math.max(1, Math.floor(Number(quest.target) || 1));
            quest.progress = Math.max(target, Math.floor(Number(quest.progress) || 0));
            quest.status = QUEST_STATUS.CLAIMED;
            markQuestClaimedInLedger(ledgerUid, id);
            if (isFn(Schema.syncDerivedFields)) {
                Schema.syncDerivedFields(state, game);
            }
            persistQuestState(game, {
                refreshPanel: true,
                save: true,
                markDirty: true,
                saveNow: true,
                requireCloud: true,
                silent: opts.silent === true,
                toast: '[퀘스트] 이미 수령 완료한 보상입니다.'
            });
            return false;
        }

        if (quest.status !== QUEST_STATUS.CLAIMABLE) {
            persistQuestState(game, { refreshPanel: true, silent: true, markDirty: false });
            return false;
        }

        const rewardLabel = isFn(Schema.formatRewardLabel) ? Schema.formatRewardLabel(quest.reward) : '';
        const rewardResult = applyQuestReward(game, quest, quest.reward);
        if (!rewardResult.ok) {
            persistQuestState(game, {
                refreshPanel: true,
                silent: opts.silent === true,
                toast: '[퀘스트] 보상 지급에 실패했습니다. 잠시 후 다시 시도해 주세요.'
            });
            return false;
        }

        const missionTitle = String(quest.missionName || '작전 퀘스트').trim() || '작전 퀘스트';
        if (id === QUEST_IDS.KILL_CONTRACT || id === QUEST_IDS.VICTORY_CONTRACT) {
            advanceRecurringQuest(state, id, game);
        } else {
            quest.progress = Math.max(quest.progress, quest.target);
            quest.status = QUEST_STATUS.CLAIMED;
            // Lock one-time quests immediately to prevent claimed -> claimable regression during save/load races.
            state.meta = (state.meta && typeof state.meta === 'object') ? state.meta : {};
            const permanent = Array.isArray(state.meta.permanentClaimed) ? state.meta.permanentClaimed : [];
            const permanentSet = new Set(
                permanent
                    .map((value) => String(value || '').trim())
                    .filter(Boolean)
            );
            permanentSet.add(id);
            if (id === QUEST_IDS.LOGIN_SUPPLY_BOX) {
                state.meta.loginSupplyClaimed = true;
            }
            if (id === QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX) {
                state.meta.skirmishFirstWinClaimed = true;
            }
            state.meta.permanentClaimed = Array.from(permanentSet);
            markQuestClaimedInLedger(ledgerUid, id);
        }

        if (isFn(Schema.syncDerivedFields)) {
            Schema.syncDerivedFields(state, game);
        }
        syncClaimLedgerFromState(state, ledgerUid);

        let toastMessage = `[퀘스트] ${missionTitle} 보상 지급 완료`;
        if (rewardLabel) toastMessage = `${toastMessage} (${rewardLabel})`;
        if (rewardResult.expResult && rewardResult.expResult.levelsGained > 0) {
            toastMessage = `${toastMessage} / Lv.${rewardResult.expResult.level} 상승`;
        }

        persistQuestState(game, {
            refreshPanel: true,
            renderResources: true,
            save: true,
            markDirty: true,
            saveNow: true,
            requireCloud: true,
            toast: toastMessage,
            silent: opts.silent === true
        });
        return true;
    }

    function claimAllQuests(game, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const rows = getProgressRows(game);
        const claimableIds = rows.filter((row) => row && row.canClaim).map((row) => row.id);

        if (claimableIds.length <= 0) {
            persistQuestState(game, {
                refreshPanel: true,
                markDirty: false,
                silent: opts.silent === true,
                toast: '[퀘스트] 일괄 수령 가능한 보상이 없습니다.'
            });
            return 0;
        }

        let claimed = 0;
        claimableIds.forEach((id) => {
            if (claimQuest(game, id, { silent: true })) claimed += 1;
        });

        if (claimed > 0) {
            persistQuestState(game, {
                refreshPanel: true,
                renderResources: true,
                save: true,
                markDirty: true,
                saveNow: true,
                requireCloud: true,
                silent: opts.silent === true,
                toast: `[퀘스트] ${claimed}개 보상을 일괄 수령했습니다.`
            });
        }

        return claimed;
    }

    function getProgressRows(game) {
        const state = ensureState(game);
        if (isFn(Schema.syncDerivedFields)) {
            Schema.syncDerivedFields(state, game);
        }

        const levelBonusSet = new Set(LEVEL_BONUS_IDS);
        const currentLevelBonusId = LEVEL_BONUS_IDS.find((levelId) => {
            const q = getQuestById(state, levelId);
            return !!(q && q.status !== QUEST_STATUS.CLAIMED);
        }) || '';
        const activeBuildSpec = getActiveBuildQuestSpec(state);
        const activeBuildQuestId = String(activeBuildSpec?.id || '').trim();

        const ids = [];
        const seen = new Set();
        const pushId = (value) => {
            const id = String(value || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            ids.push(id);
        };
        QUEST_ORDER.forEach(pushId);
        if (state && state.quests && typeof state.quests === 'object') {
            Object.keys(state.quests).forEach(pushId);
        }

        return ids.map((id) => {
            const quest = getQuestById(state, id);
            if (!quest) return null;
            if (BUILD_QUEST_CHAIN_ID_SET.has(id)) {
                if (!activeBuildQuestId) return null;
                if (id !== activeBuildQuestId) return null;
            }
            if (levelBonusSet.has(id)) {
                if (!currentLevelBonusId) return null;
                if (id !== currentLevelBonusId) return null;
            }
            const rewardLabel = isFn(Schema.formatRewardLabel) ? Schema.formatRewardLabel(quest.reward) : '';
            const rewardParts = String(rewardLabel || '')
                .split('·')
                .map((part) => String(part || '').trim())
                .filter(Boolean);
            const statusLabel = QUEST_STATUS_LABELS[quest.status] || QUEST_STATUS_LABELS[QUEST_STATUS.IN_PROGRESS] || '진행 중';
            return {
                id: quest.id,
                type: quest.type,
                title: quest.missionName,
                action: quest.actionName,
                reward: rewardLabel,
                rewardParts,
                status: quest.status,
                statusLabel,
                done: quest.status === QUEST_STATUS.CLAIMED,
                canClaim: quest.status === QUEST_STATUS.CLAIMABLE,
                text: `- ${quest.missionName} : (${quest.actionName})`
            };
        }).filter(Boolean);
    }

    function serialize(game) {
        const state = ensureState(game);
        if (isFn(Schema.cloneState)) {
            return Schema.cloneState(state);
        }
        return state && typeof state === 'object' ? { ...state } : null;
    }

    function hydrate(game, savedState) {
        if (!game || typeof game !== 'object') return null;
        if (!isFn(Schema.normalizeState)) {
            game.cityQuestMission = savedState && typeof savedState === 'object' ? savedState : {};
            return game.cityQuestMission;
        }
        game.cityQuestMission = Schema.normalizeState(game, savedState);
        return game.cityQuestMission;
    }

    function reset(game) {
        if (!game || typeof game !== 'object') return null;
        if (!isFn(Schema.createDefaultState)) {
            game.cityQuestMission = {};
        } else {
            game.cityQuestMission = Schema.createDefaultState(game);
            if (isFn(Schema.syncDerivedFields)) {
                Schema.syncDerivedFields(game.cityQuestMission, game);
            }
        }
        persistQuestState(game, {
            refreshPanel: true,
            markDirty: true,
            silent: true
        });
        return game.cityQuestMission;
    }

    function init(game) {
        ensureState(game);
        persistQuestState(game, {
            refreshPanel: true,
            markDirty: false,
            silent: true
        });
    }

    global.CityQuestMissionEngine = {
        init,
        ensureState,
        getProgressRows,
        markEvent,
        markLegacyQuest,
        claimQuest,
        claimAllQuests,
        serialize,
        hydrate,
        reset
    };
})(window);
