(function (global) {
    const QUEST_ID = 'login_supply_box';
    const QUEST_TYPE = 'attendance_login';

    const REWARD_PLAN = [
        { day: 1, reward: { box: '\uD2B9\uC218 \uBCF4\uAE09\uBC15\uC2A4 x1', boxType: 'box_level2' } },
        { day: 2, reward: { gold: 2 } },
        { day: 3, reward: { money: 300 } },
        { day: 4, reward: { gold: 3 } },
        { day: 5, reward: { box: '\uC77C\uBC18 \uBCF4\uAE09\uC0C1\uC790 x1', boxType: 'box_level1' } },
        { day: 6, reward: { money: 700, gold: 2 } },
        { day: 7, reward: { box: '\uD2B9\uC218 \uBCF4\uAE09\uBC15\uC2A4 x1', boxType: 'box_level2', gold: 5 } }
    ];

    function clampInt(value, fallback, min, max) {
        const parsed = Math.floor(Number(value));
        const lower = Number.isFinite(min) ? min : 0;
        const upper = Number.isFinite(max) ? max : Number.MAX_SAFE_INTEGER;
        if (!Number.isFinite(parsed)) {
            return Math.max(lower, Math.min(upper, Math.floor(Number(fallback) || 0)));
        }
        return Math.max(lower, Math.min(upper, parsed));
    }

    function toText(value, fallback) {
        const text = String(value == null ? '' : value).trim();
        return text || String(fallback || '');
    }

    function pad2(value) {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        return n < 10 ? `0${n}` : String(n);
    }

    function getTodayKey(nowValue) {
        const now = (nowValue instanceof Date) ? nowValue : new Date(nowValue || Date.now());
        if (!(now instanceof Date) || Number.isNaN(now.getTime())) return '';
        return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    }

    function normalizeDateKey(value) {
        const text = toText(value, '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
        return text;
    }

    function getMaxDay() {
        return REWARD_PLAN.length;
    }

    function normalizeRewardFallback(rawReward, fallbackReward) {
        const fallback = (fallbackReward && typeof fallbackReward === 'object') ? fallbackReward : {};
        const reward = (rawReward && typeof rawReward === 'object') ? rawReward : {};
        return {
            money: Math.max(0, Math.floor(Number((reward.money != null) ? reward.money : fallback.money) || 0)),
            gold: Math.max(0, Math.floor(Number((reward.gold != null) ? reward.gold : fallback.gold) || 0)),
            honor: Math.max(0, Math.floor(Number((reward.honor != null) ? reward.honor : fallback.honor) || 0)),
            exp: Math.max(0, Math.floor(Number((reward.exp != null) ? reward.exp : fallback.exp) || 0)),
            box: toText(reward.box, toText(fallback.box, '')),
            boxType: toText(reward.boxType, toText(fallback.boxType, ''))
        };
    }

    function resolveQuestStatusMap(statusMap) {
        const raw = (statusMap && typeof statusMap === 'object') ? statusMap : {};
        return {
            IN_PROGRESS: toText(raw.IN_PROGRESS, 'in_progress'),
            CLAIMABLE: toText(raw.CLAIMABLE, 'claimable'),
            CLAIMED: toText(raw.CLAIMED, 'claimed')
        };
    }

    function resolveNormalizeReward(normalizeRewardFn) {
        if (typeof normalizeRewardFn === 'function') return normalizeRewardFn;
        return normalizeRewardFallback;
    }

    function getPlanEntry(day) {
        const maxDay = getMaxDay();
        const index = clampInt(day, 1, 1, maxDay) - 1;
        return REWARD_PLAN[Math.max(0, Math.min(maxDay - 1, index))];
    }

    function normalizeMeta(rawMeta) {
        const maxDay = getMaxDay();
        const meta = (rawMeta && typeof rawMeta === 'object') ? rawMeta : {};

        let day = clampInt(meta.day, 1, 1, maxDay + 1);
        let claimedDays = clampInt(meta.claimedDays, day - 1, 0, maxDay);
        const lastClaimDate = normalizeDateKey(meta.lastClaimDate);

        if (claimedDays < day - 1) claimedDays = Math.max(0, day - 1);
        if (claimedDays >= maxDay) {
            claimedDays = maxDay;
            day = maxDay + 1;
        } else if (day > claimedDays + 1) {
            day = claimedDays + 1;
        }

        return {
            day,
            claimedDays,
            lastClaimDate
        };
    }

    function ensureAttendanceMeta(state) {
        if (!state || typeof state !== 'object') return normalizeMeta(null);
        if (!state.meta || typeof state.meta !== 'object') state.meta = {};
        const meta = normalizeMeta(state.meta.attendance);
        state.meta.attendance = meta;
        return meta;
    }

    function getProgressInfoFromMeta(metaInput, todayKey) {
        const maxDay = getMaxDay();
        const meta = normalizeMeta(metaInput);
        const completed = meta.day > maxDay || meta.claimedDays >= maxDay;
        const day = completed ? maxDay : Math.max(1, Math.min(maxDay, meta.day));
        const claimedDays = Math.max(0, Math.min(maxDay, meta.claimedDays));
        const remainingDays = Math.max(0, maxDay - claimedDays);
        const todayClaimed = normalizeDateKey(todayKey) === meta.lastClaimDate;

        let label = `\uCD9C\uC11D ${day}/${maxDay}\uC77C\uCC28`;
        if (completed) label = `\uCD9C\uC11D \uC644\uB8CC (${maxDay}/${maxDay})`;
        if (todayClaimed && !completed) {
            label = `\uC624\uB298 \uC218\uB839 \uC644\uB8CC \u00B7 \uB2E4\uC74C ${day}\uC77C\uCC28`;
        }

        return {
            day,
            maxDay,
            claimedDays,
            remainingDays,
            todayClaimed,
            completed,
            label
        };
    }

    function syncQuestState(state, quest, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const status = resolveQuestStatusMap(opts.questStatus);
        const normalizeReward = resolveNormalizeReward(opts.normalizeReward);
        const questType = toText(opts.questType, QUEST_TYPE);
        const todayKey = normalizeDateKey(opts.todayKey) || getTodayKey();

        const meta = ensureAttendanceMeta(state);
        const info = getProgressInfoFromMeta(meta, todayKey);
        const entry = getPlanEntry(info.day);
        const reward = normalizeReward(entry && entry.reward, {
            money: 0,
            gold: 0,
            honor: 0,
            exp: 0,
            box: '',
            boxType: ''
        });

        if (quest && typeof quest === 'object') {
            quest.id = QUEST_ID;
            quest.type = questType;
            quest.missionName = '\uCD9C\uC11D \uBCF4\uAE09';
            quest.target = 1;
            quest.tier = 1;
            quest.reward = reward;
            if (info.completed) {
                quest.status = status.CLAIMED;
                quest.progress = 1;
                quest.actionName = `${info.maxDay}\uC77C\uCC28\uAE4C\uC9C0 \uC218\uB839 \uC644\uB8CC`;
            } else if (info.todayClaimed) {
                quest.status = status.CLAIMED;
                quest.progress = 1;
                quest.actionName = `\uC624\uB298 \uC218\uB839 \uC644\uB8CC (\uB2E4\uC74C ${info.day}\uC77C\uCC28)`;
            } else {
                quest.status = status.CLAIMABLE;
                quest.progress = 1;
                quest.actionName = `${info.day}\uC77C\uCC28 \uBCF4\uC0C1 \uC218\uB839`;
            }
        }

        return {
            day: info.day,
            maxDay: info.maxDay,
            claimedDays: info.claimedDays,
            remainingDays: info.remainingDays,
            todayClaimed: info.todayClaimed,
            completed: info.completed,
            label: info.label,
            todayKey,
            reward
        };
    }

    function commitClaim(state, quest, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const todayKey = normalizeDateKey(opts.todayKey) || getTodayKey();
        const info = syncQuestState(state, quest, {
            questStatus: opts.questStatus,
            normalizeReward: opts.normalizeReward,
            questType: opts.questType,
            todayKey
        });

        if (info.completed || info.todayClaimed) {
            return {
                ok: false,
                reason: 'not_claimable',
                info
            };
        }

        const meta = ensureAttendanceMeta(state);
        const claimedDay = info.day;
        const maxDay = info.maxDay;

        meta.lastClaimDate = todayKey;
        meta.claimedDays = Math.max(meta.claimedDays, claimedDay);

        if (claimedDay >= maxDay) {
            meta.claimedDays = maxDay;
            meta.day = maxDay + 1;
        } else {
            meta.day = claimedDay + 1;
        }

        const nextInfo = syncQuestState(state, quest, {
            questStatus: opts.questStatus,
            normalizeReward: opts.normalizeReward,
            questType: opts.questType,
            todayKey
        });

        return {
            ok: true,
            claimedDay,
            maxDay,
            nextInfo
        };
    }

    function getProgressInfo(state, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const todayKey = normalizeDateKey(opts.todayKey) || getTodayKey();
        const stateMeta = (state && state.meta && typeof state.meta === 'object') ? state.meta : {};
        const meta = normalizeMeta(stateMeta.attendance);
        return getProgressInfoFromMeta(meta, todayKey);
    }

    global.CityQuestMissionAttendance = {
        QUEST_ID,
        QUEST_TYPE,
        REWARD_PLAN: REWARD_PLAN.slice(),
        getTodayKey,
        normalizeMeta,
        ensureAttendanceMeta,
        syncQuestState,
        commitClaim,
        getProgressInfo
    };
})(window);
