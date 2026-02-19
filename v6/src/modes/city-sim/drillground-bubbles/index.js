(function attachCityDrillgroundBubbles(global) {
    'use strict';

    function getRuntime() {
        const runtime = global.CitySimDrillgroundBubbleRuntime;
        return (runtime && typeof runtime === 'object') ? runtime : null;
    }

    function getRender() {
        const render = global.CitySimDrillgroundBubbleRender;
        return (render && typeof render === 'object') ? render : null;
    }

    function getConfig() {
        const config = global.CitySimDrillgroundBubbleConfig;
        return (config && typeof config === 'object') ? config : null;
    }

    const api = {
        init(game, options) {
            const runtime = getRuntime();
            if (!runtime || typeof runtime.init !== 'function') return false;
            return runtime.init(game, options);
        },
        setOptions(game, options) {
            const runtime = getRuntime();
            if (!runtime || typeof runtime.setOptions !== 'function') return false;
            return runtime.setOptions(game, options);
        },
        clear(game) {
            const runtime = getRuntime();
            if (!runtime || typeof runtime.clear !== 'function') return;
            runtime.clear(game);
        },
        tick(game) {
            const runtime = getRuntime();
            if (!runtime || typeof runtime.tick !== 'function') return false;
            return runtime.tick(game) === true;
        },
        queueBattleEvent(game, type, options) {
            const runtime = getRuntime();
            if (!runtime || typeof runtime.queueBattleEvent !== 'function') return false;
            return runtime.queueBattleEvent(game, type, options);
        },
        getRenderToken(game, slotPayload) {
            const runtime = getRuntime();
            if (!runtime || typeof runtime.getRenderToken !== 'function') return '';
            return runtime.getRenderToken(game, slotPayload);
        },
        appendBubble(cell, game, slotPayload) {
            const render = getRender();
            if (!render || typeof render.appendBubbleForSlot !== 'function') return false;
            return render.appendBubbleForSlot(cell, game, slotPayload);
        },
        setDialogueLines(type, mode, lines) {
            const config = getConfig();
            if (!config || typeof config.setDialogueLines !== 'function') return false;
            config.setDialogueLines(type, mode, lines);
            return true;
        },
        replaceDialogueBundle(bundle) {
            const config = getConfig();
            if (!config || typeof config.replaceDialogueBundle !== 'function') return false;
            config.replaceDialogueBundle(bundle);
            return true;
        },
        getDialogueBundle() {
            const config = getConfig();
            if (!config || typeof config.getDialogueBundle !== 'function') return null;
            return config.getDialogueBundle();
        },
        resetDialogueBundle() {
            const config = getConfig();
            if (!config || typeof config.resetDialogueBundle !== 'function') return false;
            config.resetDialogueBundle();
            return true;
        }
    };

    global.CitySimDrillgroundBubbles = api;
})(window);
