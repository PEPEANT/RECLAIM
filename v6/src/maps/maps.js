// [FILE] maps.js: ?? ? ?? ??? ?? ? ?? ?? ??.
const Maps = {
    types: {
        skirmish: {
            name: '국지전 (Skirmish)',
            sky: '#87CEEB',
            skyMid: '#b0d4e8',
            ground: '#4ade80',
            groundDark: '#16a34a'
        }
    },

    rules: {
        skirmish: {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false,
            winCondition: 'annihilation',
            survivalTime: 600
        }
    },

    currentMap: 'skirmish_kabul',

    _rand(seed) {
        let h = 2166136261;
        const s = String(seed);
        for (let i = 0; i < s.length; i += 1) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0) / 4294967295;
    },

    getMapDefinition(mapId = this.currentMap) {
        if (typeof window === 'undefined' || !window.MapRegistry || typeof window.MapRegistry.getMapDefinition !== 'function') {
            return null;
        }
        return window.MapRegistry.getMapDefinition(mapId);
    },

    getMapHook(hookName, mapId = this.currentMap) {
        if (typeof window === 'undefined' || !window.MapRegistry || typeof window.MapRegistry.getMapHook !== 'function') {
            return null;
        }
        return window.MapRegistry.getMapHook(mapId, hookName);
    },

    getRule(key) {
        const mapId = String(this.currentMap || 'skirmish_kabul').trim() || 'skirmish_kabul';
        const mapRules = (this.rules && this.rules[mapId]) ? this.rules[mapId] : null;
        if (mapRules && Object.prototype.hasOwnProperty.call(mapRules, key)) {
            return mapRules[key];
        }

        const defaults = {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false,
            winCondition: 'annihilation',
            survivalTime: 600,
            allowWipeWinWhenNoHQ: true
        };
        return defaults[key];
    },

    setMap(mapId) {
        const requested = String(mapId || '').trim();
        if (requested && this.types && this.types[requested]) {
            this.currentMap = requested;
        } else {
            this.currentMap = 'skirmish_kabul';
        }
        return this.currentMap;
    },

    drawBase(ctx, width, height, groundY, cameraX = 0) {
        if (!ctx) return;

        const mapId = String(this.currentMap || 'skirmish_kabul').trim() || 'skirmish_kabul';
        const baseHook = this.getMapHook('renderBase', mapId);
        if (typeof baseHook === 'function') {
            try {
                const handled = baseHook(ctx, { width, height, groundY, cameraX, mapId, maps: this });
                if (handled) return;
            } catch (err) {
                console.error(`[Maps] renderBase hook failed for ${mapId}`, err);
            }
        }

        const theme = (this.types && this.types[mapId]) ? this.types[mapId] : this.types.skirmish;

        ctx.fillStyle = theme.sky || '#87CEEB';
        ctx.fillRect(0, 0, width, Math.max(0, groundY));

        ctx.fillStyle = theme.ground || '#4ade80';
        ctx.fillRect(0, groundY, width, Math.max(0, height - groundY));
    },

    _drawCloudLayer(ctx, width, cameraX) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        const parallax = cameraX * 0.08;
        const span = 260;
        const start = Math.floor((parallax - 320) / span) * span;
        const end = parallax + width + 320;

        for (let wx = start; wx <= end; wx += span) {
            const sx = wx - parallax;
            const seed = this._rand(`cloud:${wx}`);
            const y = 40 + Math.floor(seed * 120);
            const w = 90 + Math.floor(this._rand(`cloud:w:${wx}`) * 70);
            const h = 22 + Math.floor(this._rand(`cloud:h:${wx}`) * 16);
            ctx.beginPath();
            ctx.ellipse(sx, y, w, h, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    drawDecorations(ctx, width, height, groundY, cameraX = 0) {
        if (!ctx) return;

        const mapId = String(this.currentMap || 'skirmish_kabul').trim() || 'skirmish_kabul';
        const decorHook = this.getMapHook('renderDecor', mapId);
        if (typeof decorHook === 'function') {
            try {
                const handled = decorHook(ctx, { width, height, groundY, cameraX, mapId, maps: this });
                if (handled) return;
            } catch (err) {
                console.error(`[Maps] renderDecor hook failed for ${mapId}`, err);
            }
        }

        return;
    },

    drawThreatOverlay(ctx, width, height, groundY, cameraX = 0, threatLevel = 1) {
        return;
    },

    drawBackground(ctx, width, height, groundY, cameraX = 0, options = {}) {
        this.drawBase(ctx, width, height, groundY, cameraX);
        this.drawDecorations(ctx, width, height, groundY, cameraX);
        const threatLevel = Number(options && options.threatLevel) || 1;
        this.drawThreatOverlay(ctx, width, height, groundY, cameraX, threatLevel);
    }
};

if (typeof window !== 'undefined') {
    if (window.MapRegistryAdapter && typeof window.MapRegistryAdapter.applyRegistryToMaps === 'function') {
        window.MapRegistryAdapter.applyRegistryToMaps(Maps);
    } else if (window.MapRegistry && typeof window.MapRegistry.getDefinitions === 'function') {
        const defs = window.MapRegistry.getDefinitions();
        if (defs && defs.types && typeof defs.types === 'object') {
            Maps.types = { ...Maps.types, ...defs.types };
        }
        if (defs && defs.rules && typeof defs.rules === 'object') {
            Maps.rules = { ...Maps.rules, ...defs.rules };
        }
    }

    window.Maps = Maps;
}
