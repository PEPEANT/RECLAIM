(function attachCityTutorialProgress(global) {
    'use strict';

    function getStateApi() {
        if (typeof global.CitySimState === 'undefined' || !global.CitySimState) return null;
        return global.CitySimState;
    }

    function ensureState(game) {
        const stateApi = getStateApi();
        if (!stateApi || typeof stateApi.ensure !== 'function') return null;
        return stateApi.ensure(game);
    }

    function save(game) {
        if (!game || typeof game.saveCitySimState !== 'function') return false;
        try {
            const result = game.saveCitySimState();
            if (result && typeof result.catch === 'function') {
                result.catch((err) => {
                    console.warn('[CityTutorialProgress] saveCitySimState failed:', err);
                });
            }
            return true;
        } catch (err) {
            console.warn('[CityTutorialProgress] saveCitySimState threw:', err);
            return false;
        }
    }

    function patch(game, patchValue) {
        if (!game || !patchValue || typeof patchValue !== 'object') return false;
        const stateApi = getStateApi();
        if (!stateApi) return false;
        const patchObj = {
            ...patchValue,
            updatedAt: Math.max(0, Math.floor(Number(patchValue.updatedAt) || Date.now()))
        };

        if (typeof stateApi.patchTutorial === 'function') {
            stateApi.patchTutorial(game, patchObj);
            save(game);
            return true;
        }

        if (typeof stateApi.mutate === 'function') {
            stateApi.mutate(game, (state) => {
                if (!state.tutorial || typeof state.tutorial !== 'object') {
                    state.tutorial = {};
                }
                state.tutorial = {
                    ...state.tutorial,
                    ...patchObj
                };
            });
            save(game);
            return true;
        }

        return false;
    }

    function setStep(game, stepValue) {
        const step = Math.max(0, Math.floor(Number(stepValue) || 0));
        return patch(game, { step });
    }

    function getStep(game) {
        const state = ensureState(game);
        return Math.max(0, Math.floor(Number(state?.tutorial?.step) || 0));
    }

    function isCityIntroSeen(game) {
        const state = ensureState(game);
        return state?.tutorial?.cityIntroSeen === true;
    }

    function markCityIntroSeen(game, options = {}) {
        if (!game) return false;
        const skipped = options.skipped === true;
        const step = skipped
            ? 0
            : Math.max(1, Math.floor(Number(options.step) || 1));
        const choice = skipped ? 'skip' : 'guided';
        const stateApi = getStateApi();

        if (stateApi && typeof stateApi.markTutorialCityIntroSeen === 'function') {
            stateApi.markTutorialCityIntroSeen(game, {
                skipped,
                step,
                choice,
                updatedAt: Math.max(0, Math.floor(Number(options.updatedAt) || Date.now()))
            });
            save(game);
            return true;
        }

        return patch(game, {
            cityIntroSeen: true,
            cityIntroSkipped: skipped,
            cityIntroChoice: choice,
            mode: choice,
            step
        });
    }

    global.CitySimTutorialProgress = {
        save,
        patch,
        setStep,
        getStep,
        isCityIntroSeen,
        markCityIntroSeen
    };
})(window);
