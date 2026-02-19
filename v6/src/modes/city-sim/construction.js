(function (global) {
    const MSG_SELECT_CARD = '카드를 선택하면 배치 모드로 전환됩니다.';
    const MSG_SELECT_TILE = '배치할 타일을 선택하세요.';
    const MOVE_COST_MONEY = 0;

    const BUILDING_DEFS = {
        ground_dirt: {
            id: 'ground_dirt',
            name: '흙',
            icon: '흙',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 17
        },
        ground_grass: {
            id: 'ground_grass',
            name: '잔디',
            icon: '잔디',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 17
        },
        ground_concrete: {
            id: 'ground_concrete',
            name: '회색 타일',
            icon: '회색',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 67
        },
        ground_asphalt: {
            id: 'ground_asphalt',
            name: '아스팔트',
            icon: '아스팔트',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 50
        },
        road: {
            id: 'road',
            name: '도로',
            icon: '도로',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 84
        },
        tree: {
            id: 'tree',
            name: '나무',
            icon: '나무',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 84
        },
        barracks: {
            id: 'barracks',
            name: '병영',
            icon: '병영',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 500
        },
        airport: {
            id: 'airport',
            name: '공항',
            icon: '공항',
            category: 'build',
            maxOwned: 2,
            costMoney: 2500
        },
        airport_tr: {
            id: 'airport_tr',
            name: '공항(우상)',
            icon: '공항',
            category: 'build',
            hidden: true,
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 0
        },
        airport_bl: {
            id: 'airport_bl',
            name: '공항(좌하)',
            icon: '공항',
            category: 'build',
            hidden: true,
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 0
        },
        airport_br: {
            id: 'airport_br',
            name: '공항(우하)',
            icon: '공항',
            category: 'build',
            hidden: true,
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 0
        },
        factory: {
            id: 'factory',
            name: '전차기지',
            icon: '전차',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 1167
        },
        powerplant: {
            id: 'powerplant',
            name: '연구소',
            icon: '연구',
            category: 'build',
            maxOwned: 2,
            costMoney: 1667
        },
        oilrig: {
            id: 'oilrig',
            name: '보급창고',
            icon: '보급',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 834
        },
        drillground: {
            id: 'drillground',
            name: '연병장',
            icon: '연병',
            category: 'build',
            maxOwned: 20,
            costMoney: 84
        },
        hq: {
            id: 'hq',
            name: '사령부',
            icon: '본부',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 2500
        },
        house: {
            id: 'house',
            name: '회사',
            icon: '회사',
            category: 'build',
            maxOwned: 6,
            costMoney: 800
        },
        apartment_large: {
            id: 'apartment_large',
            name: '아파트',
            icon: '아파트',
            category: 'build',
            maxOwned: 4,
            costMoney: 500
        },
        shop_store: {
            id: 'shop_store',
            name: '가게',
            icon: '가게',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 400
        },
        tax_office: {
            id: 'tax_office',
            name: '세무소',
            icon: '세무',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 900
        },
        park_plaza: {
            id: 'park_plaza',
            name: '공원(2x2)',
            icon: '공원',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 250
        },
        park_plaza_tr: {
            id: 'park_plaza_tr',
            name: '공원(우상)',
            icon: '공원',
            category: 'build',
            hidden: true,
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 0
        },
        park_plaza_bl: {
            id: 'park_plaza_bl',
            name: '공원(좌하)',
            icon: '공원',
            category: 'build',
            hidden: true,
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 0
        },
        park_plaza_br: {
            id: 'park_plaza_br',
            name: '공원(우하)',
            icon: '공원',
            category: 'build',
            hidden: true,
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 0
        },
        park: {
            id: 'park',
            name: '공원',
            icon: '공원',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 167
        },
        monument: {
            id: 'monument',
            name: '기념물',
            icon: '기념',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 334
        },
        decor: {
            id: 'decor',
            // Keep legacy tile id for save compatibility, but show as "집" in UI.
            name: '집',
            icon: '집',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 300
        },
        eraser: {
            id: 'eraser',
            name: '철거',
            icon: '철거',
            category: 'build',
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 0
        }
    };

    const AIRPORT_FOOTPRINT_PARTS = [
        { dx: 0, dy: 0, tile: 'airport' },
        { dx: 1, dy: 0, tile: 'airport_tr' },
        { dx: 2, dy: 0, tile: 'airport_r0c2' },
        { dx: 3, dy: 0, tile: 'airport_r0c3' },
        { dx: 0, dy: 1, tile: 'airport_bl' },
        { dx: 1, dy: 1, tile: 'airport_br' },
        { dx: 2, dy: 1, tile: 'airport_r1c2' },
        { dx: 3, dy: 1, tile: 'airport_r1c3' }
    ];
    const LEGACY_AIRPORT_FOOTPRINT_PARTS = [
        { dx: 0, dy: 0, tile: 'airport' },
        { dx: 1, dy: 0, tile: 'airport_tr' },
        { dx: 0, dy: 1, tile: 'airport_bl' },
        { dx: 1, dy: 1, tile: 'airport_br' }
    ];
    const AIRPORT_WIDTH = 4;
    const AIRPORT_HEIGHT = 2;
    const PARK_PLAZA_FOOTPRINT_PARTS = [
        { dx: 0, dy: 0, tile: 'park_plaza' },
        { dx: 1, dy: 0, tile: 'park_plaza_tr' },
        { dx: 0, dy: 1, tile: 'park_plaza_bl' },
        { dx: 1, dy: 1, tile: 'park_plaza_br' }
    ];
    const PARK_PLAZA_WIDTH = 2;
    const PARK_PLAZA_HEIGHT = 2;

    AIRPORT_FOOTPRINT_PARTS.forEach((part) => {
        const tile = part.tile;
        if (tile === 'airport') return;
        if (Object.prototype.hasOwnProperty.call(BUILDING_DEFS, tile)) return;
        BUILDING_DEFS[tile] = {
            id: tile,
            name: `공항(${part.dy},${part.dx})`,
            icon: '공항',
            category: 'build',
            hidden: true,
            maxOwned: Number.POSITIVE_INFINITY,
            costMoney: 0
        };
    });

    const BUILD_TABS = [
        { id: 'base', label: '경제' },
        { id: 'industry', label: '국방' },
        { id: 'decor', label: '장식' },
        { id: 'infra', label: '기반' },
        { id: 'tile', label: '타일' }
    ];

    const TOOLS_BY_TAB = {
        base: ['decor', 'shop_store', 'apartment_large', 'house', 'tax_office'],
        industry: ['drillground', 'oilrig', 'barracks', 'factory', 'powerplant', 'airport'],
        decor: ['tree', 'park', 'park_plaza', 'monument'],
        infra: ['road', 'eraser'],
        tile: ['ground_dirt', 'ground_grass', 'ground_asphalt', 'ground_concrete']
    };

    const LEGACY_BUILD_TAB_FALLBACK = {
        build: 'base'
    };

    const INVENTORY_TABS = [
        { id: 'infantry', label: '보병' },
        { id: 'armored', label: '기갑' },
        { id: 'air', label: '공군' },
        { id: 'special', label: '특수' },
        { id: 'veteran', label: '베테랑' },
        { id: 'supply', label: '보급품' }
    ];

    const SUPPLY_INVENTORY_ITEMS = [
        {
            boxId: 'box_level1',
            name: '일반 보급박스',
            asset: 'png/store/BOX_Level1.png'
        },
        {
            boxId: 'box_level2',
            name: '특수 보급박스',
            asset: 'png/store/BOX_Level2.png'
        },
        {
            boxId: 'confidential',
            name: '1급 기밀문서',
            asset: 'png/store/1confidential.png'
        }
    ];
    const VETERAN_ITEM_DEFS = {
        drone_module: {
            id: 'drone_module',
            name: '드론 모듈',
            asset: 'png/box.png',
            desc: '드론병 전용 · 드론 최대 발진 수 3기'
        }
    };
    const VETERAN_ITEM_ORDER = ['drone_module'];
    const VETERAN_ITEM_COMPAT = {
        drone_module: new Set(['drone_operator'])
    };

    const CITY_UNIT_PRODUCTION = {
        barracks: {
            title: '병영 유닛 생산',
            unitKeys: ['special_forces', 'engineer', 'drone_operator', 'special_ops', 'sniper']
        },
        factory: {
            title: '전차기지 유닛 생산',
            unitKeys: ['humvee', 'apc', 'mbt', 'aa_tank', 'spg', 'icbm']
        },
        powerplant: {
            title: '연구소 선행 연구',
            unitKeys: ['aa_tank', 'spg', 'icbm', 'chinook', 'bomber']
        },
        airport: {
            title: '공항 유닛 생산',
            unitKeys: ['recon', 'apache', 'fighter', 'blackhawk', 'chinook', 'bomber']
        },
        oilrig: {
            title: '보급 생산',
            unitKeys: ['supply_box']
        }
    };

    const CITY_UNIT_COST_OVERRIDES = {
        infantry: 200,
        engineer: 350,
        special_forces: 200,
        special_ops: 417,
        sniper: 667,
        drone_operator: 500,
        humvee: 400,
        apc: 700,
        mbt: 1100,
        aa_tank: 980,
        spg: 1550,
        icbm: 1200,
        recon: 834,
        apache: 1334,
        fighter: 1667,
        blackhawk: 1667,
        chinook: 2500,
        bomber: 3334,
        tactical_missile: 1800,
        emp: 1500,
        supply_box: 300
    };

    function getUnitGlobalCostMultiplier() {
        const raw = Number(global.UNIT_GLOBAL_COST_MULT);
        if (Number.isFinite(raw) && raw > 0 && raw <= 1) return raw;
        return 1;
    }

    const UNIT_WEAPON_LABEL_OVERRIDES = {
        infantry: 'K2 소총',
        engineer: '유도 미사일 발사기',
        special_forces: '보병 전투 소총',
        special_ops: 'K1A 기관단총',
        sniper: 'M24 저격소총',
        drone_operator: '드론 조종기 + 카빈',
        humvee: '중기관총',
        apc: '기관포',
        mbt: '120mm 활강포',
        aa_tank: '대공 미사일',
        spg: '155mm 곡사포',
        tactical_missile: '전술 탄도탄',
        emp: 'EMP 탄두'
    };
    const FACTORY_RESEARCH_KEYS = ['aa_tank', 'spg', 'icbm', 'chinook', 'bomber'];
    const FACTORY_RESEARCH_KEY_SET = new Set(FACTORY_RESEARCH_KEYS);

    const TILE_META = {
        road: { icon: '', className: 'tile-road' },
        tree: { icon: '나무', className: 'tile-tree' },
        hq: { icon: '본부', className: 'tile-hq' },
        house: { icon: '회사', className: 'tile-house' },
        apartment_large: { icon: '아파트', className: 'tile-apartment-large' },
        shop_store: { icon: '가게', className: 'tile-shop-store' },
        tax_office: { icon: '세무', className: 'tile-tax-office' },
        drillground: { icon: '연병', className: 'tile-drillground' },
        barracks: { icon: '병영', className: 'tile-barracks' },
        airport: { icon: '공항', className: 'tile-airport' },
        airport_tr: { icon: '공항', className: 'tile-airport' },
        airport_bl: { icon: '공항', className: 'tile-airport' },
        airport_br: { icon: '공항', className: 'tile-airport' },
        factory: { icon: '전차', className: 'tile-factory' },
        powerplant: { icon: '연구', className: 'tile-powerplant' },
        oilrig: { icon: '보급', className: 'tile-oilrig' },
        park_plaza: { icon: '공원', className: 'tile-park' },
        park_plaza_tr: { icon: '공원', className: 'tile-park' },
        park_plaza_bl: { icon: '공원', className: 'tile-park' },
        park_plaza_br: { icon: '공원', className: 'tile-park' },
        park: { icon: '공원', className: 'tile-park' },
        monument: { icon: '기념', className: 'tile-monument' },
        decor: { icon: '집', className: 'tile-decor' }
    };
    AIRPORT_FOOTPRINT_PARTS.forEach((part) => {
        if (!Object.prototype.hasOwnProperty.call(TILE_META, part.tile)) {
            TILE_META[part.tile] = { icon: '공항', className: 'tile-airport' };
        }
    });

    const AIRPORT_TILE_PARTS = AIRPORT_FOOTPRINT_PARTS.map((part) => part.tile);
    const AIRPORT_TILE_SET = new Set(AIRPORT_TILE_PARTS);
    const AIRPORT_OFFSET_BY_TILE = AIRPORT_FOOTPRINT_PARTS.reduce((acc, part) => {
        acc[part.tile] = { dx: part.dx, dy: part.dy };
        return acc;
    }, {});
    const PARK_PLAZA_TILE_PARTS = PARK_PLAZA_FOOTPRINT_PARTS.map((part) => part.tile);
    const PARK_PLAZA_TILE_SET = new Set(PARK_PLAZA_TILE_PARTS);
    const PARK_PLAZA_OFFSET_BY_TILE = PARK_PLAZA_FOOTPRINT_PARTS.reduce((acc, part) => {
        acc[part.tile] = { dx: part.dx, dy: part.dy };
        return acc;
    }, {});
    const BUILDING_SPRITE_BASE_SIZE = 256;
    const BUILDING_SPRITE_MAX_DPR = 2;
    const spriteUrlCache = new Map();
    const buildCardPreviewCache = new Map();
    const inventoryIconCache = new Map();
    const drillgroundMissileIconCache = new Map();
    const DRILLGROUND_MISSILE_ICON_KEYS = new Set(['emp', 'nuke', 'tactical_missile']);
    const CITY_OWN_SIGN_REFRESH_MS = 15000;

    function getBuildingSpriteSize() {
        const rawDpr = (typeof window !== 'undefined') ? Number(window.devicePixelRatio) : 1;
        const dpr = Number.isFinite(rawDpr) ? Math.max(1, Math.min(BUILDING_SPRITE_MAX_DPR, rawDpr)) : 1;
        return Math.max(128, Math.round(BUILDING_SPRITE_BASE_SIZE * dpr));
    }

    function showToast(msg) {
        if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
            ui.showToast(msg);
        }
    }

    function getActiveAuthUid() {
        if (typeof CitySimAuth !== 'undefined'
            && CitySimAuth
            && typeof CitySimAuth.getCurrentUser === 'function') {
            const user = CitySimAuth.getCurrentUser();
            if (user && user.uid) return String(user.uid);
        }
        const fb = global.RECLAIM_FB;
        if (fb && typeof fb.getUser === 'function') {
            const user = fb.getUser();
            if (user && user.uid) return String(user.uid);
        }
        return '';
    }

    function getCityOwnSignRuntime(game) {
        if (!game || typeof game !== 'object') {
            return {
                uid: '',
                entries: [],
                byIndex: new Map(),
                loadedAt: 0,
                loading: null,
                token: 0
            };
        }
        if (!game._cityOwnSignRuntime || typeof game._cityOwnSignRuntime !== 'object') {
            game._cityOwnSignRuntime = {
                uid: '',
                entries: [],
                byIndex: new Map(),
                loadedAt: 0,
                loading: null,
                token: 0
            };
        }
        const rt = game._cityOwnSignRuntime;
        if (!(rt.byIndex instanceof Map)) rt.byIndex = new Map();
        if (!Array.isArray(rt.entries)) rt.entries = [];
        rt.uid = String(rt.uid || '');
        rt.loadedAt = Math.max(0, Math.floor(Number(rt.loadedAt) || 0));
        rt.token = Math.max(0, Math.floor(Number(rt.token) || 0));
        return rt;
    }

    function setCityOwnSigns(game, uid, entries) {
        const rt = getCityOwnSignRuntime(game);
        const nextUid = String(uid || '');
        const list = Array.isArray(entries) ? entries.slice() : [];
        const byIndex = new Map();
        list.forEach((entry) => {
            const idx = Math.floor(Number(entry?.targetCellIndex) || -1);
            if (idx < 0) return;
            const prev = byIndex.get(idx);
            const nextMs = Math.max(0, Math.floor(Number(entry?.createdAtMs) || 0));
            const prevMs = Math.max(0, Math.floor(Number(prev?.createdAtMs) || 0));
            if (!prev || nextMs >= prevMs) {
                byIndex.set(idx, entry);
            }
        });
        rt.uid = nextUid;
        rt.entries = list;
        rt.byIndex = byIndex;
        rt.loadedAt = Date.now();
    }

    function resetCityOwnSigns(game, uid) {
        const rt = getCityOwnSignRuntime(game);
        rt.token = Math.max(0, Math.floor(Number(rt.token) || 0)) + 1;
        rt.loading = null;
        rt.uid = String(uid || '');
        rt.entries = [];
        rt.byIndex = new Map();
        rt.loadedAt = 0;
        return rt;
    }

    function ensureCityOwnSigns(game, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const force = opts.force === true;
        const uid = getActiveAuthUid();
        const rt = getCityOwnSignRuntime(game);
        const now = Date.now();

        if (!uid) {
            if (rt.uid || rt.entries.length > 0 || rt.byIndex.size > 0 || rt.loading) {
                resetCityOwnSigns(game, '');
            }
            return Promise.resolve([]);
        }

        if (rt.uid !== uid) {
            resetCityOwnSigns(game, uid);
        }

        if (rt.loading) return rt.loading;
        if (!force && rt.loadedAt > 0 && (now - rt.loadedAt) < CITY_OWN_SIGN_REFRESH_MS) {
            return Promise.resolve(rt.entries);
        }

        if (typeof CitySimVisitActions === 'undefined'
            || !CitySimVisitActions
            || typeof CitySimVisitActions.fetchActiveSigns !== 'function') {
            return Promise.resolve(rt.entries);
        }

        rt.token = (rt.token || 0) + 1;
        const fetchToken = rt.token;
        const task = Promise.resolve(CitySimVisitActions.fetchActiveSigns(uid))
            .then((entries) => {
                const latest = getCityOwnSignRuntime(game);
                if (latest.token !== fetchToken) return latest.entries;
                if (latest.uid !== uid) return latest.entries;
                setCityOwnSigns(game, uid, entries);
                if (game && typeof game.renderCityGrid === 'function') {
                    game.renderCityGrid();
                }
                return getCityOwnSignRuntime(game).entries;
            })
            .catch((err) => {
                console.warn('[CitySimConstruction] ensureCityOwnSigns failed:', err);
                return getCityOwnSignRuntime(game).entries;
            })
            .finally(() => {
                const latest = getCityOwnSignRuntime(game);
                if (latest.loading === task) {
                    latest.loading = null;
                }
            });

        rt.loading = task;
        return task;
    }

    function refreshOwnSigns(game, options) {
        return ensureCityOwnSigns(game, options);
    }

    function formatSignDateTime(ms) {
        const value = Math.max(0, Math.floor(Number(ms) || 0));
        if (value <= 0) return '-';
        try {
            return new Date(value).toLocaleString('ko-KR', {
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

    function openCityOwnSignDetail(game, sign) {
        if (!game || typeof game.openCityActionModal !== 'function') return;
        const entry = (sign && typeof sign === 'object') ? sign : null;
        if (!entry) return;
        const signId = String(entry.id || '').trim();
        const fromName = String(entry.fromName || '익명관').trim().slice(0, 40) || '익명관';
        const text = String(entry.text || '').trim();
        const createdAtText = formatSignDateTime(entry.createdAtMs);
        const canDelete = !!(signId
            && typeof CitySimVisitActions !== 'undefined'
            && CitySimVisitActions
            && typeof CitySimVisitActions.deleteSign === 'function');

        const htmlParts = [
            '<div class="city-visit-modal-wrap">',
            `<div class="city-visit-modal-desc"><strong>${escapeHtml(fromName)}</strong>님의 표지판</div>`,
            `<div class="city-visit-sign-text">${escapeHtml(text)}</div>`,
            `<div class="city-visit-sign-meta">설치 시간: ${escapeHtml(createdAtText)}</div>`
        ];
        if (canDelete) {
            htmlParts.push(
                '<div class="city-visit-modal-actions">',
                '<button type="button" class="city-visit-modal-submit" data-city-own-sign-delete="1">표지판 철거</button>',
                '</div>'
            );
        }
        htmlParts.push('</div>');

        game.openCityActionModal('방문 표지판', htmlParts.join(''), {
            allowHtml: true,
            detail: ''
        });

        if (!canDelete) return;
        const msgEl = document.getElementById('city-action-msg');
        const deleteBtn = msgEl ? msgEl.querySelector('[data-city-own-sign-delete="1"]') : null;
        if (!deleteBtn) return;

        let busy = false;
        deleteBtn.addEventListener('click', () => {
            if (busy) return;
            busy = true;
            deleteBtn.disabled = true;

            Promise.resolve(CitySimVisitActions.deleteSign(signId))
                .then((result) => {
                    if (!result || result.ok !== true) {
                        const reason = String(result?.reason || '').trim();
                        showToast(reason ? `표지판 철거 실패: ${reason}` : '표지판 철거에 실패했습니다.');
                        busy = false;
                        deleteBtn.disabled = false;
                        return;
                    }
                    if (typeof game.closeCityActionModal === 'function') {
                        game.closeCityActionModal();
                    }
                    ensureCityOwnSigns(game, { force: true });
                })
                .catch((err) => {
                    console.warn('[CitySimConstruction] delete own sign failed:', err);
                    showToast('표지판 철거에 실패했습니다.');
                    busy = false;
                    deleteBtn.disabled = false;
                });
        });
    }

    function appendCityOwnSignMarker(game, cell, sign) {
        if (!cell || !sign) return;
        const signId = String(sign.id || '').trim();
        if (!signId) return;
        const fromName = String(sign.fromName || '익명관').trim().slice(0, 40) || '익명관';
        const text = String(sign.text || '').trim();

        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'city-visit-sign-marker';
        marker.dataset.cityOwnSign = '1';
        marker.dataset.signId = signId;
        marker.setAttribute('aria-label', `${fromName}님의 표지판 보기`);
        marker.title = `${fromName}: ${text}`;

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

        marker.append(board, leftPole, rightPole);
        marker.addEventListener('click', (e) => {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            openCityOwnSignDetail(game, sign);
        });
        cell.appendChild(marker);
    }

    function openOwnSignAtCell(game, index) {
        const idx = Math.floor(Number(index));
        if (!Number.isFinite(idx) || idx < 0) return false;
        const rt = getCityOwnSignRuntime(game);
        const sign = rt.byIndex.get(idx) || null;
        if (!sign) {
            ensureCityOwnSigns(game, { force: true });
            return false;
        }
        openCityOwnSignDetail(game, sign);
        return true;
    }

    function getBuildingDefs() {
        return BUILDING_DEFS;
    }

    function getBuildTabs() {
        return BUILD_TABS.slice();
    }

    function getInventoryTabs() {
        return INVENTORY_TABS.slice();
    }

    function getToolsByTab(tabId) {
        const list = TOOLS_BY_TAB[tabId];
        if (!Array.isArray(list)) return [];
        return list.filter((tool) => Object.prototype.hasOwnProperty.call(BUILDING_DEFS, tool));
    }

    function isGroundTool(tool) {
        return (
            tool === 'ground_grass' ||
            tool === 'ground_dirt' ||
            tool === 'ground_concrete' ||
            tool === 'ground_asphalt'
        );
    }

    function isObjectTool(tool) {
        return !!BUILDING_DEFS[tool] && !isGroundTool(tool) && tool !== 'eraser';
    }

    function normalizeGroundType(value) {
        if (value === 'concrete') return 'concrete';
        if (value === 'dirt') return 'dirt';
        if (value === 'asphalt') return 'asphalt';
        return 'grass';
    }

    function ensureGroundLayer(state) {
        if (!state) return [];
        const total = Math.max(0, Array.isArray(state.grid) ? state.grid.length : 0);

        if (!Array.isArray(state.ground)) {
            state.ground = new Array(total).fill('grass');
            return state.ground;
        }

        if (state.ground.length !== total) {
            const next = new Array(total).fill('grass');
            for (let i = 0; i < Math.min(total, state.ground.length); i++) {
                next[i] = normalizeGroundType(state.ground[i]);
            }
            state.ground = next;
            return state.ground;
        }

        for (let i = 0; i < state.ground.length; i++) {
            state.ground[i] = normalizeGroundType(state.ground[i]);
        }

        return state.ground;
    }

    function getGroundType(state, index) {
        const layer = ensureGroundLayer(state);
        if (!Array.isArray(layer) || index < 0 || index >= layer.length) return 'grass';
        return normalizeGroundType(layer[index]);
    }

    function getRoadMaskWithResolver(state, index, resolveTileAt) {
        if (!state || !Array.isArray(state.grid) || typeof resolveTileAt !== 'function') return 0;

        const cols = Math.max(1, Math.floor(Number(state.cols) || 1));
        const rows = Math.max(1, Math.floor(Number(state.rows) || 1));
        const total = cols * rows;
        if (!Number.isInteger(index) || index < 0 || index >= total) return 0;

        if (resolveTileAt(index) !== 'road') return 0;

        const x = index % cols;
        const y = Math.floor(index / cols);
        let mask = 0;

        const hasRoad = (cx, cy) => {
            if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
            const nIdx = (cy * cols) + cx;
            return resolveTileAt(nIdx) === 'road';
        };

        if (hasRoad(x, y - 1)) mask |= 1;
        if (hasRoad(x + 1, y)) mask |= 2;
        if (hasRoad(x, y + 1)) mask |= 4;
        if (hasRoad(x - 1, y)) mask |= 8;

        return mask;
    }

    function getRoadMaskAt(state, index) {
        return getRoadMaskWithResolver(
            state,
            index,
            (nIdx) => state.grid[nIdx] ?? null
        );
    }

    function getGroundTransitionMaskAt(state, index, groundLayer, targetGroundType) {
        if (!state || !Array.isArray(state.grid)) return 0;
        const layer = Array.isArray(groundLayer) ? groundLayer : ensureGroundLayer(state);
        const target = normalizeGroundType(targetGroundType);
        if (target === 'grass') return 0;
        if (!Array.isArray(layer) || normalizeGroundType(layer[index]) !== target) return 0;

        const cols = Math.max(1, Math.floor(Number(state.cols) || 1));
        const rows = Math.max(1, Math.floor(Number(state.rows) || 1));
        const x = index % cols;
        const y = Math.floor(index / cols);
        let mask = 0;

        const isSameGround = (cx, cy) => {
            if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
            const nIdx = (cy * cols) + cx;
            return normalizeGroundType(layer[nIdx]) === target;
        };

        if (!isSameGround(x, y - 1)) mask |= 1;
        if (!isSameGround(x + 1, y)) mask |= 2;
        if (!isSameGround(x, y + 1)) mask |= 4;
        if (!isSameGround(x - 1, y)) mask |= 8;

        return mask;
    }

    function createDefaultGrid(cols, rows) {
        const safeCols = Math.max(16, Math.floor(Number(cols) || 24));
        const safeRows = Math.max(10, Math.floor(Number(rows) || 14));
        return new Array(safeCols * safeRows).fill(null);
    }

    function setBuildHint(message) {
        const hintEl = document.getElementById('city-build-hint');
        if (!hintEl) return;
        const next = String(message || '').trim();
        if (hintEl.textContent !== next) {
            hintEl.textContent = next;
        }
    }

    function playDemolitionSmokeEffect(game, indices) {
        if (!Array.isArray(indices) || indices.length <= 0) return;
        const gridEl = document.getElementById('city-grid');
        if (!gridEl) return;

        const unique = Array.from(new Set(
            indices
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value >= 0)
        ));
        if (unique.length <= 0) return;

        unique.forEach((index) => {
            const cell = gridEl.querySelector(`.city-cell[data-index="${index}"]`);
            if (!cell) return;

            const durationMs = 600 + Math.floor(Math.random() * 301);
            const layer = document.createElement('span');
            layer.className = 'city-demolition-smoke';
            layer.style.setProperty('--smoke-duration', `${durationMs}ms`);
            layer.setAttribute('aria-hidden', 'true');

            const puff = document.createElement('span');
            puff.className = 'city-demolition-smoke-puff';
            layer.appendChild(puff);

            cell.appendChild(layer);
            window.setTimeout(() => {
                if (layer.parentNode) {
                    layer.parentNode.removeChild(layer);
                }
            }, durationMs + 80);
        });
    }

    function normalizeBuildTab(game, state) {
        const current = String(state?.buildTab || '').trim();
        const legacy = LEGACY_BUILD_TAB_FALLBACK[current] || null;
        if (legacy && BUILD_TABS.some((tab) => tab.id === legacy)) {
            CitySimState.setBuildTab(game, legacy);
            return legacy;
        }
        if (BUILD_TABS.some((tab) => tab.id === current)) return current;
        const fallback = BUILD_TABS[0].id;
        CitySimState.setBuildTab(game, fallback);
        return fallback;
    }

    function setBuildTab(game, tab) {
        const nextTab = BUILD_TABS.find((item) => item.id === tab)?.id || BUILD_TABS[0].id;
        CitySimState.setBuildTab(game, nextTab);
        renderBuildSelection(game);
    }

    function setInventoryTab(game, tab) {
        if (!tab) return;
        const nextTab = INVENTORY_TABS.find((item) => item.id === tab)?.id || INVENTORY_TABS[0].id;
        CitySimState.setInventoryTab(game, nextTab);
        renderInventoryPanel(game);
    }

    function normalizeInventoryTab(game, state) {
        const current = String(state?.inventoryTab || '').trim();
        if (INVENTORY_TABS.some((tab) => tab.id === current)) return current;
        const fallback = INVENTORY_TABS[0].id;
        CitySimState.setInventoryTab(game, fallback);
        return fallback;
    }

    function formatNumber(value) {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        try {
            return n.toLocaleString('ko-KR');
        } catch (_) {
            return String(n);
        }
    }

    function normalizeMoneyStep(value, step = 10) {
        const unit = Math.max(1, Math.floor(Number(step) || 1));
        const n = Math.max(0, Math.floor(Number(value) || 0));
        if (n <= 0) return 0;
        return Math.max(unit, Math.round(n / unit) * unit);
    }

    function getBuildToolCostMoney(tool) {
        const def = BUILDING_DEFS[tool];
        if (!def) return 0;
        const baseCost = Math.max(0, Math.floor(Number(def.costMoney) || 0));
        if (baseCost <= 0) return 0;
        // 건물 건설비는 유닛 글로벌 할인 배율(UNIT_GLOBAL_COST_MULT)과 분리한다.
        return normalizeMoneyStep(baseCost, 10);
    }

    function getTargetGroundByTool(tool) {
        if (tool === 'ground_grass') return 'grass';
        if (tool === 'ground_dirt') return 'dirt';
        if (tool === 'ground_concrete') return 'concrete';
        if (tool === 'ground_asphalt') return 'asphalt';
        return null;
    }

    function isAirportTile(tile) {
        return AIRPORT_TILE_SET.has(tile);
    }

    function isParkPlazaTile(tile) {
        return PARK_PLAZA_TILE_SET.has(tile);
    }

    function isFootprintTool(tool) {
        return tool === 'airport' || tool === 'park_plaza';
    }

    function isFootprintTile(tile) {
        return isAirportTile(tile) || isParkPlazaTile(tile);
    }

    function getAirportAnchorIndex(state, index) {
        if (!state || !Array.isArray(state.grid)) return null;
        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return null;

        const tile = state.grid[index] ?? null;
        if (!isAirportTile(tile)) return null;

        const offset = AIRPORT_OFFSET_BY_TILE[tile];
        if (!offset) return null;

        const cols = Math.max(1, Math.floor(Number(state.cols) || 1));
        const rows = Math.max(1, Math.floor(Number(state.rows) || 1));
        const x = index % cols;
        const y = Math.floor(index / cols);
        const anchorX = x - offset.dx;
        const anchorY = y - offset.dy;
        if (anchorX < 0 || anchorY < 0 || anchorX >= cols || anchorY >= rows) return null;
        const anchorIndex = (anchorY * cols) + anchorX;
        if (!Number.isInteger(anchorIndex)) return null;
        if ((state.grid[anchorIndex] ?? null) !== 'airport') return null;
        return anchorIndex;
    }

    function getParkPlazaAnchorIndex(state, index) {
        if (!state || !Array.isArray(state.grid)) return null;
        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return null;

        const tile = state.grid[index] ?? null;
        if (!isParkPlazaTile(tile)) return null;

        const offset = PARK_PLAZA_OFFSET_BY_TILE[tile];
        if (!offset) return null;

        const cols = Math.max(1, Math.floor(Number(state.cols) || 1));
        const rows = Math.max(1, Math.floor(Number(state.rows) || 1));
        const x = index % cols;
        const y = Math.floor(index / cols);
        const anchorX = x - offset.dx;
        const anchorY = y - offset.dy;
        if (anchorX < 0 || anchorY < 0 || anchorX >= cols || anchorY >= rows) return null;
        const anchorIndex = (anchorY * cols) + anchorX;
        if (!Number.isInteger(anchorIndex)) return null;
        if ((state.grid[anchorIndex] ?? null) !== 'park_plaza') return null;
        return anchorIndex;
    }

    function getAirportFootprintAtAnchor(state, anchorIndex) {
        if (!state || !Array.isArray(state.grid)) return null;
        if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= state.grid.length) return null;

        const cols = Math.max(1, Math.floor(Number(state.cols) || 1));
        const rows = Math.max(1, Math.floor(Number(state.rows) || 1));
        const x = anchorIndex % cols;
        const y = Math.floor(anchorIndex / cols);
        if ((x + AIRPORT_WIDTH - 1) < cols && (y + AIRPORT_HEIGHT - 1) < rows) {
            return AIRPORT_FOOTPRINT_PARTS.map((part) => ({
                index: ((y + part.dy) * cols) + (x + part.dx),
                tile: part.tile
            }));
        }
        if ((x + 1) < cols && (y + 1) < rows) {
            return LEGACY_AIRPORT_FOOTPRINT_PARTS.map((part) => ({
                index: ((y + part.dy) * cols) + (x + part.dx),
                tile: part.tile
            }));
        }
        return null;
    }

    function getAirportBuildFootprintAtAnchor(state, anchorIndex) {
        if (!state || !Array.isArray(state.grid)) return null;
        if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= state.grid.length) return null;
        const cols = Math.max(1, Math.floor(Number(state.cols) || 1));
        const rows = Math.max(1, Math.floor(Number(state.rows) || 1));
        const x = anchorIndex % cols;
        const y = Math.floor(anchorIndex / cols);
        if ((x + AIRPORT_WIDTH - 1) >= cols || (y + AIRPORT_HEIGHT - 1) >= rows) return null;
        return AIRPORT_FOOTPRINT_PARTS.map((part) => ({
            index: ((y + part.dy) * cols) + (x + part.dx),
            tile: part.tile
        }));
    }

    function getParkPlazaFootprintAtAnchor(state, anchorIndex) {
        if (!state || !Array.isArray(state.grid)) return null;
        if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= state.grid.length) return null;
        const cols = Math.max(1, Math.floor(Number(state.cols) || 1));
        const rows = Math.max(1, Math.floor(Number(state.rows) || 1));
        const x = anchorIndex % cols;
        const y = Math.floor(anchorIndex / cols);
        if ((x + PARK_PLAZA_WIDTH - 1) >= cols || (y + PARK_PLAZA_HEIGHT - 1) >= rows) return null;
        return PARK_PLAZA_FOOTPRINT_PARTS.map((part) => ({
            index: ((y + part.dy) * cols) + (x + part.dx),
            tile: part.tile
        }));
    }

    function getFootprintAnchorIndex(state, index, tile) {
        if (tile === 'airport' || isAirportTile(tile)) {
            return getAirportAnchorIndex(state, index);
        }
        if (tile === 'park_plaza' || isParkPlazaTile(tile)) {
            return getParkPlazaAnchorIndex(state, index);
        }
        return null;
    }

    function getFootprintAtAnchor(state, anchorIndex, tool, forBuild) {
        if (tool === 'airport') {
            return forBuild
                ? getAirportBuildFootprintAtAnchor(state, anchorIndex)
                : getAirportFootprintAtAnchor(state, anchorIndex);
        }
        if (tool === 'park_plaza') {
            return getParkPlazaFootprintAtAnchor(state, anchorIndex);
        }
        return null;
    }

    function getFootprintRequirementMessage(tool) {
        if (tool === 'airport') return '공항은 4x2 공간이 필요합니다.';
        if (tool === 'park_plaza') return '공원(2x2)은 2x2 공간이 필요합니다.';
        return '배치 공간이 부족합니다.';
    }

    function clearAirportFootprint(game, state, index) {
        const clearedIndices = [];
        const markCleared = (cellIndex) => {
            if (!Number.isInteger(cellIndex)) return;
            if (!clearedIndices.includes(cellIndex)) {
                clearedIndices.push(cellIndex);
            }
        };

        const anchorIndex = getAirportAnchorIndex(state, index);
        if (!Number.isInteger(anchorIndex)) {
            const currentTile = state.grid[index] ?? null;
            CitySimState.setGridTile(game, index, null);
            if (currentTile) markCleared(index);
            return clearedIndices;
        }
        const footprint = getAirportFootprintAtAnchor(state, anchorIndex);
        if (!Array.isArray(footprint) || footprint.length === 0) {
            const currentTile = state.grid[index] ?? null;
            CitySimState.setGridTile(game, index, null);
            if (currentTile) markCleared(index);
            return clearedIndices;
        }
        let cleared = 0;
        footprint.forEach((entry) => {
            const currentTile = state.grid[entry.index] ?? null;
            if (!isAirportTile(currentTile)) return;
            CitySimState.setGridTile(game, entry.index, null);
            markCleared(entry.index);
            cleared += 1;
        });
        if (cleared <= 0) {
            const currentTile = state.grid[index] ?? null;
            CitySimState.setGridTile(game, index, null);
            if (currentTile) markCleared(index);
        }
        return clearedIndices;
    }

    function clearParkPlazaFootprint(game, state, index) {
        const clearedIndices = [];
        const markCleared = (cellIndex) => {
            if (!Number.isInteger(cellIndex)) return;
            if (!clearedIndices.includes(cellIndex)) {
                clearedIndices.push(cellIndex);
            }
        };

        const anchorIndex = getParkPlazaAnchorIndex(state, index);
        if (!Number.isInteger(anchorIndex)) {
            const currentTile = state.grid[index] ?? null;
            CitySimState.setGridTile(game, index, null);
            if (currentTile) markCleared(index);
            return clearedIndices;
        }
        const footprint = getParkPlazaFootprintAtAnchor(state, anchorIndex);
        if (!Array.isArray(footprint) || footprint.length === 0) {
            const currentTile = state.grid[index] ?? null;
            CitySimState.setGridTile(game, index, null);
            if (currentTile) markCleared(index);
            return clearedIndices;
        }

        let cleared = 0;
        footprint.forEach((entry) => {
            const currentTile = state.grid[entry.index] ?? null;
            if (!isParkPlazaTile(currentTile)) return;
            CitySimState.setGridTile(game, entry.index, null);
            markCleared(entry.index);
            cleared += 1;
        });

        if (cleared <= 0) {
            const currentTile = state.grid[index] ?? null;
            CitySimState.setGridTile(game, index, null);
            if (currentTile) markCleared(index);
        }
        return clearedIndices;
    }

    function clearFootprintAtIndex(game, state, index, tile) {
        if (tile === 'airport' || isAirportTile(tile)) {
            return clearAirportFootprint(game, state, index);
        }
        if (tile === 'park_plaza' || isParkPlazaTile(tile)) {
            return clearParkPlazaFootprint(game, state, index);
        }
        return [];
    }

    function normalizeObjectSelection(state, index, tile) {
        if (!state || !Number.isInteger(index) || index < 0) {
            return { index, tile };
        }
        if (!isFootprintTile(tile)) {
            return { index, tile };
        }
        const anchorIndex = getFootprintAnchorIndex(state, index, tile);
        if (!Number.isInteger(anchorIndex)) {
            return { index, tile };
        }
        const anchorTile = state.grid[anchorIndex] ?? null;
        if (!isFootprintTool(anchorTile)) {
            return { index, tile };
        }
        return { index: anchorIndex, tile: anchorTile };
    }

    function shouldChargeBuildPlacementCost(state, index, tool) {
        if (!state || !Number.isInteger(index) || index < 0 || index >= state.grid.length) return false;
        const costMoney = getBuildToolCostMoney(tool);
        if (costMoney <= 0) return false;
        if (tool === 'eraser') return false;

        const targetGround = getTargetGroundByTool(tool);
        if (targetGround) {
            return getGroundType(state, index) !== targetGround;
        }

        if (!isObjectTool(tool)) return false;
        if (isFootprintTool(tool)) {
            const footprint = getFootprintAtAnchor(state, index, tool, true);
            if (!Array.isArray(footprint) || footprint.length === 0) return false;
            return footprint.some((entry) => ((state.grid[entry.index] ?? null) !== entry.tile));
        }
        const currentTile = state.grid[index] ?? null;
        return currentTile !== tool;
    }

    function getSelectedTileInfo(game) {
        const state = CitySimState.ensure(game);
        const rawIndex = Number(state.selection?.index);
        if (!Number.isInteger(rawIndex) || rawIndex < 0 || rawIndex >= state.grid.length) return null;
        const rawTile = state.grid[rawIndex] ?? null;
        if (!rawTile || !isObjectTool(rawTile)) return null;
        const normalized = normalizeObjectSelection(state, rawIndex, rawTile);
        const index = Number(normalized.index);
        const tile = normalized.tile;
        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return null;
        if (!tile || !isObjectTool(tile)) return null;
        return {
            index,
            tile,
            def: BUILDING_DEFS[tile] || null
        };
    }

    function getMoveSourceInfo(state, placement) {
        if (!state || !placement || placement.mode !== 'move') return null;
        const rawSourceIndex = Number(placement.sourceIndex);
        if (!Number.isInteger(rawSourceIndex) || rawSourceIndex < 0 || rawSourceIndex >= state.grid.length) return null;
        const rawTile = state.grid[rawSourceIndex] ?? null;
        if (!rawTile || !isObjectTool(rawTile)) return null;
        const normalized = normalizeObjectSelection(state, rawSourceIndex, rawTile);
        const sourceIndex = Number(normalized.index);
        const sourceTile = normalized.tile;
        if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= state.grid.length) return null;
        if (!sourceTile || !isObjectTool(sourceTile)) return null;
        return {
            index: sourceIndex,
            tile: sourceTile,
            def: BUILDING_DEFS[sourceTile] || null
        };
    }

    function isMapInputLocked(game, options) {
        if (global.CitySimConstructionValidation
            && typeof global.CitySimConstructionValidation.isMapInputLocked === 'function') {
            return !!global.CitySimConstructionValidation.isMapInputLocked(game, options);
        }
        return false;
    }

    function normalizeUnitKey(value) {
        const key = String(value || '').trim();
        return key || null;
    }

    function getDrillgroundUnitAt(state, index) {
        if (!state || !Number.isInteger(index) || index < 0 || index >= state.grid.length) return null;
        const unitKey = normalizeUnitKey(state.drillgroundSlots?.[index]);
        return unitKey;
    }

    function returnUnitToInventory(game, unitKey) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return;
        CitySimState.mutate(game, (draft) => {
            if (!draft.units || typeof draft.units !== 'object') draft.units = {};
            const current = Math.max(0, Math.floor(Number(draft.units[key]) || 0));
            draft.units[key] = current + 1;
        });
    }

    function consumeUnitFromInventory(game, unitKey) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return false;
        let consumed = false;
        CitySimState.mutate(game, (draft) => {
            if (!draft.units || typeof draft.units !== 'object') draft.units = {};
            const current = Math.max(0, Math.floor(Number(draft.units[key]) || 0));
            if (current <= 0) return;
            draft.units[key] = current - 1;
            consumed = true;
        });
        return consumed;
    }

    function refreshCityUnitPanels(game) {
        if (typeof game.renderCityUnits === 'function') {
            game.renderCityUnits();
        }
        if (typeof game.renderCityInventoryPanel === 'function') {
            game.renderCityInventoryPanel();
        }
        if (typeof game.applyCityUnitsToBattleStock === 'function') {
            game.applyCityUnitsToBattleStock();
        }
    }

    function releaseDrillgroundUnit(game, index) {
        const unitKey = CitySimState.getDrillgroundUnit(game, index);
        if (!unitKey) {
            CitySimState.clearDrillgroundUnit(game, index);
            return null;
        }
        returnUnitToInventory(game, unitKey);
        CitySimState.clearDrillgroundUnit(game, index);
        return unitKey;
    }

    function assignDrillgroundUnit(game, index, nextUnitKey) {
        const state = CitySimState.ensure(game);
        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) {
            return { ok: false, reason: '연병장 위치가 유효하지 않습니다.' };
        }
        if (state.grid[index] !== 'drillground') {
            return { ok: false, reason: '연병장이 선택되지 않았습니다.' };
        }

        const key = normalizeUnitKey(nextUnitKey);
        if (!key) {
            return { ok: false, reason: '유닛을 선택하세요.' };
        }

        const unitDef = getUnitDefByKey(key);
        if (!unitDef) {
            return { ok: false, reason: '유닛 정보를 찾을 수 없습니다.' };
        }

        const currentUnitKey = getDrillgroundUnitAt(state, index);
        if (currentUnitKey === key) {
            return { ok: true, changed: false, unitKey: key, unitDef };
        }

        if (!consumeUnitFromInventory(game, key)) {
            return { ok: false, reason: '보관함 수량이 부족합니다.' };
        }

        if (currentUnitKey) {
            returnUnitToInventory(game, currentUnitKey);
        }
        CitySimState.setDrillgroundUnit(game, index, key);

        return { ok: true, changed: true, unitKey: key, unitDef };
    }

    function getDrillgroundSelectableEntries(game, currentUnitKey) {
        const currentKey = normalizeUnitKey(currentUnitKey);
        const entries = [];

        INVENTORY_TABS.forEach((tab) => {
            getInventoryUnitDefsByTab(tab.id).forEach(({ key, unit }) => {
                const owned = getInventoryUnitCount(game, key, unit);
                const available = owned + (currentKey === key ? 1 : 0);
                entries.push({
                    key,
                    unit,
                    available,
                    isCurrent: currentKey === key,
                    canAssign: available > 0
                });
            });
        });

        return entries;
    }

    function isDrillgroundUnitTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return !!target.closest('.city-drillground-unit, .city-drillground-unit-fallback.city-drillground-unit-populated');
    }

    function isProductionClaimTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return !!target.closest('[data-city-production-claim]');
    }

    function isIncomeClaimTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return !!target.closest('[data-city-income-claim]');
    }

    function closeFloatingPanelsForUnitAction(game) {
        const screen = document.getElementById('city-screen');

        CitySimState.setBuildPanelOpen(game, false);
        CitySimState.setInventoryPanelOpen(game, false);
        CitySimState.setMissionOpen(game, false);

        const buildPanel = document.getElementById('city-build-panel');
        if (buildPanel) buildPanel.classList.remove('open');
        const inventoryPanel = document.getElementById('city-inventory-panel');
        if (inventoryPanel) inventoryPanel.classList.remove('open');
        const missionCard = document.getElementById('city-mission-card');
        if (missionCard) missionCard.classList.add('hidden');
        const missionToggle = document.querySelector('.city-mission-toggle');
        if (missionToggle) missionToggle.classList.remove('hidden');

        if (screen) {
            screen.classList.remove('city-build-open');
            screen.classList.remove('city-inventory-open');
            screen.classList.remove('city-mission-open');
            screen.classList.remove('city-shop-open');
        }

        if (typeof CitySimGacha !== 'undefined' && CitySimGacha && typeof CitySimGacha.close === 'function') {
            CitySimGacha.close();
        }
    }

    function openDrillgroundUnitProfile(game, index) {
        const state = CitySimState.ensure(game);
        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return;
        if (state.grid[index] !== 'drillground') return;

        const unitKey = getDrillgroundUnitAt(state, index);
        if (!unitKey) {
            showToast('연병장에 배치된 유닛이 없습니다.');
            return;
        }

        const unitDef = getUnitDefByKey(unitKey);
        if (!unitDef) {
            showToast('유닛 정보를 찾을 수 없습니다.');
            return;
        }

        openCityUnitProfilePanel(game, unitKey, unitDef, {
            fixedCount: 1,
            source: 'drillground'
        });
    }

    function openDrillgroundUnitPicker(game, selectionInfo) {
        if (!game || !selectionInfo) return;
        if (selectionInfo.tile !== 'drillground') return;
        if (typeof game.openCityActionModal !== 'function') return;
        closeFloatingPanelsForUnitAction(game);

        const currentUnitKey = CitySimState.getDrillgroundUnit(game, selectionInfo.index);
        const entries = getDrillgroundSelectableEntries(game, currentUnitKey);
        if (entries.length === 0) {
            showToast('배치 가능한 유닛 목록을 불러올 수 없습니다.');
            return;
        }

        const title = currentUnitKey ? '연병장 유닛 변경' : '연병장 유닛 배치';
        const bodyHtml = entries.map((entry) => {
            const displayName = getInventoryDisplayName(entry.key, entry.unit);
            const iconUrl = drawInventoryUnitIcon(entry.key);
            const disabled = entry.canAssign !== true && entry.isCurrent !== true;
            const badgeText = entry.isCurrent ? '배치중' : (entry.canAssign ? '배치' : '부족');
            return (
                `<button type="button" class="btn-unit city-action-unitbar-item ${entry.isCurrent ? 'is-current' : ''}${disabled ? ' is-disabled' : ''}" data-city-drillground-unit="${entry.key}" title="${escapeHtml(displayName)}"${disabled ? ' disabled' : ''}>` +
                (
                    iconUrl
                        ? `<img class="city-action-unitbar-icon" src="${iconUrl}" alt="${escapeHtml(displayName)}">`
                        : `<span class="city-action-unitbar-icon-fallback">${escapeHtml(displayName.slice(0, 2))}</span>`
                ) +
                `<span class="city-action-unitbar-name">${escapeHtml(displayName)}</span>` +
                `<span class="city-action-unitbar-meta">가용 ${formatNumber(entry.available)}</span>` +
                `<span class="city-action-unitbar-badge">${badgeText}</span>` +
                `</button>`
            );
        }).join('');

        game.openCityActionModal(
            title,
            `<div class="city-action-unitbar-wrap"><div class="city-action-unitbar">${bodyHtml}</div></div>`,
            {
                allowHtml: true,
                layout: 'bar'
            }
        );

        const msgEl = document.getElementById('city-action-msg');
        if (!msgEl) return;
        msgEl.querySelectorAll('[data-city-drillground-unit]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const unitKey = normalizeUnitKey(btn.getAttribute('data-city-drillground-unit'));
                if (!unitKey) return;

                const latestSelection = getSelectedTileInfo(game);
                if (!latestSelection || latestSelection.index !== selectionInfo.index || latestSelection.tile !== 'drillground') {
                    showToast('선택된 연병장이 없습니다.');
                    return;
                }

                const result = assignDrillgroundUnit(game, selectionInfo.index, unitKey);
                if (!result.ok) {
                    showToast(result.reason || '유닛을 배치할 수 없습니다.');
                    return;
                }

                persist(game);
                renderGrid(game);
                renderContextBar(game);
                refreshCityUnitPanels(game);
                if (typeof game.closeCityActionModal === 'function') {
                    game.closeCityActionModal();
                }

                if (result.changed) {
                    showToast(`${getInventoryDisplayName(result.unitKey, result.unitDef)} 1기 배치 완료`);
                } else {
                    showToast('이미 해당 유닛이 배치되어 있습니다.');
                }
            });
        });
    }

    function getProductionCatalog(tile) {
        return CITY_UNIT_PRODUCTION[tile] || null;
    }

    function isFactoryResearchKey(unitKey) {
        return FACTORY_RESEARCH_KEY_SET.has(String(unitKey || '').trim());
    }

    function isFactoryResearchUnlocked(game, unitKey) {
        if (!isFactoryResearchKey(unitKey)) return false;
        const key = String(unitKey || '').trim();
        const state = CitySimState.ensure(game);
        return state?.researchUnlocks?.[key] === true;
    }

    function markFactoryResearchUnlocked(game, unitKey) {
        if (!isFactoryResearchKey(unitKey)) return false;
        const key = String(unitKey || '').trim();
        let changed = false;
        CitySimState.mutate(game, (draft) => {
            if (!draft.researchUnlocks || typeof draft.researchUnlocks !== 'object') {
                draft.researchUnlocks = {};
            }
            if (draft.researchUnlocks[key] === true) return;
            draft.researchUnlocks[key] = true;
            changed = true;
        });
        return changed;
    }

    function getResearchUnlockTargetLabel(unitKey) {
        const key = String(unitKey || '').trim();
        if (key === 'chinook' || key === 'bomber') return '공항';
        return '전차기지';
    }

    function getBlockedProductionChoiceReason(game, tile, unitKey) {
        if (tile === 'barracks' && unitKey === 'infantry') {
            return '병영에서는 민병대를 생산할 수 없습니다.';
        }
        if (tile === 'factory' && isFactoryResearchKey(unitKey) && !isFactoryResearchUnlocked(game, unitKey)) {
            const unitDef = getUnitDefByKey(unitKey);
            const name = getInventoryDisplayName(unitKey, unitDef || undefined);
            return `${name}은(는) 연구소 선행 연구가 필요합니다.`;
        }
        if (tile === 'airport' && isFactoryResearchKey(unitKey) && !isFactoryResearchUnlocked(game, unitKey)) {
            const unitDef = getUnitDefByKey(unitKey);
            const name = getInventoryDisplayName(unitKey, unitDef || undefined);
            return `${name}은(는) 연구소 선행 연구가 필요합니다.`;
        }
        if (tile === 'powerplant' && isFactoryResearchKey(unitKey) && isFactoryResearchUnlocked(game, unitKey)) {
            const unitDef = getUnitDefByKey(unitKey);
            const name = getInventoryDisplayName(unitKey, unitDef || undefined);
            return `${name} 연구는 이미 완료되었습니다.`;
        }
        return '';
    }

    function isBlockedProductionChoice(game, tile, unitKey) {
        return getBlockedProductionChoiceReason(game, tile, unitKey).length > 0;
    }

    function normalizeProductionQueueEntry(rawEntry) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return null;
        const unitKey = normalizeUnitKey(rawEntry.unitKey || rawEntry.key);
        if (!unitKey) return null;
        const until = Math.max(0, Math.floor(Number(rawEntry.until ?? rawEntry.untilMs ?? rawEntry.cooldownUntil) || 0));
        if (!Number.isFinite(until) || until <= 0) return null;
        return {
            unitKey,
            until
        };
    }

    function getProductionQueueAt(state, index) {
        if (!state || !Number.isInteger(index) || index < 0 || index >= state.grid.length) return null;
        return normalizeProductionQueueEntry(state.productionCooldowns?.[index]);
    }

    function getProductionCooldownUntilAt(state, index) {
        const queue = getProductionQueueAt(state, index);
        return queue ? queue.until : 0;
    }

    function getProductionCooldownRemainingMsAt(state, index, now) {
        const currentNow = Number.isFinite(now) ? now : Date.now();
        const until = getProductionCooldownUntilAt(state, index);
        if (until <= currentNow) return 0;
        return until - currentNow;
    }

    function getProductionCooldownDurationMs(entry) {
        const key = normalizeUnitKey(entry?.key);
        if (key === 'supply_box') return 60000;
        const cost = Math.max(0, Math.floor(Number(entry?.costMoney) || 0));
        const baseCooldown = Math.max(6, Math.floor(Number(entry?.unit?.cooldown) || 0));
        const baseDurationSec = Math.max(
            8,
            Math.min(90, Math.round((baseCooldown * 0.5) + (cost / 80)))
        );
        // Global production speed-up: reduce unit production cooldowns by 70%.
        const durationSec = Math.max(2, Math.round(baseDurationSec * 0.3));
        return durationSec * 1000;
    }

    function getProductionCooldownText(ms) {
        const remain = Math.max(0, Math.floor(Number(ms) || 0));
        const sec = Math.max(1, Math.ceil(remain / 1000));
        return `${sec}s`;
    }

    function getProductionCooldownSmoothText(ms) {
        const remain = Math.max(0, Number(ms) || 0);
        const sec = remain / 1000;
        if (sec >= 10) {
            return `${sec.toFixed(1)}s`;
        }
        return `${sec.toFixed(2)}s`;
    }

    function stopProductionCountdownTicker(game) {
        if (!game || typeof game !== 'object') return;
        const rafId = Number(game._cityProductionCountdownRaf) || 0;
        if (rafId > 0 && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(rafId);
        }
        game._cityProductionCountdownRaf = 0;
    }

    function runProductionCountdownTicker(game) {
        if (!game || typeof game !== 'object') return;
        // Current RAF callback is running now; clear the handle so nested refresh paths can re-arm safely.
        game._cityProductionCountdownRaf = 0;
        const screen = document.getElementById('city-screen');
        if (!screen || screen.classList.contains('hidden')) {
            stopProductionCountdownTicker(game);
            return;
        }

        const timerEls = document.querySelectorAll('.city-production-slot-time[data-city-production-until]');
        if (!timerEls || timerEls.length === 0) {
            stopProductionCountdownTicker(game);
            return;
        }

        const now = Date.now();
        let needsReadyRefresh = false;
        timerEls.forEach((timerEl) => {
            const until = Math.max(0, Math.floor(Number(timerEl.getAttribute('data-city-production-until')) || 0));
            const remainMs = Math.max(0, until - now);
            if (remainMs <= 0) {
                timerEl.textContent = '완료';
                needsReadyRefresh = true;
                return;
            }
            const nextText = getProductionCooldownSmoothText(remainMs);
            if (timerEl.textContent !== nextText) {
                timerEl.textContent = nextText;
            }
        });

        if (needsReadyRefresh) {
            const lastRefreshAt = Math.max(0, Number(game._cityProductionReadyRefreshAt) || 0);
            if ((now - lastRefreshAt) >= 120) {
                game._cityProductionReadyRefreshAt = now;
                renderGrid(game);
                renderContextBar(game);
                if (Number(game._cityProductionCountdownRaf) <= 0) {
                    ensureProductionCountdownTicker(game);
                }
                return;
            }
        }

        if (typeof requestAnimationFrame === 'function') {
            game._cityProductionCountdownRaf = requestAnimationFrame(() => runProductionCountdownTicker(game));
        } else {
            stopProductionCountdownTicker(game);
        }
    }

    function ensureProductionCountdownTicker(game) {
        if (!game || typeof game !== 'object') return;
        if (Number(game._cityProductionCountdownRaf) > 0) return;
        if (typeof requestAnimationFrame !== 'function') return;
        game._cityProductionCountdownRaf = requestAnimationFrame(() => runProductionCountdownTicker(game));
    }

    function setProductionCooldownForBuilding(game, index, entry) {
        const durationMs = getProductionCooldownDurationMs(entry);
        const until = Date.now() + durationMs;
        const unitKey = normalizeUnitKey(entry?.key);
        if (!unitKey || typeof CitySimState.setProductionQueue !== 'function') {
            return {
                durationMs,
                until,
                unitKey: null
            };
        }
        CitySimState.setProductionQueue(game, index, { unitKey, until });
        return {
            durationMs,
            until,
            unitKey
        };
    }

    function tickProductionCooldowns(game) {
        if (global.CitySimConstructionProgress
            && typeof global.CitySimConstructionProgress.tickProductionCooldowns === 'function') {
            return global.CitySimConstructionProgress.tickProductionCooldowns(game);
        }
    }

    function getCityUnitMoneyCost(key, unitDef) {
        if (Object.prototype.hasOwnProperty.call(CITY_UNIT_COST_OVERRIDES, key)) {
            const baseOverrideCost = Math.max(0, Math.floor(Number(CITY_UNIT_COST_OVERRIDES[key]) || 0));
            const hasUnitDef = !!(
                typeof CONFIG !== 'undefined'
                && CONFIG
                && CONFIG.units
                && Object.prototype.hasOwnProperty.call(CONFIG.units, key)
            );
            if (!hasUnitDef) return normalizeMoneyStep(baseOverrideCost, 10);
            return normalizeMoneyStep(Math.max(1, Math.floor(baseOverrideCost * getUnitGlobalCostMultiplier())), 10);
        }
        const baseSupplyCost = Math.max(1, Math.floor(Number(unitDef?.cost) || 20));
        return normalizeMoneyStep(Math.max(120, baseSupplyCost * 14), 10);
    }

    function getCityUnitPopulationNeed(unitKey, unitDef) {
        if (typeof CitySimEconomy !== 'undefined'
            && CitySimEconomy
            && typeof CitySimEconomy.getUnitPopulationNeed === 'function') {
            return Math.max(0, Math.floor(Number(CitySimEconomy.getUnitPopulationNeed(unitKey, unitDef)) || 0));
        }
        return 1;
    }

    function getSupplyEntriesForTile(game, tile) {
        const catalog = getProductionCatalog(tile);
        if (!catalog || !Array.isArray(catalog.unitKeys)) return [];
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return [];

        return catalog.unitKeys
            .filter((key) => !isBlockedProductionChoice(game, tile, key))
            .filter((key) => key === 'supply_box' || Object.prototype.hasOwnProperty.call(CONFIG.units, key))
            .map((key) => {
                if (key === 'supply_box') {
                    return {
                        key,
                        unit: null,
                        costMoney: normalizeMoneyStep(CITY_UNIT_COST_OVERRIDES['supply_box'] || 300, 10),
                        popNeed: 0
                    };
                }
                const unit = CONFIG.units[key];
                return {
                    key,
                    unit,
                    costMoney: getCityUnitMoneyCost(key, unit),
                    popNeed: getCityUnitPopulationNeed(key, unit)
                };
            });
    }

    function addUnitToCityInventory(game, unitKey, amount) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return 0;
        const wanted = Math.max(1, Math.floor(Number(amount) || 1));
        let added = 0;
        CitySimState.mutate(game, (draft) => {
            if (!draft.units || typeof draft.units !== 'object') draft.units = {};
            const current = Math.max(0, Math.floor(Number(draft.units[key]) || 0));
            if (key === 'icbm') {
                const canAdd = Math.max(0, 2 - current);
                added = Math.max(0, Math.min(wanted, canAdd));
                draft.units[key] = current + added;
                return;
            }
            added = wanted;
            draft.units[key] = current + added;
        });
        return added;
    }

    function getQueuedProductionUnitName(unitKey) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return '유닛';
        const unitDef = getUnitDefByKey(key);
        return getInventoryDisplayName(key, unitDef || undefined);
    }

    function getProductionClaimExpGain(unitKey, unitDef) {
        const key = normalizeUnitKey(unitKey);
        if (!key) return 1;
        const baseCost = Math.max(0, Math.floor(Number(unitDef?.cost) || 0));
        if (baseCost <= 0) return 2;
        return Math.max(1, Math.min(18, Math.round(baseCost / 130)));
    }

    function claimBuildingProducedUnit(game, index) {
        const state = CitySimState.ensure(game);
        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return false;

        const tile = state.grid[index] ?? null;
        if (!tile || !getProductionCatalog(tile)) {
            if (typeof CitySimState.clearProductionQueue === 'function') {
                CitySimState.clearProductionQueue(game, index);
            } else {
                CitySimState.clearProductionCooldown(game, index);
            }
            renderGrid(game);
            renderContextBar(game);
            persist(game);
            return false;
        }

        const queue = getProductionQueueAt(state, index);
        if (!queue) {
            showToast('수령할 생산 유닛이 없습니다.');
            renderGrid(game);
            renderContextBar(game);
            return false;
        }

        const remainMs = getProductionCooldownRemainingMsAt(state, index, Date.now());
        if (remainMs > 0) {
            showToast(`생산이 아직 진행중입니다. (${getProductionCooldownText(remainMs)})`);
            renderGrid(game);
            renderContextBar(game);
            return false;
        }

        const unitKey = normalizeUnitKey(queue.unitKey);

        // [보급창고] supply_box: 일반 보급상자 → 보관함 저장
        if (unitKey === 'supply_box') {
            let boxOk = false;
            if (typeof CitySimGacha !== 'undefined' && CitySimGacha && typeof CitySimGacha.addBoxToInventory === 'function') {
                CitySimGacha.addBoxToInventory(game, 'box_level1', 1);
                boxOk = true;
            }
            const gainedExp = 3;
            const expResult = (typeof CitySimEconomy !== 'undefined' && CitySimEconomy && typeof CitySimEconomy.addExp === 'function')
                ? CitySimEconomy.addExp(game, gainedExp, { render: false, save: false })
                : null;
            if (typeof CitySimState.clearProductionQueue === 'function') {
                CitySimState.clearProductionQueue(game, index);
            } else {
                CitySimState.clearProductionCooldown(game, index);
            }
            persist(game);
            renderGrid(game);
            renderContextBar(game);
            refreshCityUnitPanels(game);
            if (boxOk) {
                const rewardText = [`일반 보급상자 → 보관함 저장`, `EXP +${formatNumber(gainedExp)}`];
                if (expResult && expResult.levelsGained > 0) {
                    rewardText.push(`레벨 ${formatNumber(expResult.level)} 달성`);
                }
                showToast(rewardText.join(' · '));
            } else {
                showToast('보급상자 저장에 실패했습니다.');
            }
            return boxOk;
        }

        const unitDef = getUnitDefByKey(unitKey);
        if (!unitKey || !unitDef) {
            if (typeof CitySimState.clearProductionQueue === 'function') {
                CitySimState.clearProductionQueue(game, index);
            } else {
                CitySimState.clearProductionCooldown(game, index);
            }
            showToast('생산 유닛 정보를 찾을 수 없어 대기열을 초기화했습니다.');
            persist(game);
            renderGrid(game);
            renderContextBar(game);
            return false;
        }

        if (tile === 'powerplant' && isFactoryResearchKey(unitKey)) {
            const changed = markFactoryResearchUnlocked(game, unitKey);
            const gainedExp = getProductionClaimExpGain(unitKey, unitDef);
            const expResult = (typeof CitySimEconomy !== 'undefined' && CitySimEconomy && typeof CitySimEconomy.addExp === 'function')
                ? CitySimEconomy.addExp(game, gainedExp, { render: false, save: false })
                : null;
            if (typeof CitySimState.clearProductionQueue === 'function') {
                CitySimState.clearProductionQueue(game, index);
            } else {
                CitySimState.clearProductionCooldown(game, index);
            }
            persist(game);
            renderGrid(game);
            renderContextBar(game);
            refreshCityUnitPanels(game);
            const unlockTarget = getResearchUnlockTargetLabel(unitKey);
            const rewardText = [
                changed
                    ? `${getInventoryDisplayName(unitKey, unitDef)} 연구 완료 · ${unlockTarget} 해금`
                    : `${getInventoryDisplayName(unitKey, unitDef)} 연구는 이미 완료됨`,
                `EXP +${formatNumber(gainedExp)}`
            ];
            if (expResult && expResult.levelsGained > 0) {
                rewardText.push(`레벨 ${formatNumber(expResult.level)} 달성`);
            }
            showToast(rewardText.join(' · '));
            return changed;
        }

        const popNeed = getCityUnitPopulationNeed(unitKey, unitDef);
        if (popNeed > 0) {
            const currentPop = Math.max(0, Math.floor(Number(state.res?.pop) || 0));
            const maxPop = Math.max(1, Math.floor(Number(state.res?.maxPop) || 1));
            if ((currentPop + popNeed) > maxPop) {
                showToast(`인구 한도가 부족합니다. (필요 ${formatNumber(popNeed)})`);
                renderGrid(game);
                renderContextBar(game);
                return false;
            }
        }

        const addedCount = addUnitToCityInventory(game, unitKey);
        if (addedCount <= 0) {
            if (typeof CitySimState.clearProductionQueue === 'function') {
                CitySimState.clearProductionQueue(game, index);
            } else {
                CitySimState.clearProductionCooldown(game, index);
            }
            persist(game);
            renderGrid(game);
            renderContextBar(game);
            refreshCityUnitPanels(game);
            showToast('해당 유닛은 보유 한도에 도달해 수령되지 않았습니다.');
            return false;
        }
        const gainedExp = getProductionClaimExpGain(unitKey, unitDef);
        const expResult = (typeof CitySimEconomy !== 'undefined' && CitySimEconomy && typeof CitySimEconomy.addExp === 'function')
            ? CitySimEconomy.addExp(game, gainedExp, { render: false, save: false })
            : null;
        if (typeof CitySimState.clearProductionQueue === 'function') {
            CitySimState.clearProductionQueue(game, index);
        } else {
            CitySimState.clearProductionCooldown(game, index);
        }
        persist(game);
        renderGrid(game);
        renderContextBar(game);
        refreshCityUnitPanels(game);
        const rewardText = [`${getInventoryDisplayName(unitKey, unitDef)} ${formatNumber(addedCount)}기 수령 완료`, `EXP +${formatNumber(gainedExp)}`];
        if (expResult && expResult.levelsGained > 0) {
            rewardText.push(`레벨 ${formatNumber(expResult.level)} 달성`);
        }
        showToast(rewardText.join(' · '));
        return true;
    }

    function openCitySupplyPanel(game, selectionInfo) {
        if (!game || !selectionInfo) return;
        if (typeof game.openCityActionModal !== 'function') return;
        closeFloatingPanelsForUnitAction(game);

        const tile = selectionInfo.tile;
        const catalog = getProductionCatalog(tile);
        if (!catalog) {
            showToast('이 건물은 생산 기능이 없습니다.');
            return;
        }

        const entries = getSupplyEntriesForTile(game, tile);
        if (entries.length === 0) {
            if (tile === 'oilrig') {
                showToast('생산 가능한 보급이 없습니다.');
            } else if (tile === 'powerplant') {
                showToast('연구 가능한 항목이 없습니다.');
            } else {
                showToast('생산 가능한 유닛이 없습니다.');
            }
            return;
        }

        const bodyHtml = entries.map((entry) => {
            const owned = getInventoryUnitCount(game, entry.key, entry.unit);
            const name = getInventoryDisplayName(entry.key, entry.unit);
            const iconUrl = drawInventoryUnitIcon(entry.key);
            const isResearchEntry = tile === 'powerplant' && isFactoryResearchKey(entry.key);
            const popNeed = Math.max(0, Math.floor(Number(entry.popNeed) || 0));
            const metaText = isResearchEntry
                ? '선행 연구'
                : `보유 ${formatNumber(owned)} · 인구 ${formatNumber(popNeed)}`;
            return (
                `<button type="button" class="btn-unit city-action-unitbar-item city-action-unitbar-item-production" data-city-supply-unit="${entry.key}" title="${escapeHtml(name)}">` +
                (
                    iconUrl
                        ? `<img class="city-action-unitbar-icon" src="${iconUrl}" alt="${escapeHtml(name)}">`
                        : `<span class="city-action-unitbar-icon-fallback">${escapeHtml(name.slice(0, 2))}</span>`
                ) +
                `<span class="city-action-unitbar-name">${escapeHtml(name)}</span>` +
                `<span class="city-action-unitbar-meta">${escapeHtml(metaText)}</span>` +
                `<span class="city-action-unitbar-badge">${formatNumber(entry.costMoney)}</span>` +
                `</button>`
            );
        }).join('');

        game.openCityActionModal(
            catalog.title || (tile === 'oilrig' ? '보급 생산' : '유닛 생산'),
            `<div class="city-action-unitbar-wrap"><div class="city-action-unitbar">${bodyHtml}</div></div>`,
            {
                allowHtml: true,
                layout: 'bar'
            }
        );

        const msgEl = document.getElementById('city-action-msg');
        if (!msgEl) return;
        msgEl.querySelectorAll('[data-city-supply-unit]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const unitKey = String(btn.getAttribute('data-city-supply-unit') || '').trim();
                if (!unitKey) return;
                const entry = entries.find((item) => item.key === unitKey);
                if (!entry) return;
                const latestSelection = getSelectedTileInfo(game);
                if (!latestSelection || latestSelection.index !== selectionInfo.index || latestSelection.tile !== selectionInfo.tile) {
                    showToast('선택된 건물이 변경되었습니다.');
                    return;
                }
                const blockedReason = getBlockedProductionChoiceReason(game, selectionInfo.tile, unitKey);
                if (blockedReason) {
                    showToast(blockedReason);
                    return;
                }

                const latestState = CitySimState.ensure(game);
                const queued = getProductionQueueAt(latestState, selectionInfo.index);
                if (queued) {
                    const cooldownMs = getProductionCooldownRemainingMsAt(latestState, selectionInfo.index, Date.now());
                    const queuedName = getQueuedProductionUnitName(queued.unitKey);
                    const queuedActionLabel = (selectionInfo.tile === 'powerplant' && isFactoryResearchKey(queued.unitKey))
                        ? '연구'
                        : '생산';
                    if (cooldownMs > 0) {
                        showToast(`이미 ${queuedName} ${queuedActionLabel}중입니다. (${getProductionCooldownText(cooldownMs)})`);
                    } else {
                        showToast(`${queuedName} ${queuedActionLabel}이 완료되었습니다. 건물 위 수령 UI를 눌러 획득하세요.`);
                    }
                    renderGrid(game);
                    return;
                }

                const needsPopulation = !(selectionInfo.tile === 'powerplant' && isFactoryResearchKey(unitKey));
                const popNeed = needsPopulation ? Math.max(0, Math.floor(Number(entry.popNeed) || 0)) : 0;
                if (popNeed > 0) {
                    const currentPop = Math.max(0, Math.floor(Number(latestState.res?.pop) || 0));
                    const maxPop = Math.max(1, Math.floor(Number(latestState.res?.maxPop) || 1));
                    if ((currentPop + popNeed) > maxPop) {
                        showToast(`인구 한도가 부족합니다. (필요 ${formatNumber(popNeed)})`);
                        return;
                    }
                }

                if (!CitySimEconomy.canPayCost(game, { costMoney: entry.costMoney })) {
                    showToast('자금이 부족합니다.');
                    return;
                }

                CitySimEconomy.payCost(game, { costMoney: entry.costMoney });
                const cooldownMeta = setProductionCooldownForBuilding(game, selectionInfo.index, entry);
                persist(game);
                renderGrid(game);
                renderContextBar(game);

                const isResearchEntry = selectionInfo.tile === 'powerplant' && isFactoryResearchKey(unitKey);
                const actionLabel = isResearchEntry ? '연구 시작' : '생산 시작';
                showToast(
                    `${getInventoryDisplayName(unitKey, entry.unit)} ${actionLabel} · 완료까지 ${getProductionCooldownText(cooldownMeta.durationMs)}`
                );
                const latestSelectionAfter = getSelectedTileInfo(game);
                if (latestSelectionAfter && latestSelectionAfter.index === selectionInfo.index && latestSelectionAfter.tile === selectionInfo.tile) {
                    openCitySupplyPanel(game, latestSelectionAfter);
                }
            });
        });
    }

    function setBuildTool(game, tool) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.setBuildTool === 'function') {
            return global.CitySimConstructionPlacement.setBuildTool(game, tool);
        }
    }

    function openBuildPanel(game, forceOpen) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.openBuildPanel === 'function') {
            return global.CitySimConstructionPlacement.openBuildPanel(game, forceOpen);
        }
    }

    function openInventory(game, forceOpen) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.openInventory === 'function') {
            return global.CitySimConstructionPlacement.openInventory(game, forceOpen);
        }
    }

    function evaluatePlacement(game, index, placement) {
        if (global.CitySimConstructionValidation
            && typeof global.CitySimConstructionValidation.evaluatePlacement === 'function') {
            return global.CitySimConstructionValidation.evaluatePlacement(game, index, placement);
        }
        return { ok: false, reason: '배치 검증 모듈이 준비되지 않았습니다.' };
    }

    function evaluateMovePlacement(game, index, placement) {
        if (global.CitySimConstructionValidation
            && typeof global.CitySimConstructionValidation.evaluateMovePlacement === 'function') {
            return global.CitySimConstructionValidation.evaluateMovePlacement(game, index, placement);
        }
        return { ok: false, reason: '이동 검증 모듈이 준비되지 않았습니다.' };
    }

    function updatePlacementPreview(game, index) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.updatePlacementPreview === 'function') {
            return global.CitySimConstructionPlacement.updatePlacementPreview(game, index);
        }
    }

    function clearPlacementPreview(game) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.clearPlacementPreview === 'function') {
            return global.CitySimConstructionPlacement.clearPlacementPreview(game);
        }
    }

    function persist(game) {
        if (typeof game.recalcCityDerived === 'function') game.recalcCityDerived();
        if (typeof game.renderCityResources === 'function') game.renderCityResources();
        if (typeof game.saveCitySimState === 'function') {
            if (game && game._cityRoadTreeBrushActive === true) {
                game._cityBrushDirty = true;
            } else {
                game.saveCitySimState();
            }
        }
    }

    function applyMovePlacement(game, index) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.applyMovePlacement === 'function') {
            return global.CitySimConstructionPlacement.applyMovePlacement(game, index);
        }
    }

    function applyPlacement(game, index) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.applyPlacement === 'function') {
            return global.CitySimConstructionPlacement.applyPlacement(game, index);
        }
    }

    function handleCellAction(game, index, options) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.handleCellAction === 'function') {
            return global.CitySimConstructionPlacement.handleCellAction(game, index, options);
        }
    }

    function appendRoadShape(cell, mask, options) {
        const opts = options || {};
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
        if (opts.preview === true) road.classList.add('preview');

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

        if (hasVertical) {
            road.classList.add('has-vertical');
        }
        if (hasHorizontal) {
            road.classList.add('has-horizontal');
        }

        const lane = document.createElement('span');
        lane.className = 'city-road-lane';
        lane.style.setProperty('--lane-v-top', hasN ? '0%' : '50%');
        lane.style.setProperty('--lane-v-bottom', hasS ? '0%' : '50%');
        lane.style.setProperty('--lane-h-left', hasW ? '0%' : '50%');
        lane.style.setProperty('--lane-h-right', hasE ? '0%' : '50%');
        road.appendChild(lane);

        cell.appendChild(road);
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

    function appendProductionCooldownBadge(cell, untilMs, unitKey, tile) {
        if (!cell) return;
        const until = Math.max(0, Math.floor(Number(untilMs) || 0));
        if (until <= 0) return;
        const displayName = getQueuedProductionUnitName(unitKey);
        const isResearch = tile === 'powerplant' && isFactoryResearchKey(unitKey);
        const actionLabel = isResearch ? '연구' : '생산';

        const slot = document.createElement('span');
        slot.className = 'city-production-slot city-production-slot-cooldown';
        slot.title = `${displayName} ${actionLabel}중`;

        const stateLabel = document.createElement('span');
        stateLabel.className = 'city-production-slot-state';
        stateLabel.textContent = `${actionLabel}중`;
        slot.appendChild(stateLabel);

        const timer = document.createElement('span');
        timer.className = 'city-production-slot-time';
        timer.setAttribute('data-city-production-until', String(until));
        timer.textContent = getProductionCooldownSmoothText(until - Date.now());
        slot.appendChild(timer);

        cell.appendChild(slot);
    }

    function appendProductionReadyBadge(cell, unitKey) {
        if (!cell) return;
        const key = normalizeUnitKey(unitKey);
        if (!key) return;

        const unitDef = getUnitDefByKey(key);
        const displayName = getInventoryDisplayName(key, unitDef || undefined);
        const slot = document.createElement('span');
        slot.className = 'city-production-slot city-production-slot-ready';
        slot.dataset.cityProductionClaim = '1';
        slot.dataset.cityProductionUnit = key;
        slot.title = `${displayName} 수령`;

        const iconUrl = drawInventoryUnitIcon(key);
        if (iconUrl) {
            const img = document.createElement('img');
            img.className = 'city-production-slot-icon';
            img.src = iconUrl;
            img.alt = displayName;
            img.decoding = 'async';
            slot.appendChild(img);
        } else {
            const fallback = document.createElement('span');
            fallback.className = 'city-production-slot-fallback';
            fallback.textContent = displayName.slice(0, 2);
            slot.appendChild(fallback);
        }

        const label = document.createElement('span');
        label.className = 'city-production-slot-label';
        label.textContent = '수령';
        slot.appendChild(label);

        cell.appendChild(slot);
    }

    function appendIncomeReadyBadge(cell, stored) {
        if (!cell) return;
        const amount = Math.max(0, Math.floor(Number(stored) || 0));
        if (amount <= 0) return;

        const slot = document.createElement('span');
        slot.className = 'city-income-slot';
        slot.dataset.cityIncomeClaim = '1';
        slot.title = `세금 수금 ₩${formatNumber(amount)}`;
        slot.textContent = `₩${formatNumber(amount)}`;
        cell.appendChild(slot);
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

    function appendDrillgroundVisual(cell, options) {
        if (!cell) return;
        const opts = options || {};
        const preview = opts.preview === true;
        const unitKey = normalizeUnitKey(opts.unitKey);
        const unitDef = unitKey ? getUnitDefByKey(unitKey) : null;
        const sizeClass = getDrillgroundUnitSizeClass(unitKey, unitDef);

        const pad = document.createElement('span');
        pad.className = 'city-drillground-pad';
        if (preview) pad.classList.add('city-drillground-pad-preview');
        if (!unitKey) pad.classList.add('city-drillground-pad-empty');
        cell.appendChild(pad);

        const iconUrl = unitKey
            ? (isDrillgroundMissileIconUnit(unitKey)
                ? drawDrillgroundMissileIcon(unitKey)
                : drawInventoryUnitIcon(unitKey))
            : null;
        if (iconUrl) {
            const img = document.createElement('img');
            img.className = `city-drillground-unit city-drillground-unit-populated ${sizeClass}`;
            if (preview) img.classList.add('city-drillground-unit-preview');
            img.dataset.cityDrillgroundUnit = '1';
            img.src = iconUrl;
            img.alt = getInventoryDisplayName(unitKey, unitDef || undefined);
            img.decoding = 'async';
            cell.appendChild(img);
            return;
        }

        if (!unitKey) return;

        const fallback = document.createElement('span');
        fallback.className = 'city-drillground-unit-fallback';
        if (preview) fallback.classList.add('city-cell-ghost');
        fallback.classList.add('city-drillground-unit-populated');
        fallback.dataset.cityDrillgroundUnit = '1';
        fallback.textContent = getInventoryDisplayName(unitKey, unitDef || undefined).slice(0, 2);
        cell.appendChild(fallback);
    }

    function getTileSpriteUrl(tile) {
        if (!tile || !isObjectTool(tile)) return null;
        const spriteSize = getBuildingSpriteSize();
        const cacheKey = `${tile}:${spriteSize}`;
        if (spriteUrlCache.has(cacheKey)) return spriteUrlCache.get(cacheKey) || null;
        if (typeof CitySimBuildingRenderer === 'undefined' || !CitySimBuildingRenderer) {
            return null;
        }
        if (typeof CitySimBuildingRenderer.hasSprite === 'function' && !CitySimBuildingRenderer.hasSprite(tile)) {
            return null;
        }
        if (typeof CitySimBuildingRenderer.getSpriteDataUrl !== 'function') {
            return null;
        }
        const dataUrl = CitySimBuildingRenderer.getSpriteDataUrl(tile, spriteSize);
        const nextUrl = (typeof dataUrl === 'string' && dataUrl.length > 0) ? dataUrl : null;
        spriteUrlCache.set(cacheKey, nextUrl);
        return nextUrl;
    }

    function drawBuildCardFallbackPreview(tool) {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (tool === 'road') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(6, 24, w - 12, 12);
            ctx.fillStyle = '#f8fafc';
            for (let x = 12; x < w - 12; x += 14) {
                ctx.fillRect(x, 29, 8, 2);
            }
            return canvas.toDataURL('image/png');
        }

        if (tool === 'ground_grass') {
            ctx.fillStyle = '#3f7d3a';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            for (let i = 0; i < 9; i++) {
                ctx.fillRect((i * 12) % w, (i * 7) % h, 3, 14);
            }
            return canvas.toDataURL('image/png');
        }

        if (tool === 'ground_dirt') {
            ctx.fillStyle = '#7c5a3b';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(0,0,0,0.16)';
            for (let i = 0; i < 24; i++) {
                const x = Math.floor((i * 13) % w);
                const y = Math.floor((i * 17) % h);
                ctx.fillRect(x, y, 4, 2);
            }
            return canvas.toDataURL('image/png');
        }

        if (tool === 'ground_concrete') {
            ctx.fillStyle = '#6b7280';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(226,232,240,0.32)';
            ctx.lineWidth = 1;
            for (let x = 8; x < w; x += 16) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 8; y < h; y += 16) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            return canvas.toDataURL('image/png');
        }

        if (tool === 'ground_asphalt') {
            ctx.fillStyle = '#3c414b';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            for (let i = 0; i < 8; i++) {
                ctx.fillRect((i * 14 + 3) % w, (i * 9 + 2) % h, 6, 2);
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, Math.round(h * 0.5));
            ctx.lineTo(w, Math.round(h * 0.5));
            ctx.stroke();
            return canvas.toDataURL('image/png');
        }

        if (tool === 'eraser') {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, w, h);
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.rotate(-0.28);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-20, -9, 40, 18);
            ctx.fillStyle = '#fca5a5';
            ctx.fillRect(-20, -9, 12, 18);
            ctx.fillStyle = '#fef2f2';
            ctx.fillRect(8, -9, 12, 18);
            ctx.restore();
            return canvas.toDataURL('image/png');
        }

        if (tool === 'drillground') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, w - 20, h - 20);
            ctx.strokeStyle = '#93c5fd';
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect((w / 2) - 2, (h / 2) - 2, 4, 4);
            return canvas.toDataURL('image/png');
        }

        if (tool === 'house' || tool === 'decor') {
            const bg = ctx.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, '#1f5f3b');
            bg.addColorStop(1, '#16452c');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(28, 26, 40, 22);
            ctx.fillStyle = '#dcfce7';
            ctx.fillRect(42, 30, 12, 18);
            ctx.fillStyle = '#86efac';
            ctx.beginPath();
            ctx.moveTo(24, 26);
            ctx.lineTo(48, 10);
            ctx.lineTo(72, 26);
            ctx.closePath();
            ctx.fill();
            return canvas.toDataURL('image/png');
        }

        if (tool === 'tax_office') {
            const bg = ctx.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, '#1f6b47');
            bg.addColorStop(1, '#155236');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(18, 16, 60, 34);
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(18, 10, 60, 7);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(24, 21, 10, 10);
            ctx.fillRect(40, 21, 10, 10);
            ctx.fillRect(56, 21, 10, 10);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(44, 34, 8, 16);
            return canvas.toDataURL('image/png');
        }

        if (tool === 'shop_store') {
            const bg = ctx.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, '#1b5e20');
            bg.addColorStop(1, '#14532d');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(18, 20, 60, 30);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(18, 14, 60, 8);
            ctx.fillStyle = '#fecaca';
            for (let x = 22; x < 76; x += 10) {
                ctx.fillRect(x, 14, 5, 8);
            }
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(44, 31, 8, 19);
            return canvas.toDataURL('image/png');
        }

        if (tool === 'apartment_large') {
            const bg = ctx.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, '#1f6d4a');
            bg.addColorStop(1, '#114933');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#dbeafe';
            ctx.fillRect(28, 10, 40, 40);
            ctx.fillStyle = '#93c5fd';
            for (let yy = 14; yy <= 42; yy += 7) {
                for (let xx = 33; xx <= 59; xx += 8) {
                    ctx.fillRect(xx, yy, 5, 4);
                }
            }
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(44, 38, 8, 12);
            return canvas.toDataURL('image/png');
        }

        if (tool === 'oilrig') {
            const bg = ctx.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, '#6b3b16');
            bg.addColorStop(1, '#42210f');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(18, 32, 60, 16);
            ctx.fillStyle = '#7c2d12';
            ctx.fillRect(26, 20, 44, 12);
            ctx.fillStyle = '#fde68a';
            ctx.fillRect(30, 24, 10, 4);
            ctx.fillRect(44, 24, 10, 4);
            ctx.fillRect(58, 24, 8, 4);
            return canvas.toDataURL('image/png');
        }

        if (tool === 'barracks' || tool === 'factory' || tool === 'powerplant') {
            const bg = ctx.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, '#7a4c1e');
            bg.addColorStop(1, '#4a2c12');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(16, 26, 64, 20);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(16, 20, 64, 6);
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(26, 31, 8, 7);
            ctx.fillRect(40, 31, 8, 7);
            ctx.fillRect(54, 31, 8, 7);
            ctx.fillRect(68, 31, 8, 7);
            return canvas.toDataURL('image/png');
        }

        if (tool === 'airport') {
            // Concrete apron background (no sky)
            const apron = ctx.createLinearGradient(0, 0, 0, h);
            apron.addColorStop(0, '#3a4250');
            apron.addColorStop(1, '#303844');
            ctx.fillStyle = apron;
            ctx.fillRect(0, 0, w, h);

            // Grass strip at top
            ctx.fillStyle = '#2d4a32';
            ctx.fillRect(0, 0, w, 5);

            const groundY = Math.round(h * 0.50);

            // Terminal building
            ctx.fillStyle = '#4a5059';
            ctx.beginPath();
            ctx.moveTo(30, groundY);
            ctx.lineTo(80, groundY);
            ctx.lineTo(76, 16);
            ctx.lineTo(34, 16);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.fillRect(40, 24, 24, 12);
            ctx.fillStyle = '#e6b800';
            ctx.fillRect(38, 20, 28, 3);

            // Control tower (grounded)
            ctx.fillStyle = '#5d6470';
            ctx.fillRect(10, 20, 10, 30);
            ctx.fillStyle = '#4d88ff';
            ctx.fillRect(7, 12, 16, 8);

            // Runway area
            ctx.fillStyle = '#2b313a';
            ctx.fillRect(0, groundY + 4, w, h - groundY - 8);

            // Runway center line
            ctx.strokeStyle = '#b8860b';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(0, groundY + Math.round((h - groundY) * 0.5));
            ctx.lineTo(w, groundY + Math.round((h - groundY) * 0.5));
            ctx.stroke();
            ctx.setLineDash([]);

            // Grass strip at bottom
            ctx.fillStyle = '#2d4a32';
            ctx.fillRect(0, h - 5, w, 5);

            return canvas.toDataURL('image/png');
        }

        if (tool === 'park_plaza') {
            ctx.fillStyle = '#1f4d2d';
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = '#3f8f54';
            ctx.fillRect(4, 4, w - 8, h - 8);

            ctx.fillStyle = '#c6b288';
            ctx.fillRect(Math.round(w * 0.45), 0, Math.round(w * 0.1), h);
            ctx.fillRect(0, Math.round(h * 0.45), w, Math.round(h * 0.1));

            ctx.fillStyle = '#4a7c2e';
            ctx.beginPath();
            ctx.arc(Math.round(w * 0.25), Math.round(h * 0.25), 9, 0, Math.PI * 2);
            ctx.arc(Math.round(w * 0.75), Math.round(h * 0.75), 9, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#60a5fa';
            ctx.beginPath();
            ctx.ellipse(Math.round(w * 0.74), Math.round(h * 0.26), 12, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            return canvas.toDataURL('image/png');
        }

        const label = String(BUILDING_DEFS[tool]?.icon || tool || '').slice(0, 2);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '700 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, w / 2, h / 2);
        return canvas.toDataURL('image/png');
    }

    function getBuildToolCardPreviewUrl(tool) {
        const key = String(tool || '').trim();
        if (!key) return null;

        const spriteUrl = (key === 'airport' || key === 'park_plaza') ? null : getTileSpriteUrl(key);
        if (spriteUrl) return spriteUrl;

        if (buildCardPreviewCache.has(key)) {
            return buildCardPreviewCache.get(key) || null;
        }

        const fallbackUrl = drawBuildCardFallbackPreview(key);
        const nextUrl = (typeof fallbackUrl === 'string' && fallbackUrl.length > 0) ? fallbackUrl : null;
        buildCardPreviewCache.set(key, nextUrl);
        return nextUrl;
    }

    function appendObjectTileVisual(cell, tile, options) {
        if (!cell || !isObjectTool(tile)) return;
        const opts = options || {};
        const preview = opts.preview === true;

        if (tile === 'drillground') {
            appendDrillgroundVisual(cell, opts);
            return;
        }

        const spriteUrl = getTileSpriteUrl(tile);

        if (spriteUrl) {
            const img = document.createElement('img');
            img.className = 'city-cell-sprite';
            if (tile === 'tree') img.classList.add('city-tree-sprite');
            if (preview) {
                img.classList.add('city-sprite-preview');
                if (tile === 'tree') img.classList.add('city-tree-preview');
            }
            img.src = spriteUrl;
            img.alt = preview
                ? `${BUILDING_DEFS[tile]?.name || tile} 미리보기`
                : (BUILDING_DEFS[tile]?.name || tile);
            img.decoding = 'async';
            cell.appendChild(img);
            return;
        }

        if (tile === 'tree') {
            const treeIcon = document.createElement('span');
            treeIcon.className = preview ? 'city-tree-dot city-tree-preview-dot' : 'city-tree-dot';
            cell.appendChild(treeIcon);
            return;
        }

        const fallback = document.createElement('span');
        fallback.className = `city-cell-icon label-${tile}`;
        if (preview) fallback.classList.add('city-cell-ghost');
        fallback.textContent = BUILDING_DEFS[tile]?.icon || TILE_META[tile]?.icon || tile;
        cell.appendChild(fallback);
    }

    function renderGrid(game) {
        const gridEl = document.getElementById('city-grid');
        if (!gridEl) return;

        const state = CitySimState.ensure(game);
        ensureGroundLayer(state);
        const groundLayer = Array.isArray(state.ground) ? state.ground : [];

        const cols = state.cols || 12;
        const rows = state.rows || 8;
        const total = cols * rows;
        gridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
        gridEl.style.aspectRatio = `${cols} / ${rows}`;

        const cache = game && typeof game === 'object'
            ? (game._cityGridDomCache || (game._cityGridDomCache = { cols: 0, rows: 0, total: 0, cells: [], signatures: [] }))
            : { cols: 0, rows: 0, total: 0, cells: [], signatures: [] };

        if (cache.cols !== cols || cache.rows !== rows || cache.total !== total || cache.cells.length !== total) {
            cache.cols = cols;
            cache.rows = rows;
            cache.total = total;
            cache.cells = [];
            cache.signatures = new Array(total).fill('');

            const frag = document.createDocumentFragment();
            for (let i = 0; i < total; i++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'city-cell';
                cell.dataset.index = String(i);
                cache.cells.push(cell);
                frag.appendChild(cell);
            }
            gridEl.innerHTML = '';
            gridEl.appendChild(frag);
        }

        const placement = state.placement || {};
        const placementTool = placement.tool || state.selectedTool || '';
        const placementIsGroundTool = isGroundTool(placementTool);
        const isMovePlacementActive = placement.active && placement.mode === 'move';
        const moveSourceInfo = isMovePlacementActive ? getMoveSourceInfo(state, placement) : null;
        const signRuntime = getCityOwnSignRuntime(game);
        ensureCityOwnSigns(game);
        const signByIndex = (signRuntime && signRuntime.byIndex instanceof Map)
            ? signRuntime.byIndex
            : new Map();
        const selectedIndex = Number(state.selection?.index);
        const selectedTile = state.selection?.tile ?? null;
        const now = Date.now();
        let hasLiveProductionCooldown = false;
        let previewFootprintIndexSet = null;
        let previewFootprintTileMap = null;
        if (
            placement.active &&
            isFootprintTool(placementTool) &&
            Number.isInteger(placement.targetIndex) &&
            placement.targetIndex >= 0 &&
            placement.targetIndex < total
        ) {
            const previewFootprint = getFootprintAtAnchor(state, placement.targetIndex, placementTool, true);
            previewFootprintIndexSet = new Set();
            previewFootprintTileMap = new Map();
            if (Array.isArray(previewFootprint) && previewFootprint.length > 0) {
                previewFootprint.forEach((entry) => {
                    previewFootprintIndexSet.add(entry.index);
                    previewFootprintTileMap.set(entry.index, entry.tile);
                });
            } else {
                previewFootprintIndexSet.add(placement.targetIndex);
                previewFootprintTileMap.set(placement.targetIndex, placementTool);
            }
        }
        let moveSourceFootprintIndexSet = null;
        if (isMovePlacementActive && moveSourceInfo && isFootprintTool(moveSourceInfo.tile)) {
            const sourceFootprint = getFootprintAtAnchor(state, moveSourceInfo.index, moveSourceInfo.tile, false);
            if (Array.isArray(sourceFootprint) && sourceFootprint.length > 0) {
                moveSourceFootprintIndexSet = new Set(sourceFootprint.map((entry) => entry.index));
            }
        }
        let selectedFootprintIndexSet = null;
        if (!placement.active && Number.isInteger(selectedIndex) && isFootprintTool(selectedTile)) {
            const selectedFootprint = getFootprintAtAnchor(state, selectedIndex, selectedTile, false);
            if (Array.isArray(selectedFootprint) && selectedFootprint.length > 0) {
                selectedFootprintIndexSet = new Set(selectedFootprint.map((entry) => entry.index));
            }
        }

        for (let index = 0; index < total; index++) {
            const cell = cache.cells[index];
            if (!cell) continue;

            const tile = state.grid[index] ?? null;
            const meta = TILE_META[tile] || null;
            const ground = normalizeGroundType(groundLayer[index]);
            const groundTransitionMask = ground === 'grass' ? 0 : getGroundTransitionMaskAt(state, index, groundLayer, ground);
            const roadMask = tile === 'road' ? getRoadMaskAt(state, index) : 0;
            const drillgroundUnitKey = tile === 'drillground' ? (getDrillgroundUnitAt(state, index) || '') : '';
            const productionQueue = (tile && getProductionCatalog(tile))
                ? getProductionQueueAt(state, index)
                : null;
            const productionCooldownMs = productionQueue
                ? Math.max(0, productionQueue.until - now)
                : 0;
            const productionReady = !!productionQueue && productionCooldownMs <= 0;
            const productionUnitKey = productionQueue ? productionQueue.unitKey : '';
            const incomeStored = (
                (tile === 'house' || tile === 'apartment_large' || tile === 'shop_store' || tile === 'decor')
                    ? Math.max(0, Math.floor(Number(state.incomeSlots?.[index]?.stored) || 0))
                    : 0
            );
            if (productionQueue && productionCooldownMs > 0) {
                hasLiveProductionCooldown = true;
            }

            const isPreviewTarget = placement.active && (
                isFootprintTool(placementTool)
                    ? !!(previewFootprintIndexSet && previewFootprintIndexSet.has(index))
                    : placement.targetIndex === index
            );
            const previewClass = isPreviewTarget ? (placement.canPlace ? 'preview-valid' : 'preview-invalid') : '';
            const showBuildGhost = (
                isPreviewTarget &&
                placement.mode === 'build' &&
                placementTool &&
                (isObjectTool(placementTool) || placementIsGroundTool || placementTool === 'eraser')
            );
            const showRoadGhost = showBuildGhost && placementTool === 'road';
            const showTreeGhost = showBuildGhost && placementTool === 'tree';
            const showObjectGhost = showBuildGhost && isObjectTool(placementTool) && placementTool !== 'road' && placementTool !== 'tree';
            const showGroundGhost = showBuildGhost && placementIsGroundTool;
            const showEraserGhost = showBuildGhost && placementTool === 'eraser';
            const showMoveGhost = (
                isPreviewTarget &&
                placement.mode === 'move' &&
                placementTool &&
                isObjectTool(placementTool)
            );
            const previewGhostTile = (showObjectGhost || showMoveGhost)
                ? (
                    isFootprintTool(placementTool)
                        ? (previewFootprintTileMap?.get(index) || placementTool)
                        : placementTool
                )
                : '';
            const isMoveSource = (
                isMovePlacementActive &&
                !!moveSourceInfo &&
                (
                    (
                        isFootprintTool(moveSourceInfo.tile) &&
                        !!(moveSourceFootprintIndexSet && moveSourceFootprintIndexSet.has(index))
                    ) ||
                    (
                        !isFootprintTool(moveSourceInfo.tile) &&
                        moveSourceInfo.index === index
                    )
                )
            );
            const isSelected = (
                !placement.active &&
                (
                    (
                        isFootprintTool(selectedTile) &&
                        !!(selectedFootprintIndexSet && selectedFootprintIndexSet.has(index))
                    ) ||
                    (
                        Number.isInteger(selectedIndex) &&
                        selectedIndex === index &&
                        selectedTile === tile &&
                        !!tile &&
                        isObjectTool(tile)
                    )
                )
            );
            const ownSign = signByIndex.get(index) || null;
            const ownSignSig = ownSign
                ? `${String(ownSign.id || '')}|${Math.max(0, Math.floor(Number(ownSign.createdAtMs) || 0))}|${String(ownSign.fromName || '')}|${String(ownSign.text || '')}`
                : '';

            const signature = [
                ground,
                groundTransitionMask,
                tile || '',
                drillgroundUnitKey,
                productionQueue ? 1 : 0,
                productionReady ? 1 : 0,
                productionUnitKey,
                incomeStored,
                roadMask,
                previewClass,
                showRoadGhost ? 1 : 0,
                showTreeGhost ? 1 : 0,
                showObjectGhost ? 1 : 0,
                showMoveGhost ? 1 : 0,
                previewGhostTile,
                showGroundGhost ? 1 : 0,
                showEraserGhost ? 1 : 0,
                placementTool,
                isMoveSource ? 1 : 0,
                isSelected ? 1 : 0,
                ownSignSig
            ].join('|');

            if (cache.signatures[index] === signature) continue;
            cache.signatures[index] = signature;

            const classes = ['city-cell', `ground-${ground}`];
            if (meta?.className) classes.push(meta.className);
            if (productionQueue) classes.push('city-cell-production-active');
            if (productionReady) classes.push('city-cell-production-ready');
            if (incomeStored > 0) classes.push('city-cell-income-ready');
            if (previewClass) classes.push(previewClass);
            if (isMoveSource) classes.push('preview-source');
            if (isSelected) classes.push('selected');
            cell.className = classes.join(' ');

            cell.replaceChildren();

            if (ground !== 'grass') {
                appendGroundSurface(cell, ground, groundTransitionMask);
            }

            if (tile === 'road') {
                appendRoadShape(cell, roadMask);
            }

            if (isObjectTool(tile) && tile !== 'road') {
                appendObjectTileVisual(cell, tile, tile === 'drillground'
                    ? { unitKey: drillgroundUnitKey }
                    : undefined);
            }
            if (productionQueue) {
                if (productionCooldownMs > 0) {
                    appendProductionCooldownBadge(cell, productionQueue.until, productionUnitKey, tile);
                } else {
                    appendProductionReadyBadge(cell, productionUnitKey);
                }
            }
            if (incomeStored > 0) {
                appendIncomeReadyBadge(cell, incomeStored);
            }

            if (showBuildGhost || showMoveGhost) {
                if (showRoadGhost) {
                    appendRoadShape(cell, 0, { preview: true });
                } else if (showTreeGhost || showObjectGhost || showMoveGhost) {
                    appendObjectTileVisual(cell, previewGhostTile || placementTool, { preview: true });
                } else if (showGroundGhost) {
                    const ghostGround = document.createElement('span');
                    ghostGround.className = 'city-cell-ground-ghost';
                    ghostGround.textContent = BUILDING_DEFS[placementTool]?.icon || '타일';
                    cell.appendChild(ghostGround);
                } else if (showEraserGhost) {
                    const ghost = document.createElement('span');
                    ghost.className = 'city-cell-icon city-cell-ghost';
                    ghost.textContent = BUILDING_DEFS[placementTool]?.icon || '';
                    cell.appendChild(ghost);
                }
            }

            if (ownSign) {
                appendCityOwnSignMarker(game, cell, ownSign);
            }
        }

        if (hasLiveProductionCooldown) {
            ensureProductionCountdownTicker(game);
        } else {
            stopProductionCountdownTicker(game);
        }
    }

    function renderBuildSelection(game) {
        const state = CitySimState.ensure(game);
        const activeTab = normalizeBuildTab(game, state);

        const tabsEl = document.getElementById('city-build-tabs');
        if (tabsEl) {
            tabsEl.innerHTML = '';
            BUILD_TABS.forEach((tab) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-category flex-1 py-2 text-xs md:text-sm';
                btn.classList.add(`city-build-tab-${tab.id}`);
                if (tab.id === activeTab) btn.classList.add('active');
                btn.textContent = tab.label;
                btn.addEventListener('click', () => setBuildTab(game, tab.id));
                tabsEl.appendChild(btn);
            });
        }

        const tools = getToolsByTab(activeTab);
        const cardsEl = document.getElementById('city-build-cards');
        if (cardsEl) {
            cardsEl.innerHTML = '';
            tools.forEach((tool) => {
                const def = BUILDING_DEFS[tool];
                const isSelected = (
                    state.selectedTool === tool &&
                    state.placement.active &&
                    state.placement.mode === 'build'
                );

                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'btn-unit city-build-card';
                card.classList.add(`city-build-card-tab-${activeTab}`);
                if (isSelected) card.classList.add('selected');

                const icon = document.createElement('div');
                icon.className = `city-build-card-icon icon-${tool}`;
                icon.classList.add(`tab-${activeTab}`);
                const previewUrl = getBuildToolCardPreviewUrl(tool);
                if (previewUrl) {
                    const preview = document.createElement('img');
                    preview.className = 'city-build-card-preview';
                    preview.src = previewUrl;
                    preview.alt = `${def.name} 일러스트`;
                    preview.decoding = 'async';
                    icon.appendChild(preview);
                } else {
                    icon.textContent = def.icon;
                }

                const name = document.createElement('div');
                name.className = 'city-build-card-name';
                name.textContent = def.name;

                const cost = document.createElement('div');
                cost.className = 'city-build-card-cost count-text';
                const costMoney = getBuildToolCostMoney(tool);
                cost.textContent = costMoney > 0 ? formatNumber(costMoney) : '무료';
                if (costMoney <= 0) {
                    cost.classList.add('is-free');
                } else if (!CitySimEconomy.canPayCost(game, { costMoney })) {
                    card.classList.add('cost-unaffordable');
                }

                card.appendChild(icon);
                card.appendChild(name);
                card.appendChild(cost);

                card.addEventListener('click', () => setBuildTool(game, tool));
                cardsEl.appendChild(card);
            });
        }

        const nextHint = (state.placement.active && state.placement.reason)
            ? state.placement.reason
            : MSG_SELECT_CARD;
        setBuildHint(nextHint);
    }

    function getUnitCategoryForInventoryTab(unitKey, unitDef) {
        const key = normalizeUnitKey(unitKey) || '';
        const category = String(unitDef?.category || '').trim().toLowerCase();
        if (category === 'infantry' || category === 'armored' || category === 'air' || category === 'special') {
            return category;
        }

        // Legacy/defensive mapping: recon must always stay in the air tab.
        if (key === 'recon') return 'air';

        const type = String(unitDef?.type || '').trim().toLowerCase();
        if (type === 'air') return 'air';
        if (type === 'mech') return 'armored';
        if (type === 'skill') return 'special';
        return 'infantry';
    }

    function getInventoryUnitDefsByTab(tabId) {
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return [];
        const tabSet = new Set(INVENTORY_TABS.map((tab) => tab.id));
        return Object.keys(CONFIG.units)
            .filter((key) => {
                const unit = CONFIG.units[key];
                if (!unit || unit.hideFromUnitBar === true) return false;
                const mappedTab = getUnitCategoryForInventoryTab(key, unit);
                if (!tabSet.has(mappedTab)) return false;
                return mappedTab === tabId;
            })
            .map((key) => ({ key, unit: CONFIG.units[key] }));
    }

    function getOwnedInventoryUnitDefsByTab(game, tabId) {
        return getInventoryUnitDefsByTab(tabId)
            .map(({ key, unit }) => ({
                key,
                unit,
                count: getInventoryUnitCount(game, key, unit)
            }))
            .filter((entry) => entry.count > 0);
    }

    function getSupplyBoxCount(game, boxId) {
        const key = String(boxId || '').trim();
        if (!key) return 0;
        if (typeof CitySimGacha !== 'undefined' && CitySimGacha && typeof CitySimGacha.getBoxCount === 'function') {
            return Math.max(0, Math.floor(Number(CitySimGacha.getBoxCount(game, key)) || 0));
        }
        const state = CitySimState.ensure(game);
        return Math.max(0, Math.floor(Number(state.boxes?.[key]) || 0));
    }

    function getHonorMedalCount(game) {
        const state = CitySimState.ensure(game);
        return Math.max(0, Math.floor(Number(state?.hud?.honor) || 0));
    }

    function normalizeVeteranItemKey(value) {
        const key = String(value || '').trim();
        if (!key) return '';
        if (!Object.prototype.hasOwnProperty.call(VETERAN_ITEM_DEFS, key)) return '';
        return key;
    }

    function getVeteranItemDef(itemKey) {
        const key = normalizeVeteranItemKey(itemKey);
        if (!key) return null;
        return VETERAN_ITEM_DEFS[key] || null;
    }

    function isVeteranItemCompatible(itemKey, unitKey) {
        const key = normalizeVeteranItemKey(itemKey);
        const unit = normalizeUnitKey(unitKey);
        if (!key || !unit) return false;
        const allowed = VETERAN_ITEM_COMPAT[key];
        return !!(allowed && allowed.has(unit));
    }

    function getVeteranItemCount(game, itemKey) {
        const key = normalizeVeteranItemKey(itemKey);
        if (!key) return 0;
        const state = CitySimState.ensure(game);
        return Math.max(0, Math.floor(Number(state?.veteranItems?.[key]) || 0));
    }

    function getVeteranItemEntries(game) {
        return VETERAN_ITEM_ORDER
            .map((key) => {
                const def = getVeteranItemDef(key);
                if (!def) return null;
                const count = getVeteranItemCount(game, key);
                return {
                    kind: 'veteran_item',
                    itemKey: key,
                    name: def.name,
                    asset: def.asset,
                    desc: def.desc,
                    count,
                    tabCount: count
                };
            })
            .filter((entry) => !!entry && entry.count > 0);
    }

    function getSupplyInventoryEntries(game) {
        const boxEntries = SUPPLY_INVENTORY_ITEMS
            .map((item) => ({
                ...item,
                count: getSupplyBoxCount(game, item.boxId),
                kind: 'box',
                isOpenable: true
            }))
            .filter((entry) => entry.count > 0);

        const medalCount = getHonorMedalCount(game);
        const honorEntry = {
            kind: 'honor_medal',
            isOpenable: false,
            boxId: null,
            name: '명예훈장',
            asset: 'png/decoration.png',
            count: medalCount,
            tabCount: medalCount
        };

        const veteranItems = getVeteranItemEntries(game);
        return [...boxEntries, ...veteranItems, honorEntry];
    }

    function isPromotableVeteranUnit(unitKey, unitDef) {
        const key = normalizeUnitKey(unitKey);
        if (!key || !unitDef) return false;
        if (key === 'icbm_enemy') return false;
        if (unitDef.disabled === true) return false;
        if (unitDef.hideFromUnitBar === true) return false;
        if (unitDef.isSkill === true) return false;
        if (unitDef.isBuilder === true) return false;
        if (unitDef.droneLaunchOnly === true) return false;
        return true;
    }

    function getVeteranDisplayName(veteran, unitDef) {
        const base = getInventoryDisplayName(veteran?.unitKey, unitDef || undefined);
        const named = String(veteran?.name || '').trim();
        return named || base;
    }

    function getVeteranEntries(game) {
        const fromApi = (typeof CitySimState !== 'undefined'
            && CitySimState
            && typeof CitySimState.getVeterans === 'function')
            ? CitySimState.getVeterans(game)
            : null;
        const state = CitySimState.ensure(game);
        const src = Array.isArray(fromApi)
            ? fromApi
            : (Array.isArray(state.veterans) ? state.veterans : []);
        const list = [];
        src.forEach((entry) => {
            const unitKey = normalizeUnitKey(entry?.unitKey);
            if (!unitKey) return;
            const unitDef = getUnitDefByKey(unitKey);
            if (!unitDef || !isPromotableVeteranUnit(unitKey, unitDef)) return;
            const id = String(entry?.id || '').trim();
            if (!id) return;
            list.push({
                id,
                unitKey,
                unit: unitDef,
                level: Math.max(2, Math.floor(Number(entry?.level) || 2)),
                name: String(entry?.name || '').trim().slice(0, 24),
                createdAt: Math.max(0, Math.floor(Number(entry?.createdAt) || 0)),
                loadout: {
                    itemKey: normalizeVeteranItemKey(entry?.loadout?.itemKey || '')
                }
            });
        });
        list.sort((a, b) => {
            if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
            return a.id.localeCompare(b.id);
        });
        return list;
    }

    function getVeteranInventoryEntries(game) {
        return getVeteranEntries(game).map((entry) => ({
            ...entry,
            displayName: getVeteranDisplayName(entry, entry.unit),
            count: 1,
            tabCount: 1
        }));
    }

    function findVeteranEntryById(game, veteranId) {
        const targetId = String(veteranId || '').trim();
        if (!targetId) return null;
        const veterans = getVeteranEntries(game);
        return veterans.find((entry) => entry && entry.id === targetId) || null;
    }

    function getVeteranLoadoutItemKey(veteran) {
        return normalizeVeteranItemKey(veteran?.loadout?.itemKey || '');
    }

    function getVeteranLoadoutItemDef(veteran) {
        const key = getVeteranLoadoutItemKey(veteran);
        return key ? getVeteranItemDef(key) : null;
    }

    function equipVeteranItem(game, veteranId, itemKey) {
        const targetId = String(veteranId || '').trim();
        const nextItemKey = normalizeVeteranItemKey(itemKey);
        if (!targetId || !nextItemKey) return { ok: false, reason: '장착 아이템 정보가 올바르지 않습니다.' };

        let result = { ok: false, reason: '장착에 실패했습니다.' };
        CitySimState.mutate(game, (draft) => {
            if (!Array.isArray(draft.veterans) || draft.veterans.length <= 0) {
                result = { ok: false, reason: '베테랑 정보를 찾을 수 없습니다.' };
                return;
            }
            const idx = draft.veterans.findIndex((entry) => entry && String(entry.id || '').trim() === targetId);
            if (idx < 0) {
                result = { ok: false, reason: '베테랑 정보를 찾을 수 없습니다.' };
                return;
            }

            const veteran = draft.veterans[idx] || null;
            const unitKey = normalizeUnitKey(veteran?.unitKey);
            if (!unitKey) {
                result = { ok: false, reason: '유닛 정보를 찾을 수 없습니다.' };
                return;
            }
            if (!isVeteranItemCompatible(nextItemKey, unitKey)) {
                result = { ok: false, reason: '이 유닛은 해당 아이템을 장착할 수 없습니다.' };
                return;
            }

            if (!draft.veteranItems || typeof draft.veteranItems !== 'object') {
                draft.veteranItems = {};
            }
            const nextCount = Math.max(0, Math.floor(Number(draft.veteranItems[nextItemKey]) || 0));
            if (nextCount <= 0) {
                result = { ok: false, reason: '아이템 수량이 부족합니다.' };
                return;
            }

            const prevItemKey = normalizeVeteranItemKey(veteran?.loadout?.itemKey || '');
            if (prevItemKey === nextItemKey) {
                result = { ok: true, itemKey: nextItemKey, noChange: true };
                return;
            }

            draft.veteranItems[nextItemKey] = nextCount - 1;
            if (prevItemKey) {
                const prevCount = Math.max(0, Math.floor(Number(draft.veteranItems[prevItemKey]) || 0));
                draft.veteranItems[prevItemKey] = prevCount + 1;
            }

            draft.veterans[idx] = {
                ...veteran,
                loadout: {
                    itemKey: nextItemKey
                }
            };
            result = { ok: true, itemKey: nextItemKey, prevItemKey };
        });
        return result;
    }

    function unequipVeteranItem(game, veteranId) {
        const targetId = String(veteranId || '').trim();
        if (!targetId) return { ok: false, reason: '베테랑 정보를 찾을 수 없습니다.' };

        let result = { ok: false, reason: '해제에 실패했습니다.' };
        CitySimState.mutate(game, (draft) => {
            if (!Array.isArray(draft.veterans) || draft.veterans.length <= 0) {
                result = { ok: false, reason: '베테랑 정보를 찾을 수 없습니다.' };
                return;
            }
            const idx = draft.veterans.findIndex((entry) => entry && String(entry.id || '').trim() === targetId);
            if (idx < 0) {
                result = { ok: false, reason: '베테랑 정보를 찾을 수 없습니다.' };
                return;
            }
            const veteran = draft.veterans[idx] || null;
            const prevItemKey = normalizeVeteranItemKey(veteran?.loadout?.itemKey || '');
            if (!prevItemKey) {
                result = { ok: false, reason: '장착된 아이템이 없습니다.' };
                return;
            }

            if (!draft.veteranItems || typeof draft.veteranItems !== 'object') {
                draft.veteranItems = {};
            }
            const prevCount = Math.max(0, Math.floor(Number(draft.veteranItems[prevItemKey]) || 0));
            draft.veteranItems[prevItemKey] = prevCount + 1;

            draft.veterans[idx] = {
                ...veteran,
                loadout: {
                    itemKey: ''
                }
            };
            result = { ok: true, prevItemKey };
        });
        return result;
    }

    function syncVeteranStateUi(game) {
        persist(game);
        renderGrid(game);
        renderContextBar(game);
        refreshCityUnitPanels(game);
        renderInventoryPanel(game);
        if (game && typeof game.applyCityUnitsToBattleStock === 'function') {
            game.applyCityUnitsToBattleStock();
        }
    }

    function openVeteranRenameModal(game, veteranInput, options) {
        if (!game || typeof game.openCityActionModal !== 'function') return;
        const opts = (options && typeof options === 'object') ? options : {};

        const inputId = String(veteranInput?.id || '').trim();
        const veteran = inputId
            ? (findVeteranEntryById(game, inputId) || veteranInput)
            : veteranInput;
        if (!veteran || !veteran.id) {
            showToast('베테랑 정보를 찾을 수 없습니다.');
            return;
        }

        const veteranId = String(veteran.id || '').trim();
        const unitKey = normalizeUnitKey(veteran.unitKey);
        const unitDef = veteran.unit || getUnitDefByKey(unitKey);
        if (!unitKey || !unitDef) {
            showToast('유닛 정보를 찾을 수 없습니다.');
            return;
        }

        const baseName = getInventoryDisplayName(unitKey, unitDef);
        const currentName = String(veteran.name || '').trim();
        const displayName = getVeteranDisplayName(veteran, unitDef);
        const level = Math.max(2, Math.floor(Number(veteran.level) || 2));

        const title = String(opts.title || '베테랑 이름 변경').trim() || '베테랑 이름 변경';
        const bodyHtml =
            `<div class="city-veteran-rename-wrap">` +
            `<div class="city-veteran-rename-meta">${escapeHtml(displayName)} · LV${formatNumber(level)}</div>` +
            `<label class="city-veteran-rename-label" for="city-veteran-rename-input">이름</label>` +
            `<input id="city-veteran-rename-input" class="city-veteran-rename-input" type="text" maxlength="24" ` +
            `value="${escapeHtml(currentName)}" placeholder="${escapeHtml(baseName)}" autocomplete="off">` +
            `<div class="city-veteran-rename-help">최대 24자 · 기본명: ${escapeHtml(baseName)}</div>` +
            `<div class="city-veteran-rename-actions">` +
            `<button type="button" class="city-veteran-rename-btn is-default" data-city-veteran-rename-default>기본명 사용</button>` +
            `<button type="button" class="city-veteran-rename-btn is-primary" data-city-veteran-rename-apply>저장</button>` +
            `</div>` +
            `</div>`;

        game.openCityActionModal(title, bodyHtml, {
            allowHtml: true
        });

        const msgEl = document.getElementById('city-action-msg');
        if (!msgEl) return;
        const inputEl = msgEl.querySelector('#city-veteran-rename-input');
        const applyBtn = msgEl.querySelector('[data-city-veteran-rename-apply]');
        const defaultBtn = msgEl.querySelector('[data-city-veteran-rename-default]');
        if (!inputEl || !applyBtn || !defaultBtn) return;

        const commitRename = (nextName) => {
            const value = String(nextName || '').trim().slice(0, 24);
            if (!value) {
                showToast('이름을 입력하거나 기본명 사용을 선택하세요.');
                return false;
            }
            if (typeof CitySimState === 'undefined'
                || !CitySimState
                || typeof CitySimState.renameVeteran !== 'function') {
                showToast('이름 변경 기능을 사용할 수 없습니다.');
                return false;
            }
            const ok = CitySimState.renameVeteran(game, veteranId, value);
            if (!ok) {
                showToast('이름 변경에 실패했습니다.');
                return false;
            }
            syncVeteranStateUi(game);
            if (typeof game.closeCityActionModal === 'function') {
                game.closeCityActionModal();
            }
            if (typeof opts.onRenamed === 'function') {
                try { opts.onRenamed(value); } catch (_) { }
            }
            showToast(`베테랑 이름이 "${value}"(으)로 변경되었습니다.`);
            return true;
        };

        applyBtn.addEventListener('click', () => {
            commitRename(inputEl.value);
        });
        defaultBtn.addEventListener('click', () => {
            commitRename(baseName);
        });
        inputEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitRename(inputEl.value);
            }
        });

        if (typeof inputEl.focus === 'function') {
            setTimeout(() => {
                try {
                    inputEl.focus();
                    if (typeof inputEl.select === 'function' && String(inputEl.value || '').trim().length > 0) {
                        inputEl.select();
                    }
                } catch (_) { }
            }, 0);
        }
    }

    function consumeHonorMedal(game, count = 1) {
        const need = Math.max(1, Math.floor(Number(count) || 1));
        let consumed = false;
        CitySimState.mutate(game, (draft) => {
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
            const current = Math.max(0, Math.floor(Number(draft.hud.honor) || 0));
            if (current < need) return;
            draft.hud.honor = current - need;
            consumed = true;
        });
        return consumed;
    }

    function collectHonorMedalTargets(game) {
        const state = CitySimState.ensure(game);
        const targets = [];

        const drillSlots = state.drillgroundSlots && typeof state.drillgroundSlots === 'object'
            ? state.drillgroundSlots
            : {};
        Object.keys(drillSlots)
            .map((raw) => Number(raw))
            .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < state.grid.length)
            .sort((a, b) => a - b)
            .forEach((index) => {
                const unitKey = normalizeUnitKey(drillSlots[index]);
                if (!unitKey) return;
                const unitDef = getUnitDefByKey(unitKey);
                if (!isPromotableVeteranUnit(unitKey, unitDef)) return;
                const displayName = getInventoryDisplayName(unitKey, unitDef || undefined);
                targets.push({
                    id: `drillground:${index}`,
                    source: 'drillground',
                    sourceLabel: '배치',
                    index,
                    unitKey,
                    unit: unitDef,
                    displayName,
                    count: 1
                });
            });

        const units = state.units && typeof state.units === 'object' ? state.units : {};
        Object.keys(units)
            .sort((a, b) => a.localeCompare(b))
            .forEach((unitKey) => {
                const count = Math.max(0, Math.floor(Number(units[unitKey]) || 0));
                if (count <= 0) return;
                const unitDef = getUnitDefByKey(unitKey);
                if (!isPromotableVeteranUnit(unitKey, unitDef)) return;
                const displayName = getInventoryDisplayName(unitKey, unitDef || undefined);
                targets.push({
                    id: `inventory:${unitKey}`,
                    source: 'inventory',
                    sourceLabel: '보관',
                    index: null,
                    unitKey,
                    unit: unitDef,
                    displayName,
                    count
                });
            });

        return targets;
    }

    function resolveHonorMedalTarget(game, targetInput) {
        const targetId = String(
            (typeof targetInput === 'string')
                ? targetInput
                : (targetInput?.id || '')
        ).trim();

        if (targetId) {
            const latest = collectHonorMedalTargets(game).find((entry) => entry && entry.id === targetId);
            if (latest) return latest;
        }

        if (!targetInput || typeof targetInput !== 'object') return null;
        const source = String(targetInput.source || '').trim();
        if (source !== 'inventory' && source !== 'drillground') return null;
        const unitKey = normalizeUnitKey(targetInput.unitKey);
        if (!unitKey) return null;
        return {
            id: targetId,
            source,
            sourceLabel: String(targetInput.sourceLabel || '').trim(),
            index: Number.isInteger(Number(targetInput.index)) ? Number(targetInput.index) : null,
            unitKey,
            unit: getUnitDefByKey(unitKey),
            displayName: String(targetInput.displayName || '').trim(),
            count: Math.max(0, Math.floor(Number(targetInput.count) || 0))
        };
    }

    function applyHonorMedalToTarget(game, targetInput) {
        const target = resolveHonorMedalTarget(game, targetInput);
        if (!target) return { ok: false, reason: '지급 대상을 찾을 수 없습니다.' };
        const medalCount = getHonorMedalCount(game);
        if (medalCount <= 0) {
            return { ok: false, reason: '명예훈장이 부족합니다.' };
        }

        const unitKey = normalizeUnitKey(target.unitKey);
        const unitDef = getUnitDefByKey(unitKey);
        if (!unitKey || !isPromotableVeteranUnit(unitKey, unitDef)) {
            return { ok: false, reason: '승격 가능한 유닛이 아닙니다.' };
        }

        let consumedUnit = false;
        if (target.source === 'inventory') {
            consumedUnit = consumeUnitFromInventory(game, unitKey);
            if (!consumedUnit) {
                return { ok: false, reason: '보관함 유닛 수량이 부족합니다.' };
            }
        } else if (target.source === 'drillground') {
            const index = Number(target.index);
            const state = CitySimState.ensure(game);
            const current = Number.isInteger(index) ? getDrillgroundUnitAt(state, index) : null;
            if (!current || current !== unitKey) {
                return { ok: false, reason: '연병장 배치 유닛이 변경되었습니다.' };
            }
            CitySimState.clearDrillgroundUnit(game, index);
            consumedUnit = true;
        } else {
            return { ok: false, reason: '알 수 없는 지급 대상입니다.' };
        }

        if (!consumeHonorMedal(game, 1)) {
            if (target.source === 'inventory') {
                returnUnitToInventory(game, unitKey);
            } else if (target.source === 'drillground' && Number.isInteger(Number(target.index))) {
                CitySimState.setDrillgroundUnit(game, Number(target.index), unitKey);
            }
            return { ok: false, reason: '명예훈장 차감에 실패했습니다.' };
        }

        const created = (typeof CitySimState !== 'undefined'
            && CitySimState
            && typeof CitySimState.addVeteran === 'function')
            ? CitySimState.addVeteran(game, {
                unitKey,
                level: 2,
                name: '',
                createdAt: Date.now()
            })
            : null;

        if (!created) {
            if (target.source === 'inventory') {
                returnUnitToInventory(game, unitKey);
            } else if (target.source === 'drillground' && Number.isInteger(Number(target.index))) {
                CitySimState.setDrillgroundUnit(game, Number(target.index), unitKey);
            }
            CitySimState.mutate(game, (draft) => {
                if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
                draft.hud.honor = Math.max(0, Math.floor(Number(draft.hud.honor) || 0)) + 1;
            });
            return { ok: false, reason: '베테랑 생성에 실패했습니다.' };
        }

        return {
            ok: true,
            veteran: created,
            unitKey,
            unitDef
        };
    }

    function renderCityInventoryVeteranRow(game) {
        const rowEl = document.getElementById('city-inventory-veteran-row');
        const listEl = document.getElementById('city-inventory-veteran-list');
        if (!rowEl || !listEl) return;

        const veterans = getVeteranEntries(game);
        if (veterans.length <= 0) {
            rowEl.classList.add('hidden');
            listEl.innerHTML = '';
            return;
        }

        listEl.innerHTML = '';
        veterans.forEach((veteran) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'city-inventory-veteran-chip';
            chip.textContent = '';
            const levelSpan = document.createElement('span');
            levelSpan.className = 'city-inventory-veteran-chip-lv';
            levelSpan.textContent = `LV${veteran.level}`;
            chip.appendChild(levelSpan);

            const nameSpan = document.createElement('span');
            nameSpan.textContent = getVeteranDisplayName(veteran, veteran.unit);
            chip.appendChild(nameSpan);

            chip.addEventListener('click', () => {
                openCityUnitProfilePanel(game, veteran.unitKey, veteran.unit, {
                    fixedCount: 1,
                    source: 'veteran',
                    veteranId: veteran.id,
                    veteranName: veteran.name,
                    veteranLevel: veteran.level
                });
            });

            listEl.appendChild(chip);
        });

        rowEl.classList.remove('hidden');
    }

    function openHonorMedalPicker(game) {
        if (!game || typeof game.openCityActionModal !== 'function') return;
        const medalCount = getHonorMedalCount(game);
        if (medalCount <= 0) {
            showToast('명예훈장이 없습니다.');
            return;
        }

        const targets = collectHonorMedalTargets(game);
        if (targets.length <= 0) {
            showToast('지급 가능한 유닛이 없습니다.');
            return;
        }

        closeFloatingPanelsForUnitAction(game);

        const cardsHtml = targets.map((entry) => {
            const iconUrl = drawInventoryUnitIcon(entry.unitKey);
            const badgeText = entry.source === 'inventory'
                ? `보유 ${formatNumber(entry.count)}`
                : '1기';
            return (
                `<button type="button" class="btn-unit city-action-unitbar-item city-honor-medal-target" data-city-honor-target="${escapeHtml(entry.id)}" title="${escapeHtml(entry.displayName)}">` +
                (
                    iconUrl
                        ? `<img class="city-action-unitbar-icon" src="${iconUrl}" alt="${escapeHtml(entry.displayName)}">`
                        : `<span class="city-action-unitbar-icon-fallback">${escapeHtml(entry.displayName.slice(0, 2))}</span>`
                ) +
                `<span class="city-action-unitbar-name">${escapeHtml(entry.displayName)}</span>` +
                `<span class="city-action-unitbar-meta">LV1 · ${escapeHtml(entry.sourceLabel)}</span>` +
                `<span class="city-action-unitbar-badge">${badgeText}</span>` +
                `</button>`
            );
        }).join('');

        game.openCityActionModal(
            '명예훈장 지급',
            (
                `<div class="city-honor-medal-wrap">` +
                `<div class="city-honor-medal-head">보유 명예훈장 ${formatNumber(medalCount)}개 · 지급할 유닛 1기를 선택하세요.</div>` +
                `<div class="city-action-unitbar-wrap"><div class="city-action-unitbar city-honor-medal-list">${cardsHtml}</div></div>` +
                `<div class="city-honor-medal-actions">` +
                `<button type="button" class="city-honor-medal-apply-btn" data-city-honor-apply disabled>지급</button>` +
                `</div>` +
                `</div>`
            ),
            {
                allowHtml: true,
                layout: 'bar',
                detail: ''
            }
        );

        const msgEl = document.getElementById('city-action-msg');
        if (!msgEl) return;

        const targetMap = new Map(targets.map((entry) => [entry.id, entry]));
        const cards = Array.from(msgEl.querySelectorAll('[data-city-honor-target]'));
        const applyBtn = msgEl.querySelector('[data-city-honor-apply]');
        let selectedId = '';
        let applying = false;

        const syncSelectionUi = () => {
            cards.forEach((card) => {
                const cardId = String(card.getAttribute('data-city-honor-target') || '');
                card.classList.toggle('is-current', !!selectedId && cardId === selectedId);
            });
            if (applyBtn) {
                applyBtn.disabled = applying || !selectedId;
            }
        };

        const commitApply = () => {
            if (applying) return;
            if (!selectedId) {
                showToast('유닛을 먼저 선택하세요.');
                return;
            }

            const target = targetMap.get(selectedId);
            if (!target) {
                showToast('지급 대상을 찾을 수 없습니다.');
                return;
            }

            applying = true;
            syncSelectionUi();

            const result = applyHonorMedalToTarget(game, selectedId);
            if (!result.ok) {
                showToast(result.reason || '명예훈장을 지급할 수 없습니다.');
                applying = false;
                syncSelectionUi();
                return;
            }

            syncVeteranStateUi(game);
            if (typeof game.closeCityActionModal === 'function') {
                game.closeCityActionModal();
            }
            const promotedName = getVeteranDisplayName(result.veteran, result.unitDef);
            showToast(`${promotedName} 베테랑 LV2 승격 완료`);
            setTimeout(() => {
                openCityUnitProfilePanel(game, result.veteran.unitKey, result.unitDef, {
                    fixedCount: 1,
                    source: 'veteran',
                    veteranId: result.veteran.id,
                    veteranName: result.veteran.name,
                    veteranLevel: result.veteran.level
                });
            }, 0);
        };

        cards.forEach((card) => {
            card.addEventListener('click', () => {
                const cardId = String(card.getAttribute('data-city-honor-target') || '');
                const alreadySelected = !!selectedId && selectedId === cardId;
                selectedId = cardId;
                syncSelectionUi();
                if (alreadySelected) {
                    commitApply();
                }
            });
        });
        syncSelectionUi();

        if (!applyBtn) return;
        applyBtn.addEventListener('click', commitApply);
    }

    function openVeteranItemTargetPicker(game, itemKey) {
        if (!game || typeof game.openCityActionModal !== 'function') return;
        const key = normalizeVeteranItemKey(itemKey);
        const itemDef = getVeteranItemDef(key);
        if (!itemDef) {
            showToast('아이템 정보를 찾을 수 없습니다.');
            return;
        }

        const count = getVeteranItemCount(game, key);
        if (count <= 0) {
            showToast(`${itemDef.name} 수량이 없습니다.`);
            return;
        }

        const candidates = getVeteranEntries(game).filter((entry) => isVeteranItemCompatible(key, entry.unitKey));
        if (candidates.length <= 0) {
            showToast(`${itemDef.name}을(를) 장착할 수 있는 베테랑이 없습니다.`);
            return;
        }

        if (candidates.length === 1) {
            const target = candidates[0];
            openCityUnitProfilePanel(game, target.unitKey, target.unit, {
                fixedCount: 1,
                source: 'veteran',
                veteranId: target.id,
                veteranName: target.name,
                veteranLevel: target.level
            });
            return;
        }

        closeFloatingPanelsForUnitAction(game);

        const cardsHtml = candidates.map((entry) => {
            const iconUrl = drawInventoryUnitIcon(entry.unitKey);
            const displayName = getVeteranDisplayName(entry, entry.unit);
            return (
                `<button type="button" class="btn-unit city-action-unitbar-item city-honor-medal-target" data-city-veteran-item-target="${escapeHtml(entry.id)}" title="${escapeHtml(displayName)}">` +
                (
                    iconUrl
                        ? `<img class="city-action-unitbar-icon" src="${iconUrl}" alt="${escapeHtml(displayName)}">`
                        : `<span class="city-action-unitbar-icon-fallback">${escapeHtml(displayName.slice(0, 2))}</span>`
                ) +
                `<span class="city-action-unitbar-name">${escapeHtml(displayName)}</span>` +
                `<span class="city-action-unitbar-meta">LV${formatNumber(entry.level)}</span>` +
                `<span class="city-action-unitbar-badge">${escapeHtml(entry.unit?.name || entry.unitKey)}</span>` +
                `</button>`
            );
        }).join('');

        game.openCityActionModal(
            `${itemDef.name} 지급 대상 선택`,
            (
                `<div class="city-honor-medal-wrap">` +
                `<div class="city-honor-medal-head">보유 ${escapeHtml(itemDef.name)} ${formatNumber(count)}개 · 지급할 베테랑을 선택하세요.</div>` +
                `<div class="city-action-unitbar-wrap"><div class="city-action-unitbar city-honor-medal-list">${cardsHtml}</div></div>` +
                `<div class="city-honor-medal-actions">` +
                `<button type="button" class="city-honor-medal-apply-btn" data-city-veteran-item-open disabled>프로필 열기</button>` +
                `</div>` +
                `</div>`
            ),
            {
                allowHtml: true
            }
        );

        const msgEl = document.getElementById('city-action-msg');
        if (!msgEl) return;
        const cards = Array.from(msgEl.querySelectorAll('[data-city-veteran-item-target]'));
        const openBtn = msgEl.querySelector('[data-city-veteran-item-open]');
        let selectedId = '';

        const syncSelectionUi = () => {
            cards.forEach((card) => {
                const cardId = String(card.getAttribute('data-city-veteran-item-target') || '');
                card.classList.toggle('is-current', !!selectedId && cardId === selectedId);
            });
            if (openBtn) openBtn.disabled = !selectedId;
        };

        cards.forEach((card) => {
            card.addEventListener('click', () => {
                selectedId = String(card.getAttribute('data-city-veteran-item-target') || '').trim();
                syncSelectionUi();
            });
        });
        syncSelectionUi();

        if (!openBtn) return;
        openBtn.addEventListener('click', () => {
            if (!selectedId) {
                showToast('베테랑을 먼저 선택하세요.');
                return;
            }
            const target = candidates.find((entry) => entry.id === selectedId);
            if (!target) {
                showToast('대상을 찾을 수 없습니다.');
                return;
            }
            openCityUnitProfilePanel(game, target.unitKey, target.unit, {
                fixedCount: 1,
                source: 'veteran',
                veteranId: target.id,
                veteranName: target.name,
                veteranLevel: target.level
            });
        });
    }

    function getInventoryUnitCount(game, key, unitDef) {
        const state = CitySimState.ensure(game);
        const units = state.units || {};
        if (Object.prototype.hasOwnProperty.call(units, key)) {
            return Math.max(0, Math.floor(Number(units[key]) || 0));
        }
        return 0;
    }

    function getInventoryDisplayName(key, unitDef) {
        if (key === 'supply_box') return '일반 보급상자';
        if (typeof Lang !== 'undefined' && Lang && typeof Lang.getText === 'function') {
            const localized = String(Lang.getText(`unit_${key}_name`) || '').trim();
            if (localized && localized !== `unit_${key}_name`) return localized;
        }
        return String(unitDef?.name || key);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getUnitDefByKey(unitKey) {
        if (!unitKey) return null;
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return null;
        return CONFIG.units[unitKey] || null;
    }

    function getUnitWeaponLabel(unitKey, unitDef) {
        if (Object.prototype.hasOwnProperty.call(UNIT_WEAPON_LABEL_OVERRIDES, unitKey)) {
            return UNIT_WEAPON_LABEL_OVERRIDES[unitKey];
        }
        if (unitDef?.isSkill === true) return '특수 탄두';
        if (unitDef?.type === 'air') return '항공 무장';
        if (unitDef?.type === 'mech') return '기갑 무장';
        return '개인 화기';
    }

    function getUnitAttackLabel(unitDef) {
        if (!unitDef || typeof unitDef !== 'object') return '0';
        if (unitDef.damageGround != null || unitDef.damageAir != null) {
            const g = Math.max(0, Math.floor(Number(unitDef.damageGround ?? unitDef.damage) || 0));
            const a = Math.max(0, Math.floor(Number(unitDef.damageAir ?? unitDef.damage) || 0));
            return `${formatNumber(g)} / ${formatNumber(a)}`;
        }
        const missile = Math.max(0, Math.floor(Number(unitDef.missileDamage) || 0));
        const base = Math.max(0, Math.floor(Number(unitDef.damage) || 0));
        if (missile > 0 && missile !== base) return `${formatNumber(base)} + ${formatNumber(missile)}`;
        return formatNumber(base);
    }

    function getUnitDefenseLabel(unitDef) {
        const hp = Math.max(0, Math.floor(Number(unitDef?.hp) || 0));
        return formatNumber(hp);
    }

    function getUnitFireRateLabel(unitDef) {
        const rate = Math.max(0, Math.floor(Number(unitDef?.rate) || 0));
        if (rate > 0) return formatNumber(rate);
        const cooldown = Math.max(0, Math.floor(Number(unitDef?.cooldown) || 0));
        if (cooldown > 0) return formatNumber(cooldown);
        return '-';
    }

    function getUnitTypeLabel(unitDef) {
        if (!unitDef) return '-';
        if (unitDef.type === 'air') return '공중';
        if (unitDef.type === 'mech') return '기갑';
        if (unitDef.type === 'skill') return '특수';
        return '보병';
    }

    function getUnitPreviewGunType(unitKey) {
        if (unitKey === 'special_forces') return 'special';
        if (unitKey === 'special_ops') return 'special_ops';
        if (unitKey === 'sniper') return 'sniper';
        if (unitKey === 'humvee') return 'machine_gun';
        if (unitKey === 'apc' || unitKey === 'aa_tank') return 'flak';
        if (unitKey === 'spg' || unitKey === 'mbt') return 'self';
        return 'infantry';
    }

    function playUnitProfileShot(unitKey) {
        if (typeof AudioSystem === 'undefined' || !AudioSystem) return;
        if ((unitKey === 'emp' || unitKey === 'tactical_missile') && typeof AudioSystem.playSFX === 'function') {
            AudioSystem.playSFX('rocket_launcher');
            return;
        }
        if (typeof AudioSystem.playGun === 'function') {
            AudioSystem.playGun(getUnitPreviewGunType(unitKey));
            return;
        }
        if (typeof AudioSystem.playSFX === 'function') {
            AudioSystem.playSFX('shoot');
        }
    }

    function openCityUnitProfilePanel(game, unitKey, unitDef, options) {
        if (!game || typeof game.openCityActionModal !== 'function') return;
        const unit = unitDef || getUnitDefByKey(unitKey);
        if (!unit) {
            showToast('유닛 정보를 불러올 수 없습니다.');
            return;
        }

        const opts = (options && typeof options === 'object') ? options : {};
        const veteranId = String(opts.veteranId || '').trim();
        const isVeteranProfile = String(opts.source || '').trim() === 'veteran' && veteranId.length > 0;
        const veteranEntry = isVeteranProfile
            ? (findVeteranEntryById(game, veteranId) || {
                id: veteranId,
                unitKey,
                unit,
                level: Math.max(2, Math.floor(Number(opts.veteranLevel) || 2)),
                name: String(opts.veteranName || '').trim().slice(0, 24),
                loadout: { itemKey: '' }
            })
            : null;
        const veteranLevel = isVeteranProfile
            ? Math.max(2, Math.floor(Number(veteranEntry?.level) || 2))
            : Math.max(2, Math.floor(Number(opts.veteranLevel) || 2));
        const veteranName = isVeteranProfile
            ? String(veteranEntry?.name || '').trim().slice(0, 24)
            : String(opts.veteranName || '').trim().slice(0, 24);
        const baseDisplayName = getInventoryDisplayName(unitKey, unit);
        const displayName = isVeteranProfile ? (veteranName || baseDisplayName) : baseDisplayName;
        const equippedItemKey = isVeteranProfile ? getVeteranLoadoutItemKey(veteranEntry) : '';
        const equippedItemDef = equippedItemKey ? getVeteranItemDef(equippedItemKey) : null;
        const compatibleItemDefs = isVeteranProfile
            ? VETERAN_ITEM_ORDER
                .map((key) => getVeteranItemDef(key))
                .filter((def) => !!def && isVeteranItemCompatible(def.id, unitKey))
            : [];
        let displayDesc = String(unit.description || '설명 정보가 없습니다.');
        if (typeof Lang !== 'undefined' && Lang && typeof Lang.getText === 'function') {
            const localizedDesc = String(Lang.getText(`unit_${unitKey}_desc`) || '').trim();
            if (localizedDesc && localizedDesc !== `unit_${unitKey}_desc`) {
                displayDesc = localizedDesc;
            }
        }

        const role = String(unit.role || '유닛');
        const iconUrl = drawInventoryUnitIcon(unitKey);
        const fixedCount = Number.isFinite(Number(opts.fixedCount))
            ? Math.max(0, Math.floor(Number(opts.fixedCount)))
            : null;
        const ownedCount = fixedCount != null
            ? fixedCount
            : Math.max(0, Math.floor(Number(opts.ownedCount) || getInventoryUnitCount(game, unitKey, unit)));
        const leftBadge = isVeteranProfile
            ? `베테랑 LV${formatNumber(veteranLevel)}`
            : (fixedCount != null
                ? `${formatNumber(ownedCount)}기 배치`
                : `보유 ${formatNumber(ownedCount)}기`);
        const veteranEditHtml = isVeteranProfile
            ? (
                `<div class="city-veteran-inline-wrap">` +
                `<label class="city-veteran-inline-name-label" for="city-veteran-inline-name-input">이름</label>` +
                `<div class="city-veteran-inline-name-row">` +
                `<input id="city-veteran-inline-name-input" class="city-veteran-inline-name-input" type="text" maxlength="24" ` +
                `value="${escapeHtml(veteranName)}" placeholder="${escapeHtml(baseDisplayName)}" autocomplete="off">` +
                `<button type="button" class="city-veteran-inline-btn is-primary" data-city-veteran-inline-save>저장</button>` +
                `<button type="button" class="city-veteran-inline-btn is-default" data-city-veteran-inline-default>기본명</button>` +
                `</div>` +
                `<div class="city-veteran-inline-name-help">최대 24자</div>` +
                `</div>` +
                `<div class="city-veteran-item-wrap">` +
                `<div class="city-veteran-item-head">장착 슬롯</div>` +
                `<div class="city-veteran-item-slot${equippedItemDef ? ' is-equipped' : ''}">` +
                `<div class="city-veteran-item-slot-name">${escapeHtml(equippedItemDef ? equippedItemDef.name : 'ㅁ')}</div>` +
                `<div class="city-veteran-item-slot-desc">${escapeHtml(equippedItemDef ? equippedItemDef.desc : '아이템 미장착')}</div>` +
                `</div>` +
                `<div class="city-veteran-item-actions">` +
                `<button type="button" class="city-veteran-inline-btn is-default" data-city-veteran-item-unequip${equippedItemDef ? '' : ' disabled'}>해제</button>` +
                `</div>` +
                `<div class="city-veteran-item-list">` +
                (
                    compatibleItemDefs.length > 0
                        ? compatibleItemDefs.map((itemDef) => {
                            const count = getVeteranItemCount(game, itemDef.id);
                            const isCurrent = equippedItemKey === itemDef.id;
                            const canEquip = isCurrent || count > 0;
                            const badge = isCurrent
                                ? '장착중'
                                : `보유 ${formatNumber(count)}`;
                            return (
                                `<button type="button" class="city-veteran-item-btn${isCurrent ? ' is-current' : ''}" ` +
                                `data-city-veteran-item-equip="${escapeHtml(itemDef.id)}"${canEquip ? '' : ' disabled'}>` +
                                `<span class="city-veteran-item-btn-name">${escapeHtml(itemDef.name)}</span>` +
                                `<span class="city-veteran-item-btn-meta">${escapeHtml(badge)}</span>` +
                                `</button>`
                            );
                        }).join('')
                        : `<div class="city-veteran-item-empty">장착 가능한 아이템이 없습니다.</div>`
                ) +
                `</div>` +
                `</div>`
            )
            : '';

        const bodyHtml =
            `<div class="city-unit-profile-tabrow"><span class="city-unit-profile-tab active">${escapeHtml(displayName)}</span></div>` +
            `<div class="city-unit-profile">` +
            `<div class="city-unit-profile-left">` +
            `<div class="city-unit-profile-card">` +
            (iconUrl
                ? `<img class="city-unit-profile-icon" src="${iconUrl}" alt="${escapeHtml(displayName)}">`
                : `<div class="city-unit-profile-icon-fallback">${escapeHtml(displayName.slice(0, 2))}</div>`) +
            `<div class="city-unit-profile-badge">${escapeHtml(leftBadge)}</div>` +
            `<button type="button" class="city-unit-profile-shot-btn" data-city-unit-preview-shot>사격음 재생</button>` +
            `</div>` +
            `</div>` +
            `<div class="city-unit-profile-right">` +
            `<div class="city-unit-profile-name">${escapeHtml(displayName)}</div>` +
            (isVeteranProfile
                ? `<div class="city-unit-profile-veteran-name">기본명: ${escapeHtml(baseDisplayName)}</div>`
                : '') +
            veteranEditHtml +
            `<div class="city-unit-profile-role">${escapeHtml(role)}</div>` +
            `<p class="city-unit-profile-desc">${escapeHtml(displayDesc)}</p>` +
            `<div class="city-unit-profile-stats">` +
            `<div class="city-unit-profile-stat"><span>총기</span><strong>${escapeHtml(getUnitWeaponLabel(unitKey, unit))}</strong></div>` +
            `<div class="city-unit-profile-stat"><span>공격력</span><strong>${escapeHtml(getUnitAttackLabel(unit))}</strong></div>` +
            `<div class="city-unit-profile-stat"><span>방어력</span><strong>${escapeHtml(getUnitDefenseLabel(unit))}</strong></div>` +
            `<div class="city-unit-profile-stat"><span>사거리</span><strong>${formatNumber(unit.range || 0)}</strong></div>` +
            `<div class="city-unit-profile-stat"><span>공격 간격</span><strong>${escapeHtml(getUnitFireRateLabel(unit))}</strong></div>` +
            `<div class="city-unit-profile-stat"><span>이동 속도</span><strong>${Number(unit.speed || 0).toFixed(2)}</strong></div>` +
            `<div class="city-unit-profile-stat"><span>분류</span><strong>${escapeHtml(getUnitTypeLabel(unit))}</strong></div>` +
            `<div class="city-unit-profile-stat"><span>보급 비용</span><strong>${formatNumber(unit.cost || 0)}</strong></div>` +
            `</div>` +
            `</div>` +
            `</div>`;

        game.openCityActionModal(
            `${displayName} 프로필`,
            bodyHtml,
            {
                allowHtml: true
            }
        );

        const msgEl = document.getElementById('city-action-msg');
        const shotBtn = msgEl ? msgEl.querySelector('[data-city-unit-preview-shot]') : null;
        if (shotBtn) {
            shotBtn.addEventListener('click', () => {
                playUnitProfileShot(unitKey);
            });
        }

        if (!isVeteranProfile || !msgEl) return;

        const nameInputEl = msgEl.querySelector('#city-veteran-inline-name-input');
        const nameSaveBtn = msgEl.querySelector('[data-city-veteran-inline-save]');
        const nameDefaultBtn = msgEl.querySelector('[data-city-veteran-inline-default]');
        const itemEquipBtns = Array.from(msgEl.querySelectorAll('[data-city-veteran-item-equip]'));
        const itemUnequipBtn = msgEl.querySelector('[data-city-veteran-item-unequip]');

        const reopenVeteranProfile = () => {
            const latest = findVeteranEntryById(game, veteranId);
            if (!latest) return;
            openCityUnitProfilePanel(game, unitKey, unit, {
                fixedCount: fixedCount != null ? fixedCount : 1,
                source: 'veteran',
                veteranId: latest.id,
                veteranName: latest.name,
                veteranLevel: latest.level
            });
        };

        const commitRename = (nextName) => {
            const value = String(nextName || '').trim().slice(0, 24);
            if (!value) {
                showToast('이름을 입력하거나 기본명을 선택하세요.');
                return;
            }
            if (typeof CitySimState === 'undefined'
                || !CitySimState
                || typeof CitySimState.renameVeteran !== 'function') {
                showToast('이름 변경 기능을 사용할 수 없습니다.');
                return;
            }
            const ok = CitySimState.renameVeteran(game, veteranId, value);
            if (!ok) {
                showToast('이름 변경에 실패했습니다.');
                return;
            }
            syncVeteranStateUi(game);
            showToast(`베테랑 이름이 "${value}"(으)로 변경되었습니다.`);
            reopenVeteranProfile();
        };

        if (nameSaveBtn && nameInputEl) {
            nameSaveBtn.addEventListener('click', () => commitRename(nameInputEl.value));
        }
        if (nameDefaultBtn) {
            nameDefaultBtn.addEventListener('click', () => commitRename(baseDisplayName));
        }
        if (nameInputEl) {
            nameInputEl.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    commitRename(nameInputEl.value);
                }
            });
        }

        itemEquipBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const itemKey = String(btn.getAttribute('data-city-veteran-item-equip') || '').trim();
                if (!itemKey) return;
                const result = equipVeteranItem(game, veteranId, itemKey);
                if (!result.ok) {
                    showToast(result.reason || '아이템 장착에 실패했습니다.');
                    return;
                }
                syncVeteranStateUi(game);
                const itemDef = getVeteranItemDef(itemKey);
                showToast(`${itemDef ? itemDef.name : itemKey} 장착 완료`);
                reopenVeteranProfile();
            });
        });

        if (itemUnequipBtn) {
            itemUnequipBtn.addEventListener('click', () => {
                const result = unequipVeteranItem(game, veteranId);
                if (!result.ok) {
                    showToast(result.reason || '아이템 해제에 실패했습니다.');
                    return;
                }
                syncVeteranStateUi(game);
                showToast('아이템을 해제했습니다.');
                reopenVeteranProfile();
            });
        }
    }

    function drawInventoryUnitIcon(key) {
        if (inventoryIconCache.has(key)) {
            const cached = inventoryIconCache.get(key);
            if (cached) return cached;
        }
        if (typeof CONFIG === 'undefined' || !CONFIG?.units?.[key]) {
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

        const unitDef = CONFIG.units[key];
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

    function renderInventoryPanel(game) {
        const state = CitySimState.ensure(game);
        const requestedTab = normalizeInventoryTab(game, state);
        const tabSummaries = INVENTORY_TABS.map((tab) => {
            let entries = [];
            if (tab.id === 'supply') {
                entries = getSupplyInventoryEntries(game);
            } else if (tab.id === 'veteran') {
                entries = getVeteranInventoryEntries(game);
            } else {
                entries = getOwnedInventoryUnitDefsByTab(game, tab.id);
            }
            const totalCount = entries.reduce((sum, entry) => {
                const countBase = (entry && Object.prototype.hasOwnProperty.call(entry, 'tabCount'))
                    ? entry.tabCount
                    : entry.count;
                return sum + Math.max(0, Number(countBase) || 0);
            }, 0);
            return {
                id: tab.id,
                label: tab.label,
                entries,
                totalCount
            };
        });
        let activeTab = requestedTab;
        if (!tabSummaries.some((tab) => tab.id === activeTab)) {
            activeTab = INVENTORY_TABS[0]?.id || null;
            if (activeTab && state.inventoryTab !== activeTab) {
                CitySimState.setInventoryTab(game, activeTab);
            }
        }

        const titleEl = document.getElementById('city-inventory-title');
        if (titleEl) {
            titleEl.textContent = '보관함';
        }

        const tabsEl = document.getElementById('city-inventory-tabs');
        if (tabsEl) {
            tabsEl.innerHTML = '';
            tabSummaries.forEach((tab) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-category flex-1 py-2 text-xs md:text-sm';
                if (tab.id === activeTab) btn.classList.add('active');
                btn.addEventListener('click', () => setInventoryTab(game, tab.id));

                const label = document.createElement('span');
                label.textContent = tab.label;
                btn.appendChild(label);

                const count = document.createElement('span');
                count.className = 'city-inventory-tab-count';
                count.textContent = String(tab.totalCount);
                btn.appendChild(count);

                tabsEl.appendChild(btn);
            });
        }

        const listEl = document.getElementById('city-inventory-cards');
        if (!listEl) return;

        listEl.innerHTML = '';
        listEl.classList.add('city-inventory-unit-strip');
        const legacyVeteranRow = document.getElementById('city-inventory-veteran-row');
        if (legacyVeteranRow) legacyVeteranRow.classList.add('hidden');

        const activeSummary = activeTab
            ? tabSummaries.find((tab) => tab.id === activeTab)
            : null;
        const entries = activeSummary ? activeSummary.entries : [];
        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'city-inventory-empty-card';
            empty.textContent = activeTab === 'supply'
                ? '보관함에 보급품이 없습니다.'
                : activeTab === 'veteran'
                    ? '베테랑 유닛이 없습니다.'
                : '표시할 유닛이 없습니다.';
            listEl.appendChild(empty);
            return;
        }

        if (activeTab === 'veteran') {
            entries.forEach((entry) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg shrink-0 city-inventory-unit-btn is-clickable';
                card.title = `${entry.displayName} (LV${entry.level})`;

                const iconUrl = drawInventoryUnitIcon(entry.unitKey);
                if (iconUrl) {
                    const img = document.createElement('img');
                    img.className = 'city-inventory-unit-icon';
                    img.src = iconUrl;
                    img.alt = entry.displayName;
                    img.decoding = 'async';
                    card.appendChild(img);
                } else {
                    const fallback = document.createElement('span');
                    fallback.className = 'city-inventory-unit-icon-fallback';
                    fallback.textContent = String(entry.displayName || entry.unitKey).slice(0, 2);
                    card.appendChild(fallback);
                }

                const nameSpan = document.createElement('span');
                nameSpan.className = 'city-inventory-unit-name';
                nameSpan.textContent = entry.displayName;
                card.appendChild(nameSpan);

                const lvSpan = document.createElement('span');
                lvSpan.className = 'count-text z-50 absolute bottom-1 right-1';
                lvSpan.textContent = `LV${entry.level}`;
                card.appendChild(lvSpan);

                const renameBtn = document.createElement('button');
                renameBtn.type = 'button';
                renameBtn.className = 'city-veteran-card-rename-btn';
                renameBtn.title = '이름 변경';
                renameBtn.textContent = '✎';
                renameBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openCityUnitProfilePanel(game, entry.unitKey, entry.unit, {
                        fixedCount: 1,
                        source: 'veteran',
                        veteranId: entry.id,
                        veteranName: entry.name,
                        veteranLevel: entry.level
                    });
                });
                card.appendChild(renameBtn);

                const colorBar = document.createElement('div');
                colorBar.className = 'absolute bottom-0 w-full h-1 z-10';
                colorBar.style.backgroundColor = '#facc15';
                card.appendChild(colorBar);

                card.addEventListener('click', () => {
                    openCityUnitProfilePanel(game, entry.unitKey, entry.unit, {
                        fixedCount: 1,
                        source: 'veteran',
                        veteranId: entry.id,
                        veteranName: entry.name,
                        veteranLevel: entry.level
                    });
                });

                listEl.appendChild(card);
            });
            return;
        }

        if (activeTab === 'supply') {
            entries.forEach((entry) => {
                const count = Math.max(0, Math.floor(Number(entry.count) || 0));

                const card = document.createElement('button');
                card.type = 'button';
                const isOpenable = entry.isOpenable === true && !!entry.boxId;
                const isVeteranItem = entry.kind === 'veteran_item' && !!entry.itemKey;
                const isHonorMedal = entry.kind === 'honor_medal';
                const isClickable = isOpenable || isHonorMedal || isVeteranItem;
                card.className = `btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg shrink-0 city-inventory-unit-btn${isClickable ? ' is-clickable' : ''}`;
                card.title = `${entry.name} (${count})`;

                if (entry.asset) {
                    const img = document.createElement('img');
                    img.className = 'city-inventory-unit-icon';
                    img.src = entry.asset;
                    img.alt = entry.name;
                    img.decoding = 'async';
                    card.appendChild(img);
                } else {
                    const fallback = document.createElement('span');
                    fallback.className = 'city-inventory-unit-icon-fallback';
                    fallback.textContent = String(entry.name || '').slice(0, 2) || '??';
                    card.appendChild(fallback);
                }

                const nameSpan = document.createElement('span');
                nameSpan.className = 'city-inventory-unit-name';
                nameSpan.textContent = entry.name;
                card.appendChild(nameSpan);

                const countSpan = document.createElement('span');
                countSpan.className = 'count-text z-50 absolute bottom-1 right-1';
                countSpan.textContent = formatNumber(count);
                card.appendChild(countSpan);

                const colorBar = document.createElement('div');
                colorBar.className = 'absolute bottom-0 w-full h-1 z-10';
                colorBar.style.backgroundColor = isOpenable
                    ? '#f59e0b'
                    : (isHonorMedal
                        ? '#facc15'
                        : (isVeteranItem ? '#22d3ee' : '#38bdf8'));
                card.appendChild(colorBar);

                if (isOpenable) card.addEventListener('click', () => {
                    if (typeof CitySimGacha === 'undefined' || !CitySimGacha || typeof CitySimGacha.openBoxFromInventory !== 'function') {
                        showToast('보급품 개봉 기능을 사용할 수 없습니다.');
                        return;
                    }
                    const result = CitySimGacha.openBoxFromInventory(game, entry.boxId);
                    if (!result || result.ok !== true) return;
                    if (typeof game.renderCityUnits === 'function') {
                        game.renderCityUnits();
                    }
                    if (typeof game.applyCityUnitsToBattleStock === 'function') {
                        game.applyCityUnitsToBattleStock();
                    }
                    renderInventoryPanel(game);
                });
                else if (isHonorMedal) {
                    card.addEventListener('click', () => {
                        openHonorMedalPicker(game);
                    });
                } else if (isVeteranItem) {
                    card.addEventListener('click', () => {
                        openVeteranItemTargetPicker(game, entry.itemKey);
                    });
                }

                listEl.appendChild(card);
            });
            return;
        }

        entries.forEach(({ key, unit, count }) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg shrink-0 city-inventory-unit-btn';
            card.title = `${getInventoryDisplayName(key, unit)} (${count})`;
            card.classList.add('is-clickable');

            const iconUrl = drawInventoryUnitIcon(key);
            if (iconUrl) {
                const img = document.createElement('img');
                img.className = 'city-inventory-unit-icon';
                img.src = iconUrl;
                img.alt = getInventoryDisplayName(key, unit);
                img.decoding = 'async';
                card.appendChild(img);
            } else {
                const fallback = document.createElement('span');
                fallback.className = 'city-cell-icon';
                fallback.textContent = getInventoryDisplayName(key, unit).slice(0, 2);
                card.appendChild(fallback);
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'city-inventory-unit-name';
            nameSpan.textContent = getInventoryDisplayName(key, unit);
            card.appendChild(nameSpan);

            const countSpan = document.createElement('span');
            countSpan.className = 'count-text z-50 absolute bottom-1 right-1';
            countSpan.textContent = String(count);
            card.appendChild(countSpan);

            const colorBar = document.createElement('div');
            colorBar.className = 'absolute bottom-0 w-full h-1 z-10';
            colorBar.style.backgroundColor = unit.color || '#475569';
            card.appendChild(colorBar);

            card.addEventListener('click', () => {
                openCityUnitProfilePanel(game, key, unit, {
                    ownedCount: count,
                    source: 'inventory'
                });
            });

            listEl.appendChild(card);
        });
    }

    function renderContextBar(game) {
        if (global.CitySimConstructionRender
            && typeof global.CitySimConstructionRender.renderContextBar === 'function') {
            return global.CitySimConstructionRender.renderContextBar(game);
        }
    }

    function triggerPrimaryAction(game) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.triggerPrimaryAction === 'function') {
            return global.CitySimConstructionPlacement.triggerPrimaryAction(game);
        }
    }

    function sellSelected(game) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.sellSelected === 'function') {
            return global.CitySimConstructionPlacement.sellSelected(game);
        }
    }

    function moveSelected(game) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.moveSelected === 'function') {
            return global.CitySimConstructionPlacement.moveSelected(game);
        }
    }

    function confirmSelection(game) {
        if (global.CitySimConstructionPlacement
            && typeof global.CitySimConstructionPlacement.confirmSelection === 'function') {
            return global.CitySimConstructionPlacement.confirmSelection(game);
        }
    }

    const constructionInternals = global.CitySimConstructionInternals || {};
    Object.assign(constructionInternals, {
        BUILDING_DEFS,
        MSG_SELECT_CARD,
        MSG_SELECT_TILE,
        MOVE_COST_MONEY,
        showToast,
        setBuildHint,
        formatNumber,
        getBuildToolCostMoney,
        getFootprintRequirementMessage,
        isMapInputLocked,
        evaluatePlacement,
        evaluateMovePlacement,
        applyPlacement,
        applyMovePlacement,
        normalizeObjectSelection,
        isObjectTool,
        isFootprintTool,
        isFootprintTile,
        getFootprintAtAnchor,
        shouldChargeBuildPlacementCost,
        getSelectedTileInfo,
        getMoveSourceInfo,
        getProductionCatalog,
        getProductionQueueAt,
        ensureProductionCountdownTicker,
        getDrillgroundUnitAt,
        isDrillgroundUnitTarget,
        isProductionClaimTarget,
        isIncomeClaimTarget,
        claimBuildingProducedUnit,
        openDrillgroundUnitProfile,
        openDrillgroundUnitPicker,
        openCitySupplyPanel,
        releaseDrillgroundUnit,
        refreshCityUnitPanels,
        clearFootprintAtIndex,
        playDemolitionSmokeEffect,
        persist,
        renderBuildSelection,
        renderGrid,
        renderContextBar,
        renderInventoryPanel,
        openOwnSignAtCell,
        refreshOwnSigns,
        tickProductionCooldowns
    });
    global.CitySimConstructionInternals = constructionInternals;

    global.CitySimConstruction = {
        getBuildingDefs,
        getBuildTabs,
        getInventoryTabs,
        createDefaultGrid,
        openBuildPanel,
        openInventory,
        setBuildTab,
        setBuildTool,
        setInventoryTab,
        updatePlacementPreview,
        clearPlacementPreview,
        renderBuildSelection,
        renderGrid,
        renderContextBar,
        renderInventoryPanel,
        isMapInputLocked,
        openOwnSignAtCell,
        refreshOwnSigns,
        tickProductionCooldowns,
        handleCellAction,
        triggerPrimaryAction,
        sellSelected,
        moveSelected,
        confirmSelection
    };
})(window);
