(() => {
    'use strict';

    const STORAGE_KEY = 'reclaim_ui_layout_v1';
    const TARGET_IDS = [
        'hud-production-area',
        'hud-right',
        'hud-top-actions',
        'hud-timer-container',
        'unit-info-panel',
        'mobile-direct-ui',
        'mobile-direct-toggle-btn'
    ];
    const MAX_ABS_PX = 20000;

    function asNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function clampPx(value) {
        return Math.max(-MAX_ABS_PX, Math.min(MAX_ABS_PX, value));
    }

    function sanitizePx(value) {
        const n = asNumber(value);
        if (n === null) return '';
        return `${Math.round(clampPx(n))}px`;
    }

    function sanitizeSize(value) {
        const n = asNumber(value);
        if (n === null) return '';
        return `${Math.max(0, Math.round(clampPx(n)))}px`;
    }

    function sanitizeZIndex(value) {
        const n = asNumber(value);
        if (n === null) return '';
        return String(Math.max(-9999, Math.min(9999, Math.round(n))));
    }

    function sanitizeItem(raw) {
        const item = (raw && typeof raw === 'object') ? raw : {};
        const position = (item.position === 'absolute') ? 'absolute' : 'fixed';
        return {
            position,
            top: sanitizePx(item.top),
            left: sanitizePx(item.left),
            right: sanitizePx(item.right),
            bottom: sanitizePx(item.bottom),
            width: sanitizeSize(item.width),
            height: sanitizeSize(item.height),
            zIndex: sanitizeZIndex(item.zIndex)
        };
    }

    function sanitizePreset(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const srcItems = (raw.items && typeof raw.items === 'object') ? raw.items : {};
        const outItems = {};
        Object.keys(srcItems).forEach((id) => {
            if (!id || typeof id !== 'string' || id.length > 120) return;
            outItems[id] = sanitizeItem(srcItems[id]);
        });
        return {
            version: 1,
            updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
            items: outItems
        };
    }

    function readPreset() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return sanitizePreset(parsed);
        } catch (_err) {
            return null;
        }
    }

    function writePreset(preset) {
        const safe = sanitizePreset(preset);
        if (!safe) return false;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
            return true;
        } catch (_err) {
            return false;
        }
    }

    function applyStyleValue(style, key, value) {
        if (typeof value !== 'string') {
            style[key] = '';
            return;
        }
        style[key] = value || '';
    }

    function applyItemToElement(el, item) {
        if (!el || !item) return;
        el.style.position = item.position || 'fixed';
        applyStyleValue(el.style, 'top', item.top);
        applyStyleValue(el.style, 'left', item.left);
        applyStyleValue(el.style, 'right', item.right);
        applyStyleValue(el.style, 'bottom', item.bottom);
        applyStyleValue(el.style, 'width', item.width);
        applyStyleValue(el.style, 'height', item.height);
        applyStyleValue(el.style, 'zIndex', item.zIndex);
    }

    function apply(presetInput = null) {
        const preset = sanitizePreset(presetInput || readPreset());
        if (!preset) return false;
        const items = preset.items || {};
        Object.keys(items).forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            applyItemToElement(el, items[id]);
        });
        return true;
    }

    function clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch (_err) {
            return false;
        }
    }

    function exportJSON() {
        const preset = readPreset();
        return preset ? JSON.stringify(preset, null, 2) : '';
    }

    function importJSON(jsonText) {
        try {
            const parsed = JSON.parse(String(jsonText || '{}'));
            const safe = sanitizePreset(parsed);
            if (!safe) return { ok: false, error: 'invalid_preset' };
            if (!writePreset(safe)) return { ok: false, error: 'write_failed' };
            return { ok: true };
        } catch (_err) {
            return { ok: false, error: 'parse_failed' };
        }
    }

    window.UILayoutPreset = {
        STORAGE_KEY,
        TARGET_IDS: TARGET_IDS.slice(),
        read: readPreset,
        write: writePreset,
        apply,
        clear,
        exportJSON,
        importJSON
    };

    document.addEventListener('DOMContentLoaded', () => {
        apply();
    }, { once: true });

    window.addEventListener('load', () => {
        setTimeout(() => apply(), 0);
    }, { once: true });
})();
