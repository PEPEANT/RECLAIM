(function (global) {
    function showToast(message) {
        if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
            ui.showToast(message);
        }
    }

    function renderUnits(game) {
        const state = CitySimState.ensure(game);
        const units = state.units || {};

        const el = document.getElementById('city-unit-icbm');
        if (el) el.textContent = String(Math.floor(units.icbm || 0));
    }

    function trainUnit(game, type) {
        // 현재 시티 화면에서는 ICBM만 관리한다.
        if (type !== 'icbm') {
            showToast('현재는 ICBM만 훈련할 수 있습니다.');
            return;
        }

        const unitCostMult = (() => {
            const raw = Number(global.UNIT_GLOBAL_COST_MULT);
            return (Number.isFinite(raw) && raw > 0 && raw <= 1) ? raw : 1;
        })();
        const unitDef = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units)
            ? CONFIG.units[type]
            : null;
        const popNeed = (typeof CitySimEconomy !== 'undefined'
            && CitySimEconomy
            && typeof CitySimEconomy.getUnitPopulationNeed === 'function')
            ? Math.max(0, Math.floor(Number(CitySimEconomy.getUnitPopulationNeed(type, unitDef)) || 0))
            : 1;
        const cost = { costMoney: Math.max(1, Math.floor(950 * unitCostMult)) };
        const state = CitySimState.ensure(game);
        const currentIcbm = Math.floor(state.units?.icbm || 0);

        if (currentIcbm >= 2) {
            showToast('ICBM은 최대 2기까지 보유할 수 있습니다.');
            return;
        }

        if ((Number(state.res?.pop) || 0) + popNeed > (Number(state.res?.maxPop) || 0)) {
            showToast(`인구 한도가 부족합니다. (필요 ${popNeed})`);
            return;
        }

        if (!CitySimEconomy.canPayCost(game, cost)) {
            showToast('자금이 부족합니다.');
            return;
        }

        CitySimEconomy.payCost(game, cost);
        CitySimState.mutate(game, (draft) => {
            if (!draft.units || typeof draft.units !== 'object') draft.units = {};
            draft.units.icbm = Math.max(0, Math.floor(Number(draft.units.icbm) || 0)) + 1;
        });

        if (typeof game.recalcCityDerived === 'function') game.recalcCityDerived();
        if (typeof game.renderCityScreen === 'function') game.renderCityScreen();
        if (typeof game.saveCitySimState === 'function') game.saveCitySimState();

        showToast('ICBM 훈련이 완료되었습니다.');
    }

    function openTrainingGuide(game) {
        if (!game || typeof game.openCityActionModal !== 'function') return;

        game.openCityActionModal(
            '유닛 훈련',
            '현재 시티 모드에서는 ICBM만 훈련할 수 있습니다.\n최대 보유 수량: 2기'
        );
    }

    global.CitySimBarracks = {
        renderUnits,
        trainUnit,
        openTrainingGuide
    };
})(window);
