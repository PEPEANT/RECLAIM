// src/modes/city-sim/construction/placement.js
(function attachCityConstructionPlacement(global) {
    'use strict';

    function getDeps() {
        return (global.CitySimConstructionInternals && typeof global.CitySimConstructionInternals === 'object')
            ? global.CitySimConstructionInternals
            : {};
    }

    function showToast(message) {
        const deps = getDeps();
        if (typeof deps.showToast === 'function') {
            deps.showToast(message);
            return;
        }
        if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            ui.showToast(message);
        }
    }

    function renderGrid(game) {
        const deps = getDeps();
        if (typeof deps.renderGrid === 'function') {
            deps.renderGrid(game);
        }
    }

    function renderContextBar(game) {
        if (global.CitySimConstructionRender
            && typeof global.CitySimConstructionRender.renderContextBar === 'function') {
            global.CitySimConstructionRender.renderContextBar(game);
        }
    }

    function renderBuildSelection(game) {
        const deps = getDeps();
        if (typeof deps.renderBuildSelection === 'function') {
            deps.renderBuildSelection(game);
        }
    }

    function renderInventoryPanel(game) {
        const deps = getDeps();
        if (typeof deps.renderInventoryPanel === 'function') {
            deps.renderInventoryPanel(game);
        }
    }

    function closeShopPanel() {
        if (typeof CitySimGacha !== 'undefined'
            && CitySimGacha
            && typeof CitySimGacha.close === 'function') {
            CitySimGacha.close();
        }
    }

    function setBuildHint(message) {
        const deps = getDeps();
        if (typeof deps.setBuildHint === 'function') {
            deps.setBuildHint(message);
        }
    }

    function isDrillgroundTile(tile, depsInput) {
        const deps = depsInput || getDeps();
        if (typeof deps.isDrillgroundTile === 'function') {
            return deps.isDrillgroundTile(tile);
        }
        const key = String(tile || '').trim();
        return key === 'drillground' || key === 'drillground_gray';
    }

    function getMoveStartHint() {
        const deps = getDeps();
        const formatNumber = (typeof deps.formatNumber === 'function')
            ? deps.formatNumber
            : (value) => String(Math.max(0, Math.floor(Number(value) || 0)));
        const moveCost = Math.max(0, Math.floor(Number(deps.MOVE_COST_MONEY) || 0));
        if (moveCost <= 0) return '이동할 위치를 선택하세요. (비용 없음)';
        return `이동할 위치를 선택하세요. (비용 ${formatNumber(moveCost)})`;
    }

    function openTaxOfficeActions(game) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        const CitySimEconomy = global.CitySimEconomy;
        if (!game || typeof game.openCityActionModal !== 'function') return;
        if (!CitySimEconomy || typeof CitySimEconomy.getBatchIncomeStatus !== 'function') {
            showToast('세무소 기능을 불러오지 못했습니다.');
            return;
        }

        const formatNumber = (typeof deps.formatNumber === 'function')
            ? deps.formatNumber
            : (value) => String(Math.max(0, Math.floor(Number(value) || 0)));
        const getCurrentMoney = () => {
            const state = (CitySimState && typeof CitySimState.ensure === 'function')
                ? CitySimState.ensure(game)
                : null;
            return Math.max(0, Math.floor(Number(state?.res?.money) || 0));
        };
        const getAutoStatus = () => (
            (typeof CitySimEconomy.getAutoTaxStatus === 'function')
                ? CitySimEconomy.getAutoTaxStatus(game)
                : null
        );
        const formatRemainClock = (remainMs) => {
            const totalSec = Math.max(0, Math.ceil(Math.max(0, Number(remainMs) || 0) / 1000));
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        };

        const batch = CitySimEconomy.getBatchIncomeStatus(game);
        const auto = getAutoStatus();
        const batchNet = Math.max(0, Math.floor(Number(batch?.net) || 0));
        const autoCost = Math.max(0, Math.floor(Number(auto?.cost) || 0));
        const autoDurationHours = Math.max(1, Math.floor(Number(auto?.durationHours) || 0));
        const autoActive = !!auto?.active;
        const autoLabel = autoActive
            ? `자동수금 ${formatRemainClock(auto?.remainMs)}`
            : `자동수금 시작 (${autoDurationHours}시간)`;

        const html = [
            '<div class="city-tax-modal-wrap">',
            `<button type="button" class="city-tax-modal-btn is-batch" data-city-tax-batch="1">일괄수금 +${formatNumber(batchNet)}</button>`,
            `<button type="button" class="city-tax-modal-btn is-auto" data-city-tax-auto="1">${autoLabel}</button>`,
            `<div class="city-tax-modal-info" data-city-tax-auto-info="1">${autoActive ? '자동수금 활성화중' : '자동수금 설명'}</div>`,
            '</div>'
        ].join('');

        game.openCityActionModal('세무소 기능', html, {
            allowHtml: true,
            detail: '',
            onClose: () => {
                if (refreshTimer != null) {
                    clearInterval(refreshTimer);
                    refreshTimer = null;
                }
            }
        });

        const msgEl = document.getElementById('city-action-msg');
        if (!msgEl) return;
        const batchBtn = msgEl.querySelector('[data-city-tax-batch="1"]');
        const autoBtn = msgEl.querySelector('[data-city-tax-auto="1"]');
        const autoInfo = msgEl.querySelector('[data-city-tax-auto-info="1"]');
        let refreshTimer = null;
        let busy = false;

        const readLiveState = () => {
            const liveBatch = CitySimEconomy.getBatchIncomeStatus(game);
            const liveBatchNet = Math.max(0, Math.floor(Number(liveBatch?.net) || 0));
            const liveAuto = getAutoStatus();
            const liveAutoActive = !!liveAuto?.active;
            const liveCost = Math.max(0, Math.floor(Number(liveAuto?.cost) || autoCost));
            const liveDurationHours = Math.max(1, Math.floor(Number(liveAuto?.durationHours) || autoDurationHours));
            const liveMoney = getCurrentMoney();
            const canBatch = liveBatchNet > 0;
            const canAutoBuy = !liveAutoActive && liveMoney >= liveCost;
            return {
                batchNet: liveBatchNet,
                autoActive: liveAutoActive,
                autoRemainMs: Math.max(0, Math.floor(Number(liveAuto?.remainMs) || 0)),
                autoDurationHours: liveDurationHours,
                canBatch,
                canAutoBuy
            };
        };

        const refreshUi = () => {
            const live = readLiveState();
            if (batchBtn) {
                batchBtn.textContent = `일괄수금 +${formatNumber(live.batchNet)}`;
                batchBtn.disabled = busy || !live.canBatch;
            }
            if (autoBtn) {
                autoBtn.textContent = live.autoActive
                    ? `자동수금 ${formatRemainClock(live.autoRemainMs)}`
                    : `자동수금 시작 (${live.autoDurationHours}시간)`;
                // 활성 중에는 연장 구매 금지
                autoBtn.disabled = busy || !live.canAutoBuy;
            }
            if (autoInfo) {
                autoInfo.textContent = live.autoActive ? '자동수금 활성화중' : '자동수금 설명';
            }
        };

        const setBusy = (nextBusy) => {
            busy = nextBusy === true;
            refreshUi();
        };

        refreshUi();
        refreshTimer = setInterval(() => {
            if (busy) return;
            refreshUi();
        }, 1000);

        if (batchBtn) {
            batchBtn.addEventListener('click', () => {
                setBusy(true);
                const result = CitySimEconomy.claimAllIncome(game);
                if (result && result.ok === true && typeof game.closeCityActionModal === 'function') {
                    game.closeCityActionModal();
                } else {
                    setBusy(false);
                }
                renderContextBar(game);
            });
        }

        if (autoBtn) {
            autoBtn.addEventListener('click', () => {
                setBusy(true);
                const result = (typeof CitySimEconomy.activateAutoTaxCollect === 'function')
                    ? CitySimEconomy.activateAutoTaxCollect(game)
                    : { ok: false };
                if (result && result.ok === true && typeof game.closeCityActionModal === 'function') {
                    game.closeCityActionModal();
                } else {
                    setBusy(false);
                }
                renderContextBar(game);
            });
        }
    }

    function updatePanelClasses(game, options) {
        const opts = options || {};
        const buildOpen = opts.buildOpen === true;
        const inventoryOpen = opts.inventoryOpen === true;
        const missionClosed = opts.missionClosed === true;

        const buildPanel = document.getElementById('city-build-panel');
        if (buildPanel) buildPanel.classList.toggle('open', buildOpen);

        const inventoryPanel = document.getElementById('city-inventory-panel');
        if (inventoryPanel) inventoryPanel.classList.toggle('open', inventoryOpen);

        const missionCard = document.getElementById('city-mission-card');
        if (missionCard && missionClosed) missionCard.classList.add('hidden');

        const missionToggle = document.querySelector('.city-mission-toggle');
        if (missionToggle && missionClosed) missionToggle.classList.remove('hidden');

        const screen = document.getElementById('city-screen');
        if (screen) {
            screen.classList.toggle('city-build-open', buildOpen);
            screen.classList.toggle('city-inventory-open', inventoryOpen);
            if (missionClosed) screen.classList.remove('city-mission-open');
        }
    }

    function openBuildPanel(game, forceOpen) {
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const state = CitySimState.ensure(game);
        const wasOpen = state.buildPanelOpen === true;
        const open = (typeof forceOpen === 'boolean') ? forceOpen : !state.buildPanelOpen;
        const opening = open && !wasOpen;

        if (opening) {
            CitySimState.setInventoryPanelOpen(game, false);
            CitySimState.setMissionOpen(game, false);
            if (state.placement?.mode === 'move') {
                CitySimState.clearPlacement(game);
            }
            CitySimState.clearSelection(game);
            if (typeof game?.closeCityActionModal === 'function') {
                game.closeCityActionModal();
            }
            closeShopPanel();
        }

        CitySimState.setBuildPanelOpen(game, open);
        updatePanelClasses(game, {
            buildOpen: open,
            inventoryOpen: false,
            missionClosed: open
        });

        if (open) {
            renderBuildSelection(game);
            const latest = CitySimState.ensure(game);
            const nextHint = (latest.placement?.active && latest.placement?.reason)
                ? latest.placement.reason
                : (getDeps().MSG_SELECT_CARD || '카드를 선택하세요.');
            setBuildHint(nextHint);
        } else if (!CitySimState.ensure(game).placement?.active) {
            setBuildHint(getDeps().MSG_SELECT_CARD || '카드를 선택하세요.');
        }

        renderGrid(game);
        renderContextBar(game);
    }

    function openInventory(game, forceOpen) {
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const state = CitySimState.ensure(game);
        const wasOpen = state.inventoryPanelOpen === true;
        const open = (typeof forceOpen === 'boolean') ? forceOpen : !state.inventoryPanelOpen;
        const opening = open && !wasOpen;

        if (opening) {
            CitySimState.setBuildPanelOpen(game, false);
            CitySimState.setMissionOpen(game, false);
            CitySimState.clearPlacement(game);
            CitySimState.clearSelection(game);
            if (typeof game?.closeCityActionModal === 'function') {
                game.closeCityActionModal();
            }
            closeShopPanel();
        }

        CitySimState.setInventoryPanelOpen(game, open);
        updatePanelClasses(game, {
            buildOpen: false,
            inventoryOpen: open,
            missionClosed: open
        });

        if (open) {
            renderInventoryPanel(game);
            setBuildHint(getDeps().MSG_SELECT_CARD || '카드를 선택하세요.');
        }

        renderGrid(game);
        renderContextBar(game);
    }

    function setBuildTool(game, tool) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const selectedTool = String(tool || '').trim();
        const def = deps.BUILDING_DEFS && deps.BUILDING_DEFS[selectedTool];
        if (!def) return;

        const state = CitySimState.ensure(game);
        if (!state.buildPanelOpen) {
            openBuildPanel(game, true);
        }

        CitySimState.setSelectedTool(game, selectedTool);
        CitySimState.setPlacement(game, {
            active: true,
            mode: 'build',
            tool: selectedTool,
            targetIndex: null,
            canPlace: false,
            reason: deps.MSG_SELECT_TILE || '배치할 타일을 선택하세요.',
            sourceIndex: null
        });
        CitySimState.clearSelection(game);
        if (game && typeof game === 'object') {
            game._citySuppressClickUntil = Date.now() + 220;
        }

        if (typeof game?.closeCityActionModal === 'function') {
            game.closeCityActionModal();
        }

        const isMobile = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
            ? window.matchMedia('(pointer: coarse)').matches
            : false;
        if (isMobile) {
            CitySimState.setBuildPanelOpen(game, false);
            updatePanelClasses(game, {
                buildOpen: false,
                inventoryOpen: false,
                missionClosed: true
            });
        }

        setBuildHint(deps.MSG_SELECT_TILE || '배치할 타일을 선택하세요.');
        renderBuildSelection(game);
        renderGrid(game);
        renderContextBar(game);
    }

    function updatePlacementPreview(game, index) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const state = CitySimState.ensure(game);
        const placement = state.placement || null;
        if (!placement || placement.active !== true) return;

        const cellIndex = Number(index);
        if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= state.grid.length) {
            if (placement.targetIndex != null) {
                CitySimState.setPlacement(game, {
                    targetIndex: null,
                    canPlace: false,
                    reason: placement.mode === 'move'
                        ? getMoveStartHint()
                        : (deps.MSG_SELECT_TILE || '배치할 타일을 선택하세요.')
                });
                if (!(game && game._cityRoadTreeBrushActive === true)) {
                    setBuildHint(
                        placement.mode === 'move'
                            ? getMoveStartHint()
                            : (deps.MSG_SELECT_TILE || '배치할 타일을 선택하세요.')
                    );
                }
                renderGrid(game);
            }
            return;
        }

        let check = null;
        if (placement.mode === 'move') {
            if (typeof deps.evaluateMovePlacement === 'function') {
                check = deps.evaluateMovePlacement(game, cellIndex, placement);
            }
        } else if (typeof deps.evaluatePlacement === 'function') {
            check = deps.evaluatePlacement(game, cellIndex, placement);
        }

        if (!check || typeof check !== 'object') {
            check = { ok: false, reason: '배치 검증 정보를 확인할 수 없습니다.' };
        }

        const prevTarget = Number(placement.targetIndex);
        const prevCanPlace = placement.canPlace === true;
        const prevReason = String(placement.reason || '');
        if (prevTarget === cellIndex && prevCanPlace === (check.ok === true) && prevReason === String(check.reason || '')) {
            return;
        }

        CitySimState.setPlacement(game, {
            targetIndex: cellIndex,
            canPlace: check.ok === true,
            reason: String(check.reason || '')
        });

        if (!(game && game._cityRoadTreeBrushActive === true)) {
            setBuildHint(String(check.reason || ''));
        }
        renderGrid(game);
    }

    function clearPlacementPreview(game) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const state = CitySimState.ensure(game);
        const placement = state.placement || null;
        if (!placement || placement.active !== true) return;
        if (placement.targetIndex == null && placement.canPlace !== true) return;

        const reason = placement.mode === 'move'
            ? getMoveStartHint()
            : (deps.MSG_SELECT_TILE || '배치할 타일을 선택하세요.');
        CitySimState.setPlacement(game, {
            targetIndex: null,
            canPlace: false,
            reason
        });
        if (!(game && game._cityRoadTreeBrushActive === true)) {
            setBuildHint(reason);
        }
        renderGrid(game);
    }

    function applyMovePlacement(game, index) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        const CitySimEconomy = global.CitySimEconomy;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return false;

        const state = CitySimState.ensure(game);
        const placement = state.placement || null;
        const source = (typeof deps.getMoveSourceInfo === 'function')
            ? deps.getMoveSourceInfo(state, placement)
            : null;
        if (!source) {
            const message = '이동할 건물을 찾을 수 없습니다.';
            showToast(message);
            setBuildHint(message);
            CitySimState.clearPlacement(game);
            renderGrid(game);
            renderContextBar(game);
            return false;
        }

        const check = (typeof deps.evaluateMovePlacement === 'function')
            ? deps.evaluateMovePlacement(game, index, placement)
            : { ok: false, reason: '이동 검증 모듈이 준비되지 않았습니다.' };
        CitySimState.setPlacement(game, {
            targetIndex: index,
            canPlace: check.ok === true,
            reason: String(check.reason || '')
        });
        if (!check.ok) {
            setBuildHint(String(check.reason || '이동할 수 없습니다.'));
            showToast(String(check.reason || '이동할 수 없습니다.'));
            renderGrid(game);
            return false;
        }

        const formatNumber = (typeof deps.formatNumber === 'function')
            ? deps.formatNumber
            : (value) => String(Math.max(0, Math.floor(Number(value) || 0)));
        const moveCost = Math.max(0, Math.floor(Number(deps.MOVE_COST_MONEY) || 0));
        if (moveCost > 0) {
            if (!CitySimEconomy
                || typeof CitySimEconomy.canPayCost !== 'function'
                || !CitySimEconomy.canPayCost(game, { costMoney: moveCost })) {
                const message = `자금이 부족합니다. (필요: ${formatNumber(moveCost)})`;
                setBuildHint(message);
                showToast(message);
                renderGrid(game);
                return false;
            }
        }

        const sourceIndex = source.index;
        const targetIndex = index;
        const sourceTile = source.tile;
        const sourceQueue = (typeof deps.getProductionCatalog === 'function'
            && deps.getProductionCatalog(sourceTile)
            && typeof deps.getProductionQueueAt === 'function')
            ? deps.getProductionQueueAt(state, sourceIndex)
            : null;
        const sourceDrillgroundUnit = (isDrillgroundTile(sourceTile, deps) && typeof deps.getDrillgroundUnitAt === 'function')
            ? deps.getDrillgroundUnitAt(state, sourceIndex)
            : null;
        const sourceDrillgroundAnchorIndex = (isDrillgroundTile(sourceTile, deps)
            && typeof deps.getDrillgroundPlacementAnchorIndex === 'function')
            ? deps.getDrillgroundPlacementAnchorIndex(state, sourceIndex)
            : sourceIndex;
        const sourceDrillgroundVeteranId = (
            Number.isInteger(sourceDrillgroundAnchorIndex)
            && state.drillgroundVeteranSlots
            && typeof state.drillgroundVeteranSlots === 'object'
        )
            ? String(state.drillgroundVeteranSlots[sourceDrillgroundAnchorIndex] || '').trim()
            : '';
        const sourceDrillgroundSourceMode = sourceDrillgroundVeteranId ? 'veteran' : 'normal';

        if (
            isDrillgroundTile(sourceTile, deps)
            && sourceDrillgroundUnit
            && typeof deps.canPlaceDrillgroundUnitAtAnchor === 'function'
        ) {
            const simulatedGrid = Array.isArray(state.grid) ? state.grid.slice() : [];
            simulatedGrid[sourceIndex] = null;
            simulatedGrid[targetIndex] = sourceTile;

            const simulatedSlots = {};
            if (state.drillgroundSlots && typeof state.drillgroundSlots === 'object') {
                Object.keys(state.drillgroundSlots).forEach((rawIndex) => {
                    simulatedSlots[rawIndex] = state.drillgroundSlots[rawIndex];
                });
            }
            if (Number.isInteger(sourceDrillgroundAnchorIndex)) {
                delete simulatedSlots[sourceDrillgroundAnchorIndex];
            } else {
                delete simulatedSlots[sourceIndex];
            }
            const simulatedVeteranSlots = {};
            if (state.drillgroundVeteranSlots && typeof state.drillgroundVeteranSlots === 'object') {
                Object.keys(state.drillgroundVeteranSlots).forEach((rawIndex) => {
                    simulatedVeteranSlots[rawIndex] = state.drillgroundVeteranSlots[rawIndex];
                });
            }
            if (Number.isInteger(sourceDrillgroundAnchorIndex)) {
                delete simulatedVeteranSlots[sourceDrillgroundAnchorIndex];
            } else {
                delete simulatedVeteranSlots[sourceIndex];
            }

            const simulatedState = Object.assign({}, state, {
                grid: simulatedGrid,
                drillgroundSlots: simulatedSlots,
                drillgroundVeteranSlots: simulatedVeteranSlots
            });
            const drillgroundMoveCheck = deps.canPlaceDrillgroundUnitAtAnchor(
                simulatedState,
                targetIndex,
                sourceDrillgroundUnit
            );
            if (!drillgroundMoveCheck || drillgroundMoveCheck.ok !== true) {
                const message = String(drillgroundMoveCheck?.reason || '해당 위치에는 연병장 유닛을 이동할 수 없습니다.');
                setBuildHint(message);
                showToast(message);
                renderGrid(game);
                return false;
            }
        }

        if (typeof deps.isFootprintTool === 'function' && deps.isFootprintTool(sourceTile)) {
            const sourceFootprint = (typeof deps.getFootprintAtAnchor === 'function')
                ? deps.getFootprintAtAnchor(state, sourceIndex, sourceTile, false)
                : null;
            const targetFootprint = (typeof deps.getFootprintAtAnchor === 'function')
                ? deps.getFootprintAtAnchor(state, targetIndex, sourceTile, true)
                : null;
            if (!Array.isArray(sourceFootprint) || sourceFootprint.length === 0) {
                const message = `${source.def?.name || sourceTile} 원본 형태를 확인할 수 없습니다.`;
                setBuildHint(message);
                showToast(message);
                renderGrid(game);
                return false;
            }
            if (!Array.isArray(targetFootprint) || targetFootprint.length === 0) {
                const message = (typeof deps.getFootprintRequirementMessage === 'function')
                    ? deps.getFootprintRequirementMessage(sourceTile)
                    : '이동할 수 없는 위치입니다.';
                setBuildHint(message);
                showToast(message);
                renderGrid(game);
                return false;
            }

            sourceFootprint.forEach((entry) => {
                const currentTile = state.grid[entry.index] ?? null;
                if (typeof deps.isFootprintTile === 'function' && !deps.isFootprintTile(currentTile)) return;
                CitySimState.setGridTile(game, entry.index, null);
            });
            targetFootprint.forEach((entry) => {
                CitySimState.setGridTile(game, entry.index, entry.tile);
            });
        } else {
            CitySimState.setGridTile(game, sourceIndex, null);
            CitySimState.setGridTile(game, targetIndex, sourceTile);
            if (isDrillgroundTile(sourceTile, deps) && sourceDrillgroundUnit) {
                if (typeof deps.setDrillgroundUnitAtAnchor === 'function') {
                    const applied = deps.setDrillgroundUnitAtAnchor(
                        game,
                        targetIndex,
                        sourceDrillgroundUnit,
                        null,
                        {
                            sourceMode: sourceDrillgroundSourceMode,
                            veteranId: sourceDrillgroundVeteranId
                        }
                    );
                    if (!applied) {
                        CitySimState.setGridTile(game, targetIndex, null);
                        CitySimState.setGridTile(game, sourceIndex, sourceTile);
                        if (typeof deps.setDrillgroundUnitAtAnchor === 'function') {
                            deps.setDrillgroundUnitAtAnchor(
                                game,
                                Number.isInteger(sourceDrillgroundAnchorIndex) ? sourceDrillgroundAnchorIndex : sourceIndex,
                                sourceDrillgroundUnit,
                                null,
                                {
                                    sourceMode: sourceDrillgroundSourceMode,
                                    veteranId: sourceDrillgroundVeteranId
                                }
                            );
                        } else {
                            CitySimState.setDrillgroundUnit(
                                game,
                                Number.isInteger(sourceDrillgroundAnchorIndex) ? sourceDrillgroundAnchorIndex : sourceIndex,
                                sourceDrillgroundUnit
                            );
                        }
                        const message = '연병장 유닛 이동에 실패했습니다. 위치를 다시 확인하세요.';
                        setBuildHint(message);
                        showToast(message);
                        renderGrid(game);
                        return false;
                    }
                } else {
                    CitySimState.setDrillgroundUnit(game, targetIndex, sourceDrillgroundUnit);
                }
            }
        }

        if (sourceQueue && typeof CitySimState.setProductionQueue === 'function') {
            CitySimState.setProductionQueue(game, targetIndex, sourceQueue);
        }

        if (moveCost > 0 && CitySimEconomy && typeof CitySimEconomy.payCost === 'function') {
            CitySimEconomy.payCost(game, { costMoney: moveCost });
        }

        CitySimState.clearPlacement(game);
        CitySimState.setSelection(game, targetIndex, sourceTile);
        if (moveCost > 0) {
            setBuildHint(`${source.def?.name || sourceTile} 이동 완료 (-${formatNumber(moveCost)})`);
        } else {
            setBuildHint(`${source.def?.name || sourceTile} 이동 완료`);
        }
        renderGrid(game);
        renderContextBar(game);
        if (typeof deps.persist === 'function') {
            deps.persist(game);
        }
        return true;
    }

    function applyPlacement(game, index) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        const CitySimEconomy = global.CitySimEconomy;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return false;

        const state = CitySimState.ensure(game);
        const tool = state.placement?.tool || state.selectedTool;
        let shouldRefreshUnits = false;
        let demolitionTargets = [];

        const check = (typeof deps.evaluatePlacement === 'function')
            ? deps.evaluatePlacement(game, index, state.placement)
            : { ok: false, reason: '배치 검증 모듈이 준비되지 않았습니다.' };
        CitySimState.setPlacement(game, {
            targetIndex: index,
            canPlace: check.ok === true,
            reason: String(check.reason || '')
        });

        if (!check.ok) {
            setBuildHint(String(check.reason || '배치할 수 없습니다.'));
            showToast(String(check.reason || '배치할 수 없습니다.'));
            renderGrid(game);
            return false;
        }

        const shouldCharge = (typeof deps.shouldChargeBuildPlacementCost === 'function')
            ? deps.shouldChargeBuildPlacementCost(state, index, tool)
            : false;
        const shouldTrackBuildQuest = (
            shouldCharge
            && typeof deps.isObjectTool === 'function'
            && deps.isObjectTool(tool)
            && tool !== 'eraser'
        );
        const costMoney = (typeof deps.getBuildToolCostMoney === 'function')
            ? deps.getBuildToolCostMoney(tool)
            : 0;
        const formatNumber = (typeof deps.formatNumber === 'function')
            ? deps.formatNumber
            : (value) => String(Math.max(0, Math.floor(Number(value) || 0)));

        if (shouldCharge && costMoney > 0) {
            if (!CitySimEconomy
                || typeof CitySimEconomy.canPayCost !== 'function'
                || !CitySimEconomy.canPayCost(game, { costMoney })) {
                const message = `자금이 부족합니다. (필요: ${formatNumber(costMoney)})`;
                setBuildHint(message);
                showToast(message);
                renderGrid(game);
                return false;
            }
            if (typeof CitySimEconomy.payCost === 'function') {
                CitySimEconomy.payCost(game, { costMoney });
            }
        }

        if (tool === 'ground_grass') {
            CitySimState.setGroundTile(game, index, 'grass');
        } else if (tool === 'ground_dirt') {
            CitySimState.setGroundTile(game, index, 'dirt');
        } else if (tool === 'ground_concrete') {
            CitySimState.setGroundTile(game, index, 'concrete');
        } else if (tool === 'ground_asphalt') {
            CitySimState.setGroundTile(game, index, 'asphalt');
        } else if (typeof deps.isFootprintTool === 'function' && deps.isFootprintTool(tool)) {
            const footprint = (typeof deps.getFootprintAtAnchor === 'function')
                ? deps.getFootprintAtAnchor(state, index, tool, true)
                : null;
            if (!Array.isArray(footprint) || footprint.length === 0) {
                const message = (typeof deps.getFootprintRequirementMessage === 'function')
                    ? deps.getFootprintRequirementMessage(tool)
                    : '배치 조건을 확인하세요.';
                setBuildHint(message);
                showToast(message);
                renderGrid(game);
                return false;
            }
            footprint.forEach((entry) => {
                CitySimState.setGridTile(game, entry.index, entry.tile);
            });
        } else if (tool === 'eraser') {
            const currentTile = state.grid[index] ?? null;
            if (isDrillgroundTile(currentTile, deps)) {
                if (typeof deps.releaseDrillgroundUnit === 'function') {
                    deps.releaseDrillgroundUnit(game, index);
                    shouldRefreshUnits = true;
                }
                CitySimState.setGridTile(game, index, null);
                demolitionTargets = [index];
            } else if (typeof deps.isFootprintTile === 'function' && deps.isFootprintTile(currentTile)) {
                demolitionTargets = (typeof deps.clearFootprintAtIndex === 'function')
                    ? (deps.clearFootprintAtIndex(game, state, index, currentTile) || [])
                    : [];
            } else {
                CitySimState.setGridTile(game, index, null);
                if (currentTile) demolitionTargets = [index];
            }
        } else {
            const nextObject = (typeof deps.isObjectTool === 'function' && deps.isObjectTool(tool))
                ? tool
                : null;
            CitySimState.setGridTile(game, index, nextObject);
        }

        const defs = deps.BUILDING_DEFS || {};
        const toolName = defs[tool]?.name || String(tool || '건물');
        const doneMessage = (
            tool === 'ground_dirt' ||
            tool === 'ground_grass' ||
            tool === 'ground_concrete' ||
            tool === 'ground_asphalt' ||
            tool === 'eraser'
        )
            ? `${toolName} 적용 완료`
            : `${toolName} 배치 완료`;

        CitySimState.setPlacement(game, {
            active: true,
            mode: 'build',
            tool,
            targetIndex: index,
            canPlace: false,
            reason: doneMessage,
            sourceIndex: null
        });

        if (!(game && game._cityRoadTreeBrushActive === true)) {
            setBuildHint(doneMessage);
        }

        if (shouldTrackBuildQuest
            && game
            && typeof game.onQuestMissionEvent === 'function') {
            game.onQuestMissionEvent('build', { tool, count: 1 });
        }

        renderGrid(game);
        if (game && typeof game.renderCityResources === 'function') {
            game.renderCityResources();
        }
        if (shouldRefreshUnits && typeof deps.refreshCityUnitPanels === 'function') {
            deps.refreshCityUnitPanels(game);
        }
        if (tool === 'eraser'
            && Array.isArray(demolitionTargets)
            && demolitionTargets.length > 0
            && typeof deps.playDemolitionSmokeEffect === 'function') {
            deps.playDemolitionSmokeEffect(game, demolitionTargets);
        }
        if (typeof deps.persist === 'function') {
            deps.persist(game);
        }
        return true;
    }

    function handleCellAction(game, index, options) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const state = CitySimState.ensure(game);
        const cellIndex = Number(index);
        if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= state.grid.length) return;

        const placement = state.placement || null;
        if (placement && placement.active === true) {
            if (placement.mode === 'move') {
                applyMovePlacement(game, cellIndex);
                return;
            }
            applyPlacement(game, cellIndex);
            return;
        }

        const target = options && options.target;
        if (target && typeof deps.isIncomeClaimTarget === 'function' && deps.isIncomeClaimTarget(target)) {
            if (global.CitySimEconomy && typeof global.CitySimEconomy.claimIncome === 'function') {
                global.CitySimEconomy.claimIncome(game, cellIndex);
            }
            renderContextBar(game);
            return;
        }

        if (target && typeof deps.isProductionClaimTarget === 'function' && deps.isProductionClaimTarget(target)) {
            if (typeof deps.claimBuildingProducedUnit === 'function') {
                deps.claimBuildingProducedUnit(game, cellIndex);
            }
            return;
        }

        const tile = state.grid[cellIndex] ?? null;
        const objectLike = !!tile && (
            (typeof deps.isObjectTool === 'function' && deps.isObjectTool(tile))
            || (typeof deps.isFootprintTile === 'function' && deps.isFootprintTile(tile))
        );

        if (!objectLike) {
            CitySimState.clearSelection(game);
            renderGrid(game);
            renderContextBar(game);
            return;
        }

        const normalized = (typeof deps.normalizeObjectSelection === 'function')
            ? deps.normalizeObjectSelection(state, cellIndex, tile)
            : { index: cellIndex, tile };
        const selectedIndex = Number(normalized.index);
        const selectedTile = normalized.tile;
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= state.grid.length || !selectedTile) {
            CitySimState.clearSelection(game);
            renderGrid(game);
            renderContextBar(game);
            return;
        }

        CitySimState.setSelection(game, selectedIndex, selectedTile);
        renderGrid(game);
        renderContextBar(game);

        if (target
            && isDrillgroundTile(selectedTile, deps)
            && typeof deps.isDrillgroundUnitTarget === 'function'
            && deps.isDrillgroundUnitTarget(target)
            && typeof deps.openDrillgroundUnitProfile === 'function') {
            deps.openDrillgroundUnitProfile(game, selectedIndex);
        }
    }

    function triggerPrimaryAction(game) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const state = CitySimState.ensure(game);
        const placement = state.placement || null;
        if (placement && placement.active === true) {
            if (placement.mode === 'move' && Number.isInteger(placement.targetIndex) && placement.canPlace === true) {
                applyMovePlacement(game, Number(placement.targetIndex));
                return;
            }
            if (placement.mode === 'build' && Number.isInteger(placement.targetIndex) && placement.canPlace === true) {
                applyPlacement(game, Number(placement.targetIndex));
                return;
            }
            setBuildHint(String(placement.reason || '배치할 타일을 선택하세요.'));
            return;
        }

        const selectionInfo = (typeof deps.getSelectedTileInfo === 'function')
            ? deps.getSelectedTileInfo(game)
            : null;
        if (!selectionInfo) {
            showToast('선택된 건물이 없습니다.');
            return;
        }

        if (isDrillgroundTile(selectionInfo.tile, deps)) {
            const currentUnitKey = (typeof deps.getDrillgroundUnitAt === 'function')
                ? deps.getDrillgroundUnitAt(state, selectionInfo.index)
                : null;
            if (currentUnitKey) {
                if (typeof deps.releaseDrillgroundUnit === 'function') {
                    const releasedUnitKey = deps.releaseDrillgroundUnit(game, selectionInfo.index);
                    if (releasedUnitKey) {
                        if (typeof deps.persist === 'function') {
                            deps.persist(game);
                        }
                        renderGrid(game);
                        renderContextBar(game);
                        if (typeof deps.refreshCityUnitPanels === 'function') {
                            deps.refreshCityUnitPanels(game);
                        }
                        showToast('연병장 배치를 해제했습니다.');
                        return;
                    }
                }
                showToast('해제할 배치 유닛이 없습니다.');
                return;
            }
            if (typeof deps.openDrillgroundUnitPicker === 'function') {
                deps.openDrillgroundUnitPicker(game, selectionInfo);
            }
            return;
        }

        if (selectionInfo.tile === 'tax_office') {
            openTaxOfficeActions(game);
            return;
        }

        const catalog = (typeof deps.getProductionCatalog === 'function')
            ? deps.getProductionCatalog(selectionInfo.tile)
            : null;
        if (catalog) {
            const queue = (typeof deps.getProductionQueueAt === 'function')
                ? deps.getProductionQueueAt(state, selectionInfo.index)
                : null;
            const ready = !!queue && Math.max(0, Number(queue.until) - Date.now()) <= 0;
            if (ready && typeof deps.claimBuildingProducedUnit === 'function') {
                deps.claimBuildingProducedUnit(game, selectionInfo.index);
                return;
            }
            if (typeof deps.openCitySupplyPanel === 'function') {
                deps.openCitySupplyPanel(game, selectionInfo);
                return;
            }
        }

        const CitySimEconomy = global.CitySimEconomy;
        if (CitySimEconomy && typeof CitySimEconomy.getIncomeStatus === 'function') {
            const incomeStatus = CitySimEconomy.getIncomeStatus(game, selectionInfo.index, selectionInfo.tile);
            if (incomeStatus) {
                if (incomeStatus.claimable && typeof CitySimEconomy.claimIncome === 'function') {
                    CitySimEconomy.claimIncome(game, selectionInfo.index);
                } else {
                    const remainSec = Math.max(1, Math.ceil(Math.max(0, Number(incomeStatus.remainMs) || 0) / 1000));
                    showToast(`다음 세금까지 ${remainSec}초`);
                }
                renderContextBar(game);
                return;
            }
        }

        showToast('해당 건물은 사용할 기능이 없습니다.');
    }

    function sellSelected(game) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        const CitySimEconomy = global.CitySimEconomy;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const state = CitySimState.ensure(game);
        const placement = state.placement || null;
        if (placement && placement.active === true) {
            const cancelHint = placement.mode === 'move'
                ? '이동이 취소되었습니다.'
                : '건설이 취소되었습니다.';
            CitySimState.clearPlacement(game);
            CitySimState.clearSelection(game);
            setBuildHint(cancelHint);
            renderGrid(game);
            renderContextBar(game);
            return;
        }

        const selectionInfo = (typeof deps.getSelectedTileInfo === 'function')
            ? deps.getSelectedTileInfo(game)
            : null;
        if (!selectionInfo) {
            showToast('판매할 건물을 먼저 선택하세요.');
            return;
        }

        if (selectionInfo.tile === 'hq') {
            showToast('사령부는 판매할 수 없습니다.');
            return;
        }

        const index = selectionInfo.index;
        const tile = selectionInfo.tile;
        const name = selectionInfo.def?.name || tile;
        let demolitionTargets = [];
        let shouldRefreshUnits = false;

        if (isDrillgroundTile(tile, deps)) {
            if (typeof deps.releaseDrillgroundUnit === 'function') {
                deps.releaseDrillgroundUnit(game, index);
                shouldRefreshUnits = true;
            }
            CitySimState.setGridTile(game, index, null);
            demolitionTargets = [index];
        } else if (
            (typeof deps.isFootprintTool === 'function' && deps.isFootprintTool(tile))
            || (typeof deps.isFootprintTile === 'function' && deps.isFootprintTile(tile))
        ) {
            if (typeof deps.clearFootprintAtIndex === 'function') {
                demolitionTargets = deps.clearFootprintAtIndex(game, state, index, tile) || [];
            }
        } else {
            CitySimState.setGridTile(game, index, null);
            demolitionTargets = tile ? [index] : [];
        }

        CitySimState.clearSelection(game);

        if (Array.isArray(demolitionTargets)
            && demolitionTargets.length > 0
            && typeof deps.playDemolitionSmokeEffect === 'function') {
            deps.playDemolitionSmokeEffect(game, demolitionTargets);
        }

        if (shouldRefreshUnits && typeof deps.refreshCityUnitPanels === 'function') {
            deps.refreshCityUnitPanels(game);
        }

        const formatNumber = (typeof deps.formatNumber === 'function')
            ? deps.formatNumber
            : (value) => String(Math.max(0, Math.floor(Number(value) || 0)));
        const refundMoney = (typeof deps.getBuildToolCostMoney === 'function')
            ? Math.max(0, Math.floor(Number(deps.getBuildToolCostMoney(tile)) || 0))
            : Math.max(0, Math.floor(Number(selectionInfo.def?.costMoney) || 0));
        if (refundMoney > 0) {
            CitySimState.mutate(game, (draft) => {
                if (!draft.res || typeof draft.res !== 'object') draft.res = {};
                draft.res.money = Math.max(0, Number(draft.res.money) || 0) + refundMoney;
            });
        }
        if (game && typeof game.renderCityResources === 'function') {
            game.renderCityResources();
        } else if (CitySimEconomy && typeof CitySimEconomy.renderResources === 'function') {
            CitySimEconomy.renderResources(game);
        }

        if (refundMoney > 0) {
            setBuildHint(`${name} 철거 완료 (+${formatNumber(refundMoney)} 환급)`);
            showToast(`건물 판매 완료 (+${formatNumber(refundMoney)})`);
        } else {
            setBuildHint(`${name} 철거 완료`);
            showToast('건물 판매 완료');
        }
        renderGrid(game);
        renderContextBar(game);
        if (typeof deps.persist === 'function') {
            deps.persist(game);
        }
    }

    function moveSelected(game) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const state = CitySimState.ensure(game);
        const placement = state.placement || null;
        if (placement && placement.active === true) {
            if (placement.mode === 'build') {
                setBuildHint('지도를 이동하거나 타일을 바꿔 배치 위치를 조정하세요.');
                return;
            }
            if (placement.mode === 'move') {
                setBuildHint(getMoveStartHint());
                return;
            }
        }

        const selectionInfo = (typeof deps.getSelectedTileInfo === 'function')
            ? deps.getSelectedTileInfo(game)
            : null;
        if (!selectionInfo) {
            showToast('이동할 건물을 먼저 선택하세요.');
            return;
        }
        const hint = getMoveStartHint();
        CitySimState.setPlacement(game, {
            active: true,
            mode: 'move',
            tool: selectionInfo.tile,
            targetIndex: selectionInfo.index,
            canPlace: false,
            reason: hint,
            sourceIndex: selectionInfo.index
        });
        setBuildHint(hint);
        renderGrid(game);
        renderContextBar(game);
    }

    function confirmSelection(game) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.clearPlacement !== 'function') return;

        CitySimState.clearPlacement(game);
        CitySimState.clearSelection(game);
        setBuildHint(deps.MSG_SELECT_CARD || '카드를 선택하세요.');
        renderGrid(game);
        renderContextBar(game);
    }

    const placementApi = {
        openBuildPanel,
        openInventory,
        setBuildTool,
        updatePlacementPreview,
        clearPlacementPreview,
        applyPlacement,
        applyMovePlacement,
        handleCellAction,
        triggerPrimaryAction,
        sellSelected,
        moveSelected,
        confirmSelection
    };

    global.CitySimConstructionPlacement = placementApi;

    const api = global.CitySimConstruction;
    if (api && typeof api === 'object') {
        Object.assign(api, placementApi);
    }
})(window);
