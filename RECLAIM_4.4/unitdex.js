// UnitDex - Unit Encyclopedia Renderer
// Reads CONFIG.units and displays cards with language-aware labels

const UnitDex = {
    currentFilter: 'all',

    // Check if data is available
    isReady() {
        if (!window.CONFIG || !CONFIG.units) {
            if (typeof ui !== 'undefined') ui.showToast('CONFIG.units ?놁쓬');
            console.error('[UnitDex] CONFIG.units not found');
            return false;
        }
        const keys = Object.keys(CONFIG.units);
        if (keys.length === 0) {
            if (typeof ui !== 'undefined') ui.showToast('units 鍮꾩뼱?덉쓬');
            console.error('[UnitDex] CONFIG.units is empty');
            return false;
        }
        return true;
    },
    // Get labels based on current language
    getLabels() {
        const isKo = (typeof Lang !== 'undefined' && Lang.current === 'ko');
        return {
            title: isKo ? '유닛 도감' : 'UNIT ENCYCLOPEDIA',
            hp: isKo ? '체력' : 'HP',
            dmg: isKo ? '공격력' : 'DMG',
            range: isKo ? '사거리' : 'Range',
            speed: isKo ? '이동속도' : 'Speed',
            mobility: isKo ? '기동력' : 'Mobility',
            cooldown: isKo ? '쿨타임' : 'CD',
            max: isKo ? '최대' : 'Max',
            categories: {
                all: isKo ? '전체' : 'ALL',
                infantry: isKo ? '보병' : 'INFANTRY',
                armored: isKo ? '기갑' : 'ARMORED',
                air: isKo ? '공중' : 'AIR',
                drone: isKo ? '드론' : 'DRONE',
                special: isKo ? '특수' : 'SPECIAL'
            }
        };
    },

    getPack() {
        const isKo = (typeof Lang !== 'undefined' && Lang.current === 'ko');
        return isKo ? window.UNITDEX_LANG_KR : window.UNITDEX_LANG_EN;
    },

    // Render all unit cards
    render() {
        if (!this.isReady()) return;

        const labels = this.getLabels();
        const container = document.getElementById('unitdex-cards');
        if (!container) return;

        // Update title
        const titleEl = document.getElementById('unitdex-title');
        if (titleEl) titleEl.textContent = labels.title;

        // Update category tabs
        document.querySelectorAll('.unitdex-tab').forEach(btn => {
            const cat = btn.dataset.cat;
            if (labels.categories[cat]) btn.textContent = labels.categories[cat];
        });

        // Clear and render cards
        container.innerHTML = '';
        let count = 0;

        Object.keys(CONFIG.units).forEach(key => {
            const unit = CONFIG.units[key];

            // Apply filter
            if (this.currentFilter !== 'all' && unit.category !== this.currentFilter) return;

            // [R 4.2] 도감에서 숨김 처리된 유닛은 카드 생성 스킵
            if (unit.hideFromUnitDex === true) return;

            const card = this.createCard(key, unit, labels);
            container.appendChild(card);
            count++;
        });

        console.log(`[UnitDex] Rendered ${count} units`);
    },

    // Create a single unit card
    createCard(key, unit, labels) {
        const card = document.createElement('div');
        card.className = 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl overflow-hidden hover:border-blue-500 transition-all hover:-translate-y-1';
        card.dataset.category = unit.category;
        const dmgText = (unit.damageGround != null || unit.damageAir != null)
            ? `${unit.damageGround ?? unit.damage ?? 0}/${unit.damageAir ?? unit.damage ?? 0}`
            : `${unit.damage ?? 0}`;
        const isDrone = (unit.id && unit.id.includes('drone'));
        const mobilityNum = (unit.mobility ?? 0);
        const mobilityText = Number.isFinite(mobilityNum) ? String(mobilityNum) : '0';
        const pack = this.getPack();
        const t = pack?.units?.[unit.id];
        const displayName = t?.name ?? unit.name ?? unit.id;
        const displayRole = t?.role ?? unit.role ?? '';
        const displayDesc = t?.desc ?? unit.description ?? '';
        const mobilityBlock = isDrone ? `
                <div class="bg-slate-900 rounded-lg p-2">
                    <div class="text-[10px] text-gray-500 uppercase">${labels.mobility}</div>
                    <div class="text-sm font-bold text-blue-400">${mobilityText}</div>
                </div>` : '';

        // Category badge color
        const catColors = {
            infantry: 'bg-green-600',
            armored: 'bg-blue-600',
            air: 'bg-purple-600',
            drone: 'bg-orange-600',
            special: 'bg-red-600'
        };
        const catColor = catColors[unit.category] || 'bg-gray-600';

        // Create card structure
        const header = document.createElement('div');
        header.className = 'p-4 bg-slate-700/50 border-b border-slate-600';

        const headerFlex = document.createElement('div');
        headerFlex.className = 'flex items-center gap-3';

        // [KEY CHANGE] Canvas-based icon (same as in-game unit bar)
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'w-16 h-12 rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden';

        const iconCanvas = this.renderUnitIcon(key, unit);
        iconWrapper.appendChild(iconCanvas);

        const info = document.createElement('div');
        info.innerHTML = `
            <div class="font-bold text-white text-lg">${displayName}</div>
            <span class="inline-block px-2 py-0.5 text-xs font-semibold rounded ${catColor} text-white">${displayRole || unit.category}</span>
        `;

        headerFlex.appendChild(iconWrapper);
        headerFlex.appendChild(info);
        header.appendChild(headerFlex);

        const body = document.createElement('div');
        body.className = 'p-4';
        body.innerHTML = `
            <p class="text-sm text-gray-300 mb-4 min-h-[3rem]">${displayDesc}</p>
            <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-slate-900 rounded-lg p-2">
                    <div class="text-[10px] text-gray-500 uppercase">${labels.hp}</div>
                    <div class="text-sm font-bold text-blue-400">${unit.hp || 0}</div>
                </div>
                <div class="bg-slate-900 rounded-lg p-2">
                    <div class="text-[10px] text-gray-500 uppercase">${labels.dmg}</div>
                    <div class="text-sm font-bold text-blue-400">${dmgText}</div>
                </div>
                <div class="bg-slate-900 rounded-lg p-2">
                    <div class="text-[10px] text-gray-500 uppercase">${labels.range}</div>
                    <div class="text-sm font-bold text-blue-400">${unit.range || 0}</div>
                </div>
                <div class="bg-slate-900 rounded-lg p-2">
                    <div class="text-[10px] text-gray-500 uppercase">${labels.max}</div>
                    <div class="text-sm font-bold text-blue-400">${unit.maxCount || 0}</div>
                </div>
                <div class="bg-slate-900 rounded-lg p-2">
                    <div class="text-[10px] text-gray-500 uppercase">${labels.speed}</div>
                    <div class="text-sm font-bold text-blue-400">${unit.speed || 0}</div>
                </div>${mobilityBlock}
            </div>
        `;

        card.appendChild(header);
        card.appendChild(body);

        return card;
    },

    // [NEW] Render unit icon using canvas (same approach as in-game unit bar)
    renderUnitIcon(key, unit) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;

        // Check if Unit class is available
        if (typeof Unit === 'undefined') {
            // Fallback: just fill with placeholder
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = unit.color || '#3b82f6';
            ctx.fillRect(16, 12, 32, 24);
            return canvas;
        }

        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(32, 30);

        // Create dummy unit for rendering (same as ui.initUnitButtons)
        const dummy = new Unit(key, 0, 0, 'player');
        dummy.hideHp = true;
        if (dummy.stats.type === 'air') dummy.y = 0;

        // Scale based on unit size - special handling for helicopters
        if (key === 'blackhawk' || key === 'chinook') {
            // ?ш린?????묎쾶 ?ㅼ??쇳븯怨??꾩튂 議곗젙
            ctx.scale(0.4, 0.4);
        } else if (key === 'bomber') {
            ctx.scale(0.35, 0.35);
        } else if (unit.width > 50) {
            ctx.scale(0.5, 0.5);
        } else {
            ctx.scale(0.7, 0.7);
        }

        dummy.draw(ctx);
        ctx.restore();

        return canvas;
    },

    // Get icon for category
    getCategoryIcon(category) {
        const icons = {
            infantry: 'fa-person-rifle',
            armored: 'fa-truck-monster',
            air: 'fa-helicopter',
            drone: 'fa-jet-fighter',
            special: 'fa-radiation'
        };
        return icons[category] || 'fa-question';
    },

    // Filter by category
    filter(category) {
        this.currentFilter = category;

        // Update active tab
        document.querySelectorAll('.unitdex-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cat === category);
        });

        this.render();
    }
};



