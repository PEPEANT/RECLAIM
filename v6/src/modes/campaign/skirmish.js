/**
 * SkirmishMode ??援????罹좏럹???꾩슜 濡쒖쭅
 *
 * 諛곗튂 ?섏씠利???移댁슫?몃떎?????꾪닾 (annihilation)
 * - HQ/諛⑹뼱嫄대Ъ/嫄곗젏 ?놁쓬, AI ?ㅽ룿 ?꾩쟾 李⑤떒
 * - ???좊떅 ?ъ쟾 諛곗튂 (?곗륫, ?뺤? ?곹깭)
 * - ?쒕? 以묒븰 諛곗튂
 * - 1?ㅽ뀒?댁?: ?꾧뎔 ?좊떅 吏湲?+ 蹂닿???1湲?異붽? 諛곗튂
 * - 2?ㅽ뀒?댁?+: 吏湲??놁씠 蹂닿??⑥뿉?쒕쭔 諛곗튂
 * - "諛곗튂 ?꾨즺" ??3..2..1 ???꾪닾?쒖옉
 */
(function (global) {
    'use strict';

    const SkirmishMode = {
        isActive: false,
        phase: 'idle',       // 'idle' | 'placement' | 'countdown' | 'battle'
        stageData: null,
        _game: null,
        _budget: [],         // [{ unitId, count, placed, source:'given'|'storage'|'veteran', veteranId? }]
        _storageSlots: 0,    // 보관 유닛에서 추가 배치 가능한 슬롯 수
        _storagePlaced: 0,   // 보관 유닛에서 현재까지 배치한 수
        _selectedUnit: null,
        _placementListener: null,
        _placementTouchListener: null,
        _placementLastTouchAt: 0,
        _stockBackup: null,
        _stage1AzanAudio: null,
        _storegraphicActive: false,
        _fadeOnFirstShotActive: false,
        _stageBgmPath: '',
        _stageBgmFadeTimer: null,
        _gunHook: null,
        _prevGunHook: null,
        _casualtyWatchTimer: null,
        _battleAliveBaseline: null,
        _countdownTimeouts: null,
        _deployBypassUnits: null,
        _placementResizeHandler: null,

        // Initialize skirmish placement mode
        init(game, stageData) {
            this.isActive = true;
            this.phase = 'placement';
            this.stageData = stageData || {};
            this._game = game;
            this._storagePlaced = 0;
            const stage = this.stageData;
            this._stage1AzanAudio = null;
            this._storegraphicActive = false;
            this._fadeOnFirstShotActive = false;
            this._stageBgmPath = '';
            this._clearStageBgmFade();
            this._gunHook = null;
            this._prevGunHook = null;
            this._casualtyWatchTimer = null;
            this._battleAliveBaseline = null;
            this._clearCountdownTimers();
            this._deployBypassUnits = this._buildDeployBypassSet();

            // Initial unit budget from stage.playerBudget
            const givenBudget = Array.isArray(stage.playerBudget) ? stage.playerBudget : [];
            this._budget = givenBudget.map(b => ({
                unitId: b.unitId,
                count: Math.max(0, Math.floor(Number(b.count) || 0)),
                placed: 0,
                source: 'given'
            }));

            // 보관 슬롯 수
            this._storageSlots = Math.max(0, Math.floor(Number(stage.storageSlots) || 0));
            if (this._hasUnlimitedStorageSlots()) {
                this._storageSlots = Math.max(1, this._storageSlots);
            }

            // Add deployable units from city storage (owned units only)
            this._addStorageUnits(game);
            this._addVeteranUnits(game);

            // 초기 선택 초기화 + 기존 유닛생성바 수량 동기화
            this._selectedUnit = null;
            this._syncUnitBarStock(game);

            // Pre-deploy enemy units
            this._preDeployEnemies(game);

            // Pre-deploy civilians
            this._preDeployCivilians(game);

            // Freeze all units during placement phase
            this._freezeAllUnits(game);
            this._focusPlacementView(game);

            // UI ?쒖떆
            this._showPlacementUI(game);

            // 배치 클릭 이벤트 바인딩
            this._bindPlacementClick(game);

            // Stage 1 pre-battle ambience + background music.
            this._startStageAudio();
        },

        _getStageId() {
            return Math.floor(Number(this.stageData && this.stageData.id) || 0);
        },

        _isStageOne() {
            return this._getStageId() === 101;
        },

        _isStageOneUnlimitedPlacement() {
            return this._isStageOne();
        },

        _hasUnlimitedStorageSlots() {
            return this._isStageOneUnlimitedPlacement();
        },

        _getStorageRemainingSlots() {
            if (this._hasUnlimitedStorageSlots()) return Number.POSITIVE_INFINITY;
            const total = Math.max(0, Math.floor(Number(this._storageSlots) || 0));
            const placed = Math.max(0, Math.floor(Number(this._storagePlaced) || 0));
            return Math.max(0, total - placed);
        },

        _buildDeployBypassSet() {
            const base = ['icbm', 'drone_operator', 'drone_suicide', 'drone_at'];
            const out = new Set(base);
            const extra = this.stageData && Array.isArray(this.stageData.skirmishBypassUnits)
                ? this.stageData.skirmishBypassUnits
                : [];
            extra.forEach((id) => {
                const key = String(id || '').trim();
                if (key) out.add(key);
            });
            return out;
        },

        _canBypassSpawnBlock(unitId) {
            const key = String(unitId || '').trim();
            return !!(key && this._deployBypassUnits && this._deployBypassUnits.has(key));
        },

        _calcAuxVolume(multiplier = 1) {
            const m = Math.max(0, Number(multiplier) || 0);
            if (typeof AudioSystem === 'undefined' || !AudioSystem || !AudioSystem.volume) return Math.min(1, 0.35 * m);
            const master = Math.max(0, Math.min(1, Number(AudioSystem.volume.master) || 0));
            const bgm = Math.max(0, Math.min(1, Number(AudioSystem.volume.bgm) || 0));
            return Math.max(0, Math.min(1, master * bgm * m));
        },

        _startStageAudio() {
            if (typeof AudioSystem === 'undefined' || !AudioSystem) return;

            try {
                if (typeof AudioSystem.init === 'function') AudioSystem.init();
                if (AudioSystem.ctx && AudioSystem.ctx.state === 'suspended' && typeof AudioSystem.ctx.resume === 'function') {
                    AudioSystem.ctx.resume().catch(() => { });
                }
            } catch (_) { }

            const stageId = this._getStageId();
            let stageBgm = '';
            if (stageId === 101) stageBgm = 'bgm/ost/storegraphic.mp3';
            else if (stageId === 102) stageBgm = 'bgm/ost/hitslabwar.mp3';
            else if (stageId === 103) stageBgm = 'bgm/ost/williamhector.mp3';
            else if (stageId === 104) stageBgm = 'bgm/ost/mfcc-egypt-egypt.mp3';
            else if (stageId === 105) stageBgm = 'bgm/ost/rinesh3031.mp3';

            try {
                if (typeof AudioSystem.setBGMLock === 'function') AudioSystem.setBGMLock('');
                if (stageBgm && typeof AudioSystem.playBGMFile === 'function') {
                    AudioSystem.playBGMFile(stageBgm);
                    this._stageBgmPath = stageBgm;
                    this._storegraphicActive = stageBgm === 'bgm/ost/storegraphic.mp3';
                    this._fadeOnFirstShotActive = stageId === 104;
                }
            } catch (_) { }

            if (stageId === 101) {
                // Stage 1 city ambience (stops at countdown start).
                try {
                    const azan = new Audio('bgm/ost/AzanAdhan.mp3');
                    azan.loop = true;
                    azan.preload = 'auto';
                    azan.volume = this._calcAuxVolume(0.95);
                    this._stage1AzanAudio = azan;
                    azan.play().catch(() => { });
                } catch (_) {
                    this._stage1AzanAudio = null;
                }
            }

            const needsGunHook = (stageId === 101) || (stageId === 104);
            if (!needsGunHook) return;

            const prevHook = (typeof AudioSystem.onGunShot === 'function') ? AudioSystem.onGunShot : null;
            this._prevGunHook = prevHook;
            this._gunHook = (payload) => {
                if (this.phase === 'battle' && this._storegraphicActive) {
                    this._stopStoregraphicBgm();
                }
                if (this.phase === 'battle' && this._fadeOnFirstShotActive) {
                    this._fadeOnFirstShotActive = false;
                    this._fadeOutStageBgm(2800);
                }
                if (typeof prevHook === 'function') {
                    try { prevHook(payload); } catch (_) { }
                }
            };
            AudioSystem.onGunShot = this._gunHook;
        },

        _stopAzanAmbience() {
            const a = this._stage1AzanAudio;
            if (!a) return;
            try { a.pause(); } catch (_) { }
            try { a.currentTime = 0; } catch (_) { }
            this._stage1AzanAudio = null;
        },

        _stopStoregraphicBgm() {
            if (!this._storegraphicActive) return;
            this._storegraphicActive = false;
            this._stopStageBgm();
        },

        _clearStageBgmFade() {
            if (this._stageBgmFadeTimer) {
                clearInterval(this._stageBgmFadeTimer);
                this._stageBgmFadeTimer = null;
            }
        },

        _fadeOutStageBgm(durationMs = 2800) {
            const path = String(this._stageBgmPath || '').trim();
            if (!path) return;
            if (typeof AudioSystem === 'undefined' || !AudioSystem) return;
            const bgmEl = AudioSystem.bgmEl;
            const src = (bgmEl && bgmEl.dataset) ? String(bgmEl.dataset.src || '') : '';
            if (!bgmEl || src !== path) return;

            this._clearStageBgmFade();

            const startVolume = Math.max(0, Math.min(1, Number(bgmEl.volume) || 0));
            if (startVolume <= 0.001) {
                this._stopStageBgm();
                return;
            }

            const total = Math.max(300, Math.floor(Number(durationMs) || 0));
            const startedAt = Date.now();
            this._stageBgmFadeTimer = setInterval(() => {
                if (typeof AudioSystem === 'undefined' || !AudioSystem) {
                    this._clearStageBgmFade();
                    return;
                }
                const live = AudioSystem.bgmEl;
                const liveSrc = (live && live.dataset) ? String(live.dataset.src || '') : '';
                if (!live || liveSrc !== path) {
                    this._clearStageBgmFade();
                    return;
                }

                const elapsed = Math.max(0, Date.now() - startedAt);
                const ratio = Math.min(1, elapsed / total);
                live.volume = Math.max(0, startVolume * (1 - ratio));

                if (ratio >= 1) {
                    this._clearStageBgmFade();
                    this._stopStageBgm();
                }
            }, 120);
        },

        _stopStageBgm() {
            this._clearStageBgmFade();
            const path = String(this._stageBgmPath || '').trim();
            if (!path) return;
            this._stageBgmPath = '';
            if (typeof AudioSystem === 'undefined' || !AudioSystem) return;
            const current = AudioSystem.bgmEl;
            const src = current && current.dataset ? String(current.dataset.src || '') : '';
            if (src === path && typeof AudioSystem.stopBGM === 'function') {
                try { AudioSystem.stopBGM(); } catch (_) { }
            }
        },

        _countAliveUnits(list) {
            if (!Array.isArray(list) || list.length === 0) return 0;
            let alive = 0;
            for (let i = 0; i < list.length; i++) {
                const unit = list[i];
                if (unit && !unit.dead) alive++;
            }
            return alive;
        },

        _stopCasualtyWatch() {
            if (this._casualtyWatchTimer) {
                clearInterval(this._casualtyWatchTimer);
            }
            this._casualtyWatchTimer = null;
            this._battleAliveBaseline = null;
        },

        _trackCountdownTimeout(timerId) {
            if (!timerId) return null;
            if (!Array.isArray(this._countdownTimeouts)) {
                this._countdownTimeouts = [];
            }
            this._countdownTimeouts.push(timerId);
            return timerId;
        },

        _clearCountdownTimers() {
            if (!Array.isArray(this._countdownTimeouts) || this._countdownTimeouts.length === 0) {
                this._countdownTimeouts = [];
                return;
            }
            for (let i = 0; i < this._countdownTimeouts.length; i++) {
                clearTimeout(this._countdownTimeouts[i]);
            }
            this._countdownTimeouts.length = 0;
        },

        _startCasualtyWatch(game) {
            this._stopCasualtyWatch();
            if (!this._isStageOne()) return;
            if (!game) return;

            const basePlayer = this._countAliveUnits(game.players);
            const baseEnemy = this._countAliveUnits(game.enemies);
            this._battleAliveBaseline = {
                player: basePlayer,
                enemy: baseEnemy
            };

            this._casualtyWatchTimer = setInterval(() => {
                if (!this.isActive || this.phase !== 'battle') return;
                if (!this._stage1AzanAudio) {
                    this._stopCasualtyWatch();
                    return;
                }

                const baseline = this._battleAliveBaseline || { player: 0, enemy: 0 };
                const nowPlayer = this._countAliveUnits(game.players);
                const nowEnemy = this._countAliveUnits(game.enemies);
                const casualtyDetected = (nowPlayer < baseline.player) || (nowEnemy < baseline.enemy);
                if (!casualtyDetected) return;

                this._stopAzanAmbience();
                this._stopCasualtyWatch();
            }, 250);
        },

        _stopStageAudio() {
            this._stopCasualtyWatch();
            this._stopAzanAmbience();
            this._stopStageBgm();
            this._storegraphicActive = false;
            this._fadeOnFirstShotActive = false;

            if (typeof AudioSystem === 'undefined' || !AudioSystem) {
                this._gunHook = null;
                this._prevGunHook = null;
                return;
            }

            if (this._gunHook && AudioSystem.onGunShot === this._gunHook) {
                AudioSystem.onGunShot = this._prevGunHook || null;
            }
            this._gunHook = null;
            this._prevGunHook = null;
        },

        _isStorageEligibleUnit(unitId) {
            const key = String(unitId || '').trim();
            if (!key) return false;
            if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return false;
            const unitCfg = CONFIG.units[key];
            if (!unitCfg) return false;
            if (unitCfg.hideFromUnitBar === true && !this._canBypassSpawnBlock(key)) return false;
            if (unitCfg.disabled === true) return false;
            if (unitCfg.isBuilder === true) return false;
            if (unitCfg.isSkill === true) return false;
            return true;
        },

        _collectStorageUnitCounts(game) {
            const out = {};
            if (!game || !game.citySim || typeof game.citySim !== 'object') return out;

            const addCount = (unitId, amount) => {
                const key = String(unitId || '').trim();
                if (!key) return;
                if (!this._isStorageEligibleUnit(key)) return;
                const qty = Math.max(0, Math.floor(Number(amount) || 0));
                if (qty <= 0) return;
                out[key] = Math.max(0, Math.floor(Number(out[key]) || 0)) + qty;
            };

            const cityUnits = (game.citySim && typeof game.citySim.units === 'object')
                ? game.citySim.units
                : null;
            if (cityUnits) {
                Object.keys(cityUnits).forEach((key) => {
                    addCount(key, cityUnits[key]);
                });
            }

            // 연병장 배치 유닛도 국지전 배치 예산에 포함한다.
            const drillgroundSlots = (game.citySim && typeof game.citySim.drillgroundSlots === 'object')
                ? game.citySim.drillgroundSlots
                : null;
            if (drillgroundSlots) {
                Object.keys(drillgroundSlots).forEach((slotKey) => {
                    const unitId = String(drillgroundSlots[slotKey] || '').trim();
                    if (!unitId) return;
                    addCount(unitId, 1);
                });
            }

            return out;
        },

        // Add storage-backed units into placement budget
        _addStorageUnits(game) {
            if (this._storageSlots <= 0) return;
            const ownedCounts = this._collectStorageUnitCounts(game);
            const unitKeys = Object.keys(ownedCounts);
            if (unitKeys.length <= 0) return;

            // Append city-owned units as storage budget entries
            unitKeys.forEach((key) => {
                const qty = Math.max(0, Math.floor(Number(ownedCounts[key]) || 0));
                if (qty <= 0) return;
                // Keep storage entries separate from given budget entries
                this._budget.push({
                    unitId: key,
                    count: qty,
                    placed: 0,
                    source: 'storage'
                });
            });
        },

        _addVeteranUnits(game) {
            if (!game || typeof game.getVeteranSpawnEntries !== 'function') return;
            const entries = game.getVeteranSpawnEntries();
            if (!Array.isArray(entries) || entries.length <= 0) return;

            entries.forEach((entry) => {
                const veteranId = String(entry?.id || '').trim();
                const unitId = String(entry?.unitKey || '').trim();
                const count = Math.max(0, Math.floor(Number(entry?.stock) || 0));
                if (!veteranId || !unitId || count <= 0) return;
                const unitCfg = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units)
                    ? CONFIG.units[unitId]
                    : null;
                if (!unitCfg || unitCfg.disabled === true) return;

                this._budget.push({
                    unitId,
                    count,
                    placed: 0,
                    source: 'veteran',
                    veteranId,
                    veteranName: String(entry?.name || '').trim().slice(0, 24),
                    veteranLevel: Math.max(2, Math.floor(Number(entry?.level) || 2))
                });
            });
        },

        // Pre-deploy stage units (stationary)
        _preDeployEnemies(game) {
            const stageId = Math.floor(Number(this.stageData?.id) || 0);
            const mapW = (typeof CONFIG !== 'undefined' && CONFIG.mapWidth) ? CONFIG.mapWidth : 6000;

            this._preDeployPresetUnits(game, this.stageData.enemyPreset || [], 'enemy', stageId, mapW);
            this._preDeployPresetUnits(game, this.stageData.playerPreset || [], 'player', stageId, mapW);

            this._preDeployEnemyStructures(game, stageId, mapW);
        },

        _preDeployPresetUnits(game, presets, team, stageId, mapW) {
            if (!game || !Array.isArray(presets) || presets.length <= 0) return;

            const safeMapW = Math.max(1000, Number(mapW) || 6000);
            const isEnemy = team === 'enemy';
            const zoneStart = isEnemy ? (safeMapW * 0.65) : (safeMapW * 0.1);
            const zoneEnd = isEnemy ? (safeMapW * 0.9) : (safeMapW * 0.35);
            const frontBaseX = isEnemy ? (safeMapW * 0.65 + 42) : (safeMapW * 0.35 - 42);
            const clampX = (v) => Math.max(70, Math.min(safeMapW - 70, Number(v) || 0));
            let frontSpawnIndex = 0;

            for (const preset of presets) {
                const unitId = String(preset?.unitId || '').trim();
                const count = Math.max(0, Math.floor(Number(preset?.count) || 0));
                if (!unitId || count <= 0) continue;

                const placement = String(preset?.placement || '').trim().toLowerCase();
                const frontPlaced = placement === 'front';
                const useAdvanceTankSpacing = (stageId === 104 && unitId === 'mbt' && count > 1);
                const innerPad = Math.min(120, Math.max(40, (zoneEnd - zoneStart) * 0.1));
                const laneStart = zoneStart + innerPad;
                const laneEnd = zoneEnd - innerPad;
                const laneWidth = Math.max(120, laneEnd - laneStart);
                const tanksPerRow = useAdvanceTankSpacing ? Math.max(2, Math.ceil(count / 2)) : 0;
                const tankStep = (useAdvanceTankSpacing && tanksPerRow > 1)
                    ? (laneWidth / (tanksPerRow - 1))
                    : 0;
                for (let i = 0; i < count; i++) {
                    let x = 0;
                    if (frontPlaced) {
                        const slot = frontSpawnIndex++;
                        let slotOffset = 0;
                        if (slot > 0) {
                            const ring = Math.ceil(slot / 2);
                            const sign = (slot % 2 === 1) ? 1 : -1;
                            slotOffset = sign * ring * 26;
                        }
                        x = clampX(frontBaseX + (isEnemy ? slotOffset : -slotOffset));
                    } else if (useAdvanceTankSpacing) {
                        const row = Math.floor(i / tanksPerRow);
                        const col = i % tanksPerRow;
                        const stagger = (row % 2 === 1 && tankStep > 0) ? (tankStep * 0.45) : 0;
                        x = clampX(laneStart + (col * tankStep) + stagger);
                    } else {
                        x = clampX(zoneStart + Math.random() * (zoneEnd - zoneStart));
                    }

                    const unit = game.spawnUnitDirect(unitId, x, game.groundY, team);
                    if (!unit) continue;

                    // Keep stage pre-deploy units exactly where requested.
                    unit.x = x;
                    unit.commandMode = 'stop';
                    unit.attackTarget = null;

                    // Stage 1 exception: enemy humvee uses combat truck visuals.
                    if (stageId === 101 && isEnemy && unitId === 'humvee') {
                        unit.skinVariant = 'combat_truck';
                    }
                }
            }
        },

        _preDeployEnemyStructures(game, stageId, mapW) {
            if (stageId !== 105 || !game) return;

            const safeMapW = Math.max(1000, Number(mapW) || 6000);
            const objectiveX = Math.max(180, Math.min(safeMapW - 180, Math.round(safeMapW * 0.76)));
            let tower = null;

            if (Array.isArray(game.buildings)) {
                tower = game.buildings.find((b) => (
                    b
                    && b.team === 'enemy'
                    && b.type === 'watchtower'
                    && !b.dead
                )) || null;
            }

            if (!tower && typeof Building !== 'undefined') {
                try {
                    tower = new Building('watchtower', objectiveX, game.groundY, 'enemy');
                    game.buildings.push(tower);
                } catch (_) {
                    tower = null;
                }
            }
            if (!tower) return;

            // Stage-105 objective tower: force visibility and durability.
            tower.x = objectiveX;
            if (tower._skirmishObjectiveTower !== true) {
                tower._skirmishObjectiveTower = true;
                tower.width = Math.max(120, Number(tower.width) || 0);
                tower.height = Math.max(180, Number(tower.height) || 0);
                const objectiveHp = Math.max(2600, Number(tower.maxHp) || 0);
                tower.maxHp = objectiveHp;
                tower.hp = objectiveHp;
                tower.hpBarOffsetY = Math.max(18, Number(tower.hpBarOffsetY) || 0);
            }
        },
        // Pre-deploy civilians (center area)
        _preDeployCivilians(game) {
            const count = this.stageData.civilians || 0;
            const stageId = Math.floor(Number(this.stageData?.id) || 0);
            const mapW = (typeof CONFIG !== 'undefined' && CONFIG.mapWidth) ? CONFIG.mapWidth : 6000;
            const centerX = mapW * 0.5;
            const pad = 80;
            // Stage 1: denser traffic/civilian setup.
            if (stageId === 101) {
                const vehiclePool = ['civ_sedan', 'civ_suv', 'civ_bus', 'civ_sedan', 'civ_suv', 'civ_bus'];
                const humanPool = ['civ_a', 'civ_b', 'civ_crowd', 'civ_a', 'civ_b', 'civ_crowd'];
                const vehicleCount = 22;
                const humanCount = Math.max(10, (Number(count) || 0) * 4);
                const spread = 950;
                for (let i = 0; i < vehicleCount; i++) {
                    const key = vehiclePool[i % vehiclePool.length];
                    let x = centerX + (Math.random() - 0.5) * spread;
                    x = Math.max(pad, Math.min(mapW - pad, x));
                    game.spawnCivilianUnit(key, x, game.groundY);
                }
                for (let i = 0; i < humanCount; i++) {
                    const key = humanPool[i % humanPool.length];
                    let x = centerX + (Math.random() - 0.5) * (spread * 0.9);
                    x = Math.max(pad, Math.min(mapW - pad, x));
                    game.spawnCivilianUnit(key, x, game.groundY);
                }
                return;
            }
            const civTypes = ['civ_a', 'civ_b'];
            for (let i = 0; i < count; i++) {
                const x = centerX - 200 + Math.random() * 400;
                const key = civTypes[i % civTypes.length];
                game.spawnCivilianUnit(key, x, game.groundY);
            }
        },
        // Freeze/unfreeze helper
        _freezeAllUnits(game) {
            game.enemies.forEach(u => { u.commandMode = 'stop'; });
            game.players.forEach(u => { u.commandMode = 'stop'; });
        },

        _unfreezeAllUnits(game) {
            game.enemies.forEach(u => { u.commandMode = 'advance'; });
            game.players.forEach(u => { u.commandMode = 'advance'; });
        },

        _focusPlacementView(game) {
            if (!game) return;
            const mapW = (typeof CONFIG !== 'undefined' && Number.isFinite(Number(CONFIG.mapWidth)))
                ? Number(CONFIG.mapWidth)
                : 6000;

            // Mobile skirmish starts with a wider view to avoid excessive crop.
            const isCoarse = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
                ? window.matchMedia('(pointer: coarse)').matches
                : false;
            if (isCoarse && typeof Camera !== 'undefined' && Camera) {
                const currentZoom = Number(Camera.zoom) || 1;
                const maxPlacementZoom = 0.65;
                if (currentZoom > maxPlacementZoom) {
                    Camera.zoom = maxPlacementZoom;
                    if (typeof game.updateZoomUI === 'function') {
                        game.updateZoomUI();
                    }
                }
            }

            const viewW = (typeof Camera !== 'undefined' && Camera && typeof Camera.viewW === 'function')
                ? Camera.viewW(game)
                : Number(game.width) || 1280;

            const deployRight = mapW * 0.35;
            const deployCenter = deployRight * 0.5;
            let nextX = deployCenter - (viewW * 0.5);

            if (typeof Camera !== 'undefined' && Camera && typeof Camera.clampCameraX === 'function') {
                nextX = Camera.clampCameraX(game, nextX);
            } else {
                nextX = Math.max(0, Math.min(nextX, Math.max(0, mapW - viewW)));
            }
            game.cameraX = nextX;
        },

        // Show placement UI
        _showPlacementUI(game) {
            const uiEl = document.getElementById('skirmish-placement-ui');
            if (uiEl) {
                uiEl.classList.remove('hidden');
                uiEl.classList.add('use-main-unit-bar');
            }
            this._bindPlacementResize();

            // 국지전 나레이션은 사용하지 않음
            const narEl = document.getElementById('skirmish-narration');
            if (narEl) {
                narEl.textContent = '';
                narEl.classList.add('hidden');
            }

            // 국지전 전용 팔레트 대신 기존 인게임 유닛생성바를 사용
            const paletteEl = document.getElementById('skirmish-unit-palette');
            if (paletteEl) {
                paletteEl.classList.add('hidden');
                paletteEl.innerHTML = '';
            }

            if (typeof HUD !== 'undefined' && HUD && typeof HUD.show === 'function') {
                HUD.show();
            }
            this._applyPredeployHudPolicy(true);
            this._syncPlacementHudOffset();
            this._updateReadyButtonState();

            // Layout can change one frame later on mobile rotation/viewport settle.
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(() => this._syncPlacementHudOffset());
            }
        },

        _getTotalPlacedCount() {
            return this._budget.reduce((sum, item) => sum + Math.max(0, Number(item?.placed) || 0), 0);
        },

        _updateReadyButtonState() {
            const readyBtn = document.getElementById('skirmish-ready-btn');
            if (!readyBtn) return;
            const canReady = this.phase === 'placement' && this._getTotalPlacedCount() > 0;
            readyBtn.classList.toggle('is-hidden', !canReady);
            readyBtn.disabled = !canReady;
        },

        _applyPredeployHudPolicy(enabled) {
            const predeploy = enabled === true;
            const hudFooter = document.getElementById('hud-footer');
            if (hudFooter) {
                hudFooter.classList.remove('hidden');
                if (predeploy) hudFooter.classList.remove('hud-show-production');
            }

            const cameraBtn = document.getElementById('hud-camera-btn');
            if (cameraBtn) cameraBtn.classList.toggle('hidden', predeploy);

            if (typeof HUD !== 'undefined' && HUD) {
                if (typeof HUD.setSkirmishRightSlotMode === 'function') {
                    HUD.setSkirmishRightSlotMode(predeploy);
                }
                if (typeof HUD.hideProductionArea === 'function') {
                    HUD.hideProductionArea();
                }
                if (typeof HUD.updateCommandButtons === 'function') {
                    HUD._lastCmdState = '';
                    HUD.updateCommandButtons();
                }
            } else {
                const unitPanel = document.getElementById('unit-panel-container');
                if (unitPanel) unitPanel.classList.toggle('hidden', !predeploy);
                if (hudFooter) hudFooter.classList.toggle('hud-skirmish-predeploy', predeploy);
            }
        },

        _hidePlacementUI() {
            const uiEl = document.getElementById('skirmish-placement-ui');
            if (uiEl) {
                uiEl.classList.add('hidden');
                uiEl.classList.remove('use-main-unit-bar');
                uiEl.style.removeProperty('--skirmish-hud-offset');
            }
            this._unbindPlacementResize();
            this._applyPredeployHudPolicy(false);
        },

        _syncPlacementHudOffset() {
            const uiEl = document.getElementById('skirmish-placement-ui');
            if (!uiEl) return;
            const hudFooter = document.getElementById('hud-footer');
            let offset = 0;
            if (hudFooter && !hudFooter.classList.contains('hidden')) {
                const rect = hudFooter.getBoundingClientRect();
                offset = Math.max(0, Math.round(rect.height || 0));
            }
            uiEl.style.setProperty('--skirmish-hud-offset', `${offset}px`);
        },

        _bindPlacementResize() {
            if (this._placementResizeHandler || typeof window === 'undefined') return;
            this._placementResizeHandler = () => this._syncPlacementHudOffset();
            window.addEventListener('resize', this._placementResizeHandler);
            window.addEventListener('orientationchange', this._placementResizeHandler);
        },

        _unbindPlacementResize() {
            if (!this._placementResizeHandler || typeof window === 'undefined') return;
            window.removeEventListener('resize', this._placementResizeHandler);
            window.removeEventListener('orientationchange', this._placementResizeHandler);
            this._placementResizeHandler = null;
        },

        // Sync stock values to the existing unit bar
        _syncUnitBarStock(game) {
            if (!game) return;
            if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return;

            if (!this._stockBackup) {
                this._stockBackup = { ...(game.playerStock || {}) };
            }

            const stock = { ...(game.playerStock || {}) };
            Object.keys(CONFIG.units).forEach((key) => {
                const cfg = CONFIG.units[key];
                if (!cfg) return;
                if (cfg.hideFromUnitBar === true) return;
                if (cfg.isSkill === true) return;
                stock[key] = 0;
            });

            const storageRemaining = this._getStorageRemainingSlots();
            this._budget.forEach((item) => {
                if (!item || item.source === 'veteran') return;
                const remain = Math.max(0, (item.count - item.placed));
                if (remain <= 0) return;
                if (item.source === 'storage' && storageRemaining <= 0) return;
                stock[item.unitId] = Math.max(0, Math.floor(Number(stock[item.unitId]) || 0)) + remain;
            });

            game.playerStock = stock;
            if (typeof game.setCategory === 'function') {
                const cat = game.currentCategory;
                if (cat !== 'infantry' && cat !== 'armored' && cat !== 'air') {
                    game.setCategory('infantry');
                }
            }
            if (typeof app !== 'undefined') {
                app.markUiDirty();
            }
        },

        _getBudgetSelectKey(item) {
            if (!item || typeof item !== 'object') return '';
            if (item.source === 'veteran') {
                const veteranId = String(item.veteranId || '').trim();
                if (veteranId) return `veteran:${veteranId}`;
            }
            const unitId = String(item.unitId || '').trim();
            const source = String(item.source || '').trim();
            if (!unitId || !source) return '';
            return `${unitId}:${source}`;
        },

        _findBudgetItemBySelectKey(selectKey) {
            const target = String(selectKey || '').trim();
            if (!target) return null;
            return this._budget.find((item) => this._getBudgetSelectKey(item) === target) || null;
        },

        _pickBudgetItemByUnitId(unitId, veteranId = '') {
            const unitKey = String(unitId || '').trim();
            if (!unitKey) return null;
            const vetId = String(veteranId || '').trim();

            if (vetId) {
                const exactVeteran = this._budget.find((b) =>
                    b.unitId === unitKey
                    && b.source === 'veteran'
                    && String(b.veteranId || '').trim() === vetId
                    && b.placed < b.count
                );
                if (exactVeteran) return exactVeteran;
            }

            const given = this._budget.find((b) => b.unitId === unitKey && b.source === 'given' && b.placed < b.count);
            if (given) return given;
            const storageRemaining = this._getStorageRemainingSlots();
            const storage = (storageRemaining > 0)
                ? (this._budget.find((b) => b.unitId === unitKey && b.source === 'storage' && b.placed < b.count) || null)
                : null;
            if (storage) return storage;
            return this._budget.find((b) => b.unitId === unitKey && b.source === 'veteran' && b.placed < b.count) || null;
        },

        selectUnitFromBar(game, unitId, veteranId = '') {
            if (this.phase !== 'placement') return false;
            const item = this._pickBudgetItemByUnitId(unitId, veteranId);
            if (!item) {
                if (typeof ChatPanel !== 'undefined') {
                    ChatPanel.push('배치 가능한 수량이 없는 유닛입니다.', 'WARN');
                }
                return true;
            }
            this._selectedUnit = this._getBudgetSelectKey(item);
            this._renderPalette();
            return true;
        },

        // Render placement palette
        _renderPalette() {
            const uiEl = document.getElementById('skirmish-placement-ui');
            if (uiEl && uiEl.classList.contains('use-main-unit-bar')) return;
            const paletteEl = document.getElementById('skirmish-unit-palette');
            if (!paletteEl) return;
            paletteEl.innerHTML = '';

            const hasConfig = typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units;
            const storageRemaining = this._getStorageRemainingSlots();
            const storageUnitRemaining = this._budget.reduce((sum, item) => {
                if (!item || item.source !== 'storage') return sum;
                return sum + Math.max(0, Math.floor(Number(item.count - item.placed) || 0));
            }, 0);
            const storageLabel = this._hasUnlimitedStorageSlots()
                ? `${storageUnitRemaining}기`
                : `${Math.max(0, Math.floor(Number(storageRemaining) || 0))}기`;
            const veteranItems = this._budget.filter((b) => b.source === 'veteran' && (b.count - b.placed) > 0);

            // Remaining given units
            const givenItems = this._budget.filter((b) => b.source === 'given' && (b.count - b.placed) > 0);
            const storageItems = this._budget.filter((b) =>
                b.source === 'storage'
                && storageRemaining > 0
                && (b.count - b.placed) > 0
            );

            const appendDivider = () => {
                const sep = document.createElement('div');
                sep.style.cssText = 'width:1px;height:40px;background:#475569;margin:0 4px;flex-shrink:0;';
                paletteEl.appendChild(sep);
            };

            let hasSection = false;

            // Veteran section
            if (veteranItems.length > 0) {
                if (hasSection) appendDivider();
                const label = document.createElement('div');
                label.className = 'skirmish-unit-card-name';
                label.style.cssText = 'color:#f59e0b;font-size:0.6rem;min-width:44px;display:flex;align-items:center;';
                label.textContent = '베테랑';
                paletteEl.appendChild(label);

                veteranItems.forEach((item) => {
                    this._createCard(paletteEl, item, hasConfig, true);
                });
                hasSection = true;
            }

            // Given-unit section
            if (givenItems.length > 0) {
                if (hasSection) appendDivider();
                const label = document.createElement('div');
                label.className = 'skirmish-unit-card-name';
                label.style.cssText = 'color:#60a5fa;font-size:0.6rem;min-width:40px;display:flex;align-items:center;';
                label.textContent = '지급';
                paletteEl.appendChild(label);

                givenItems.forEach(item => {
                    this._createCard(paletteEl, item, hasConfig, true);
                });
                hasSection = true;
            }

            // Storage-unit section
            if (this._storageSlots > 0) {
                if (hasSection) appendDivider();

                const label2 = document.createElement('div');
                label2.className = 'skirmish-unit-card-name';
                label2.style.cssText = 'color:#fbbf24;font-size:0.6rem;min-width:40px;display:flex;align-items:center;flex-direction:column;';
                label2.innerHTML = `보관<br><span style="color:#94a3b8;font-size:0.55rem;">${storageLabel}</span>`;
                paletteEl.appendChild(label2);

                storageItems.forEach(item => {
                    const canPlace = storageRemaining > 0;
                    this._createCard(paletteEl, item, hasConfig, canPlace);
                });
                hasSection = true;
            }

            if (!hasSection) {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'skirmish-unit-card-name';
                emptyEl.style.cssText = 'display:flex;align-items:center;padding:0 10px;font-size:0.7rem;color:#94a3b8;white-space:nowrap;';
                emptyEl.textContent = '배치 가능한 유닛이 없습니다.';
                paletteEl.appendChild(emptyEl);
            }
        },

        _createCard(container, item, hasConfig, canPlace) {
            const remaining = item.count - item.placed;
            const isStorage = item.source === 'storage';
            const isVeteran = item.source === 'veteran';
            const selKey = this._getBudgetSelectKey(item);
            const depleted = remaining <= 0 || (!canPlace && isStorage);

            const card = document.createElement('div');
            card.className = 'skirmish-unit-card';
            if (selKey === this._selectedUnit) card.classList.add('selected');
            if (depleted) card.classList.add('depleted');
            if (isStorage) card.style.borderColor = '#92400e';
            if (isVeteran) card.style.borderColor = '#f59e0b';

            const unitConfig = hasConfig ? CONFIG.units[item.unitId] : null;
            const baseName = unitConfig ? unitConfig.name : item.unitId;
            const veteranName = String(item.veteranName || '').trim();
            const displayName = isVeteran
                ? (veteranName || baseName)
                : baseName;

            const nameEl = document.createElement('div');
            nameEl.className = 'skirmish-unit-card-name';
            nameEl.textContent = isVeteran ? `★ ${displayName}` : displayName;

            const countEl = document.createElement('div');
            countEl.className = 'skirmish-unit-card-count';
            countEl.textContent = (isStorage || isVeteran) ? `${remaining}기` : `${remaining}/${item.count}`;

            card.appendChild(nameEl);
            card.appendChild(countEl);

            card.addEventListener('click', () => {
                if (depleted) return;
                this._selectedUnit = selKey;
                this._renderPalette();
            });

            container.appendChild(card);
        },

        // Bind click/touch-to-deploy handler
        _bindPlacementClick(game) {
            const canvas = game.canvas;
            if (!canvas) return;

            const readClientPoint = (evt) => {
                let clientX = Number(evt?.clientX);
                let clientY = Number(evt?.clientY);
                if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
                    const touch = (evt?.changedTouches && evt.changedTouches[0])
                        ? evt.changedTouches[0]
                        : ((evt?.touches && evt.touches[0]) ? evt.touches[0] : null);
                    clientX = Number(touch?.clientX);
                    clientY = Number(touch?.clientY);
                }
                if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
                return { clientX, clientY };
            };

            const handlePlacement = (e) => {
                if (this.phase !== 'placement') return;
                if (e && e.cancelable) e.preventDefault();
                if (!this._selectedUnit) {
                    if (typeof ChatPanel !== 'undefined') {
                        ChatPanel.push('유닛 생성바에서 유닛을 먼저 선택하세요.', 'WARN');
                    }
                    return;
                }

                const budgetItem = this._findBudgetItemBySelectKey(this._selectedUnit);
                if (!budgetItem) return;
                if (budgetItem.placed >= budgetItem.count) return;
                const unitId = String(budgetItem.unitId || '').trim();
                const source = String(budgetItem.source || '').trim();
                if (!unitId || !source) return;

                // Validate storage slot limits
                if (source === 'storage') {
                    const storageRemaining = this._getStorageRemainingSlots();
                    if (storageRemaining <= 0) {
                        if (typeof ChatPanel !== 'undefined') {
                            ChatPanel.push('보관 배치 수량을 모두 사용했습니다.', 'WARN');
                        }
                        return;
                    }
                }

                if (source === 'veteran') {
                    const veteranId = String(budgetItem.veteranId || '').trim();
                    const remain = Math.max(0, Math.floor(Number(game.playerVeteranStock?.[veteranId]) || 0));
                    if (!veteranId || remain <= 0) {
                        if (typeof ChatPanel !== 'undefined') {
                            ChatPanel.push('베테랑 출격 가능 수량이 없습니다.', 'WARN');
                        }
                        return;
                    }
                }

                // Convert click position to world X
                const rect = canvas.getBoundingClientRect();
                const point = readClientPoint(e);
                if (!point) return;
                if (point.clientX < rect.left || point.clientX > rect.right || point.clientY < rect.top || point.clientY > rect.bottom) {
                    return;
                }
                const scaleRatio = game.scaleRatio || 1;
                let clickX = (point.clientX - rect.left) / scaleRatio + (game.cameraX || 0);
                if (typeof Camera !== 'undefined' && Camera && typeof Camera.screenToView === 'function') {
                    const viewPos = Camera.screenToView(game, point.clientX, point.clientY);
                    if (viewPos && Number.isFinite(Number(viewPos.x))) {
                        clickX = Number(viewPos.x) + (game.cameraX || 0);
                    }
                }

                // Deployable region: left 35% of map
                const mapW = (typeof CONFIG !== 'undefined' && CONFIG.mapWidth) ? CONFIG.mapWidth : 6000;
                const maxPlaceX = mapW * 0.35;

                if (clickX < 0 || clickX > maxPlaceX) {
                    if (typeof ChatPanel !== 'undefined') {
                        ChatPanel.push('좌측 영역에서만 배치할 수 있습니다.', 'WARN');
                    }
                    return;
                }

                // Spawn selected unit
                const bypassBlock = this._canBypassSpawnBlock(unitId);
                let spawnArg = bypassBlock;
                if (source === 'veteran') {
                    const veteranId = String(budgetItem.veteranId || '').trim();
                    const veteranMeta = veteranId ? game.playerVeteransById?.[veteranId] : null;
                    if (!veteranMeta) {
                        if (typeof ChatPanel !== 'undefined') {
                            ChatPanel.push('베테랑 정보를 불러오지 못했습니다.', 'WARN');
                        }
                        return;
                    }
                    spawnArg = { bypassBlock, veteran: veteranMeta };
                }
                const unit = game.spawnUnitDirect(unitId, clickX, game.groundY, 'player', spawnArg);
                if (unit) {
                    unit.commandMode = 'stop';
                    budgetItem.placed++;

                    // Storage deployment: consume skirmish placement slots only.
                    // Do not mutate city inventory in skirmish (win/lose both non-destructive).
                    if (source === 'storage') {
                        if (!this._hasUnlimitedStorageSlots()) {
                            this._storagePlaced++;
                        }
                    }

                    // Veteran deployment: decrement per-battle veteran stock
                    if (source === 'veteran') {
                        const veteranId = String(budgetItem.veteranId || '').trim();
                        if (veteranId && game.playerVeteranStock && typeof game.playerVeteranStock === 'object') {
                            const current = Math.max(0, Math.floor(Number(game.playerVeteranStock[veteranId]) || 0));
                            game.playerVeteranStock[veteranId] = Math.max(0, current - 1);
                        }
                    }

                    this._syncUnitBarStock(game);
                    this._renderPalette();
                    this._updateReadyButtonState();

                    // ?뚯쭊 ???먮룞?좏깮?섏? ?딄퀬 ?좏깮 ?곹깭 ?댁젣
                    const storageExhausted = (source === 'storage')
                        && !this._hasUnlimitedStorageSlots()
                        && (this._storagePlaced >= this._storageSlots);
                    if (budgetItem.placed >= budgetItem.count || storageExhausted) {
                        this._selectedUnit = null;
                        this._renderPalette();
                    }
                }
            };

            this._placementListener = (e) => {
                // Ignore synthetic click fired right after touchstart.
                if (e && e.type === 'click') {
                    const elapsed = Date.now() - (this._placementLastTouchAt || 0);
                    if (elapsed >= 0 && elapsed < 450) return;
                }
                handlePlacement(e);
            };
            this._placementTouchListener = (e) => {
                this._placementLastTouchAt = Date.now();
                handlePlacement(e);
            };

            canvas.addEventListener('click', this._placementListener);
            canvas.addEventListener('touchstart', this._placementTouchListener, { passive: false });
        },

        _unbindPlacementClick() {
            if (this._game && this._game.canvas) {
                if (this._placementListener) {
                    this._game.canvas.removeEventListener('click', this._placementListener);
                }
                if (this._placementTouchListener) {
                    this._game.canvas.removeEventListener('touchstart', this._placementTouchListener);
                }
            }
            this._placementListener = null;
            this._placementTouchListener = null;
            this._placementLastTouchAt = 0;
        },

        // "Ready" button handler
        onReadyClick(game) {
            if (this.phase !== 'placement') return;

            // Require at least one unit placed
            const totalPlaced = this._getTotalPlacedCount();
            if (totalPlaced === 0) {
                if (typeof ChatPanel !== 'undefined') {
                    ChatPanel.push('최소 1기 이상 유닛을 배치하세요.', 'WARN');
                }
                return;
            }

            this._unbindPlacementClick();
            this._hidePlacementUI();
            this.startCountdown(game);
        },

        // Countdown before battle starts
        startCountdown(game) {
            if (!this.isActive) return;
            this._clearCountdownTimers();
            this.phase = 'countdown';
            this._hidePlacementUI();
            const overlay = document.getElementById('skirmish-countdown');
            const numEl = document.getElementById('skirmish-countdown-num');
            if (!overlay || !numEl) {
                this.startBattle(game);
                return;
            }

            overlay.classList.remove('hidden');
            const sequence = ['3', '2', '1', '전투 시작!'];
            let idx = 0;

            numEl.textContent = sequence[0];
            numEl.style.animation = 'none';
            void numEl.offsetWidth;
            numEl.style.animation = '';

            const step = () => {
                if (!this.isActive || this.phase !== 'countdown') return;
                idx++;
                if (idx < sequence.length) {
                    numEl.textContent = sequence[idx];
                    numEl.style.animation = 'none';
                    void numEl.offsetWidth;
                    numEl.style.animation = '';

                    if (idx === sequence.length - 1) {
                        this._trackCountdownTimeout(setTimeout(() => {
                            if (!this.isActive || this.phase !== 'countdown') return;
                            overlay.classList.add('hidden');
                            this.startBattle(game);
                        }, 800));
                    } else {
                        this._trackCountdownTimeout(setTimeout(step, 1000));
                    }
                }
            };

            this._trackCountdownTimeout(setTimeout(step, 1000));
        },

        // Start active battle phase
        startBattle(game) {
            if (!this.isActive || this.phase === 'battle') return;
            this._clearCountdownTimers();
            this.phase = 'battle';
            this._applyPredeployHudPolicy(false);
            const overlay = document.getElementById('skirmish-countdown');
            if (overlay) overlay.classList.add('hidden');

            if (game && typeof game.cancelTargeting === 'function') {
                game.cancelTargeting();
            }
            if (game) {
                game.selectedBuilding = null;
                if (typeof game.updateHUDSelection === 'function') {
                    game.updateHUDSelection();
                }
            }
            if (typeof HUD !== 'undefined' && HUD && typeof HUD.hideProductionArea === 'function') {
                HUD.hideProductionArea();
            }

            // Safety: ensure stage objective structures still exist before unfreeze.
            const mapW = (typeof CONFIG !== 'undefined' && Number.isFinite(Number(CONFIG.mapWidth)))
                ? Number(CONFIG.mapWidth)
                : 6000;
            this._preDeployEnemyStructures(game, this._getStageId(), mapW);

            this._unfreezeAllUnits(game);
            this._startCasualtyWatch(game);

            if (typeof ChatPanel !== 'undefined') {
                ChatPanel.push('전투가 시작되었습니다.', 'INFO');
            }
        },

        // Cleanup on exit
        cleanup() {
            this._unbindPlacementClick();
            this._hidePlacementUI();
            this._stopStageAudio();
            this._clearCountdownTimers();

            const overlay = document.getElementById('skirmish-countdown');
            if (overlay) overlay.classList.add('hidden');

            if (this._stockBackup && this._game) {
                this._game.playerStock = { ...this._stockBackup };
                if (typeof app !== 'undefined') {
                    app.markUiDirty();
                }
            }

            this.isActive = false;
            this.phase = 'idle';
            this.stageData = null;
            this._game = null;
            this._budget = [];
            this._storageSlots = 0;
            this._storagePlaced = 0;
            this._selectedUnit = null;
            this._stockBackup = null;
            this._countdownTimeouts = null;
            this._deployBypassUnits = null;
            this._unbindPlacementResize();
        }
    };

    global.SkirmishMode = SkirmishMode;
})(window);

