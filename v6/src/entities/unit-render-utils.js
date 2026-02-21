// Shared rendering helpers for Unit feet snap and skin-layer drawing.
(function attachUnitRenderUtils(globalScope) {
    'use strict';

    const FEET_Y_FALLBACK = {
        worker: 0,
        infantry: 0,
        sniper: 0,
        engineer: 0,
        rpg: 0,
        special_ops: 0,
        drone_operator: 0,
        humvee: 36, // Slightly reduced after humvee model scale down.
        apc: 26,    // Slightly larger APC model/height requires a bit more snap.
        mbt: 24,    // Tracked hull bottom (y=15) * current V2 battle scale ~= 24.
        spg: 24,    // Same tracked baseline with current V2 battle scale.
        aa_tank: 18, // V2 aa_tank track bottom (y=15) * current battle world scale ~= 18.
        icbm: 4,
        icbm_enemy: 4
    };

    function shouldFeetSnap(unit) {
        if (!unit) return false;
        if (unit.disableFeetSnap) return false;
        if (unit.lobbyPreview) return false;
        const stats = unit.stats || {};
        if (stats.type === 'air' || stats.category === 'air') return false;
        if (stats.type === 'skill' || stats.category === 'special') return false;
        return true;
    }

    function getFeetYFromSkin(skin) {
        if (!skin || !Array.isArray(skin.layers) || skin.layers.length === 0) return null;
        const scaleRaw = Number(skin.scale);
        const scale = Number.isFinite(scaleRaw) ? scaleRaw : 1;
        const anchor = (skin.anchor && typeof skin.anchor === 'object') ? skin.anchor : null;
        const ay = anchor && Number.isFinite(Number(anchor.y)) ? Number(anchor.y) : 0;

        const TAU = Math.PI * 2;
        const norm = (angle) => {
            const n = Number(angle);
            if (!Number.isFinite(n)) return null;
            let v = n % TAU;
            if (v < 0) v += TAU;
            return v;
        };
        const arcIncludes = (angle, start, end, ccw) => {
            const a = norm(angle);
            const s0 = norm(start);
            const e0 = norm(end);
            if (a === null || s0 === null || e0 === null) return false;
            if (ccw) {
                if (s0 <= e0) return a >= s0 && a <= e0;
                return a >= s0 || a <= e0;
            }
            if (e0 <= s0) return a >= e0 && a <= s0;
            return a >= e0 || a <= s0;
        };
        const arcMaxY = (cx, cy, r, start, end, ccw) => {
            if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= 0) return null;
            if (!Number.isFinite(start) || !Number.isFinite(end)) return cy + r;
            const angles = [start, end];
            const down = Math.PI / 2;
            if (arcIncludes(down, start, end, ccw)) angles.push(down);
            let maxY = -Infinity;
            for (const angle of angles) {
                const y = cy + r * Math.sin(angle);
                if (Number.isFinite(y)) maxY = Math.max(maxY, y);
            }
            return Number.isFinite(maxY) ? maxY : null;
        };

        let maxY = -Infinity;
        for (const layer of skin.layers) {
            if (!layer || typeof layer !== 'object') continue;
            const shape = (typeof layer.shape === 'string' && layer.shape) ? layer.shape : null;
            if (shape === 'circle') {
                const cy = Number(layer.cy);
                const r = Number(layer.r);
                if (Number.isFinite(cy) && Number.isFinite(r)) maxY = Math.max(maxY, cy + r);
                continue;
            }
            if (shape === 'arc') {
                const cy = Number(layer.cy);
                const r = Number(layer.r);
                const start = Number(layer.start);
                const end = Number(layer.end);
                const y = arcMaxY(Number(layer.cx), cy, r, start, end, !!layer.ccw);
                if (Number.isFinite(y)) maxY = Math.max(maxY, y);
                continue;
            }
            if (Array.isArray(layer.points) && layer.points.length) {
                for (const point of layer.points) {
                    const y = Number(point && point.y);
                    if (Number.isFinite(y)) maxY = Math.max(maxY, y);
                }
            }
        }

        if (!Number.isFinite(maxY)) return null;
        return (maxY + ay) * scale;
    }

    function getFeetYFromHardcoded(unit) {
        const id = unit && unit.stats ? unit.stats.id : null;
        if (id && Object.prototype.hasOwnProperty.call(FEET_Y_FALLBACK, id)) {
            return FEET_Y_FALLBACK[id];
        }
        return 0;
    }

    function getFeetYForRender(unit, skin) {
        const fromSkin = getFeetYFromSkin(skin);
        if (Number.isFinite(fromSkin)) return fromSkin;
        return getFeetYFromHardcoded(unit);
    }

    function computeFeetSnapDy(unit, skin) {
        if (!shouldFeetSnap(unit)) return 0;
        if (typeof game === 'undefined' || !Number.isFinite(game.groundY)) return 0;
        const floorY = game.groundY;
        if (!Number.isFinite(unit.y)) return 0;
        if (Math.abs(unit.y - floorY) > 120) return 0;
        const feetY = getFeetYForRender(unit, skin);
        if (!Number.isFinite(feetY)) return 0;
        return floorY - (unit.y + feetY);
    }

    function renderSkinLayers(unit, ctx, skin) {
        if (!unit || !ctx) return false;
        if (!skin || !Array.isArray(skin.layers) || skin.layers.length === 0) return false;

        if (unit.stats && unit.stats.id !== 'drone_at') {
            ctx.scale(unit.facing || 1, 1);
        }

        const scale = Number(skin.scale);
        const s = Number.isFinite(scale) ? scale : 1;
        const anchor = (skin.anchor && typeof skin.anchor === 'object') ? skin.anchor : null;
        const ax = anchor && Number.isFinite(Number(anchor.x)) ? Number(anchor.x) : 0;
        const ay = anchor && Number.isFinite(Number(anchor.y)) ? Number(anchor.y) : 0;

        ctx.scale(s, s);
        ctx.translate(ax, ay);

        skin.layers.forEach((layer) => {
            if (!layer || typeof layer !== 'object') return;
            const shape = (typeof layer.shape === 'string' && layer.shape) ? layer.shape : null;
            const hasPoints = Array.isArray(layer.points) && layer.points.length >= 2;
            if (!shape && !hasPoints) return;

            const color = (typeof layer.color === 'string' && layer.color)
                ? layer.color
                : ((unit.stats && unit.stats.color) || '#3b82f6');
            ctx.fillStyle = color;
            ctx.beginPath();

            if (shape === 'circle') {
                const cx = Number(layer.cx);
                const cy = Number(layer.cy);
                const r = Number(layer.r);
                if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= 0) return;
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.closePath();
            } else if (shape === 'arc') {
                const cx = Number(layer.cx);
                const cy = Number(layer.cy);
                const r = Number(layer.r);
                const start = Number(layer.start);
                const end = Number(layer.end);
                if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= 0) return;
                if (!Number.isFinite(start) || !Number.isFinite(end)) return;
                const ccw = !!layer.ccw;
                ctx.arc(cx, cy, r, start, end, ccw);
                if (layer.closed !== false) {
                    ctx.lineTo(cx, cy);
                    ctx.closePath();
                }
            } else if (hasPoints) {
                const points = layer.points;
                const n = points.length;

                if (layer.curve === 'smooth' && n >= 3) {
                    ctx.moveTo(points[0].x, points[0].y);
                    for (let i = 0; i < n; i++) {
                        const p0 = points[(i - 1 + n) % n];
                        const p1 = points[i];
                        const p2 = points[(i + 1) % n];
                        const p3 = points[(i + 2) % n];

                        const cp1x = p1.x + (p2.x - p0.x) / 6;
                        const cp1y = p1.y + (p2.y - p0.y) / 6;
                        const cp2x = p2.x - (p3.x - p1.x) / 6;
                        const cp2y = p2.y - (p3.y - p1.y) / 6;

                        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                    }
                } else {
                    ctx.moveTo(points[0].x, points[0].y);
                    for (let i = 1; i < n; i++) {
                        ctx.lineTo(points[i].x, points[i].y);
                    }
                }

                ctx.closePath();
            } else {
                return;
            }

            ctx.fill();
        });

        return true;
    }

    function drawUnitHpBar(unit, ctx, snapDy, showHp) {
        if (!unit || !ctx || !showHp) return;
        const hpPct = Math.max(0, unit.hp / unit.maxHp);
        const w = 24;
        const h = 4;
        const yOffset = -50;
        const barX = unit.x;
        const barY = (unit.y + snapDy) + yOffset;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(barX - w / 2, barY, w, h);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(barX - w / 2, barY, w * hpPct, h);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX - w / 2, barY, w, h);
    }

    function getUnitIconProfile(unitKey, unitDef, options) {
        const key = String(unitKey || '').trim();
        const def = unitDef || {};
        const opts = options || {};

        const centerX = Number.isFinite(Number(opts.centerX)) ? Number(opts.centerX) : 32;
        const bottomY = Number.isFinite(Number(opts.bottomY)) ? Number(opts.bottomY) : 44;
        let scale = Number.isFinite(Number(opts.baseScale)) ? Number(opts.baseScale) : 0.8;
        let offsetY = Number.isFinite(Number(opts.baseOffsetY)) ? Number(opts.baseOffsetY) : 0;

        if (key === 'drone_suicide') {
            scale = 1.02;
            offsetY = -4;
        } else if (key === 'drone_at') {
            scale = 0.96;
            offsetY = -4;
        } else if (key === 'blackhawk' || key === 'chinook') {
            scale = 0.35;
            offsetY = -15;
        } else if (key === 'bomber') {
            scale = 0.30;
            offsetY = -10;
        } else if (key === 'apache' || key === 'fighter') {
            scale = 0.45;
            offsetY = -12;
        } else if (key === 'humvee') {
            scale = 0.60;
            offsetY = -14;
        } else if (key === 'apc' || key === 'aa_tank') {
            scale = 0.56;
            offsetY = -10;
        } else if (key === 'mbt' || key === 'spg') {
            scale = 0.52;
            offsetY = -10;
        } else if (key === 'icbm' || key === 'icbm_enemy') {
            scale = 0.34;
            offsetY = -8;
        } else if (key === 'emp' || key === 'nuke' || key === 'tactical_missile') {
            scale = 0.70;
            offsetY = -8;
        } else if ((Number(def.width) || 0) > 60) {
            scale = 0.46;
            offsetY = -5;
        } else if ((Number(def.width) || 0) > 40) {
            scale = 0.55;
            offsetY = -3;
        } else if (def.type === 'air') {
            scale = 0.60;
            offsetY = -8;
        }

        return { centerX, bottomY, scale, offsetY };
    }

    function drawUnitIconToCanvas(ctx, unitKey, unitDef, options) {
        if (!ctx) return false;
        const key = String(unitKey || '').trim();
        if (!key) return false;
        const def = unitDef || {};
        const opts = options || {};
        const profile = getUnitIconProfile(key, def, opts);

        let drew = false;
        try {
            ctx.save();
            ctx.translate(profile.centerX, profile.bottomY + profile.offsetY);
            ctx.scale(profile.scale, profile.scale);

            const registry = (typeof globalScope !== 'undefined' && globalScope && globalScope.UnitRenderV2Registry)
                ? globalScope.UnitRenderV2Registry
                : null;
            const renderer = registry && registry[key];
            if (renderer && typeof renderer.drawIcon === 'function') {
                drew = (renderer.drawIcon(ctx, { iconScale: 1 }) === true);
            }

            if (!drew && typeof Unit !== 'undefined') {
                const dummy = new Unit(key, 0, 0, 'player');
                dummy.hideHp = true;
                dummy.disableFeetSnap = true;
                dummy.iconRenderBackTurret = true;
                if (dummy.stats && dummy.stats.type === 'air') dummy.y = 0;
                dummy.draw(ctx);
                drew = true;
            }
            ctx.restore();
        } catch (_) {
            try { ctx.restore(); } catch (_) { }
            drew = false;
        }

        if (!drew && opts.drawFallback !== false) {
            const w = Math.max(10, Math.min(50, Math.round((Number(def.width) || 30) * 0.9)));
            const h = Math.max(6, Math.min(26, Math.round((Number(def.height) || 16) * 0.9)));
            ctx.fillStyle = def.color || '#38bdf8';
            ctx.globalAlpha = 0.9;
            ctx.fillRect((60 - w) / 2, (40 - h) / 2 + 6, w, h);
            ctx.globalAlpha = 1;
            return true;
        }

        return drew;
    }

    globalScope.UnitRenderUtils = {
        shouldFeetSnap,
        getFeetYFromSkin,
        getFeetYFromHardcoded,
        getFeetYForRender,
        computeFeetSnapDy,
        renderSkinLayers,
        drawUnitHpBar,
        getUnitIconProfile,
        drawUnitIconToCanvas
    };
})(typeof window !== 'undefined' ? window : globalThis);
