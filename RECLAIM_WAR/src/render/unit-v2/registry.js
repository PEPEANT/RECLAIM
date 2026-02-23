// Unit Render V2 registry (unitId -> renderer).
(function attachUnitRenderV2Registry(globalScope) {
    'use strict';

    var existing = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : {};

    globalScope.UnitRenderV2Registry = existing;
})(typeof window !== 'undefined' ? window : globalThis);
