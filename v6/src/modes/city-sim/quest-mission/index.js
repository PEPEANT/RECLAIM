(function (global) {
    function isFn(value) {
        return typeof value === 'function';
    }

    function callEngine(name, args, fallback) {
        const engine = global.CityQuestMissionEngine;
        if (!engine || !isFn(engine[name])) return fallback;
        return engine[name].apply(engine, args || []);
    }

    function renderPanel(game) {
        const uiApi = global.CityQuestMissionUI;
        if (uiApi && isFn(uiApi.renderPanel)) {
            uiApi.renderPanel(game);
        }
    }

    global.CityQuestMission = {
        init(game) {
            return callEngine('init', [game], null);
        },
        ensureState(game) {
            return callEngine('ensureState', [game], null);
        },
        getProgressRows(game) {
            return callEngine('getProgressRows', [game], []);
        },
        renderPanel,
        markEvent(game, eventType, payload) {
            return callEngine('markEvent', [game, eventType, payload], false);
        },
        markLegacyQuest(game, questKey, options) {
            return callEngine('markLegacyQuest', [game, questKey, options], false);
        },
        claimQuest(game, questId, options) {
            return callEngine('claimQuest', [game, questId, options], false);
        },
        claimAllQuests(game, options) {
            return callEngine('claimAllQuests', [game, options], 0);
        },
        clearClaimLedger(options) {
            return callEngine('clearClaimLedger', [options], false);
        },
        serialize(game) {
            return callEngine('serialize', [game], null);
        },
        hydrate(game, savedState) {
            return callEngine('hydrate', [game, savedState], null);
        },
        reset(game) {
            return callEngine('reset', [game], null);
        }
    };
})(window);
