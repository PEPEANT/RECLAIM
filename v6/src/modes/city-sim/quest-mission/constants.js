(function (global) {
    const QUEST_SCHEMA_VERSION = 1;

    const QUEST_STATUS = {
        IN_PROGRESS: 'in_progress',
        CLAIMABLE: 'claimable',
        CLAIMED: 'claimed'
    };

    const QUEST_STATUS_LABELS = {
        [QUEST_STATUS.IN_PROGRESS]: '진행 중',
        [QUEST_STATUS.CLAIMABLE]: '지급 가능',
        [QUEST_STATUS.CLAIMED]: '지급 완료'
    };

    const QUEST_TYPES = {
        LEGACY_BUILD: 'legacy_build',
        LEGACY_LOGIN: 'legacy_login',
        LEGACY_SKIRMISH_WIN: 'legacy_skirmish_win',
        KILL: 'kill',
        OCCUPATION_WIN: 'occupation_win',
        LEVEL_BONUS: 'level_bonus'
    };

    const QUEST_IDS = {
        BUILD_BARRACKS: 'build_barracks',
        BUILD_FACTORY: 'build_factory',
        BUILD_POWERPLANT: 'build_powerplant',
        BUILD_HOUSE_3: 'build_house_3',
        BUILD_OILRIG: 'build_oilrig',
        BUILD_AIRPORT: 'build_airport',
        PLANT_TREE_5: 'plant_tree_5',
        LOGIN_SUPPLY_BOX: 'login_supply_box',
        SKIRMISH_FIRST_WIN_SUPPLY_BOX: 'skirmish_first_win_supply_box',
        KILL_CONTRACT: 'kill_contract',
        VICTORY_CONTRACT: 'victory_contract',
        LEVEL_BONUS_PRIVATE: 'level_bonus_private',
        LEVEL_BONUS_SERGEANT: 'level_bonus_sergeant',
        LEVEL_BONUS_STAFF_SERGEANT: 'level_bonus_staff_sergeant',
        LEVEL_BONUS_SECOND_LIEUTENANT: 'level_bonus_second_lieutenant',
        LEVEL_BONUS_LIEUTENANT_COLONEL: 'level_bonus_lieutenant_colonel',
        LEVEL_CONTRACT: 'level_contract'
    };

    const LEVEL_BONUS_IDS = [
        QUEST_IDS.LEVEL_BONUS_PRIVATE,
        QUEST_IDS.LEVEL_BONUS_SERGEANT,
        QUEST_IDS.LEVEL_BONUS_STAFF_SERGEANT,
        QUEST_IDS.LEVEL_BONUS_SECOND_LIEUTENANT,
        QUEST_IDS.LEVEL_BONUS_LIEUTENANT_COLONEL
    ];

    const DEPRECATED_QUEST_IDS = [
        QUEST_IDS.LEVEL_CONTRACT
    ];

    const QUEST_ORDER = [
        QUEST_IDS.BUILD_BARRACKS,
        QUEST_IDS.BUILD_FACTORY,
        QUEST_IDS.BUILD_POWERPLANT,
        QUEST_IDS.BUILD_HOUSE_3,
        QUEST_IDS.BUILD_OILRIG,
        QUEST_IDS.BUILD_AIRPORT,
        QUEST_IDS.PLANT_TREE_5,
        QUEST_IDS.LOGIN_SUPPLY_BOX,
        QUEST_IDS.SKIRMISH_FIRST_WIN_SUPPLY_BOX,
        QUEST_IDS.KILL_CONTRACT,
        QUEST_IDS.VICTORY_CONTRACT,
        ...LEVEL_BONUS_IDS
    ];

    global.CityQuestMissionConstants = {
        QUEST_SCHEMA_VERSION,
        QUEST_STATUS,
        QUEST_STATUS_LABELS,
        QUEST_TYPES,
        QUEST_IDS,
        LEVEL_BONUS_IDS,
        DEPRECATED_QUEST_IDS,
        QUEST_ORDER
    };
})(window);
