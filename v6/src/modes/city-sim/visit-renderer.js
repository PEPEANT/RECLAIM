// ============================================
// City Base Visit Renderer
// ============================================

(function (global) {
    let _currentVisitData = null;
    let _renderCache = { cols: 0, rows: 0, total: 0, cells: [], signatures: [] };

    const BUILDING_SPRITE_BASE_SIZE = 256;
    const BUILDING_SPRITE_MAX_DPR = 2;
    const VISIT_SCALE_MIN = 0.9;
    const VISIT_SCALE_MAX = 2.4;
    const VISIT_SCALE_STEP = 0.05;
    const TAP_MOVE_THRESHOLD_BY_POINTER = {
        mouse: 4,
        pen: 7,
        touch: 12,
        default: 6
    };
    const spriteUrlCache = new Map();
    const inventoryIconCache = new Map();
    const drillgroundUnitIconCache = new Map();
    const drillgroundMissileIconCache = new Map();
    const DRILLGROUND_MISSILE_ICON_KEYS = new Set(['emp', 'nuke', 'tactical_missile']);
    const DRILLGROUND_TILE_SET = new Set(['drillground', 'drillground_gray']);
    const AIRPORT_TILE_RE = /^airport_r\d+c\d+$/;
    const PARK_PLAZA_TILE_SET = new Set(['park_plaza', 'park_plaza_tr', 'park_plaza_bl', 'park_plaza_br']);
    let _visitView = { x: 0, y: 0, scale: 1 };
    let _activeVisitSigns = [];
    let _visitSignByIndex = new Map();
    let _visitSignLoadToken = 0;
    let _visitSignPlacement = {
        active: false,
        busy: false,
        text: '',
        targetUid: '',
        targetName: '',
        cityPayload: null,
        availableSet: new Set(),
        suggestedIndex: -1,
        selectedIndex: -1
    };
    const LEVEL_BADGE_BY_LEVEL = [
        null,
        'png/level.png/leftbar_level.1.png',
        'png/level.png/leftbar_level.2.png',
        'png/level.png/leftbar_level.3.png',
        'png/level.png/leftbar_level.4.png',
        'png/level.png/gold_level.5.png',
        'png/level.png/gold_level.6.png',
        'png/level.png/gold_level.7.png',
        'png/level.png/gold_level.8.png',
        'png/level.png/gold_gem_level.9.png',
        'png/level.png/gem_level.10.png',
        'png/level.png/gem_level.11.png',
        'png/level.png/gem_level.12.png',
        'png/level.png/flower_level.13.png',
        'png/level.png/flower_level.14.png',
        'png/level.png/flower_level.15.png',
        'png/level.png/star_level.16.png',
        'png/level.png/star_level.17.png',
        'png/level.png/star_level.18.png',
        'png/level.png/star_level.19.png'
    ];
    const TILE_ICON = {
        tree: '나무',
        hq: '본부',
        house: '회사',
        apartment_large: '아파트',
        shop_store: '가게',
        tax_office: '세무소',
        drillground: '연병',
        drillground_gray: '연병',
        barracks: '병영',
        airport: '공항',
        airport_tr: '공항',
        airport_bl: '공항',
        airport_br: '공항',
        factory: '전차',
        powerplant: '연구',
        oilrig: '보급',
        park_plaza: '공원',
        park_plaza_tr: '공원',
        park_plaza_bl: '공원',
        park_plaza_br: '공원',
        park: '공원',
        monument: '기념',
        decor: '집'
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function getTapMoveThreshold(pointerType) {
        const kind = String(pointerType || '').trim().toLowerCase();
        if (!kind) return TAP_MOVE_THRESHOLD_BY_POINTER.default;
        return TAP_MOVE_THRESHOLD_BY_POINTER[kind] || TAP_MOVE_THRESHOLD_BY_POINTER.default;
    }

    function clampNumber(value, min, max) {
        if (!Number.isFinite(value)) return min;
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    function normalizeVisitScale(value) {
        const parsed = Number(value);
        const safe = Number.isFinite(parsed) ? parsed : 1;
        const clamped = clampNumber(safe, VISIT_SCALE_MIN, VISIT_SCALE_MAX);
        const stepped = Math.round(clamped / VISIT_SCALE_STEP) * VISIT_SCALE_STEP;
        return Math.round(stepped * 100) / 100;
    }

    function formatNumber(value) {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        try {
            return n.toLocaleString('ko-KR');
        } catch (_) {
            return String(n);
        }
    }

    function toNumber(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getUiRef() {
        if (typeof ui !== 'undefined' && ui) return ui;
        if (global.ui) return global.ui;
        return null;
    }

    function getGameRef() {
        if (typeof game !== 'undefined' && game) return game;
        if (global.game) return global.game;
        return null;
    }

    function showToast(message) {
        const msg = String(message || '').trim();
        if (!msg) return;

        const uiRef = getUiRef();
        if (uiRef && typeof uiRef.showToast === 'function') {
            uiRef.showToast(msg);
            return;
        }

        const gameRef = getGameRef();
        if (gameRef && typeof gameRef.showToast === 'function') {
            gameRef.showToast(msg);
            return;
        }

        console.info('[CitySimVisitRenderer] toast:', msg);
    }

    const SIGN_TRACE_PREFIX = '[표지판설치]';

    function traceSignInstall(code, detail, notifyUser) {
        const tag = `${SIGN_TRACE_PREFIX}[${String(code || 'UNKNOWN')}]`;
        const payload = (detail && typeof detail === 'object') ? detail : {};
        console.warn(`${tag}`, payload);
        if (notifyUser === true) {
            showToast(`${tag} 오류`);
        }
    }

    function getCurrentUser() {
        if (typeof CitySimAuth !== 'undefined' && CitySimAuth && typeof CitySimAuth.getCurrentUser === 'function') {
            return CitySimAuth.getCurrentUser();
        }
        const fb = global.RECLAIM_FB;
        if (!fb || typeof fb.getUser !== 'function') return null;
        return fb.getUser();
    }

    function getCurrentUid() {
        const user = getCurrentUser();
        return (user && user.uid) ? String(user.uid) : '';
    }

    function formatDateTime(ms) {
        const value = Math.max(0, Math.floor(toNumber(ms, 0)));
        if (value <= 0) return '-';
        try {
            const d = new Date(value);
            return d.toLocaleString('ko-KR', {
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (_) {
            return '-';
        }
    }

    function getLevelBadgePath(level) {
        const lv = Math.max(1, Math.min(19, Math.floor(toNumber(level, 1))));
        return LEVEL_BADGE_BY_LEVEL[lv] || LEVEL_BADGE_BY_LEVEL[1];
    }

    function normalizeUnitKey(value) {
        return String(value || '').trim();
    }

    function isDrillgroundTile(tile) {
        const key = String(tile || '').trim();
        return !!key && DRILLGROUND_TILE_SET.has(key);
    }

    function getUnitDefByKey(unitKey) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return null;
        const units = (typeof CONFIG !== 'undefined' && CONFIG && typeof CONFIG.units === 'object')
            ? CONFIG.units
            : null;
        return (units && units[key]) ? units[key] : null;
    }

    function getInventoryDisplayName(unitKey, unitDef) {
        const key = normalizeUnitKey(unitKey);
        const def = unitDef || getUnitDefByKey(key);
        const fallback = String(def?.name || key || '유닛');
        if (key && typeof Lang !== 'undefined' && Lang && typeof Lang.getText === 'function') {
            const localized = String(Lang.getText(`unit_${key}_name`) || '').trim();
            if (localized && localized !== `unit_${key}_name`) {
                return localized;
            }
        }
        return fallback;
    }

    function computeUnitCombatPower(unitKey, count) {
        const safeCount = Math.max(0, Math.floor(Number(count) || 0));
        if (safeCount <= 0) return 0;

        const def = getUnitDefByKey(unitKey);
        if (!def || typeof def !== 'object') {
            return safeCount * 180;
        }

        const hp = Math.max(1, toNumber(def.hp, toNumber(def.maxHp, 100)));
        const damage = Math.max(
            1,
            toNumber(
                def.damage,
                toNumber(
                    def.attack,
                    toNumber(def.atk, toNumber(def.power, 12))
                )
            )
        );
        const armor = Math.max(0, toNumber(def.armor, toNumber(def.defense, 0)));
        const speed = Math.max(0, toNumber(def.speed, toNumber(def.moveSpeed, 0)));
        const tier = Math.max(0, toNumber(def.tier, 0));
        const popNeed = Math.max(1, toNumber(def.population, toNumber(def.pop, 1)));
        const cost = Math.max(0, toNumber(def.cost, toNumber(def.price, toNumber(def.buildCost, 0))));

        const baseScore = Math.max(
            120,
            Math.round((hp * 0.35) + (damage * 8) + (armor * 24) + (speed * 18) + (tier * 120) + (popNeed * 60) + (cost * 0.2))
        );
        return baseScore * safeCount;
    }

    function collectVisitHudInfo(baseData) {
        const base = (baseData && typeof baseData === 'object') ? baseData : {};
        const city = (base.city && typeof base.city === 'object') ? base.city : {};
        const summary = (base.summary && typeof base.summary === 'object') ? base.summary : {};
        const hud = (city.hud && typeof city.hud === 'object') ? city.hud : {};
        const res = (city.res && typeof city.res === 'object') ? city.res : {};
        const units = (city.units && typeof city.units === 'object') ? city.units : {};
        const grid = Array.isArray(city.grid) ? city.grid : [];

        const level = Math.max(1, Math.floor(toNumber(base.level, toNumber(hud.level, toNumber(summary.level, 1)))));
        const honor = Math.max(0, Math.floor(toNumber(base.honor, toNumber(hud.honor, toNumber(summary.honor, 0)))));
        const money = Math.max(0, Math.floor(toNumber(res.money, toNumber(summary.money, toNumber(base.money, 0)))));
        const gold = Math.max(0, Math.floor(toNumber(res.gold, toNumber(summary.gold, toNumber(base.gold, 0)))));
        const maxPop = Math.max(1, Math.floor(toNumber(res.maxPop, toNumber(base.maxPop, toNumber(summary.maxPop, 1)))));
        const pop = Math.max(0, Math.min(maxPop, Math.floor(toNumber(res.pop, toNumber(base.pop, toNumber(summary.pop, 0))))));

        const buildingCountFallback = grid.reduce((acc, tile) => {
            return acc + (tile ? 1 : 0);
        }, 0);
        const buildingCount = Math.max(0, Math.floor(toNumber(summary.buildingCount, buildingCountFallback)));

        const unitTotalFallback = Object.keys(units).reduce((acc, unitKey) => {
            return acc + Math.max(0, Math.floor(toNumber(units[unitKey], 0)));
        }, 0);
        const unitTotal = Math.max(0, Math.floor(toNumber(summary.unitTotal, unitTotalFallback)));

        const roadCount = grid.reduce((acc, tile) => acc + (tile === 'road' ? 1 : 0), 0);
        const buildingStructurePower = Math.max(0, (buildingCount - roadCount) * 45);
        let unitCombatPower = 0;
        Object.keys(units).forEach((unitKey) => {
            unitCombatPower += computeUnitCombatPower(unitKey, units[unitKey]);
        });
        const combatPowerFromSummary = Math.max(0, (unitTotal * 180) + (buildingCount * 35));
        const combatPower = Math.max(0, Math.floor(unitCombatPower + buildingStructurePower)) || combatPowerFromSummary;

        return {
            level,
            honor,
            money,
            gold,
            pop,
            maxPop,
            buildingCount,
            unitTotal,
            combatPower
        };
    }

    function getVisitUnitTypeLabel(unitDef) {
        const raw = String(unitDef?.type || unitDef?.category || '').trim().toLowerCase();
        if (raw === 'air') return '공군';
        if (raw === 'mech' || raw === 'armored') return '기갑';
        if (raw === 'infantry') return '보병';
        if (raw === 'special') return '특수';
        return '유닛';
    }

    function getVisitUnitEntries(baseData) {
        const base = (baseData && typeof baseData === 'object') ? baseData : {};
        const city = (base.city && typeof base.city === 'object') ? base.city : {};
        const units = (city.units && typeof city.units === 'object') ? city.units : {};
        const entries = [];

        Object.keys(units).forEach((unitKey) => {
            const key = normalizeUnitKey(unitKey);
            if (!key || key === 'icbm_enemy') return;

            const count = Math.max(0, Math.floor(toNumber(units[key], 0)));
            if (count <= 0) return;

            const unitDef = getUnitDefByKey(key);
            const name = getInventoryDisplayName(key, unitDef || undefined);
            const iconUrl = drawInventoryUnitIcon(key);
            entries.push({
                key,
                count,
                unitDef: unitDef || null,
                name,
                iconUrl,
                typeLabel: getVisitUnitTypeLabel(unitDef)
            });
        });

        entries.sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return String(a.name || '').localeCompare(String(b.name || ''), 'ko-KR');
        });
        return entries;
    }

    function openVisitUnitInventory() {
        const gameRef = getActionGameRef();
        if (!gameRef || typeof gameRef.openCityActionModal !== 'function') {
            showToast('유닛보기 창을 열 수 없습니다.');
            return;
        }

        const baseData = (_currentVisitData && typeof _currentVisitData.base === 'object')
            ? _currentVisitData.base
            : {};
        const ownerName = getVisitOwnerName();
        const entries = getVisitUnitEntries(baseData);
        const totalCount = entries.reduce((sum, entry) => sum + Math.max(0, Math.floor(toNumber(entry?.count, 0))), 0);
        const kindCount = entries.length;

        let html = '';
        if (entries.length <= 0) {
            const summary = (baseData.summary && typeof baseData.summary === 'object') ? baseData.summary : {};
            const summaryKinds = Math.max(0, Math.floor(toNumber(summary.unitKinds, 0)));
            const summaryTotal = Math.max(0, Math.floor(toNumber(summary.unitTotal, 0)));
            const summaryText = (summaryKinds > 0 || summaryTotal > 0)
                ? `요약 정보: 유닛 ${formatNumber(summaryKinds)}종 · 총 ${formatNumber(summaryTotal)}기`
                : '표시 가능한 유닛 정보가 없습니다.';
            html = [
                '<div class="city-visit-modal-wrap city-visit-unit-modal">',
                `<div class="city-visit-modal-desc"><strong>${escapeHtml(ownerName)}</strong>의 유닛 보관함</div>`,
                `<div class="city-visit-modal-desc city-visit-unit-empty">${escapeHtml(summaryText)}</div>`,
                '</div>'
            ].join('');
        } else {
            const cardsHtml = entries.map((entry) => {
                const icon = entry.iconUrl
                    ? `<img class="city-action-unitbar-icon" src="${escapeHtml(entry.iconUrl)}" alt="${escapeHtml(entry.name)}">`
                    : `<span class="city-action-unitbar-icon-fallback">${escapeHtml(String(entry.name || '').slice(0, 2))}</span>`;
                return (
                    `<div class="btn-unit city-action-unitbar-item city-visit-unit-item" title="${escapeHtml(entry.name)} ${formatNumber(entry.count)}기">` +
                    icon +
                    `<span class="city-action-unitbar-name">${escapeHtml(entry.name)}</span>` +
                    `<span class="city-action-unitbar-meta">${escapeHtml(entry.typeLabel)}</span>` +
                    `<span class="city-action-unitbar-badge">${formatNumber(entry.count)}기</span>` +
                    '</div>'
                );
            }).join('');

            html = (
                '<div class="city-action-unitbar-wrap city-visit-unitbar-wrap">' +
                `<div class="city-visit-unitbar-head">${escapeHtml(ownerName)} · 유닛 ${formatNumber(kindCount)}종 / 총 ${formatNumber(totalCount)}기</div>` +
                `<div class="city-action-unitbar">${cardsHtml}</div>` +
                '</div>'
            );
        }

        gameRef.openCityActionModal('유닛보관함', html, {
            allowHtml: true,
            layout: 'bar',
            detail: ''
        });
    }

    function applyInventoryIconRenderTweaks(dummy) {
        if (!dummy || typeof dummy !== 'object') return;
        // Keep cannon/turret behind hull for compact icon readability.
        dummy.iconRenderBackTurret = true;
    }

    function drawInventoryUnitIcon(unitKey) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return null;

        if (inventoryIconCache.has(key)) {
            const cached = inventoryIconCache.get(key);
            return cached || null;
        }

        const unitDef = getUnitDefByKey(key);
        if (!unitDef) {
            inventoryIconCache.set(key, null);
            return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            inventoryIconCache.set(key, null);
            return null;
        }

        let drew = false;
        if (typeof Unit !== 'undefined') {
            try {
                ctx.save();
                const canvasCenterX = 32;
                const canvasBottomY = 44;

                let scale = 0.8;
                let offsetY = 0;
                if (key === 'blackhawk' || key === 'chinook') {
                    scale = 0.35;
                    offsetY = -15;
                } else if (key === 'bomber') {
                    scale = 0.3;
                    offsetY = -10;
                } else if (key === 'apache' || key === 'fighter') {
                    scale = 0.45;
                    offsetY = -12;
                } else if (key === 'humvee') {
                    scale = 0.65;
                    offsetY = -18;
                } else if (key === 'emp' || key === 'nuke' || key === 'tactical_missile') {
                    scale = 0.7;
                    offsetY = -8;
                } else if ((Number(unitDef.width) || 0) > 60) {
                    scale = 0.45;
                    offsetY = -5;
                } else if ((Number(unitDef.width) || 0) > 40) {
                    scale = 0.55;
                    offsetY = -3;
                } else if (unitDef.type === 'air') {
                    scale = 0.6;
                    offsetY = -8;
                }

                ctx.translate(canvasCenterX, canvasBottomY + offsetY);
                ctx.scale(scale, scale);

                const dummy = new Unit(key, 0, 0, 'player');
                dummy.hideHp = true;
                dummy.disableFeetSnap = true;
                applyInventoryIconRenderTweaks(dummy);
                if (dummy.stats.type === 'air') dummy.y = 0;
                dummy.draw(ctx);
                ctx.restore();
                drew = true;
            } catch (_) {
                try {
                    ctx.restore();
                } catch (_) { }
            }
        }

        if (!drew) {
            const w = Math.max(10, Math.min(50, Math.round((Number(unitDef.width) || 30) * 0.9)));
            const h = Math.max(6, Math.min(26, Math.round((Number(unitDef.height) || 16) * 0.9)));
            ctx.fillStyle = unitDef.color || '#38bdf8';
            ctx.globalAlpha = 0.9;
            ctx.fillRect((60 - w) / 2, (40 - h) / 2 + 6, w, h);
            ctx.globalAlpha = 1;
        }

        const dataUrl = canvas.toDataURL('image/png');
        inventoryIconCache.set(key, dataUrl);
        return dataUrl;
    }

    function drawDrillgroundUnitIcon(unitKey) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return null;
        if (isDrillgroundMissileIconUnit(key)) {
            return drawDrillgroundMissileIcon(key);
        }

        if (drillgroundUnitIconCache.has(key)) {
            const cached = drillgroundUnitIconCache.get(key);
            return cached || null;
        }

        const unitDef = getUnitDefByKey(key);
        if (!unitDef) {
            drillgroundUnitIconCache.set(key, null);
            return null;
        }

        if (typeof Unit === 'undefined') {
            const fallbackUrl = drawInventoryUnitIcon(key);
            drillgroundUnitIconCache.set(key, fallbackUrl || null);
            return fallbackUrl || null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 192;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            drillgroundUnitIconCache.set(key, null);
            return null;
        }

        let drew = false;
        let unitType = '';
        let unitCategory = '';
        let verticalBias = -1;
        try {
            ctx.save();

            const width = Math.max(0, Number(unitDef.width) || 0);
            const height = Math.max(0, Number(unitDef.height) || 0);
            const type = String(unitDef.type || '').trim().toLowerCase();
            const category = String(unitDef.category || '').trim().toLowerCase();
            unitType = type;
            unitCategory = category;

            let scale = 0.98;
            let offsetY = -4;
            if (category === 'infantry') {
                scale = 1.34;
                offsetY = -2;
                verticalBias = -1;
            } else if (type === 'air') {
                if (key === 'blackhawk') {
                    scale = 0.62;
                    offsetY = -10;
                } else if (key === 'chinook') {
                    scale = 0.64;
                    offsetY = -10;
                } else if (key === 'bomber' || key === 'fighter') {
                    scale = 0.7;
                    offsetY = -11;
                } else if (key === 'apache') {
                    scale = 0.72;
                    offsetY = -12;
                } else if (width >= 120) {
                    scale = 0.68;
                    offsetY = -11;
                } else {
                    scale = 0.74;
                    offsetY = -10;
                }
                verticalBias = -3;
            } else if (type === 'mech' || category === 'armored') {
                if (key === 'icbm') {
                    scale = 0.84;
                    offsetY = -14;
                } else if (width >= 120) {
                    scale = 0.58;
                    offsetY = -5;
                } else if (key === 'humvee' || key === 'apc' || key === 'aa_tank') {
                    scale = 0.82;
                    offsetY = -4;
                } else if (width >= 72 || height >= 42 || key === 'mbt' || key === 'spg') {
                    scale = (key === 'mbt') ? 0.68 : ((key === 'spg') ? 0.66 : 0.62);
                    offsetY = -4;
                } else {
                    scale = 0.58;
                    offsetY = -3;
                }
                if (key === 'humvee') {
                    offsetY -= 2;
                    verticalBias = -8;
                } else if (key === 'apc' || key === 'aa_tank') {
                    offsetY -= 1;
                    verticalBias = -6;
                } else if (key === 'icbm') {
                    verticalBias = -6;
                } else if (key === 'mbt') {
                    verticalBias = -5;
                } else {
                    verticalBias = -4;
                }
            } else if (width >= 55 || height >= 34) {
                scale = 0.86;
                offsetY = -5;
                verticalBias = -2;
            }

            const canvasCenterX = canvas.width * 0.5;
            const canvasBottomY = canvas.height - 14;
            ctx.translate(canvasCenterX, canvasBottomY + offsetY);
            ctx.scale(scale, scale);

            const dummy = new Unit(key, 0, 0, 'player');
            dummy.hideHp = true;
            dummy.disableFeetSnap = true;
            applyInventoryIconRenderTweaks(dummy);
            if (dummy.stats?.type === 'air') dummy.y = 0;
            dummy.draw(ctx);

            ctx.restore();
            drew = true;
        } catch (_) {
            try {
                ctx.restore();
            } catch (_) { }
        }

        if (!drew) {
            const fallbackUrl = drawInventoryUnitIcon(key);
            drillgroundUnitIconCache.set(key, fallbackUrl || null);
            return fallbackUrl || null;
        }

        const normalizedCanvas = normalizeDrillgroundIconCanvas(canvas, {
            alphaCutoff: (
                unitType === 'air'
                    ? 4
                    : ((unitCategory === 'armored' || unitType === 'mech') ? 18 : 20)
            ),
            padding: (key === 'icbm') ? 1 : 2,
            verticalBias,
            trimBottomSoftLine: false,
            allowUpscale: (unitCategory === 'armored' || unitType === 'mech'),
            maxUpscale: (
                key === 'icbm'
                    ? 1.24
                    : ((key === 'mbt' || key === 'spg') ? 1.16 : 1.1)
            )
        });
        const dataUrl = (normalizedCanvas || canvas).toDataURL('image/png');
        drillgroundUnitIconCache.set(key, dataUrl);
        return dataUrl;
    }

    function normalizeDrillgroundIconCanvas(canvas, options) {
        if (!canvas) return canvas;
        const opts = options || {};
        const alphaCutoff = Math.max(0, Math.min(255, Math.floor(Number(opts.alphaCutoff) || 26)));
        const padding = Math.max(0, Math.floor(Number(opts.padding) || 2));
        const verticalBias = Number.isFinite(Number(opts.verticalBias)) ? Number(opts.verticalBias) : 0;
        const trimBottomSoftLine = opts.trimBottomSoftLine === true;
        const allowUpscale = opts.allowUpscale === true;
        const maxUpscale = Math.max(1, Number(opts.maxUpscale) || 1);
        const width = Math.max(1, Math.floor(Number(canvas.width) || 0));
        const height = Math.max(1, Math.floor(Number(canvas.height) || 0));
        const srcCtx = canvas.getContext('2d');
        if (!srcCtx) return canvas;

        let imageData;
        try {
            imageData = srcCtx.getImageData(0, 0, width, height);
        } catch (_) {
            return canvas;
        }
        const data = imageData.data;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        const rowCount = new Array(height).fill(0);
        const rowAlpha = new Array(height).fill(0);

        for (let y = 0; y < height; y++) {
            const rowBase = y * width * 4;
            for (let x = 0; x < width; x++) {
                const alpha = data[rowBase + (x * 4) + 3];
                if (alpha < alphaCutoff) continue;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
                rowCount[y] += 1;
                rowAlpha[y] += alpha;
            }
        }

        if (maxX < minX || maxY < minY) {
            return canvas;
        }

        if (trimBottomSoftLine) {
            while (maxY > minY) {
                const cnt = rowCount[maxY];
                if (cnt <= 0) {
                    maxY -= 1;
                    continue;
                }
                const spanW = Math.max(1, maxX - minX + 1);
                const coverage = cnt / spanW;
                const avgAlpha = rowAlpha[maxY] / cnt;
                if (coverage >= 0.82 && avgAlpha <= 150) {
                    maxY -= 1;
                    continue;
                }
                break;
            }
        }

        const boxW = Math.max(1, maxX - minX + 1);
        const boxH = Math.max(1, maxY - minY + 1);
        const maxDrawW = Math.max(1, width - (padding * 2));
        const maxDrawH = Math.max(1, height - (padding * 2));
        let drawScale = 1;
        if (boxW > maxDrawW || boxH > maxDrawH) {
            drawScale = Math.min(maxDrawW / boxW, maxDrawH / boxH);
        } else if (allowUpscale) {
            const upscaleLimit = Math.min(maxDrawW / boxW, maxDrawH / boxH, maxUpscale);
            if (upscaleLimit > 1) drawScale = upscaleLimit;
        }

        const drawW = boxW * drawScale;
        const drawH = boxH * drawScale;
        const drawX = (width - drawW) * 0.5;
        const desiredY = ((height - drawH) * 0.5) + verticalBias;
        const minYLimit = padding;
        const maxYLimit = Math.max(minYLimit, height - drawH - padding);
        const drawY = Math.max(minYLimit, Math.min(maxYLimit, desiredY));

        const normalized = document.createElement('canvas');
        normalized.width = width;
        normalized.height = height;
        const outCtx = normalized.getContext('2d');
        if (!outCtx) return canvas;
        outCtx.imageSmoothingEnabled = true;
        if (typeof outCtx.imageSmoothingQuality === 'string') outCtx.imageSmoothingQuality = 'high';
        outCtx.clearRect(0, 0, width, height);
        outCtx.drawImage(canvas, minX, minY, boxW, boxH, drawX, drawY, drawW, drawH);
        return normalized;
    }

    function isDrillgroundMissileIconUnit(unitKey) {
        const key = normalizeUnitKey(unitKey);
        return !!key && DRILLGROUND_MISSILE_ICON_KEYS.has(key);
    }

    function getDrillgroundMissilePalette(unitKey) {
        const key = normalizeUnitKey(unitKey);
        if (key === 'emp') {
            return { body: '#dbeafe', nose: '#60a5fa', band: '#2563eb', fin: '#334155', glow: 'rgba(59,130,246,0.24)' };
        }
        if (key === 'tactical_missile') {
            return { body: '#f3f4f6', nose: '#ef4444', band: '#f59e0b', fin: '#64748b', glow: 'rgba(239,68,68,0.20)' };
        }
        if (key === 'nuke') {
            return { body: '#e5e7eb', nose: '#ef4444', band: '#111827', fin: '#475569', glow: 'rgba(248,113,113,0.20)' };
        }
        return { body: '#e2e8f0', nose: '#cbd5e1', band: '#facc15', fin: '#475569', glow: 'rgba(250,204,21,0.22)' };
    }

    function drawDrillgroundMissileIcon(unitKey) {
        const key = normalizeUnitKey(unitKey);
        if (!key || !DRILLGROUND_MISSILE_ICON_KEYS.has(key)) return null;

        if (drillgroundMissileIconCache.has(key)) {
            const cached = drillgroundMissileIconCache.get(key);
            return cached || null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            drillgroundMissileIconCache.set(key, null);
            return null;
        }

        const palette = getDrillgroundMissilePalette(key);
        const isIcbmFamily = key === 'icbm' || key === 'icbm_enemy';
        const bodyX = isIcbmFamily ? 10 : 12;
        const bodyY = isIcbmFamily ? 17 : 19;
        const bodyW = isIcbmFamily ? 38 : 34;
        const bodyH = isIcbmFamily ? 12 : 10;

        if (palette.glow) {
            ctx.fillStyle = palette.glow;
            ctx.beginPath();
            ctx.ellipse(30, 28, 24, 11, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        if (isIcbmFamily) {
            ctx.fillStyle = '#334155';
            ctx.fillRect(8, 32, 46, 3);
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.arc(16, 36, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(46, 36, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = palette.body;
        ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

        ctx.fillStyle = palette.nose;
        ctx.beginPath();
        ctx.moveTo(bodyX + bodyW, bodyY);
        ctx.lineTo(bodyX + bodyW + 8, bodyY + (bodyH / 2));
        ctx.lineTo(bodyX + bodyW, bodyY + bodyH);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.band;
        ctx.fillRect(bodyX + Math.round(bodyW * 0.55), bodyY, 5, bodyH);

        ctx.fillStyle = palette.fin;
        ctx.beginPath();
        ctx.moveTo(bodyX + 6, bodyY);
        ctx.lineTo(bodyX + 1, bodyY - 5);
        ctx.lineTo(bodyX + 1, bodyY);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bodyX + 6, bodyY + bodyH);
        ctx.lineTo(bodyX + 1, bodyY + bodyH + 5);
        ctx.lineTo(bodyX + 1, bodyY + bodyH);
        ctx.closePath();
        ctx.fill();

        if (key === 'emp') {
            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bodyX + 12, bodyY + 2);
            ctx.lineTo(bodyX + 17, bodyY + 2);
            ctx.lineTo(bodyX + 13, bodyY + 8);
            ctx.lineTo(bodyX + 20, bodyY + 8);
            ctx.stroke();
        } else if (key === 'nuke') {
            const cx = bodyX + 15;
            const cy = bodyY + 5;
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 3; i++) {
                const ang = (Math.PI * 2 * i) / 3;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(ang) * 5.2, cy + Math.sin(ang) * 5.2);
                ctx.stroke();
            }
        }

        const dataUrl = canvas.toDataURL('image/png');
        drillgroundMissileIconCache.set(key, dataUrl);
        return dataUrl;
    }

    function getDrillgroundUnitSizeClass(unitKey, unitDef) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return 'city-drillground-unit-size-base';

        const type = String(unitDef?.type || '').toLowerCase();
        const category = String(unitDef?.category || '').toLowerCase();
        const width = Math.max(0, Number(unitDef?.width) || 0);
        const height = Math.max(0, Number(unitDef?.height) || 0);

        if (type === 'air') {
            if (width >= 120 || key === 'chinook' || key === 'apache') {
                return 'city-drillground-unit-size-air-heavy';
            }
            if (width >= 75 || key === 'blackhawk' || key === 'bomber' || key === 'fighter') {
                return 'city-drillground-unit-size-air';
            }
            return 'city-drillground-unit-size-air-light';
        }

        const isArmored = type === 'mech' || category === 'armored';
        if (isArmored) {
            if (width >= 120 || key === 'icbm') return 'city-drillground-unit-size-heavy';
            if (width >= 72 || height >= 42 || key === 'mbt' || key === 'spg') {
                return 'city-drillground-unit-size-large';
            }
            if (width >= 52 || key === 'apc' || key === 'aa_tank' || key === 'humvee') {
                return 'city-drillground-unit-size-medium';
            }
        }

        if (width >= 55 || height >= 34) return 'city-drillground-unit-size-medium';
        return 'city-drillground-unit-size-base';
    }

    function isDrillgroundAssignableUnit(unitKey, unitDef) {
        const key = normalizeUnitKey(unitKey);
        if (!key || !unitDef) return false;
        if (key === 'icbm_enemy') return false;
        if (unitDef.disabled === true) return false;
        if (unitDef.hideFromUnitBar === true) return false;
        if (unitDef.isSkill === true) return false;
        if (unitDef.isBuilder === true) return false;
        if (unitDef.droneLaunchOnly === true) return false;

        const unitType = String(unitDef.type || '').trim().toLowerCase();
        const unitCategory = String(unitDef.category || '').trim().toLowerCase();
        if (unitType === 'civilian' || unitCategory === 'civilian') return false;
        return true;
    }

    function getGridColumnCount(cols, total) {
        const parsedCols = Math.floor(Number(cols) || 0);
        if (parsedCols > 0) return parsedCols;
        return Math.max(1, Math.floor(Number(total) || 0));
    }

    function isHorizontalAdjacentIndex(cols, leftIndex, rightIndex) {
        if (!Number.isInteger(leftIndex) || !Number.isInteger(rightIndex)) return false;
        if (rightIndex !== leftIndex + 1) return false;
        const colCount = getGridColumnCount(cols, 0);
        if (colCount <= 0) return false;
        return Math.floor(leftIndex / colCount) === Math.floor(rightIndex / colCount);
    }

    function isDrillgroundCell(grid, index) {
        if (!Array.isArray(grid)) return false;
        if (!Number.isInteger(index) || index < 0 || index >= grid.length) return false;
        return isDrillgroundTile(grid[index]);
    }

    function getDrillgroundTileAt(grid, index) {
        if (!isDrillgroundCell(grid, index)) return '';
        return String(grid[index] || '').trim();
    }

    function isSameDrillgroundType(grid, leftIndex, rightIndex) {
        const leftTile = getDrillgroundTileAt(grid, leftIndex);
        const rightTile = getDrillgroundTileAt(grid, rightIndex);
        return !!leftTile && leftTile === rightTile;
    }

    function getDrillgroundUnitFootprintSlots(unitKey, unitDefInput) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return 1;
        const unitDef = unitDefInput || getUnitDefByKey(key);
        if (!unitDef) return 1;
        const category = String(unitDef.category || '').trim().toLowerCase();
        if (category === 'infantry') return 1;
        // Wheeled light vehicles stay single-slot in drillground layout.
        if (key === 'humvee' || key === 'apc' || key === 'aa_tank') return 1;
        return 2;
    }

    const DRILLGROUND_INFANTRY_MAX_STACK = 4;

    function isInfantryUnit(unitDefInput) {
        const category = String(unitDefInput?.category || '').trim().toLowerCase();
        return category === 'infantry';
    }

    function clampDrillgroundInfantryCount(value) {
        const raw = Math.max(1, Math.floor(Number(value) || 1));
        return Math.min(DRILLGROUND_INFANTRY_MAX_STACK, raw);
    }

    function normalizeDrillgroundInfantryCounts(rawCounts, expectedSize, grid, drillgroundSlots) {
        const next = {};
        const size = Math.max(0, Math.floor(Number(expectedSize) || 0));
        if (size <= 0 || !Array.isArray(grid) || grid.length !== size) return next;
        if (!rawCounts || typeof rawCounts !== 'object' || Array.isArray(rawCounts)) return next;

        const slotMap = (drillgroundSlots && typeof drillgroundSlots === 'object')
            ? drillgroundSlots
            : {};
        Object.keys(rawCounts).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (!isDrillgroundTile(grid[index])) return;
            const unitKey = normalizeUnitKey(slotMap[index]);
            const unitDef = unitKey ? getUnitDefByKey(unitKey) : null;
            if (!unitKey || !isInfantryUnit(unitDef)) return;
            next[index] = clampDrillgroundInfantryCount(rawCounts[rawIndex]);
        });
        return next;
    }

    function getDrillgroundRightCompanionIndex(grid, cols, anchorIndex) {
        const companionIndex = Number(anchorIndex) + 1;
        if (!isHorizontalAdjacentIndex(cols, Number(anchorIndex), companionIndex)) return null;
        if (!isDrillgroundCell(grid, companionIndex)) return null;
        if (!isSameDrillgroundType(grid, Number(anchorIndex), companionIndex)) return null;
        return companionIndex;
    }

    function getDrillgroundMergeFlags(grid, cols, index) {
        if (!isDrillgroundCell(grid, index)) {
            return { mergeLeft: false, mergeRight: false, mergeUp: false, mergeDown: false };
        }

        const colCount = getGridColumnCount(cols, grid.length);
        const leftIndex = index - 1;
        const rightIndex = index + 1;
        const upIndex = index - colCount;
        const downIndex = index + colCount;
        const mergeLeft = (
            isHorizontalAdjacentIndex(cols, leftIndex, index)
            && isSameDrillgroundType(grid, leftIndex, index)
        );
        const mergeRight = (
            isHorizontalAdjacentIndex(cols, index, rightIndex)
            && isSameDrillgroundType(grid, index, rightIndex)
        );
        const mergeUp = isSameDrillgroundType(grid, upIndex, index);
        const mergeDown = isSameDrillgroundType(grid, index, downIndex);
        return { mergeLeft, mergeRight, mergeUp, mergeDown };
    }

    function buildDrillgroundOccupancy(grid, cols, drillgroundSlots, infantryCounts) {
        const anchors = new Map();
        const ownerByIndex = new Map();
        if (!Array.isArray(grid) || !drillgroundSlots || typeof drillgroundSlots !== 'object') {
            return { anchors, ownerByIndex };
        }

        const indices = Object.keys(drillgroundSlots)
            .map((raw) => Number(raw))
            .filter((idx) => Number.isInteger(idx) && isDrillgroundCell(grid, idx))
            .sort((a, b) => a - b);

        indices.forEach((index) => {
            if (ownerByIndex.has(index)) return;

            const unitKey = normalizeUnitKey(drillgroundSlots[index]);
            if (!unitKey) return;
            const unitDef = getUnitDefByKey(unitKey);
            if (!isDrillgroundAssignableUnit(unitKey, unitDef)) return;
            const infantryCount = (
                isInfantryUnit(unitDef)
                    ? clampDrillgroundInfantryCount(infantryCounts?.[index])
                    : 1
            );

            const span = getDrillgroundUnitFootprintSlots(unitKey, unitDef);
            if (span >= 2) {
                const companionIndex = getDrillgroundRightCompanionIndex(grid, cols, index);
                const companionStoredUnitKey = Number.isInteger(companionIndex)
                    ? normalizeUnitKey(drillgroundSlots[companionIndex])
                    : null;
                const companionStoredUnitDef = companionStoredUnitKey
                    ? getUnitDefByKey(companionStoredUnitKey)
                    : null;
                const companionHasOwnUnit = !!(
                    companionStoredUnitKey
                    && isDrillgroundAssignableUnit(companionStoredUnitKey, companionStoredUnitDef)
                );

                if (Number.isInteger(companionIndex) && !ownerByIndex.has(companionIndex) && !companionHasOwnUnit) {
                    anchors.set(index, {
                        unitKey,
                        unitDef,
                        span: 2,
                        companionIndex,
                        infantryCount: 1
                    });
                    ownerByIndex.set(index, index);
                    ownerByIndex.set(companionIndex, index);
                    return;
                }
            }

            anchors.set(index, {
                unitKey,
                unitDef,
                span: 1,
                companionIndex: null,
                infantryCount
            });
            ownerByIndex.set(index, index);
        });

        return { anchors, ownerByIndex };
    }

    function getDrillgroundEntryAt(index, occupancy) {
        if (!Number.isInteger(index) || !occupancy) return null;
        const anchorIndex = occupancy.ownerByIndex.get(index);
        if (!Number.isInteger(anchorIndex)) return null;
        const anchorEntry = occupancy.anchors.get(anchorIndex);
        if (!anchorEntry) return null;
        return {
            anchorIndex,
            unitKey: anchorEntry.unitKey,
            unitDef: anchorEntry.unitDef,
            span: anchorEntry.span,
            companionIndex: anchorEntry.companionIndex,
            infantryCount: clampDrillgroundInfantryCount(anchorEntry.infantryCount),
            isAnchor: anchorIndex === index
        };
    }

    function appendDrillgroundVisual(cell, options) {
        if (!cell) return;
        const opts = options || {};
        const unitKey = normalizeUnitKey(opts.unitKey);
        const unitDef = unitKey ? getUnitDefByKey(unitKey) : null;
        const span = Math.max(1, Math.floor(Number(opts.span) || getDrillgroundUnitFootprintSlots(unitKey, unitDef)));
        const isCompanion = opts.isCompanion === true;
        const mergeLeft = opts.mergeLeft === true;
        const mergeRight = opts.mergeRight === true;
        const mergeUp = opts.mergeUp === true;
        const mergeDown = opts.mergeDown === true;
        const infantryCount = clampDrillgroundInfantryCount(opts.infantryCount);
        const infantryStacked = !!unitKey && isInfantryUnit(unitDef) && infantryCount > 1;
        const sizeClass = getDrillgroundUnitSizeClass(unitKey, unitDef);

        const pad = document.createElement('span');
        pad.className = 'city-drillground-pad';
        if (!unitKey) pad.classList.add('city-drillground-pad-empty');
        if (mergeRight) pad.classList.add('city-drillground-pad-joined-left');
        if (mergeLeft) pad.classList.add('city-drillground-pad-joined-right');
        if (mergeUp) pad.classList.add('city-drillground-pad-joined-top');
        if (mergeDown) pad.classList.add('city-drillground-pad-joined-bottom');
        cell.appendChild(pad);

        if (isCompanion && span >= 2) return;

        if (!unitKey) return;

        const iconUrl = drawDrillgroundUnitIcon(unitKey);
        if (iconUrl) {
            if (infantryStacked) {
                const squad = document.createElement('span');
                squad.className = 'city-drillground-infantry-squad city-drillground-unit-populated';
                squad.dataset.cityDrillgroundUnit = '1';
                squad.dataset.stackCount = String(infantryCount);
                for (let i = 0; i < infantryCount; i++) {
                    const squadImg = document.createElement('img');
                    squadImg.className = 'city-drillground-infantry-squad-unit';
                    squadImg.src = iconUrl;
                    squadImg.alt = getInventoryDisplayName(unitKey, unitDef || undefined);
                    squadImg.decoding = 'async';
                    squad.appendChild(squadImg);
                }
                cell.appendChild(squad);
                return;
            }
            const img = document.createElement('img');
            img.className = `city-drillground-unit city-drillground-unit-populated ${sizeClass}`;
            if (isInfantryUnit(unitDef)) img.classList.add('city-drillground-unit-infantry');
            if (span >= 2) img.classList.add('city-drillground-unit-span-2');
            if (unitKey) {
                const unitKeyClass = `city-drillground-unit-key-${String(unitKey).toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
                img.classList.add(unitKeyClass);
            }
            img.dataset.cityDrillgroundUnit = '1';
            img.src = iconUrl;
            img.alt = getInventoryDisplayName(unitKey, unitDef || undefined);
            img.decoding = 'async';
            cell.appendChild(img);
            return;
        }

        const fallback = document.createElement('span');
        fallback.className = 'city-drillground-unit-fallback city-drillground-unit-populated';
        fallback.dataset.cityDrillgroundUnit = '1';
        fallback.textContent = getInventoryDisplayName(unitKey, unitDef || undefined).slice(0, 2);
        cell.appendChild(fallback);
    }

    function normalizeDrillgroundSlots(rawSlots, expectedSize, grid) {
        const next = {};
        const size = Math.max(0, Math.floor(Number(expectedSize) || 0));
        const hasGrid = Array.isArray(grid) && grid.length === size;

        const readSlot = (rawIndex, value) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (hasGrid && !isDrillgroundTile(grid[index])) return;
            const unitKey = normalizeUnitKey(value);
            if (!unitKey) return;
            next[index] = unitKey;
        };

        if (Array.isArray(rawSlots)) {
            rawSlots.forEach((value, index) => readSlot(index, value));
            return next;
        }
        if (!rawSlots || typeof rawSlots !== 'object') return next;

        Object.keys(rawSlots).forEach((rawIndex) => {
            readSlot(rawIndex, rawSlots[rawIndex]);
        });
        return next;
    }

    function normalizeGroundType(value) {
        const str = String(value || '').trim().toLowerCase();
        if (str === 'dirt') return 'dirt';
        if (str === 'concrete') return 'concrete';
        if (str === 'asphalt') return 'asphalt';
        return 'grass';
    }

    function getGroundTransitionMask(ground, groundLayer, index, cols, rows) {
        const targetGround = normalizeGroundType(ground);
        if (targetGround === 'grass') return 0;
        if (!Array.isArray(groundLayer) || normalizeGroundType(groundLayer[index]) !== targetGround) return 0;

        const x = index % cols;
        const y = Math.floor(index / cols);
        let mask = 0;

        const isSameGround = (cx, cy) => {
            if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
            const nIdx = (cy * cols) + cx;
            return normalizeGroundType(groundLayer[nIdx]) === targetGround;
        };

        if (!isSameGround(x, y - 1)) mask |= 1;
        if (!isSameGround(x + 1, y)) mask |= 2;
        if (!isSameGround(x, y + 1)) mask |= 4;
        if (!isSameGround(x - 1, y)) mask |= 8;

        return mask;
    }

    function getRoadMask(grid, index, cols, rows) {
        if (!Array.isArray(grid) || grid[index] !== 'road') return 0;

        const x = index % cols;
        const y = Math.floor(index / cols);
        let mask = 0;

        const hasRoad = (cx, cy) => {
            if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
            const nIdx = (cy * cols) + cx;
            return grid[nIdx] === 'road';
        };

        if (hasRoad(x, y - 1)) mask |= 1;
        if (hasRoad(x + 1, y)) mask |= 2;
        if (hasRoad(x, y + 1)) mask |= 4;
        if (hasRoad(x - 1, y)) mask |= 8;

        return mask;
    }

    function isAirportTile(tile) {
        return tile === 'airport' || tile === 'airport_tr' || tile === 'airport_bl' || tile === 'airport_br' || AIRPORT_TILE_RE.test(tile);
    }

    function isParkPlazaTile(tile) {
        return PARK_PLAZA_TILE_SET.has(tile);
    }

    function getTileClassName(tile) {
        if (!tile) return '';
        if (tile === 'road') return 'tile-road';
        if (tile === 'drillground') return 'tile-drillground';
        if (tile === 'drillground_gray') return 'tile-drillground-gray';
        if (isAirportTile(tile)) return 'tile-airport';
        if (isParkPlazaTile(tile)) return 'tile-park';
        return `tile-${tile}`;
    }

    function isObjectTile(tile) {
        return !!tile && tile !== 'road';
    }

    function getBuildingSpriteSize() {
        const rawDpr = (typeof window !== 'undefined') ? Number(window.devicePixelRatio) : 1;
        const dpr = Number.isFinite(rawDpr) ? Math.max(1, Math.min(BUILDING_SPRITE_MAX_DPR, rawDpr)) : 1;
        return Math.max(128, Math.round(BUILDING_SPRITE_BASE_SIZE * dpr));
    }

    function getTileSpriteUrl(tile) {
        if (!isObjectTile(tile)) return null;

        const spriteSize = getBuildingSpriteSize();
        const cacheKey = `${tile}:${spriteSize}`;
        if (spriteUrlCache.has(cacheKey)) return spriteUrlCache.get(cacheKey) || null;

        if (typeof CitySimBuildingRenderer === 'undefined' || !CitySimBuildingRenderer) return null;
        if (typeof CitySimBuildingRenderer.hasSprite === 'function' && !CitySimBuildingRenderer.hasSprite(tile)) return null;
        if (typeof CitySimBuildingRenderer.getSpriteDataUrl !== 'function') return null;

        const dataUrl = CitySimBuildingRenderer.getSpriteDataUrl(tile, spriteSize);
        const nextUrl = (typeof dataUrl === 'string' && dataUrl.length > 0) ? dataUrl : null;
        spriteUrlCache.set(cacheKey, nextUrl);
        return nextUrl;
    }

    function appendGroundSurface(cell, groundType, transitionMask) {
        const slab = document.createElement('span');
        slab.className = 'city-ground-surface';
        slab.classList.add(`ground-${normalizeGroundType(groundType)}`);
        if (transitionMask & 1) slab.classList.add('edge-n');
        if (transitionMask & 2) slab.classList.add('edge-e');
        if (transitionMask & 4) slab.classList.add('edge-s');
        if (transitionMask & 8) slab.classList.add('edge-w');
        cell.appendChild(slab);
    }

    function appendRoadShape(cell, mask) {
        const hasN = (mask & 1) !== 0;
        const hasE = (mask & 2) !== 0;
        const hasS = (mask & 4) !== 0;
        const hasW = (mask & 8) !== 0;
        const hasVertical = hasN || hasS;
        const hasHorizontal = hasE || hasW;
        const isIsolated = !hasVertical && !hasHorizontal;

        const road = document.createElement('div');
        road.className = 'city-road-shape';
        if (isIsolated) road.classList.add('isolated');

        const core = document.createElement('span');
        core.className = 'city-road-core';
        road.appendChild(core);

        const innerCore = document.createElement('span');
        innerCore.className = 'city-road-inner-core';
        road.appendChild(innerCore);

        const addArm = (dir) => {
            const arm = document.createElement('span');
            arm.className = `city-road-arm ${dir}`;
            road.appendChild(arm);

            const innerArm = document.createElement('span');
            innerArm.className = `city-road-inner-arm ${dir}`;
            road.appendChild(innerArm);
        };

        if (hasN) {
            addArm('n');
            road.classList.add('has-n');
        }
        if (hasE) {
            addArm('e');
            road.classList.add('has-e');
        }
        if (hasS) {
            addArm('s');
            road.classList.add('has-s');
        }
        if (hasW) {
            addArm('w');
            road.classList.add('has-w');
        }
        if (hasVertical) road.classList.add('has-vertical');
        if (hasHorizontal) road.classList.add('has-horizontal');

        const lane = document.createElement('span');
        lane.className = 'city-road-lane';
        lane.style.setProperty('--lane-v-top', hasN ? '0%' : '50%');
        lane.style.setProperty('--lane-v-bottom', hasS ? '0%' : '50%');
        lane.style.setProperty('--lane-h-left', hasW ? '0%' : '50%');
        lane.style.setProperty('--lane-h-right', hasE ? '0%' : '50%');
        road.appendChild(lane);

        cell.appendChild(road);
    }

    function appendObjectTileVisual(cell, tile, options) {
        if (!cell || !isObjectTile(tile)) return;

        const opts = options || {};
        if (isDrillgroundTile(tile)) {
            appendDrillgroundVisual(cell, opts);
            return;
        }

        const spriteUrl = getTileSpriteUrl(tile);
        if (spriteUrl) {
            const img = document.createElement('img');
            img.className = 'city-cell-sprite';
            if (tile === 'tree') img.classList.add('city-tree-sprite');
            img.src = spriteUrl;
            img.alt = tile;
            img.decoding = 'async';
            cell.appendChild(img);
            return;
        }

        if (tile === 'tree') {
            const treeIcon = document.createElement('span');
            treeIcon.className = 'city-tree-dot';
            cell.appendChild(treeIcon);
            return;
        }

        const fallback = document.createElement('span');
        fallback.className = `city-cell-icon label-${tile}`;
        fallback.textContent = TILE_ICON[tile] || (isAirportTile(tile) ? '공항' : String(tile).slice(0, 2));
        cell.appendChild(fallback);
    }

    function clearVisitSigns() {
        _activeVisitSigns = [];
        _visitSignByIndex = new Map();
        _visitSignLoadToken += 1;
    }

    function setVisitSigns(entries) {
        const next = Array.isArray(entries) ? entries.slice() : [];
        _activeVisitSigns = next;
        _visitSignByIndex = new Map();

        next.forEach((entry) => {
            const idx = Math.floor(toNumber(entry?.targetCellIndex, -1));
            if (idx < 0) return;
            const prev = _visitSignByIndex.get(idx);
            if (!prev || toNumber(entry?.createdAtMs, 0) >= toNumber(prev?.createdAtMs, 0)) {
                _visitSignByIndex.set(idx, entry);
            }
        });

        applyVisitSignsToGrid();
    }

    function getSignAtIndex(index) {
        if (!Number.isInteger(index)) return null;
        return _visitSignByIndex.get(index) || null;
    }

    function getMyInstalledVisitSign() {
        const ownerUid = String(_currentVisitData?.uid || '').trim();
        const myUid = getCurrentUid();
        if (!ownerUid || !myUid) return null;

        let found = null;
        const signs = Array.isArray(_activeVisitSigns) ? _activeVisitSigns : [];
        signs.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            const fromUid = String(entry.fromUid || '').trim();
            const toUid = String(entry.toUid || '').trim();
            if (fromUid !== myUid) return;
            if (toUid !== ownerUid) return;
            const prevMs = Math.floor(toNumber(found?.createdAtMs, 0));
            const nextMs = Math.floor(toNumber(entry?.createdAtMs, 0));
            if (!found || nextMs >= prevMs) {
                found = entry;
            }
        });
        return found;
    }

    function syncVisitActionButtons() {
        const footerEl = byId('city-visit-footer');
        if (!footerEl) return;

        const messageBtn = footerEl.querySelector('[data-visit-action="message"]');
        if (!messageBtn) return;

        const active = _visitSignPlacement.active === true;
        const mySign = getMyInstalledVisitSign();
        messageBtn.textContent = active ? '설치취소' : (mySign ? '표지판수정' : '표지판설치');
        messageBtn.dataset.visitSignActionMode = active ? 'cancel' : (mySign ? 'edit' : 'create');
        messageBtn.classList.toggle('is-cancel', active);
    }

    function applyVisitSignPlacementToGrid() {
        syncVisitActionButtons();
        if (!Array.isArray(_renderCache.cells) || _renderCache.cells.length <= 0) return;

        const active = _visitSignPlacement.active === true;
        const availableSet = (_visitSignPlacement.availableSet instanceof Set)
            ? _visitSignPlacement.availableSet
            : new Set();
        const selectedIndex = Math.floor(toNumber(_visitSignPlacement.selectedIndex, -1));

        for (let i = 0; i < _renderCache.cells.length; i += 1) {
            const cell = _renderCache.cells[i];
            if (!cell) continue;

            cell.classList.remove('visit-sign-placement-available', 'visit-sign-placement-selected');
            delete cell.dataset.visitSignPlaceable;
            if (!active) continue;

            const index = Math.floor(toNumber(cell.dataset.index, -1));
            if (!Number.isInteger(index) || index < 0) continue;

            if (availableSet.has(index)) {
                cell.classList.add('visit-sign-placement-available');
                cell.dataset.visitSignPlaceable = '1';
                if (selectedIndex === index) {
                    cell.classList.add('visit-sign-placement-selected');
                }
            } else {
                cell.dataset.visitSignPlaceable = '0';
            }
        }
    }

    function cancelVisitSignPlacement(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const wasActive = _visitSignPlacement.active === true;
        _visitSignPlacement = {
            active: false,
            busy: false,
            text: '',
            targetUid: '',
            targetName: '',
            cityPayload: null,
            availableSet: new Set(),
            suggestedIndex: -1,
            selectedIndex: -1
        };
        applyVisitSignPlacementToGrid();
        if (wasActive && opts.notify === true) {
            showToast('표지판 설치를 취소했습니다.');
        }
    }

    function beginVisitSignPlacement(plan) {
        const payload = (plan && typeof plan === 'object') ? plan : null;
        if (!payload) {
            showToast('표지판 배치 정보를 확인할 수 없습니다.');
            return;
        }

        const text = String(payload.text || '').trim();
        if (!text) {
            showToast('표지판 문구를 입력해주세요.');
            return;
        }

        const maxIndex = Math.max(0, Math.floor(toNumber(_renderCache.total, 0)));
        const availableSet = new Set();
        (Array.isArray(payload.availableCellIndexes) ? payload.availableCellIndexes : []).forEach((value) => {
            const idx = Math.floor(toNumber(value, -1));
            if (idx < 0) return;
            if (maxIndex > 0 && idx >= maxIndex) return;
            availableSet.add(idx);
        });

        if (availableSet.size <= 0) {
            showToast('표지판 설치 가능한 빈자리를 찾지 못했습니다.');
            return;
        }

        const suggestedIndex = Math.floor(toNumber(payload.suggestedCellIndex, -1));
        _visitSignPlacement = {
            active: true,
            busy: false,
            text,
            targetUid: String(payload.targetUid || _currentVisitData?.uid || ''),
            targetName: String(payload.targetName || getVisitOwnerName() || '상대 지휘관'),
            cityPayload: payload.cityPayload || _currentVisitData?.base?.city || null,
            availableSet,
            suggestedIndex,
            selectedIndex: availableSet.has(suggestedIndex) ? suggestedIndex : -1
        };
        applyVisitSignPlacementToGrid();
        showToast('설치할 칸을 선택하세요. 표지판설치를 다시 누르면 취소됩니다.');
    }

    async function commitVisitSignPlacement(cellIndex) {
        if (_visitSignPlacement.active !== true) {
            traceSignInstall('E_COMMIT_NOT_ACTIVE', { cellIndex }, false);
            return;
        }
        if (_visitSignPlacement.busy === true) {
            traceSignInstall('E_COMMIT_BUSY', { cellIndex }, false);
            return;
        }

        const index = Math.floor(toNumber(cellIndex, -1));
        if (index < 0) {
            traceSignInstall('E_COMMIT_INDEX_INVALID', { cellIndex }, true);
            return;
        }

        if (!(_visitSignPlacement.availableSet instanceof Set) || !_visitSignPlacement.availableSet.has(index)) {
            traceSignInstall('E_COMMIT_CELL_NOT_ALLOWED', {
                index,
                availableCount: _visitSignPlacement.availableSet instanceof Set
                    ? _visitSignPlacement.availableSet.size
                    : -1
            }, true);
            showToast('표지판 설치 가능한 칸을 선택해주세요.');
            return;
        }

        if (typeof CitySimVisitActions === 'undefined'
            || !CitySimVisitActions
            || typeof CitySimVisitActions.createSignEntry !== 'function') {
            traceSignInstall('E_COMMIT_ACTION_API_MISSING', {
                hasActions: typeof CitySimVisitActions !== 'undefined',
                hasCreateSignEntry: !!(typeof CitySimVisitActions !== 'undefined'
                    && CitySimVisitActions
                    && typeof CitySimVisitActions.createSignEntry === 'function')
            }, true);
            showToast('표지판 설치 기능을 사용할 수 없습니다.');
            return;
        }

        _visitSignPlacement.busy = true;
        _visitSignPlacement.selectedIndex = index;
        applyVisitSignPlacementToGrid();

        let result = null;
        try {
            result = await CitySimVisitActions.createSignEntry(
                {
                    game: getActionGameRef() || getGameRef(),
                    targetUid: _visitSignPlacement.targetUid || String(_currentVisitData?.uid || ''),
                    targetName: _visitSignPlacement.targetName || getVisitOwnerName(),
                    cityPayload: _visitSignPlacement.cityPayload || _currentVisitData?.base?.city || null
                },
                _visitSignPlacement.text,
                {
                    targetCellIndex: index,
                    skipSlotValidation: true
                }
            );
        } catch (err) {
            traceSignInstall('E_COMMIT_CREATE_THROW', { message: String(err?.message || err || '') }, true);
            console.warn('[CitySimVisitRenderer] commitVisitSignPlacement failed:', err);
        }

        const ok = !!(result && result.ok === true);
        const reason = String(result?.reason || '');
        const errorCode = String(result?.errorCode || '').trim();
        const errorMessage = String(result?.errorMessage || '').trim();

        _visitSignPlacement.busy = false;
        if (ok) {
            cancelVisitSignPlacement({ notify: false });
            refreshVisitSigns();
            return;
        }

        traceSignInstall('E_COMMIT_CREATE_FAILED', {
            reason,
            index,
            errorCode,
            errorMessage
        }, true);

        if (reason === 'invalid_slot' || reason === 'no_slot' || reason === 'already_exists') {
            cancelVisitSignPlacement({ notify: false });
            refreshVisitSigns();
            return;
        }

        if (reason === 'unauthenticated' || reason === 'missing_target' || reason === 'self_target') {
            cancelVisitSignPlacement({ notify: false });
            return;
        }

        if (reason === 'write_failed') {
            if (errorCode === 'permission-denied') {
                showToast('표지판 권한 거부: Firestore rules 배포/로그인 세션을 확인해주세요.');
            } else if (errorCode) {
                showToast(`표지판 저장 실패: ${errorCode}`);
            } else {
                showToast('표지판 저장 실패: 네트워크 또는 Firebase 설정을 확인해주세요.');
            }
            applyVisitSignPlacementToGrid();
            return;
        }

        if (!reason) {
            showToast('표지판 설치에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } else {
            const suffix = errorCode ? ` (${errorCode})` : '';
            showToast(`표지판 설치 실패: ${reason}${suffix}`);
        }
        applyVisitSignPlacementToGrid();
    }

    function applyVisitSignsToGrid() {
        if (!Array.isArray(_renderCache.cells) || _renderCache.cells.length <= 0) return;

        for (let i = 0; i < _renderCache.cells.length; i += 1) {
            const cell = _renderCache.cells[i];
            if (!cell) continue;

            const marker = cell.querySelector('[data-city-visit-sign="1"]');
            if (marker) marker.remove();
            delete cell.dataset.visitSignIndex;

            const index = Math.floor(toNumber(cell.dataset.index, -1));
            const sign = getSignAtIndex(index);
            if (!sign) continue;

            const signBtn = document.createElement('button');
            signBtn.type = 'button';
            signBtn.className = 'city-visit-sign-marker';
            signBtn.dataset.cityVisitSign = '1';
            signBtn.dataset.signId = String(sign.id || '');
            const fromName = String(sign.fromName || '익명관').trim().slice(0, 40) || '익명관';
            const text = String(sign.text || '').trim();
            signBtn.setAttribute('aria-label', `${fromName}님의 표지판 보기`);
            signBtn.title = `${fromName}: ${text}`;

            const board = document.createElement('span');
            board.className = 'city-visit-sign-board';
            board.setAttribute('aria-hidden', 'true');

            const line = document.createElement('span');
            line.className = 'city-visit-sign-line';
            line.textContent = text || '(빈 문구)';
            board.appendChild(line);

            const leftPole = document.createElement('span');
            leftPole.className = 'city-visit-sign-pole city-visit-sign-pole-left';
            leftPole.setAttribute('aria-hidden', 'true');

            const rightPole = document.createElement('span');
            rightPole.className = 'city-visit-sign-pole city-visit-sign-pole-right';
            rightPole.setAttribute('aria-hidden', 'true');

            signBtn.append(board, leftPole, rightPole);
            cell.appendChild(signBtn);
            cell.dataset.visitSignIndex = String(index);
        }

        applyVisitSignPlacementToGrid();
    }

    async function refreshVisitSigns() {
        const ownerUid = String(_currentVisitData?.uid || '').trim();
        if (!ownerUid) {
            setVisitSigns([]);
            return;
        }

        const token = ++_visitSignLoadToken;
        if (typeof CitySimVisitActions === 'undefined'
            || !CitySimVisitActions
            || typeof CitySimVisitActions.fetchActiveSigns !== 'function') {
            setVisitSigns([]);
            return;
        }

        try {
            const entries = await CitySimVisitActions.fetchActiveSigns(ownerUid);
            if (token !== _visitSignLoadToken) return;
            setVisitSigns(entries);
        } catch (err) {
            if (token !== _visitSignLoadToken) return;
            console.warn('[CitySimVisitRenderer] refreshVisitSigns failed:', err);
            setVisitSigns([]);
        }
    }

    function openSignDetailModal(sign) {
        const entry = (sign && typeof sign === 'object') ? sign : null;
        if (!entry) return;

        const ownerUid = String(_currentVisitData?.uid || '').trim();
        const myUid = getCurrentUid();
        const fromUid = String(entry.fromUid || '').trim();
        const toUid = String(entry.toUid || '').trim();
        const isOwner = !!(ownerUid && myUid && ownerUid === myUid);
        const isInstaller = !!(myUid && fromUid === myUid);
        const canDelete = !!(myUid && (isOwner || toUid === myUid || isInstaller));
        const canEdit = isInstaller;
        const createdAtText = formatDateTime(entry.createdAtMs);
        const fromName = String(entry.fromName || '익명관');
        const text = String(entry.text || '');
        const signId = String(entry.id || '').trim();

        const htmlParts = [
            '<div class="city-visit-modal-wrap">',
            `<div class="city-visit-modal-desc"><strong>${escapeHtml(fromName)}</strong>님의 표지판</div>`,
            `<div class="city-visit-sign-text">${escapeHtml(text)}</div>`,
            `<div class="city-visit-sign-meta">설치 시간: ${escapeHtml(createdAtText)}</div>`,
            '</div>'
        ];
        if (canEdit || canDelete) {
            htmlParts.splice(htmlParts.length - 1, 0, '<div class="city-visit-modal-actions">');
            if (canEdit) {
                htmlParts.splice(htmlParts.length - 1, 0,
                    '<button type="button" class="city-visit-modal-submit" data-visit-sign-edit="1">표지판 수정</button>');
            }
            if (canDelete) {
                htmlParts.splice(htmlParts.length - 1, 0,
                    '<button type="button" class="city-visit-modal-submit is-danger" data-visit-sign-delete="1">표지판 철거</button>');
            }
            htmlParts.splice(htmlParts.length - 1, 0, '</div>');
        }
        const html = htmlParts.join('');

        const gameRef = getGameRef();
        if (gameRef && typeof gameRef.openCityActionModal === 'function') {
            gameRef.openCityActionModal('표지판', html, {
                allowHtml: true,
                detail: ''
            });

            if (!canEdit && !canDelete) return;
            if (!signId) return;

            const msgEl = byId('city-action-msg');
            if (!msgEl) return;
            const editBtn = msgEl.querySelector('[data-visit-sign-edit="1"]');
            const deleteBtn = msgEl.querySelector('[data-visit-sign-delete="1"]');
            let busy = false;

            const setBusy = (nextBusy) => {
                busy = nextBusy === true;
                if (editBtn) editBtn.disabled = busy;
                if (deleteBtn) deleteBtn.disabled = busy;
            };

            const canDeleteByApi = () => (
                typeof CitySimVisitActions !== 'undefined'
                && CitySimVisitActions
                && typeof CitySimVisitActions.deleteSign === 'function'
            );

            const runDeleteSign = (silent) => {
                if (!canDeleteByApi()) return Promise.resolve({ ok: false, reason: 'api_unavailable' });
                return Promise.resolve(CitySimVisitActions.deleteSign(signId, { silent: silent === true }));
            };

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if (busy) return;
                    if (!canDeleteByApi()) {
                        showToast('표지판 제거 기능을 사용할 수 없습니다.');
                        return;
                    }
                    setBusy(true);
                    runDeleteSign(false)
                        .then((result) => {
                            if (!result || result.ok !== true) {
                                setBusy(false);
                                return;
                            }
                            if (typeof gameRef.closeCityActionModal === 'function') {
                                gameRef.closeCityActionModal();
                            }
                            refreshVisitSigns();
                        })
                        .catch((err) => {
                            console.warn('[CitySimVisitRenderer] delete sign failed:', err);
                            setBusy(false);
                        });
                });
            }

            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    if (busy) return;
                    if (!canDeleteByApi()) {
                        showToast('표지판 수정 기능을 사용할 수 없습니다.');
                        return;
                    }
                    setBusy(true);
                    runDeleteSign(true)
                        .then((result) => {
                            if (!result || result.ok !== true) {
                                showToast('기존 표지판 철거에 실패해 수정을 시작할 수 없습니다.');
                                setBusy(false);
                                return;
                            }

                            if (typeof gameRef.closeCityActionModal === 'function') {
                                gameRef.closeCityActionModal();
                            }
                            cancelVisitSignPlacement({ notify: false });
                            refreshVisitSigns();

                            if (typeof CitySimVisitActions === 'undefined'
                                || !CitySimVisitActions
                                || typeof CitySimVisitActions.openSignComposer !== 'function') {
                                showToast('표지판 수정 UI를 열 수 없습니다.');
                                return;
                            }

                            CitySimVisitActions.openSignComposer({
                                game: gameRef,
                                modalTitle: '표지판 수정',
                                submitLabel: '수정 설치',
                                initialText: text,
                                targetUid: String(_currentVisitData?.uid || ''),
                                targetName: getVisitOwnerName(),
                                cityPayload: _currentVisitData?.base?.city || null,
                                enableManualPlacement: true,
                                onRequestPlacement: (plan) => {
                                    beginVisitSignPlacement(plan);
                                },
                                onSuccess: () => {
                                    refreshVisitSigns();
                                }
                            });
                        })
                        .catch((err) => {
                            console.warn('[CitySimVisitRenderer] edit sign prepare failed:', err);
                            showToast('표지판 수정 준비에 실패했습니다.');
                            setBusy(false);
                        });
                });
            }
            return;
        }

        showToast(`${fromName}: ${text}`);
    }

    function openAllianceMenu() {
        const gameRef = getGameRef();
        if (!gameRef || typeof gameRef.openCityActionModal !== 'function') {
            showToast('준비중입니다.');
            return;
        }

        const html = [
            '<div class="city-visit-modal-wrap">',
            '<div class="city-visit-modal-desc">외교 기능은 준비중입니다.</div>',
            '<div class="city-visit-modal-list city-visit-modal-list-compact">',
            '<button type="button" class="city-visit-modal-btn" data-visit-alliance-request="1"><span>동맹제안</span><span>준비중</span></button>',
            '</div>',
            '</div>'
        ].join('');

        gameRef.openCityActionModal('외교 행동', html, {
            allowHtml: true,
            detail: ''
        });

        const msgEl = byId('city-action-msg');
        if (!msgEl) return;
        const btnAlliance = msgEl.querySelector('[data-visit-alliance-request]');

        if (btnAlliance) {
            btnAlliance.addEventListener('click', () => {
                showToast('동맹 제안 기능은 준비중입니다.');
            });
        }
    }

    function clampVisitViewToVisibleBounds() {
        const wrap = byId('city-visit-content');
        const grid = byId('city-visit-grid');
        if (!wrap || !grid) return;

        const scale = normalizeVisitScale(_visitView.scale);
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

        _visitView.scale = scale;
        _visitView.x = Math.round(clampNumber(Number(_visitView.x) || 0, -maxX, maxX));
        _visitView.y = Math.round(clampNumber(Number(_visitView.y) || 0, -maxY, maxY));
    }

    function applyVisitViewTransform() {
        const viewport = byId('city-visit-viewport');
        if (!viewport) return;

        clampVisitViewToVisibleBounds();
        const x = Math.round(Number(_visitView.x) || 0);
        const y = Math.round(Number(_visitView.y) || 0);
        const scale = normalizeVisitScale(_visitView.scale);
        _visitView.scale = scale;

        viewport.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale.toFixed(2)})`;
    }

    function resetVisitView() {
        _visitView = { x: 0, y: 0, scale: 1 };
    }

    function bindVisitViewportInteractions() {
        const viewport = byId('city-visit-viewport');
        if (!viewport || viewport._visitInteractionsBound) return;

        const drag = {
            active: false,
            moved: false,
            pointerId: null,
            startX: 0,
            startY: 0,
            originX: 0,
            originY: 0,
            maxDistance: 0
        };
        const touchPoints = new Map();
        const pinch = {
            active: false,
            startDist: 1,
            startScale: 1,
            startViewX: 0,
            startViewY: 0
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
            drag.maxDistance = 0;
            if (!pinch.active) {
                viewport.classList.remove('dragging');
            }
        };

        const endPinch = () => {
            if (!pinch.active) return;
            pinch.active = false;
            if (!drag.active) {
                viewport.classList.remove('dragging');
            }
        };

        const startPinchFromTouches = () => {
            const pair = getPinchPair();
            if (!pair) return;
            const [p1, p2] = pair;
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (!Number.isFinite(dist) || dist <= 0) return;

            pinch.active = true;
            pinch.startDist = Math.max(1, dist);
            pinch.startScale = normalizeVisitScale(_visitView.scale);
            pinch.startViewX = Number(_visitView.x) || 0;
            pinch.startViewY = Number(_visitView.y) || 0;

            drag.active = false;
            drag.moved = false;
            drag.pointerId = null;
            viewport.classList.add('dragging');
        };

        viewport.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            if (e.pointerType === 'touch') {
                touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (touchPoints.size >= 2) {
                    startPinchFromTouches();
                    return;
                }
            }

            drag.active = true;
            drag.moved = false;
            drag.pointerId = e.pointerId;
            drag.startX = e.clientX;
            drag.startY = e.clientY;
            drag.originX = Number(_visitView.x) || 0;
            drag.originY = Number(_visitView.y) || 0;
            drag.maxDistance = 0;
            viewport.classList.add('dragging');

            try {
                viewport.setPointerCapture(e.pointerId);
            } catch (_) { }
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
                const nextScale = normalizeVisitScale(prevScale * (dist / pinch.startDist));
                if (!Number.isFinite(nextScale)) return;

                const centerX = (p1.x + p2.x) * 0.5;
                const centerY = (p1.y + p2.y) * 0.5;
                const rect = viewport.getBoundingClientRect();
                const relX = centerX - (rect.left + rect.width / 2);
                const relY = centerY - (rect.top + rect.height / 2);
                const ratio = nextScale / prevScale;

                _visitView.scale = nextScale;
                _visitView.x = pinch.startViewX - relX * (ratio - 1);
                _visitView.y = pinch.startViewY - relY * (ratio - 1);
                applyVisitViewTransform();
                return;
            }

            if (!drag.active || drag.pointerId !== e.pointerId) return;

            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            const moveDist = Math.hypot(dx, dy);
            if (moveDist > drag.maxDistance) drag.maxDistance = moveDist;
            const moveThreshold = getTapMoveThreshold(e.pointerType);
            if (!drag.moved && moveDist > moveThreshold) {
                drag.moved = true;
            }
            if (!drag.moved) return;

            _visitView.x = drag.originX + dx;
            _visitView.y = drag.originY + dy;
            applyVisitViewTransform();
        });

        const handlePointerRelease = (e, releaseType) => {
            const releaseKind = String(releaseType || 'pointerup');
            const releaseDx = Number(e.clientX) - Number(drag.startX);
            const releaseDy = Number(e.clientY) - Number(drag.startY);
            const releaseDist = Math.hypot(releaseDx, releaseDy);
            const moveThreshold = getTapMoveThreshold(e.pointerType);
            const movedByDistance = Number.isFinite(releaseDist) && releaseDist > moveThreshold;
            const movedByTravel = Number.isFinite(drag.maxDistance) && drag.maxDistance > moveThreshold;
            const canCommitByTap = (
                releaseKind === 'pointerup'
                && _visitSignPlacement.active === true
                && pinch.active !== true
                && drag.active === true
                && drag.pointerId === e.pointerId
                && drag.moved !== true
                && movedByDistance !== true
                && movedByTravel !== true
            );

            if (_visitSignPlacement.active === true && canCommitByTap !== true) {
                traceSignInstall('E_TAP_RELEASE_SKIPPED', {
                    releaseKind,
                    pointerType: String(e.pointerType || ''),
                    dragActive: drag.active === true,
                    dragPointerId: drag.pointerId,
                    eventPointerId: e.pointerId,
                    pinchActive: pinch.active === true,
                    dragMoved: drag.moved === true,
                    releaseDist: Math.round(toNumber(releaseDist, 0) * 100) / 100,
                    dragMaxDist: Math.round(toNumber(drag.maxDistance, 0) * 100) / 100,
                    moveThreshold
                }, false);
            }

            if (canCommitByTap) {
                let cell = (e.target && typeof e.target.closest === 'function')
                    ? e.target.closest('.city-cell')
                    : null;
                if (!cell && typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
                    const hit = document.elementFromPoint(e.clientX, e.clientY);
                    if (hit && typeof hit.closest === 'function') {
                        cell = hit.closest('.city-cell');
                    }
                }

                if (cell) {
                    const idx = Math.floor(toNumber(cell.dataset.index, -1));
                    if (idx >= 0) {
                        commitVisitSignPlacement(idx);
                    } else {
                        traceSignInstall('E_TAP_CELL_INDEX_INVALID', {
                            rawIndex: cell?.dataset?.index,
                            pointerType: e.pointerType
                        }, true);
                    }
                } else {
                    traceSignInstall('E_TAP_CELL_NOT_FOUND', {
                        pointerType: e.pointerType,
                        x: Math.floor(toNumber(e.clientX, -1)),
                        y: Math.floor(toNumber(e.clientY, -1))
                    }, true);
                }
            }

            if (e.pointerType === 'touch') {
                touchPoints.delete(e.pointerId);
                if (pinch.active && touchPoints.size < 2) {
                    endPinch();
                }
            }
            endDrag(e.pointerId);
        };

        viewport.addEventListener('pointerup', (e) => {
            handlePointerRelease(e, 'pointerup');
        });
        viewport.addEventListener('pointercancel', (e) => {
            handlePointerRelease(e, 'pointercancel');
        });
        viewport.addEventListener('lostpointercapture', () => {
            touchPoints.clear();
            endPinch();
            endDrag(null);
        });

        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();

            const prevScale = normalizeVisitScale(_visitView.scale);
            const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
            const nextScale = normalizeVisitScale(prevScale * zoomFactor);
            if (Math.abs(nextScale - prevScale) < 0.0001) return;

            const rect = viewport.getBoundingClientRect();
            const relX = e.clientX - (rect.left + rect.width / 2);
            const relY = e.clientY - (rect.top + rect.height / 2);
            const ratio = nextScale / prevScale;

            _visitView.scale = nextScale;
            _visitView.x = (Number(_visitView.x) || 0) - relX * (ratio - 1);
            _visitView.y = (Number(_visitView.y) || 0) - relY * (ratio - 1);
            applyVisitViewTransform();
        }, { passive: false });

        viewport._visitInteractionsBound = true;
    }

    function renderVisitorGrid(cityPayload) {
        const gridEl = byId('city-visit-grid');
        if (!gridEl) return;

        const city = (cityPayload && typeof cityPayload === 'object') ? cityPayload : {};
        const grid = Array.isArray(city.grid) ? city.grid : [];
        const groundLayer = Array.isArray(city.ground) ? city.ground : [];
        const cols = Math.max(12, Math.floor(Number(city.cols) || 24));
        const rows = Math.max(8, Math.floor(Number(city.rows) || 14));
        const total = cols * rows;
        const drillgroundSlots = normalizeDrillgroundSlots(city.drillgroundSlots, total, grid);
        const drillgroundInfantryCounts = normalizeDrillgroundInfantryCounts(
            city.drillgroundInfantryCounts,
            total,
            grid,
            drillgroundSlots
        );
        const drillgroundOccupancy = buildDrillgroundOccupancy(grid, cols, drillgroundSlots, drillgroundInfantryCounts);

        gridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
        gridEl.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
        gridEl.style.gridAutoColumns = 'minmax(0, 1fr)';
        gridEl.style.gridAutoRows = 'minmax(0, 1fr)';
        gridEl.style.aspectRatio = `${cols} / ${rows}`;

        if (_renderCache.cols !== cols || _renderCache.rows !== rows || _renderCache.total !== total || _renderCache.cells.length !== total) {
            _renderCache.cols = cols;
            _renderCache.rows = rows;
            _renderCache.total = total;
            _renderCache.cells = [];
            _renderCache.signatures = new Array(total).fill('');

            const frag = document.createDocumentFragment();
            for (let i = 0; i < total; i++) {
                const cell = document.createElement('div');
                cell.className = 'city-cell city-cell-readonly';
                cell.dataset.index = String(i);
                _renderCache.cells.push(cell);
                frag.appendChild(cell);
            }
            gridEl.innerHTML = '';
            gridEl.appendChild(frag);
        }

        for (let index = 0; index < total; index++) {
            const cell = _renderCache.cells[index];
            if (!cell) continue;

            const tile = grid[index] ?? null;
            const ground = normalizeGroundType(groundLayer[index]);
            const groundTransitionMask = ground === 'grass' ? 0 : getGroundTransitionMask(ground, groundLayer, index, cols, rows);
            const roadMask = tile === 'road' ? getRoadMask(grid, index, cols, rows) : 0;
            const tileClassName = getTileClassName(tile);
            const drillgroundEntry = (isDrillgroundTile(tile))
                ? getDrillgroundEntryAt(index, drillgroundOccupancy)
                : null;
            const drillgroundUnitKey = drillgroundEntry ? drillgroundEntry.unitKey : '';
            const drillgroundUnitSpan = drillgroundEntry ? drillgroundEntry.span : 0;
            const drillgroundInfantryCount = drillgroundEntry ? clampDrillgroundInfantryCount(drillgroundEntry.infantryCount) : 1;
            const drillgroundIsAnchor = drillgroundEntry ? drillgroundEntry.isAnchor === true : false;
            const drillgroundIsCompanion = !!(drillgroundEntry && drillgroundEntry.span >= 2 && drillgroundEntry.isAnchor !== true);
            const drillgroundMerge = (isDrillgroundTile(tile))
                ? getDrillgroundMergeFlags(grid, cols, index)
                : { mergeLeft: false, mergeRight: false, mergeUp: false, mergeDown: false };

            const signature = [
                ground,
                groundTransitionMask,
                tile || '',
                drillgroundUnitKey,
                drillgroundUnitSpan,
                drillgroundInfantryCount,
                drillgroundIsAnchor ? 1 : 0,
                drillgroundIsCompanion ? 1 : 0,
                drillgroundMerge.mergeLeft ? 1 : 0,
                drillgroundMerge.mergeRight ? 1 : 0,
                drillgroundMerge.mergeUp ? 1 : 0,
                drillgroundMerge.mergeDown ? 1 : 0,
                roadMask,
                tileClassName
            ].join('|');

            if (_renderCache.signatures[index] === signature) continue;
            _renderCache.signatures[index] = signature;

            const classes = ['city-cell', 'city-cell-readonly', `ground-${ground}`];
            if (tileClassName) classes.push(tileClassName);
            if (isDrillgroundTile(tile) && drillgroundMerge.mergeRight) classes.push('city-drillground-merged-left');
            if (isDrillgroundTile(tile) && drillgroundMerge.mergeLeft) classes.push('city-drillground-merged-right');
            if (isDrillgroundTile(tile) && drillgroundIsAnchor) classes.push('city-drillground-anchor');
            if (isDrillgroundTile(tile) && drillgroundIsCompanion) classes.push('city-drillground-companion');
            cell.className = classes.join(' ');
            cell.replaceChildren();

            appendGroundSurface(cell, ground, groundTransitionMask);
            if (tile === 'road') {
                appendRoadShape(cell, roadMask);
            }
            if (isObjectTile(tile)) {
                appendObjectTileVisual(
                    cell,
                    tile,
                    isDrillgroundTile(tile)
                        ? {
                            unitKey: drillgroundUnitKey,
                            span: drillgroundUnitSpan,
                            infantryCount: drillgroundInfantryCount,
                            isAnchor: drillgroundIsAnchor,
                            isCompanion: drillgroundIsCompanion,
                            mergeLeft: drillgroundMerge.mergeLeft,
                            mergeRight: drillgroundMerge.mergeRight,
                            mergeUp: drillgroundMerge.mergeUp,
                            mergeDown: drillgroundMerge.mergeDown
                        }
                        : undefined
                );
            }
        }

        applyVisitSignsToGrid();
    }

    function updateFooterStats() {
        // UI-only phase: action bar buttons are shown instead of numerical summary.
    }

    function setLoadingState(mode) {
        const loading = byId('city-visit-loading');
        if (!loading) return;

        if (mode === 'empty') {
            loading.innerHTML = `
                <div class="city-visit-loading-box">
                    <i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>
                    <p>아직 공개된 기지 데이터가 없습니다.</p>
                </div>`;
            return;
        }

        if (mode === 'error') {
            loading.innerHTML = `
                <div class="city-visit-loading-box">
                    <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                    <p>기지 정보를 불러오지 못했습니다.</p>
                </div>`;
            return;
        }

        loading.innerHTML = `
            <div class="city-visit-loading-box">
                <div class="city-visit-spinner" aria-hidden="true"></div>
                <p>기지 정보를 불러오는 중...</p>
            </div>`;
    }

    function getVisitOwnerName() {
        const base = (_currentVisitData && _currentVisitData.base && typeof _currentVisitData.base === 'object')
            ? _currentVisitData.base
            : {};
        return String(base.displayName || '상대 지휘관');
    }

    function getActionGameRef() {
        const g = getGameRef();
        if (g && typeof g.openCityActionModal === 'function') return g;
        return null;
    }

    function showActionUnavailable(title, message) {
        const t = String(title || '안내');
        const msg = String(message || '').trim() || '기능을 사용할 수 없습니다.';
        const gameRef = getActionGameRef();
        if (gameRef) {
            gameRef.openCityActionModal(t, msg, { detail: '' });
            return;
        }
        showToast(msg);
    }

    function handleAction(actionKey) {
        const key = String(actionKey || '').trim();
        if (!key) return;

        if (_visitSignPlacement.active === true && key !== 'message') {
            cancelVisitSignPlacement({ notify: false });
        }

        if (key === 'message') {
            if (_visitSignPlacement.active === true) {
                cancelVisitSignPlacement({ notify: true });
                return;
            }

            const mySign = getMyInstalledVisitSign();
            if (mySign) {
                openSignDetailModal(mySign);
                return;
            }

            if (typeof CitySimVisitActions === 'undefined'
                || !CitySimVisitActions
                || typeof CitySimVisitActions.openSignComposer !== 'function') {
                showActionUnavailable('표지판설치', '표지판 기능 초기화에 실패했습니다. 새로고침 후 다시 시도해주세요.');
                return;
            }

            const gameRef = getActionGameRef();
            if (!gameRef) {
                showActionUnavailable('표지판설치', '표지판 창을 열 수 없습니다.');
                return;
            }

            CitySimVisitActions.openSignComposer({
                game: gameRef,
                modalTitle: '표지판설치',
                targetUid: String(_currentVisitData?.uid || ''),
                targetName: getVisitOwnerName(),
                cityPayload: _currentVisitData?.base?.city || null,
                enableManualPlacement: true,
                onRequestPlacement: (plan) => {
                    beginVisitSignPlacement(plan);
                },
                onSuccess: () => {
                    refreshVisitSigns();
                }
            });
            return;
        }

        if (key === 'alliance') {
            openAllianceMenu();
            return;
        }

        if (key === 'units') {
            openVisitUnitInventory();
            return;
        }

        const message = (key === 'war') ? '선전포고 기능은 준비중입니다.' : '준비중입니다.';
        showToast(message);
    }

    function renderVisitorBase(targetUid, baseData) {
        const modal = byId('city-visit-viewer-modal');
        const loading = byId('city-visit-loading');
        const content = byId('city-visit-content');
        const footer = byId('city-visit-footer');
        const ownerName = byId('city-visit-owner-name');
        const ownerStats = byId('city-visit-owner-stats');
        const ownerLevel = byId('city-visit-level');
        const ownerLevelBadge = byId('city-visit-level-badge');
        const ownerHonor = byId('city-visit-honor');
        const ownerPop = byId('city-visit-pop');
        const ownerMoney = byId('city-visit-money');
        const ownerGold = byId('city-visit-gold');
        const ownerCombat = byId('city-visit-combat-power');
        const viewport = byId('city-visit-viewport');

        if (!modal) {
            console.warn('[CitySimVisitRenderer] Modal not found');
            return;
        }

        const safeBase = (baseData && typeof baseData === 'object') ? baseData : {};
        _currentVisitData = {
            uid: String(targetUid || ''),
            base: safeBase
        };
        cancelVisitSignPlacement({ notify: false });
        clearVisitSigns();

        bindVisitViewportInteractions();
        resetVisitView();
        if (viewport) {
            viewport.classList.remove('dragging');
            viewport.style.transform = '';
        }

        modal.classList.remove('hidden');
        if (loading) loading.classList.remove('hidden');
        setLoadingState('loading');
        if (content) content.classList.add('hidden');
        if (footer) footer.classList.remove('hidden');

        const displayName = String(safeBase.displayName || '익명 방문자');
        const hudInfo = collectVisitHudInfo(safeBase);

        if (ownerName) ownerName.textContent = `${displayName}의 기지`;
        if (ownerStats) {
            ownerStats.textContent = `전투력 ${formatNumber(hudInfo.combatPower)} · 건물 ${formatNumber(hudInfo.buildingCount)} · 유닛 ${formatNumber(hudInfo.unitTotal)}`;
        }
        if (ownerLevel) ownerLevel.textContent = String(formatNumber(hudInfo.level));
        if (ownerLevelBadge) {
            ownerLevelBadge.src = getLevelBadgePath(hudInfo.level);
            ownerLevelBadge.alt = `레벨 ${formatNumber(hudInfo.level)}`;
        }
        if (ownerHonor) ownerHonor.textContent = formatNumber(hudInfo.honor);
        if (ownerPop) ownerPop.textContent = `${formatNumber(hudInfo.pop)}/${formatNumber(hudInfo.maxPop)}`;
        if (ownerMoney) ownerMoney.textContent = formatNumber(hudInfo.money);
        if (ownerGold) ownerGold.textContent = formatNumber(hudInfo.gold);
        if (ownerCombat) ownerCombat.textContent = formatNumber(hudInfo.combatPower);

        setTimeout(() => {
            const cityPayload = safeBase.city || null;
            if (!cityPayload || !Array.isArray(cityPayload.grid) || cityPayload.grid.length === 0) {
                setLoadingState('empty');
                setVisitSigns([]);
                return;
            }

            try {
                renderVisitorGrid(cityPayload);
                updateFooterStats(cityPayload);

                if (loading) loading.classList.add('hidden');
                if (content) content.classList.remove('hidden');

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        applyVisitViewTransform();
                    });
                });
                refreshVisitSigns();
            } catch (err) {
                console.error('[CitySimVisitRenderer] Render failed:', err);
                setLoadingState('error');
                setVisitSigns([]);
            }
        }, 300);
    }

    function close() {
        const modal = byId('city-visit-viewer-modal');
        if (modal) modal.classList.add('hidden');

        cancelVisitSignPlacement({ notify: false });
        _currentVisitData = null;
        _renderCache = { cols: 0, rows: 0, total: 0, cells: [], signatures: [] };
        resetVisitView();
        clearVisitSigns();

        const gridEl = byId('city-visit-grid');
        if (gridEl) gridEl.innerHTML = '';
        const viewport = byId('city-visit-viewport');
        if (viewport) {
            viewport.style.transform = '';
            viewport.classList.remove('dragging');
        }

        const loading = byId('city-visit-loading');
        const content = byId('city-visit-content');
        const footer = byId('city-visit-footer');

        if (loading) {
            loading.classList.remove('hidden');
            setLoadingState('loading');
        }
        if (content) content.classList.add('hidden');
        if (footer) footer.classList.add('hidden');
    }

    function initEventHandlers() {
        bindVisitViewportInteractions();
        syncVisitActionButtons();

        const gridEl = byId('city-visit-grid');
        if (gridEl && !gridEl._visitSignClickBound) {
            gridEl.addEventListener('click', (e) => {
                const cell = (e.target && typeof e.target.closest === 'function')
                    ? e.target.closest('.city-cell')
                    : null;
                if (_visitSignPlacement.active === true && cell) {
                    const index = Math.floor(toNumber(cell.dataset.index, -1));
                    if (typeof e.preventDefault === 'function') e.preventDefault();
                    if (typeof e.stopPropagation === 'function') e.stopPropagation();
                    if (index >= 0) {
                        traceSignInstall('E_TAP_CLICK_FALLBACK', {
                            index,
                            pointerType: String(e.pointerType || '')
                        }, false);
                        commitVisitSignPlacement(index);
                    }
                    return;
                }

                const marker = (e.target && typeof e.target.closest === 'function')
                    ? e.target.closest('[data-city-visit-sign="1"]')
                    : null;
                if (!marker) return;

                const markerCell = marker.closest('.city-cell');
                if (!markerCell) return;
                const index = Math.floor(toNumber(markerCell.dataset.index, -1));
                if (index < 0) return;
                const sign = getSignAtIndex(index);
                if (!sign) return;

                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
                openSignDetailModal(sign);
            });
            gridEl._visitSignClickBound = true;
        }

        const footerEl = byId('city-visit-footer');
        if (footerEl && !footerEl._visitActionClickBound) {
            footerEl.addEventListener('click', (e) => {
                const btn = (e.target && typeof e.target.closest === 'function')
                    ? e.target.closest('[data-visit-action]')
                    : null;
                if (!btn) return;

                const action = String(btn.getAttribute('data-visit-action') || '').trim();
                if (!action) return;

                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof e.stopPropagation === 'function') e.stopPropagation();

                if (action === 'close') {
                    close();
                    return;
                }
                handleAction(action);
            });
            footerEl._visitActionClickBound = true;
        }

        const escapeHandler = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                const modal = byId('city-visit-viewer-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    close();
                }
            }
        };

        if (!global._cityVisitEscHandlerRegistered) {
            document.addEventListener('keydown', escapeHandler);
            global._cityVisitEscHandlerRegistered = true;
        }

        if (!global._cityVisitResizeHandlerRegistered && typeof window !== 'undefined') {
            window.addEventListener('resize', () => {
                const modal = byId('city-visit-viewer-modal');
                if (!modal || modal.classList.contains('hidden')) return;
                applyVisitViewTransform();
            });
            global._cityVisitResizeHandlerRegistered = true;
        }

        const modal = byId('city-visit-viewer-modal');
        if (modal && !modal._visitBackdropHandlerRegistered) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) close();
            });
            modal._visitBackdropHandlerRegistered = true;
        }
    }

    global.CitySimVisitRenderer = {
        renderVisitorBase,
        handleAction,
        close,
        init: initEventHandlers
    };

    if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEventHandlers);
    } else {
        initEventHandlers();
    }
})(window);

