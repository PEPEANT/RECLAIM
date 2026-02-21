(function (global) {
    const OVERLAY_ID = 'city-tutorial-intro-overlay';
    const VIDEO_SRC = 'assets/tutorial/videos/chroma_tutorial_01.webm';
    const VIDEO_FALLBACK_SRC = 'assets/tutorial/videos/tutorial_01.mp4';
    const GUIDED_VIDEO_SRC = 'assets/tutorial/videos/chroma_tutorial_03.webm';
    const GUIDED_VIDEO_FALLBACK_SRC = 'assets/tutorial/videos/tutorial_03.mp4';
    const BARRACKS_VIDEO_SRC = 'assets/tutorial/videos/chroma_tutorial_04.webm';
    const BARRACKS_VIDEO_FALLBACK_SRC = 'assets/tutorial/videos/tutorial_04.mp4';
    const QUEST_VIDEO_SRC = 'assets/tutorial/videos/chroma_tutorial_05.webm';
    const QUEST_VIDEO_FALLBACK_SRC = 'assets/tutorial/videos/chroma_tutorial_05.webm';
    const SUPPLY_VIDEO_SRC = 'assets/tutorial/videos/chroma_tutorial_06.webm';
    const SUPPLY_VIDEO_FALLBACK_SRC = 'assets/tutorial/videos/chroma_tutorial_06.webm';
    const HONOR_VIDEO_SRC = 'assets/tutorial/videos/chroma_tutorial_07.webm';
    const HONOR_VIDEO_FALLBACK_SRC = 'assets/tutorial/videos/chroma_tutorial_07.webm';
    const BATTLE_VIDEO_SRC = 'assets/tutorial/videos/chroma_tutorial_08.webm';
    const BATTLE_VIDEO_FALLBACK_SRC = 'assets/tutorial/videos/chroma_tutorial_08.webm';
    const OUTRO_VIDEO_SRC = 'assets/tutorial/videos/chroma_tutorial_09.webm';
    const OUTRO_VIDEO_FALLBACK_SRC = 'assets/tutorial/videos/chroma_tutorial_09.webm';
    const SKIP_VIDEO_SRC = 'assets/tutorial/videos/chroma_tutorial_02.webm';
    const SKIP_VIDEO_FALLBACK_SRC = 'assets/tutorial/videos/tutorial_02.mp4';
    const TUTORIAL_QUEST_ID = 'tutorial_intro_honor_medal';
    const TUTORIAL_FINAL_QUEST_ID = 'tutorial_intro_complete_gold';
    const ENTER_DELAY_MS = 140;
    const TUTORIAL_BGM_DUCK_VOLUME = 0.14;
    const TUTORIAL_FLOW_POLL_MS = 120;
    const TUTORIAL_HIGHLIGHT_CLASS = 'city-tutorial-target-highlight';
    const GUIDED_BUILD_STEPS = Object.freeze({
        OPEN_BUILD: 'open_build',
        OPEN_ECONOMY: 'open_economy',
        SELECT_HOUSE: 'select_house',
        PLACE_HOUSE: 'place_house',
        PLAY_BARRACKS_VIDEO: 'play_barracks_video',
        OPEN_DEFENSE: 'open_defense',
        SELECT_BARRACKS: 'select_barracks',
        PLACE_BARRACKS: 'place_barracks',
        OPEN_PRODUCTION: 'open_production',
        QUEUE_DRONE: 'queue_drone',
        PLAY_QUEST_VIDEO: 'play_quest_video',
        OPEN_QUEST: 'open_quest',
        CLAIM_QUEST_REWARD: 'claim_quest_reward',
        PLAY_SUPPLY_VIDEO: 'play_supply_video',
        OPEN_SHOP: 'open_shop',
        BUY_SPECIAL_BOX: 'buy_special_box',
        OPEN_INVENTORY: 'open_inventory',
        OPEN_SUPPLY_TAB: 'open_supply_tab',
        OPEN_SPECIAL_BOX: 'open_special_box',
        VERIFY_AT_DRONE: 'verify_at_drone',
        PLAY_HONOR_VIDEO: 'play_honor_video',
        AUTO_CLAIM_DRONE: 'auto_claim_drone',
        OPEN_HONOR_MEDAL: 'open_honor_medal',
        SELECT_HONOR_TARGET: 'select_honor_target',
        APPLY_HONOR_MEDAL: 'apply_honor_medal',
        EQUIP_AT_DRONE: 'equip_at_drone',
        NAME_VETERAN: 'name_veteran',
        CLOSE_VETERAN_PROFILE: 'close_veteran_profile',
        PLAY_BATTLE_VIDEO: 'play_battle_video',
        WAIT_BATTLE_BUTTON: 'wait_battle_button',
        DEPLOY_INFANTRY: 'deploy_infantry',
        DEPLOY_VETERAN: 'deploy_veteran',
        START_BATTLE: 'start_battle',
        WAIT_BATTLE_END: 'wait_battle_end',
        PLAY_OUTRO_VIDEO: 'play_outro_video',
        OPEN_FINAL_QUEST: 'open_final_quest',
        CLAIM_FINAL_QUEST: 'claim_final_quest',
        DONE: 'done'
    });

    let enterTimer = null;
    let activeVideo = null;
    let narrationAudio = null;
    let audioResumeHandler = null;
    let bgmVolumeBeforeTutorial = null;
    let playbackTargets = [];
    let guidedFlow = null;

    function clearEnterTimer() {
        if (!enterTimer) return;
        clearTimeout(enterTimer);
        enterTimer = null;
    }

    function unbindAudioResumeGesture() {
        if (!audioResumeHandler) return;
        try { document.removeEventListener('pointerdown', audioResumeHandler, true); } catch (_) { }
        try { document.removeEventListener('keydown', audioResumeHandler, true); } catch (_) { }
        audioResumeHandler = null;
    }

    function clearPlaybackTargets() {
        playbackTargets = [];
    }

    function setPlaybackTargets(targets) {
        playbackTargets = Array.isArray(targets)
            ? targets.filter((item) => !!item)
            : [];
    }

    function getCityState(game) {
        if (typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.ensure !== 'function') {
            return null;
        }
        return CitySimState.ensure(game);
    }

    function getTutorialProgressApi() {
        const api = global.CitySimTutorialProgress;
        if (!api || typeof api !== 'object') return null;
        return api;
    }

    function countGridTile(game, tileKey) {
        const state = getCityState(game);
        if (!state || !Array.isArray(state.grid)) return 0;
        const target = String(tileKey || '').trim();
        if (!target) return 0;
        return state.grid.reduce((acc, tile) => acc + (String(tile || '') === target ? 1 : 0), 0);
    }

    function patchTutorialStep(game, step) {
        if (!game) return;
        const nextStep = Math.max(0, Math.floor(Number(step) || 0));
        const progressApi = getTutorialProgressApi();
        if (progressApi && typeof progressApi.setStep === 'function') {
            const applied = progressApi.setStep(game, nextStep);
            if (applied === true) return;
        }

        if (typeof CitySimState !== 'undefined'
            && CitySimState
            && typeof CitySimState.patchTutorial === 'function') {
            CitySimState.patchTutorial(game, {
                step: nextStep,
                updatedAt: Date.now()
            });
            persistTutorial(game);
            return;
        }

        if (typeof CitySimState !== 'undefined'
            && CitySimState
            && typeof CitySimState.mutate === 'function') {
            CitySimState.mutate(game, (state) => {
                if (!state.tutorial || typeof state.tutorial !== 'object') {
                    state.tutorial = {};
                }
                state.tutorial.step = nextStep;
                state.tutorial.updatedAt = Date.now();
            });
            persistTutorial(game);
        }
    }

    function guidedStepToNumber(step) {
        if (step === GUIDED_BUILD_STEPS.OPEN_BUILD) return 2;
        if (step === GUIDED_BUILD_STEPS.OPEN_ECONOMY) return 3;
        if (step === GUIDED_BUILD_STEPS.SELECT_HOUSE) return 4;
        if (step === GUIDED_BUILD_STEPS.PLACE_HOUSE) return 5;
        if (step === GUIDED_BUILD_STEPS.PLAY_BARRACKS_VIDEO) return 6;
        if (step === GUIDED_BUILD_STEPS.OPEN_DEFENSE) return 7;
        if (step === GUIDED_BUILD_STEPS.SELECT_BARRACKS) return 8;
        if (step === GUIDED_BUILD_STEPS.PLACE_BARRACKS) return 9;
        if (step === GUIDED_BUILD_STEPS.OPEN_PRODUCTION) return 10;
        if (step === GUIDED_BUILD_STEPS.QUEUE_DRONE) return 10;
        if (step === GUIDED_BUILD_STEPS.PLAY_QUEST_VIDEO) return 10;
        if (step === GUIDED_BUILD_STEPS.OPEN_QUEST) return 10;
        if (step === GUIDED_BUILD_STEPS.CLAIM_QUEST_REWARD) return 10;
        if (step === GUIDED_BUILD_STEPS.PLAY_SUPPLY_VIDEO) return 10;
        if (step === GUIDED_BUILD_STEPS.OPEN_SHOP) return 10;
        if (step === GUIDED_BUILD_STEPS.BUY_SPECIAL_BOX) return 10;
        if (step === GUIDED_BUILD_STEPS.OPEN_INVENTORY) return 10;
        if (step === GUIDED_BUILD_STEPS.OPEN_SUPPLY_TAB) return 10;
        if (step === GUIDED_BUILD_STEPS.OPEN_SPECIAL_BOX) return 10;
        if (step === GUIDED_BUILD_STEPS.VERIFY_AT_DRONE) return 10;
        if (step === GUIDED_BUILD_STEPS.PLAY_HONOR_VIDEO) return 10;
        if (step === GUIDED_BUILD_STEPS.AUTO_CLAIM_DRONE) return 10;
        if (step === GUIDED_BUILD_STEPS.OPEN_HONOR_MEDAL) return 10;
        if (step === GUIDED_BUILD_STEPS.SELECT_HONOR_TARGET) return 10;
        if (step === GUIDED_BUILD_STEPS.APPLY_HONOR_MEDAL) return 10;
        if (step === GUIDED_BUILD_STEPS.EQUIP_AT_DRONE) return 10;
        if (step === GUIDED_BUILD_STEPS.NAME_VETERAN) return 10;
        if (step === GUIDED_BUILD_STEPS.CLOSE_VETERAN_PROFILE) return 11;
        if (step === GUIDED_BUILD_STEPS.PLAY_BATTLE_VIDEO) return 12;
        if (step === GUIDED_BUILD_STEPS.WAIT_BATTLE_BUTTON) return 13;
        if (step === GUIDED_BUILD_STEPS.DEPLOY_INFANTRY) return 14;
        if (step === GUIDED_BUILD_STEPS.DEPLOY_VETERAN) return 15;
        if (step === GUIDED_BUILD_STEPS.START_BATTLE) return 16;
        if (step === GUIDED_BUILD_STEPS.WAIT_BATTLE_END) return 17;
        if (step === GUIDED_BUILD_STEPS.PLAY_OUTRO_VIDEO) return 18;
        if (step === GUIDED_BUILD_STEPS.OPEN_FINAL_QUEST) return 19;
        if (step === GUIDED_BUILD_STEPS.CLAIM_FINAL_QUEST) return 20;
        if (step === GUIDED_BUILD_STEPS.DONE) return 21;
        return 1;
    }

    function clearGuidedHighlights(flow) {
        if (!flow || !Array.isArray(flow.highlighted)) return;
        flow.highlighted.forEach((el) => {
            if (!el || !el.classList) return;
            el.classList.remove(TUTORIAL_HIGHLIGHT_CLASS);
        });
        flow.highlighted = [];
    }

    function setGuidedHighlights(flow, targets) {
        if (!flow) return;
        clearGuidedHighlights(flow);
        const list = Array.isArray(targets) ? targets : [targets];
        flow.highlighted = list.filter((el) => !!(el && el.classList));
        flow.highlighted.forEach((el) => {
            el.classList.add(TUTORIAL_HIGHLIGHT_CLASS);
        });
    }

    function findBuildButton() {
        return document.getElementById('city-fab-build');
    }

    function findBattleButton() {
        return document.getElementById('city-fab-battle');
    }

    function findEconomyTabButton() {
        return document.querySelector('#city-build-tabs [data-city-build-tab="base"], #city-build-tabs .city-build-tab-base');
    }

    function findDefenseTabButton() {
        return document.querySelector('#city-build-tabs [data-city-build-tab="industry"], #city-build-tabs .city-build-tab-industry');
    }

    function isHouseCardElement(element) {
        const card = (element && typeof element.closest === 'function')
            ? element.closest('.city-build-card')
            : null;
        if (!card) return false;
        const byData = String(card.dataset?.cityBuildTool || '').trim();
        if (byData) return byData === 'house';
        const iconClass = String(card.querySelector('.city-build-card-icon')?.className || '');
        if (iconClass.includes('icon-house')) return true;
        const name = String(card.querySelector('.city-build-card-name')?.textContent || '').trim().toLowerCase();
        return name === 'house' || name === '회사';
    }

    function findHouseCardButton() {
        const byData = document.querySelector('#city-build-cards [data-city-build-tool="house"]');
        if (byData) return byData;
        const cards = Array.from(document.querySelectorAll('#city-build-cards .city-build-card'));
        return cards.find((card) => isHouseCardElement(card)) || null;
    }

    function isBarracksCardElement(element) {
        const card = (element && typeof element.closest === 'function')
            ? element.closest('.city-build-card')
            : null;
        if (!card) return false;
        const byData = String(card.dataset?.cityBuildTool || '').trim();
        if (byData) return byData === 'barracks';
        const iconClass = String(card.querySelector('.city-build-card-icon')?.className || '');
        if (iconClass.includes('icon-barracks')) return true;
        const name = String(card.querySelector('.city-build-card-name')?.textContent || '').trim();
        return name === '병영';
    }

    function findBarracksCardButton() {
        const byData = document.querySelector('#city-build-cards [data-city-build-tool="barracks"]');
        if (byData) return byData;
        const cards = Array.from(document.querySelectorAll('#city-build-cards .city-build-card'));
        return cards.find((card) => isBarracksCardElement(card)) || null;
    }

    function findGridTileIndex(game, tileKey) {
        const state = getCityState(game);
        if (!state || !Array.isArray(state.grid)) return -1;
        const target = String(tileKey || '').trim();
        if (!target) return -1;
        return state.grid.findIndex((tile) => String(tile || '') === target);
    }

    function isBarracksSelected(game) {
        const state = getCityState(game);
        if (!state) return false;
        const selectedIndex = Number(state.selection?.index);
        const selectedTile = String(state.selection?.tile || '').trim();
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0) return false;
        const tileAtIndex = String(state.grid?.[selectedIndex] || '').trim();
        return selectedTile === 'barracks' && tileAtIndex === 'barracks';
    }

    function findProductionButton() {
        const bar = document.getElementById('city-context-bar');
        if (!bar || !bar.classList.contains('active')) return null;
        return bar.querySelector('.city-context-actions button:first-child');
    }

    function isProductionModalOpen() {
        const modal = document.getElementById('city-action-modal');
        return !!(modal && modal.classList.contains('active'));
    }

    function findDroneProductionButton() {
        return document.querySelector('#city-action-msg [data-city-supply-unit="drone_operator"]');
    }

    function findShopButton() {
        return document.getElementById('city-fab-store');
    }

    function isShopPanelOpen() {
        const panel = document.getElementById('city-shop-panel');
        if (panel && panel.classList.contains('open')) return true;
        const screen = document.getElementById('city-screen');
        return !!(screen && screen.classList.contains('city-shop-open'));
    }

    function findShopSpecialBoxCard() {
        const byData = document.querySelector('#city-shop-cards [data-city-shop-item-id="box_level2"]');
        if (byData) return byData;
        const cards = Array.from(document.querySelectorAll('#city-shop-cards .city-shop-card'));
        return cards.find((card) => String(card.textContent || '').includes('특수 보급박스')) || null;
    }

    function findInventoryButton() {
        return document.getElementById('city-fab-inventory');
    }

    function isInventoryPanelOpen(game) {
        return getCityState(game)?.inventoryPanelOpen === true;
    }

    function isSupplyTabSelected(game) {
        return String(getCityState(game)?.inventoryTab || '').trim() === 'supply';
    }

    function findInventorySupplyTabButton() {
        const byData = document.querySelector('#city-inventory-tabs [data-city-inventory-tab="supply"]');
        if (byData) return byData;
        const tabs = Array.from(document.querySelectorAll('#city-inventory-tabs .btn-category'));
        return tabs.find((tab) => String(tab.textContent || '').includes('보급')) || null;
    }

    function findInventoryVeteranToggleButton() {
        return document.getElementById('city-inventory-veteran-toggle');
    }

    function findInventoryVeteranChip() {
        return document.querySelector('#city-inventory-veteran-list .city-inventory-veteran-chip');
    }

    function findInventorySpecialBoxCard() {
        const byData = document.querySelector('#city-inventory-cards [data-city-inventory-box-id="box_level2"]');
        if (byData) return byData;
        const cards = Array.from(document.querySelectorAll('#city-inventory-cards .city-inventory-unit-btn'));
        return cards.find((card) => String(card.title || '').includes('특수 보급박스')) || null;
    }

    function findInventoryAtDroneCard() {
        const byData = document.querySelector('#city-inventory-cards [data-city-inventory-item-key="drone_at_item"]');
        if (byData) return byData;
        const cards = Array.from(document.querySelectorAll('#city-inventory-cards .city-inventory-unit-btn'));
        return cards.find((card) => {
            const text = String(card.title || card.textContent || '');
            return text.includes('AT드론') || text.includes('AT대전차드론');
        }) || null;
    }

    function findInventoryHonorMedalCard() {
        const byData = document.querySelector('#city-inventory-cards [data-city-inventory-entry-kind="honor_medal"]');
        if (byData) return byData;
        const cards = Array.from(document.querySelectorAll('#city-inventory-cards .city-inventory-unit-btn'));
        return cards.find((card) => {
            const text = String(card.title || card.textContent || '');
            return text.includes('명예훈장');
        }) || null;
    }

    function isHonorMedalPickerOpen() {
        const modal = document.getElementById('city-action-modal');
        if (!modal || !modal.classList.contains('active')) return false;
        return modal.classList.contains('city-action-modal-honor-picker')
            || !!document.querySelector('#city-action-msg [data-city-honor-apply]');
    }

    function findHonorDroneTargetCard() {
        const byData = document.querySelector('#city-action-msg [data-city-honor-target="unit:drone_operator"]');
        if (byData) return byData;
        const cards = Array.from(document.querySelectorAll('#city-action-msg [data-city-honor-target]'));
        return cards.find((card) => {
            const text = String(card.title || card.textContent || '');
            return text.includes('드론병');
        }) || null;
    }

    function findHonorSelectedTargetCard() {
        return document.querySelector('#city-action-msg [data-city-honor-target].is-current');
    }

    function findHonorApplyButton() {
        return document.querySelector('#city-action-msg [data-city-honor-apply]');
    }

    function isVeteranProfileOpen() {
        const modal = document.getElementById('city-action-modal');
        if (!modal || !modal.classList.contains('active')) return false;
        return modal.classList.contains('city-action-modal-unit-profile')
            || !!document.querySelector('#city-action-msg [data-city-veteran-item-equip]');
    }

    function findVeteranProfileAtDroneEquipButton() {
        return document.querySelector('#city-action-msg [data-city-veteran-item-equip="drone_at_item"]');
    }

    function findVeteranInlineSaveButton() {
        return document.querySelector('#city-action-msg [data-city-veteran-inline-save]');
    }

    function findVeteranInlineNameInput() {
        return document.getElementById('city-veteran-inline-name-input');
    }

    function findCityActionCloseButton() {
        return document.getElementById('city-action-close-btn');
    }

    function setCityActionCloseButtonLocked(locked) {
        const closeBtn = findCityActionCloseButton();
        if (!closeBtn) return;
        const nextLocked = locked === true;
        closeBtn.disabled = nextLocked;
        closeBtn.classList.toggle('is-disabled', nextLocked);
        if (nextLocked) {
            closeBtn.setAttribute('aria-disabled', 'true');
        } else {
            closeBtn.removeAttribute('aria-disabled');
        }
    }

    function isShopOpenEffectVisible() {
        const overlay = document.getElementById('shop-open-overlay');
        return !!overlay;
    }

    function getCityBoxCount(game, boxId) {
        const key = String(boxId || '').trim();
        if (!key) return 0;
        const state = getCityState(game);
        return Math.max(0, Math.floor(Number(state?.boxes?.[key]) || 0));
    }

    function getCityItemCount(game, itemKey) {
        const key = String(itemKey || '').trim();
        if (!key) return 0;
        const state = getCityState(game);
        return Math.max(0, Math.floor(Number(state?.items?.[key]) || 0));
    }

    function getCityUnitCount(game, unitKey) {
        const key = String(unitKey || '').trim();
        if (!key) return 0;
        const state = getCityState(game);
        return Math.max(0, Math.floor(Number(state?.units?.[key]) || 0));
    }

    function getCityVeterans(game) {
        const state = getCityState(game);
        if (!state || !Array.isArray(state.veterans)) return [];
        return state.veterans
            .map((entry) => {
                const id = String(entry?.id || '').trim();
                const unitKey = String(entry?.unitKey || '').trim();
                if (!id || !unitKey) return null;
                return {
                    id,
                    unitKey,
                    name: String(entry?.name || '').trim(),
                    createdAt: Math.max(0, Math.floor(Number(entry?.createdAt) || 0))
                };
            })
            .filter((entry) => !!entry);
    }

    function getLatestVeteranEntry(game, unitKey) {
        const targetUnitKey = String(unitKey || '').trim();
        const veterans = getCityVeterans(game)
            .filter((entry) => !targetUnitKey || entry.unitKey === targetUnitKey)
            .sort((a, b) => {
                if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
                return b.id.localeCompare(a.id);
            });
        return veterans[0] || null;
    }

    function getVeteranNameById(game, veteranId) {
        const targetId = String(veteranId || '').trim();
        if (!targetId) return '';
        const veterans = getCityVeterans(game);
        const found = veterans.find((entry) => entry.id === targetId);
        return String(found?.name || '').trim();
    }

    function syncPromotedDroneVeteran(flow) {
        if (!flow || !flow.game) return null;
        const veterans = getCityVeterans(flow.game);
        if (veterans.length <= 0) return null;

        const baselineCount = Math.max(0, Math.floor(Number(flow.veteranCountBeforeHonor) || 0));
        const latestDroneVeteran = getLatestVeteranEntry(flow.game, 'drone_operator');
        const promotedByCount = !!latestDroneVeteran && veterans.length > baselineCount;

        if (!flow.promotedVeteranId && promotedByCount && latestDroneVeteran) {
            flow.promotedVeteranId = latestDroneVeteran.id;
            if (!flow.promotedVeteranBaselineName) {
                flow.promotedVeteranBaselineName = String(latestDroneVeteran.name || '').trim();
            }
        }

        if (flow.promotedVeteranId) {
            const promoted = veterans.find((entry) => entry.id === flow.promotedVeteranId) || null;
            if (promoted) {
                if (!flow.promotedVeteranBaselineName) {
                    flow.promotedVeteranBaselineName = String(promoted.name || '').trim();
                }
                return promoted;
            }
            flow.promotedVeteranId = '';
        }

        if (promotedByCount && latestDroneVeteran) {
            return latestDroneVeteran;
        }
        return null;
    }

    function hasPromotedDroneVeteran(flow) {
        return !!syncPromotedDroneVeteran(flow);
    }

    function normalizeQueuedProduction(rawEntry) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return null;
        const unitKey = String(rawEntry.unitKey || rawEntry.key || '').trim();
        const until = Math.max(0, Math.floor(Number(rawEntry.until ?? rawEntry.untilMs ?? rawEntry.cooldownUntil) || 0));
        if (!unitKey || until <= 0) return null;
        return { unitKey, until };
    }

    function hasQueuedDroneAtIndex(game, index) {
        const state = getCityState(game);
        if (!state || !Number.isInteger(index) || index < 0) return false;
        const queued = normalizeQueuedProduction(state.productionCooldowns?.[index]);
        return !!queued && queued.unitKey === 'drone_operator';
    }

    function hasQueuedDroneAtAnyBarracks(game) {
        const state = getCityState(game);
        if (!state || !Array.isArray(state.grid)) return false;
        for (let i = 0; i < state.grid.length; i += 1) {
            if (String(state.grid[i] || '').trim() !== 'barracks') continue;
            if (hasQueuedDroneAtIndex(game, i)) return true;
        }
        return false;
    }

    function hasPendingQueuedDroneProduction(game) {
        const state = getCityState(game);
        if (!state || !Array.isArray(state.grid)) return false;
        const now = Date.now();
        for (let i = 0; i < state.grid.length; i += 1) {
            const queued = normalizeQueuedProduction(state.productionCooldowns?.[i]);
            if (!queued || queued.unitKey !== 'drone_operator') continue;
            if ((queued.until - now) > 0) return true;
        }
        return false;
    }

    function autoClaimReadyDroneProduction(game) {
        const state = getCityState(game);
        if (!state || !Array.isArray(state.grid)) return { claimed: 0, pending: false };

        const claimFn = global?.CitySimConstructionInternals?.claimBuildingProducedUnit;
        if (typeof claimFn !== 'function') return { claimed: 0, pending: false };

        const now = Date.now();
        let claimed = 0;
        let pending = false;

        for (let i = 0; i < state.grid.length; i += 1) {
            const queued = normalizeQueuedProduction(state.productionCooldowns?.[i]);
            if (!queued || queued.unitKey !== 'drone_operator') continue;
            if ((queued.until - now) > 0) {
                pending = true;
                continue;
            }
            const ok = claimFn(game, i);
            if (ok === true) claimed += 1;
        }

        return { claimed, pending };
    }

    function findMissionToggleButton() {
        return document.querySelector('.city-mission-toggle');
    }

    function findMissionCard() {
        return document.getElementById('city-mission-card');
    }

    function findQuestRowById(questId) {
        const id = String(questId || '').trim();
        if (!id) return null;
        const byData = document.querySelector(`#city-mission-card [data-city-mission-id="${id}"]`);
        if (byData) return byData;
        return null;
    }

    function findQuestClaimButtonById(questId) {
        const id = String(questId || '').trim();
        if (!id) return null;
        const byData = document.querySelector(`#city-mission-card [data-city-mission-claim="${id}"]`);
        if (byData) return byData;
        const row = findQuestRowById(id);
        if (!row) return null;
        return row.querySelector('.city-mission-claim-btn');
    }

    function findTutorialQuestRow() {
        return findQuestRowById(TUTORIAL_QUEST_ID);
    }

    function findTutorialQuestClaimButton() {
        return findQuestClaimButtonById(TUTORIAL_QUEST_ID);
    }

    function findFinalQuestRow() {
        return findQuestRowById(TUTORIAL_FINAL_QUEST_ID);
    }

    function findFinalQuestClaimButton() {
        return findQuestClaimButtonById(TUTORIAL_FINAL_QUEST_ID);
    }

    function isMissionPanelOpen(game) {
        return getCityState(game)?.missionOpen === true;
    }

    function getQuestMissionState(game) {
        if (!game || typeof game !== 'object') return null;
        if (game.cityQuestMission && typeof game.cityQuestMission === 'object') {
            return game.cityQuestMission;
        }
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.ensureState === 'function') {
            return CityQuestMission.ensureState(game);
        }
        return null;
    }

    function refreshQuestMissionPanel(game) {
        if (!game || typeof game !== 'object') return;
        if (typeof game.refreshCityQuestPanel === 'function') {
            game.refreshCityQuestPanel();
            return;
        }
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.renderPanel === 'function') {
            CityQuestMission.renderPanel(game);
        }
    }

    function persistGameState(game) {
        if (!game || typeof game.saveCitySimState !== 'function') return;
        try {
            const saveResult = game.saveCitySimState();
            if (saveResult && typeof saveResult.catch === 'function') {
                saveResult.catch((err) => {
                    console.warn('[CityTutorialIntro] saveCitySimState failed:', err);
                });
            }
        } catch (err) {
            console.warn('[CityTutorialIntro] saveCitySimState threw:', err);
        }
    }

    function getQuestById(game, questId) {
        const state = getQuestMissionState(game);
        if (!state || !state.quests || typeof state.quests !== 'object') return null;
        const id = String(questId || '').trim();
        if (!id) return null;
        const quest = state.quests[id];
        if (!quest || typeof quest !== 'object') return null;
        return quest;
    }

    function getTutorialQuest(game) {
        return getQuestById(game, TUTORIAL_QUEST_ID);
    }

    function getFinalTutorialQuest(game) {
        return getQuestById(game, TUTORIAL_FINAL_QUEST_ID);
    }

    function ensureTutorialQuestClaimable(game) {
        const state = getQuestMissionState(game);
        if (!state) return false;
        if (!state.quests || typeof state.quests !== 'object') {
            state.quests = {};
        }
        const existing = state.quests[TUTORIAL_QUEST_ID];
        const alreadyClaimed = String(existing?.status || '').trim() === 'claimed';
        if (alreadyClaimed) return true;

        if (existing
            && String(existing.status || '').trim() === 'claimable'
            && Math.max(1, Math.floor(Number(existing.target) || 1)) === 1
            && Math.max(0, Math.floor(Number(existing.progress) || 0)) >= 1
            && Math.max(0, Math.floor(Number(existing?.reward?.honor) || 0)) >= 1) {
            return true;
        }

        state.quests[TUTORIAL_QUEST_ID] = {
            id: TUTORIAL_QUEST_ID,
            type: 'tutorial_intro',
            missionName: '튜토리얼 진행 보상',
            actionName: '퀘스트 창에서 [지급받기]를 누르세요.',
            target: 1,
            progress: 1,
            status: 'claimable',
            reward: {
                money: 0,
                gold: 0,
                honor: 1,
                exp: 0,
                box: '',
                boxType: ''
            },
            tier: 1
        };
        refreshQuestMissionPanel(game);
        persistGameState(game);
        return true;
    }

    function isTutorialQuestClaimed(game) {
        const quest = getTutorialQuest(game);
        return String(quest?.status || '').trim() === 'claimed';
    }

    function ensureFinalTutorialQuestClaimable(game) {
        const state = getQuestMissionState(game);
        if (!state) return false;
        if (!state.quests || typeof state.quests !== 'object') {
            state.quests = {};
        }
        const existing = state.quests[TUTORIAL_FINAL_QUEST_ID];
        const alreadyClaimed = String(existing?.status || '').trim() === 'claimed';
        if (alreadyClaimed) return true;

        if (existing
            && String(existing.status || '').trim() === 'claimable'
            && Math.max(1, Math.floor(Number(existing.target) || 1)) === 1
            && Math.max(0, Math.floor(Number(existing.progress) || 0)) >= 1
            && Math.max(0, Math.floor(Number(existing?.reward?.gold) || 0)) >= 5) {
            return true;
        }

        state.quests[TUTORIAL_FINAL_QUEST_ID] = {
            id: TUTORIAL_FINAL_QUEST_ID,
            type: 'tutorial_intro',
            missionName: '튜토리얼 완료 보상',
            actionName: '퀘스트 창에서 [지급받기]를 누르세요.',
            target: 1,
            progress: 1,
            status: 'claimable',
            reward: {
                money: 0,
                gold: 5,
                honor: 0,
                exp: 0,
                box: '',
                boxType: ''
            },
            tier: 1
        };
        refreshQuestMissionPanel(game);
        persistGameState(game);
        return true;
    }

    function isFinalTutorialQuestClaimed(game) {
        const quest = getFinalTutorialQuest(game);
        return String(quest?.status || '').trim() === 'claimed';
    }

    function removeTutorialQuest(game) {
        const state = getQuestMissionState(game);
        if (!state || !state.quests || typeof state.quests !== 'object') return false;
        if (!Object.prototype.hasOwnProperty.call(state.quests, TUTORIAL_QUEST_ID)) return false;
        delete state.quests[TUTORIAL_QUEST_ID];

        if (state.meta && typeof state.meta === 'object' && Array.isArray(state.meta.permanentClaimed)) {
            state.meta.permanentClaimed = state.meta.permanentClaimed
                .map((value) => String(value || '').trim())
                .filter((value) => value && value !== TUTORIAL_QUEST_ID);
        }
        refreshQuestMissionPanel(game);
        persistGameState(game);
        return true;
    }

    function isBuildPanelOpen(game) {
        return getCityState(game)?.buildPanelOpen === true;
    }

    function isEconomyTabSelected(game) {
        return String(getCityState(game)?.buildTab || '').trim() === 'base';
    }

    function isDefenseTabSelected(game) {
        return String(getCityState(game)?.buildTab || '').trim() === 'industry';
    }

    function isHouseToolSelected(game) {
        const state = getCityState(game);
        if (!state) return false;
        const placementTool = String(state.placement?.tool || '').trim();
        if (state.placement?.active === true && state.placement?.mode === 'build' && placementTool === 'house') {
            return true;
        }
        return String(state.selectedTool || '').trim() === 'house';
    }

    function isBarracksToolSelected(game) {
        const state = getCityState(game);
        if (!state) return false;
        const placementTool = String(state.placement?.tool || '').trim();
        if (state.placement?.active === true && state.placement?.mode === 'build' && placementTool === 'barracks') {
            return true;
        }
        return String(state.selectedTool || '').trim() === 'barracks';
    }

    function getTutorialSkirmishState(game) {
        if (!game || typeof game !== 'object') return null;
        const state = game._cityTutorialSkirmish;
        if (!state || typeof state !== 'object') return null;
        return state;
    }

    function getSkirmishPhase() {
        if (typeof SkirmishMode === 'undefined' || !SkirmishMode) return '';
        return String(SkirmishMode.phase || '').trim();
    }

    function getAlivePlayerUnits(game) {
        if (!game || !Array.isArray(game.players)) return [];
        return game.players.filter((unit) => !!(unit && !unit.dead && unit.team === 'player'));
    }

    function getAlivePlayerOperators(game) {
        return getAlivePlayerUnits(game).filter((unit) => unit?.stats?.operator === true);
    }

    function getAlivePlayerDrones(game) {
        return getAlivePlayerUnits(game).filter((unit) => {
            const unitId = String(unit?.stats?.id || '').trim();
            const category = String(unit?.stats?.category || '').trim();
            if (category === 'drone') return true;
            return unitId === 'drone_suicide' || unitId === 'drone_at' || unitId.includes('drone');
        });
    }

    function getPlayerOperatorDroneChargeSum(game) {
        return getAlivePlayerOperators(game).reduce((sum, operator) => {
            return sum + Math.max(0, Math.floor(Number(operator?.droneChargesLeft) || 0));
        }, 0);
    }

    function isTutorialBattleSelectionLockActive(flow) {
        if (!flow || flow.active !== true || !flow.game) return false;
        const tracker = getTutorialSkirmishState(flow.game);
        if (!tracker || tracker.active !== true) return false;
        if (flow.step !== GUIDED_BUILD_STEPS.START_BATTLE) return false;
        if (tracker.lockdownUsed === true) return false;
        return getSkirmishPhase() === 'battle';
    }

    function pruneSelectionToDroneOperator(game) {
        if (!game || !game.selectedUnits || typeof game.selectedUnits.forEach !== 'function') return;
        const allowed = [];
        game.selectedUnits.forEach((unit) => {
            const unitId = String(unit?.stats?.id || '').trim();
            if (unit && !unit.dead && unitId === 'drone_operator') {
                allowed.push(unit);
            } else if (unit && typeof unit === 'object') {
                unit.isSelected = false;
            }
        });
        if (typeof game.selectedUnits.clear === 'function') {
            game.selectedUnits.clear();
        } else {
            return;
        }
        allowed.forEach((unit) => {
            unit.isSelected = true;
            game.selectedUnits.add(unit);
        });
        if (typeof game.updateHUDSelection === 'function') {
            game.updateHUDSelection();
        }
    }

    function setTutorialSupportUnitsHold(game, hold) {
        if (!game) return;
        const nextMode = hold === true ? 'stop' : 'advance';
        getAlivePlayerUnits(game).forEach((unit) => {
            const unitId = String(unit?.stats?.id || '').trim();
            const category = String(unit?.stats?.category || '').trim();
            const isOperator = unit?.stats?.operator === true || unitId === 'drone_operator';
            const isDrone = category === 'drone' || unitId === 'drone_suicide' || unitId === 'drone_at' || unitId.includes('drone');
            if (isOperator || isDrone) return;
            unit.commandMode = nextMode;
        });
    }

    function cloneStagePreset(preset) {
        if (!preset || typeof preset !== 'object') return null;
        const unitId = String(preset.unitId || '').trim();
        const count = Math.max(0, Math.floor(Number(preset.count) || 0));
        if (!unitId || count <= 0) return null;
        const placement = String(preset.placement || '').trim();
        return placement ? { unitId, count, placement } : { unitId, count };
    }

    function getStageTemplateById(stageId) {
        const id = Math.floor(Number(stageId) || 0);
        if (id <= 0) return null;
        const stages = Array.isArray(global.CAMPAIGN_SKIRMISH_STAGES)
            ? global.CAMPAIGN_SKIRMISH_STAGES
            : [];
        return stages.find((entry) => Math.floor(Number(entry?.id) || 0) === id) || null;
    }

    function createTutorialSkirmishStageData() {
        const template = getStageTemplateById(101);
        const mapId = String(template?.mapId || '').trim() || 'skirmish_kabul';
        const enemyPreset = Array.isArray(template?.enemyPreset)
            ? template.enemyPreset.map((entry) => cloneStagePreset(entry)).filter((entry) => !!entry)
            : [];
        const templateCivilians = Math.max(0, Math.floor(Number(template?.civilians) || 0));
        return {
            id: 0,
            title: '도시 소탕 작전',
            type: 'tutorial',
            difficulty: 1,
            x: Number(template?.x) || 0,
            y: Number(template?.y) || 0,
            reward: 0,
            mapId,
            enemyPreset,
            playerPreset: [
                { unitId: 'infantry', count: 10 },
                { unitId: 'humvee', count: 3 },
                { unitId: 'apache', count: 1 }
            ],
            playerBudget: [],
            storageSlots: 0,
            tutorialVeteranOnlyUnitId: 'drone_operator',
            civilians: templateCivilians,
            narration: '튜토리얼 전투: 배치된 아군을 유지한 채 베테랑 드론병을 출격시키고 드론 락다운으로 전장을 정리하세요.'
        };
    }

    function restoreBattleHook(flow) {
        if (!flow || !flow.game) return;
        if (flow.battleEndWrapped !== true) return;
        if (flow.game.endGame === flow.battleEndWrapper && typeof flow.battleEndOriginal === 'function') {
            flow.game.endGame = flow.battleEndOriginal;
        }
        flow.battleEndWrapped = false;
        flow.battleEndOriginal = null;
        flow.battleEndWrapper = null;
    }

    function clearTutorialSkirmishRuntime(flow) {
        if (!flow || !flow.game) return;
        const state = getTutorialSkirmishState(flow.game);
        if (state && typeof state === 'object') {
            state.active = false;
        }
        try { delete flow.game._cityTutorialSkirmish; } catch (_) { }
    }

    function setGuidedStep(flow, step) {
        if (!flow || !step || flow.step === step) return;
        flow.step = step;
        patchTutorialStep(flow.game, guidedStepToNumber(step));
    }

    function restoreQuestHook(flow) {
        if (!flow || !flow.game || !flow.originalQuestHandler) return;
        if (flow.game.onQuestMissionEvent === flow.wrappedQuestHandler) {
            flow.game.onQuestMissionEvent = flow.originalQuestHandler;
        }
        flow.wrappedQuestHandler = null;
        flow.originalQuestHandler = null;
    }

    function stopGuidedFlow() {
        const flow = guidedFlow;
        guidedFlow = null;
        if (!flow) return;
        flow.active = false;
        if (flow.pollTimer) {
            clearInterval(flow.pollTimer);
            flow.pollTimer = null;
        }
        if (flow.pointerHandler) {
            try { document.removeEventListener('pointerdown', flow.pointerHandler, true); } catch (_) { }
            flow.pointerHandler = null;
        }
        setCityActionCloseButtonLocked(false);
        setChoicePanelGuidedMode(flow.overlay, false);
        clearGuidedHighlights(flow);
        restoreQuestHook(flow);
        restoreBattleHook(flow);
        setTutorialSupportUnitsHold(flow.game, false);
        clearTutorialSkirmishRuntime(flow);
    }

    function cleanupVideo() {
        unbindAudioResumeGesture();
        if (!activeVideo) return;
        activeVideo.onended = null;
        activeVideo.onerror = null;
        try { activeVideo.pause(); } catch (_) { }
        try { activeVideo.src = ''; } catch (_) { }
        activeVideo = null;
    }

    function cleanupNarrationAudio() {
        if (!narrationAudio) return;
        try { narrationAudio.pause(); } catch (_) { }
        try { narrationAudio.src = ''; } catch (_) { }
        narrationAudio = null;
    }

    function duckBgmVolume() {
        if (typeof AudioSystem === 'undefined' || !AudioSystem || typeof AudioSystem.setBGMVolume !== 'function') return;
        const current = Number(AudioSystem?.volume?.bgm);
        if (!Number.isFinite(current)) return;
        if (bgmVolumeBeforeTutorial == null) {
            bgmVolumeBeforeTutorial = current;
        }
        const next = Math.max(0, Math.min(1, Math.min(current, TUTORIAL_BGM_DUCK_VOLUME)));
        AudioSystem.setBGMVolume(next);
    }

    function restoreBgmVolume() {
        if (bgmVolumeBeforeTutorial == null) return;
        if (typeof AudioSystem !== 'undefined' && AudioSystem && typeof AudioSystem.setBGMVolume === 'function') {
            AudioSystem.setBGMVolume(Math.max(0, Math.min(1, Number(bgmVolumeBeforeTutorial) || 0.4)));
        }
        bgmVolumeBeforeTutorial = null;
    }

    function resetRuntime() {
        stopGuidedFlow();
        cleanupVideo();
        cleanupNarrationAudio();
        clearPlaybackTargets();
        restoreBgmVolume();
    }

    function isCityScreenVisible() {
        const cityScreen = document.getElementById('city-screen');
        return !!(cityScreen && !cityScreen.classList.contains('hidden'));
    }

    function getOverlay() {
        return document.getElementById(OVERLAY_ID);
    }

    function getTutorialLevel(game) {
        const state = (typeof CitySimState !== 'undefined' && CitySimState && typeof CitySimState.ensure === 'function')
            ? CitySimState.ensure(game)
            : null;
        return Math.max(0, Math.floor(Number(state?.hud?.level) || 0));
    }

    function isCityIntroSeen(game) {
        const progressApi = getTutorialProgressApi();
        if (progressApi && typeof progressApi.isCityIntroSeen === 'function') {
            const seen = progressApi.isCityIntroSeen(game);
            if (typeof seen === 'boolean') return seen;
        }

        if (typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.ensure !== 'function') {
            return false;
        }
        const state = CitySimState.ensure(game);
        return state?.tutorial?.cityIntroSeen === true;
    }

    function findTutorialBriefingButton() {
        return document.getElementById('city-briefing-btn');
    }

    function shouldShowTutorialBriefingButton(game) {
        if (!game) return false;
        return isCityIntroSeen(game) !== true;
    }

    function refreshTutorialBriefingButton(game) {
        const btn = findTutorialBriefingButton();
        if (!btn) return;
        const visible = shouldShowTutorialBriefingButton(game);
        btn.classList.toggle('hidden', !visible);
        btn.disabled = !visible;
        btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    function shouldShow(game, forceOpen) {
        if (!game) return false;
        if (isCityIntroSeen(game)) return false;
        if (forceOpen === true) return true;
        if (!isCityScreenVisible()) return false;
        if (getTutorialLevel(game) !== 1) return false;
        return true;
    }

    function persistTutorial(game) {
        const progressApi = getTutorialProgressApi();
        if (progressApi && typeof progressApi.save === 'function') {
            const saved = progressApi.save(game);
            if (saved === true) return;
        }

        if (!game || typeof game.saveCitySimState !== 'function') return;
        try {
            const saveResult = game.saveCitySimState();
            if (saveResult && typeof saveResult.catch === 'function') {
                saveResult.catch((err) => {
                    console.warn('[CityTutorialIntro] saveCitySimState failed:', err);
                });
            }
        } catch (err) {
            console.warn('[CityTutorialIntro] saveCitySimState threw:', err);
        }
    }

    function markCityIntroSeen(game, skipped) {
        if (!game) return;
        const nextSkipped = skipped === true;
        const progressApi = getTutorialProgressApi();
        if (progressApi && typeof progressApi.markCityIntroSeen === 'function') {
            const applied = progressApi.markCityIntroSeen(game, {
                skipped: nextSkipped,
                step: nextSkipped ? 0 : 1
            });
            if (applied === true) {
                refreshTutorialBriefingButton(game);
                return;
            }
        }

        if (typeof CitySimState !== 'undefined'
            && CitySimState
            && typeof CitySimState.markTutorialCityIntroSeen === 'function') {
            CitySimState.markTutorialCityIntroSeen(game, {
                skipped: nextSkipped,
                step: nextSkipped ? 0 : 1
            });
        } else if (typeof CitySimState !== 'undefined'
            && CitySimState
            && typeof CitySimState.mutate === 'function') {
            CitySimState.mutate(game, (state) => {
                if (!state.tutorial || typeof state.tutorial !== 'object') {
                    state.tutorial = {};
                }
                state.tutorial.cityIntroSeen = true;
                state.tutorial.cityIntroSkipped = nextSkipped;
                state.tutorial.cityIntroChoice = nextSkipped ? 'skip' : 'guided';
                state.tutorial.mode = nextSkipped ? 'skip' : 'guided';
                state.tutorial.step = nextSkipped ? 0 : 1;
                state.tutorial.updatedAt = Date.now();
            });
        }
        persistTutorial(game);
        refreshTutorialBriefingButton(game);
    }

    function closeOverlay() {
        const overlay = getOverlay();
        if (overlay) overlay.remove();
        resetRuntime();
    }

    function setFallbackText(overlay, text) {
        if (!overlay) return;
        const fallback = overlay.querySelector('.city-tutorial-intro-fallback');
        if (!fallback) return;
        const safe = String(text || '').trim();
        fallback.textContent = safe;
        fallback.classList.toggle('hidden', safe.length === 0);
    }

    function setActionsVisible(overlay, visible) {
        if (!overlay) return;
        const actions = overlay.querySelector('.city-tutorial-intro-actions');
        if (!actions) return;
        actions.classList.toggle('is-hidden', visible !== true);
    }

    function setChoicePanelGuidedMode(overlay, guided) {
        if (!overlay) return;
        const panel = overlay.querySelector('.city-tutorial-intro-choice-panel');
        if (!panel) return;
        panel.classList.toggle('is-guided', guided === true);
    }

    function bindAudioResumeGesture(overlay) {
        if (audioResumeHandler) return;

        audioResumeHandler = () => {
            if (!playbackTargets.length) {
                unbindAudioResumeGesture();
                return;
            }
            const targets = playbackTargets.slice();
            const tasks = targets.map((media) => {
                try {
                    media.volume = 1;
                    return Promise.resolve(media.play()).then(() => true).catch(() => false);
                } catch (_) {
                    return Promise.resolve(false);
                }
            });

            Promise.all(tasks).then((results) => {
                if (results.every(Boolean)) {
                    setFallbackText(overlay, '');
                    unbindAudioResumeGesture();
                    return;
                }
                setFallbackText(overlay, '음성 재생을 위해 화면을 한번 더 눌러주세요.');
            });
        };

        document.addEventListener('pointerdown', audioResumeHandler, true);
        document.addEventListener('keydown', audioResumeHandler, true);
    }

    function ensureNarrationAudio() {
        if (narrationAudio) return narrationAudio;
        narrationAudio = document.createElement('audio');
        narrationAudio.preload = 'auto';
        narrationAudio.loop = false;
        narrationAudio.src = VIDEO_FALLBACK_SRC;
        narrationAudio.volume = 1;
        return narrationAudio;
    }

    function playVideo(video, overlay, options = {}) {
        if (!video) return;
        const withNarration = options.withNarration === true;
        if (withNarration) {
            video.muted = true;
        } else {
            video.muted = false;
        }
        video.volume = 1;
        const targets = [video];

        if (withNarration) {
            const audio = ensureNarrationAudio();
            try { audio.currentTime = Math.max(0, Number(video.currentTime) || 0); } catch (_) { }
            targets.push(audio);
        } else {
            cleanupNarrationAudio();
        }

        setPlaybackTargets(targets);

        const tasks = targets.map((media) => {
            try {
                return Promise.resolve(media.play()).then(() => true).catch(() => false);
            } catch (_) {
                return Promise.resolve(false);
            }
        });

        Promise.all(tasks).then((results) => {
            if (results.every(Boolean)) {
                setFallbackText(overlay, '');
                return;
            }
            setFallbackText(overlay, '음성 자동재생이 차단되었습니다. 화면을 한번 눌러주세요.');
            setActionsVisible(overlay, true);
            bindAudioResumeGesture(overlay);
        });
    }

    function selectPlaybackSource(video, webmSrc, fallbackMp4Src) {
        const canPlayWebm = (typeof video?.canPlayType === 'function')
            && !!video.canPlayType('video/webm');
        return canPlayWebm ? webmSrc : fallbackMp4Src;
    }

    function completeGuidedFlow(flow, message) {
        if (!flow || flow.active !== true) return;
        setGuidedStep(flow, GUIDED_BUILD_STEPS.DONE);
        setFallbackText(flow.overlay, String(message || '튜토리얼 단계 완료.'));
        markCityIntroSeen(flow.game, false);
        persistTutorial(flow.game);
        stopGuidedFlow();
        setTimeout(() => {
            const overlay = getOverlay();
            if (overlay) closeOverlay();
        }, 520);
    }

    function selectBuildingForTutorial(flow, tileKey, preferredIndex) {
        if (!flow || flow.active !== true) return false;
        const state = getCityState(flow.game);
        if (!state) return false;
        const targetTile = String(tileKey || '').trim();
        if (!targetTile) return false;

        let index = Number(preferredIndex);
        if (!Number.isInteger(index) || index < 0 || String(state.grid?.[index] || '').trim() !== targetTile) {
            index = findGridTileIndex(flow.game, targetTile);
        }
        if (!Number.isInteger(index) || index < 0) return false;

        if (typeof CitySimState !== 'undefined' && CitySimState) {
            if (typeof CitySimState.clearPlacement === 'function') {
                CitySimState.clearPlacement(flow.game);
            }
            if (typeof CitySimState.setSelection === 'function') {
                CitySimState.setSelection(flow.game, index, targetTile);
            }
        }
        if (typeof flow.game.renderCityGrid === 'function') flow.game.renderCityGrid();
        if (typeof flow.game.renderCityContextBar === 'function') flow.game.renderCityContextBar();
        return true;
    }

    function playInlineClip(flow, webmSrc, fallbackMp4Src, onDone, options = {}) {
        if (!flow || flow.active !== true || !activeVideo) return false;
        const overlay = flow.overlay;
        if (!overlay) return false;
        const startAtSec = Math.max(0, Number(options?.startAtSec) || 0);

        unbindAudioResumeGesture();
        cleanupNarrationAudio();
        setActionsVisible(overlay, false);
        setChoicePanelGuidedMode(overlay, true);

        activeVideo.onended = () => {
            clearPlaybackTargets();
            if (flow.active !== true) return;
            if (typeof onDone === 'function') onDone();
        };
        activeVideo.onerror = () => {
            clearPlaybackTargets();
            setFallbackText(overlay, '영상 로드에 실패했습니다. 텍스트 안내로 계속 진행합니다.');
            if (flow.active !== true) return;
            if (typeof onDone === 'function') onDone();
        };

        try {
            activeVideo.pause();
            activeVideo.src = selectPlaybackSource(activeVideo, webmSrc, fallbackMp4Src);

            let started = false;
            let seekApplied = startAtSec <= 0;
            const startPlayback = () => {
                if (started) return;
                started = true;
                playVideo(activeVideo, overlay, { withNarration: false });
            };
            const applySeek = () => {
                if (seekApplied || startAtSec <= 0) return;
                try {
                    if (Number.isFinite(activeVideo.duration) && activeVideo.duration > 0) {
                        activeVideo.currentTime = Math.min(startAtSec, Math.max(0, activeVideo.duration - 0.06));
                    } else {
                        activeVideo.currentTime = startAtSec;
                    }
                    seekApplied = true;
                } catch (_) { }
            };

            activeVideo.load();
            if (startAtSec > 0) {
                try {
                    activeVideo.addEventListener('loadedmetadata', () => {
                        applySeek();
                        if (!started) startPlayback();
                    }, { once: true });
                } catch (_) { }
                setTimeout(() => {
                    if (started) return;
                    applySeek();
                    startPlayback();
                }, 900);
            } else {
                startPlayback();
            }
            return true;
        } catch (err) {
            console.warn('[CityTutorialIntro] inline clip playback failed:', err);
            if (typeof onDone === 'function') onDone();
            return false;
        }
    }

    function transitionToBarracksFlow(flow) {
        if (!flow || flow.active !== true) return;
        setGuidedStep(flow, GUIDED_BUILD_STEPS.PLAY_BARRACKS_VIDEO);
        setFallbackText(flow.overlay, '병영 관련 안내 영상을 재생 중입니다.');
        clearGuidedHighlights(flow);

        playInlineClip(flow, BARRACKS_VIDEO_SRC, BARRACKS_VIDEO_FALLBACK_SRC, () => {
            if (!flow || flow.active !== true) return;
            setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_DEFENSE);
            setFallbackText(flow.overlay, '건설 패널에서 [국방] 탭을 눌러 병영을 건설합니다.');
            tickGuidedFlow(flow);
        });
    }

    function transitionToQuestRewardFlow(flow) {
        if (!flow || flow.active !== true) return;
        if (flow.game && typeof flow.game.closeCityActionModal === 'function') {
            flow.game.closeCityActionModal();
        }
        setGuidedStep(flow, GUIDED_BUILD_STEPS.PLAY_QUEST_VIDEO);
        setFallbackText(flow.overlay, '퀘스트 보상 안내 영상을 재생 중입니다.');
        clearGuidedHighlights(flow);

        playInlineClip(flow, QUEST_VIDEO_SRC, QUEST_VIDEO_FALLBACK_SRC, () => {
            if (!flow || flow.active !== true) return;
            ensureTutorialQuestClaimable(flow.game);
            setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_QUEST);
            setFallbackText(flow.overlay, '좌측 상단 [퀘스트] 버튼을 눌러 튜토리얼 보상을 수령하세요.');
            tickGuidedFlow(flow);
        });
    }

    function transitionToSupplyBoxFlow(flow) {
        if (!flow || flow.active !== true) return;
        if (flow.game && typeof flow.game.closeCityActionModal === 'function') {
            flow.game.closeCityActionModal();
        }
        if (flow.game && typeof flow.game.toggleCityMissionPanel === 'function') {
            flow.game.toggleCityMissionPanel(false);
        }
        setGuidedStep(flow, GUIDED_BUILD_STEPS.PLAY_SUPPLY_VIDEO);
        setFallbackText(flow.overlay, '상점/보관함 안내 영상을 재생 중입니다.');
        clearGuidedHighlights(flow);

        playInlineClip(flow, SUPPLY_VIDEO_SRC, SUPPLY_VIDEO_FALLBACK_SRC, () => {
            if (!flow || flow.active !== true) return;
            flow.specialBoxTargetCount = getCityBoxCount(flow.game, 'box_level2') + 1;
            flow.atItemTargetCount = getCityItemCount(flow.game, 'drone_at_item') + 1;
            flow.forceAtRewardPending = true;
            setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_SHOP);
            setFallbackText(flow.overlay, '우하단 [상점] 버튼을 눌러 특수 보급박스를 무료로 구매하세요.');
            tickGuidedFlow(flow);
        });
    }

    function transitionToHonorFlow(flow) {
        if (!flow || flow.active !== true) return;
        if (flow.game && typeof flow.game.closeCityActionModal === 'function') {
            flow.game.closeCityActionModal();
        }
        if (flow.game && typeof flow.game.toggleCityMissionPanel === 'function') {
            flow.game.toggleCityMissionPanel(false);
        }

        setGuidedStep(flow, GUIDED_BUILD_STEPS.PLAY_HONOR_VIDEO);
        setFallbackText(flow.overlay, '명예훈장 지급 안내 영상을 재생 중입니다.');
        clearGuidedHighlights(flow);

        playInlineClip(flow, HONOR_VIDEO_SRC, HONOR_VIDEO_FALLBACK_SRC, () => {
            if (!flow || flow.active !== true) return;
            flow.honorVideoPlayed = true;
            flow.droneTargetCount = Math.max(1, getCityUnitCount(flow.game, 'drone_operator'));
            flow.veteranCountBeforeHonor = getCityVeterans(flow.game).length;
            flow.promotedVeteranId = '';
            flow.promotedVeteranBaselineName = '';
            setGuidedStep(flow, GUIDED_BUILD_STEPS.AUTO_CLAIM_DRONE);
            tickGuidedFlow(flow);
        });
    }

    function wrapTutorialBattleEnd(flow) {
        if (!flow || flow.active !== true || !flow.game) return false;
        if (flow.battleEndWrapped === true && flow.game.endGame === flow.battleEndWrapper) return true;
        if (typeof flow.game.endGame !== 'function') return false;

        restoreBattleHook(flow);
        flow.battleEndOriginal = flow.game.endGame;
        flow.battleEndWrapper = function tutorialBattleEndWrapper(result, title, desc) {
            const out = flow.battleEndOriginal.call(this, result, title, desc);
            if (!flow || flow.active !== true) return out;
            const tracker = getTutorialSkirmishState(this);
            if (tracker) {
                tracker.active = false;
                tracker.battleEnded = true;
                tracker.result = String(result || '').trim();
            }
            flow.pendingOutroAfterBattle = true;
            setGuidedStep(flow, GUIDED_BUILD_STEPS.WAIT_BATTLE_END);
            setTimeout(() => {
                if (!flow || flow.active !== true) return;
                if (typeof this.retreatToCity === 'function') {
                    try { this.retreatToCity(); } catch (_) { }
                }
            }, 420);
            return out;
        };
        flow.game.endGame = flow.battleEndWrapper;
        flow.battleEndWrapped = true;
        return true;
    }

    function startTutorialSkirmishBattle(flow) {
        if (!flow || flow.active !== true || !flow.game) return false;
        if (flow.tutorialBattleStarted === true) return true;

        const stageData = createTutorialSkirmishStageData();
        const mapId = String(stageData?.mapId || '').trim() || 'skirmish_kabul';
        const tutorialSkirmishState = {
            active: true,
            mode: 'city_intro',
            infantryRequired: 0,
            infantryPlaced: 0,
            veteranRequired: 1,
            veteranPlaced: 0,
            veteranUnitKey: 'drone_operator',
            droneSkillUsed: false,
            lockdownUsed: false,
            droneLockCursorBaseline: Math.max(0, Math.floor(Number(flow.game.droneLockCursor) || 0)),
            operatorChargeBaseline: 0,
            battleStarted: false,
            battleEnded: false,
            result: '',
            mapId
        };

        flow.game._cityTutorialSkirmish = tutorialSkirmishState;
        if (!wrapTutorialBattleEnd(flow)) return false;

        flow.tutorialBattleStarted = true;
        flow.pendingOutroAfterBattle = false;
        setGuidedStep(flow, GUIDED_BUILD_STEPS.DEPLOY_INFANTRY);
        setFallbackText(flow.overlay, '국지전 시작: [★ 베테랑 탭]에서 드론병을 1기 배치하세요.');
        clearGuidedHighlights(flow);

        if (typeof flow.game.closeCityActionModal === 'function') flow.game.closeCityActionModal();
        if (typeof flow.game.openCityBuildPanel === 'function') flow.game.openCityBuildPanel(false);
        if (typeof flow.game.openCityInventory === 'function') flow.game.openCityInventory(false);
        if (typeof flow.game.toggleCityMissionPanel === 'function') flow.game.toggleCityMissionPanel(false);

        try {
            flow.game.startGame(mapId, {
                campaignStageId: 0,
                campaignMode: 'skirmish',
                threatLevel: 1,
                skirmish: true,
                skirmishData: stageData
            });
            if (typeof ChatPanel !== 'undefined' && ChatPanel && typeof ChatPanel.push === 'function') {
                ChatPanel.push('튜토리얼: 별 표시(베테랑 탭)에서 드론병 1기를 먼저 배치하세요.', 'INFO');
            }
            return true;
        } catch (err) {
            console.warn('[CityTutorialIntro] tutorial skirmish start failed:', err);
            restoreBattleHook(flow);
            clearTutorialSkirmishRuntime(flow);
            flow.tutorialBattleStarted = false;
            return false;
        }
    }

    function transitionToBattleFlow(flow) {
        if (!flow || flow.active !== true) return;
        if (flow.game && typeof flow.game.closeCityActionModal === 'function') {
            flow.game.closeCityActionModal();
        }
        if (flow.game && typeof flow.game.toggleCityMissionPanel === 'function') {
            flow.game.toggleCityMissionPanel(false);
        }
        setGuidedStep(flow, GUIDED_BUILD_STEPS.PLAY_BATTLE_VIDEO);
        setFallbackText(flow.overlay, '전투 안내 영상을 재생 중입니다.');
        clearGuidedHighlights(flow);

        playInlineClip(flow, BATTLE_VIDEO_SRC, BATTLE_VIDEO_FALLBACK_SRC, () => {
            if (!flow || flow.active !== true) return;
            setGuidedStep(flow, GUIDED_BUILD_STEPS.WAIT_BATTLE_BUTTON);
            setFallbackText(flow.overlay, '[전투] 버튼을 눌러 도시 소탕 작전을 시작하세요.');
            setGuidedHighlights(flow, [findBattleButton()]);
            tickGuidedFlow(flow);
        }, { startAtSec: 0.5 });
    }

    function transitionToOutroFlow(flow) {
        if (!flow || flow.active !== true) return;
        if (!isCityScreenVisible()) return;
        setGuidedStep(flow, GUIDED_BUILD_STEPS.PLAY_OUTRO_VIDEO);
        setFallbackText(flow.overlay, '작전 종료 안내 영상을 재생 중입니다.');
        clearGuidedHighlights(flow);

        playInlineClip(flow, OUTRO_VIDEO_SRC, OUTRO_VIDEO_FALLBACK_SRC, () => {
            if (!flow || flow.active !== true) return;
            ensureFinalTutorialQuestClaimable(flow.game);
            if (flow.game && typeof flow.game.toggleCityMissionPanel === 'function') {
                flow.game.toggleCityMissionPanel(false);
            }
            setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_FINAL_QUEST);
            setFallbackText(flow.overlay, '좌측 상단 [퀘스트]를 열어 튜토리얼 완료 보상(금 5)을 수령하세요.');
            tickGuidedFlow(flow);
        });
    }

    function tickGuidedFlow(flow) {
        if (!flow || flow.active !== true) return;
        if (!flow.overlay || !flow.overlay.isConnected) {
            stopGuidedFlow();
            return;
        }
        setCityActionCloseButtonLocked(
            flow.step === GUIDED_BUILD_STEPS.NAME_VETERAN
            && flow.veteranRenameCompleted !== true
        );

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_BUILD) {
            setFallbackText(flow.overlay, '건설 버튼을 눌러 건설 패널을 열어주세요.');
            setGuidedHighlights(flow, [findBuildButton()]);
            if (isBuildPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_ECONOMY);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_ECONOMY) {
            if (!isBuildPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_BUILD);
                return;
            }
            setFallbackText(flow.overlay, '건설 패널 상단의 [경제] 탭을 눌러주세요.');
            const target = findEconomyTabButton() || document.getElementById('city-build-tabs');
            setGuidedHighlights(flow, [target]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.SELECT_HOUSE) {
            if (!isBuildPanelOpen(flow.game) && !isHouseToolSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_BUILD);
                return;
            }
            if (!isEconomyTabSelected(flow.game) && isBuildPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_ECONOMY);
                return;
            }
            setFallbackText(flow.overlay, '경제 탭에서 [집(회사)] 카드를 눌러 선택하세요.');
            const target = findHouseCardButton() || document.getElementById('city-build-cards');
            setGuidedHighlights(flow, [target]);
            if (isHouseToolSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.PLACE_HOUSE);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.PLACE_HOUSE) {
            setFallbackText(flow.overlay, '원하는 타일을 눌러 집(회사)을 건설하세요.');
            const target = document.getElementById('city-grid') || document.getElementById('city-map-viewport');
            setGuidedHighlights(flow, [target]);
            if (flow.houseBuilt === true || countGridTile(flow.game, 'house') > flow.baseHouseCount) {
                setFallbackText(flow.overlay, '좋습니다. 집(회사) 건설 완료.');
                transitionToBarracksFlow(flow);
                return;
            }
            if (!isHouseToolSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.SELECT_HOUSE);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.PLAY_BARRACKS_VIDEO) {
            setFallbackText(flow.overlay, '병영 관련 안내 영상을 재생 중입니다.');
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_DEFENSE) {
            if (!isBuildPanelOpen(flow.game)) {
                setFallbackText(flow.overlay, '건설 버튼을 눌러 패널을 연 뒤 [국방] 탭을 누르세요.');
                setGuidedHighlights(flow, [findBuildButton()]);
                return;
            }
            setFallbackText(flow.overlay, '건설 패널 상단의 [국방] 탭을 눌러주세요.');
            const target = findDefenseTabButton() || document.getElementById('city-build-tabs');
            setGuidedHighlights(flow, [target]);
            if (isDefenseTabSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.SELECT_BARRACKS);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.SELECT_BARRACKS) {
            if (!isBuildPanelOpen(flow.game) && !isBarracksToolSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_DEFENSE);
                return;
            }
            if (!isDefenseTabSelected(flow.game) && isBuildPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_DEFENSE);
                return;
            }
            setFallbackText(flow.overlay, '국방 탭에서 [병영] 카드를 선택하세요.');
            const target = findBarracksCardButton() || document.getElementById('city-build-cards');
            setGuidedHighlights(flow, [target]);
            if (isBarracksToolSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.PLACE_BARRACKS);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.PLACE_BARRACKS) {
            setFallbackText(flow.overlay, '원하는 타일을 눌러 병영을 건설하세요.');
            const target = document.getElementById('city-grid') || document.getElementById('city-map-viewport');
            setGuidedHighlights(flow, [target]);
            const barracksCount = countGridTile(flow.game, 'barracks');
            if (flow.barracksBuilt === true || barracksCount > flow.baseBarracksCount) {
                if (!Number.isInteger(flow.barracksIndex) || flow.barracksIndex < 0) {
                    flow.barracksIndex = findGridTileIndex(flow.game, 'barracks');
                }
                selectBuildingForTutorial(flow, 'barracks', flow.barracksIndex);
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_PRODUCTION);
                return;
            }
            if (!isBarracksToolSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.SELECT_BARRACKS);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_PRODUCTION) {
            const selectedOk = isBarracksSelected(flow.game) || selectBuildingForTutorial(flow, 'barracks', flow.barracksIndex);
            if (!selectedOk) {
                setFallbackText(flow.overlay, '병영을 선택한 뒤 하단 [생산] 버튼을 눌러주세요.');
                setGuidedHighlights(flow, [document.getElementById('city-grid') || document.getElementById('city-map-viewport')]);
                return;
            }
            setFallbackText(flow.overlay, '하단 [생산] 버튼을 눌러 병영 생산창을 여세요.');
            const target = findProductionButton() || document.getElementById('city-context-bar');
            setGuidedHighlights(flow, [target]);
            if (isProductionModalOpen()) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.QUEUE_DRONE);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.QUEUE_DRONE) {
            if (!isProductionModalOpen()) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_PRODUCTION);
                return;
            }
            setFallbackText(flow.overlay, '생산창에서 [드론병] 1기를 선택하세요. (튜토리얼 무료)');
            const droneBtn = findDroneProductionButton();
            const target = droneBtn || document.getElementById('city-action-modal');
            setGuidedHighlights(flow, [target]);

            if (!Number.isInteger(flow.barracksIndex) || flow.barracksIndex < 0) {
                flow.barracksIndex = findGridTileIndex(flow.game, 'barracks');
            }
            if (hasQueuedDroneAtIndex(flow.game, flow.barracksIndex) || hasQueuedDroneAtAnyBarracks(flow.game)) {
                transitionToQuestRewardFlow(flow);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.PLAY_QUEST_VIDEO) {
            setFallbackText(flow.overlay, '퀘스트 보상 안내 영상을 재생 중입니다.');
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_QUEST) {
            if (isTutorialQuestClaimed(flow.game)) {
                removeTutorialQuest(flow.game);
                transitionToSupplyBoxFlow(flow);
                return;
            }
            ensureTutorialQuestClaimable(flow.game);
            if (isMissionPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.CLAIM_QUEST_REWARD);
                return;
            }
            setFallbackText(flow.overlay, '좌측 상단 [퀘스트] 버튼을 눌러 튜토리얼 보상을 여세요.');
            const toggleBtn = findMissionToggleButton();
            const target = toggleBtn || findMissionCard() || document.getElementById('city-screen');
            setGuidedHighlights(flow, [target]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.CLAIM_QUEST_REWARD) {
            if (isTutorialQuestClaimed(flow.game)) {
                removeTutorialQuest(flow.game);
                transitionToSupplyBoxFlow(flow);
                return;
            }
            ensureTutorialQuestClaimable(flow.game);
            if (!isMissionPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_QUEST);
                return;
            }
            setFallbackText(flow.overlay, '퀘스트 목록에서 [튜토리얼 진행 보상]의 [지급받기]를 눌러 명예훈장 1개를 수령하세요.');
            const claimBtn = findTutorialQuestClaimButton();
            const target = claimBtn || findTutorialQuestRow() || findMissionCard();
            setGuidedHighlights(flow, [target]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.PLAY_SUPPLY_VIDEO) {
            setFallbackText(flow.overlay, '상점/보관함 안내 영상을 재생 중입니다.');
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_SHOP) {
            if (isShopPanelOpen()) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.BUY_SPECIAL_BOX);
                return;
            }
            setFallbackText(flow.overlay, '우하단 [상점] 버튼을 눌러 특수 보급박스를 무료로 구매하세요.');
            setGuidedHighlights(flow, [findShopButton()]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.BUY_SPECIAL_BOX) {
            if (!isShopPanelOpen()) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_SHOP);
                return;
            }
            const currentBoxCount = getCityBoxCount(flow.game, 'box_level2');
            if (currentBoxCount >= Math.max(1, Math.floor(Number(flow.specialBoxTargetCount) || 1))) {
                if (typeof CitySimGacha !== 'undefined' && CitySimGacha && typeof CitySimGacha.close === 'function') {
                    CitySimGacha.close();
                }
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_INVENTORY);
                return;
            }
            let specialCard = findShopSpecialBoxCard();
            if (!specialCard
                && typeof CitySimGacha !== 'undefined'
                && CitySimGacha
                && typeof CitySimGacha.switchTab === 'function') {
                CitySimGacha.switchTab('supply');
                specialCard = findShopSpecialBoxCard();
            }
            setFallbackText(flow.overlay, '상점에서 [특수 보급박스]를 무료로 1회 구매하세요.');
            const target = specialCard || document.getElementById('city-shop-cards');
            setGuidedHighlights(flow, [target]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_INVENTORY) {
            if (isInventoryPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_SUPPLY_TAB);
                return;
            }
            setFallbackText(flow.overlay, '좌하단 [보관함] 버튼을 눌러 보급품을 확인하세요.');
            setGuidedHighlights(flow, [findInventoryButton()]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_SUPPLY_TAB) {
            if (!isInventoryPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_INVENTORY);
                return;
            }
            const supplyTabBtn = findInventorySupplyTabButton();
            if (!supplyTabBtn) {
                const veteranToggleBtn = findInventoryVeteranToggleButton();
                if (veteranToggleBtn && veteranToggleBtn.classList.contains('is-open')) {
                    veteranToggleBtn.click();
                    setFallbackText(flow.overlay, '보급품 탭을 표시 중입니다. 잠시만 기다려주세요.');
                    setGuidedHighlights(flow, [veteranToggleBtn]);
                    return;
                }
                setFallbackText(flow.overlay, '보관함 상단 [★]를 꺼서 일반 보관함 탭으로 전환하세요.');
                setGuidedHighlights(flow, [veteranToggleBtn || document.getElementById('city-inventory-tabs')]);
                return;
            }
            if (isSupplyTabSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_SPECIAL_BOX);
                return;
            }
            setFallbackText(flow.overlay, '보관함 상단 [보급품] 탭을 눌러주세요.');
            const target = supplyTabBtn || document.getElementById('city-inventory-tabs');
            setGuidedHighlights(flow, [target]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_SPECIAL_BOX) {
            if (!isInventoryPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_INVENTORY);
                return;
            }
            if (!isSupplyTabSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_SUPPLY_TAB);
                return;
            }
            const atTargetCount = Math.max(1, Math.floor(Number(flow.atItemTargetCount) || 1));
            const atCount = getCityItemCount(flow.game, 'drone_at_item');
            if (atCount >= atTargetCount) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.VERIFY_AT_DRONE);
                return;
            }
            setFallbackText(flow.overlay, '[특수 보급박스]를 개봉하세요. (튜토리얼 보상: AT드론)');
            const target = findInventorySpecialBoxCard() || document.getElementById('city-inventory-cards');
            setGuidedHighlights(flow, [target]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.VERIFY_AT_DRONE) {
            if (!isInventoryPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_INVENTORY);
                return;
            }
            if (!isSupplyTabSelected(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_SUPPLY_TAB);
                return;
            }
            const atTargetCount = Math.max(1, Math.floor(Number(flow.atItemTargetCount) || 1));
            const atCount = getCityItemCount(flow.game, 'drone_at_item');
            if (atCount < atTargetCount) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_SPECIAL_BOX);
                return;
            }
            if (isShopOpenEffectVisible()) {
                setFallbackText(flow.overlay, '보상 확인 창의 [확인]을 눌러 닫아주세요.');
                setGuidedHighlights(flow, [document.getElementById('shop-open-overlay')]);
                return;
            }
            const atCard = findInventoryAtDroneCard();
            setFallbackText(flow.overlay, '좋습니다. 보관함에서 AT드론 보유를 확인했습니다.');
            setGuidedHighlights(flow, [atCard || document.getElementById('city-inventory-cards')]);
            if (atCard) {
                transitionToHonorFlow(flow);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.PLAY_HONOR_VIDEO) {
            setFallbackText(flow.overlay, '명예훈장 지급 안내 영상을 재생 중입니다.');
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.AUTO_CLAIM_DRONE) {
            const claimResult = autoClaimReadyDroneProduction(flow.game);
            const droneCount = getCityUnitCount(flow.game, 'drone_operator');
            if (droneCount > 0) {
                flow.droneTargetCount = Math.max(1, droneCount);
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_HONOR_MEDAL);
                return;
            }
            if (claimResult.pending === true || hasPendingQueuedDroneProduction(flow.game)) {
                setFallbackText(flow.overlay, '드론병 생산이 완료되는 즉시 자동 수령합니다. 잠시만 기다려주세요.');
                setGuidedHighlights(flow, [document.getElementById('city-grid') || document.getElementById('city-map-viewport')]);
                return;
            }
            setFallbackText(flow.overlay, '드론병 수량을 확인하는 중입니다. 잠시만 기다려주세요.');
            setGuidedHighlights(flow, [document.getElementById('city-screen')]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_HONOR_MEDAL) {
            if (flow.honorVideoPlayed !== true) {
                setFallbackText(flow.overlay, '명예훈장 지급 안내 영상을 먼저 재생합니다.');
                clearGuidedHighlights(flow);
                transitionToHonorFlow(flow);
                return;
            }
            if (hasPromotedDroneVeteran(flow)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.EQUIP_AT_DRONE);
                return;
            }
            if (!isInventoryPanelOpen(flow.game)) {
                setFallbackText(flow.overlay, '좌하단 [보관함] 버튼을 눌러 보급품을 확인하세요.');
                setGuidedHighlights(flow, [findInventoryButton()]);
                return;
            }
            if (!isSupplyTabSelected(flow.game)) {
                const supplyTabBtn = findInventorySupplyTabButton();
                if (!supplyTabBtn) {
                    const veteranToggleBtn = findInventoryVeteranToggleButton();
                    if (veteranToggleBtn && veteranToggleBtn.classList.contains('is-open')) {
                        veteranToggleBtn.click();
                        setFallbackText(flow.overlay, '보급품 탭을 표시 중입니다. 잠시만 기다려주세요.');
                        setGuidedHighlights(flow, [veteranToggleBtn]);
                        return;
                    }
                    setFallbackText(flow.overlay, '보관함 상단 [★]를 꺼서 일반 보관함 탭으로 전환하세요.');
                    setGuidedHighlights(flow, [veteranToggleBtn || document.getElementById('city-inventory-tabs')]);
                    return;
                }
                setFallbackText(flow.overlay, '보관함 상단 [보급품] 탭을 눌러주세요.');
                setGuidedHighlights(flow, [supplyTabBtn]);
                return;
            }
            if (isHonorMedalPickerOpen()) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.SELECT_HONOR_TARGET);
                return;
            }
            const honorCard = findInventoryHonorMedalCard();
            setFallbackText(flow.overlay, '보관함 [보급품]에서 [명예훈장]을 눌러 지급 창을 여세요.');
            setGuidedHighlights(flow, [honorCard || document.getElementById('city-inventory-cards')]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.SELECT_HONOR_TARGET) {
            if (!isHonorMedalPickerOpen()) {
                if (isVeteranProfileOpen() || hasPromotedDroneVeteran(flow)) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.EQUIP_AT_DRONE);
                } else {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_HONOR_MEDAL);
                }
                return;
            }
            const droneCard = findHonorDroneTargetCard();
            const selectedCard = findHonorSelectedTargetCard();
            const selectedId = String(selectedCard?.getAttribute('data-city-honor-target') || '').trim();
            if (selectedCard && (!droneCard || selectedId === 'unit:drone_operator')) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.APPLY_HONOR_MEDAL);
                return;
            }
            if (selectedCard && droneCard && selectedId && selectedId !== 'unit:drone_operator') {
                setFallbackText(flow.overlay, '이번 단계에서는 [드론병]을 선택해야 합니다.');
                setGuidedHighlights(flow, [droneCard]);
                return;
            }
            setFallbackText(flow.overlay, '명예훈장 지급 대상에서 [드론병]을 선택하세요.');
            setGuidedHighlights(flow, [droneCard || document.getElementById('city-action-msg')]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.APPLY_HONOR_MEDAL) {
            if (hasPromotedDroneVeteran(flow)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.EQUIP_AT_DRONE);
                return;
            }
            if (isVeteranProfileOpen()) {
                syncPromotedDroneVeteran(flow);
                setGuidedStep(flow, GUIDED_BUILD_STEPS.EQUIP_AT_DRONE);
                return;
            }
            if (!isHonorMedalPickerOpen()) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_HONOR_MEDAL);
                return;
            }
            const applyBtn = findHonorApplyButton();
            setFallbackText(flow.overlay, '[지급] 버튼을 눌러 드론병을 베테랑으로 승격하세요.');
            setGuidedHighlights(flow, [applyBtn || document.getElementById('city-action-msg')]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.EQUIP_AT_DRONE) {
            if (!isVeteranProfileOpen()) {
                if (hasPromotedDroneVeteran(flow)) {
                    if (!isInventoryPanelOpen(flow.game)) {
                        setFallbackText(flow.overlay, '좌하단 [보관함]을 다시 열고 승격된 드론병 프로필을 이어서 진행하세요.');
                        setGuidedHighlights(flow, [findInventoryButton() || document.getElementById('city-fab-inventory')]);
                        return;
                    }
                    const veteranChip = findInventoryVeteranChip();
                    setFallbackText(flow.overlay, '보관함의 베테랑 유닛 칩을 눌러 드론병 프로필을 다시 열어주세요.');
                    setGuidedHighlights(flow, [veteranChip || document.getElementById('city-inventory-veteran-list') || document.getElementById('city-inventory-cards')]);
                    return;
                }
                if (isHonorMedalPickerOpen()) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.APPLY_HONOR_MEDAL);
                } else {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_HONOR_MEDAL);
                }
                return;
            }
            syncPromotedDroneVeteran(flow);
            const atEquipBtn = findVeteranProfileAtDroneEquipButton();
            if (atEquipBtn && atEquipBtn.classList.contains('is-current')) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.NAME_VETERAN);
                return;
            }
            setFallbackText(flow.overlay, '아이템 보관함에서 [AT드론]을 눌러 스킬 트리에 적용하세요.');
            setGuidedHighlights(flow, [atEquipBtn || document.getElementById('city-action-msg')]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.NAME_VETERAN) {
            if (!isVeteranProfileOpen()) {
                const requestedAt = Math.max(0, Math.floor(Number(flow.veteranRenameRequestedAt) || 0));
                if (requestedAt > 0 && (Date.now() - requestedAt) < 1800) {
                    setFallbackText(flow.overlay, '이름을 적용 중입니다. 잠시만 기다려주세요.');
                    clearGuidedHighlights(flow);
                    return;
                }
                setGuidedStep(flow, GUIDED_BUILD_STEPS.EQUIP_AT_DRONE);
                return;
            }

            syncPromotedDroneVeteran(flow);

            const currentName = getVeteranNameById(flow.game, flow.promotedVeteranId);
            if (currentName && currentName !== String(flow.promotedVeteranBaselineName || '')) {
                flow.veteranRenameCompleted = true;
            }
            if (flow.veteranRenameCompleted === true) {
                setCityActionCloseButtonLocked(false);
                setGuidedStep(flow, GUIDED_BUILD_STEPS.CLOSE_VETERAN_PROFILE);
                return;
            }
            const saveBtn = findVeteranInlineSaveButton();
            const nameInput = findVeteranInlineNameInput();
            if (nameInput && !String(nameInput.value || '').trim()) {
                nameInput.value = '드론병';
            }
            setFallbackText(flow.overlay, '마지막으로 베테랑 이름을 정하고 [저장/기본/랜덤] 중 하나를 눌러 마무리하세요.');
            setGuidedHighlights(flow, [saveBtn || nameInput || document.getElementById('city-action-msg')]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.CLOSE_VETERAN_PROFILE) {
            setCityActionCloseButtonLocked(false);
            if (!isVeteranProfileOpen()) {
                transitionToBattleFlow(flow);
                return;
            }
            const closeBtn = findCityActionCloseButton();
            setFallbackText(flow.overlay, '이름 적용이 완료되었습니다. [닫기]를 눌러 시티 화면으로 돌아가세요.');
            setGuidedHighlights(flow, [closeBtn || document.getElementById('city-action-modal')]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.PLAY_BATTLE_VIDEO) {
            setFallbackText(flow.overlay, '전투 안내 영상을 재생 중입니다.');
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.WAIT_BATTLE_BUTTON) {
            if (!isCityScreenVisible()) {
                setFallbackText(flow.overlay, '시티 화면을 표시 중입니다. 잠시만 기다려주세요.');
                clearGuidedHighlights(flow);
                return;
            }
            setFallbackText(flow.overlay, '[전투] 버튼을 눌러 도시 소탕 작전을 시작하세요.');
            setGuidedHighlights(flow, [findBattleButton()]);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.DEPLOY_INFANTRY) {
            const tracker = getTutorialSkirmishState(flow.game);
            if (!tracker) {
                setFallbackText(flow.overlay, '국지전 진입을 준비 중입니다. 잠시만 기다려주세요.');
                clearGuidedHighlights(flow);
                return;
            }
            const required = Math.max(1, Math.floor(Number(tracker.veteranRequired) || 1));
            const placed = Math.max(0, Math.floor(Number(tracker.veteranPlaced) || 0));
            if (placed >= required) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.DEPLOY_VETERAN);
                return;
            }
            setFallbackText(flow.overlay, `국지전 진행 중: [★ 베테랑 탭]에서 드론병 배치 (${placed}/${required})`);
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.DEPLOY_VETERAN) {
            const tracker = getTutorialSkirmishState(flow.game);
            if (!tracker) return;
            if (tracker.battleStarted === true || getSkirmishPhase() === 'battle') {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.START_BATTLE);
                return;
            }
            const required = Math.max(1, Math.floor(Number(tracker.veteranRequired) || 1));
            const placed = Math.max(0, Math.floor(Number(tracker.veteranPlaced) || 0));
            if (placed < required) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.DEPLOY_INFANTRY);
                return;
            }
            setFallbackText(flow.overlay, '국지전 진행 중: [전투 시작]을 눌러 전투를 개시하세요.');
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.START_BATTLE) {
            const tracker = getTutorialSkirmishState(flow.game);
            if (!tracker) return;
            if (getSkirmishPhase() !== 'battle' && tracker.battleStarted !== true) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.DEPLOY_VETERAN);
                return;
            }
            setTutorialSupportUnitsHold(flow.game, true);
            if (isTutorialBattleSelectionLockActive(flow)) {
                pruneSelectionToDroneOperator(flow.game);
            }

            const lockBaseline = Math.max(0, Math.floor(Number(tracker.droneLockCursorBaseline) || 0));
            const currentLockCursor = Math.max(0, Math.floor(Number(flow.game?.droneLockCursor) || 0));
            if (currentLockCursor > lockBaseline) {
                tracker.lockdownUsed = true;
            }

            const aliveDrones = getAlivePlayerDrones(flow.game);
            if (aliveDrones.length > 0) {
                tracker.droneSkillUsed = true;
            }

            if (tracker.operatorChargeBaseline <= 0) {
                tracker.operatorChargeBaseline = getPlayerOperatorDroneChargeSum(flow.game);
            }
            const currentChargeSum = getPlayerOperatorDroneChargeSum(flow.game);
            if (currentChargeSum < Math.max(0, Math.floor(Number(tracker.operatorChargeBaseline) || 0))) {
                tracker.droneSkillUsed = true;
            }

            if (!tracker.lockdownUsed) {
                const hasLiveLock = aliveDrones.some((drone) => !!(drone && drone.lockedTarget && !drone.lockedTarget.dead));
                if (hasLiveLock) {
                    tracker.lockdownUsed = true;
                }
            }

            if (tracker.droneSkillUsed !== true) {
                setFallbackText(flow.overlay, '국지전 진행 중: 드론병을 선택하고 스킬(자폭드론/AT드론)을 1회 사용하세요.');
                clearGuidedHighlights(flow);
                return;
            }

            if (tracker.lockdownUsed !== true) {
                setFallbackText(flow.overlay, '국지전 진행 중: 드론병 선택 상태에서 적을 눌러 [락다운]을 지정하세요.');
                clearGuidedHighlights(flow);
                return;
            }

            setTutorialSupportUnitsHold(flow.game, false);
            setGuidedStep(flow, GUIDED_BUILD_STEPS.WAIT_BATTLE_END);
            setFallbackText(flow.overlay, '좋습니다. 락다운 지시 완료. 남은 적을 소탕하면 즉시 시티로 복귀합니다.');
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.WAIT_BATTLE_END) {
            if (flow.pendingOutroAfterBattle === true && isCityScreenVisible()) {
                flow.pendingOutroAfterBattle = false;
                transitionToOutroFlow(flow);
                return;
            }
            setFallbackText(flow.overlay, '전투 진행 중입니다. 결과를 확인하는 즉시 시티로 복귀합니다.');
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.PLAY_OUTRO_VIDEO) {
            setFallbackText(flow.overlay, '작전 종료 안내 영상을 재생 중입니다.');
            clearGuidedHighlights(flow);
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.OPEN_FINAL_QUEST) {
            if (isFinalTutorialQuestClaimed(flow.game)) {
                completeGuidedFlow(flow, '튜토리얼 완료: 금 5 보상 수령까지 완료했습니다.');
                return;
            }
            if (!isMissionPanelOpen(flow.game)) {
                setFallbackText(flow.overlay, '좌측 상단 [퀘스트]를 눌러 완료 보상을 확인하세요.');
                setGuidedHighlights(flow, [findMissionToggleButton() || findMissionCard() || document.getElementById('city-screen')]);
                return;
            }
            setFallbackText(flow.overlay, '[튜토리얼 완료 보상] 행의 [지급받기]를 누르세요. (금 +5)');
            setGuidedHighlights(flow, [findFinalQuestRow() || findMissionCard()]);
            if (findFinalQuestClaimButton()) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.CLAIM_FINAL_QUEST);
            }
            return;
        }

        if (flow.step === GUIDED_BUILD_STEPS.CLAIM_FINAL_QUEST) {
            if (isFinalTutorialQuestClaimed(flow.game)) {
                completeGuidedFlow(flow, '튜토리얼 완료: 금 5 보상 수령까지 완료했습니다.');
                return;
            }
            if (!isMissionPanelOpen(flow.game)) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_FINAL_QUEST);
                return;
            }
            const claimBtn = findFinalQuestClaimButton();
            if (!claimBtn) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_FINAL_QUEST);
                return;
            }
            setFallbackText(flow.overlay, '[지급받기]를 눌러 튜토리얼 완료 보상(금 5)을 수령하세요.');
            setGuidedHighlights(flow, [claimBtn]);
            return;
        }
    }

    function startGuidedFlow(game, overlay) {
        stopGuidedFlow();
        if (!game || !overlay) {
            markCityIntroSeen(game, false);
            closeOverlay();
            return;
        }

        if (isTutorialQuestClaimed(game)) {
            removeTutorialQuest(game);
        }

        const flow = {
            active: true,
            game,
            overlay,
            step: GUIDED_BUILD_STEPS.OPEN_BUILD,
            pollTimer: null,
            pointerHandler: null,
            wrappedQuestHandler: null,
            originalQuestHandler: null,
            highlighted: [],
            houseBuilt: false,
            baseHouseCount: countGridTile(game, 'house'),
            barracksBuilt: false,
            baseBarracksCount: countGridTile(game, 'barracks'),
            barracksIndex: -1,
            specialBoxTargetCount: Math.max(1, getCityBoxCount(game, 'box_level2') + 1),
            atItemTargetCount: Math.max(1, getCityItemCount(game, 'drone_at_item') + 1),
            forceAtRewardPending: false,
            droneTargetCount: Math.max(1, getCityUnitCount(game, 'drone_operator')),
            veteranCountBeforeHonor: getCityVeterans(game).length,
            promotedVeteranId: '',
            promotedVeteranBaselineName: '',
            battleEndOriginal: null,
            battleEndWrapper: null,
            battleEndWrapped: false,
            tutorialBattleStarted: false,
            pendingOutroAfterBattle: false,
            honorVideoPlayed: false,
            veteranRenameRequestedAt: 0,
            veteranRenameCompleted: false
        };
        guidedFlow = flow;
        markCityIntroSeen(game, false);
        patchTutorialStep(game, guidedStepToNumber(flow.step));
        setActionsVisible(overlay, false);
        setChoicePanelGuidedMode(overlay, true);

        if (typeof game.onQuestMissionEvent === 'function') {
            flow.originalQuestHandler = game.onQuestMissionEvent;
            flow.wrappedQuestHandler = function wrappedQuestMissionEvent(eventType, payload = {}) {
                const result = flow.originalQuestHandler.call(this, eventType, payload);
                if (flow.active === true
                    && String(eventType || '').trim() === 'build'
                    && String(payload?.tool || '').trim() === 'house') {
                    flow.houseBuilt = true;
                }
                if (flow.active === true
                    && String(eventType || '').trim() === 'build'
                    && String(payload?.tool || '').trim() === 'barracks') {
                    flow.barracksBuilt = true;
                    if (!Number.isInteger(flow.barracksIndex) || flow.barracksIndex < 0) {
                        flow.barracksIndex = findGridTileIndex(flow.game, 'barracks');
                    }
                }
                return result;
            };
            game.onQuestMissionEvent = flow.wrappedQuestHandler;
        }

        flow.pointerHandler = (event) => {
            if (!flow || flow.active !== true) return;
            const target = event?.target;
            if (!target || typeof target.closest !== 'function') return;
            if (flow.step === GUIDED_BUILD_STEPS.NAME_VETERAN && flow.veteranRenameCompleted !== true) {
                const modal = document.getElementById('city-action-modal');
                const closeBtn = target.closest('#city-action-close-btn');
                const clickedBackdrop = !!modal && target === modal;
                if (closeBtn || clickedBackdrop) {
                    if (event.cancelable) event.preventDefault();
                    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
                    event.stopPropagation();
                    setFallbackText(flow.overlay, '이름을 먼저 [저장/기본/랜덤]으로 확정해야 [닫기]가 가능합니다.');
                    const saveBtn = findVeteranInlineSaveButton();
                    const nameInput = findVeteranInlineNameInput();
                    setGuidedHighlights(flow, [saveBtn || nameInput || document.getElementById('city-action-msg')]);
                    return;
                }
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_BUILD && target.closest('#city-fab-build')) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_ECONOMY);
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_ECONOMY) {
                const economyTarget = target.closest('#city-build-tabs [data-city-build-tab="base"], #city-build-tabs .city-build-tab-base');
                if (economyTarget) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.SELECT_HOUSE);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.SELECT_HOUSE) {
                const card = target.closest('#city-build-cards .city-build-card');
                if (card && isHouseCardElement(card)) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.PLACE_HOUSE);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_DEFENSE) {
                const defenseTarget = target.closest('#city-build-tabs [data-city-build-tab="industry"], #city-build-tabs .city-build-tab-industry');
                if (defenseTarget) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.SELECT_BARRACKS);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.SELECT_BARRACKS) {
                const card = target.closest('#city-build-cards .city-build-card');
                if (card && isBarracksCardElement(card)) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.PLACE_BARRACKS);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_PRODUCTION) {
                const productionBtn = target.closest('#city-context-bar .city-context-actions button:first-child');
                if (productionBtn) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.QUEUE_DRONE);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_QUEST) {
                const missionToggle = target.closest('.city-mission-toggle');
                if (missionToggle) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.CLAIM_QUEST_REWARD);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.CLAIM_QUEST_REWARD) {
                const claimBtn = target.closest(`[data-city-mission-claim="${TUTORIAL_QUEST_ID}"]`);
                if (claimBtn) {
                    setFallbackText(flow.overlay, '보상을 지급 중입니다. 잠시만 기다려주세요.');
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_SHOP) {
                const shopBtn = target.closest('#city-fab-store');
                if (shopBtn) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.BUY_SPECIAL_BOX);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.BUY_SPECIAL_BOX) {
                const shopCard = target.closest('#city-shop-cards [data-city-shop-item-id="box_level2"]');
                if (shopCard) {
                    setFallbackText(flow.overlay, '특수 보급박스를 구매 중입니다.');
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_INVENTORY) {
                const inventoryBtn = target.closest('#city-fab-inventory');
                if (inventoryBtn) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_SUPPLY_TAB);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_SUPPLY_TAB) {
                const supplyTab = target.closest('#city-inventory-tabs [data-city-inventory-tab="supply"]');
                if (supplyTab) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.OPEN_SPECIAL_BOX);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_SPECIAL_BOX) {
                const boxCard = target.closest('#city-inventory-cards [data-city-inventory-box-id="box_level2"]');
                if (boxCard) {
                    setFallbackText(flow.overlay, '특수 보급박스를 개봉 중입니다.');
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_HONOR_MEDAL) {
                const honorCard = target.closest('#city-inventory-cards [data-city-inventory-entry-kind="honor_medal"]');
                if (honorCard) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.SELECT_HONOR_TARGET);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.SELECT_HONOR_TARGET) {
                const targetCard = target.closest('#city-action-msg [data-city-honor-target]');
                const targetId = String(targetCard?.getAttribute('data-city-honor-target') || '').trim();
                if (targetCard && targetId === 'unit:drone_operator') {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.APPLY_HONOR_MEDAL);
                } else if (targetCard) {
                    setFallbackText(flow.overlay, '이번 단계에서는 [드론병]을 선택해야 합니다.');
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.APPLY_HONOR_MEDAL) {
                const applyBtn = target.closest('#city-action-msg [data-city-honor-apply]');
                if (applyBtn) {
                    setFallbackText(flow.overlay, '명예훈장을 지급 중입니다. 잠시만 기다려주세요.');
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.EQUIP_AT_DRONE) {
                const atBtn = target.closest('#city-action-msg [data-city-veteran-item-equip="drone_at_item"]');
                if (atBtn) {
                    setFallbackText(flow.overlay, 'AT드론을 스킬 트리에 적용 중입니다.');
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.NAME_VETERAN) {
                const renameBtn = target.closest(
                    '#city-action-msg [data-city-veteran-inline-save], ' +
                    '#city-action-msg [data-city-veteran-inline-default], ' +
                    '#city-action-msg [data-city-veteran-inline-random]'
                );
                if (renameBtn) {
                    flow.veteranRenameRequestedAt = Date.now();
                    setFallbackText(flow.overlay, '이름을 저장하는 중입니다.');
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.CLOSE_VETERAN_PROFILE) {
                const closeBtn = target.closest('#city-action-close-btn');
                if (closeBtn) {
                    setFallbackText(flow.overlay, '시티 화면으로 복귀 중입니다.');
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.WAIT_BATTLE_BUTTON) {
                const battleBtn = target.closest('#city-fab-battle');
                if (battleBtn) {
                    setFallbackText(flow.overlay, '국지전 로딩 중입니다.');
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.OPEN_FINAL_QUEST) {
                const missionToggle = target.closest('.city-mission-toggle');
                if (missionToggle) {
                    setGuidedStep(flow, GUIDED_BUILD_STEPS.CLAIM_FINAL_QUEST);
                }
                return;
            }
            if (flow.step === GUIDED_BUILD_STEPS.CLAIM_FINAL_QUEST) {
                const claimBtn = target.closest(`[data-city-mission-claim="${TUTORIAL_FINAL_QUEST_ID}"]`);
                if (claimBtn) {
                    setFallbackText(flow.overlay, '완료 보상을 지급 중입니다.');
                }
            }
        };
        document.addEventListener('pointerdown', flow.pointerHandler, true);

        flow.pollTimer = setInterval(() => {
            tickGuidedFlow(flow);
        }, TUTORIAL_FLOW_POLL_MS);
        tickGuidedFlow(flow);
    }

    function playGuidedClipAndStartFlow(game, overlay, guidedBtn, skipBtn) {
        if (!overlay || !activeVideo) {
            markCityIntroSeen(game, false);
            closeOverlay();
            return;
        }

        if (guidedBtn) guidedBtn.disabled = true;
        if (skipBtn) skipBtn.disabled = true;
        setActionsVisible(overlay, false);
        setFallbackText(overlay, '진행 안내 영상을 재생 중입니다.');

        unbindAudioResumeGesture();
        cleanupNarrationAudio();
        activeVideo.onended = () => {
            clearPlaybackTargets();
            startGuidedFlow(game, overlay);
        };
        activeVideo.onerror = () => {
            clearPlaybackTargets();
            setFallbackText(overlay, '영상 로드에 실패했습니다. 진행을 기본값으로 처리합니다.');
            markCityIntroSeen(game, false);
            closeOverlay();
        };

        try {
            activeVideo.pause();
            activeVideo.src = selectPlaybackSource(activeVideo, GUIDED_VIDEO_SRC, GUIDED_VIDEO_FALLBACK_SRC);
            activeVideo.load();
            playVideo(activeVideo, overlay, { withNarration: false });
        } catch (err) {
            console.warn('[CityTutorialIntro] guided clip playback failed:', err);
            markCityIntroSeen(game, false);
            closeOverlay();
        }
    }

    function playSkipClipAndFinish(game, overlay, guidedBtn, skipBtn) {
        if (!overlay || !activeVideo) {
            markCityIntroSeen(game, true);
            closeOverlay();
            return;
        }

        if (guidedBtn) guidedBtn.disabled = true;
        if (skipBtn) skipBtn.disabled = true;
        setActionsVisible(overlay, false);
        setChoicePanelGuidedMode(overlay, false);
        setFallbackText(overlay, '다음 안내 영상을 재생 중입니다.');

        unbindAudioResumeGesture();
        cleanupNarrationAudio();
        activeVideo.onended = () => {
            clearPlaybackTargets();
            markCityIntroSeen(game, true);
            closeOverlay();
        };
        activeVideo.onerror = () => {
            clearPlaybackTargets();
            setFallbackText(overlay, '영상 로드에 실패했습니다. 현재 단계는 건너뜁니다.');
            markCityIntroSeen(game, true);
            closeOverlay();
        };

        try {
            activeVideo.pause();
            activeVideo.src = selectPlaybackSource(activeVideo, SKIP_VIDEO_SRC, SKIP_VIDEO_FALLBACK_SRC);
            activeVideo.load();
            playVideo(activeVideo, overlay, { withNarration: false });
        } catch (err) {
            console.warn('[CityTutorialIntro] skip clip playback failed:', err);
            markCityIntroSeen(game, true);
            closeOverlay();
        }
    }

    function createOverlay(game) {
        const existing = getOverlay();
        if (existing) return existing;

        const cityScreen = document.getElementById('city-screen');
        if (!cityScreen) return null;

        const overlay = document.createElement('aside');
        overlay.id = OVERLAY_ID;
        overlay.className = 'city-tutorial-intro-overlay';

        const character = document.createElement('div');
        character.className = 'city-tutorial-intro-character';

        const video = document.createElement('video');
        video.className = 'city-tutorial-intro-canvas city-tutorial-intro-media';
        video.autoplay = true;
        video.loop = false;
        video.preload = 'auto';
        video.playsInline = true;
        video.setAttribute('playsinline', 'playsinline');
        video.setAttribute('aria-label', '첫 시티 진입 튜토리얼 영상');

        const sourceWebm = document.createElement('source');
        sourceWebm.src = VIDEO_SRC;
        sourceWebm.type = 'video/webm';
        video.appendChild(sourceWebm);

        const sourceMp4 = document.createElement('source');
        sourceMp4.src = VIDEO_FALLBACK_SRC;
        sourceMp4.type = 'video/mp4';
        video.appendChild(sourceMp4);

        const shadow = document.createElement('div');
        shadow.className = 'city-tutorial-intro-shadow';

        character.appendChild(video);
        character.appendChild(shadow);

        const choicePanel = document.createElement('div');
        choicePanel.className = 'city-tutorial-intro-choice-panel';

        const fallback = document.createElement('p');
        fallback.className = 'city-tutorial-intro-fallback hidden';

        const actions = document.createElement('div');
        actions.className = 'city-tutorial-intro-actions is-hidden';

        const guidedBtn = document.createElement('button');
        guidedBtn.type = 'button';
        guidedBtn.className = 'city-tutorial-intro-btn city-tutorial-intro-btn-primary';
        guidedBtn.textContent = '튜토리얼 진행을 들어보겠다';
        guidedBtn.addEventListener('click', () => {
            playGuidedClipAndStartFlow(game, overlay, guidedBtn, skipBtn);
        });

        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'city-tutorial-intro-btn city-tutorial-intro-btn-secondary';
        skipBtn.textContent = '들을 필요 없다';
        skipBtn.addEventListener('click', () => {
            playSkipClipAndFinish(game, overlay, guidedBtn, skipBtn);
        });

        actions.appendChild(guidedBtn);
        actions.appendChild(skipBtn);
        choicePanel.appendChild(fallback);
        choicePanel.appendChild(actions);

        overlay.appendChild(character);
        overlay.appendChild(choicePanel);
        cityScreen.appendChild(overlay);

        activeVideo = video;
        activeVideo.onended = () => {
            clearPlaybackTargets();
            cleanupNarrationAudio();
            setChoicePanelGuidedMode(overlay, false);
            setFallbackText(overlay, '');
            setActionsVisible(overlay, true);
        };
        activeVideo.onerror = () => {
            clearPlaybackTargets();
            cleanupNarrationAudio();
            setChoicePanelGuidedMode(overlay, false);
            setFallbackText(overlay, '영상 로드에 실패했습니다.');
            setActionsVisible(overlay, true);
        };

        duckBgmVolume();
        try { activeVideo.load(); } catch (_) { }
        playVideo(activeVideo, overlay, { withNarration: false });

        return overlay;
    }

    function open(game, options = {}) {
        const forceOpen = options.force === true;
        refreshTutorialBriefingButton(game);
        if (!shouldShow(game, forceOpen)) return false;
        const overlay = createOverlay(game);
        return !!overlay;
    }

    function startOnEnter(game) {
        clearEnterTimer();
        if (!game) return;
        refreshTutorialBriefingButton(game);

        enterTimer = setTimeout(() => {
            enterTimer = null;
            refreshTutorialBriefingButton(game);
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => open(game));
                return;
            }
            open(game);
        }, ENTER_DELAY_MS);
    }

    function onLeave() {
        clearEnterTimer();
        const flow = guidedFlow;
        if (flow && flow.active === true) {
            const tracker = getTutorialSkirmishState(flow.game);
            const step = String(flow.step || '').trim();
            const shouldPreserve =
                (tracker && tracker.active === true)
                || flow.pendingOutroAfterBattle === true
                || step === GUIDED_BUILD_STEPS.WAIT_BATTLE_END
                || step === GUIDED_BUILD_STEPS.PLAY_OUTRO_VIDEO;
            if (shouldPreserve) {
                return;
            }
        }
        closeOverlay();
    }

    function handleBattleLaunch(game) {
        const flow = guidedFlow;
        if (!flow || flow.active !== true) return false;
        if (flow.game !== game) return false;
        if (flow.step !== GUIDED_BUILD_STEPS.WAIT_BATTLE_BUTTON) return false;
        const started = startTutorialSkirmishBattle(flow);
        return started === true;
    }

    function onSkirmishEvent(game, eventType, payload = {}) {
        const flow = guidedFlow;
        if (!flow || flow.active !== true) return;
        if (flow.game !== game) return;
        const tracker = getTutorialSkirmishState(game);
        if (!tracker) return;

        const type = String(eventType || '').trim();
        if (type === 'placed') {
            const infantryPlaced = Math.max(0, Math.floor(Number(payload?.infantryPlaced ?? tracker.infantryPlaced) || 0));
            const veteranPlaced = Math.max(0, Math.floor(Number(payload?.veteranPlaced ?? tracker.veteranPlaced) || 0));
            tracker.infantryPlaced = infantryPlaced;
            tracker.veteranPlaced = veteranPlaced;
            if (flow.step === GUIDED_BUILD_STEPS.DEPLOY_INFANTRY
                && veteranPlaced >= Math.max(1, Math.floor(Number(tracker.veteranRequired) || 1))) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.DEPLOY_VETERAN);
            }
            return;
        }

        if (type === 'battle_started') {
            tracker.battleStarted = true;
            tracker.droneLockCursorBaseline = Math.max(0, Math.floor(Number(flow.game?.droneLockCursor) || 0));
            tracker.operatorChargeBaseline = getPlayerOperatorDroneChargeSum(flow.game);
            if (flow.step === GUIDED_BUILD_STEPS.DEPLOY_VETERAN || flow.step === GUIDED_BUILD_STEPS.START_BATTLE) {
                setGuidedStep(flow, GUIDED_BUILD_STEPS.START_BATTLE);
            }
            return;
        }

        if (type === 'cleanup' && tracker.active === true) {
            tracker.active = false;
            setTutorialSupportUnitsHold(flow.game, false);
        }
    }

    function getProductionCostOverride(game, context = {}) {
        const flow = guidedFlow;
        if (!flow || flow.active !== true) return null;
        if (flow.game !== game) return null;
        const step = String(flow.step || '').trim();
        if (step !== GUIDED_BUILD_STEPS.OPEN_PRODUCTION && step !== GUIDED_BUILD_STEPS.QUEUE_DRONE) {
            return null;
        }
        const tile = String(context.tile || '').trim();
        const unitKey = String(context.unitKey || '').trim();
        if (tile !== 'barracks' || unitKey !== 'drone_operator') return null;
        return 0;
    }

    function getShopCostOverride(game, context = {}) {
        const flow = guidedFlow;
        if (!flow || flow.active !== true) return null;
        if (flow.game !== game) return null;
        const step = String(flow.step || '').trim();
        if (step !== GUIDED_BUILD_STEPS.OPEN_SHOP && step !== GUIDED_BUILD_STEPS.BUY_SPECIAL_BOX) {
            return null;
        }
        const itemId = String(context.itemId || '').trim();
        const rewardType = String(context.rewardType || '').trim();
        if (itemId !== 'box_level2' && rewardType !== 'box_level2') return null;
        return {
            costMoney: 0,
            costGold: 0
        };
    }

    function consumeForcedBoxItemReward(game, context = {}) {
        const flow = guidedFlow;
        if (!flow || flow.active !== true) return '';
        if (flow.game !== game) return '';
        const boxId = String(context.boxId || '').trim();
        if (boxId !== 'box_level2') return '';
        const step = String(flow.step || '').trim();
        if (step !== GUIDED_BUILD_STEPS.OPEN_SPECIAL_BOX && step !== GUIDED_BUILD_STEPS.VERIFY_AT_DRONE) {
            return '';
        }
        if (flow.forceAtRewardPending !== true) return '';
        flow.forceAtRewardPending = false;
        return 'drone_at_item';
    }

    function isBattleUnitSelectionAllowed(game, unit) {
        const flow = guidedFlow;
        if (!flow || flow.active !== true) return true;
        if (flow.game !== game) return true;
        if (!isTutorialBattleSelectionLockActive(flow)) return true;
        const unitId = String(unit?.stats?.id || '').trim();
        return unitId === 'drone_operator';
    }

    function onVeteranNameApplied(game, payload = {}) {
        const flow = guidedFlow;
        if (!flow || flow.active !== true) return false;
        if (flow.game !== game) return false;
        const step = String(flow.step || '').trim();
        if (step !== GUIDED_BUILD_STEPS.NAME_VETERAN && step !== GUIDED_BUILD_STEPS.CLOSE_VETERAN_PROFILE) {
            return false;
        }
        const veteranId = String(payload?.veteranId || '').trim();
        if (!veteranId) return false;
        syncPromotedDroneVeteran(flow);
        if (!flow.promotedVeteranId || flow.promotedVeteranId !== veteranId) return false;
        flow.veteranRenameRequestedAt = 0;
        flow.veteranRenameCompleted = true;
        return true;
    }

    global.CitySimTutorialIntro = {
        open,
        startOnEnter,
        onLeave,
        close: closeOverlay,
        refreshUi: refreshTutorialBriefingButton,
        handleBattleLaunch,
        onSkirmishEvent,
        getProductionCostOverride,
        getShopCostOverride,
        consumeForcedBoxItemReward,
        isBattleUnitSelectionAllowed,
        onVeteranNameApplied
    };
})(window);
