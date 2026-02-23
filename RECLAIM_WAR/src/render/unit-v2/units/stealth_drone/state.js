// Per-unit runtime render state for: stealth_drone
(function attachUnitRenderV2State_stealth_drone(globalScope) {
    'use strict';

    function getState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        return unit._renderV2State;
    }

    globalScope['UnitRenderV2State_stealth_drone'] = {
        getState: getState
    };
})(typeof window !== 'undefined' ? window : globalThis);
