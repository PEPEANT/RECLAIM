(function (global) {
    const MIN_CITY_LEVEL = 1;
    const MAX_CITY_LEVEL = 19;
    const DEFAULT_EXP_MAX = 100;
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

    function clampLevel(value) {
        return Math.max(MIN_CITY_LEVEL, Math.min(MAX_CITY_LEVEL, Math.floor(Number(value) || MIN_CITY_LEVEL)));
    }

    function getExpRequiredForLevel(level) {
        if (typeof CitySimState !== 'undefined' && CitySimState && typeof CitySimState.getExpRequiredForLevel === 'function') {
            return Math.max(1, Math.floor(Number(CitySimState.getExpRequiredForLevel(level)) || 1));
        }
        const safeLevel = clampLevel(level);
        if (safeLevel >= MAX_CITY_LEVEL) return 1;
        return DEFAULT_EXP_MAX;
    }

    function clampExp(value, expMax) {
        const safeMax = Math.max(1, Math.floor(Number(expMax) || DEFAULT_EXP_MAX));
        return Math.max(0, Math.min(safeMax, Math.floor(Number(value) || 0)));
    }

    function clampHonor(value) {
        return Math.max(0, Math.floor(Number(value) || 0));
    }

    function getLevelBadgePath(level) {
        const safeLevel = clampLevel(level);
        return LEVEL_BADGE_BY_LEVEL[safeLevel] || LEVEL_BADGE_BY_LEVEL[MIN_CITY_LEVEL];
    }

    function clampAmount(value) {
        return Math.max(0, Math.floor(Number(value) || 0));
    }

    function addToCountMap(out, key, value) {
        const k = String(key || '').trim();
        const amount = clampAmount(value);
        if (!k || amount <= 0) return;
        out[k] = clampAmount(out[k]) + amount;
    }

    function normalizeCountMap(rawMap) {
        const src = (rawMap && typeof rawMap === 'object' && !Array.isArray(rawMap)) ? rawMap : {};
        const out = {};
        Object.keys(src).forEach((key) => {
            addToCountMap(out, key, src[key]);
        });
        return out;
    }

    function normalizeChargePayload(cost) {
        const src = (cost && typeof cost === 'object') ? cost : {};
        const itemCosts = normalizeCountMap(src.items);
        const costItemKey = String(src.costItemKey || '').trim();
        const costItemCount = clampAmount(src.costItemCount);
        if (costItemKey && costItemCount > 0) {
            addToCountMap(itemCosts, costItemKey, costItemCount);
        }
        return {
            money: clampAmount(src.costMoney ?? src.money),
            gold: clampAmount(src.costGold ?? src.gold),
            honor: clampAmount(src.costHonor ?? src.honor),
            items: itemCosts
        };
    }

    function normalizeGrantPayload(reward) {
        const src = (reward && typeof reward === 'object') ? reward : {};
        const units = normalizeCountMap(src.units);
        const veteranItems = normalizeCountMap(src.veteranItems);
        const items = normalizeCountMap(src.items);

        const unitKey = String(src.unitKey || '').trim();
        const unitAmount = clampAmount(src.unitAmount ?? src.amount);
        if (unitKey && unitAmount > 0) addToCountMap(units, unitKey, unitAmount);

        const veteranItemKey = String(src.veteranItemKey || '').trim();
        const veteranItemAmount = clampAmount(src.veteranItemAmount ?? src.veteranItemCount);
        if (veteranItemKey && veteranItemAmount > 0) {
            addToCountMap(veteranItems, veteranItemKey, veteranItemAmount);
        }

        const itemKey = String(src.itemKey || '').trim();
        const itemAmount = clampAmount(src.itemAmount ?? src.itemCount);
        if (itemKey && itemAmount > 0) addToCountMap(items, itemKey, itemAmount);

        return {
            money: clampAmount(src.money),
            gold: clampAmount(src.gold),
            honor: clampAmount(src.honor),
            units,
            veteranItems,
            items
        };
    }

    function canCharge(game, cost) {
        if (!game || typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.ensure !== 'function') {
            return false;
        }
        const need = normalizeChargePayload(cost);
        const state = CitySimState.ensure(game);
        const money = clampAmount(state?.res?.money);
        const gold = clampAmount(state?.res?.gold);
        const honor = clampAmount(state?.hud?.honor);
        if (money < need.money) return false;
        if (gold < need.gold) return false;
        if (honor < need.honor) return false;
        const ownedItems = (state?.items && typeof state.items === 'object') ? state.items : {};
        const itemKeys = Object.keys(need.items);
        for (let i = 0; i < itemKeys.length; i += 1) {
            const key = itemKeys[i];
            if (clampAmount(ownedItems[key]) < need.items[key]) return false;
        }
        return true;
    }

    function charge(game, cost, options) {
        if (!canCharge(game, cost)) return false;
        const need = normalizeChargePayload(cost);
        const opts = (options && typeof options === 'object') ? options : {};
        CitySimState.mutate(game, (draft) => {
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
            if (!draft.items || typeof draft.items !== 'object') draft.items = {};

            if (need.money > 0) {
                draft.res.money = Math.max(0, clampAmount(draft.res.money) - need.money);
            }
            if (need.gold > 0) {
                draft.res.gold = Math.max(0, clampAmount(draft.res.gold) - need.gold);
            }
            if (need.honor > 0) {
                draft.hud.honor = Math.max(0, clampAmount(draft.hud.honor) - need.honor);
            }

            Object.keys(need.items).forEach((key) => {
                const required = need.items[key];
                if (required <= 0) return;
                const current = clampAmount(draft.items[key]);
                draft.items[key] = Math.max(0, current - required);
            });
        });

        if (opts.render === true && typeof game.renderCityResources === 'function') game.renderCityResources();
        if (opts.save === true && typeof game.saveCitySimState === 'function') game.saveCitySimState();
        return true;
    }

    function grant(game, reward, options) {
        if (!game || typeof CitySimState === 'undefined' || !CitySimState || typeof CitySimState.mutate !== 'function') {
            return {
                money: 0,
                gold: 0,
                honor: 0,
                units: {},
                veteranItems: {},
                items: {},
                changed: false
            };
        }

        const gain = normalizeGrantPayload(reward);
        const opts = (options && typeof options === 'object') ? options : {};
        const report = {
            money: 0,
            gold: 0,
            honor: 0,
            units: {},
            veteranItems: {},
            items: {},
            changed: false
        };

        CitySimState.mutate(game, (draft) => {
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
            if (!draft.units || typeof draft.units !== 'object') draft.units = {};
            if (!draft.veteranItems || typeof draft.veteranItems !== 'object') draft.veteranItems = {};
            if (!draft.items || typeof draft.items !== 'object') draft.items = {};

            if (gain.money > 0) {
                draft.res.money = clampAmount(draft.res.money) + gain.money;
                report.money = gain.money;
                report.changed = true;
            }
            if (gain.gold > 0) {
                draft.res.gold = clampAmount(draft.res.gold) + gain.gold;
                report.gold = gain.gold;
                report.changed = true;
            }
            if (gain.honor > 0) {
                draft.hud.honor = clampAmount(draft.hud.honor) + gain.honor;
                report.honor = gain.honor;
                report.changed = true;
            }

            Object.keys(gain.units).forEach((key) => {
                const amount = gain.units[key];
                if (amount <= 0) return;
                const current = clampAmount(draft.units[key]);
                let applied = amount;
                if (key === 'nuke' || key === 'icbm') {
                    applied = Math.max(0, Math.min(amount, 2 - current));
                }
                if (applied <= 0) return;
                draft.units[key] = current + applied;
                report.units[key] = applied;
                report.changed = true;
            });

            Object.keys(gain.veteranItems).forEach((key) => {
                const amount = gain.veteranItems[key];
                if (amount <= 0) return;
                const current = clampAmount(draft.veteranItems[key]);
                draft.veteranItems[key] = current + amount;
                report.veteranItems[key] = amount;
                report.changed = true;
            });

            Object.keys(gain.items).forEach((key) => {
                const amount = gain.items[key];
                if (amount <= 0) return;
                const current = clampAmount(draft.items[key]);
                draft.items[key] = current + amount;
                report.items[key] = amount;
                report.changed = true;
            });
        });

        if (opts.render === true && typeof game.renderCityResources === 'function') game.renderCityResources();
        if (opts.save === true && typeof game.saveCitySimState === 'function') game.saveCitySimState();
        return report;
    }

    function canPayCost(game, cost) {
        return canCharge(game, {
            costMoney: Number(cost?.costMoney) || 0
        });
    }

    function payCost(game, cost) {
        return charge(game, {
            costMoney: Number(cost?.costMoney) || 0
        }, {
            render: false,
            save: false
        });
    }

    const TAX_INCOME_INTERVAL_MS = 150_000;
    const INCOME_CONFIG = {
        // 가격순 수익 차등: 집(420) < 가게(560) < 아파트(700) < 회사(1100)
        // 체감이 겹치지 않게 5단위 기준 구간을 분리했다.
        decor: { intervalMs: TAX_INCOME_INTERVAL_MS, min: 5, max: 10, cap: 100 },
        shop_store: { intervalMs: TAX_INCOME_INTERVAL_MS, min: 15, max: 20, cap: 160 },
        apartment_large: { intervalMs: TAX_INCOME_INTERVAL_MS, min: 25, max: 30, cap: 240 },
        house: { intervalMs: TAX_INCOME_INTERVAL_MS, min: 40, max: 50, cap: 380 }
    };
    const TAX_OFFICE_TILE = 'tax_office';
    const TAX_OFFICE_BATCH_FEE_RATE = 0.10;
    const TAX_COLLECTION_MAINTENANCE_RATE = 0.50;
    const TAX_MAINTENANCE_LABOR_SHARE = 1 / 3;
    const TAX_MAINTENANCE_STATE_SHARE = 1 / 3;
    const TAX_MAINTENANCE_MILITARY_SHARE = 1 / 3;
    const TAX_AUTO_COLLECT_COST = 1_000;
    const TAX_AUTO_COLLECT_DURATION_MS = 4 * 60 * 60 * 1000;
    const INCOME_MONEY_STEP = 5;
    const MONEY_STEP = 10;
    const ONLINE_GAP_RESET_MS = 240_000;

    function getIncomeConfig(tile) {
        const key = String(tile || '').trim();
        if (!key) return null;
        return Object.prototype.hasOwnProperty.call(INCOME_CONFIG, key)
            ? INCOME_CONFIG[key]
            : null;
    }

    function rollIncomeAmount(conf) {
        const normalizeMoneyStep = (value, step = MONEY_STEP) => {
            const unit = Math.max(1, Math.floor(Number(step) || 1));
            const n = Math.max(0, Math.floor(Number(value) || 0));
            if (n <= 0) return 0;
            return Math.max(unit, Math.round(n / unit) * unit);
        };

        const min = Math.max(0, Math.floor(Number(conf?.min) || 0));
        const max = Math.max(min, Math.floor(Number(conf?.max) || min));
        const raw = min + Math.floor(Math.random() * ((max - min) + 1));
        return normalizeMoneyStep(raw, INCOME_MONEY_STEP);
    }

    function tickIncome(game) {
        let changed = false;
        const now = Date.now();

        CitySimState.mutate(game, (draft) => {
            if (!Array.isArray(draft.grid)) draft.grid = [];
            if (!draft.incomeSlots || typeof draft.incomeSlots !== 'object') draft.incomeSlots = {};

            const incomeSlots = draft.incomeSlots;
            const liveIndexSet = new Set();
            const grid = draft.grid;

            for (let index = 0; index < grid.length; index += 1) {
                const tile = grid[index];
                const conf = getIncomeConfig(tile);
                if (!conf) continue;

                const key = String(index);
                liveIndexSet.add(key);
                const current = incomeSlots[key];
                const slot = (current && typeof current === 'object' && !Array.isArray(current))
                    ? current
                    : { stored: 0, lastAt: now };

                let stored = Math.max(0, Math.floor(Number(slot.stored) || 0));
                let lastAt = Math.max(0, Math.floor(Number(slot.lastAt) || 0));
                if (lastAt <= 0 || lastAt > now) lastAt = now;

                const intervalMs = Math.max(1_000, Math.floor(Number(conf.intervalMs) || 60_000));
                const maxStored = Math.max(0, Math.floor(Number(conf.cap) || 0));
                const elapsed = Math.max(0, now - lastAt);

                // A안: 온라인 실행 중에만 적립. 긴 공백은 오프라인으로 간주하고 누적하지 않는다.
                if (elapsed >= Math.max(ONLINE_GAP_RESET_MS, intervalMs * 2)) {
                    if (!current || lastAt !== slot.lastAt) {
                        incomeSlots[key] = { stored, lastAt: now };
                    } else {
                        slot.lastAt = now;
                    }
                    continue;
                }

                const cycles = Math.floor(elapsed / intervalMs);
                if (cycles <= 0) {
                    if (!current) incomeSlots[key] = { stored, lastAt };
                    continue;
                }

                let nextStored = stored;
                for (let i = 0; i < cycles; i += 1) {
                    if (nextStored >= maxStored) break;
                    nextStored = Math.min(maxStored, nextStored + rollIncomeAmount(conf));
                }
                const nextLastAt = lastAt + (cycles * intervalMs);

                if (!current || nextStored !== stored || nextLastAt !== lastAt) {
                    incomeSlots[key] = { stored: nextStored, lastAt: nextLastAt };
                }
                if (nextStored !== stored) changed = true;
            }

            Object.keys(incomeSlots).forEach((rawIndex) => {
                if (liveIndexSet.has(String(rawIndex))) return;
                const prevStored = Math.max(0, Math.floor(Number(incomeSlots[rawIndex]?.stored) || 0));
                delete incomeSlots[rawIndex];
                if (prevStored > 0) changed = true;
            });
        });

        return changed;
    }

    function getIncomeStatus(game, index, tileOverride) {
        const state = CitySimState.ensure(game);
        const cellIndex = Number(index);
        if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= state.grid.length) return null;

        const tile = String(tileOverride || state.grid[cellIndex] || '').trim();
        const conf = getIncomeConfig(tile);
        if (!conf) return null;

        const intervalMs = Math.max(1_000, Math.floor(Number(conf.intervalMs) || 60_000));
        const maxStored = Math.max(0, Math.floor(Number(conf.cap) || 0));
        const now = Date.now();
        const rawSlot = (state.incomeSlots && typeof state.incomeSlots === 'object')
            ? state.incomeSlots[cellIndex]
            : null;

        const slot = (rawSlot && typeof rawSlot === 'object' && !Array.isArray(rawSlot))
            ? rawSlot
            : { stored: 0, lastAt: now };
        const stored = Math.max(0, Math.floor(Number(slot.stored) || 0));
        let lastAt = Math.max(0, Math.floor(Number(slot.lastAt) || 0));
        if (lastAt <= 0 || lastAt > now) lastAt = now;

        const elapsed = Math.max(0, now - lastAt);
        const offlineGapMs = Math.max(ONLINE_GAP_RESET_MS, intervalMs * 2);
        const offlineGap = elapsed >= offlineGapMs;

        let remainMs = intervalMs;
        if (maxStored > 0 && stored >= maxStored) {
            remainMs = 0;
        } else if (!offlineGap) {
            const progress = elapsed % intervalMs;
            remainMs = progress <= 0 ? intervalMs : (intervalMs - progress);
        }

        return {
            tile,
            intervalMs,
            min: Math.max(0, Math.floor(Number(conf.min) || 0)),
            max: Math.max(0, Math.floor(Number(conf.max) || 0)),
            cap: maxStored,
            stored,
            claimable: stored > 0,
            remainMs: Math.max(0, Math.floor(remainMs)),
            nextAt: now + Math.max(0, Math.floor(remainMs)),
            isCapped: maxStored > 0 && stored >= maxStored,
            offlineGap
        };
    }

    function hasTaxOffice(state) {
        const grid = Array.isArray(state?.grid) ? state.grid : [];
        return grid.some((tile) => String(tile || '').trim() === TAX_OFFICE_TILE);
    }

    function computeTaxCollectionPenalty(baseAmount) {
        const base = Math.max(0, Math.floor(Number(baseAmount) || 0));
        const maintenance = Math.min(base, Math.floor(base * TAX_COLLECTION_MAINTENANCE_RATE));
        const labor = Math.floor(maintenance * TAX_MAINTENANCE_LABOR_SHARE);
        const stateKeep = Math.floor(maintenance * TAX_MAINTENANCE_STATE_SHARE);
        const military = Math.max(0, maintenance - labor - stateKeep);
        const net = Math.max(0, base - maintenance);
        return {
            base,
            maintenance,
            labor,
            state: stateKeep,
            military,
            net
        };
    }

    function normalizeTaxAutoState(rawState) {
        const untilMs = Math.max(0, Math.floor(Number(rawState?.untilMs) || 0));
        return { untilMs };
    }

    function ensureTaxAutoState(draft) {
        if (!draft.taxAuto || typeof draft.taxAuto !== 'object' || Array.isArray(draft.taxAuto)) {
            draft.taxAuto = normalizeTaxAutoState(null);
            return draft.taxAuto;
        }
        const normalized = normalizeTaxAutoState(draft.taxAuto);
        draft.taxAuto.untilMs = normalized.untilMs;
        return draft.taxAuto;
    }

    function getAutoTaxStatusFromState(state) {
        const now = Date.now();
        const normalized = normalizeTaxAutoState(state?.taxAuto);
        const remainMs = Math.max(0, normalized.untilMs - now);
        return {
            hasTaxOffice: hasTaxOffice(state),
            active: remainMs > 0,
            remainMs,
            untilMs: normalized.untilMs,
            cost: TAX_AUTO_COLLECT_COST,
            durationMs: TAX_AUTO_COLLECT_DURATION_MS,
            durationHours: Math.floor(TAX_AUTO_COLLECT_DURATION_MS / (60 * 60 * 1000))
        };
    }

    function getAutoTaxStatus(game) {
        const state = CitySimState.ensure(game);
        return getAutoTaxStatusFromState(state);
    }

    function formatDurationClock(ms) {
        const totalSec = Math.max(0, Math.ceil(Number(ms) / 1000));
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function tickAutoTaxCollect(game) {
        let changed = false;
        const now = Date.now();

        CitySimState.mutate(game, (draft) => {
            if (!Array.isArray(draft.grid)) draft.grid = [];
            if (!draft.incomeSlots || typeof draft.incomeSlots !== 'object') draft.incomeSlots = {};
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};

            const taxAuto = ensureTaxAutoState(draft);
            const untilMs = taxAuto.untilMs;
            if (untilMs <= 0) return;

            const hasOffice = hasTaxOffice(draft);
            const collectUntil = Math.min(now, untilMs);
            let collectedTotal = 0;

            if (hasOffice && collectUntil > 0) {
                const grid = draft.grid;
                const incomeSlots = draft.incomeSlots;
                for (let index = 0; index < grid.length; index += 1) {
                    const conf = getIncomeConfig(grid[index]);
                    if (!conf) continue;

                    const key = String(index);
                    const current = incomeSlots[key];
                    const slot = (current && typeof current === 'object' && !Array.isArray(current))
                        ? current
                        : { stored: 0, lastAt: collectUntil };

                    const stored = Math.max(0, Math.floor(Number(slot.stored) || 0));
                    let lastAt = Math.max(0, Math.floor(Number(slot.lastAt) || 0));
                    if (lastAt <= 0 || lastAt > collectUntil) lastAt = collectUntil;

                    const intervalMs = Math.max(1_000, Math.floor(Number(conf.intervalMs) || 60_000));
                    const elapsed = Math.max(0, collectUntil - lastAt);
                    const cycles = Math.floor(elapsed / intervalMs);

                    let generated = 0;
                    for (let i = 0; i < cycles; i += 1) {
                        generated += rollIncomeAmount(conf);
                    }

                    const nextLastAt = lastAt + (cycles * intervalMs);
                    const cycleIncome = stored + generated;
                    if (cycleIncome > 0) collectedTotal += cycleIncome;

                    if (!current || stored > 0 || generated > 0 || nextLastAt !== lastAt) {
                        incomeSlots[key] = { stored: 0, lastAt: nextLastAt };
                    }
                }
            }

            if (collectedTotal > 0) {
                const penalty = computeTaxCollectionPenalty(collectedTotal);
                draft.res.money = Math.max(0, Number(draft.res.money) || 0) + penalty.net;
                draft.hud.netMoney = penalty.net;
                changed = true;
            }

            if (now >= untilMs) {
                taxAuto.untilMs = 0;
                changed = true;
            }
        });

        return changed;
    }

    function getBatchIncomeStatusFromState(state) {
        const grid = Array.isArray(state?.grid) ? state.grid : [];
        const incomeSlots = (state?.incomeSlots && typeof state.incomeSlots === 'object')
            ? state.incomeSlots
            : {};

        const feeRate = Math.max(0, Math.min(0.95, Number(TAX_OFFICE_BATCH_FEE_RATE) || 0));
        let gross = 0;
        let claimableCount = 0;
        const claimIndexes = [];

        Object.keys(incomeSlots).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= grid.length) return;
            const conf = getIncomeConfig(grid[index]);
            if (!conf) return;
            const stored = Math.max(0, Math.floor(Number(incomeSlots[rawIndex]?.stored) || 0));
            if (stored <= 0) return;
            gross += stored;
            claimableCount += 1;
            claimIndexes.push(index);
        });

        const fee = Math.min(gross, Math.max(0, Math.round((gross * feeRate) / MONEY_STEP) * MONEY_STEP));
        const afterFee = Math.max(0, gross - fee);
        const penalty = computeTaxCollectionPenalty(afterFee);
        return {
            hasTaxOffice: hasTaxOffice(state),
            feeRate,
            feeRatePercent: Math.round(feeRate * 100),
            maintenanceRate: TAX_COLLECTION_MAINTENANCE_RATE,
            maintenanceRatePercent: Math.round(TAX_COLLECTION_MAINTENANCE_RATE * 100),
            claimableCount,
            gross,
            fee,
            afterFee,
            maintenance: penalty.maintenance,
            maintenanceLabor: penalty.labor,
            maintenanceState: penalty.state,
            maintenanceMilitary: penalty.military,
            net: penalty.net,
            claimIndexes
        };
    }

    function getBatchIncomeStatus(game) {
        const state = CitySimState.ensure(game);
        return getBatchIncomeStatusFromState(state);
    }

    function claimAllIncome(game) {
        const initial = getBatchIncomeStatus(game);
        if (!initial.hasTaxOffice) {
            showToast('세무소 건설 후 사용할 수 있습니다.');
            return { ok: false, reason: 'no_tax_office', ...initial };
        }
        if (initial.gross <= 0 || initial.claimableCount <= 0) {
            showToast('일괄 수금할 세금이 없습니다.');
            return { ok: false, reason: 'empty', ...initial };
        }

        let applied = null;
        const now = Date.now();
        CitySimState.mutate(game, (draft) => {
            const live = getBatchIncomeStatusFromState(draft);
            if (!live.hasTaxOffice || live.gross <= 0 || live.claimableCount <= 0) return;
            if (!draft.incomeSlots || typeof draft.incomeSlots !== 'object') draft.incomeSlots = {};
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};

            live.claimIndexes.forEach((idx) => {
                const slot = draft.incomeSlots[idx];
                if (!slot || typeof slot !== 'object') return;
                slot.stored = 0;
                slot.lastAt = now;
            });

            draft.res.money = Math.max(0, Number(draft.res.money) || 0) + live.net;
            draft.hud.netMoney = live.net;
            applied = live;
        });

        if (!applied || applied.net <= 0) {
            showToast('일괄 수금할 세금이 없습니다.');
            return { ok: false, reason: 'empty_after_sync', ...initial };
        }

        if (typeof game.renderCityResources === 'function') game.renderCityResources();
        if (typeof game.renderCityGrid === 'function') game.renderCityGrid();
        if (typeof game.saveCitySimState === 'function') game.saveCitySimState();
        showToast(`일괄 수금 +${formatMoney(applied.net)} (수수료 ${applied.feeRatePercent}% -${formatMoney(applied.fee)}, 유지비 ${applied.maintenanceRatePercent}% -${formatMoney(applied.maintenance)})`);
        return { ok: true, ...applied };
    }

    function activateAutoTaxCollect(game) {
        const state = CitySimState.ensure(game);
        if (!hasTaxOffice(state)) {
            showToast('세무소 건설 후 사용할 수 있습니다.');
            return { ok: false, reason: 'no_tax_office' };
        }

        const cost = Math.max(0, Math.floor(Number(TAX_AUTO_COLLECT_COST) || 0));
        const money = Math.max(0, Math.floor(Number(state.res?.money) || 0));
        if (money < cost) {
            showToast(`자금이 부족합니다. (${formatMoney(cost)} 필요)`);
            return { ok: false, reason: 'not_enough_money', need: cost, money };
        }

        const before = getAutoTaxStatusFromState(state);
        const now = Date.now();
        let applied = null;

        CitySimState.mutate(game, (draft) => {
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
            if (!draft.incomeSlots || typeof draft.incomeSlots !== 'object') draft.incomeSlots = {};
            if (!Array.isArray(draft.grid)) draft.grid = [];

            const taxAuto = ensureTaxAutoState(draft);
            const currentMoney = Math.max(0, Math.floor(Number(draft.res.money) || 0));
            if (currentMoney < cost) return;

            let immediateCollected = 0;
            for (let index = 0; index < draft.grid.length; index += 1) {
                const conf = getIncomeConfig(draft.grid[index]);
                if (!conf) continue;
                const key = String(index);
                const rawSlot = draft.incomeSlots[key];
                const slot = (rawSlot && typeof rawSlot === 'object' && !Array.isArray(rawSlot))
                    ? rawSlot
                    : { stored: 0, lastAt: now };
                const stored = Math.max(0, Math.floor(Number(slot.stored) || 0));
                if (stored > 0) immediateCollected += stored;
                draft.incomeSlots[key] = { stored: 0, lastAt: now };
            }
            const immediatePenalty = computeTaxCollectionPenalty(immediateCollected);

            const baseUntil = Math.max(now, Math.floor(Number(taxAuto.untilMs) || 0));
            const nextUntil = baseUntil + TAX_AUTO_COLLECT_DURATION_MS;

            draft.res.money = currentMoney - cost + immediatePenalty.net;
            draft.hud.netMoney = immediatePenalty.net - cost;
            taxAuto.untilMs = nextUntil;

            applied = {
                untilMs: nextUntil,
                cost,
                immediateCollected,
                immediateMaintenance: immediatePenalty.maintenance,
                immediateNet: immediatePenalty.net
            };
        });

        if (!applied) {
            showToast(`자금이 부족합니다. (${formatMoney(cost)} 필요)`);
            return { ok: false, reason: 'not_enough_money_after_sync', need: cost };
        }

        if (typeof game.renderCityResources === 'function') game.renderCityResources();
        if (typeof game.renderCityGrid === 'function') game.renderCityGrid();
        if (typeof game.saveCitySimState === 'function') game.saveCitySimState();

        const actionLabel = before.active ? '연장' : '시작';
        const hours = Math.floor(TAX_AUTO_COLLECT_DURATION_MS / (60 * 60 * 1000));
        let msg = `자동수금 ${hours}시간 ${actionLabel} (-${formatMoney(cost)})`;
        if (applied.immediateCollected > 0 || applied.immediateMaintenance > 0) {
            msg += ` · 즉시 수금 +${formatMoney(applied.immediateNet)} (유지비 -${formatMoney(applied.immediateMaintenance)})`;
        }
        showToast(msg);
        return {
            ok: true,
            ...applied
        };
    }

    function claimIncome(game, index) {
        const state = CitySimState.ensure(game);
        const cellIndex = Number(index);
        if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= state.grid.length) return false;

        let claimed = 0;
        let maintenance = 0;
        let netClaimed = 0;
        const now = Date.now();

        CitySimState.mutate(game, (draft) => {
            if (!draft.incomeSlots || typeof draft.incomeSlots !== 'object') draft.incomeSlots = {};
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};

            const slot = draft.incomeSlots[cellIndex];
            if (!slot || typeof slot !== 'object') return;
            const stored = Math.max(0, Math.floor(Number(slot.stored) || 0));
            if (stored <= 0) return;

            claimed = stored;
            const penalty = computeTaxCollectionPenalty(claimed);
            maintenance = penalty.maintenance;
            netClaimed = penalty.net;
            slot.stored = 0;
            slot.lastAt = now;
            draft.res.money = Math.max(0, Number(draft.res.money) || 0) + netClaimed;
            draft.hud.netMoney = netClaimed;
        });

        if (claimed <= 0) {
            showToast('수금할 금액이 없습니다.');
            return false;
        }

        if (typeof game.renderCityResources === 'function') game.renderCityResources();
        if (typeof game.renderCityGrid === 'function') game.renderCityGrid();
        if (typeof game.saveCitySimState === 'function') game.saveCitySimState();
        showToast(`세금 수금 +${formatMoney(netClaimed)} (유지비 -${formatMoney(maintenance)})`);
        return true;
    }

    const BUILDING_POP_CAP_BONUS = {
        barracks: 6,
        house: 4,
        apartment_large: 8,
        shop_store: 2,
        decor: 2
    };

    const UNIT_POP_NEED_BY_KEY = {
        humvee: 2,
        apc: 3,
        mbt: 4,
        aa_tank: 4,
        spg: 4,
        icbm: 6,
        recon: 2,
        apache: 4,
        fighter: 4,
        blackhawk: 5,
        chinook: 6,
        bomber: 6
    };

    function getUnitDef(unitKey) {
        const key = String(unitKey || '').trim();
        if (!key) return null;
        if (typeof CONFIG === 'undefined' || !CONFIG || typeof CONFIG.units !== 'object') return null;
        return CONFIG.units[key] || null;
    }

    function getUnitPopulationNeed(unitKey, unitDef) {
        const key = String(unitKey || '').trim();
        const def = unitDef || getUnitDef(key);
        if (!def || typeof def !== 'object') return 1;

        const explicit = Number(def.population ?? def.pop);
        if (Number.isFinite(explicit) && explicit >= 0) {
            return Math.max(0, Math.floor(explicit));
        }

        if (def.isSkill === true || String(def.type || '').toLowerCase() === 'skill') {
            return 0;
        }

        const category = String(def.category || '').toLowerCase();
        const type = String(def.type || '').toLowerCase();

        if (category === 'civilian' || type === 'civilian') return 0;
        if (Object.prototype.hasOwnProperty.call(UNIT_POP_NEED_BY_KEY, key)) {
            return UNIT_POP_NEED_BY_KEY[key];
        }
        if (category === 'air' || type === 'air') return 5;
        if (category === 'armored' || type === 'mech') return 3;
        if (category === 'drone') return 1;
        return 1;
    }

    function computePopulationCapFromGrid(grid) {
        const baseMaxPop = 20;
        let maxPop = baseMaxPop;
        const tiles = Array.isArray(grid) ? grid : [];
        tiles.forEach((tile) => {
            const key = String(tile || '');
            if (!Object.prototype.hasOwnProperty.call(BUILDING_POP_CAP_BONUS, key)) return;
            maxPop += BUILDING_POP_CAP_BONUS[key];
        });
        return Math.max(1, Math.floor(maxPop));
    }

    function computePopulationUsageFromUnits(units) {
        const source = (units && typeof units === 'object') ? units : {};
        let used = 0;
        Object.keys(source).forEach((unitKey) => {
            const count = Math.max(0, Math.floor(Number(source[unitKey]) || 0));
            if (count <= 0) return;
            used += getUnitPopulationNeed(unitKey) * count;
        });
        return Math.max(0, Math.floor(used));
    }

    function computePopulationUsageFromSlots(slotMap) {
        const source = (slotMap && typeof slotMap === 'object') ? slotMap : {};
        let used = 0;
        Object.keys(source).forEach((index) => {
            const unitKey = String(source[index] || '').trim();
            if (!unitKey) return;
            used += getUnitPopulationNeed(unitKey);
        });
        return Math.max(0, Math.floor(used));
    }

    function computePopulationUsageFromVeterans(veterans) {
        if (!Array.isArray(veterans) || veterans.length <= 0) return 0;
        let used = 0;
        veterans.forEach((entry) => {
            const unitKey = String(entry?.unitKey || '').trim();
            if (!unitKey) return;
            used += getUnitPopulationNeed(unitKey);
        });
        return Math.max(0, Math.floor(used));
    }

    function computePopulationUsage(state) {
        const usageFromUnits = computePopulationUsageFromUnits(state?.units);
        const usageFromDrillground = computePopulationUsageFromSlots(state?.drillgroundSlots);
        const usageFromVeterans = computePopulationUsageFromVeterans(state?.veterans);
        return Math.max(0, Math.floor(usageFromUnits + usageFromDrillground + usageFromVeterans));
    }

    function recalcDerived(game) {
        CitySimState.mutate(game, (draft) => {
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            if (!draft.units || typeof draft.units !== 'object') draft.units = {};

            draft.units.icbm = Math.min(Math.max(0, Math.floor(Number(draft.units.icbm) || 0)), 2);
            draft.units.nuke = Math.min(Math.max(0, Math.floor(Number(draft.units.nuke) || 0)), 2);

            const nextMaxPop = computePopulationCapFromGrid(draft.grid);
            const usedPop = computePopulationUsage(draft);

            draft.res.maxPop = Math.max(1, nextMaxPop);
            // Keep overflow population visible (e.g. supply-box rewards can push above cap).
            draft.res.pop = Math.max(0, usedPop);
            draft.res.money = Math.max(0, Number(draft.res.money) || 0);
            draft.res.gold = Math.max(0, Number(draft.res.gold) || 0);
        });
    }

    function formatSigned(value) {
        const n = Math.floor(Number(value) || 0);
        if (n > 0) return `+${n}`;
        return String(n);
    }

    function formatMoney(value) {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        try {
            return n.toLocaleString('ko-KR');
        } catch (_) {
            return String(n);
        }
    }

    function formatGold(value) {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        try {
            return n.toLocaleString('ko-KR');
        } catch (_) {
            return String(n);
        }
    }

    function renderResources(game) {
        const state = CitySimState.ensure(game);
        recalcDerived(game);
        const r = state.res || {};
        const hud = state.hud || {};
        const level = clampLevel(hud.level);
        const expMax = getExpRequiredForLevel(level);
        const exp = clampExp(hud.exp, expMax);
        const honor = clampHonor(hud.honor);
        const expPercent = Math.max(0, Math.min(100, (exp / expMax) * 100));

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(value);
        };

        const popEl = document.getElementById('city-res-pop');
        const currentPop = Math.max(0, Math.floor(Number(r.pop) || 0));
        const maxPop = Math.max(1, Math.floor(Number(r.maxPop) || 1));
        if (popEl) {
            if (currentPop > maxPop) {
                popEl.classList.add('is-overflow');
                popEl.innerHTML = `<span class="city-pop-overflow-current">${formatMoney(currentPop)}</span>/${formatMoney(maxPop)}`;
            } else {
                popEl.classList.remove('is-overflow');
                popEl.textContent = `${formatMoney(currentPop)}/${formatMoney(maxPop)}`;
            }
        }
        setText('city-res-money', formatMoney(r.money));
        setText('city-res-gold', formatGold(r.gold));

        setText('city-hud-level', level);
        setText('city-hud-exp', `${exp}/${expMax}`);
        setText('city-hud-honor', formatGold(honor));

        const batchBtn = document.getElementById('city-tax-collect-btn');
        const autoBtn = document.getElementById('city-tax-auto-btn');
        const batch = getBatchIncomeStatusFromState(state);

        if (batchBtn) {
            const hasAnyTax = batch.claimableCount > 0;
            if (!batch.hasTaxOffice || !hasAnyTax) {
                batchBtn.classList.add('hidden');
                batchBtn.disabled = true;
                batchBtn.textContent = '일괄 수금';
                batchBtn.title = '';
            } else {
                batchBtn.classList.remove('hidden');
                batchBtn.title = `세무소 일괄 수금 · 수수료 ${batch.feeRatePercent}% + 유지비 ${batch.maintenanceRatePercent}%`;
                if (batch.net > 0) {
                    batchBtn.disabled = false;
                    batchBtn.textContent = `일괄 수금 +${formatMoney(batch.net)}`;
                } else {
                    batchBtn.disabled = true;
                    batchBtn.textContent = '일괄 수금';
                }
            }
        }

        if (autoBtn) {
            // 상단 고정 UI에서는 자동수금을 숨기고, 세무소 기능 버튼(컨텍스트 모달)에서만 노출한다.
            autoBtn.classList.add('hidden');
            autoBtn.disabled = true;
            autoBtn.textContent = '자동수금';
            autoBtn.title = '';
        }

        const expFill = document.getElementById('city-hud-exp-fill');
        if (expFill) {
            expFill.style.width = `${expPercent.toFixed(2)}%`;
        }

        const badgeEl = document.getElementById('city-hud-level-badge');
        if (badgeEl) {
            const nextSrc = getLevelBadgePath(level);
            if (badgeEl.getAttribute('src') !== nextSrc) {
                badgeEl.setAttribute('src', nextSrc);
            }
            badgeEl.setAttribute('alt', `레벨 ${level}`);
        }

        const feedback = document.getElementById('city-hud-feedback');
        if (feedback) {
            feedback.textContent = `자금 변동 ${formatSigned(hud.netMoney || 0)}`;
        }
    }

    function addHonor(game, amount, options) {
        const gain = Math.max(0, Math.floor(Number(amount) || 0));
        const opts = (options && typeof options === 'object') ? options : {};
        if (gain <= 0) return 0;

        CitySimState.mutate(game, (draft) => {
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
            const current = clampHonor(draft.hud.honor);
            draft.hud.honor = current + gain;
        });

        if (opts.render !== false && typeof game.renderCityResources === 'function') game.renderCityResources();
        if (opts.save === true && typeof game.saveCitySimState === 'function') game.saveCitySimState();
        return gain;
    }

    function addExp(game, amount, options) {
        const gain = Math.max(0, Math.floor(Number(amount) || 0));
        const opts = (options && typeof options === 'object') ? options : {};
        const initialLevel = (game && game.citySim && game.citySim.hud) ? game.citySim.hud.level : MIN_CITY_LEVEL;
        const result = {
            requestedExp: gain,
            addedExp: 0,
            levelsGained: 0,
            level: MIN_CITY_LEVEL,
            exp: 0,
            expMax: getExpRequiredForLevel(initialLevel),
            honorGained: 0,
            honor: 0
        };

        CitySimState.mutate(game, (draft) => {
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};

            let level = clampLevel(draft.hud.level);
            let expMax = getExpRequiredForLevel(level);
            let exp = clampExp(draft.hud.exp, expMax);
            let honor = clampHonor(draft.hud.honor);
            let remain = gain;
            let levelsGained = 0;

            while (remain > 0 && level < MAX_CITY_LEVEL) {
                expMax = getExpRequiredForLevel(level);
                const need = Math.max(1, expMax - exp);
                if (remain >= need) {
                    remain -= need;
                    level += 1;
                    expMax = getExpRequiredForLevel(level);
                    exp = 0;
                    levelsGained += 1;
                } else {
                    exp += remain;
                    remain = 0;
                }
            }

            if (level >= MAX_CITY_LEVEL) {
                level = MAX_CITY_LEVEL;
                expMax = getExpRequiredForLevel(level);
                exp = expMax;
                remain = 0;
            }

            const addedExp = gain - remain;
            const honorGained = levelsGained;
            honor += honorGained;

            draft.hud.level = level;
            draft.hud.exp = exp;
            draft.hud.expMax = expMax;
            draft.hud.honor = honor;

            result.addedExp = addedExp;
            result.levelsGained = levelsGained;
            result.level = level;
            result.exp = exp;
            result.expMax = expMax;
            result.honorGained = honorGained;
            result.honor = honor;
        });

        if (result.levelsGained > 0
            && game
            && typeof game.onQuestMissionEvent === 'function') {
            game.onQuestMissionEvent('level_up', {
                count: result.levelsGained,
                level: result.level
            });
        }

        if (opts.render !== false && typeof game.renderCityResources === 'function') game.renderCityResources();
        if (opts.save === true && typeof game.saveCitySimState === 'function') game.saveCitySimState();
        return result;
    }

    function getStageClearExpReward(stage, currentLevel, currentExp) {
        const level = clampLevel(currentLevel);
        const expMax = getExpRequiredForLevel(level);
        const exp = clampExp(currentExp, expMax);
        const remain = Math.max(1, expMax - exp);

        const diff = Math.max(1, Math.min(10, Math.floor(Number(stage?.difficulty) || 1)));
        const stageType = String(stage?.type || 'normal');
        const typeBonus = stageType === 'boss' ? 22 : (stageType === 'elite' ? 12 : 6);

        let reward = (28 + (diff * 10) + typeBonus);
        if (level <= 5) {
            reward = Math.max(reward, remain);
        } else if (level >= 12) {
            reward = Math.floor(reward * 0.85);
        }
        return Math.max(12, Math.floor(reward));
    }

    function tick(game) {
        const autoChanged = tickAutoTaxCollect(game);
        const incomeChanged = tickIncome(game);
        if ((incomeChanged || autoChanged) && typeof game.renderCityGrid === 'function') {
            game.renderCityGrid();
        }

        CitySimState.mutate(game, (draft) => {
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
            draft.hud.netMoney = 0;
        });

        if (typeof game.renderCityResources === 'function') game.renderCityResources();
        if (typeof game.saveCitySimState === 'function') game.saveCitySimState();
    }

    function showToast(msg) {
        if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
            ui.showToast(msg);
        }
    }

    function earnMoney(game) {
        const rawGain = 160 + Math.floor(Math.random() * 120);
        const gain = Math.max(MONEY_STEP, Math.round(rawGain / MONEY_STEP) * MONEY_STEP);
        CitySimState.mutate(game, (draft) => {
            if (!draft.res || typeof draft.res !== 'object') draft.res = {};
            if (!draft.hud || typeof draft.hud !== 'object') draft.hud = {};
            draft.res.money = Math.max(0, Number(draft.res.money) || 0) + gain;
            draft.hud.netMoney = gain;
        });

        if (typeof game.renderCityResources === 'function') game.renderCityResources();
        if (typeof game.saveCitySimState === 'function') game.saveCitySimState();
        showToast(`+${gain}`);
    }

    global.CitySimEconomy = {
        canPayCost,
        payCost,
        canCharge,
        charge,
        grant,
        tickIncome,
        getAutoTaxStatus,
        getIncomeStatus,
        getBatchIncomeStatus,
        claimIncome,
        claimAllIncome,
        activateAutoTaxCollect,
        getUnitPopulationNeed,
        recalcDerived,
        getLevelBadgePath,
        getExpRequiredForLevel,
        getStageClearExpReward,
        addHonor,
        addExp,
        renderResources,
        tick,
        earnMoney
    };
})(window);
