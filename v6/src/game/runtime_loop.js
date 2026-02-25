(function (global) {
    'use strict';

    function updateUnitVelocity(unit, prevX, prevY) {
        if (!unit) return;
        const x0 = Number(prevX);
        const y0 = Number(prevY);
        const x1 = Number(unit.x);
        const y1 = Number(unit.y);
        const vx = (Number.isFinite(x0) && Number.isFinite(x1)) ? (x1 - x0) : 0;
        const vy = (Number.isFinite(y0) && Number.isFinite(y1)) ? (y1 - y0) : 0;
        unit.vx = Number.isFinite(vx) ? vx : 0;
        unit.vy = Number.isFinite(vy) ? vy : 0;
    }

    function drawCaptureControlOverlay(game, ctx) {
        const state = game && game._captureControlState;
        if (!state || !ctx) return;

        const frame = Number(game.frame) || 0;
        const enemyRisk = Math.max(0, Math.min(100, Number(state.enemyRisk) || 0));
        const playerCapture = Math.max(0, Math.min(100, Number(state.playerCapture) || 0));
        const threshold = Math.max(1, Number(state.threshold) || 5);
        const enemyCount = Math.max(0, Number(state.enemyCount) || 0);
        const playerCount = Math.max(0, Number(state.playerCount) || 0);
        const enemyActive = enemyCount >= threshold;
        const playerActive = playerCount >= threshold;

        const holdUntil = Number(state.showUntilFrame) || 0;
        const hasValue = enemyRisk > 0.05 || playerCapture > 0.05;
        if (!enemyActive && !playerActive && (!hasValue || frame > holdUntil)) return;

        let mode = String(state.displayMode || '').toLowerCase();
        if (mode !== 'enemy' && mode !== 'player') {
            mode = enemyRisk >= playerCapture ? 'enemy' : 'player';
        }

        const value = mode === 'enemy' ? enemyRisk : playerCapture;
        if (value <= 0.05) return;

        let alpha = 0.93;
        if (!enemyActive && !playerActive) {
            const fadeFrames = 42;
            const fadeStart = holdUntil - fadeFrames;
            if (frame >= fadeStart) {
                const fade = Math.max(0, Math.min(1, (holdUntil - frame) / Math.max(1, fadeFrames)));
                alpha *= fade;
            }
        }
        if (alpha <= 0.01) return;

        const label = mode === 'enemy' ? '점령 위험도' : '점령도';
        const barColor = mode === 'enemy' ? '#ef4444' : '#22c55e';
        const glowColor = mode === 'enemy' ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)';
        const panelW = Math.max(240, Math.min(420, (Number(game.width) || 1280) * 0.42));
        const panelH = panelW > 320 ? 62 : 56;
        const x = ((Number(game.width) || 1280) - panelW) * 0.5;
        const y = Math.max(54, Math.floor((Number(game.height) || 840) * 0.33));
        const barPad = 16;
        const barW = panelW - (barPad * 2);
        const barH = 10;
        const barY = y + panelH - barH - 12;
        const textY = y + 10;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(2,6,23,0.76)';
        ctx.fillRect(x, y, panelW, panelH);
        ctx.strokeStyle = 'rgba(148,163,184,0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, panelW - 1, panelH - 1);

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 16px "Orbitron", sans-serif';
        ctx.fillText(`${label} ${Math.round(value)}%`, x + panelW / 2, textY);

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(51,65,85,0.88)';
        ctx.fillRect(x + barPad, barY, barW, barH);
        ctx.fillStyle = barColor;
        ctx.fillRect(x + barPad, barY, barW * (value / 100), barH);
        ctx.strokeStyle = 'rgba(226,232,240,0.35)';
        ctx.strokeRect(x + barPad + 0.5, barY + 0.5, barW - 1, barH - 1);

        ctx.restore();
    }

    function loop(game) {
        if (!game.running) {
            if (typeof AudioSystem !== 'undefined'
                && AudioSystem
                && typeof AudioSystem.stopBattleMovementAmbience === 'function') {
                try { AudioSystem.stopBattleMovementAmbience(); } catch (_) { }
            }
            return;
        }

        // [New] Speed Logic
        // 1x: Update once
        // 2x: Update twice
        // 0.5x: Update every other frame

        // [FIX] Use engineFrame to prevent freeze (game.frame only updates inside game.update)
        game.engineFrame = (game.engineFrame || 0) + 1;

        let updates = 1;
        if (game.paused) updates = 0;
        else if (game.speed === 2) updates = 2;
        else if (game.speed === 0.5 && game.engineFrame % 2 !== 0) updates = 0;

        let updateFailed = false;
        for (let i = 0; i < updates; i++) {
            try {
                game.update();
            } catch (e) {
                updateFailed = true;
                game._reportLoopError('update', e);
                break;
            }
        }

        if (updates > 0 || game.paused || updateFailed) {
            try {
                game.draw();
            } catch (e) {
                game._reportLoopError('draw', e);
                // 첫 프레임 draw 실패 시 완전한 검은 화면으로 보이는 현상을 방지한다.
                game._drawFallbackFrame();
            }
        }

        if (typeof AudioSystem !== 'undefined'
            && AudioSystem
            && typeof AudioSystem.updateBattleMovementAmbience === 'function') {
            try {
                AudioSystem.updateBattleMovementAmbience(game, { paused: !!game.paused });
            } catch (e) {
                game._reportLoopError('audio:movement', e);
            }
        }

        game.loopId = requestAnimationFrame(() => game.loop());
    }

    function update(game) {
        if (game.isGameOver) return;
        game.frame++; // Always increment frame internally? No, frame should track logic ticks.
        // Actually, if we skip update, frame doesn't increment.
        // If we double update, frame increments twice.
        // This is correct for game logic time.

        if (game.landingIntroController && typeof game.landingIntroController.update === 'function') {
            try {
                game.landingIntroController.update(1 / 60);
                if (typeof game.landingIntroController.isFinished === 'function' && game.landingIntroController.isFinished()) {
                    if (typeof game._clearLandingIntroController === 'function') game._clearLandingIntroController();
                    else game.landingIntroController = null;
                }
            } catch (e) {
                game._reportLoopError('landing-intro:update', e);
                if (typeof game._clearLandingIntroController === 'function') game._clearLandingIntroController();
                else game.landingIntroController = null;
            }
        }

        if (game._landingSpawnUiLocked === true) {
            let shouldUnlock = false;
            const ctrl = game.landingIntroController;
            if (!ctrl) {
                shouldUnlock = true;
            } else if (typeof ctrl.getDebugState === 'function') {
                const state = ctrl.getDebugState();
                const crafts = Array.isArray(state && state.crafts) ? state.crafts : [];
                shouldUnlock = crafts.some((c) => c && (c.state === 'ramp_open' || c.state === 'hold' || c.state === 'done'));
            } else if (typeof window !== 'undefined') {
                const state = window.__RECLAIM_LANDING_INTRO_STATE__;
                const crafts = Array.isArray(state && state.crafts) ? state.crafts : [];
                shouldUnlock = crafts.some((c) => c && (c.state === 'ramp_open' || c.state === 'hold' || c.state === 'done'));
            }
            if (shouldUnlock && typeof game._setLandingSpawnUiLocked === 'function') {
                game._setLandingSpawnUiLocked(false, 'first-craft-ramp-open');
            }
        }

        const panLeft = !!game._cameraPanLeftKey;
        const panRight = !!game._cameraPanRightKey;
        if (!game.paused && (panLeft || panRight)) {
            const cameraLocked = (typeof game.isCameraLocked === 'function')
                ? !!game.isCameraLocked()
                : !!game.cameraLockActive;
            if (!cameraLocked) {
                const panStep = 18;
                let dx = 0;
                if (panLeft) dx -= panStep;
                if (panRight) dx += panStep;
                if (dx !== 0) {
                    game.cameraX += dx;
                    if (typeof Camera !== 'undefined' && typeof Camera.clampCameraX === 'function') {
                        game.cameraX = Camera.clampCameraX(game, game.cameraX);
                    } else {
                        const maxX = Math.max(0, (CONFIG.mapWidth || game.width || 0) - (game.width || 0));
                        game.cameraX = Math.max(0, Math.min(game.cameraX, maxX));
                    }
                }
            }
        }

        // [NEW] Update Timer UI (once per second)
        if (game.$hudTimer) {
            const t = Math.floor(game.frame / 60);
            const min = Math.floor(t / 60).toString().padStart(2, '0');
            const sec = (t % 60).toString().padStart(2, '0');
            const text = `${min}:${sec}`;
            if (text !== game._lastTimerText) {
                game._lastTimerText = text;
                game.$hudTimer.textContent = text;
            }
        }

        if (typeof BattleEconomy !== 'undefined'
            && BattleEconomy
            && typeof BattleEconomy.regenerate === 'function') {
            BattleEconomy.regenerate(game);
        } else {
            if (game.supply < CONFIG.maxSupply) game.supply += CONFIG.supplyRate;
            const enemySupplyRate = Number(game.enemySupplyRate);
            const enemyRate = Number.isFinite(enemySupplyRate) ? Math.max(0, enemySupplyRate) : CONFIG.supplyRate;
            if (game.enemySupply < CONFIG.maxSupply) game.enemySupply += enemyRate;
        }

        game.processQueue();

        for (let k in game.cooldowns) if (game.cooldowns[k] > 0) game.cooldowns[k]--;
        for (let k in game.enemyCooldowns) if (game.enemyCooldowns[k] > 0) game.enemyCooldowns[k]--;

        // [NEW] 작업자 건설 쿨타임 감소
        if (game.builderCooldown > 0) game.builderCooldown--;

        if (game.empTimer > 0) {
            game.empTimer--;
            // [P0-4] 상태 변화 시에만 class 토글 (DOM 쿼리 캐싱)
            const shouldBeActive = game.empTimer > 0;
            if (game._empWasActive !== shouldBeActive && game.$empFlash) {
                game.$empFlash.classList.toggle('active', shouldBeActive);
                game._empWasActive = shouldBeActive;
            }
        } else if (game._empWasActive && game.$empFlash) {
            game.$empFlash.classList.remove('active');
            game._empWasActive = false;
        }

        if (game.civilianGlobalPanic > 0) {
            game.civilianGlobalPanic--;
        }

        // [P0-2] 단일 패스: dead 제거 + player/enemy 분류 + HQ 탐색
        game.playerBuildings.length = 0;
        game.enemyBuildings.length = 0;
        let playerHQ = null;
        let enemyHQ = null;
        let writeIdx = 0;
        for (let i = 0; i < game.buildings.length; i++) {
            const b = game.buildings[i];
            if (!b.dead) {
                game.buildings[writeIdx++] = b;
                if (b.team === 'player') {
                    game.playerBuildings.push(b);
                    if (b.type === 'hq_player') playerHQ = b;
                } else if (b.team === 'enemy') {
                    game.enemyBuildings.push(b);
                    if (b.type === 'hq_enemy') enemyHQ = b;
                }
            }
        }
        game.buildings.length = writeIdx;

        const elapsedSeconds = game.frame / 60; // 60 FPS 기준

        // 생존한 유닛 수 계산 (allocation-free)
        const alivePlayerUnits = countAliveUnits(game.players);
        const aliveEnemyUnits = countAliveUnits(game.enemies);
        if (alivePlayerUnits > 0) game.playerEverSeen = true;
        if (aliveEnemyUnits > 0) game.enemyEverSeen = true;

        if (typeof GameNews !== 'undefined' && GameNews.update) {
            GameNews.update(game, elapsedSeconds, playerHQ);
        }

        if (typeof GameVictory !== 'undefined' && GameVictory.check) {
            GameVictory.check(game, elapsedSeconds, playerHQ, alivePlayerUnits, aliveEnemyUnits);
        }
        if (game.isGameOver) return;

        // [P1] 시체 생성 버스트 완화: 프레임당 예산만큼 처리
        game._processCorpseSpawnQueue();

        // 국지전 배치/카운트다운 중에는 유닛 update 스킵 (이동/공격 금지)
        const skirmishPhase = (game._skirmishMode
            && typeof SkirmishMode !== 'undefined'
            && SkirmishMode
            && SkirmishMode.isActive)
            ? String(SkirmishMode.phase || '')
            : '';
        const skirmishFrozen = skirmishPhase === 'placement' || skirmishPhase === 'countdown';

        // [OPT] update + compaction single pass
        let writePlayer = 0;
        for (let i = 0; i < game.players.length; i++) {
            const u = game.players[i];
            const prevX = Number(u && u.x);
            const prevY = Number(u && u.y);
            if (!skirmishFrozen) u.update(game.enemies, game.enemyBuildings);
            if (!u.dead && typeof u.applyGroundLanePostUpdate === 'function') {
                u.applyGroundLanePostUpdate();
            }
            updateUnitVelocity(u, prevX, prevY);
            if (!u.dead) game.players[writePlayer++] = u;
        }
        game.players.length = writePlayer;

        let writeEnemy = 0;
        for (let i = 0; i < game.enemies.length; i++) {
            const u = game.enemies[i];
            const prevX = Number(u && u.x);
            const prevY = Number(u && u.y);
            if (!skirmishFrozen) u.update(game.players, game.playerBuildings);
            if (!u.dead && typeof u.applyGroundLanePostUpdate === 'function') {
                u.applyGroundLanePostUpdate();
            }
            updateUnitVelocity(u, prevX, prevY);
            if (!u.dead) game.enemies[writeEnemy++] = u;
        }
        game.enemies.length = writeEnemy;

        let writeCivilian = 0;
        for (let i = 0; i < game.civilians.length; i++) {
            const u = game.civilians[i];
            const prevX = Number(u && u.x);
            const prevY = Number(u && u.y);
            // Keep neutral civilians moving during skirmish placement/countdown.
            u.update(game.enemies, game.enemyBuildings);
            updateUnitVelocity(u, prevX, prevY);
            if (!u.dead) game.civilians[writeCivilian++] = u;
        }
        game.civilians.length = writeCivilian;

        if (!skirmishFrozen) {
            for (let i = 0; i < game.buildings.length; i++) {
                const b = game.buildings[i];
                if (!b || b.dead) continue;
                try {
                    b.update(game.enemies, game.players);
                } catch (e) {
                    game._reportLoopError('building:update', e);
                }
            }
        }

        let writeProjectile = 0;
        for (let i = 0; i < game.projectiles.length; i++) {
            const p = game.projectiles[i];
            p.update();
            if (!p.dead) game.projectiles[writeProjectile++] = p;
        }
        game.projectiles.length = writeProjectile;

        let writeParticle = 0;
        for (let i = 0; i < game.particles.length; i++) {
            const p = game.particles[i];
            p.update();
            if (p.life > 0) game.particles[writeParticle++] = p;
        }
        game.particles.length = writeParticle;

        // [NEW] 잔해 업데이트
        let writeWreckage = 0;
        for (let i = 0; i < game.wreckages.length; i++) {
            const w = game.wreckages[i];
            w.update();
            if (w.life > 0) game.wreckages[writeWreckage++] = w;
        }
        game.wreckages.length = writeWreckage;

        // [NEW] 보병 시체 업데이트
        let writeCorpse = 0;
        for (let i = 0; i < game.corpses.length; i++) {
            const c = game.corpses[i];
            if (!c) continue;
            if (!c.fallen || c.knockbackFrame < c.knockbackFrames) {
                c.update();
            }
            const keepCorpse = (Number.isFinite(c.deadAt) && Number.isFinite(game.frame))
                ? ((game.frame - c.deadAt) < c.fadeTimer)
                : (c.fadeTimer > 0);
            if (keepCorpse) game.corpses[writeCorpse++] = c;
        }
        game.corpses.length = writeCorpse;

        // [NEW] 건설 중인 건물 업데이트
        game.updateConstructions();

        // [NEW] Camera lock follow
        game.applyCameraLock();

        // [VFX] decay
        if (game.shake > 0.01) {
            game.shake *= game.shakeDecay;
            if (game.shake < 0.15) game.shake = 0;
        } else {
            game.shake = 0;
        }
        if (game.flash > 0.01) {
            game.flash *= game.flashDecay;
            if (game.flash < 0.02) game.flash = 0;
        } else {
            game.flash = 0;
        }

        // 국지전 모드에서는 AI 스폰 완전 차단 (모든 페이즈)
        if (typeof AI !== 'undefined' && !game._skirmishMode) {
            AI.update(game.frame);
        }

        // [FIX] 쿨타임/큐가 진행 중이면 매 프레임 UI 갱신 필요
        if (typeof app !== 'undefined') {
            // 쿨타임이 진행 중이거나 큐가 있으면 uiDirty (allocation-free)
            const hasCooldown = hasPositiveValue(game.cooldowns);
            const hasQueue = hasPositiveValue(game.spawnQueue);
            if (hasCooldown || hasQueue) {
                app.markUiDirty();
            }
        }

        if (game.frame % 5 === 0) {
            game.renderUI();
        }

        // Minimap rendering removed.
    }

    function renderUI(game) {
        // [CHANGE][APP] UI 갱신 경로 단일화
        // - 기존: ui.updateUnitButtons(), ui.setSkillCount() ... 분산 호출
        // - 변경: app.commit() 한 번에서만 UI + 저장 처리
        if (typeof app !== 'undefined') app.commit('tick');
    }

    function draw(game) {
        const ctx = game.ctx;
        const safeDrawCall = (scope, fn) => {
            try {
                fn();
                return true;
            } catch (e) {
                game._reportLoopError(scope, e);
                return false;
            }
        };

        // [FIX][ZOOM-ARTIFACT] always clear whole screen in screen-space
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, game.width, game.height);
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(0, 0, game.width, game.height);

        const cameraPivotYRaw = (typeof game.getCameraPivotY === 'function')
            ? Number(game.getCameraPivotY())
            : Number(game.groundY);
        const cameraPivotY = Number.isFinite(cameraPivotYRaw) ? cameraPivotYRaw : Number(game.groundY || 0);
        const zoomNow = (typeof Camera !== 'undefined' && Number.isFinite(Number(Camera.zoom)) && Number(Camera.zoom) > 0)
            ? Number(Camera.zoom)
            : 1;
        const mapDrawWidth = Math.max(1, game.width / zoomNow);
        const worldPad = Math.max(1, 2 / zoomNow);
        const mapTopWorld = (cameraPivotY + ((0 - cameraPivotY) / zoomNow)) - worldPad;
        const mapBottomWorld = (cameraPivotY + ((game.height - cameraPivotY) / zoomNow)) + worldPad;
        const mapDrawHeight = Math.max(1, mapBottomWorld - mapTopWorld);
        const mapGroundY = Number(game.groundY || 0) - mapTopWorld;

        if (typeof Maps !== 'undefined') {
            // Apply the same zoom pivot to map layers so background/units scale together.
            ctx.save();
            ctx.translate(0, cameraPivotY);
            ctx.scale(zoomNow, zoomNow);
            ctx.translate(0, -cameraPivotY);
            // Draw map in the exact world-space slice visible on screen to avoid blue gutters/clipping.
            ctx.translate(0, mapTopWorld);

            const drewBase = safeDrawCall('draw:map-base', () => {
                Maps.drawBase(ctx, mapDrawWidth, mapDrawHeight, mapGroundY, game.cameraX);
            });
            if (!drewBase) {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(0, 0, mapDrawWidth, mapDrawHeight);
                ctx.fillStyle = '#334155';
                ctx.fillRect(0, mapGroundY, mapDrawWidth, mapDrawHeight - mapGroundY);
            }

            safeDrawCall('draw:map-decorations', () => {
                Maps.drawDecorations(
                    ctx,
                    mapDrawWidth,
                    mapDrawHeight,
                    mapGroundY,
                    game.cameraX
                );
            });

            if (typeof Maps.drawThreatOverlay === 'function') {
                safeDrawCall('draw:map-threat-overlay', () => {
                    Maps.drawThreatOverlay(
                        ctx,
                        mapDrawWidth,
                        mapDrawHeight,
                        mapGroundY,
                        game.cameraX,
                        1
                    );
                });
            }

            ctx.restore();
        }

        ctx.save();
        ctx.translate(0, cameraPivotY);
        ctx.scale(Camera.zoom, Camera.zoom);
        ctx.translate(0, -cameraPivotY);
        ctx.translate(-Math.floor(game.cameraX), 0);

        if (game.landingIntroController && typeof game.landingIntroController.draw === 'function') {
            try {
                game.landingIntroController.draw(ctx);
            } catch (e) {
                game._reportLoopError('landing-intro:draw', e);
                if (typeof game._clearLandingIntroController === 'function') game._clearLandingIntroController();
                else game.landingIntroController = null;
            }
        }

        // [VFX] world-layer shake (screen 기준 고정)
        if (game.shake > 0.01) {
            const j = game.shake / Math.max(0.01, Camera.zoom);
            ctx.translate((Math.random() - 0.5) * j * 2, (Math.random() - 0.5) * j * 2);
        }
        for (let i = 0; i < game.buildings.length; i++) {
            const b = game.buildings[i];
            if (!b || b.dead) continue;
            try {
                b.draw(ctx);
            } catch (e) {
                game._reportLoopError('draw:building', e);
            }
        }

        // [NEW] 잔해 렌더링 (유닛보다 뒤, 건물 앞)
        game.wreckages.forEach(w => w.draw(ctx));

        // [NEW] 보병 시체 렌더링 (잔해 위, 유닛 뒤)
        const doCorpseProfile = !!(game.debug && game.debug.corpseProfile && typeof performance !== 'undefined' && performance.now);
        const corpseProfileEvery = (game.debug && Number.isFinite(game.debug.corpseProfileEvery) && game.debug.corpseProfileEvery > 0)
            ? game.debug.corpseProfileEvery
            : 120;
        const corpseDrawStart = doCorpseProfile ? performance.now() : 0;
        const z = (typeof Camera !== 'undefined' && Camera.zoom) ? Camera.zoom : 1;
        const pad = Number.isFinite(game.corpseCullPadding) ? game.corpseCullPadding : 0;
        const viewLeft = game.cameraX - pad / z;
        const viewRight = game.cameraX + (game.width + pad) / z;
        const viewTop = cameraPivotY + ((-pad - cameraPivotY) / z);
        const viewBottom = cameraPivotY + ((game.height + pad - cameraPivotY) / z);
        game.corpses.forEach(c => {
            if (!c) return;
            if (c.x < viewLeft || c.x > viewRight || c.y < viewTop || c.y > viewBottom) return;
            c.draw(ctx);
        });
        if (doCorpseProfile && (game.frame % corpseProfileEvery === 0)) {
            const dt = performance.now() - corpseDrawStart;
            console.log(`[perf] corpses=${game.corpses.length} draw=${dt.toFixed(2)}ms`);
        }

        game.civilians.forEach(u => u.draw(ctx));

        // [FIX] 건설 진행 UI는 유닛보다 뒤(배경 레이어)에 렌더링
        if (game.constructingBuildings) {
            game.constructingBuildings.forEach(c => {
                if (c.dead) return;
                game.drawConstructingBuilding(ctx, c);
            });
        }

        const isInfantryUnit = (u) => {
            if (!u || !u.stats) return false;
            return String(u.stats.category || '') === 'infantry';
        };
        const getUnitSortY = (u) => {
            if (!u) return 0;
            const renderY = (typeof u.getRenderY === 'function')
                ? Number(u.getRenderY())
                : Number(u.y);
            return Number.isFinite(renderY) ? renderY : Number(u.y || 0);
        };
        const drawUnitsDepthSorted = (...lists) => {
            const units = [];
            for (let li = 0; li < lists.length; li++) {
                const list = lists[li];
                if (!Array.isArray(list) || list.length <= 0) continue;
                for (let i = 0; i < list.length; i++) {
                    const u = list[i];
                    if (!u || u.dead) continue;
                    units.push(u);
                }
            }
            if (units.length <= 0) return;
            units.sort((a, b) => {
                const ay = getUnitSortY(a);
                const by = getUnitSortY(b);
                if (ay !== by) return ay - by;
                const aInf = isInfantryUnit(a) ? 1 : 0;
                const bInf = isInfantryUnit(b) ? 1 : 0;
                if (aInf !== bInf) return aInf - bInf;
                const aPlayer = (a.team === 'player') ? 1 : 0;
                const bPlayer = (b.team === 'player') ? 1 : 0;
                return aPlayer - bPlayer;
            });
            for (let i = 0; i < units.length; i++) {
                units[i].draw(ctx);
            }
        };

        drawUnitsDepthSorted(game.enemies, game.players);
        game.projectiles.forEach(p => p.draw(ctx));
        game.particles.forEach(p => p.draw(ctx));

        game.drawSkirmishPlacementZone(ctx);

        // [NEW] 건설 프리뷰 렌더링
        if (game.buildMode.active && game.buildMode.type) {
            game.drawBuildPreview(ctx);
        }

        game.drawDroneLockTargets(ctx);

        ctx.restore();

        // [VFX] screen flash (screen-space) - 흰색만 사용
        if (game.flash > 0.01) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = `rgba(255,255,255,${game.flash})`;
            ctx.fillRect(0, 0, game.width, game.height);
            ctx.restore();
        }

        if (typeof NewsOverlay !== 'undefined') {
            NewsOverlay.renderFromGame(game);
        }

        drawCaptureControlOverlay(game, ctx);

    }

    function drawHUD(game) {
        const ctx = game.ctx;
        // 모바일 가로 모드인지 체크
        const isMobileLandscape = window.innerHeight < 600 && window.innerWidth > window.innerHeight;

        const fontSize = (game.width < 800) ? 16 : 24;
        const padding = (game.width < 800) ? 10 : 20;

        ctx.save();
        ctx.font = `bold ${fontSize}px "Orbitron", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;

        // [변경] 자원(SUPPLY) 표시 위치
        // 모바일 가로 모드면 -> 왼쪽 하단 (Bottom Left)
        // 그 외(PC/세로) -> 왼쪽 상단 (Top Left)
        let supplyX = padding;
        let supplyY = padding;

        if (isMobileLandscape) {
            supplyX = padding;
            supplyY = game.height - padding - 40; // 바닥에서 조금 위
        }

        // 1. Supply Text
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'left';
        ctx.fillText(`SUPPLY: ${Math.floor(game.supply)}`, supplyX, supplyY);

        // Supply Bar (Text 아래에)
        const barW = (game.width < 800) ? 100 : 150;
        const barH = (game.width < 800) ? 4 : 6;
        const ratio = Math.min(1, game.supply / CONFIG.maxSupply);

        ctx.fillStyle = '#4b5563';
        ctx.fillRect(supplyX, supplyY + fontSize + 5, barW, barH);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(supplyX, supplyY + fontSize + 5, barW * ratio, barH);

        // 2. Kill Count (오른쪽 상단 유지)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`KILLS: ${game.killCount || 0}`, game.width - padding, padding);

        // 3. Time (중앙 상단 유지)
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        const time = Math.floor(game.frame / 60);
        const min = Math.floor(time / 60).toString().padStart(2, '0');
        const sec = (time % 60).toString().padStart(2, '0');
        ctx.fillText(`${min}:${sec}`, game.width / 2, padding);

        // [NEW] 공습경보 표시
        if (game.airRaidWarning) {
            const warn = game.airRaidWarning;
            const elapsed = (game.frame || 0) - warn.startFrame;
            const total = warn.endFrame - warn.startFrame;
            const progress = Math.min(1, elapsed / total);

            // 깜빡임 효과
            const blink = Math.floor(elapsed / 8) % 2 === 0;

            if (blink) {
                const warnFontSize = (game.width < 800) ? 28 : 48;
                ctx.font = `bold ${warnFontSize}px "Orbitron", sans-serif`;
                ctx.textAlign = 'left';

                // 빨간색 그라데이션 효과
                ctx.fillStyle = '#ef4444';
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 20;

                // 왼쪽 중앙에 표시
                const warnX = padding + 10;
                const warnY = game.height / 2 - warnFontSize;

                ctx.fillText('공습경보', warnX, warnY);

                // 무기 종류 표시
                const subFontSize = (game.width < 800) ? 16 : 24;
                ctx.font = `bold ${subFontSize}px "Orbitron", sans-serif`;
                ctx.fillStyle = '#fbbf24';
                const weaponName = warn.type === 'nuke' ? '전술핵 발사 감지!' : '전술미사일 발사 감지!';
                ctx.fillText(weaponName, warnX, warnY + warnFontSize + 10);

                // 남은 시간 바 표시
                const barWidth = 150;
                const barHeight = 8;
                ctx.fillStyle = '#4b5563';
                ctx.fillRect(warnX, warnY + warnFontSize + subFontSize + 20, barWidth, barHeight);
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(warnX, warnY + warnFontSize + subFontSize + 20, barWidth * (1 - progress), barHeight);
            }
        }

        ctx.restore();
    }

    global.GameRuntimeLoop = {
        loop,
        update,
        renderUI,
        draw,
        drawHUD
    };
})(window);
