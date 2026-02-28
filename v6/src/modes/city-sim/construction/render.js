// src/modes/city-sim/construction/render.js
(function attachCityConstructionRender(global) {
    'use strict';

    let contextAutoRefreshTimer = null;
    let contextAutoRefreshGame = null;

    function getDeps() {
        return (global.CitySimConstructionInternals && typeof global.CitySimConstructionInternals === 'object')
            ? global.CitySimConstructionInternals
            : {};
    }

    function getButtonAt(list, index) {
        if (!list || typeof list.length !== 'number') return null;
        return list[index] || null;
    }

    function setButtonState(button, label, enabled) {
        if (!button) return;
        if (typeof label === 'string' && label.length > 0) {
            button.textContent = label;
        }
        button.disabled = enabled !== true;
    }

    function setButtonVisible(button, visible) {
        if (!button) return;
        button.style.display = visible ? '' : 'none';
    }

    function getMoveHint(deps) {
        const formatNumber = (typeof deps.formatNumber === 'function')
            ? deps.formatNumber
            : (value) => String(Math.max(0, Math.floor(Number(value) || 0)));
        const moveCost = Math.max(0, Math.floor(Number(deps.MOVE_COST_MONEY) || 0));
        if (moveCost <= 0) return '이동할 위치를 선택하세요. (비용 없음)';
        return `이동할 위치를 선택하세요. (비용 ${formatNumber(moveCost)})`;
    }

    function formatRemainText(untilMs) {
        const remainMs = Math.max(0, Math.floor(Number(untilMs) - Date.now()));
        if (remainMs <= 0) return '완료';
        const sec = Math.max(1, Math.ceil(remainMs / 1000));
        return `${sec}s`;
    }

    function setContextAutoRefresh(game, enabled) {
        if (enabled !== true) {
            if (contextAutoRefreshTimer != null) {
                clearInterval(contextAutoRefreshTimer);
                contextAutoRefreshTimer = null;
            }
            contextAutoRefreshGame = null;
            return;
        }

        if (contextAutoRefreshTimer != null && contextAutoRefreshGame === game) {
            return;
        }

        if (contextAutoRefreshTimer != null) {
            clearInterval(contextAutoRefreshTimer);
            contextAutoRefreshTimer = null;
        }

        contextAutoRefreshGame = game;
        contextAutoRefreshTimer = setInterval(() => {
            if (!contextAutoRefreshGame) return;
            renderContextBar(contextAutoRefreshGame);
        }, 1000);
    }

    function renderContextBar(game) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') {
            setContextAutoRefresh(game, false);
            return;
        }

        const bar = document.getElementById('city-context-bar');
        if (!bar) {
            setContextAutoRefresh(game, false);
            return;
        }

        const titleEl = document.getElementById('city-context-title');
        const actionWrap = bar.querySelector('.city-context-actions');
        const actionButtons = bar.querySelectorAll('.city-context-actions button');
        const primaryBtn = getButtonAt(actionButtons, 0);
        const sellBtn = getButtonAt(actionButtons, 1);
        const moveBtn = getButtonAt(actionButtons, 2);
        const doneBtn = getButtonAt(actionButtons, 3);

        const state = CitySimState.ensure(game);
        const placement = state.placement || {};
        const placementActive = placement.active === true;
        const buildMode = placementActive && placement.mode === 'build';
        const moveMode = placementActive && placement.mode === 'move';
        const selectionInfo = (!placementActive && typeof deps.getSelectedTileInfo === 'function')
            ? deps.getSelectedTileInfo(game)
            : null;

        let showBar = false;
        let title = '선택된 건물이 없습니다';
        let primaryLabel = '기능';
        let primaryEnabled = false;
        let sellLabel = '판매';
        let sellEnabled = false;
        let moveLabel = '이동';
        let moveEnabled = false;
        let doneLabel = '완료';
        let doneEnabled = false;
        let showTitle = true;
        let singleActionMode = false;
        let tripleActionMode = false;
        let buildCancelMode = false;
        let showPrimaryButton = true;
        let showSellButton = true;
        let showMoveButton = true;
        let showDoneButton = true;
        let shouldTickCountdown = false;

        if (buildMode) {
            showBar = true;
            sellLabel = '건설취소';
            sellEnabled = true;
            buildCancelMode = true;
            showPrimaryButton = false;
            showMoveButton = false;
            showTitle = false;
            showDoneButton = false;
        } else if (moveMode) {
            showBar = true;
            title = String(placement.reason || getMoveHint(deps)).trim();
            doneLabel = '이동 취소';
            doneEnabled = true;
            showTitle = false;
            singleActionMode = true;
            showPrimaryButton = false;
            showSellButton = false;
            showMoveButton = false;
        } else if (selectionInfo) {
            showBar = true;

            const tileName = selectionInfo.def?.name || selectionInfo.tile || '건물';
            const formatNumber = (typeof deps.formatNumber === 'function')
                ? deps.formatNumber
                : (value) => String(Math.max(0, Math.floor(Number(value) || 0)));
            const catalog = (typeof deps.getProductionCatalog === 'function')
                ? deps.getProductionCatalog(selectionInfo.tile)
                : null;
            const queue = (catalog && typeof deps.getProductionQueueAt === 'function')
                ? deps.getProductionQueueAt(state, selectionInfo.index)
                : null;
            const queueReady = !!queue && (Number(queue.until) - Date.now()) <= 0;
            const incomeStatus = (global.CitySimEconomy && typeof global.CitySimEconomy.getIncomeStatus === 'function')
                ? global.CitySimEconomy.getIncomeStatus(game, selectionInfo.index, selectionInfo.tile)
                : null;

            if (selectionInfo.tile === 'drillground') {
                primaryLabel = '배치';
                primaryEnabled = true;
                title = `${tileName} 선택됨 · 유닛 관리`;
            } else if (catalog) {
                const actionLabel = selectionInfo.tile === 'powerplant' ? '연구' : '생산';
                primaryLabel = queueReady ? '수령' : actionLabel;
                primaryEnabled = true;
                if (queue) {
                    title = `${tileName} 선택됨 · ${actionLabel} ${formatRemainText(queue.until)}`;
                    if (!queueReady) shouldTickCountdown = true;
                } else {
                    title = `${tileName} 선택됨 · ${actionLabel} 대기`;
                }
            } else if (incomeStatus) {
                primaryEnabled = true;
                if (incomeStatus.claimable) {
                    primaryLabel = '수금';
                    title = `${tileName} 선택됨 · 세금 ₩${formatNumber(incomeStatus.stored)} 수금 가능`;
                } else {
                    const remainText = formatRemainText(Date.now() + Math.max(0, Number(incomeStatus.remainMs) || 0));
                    primaryLabel = `세금 ${remainText}`;
                    title = `${tileName} 선택됨 · 다음 세금 ${remainText}`;
                    shouldTickCountdown = true;
                }
            } else if (selectionInfo.tile === 'tax_office') {
                const batchStatus = (global.CitySimEconomy && typeof global.CitySimEconomy.getBatchIncomeStatus === 'function')
                    ? global.CitySimEconomy.getBatchIncomeStatus(game)
                    : null;
                const autoStatus = (global.CitySimEconomy && typeof global.CitySimEconomy.getAutoTaxStatus === 'function')
                    ? global.CitySimEconomy.getAutoTaxStatus(game)
                    : null;
                const batchNet = Math.max(0, Math.floor(Number(batchStatus?.net) || 0));
                const autoActive = !!autoStatus?.active;
                const autoRemainMs = Math.max(0, Math.floor(Number(autoStatus?.remainMs) || 0));
                const autoRemainText = autoActive
                    ? formatRemainText(Date.now() + autoRemainMs)
                    : `${Math.max(1, Math.floor(Number(autoStatus?.durationHours) || 4))}h`;
                primaryLabel = batchNet > 0
                    ? `일괄수금 +${formatNumber(batchNet)}`
                    : '세무기능';
                primaryEnabled = true;
                title = `${tileName} 선택됨 · 자동수금 ${autoRemainText}`;
                if (autoActive) shouldTickCountdown = true;
            } else {
                title = `${tileName} 선택됨`;
            }

            const canEdit = selectionInfo.tile !== 'hq';
            if (canEdit) sellLabel = '판매';
            sellEnabled = canEdit;
            moveEnabled = canEdit;
            doneLabel = '해제';
            doneEnabled = true;
        }

        bar.classList.toggle('active', showBar);
        if (actionWrap) {
            actionWrap.classList.toggle('is-single', singleActionMode);
            actionWrap.classList.toggle('is-triple', tripleActionMode);
            actionWrap.classList.toggle('is-build-cancel', buildCancelMode);
        }

        if (titleEl) {
            titleEl.textContent = title;
            titleEl.style.display = showTitle ? '' : 'none';
        }

        setButtonState(primaryBtn, primaryLabel, primaryEnabled);
        setButtonState(sellBtn, sellLabel, sellEnabled);
        setButtonState(moveBtn, moveLabel, moveEnabled);
        setButtonState(doneBtn, doneLabel, doneEnabled);
        setButtonVisible(primaryBtn, showPrimaryButton && !singleActionMode);
        setButtonVisible(sellBtn, showSellButton && !singleActionMode);
        setButtonVisible(moveBtn, showMoveButton && !singleActionMode);
        setButtonVisible(doneBtn, showDoneButton);

        setContextAutoRefresh(game, showBar && shouldTickCountdown);
    }

    const renderApi = {
        renderContextBar
    };

    global.CitySimConstructionRender = renderApi;

    const api = global.CitySimConstruction;
    if (api && typeof api === 'object') {
        Object.assign(api, renderApi);
    }
})(window);
