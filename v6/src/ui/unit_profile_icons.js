// src/ui/unit_profile_icons.js
(function () {
    'use strict';

    const DEFAULT_BG_COLOR = '#4A8522';
    const dataUrlCache = Object.create(null);

    function normalize(value) {
        return String(value || '').trim().toLowerCase();
    }

    function sanitizeColor(value) {
        const v = String(value || '').trim();
        if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
        return DEFAULT_BG_COLOR;
    }

    function resolveIconType(unitKey, unitDef) {
        const key = normalize(unitKey);
        const category = normalize(unitDef && unitDef.category);

        if (key === 'bagpiper') return 'bagpipe';
        if (key === 'sniper') return 'sniper';
        if (key === 'special_ops') return 'm4';
        if (key === 'mbt') return 'mbt';
        if (key === 'aa_tank') return 'aa_tank';
        if (key === 'humvee') return 'humvee';
        if (key === 'icbm' || key === 'icbm_enemy') return 'icbm_tel';
        if (key === 'apc') return 'apc';
        if (key === 'spg') return 'spg';
        if (key === 'apache') return 'apache';
        if (key === 'blackhawk' || key === 'uh60') return 'transport_heli';
        if (key === 'fighter') return 'fighter';
        if (key === 'recon') return 'recon';
        if (key === 'bomber') return 'bomber';
        if (key === 'chinook') return 'chinook';
        if (key === 'drone_suicide' || key === 'drone_at') return 'recon';

        if (
            key === 'engineer'
            || category === 'armored'
        ) {
            return 'launcher';
        }

        if (
            key === 'drone_operator'
            || key.includes('drone')
            || category === 'air'
            || category === 'drone'
        ) {
            return 'drone';
        }

        if (category === 'infantry') return 'm16';
        return '';
    }

    function svgForType(type, bgColor) {
        switch (type) {
            case 'mbt':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(0, 5)" fill="#000">
<rect x="110" y="88" width="75" height="8" rx="2" />
<rect x="175" y="86" width="10" height="12" rx="1" />
<path d="M 50 100 l 15 -20 h 45 l 20 20 z" />
<rect x="65" y="75" width="15" height="5" />
<line x1="55" y1="100" x2="45" y2="50" stroke="#000" stroke-width="2" />
<path d="M 25 120 l 15 -20 h 110 l 20 20 z" />
<rect x="20" y="120" width="150" height="24" rx="12" />
<g fill="${bgColor}">
<circle cx="35" cy="132" r="7" />
<circle cx="55" cy="132" r="7" />
<circle cx="75" cy="132" r="7" />
<circle cx="95" cy="132" r="7" />
<circle cx="115" cy="132" r="7" />
<circle cx="135" cy="132" r="7" />
<circle cx="155" cy="132" r="7" />
</g>
</g></svg>`;
            case 'aa_tank':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(0, 5)" fill="#000">
<path d="M 25 120 l 15 -20 h 110 l 20 20 z" />
<rect x="20" y="120" width="150" height="24" rx="12" />
<g fill="${bgColor}">
<circle cx="35" cy="132" r="7" />
<circle cx="55" cy="132" r="7" />
<circle cx="75" cy="132" r="7" />
<circle cx="95" cy="132" r="7" />
<circle cx="115" cy="132" r="7" />
<circle cx="135" cy="132" r="7" />
<circle cx="155" cy="132" r="7" />
</g>
<path d="M 60 100 l 10 -25 h 35 l 10 25 z" />
<path d="M 105 75 l 10 -15 a 20 20 0 0 0 -30 -5 z" />
<g transform="rotate(-35 85 90)">
<rect x="80" y="80" width="80" height="6" rx="2" />
<rect x="80" y="92" width="80" height="6" rx="2" />
</g>
</g></svg>`;
            case 'humvee':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(0, 5)" fill="#000">
<path d="M 25 125 l 5 -15 l 15 -15 h 55 l 20 15 h 35 l 15 15 v 10 z" />
<rect x="95" y="85" width="40" height="4" />
<rect x="100" y="75" width="6" height="15" />
<path d="M 50 100 h 40 l 12 10 h -55 z" fill="${bgColor}" />
<circle cx="55" cy="125" r="16" />
<circle cx="145" cy="125" r="16" />
<circle cx="55" cy="125" r="6" fill="${bgColor}" />
<circle cx="145" cy="125" r="6" fill="${bgColor}" />
<rect x="165" y="115" width="10" height="15" rx="2" />
</g></svg>`;
            case 'icbm_tel':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(0, 10)" fill="#000">
<g transform="rotate(-35 45 110)">
<rect x="10" y="90" width="160" height="30" rx="6" />
<rect x="15" y="88" width="20" height="34" />
<path d="M 170 90 l 15 15 l -15 15 z" />
</g>
<line x1="95" y1="120" x2="115" y2="70" stroke="#000" stroke-width="6" stroke-linecap="round" />
<rect x="15" y="115" width="160" height="18" rx="4" />
<path d="M 140 115 v -25 h 25 l 10 25 z" />
<path d="M 150 100 h 15 l 5 10 h -20 z" fill="${bgColor}" />
<circle cx="35" cy="135" r="12" />
<circle cx="65" cy="135" r="12" />
<circle cx="95" cy="135" r="12" />
<circle cx="125" cy="135" r="12" />
<circle cx="155" cy="135" r="12" />
<circle cx="35" cy="135" r="4" fill="${bgColor}" />
<circle cx="65" cy="135" r="4" fill="${bgColor}" />
<circle cx="95" cy="135" r="4" fill="${bgColor}" />
<circle cx="125" cy="135" r="4" fill="${bgColor}" />
<circle cx="155" cy="135" r="4" fill="${bgColor}" />
</g></svg>`;
            case 'apc':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(0, 5)" fill="#000">
<path d="M 90 95 l 10 -15 h 25 l 10 15 z" />
<rect x="125" y="82" width="45" height="5" rx="1" />
<path d="M 20 125 v -20 l 15 -10 h 95 l 35 20 l 5 10 z" />
<line x1="35" y1="105" x2="155" y2="105" stroke="${bgColor}" stroke-width="2" />
<circle cx="45" cy="125" r="14" />
<circle cx="80" cy="125" r="14" />
<circle cx="115" cy="125" r="14" />
<circle cx="150" cy="125" r="14" />
<circle cx="45" cy="125" r="5" fill="${bgColor}" />
<circle cx="80" cy="125" r="5" fill="${bgColor}" />
<circle cx="115" cy="125" r="5" fill="${bgColor}" />
<circle cx="150" cy="125" r="5" fill="${bgColor}" />
</g></svg>`;
            case 'spg':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(0, 5)" fill="#000">
<g transform="rotate(-15 80 100)">
<rect x="80" y="92" width="105" height="10" rx="2" />
<rect x="175" y="88" width="12" height="18" rx="2" />
<rect x="120" y="90" width="20" height="14" rx="2" />
</g>
<path d="M 25 115 l 10 -30 h 55 l 15 30 z" />
<path d="M 20 135 l 15 -20 h 125 l 15 20 z" />
<path d="M 15 135 l -10 15 h 10 l 5 -15 z" />
<rect x="15" y="135" width="160" height="22" rx="11" />
<g fill="${bgColor}">
<circle cx="30" cy="146" r="6" />
<circle cx="50" cy="146" r="6" />
<circle cx="70" cy="146" r="6" />
<circle cx="90" cy="146" r="6" />
<circle cx="110" cy="146" r="6" />
<circle cx="130" cy="146" r="6" />
<circle cx="150" cy="146" r="6" />
</g>
</g></svg>`;
            case 'apache':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(200, 5) scale(-1, 1)" fill="#000">
<rect x="25" y="60" width="130" height="4" rx="2" />
<rect x="86" y="64" width="8" height="18" />
<path d="M 30 105 C 30 90, 55 82, 80 82 H 115 L 155 92 L 170 85 H 175 V 110 H 170 L 155 105 L 115 105 L 95 115 H 45 C 35 115, 30 110, 30 105 Z" />
<path d="M 45 85 L 80 85 L 80 97 L 40 97 Z" fill="${bgColor}" />
<rect x="165" y="85" width="20" height="4" transform="rotate(45 175 87)" />
<rect x="165" y="85" width="20" height="4" transform="rotate(-45 175 87)" />
<rect x="70" y="105" width="30" height="12" rx="4" fill="${bgColor}" />
<rect x="73" y="108" width="24" height="6" rx="3" fill="#000" />
<path d="M 35 115 v 10 l 12 2" fill="none" stroke="#000" stroke-width="3" />
<circle cx="65" cy="125" r="6" />
<circle cx="125" cy="120" r="5" />
<line x1="65" y1="115" x2="65" y2="125" stroke="#000" stroke-width="4" />
<line x1="125" y1="105" x2="125" y2="120" stroke="#000" stroke-width="4" />
</g></svg>`;
            case 'transport_heli':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(200, 5) scale(-1, 1)" fill="#000">
<rect x="25" y="55" width="150" height="5" rx="2" />
<rect x="95" y="60" width="10" height="16" />
<path d="M 25 110 C 25 85, 45 76, 95 76 H 125 L 165 92 L 180 82 H 185 V 110 H 180 L 165 105 H 125 L 115 115 H 45 C 30 115, 25 110, 25 110 Z" />
<path d="M 35 83 L 55 83 V 98 H 28 C 30 90, 32 85, 35 83 Z" fill="${bgColor}" />
<rect x="70" y="85" width="25" height="20" rx="3" fill="${bgColor}" />
<rect x="73" y="88" width="19" height="14" rx="2" fill="#000" />
<rect x="171" y="78" width="14" height="14" rx="2" />
<circle cx="50" cy="125" r="8" />
<circle cx="110" cy="125" r="10" />
<line x1="50" y1="110" x2="50" y2="125" stroke="#000" stroke-width="4" />
<path d="M 110 115 v 10 M 105 115 l 10 0" stroke="#000" stroke-width="4" fill="none" />
</g></svg>`;
            case 'fighter':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(200, 0) scale(-1, 1) rotate(-15 100 100) translate(0, 10)" fill="#000">
<path d="M 20 100 C 40 95, 70 90, 110 90 L 160 92 V 108 L 110 108 C 70 108, 40 105, 20 100 Z" />
<path d="M 60 92 C 70 78, 95 78, 105 90 Z" />
<path d="M 65 92 C 75 83, 90 83, 100 90 Z" fill="${bgColor}" />
<path d="M 80 108 L 90 115 H 120 L 130 108 Z" />
<path d="M 130 91 L 155 55 H 165 L 155 92 Z" />
<path d="M 90 105 L 130 135 H 150 L 140 105 Z" />
<path d="M 145 105 L 170 120 H 180 L 160 105 Z" />
<path d="M 160 94 H 175 L 180 97 V 103 L 175 106 H 160 Z" />
</g></svg>`;
            case 'recon':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(200, 0) scale(-1, 1) rotate(-10 100 100) translate(0, 10)" fill="#000">
<path d="M 25 100 C 20 85, 50 85, 80 95 L 160 95 C 165 95, 170 98, 170 100 C 170 102, 165 105, 160 105 L 80 105 C 40 115, 25 110, 25 100 Z" />
<path d="M 95 95 C 95 85, 110 85, 120 85 H 145 L 150 95 Z" />
<path d="M 145 95 L 165 70 H 175 L 155 95 Z" />
<path d="M 90 100 L 130 135 H 138 L 110 100 Z" />
<path d="M 45 105 C 50 115, 65 115, 70 103 Z" />
</g></svg>`;
            case 'bomber':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="rotate(90 100 100) translate(0, 5)" fill="#000">
<path d="M 100 40 L 180 110 L 145 125 L 120 100 L 100 120 L 80 100 L 55 125 L 20 110 Z" />
<path d="M 100 60 C 85 75, 85 85, 100 90 C 115 85, 115 75, 100 60 Z" fill="${bgColor}" />
<path d="M 100 65 C 93 75, 93 80, 100 82 C 107 80, 107 75, 100 65 Z" fill="#000" />
<line x1="85" y1="80" x2="65" y2="70" stroke="${bgColor}" stroke-width="2" />
<line x1="115" y1="80" x2="135" y2="70" stroke="${bgColor}" stroke-width="2" />
</g></svg>`;
            case 'chinook':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(200, 10) scale(-1, 1)" fill="#000">
<path d="M 35 105 C 25 95, 35 85, 55 85 H 140 L 160 60 H 175 V 105 L 145 115 H 55 C 40 115, 35 110, 35 105 Z" />
<path d="M 38 92 C 43 88, 48 88, 52 88 V 100 H 35 C 35 96, 36 94, 38 92 Z" fill="${bgColor}" />
<circle cx="65" cy="98" r="4" fill="${bgColor}" />
<circle cx="85" cy="98" r="4" fill="${bgColor}" />
<circle cx="105" cy="98" r="4" fill="${bgColor}" />
<circle cx="125" cy="98" r="4" fill="${bgColor}" />
<rect x="55" y="70" width="8" height="15" />
<rect x="10" y="66" width="100" height="4" rx="2" />
<rect x="160" y="45" width="8" height="15" />
<rect x="110" y="41" width="110" height="4" rx="2" />
<circle cx="50" cy="120" r="7" />
<circle cx="130" cy="120" r="7" />
<circle cx="145" cy="120" r="7" />
<rect x="45" y="107" width="95" height="6" rx="3" fill="${bgColor}" />
<rect x="47" y="108" width="91" height="4" rx="2" fill="#000" />
</g></svg>`;
            case 'm4':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="rotate(-35 100 100) translate(-10, 10)" fill="#000">
<path d="M140 91 h40 v4 h-40 z" />
<path d="M178 89 h8 v8 h-8 z" />
<path d="M140 91 l5 -15 h5 v15 z" />
<path d="M100 87 h40 v12 h-40 z" />
<path d="M70 85 h30 v18 h-30 z" />
<path d="M85 103 v25 c5 5, 12 0, 12 -5 v-20 z" />
<path d="M70 100 l-5 25 h-10 l5 -25 z" />
<path d="M70 88 h-30 l-5 10 v15 h10 v-10 h15 z" />
<path d="M80 85 l5 -12 h20 v12 z" />
<path d="M78 73 h24 v6 h-24 z" />
</g></svg>`;
            case 'drone':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(0, -5)" fill="#000">
<ellipse cx="100" cy="100" rx="20" ry="12" />
<path d="M 85 95 Q 100 80 115 95 Z" />
<rect x="35" y="96" width="130" height="6" rx="3" />
<rect x="35" y="85" width="8" height="12" rx="2" />
<rect x="157" y="85" width="8" height="12" rx="2" />
<path d="M 15 85 Q 39 80 63 85 Z" />
<path d="M 137 85 Q 161 80 185 85 Z" />
<path d="M 90 110 L 75 140 L 60 140" fill="none" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
<path d="M 110 110 L 125 140 L 140 140" fill="none" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
</g></svg>`;
            case 'bagpipe':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="translate(0, -10)" fill="#000">
<path d="M 70 130 C 50 145, 40 105, 75 95 C 100 85, 140 110, 145 135 C 150 160, 90 150, 70 130 Z" />
<path d="M 75 135 L 60 180 L 70 180 L 85 135 Z" />
<line x1="80" y1="100" x2="60" y2="55" stroke="#000" stroke-width="5" stroke-linecap="round"/>
<circle cx="60" cy="55" r="4" />
<path d="M 100 110 L 105 95 L 115 95 L 115 110 Z" />
<path d="M 120 120 L 125 105 L 135 105 L 130 120 Z" />
<path d="M 135 125 L 140 110 L 150 110 L 140 125 Z" />
<rect x="106" y="30" width="6" height="65" />
<rect x="127" y="45" width="5" height="60" />
<rect x="142" y="55" width="5" height="55" />
<path d="M 104 30 h 10 v -10 h -10 z M 106 20 h 6 v -15 h -6 z" />
<path d="M 125 45 h 9 v -8 h -9 z M 127 37 h 5 v -12 h -5 z" />
<path d="M 140 55 h 9 v -8 h -9 z M 142 47 h 5 v -12 h -5 z" />
<path d="M 109 60 Q 119 70 129 65" fill="none" stroke="#000" stroke-width="2" />
<path d="M 129 65 Q 137 75 144 70" fill="none" stroke="#000" stroke-width="2" />
<path d="M 109 60 l -3 20 h 6 z" />
<path d="M 129 65 l -3 20 h 6 z" />
<path d="M 144 70 l -3 20 h 6 z" />
</g></svg>`;
            case 'launcher':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="rotate(-25 100 100) translate(0, 5)" fill="#000">
<rect x="25" y="85" width="150" height="24" rx="2" />
<path d="M 25 85 l -10 -5 v 34 l 10 -5 z" />
<rect x="170" y="82" width="10" height="30" rx="1" />
<rect x="120" y="70" width="20" height="15" />
<path d="M 135 109 l -5 20 h 10 z" />
<path d="M 100 109 l -5 25 h -10 l 5 -25 z" />
<path d="M 60 109 v 20 h 15 v -20 z" />
</g></svg>`;
            case 'm16':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="rotate(-35 100 100) translate(-5, 0)" fill="#000">
<rect x="135" y="90" width="45" height="4" />
<rect x="178" y="89" width="6" height="6" />
<path d="M 135 90 L 140 75 L 145 75 L 145 90 Z" />
<path d="M 90 88 L 135 88 L 135 94 L 90 96 Z" />
<rect x="60" y="86" width="30" height="15" />
<path d="M 65 86 L 70 72 L 95 72 L 100 86 L 90 86 L 85 76 L 75 76 L 70 86 Z" />
<path d="M 75 100 L 75 125 C 80 128, 85 128, 85 125 L 90 100 Z" />
<path d="M 60 100 L 55 125 L 45 125 L 50 100 Z" />
<path d="M 60 88 L 20 88 L 20 110 L 40 105 L 60 100 Z" />
</g></svg>`;
            case 'sniper':
                return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="95" fill="${bgColor}" />
<g transform="rotate(-30 100 100) translate(-5, 5)" fill="#000">
<path d="M 115 88 h 60 v 4 h -60 z" />
<path d="M 175 86 h 10 v 8 h -10 z" />
<path d="M 65 85 h 50 v 14 h -50 z" />
<path d="M 75 70 h 40 v 6 h -40 z" />
<path d="M 75 70 l -5 -4 v 14 l 5 -4 z" />
<path d="M 115 70 l 5 -6 v 18 l -5 -6 z" />
<path d="M 85 99 h 15 v 18 h -15 z" />
<path d="M 65 85 L 20 85 L 15 110 L 45 115 L 65 100 Z" />
<path d="M 40 92 Q 52 92 52 105 Q 40 105 40 92 Z" fill="${bgColor}" />
<rect x="25" y="81" width="25" height="4" rx="2" />
<line x1="140" y1="92" x2="130" y2="120" stroke="#000" stroke-width="4" stroke-linecap="round" />
<line x1="145" y1="92" x2="155" y2="120" stroke="#000" stroke-width="4" stroke-linecap="round" />
</g></svg>`;
            default:
                return '';
        }
    }

    function getDataUrl(unitKey, unitDef, opts = {}) {
        const type = resolveIconType(unitKey, unitDef);
        if (!type) return '';

        const bgColor = sanitizeColor(opts.bgColor || DEFAULT_BG_COLOR);
        const cacheKey = `${type}|${bgColor}`;
        if (Object.prototype.hasOwnProperty.call(dataUrlCache, cacheKey)) {
            return dataUrlCache[cacheKey];
        }

        const svg = svgForType(type, bgColor);
        if (!svg) {
            dataUrlCache[cacheKey] = '';
            return '';
        }

        const encoded = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
        dataUrlCache[cacheKey] = encoded;
        return encoded;
    }

    function drawToCanvas(ctx, unitKey, unitDef, opts = {}) {
        if (!ctx || typeof ctx.drawImage !== 'function' || !ctx.canvas) return false;
        const dataUrl = getDataUrl(unitKey, unitDef, opts);
        if (!dataUrl) return false;

        const w = Number(ctx.canvas.width) || 64;
        const h = Number(ctx.canvas.height) || 48;
        const padX = Number.isFinite(Number(opts.padX)) ? Number(opts.padX) : 2;
        const padY = Number.isFinite(Number(opts.padY)) ? Number(opts.padY) : 2;

        const drawPlaceholder = () => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#2f5f18';
            ctx.beginPath();
            const r = Math.max(8, Math.min(w, h) * 0.4);
            ctx.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2);
            ctx.fill();
        };

        const drawImg = (img) => {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(
                img,
                padX,
                padY,
                Math.max(1, w - (padX * 2)),
                Math.max(1, h - (padY * 2))
            );
        };

        const img = new Image();
        img.onload = () => drawImg(img);
        img.onerror = () => drawPlaceholder();
        img.src = dataUrl;

        if (img.complete && img.naturalWidth > 0) {
            drawImg(img);
        } else {
            drawPlaceholder();
        }
        return true;
    }

    window.UnitProfileIcons = {
        DEFAULT_BG_COLOR,
        resolveIconType,
        getDataUrl,
        drawToCanvas
    };
})();
