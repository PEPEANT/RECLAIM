(function (global) {
    const C = global.CityQuestMissionConstants || {};

    const QUEST_SCHEMA_VERSION = Number(C.QUEST_SCHEMA_VERSION) || 1;
    const QUEST_STATUS = C.QUEST_STATUS || {
        IN_PROGRESS: 'in_progress',
        CLAIMABLE: 'claimable',
        CLAIMED: 'claimed'
    };
    const QUEST_TYPES = C.QUEST_TYPES || {
        LEGACY_BUILD: 'legacy_build',
        LEGACY_LOGIN: 'legacy_login',
        LEGACY_SKIRMISH_WIN: 'legacy_skirmish_win',
        LEGACY_EVENT: 'legacy_event',
        KILL: 'kill',
        OCCUPATION_WIN: 'occupation_win',
        LEVEL_BONUS: 'level_bonus'
    };

    const DEFAULT_QUEST_IDS = {
        BUILD_BARRACKS: 'build_barracks',
        BUILD_FACTORY: 'build_factory',
        BUILD_POWERPLANT: 'build_powerplant',
        BUILD_HOUSE_3: 'build_house_3',
        BUILD_OILRIG: 'build_oilrig',
        BUILD_AIRPORT: 'build_airport',
        PLANT_TREE_5: 'plant_tree_5',
        LOGIN_SUPPLY_BOX: 'login_supply_box',
        SKIRMISH_FIRST_WIN_SUPPLY_BOX: 'skirmish_first_win_supply_box',
        LUNAR_NEW_YEAR_GIFT: 'lunar_new_year_gift',
        EVENT_V62_SUPPLY_GIFT: 'event_v62_supply_gift',
        EVENT_VETERAN_UPDATE_GIFT: 'event_veteran_update_gift',
        EVENT_VISIT_UPDATE_GIFT: 'event_visit_update_gift',
        KILL_CONTRACT: 'kill_contract',
        VICTORY_CONTRACT: 'victory_contract',
        LEVEL_BONUS_PRIVATE: 'level_bonus_private',
        LEVEL_BONUS_SERGEANT: 'level_bonus_sergeant',
        LEVEL_BONUS_STAFF_SERGEANT: 'level_bonus_staff_sergeant',
        LEVEL_BONUS_SECOND_LIEUTENANT: 'level_bonus_second_lieutenant',
        LEVEL_BONUS_LIEUTENANT_COLONEL: 'level_bonus_lieutenant_colonel',
        LEVEL_CONTRACT: 'level_contract'
    };

    const RAW_QUEST_IDS = (C.QUEST_IDS && typeof C.QUEST_IDS === 'object') ? C.QUEST_IDS : {};
    const QUEST_IDS = {
        BUILD_BARRACKS: String(RAW_QUEST_IDS.BUILD_BARRACKS || DEFAULT_QUEST_IDS.BUILD_BARRACKS),
        BUILD_FACTORY: String(RAW_QUEST_IDS.BUILD_FACTORY || DEFAULT_QUEST_IDS.BUILD_FACTORY),
        BUILD_POWERPLANT: String(RAW_QUEST_IDS.BUILD_POWERPLANT || DEFAULT_QUEST_IDS.BUILD_POWERPLANT),
        BUILD_HOUSE_3: String(RAW_QUEST_IDS.BUILD_HOUSE_3 || DEFAULT_QUEST_IDS.BUILD_HOUSE_3),
        BUILD_OILRIG: String(RAW_QUEST_IDS.BUILD_OILRIG || DEFAULT_QUEST_IDS.BUILD_OILRIG),
        BUILD_AIRPORT: String(RAW_QUEST_IDS.BUILD_AIRPORT || DEFAULT_QUEST_IDS.BUILD_AIRPORT),
        PLANT_TREE_5: String(RAW_QUEST_IDS.PLANT_TREE_5 || DEFAULT_QUEST_IDS.PLANT_TREE_5),
        LOGIN_SUPPLY_BOX: String(RAW_QUEST_IDS.LOGIN_SUPPLY_BOX || DEFAULT_QUEST_IDS.LOGIN_SUPPLY_BOX),
        SKIRMISH_FIRST_WIN_SUPPLY_BOX: String(RAW_QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX || DEFAULT_QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX),
        LUNAR_NEW_YEAR_GIFT: String(RAW_QUEST_IDS.LUNAR_NEW_YEAR_GIFT || DEFAULT_QUEST_IDS.LUNAR_NEW_YEAR_GIFT),
        EVENT_V62_SUPPLY_GIFT: String(RAW_QUEST_IDS.EVENT_V62_SUPPLY_GIFT || DEFAULT_QUEST_IDS.EVENT_V62_SUPPLY_GIFT),
        EVENT_VETERAN_UPDATE_GIFT: String(RAW_QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT || DEFAULT_QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT),
        EVENT_VISIT_UPDATE_GIFT: String(RAW_QUEST_IDS.EVENT_VISIT_UPDATE_GIFT || DEFAULT_QUEST_IDS.EVENT_VISIT_UPDATE_GIFT),
        KILL_CONTRACT: String(RAW_QUEST_IDS.KILL_CONTRACT || DEFAULT_QUEST_IDS.KILL_CONTRACT),
        VICTORY_CONTRACT: String(RAW_QUEST_IDS.VICTORY_CONTRACT || DEFAULT_QUEST_IDS.VICTORY_CONTRACT),
        LEVEL_BONUS_PRIVATE: String(RAW_QUEST_IDS.LEVEL_BONUS_PRIVATE || DEFAULT_QUEST_IDS.LEVEL_BONUS_PRIVATE),
        LEVEL_BONUS_SERGEANT: String(RAW_QUEST_IDS.LEVEL_BONUS_SERGEANT || DEFAULT_QUEST_IDS.LEVEL_BONUS_SERGEANT),
        LEVEL_BONUS_STAFF_SERGEANT: String(RAW_QUEST_IDS.LEVEL_BONUS_STAFF_SERGEANT || DEFAULT_QUEST_IDS.LEVEL_BONUS_STAFF_SERGEANT),
        LEVEL_BONUS_SECOND_LIEUTENANT: String(RAW_QUEST_IDS.LEVEL_BONUS_SECOND_LIEUTENANT || DEFAULT_QUEST_IDS.LEVEL_BONUS_SECOND_LIEUTENANT),
        LEVEL_BONUS_LIEUTENANT_COLONEL: String(RAW_QUEST_IDS.LEVEL_BONUS_LIEUTENANT_COLONEL || DEFAULT_QUEST_IDS.LEVEL_BONUS_LIEUTENANT_COLONEL),
        LEVEL_CONTRACT: String(RAW_QUEST_IDS.LEVEL_CONTRACT || DEFAULT_QUEST_IDS.LEVEL_CONTRACT)
    };

    const LEVEL_BONUS_IDS = (Array.isArray(C.LEVEL_BONUS_IDS) ? C.LEVEL_BONUS_IDS : [
        QUEST_IDS.LEVEL_BONUS_PRIVATE,
        QUEST_IDS.LEVEL_BONUS_SERGEANT,
        QUEST_IDS.LEVEL_BONUS_STAFF_SERGEANT,
        QUEST_IDS.LEVEL_BONUS_SECOND_LIEUTENANT,
        QUEST_IDS.LEVEL_BONUS_LIEUTENANT_COLONEL
    ]).map((id) => String(id || '').trim()).filter(Boolean);

    const DEPRECATED_QUEST_IDS = (Array.isArray(C.DEPRECATED_QUEST_IDS) ? C.DEPRECATED_QUEST_IDS : [
        QUEST_IDS.LEVEL_CONTRACT
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
        QUEST_IDS.LUNAR_NEW_YEAR_GIFT,
        QUEST_IDS.EVENT_V62_SUPPLY_GIFT,
        QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT,
        QUEST_IDS.EVENT_VISIT_UPDATE_GIFT,
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
        QUEST_IDS.LUNAR_NEW_YEAR_GIFT,
        QUEST_IDS.EVENT_V62_SUPPLY_GIFT,
        QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT,
        QUEST_IDS.EVENT_VISIT_UPDATE_GIFT,
        QUEST_IDS.KILL_CONTRACT,
        QUEST_IDS.VICTORY_CONTRACT,
        ...LEVEL_BONUS_IDS
    ].forEach(pushQuestOrder);

    const LEVEL_BONUS_SPECS = [
        { id: QUEST_IDS.LEVEL_BONUS_PRIVATE, targetLevel: 2, rank: '이등병', rewardGold: 4 },
        { id: QUEST_IDS.LEVEL_BONUS_SERGEANT, targetLevel: 4, rank: '병장', rewardGold: 8 },
        { id: QUEST_IDS.LEVEL_BONUS_STAFF_SERGEANT, targetLevel: 5, rank: '하사', rewardGold: 12 },
        { id: QUEST_IDS.LEVEL_BONUS_SECOND_LIEUTENANT, targetLevel: 10, rank: '소위', rewardGold: 16 },
        { id: QUEST_IDS.LEVEL_BONUS_LIEUTENANT_COLONEL, targetLevel: 15, rank: '중령', rewardGold: 20 }
    ].filter((spec) => String(spec.id || '').trim().length > 0);

    const BUILD_QUEST_SPECS = [
        {
            id: QUEST_IDS.BUILD_BARRACKS,
            missionName: '초기 병영 구축',
            actionLabel: '병영 건설',
            target: 1,
            unit: '회',
            reward: { money: 100 },
            tools: ['barracks']
        },
        {
            id: QUEST_IDS.BUILD_FACTORY,
            missionName: '전차기지 구축',
            actionLabel: '전차기지 건설',
            target: 1,
            unit: '회',
            reward: { money: 200 },
            tools: ['factory']
        },
        {
            id: QUEST_IDS.BUILD_POWERPLANT,
            missionName: '연구소 확보',
            actionLabel: '연구소 건설',
            target: 1,
            unit: '회',
            reward: { money: 500 },
            tools: ['powerplant']
        },
        {
            id: QUEST_IDS.BUILD_HOUSE_3,
            missionName: '주거지 확장',
            actionLabel: '회사 건설',
            target: 3,
            unit: '채',
            reward: { money: 700 },
            tools: ['house']
        },
        {
            id: QUEST_IDS.BUILD_OILRIG,
            missionName: '보급망 구축',
            actionLabel: '보급창고 건설',
            target: 1,
            unit: '회',
            reward: { money: 350 },
            tools: ['oilrig']
        },
        {
            id: QUEST_IDS.BUILD_AIRPORT,
            missionName: '항공전력 준비',
            actionLabel: '공항 건설',
            target: 1,
            unit: '회',
            reward: { money: 900 },
            tools: ['airport']
        },
        {
            id: QUEST_IDS.PLANT_TREE_5,
            missionName: '도시 녹지 정비',
            actionLabel: '나무 식재',
            target: 5,
            unit: '그루',
            reward: { money: 250 },
            tools: ['tree']
        }
    ];
    const BUILD_QUEST_CHAIN_IDS = BUILD_QUEST_SPECS
        .map((spec) => toText(spec?.id, ''))
        .filter(Boolean);
    const BUILD_QUEST_CHAIN_SET = new Set(BUILD_QUEST_CHAIN_IDS);
    const PERMANENT_ONE_TIME_QUEST_ID_SET = new Set([
        QUEST_IDS.LOGIN_SUPPLY_BOX,
        QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX,
        QUEST_IDS.LUNAR_NEW_YEAR_GIFT,
        QUEST_IDS.EVENT_V62_SUPPLY_GIFT,
        QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT,
        QUEST_IDS.EVENT_VISIT_UPDATE_GIFT
    ]);

    function clampInt(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
        const parsed = Math.floor(Number(value));
        if (!Number.isFinite(parsed)) {
            return Math.max(min, Math.min(max, Math.floor(Number(fallback) || 0)));
        }
        return Math.max(min, Math.min(max, parsed));
    }

    function toText(value, fallback = '') {
        const text = String(value == null ? '' : value).trim();
        return text || fallback;
    }

    function isPermanentOneTimeQuestId(id) {
        const key = toText(id, '');
        if (!key) return false;
        return PERMANENT_ONE_TIME_QUEST_ID_SET.has(key);
    }

    function normalizePermanentClaimed(rawList) {
        const list = Array.isArray(rawList) ? rawList : [];
        const out = [];
        const seen = new Set();
        list.forEach((value) => {
            const id = toText(value, '');
            if (!id || seen.has(id) || !isPermanentOneTimeQuestId(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function getCityQuestLevel(gameRef) {
        const lv = Math.floor(Number(gameRef?.citySim?.hud?.level) || 1);
        return Math.max(1, Math.min(19, lv));
    }

    function getLoggedInUid() {
        try {
            if (typeof CitySimAuth !== 'undefined' && CitySimAuth && typeof CitySimAuth.getCurrentUser === 'function') {
                const user = CitySimAuth.getCurrentUser();
                if (user && user.uid && user.isAnonymous !== true) return String(user.uid);
            }
        } catch (_) { }
        try {
            if (typeof RECLAIM_FB !== 'undefined' && RECLAIM_FB && typeof RECLAIM_FB.getUser === 'function') {
                const user = RECLAIM_FB.getUser();
                if (user && user.uid && user.isAnonymous !== true) return String(user.uid);
            }
        } catch (_) { }
        return '';
    }

    function buildKillQuestSpec(level, tier) {
        const lv = Math.max(1, Math.min(19, Math.floor(Number(level) || 1)));
        const t = Math.max(1, Math.floor(Number(tier) || 1));
        return {
            target: Math.max(10, Math.floor(10 + (t * 4) + (lv * 2))),
            rewardMoney: Math.floor(220 + (t * 110) + (lv * 45)),
            rewardGold: (t % 4 === 0) ? Math.max(1, Math.floor(lv / 8)) : 0,
            rewardExp: Math.floor(8 + (t * 3) + (lv * 1.5))
        };
    }

    function buildVictoryQuestSpec(level, tier) {
        const lv = Math.max(1, Math.min(19, Math.floor(Number(level) || 1)));
        const t = Math.max(1, Math.floor(Number(tier) || 1));
        return {
            target: Math.max(1, Math.min(6, 1 + Math.floor((t - 1) / 2) + Math.floor((lv - 1) / 8))),
            rewardMoney: Math.floor(360 + (t * 140) + (lv * 55)),
            rewardGold: (t % 5 === 0) ? 1 : 0,
            rewardExp: Math.floor(12 + (t * 4) + (lv * 2))
        };
    }

    // Kept for compatibility with older callers.
    function buildLevelQuestSpec(level, tier) {
        const lv = Math.max(1, Math.min(19, Math.floor(Number(level) || 1)));
        const t = Math.max(1, Math.floor(Number(tier) || 1));
        return {
            targetLevel: Math.max(2, Math.min(19, lv + 1 + Math.floor((t - 1) / 2))),
            rewardMoney: Math.floor(420 + (t * 160) + (lv * 60)),
            rewardGold: Math.max(1, 1 + Math.floor((t - 1) / 3)),
            rewardExp: Math.floor(14 + (t * 4) + (lv * 2))
        };
    }

    function formatNumber(value) {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        try {
            return n.toLocaleString('ko-KR');
        } catch (_) {
            return String(n);
        }
    }

    function normalizeReward(rawReward, fallbackReward) {
        const fallback = (fallbackReward && typeof fallbackReward === 'object') ? fallbackReward : {};
        const reward = (rawReward && typeof rawReward === 'object') ? rawReward : {};
        return {
            money: clampInt(reward.money, fallback.money, 0, 999999999),
            gold: clampInt(reward.gold, fallback.gold, 0, 999999),
            honor: clampInt(reward.honor, fallback.honor, 0, 999999),
            exp: clampInt(reward.exp, fallback.exp, 0, 999999),
            box: toText(reward.box, toText(fallback.box, '')),
            boxType: toText(reward.boxType, toText(fallback.boxType, ''))
        };
    }

    function formatRewardLabel(reward) {
        const money = Math.max(0, Math.floor(Number(reward?.money) || 0));
        const gold = Math.max(0, Math.floor(Number(reward?.gold) || 0));
        const honor = Math.max(0, Math.floor(Number(reward?.honor) || 0));
        const exp = Math.max(0, Math.floor(Number(reward?.exp) || 0));
        const box = toText(reward?.box, '');
        const parts = [];
        if (money > 0) parts.push(`현금 +${formatNumber(money)}`);
        if (gold > 0) parts.push(`골드 +${formatNumber(gold)}`);
        if (honor > 0) parts.push(`명예훈장 +${formatNumber(honor)}`);
        if (exp > 0) parts.push(`EXP +${formatNumber(exp)}`);
        if (box) parts.push(box);
        return parts.join(' · ');
    }

    function createLegacyQuest(id, type, missionName, actionName, reward) {
        return {
            id,
            type,
            missionName,
            actionName,
            target: 1,
            progress: 0,
            status: QUEST_STATUS.IN_PROGRESS,
            reward: normalizeReward(reward, {}),
            tier: 1
        };
    }

    function formatBuildQuestAction(spec, progress) {
        const safeSpec = (spec && typeof spec === 'object') ? spec : {};
        const label = toText(safeSpec.actionLabel, '건설');
        const unit = toText(safeSpec.unit, '회');
        const target = Math.max(1, clampInt(safeSpec.target, 1, 1, 999999));
        const current = Math.min(target, Math.max(0, clampInt(progress, 0, 0, 9999999)));
        return `${label} ${formatNumber(current)}/${formatNumber(target)}${unit}`;
    }

    function createBuildQuest(spec) {
        const safeSpec = (spec && typeof spec === 'object') ? spec : {};
        const id = toText(safeSpec.id, '');
        const target = Math.max(1, clampInt(safeSpec.target, 1, 1, 999999));
        return {
            id,
            type: QUEST_TYPES.LEGACY_BUILD,
            missionName: toText(safeSpec.missionName, '건설 임무'),
            actionName: formatBuildQuestAction(safeSpec, 0),
            target,
            progress: 0,
            status: QUEST_STATUS.IN_PROGRESS,
            reward: normalizeReward(safeSpec.reward, {}),
            tier: 1
        };
    }

    function createLevelBonusQuest(spec, currentLevel) {
        const level = Math.max(1, Math.floor(Number(currentLevel) || 1));
        const target = Math.max(2, Math.floor(Number(spec?.targetLevel) || 2));
        const rank = toText(spec?.rank, '계급');
        const rewardGold = Math.max(1, Math.floor(Number(spec?.rewardGold) || 1));
        return {
            id: toText(spec?.id, ''),
            type: QUEST_TYPES.LEVEL_BONUS,
            missionName: `${rank} 퀘스트 보너스`,
            actionName: `계급 레벨 Lv.${formatNumber(target)}`,
            target,
            progress: level,
            status: (level >= target) ? QUEST_STATUS.CLAIMABLE : QUEST_STATUS.IN_PROGRESS,
            reward: normalizeReward({ gold: rewardGold }, {}),
            tier: 1
        };
    }

    function createQuestFallback(id) {
        return {
            id: toText(id, ''),
            type: 'legacy',
            missionName: toText(id, 'quest'),
            actionName: '',
            target: 1,
            progress: 0,
            status: QUEST_STATUS.IN_PROGRESS,
            reward: normalizeReward({}, {}),
            tier: 1
        };
    }

    function createDefaultState(gameRef) {
        const level = getCityQuestLevel(gameRef);
        const killSpec = buildKillQuestSpec(level, 1);
        const occupationSpec = buildVictoryQuestSpec(level, 1);

        const quests = {};

        BUILD_QUEST_SPECS.forEach((spec) => {
            const quest = createBuildQuest(spec);
            if (!quest.id) return;
            quests[quest.id] = quest;
        });

        quests[QUEST_IDS.LOGIN_SUPPLY_BOX] = createLegacyQuest(
            QUEST_IDS.LOGIN_SUPPLY_BOX,
            QUEST_TYPES.LEGACY_LOGIN,
            '출석 보급',
            '로그인 완료',
            { box: '특수 보급박스 x1', boxType: 'box_level2', gold: 15 }
        );

        quests[QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX] = createLegacyQuest(
            QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX,
            QUEST_TYPES.LEGACY_SKIRMISH_WIN,
            '첫 국지전 승리',
            '국지전 승리 1회',
            { box: '일반 보급상자 x1', boxType: 'box_level1' }
        );

        quests[QUEST_IDS.LUNAR_NEW_YEAR_GIFT] = createLegacyQuest(
            QUEST_IDS.LUNAR_NEW_YEAR_GIFT,
            QUEST_TYPES.LEGACY_EVENT,
            '첫 로그인 지급',
            '로그인 완료',
            { box: '특수 보급박스 x1', boxType: 'box_level2' }
        );

        quests[QUEST_IDS.EVENT_V62_SUPPLY_GIFT] = createLegacyQuest(
            QUEST_IDS.EVENT_V62_SUPPLY_GIFT,
            QUEST_TYPES.LEGACY_EVENT,
            'v6.2 공식 업데이트 기념',
            '이벤트 보상 수령',
            { box: '특수 보급박스 x1', boxType: 'box_level2' }
        );

        quests[QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT] = createLegacyQuest(
            QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT,
            QUEST_TYPES.LEGACY_EVENT,
            '베테랑 유닛 대규모 업데이트 기념',
            '이벤트 보상 수령',
            { honor: 1 }
        );

        quests[QUEST_IDS.EVENT_VISIT_UPDATE_GIFT] = createLegacyQuest(
            QUEST_IDS.EVENT_VISIT_UPDATE_GIFT,
            QUEST_TYPES.LEGACY_EVENT,
            '방문수령 업데이트 기념',
            '이벤트 보상 수령',
            { gold: 5 }
        );

        quests[QUEST_IDS.KILL_CONTRACT] = {
            id: QUEST_IDS.KILL_CONTRACT,
            type: QUEST_TYPES.KILL,
            missionName: '섬멸 지령 #1',
            actionName: `적 처치 0/${formatNumber(killSpec.target)}`,
            target: killSpec.target,
            progress: 0,
            status: QUEST_STATUS.IN_PROGRESS,
            reward: normalizeReward({
                money: killSpec.rewardMoney,
                gold: killSpec.rewardGold,
                exp: killSpec.rewardExp
            }, {}),
            tier: 1
        };

        quests[QUEST_IDS.VICTORY_CONTRACT] = {
            id: QUEST_IDS.VICTORY_CONTRACT,
            type: QUEST_TYPES.OCCUPATION_WIN,
            missionName: '점령 보고 #1',
            actionName: `점령전 승리 0/${formatNumber(occupationSpec.target)}회`,
            target: occupationSpec.target,
            progress: 0,
            status: QUEST_STATUS.IN_PROGRESS,
            reward: normalizeReward({
                money: occupationSpec.rewardMoney,
                gold: occupationSpec.rewardGold,
                exp: occupationSpec.rewardExp
            }, {}),
            tier: 1
        };

        LEVEL_BONUS_SPECS.forEach((spec) => {
            const id = toText(spec.id, '');
            if (!id) return;
            quests[id] = createLevelBonusQuest(spec, level);
        });

        return {
            version: QUEST_SCHEMA_VERSION,
            counters: {
                kill: 0,
                win: 0,
                levelUp: 0
            },
            tiers: {
                kill: 1,
                win: 1,
                level: 1
            },
            quests,
            meta: {
                lastLevel: level,
                loginSupplyClaimed: false,
                skirmishFirstWinClaimed: false,
                permanentClaimed: []
            }
        };
    }

    function normalizeQuest(rawQuest, fallbackQuest) {
        const quest = (rawQuest && typeof rawQuest === 'object') ? rawQuest : {};
        const fallback = fallbackQuest && typeof fallbackQuest === 'object' ? fallbackQuest : {};
        const status = toText(quest.status, fallback.status);
        const safeStatus = (
            status === QUEST_STATUS.IN_PROGRESS
            || status === QUEST_STATUS.CLAIMABLE
            || status === QUEST_STATUS.CLAIMED
        ) ? status : QUEST_STATUS.IN_PROGRESS;

        return {
            id: toText(quest.id, fallback.id),
            type: toText(quest.type, fallback.type),
            missionName: toText(quest.missionName, fallback.missionName),
            actionName: toText(quest.actionName, fallback.actionName),
            target: clampInt(quest.target, fallback.target, 1, 999999),
            progress: clampInt(quest.progress, fallback.progress, 0, 9999999),
            status: safeStatus,
            reward: normalizeReward(quest.reward, fallback.reward),
            tier: clampInt(quest.tier, fallback.tier, 1, 9999)
        };
    }

    function syncLevelBonusQuests(state, level, permanentClaimedSet) {
        LEVEL_BONUS_SPECS.forEach((spec) => {
            const id = toText(spec.id, '');
            if (!id) return;
            const base = createLevelBonusQuest(spec, level);
            const current = state.quests[id];
            const quest = normalizeQuest(current, base);
            const permanentlyClaimed = !!(permanentClaimedSet && permanentClaimedSet.has(id));

            quest.id = id;
            quest.type = QUEST_TYPES.LEVEL_BONUS;
            quest.target = base.target;
            quest.progress = level;
            quest.tier = 1;
            quest.missionName = base.missionName;
            quest.actionName = `계급 레벨 Lv.${formatNumber(base.target)}`;
            quest.reward = normalizeReward(quest.reward, base.reward);
            quest.reward.gold = Math.max(
                Math.max(1, Math.floor(Number(base.reward?.gold) || 1)),
                Math.floor(Number(quest.reward.gold) || 0)
            );

            if (permanentlyClaimed || quest.status === QUEST_STATUS.CLAIMED) {
                quest.status = QUEST_STATUS.CLAIMED;
                quest.progress = Math.max(level, base.target);
            } else {
                quest.status = (level >= base.target) ? QUEST_STATUS.CLAIMABLE : QUEST_STATUS.IN_PROGRESS;
            }
            if (quest.status === QUEST_STATUS.CLAIMED && level < base.target) {
                // Repair impossible claimed states from stale/corrupted merge data.
                quest.status = QUEST_STATUS.IN_PROGRESS;
                quest.progress = level;
            }

            state.quests[id] = quest;
        });
    }

    function syncDerivedFields(state, gameRef) {
        if (!state || typeof state !== 'object') return createDefaultState(gameRef);
        const defaultState = createDefaultState(gameRef);
        const defaultQuests = (defaultState && defaultState.quests && typeof defaultState.quests === 'object')
            ? defaultState.quests
            : {};

        state.meta = state.meta && typeof state.meta === 'object' ? state.meta : {};
        state.meta.loginSupplyClaimed = state.meta.loginSupplyClaimed === true;
        state.meta.skirmishFirstWinClaimed = state.meta.skirmishFirstWinClaimed === true;
        state.meta.permanentClaimed = normalizePermanentClaimed(state.meta.permanentClaimed);
        const permanentClaimedSet = new Set(state.meta.permanentClaimed);
        if (state.meta.loginSupplyClaimed) {
            permanentClaimedSet.add(QUEST_IDS.LOGIN_SUPPLY_BOX);
        }
        if (state.meta.skirmishFirstWinClaimed) {
            permanentClaimedSet.add(QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX);
        }

        if (!state.quests || typeof state.quests !== 'object') {
            state.quests = {};
        }

        DEPRECATED_QUEST_IDS.forEach((id) => {
            if (id && Object.prototype.hasOwnProperty.call(state.quests, id)) {
                delete state.quests[id];
            }
        });

        Object.keys(defaultQuests).forEach((id) => {
            if (!state.quests[id] || typeof state.quests[id] !== 'object') {
                state.quests[id] = normalizeQuest(null, defaultQuests[id]);
            }
        });
        Object.keys(state.quests).forEach((id) => {
            const quest = state.quests[id];
            if (!quest || typeof quest !== 'object') return;
            if (String(quest.status || '') === QUEST_STATUS.CLAIMED
                && isPermanentOneTimeQuestId(id)) {
                permanentClaimedSet.add(id);
            }
        });

        const level = getCityQuestLevel(gameRef);
        const firstUnclaimedBuildQuestId = BUILD_QUEST_CHAIN_IDS.find((id) => {
            const q = state.quests[id];
            return q && typeof q === 'object' && q.status !== QUEST_STATUS.CLAIMED;
        }) || '';

        BUILD_QUEST_SPECS.forEach((spec) => {
            const id = toText(spec?.id, '');
            if (!id) return;
            const defaultQuest = defaultQuests[id] && typeof defaultQuests[id] === 'object'
                ? defaultQuests[id]
                : createBuildQuest(spec);
            const current = state.quests[id];
            const quest = normalizeQuest(current, defaultQuest);

            quest.id = id;
            quest.type = QUEST_TYPES.LEGACY_BUILD;
            quest.missionName = toText(spec?.missionName, defaultQuest.missionName || '건설 임무');
            quest.target = Math.max(1, clampInt(spec?.target, defaultQuest.target, 1, 999999));
            quest.reward = normalizeReward(quest.reward, defaultQuest.reward);
            quest.tier = 1;

            const permanentlyClaimed = permanentClaimedSet.has(id);
            if (permanentlyClaimed || quest.status === QUEST_STATUS.CLAIMED) {
                quest.progress = quest.target;
                quest.status = QUEST_STATUS.CLAIMED;
                permanentClaimedSet.add(id);
            } else {
                const rawProgress = clampInt(quest.progress, 0, 0, quest.target);
                const isActiveBuildQuest = firstUnclaimedBuildQuestId === id;
                if (isActiveBuildQuest) {
                    quest.progress = rawProgress;
                    quest.status = (quest.progress >= quest.target)
                        ? QUEST_STATUS.CLAIMABLE
                        : QUEST_STATUS.IN_PROGRESS;
                } else if (BUILD_QUEST_CHAIN_SET.has(id)) {
                    quest.progress = 0;
                    quest.status = QUEST_STATUS.IN_PROGRESS;
                } else {
                    quest.progress = rawProgress;
                    quest.status = (quest.progress >= quest.target)
                        ? QUEST_STATUS.CLAIMABLE
                        : QUEST_STATUS.IN_PROGRESS;
                }
            }

            quest.actionName = formatBuildQuestAction(spec, quest.progress);
            state.quests[id] = quest;
        });
        const firstPendingBuildIndex = BUILD_QUEST_CHAIN_IDS.findIndex((id) => {
            const quest = state.quests[id];
            return !(quest && typeof quest === 'object' && quest.status === QUEST_STATUS.CLAIMED);
        });
        if (firstPendingBuildIndex >= 0) {
            BUILD_QUEST_SPECS.forEach((spec, index) => {
                if (index <= firstPendingBuildIndex) return;
                const id = toText(spec?.id, '');
                if (!id) return;
                const quest = state.quests[id];
                if (!quest || typeof quest !== 'object') return;
                if (quest.status !== QUEST_STATUS.CLAIMED) return;
                quest.progress = 0;
                quest.status = QUEST_STATUS.IN_PROGRESS;
                quest.actionName = formatBuildQuestAction(spec, quest.progress);
            });
        }
        const allBuildChainClaimed = BUILD_QUEST_CHAIN_IDS.length > 0
            && BUILD_QUEST_CHAIN_IDS.every((id) => {
                const quest = state.quests[id];
                return !!(quest && typeof quest === 'object' && quest.status === QUEST_STATUS.CLAIMED);
            });
        if (allBuildChainClaimed) {
            BUILD_QUEST_SPECS.forEach((spec) => {
                const id = toText(spec?.id, '');
                if (!id) return;
                const quest = state.quests[id];
                if (!quest || typeof quest !== 'object') return;
                quest.progress = 0;
                quest.status = QUEST_STATUS.IN_PROGRESS;
                quest.actionName = formatBuildQuestAction(spec, quest.progress);
            });
        }

        const legacyIds = [
            QUEST_IDS.LOGIN_SUPPLY_BOX,
            QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX,
            QUEST_IDS.LUNAR_NEW_YEAR_GIFT,
            QUEST_IDS.EVENT_V62_SUPPLY_GIFT,
            QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT,
            QUEST_IDS.EVENT_VISIT_UPDATE_GIFT
        ];
        const hasLoggedInUid = !!getLoggedInUid();

        legacyIds.forEach((id) => {
            const quest = state.quests[id];
            if (!quest || typeof quest !== 'object') return;
            quest.target = 1;
            quest.progress = clampInt(quest.progress, 0, 0, 1);
            quest.reward = normalizeReward(quest.reward, defaultQuests[id] && defaultQuests[id].reward);
            if (id === QUEST_IDS.LOGIN_SUPPLY_BOX) {
                quest.reward = normalizeReward(
                    { box: '특수 보급박스 x1', boxType: 'box_level2', gold: 15 },
                    defaultQuests[id] && defaultQuests[id].reward
                );
            }
            if (id === QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX) {
                quest.reward = normalizeReward(
                    { box: '일반 보급상자 x1', boxType: 'box_level1' },
                    defaultQuests[id] && defaultQuests[id].reward
                );
            }
            if (id === QUEST_IDS.LUNAR_NEW_YEAR_GIFT) {
                quest.reward = normalizeReward(
                    { box: '특수 보급박스 x1', boxType: 'box_level2' },
                    defaultQuests[id] && defaultQuests[id].reward
                );
                quest.missionName = '첫 로그인 지급';
                quest.actionName = '로그인 완료';
            }
            if (id === QUEST_IDS.EVENT_V62_SUPPLY_GIFT) {
                quest.reward = normalizeReward(
                    { box: '특수 보급박스 x1', boxType: 'box_level2' },
                    defaultQuests[id] && defaultQuests[id].reward
                );
                quest.missionName = 'v6.2 공식 업데이트 기념';
                quest.actionName = '이벤트 보상 수령';
            }
            if (id === QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT) {
                quest.reward = normalizeReward(
                    { honor: 1 },
                    defaultQuests[id] && defaultQuests[id].reward
                );
                quest.missionName = '베테랑 유닛 대규모 업데이트 기념';
                quest.actionName = '이벤트 보상 수령';
            }
            if (id === QUEST_IDS.EVENT_VISIT_UPDATE_GIFT) {
                quest.reward = normalizeReward(
                    { gold: 5 },
                    defaultQuests[id] && defaultQuests[id].reward
                );
                quest.missionName = '방문수령 업데이트 기념';
                quest.actionName = '이벤트 보상 수령';
            }

            const permanentlyClaimed = permanentClaimedSet.has(id);
            if (permanentlyClaimed
                || (id === QUEST_IDS.LOGIN_SUPPLY_BOX && state.meta.loginSupplyClaimed === true)
                || (id === QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX && state.meta.skirmishFirstWinClaimed === true)) {
                quest.status = QUEST_STATUS.CLAIMED;
                quest.progress = 1;
                permanentClaimedSet.add(id);
            } else if (quest.status === QUEST_STATUS.CLAIMED) {
                quest.progress = 1;
                permanentClaimedSet.add(id);
            } else if (id === QUEST_IDS.LUNAR_NEW_YEAR_GIFT) {
                quest.progress = hasLoggedInUid ? 1 : 0;
                quest.status = hasLoggedInUid
                    ? QUEST_STATUS.CLAIMABLE
                    : QUEST_STATUS.IN_PROGRESS;
            } else if (
                id === QUEST_IDS.EVENT_V62_SUPPLY_GIFT
                || id === QUEST_IDS.EVENT_VETERAN_UPDATE_GIFT
                || id === QUEST_IDS.EVENT_VISIT_UPDATE_GIFT
            ) {
                quest.progress = 1;
                quest.status = QUEST_STATUS.CLAIMABLE;
            } else if (quest.progress >= 1) {
                quest.status = QUEST_STATUS.CLAIMABLE;
            } else {
                quest.status = QUEST_STATUS.IN_PROGRESS;
            }

            if (id === QUEST_IDS.LOGIN_SUPPLY_BOX && quest.status === QUEST_STATUS.CLAIMED) {
                state.meta.loginSupplyClaimed = true;
            }
            if (id === QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX && quest.status === QUEST_STATUS.CLAIMED) {
                state.meta.skirmishFirstWinClaimed = true;
            }
        });

        state.counters = state.counters && typeof state.counters === 'object' ? state.counters : {};
        state.counters.kill = clampInt(state.counters.kill, 0, 0, 999999999);
        state.counters.win = clampInt(state.counters.win, 0, 0, 999999999);
        state.counters.levelUp = clampInt(state.counters.levelUp, 0, 0, 999999999);

        state.tiers = state.tiers && typeof state.tiers === 'object' ? state.tiers : {};
        state.tiers.kill = clampInt(state.tiers.kill, 1, 1, 9999);
        state.tiers.win = clampInt(state.tiers.win, 1, 1, 9999);
        state.tiers.level = clampInt(state.tiers.level, 1, 1, 9999);

        const killQuest = state.quests[QUEST_IDS.KILL_CONTRACT];
        if (killQuest && typeof killQuest === 'object') {
            killQuest.tier = clampInt(killQuest.tier, state.tiers.kill, 1, 9999);
            state.tiers.kill = killQuest.tier;
            const spec = buildKillQuestSpec(level, killQuest.tier);
            killQuest.target = clampInt(killQuest.target, spec.target, 1, 999999);
            killQuest.progress = clampInt(killQuest.progress, 0, 0, 9999999);
            killQuest.reward = normalizeReward(killQuest.reward, {
                money: spec.rewardMoney,
                gold: spec.rewardGold,
                exp: spec.rewardExp
            });
            killQuest.type = QUEST_TYPES.KILL;
            killQuest.missionName = `섬멸 지령 #${killQuest.tier}`;
            const current = Math.min(killQuest.target, killQuest.progress);
            killQuest.actionName = `적 처치 ${formatNumber(current)}/${formatNumber(killQuest.target)}`;
            killQuest.status = (killQuest.progress >= killQuest.target)
                ? QUEST_STATUS.CLAIMABLE
                : QUEST_STATUS.IN_PROGRESS;
        }

        const victoryQuest = state.quests[QUEST_IDS.VICTORY_CONTRACT];
        if (victoryQuest && typeof victoryQuest === 'object') {
            victoryQuest.tier = clampInt(victoryQuest.tier, state.tiers.win, 1, 9999);
            state.tiers.win = victoryQuest.tier;
            const spec = buildVictoryQuestSpec(level, victoryQuest.tier);
            victoryQuest.target = clampInt(victoryQuest.target, spec.target, 1, 999999);
            victoryQuest.progress = clampInt(victoryQuest.progress, 0, 0, 9999999);
            victoryQuest.reward = normalizeReward(victoryQuest.reward, {
                money: spec.rewardMoney,
                gold: spec.rewardGold,
                exp: spec.rewardExp
            });
            victoryQuest.type = QUEST_TYPES.OCCUPATION_WIN;
            victoryQuest.missionName = `점령 보고 #${victoryQuest.tier}`;
            const current = Math.min(victoryQuest.target, victoryQuest.progress);
            victoryQuest.actionName = `점령전 승리 ${formatNumber(current)}/${formatNumber(victoryQuest.target)}회`;
            victoryQuest.status = (victoryQuest.progress >= victoryQuest.target)
                ? QUEST_STATUS.CLAIMABLE
                : QUEST_STATUS.IN_PROGRESS;
        }

        syncLevelBonusQuests(state, level, permanentClaimedSet);

        Object.keys(state.quests).forEach((id) => {
            const quest = state.quests[id];
            if (!quest || typeof quest !== 'object') return;
            if (String(quest.status || '') === QUEST_STATUS.CLAIMED && isPermanentOneTimeQuestId(id)) {
                permanentClaimedSet.add(id);
            }
        });

        state.meta.lastLevel = level;
        state.meta.permanentClaimed = normalizePermanentClaimed(Array.from(permanentClaimedSet));
        state.meta.loginSupplyClaimed = state.meta.permanentClaimed.includes(QUEST_IDS.LOGIN_SUPPLY_BOX);
        state.meta.skirmishFirstWinClaimed = state.meta.permanentClaimed.includes(QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX);
        state.version = QUEST_SCHEMA_VERSION;
        return state;
    }

    function normalizeState(gameRef, rawState) {
        const base = createDefaultState(gameRef);
        const raw = (rawState && typeof rawState === 'object') ? rawState : {};

        const state = {
            version: QUEST_SCHEMA_VERSION,
            counters: {
                kill: clampInt(raw?.counters?.kill, base.counters.kill, 0, 999999999),
                win: clampInt(raw?.counters?.win, base.counters.win, 0, 999999999),
                levelUp: clampInt(raw?.counters?.levelUp, base.counters.levelUp, 0, 999999999)
            },
            tiers: {
                kill: clampInt(raw?.tiers?.kill, base.tiers.kill, 1, 9999),
                win: clampInt(raw?.tiers?.win, base.tiers.win, 1, 9999),
                level: clampInt(raw?.tiers?.level, base.tiers.level, 1, 9999)
            },
            quests: {},
            meta: {
                lastLevel: clampInt(raw?.meta?.lastLevel, base.meta.lastLevel, 1, 19),
                loginSupplyClaimed: raw?.meta?.loginSupplyClaimed === true,
                skirmishFirstWinClaimed: raw?.meta?.skirmishFirstWinClaimed === true,
                permanentClaimed: normalizePermanentClaimed(raw?.meta?.permanentClaimed)
            }
        };

        QUEST_ORDER.forEach((id) => {
            state.quests[id] = normalizeQuest(raw?.quests?.[id], base.quests[id]);
        });

        const rawQuests = (raw && raw.quests && typeof raw.quests === 'object') ? raw.quests : {};
        Object.keys(rawQuests).forEach((id) => {
            const key = toText(id, '');
            if (!key || state.quests[key]) return;
            if (DEPRECATED_QUEST_IDS.includes(key)) return;
            state.quests[key] = normalizeQuest(rawQuests[key], createQuestFallback(key));
        });

        if (state.quests[QUEST_IDS.KILL_CONTRACT]) {
            state.quests[QUEST_IDS.KILL_CONTRACT].tier = state.tiers.kill;
        }
        if (state.quests[QUEST_IDS.VICTORY_CONTRACT]) {
            state.quests[QUEST_IDS.VICTORY_CONTRACT].tier = state.tiers.win;
        }

        return syncDerivedFields(state, gameRef);
    }

    function cloneState(state) {
        const levelRef = clampInt(state?.meta?.lastLevel, 1, 1, 19);
        const safe = normalizeState({ citySim: { hud: { level: levelRef } } }, state);
        const copy = {
            version: safe.version,
            counters: {
                kill: safe.counters.kill,
                win: safe.counters.win,
                levelUp: safe.counters.levelUp
            },
            tiers: {
                kill: safe.tiers.kill,
                win: safe.tiers.win,
                level: safe.tiers.level
            },
            quests: {},
            meta: {
                lastLevel: safe.meta.lastLevel,
                loginSupplyClaimed: safe.meta.loginSupplyClaimed === true,
                skirmishFirstWinClaimed: safe.meta.skirmishFirstWinClaimed === true,
                permanentClaimed: normalizePermanentClaimed(safe.meta.permanentClaimed)
            }
        };

        const orderedIds = [];
        const seenIds = new Set();
        QUEST_ORDER.forEach((id) => {
            const key = toText(id, '');
            if (!key || seenIds.has(key)) return;
            seenIds.add(key);
            orderedIds.push(key);
        });
        Object.keys(safe.quests || {}).forEach((id) => {
            const key = toText(id, '');
            if (!key || seenIds.has(key)) return;
            seenIds.add(key);
            orderedIds.push(key);
        });

        orderedIds.forEach((id) => {
            const q = safe.quests[id];
            if (!q) return;
            copy.quests[id] = {
                id: q.id,
                type: q.type,
                missionName: q.missionName,
                actionName: q.actionName,
                target: q.target,
                progress: q.progress,
                status: q.status,
                reward: {
                    money: q.reward.money,
                    gold: q.reward.gold,
                    honor: q.reward.honor,
                    exp: q.reward.exp,
                    box: q.reward.box,
                    boxType: q.reward.boxType
                },
                tier: q.tier
            };
        });

        return copy;
    }

    global.CityQuestMissionSchema = {
        QUEST_SCHEMA_VERSION,
        QUEST_STATUS,
        QUEST_TYPES,
        QUEST_IDS,
        QUEST_ORDER,
        BUILD_QUEST_SPECS,
        LEVEL_BONUS_IDS,
        DEPRECATED_QUEST_IDS,
        clampInt,
        getCityQuestLevel,
        buildKillQuestSpec,
        buildVictoryQuestSpec,
        buildLevelQuestSpec,
        formatRewardLabel,
        normalizeReward,
        createDefaultState,
        normalizeState,
        syncDerivedFields,
        cloneState
    };
})(window);
