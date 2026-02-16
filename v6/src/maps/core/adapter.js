(function (global) {
    'use strict';

    function mergeDefinitionsIntoMaps(maps, definitions) {
        if (!maps || typeof maps !== 'object') return maps;
        if (!definitions || typeof definitions !== 'object') return maps;

        const types = (definitions.types && typeof definitions.types === 'object')
            ? definitions.types
            : null;
        const rules = (definitions.rules && typeof definitions.rules === 'object')
            ? definitions.rules
            : null;

        if (types) {
            maps.types = { ...(maps.types || {}), ...types };
        }
        if (rules) {
            maps.rules = { ...(maps.rules || {}), ...rules };
        }

        return maps;
    }

    function attachRegistryHelpers(maps) {
        if (!maps || typeof maps !== 'object') return maps;

        if (typeof maps.getMapDefinition !== 'function') {
            maps.getMapDefinition = function getMapDefinition(mapId = this.currentMap) {
                if (!global || !global.MapRegistry || typeof global.MapRegistry.getMapDefinition !== 'function') {
                    return null;
                }
                return global.MapRegistry.getMapDefinition(mapId);
            };
        }

        if (typeof maps.getMapHook !== 'function') {
            maps.getMapHook = function getMapHook(hookName, mapId = this.currentMap) {
                if (!global || !global.MapRegistry || typeof global.MapRegistry.getMapHook !== 'function') {
                    return null;
                }
                return global.MapRegistry.getMapHook(mapId, hookName);
            };
        }

        return maps;
    }

    function applyRegistryToMaps(maps) {
        if (!global || !global.MapRegistry || typeof global.MapRegistry.getDefinitions !== 'function') {
            return attachRegistryHelpers(maps);
        }
        const definitions = global.MapRegistry.getDefinitions();
        mergeDefinitionsIntoMaps(maps, definitions);
        return attachRegistryHelpers(maps);
    }

    global.MapRegistryAdapter = {
        mergeDefinitionsIntoMaps,
        attachRegistryHelpers,
        applyRegistryToMaps
    };
})(typeof window !== 'undefined' ? window : globalThis);
