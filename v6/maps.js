const Maps = {
    types: {
        'plain': { name: '평원 (Plains)', sky: '#87CEEB', ground: '#4ade80', groundDark: '#16a34a' },
        'city': { name: '도시 (City)', sky: '#cbd5e1', skyMid: '#8fb7e0', ground: '#475569', groundDark: '#334155' },
        'mountain': { name: '산악 (Mountain)', sky: '#bae6fd', ground: '#a8a29e', groundDark: '#78716c' },
        'village': { name: '마을 (Village)', sky: '#f0f9ff', ground: '#d97706', groundDark: '#b45309' },
        'forest': { name: '숲 (Forest)', sky: '#4a7c59', skyMid: '#2d5a3d', ground: '#2d5a27', groundDark: '#1a3d15' },
        'fortress': { name: '요새 (Fortress)', sky: '#8b8589', skyMid: '#6b6569', ground: '#5a524e', groundDark: '#3d3533' },
        'desert': { name: '사막 (Desert)', sky: '#f4a460', skyMid: '#daa06d', ground: '#c2b280', groundDark: '#a08c5a' },
        'skirmish': { name: '국지전 (Skirmish)', sky: '#87CEEB', skyMid: '#b0d4e8', ground: '#4ade80', groundDark: '#16a34a' },
        'skirmish_kabul': { name: '카불 시가지 (Kabul)', sky: '#6E8594', skyMid: '#9e9789', ground: '#3b3d3f', groundDark: '#2a2b2d' },
        'skirmish_desert': { name: '사막 도시 (Desert City)', sky: '#40a8c4', skyMid: '#dcedc1', ground: '#e3b768', groundDark: '#c69c55' },
        'landing': { name: '상륙전 (Landing)', sky: '#465e75', skyMid: '#87ceeb', ground: '#3e342e', groundDark: '#2e2722' }
    },

    rules: {
        'city': {
            playerHQ: true,
            enemyHQ: false,
            playerDefense: true,
            enemyDefense: false,
            bunkers: true,
            mapExpand: true,
            winCondition: 'survival',
            survivalTime: 720
        },
        'plain': {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: true,
            mapExpand: true,
            winCondition: 'annihilation'
        },
        'mountain': {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: false,
            mapExpand: true,
            winCondition: 'annihilation'
        },
        'village': {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: true,
            mapExpand: true,
            winCondition: 'hq_destroy'
        },
        'forest': {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: true,
            mapExpand: true,
            winCondition: 'annihilation'
        },
        'fortress': {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: true,
            mapExpand: true,
            winCondition: 'hq_destroy'
        },
        'desert': {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: false,
            mapExpand: true,
            winCondition: 'annihilation'
        },
        'skirmish': {
            playerHQ: false,
            enemyHQ: false,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false,
            winCondition: 'annihilation'
        },
        'skirmish_kabul': {
            playerHQ: false,
            enemyHQ: false,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false,
            winCondition: 'annihilation'
        },
        'skirmish_desert': {
            playerHQ: false,
            enemyHQ: false,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false,
            winCondition: 'annihilation'
        },
        'landing': {
            playerHQ: false,
            enemyHQ: true,
            playerDefense: false,
            enemyDefense: true,
            bunkers: true,
            mapExpand: true,
            winCondition: 'hq_destroy'
        }
    },

    getRule(key) {
        const mapRules = this.rules[this.currentMap];
        if (mapRules && key in mapRules) return mapRules[key];
        const defaults = {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: true,
            mapExpand: false,
            winCondition: 'hq_destroy',
            survivalTime: 600
        };
        return defaults[key];
    },

    currentMap: 'plain',

    // Deterministic hash -> 0..1
    _rand(seed) {
        let h = 0xdeadbeef;
        const s = String(seed);
        for (let i = 0; i < s.length; i++) {
            h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
        }
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },

    _ellipse(ctx, x, y, rx, ry, rotation = 0, start = 0, end = Math.PI * 2) {
        if (!ctx) return;
        if (typeof ctx.ellipse === 'function') {
            ctx.ellipse(x, y, rx, ry, rotation, start, end);
            return;
        }
        const safeRx = Math.max(0.001, Math.abs(Number(rx) || 0.001));
        const safeRy = Math.max(0.001, Math.abs(Number(ry) || 0.001));
        ctx.save();
        ctx.translate(x, y);
        if (rotation) ctx.rotate(rotation);
        ctx.scale(1, safeRy / safeRx);
        ctx.arc(0, 0, safeRx, start, end, false);
        ctx.restore();
    },

    drawBase(ctx, width, height, groundY, cameraX = 0) {
        const mapId = this.currentMap || 'plain';
        const baseHook = (typeof this.getMapHook === 'function')
            ? this.getMapHook('renderBase', mapId)
            : null;
        if (typeof baseHook === 'function') {
            try {
                const handled = baseHook(ctx, { width, height, groundY, cameraX, mapId, maps: this });
                if (handled) return;
            } catch (e) {
                console.error(`[Maps] renderBase hook failed for ${mapId}`, e);
            }
        }

        if (this.currentMap === 'city') {
            this.drawCityDaySky(ctx, width, height, cameraX);
            this.drawCityDayBase(ctx, width, height, groundY, cameraX);
            return;
        }
        if (this.currentMap === 'landing') {
            this.drawLandingSky(ctx, width, height);
            this.drawLandingOcean(ctx, width, height, groundY, cameraX);
            return;
        }
        if (this.currentMap === 'skirmish_kabul') {
            this.drawKabulSky(ctx, width, height);
            this.drawKabulGround(ctx, width, height, groundY);
            return;
        }
        if (this.currentMap === 'skirmish_desert') {
            this.drawSkirmishDesertSky(ctx, width, height, cameraX);
            this.drawSkirmishDesertGround(ctx, width, height, groundY);
            return;
        }
        const theme = this.types[this.currentMap] || this.types['plain'];

        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, theme.sky);
        grad.addColorStop(0.5, theme.skyMid || '#ffffff');
        grad.addColorStop(1, theme.ground);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = theme.ground;
        ctx.fillRect(0, groundY, width, height - groundY);
    },

    drawDecorations(ctx, width, height, groundY, cameraX = 0) {
        const mapId = this.currentMap || 'plain';
        const decorHook = (typeof this.getMapHook === 'function')
            ? this.getMapHook('renderDecor', mapId)
            : null;
        if (typeof decorHook === 'function') {
            try {
                const handled = decorHook(ctx, { width, height, groundY, cameraX, mapId, maps: this });
                if (handled) return;
            } catch (e) {
                console.error(`[Maps] renderDecor hook failed for ${mapId}`, e);
            }
        }

        ctx.save();
        const buffer = 200;

        if (this.currentMap === 'city') {
            this.drawCityDayDecorations(ctx, width, height, groundY, cameraX);
            ctx.restore();
            return;
        }

        if (this.currentMap === 'plain') {
            ctx.translate(-cameraX, 0);
            this.drawTrees(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        } else if (this.currentMap === 'city') {
            const pX = cameraX * 0.5;
            ctx.save();
            ctx.translate(-pX, 0);
            this.drawCitySkyline(ctx, pX - buffer, pX + width + buffer, groundY);
            ctx.restore();
            ctx.save();
            ctx.translate(-cameraX, 0);
            this.drawCityForeground(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
            ctx.restore();
        } else if (this.currentMap === 'mountain') {
            const pX = cameraX * 0.3;
            ctx.translate(-pX, 0);
            this.drawMountains(ctx, pX - buffer, pX + width + buffer, groundY);
        } else if (this.currentMap === 'village') {
            ctx.translate(-cameraX, 0);
            this.drawVillage(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        } else if (this.currentMap === 'forest') {
            const pX = cameraX * 0.3;
            ctx.save();
            ctx.translate(-pX, 0);
            this.drawForestFarTrees(ctx, pX - buffer, pX + width + buffer, groundY);
            ctx.restore();
            ctx.translate(-cameraX, 0);
            this.drawForestTrees(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        } else if (this.currentMap === 'fortress') {
            const pX = cameraX * 0.25;
            ctx.save();
            ctx.translate(-pX, 0);
            this.drawFortressWalls(ctx, pX - buffer, pX + width + buffer, groundY);
            ctx.restore();
            ctx.translate(-cameraX, 0);
            this.drawFortressForeground(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        } else if (this.currentMap === 'desert') {
            const pX = cameraX * 0.2;
            ctx.save();
            ctx.translate(-pX, 0);
            this.drawDesertDunes(ctx, pX - buffer, pX + width + buffer, groundY);
            ctx.restore();
            ctx.translate(-cameraX, 0);
            this.drawDesertForeground(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        } else if (this.currentMap === 'skirmish_kabul') {
            const farX = cameraX * 0.1;
            ctx.save();
            ctx.translate(-farX, 0);
            this.drawKabulMountains(ctx, farX - buffer, farX + width + buffer, groundY);
            ctx.restore();

            const cityX = cameraX * 0.3;
            ctx.save();
            ctx.translate(-cityX, 0);
            this.drawKabulCity(ctx, cityX - buffer, cityX + width + buffer, groundY);
            ctx.restore();

            ctx.save();
            ctx.translate(-cameraX, 0);
            this.drawKabulRoad(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
            this.drawKabulProps(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
            ctx.restore();

            this.drawKabulDust(ctx, width, height, cameraX);
        } else if (this.currentMap === 'skirmish_desert') {
            const cityX = cameraX * 0.22;
            ctx.save();
            ctx.translate(-cityX, 0);
            this.drawSkirmishDesertCity(ctx, cityX - buffer, cityX + width + buffer, groundY);
            ctx.restore();

            const duneX = cameraX * 0.12;
            ctx.save();
            ctx.translate(-duneX, 0);
            this.drawSkirmishDesertDunes(ctx, duneX - buffer, duneX + width + buffer, groundY);
            ctx.restore();

            ctx.save();
            ctx.translate(-cameraX, 0);
            this.drawSkirmishDesertProps(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
            ctx.restore();

            this.drawSkirmishDesertDust(ctx, width, height, cameraX);
        } else if (this.currentMap === 'landing') {
            // Landing map: far smoke layer (slow parallax)
            const pX = cameraX * 0.15;
            ctx.save();
            ctx.translate(-pX, 0);
            this.drawLandingSmokeClouds(ctx, pX - buffer, pX + width + buffer, groundY);
            ctx.restore();
            // Landing map: mid ruin silhouette (medium parallax)
            const pX2 = cameraX * 0.25;
            ctx.save();
            ctx.translate(-pX2, 0);
            this.drawLandingRuins(ctx, pX2 - buffer, pX2 + width + buffer, groundY);
            ctx.restore();
            // Landing map: beach foreground layer
            ctx.translate(-cameraX, 0);
            this.drawLandingBeach(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        }

        ctx.restore();
    },

    // ==========================
    // City Day Background (new)
    // ==========================
    drawCityDaySky(ctx, width, height, cameraX) {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#2563eb');
        grad.addColorStop(1, '#bfdbfe');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#fef08a';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(width - 150, 100, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        this.drawCityDayClouds(ctx, width, (cameraX || 0) * 0.1);
    },

    drawCityDayClouds(ctx, width, offset) {
        const clouds = [
            { x: 200, y: 150, s: 1.2 },
            { x: 600, y: 100, s: 0.8 },
            { x: 1000, y: 180, s: 1.5 },
            { x: 1500, y: 120, s: 1.0 }
        ];

        const wrap = width + 400;
        for (const cloud of clouds) {
            let x = (cloud.x - offset);
            x = ((x % wrap) + wrap) - 200;
            const y = cloud.y;
            const s = cloud.s;

            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.drawCityDayCloudShape(ctx, x, y + 5, s);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            this.drawCityDayCloudShape(ctx, x, y, s);
            ctx.restore();
        }
    },

    drawCityDayCloudShape(ctx, x, y, s) {
        ctx.beginPath();
        ctx.arc(x, y, 30 * s, 0, Math.PI * 2);
        ctx.arc(x + 25 * s, y - 15 * s, 35 * s, 0, Math.PI * 2);
        ctx.arc(x + 50 * s, y - 5 * s, 32 * s, 0, Math.PI * 2);
        ctx.arc(x + 75 * s, y, 28 * s, 0, Math.PI * 2);
        ctx.arc(x + 35 * s, y + 10 * s, 30 * s, 0, Math.PI * 2);
        ctx.fill();
    },

    drawCityDayBase(ctx, width, height, groundY, cameraX) {
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(0, groundY, width, height - groundY);

        const roadOffset = -((cameraX || 0) % 100);
        const startX = roadOffset - 100;
        const endX = width + 100;

        ctx.fillStyle = '#d69e2e';
        for (let x = startX; x < endX; x += 100) {
            ctx.fillRect(x, groundY + 40, 50, 4);
        }

        ctx.fillStyle = '#718096';
        ctx.fillRect(0, groundY, width, 10);

        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x < endX; x += 40) {
            ctx.moveTo(x, groundY);
            ctx.lineTo(x, groundY + 10);
        }
        ctx.stroke();
    },

    drawCityDayDecorations(ctx, width, height, groundY, cameraX = 0) {
        const buffer = 300;

        const farSpeed = 0.2;
        const farX = cameraX * farSpeed;
        ctx.save();
        ctx.translate(-farX, 0);
        this.drawCityDayFarSkyline(ctx, farX - buffer, farX + width + buffer, groundY);
        ctx.restore();

        const midSpeed = 0.5;
        const midX = cameraX * midSpeed;
        ctx.save();
        ctx.translate(-midX, 0);
        this.drawCityDaySkyline(ctx, midX - buffer, midX + width + buffer, groundY);
        ctx.restore();

        ctx.save();
        ctx.translate(-cameraX, 0);
        this.drawCityDayForeground(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        ctx.restore();
    },

    drawCityDayFarSkyline(ctx, startX, endX, groundY) {
        const interval = 40;
        const start = Math.floor(startX / interval) * interval;

        for (let x = start; x < endX; x += interval) {
            const r = this._rand(x);
            const w = 40 + r * 60;
            const h = 70 + this._rand(x + 1) * 90;
            const g = 85 + Math.floor(r * 25);
            ctx.fillStyle = `rgb(${g}, ${g}, ${g})`;
            ctx.fillRect(x, groundY - h, w, h);
        }
    },

    drawCityDaySkyline(ctx, startX, endX, groundY) {
        const interval = 60;
        const start = Math.floor(startX / interval) * interval;

        const worldW = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth))
            ? CONFIG.mapWidth
            : Math.max(2000, endX - startX);
        const decoX2 = worldW * 0.6;
        const isReserved = (x) => Math.abs(x - decoX2) < 150;

        for (let i = start; i < endX; i += interval) {
            if (isReserved(i + 30)) continue;

            const seed = Math.floor(i);
            const r = this._rand(seed);
            const w = 50 + r * 40;
            const h = 90 + this._rand(seed + 1) * 200;
            const x = i;
            const y = groundY - h;

            const typeRandom = this._rand(seed + 10);
            let buildingColor;
            let roofColor;

            if (typeRandom > 0.8) {
                const tint = Math.floor(this._rand(seed) * 25);
                const g = 170 + tint;
                buildingColor = `rgb(${g}, ${g}, ${g})`;
                roofColor = `rgb(${g - 30}, ${g - 30}, ${g - 30})`;
            } else if (typeRandom > 0.6) {
                const tint = Math.floor(this._rand(seed) * 30);
                const g = 135 + tint;
                buildingColor = `rgb(${g}, ${g}, ${g})`;
                roofColor = `rgb(${g - 25}, ${g - 25}, ${g - 25})`;
            } else {
                const tint = Math.floor(r * 35);
                const g = 110 + tint;
                buildingColor = `rgb(${g}, ${g}, ${g})`;
                roofColor = `rgb(${g - 20}, ${g - 20}, ${g - 20})`;
            }

            ctx.fillStyle = buildingColor;
            ctx.fillRect(x, y, w, h);

            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(x + w - 5, y, 5, h);

            this.drawCityDayRooftop(ctx, x, y, w, r, roofColor);

            const winStyle = Math.floor(this._rand(seed + 5) * 3);
            this.drawCityDayWindows(ctx, x, y, w, h, seed, winStyle);
        }
    },

    drawCityDayRooftop(ctx, x, y, w, r, color) {
        ctx.fillStyle = color || '#4a5568';
        if (r < 0.3) {
            ctx.fillRect(x + w / 2 - 1, y - 20, 2, 20);
        } else if (r < 0.6) {
            ctx.fillRect(x + 5, y - 15, w - 10, 15);
        } else {
            ctx.fillRect(x, y - 5, w, 5);
        }
    },

    drawCityDayWindows(ctx, bx, by, bw, bh, seed, style) {
        let winW = 6;
        let winH = 8;
        let gapX = 10;
        let gapY = 15;

        if (style === 1) {
            winW = 15; winH = 6; gapX = 20;
        } else if (style === 2) {
            winW = 5; winH = 15; gapY = 22;
        }

        const cols = Math.floor(bw / gapX);
        const rows = Math.floor(bh / gapY);
        if (cols <= 0 || rows <= 0) return;

        const drawPadX = (bw - (cols * gapX - (gapX - winW))) / 2;
        const winBase = 165 + Math.floor(this._rand(seed) * 25);
        const winColor = `rgba(${winBase}, ${winBase + 6}, ${winBase + 10}, 0.55)`;

        for (let r = 0; r < rows; r++) {
            if (r > rows - 2) continue;
            for (let c = 0; c < cols; c++) {
                if (this._rand(seed + r * 1000 + c) > 0.75) {
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                } else {
                    ctx.fillStyle = winColor;
                }

                const wx = bx + drawPadX + c * gapX;
                const wy = by + 10 + r * gapY;
                if (wx + winW <= bx + bw) {
                    ctx.fillRect(wx, wy, winW, winH);
                }
            }
        }
    },

    drawCityDayForeground(ctx, startX, endX, groundY) {
        const worldW = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth))
            ? CONFIG.mapWidth
            : Math.max(2000, endX - startX);
        const decoX2 = worldW * 0.6;
        const inRange = (x, margin) => x > startX - margin && x < endX + margin;

        if (inRange(decoX2, 300)) this.drawCityDayDetailedProps(ctx, decoX2, groundY, 0.55);
    },

    drawCityDayDetailedProps(ctx, x, groundY, s) {
        const poleH = 120 * s;
        ctx.save();

        ctx.fillStyle = '#2d3748';
        ctx.fillRect(x - 3 * s, groundY - poleH, 6 * s, poleH);
        ctx.fillRect(x - 5 * s, groundY - poleH, 50 * s, 4 * s);

        ctx.fillStyle = '#1a202c';
        ctx.beginPath();
        ctx.arc(x + 40 * s, groundY - poleH + 2 * s, 8 * s, 0, Math.PI, true);
        ctx.fill();

        ctx.fillStyle = '#a0aec0';
        ctx.beginPath();
        ctx.arc(x + 40 * s, groundY - poleH + 5 * s, 4 * s, 0, Math.PI * 2);
        ctx.fill();

        const bx = x + 60 * s;
        ctx.fillStyle = '#744210';
        ctx.fillRect(bx - 20 * s, groundY - 15 * s, 40 * s, 5 * s);
        ctx.fillStyle = '#171923';
        ctx.fillRect(bx - 15 * s, groundY - 15 * s, 4 * s, 15 * s);
        ctx.fillRect(bx + 11 * s, groundY - 15 * s, 4 * s, 15 * s);

        const tx = x - 30 * s;
        ctx.fillStyle = '#276749';
        ctx.fillRect(tx - 10 * s, groundY - 25 * s, 20 * s, 25 * s);
        ctx.fillStyle = '#22543d';
        ctx.beginPath();
        ctx.arc(tx, groundY - 25 * s, 11 * s, 0, Math.PI, true);
        ctx.fill();

        ctx.restore();
    },

    drawBackground(ctx, width, height, groundY, cameraX = 0, options = {}) {
        this.drawBase(ctx, width, height, groundY, cameraX);
        this.drawDecorations(ctx, width, height, groundY, cameraX);
        const threatLevel = Number(options?.threatLevel) || 1;
        this.drawThreatOverlay(ctx, width, height, groundY, cameraX, threatLevel);
    },

    drawThreatOverlay(ctx, width, height, groundY, cameraX = 0, threatLevel = 1) {
        const level = Math.max(1, Math.min(10, Math.floor(Number(threatLevel) || 1)));
        const intensity = Math.max(0, Math.min(1, (level - 1) / 6));
        if (intensity <= 0) return;

        const mapId = this.currentMap || 'plain';
        let topColor = '20, 39, 62';
        let midColor = '48, 26, 44';
        let bottomColor = '92, 17, 17';

        if (mapId === 'city') {
            topColor = '18, 36, 58';
            midColor = '35, 34, 64';
            bottomColor = '96, 26, 26';
        } else if (mapId === 'mountain') {
            topColor = '27, 39, 56';
            midColor = '46, 42, 63';
            bottomColor = '90, 31, 31';
        } else if (mapId === 'village') {
            topColor = '40, 35, 47';
            midColor = '63, 34, 44';
            bottomColor = '103, 35, 19';
        } else if (mapId === 'forest') {
            topColor = '10, 30, 15';
            midColor = '25, 40, 20';
            bottomColor = '60, 25, 15';
        } else if (mapId === 'fortress') {
            topColor = '25, 25, 30';
            midColor = '40, 35, 40';
            bottomColor = '80, 30, 25';
        } else if (mapId === 'desert' || mapId === 'skirmish_desert') {
            topColor = '50, 35, 15';
            midColor = '70, 45, 20';
            bottomColor = '100, 40, 15';
        } else if (mapId === 'skirmish_kabul') {
            topColor = '34, 45, 56';
            midColor = '55, 45, 40';
            bottomColor = '95, 38, 30';
        }

        ctx.save();
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `rgba(${topColor}, ${(0.06 + intensity * 0.22).toFixed(3)})`);
        gradient.addColorStop(0.62, `rgba(${midColor}, ${(0.08 + intensity * 0.22).toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${bottomColor}, ${(0.1 + intensity * 0.3).toFixed(3)})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        const hazeAlpha = (0.035 + intensity * 0.09).toFixed(3);
        ctx.fillStyle = `rgba(241, 245, 249, ${hazeAlpha})`;
        ctx.fillRect(0, groundY * 0.32, width, Math.max(20, groundY * 0.12));
        ctx.restore();
    },

    drawTrees(ctx, startX, endX, groundY) {
        const interval = 80;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const seed = Math.abs(Math.sin(i * 12.34));
            const seed2 = Math.abs(Math.cos(i * 56.78));

            const scaleX = 0.7 + (seed * 0.6);
            const scaleY = 0.6 + (seed2 * 1.2);

            ctx.save();
            ctx.translate(i, groundY);
            ctx.scale(scaleX, scaleY);

            ctx.fillStyle = seed > 0.5 ? '#15803d' : '#166534';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(20, -60);
            ctx.lineTo(40, 0);
            ctx.fill();

            ctx.fillStyle = '#3f6212';
            ctx.fillRect(15, -10, 10, 10);
            ctx.restore();
        }
    },

    // ==========================
    // Kabul Skirmish Background
    // ==========================
    drawKabulSky(ctx, width, height) {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#6E8594');
        grad.addColorStop(1, '#C2B8A3');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    },

    drawKabulGround(ctx, width, height, groundY) {
        const sidewalkH = 20;
        ctx.fillStyle = '#7A756E';
        ctx.fillRect(0, groundY, width, sidewalkH);
        ctx.fillStyle = '#3A3C3E';
        ctx.fillRect(0, groundY + sidewalkH, width, height - groundY - sidewalkH);
    },

    drawKabulMountains(ctx, startX, endX, groundY) {
        const interval = 1800;
        const start = Math.floor(startX / interval) * interval;
        const yBase = groundY - 30;

        ctx.fillStyle = '#5B6266';
        for (let i = start; i < endX + interval; i += interval) {
            ctx.beginPath();
            ctx.moveTo(i - 200, groundY + 140);
            ctx.lineTo(i + 180, yBase - 200);
            ctx.lineTo(i + 420, yBase - 90);
            ctx.lineTo(i + 700, yBase - 260);
            ctx.lineTo(i + 980, yBase - 70);
            ctx.lineTo(i + 1300, yBase - 220);
            ctx.lineTo(i + 1680, yBase - 40);
            ctx.lineTo(i + 2000, groundY + 140);
            ctx.closePath();
            ctx.fill();
        }
    },

    drawKabulCity(ctx, startX, endX, groundY) {
        const interval = 110;
        const start = Math.floor(startX / interval) * interval;
        const palette = ['#A19C93', '#C4BDB1', '#8A8275', '#9b9487'];

        for (let i = start; i < endX; i += interval) {
            const r = this._rand(i * 0.171 + 91.3);
            const h = 130 + Math.floor(r * 320);
            const w = 78 + Math.floor(this._rand(i * 0.297 + 17.9) * 130);
            const x = i + Math.floor(this._rand(i * 0.067 + 55.1) * 22) - 8;
            const y = groundY;
            const color = palette[Math.floor(this._rand(i * 0.049 + 2.1) * palette.length) % palette.length];

            if (x + w < startX - 80 || x > endX + 80) continue;

            ctx.fillStyle = color;
            ctx.fillRect(x, y - h, w, h);
            ctx.strokeStyle = '#55514a';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y - h, w, h);

            const type = Math.floor(this._rand(i * 0.173 + 7.2) * 4) % 4;
            if (type === 0) {
                for (let wy = 18; wy < h - 12; wy += 22) {
                    for (let wx = 10; wx < w - 12; wx += 18) {
                        const on = this._rand((i + wx) * (wy + 13) * 0.0019) > 0.92;
                        ctx.fillStyle = on ? '#d8cf9b' : '#2C2A28';
                        ctx.fillRect(x + wx, y - h + wy, 9, 13);
                    }
                }
            } else if (type === 1) {
                for (let wy = 24; wy < h - 12; wy += 36) {
                    ctx.fillStyle = '#5C7A8C';
                    ctx.fillRect(x + 8, y - h + wy, w - 16, 18);
                    ctx.fillStyle = '#3f4d56';
                    for (let wx = 20; wx < w - 12; wx += 30) {
                        ctx.fillRect(x + wx, y - h + wy, 2, 18);
                    }
                }
            } else if (type === 2) {
                for (let wy = 40; wy < h - 15; wy += 48) {
                    for (let wx = 12; wx < w - 30; wx += 36) {
                        ctx.fillStyle = '#2f2d2a';
                        ctx.fillRect(x + wx, y - h + wy, 23, 25);
                        ctx.fillStyle = '#85817a';
                        ctx.fillRect(x + wx, y - h + wy + 16, 23, 7);
                    }
                }
            } else {
                ctx.fillStyle = '#4A6B5D';
                ctx.fillRect(x - 4, y - h + 18, w + 8, 46);
                for (let wy = 85; wy < h - 10; wy += 34) {
                    ctx.fillStyle = '#2C2A28';
                    ctx.fillRect(x + 12, y - h + wy, Math.max(10, w - 24), 20);
                }
            }

            if (h > 170 && this._rand(i * 0.271 + 14.4) > 0.45) {
                ctx.fillStyle = '#73706a';
                ctx.fillRect(x + 12, y - h - 16, 26, 16);
            }
            if (h > 190 && this._rand(i * 0.291 + 31.7) > 0.58) {
                ctx.strokeStyle = '#5d5a54';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + w - 22, y - h);
                ctx.lineTo(x + w - 22, y - h - 46);
                ctx.stroke();
            }
        }
    },

    drawKabulRoad(ctx, startX, endX, groundY) {
        const sidewalkH = 20;
        const roadTop = groundY + sidewalkH;
        const roadBottom = groundY + 170;

        ctx.fillStyle = '#7A756E';
        ctx.fillRect(startX, groundY, endX - startX, sidewalkH);

        ctx.strokeStyle = '#64605a';
        ctx.lineWidth = 2;
        const blockW = 50;
        const start = Math.floor(startX / blockW) * blockW;
        for (let x = start; x < endX; x += blockW) {
            ctx.beginPath();
            ctx.moveTo(x, groundY);
            ctx.lineTo(x, roadTop);
            ctx.stroke();
        }

        ctx.fillStyle = '#3A3C3E';
        ctx.fillRect(startX, roadTop, endX - startX, roadBottom - roadTop);

        const dashW = 58;
        const gapW = 36;
        const y = roadTop + (roadBottom - roadTop) * 0.52;
        const lineStart = Math.floor((startX - 200) / (dashW + gapW)) * (dashW + gapW);
        ctx.fillStyle = '#E0C56E';
        for (let x = lineStart; x < endX + 120; x += (dashW + gapW)) {
            ctx.fillRect(x, y - 3, dashW, 6);
        }
    },

    drawKabulProps(ctx, startX, endX, groundY) {
        const interval = 620;
        const start = Math.floor(startX / interval) * interval;
        const poleBaseY = groundY + 10;

        for (let x = start; x < endX + interval; x += interval) {
            const poleX = x + 120;
            const topY = poleBaseY - 195;
            const lampY = topY - 8;
            const nextX = poleX + interval;

            ctx.strokeStyle = '#4A4A4A';
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(poleX, poleBaseY);
            ctx.lineTo(poleX, topY);
            ctx.stroke();

            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(poleX, topY + 18);
            ctx.quadraticCurveTo(poleX - 44, topY - 16, poleX - 76, lampY + 2);
            ctx.stroke();

            ctx.fillStyle = '#EFE8D0';
            ctx.beginPath();
            ctx.arc(poleX - 76, lampY + 2, 4.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#343434';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(poleX, topY + 8);
            ctx.quadraticCurveTo((poleX + nextX) * 0.5, topY + 74, nextX, topY + 8);
            ctx.moveTo(poleX, topY + 34);
            ctx.quadraticCurveTo((poleX + nextX) * 0.5, topY + 106, nextX, topY + 34);
            ctx.stroke();
        }
    },

    drawKabulDust(ctx, width, height, cameraX = 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(180, 170, 150, 0.25)';
        const count = 34;
        for (let i = 0; i < count; i++) {
            const baseX = ((i * 181) + (cameraX * 0.42)) % (width + 280);
            const x = (baseX < 0 ? baseX + width + 280 : baseX) - 140;
            const y = 50 + ((i * 67) % Math.max(120, height - 100));
            const r = 1 + ((i * 19) % 3);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    // ==========================
    // Desert City Skirmish (Stage 2)
    // ==========================
    drawSkirmishDesertSky(ctx, width, height, cameraX = 0) {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#40a8c4');
        grad.addColorStop(1, '#dcedc1');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.fillStyle = 'rgba(255, 236, 170, 0.85)';
        ctx.shadowColor = 'rgba(255, 220, 130, 0.65)';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(width - 160, 110, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const clouds = [
            { x: 220, y: 95, s: 1.0 },
            { x: 620, y: 75, s: 0.86 },
            { x: 1020, y: 118, s: 1.18 },
            { x: 1480, y: 88, s: 0.98 }
        ];
        const wrap = width + 520;
        for (let i = 0; i < clouds.length; i++) {
            const c = clouds[i];
            let x = c.x - cameraX * 0.12;
            x = ((x % wrap) + wrap) % wrap - 260;
            const y = c.y;
            const s = c.s;

            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.arc(x, y, 24 * s, 0, Math.PI * 2);
            ctx.arc(x + 22 * s, y - 8 * s, 28 * s, 0, Math.PI * 2);
            ctx.arc(x + 48 * s, y, 24 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    },

    drawSkirmishDesertGround(ctx, width, height, groundY) {
        const visualGroundY = groundY - 18;
        ctx.fillStyle = '#c69c55';
        ctx.fillRect(0, visualGroundY, width, height - visualGroundY);
        ctx.fillStyle = '#e3b768';
        ctx.fillRect(0, visualGroundY + 14, width, height - visualGroundY - 14);
    },

    drawSkirmishDesertCity(ctx, startX, endX, groundY) {
        const visualGroundY = groundY - 18;
        const interval = 120;
        const start = Math.floor(startX / interval) * interval;
        const yBase = visualGroundY - 65;
        const palette = ['#a67c52', '#8c6b3f', '#b18a63', '#9c7750'];

        // City canal layer: fills the gap under buildings with sea-like water.
        const waterTop = yBase + 2;
        const waterBottom = visualGroundY + 8;
        const waterWidth = endX - startX + 460;
        const waterX = startX - 230;

        const waterGrad = ctx.createLinearGradient(0, waterTop, 0, waterBottom);
        waterGrad.addColorStop(0, '#5ab2c9');
        waterGrad.addColorStop(0.5, '#2f8fab');
        waterGrad.addColorStop(1, '#1f607a');
        ctx.fillStyle = waterGrad;
        ctx.fillRect(waterX, waterTop, waterWidth, waterBottom - waterTop);

        // Sand embankment and wet edge reflection.
        ctx.fillStyle = '#d8b06f';
        ctx.fillRect(waterX, waterTop - 4, waterWidth, 4);
        ctx.fillStyle = 'rgba(255, 246, 224, 0.24)';
        ctx.fillRect(waterX, waterTop, waterWidth, 1.5);

        // Wave bands.
        ctx.lineWidth = 1.2;
        for (let y = waterTop + 4; y < waterBottom - 3; y += 7) {
            const alpha = (0.12 + ((y - waterTop) / Math.max(1, (waterBottom - waterTop))) * 0.08).toFixed(3);
            ctx.strokeStyle = `rgba(194, 234, 244, ${alpha})`;
            ctx.beginPath();
            let x = waterX;
            ctx.moveTo(x, y);
            while (x < waterX + waterWidth + 30) {
                ctx.quadraticCurveTo(x + 20, y - 2, x + 40, y);
                x += 40;
            }
            ctx.stroke();
        }

        // Sun-glint particles.
        for (let i = 0; i < 90; i++) {
            const rx = waterX + (((i * 197) % 1000) / 1000) * waterWidth;
            const ry = waterTop + (((i * 151) % 1000) / 1000) * Math.max(4, (waterBottom - waterTop - 2));
            const r = 0.5 + ((i * 73) % 10) / 10;
            ctx.fillStyle = (i % 3 === 0) ? 'rgba(242, 250, 255, 0.22)' : 'rgba(203, 235, 246, 0.13)';
            ctx.beginPath();
            this._ellipse(ctx, rx, ry, r * 2.2, r, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = start; i < endX + interval; i += interval) {
            const r = this._rand(i * 0.111 + 21);
            const w = 62 + Math.floor(this._rand(i * 0.073 + 12) * 92);
            const h = 80 + Math.floor(this._rand(i * 0.149 + 37) * 170);
            const x = i + Math.floor((this._rand(i * 0.037 + 8) - 0.5) * 18);
            const y = yBase;
            const color = palette[Math.floor(r * palette.length) % palette.length];

            if (x + w < startX - 100 || x > endX + 100) continue;

            ctx.fillStyle = color;
            ctx.fillRect(x, y - h, w, h);

            // Simple Islamic skyline cues: dome, minaret, or flat roof.
            const type = this._rand(i * 0.319 + 4);
            if (type < 0.25) {
                ctx.beginPath();
                ctx.arc(x + w * 0.5, y - h, Math.max(10, w * 0.28), Math.PI, 0);
                ctx.fill();
            } else if (type < 0.4) {
                const mw = Math.max(10, Math.floor(w * 0.2));
                const mh = h + 55;
                const mx = x + Math.floor((w - mw) * 0.5);
                ctx.fillRect(mx, y - mh, mw, mh);
                ctx.beginPath();
                ctx.moveTo(mx, y - mh);
                ctx.lineTo(mx + mw * 0.5, y - mh - 18);
                ctx.lineTo(mx + mw, y - mh);
                ctx.fill();
            } else {
                ctx.fillRect(x + 4, y - h - 6, Math.max(6, w - 8), 6);
            }

            // Small window slits.
            ctx.fillStyle = 'rgba(70, 57, 38, 0.65)';
            for (let wx = x + 10; wx < x + w - 10; wx += 18) {
                const wy = y - h + 16 + ((wx + i) % 4) * 14;
                ctx.fillRect(wx, wy, 6, 10);
            }
        }
    },

    drawSkirmishDesertDunes(ctx, startX, endX, groundY) {
        const visualGroundY = groundY - 18;
        const baseY = visualGroundY + 18;
        ctx.fillStyle = '#c69c55';
        ctx.beginPath();
        ctx.moveTo(startX - 200, visualGroundY + 140);
        ctx.lineTo(startX - 200, baseY);

        let x = startX - 200;
        while (x < endX + 260) {
            const seed = this._rand(Math.floor(x / 180) * 180 + 404);
            const duneW = 170 + seed * 120;
            const duneH = 24 + seed * 38;
            const peak = x + duneW * 0.5;
            ctx.quadraticCurveTo(peak, baseY - duneH, x + duneW, baseY);
            x += duneW;
        }
        ctx.lineTo(endX + 260, visualGroundY + 140);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#e3b768';
        ctx.fillRect(startX - 220, visualGroundY + 46, endX - startX + 440, 120);
    },

    drawSkirmishDesertProps(ctx, startX, endX, groundY) {
        const visualGroundY = groundY - 18;
        const interval = 340;
        const start = Math.floor(startX / interval) * interval;
        for (let i = start; i < endX + interval; i += interval) {
            const seed = this._rand(i * 0.091 + 11);
            const x = i + 80 + seed * 140;
            const scale = 0.72 + seed * 0.48;
            this.drawSkirmishPalmTree(ctx, x, visualGroundY + 8, scale, -0.18 + seed * 0.3);

            if (seed > 0.25) {
                const rx = x - 54 + seed * 92;
                ctx.fillStyle = '#795548';
                ctx.beginPath();
                ctx.moveTo(rx - 14, visualGroundY + 6);
                ctx.lineTo(rx - 6, visualGroundY - 10);
                ctx.lineTo(rx + 8, visualGroundY - 12);
                ctx.lineTo(rx + 18, visualGroundY - 5);
                ctx.lineTo(rx + 20, visualGroundY + 6);
                ctx.closePath();
                ctx.fill();
            }
        }
    },

    drawSkirmishPalmTree(ctx, x, y, scale = 1, tilt = 0) {
        const s = Math.max(0.45, Number(scale) || 1);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);

        ctx.fillStyle = '#5d4037';
        ctx.beginPath();
        ctx.moveTo(-5 * s, 0);
        ctx.quadraticCurveTo(-10 * s, -42 * s, -18 * s, -92 * s);
        ctx.lineTo(-8 * s, -92 * s);
        ctx.quadraticCurveTo(2 * s, -42 * s, 5 * s, 0);
        ctx.closePath();
        ctx.fill();

        ctx.translate(-12 * s, -92 * s);
        ctx.fillStyle = '#689f38';
        const angles = [-24, 18, 56, 100, 145, 198];
        for (let i = 0; i < angles.length; i++) {
            ctx.save();
            ctx.rotate((angles[i] * Math.PI) / 180);
            ctx.beginPath();
            this._ellipse(ctx, 30 * s, 0, 28 * s, 5 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    },

    drawSkirmishDesertDust(ctx, width, height, cameraX = 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(230, 200, 180, 0.38)';
        const count = 40;
        const span = width + 260;
        const minY = Math.max(40, height * 0.45);
        const maxY = Math.max(minY + 1, height - 16);

        for (let i = 0; i < count; i++) {
            const base = ((i * 167) + (cameraX * 0.62)) % span;
            const x = (base < 0 ? base + span : base) - 130;
            const y = minY + ((i * 59) % Math.floor(maxY - minY));
            const w = 1 + ((i * 13) % 3);
            const h = 1 + ((i * 17) % 2);
            ctx.fillRect(x, y, w * 2, h);
        }
        ctx.restore();
    },

    drawCitySkyline(ctx, startX, endX, groundY) {
        const interval = 80;
        const start = Math.floor(startX / interval) * interval;

        const worldW = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth))
            ? CONFIG.mapWidth
            : Math.max(2000, endX - startX);

        const centerX = worldW * 0.5;
        const secondX = worldW * 0.7;
        const decoX1 = worldW * 0.4;
        const decoX2 = worldW * 0.6;

        const reserved = [
            { x: centerX, w: 140 },
            { x: secondX, w: 120 },
            { x: decoX1, w: 140 },
            { x: decoX2, w: 80 }
        ];

        const isReserved = (x) => reserved.some(r => Math.abs(x - r.x) < r.w * 0.6);

        ctx.fillStyle = '#64748b';
        for (let i = start; i < endX; i += interval) {
            const fixedH = ((i * 123) % 150) + 50;
            const center = i + 30;
            if (isReserved(center)) continue;
            ctx.fillRect(i, groundY - fixedH, 60, fixedH);

            ctx.fillStyle = '#fef08a';
            for (let j = 0; j < 3; j++) {
                if ((i * j * 7) % 2 === 0) ctx.fillRect(i + 10, groundY - fixedH + 10 + j * 15, 10, 10);
            }
            ctx.fillStyle = '#64748b';
        }

    },

    drawCityForeground(ctx, startX, endX, groundY) {
        const worldW = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth))
            ? CONFIG.mapWidth
            : Math.max(2000, endX - startX);

        const decoX1 = worldW * 0.4;
        const decoX2 = worldW * 0.6;
        const inRange = (x, margin) => x > startX - margin && x < endX + margin;

        if (inRange(decoX1, 200)) this.drawShopBuilding(ctx, decoX1, groundY, 0.95);
        if (inRange(decoX2, 200)) this.drawStreetProps(ctx, decoX2, groundY, 0.95);
    },

    drawLuxuryApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const w = 100 * s;
        const h = 150 * s;
        const left = x - w / 2;
        const top = groundY - h;
        const px = (v) => left + v * s;
        const py = (v) => top + v * s;

        ctx.save();
        ctx.fillStyle = '#718096';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);

        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = Math.max(1, 1 * s);
        [37, 74, 111].forEach(y => {
            ctx.beginPath();
            ctx.moveTo(left, py(y));
            ctx.lineTo(left + w, py(y));
            ctx.stroke();
        });

        const winW = 20 * s;
        const winH = 15 * s;
        const winXs = [10, 40, 70];
        const winYs = [10, 47, 84];
        ctx.fillStyle = '#bee3f8';
        ctx.strokeStyle = '#2d3748';
        winYs.forEach(y => {
            winXs.forEach(xw => {
                ctx.fillRect(px(xw), py(y), winW, winH);
                ctx.strokeRect(px(xw), py(y), winW, winH);
            });
        });

        ctx.fillStyle = '#a0aec0';
        ctx.fillRect(px(42), py(50), 16 * s, 10 * s);

        ctx.fillStyle = '#4a5568';
        ctx.fillRect(px(20), py(-10), 20 * s, 10 * s);

        ctx.strokeStyle = '#a0aec0';
        ctx.lineWidth = Math.max(1, 1 * s);
        ctx.beginPath();
        ctx.moveTo(px(80), py(0));
        ctx.lineTo(px(80), py(-20));
        ctx.stroke();
        ctx.fillStyle = '#f56565';
        ctx.beginPath();
        ctx.arc(px(80), py(-20), 2 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(px(35), py(130), 30 * s, 20 * s);
        ctx.restore();
    },

    drawLegacyApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const w = 80 * s;
        const h = 150 * s;
        const left = x - w / 2;
        const top = groundY - h;
        const px = (v) => left + v * s;
        const py = (v) => top + v * s;

        ctx.save();
        ctx.fillStyle = '#718096';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);

        const winW = 16 * s;
        const winH = 16 * s;
        const winXs = [8, 32, 56];
        const winYs = [15, 45, 75, 105];
        ctx.fillStyle = '#bee3f8';
        winYs.forEach(y => {
            winXs.forEach(xw => {
                ctx.fillRect(px(xw), py(y), winW, winH);
            });
        });

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(px(30), py(130), 20 * s, 20 * s);
        ctx.restore();
    },
    drawDestroyedLuxuryApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const left = x - 60 * s;
        const px = (v) => left + v * s;
        const py = (v) => groundY + v * s;

        ctx.save();
        ctx.fillStyle = '#4a5568';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(px(0), py(0));
        ctx.lineTo(px(0), py(-110));
        ctx.lineTo(px(20), py(-130));
        ctx.lineTo(px(60), py(-115));
        ctx.lineTo(px(100), py(-150));
        ctx.lineTo(px(100), py(0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#1a202c';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(px(10), py(-80));
        ctx.lineTo(px(35), py(-65));
        ctx.lineTo(px(20), py(-30));
        ctx.stroke();

        ctx.fillStyle = '#1a202c';
        ctx.fillRect(px(10), py(-100), 20 * s, 15 * s);
        ctx.fillRect(px(50), py(-80), 15 * s, 12 * s);

        ctx.fillStyle = '#2d3748';
        ctx.save();
        ctx.translate(px(85), py(-5));
        ctx.rotate(Math.PI / 8);
        ctx.fillRect(0, 0, 10 * s, 8 * s);
        ctx.restore();

        ctx.save();
        ctx.translate(px(15), py(-15));
        ctx.rotate(-Math.PI / 12);
        ctx.fillRect(0, 0, 12 * s, 6 * s);
        ctx.restore();
        ctx.restore();
    },

    drawDestroyedLegacyApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const left = x - 50 * s;
        const px = (v) => left + v * s;
        const py = (v) => groundY + v * s;

        ctx.save();
        ctx.fillStyle = '#4a5568';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(px(0), py(0));
        ctx.lineTo(px(0), py(-90));
        ctx.lineTo(px(15), py(-105));
        ctx.lineTo(px(50), py(-95));
        ctx.lineTo(px(80), py(-125));
        ctx.lineTo(px(80), py(0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#1a202c';
        ctx.lineWidth = Math.max(1, 1.5 * s);
        ctx.beginPath();
        ctx.moveTo(px(10), py(-70));
        ctx.lineTo(px(30), py(-55));
        ctx.lineTo(px(25), py(-20));
        ctx.stroke();

        ctx.fillStyle = '#2d3748';
        ctx.fillRect(px(8), py(-80), 15 * s, 12 * s);

        ctx.fillStyle = '#4a5568';
        ctx.save();
        ctx.translate(px(-5), py(-5));
        ctx.rotate(Math.PI / 10);
        ctx.fillRect(0, 0, 10 * s, 5 * s);
        ctx.restore();

        ctx.save();
        ctx.translate(px(70), py(-10));
        ctx.rotate(-Math.PI / 15);
        ctx.fillRect(0, 0, 12 * s, 6 * s);
        ctx.restore();
        ctx.restore();
    },

    drawShopBuilding(ctx, x, groundY, scale = 1) {
        const s = scale;
        const w = 120 * s;
        const h = 90 * s;
        const left = x - w / 2;
        const top = groundY - h;
        const px = (v) => left + v * s;
        const py = (v) => top + v * s;

        ctx.save();
        ctx.fillStyle = '#a0aec0';
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);

        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.moveTo(px(-5), py(10));
        ctx.lineTo(px(125), py(10));
        ctx.lineTo(px(115), py(0));
        ctx.lineTo(px(5), py(0));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#4a5568';
        ctx.fillRect(px(5), py(40), 110 * s, 45 * s);

        ctx.fillStyle = '#90cdf4';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(px(12), py(50), 28 * s, 28 * s);
        ctx.fillRect(px(80), py(50), 28 * s, 28 * s);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(px(52), py(50), 16 * s, 35 * s);
        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.arc(px(64), py(68), 1.5 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#cbd5e0';
        ctx.fillRect(px(15), py(18), 25 * s, 16 * s);
        ctx.fillRect(px(80), py(18), 25 * s, 16 * s);

        ctx.fillStyle = '#1f2937';
        ctx.fillRect(px(5), py(30), 110 * s, 10 * s);
        ctx.fillStyle = '#f6e05e';
        ctx.font = `${Math.max(6, 8 * s)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('STORE', x, py(35));
        ctx.restore();
    },

    drawStreetProps(ctx, x, groundY, scale = 1) {
        const s = scale;
        const poleH = 90 * s;
        ctx.save();

        ctx.fillStyle = '#4a5568';
        ctx.fillRect(x - 2 * s, groundY - poleH, 4 * s, poleH);
        ctx.fillRect(x - 22 * s, groundY - poleH + 15 * s, 44 * s, 4 * s);
        ctx.fillStyle = '#edf2f7';
        ctx.beginPath();
        ctx.arc(x - 20 * s, groundY - poleH + 13 * s, 2 * s, 0, Math.PI * 2);
        ctx.arc(x + 20 * s, groundY - poleH + 13 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e53e3e';
        ctx.beginPath();
        ctx.arc(x + 22 * s, groundY - poleH + 28 * s, 10 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 14 * s, groundY - poleH + 24 * s, 16 * s, 6 * s);

        ctx.fillStyle = '#e53e3e';
        ctx.fillRect(x - 26 * s, groundY - 22 * s, 12 * s, 20 * s);
        ctx.fillStyle = '#c53030';
        ctx.fillRect(x - 28 * s, groundY - 26 * s, 16 * s, 4 * s);

        ctx.fillStyle = '#718096';
        ctx.fillRect(x + 10 * s, groundY - 22 * s, 14 * s, 20 * s);
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = Math.max(1, 1 * s);
        ctx.beginPath();
        ctx.moveTo(x + 12 * s, groundY - 18 * s);
        ctx.lineTo(x + 22 * s, groundY - 18 * s);
        ctx.stroke();
        ctx.restore();
    },

    drawMountains(ctx, startX, endX, groundY) {
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        ctx.moveTo(startX, groundY);

        let currentX = 0;

        while (currentX < endX + 200) {
            // [SHRUNK] Smaller Mountains
            const baseWidth = 100 + Math.abs(Math.sin(currentX) * 100);
            const height = 50 + Math.abs(Math.cos(currentX * 0.5) * 100);
            const peakX = currentX + (baseWidth / 2);

            if (currentX + baseWidth > startX) {
                ctx.lineTo(peakX, groundY - height);
                ctx.lineTo(currentX + baseWidth, groundY);
            } else {
                ctx.moveTo(currentX + baseWidth, groundY);
            }
            currentX += baseWidth;
        }

        ctx.lineTo(endX, groundY + 100);
        ctx.lineTo(startX, groundY + 100);
        ctx.fill();
    },

    drawVillage(ctx, startX, endX, groundY) {
        const interval = 120;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const offset = Math.sin(i) * 20;
            const x = i + offset;

            // House Body
            ctx.fillStyle = '#fef3c7';
            ctx.fillRect(x, groundY - 30, 40, 30);

            // Roof
            ctx.fillStyle = '#991b1b';
            ctx.beginPath();
            ctx.moveTo(x - 5, groundY - 30);
            ctx.lineTo(x + 20, groundY - 50);
            ctx.lineTo(x + 45, groundY - 30);
            ctx.fill();

            // Door/Window
            ctx.fillStyle = '#451a03';
            ctx.fillRect(x + 15, groundY - 15, 10, 15);
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(x + 5, groundY - 25, 8, 8);
        }
    },

    // ============================
    // ============================ Forest ============================
    drawForestFarTrees(ctx, startX, endX, groundY) {
        const interval = 60;
        const start = Math.floor(startX / interval) * interval;
        ctx.fillStyle = '#1a3d15';
        for (let i = start; i < endX; i += interval) {
            const seed = this._rand(i + 500);
            const h = 80 + seed * 120;
            const w = 40 + seed * 30;
            ctx.beginPath();
            ctx.moveTo(i, groundY);
            ctx.lineTo(i + w * 0.5, groundY - h);
            ctx.lineTo(i + w, groundY);
            ctx.fill();
        }
    },

    drawForestTrees(ctx, startX, endX, groundY) {
        const interval = 55;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const seed = this._rand(i + 700);
            const seed2 = this._rand(i + 701);
            const isPine = seed > 0.4;
            const trunkH = 8 + seed2 * 12;
            const x = i + seed * 15;
            ctx.fillStyle = '#5c3d2e';
            ctx.fillRect(x + 8, groundY - trunkH, 6, trunkH);

            if (isPine) {
                // Pine tree: stack 3 triangle layers
                const layers = [
                    { w: 36, h: 35, y: trunkH },
                    { w: 30, h: 30, y: trunkH + 20 },
                    { w: 22, h: 25, y: trunkH + 35 }
                ];
                for (const l of layers) {
                    ctx.fillStyle = seed > 0.6 ? '#15532d' : '#1a6b3a';
                    ctx.beginPath();
                    ctx.moveTo(x + 11 - l.w / 2, groundY - l.y);
                    ctx.lineTo(x + 11, groundY - l.y - l.h);
                    ctx.lineTo(x + 11 + l.w / 2, groundY - l.y);
                    ctx.fill();
                }
            } else {
                // Broadleaf tree canopy
                const crownR = 16 + seed2 * 10;
                ctx.fillStyle = seed2 > 0.5 ? '#2d7a2d' : '#228b22';
                ctx.beginPath();
                ctx.arc(x + 11, groundY - trunkH - crownR * 0.7, crownR, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = seed > 0.5 ? '#1e6b1e' : '#1a5c1a';
                ctx.beginPath();
                ctx.arc(x + 5, groundY - trunkH - crownR * 0.5, crownR * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // ============================
    // =========================== Fortress ==========================
    drawFortressWalls(ctx, startX, endX, groundY) {
        const interval = 200;
        const start = Math.floor(startX / interval) * interval;

        // Background fortress wall blocks
        ctx.fillStyle = '#4a4240';
        for (let i = start; i < endX; i += interval) {
            const seed = this._rand(i + 300);
            const wallH = 60 + seed * 80;
            const wallW = 120 + seed * 60;
            ctx.fillRect(i, groundY - wallH, wallW, wallH);

            // Battlement teeth (merlons)
            ctx.fillStyle = '#5a5250';
            const merlon = 16;
            for (let m = i; m < i + wallW; m += merlon * 2) {
                ctx.fillRect(m, groundY - wallH - 12, merlon, 12);
            }
            ctx.fillStyle = '#4a4240';
        }
        for (let i = start; i < endX; i += interval) {
            const seed = this._rand(i + 310);
            if (seed > 0.5) {
                const towerX = i + 60 + seed * 40;
                const towerH = 100 + seed * 60;
                ctx.fillStyle = '#3d3533';
                ctx.fillRect(towerX - 15, groundY - towerH, 30, towerH);
                ctx.fillStyle = '#5a5250';
                ctx.fillRect(towerX - 18, groundY - towerH - 8, 36, 8);
                for (let m = 0; m < 3; m++) {
                    ctx.fillRect(towerX - 16 + m * 12, groundY - towerH - 18, 8, 10);
                }
            }
        }
    },

    drawFortressForeground(ctx, startX, endX, groundY) {
        const interval = 300;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const seed = this._rand(i + 400);
            // Foreground rubble and flag props
            ctx.fillStyle = '#6b6360';
            for (let j = 0; j < 5; j++) {
                const rx = i + this._rand(i + j * 100) * 250;
                const ry = groundY - 2 - this._rand(i + j * 200) * 6;
                const rw = 6 + this._rand(i + j * 300) * 10;
                const rh = 3 + this._rand(i + j * 400) * 5;
                ctx.fillRect(rx, ry, rw, rh);
            }
            if (seed > 0.6) {
                const fx = i + 140;
                ctx.fillStyle = '#3d3533';
                ctx.fillRect(fx, groundY - 50, 3, 50);
                ctx.fillStyle = '#8b2020';
                ctx.beginPath();
                ctx.moveTo(fx + 3, groundY - 50);
                ctx.lineTo(fx + 25, groundY - 42);
                ctx.lineTo(fx + 3, groundY - 34);
                ctx.fill();
            }
        }
    },

    // ============================
    // ============================ Desert ============================
    drawDesertDunes(ctx, startX, endX, groundY) {
        // Far dune ridge layer
        ctx.fillStyle = '#b8a070';
        ctx.beginPath();
        ctx.moveTo(startX, groundY);

        let cx = startX;
        while (cx < endX + 300) {
            const seed = this._rand(Math.floor(cx / 200) * 200 + 900);
            const duneW = 180 + seed * 120;
            const duneH = 30 + seed * 50;
            const peakX = cx + duneW * 0.5;
            ctx.quadraticCurveTo(peakX, groundY - duneH, cx + duneW, groundY);
            cx += duneW;
        }
        ctx.lineTo(endX + 300, groundY + 100);
        ctx.lineTo(startX, groundY + 100);
        ctx.fill();
    },

    drawDesertForeground(ctx, startX, endX, groundY) {
        const interval = 400;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const seed = this._rand(i + 800);
            if (seed > 0.3) {
                const cx = i + seed * 200;
                const ch = 25 + seed * 20;
                ctx.fillStyle = '#567d46';
                ctx.fillRect(cx - 3, groundY - ch, 6, ch);
                ctx.fillRect(cx - 12, groundY - ch * 0.7, 9, 4);
                ctx.fillRect(cx - 12, groundY - ch * 0.7 - 10, 4, 14);
                ctx.fillRect(cx + 6, groundY - ch * 0.5, 10, 4);
                ctx.fillRect(cx + 12, groundY - ch * 0.5 - 8, 4, 12);
            }
            if (seed < 0.7) {
                const rx = i + 100 + seed * 150;
                ctx.fillStyle = '#8b7d6b';
                ctx.beginPath();
                ctx.moveTo(rx, groundY);
                ctx.lineTo(rx + 5, groundY - 12);
                ctx.lineTo(rx + 15, groundY - 14);
                ctx.lineTo(rx + 22, groundY - 8);
                ctx.lineTo(rx + 25, groundY);
                ctx.fill();
            }

            // Foreground prop: rocks / dry branch
            if (seed > 0.75) {
                const bx = i + 280;
                ctx.fillStyle = '#d4c8a0';
                ctx.beginPath();
                ctx.arc(bx, groundY - 4, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(bx + 4, groundY - 2, 12, 2);
            }
        }
    },

    // ==========================
    // Landing Map (War-Torn Coastline)
    // ==========================

    drawLandingSky(ctx, width, height) {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#465e75');
        grad.addColorStop(1, '#87ceeb');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    },

    drawLandingOcean(ctx, width, height, groundY, cameraX) {
        // Lift ocean horizon for landing map so sea sits behind mid/far terrain.
        const waterY = Math.max(0, Math.min(height - 20, groundY - 86));
        ctx.fillStyle = '#080a10';
        ctx.fillRect(0, waterY, width, height - waterY);

        // Near water body (dark band)
        ctx.fillStyle = '#161b25';
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, waterY + 10);
        const freq = 0.005;
        const amp = 4;
        for (let x = 0; x <= width; x += 30) {
            const y = waterY + 10 + Math.sin((x + cameraX * 0.6) * freq) * amp;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.fill();

        // Wave crest layer with light foam strokes
        ctx.fillStyle = '#252f3d';
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, waterY + 15);
        for (let x = 0; x <= width; x += 30) {
            const y = waterY + 15 + Math.sin((x + cameraX * 0.8) * 0.01) * 6;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.fill();
        ctx.strokeStyle = '#4a5b6c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 30) {
            const y = waterY + 15 + Math.sin((x + cameraX * 0.8) * 0.01) * 6;
            if (Math.sin((x + cameraX * 0.8) * 0.01) < -0.5) {
                ctx.moveTo(x - 5, y);
                ctx.lineTo(x + 5, y);
            }
        }
        ctx.stroke();
    },

    drawLandingSmokeClouds(ctx, startX, endX, groundY) {
        const spacing = 400;
        const yBase = 80;

        for (let i = startX - spacing; i < endX + spacing; i += spacing) {
            const seed = this._rand(Math.floor(i / spacing) + 9000);
            if (seed < 0.5) continue;

            const x = i + seed * 100;
            const y = yBase + seed * 150;
            const scale = 1.0 + seed * 1.5;

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            ctx.fillStyle = 'rgba(40, 40, 40, 0.5)';
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.arc(30, -10, 40, 0, Math.PI * 2);
            ctx.arc(60, 5, 35, 0, Math.PI * 2);
            ctx.arc(20, 20, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    },

    drawLandingRuins(ctx, startX, endX, groundY) {
        // Replace mountain-like ridge with a few small offshore islands.
        const seaLevelY = groundY - 76;
        const spacing = 1200;
        const start = Math.floor(startX / spacing) * spacing;

        for (let i = start - spacing; i < endX + spacing; i += spacing) {
            const seed = this._rand(Math.floor(i / spacing) + 8400);
            const islandCount = seed > 0.7 ? 3 : (seed > 0.35 ? 2 : 1);

            for (let n = 0; n < islandCount; n++) {
                const ns = this._rand(i * 0.0017 + n * 17 + 991);
                const cx = i + 180 + n * 280 + seed * 220 + ns * 70;
                const w = 46 + ns * 56;
                const h = 10 + this._rand(i * 0.0023 + n * 31 + 613) * 24;
                const waterY = seaLevelY + (this._rand(i * 0.0011 + n * 13 + 401) - 0.5) * 8;

                // Island body
                ctx.fillStyle = '#101215';
                ctx.beginPath();
                ctx.moveTo(cx - w * 0.72, waterY + 2);
                ctx.quadraticCurveTo(cx - w * 0.32, waterY - h * 0.85, cx, waterY - h);
                ctx.quadraticCurveTo(cx + w * 0.34, waterY - h * 0.82, cx + w * 0.74, waterY + 2);
                ctx.lineTo(cx + w * 0.7, waterY + 6);
                ctx.quadraticCurveTo(cx, waterY + 11, cx - w * 0.7, waterY + 6);
                ctx.closePath();
                ctx.fill();

                // Small top bump to break uniform silhouette
                if (this._rand(i * 0.0031 + n * 19 + 77) > 0.58) {
                    ctx.fillStyle = '#0c0f13';
                    ctx.beginPath();
                    ctx.moveTo(cx - w * 0.22, waterY - h * 0.58);
                    ctx.quadraticCurveTo(cx, waterY - h * 0.95, cx + w * 0.2, waterY - h * 0.6);
                    ctx.lineTo(cx + w * 0.08, waterY - h * 0.4);
                    ctx.lineTo(cx - w * 0.14, waterY - h * 0.44);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
    },

    drawLandingBeach(ctx, startX, endX, groundY) {
        // Raise foreground beach crest so units stand on visible land, not water.
        const baseY = groundY + 16;

        // Guarantee a visible near-ground sand strip under unit feet.
        ctx.fillStyle = '#3a312b';
        ctx.fillRect(startX, groundY - 8, Math.max(0, endX - startX), 120);

        // Lower beach contour (dark wet sand)
        ctx.fillStyle = '#2e2722';
        ctx.beginPath();
        ctx.moveTo(startX, groundY + 100);
        for (let x = startX; x <= endX; x += 50) {
            const seed = this._rand(Math.floor(x / 50) + 7000);
            const y = baseY - 15 + Math.sin(x * 0.01) * 15 + (seed - 0.5) * 20;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(endX, groundY + 100);
        ctx.fill();

        // Upper beach contour (dry sand)
        ctx.fillStyle = '#3e342e';
        ctx.beginPath();
        ctx.moveTo(startX, groundY + 100);
        for (let x = startX; x <= endX; x += 50) {
            const seed = this._rand(Math.floor(x / 50) + 7000);
            const y = baseY + Math.sin(x * 0.01) * 10 + (seed - 0.5) * 15;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(endX, groundY + 100);
        ctx.fill();

        // Beach clutter props (wire, stakes, debris)
        for (let x = startX; x <= endX; x += 200) {
            const seed = this._rand(Math.floor(x / 200) + 6000);
            const propY = baseY + Math.sin(x * 0.01) * 10;

            if (seed < 0.3) {
                ctx.save();
                ctx.translate(x, propY);
                ctx.strokeStyle = '#1a1512';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-3, -30);
                ctx.lineTo(1, -55);
                ctx.stroke();
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-3, -30);
                ctx.lineTo(-18, -40);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(1, -45);
                ctx.lineTo(12, -52);
                ctx.stroke();
                ctx.restore();
            } else if (seed >= 0.3 && seed < 0.5) {
                ctx.save();
                ctx.translate(x, propY);
                ctx.strokeStyle = '#2d2d2d';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(-12, 0);
                ctx.lineTo(12, -20);
                ctx.moveTo(12, 0);
                ctx.lineTo(-12, -20);
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -25);
                ctx.stroke();
                ctx.restore();
            }
        }
    }
};

if (typeof window !== 'undefined') {
    if (window.MapRegistryAdapter && typeof window.MapRegistryAdapter.applyRegistryToMaps === 'function') {
        window.MapRegistryAdapter.applyRegistryToMaps(Maps);
    } else if (window.MapRegistry && typeof window.MapRegistry.getDefinitions === 'function') {
        const externalDefs = window.MapRegistry.getDefinitions();
        if (externalDefs && externalDefs.types && typeof externalDefs.types === 'object') {
            Maps.types = { ...Maps.types, ...externalDefs.types };
        }
        if (externalDefs && externalDefs.rules && typeof externalDefs.rules === 'object') {
            Maps.rules = { ...Maps.rules, ...externalDefs.rules };
        }
    }
}

if (typeof window !== 'undefined') {
    window.Maps = Maps;
}


