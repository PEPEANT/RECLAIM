// src/modes/city-sim/construction/veteran-skills.js
// 베테랑 스킬·아이템 로직 모듈
// construction.js 의 CitySimConstructionInternals 에서 deps 를 가져와 re-export 합니다.
// 로드 순서: construction.js 이후
(function attachCityVeteranSkills(global) {
    'use strict';

    function getDeps() {
        return (global.CitySimConstructionInternals && typeof global.CitySimConstructionInternals === 'object')
            ? global.CitySimConstructionInternals
            : {};
    }

    // 단일 함수를 deps 에서 가져오는 헬퍼
    function _fn(name) {
        return function (...args) {
            const deps = getDeps();
            const fn = deps[name];
            if (typeof fn !== 'function') {
                if (typeof console !== 'undefined') {
                    console.warn('[CitySimVeteranSkills] Missing dep:', name);
                }
                return undefined;
            }
            return fn(...args);
        };
    }

    // ─── 아이템 키 정규화 / 정의 조회 ───
    const normalizeVeteranItemKey = _fn('normalizeVeteranItemKey');
    const getVeteranItemDef = _fn('getVeteranItemDef');
    const getVeteranItemStoreKey = _fn('getVeteranItemStoreKey');
    const getVeteranItemStoreCandidates = _fn('getVeteranItemStoreCandidates');
    const getVeteranItemStoreCount = _fn('getVeteranItemStoreCount');
    const getVeteranItemCountFromState = _fn('getVeteranItemCountFromState');
    const resolveVeteranItemDebitStore = _fn('resolveVeteranItemDebitStore');

    // ─── 유닛 카테고리 / 아이템 호환성 ───
    const isInfantryCategoryUnit = _fn('isInfantryCategoryUnit');
    const isItemRestrictedForUnit = _fn('isItemRestrictedForUnit');
    const isVeteranItemCompatible = _fn('isVeteranItemCompatible');

    // ─── 아이템 수량 ───
    const getVeteranItemCount = _fn('getVeteranItemCount');
    const getVeteranItemEntries = _fn('getVeteranItemEntries');

    // ─── 스킬 슬롯 로직 ───
    const getVeteranEditableSkillSlotIndexes = _fn('getVeteranEditableSkillSlotIndexes');
    const isVeteranSkillSlotEditable = _fn('isVeteranSkillSlotEditable');
    const getVeteranSkillCommandKeyByItemKey = _fn('getVeteranSkillCommandKeyByItemKey');
    const isVeteranSkillLoadoutItem = _fn('isVeteranSkillLoadoutItem');

    // ─── 로드아웃 정규화 ───
    const normalizeVeteranLoadoutPassiveItemKey = _fn('normalizeVeteranLoadoutPassiveItemKey');
    const getDefaultVeteranSkillItemKeys = _fn('getDefaultVeteranSkillItemKeys');
    const normalizeVeteranLoadoutSkillItemKeys = _fn('normalizeVeteranLoadoutSkillItemKeys');
    const getPrimaryVeteranLoadoutItemKey = _fn('getPrimaryVeteranLoadoutItemKey');
    const buildVeteranLoadoutFromSkillItemKeys = _fn('buildVeteranLoadoutFromSkillItemKeys');
    const getVeteranLoadoutSkillItemKeys = _fn('getVeteranLoadoutSkillItemKeys');
    const getVeteranLoadoutItemKey = _fn('getVeteranLoadoutItemKey');
    const getVeteranLoadoutItemDef = _fn('getVeteranLoadoutItemDef');

    // ─── 베테랑 엔트리 조회 ───
    const getVeteranEntries = _fn('getVeteranEntries');
    const getVeteranInventoryEntries = _fn('getVeteranInventoryEntries');
    const findVeteranEntryById = _fn('findVeteranEntryById');
    const getVeteranDisplayName = _fn('getVeteranDisplayName');

    // ─── 스킬 슬롯 변경 (state mutation) ───
    const setVeteranSkillSlotItem = _fn('setVeteranSkillSlotItem');
    const swapVeteranSkillSlotItems = _fn('swapVeteranSkillSlotItems');
    const clearVeteranSkillSlotItem = _fn('clearVeteranSkillSlotItem');
    const setVeteranPassiveLoadoutItem = _fn('setVeteranPassiveLoadoutItem');
    const clearVeteranPassiveLoadoutItem = _fn('clearVeteranPassiveLoadoutItem');
    const equipVeteranItem = _fn('equipVeteranItem');

    // ─── UI 렌더링 ───
    const getUnitProfileSkillSlots = _fn('getUnitProfileSkillSlots');
    // setupVeteranSkillDragInteractions 는 내부 클로저 const — 노출 불가

    // ─── Public API ───
    global.CitySimVeteranSkills = {
        // 아이템 키 / 정의
        normalizeVeteranItemKey,
        getVeteranItemDef,
        getVeteranItemStoreKey,
        getVeteranItemStoreCandidates,
        getVeteranItemStoreCount,
        getVeteranItemCountFromState,
        resolveVeteranItemDebitStore,

        // 유닛 카테고리 / 호환성
        isInfantryCategoryUnit,
        isItemRestrictedForUnit,
        isVeteranItemCompatible,

        // 아이템 수량
        getVeteranItemCount,
        getVeteranItemEntries,

        // 스킬 슬롯 로직
        getVeteranEditableSkillSlotIndexes,
        isVeteranSkillSlotEditable,
        getVeteranSkillCommandKeyByItemKey,
        isVeteranSkillLoadoutItem,

        // 로드아웃 정규화
        normalizeVeteranLoadoutPassiveItemKey,
        getDefaultVeteranSkillItemKeys,
        normalizeVeteranLoadoutSkillItemKeys,
        getPrimaryVeteranLoadoutItemKey,
        buildVeteranLoadoutFromSkillItemKeys,
        getVeteranLoadoutSkillItemKeys,
        getVeteranLoadoutItemKey,
        getVeteranLoadoutItemDef,

        // 베테랑 엔트리 조회
        getVeteranEntries,
        getVeteranInventoryEntries,
        findVeteranEntryById,
        getVeteranDisplayName,

        // 스킬 슬롯 변경
        setVeteranSkillSlotItem,
        swapVeteranSkillSlotItems,
        clearVeteranSkillSlotItem,
        setVeteranPassiveLoadoutItem,
        clearVeteranPassiveLoadoutItem,
        equipVeteranItem,

        // UI
        getUnitProfileSkillSlots
        // setupVeteranSkillDragInteractions: 내부 클로저 const, 직접 노출 불가
    };
})(window);
