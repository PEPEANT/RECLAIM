(function (global) {
    const LEVEL_PANEL_OVERLAY_ID = 'city-level-panel-overlay';
    const LEVEL_PANEL_MAX_PREVIEW = 5;
    const LEVEL_FALLBACK_MAX = 19;

    const STATUS_RANK = {
        in_progress: 0,
        claimable: 1,
        claimed: 2
    };

    function isFn(value) {
        return typeof value === 'function';
    }

    function clampInt(value, fallback, min, max) {
        const parsed = Math.floor(Number(value));
        const base = Number.isFinite(parsed) ? parsed : Math.floor(Number(fallback) || 0);
        const lo = Number.isFinite(min) ? min : Number.MIN_SAFE_INTEGER;
        const hi = Number.isFinite(max) ? max : Number.MAX_SAFE_INTEGER;
        return Math.max(lo, Math.min(hi, base));
    }

    function formatNumber(value) {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        try {
            return n.toLocaleString('ko-KR');
        } catch (_) {
            return String(n);
        }
    }

    function normalizeStatus(value) {
        const status = String(value || 'in_progress').trim();
        if (status === 'claimable') return 'claimable';
        if (status === 'claimed') return 'claimed';
        return 'in_progress';
    }

    function getStatusLabel(status) {
        if (status === 'claimed') return '\uC9C0\uAE09 \uC644\uB8CC';
        if (status === 'claimable') return '\uC9C0\uAE09 \uAC00\uB2A5';
        return '\uC9C4\uD589 \uC911';
    }

    function getCityState(game) {
        if (!game || typeof game !== 'object') return null;
        if (typeof CitySimState !== 'undefined' && CitySimState && isFn(CitySimState.ensure)) {
            return CitySimState.ensure(game);
        }
        return (game.citySim && typeof game.citySim === 'object') ? game.citySim : null;
    }

    function getExpRequiredForLevel(level) {
        if (typeof CitySimEconomy !== 'undefined' && CitySimEconomy && isFn(CitySimEconomy.getExpRequiredForLevel)) {
            return Math.max(1, Math.floor(Number(CitySimEconomy.getExpRequiredForLevel(level)) || 1));
        }
        if (typeof CitySimState !== 'undefined' && CitySimState && isFn(CitySimState.getExpRequiredForLevel)) {
            return Math.max(1, Math.floor(Number(CitySimState.getExpRequiredForLevel(level)) || 1));
        }
        return 100;
    }

    function resolveMaxLevel() {
        const hardCap = 120;
        for (let level = 1; level <= hardCap; level += 1) {
            const cur = getExpRequiredForLevel(level);
            const next = getExpRequiredForLevel(level + 1);
            if (cur === 1 && next === 1) return level;
        }
        return LEVEL_FALLBACK_MAX;
    }

    function getLevelPositionLabel(level, maxLevel) {
        const max = Math.max(1, Math.floor(Number(maxLevel) || 1));
        const current = Math.max(1, Math.min(max, Math.floor(Number(level) || 1)));
        const ratio = (max <= 1) ? 1 : ((current - 1) / (max - 1));
        const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));

        let phase = '\uCD08\uBC18';
        if (percent >= 67) phase = '\uD6C4\uBC18';
        else if (percent >= 34) phase = '\uC911\uBC18';

        return `${phase} \uAD6C\uAC04 \u00B7 ${current}/${max} (${percent}%)`;
    }

    function formatRewardLabel(reward) {
        const schema = (typeof CityQuestMissionSchema !== 'undefined' && CityQuestMissionSchema)
            ? CityQuestMissionSchema
            : null;
        if (schema && isFn(schema.formatRewardLabel)) {
            const label = String(schema.formatRewardLabel(reward || {}) || '').trim();
            if (label) return label;
        }

        const r = (reward && typeof reward === 'object') ? reward : {};
        const parts = [];
        const money = Math.max(0, Math.floor(Number(r.money) || 0));
        const gold = Math.max(0, Math.floor(Number(r.gold) || 0));
        const honor = Math.max(0, Math.floor(Number(r.honor) || 0));
        const exp = Math.max(0, Math.floor(Number(r.exp) || 0));

        if (money > 0) parts.push(`\uC790\uAE08 ${formatNumber(money)}`);
        if (gold > 0) parts.push(`\uAE08 ${formatNumber(gold)}`);
        if (honor > 0) parts.push(`\uBA85\uC608\uD6C8\uC7A5 ${formatNumber(honor)}`);
        if (exp > 0) parts.push(`EXP ${formatNumber(exp)}`);

        return parts.join(' \u00B7 ') || '\uBCF4\uC0C1 \uC5C6\uC74C';
    }

    function getQuestState(game) {
        if (typeof CityQuestMission !== 'undefined' && CityQuestMission && isFn(CityQuestMission.ensureState)) {
            return CityQuestMission.ensureState(game);
        }
        return (game && game.cityQuestMission && typeof game.cityQuestMission === 'object')
            ? game.cityQuestMission
            : null;
    }

    function getLevelRewardEntries(game) {
        const result = [];
        const schema = (typeof CityQuestMissionSchema !== 'undefined' && CityQuestMissionSchema)
            ? CityQuestMissionSchema
            : null;

        const questState = getQuestState(game);
        const quests = (questState && questState.quests && typeof questState.quests === 'object')
            ? questState.quests
            : {};

        const pushQuestEntry = (quest, fallbackId) => {
            if (!quest || typeof quest !== 'object') return;
            const targetLevel = Math.max(1, Math.floor(Number(quest.target) || 0));
            if (targetLevel <= 0) return;

            const status = normalizeStatus(quest.status);
            result.push({
                id: String(quest.id || fallbackId || '').trim(),
                targetLevel,
                title: String(quest.missionName || `Lv.${targetLevel} \uBCF4\uC0C1`).trim() || `Lv.${targetLevel} \uBCF4\uC0C1`,
                rewardLabel: formatRewardLabel(quest.reward || {}),
                status,
                statusLabel: getStatusLabel(status)
            });
        };

        const ids = Array.isArray(schema && schema.LEVEL_BONUS_IDS)
            ? schema.LEVEL_BONUS_IDS.map((value) => String(value || '').trim()).filter(Boolean)
            : [];

        ids.forEach((id) => {
            pushQuestEntry(quests[id], id);
        });

        if (result.length <= 0) {
            Object.keys(quests).forEach((id) => {
                const q = quests[id];
                if (!q || typeof q !== 'object') return;
                if (String(q.type || '').trim() !== 'level_bonus') return;
                pushQuestEntry(q, id);
            });
        }

        const dedupByTarget = new Map();
        result.forEach((entry) => {
            const key = Math.max(1, Math.floor(Number(entry.targetLevel) || 1));
            const prev = dedupByTarget.get(key);
            if (!prev) {
                dedupByTarget.set(key, entry);
                return;
            }
            const prevRank = STATUS_RANK[normalizeStatus(prev.status)] ?? 0;
            const nextRank = STATUS_RANK[normalizeStatus(entry.status)] ?? 0;
            if (nextRank > prevRank) dedupByTarget.set(key, entry);
        });

        return Array.from(dedupByTarget.values()).sort((a, b) => a.targetLevel - b.targetLevel);
    }

    function getFallbackRewardEntry(targetLevel) {
        const level = Math.max(1, Math.floor(Number(targetLevel) || 1));
        const gold = Math.max(1, Math.floor(level / 4));
        return {
            targetLevel: level,
            title: `Lv.${level} \uC608\uC0C1 \uBCF4\uC0C1`,
            rewardLabel: `\uAE08 ${formatNumber(gold)} (\uC608\uC0C1)`,
            status: 'in_progress',
            statusLabel: '\uC608\uC0C1'
        };
    }

    function getMaxLevelNoticeEntry(maxLevel) {
        const safeMax = Math.max(1, Math.floor(Number(maxLevel) || 1));
        return {
            targetLevel: safeMax,
            title: `Lv.${safeMax} \uCD5C\uB300 \uB808\uBCA8`,
            rewardLabel: '\uCD5C\uB300 \uB808\uBCA8 \uB3C4\uB2EC',
            status: 'claimed',
            statusLabel: '\uC644\uB8CC'
        };
    }

    function buildPanelModel(game) {
        const state = getCityState(game);
        const hud = (state && state.hud && typeof state.hud === 'object') ? state.hud : {};

        const maxLevel = resolveMaxLevel();
        const level = Math.max(1, Math.min(maxLevel, clampInt(hud.level, 1, 1, maxLevel)));

        const inferredExpMax = Math.max(1, Math.floor(Number(getExpRequiredForLevel(level)) || 1));
        const expMax = Math.max(1, clampInt(hud.expMax, inferredExpMax, 1, 1000000));
        const exp = Math.max(0, Math.min(expMax, clampInt(hud.exp, 0, 0, expMax)));

        const isMaxLevel = level >= maxLevel;
        const nextRemainExp = isMaxLevel ? 0 : Math.max(0, expMax - exp);
        const levelsToCap = Math.max(0, maxLevel - level);
        const percent = isMaxLevel
            ? 100
            : Math.max(0, Math.min(100, Math.round((exp / expMax) * 100)));
        const positionLabel = getLevelPositionLabel(level, maxLevel);

        const rewards = getLevelRewardEntries(game);
        const upcoming = rewards
            .filter((entry) => entry.targetLevel > level)
            .slice(0, LEVEL_PANEL_MAX_PREVIEW);

        if (upcoming.length <= 0 && !isMaxLevel) {
            for (let i = level + 1; i <= Math.min(maxLevel, level + LEVEL_PANEL_MAX_PREVIEW); i += 1) {
                upcoming.push(getFallbackRewardEntry(i));
            }
        }

        const nextOne = isMaxLevel
            ? getMaxLevelNoticeEntry(maxLevel)
            : (upcoming[0] || getFallbackRewardEntry(level + 1));

        return {
            level,
            maxLevel,
            exp,
            expMax,
            nextRemainExp,
            levelsToCap,
            percent,
            positionLabel,
            isMaxLevel,
            nextOne,
            upcoming
        };
    }

    function createMetricCard(label, value, hint) {
        const card = document.createElement('div');
        card.className = 'city-level-panel-metric';

        const labelEl = document.createElement('div');
        labelEl.className = 'city-level-panel-metric-label';
        labelEl.textContent = label;
        card.appendChild(labelEl);

        const valueEl = document.createElement('div');
        valueEl.className = 'city-level-panel-metric-value';
        valueEl.textContent = value;
        card.appendChild(valueEl);

        if (hint) {
            const hintEl = document.createElement('div');
            hintEl.className = 'city-level-panel-metric-hint';
            hintEl.textContent = hint;
            card.appendChild(hintEl);
        }

        return card;
    }

    function close() {
        const overlay = document.getElementById(LEVEL_PANEL_OVERLAY_ID);
        if (!overlay) return;

        const onKeyDown = overlay.__cityLevelPanelOnKeyDown;
        if (isFn(onKeyDown)) {
            document.removeEventListener('keydown', onKeyDown);
        }

        overlay.remove();
    }

    function open(game) {
        close();
        const model = buildPanelModel(game);

        const overlay = document.createElement('div');
        overlay.id = LEVEL_PANEL_OVERLAY_ID;
        overlay.className = 'city-level-panel-overlay';
        overlay.setAttribute('role', 'presentation');

        const panel = document.createElement('section');
        panel.className = 'city-level-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', '\uB808\uBCA8 \uC815\uBCF4');
        overlay.appendChild(panel);

        const head = document.createElement('header');
        head.className = 'city-level-panel-head';
        panel.appendChild(head);

        const titleWrap = document.createElement('div');
        titleWrap.className = 'city-level-panel-title-wrap';
        head.appendChild(titleWrap);

        const title = document.createElement('h3');
        title.className = 'city-level-panel-title';
        title.textContent = '\uB808\uBCA8 \uC815\uBCF4';
        titleWrap.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.className = 'city-level-panel-subtitle';
        subtitle.textContent = model.positionLabel;
        titleWrap.appendChild(subtitle);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'city-level-panel-close';
        closeBtn.textContent = '\u00D7';
        closeBtn.setAttribute('aria-label', '\uB808\uBCA8 \uC815\uBCF4 \uB2EB\uAE30');
        closeBtn.addEventListener('click', close);
        head.appendChild(closeBtn);

        const metrics = document.createElement('div');
        metrics.className = 'city-level-panel-metrics';
        metrics.appendChild(createMetricCard('\uD604\uC7AC \uB808\uBCA8', `Lv.${model.level}`));
        metrics.appendChild(createMetricCard('\uB808\uBCA8 \uCEA1', `Lv.${model.maxLevel}`));
        metrics.appendChild(createMetricCard(
            '\uB2E4\uC74C \uB808\uBCA8\uAE4C\uC9C0',
            model.isMaxLevel
                ? '\uCD5C\uB300 \uB808\uBCA8 \uB2EC\uC131'
                : `${formatNumber(model.nextRemainExp)} XP`
        ));
        metrics.appendChild(createMetricCard('\uCD5C\uB300\uAE4C\uC9C0 \uB0A8\uC740 \uB808\uBCA8', `${formatNumber(model.levelsToCap)} Lv`));
        panel.appendChild(metrics);

        const progressBox = document.createElement('section');
        progressBox.className = 'city-level-panel-progress-box';

        const progressHead = document.createElement('div');
        progressHead.className = 'city-level-panel-progress-head';
        progressHead.textContent = `\uC9C4\uD589\uB3C4 ${formatNumber(model.exp)}/${formatNumber(model.expMax)} (${model.percent}%)`;
        progressBox.appendChild(progressHead);

        const progressTrack = document.createElement('div');
        progressTrack.className = 'city-level-panel-progress-track';

        const progressFill = document.createElement('span');
        progressFill.className = 'city-level-panel-progress-fill';
        progressFill.style.width = `${Math.max(0, Math.min(100, Number(model.percent) || 0))}%`;
        progressTrack.appendChild(progressFill);

        progressBox.appendChild(progressTrack);
        panel.appendChild(progressBox);

        const nextRewardBox = document.createElement('section');
        nextRewardBox.className = 'city-level-panel-next-reward';

        const nextTitle = document.createElement('h4');
        nextTitle.className = 'city-level-panel-section-title';
        nextTitle.textContent = '\uB2E4\uC74C 1\uB808\uBCA8 \uBCF4\uC0C1';
        nextRewardBox.appendChild(nextTitle);

        const nextLine = document.createElement('div');
        nextLine.className = 'city-level-panel-next-line';
        nextLine.textContent = model.isMaxLevel
            ? '\uCD5C\uB300 \uB808\uBCA8\uC5D0 \uB3C4\uB2EC\uD588\uC2B5\uB2C8\uB2E4.'
            : `Lv.${model.nextOne.targetLevel} \u00B7 ${model.nextOne.rewardLabel}`;
        nextRewardBox.appendChild(nextLine);

        panel.appendChild(nextRewardBox);

        const previewBox = document.createElement('section');
        previewBox.className = 'city-level-panel-preview';

        const previewTitle = document.createElement('h4');
        previewTitle.className = 'city-level-panel-section-title';
        previewTitle.textContent = `\uB2E4\uC74C ${LEVEL_PANEL_MAX_PREVIEW}\uB808\uBCA8 \uBBF8\uB9AC\uBCF4\uAE30`;
        previewBox.appendChild(previewTitle);

        const previewList = document.createElement('ol');
        previewList.className = 'city-level-panel-preview-list';

        if (!Array.isArray(model.upcoming) || model.upcoming.length <= 0) {
            const empty = document.createElement('li');
            empty.className = 'city-level-panel-preview-item';

            const reward = document.createElement('span');
            reward.className = 'city-level-panel-preview-reward';
            reward.textContent = '\uCD94\uAC00 \uBCF4\uC0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.';
            empty.appendChild(reward);

            const status = document.createElement('span');
            status.className = 'city-level-panel-preview-status status-claimed';
            status.textContent = '\uC644\uB8CC';
            empty.appendChild(status);

            previewList.appendChild(empty);
        }

        model.upcoming.forEach((entry) => {
            const item = document.createElement('li');
            item.className = 'city-level-panel-preview-item';

            const lv = document.createElement('strong');
            lv.className = 'city-level-panel-preview-level';
            lv.textContent = `Lv.${entry.targetLevel}`;
            item.appendChild(lv);

            const reward = document.createElement('span');
            reward.className = 'city-level-panel-preview-reward';
            reward.textContent = entry.rewardLabel;
            item.appendChild(reward);

            const status = document.createElement('span');
            status.className = `city-level-panel-preview-status status-${entry.status || 'in_progress'}`;
            status.textContent = entry.statusLabel || '\uC9C4\uD589 \uC911';
            item.appendChild(status);

            previewList.appendChild(item);
        });

        previewBox.appendChild(previewList);
        panel.appendChild(previewBox);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close();
        });

        const onKeyDown = (event) => {
            if (event && event.key === 'Escape') close();
        };
        overlay.__cityLevelPanelOnKeyDown = onKeyDown;
        document.addEventListener('keydown', onKeyDown);

        document.body.appendChild(overlay);
    }

    function bindHud(game) {
        const line = document.querySelector('#city-screen .city-level-exp-line');
        if (!line) return false;
        if (line.__cityLevelPanelBound === true) return true;

        line.__cityLevelPanelBound = true;
        line.classList.add('city-level-clickable');
        line.setAttribute('role', 'button');
        line.setAttribute('tabindex', '0');
        line.setAttribute('aria-label', '\uB808\uBCA8 \uC815\uBCF4 \uBCF4\uAE30');

        line.addEventListener('click', (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            open(game);
        });

        line.addEventListener('keydown', (event) => {
            const key = String(event?.key || '').toLowerCase();
            if (key !== 'enter' && key !== ' ' && key !== 'spacebar' && key !== 'space') return;
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            open(game);
        });

        return true;
    }

    global.CitySimLevelPanel = {
        open,
        close,
        bindHud
    };
})(window);
