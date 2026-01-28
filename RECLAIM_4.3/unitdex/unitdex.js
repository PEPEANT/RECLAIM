// Unitdex Main Script
// Reads CONFIG.units from parent window and UNITDEX_LANG from language pack

let currentLang = 'kr';
let currentCategory = 'all';
let UNITS_DATA = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Detect language from parent or localStorage
    currentLang = localStorage.getItem('lang') || 'kr';
    if (currentLang === 'ko') currentLang = 'kr';
    if (currentLang === 'en') currentLang = 'en';

    loadLanguagePack().then(() => {
        loadUnitsData();
        renderUI();
        renderUnits();
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeUnitdex();
    });
});

// Load language pack dynamically
async function loadLanguagePack() {
    const scriptSrc = currentLang === 'en' ? 'lang_en.js' : 'lang_kr.js';
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = scriptSrc;
        script.onload = resolve;
        script.onerror = () => {
            console.warn(`Failed to load ${scriptSrc}, falling back to kr`);
            if (currentLang !== 'kr') {
                currentLang = 'kr';
                const fallback = document.createElement('script');
                fallback.src = 'lang_kr.js';
                fallback.onload = resolve;
                document.head.appendChild(fallback);
            } else {
                resolve();
            }
        };
        document.head.appendChild(script);
    });
}

// Load units data from parent CONFIG or fetch data.js
function loadUnitsData() {
    // Try to get from parent window (if opened as popup/iframe)
    if (window.opener && window.opener.CONFIG) {
        UNITS_DATA = window.opener.CONFIG.units;
    } else if (window.parent && window.parent.CONFIG) {
        UNITS_DATA = window.parent.CONFIG.units;
    } else if (typeof CONFIG !== 'undefined') {
        UNITS_DATA = CONFIG.units;
    } else {
        // Fallback: minimal data
        console.warn('CONFIG.units not found, using empty data');
        UNITS_DATA = {};
    }
}

// Render UI text
function renderUI() {
    if (typeof UNITDEX_LANG === 'undefined') return;

    document.getElementById('title-text').textContent = UNITDEX_LANG.title;

    // Category tabs
    const tabs = document.querySelectorAll('.cat-btn');
    tabs.forEach(btn => {
        const cat = btn.dataset.cat;
        btn.textContent = UNITDEX_LANG[`category_${cat}`] || cat.toUpperCase();
    });
}

// Render unit cards
function renderUnits() {
    const grid = document.getElementById('unit-grid');
    grid.innerHTML = '';

    if (!UNITS_DATA || Object.keys(UNITS_DATA).length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">No unit data available</div>';
        return;
    }

    Object.keys(UNITS_DATA).forEach(key => {
        const unit = UNITS_DATA[key];

        // Filter by category
        if (currentCategory !== 'all' && unit.category !== currentCategory) return;

        const card = createUnitCard(key, unit);
        grid.appendChild(card);
    });
}

// Create a single unit card
function createUnitCard(key, unit) {
    const lang = (typeof UNITDEX_LANG !== 'undefined' && UNITDEX_LANG.units && UNITDEX_LANG.units[key])
        ? UNITDEX_LANG.units[key]
        : { name: unit.name || key, role: unit.role || '', desc: unit.description || '' };

    const labels = typeof UNITDEX_LANG !== 'undefined' ? UNITDEX_LANG : {
        stat_hp: 'HP', stat_dmg: 'DMG', stat_range: 'Range',
        stat_speed: 'Speed', stat_cost: 'Cost', stat_max: 'Max'
    };

    const card = document.createElement('div');
    card.className = 'unit-card';
    card.dataset.category = unit.category;

    // Category badge class
    const catClass = `category-${unit.category}`;

    card.innerHTML = `
        <div class="unit-card-header">
            <div class="unit-icon">
                <i class="fa-solid ${getCategoryIcon(unit.category)}"></i>
            </div>
            <div>
                <div class="unit-name">${lang.name}</div>
                <div class="unit-role">
                    <span class="category-badge ${catClass}">${lang.role}</span>
                </div>
            </div>
        </div>
        <div class="unit-card-body">
            <div class="unit-desc">${lang.desc}</div>
            <div class="stat-grid">
                <div class="stat-item">
                    <div class="stat-label">${labels.stat_hp}</div>
                    <div class="stat-value">${unit.hp || 0}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">${labels.stat_dmg}</div>
                    <div class="stat-value">${unit.damage || 0}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">${labels.stat_range}</div>
                    <div class="stat-value">${unit.range || 0}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">${labels.stat_cost}</div>
                    <div class="stat-value">${unit.cost || 0}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">${labels.stat_max}</div>
                    <div class="stat-value">${unit.maxCount || 0}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">${labels.stat_speed}</div>
                    <div class="stat-value">${unit.speed || 0}</div>
                </div>
            </div>
        </div>
    `;

    return card;
}

// Get icon for category
function getCategoryIcon(category) {
    const icons = {
        infantry: 'fa-person-rifle',
        armored: 'fa-truck-monster',
        air: 'fa-helicopter',
        drone: 'fa-jet-fighter',
        special: 'fa-radiation'
    };
    return icons[category] || 'fa-question';
}

// Filter by category
function filterCategory(cat) {
    currentCategory = cat;

    // Update active tab
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === cat);
    });

    renderUnits();
}

// Close unitdex
function closeUnitdex() {
    // If opened as standalone, go back
    if (window.opener) {
        window.close();
    } else if (window.parent && window.parent !== window) {
        // If in iframe, notify parent
        window.parent.postMessage('closeUnitdex', '*');
    } else {
        // Fallback: go to parent folder index
        window.location.href = '../index.html';
    }
}
