(function (global) {
    let actionModalOnClose = null;
    const CITY_SCALE_MIN = 0.9;
    const CITY_SCALE_MAX = 2.4;
    const CITY_SCALE_STEP = 0.05;
    const CITY_BGM_INTRO_FILE = 'bgm/ost/tunetank2.mp3';
    const CITY_BGM_LOOP_FILE = 'bgm/ost/tunetank.mp3';
    const CITY_BGM_INTRO_PLAYED_KEY = 'reclaim_city_bgm_intro_played_v1';
    const CITY_EVENT_0216_OVERLAY_ID = 'city-event-0216-overlay';
    const CITY_EVENT_0216_IMAGE = 'png/event/event_0216.png';

    function clampNumber(value, min, max) {
        if (!Number.isFinite(value)) return min;
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    function normalizeScale(value) {
        const parsed = Number(value);
        const safe = Number.isFinite(parsed) ? parsed : 1;
        const clamped = clampNumber(safe, CITY_SCALE_MIN, CITY_SCALE_MAX);
        const stepped = Math.round(clamped / CITY_SCALE_STEP) * CITY_SCALE_STEP;
        return Math.round(stepped * 100) / 100;
    }

    function hasPlayedCityIntroBgm() {
        try {
            return String(localStorage.getItem(CITY_BGM_INTRO_PLAYED_KEY) || '') === '1';
        } catch (_) {
            return false;
        }
    }

    function markCityIntroBgmPlayed() {
        try {
            localStorage.setItem(CITY_BGM_INTRO_PLAYED_KEY, '1');
        } catch (_) { }
    }

    function isCityScreenVisible() {
        const cityScreen = document.getElementById('city-screen');
        return !!(cityScreen && !cityScreen.classList.contains('hidden'));
    }

    function playCityBgm() {
        if (typeof AudioSystem === 'undefined' || !AudioSystem) return;
        if (typeof AudioSystem.init === 'function') AudioSystem.init();

        const playLoopTrack = () => {
            if (!isCityScreenVisible()) return;
            if (typeof AudioSystem.setBGMLock === 'function') {
                AudioSystem.setBGMLock(CITY_BGM_LOOP_FILE);
            }
            if (typeof AudioSystem.playBGMFile === 'function') {
                AudioSystem.playBGMFile(CITY_BGM_LOOP_FILE);
            }
        };

        if (hasPlayedCityIntroBgm()) {
            playLoopTrack();
            return;
        }

        markCityIntroBgmPlayed();
        if (typeof AudioSystem.setBGMLock === 'function') {
            AudioSystem.setBGMLock(CITY_BGM_INTRO_FILE);
        }
        if (typeof AudioSystem.playBGMFile === 'function') {
            AudioSystem.playBGMFile(CITY_BGM_INTRO_FILE);
        }

        const bgmEl = AudioSystem.bgmEl;
        if (!bgmEl) {
            playLoopTrack();
            return;
        }

        try {
            bgmEl.loop = false;
            bgmEl.addEventListener('ended', () => {
                playLoopTrack();
            }, { once: true });
        } catch (_) {
            playLoopTrack();
        }
    }

    function setCityEvent0216Visible(overlay, visible) {
        if (!overlay) return;
        overlay.classList.toggle('hidden', visible !== true);
        overlay.style.display = (visible === true) ? 'flex' : 'none';
        overlay.setAttribute('aria-hidden', (visible === true) ? 'false' : 'true');
    }

    function closeCityEvent0216Popup() {
        const overlay = document.getElementById(CITY_EVENT_0216_OVERLAY_ID);
        if (!overlay) return;
        setCityEvent0216Visible(overlay, false);
    }

    function ensureCityEvent0216Popup() {
        const cityScreen = document.getElementById('city-screen');
        if (!cityScreen) return null;

        const existing = document.getElementById(CITY_EVENT_0216_OVERLAY_ID);
        if (existing) return existing;

        const overlay = document.createElement('div');
        overlay.id = CITY_EVENT_0216_OVERLAY_ID;
        overlay.className = 'city-event-overlay hidden';

        const panel = document.createElement('div');
        panel.className = 'city-event-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', '이벤트 안내');

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'city-event-close-btn';
        closeBtn.setAttribute('aria-label', '닫기');
        closeBtn.textContent = 'x';
        closeBtn.addEventListener('click', (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
            closeCityEvent0216Popup();
        });

        const img = document.createElement('img');
        img.className = 'city-event-image';
        img.src = CITY_EVENT_0216_IMAGE;
        img.alt = '설날 이벤트 광고';

        const imageCandidates = [
            CITY_EVENT_0216_IMAGE,
            `./${CITY_EVENT_0216_IMAGE}`
        ];
        try {
            const baseHref = new URL('.', window.location.href).href;
            imageCandidates.push(new URL(CITY_EVENT_0216_IMAGE, baseHref).href);
        } catch (_) { }

        img.dataset.cityEventCandidateIndex = '0';
        img.addEventListener('error', () => {
            const idx = Math.max(0, Math.floor(Number(img.dataset.cityEventCandidateIndex) || 0)) + 1;
            if (idx >= imageCandidates.length) return;
            img.dataset.cityEventCandidateIndex = String(idx);
            img.src = imageCandidates[idx];
        });

        panel.appendChild(closeBtn);
        panel.appendChild(img);
        overlay.appendChild(panel);

        overlay.addEventListener('pointerdown', (event) => {
            if (event.target !== overlay) return;
            closeCityEvent0216Popup();
        });

        cityScreen.appendChild(overlay);
        setCityEvent0216Visible(overlay, false);
        return overlay;
    }

    function openCityEvent0216Popup(game) {
        const overlay = ensureCityEvent0216Popup();
        if (!overlay) return;
        setCityEvent0216Visible(overlay, true);
    }

    function clampViewToVisibleBounds(game) {
        const wrap = document.querySelector('#city-screen .city-grid-wrap');
        const grid = document.getElementById('city-grid');
        if (!wrap || !grid) return;

        const state = CitySimState.ensure(game);
        const currentScale = Number(state.view?.scale) || 1;
        const scale = normalizeScale(currentScale);
        const wrapW = Math.max(1, Math.round(wrap.clientWidth || wrap.getBoundingClientRect().width || 1));
        const wrapH = Math.max(1, Math.round(wrap.clientHeight || wrap.getBoundingClientRect().height || 1));
        const gridW = Math.max(1, Math.round(grid.offsetWidth || 1));
        const gridH = Math.max(1, Math.round(grid.offsetHeight || 1));
        const scaledW = Math.max(1, Math.round(gridW * scale));
        const scaledH = Math.max(1, Math.round(gridH * scale));

        const overflowX = Math.max(0, (scaledW - wrapW) / 2);
        const overflowY = Math.max(0, (scaledH - wrapH) / 2);
        const padX = Math.min(120, Math.round(wrapW * 0.2));
        const padY = Math.min(90, Math.round(wrapH * 0.16));
        const maxX = overflowX + padX;
        const maxY = overflowY + padY;

        const currentX = Number(state.view?.x) || 0;
        const currentY = Number(state.view?.y) || 0;
        const nextX = Math.round(clampNumber(currentX, -maxX, maxX));
        const nextY = Math.round(clampNumber(currentY, -maxY, maxY));
        if (nextX !== currentX || nextY !== currentY || Math.abs(scale - currentScale) > 0.0001) {
            CitySimState.patchView(game, { x: nextX, y: nextY, scale });
        }
    }

    function applyViewTransform(game) {
        const viewport = document.getElementById('city-map-viewport');
        if (!viewport) return;

        clampViewToVisibleBounds(game);
        const state = CitySimState.ensure(game);
        const x = Math.round(Number(state.view?.x) || 0);
        const y = Math.round(Number(state.view?.y) || 0);
        const scale = normalizeScale(state.view?.scale);
        viewport.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale.toFixed(2)})`;
    }

    function renderMissionPanel(game) {
        const card = document.getElementById('city-mission-card');
        const toggle = document.querySelector('.city-mission-toggle');
        const screen = document.getElementById('city-screen');
        if (!card || !toggle) return;

        const state = CitySimState.ensure(game);
        card.classList.toggle('hidden', !state.missionOpen);
        toggle.classList.toggle('hidden', state.missionOpen);
        if (screen) {
            screen.classList.toggle('city-mission-open', state.missionOpen === true);
        }
    }

    function toggleMissionPanel(game, forceOpen) {
        const state = CitySimState.ensure(game);
        const open = (typeof forceOpen === 'boolean') ? forceOpen : !state.missionOpen;
        if (open) {
            CitySimState.setBuildPanelOpen(game, false);
            CitySimState.setInventoryPanelOpen(game, false);
            const buildPanel = document.getElementById('city-build-panel');
            if (buildPanel) buildPanel.classList.remove('open');
            const inventoryPanel = document.getElementById('city-inventory-panel');
            if (inventoryPanel) inventoryPanel.classList.remove('open');
            const screen = document.getElementById('city-screen');
            if (screen) {
                screen.classList.remove('city-build-open');
                screen.classList.remove('city-inventory-open');
            }
            if (game && typeof game.closeCityActionModal === 'function') {
                game.closeCityActionModal();
            }
            if (typeof CitySimGacha !== 'undefined' && CitySimGacha && typeof CitySimGacha.close === 'function') {
                CitySimGacha.close();
            }
        }
        CitySimState.setMissionOpen(game, open);
        renderMissionPanel(game);
    }

    function bindEvents(game) {
        if (game._cityBound) return;

        const grid = document.getElementById('city-grid');
        if (grid) {
            const BRUSH_TOOLS = new Set(['road', 'tree', 'ground_grass', 'ground_dirt', 'ground_concrete', 'eraser']);
            const isGridInputLocked = (allowBuildPlacement) => {
                if (typeof CitySimConstruction === 'undefined' || !CitySimConstruction) return false;
                if (typeof CitySimConstruction.isMapInputLocked !== 'function') return false;
                return CitySimConstruction.isMapInputLocked(game, { allowBuildPlacement: allowBuildPlacement === true });
            };

            const getCurrentBrushTool = () => {
                const state = CitySimState.ensure(game);
                const placement = state.placement || {};
                return placement.tool || state.selectedTool || '';
            };

            const isBrushMode = () => {
                const state = CitySimState.ensure(game);
                if (!state.placement?.active || state.placement?.mode !== 'build') return false;
                return BRUSH_TOOLS.has(getCurrentBrushTool());
            };

            const isPlacementPreviewMode = () => {
                const state = CitySimState.ensure(game);
                const placement = state.placement || {};
                if (placement.active !== true || placement.mode !== 'build') return false;
                const tool = placement.tool || state.selectedTool || '';
                return !BRUSH_TOOLS.has(tool);
            };

            const getCellFromPointerEvent = (e) => {
                let cell = (e.target && typeof e.target.closest === 'function')
                    ? e.target.closest('.city-cell')
                    : null;
                if (cell) return cell;

                if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return null;
                const hit = document.elementFromPoint(e.clientX, e.clientY);
                if (!hit || typeof hit.closest !== 'function') return null;
                return hit.closest('.city-cell');
            };

            const paintIndex = (idx) => {
                if (!Number.isFinite(idx)) return;
                if (game._cityRoadTreeBrushLastIndex === idx) return;
                game.handleCityCellAction(idx);
                game._cityRoadTreeBrushLastIndex = idx;
                if (typeof game.updateCityPlacementPreview === 'function') {
                    game.updateCityPlacementPreview(idx);
                }
            };

            const paintLine = (fromIdx, toIdx) => {
                if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx)) return;
                const state = CitySimState.ensure(game);
                const cols = Math.max(1, Math.floor(Number(state.cols) || 1));

                let x0 = fromIdx % cols;
                let y0 = Math.floor(fromIdx / cols);
                const x1 = toIdx % cols;
                const y1 = Math.floor(toIdx / cols);

                const dx = Math.abs(x1 - x0);
                const sx = x0 < x1 ? 1 : -1;
                const dy = -Math.abs(y1 - y0);
                const sy = y0 < y1 ? 1 : -1;
                let err = dx + dy;

                while (true) {
                    const idx = (y0 * cols) + x0;
                    if (idx !== fromIdx) paintIndex(idx);
                    if (x0 === x1 && y0 === y1) break;
                    const e2 = 2 * err;
                    if (e2 >= dy) {
                        err += dy;
                        x0 += sx;
                    }
                    if (e2 <= dx) {
                        err += dx;
                        y0 += sy;
                    }
                }
            };

            const stopRoadTreeBrush = (pointerId) => {
                if (game._cityRoadTreeBrushActive !== true) return;
                if (pointerId != null && game._cityRoadTreeBrushPointerId != null && game._cityRoadTreeBrushPointerId !== pointerId) {
                    return;
                }
                try {
                    if (pointerId != null) grid.releasePointerCapture(pointerId);
                } catch (_) { }
                game._cityRoadTreeBrushActive = false;
                game._cityRoadTreeBrushPointerId = null;
                game._cityRoadTreeBrushLastIndex = null;
                if (game._cityBrushDirty === true && typeof game.saveCitySimState === 'function') {
                    game.saveCitySimState();
                }
                game._cityBrushDirty = false;
            };

            grid.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                const cell = getCellFromPointerEvent(e);
                if (!cell) return;

                const idx = Number(cell.dataset.index);
                if (!Number.isFinite(idx)) return;

                const brushMode = isBrushMode();
                const previewMode = !brushMode && isPlacementPreviewMode();
                if (!brushMode && !previewMode) return;
                if (isGridInputLocked(true)) return;

                if (previewMode) {
                    if (typeof game.updateCityPlacementPreview === 'function') {
                        game.updateCityPlacementPreview(idx);
                    }
                    return;
                }

                if (typeof e.preventDefault === 'function') e.preventDefault();

                game._cityRoadTreeBrushActive = true;
                game._cityRoadTreeBrushPointerId = e.pointerId;
                game._cityRoadTreeBrushLastIndex = null;
                game._citySuppressClickUntil = Date.now() + 220;

                try { grid.setPointerCapture(e.pointerId); } catch (_) { }

                paintIndex(idx);
            });

            grid.addEventListener('pointermove', (e) => {
                if (game._cityRoadTreeBrushActive === true) {
                    if (game._cityRoadTreeBrushPointerId != null && game._cityRoadTreeBrushPointerId !== e.pointerId) return;
                    if (isGridInputLocked(true)) return;

                    const cell = getCellFromPointerEvent(e);
                    if (!cell) return;

                    const idx = Number(cell.dataset.index);
                    if (!Number.isFinite(idx)) return;
                    const prev = game._cityRoadTreeBrushLastIndex;
                    if (!Number.isFinite(prev)) {
                        paintIndex(idx);
                        return;
                    }
                    if (idx === prev) return;
                    paintLine(prev, idx);
                    return;
                }

                if (game._cityPanDragging === true) return;
                if (!isPlacementPreviewMode()) return;
                if (isGridInputLocked(true)) return;

                const cell = getCellFromPointerEvent(e);
                if (!cell) return;
                const idx = Number(cell.dataset.index);
                if (!Number.isFinite(idx)) return;
                if (typeof game.updateCityPlacementPreview === 'function') {
                    game.updateCityPlacementPreview(idx);
                }
            });

            grid.addEventListener('pointerup', (e) => stopRoadTreeBrush(e.pointerId));
            grid.addEventListener('pointercancel', (e) => stopRoadTreeBrush(e.pointerId));
            grid.addEventListener('lostpointercapture', () => stopRoadTreeBrush(null));

            grid.addEventListener('click', (e) => {
                if ((game._citySuppressClickUntil || 0) > Date.now()) return;
                const state = CitySimState.ensure(game);
                if (isGridInputLocked(state.placement?.active === true)) return;
                const ownSignMarker = (e.target && typeof e.target.closest === 'function')
                    ? e.target.closest('[data-city-own-sign="1"]')
                    : null;
                if (ownSignMarker) {
                    const markerCell = ownSignMarker.closest('.city-cell');
                    const markerIndex = Number(markerCell?.dataset?.index);
                    if (Number.isFinite(markerIndex)
                        && typeof CitySimConstruction !== 'undefined'
                        && CitySimConstruction
                        && typeof CitySimConstruction.openOwnSignAtCell === 'function') {
                        if (typeof e.preventDefault === 'function') e.preventDefault();
                        if (typeof e.stopPropagation === 'function') e.stopPropagation();
                        CitySimConstruction.openOwnSignAtCell(game, markerIndex);
                        return;
                    }
                }
                const cell = e.target.closest('.city-cell');
                if (!cell) return;
                const idx = Number(cell.dataset.index);
                if (!Number.isFinite(idx)) return;
                game.handleCityCellAction(idx, { target: e.target });
            });

            grid.addEventListener('mousemove', (e) => {
                if (game._cityPanDragging === true) return;
                const state = CitySimState.ensure(game);
                if (isGridInputLocked(state.placement?.active === true)) return;
                const cell = e.target.closest('.city-cell');
                if (!cell) return;
                const idx = Number(cell.dataset.index);
                if (!Number.isFinite(idx)) return;
                if (typeof game.updateCityPlacementPreview === 'function') {
                    game.updateCityPlacementPreview(idx);
                }
            });

            grid.addEventListener('mouseleave', () => {
                stopRoadTreeBrush(null);
                if (typeof game.clearCityPlacementPreview === 'function') {
                    game.clearCityPlacementPreview();
                }
            });
        }

        const viewport = document.getElementById('city-map-viewport');
        if (viewport) {
            const PAN_BRUSH_TOOLS = new Set(['road', 'tree', 'ground_grass', 'ground_dirt', 'ground_concrete', 'eraser']);
            const drag = {
                active: false,
                moved: false,
                pointerId: null,
                startX: 0,
                startY: 0,
                originX: 0,
                originY: 0
            };
            const touchPoints = new Map();
            const pinch = {
                active: false,
                startDist: 1,
                startScale: 1,
                startViewX: 0,
                startViewY: 0
            };

            const isMapInputLockedForPan = () => {
                const stateForLock = CitySimState.ensure(game);
                if (typeof CitySimConstruction !== 'undefined'
                    && CitySimConstruction
                    && typeof CitySimConstruction.isMapInputLocked === 'function'
                    && CitySimConstruction.isMapInputLocked(game, { allowBuildPlacement: stateForLock.placement?.active === true })) {
                    return true;
                }
                return false;
            };

            const isBrushPlacementActive = () => {
                const state = CitySimState.ensure(game);
                if (!state.placement?.active || state.placement?.mode !== 'build') return false;
                const tool = state.placement?.tool || state.selectedTool || '';
                return PAN_BRUSH_TOOLS.has(tool);
            };

            const getPinchPair = () => {
                if (touchPoints.size < 2) return null;
                const values = touchPoints.values();
                const p1 = values.next().value;
                const p2 = values.next().value;
                if (!p1 || !p2) return null;
                return [p1, p2];
            };

            const endDrag = (pointerId) => {
                if (!drag.active) return;
                if (pointerId != null && drag.pointerId !== pointerId) return;
                drag.active = false;
                drag.moved = false;
                drag.pointerId = null;
                if (!pinch.active) {
                    game._cityPanDragging = false;
                    viewport.classList.remove('dragging');
                }
            };

            const endPinch = () => {
                if (!pinch.active) return;
                pinch.active = false;
                if (!drag.active) {
                    game._cityPanDragging = false;
                    viewport.classList.remove('dragging');
                }
            };

            const startPinchFromTouches = () => {
                const pair = getPinchPair();
                if (!pair) return;
                const [p1, p2] = pair;
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                if (!Number.isFinite(dist) || dist <= 0) return;

                const state = CitySimState.ensure(game);
                pinch.active = true;
                pinch.startDist = Math.max(1, dist);
                pinch.startScale = normalizeScale(state.view?.scale);
                pinch.startViewX = Number(state.view?.x) || 0;
                pinch.startViewY = Number(state.view?.y) || 0;

                drag.active = false;
                drag.moved = false;
                drag.pointerId = null;
                game._cityPanDragging = true;
                game._citySuppressClickUntil = Date.now() + 220;
                viewport.classList.add('dragging');
            };

            viewport.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                if (isMapInputLockedForPan()) {
                    return;
                }
                const startedOnCell = !!(e.target && typeof e.target.closest === 'function' && e.target.closest('.city-cell'));
                if (startedOnCell && isBrushPlacementActive()) return;

                if (e.pointerType === 'touch') {
                    touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
                    if (touchPoints.size >= 2) {
                        startPinchFromTouches();
                        return;
                    }
                }

                const state = CitySimState.ensure(game);
                drag.active = true;
                drag.moved = false;
                drag.pointerId = e.pointerId;
                drag.startX = e.clientX;
                drag.startY = e.clientY;
                drag.originX = Number(state.view?.x) || 0;
                drag.originY = Number(state.view?.y) || 0;
                game._cityPanDragging = false;
                viewport.classList.add('dragging');
                if (!startedOnCell) {
                    try { viewport.setPointerCapture(e.pointerId); } catch (_) { }
                }
            });

            viewport.addEventListener('pointermove', (e) => {
                if (e.pointerType === 'touch' && touchPoints.has(e.pointerId)) {
                    touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
                }

                if (pinch.active) {
                    const pair = getPinchPair();
                    if (!pair) {
                        endPinch();
                        return;
                    }
                    const [p1, p2] = pair;
                    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                    if (!Number.isFinite(dist) || dist <= 0) return;

                    const prevScale = pinch.startScale;
                    const nextScale = normalizeScale(prevScale * (dist / pinch.startDist));
                    if (!Number.isFinite(nextScale)) return;

                    const centerX = (p1.x + p2.x) * 0.5;
                    const centerY = (p1.y + p2.y) * 0.5;
                    const rect = viewport.getBoundingClientRect();
                    const relX = centerX - (rect.left + rect.width / 2);
                    const relY = centerY - (rect.top + rect.height / 2);
                    const ratio = nextScale / prevScale;
                    const nextX = pinch.startViewX - relX * (ratio - 1);
                    const nextY = pinch.startViewY - relY * (ratio - 1);

                    CitySimState.patchView(game, { scale: nextScale, x: nextX, y: nextY });
                    applyViewTransform(game);
                    game._citySuppressClickUntil = Date.now() + 150;
                    return;
                }

                if (!drag.active || drag.pointerId !== e.pointerId) return;
                const dx = e.clientX - drag.startX;
                const dy = e.clientY - drag.startY;
                if (!drag.moved && Math.hypot(dx, dy) > 4) {
                    drag.moved = true;
                    game._cityPanDragging = true;
                    game._citySuppressClickUntil = Date.now() + 120;
                }
                if (!drag.moved) return;

                CitySimState.patchView(game, {
                    x: drag.originX + dx,
                    y: drag.originY + dy
                });
                applyViewTransform(game);
            });

            const handlePointerRelease = (e) => {
                if (e.pointerType === 'touch') {
                    touchPoints.delete(e.pointerId);
                    if (pinch.active && touchPoints.size < 2) {
                        endPinch();
                    }
                }
                endDrag(e.pointerId);
            };

            viewport.addEventListener('pointerup', handlePointerRelease);
            viewport.addEventListener('pointercancel', handlePointerRelease);
            viewport.addEventListener('lostpointercapture', () => {
                touchPoints.clear();
                endPinch();
                endDrag(null);
            });

            viewport.addEventListener('wheel', (e) => {
                e.preventDefault();
                const state = CitySimState.ensure(game);
                const prevScale = normalizeScale(state.view?.scale);
                const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
                const nextScale = normalizeScale(prevScale * zoomFactor);
                if (Math.abs(nextScale - prevScale) < 0.0001) return;

                const rect = viewport.getBoundingClientRect();
                const relX = e.clientX - (rect.left + rect.width / 2);
                const relY = e.clientY - (rect.top + rect.height / 2);
                const ratio = nextScale / prevScale;
                const nextX = (Number(state.view?.x) || 0) - relX * (ratio - 1);
                const nextY = (Number(state.view?.y) || 0) - relY * (ratio - 1);

                CitySimState.patchView(game, { scale: nextScale, x: nextX, y: nextY });
                applyViewTransform(game);
            }, { passive: false });
        }

        const modal = document.getElementById('city-action-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) game.closeCityActionModal();
            });
        }

        const keyHandler = (e) => {
            const cityScreen = document.getElementById('city-screen');
            if (!cityScreen || cityScreen.classList.contains('hidden')) return;
            if (e.key !== 'Escape') return;
            if (typeof ui !== 'undefined'
                && ui
                && typeof ui.handleEscapeShortcut === 'function'
                && ui.handleEscapeShortcut(e, game)) {
                return;
            }
        };
        document.addEventListener('keydown', keyHandler);
        game._cityKeyHandler = keyHandler;

        game._cityBound = true;
    }

    function init(game) {
        if (!game) return;
        if (typeof game.loadCitySimState === 'function') game.loadCitySimState();
        bindEvents(game);
        if (typeof game.renderCityScreen === 'function') game.renderCityScreen();
    }

    function enter(game) {
        if (!game) return;
        leave(game);

        CitySimState.setMissionOpen(game, false);
        const state = CitySimState.ensure(game);
        const enterScale = normalizeScale(state.view?.scale);
        CitySimState.patchView(game, { x: 0, y: 0, scale: enterScale });

        if (typeof LobbyBackground !== 'undefined') {
            LobbyBackground.stop();
        }

        document.getElementById('lobby-screen')?.classList.add('hidden');
        document.getElementById('difficulty-select-screen')?.classList.add('hidden');
        document.getElementById('map-select-screen')?.classList.add('hidden');
        document.getElementById('campaign-screen')?.classList.add('hidden');
        document.getElementById('unitdex-screen')?.classList.add('hidden');
        document.getElementById('city-screen')?.classList.remove('hidden');
        openCityEvent0216Popup(game);
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => openCityEvent0216Popup(game));
        }

        playCityBgm();

        if (typeof game.renderCityScreen === 'function') game.renderCityScreen();
        if (typeof CitySimConstruction !== 'undefined'
            && CitySimConstruction
            && typeof CitySimConstruction.refreshOwnSigns === 'function') {
            Promise.resolve(CitySimConstruction.refreshOwnSigns(game, { force: true }))
                .catch((err) => {
                    console.warn('[CitySimIndex] refreshOwnSigns on enter failed:', err);
                });
        }
        startLoop(game);

        if (typeof CitySimVisitActions !== 'undefined'
            && CitySimVisitActions
            && typeof CitySimVisitActions.syncIncomingGifts === 'function') {
            Promise.resolve(CitySimVisitActions.syncIncomingGifts(game, { silent: false }))
                .catch((err) => {
                    console.warn('[CitySimIndex] syncIncomingGifts on enter failed:', err);
                });
        }
    }

    function leave(game) {
        if (!game) return;

        if (typeof AudioSystem !== 'undefined' && typeof AudioSystem.setBGMLock === 'function') {
            AudioSystem.setBGMLock('');
        }

        if (typeof CitySimChat !== 'undefined' && CitySimChat && typeof CitySimChat.close === 'function') {
            CitySimChat.close();
        }

        if (typeof game.cityActionConfirm === 'function') {
            game.cityActionConfirm();
        }
        CitySimState.setMissionOpen(game, false);
        closeCityEvent0216Popup();

        document.getElementById('city-screen')?.classList.add('hidden');

        CitySimState.setBuildPanelOpen(game, false);
        const panel = document.getElementById('city-build-panel');
        if (panel) panel.classList.remove('open');

        CitySimState.setInventoryPanelOpen(game, false);
        const inventoryPanel = document.getElementById('city-inventory-panel');
        if (inventoryPanel) inventoryPanel.classList.remove('open');
        if (typeof CitySimGacha !== 'undefined' && CitySimGacha && typeof CitySimGacha.close === 'function') {
            CitySimGacha.close();
        }

        const screen = document.getElementById('city-screen');
        if (screen) {
            screen.classList.remove('city-build-open');
            screen.classList.remove('city-inventory-open');
            screen.classList.remove('city-shop-open');
            screen.classList.remove('city-mission-open');
            screen.classList.remove('city-modal-open');
        }

        closeActionModal();
        stopLoop(game);
    }

    function openActionModal(title, message, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const isConfirm = opts.mode === 'confirm';
        const barMode = opts.layout === 'bar';
        const modal = document.getElementById('city-action-modal');
        const titleEl = document.getElementById('city-action-title');
        const msgEl = document.getElementById('city-action-msg');
        const detailEl = document.getElementById('city-action-detail');
        const closeBtn = document.getElementById('city-action-close-btn');
        const cancelBtn = document.getElementById('city-action-cancel-btn');
        const confirmBtn = document.getElementById('city-action-confirm-btn');
        const panel = modal ? modal.querySelector('.city-action-panel') : null;
        const actionRow = closeBtn ? closeBtn.parentElement : null;

        if (modal) modal.classList.toggle('city-action-modal-bar', barMode);
        if (panel) panel.classList.toggle('city-action-panel-bar', barMode);
        if (actionRow) actionRow.classList.toggle('city-action-buttons-bar', barMode);
        if (msgEl) msgEl.classList.toggle('city-action-msg-bar', barMode);
        if (titleEl) titleEl.classList.toggle('city-action-title-bar', barMode);

        if (titleEl) titleEl.textContent = title || '안내';
        if (msgEl) {
            if (opts.allowHtml === true) {
                msgEl.innerHTML = String(message || '');
            } else {
                msgEl.innerHTML = String(message || '').replace(/\n/g, '<br>');
            }
        }
        if (detailEl) {
            const detailText = barMode ? '' : String(opts.detail || '').trim();
            detailEl.textContent = detailText;
            detailEl.classList.toggle('hidden', detailText.length === 0);
        }

        if (closeBtn) closeBtn.classList.toggle('hidden', isConfirm);
        if (cancelBtn) {
            cancelBtn.textContent = String(opts.cancelText || '취소');
            cancelBtn.classList.toggle('hidden', !isConfirm);
            cancelBtn.onclick = () => closeActionModal();
        }
        if (confirmBtn) {
            confirmBtn.textContent = String(opts.confirmText || '확인');
            confirmBtn.classList.toggle('hidden', !isConfirm);
            const onConfirm = (typeof opts.onConfirm === 'function') ? opts.onConfirm : null;
            confirmBtn.onclick = () => {
                closeActionModal();
                if (onConfirm) onConfirm();
            };
        }
        if (closeBtn) {
            if (barMode && !isConfirm) {
                closeBtn.textContent = '✕';
                closeBtn.setAttribute('aria-label', '닫기');
            } else {
                closeBtn.textContent = '닫기';
                closeBtn.setAttribute('aria-label', '닫기');
            }
        }

        actionModalOnClose = (typeof opts.onClose === 'function') ? opts.onClose : null;
        if (modal) modal.classList.add('active');
        const screen = document.getElementById('city-screen');
        if (screen && !screen.classList.contains('hidden')) {
            screen.classList.add('city-modal-open');
        }
    }

    function closeActionModal() {
        const modal = document.getElementById('city-action-modal');
        const titleEl = document.getElementById('city-action-title');
        const msgEl = document.getElementById('city-action-msg');
        const detailEl = document.getElementById('city-action-detail');
        const closeBtn = document.getElementById('city-action-close-btn');
        const cancelBtn = document.getElementById('city-action-cancel-btn');
        const confirmBtn = document.getElementById('city-action-confirm-btn');
        const panel = modal ? modal.querySelector('.city-action-panel') : null;
        const actionRow = closeBtn ? closeBtn.parentElement : null;

        if (msgEl) msgEl.textContent = '';
        if (msgEl) msgEl.classList.remove('city-action-msg-bar');
        if (titleEl) titleEl.classList.remove('city-action-title-bar');
        if (modal) modal.classList.remove('city-action-modal-bar');
        if (panel) panel.classList.remove('city-action-panel-bar');
        if (actionRow) actionRow.classList.remove('city-action-buttons-bar');
        if (closeBtn) closeBtn.textContent = '닫기';
        if (detailEl) {
            detailEl.classList.add('hidden');
            detailEl.textContent = '';
        }
        if (closeBtn) closeBtn.classList.remove('hidden');
        if (cancelBtn) {
            cancelBtn.classList.add('hidden');
            cancelBtn.onclick = null;
        }
        if (confirmBtn) {
            confirmBtn.classList.add('hidden');
            confirmBtn.onclick = null;
        }
        if (modal) modal.classList.remove('active');
        const screen = document.getElementById('city-screen');
        if (screen) {
            screen.classList.remove('city-modal-open');
        }

        const onClose = actionModalOnClose;
        actionModalOnClose = null;
        if (onClose) {
            try {
                onClose();
            } catch (_) { }
        }
    }

    function renderScreen(game) {
        if (!game) return;
        const state = CitySimState.ensure(game);

        if (typeof game.renderCityResources === 'function') game.renderCityResources();
        if (typeof game.renderCityUnits === 'function') game.renderCityUnits();
        if (typeof game.renderCityGrid === 'function') game.renderCityGrid();
        if (state.buildPanelOpen === true || state.placement?.active) {
            if (typeof game.renderCityBuildSelection === 'function') game.renderCityBuildSelection();
        }
        if (state.inventoryPanelOpen === true) {
            if (typeof game.renderCityInventoryPanel === 'function') game.renderCityInventoryPanel();
        }
        if (typeof game.renderCityContextBar === 'function') game.renderCityContextBar();

        renderMissionPanel(game);
        applyViewTransform(game);

        if (typeof game.openCityBuildPanel === 'function') {
            game.openCityBuildPanel(state.buildPanelOpen === true);
        }
        if (typeof game.openCityInventory === 'function') {
            game.openCityInventory(state.inventoryPanelOpen === true);
        }
    }

    function tick(game) {
        if (!game) return;
        CitySimEconomy.tick(game);
        if (typeof game.tickCityConstruction === 'function') {
            game.tickCityConstruction();
        }
    }

    function startLoop(game) {
        if (!game) return;
        stopLoop(game);

        const state = CitySimState.ensure(game);
        const ms = Math.max(800, Number(state.loopMs) || 2500);
        const timer = setInterval(() => tick(game), ms);
        CitySimState.setLoopTimer(game, timer);
    }

    function stopLoop(game) {
        if (!game) return;

        const state = CitySimState.ensure(game);
        if (state.loopTimer) {
            clearInterval(state.loopTimer);
        }
        CitySimState.clearLoopTimer(game);
    }

    function launchBattle(game) {
        if (!game) return;
        if (typeof game.openCampaignMap === 'function') game.openCampaignMap();
        else if (typeof game.openDifficultySelect === 'function') game.openDifficultySelect();
    }

    function openNews(game) {
        if (!game) return;
        if (typeof game.getCityQuestProgress === 'function') {
            const rows = game.getCityQuestProgress();
            const doneCount = rows.filter((row) => row.status === 'claimed').length;
            const claimableCount = rows.filter((row) => row.status === 'claimable').length;
            const html = rows.map((row) => {
                const status = String(row.statusLabel || '');
                const line = String(row.text || '').trim();
                return `<div>${status} · ${line}</div>`;
            }).join('');
            openActionModal(
                '작전 퀘스트',
                html,
                {
                    allowHtml: true,
                    detail: `지급 완료 ${doneCount}/${rows.length} · 지급 가능 ${claimableCount}`
                }
            );
            return;
        }

        openActionModal('뉴스', '외교/경제 뉴스 UI는 다음 단계에서 실제 데이터와 연결됩니다.');
    }

    function openDecorMode(game) {
        if (!game) return;
        if (typeof game.setCityBuildTab === 'function') game.setCityBuildTab('decor');
        if (typeof game.setCityBuildTool === 'function') game.setCityBuildTool('tree');
        if (typeof game.openCityBuildPanel === 'function') game.openCityBuildPanel(true);
    }

    global.CitySimMode = {
        bindEvents,
        init,
        enter,
        leave,
        openActionModal,
        closeActionModal,
        renderScreen,
        tick,
        startLoop,
        stopLoop,
        launchBattle,
        openNews,
        openDecorMode,
        toggleMissionPanel
    };
})(window);
