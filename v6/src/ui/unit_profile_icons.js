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

        if (
            key === 'engineer'
            || key === 'humvee'
            || key === 'apc'
            || key === 'mbt'
            || key === 'spg'
            || key === 'icbm'
            || key === 'icbm_enemy'
            || key === 'aa_tank'
            || category === 'armored'
        ) {
            return 'launcher';
        }

        if (
            key === 'drone_operator'
            || key.includes('drone')
            || key === 'fighter'
            || key === 'apache'
            || key === 'blackhawk'
            || key === 'chinook'
            || key === 'bomber'
            || key === 'recon'
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
