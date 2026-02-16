// src/game/custom_battle.js - Custom battle screen and setup logic
(function (global) {
    'use strict';

    const GameCustomBattle = {
    renderCustomBattleScreen() {
        const screen = document.getElementById('custom-battle-screen');
        if (!screen) return;

        // 맵 그리드 생성
        const grid = document.getElementById('custom-map-grid');
        if (grid) {
            grid.innerHTML = '';
            const mapTypes = (typeof Maps !== 'undefined' && Maps && Maps.types && typeof Maps.types === 'object')
                ? Maps.types
                : {};
            for (const [mapId, mapData] of Object.entries(mapTypes)) {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'custom-map-card' + (this._customMapId === mapId ? ' selected' : '');
                card.dataset.mapId = mapId;
                card.onclick = () => this.selectCustomMap(mapId);

                const swatch = document.createElement('div');
                swatch.className = 'custom-map-swatch';
                swatch.style.background = `linear-gradient(180deg, ${mapData.sky || '#87CEEB'} 0%, ${mapData.ground || '#4ade80'} 100%)`;

                const label = document.createElement('span');
                label.className = 'custom-map-label';
                label.textContent = mapData.name || mapId;

                card.appendChild(swatch);
                card.appendChild(label);
                grid.appendChild(card);
            }
        }

        // 슬롯 초기화 (비어있으면 기본 1슬롯)
        if (this._customAllySlots.length === 0) {
            this._customAllySlots = [{ unitId: 'infantry', count: 5 }];
        }
        if (this._customEnemySlots.length === 0) {
            this._customEnemySlots = [{ unitId: 'infantry', count: 5 }];
        }
        this._renderCustomSlots('ally');
        this._renderCustomSlots('enemy');

        // 맵 프리뷰 갱신
        this._updateCustomMapPreview();
    },

    selectCustomMap(mapId) {
        this._customMapId = mapId;
        // 카드 선택 상태 갱신
        const grid = document.getElementById('custom-map-grid');
        if (grid) {
            grid.querySelectorAll('.custom-map-card').forEach(c => {
                c.classList.toggle('selected', c.dataset.mapId === mapId);
            });
        }
        this._updateCustomMapPreview();
    },

    _customMapText(ko, en) {
        if (typeof Lang !== 'undefined' && Lang && Lang.current === 'en') return en;
        return ko;
    },

    _getCustomMapRules(mapId) {
        const mapRulesObj = (typeof Maps !== 'undefined' && Maps && Maps.rules && typeof Maps.rules === 'object')
            ? Maps.rules
            : {};
        const mapRules = (mapRulesObj[mapId] && typeof mapRulesObj[mapId] === 'object')
            ? mapRulesObj[mapId]
            : {};
        return {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: true,
            mapExpand: false,
            winCondition: 'hq_destroy',
            survivalTime: 600,
            ...mapRules
        };
    },

    _getCustomMapTerrainLabel(mapId) {
        const terrainByMap = {
            plain: { ko: '개활 평원', en: 'Open plains' },
            city: { ko: '도심 시가전', en: 'Dense urban district' },
            mountain: { ko: '산악 고지', en: 'Mountain ridgeline' },
            village: { ko: '마을 교전지', en: 'Rural village zone' },
            forest: { ko: '수림 지대', en: 'Forest battlefield' },
            fortress: { ko: '요새 방어선', en: 'Fortified frontline' },
            desert: { ko: '사막 지형', en: 'Desert terrain' },
            skirmish: { ko: '국지전 개활지', en: 'Skirmish open field' },
            skirmish_kabul: { ko: '카불 시가지', en: 'Kabul city sector' },
            skirmish_desert: { ko: '사막 도시', en: 'Desert city sector' },
            landing: { ko: '해안 상륙지', en: 'Coastal landing zone' }
        };
        const item = terrainByMap[mapId];
        if (!item) return this._customMapText('복합 지형', 'Mixed terrain');
        return this._customMapText(item.ko, item.en);
    },

    _getCustomMapTraitLabel(mapId) {
        const traitByMap = {
            plain: {
                ko: '특성: 시야가 넓어 장거리 화력전 전개가 빠릅니다.',
                en: 'Trait: wide sightlines favor long-range fire exchanges.'
            },
            city: {
                ko: '특성: 생존형 방어전. 제한 시간 관리가 핵심입니다.',
                en: 'Trait: survival defense map. Time management is critical.'
            },
            mountain: {
                ko: '특성: 지형 단차가 커서 전선 고착과 돌파가 반복됩니다.',
                en: 'Trait: elevation and choke points create repeated pushes and stalls.'
            },
            village: {
                ko: '특성: 본부 타격 루트가 빨리 열려 기동 압박이 큽니다.',
                en: 'Trait: HQ strike routes open early, increasing mobility pressure.'
            },
            forest: {
                ko: '특성: 시야 방해가 많아 중단거리 교전 비중이 높습니다.',
                en: 'Trait: dense cover shifts combat toward mid-range engagements.'
            },
            fortress: {
                ko: '특성: 요새선 돌파가 핵심이며 정면 화력 싸움이 길어집니다.',
                en: 'Trait: breaking fortifications is key and frontal battles last longer.'
            },
            desert: {
                ko: '특성: 은폐물이 적어 화력과 포지션 선점이 중요합니다.',
                en: 'Trait: minimal cover makes firepower and positioning decisive.'
            },
            skirmish: {
                ko: '특성: 본부 없이 순수 병력 소모전으로 진행됩니다.',
                en: 'Trait: no HQs, focused purely on force attrition.'
            },
            skirmish_kabul: {
                ko: '특성: 도심 장애물이 많아 교전선이 자주 분절됩니다.',
                en: 'Trait: urban obstacles frequently split engagement lanes.'
            },
            skirmish_desert: {
                ko: '특성: 개활 사막+건물 혼합으로 측면 전개가 잦습니다.',
                en: 'Trait: open desert mixed with structures encourages flanking.'
            },
            landing: {
                ko: '특성: 해안 상륙 후 적 본부를 압박하는 공세형 전장입니다.',
                en: 'Trait: offensive map that pushes inland after landing.'
            }
        };
        const item = traitByMap[mapId];
        if (!item) return this._customMapText('특성: 기본 전장 규칙이 적용됩니다.', 'Trait: default battlefield rules apply.');
        return this._customMapText(item.ko, item.en);
    },

    _getCustomMapObjectiveLabel(rules) {
        const win = String(rules?.winCondition || 'annihilation');
        if (win === 'survival') {
            const totalSec = Math.max(0, Math.floor(Number(rules?.survivalTime) || 600));
            const minutes = Math.floor(totalSec / 60);
            const seconds = totalSec % 60;
            if (typeof Lang !== 'undefined' && Lang && Lang.current === 'en') {
                if (seconds > 0) return `Survive ${minutes}m ${seconds}s`;
                return `Survive ${minutes}m`;
            }
            if (seconds > 0) return `${minutes}분 ${seconds}초 생존`;
            return `${minutes}분 생존`;
        }
        if (win === 'hq_destroy') return this._customMapText('적 본부 파괴', 'Destroy enemy HQ');
        return this._customMapText('적 전멸', 'Eliminate enemy forces');
    },

    _getCustomMapHqLabel(rules) {
        const playerHQ = !!rules?.playerHQ;
        const enemyHQ = !!rules?.enemyHQ;
        if (playerHQ && enemyHQ) return this._customMapText('양측 본부', 'Both HQs');
        if (playerHQ) return this._customMapText('아군 본부만', 'Player HQ only');
        if (enemyHQ) return this._customMapText('적군 본부만', 'Enemy HQ only');
        return this._customMapText('본부 없음', 'No HQ');
    },

    _getCustomMapDefenseLabel(rules) {
        const playerDefense = !!rules?.playerDefense;
        const enemyDefense = !!rules?.enemyDefense;
        if (playerDefense && enemyDefense) return this._customMapText('양측 방어시설', 'Both sides fortified');
        if (playerDefense) return this._customMapText('아군 방어시설', 'Player defenses only');
        if (enemyDefense) return this._customMapText('적군 방어시설', 'Enemy defenses only');
        return this._customMapText('방어시설 없음', 'No fixed defenses');
    },

    _drawCustomMapPreviewFallback(ctx, w, h, mapData) {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
        skyGrad.addColorStop(0, mapData?.sky || '#87CEEB');
        skyGrad.addColorStop(1, mapData?.skyMid || mapData?.sky || '#87CEEB');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h * 0.6);

        const groundGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
        groundGrad.addColorStop(0, mapData?.ground || '#4ade80');
        groundGrad.addColorStop(1, mapData?.groundDark || '#16a34a');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, h * 0.6, w, h * 0.4);
    },

    _drawCustomMapProfileRows(mapId, rules) {
        const listEl = document.getElementById('custom-map-profile-list');
        const noteEl = document.getElementById('custom-map-profile-note');
        if (!listEl || !noteEl) return;

        if (!mapId) {
            listEl.innerHTML = '';
            noteEl.textContent = '';
            return;
        }

        const rows = [
            { key: this._customMapText('지형', 'Terrain'), value: this._getCustomMapTerrainLabel(mapId) },
            { key: this._customMapText('승리 조건', 'Victory'), value: this._getCustomMapObjectiveLabel(rules) },
            { key: this._customMapText('본부 배치', 'HQ Layout'), value: this._getCustomMapHqLabel(rules) },
            { key: this._customMapText('방어 시설', 'Defenses'), value: this._getCustomMapDefenseLabel(rules) },
            { key: this._customMapText('벙커', 'Bunkers'), value: rules?.bunkers ? this._customMapText('활성', 'Enabled') : this._customMapText('없음', 'None') },
            { key: this._customMapText('전장 크기', 'Battlefield'), value: rules?.mapExpand ? this._customMapText('확장형', 'Expanded') : this._customMapText('고정형', 'Fixed') }
        ];

        listEl.innerHTML = '';
        rows.forEach((row) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'custom-map-profile-row';

            const keyEl = document.createElement('span');
            keyEl.className = 'custom-map-profile-key';
            keyEl.textContent = row.key;

            const valueEl = document.createElement('span');
            valueEl.className = 'custom-map-profile-val';
            valueEl.textContent = row.value;

            rowEl.appendChild(keyEl);
            rowEl.appendChild(valueEl);
            listEl.appendChild(rowEl);
        });

        noteEl.textContent = this._getCustomMapTraitLabel(mapId);
    },

    _drawCustomMapPreviewMarkers(ctx, w, h, groundY, rules) {
        const clampX = (x, pad = 24) => Math.max(pad, Math.min(w - pad, x));
        const drawMiniHq = (x, team = 'player') => {
            const cx = clampX(x, 28);
            const cy = groundY;
            const accent = (team === 'enemy') ? '#f87171' : '#60a5fa';

            ctx.save();
            ctx.translate(cx, cy);

            ctx.fillStyle = 'rgba(2, 6, 23, 0.32)';
            ctx.fillRect(-26, 3, 52, 3);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-22, -2, 44, 7);

            ctx.fillStyle = '#475569';
            ctx.fillRect(-15, -20, 30, 18);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-17, -14, 6, 12);
            ctx.fillRect(11, -14, 6, 12);

            ctx.fillStyle = accent;
            ctx.fillRect(-10, -24, 20, 4);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(-7, -17, 14, 8);

            ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(-15, -20, 30, 18);

            ctx.restore();
        };

        const drawMiniBunker = (x) => {
            const cx = clampX(x, 16);
            const cy = groundY;
            ctx.save();
            ctx.translate(cx, cy);

            ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
            ctx.fillRect(-14, 3, 28, 3);

            ctx.fillStyle = '#7c5a2e';
            ctx.fillRect(-12, -2, 24, 6);
            ctx.fillStyle = '#9a6b35';
            ctx.fillRect(-9, -8, 18, 6);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-4, -6, 8, 2);

            ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(-12, -2, 24, 6);

            ctx.restore();
        };

        ctx.save();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, groundY + 0.5);
        ctx.lineTo(w, groundY + 0.5);
        ctx.stroke();

        if (rules?.playerHQ) drawMiniHq(w * 0.09, 'player');
        if (rules?.enemyHQ) drawMiniHq(w * 0.91, 'enemy');
        if (rules?.bunkers) {
            drawMiniBunker(w * 0.30);
            drawMiniBunker(w * 0.70);
        }

        if (rules?.winCondition === 'survival') {
            const survivalLabel = this._customMapText('생존', 'SURVIVAL');
            ctx.font = 'bold 10px sans-serif';
            const labelWidth = Math.ceil(ctx.measureText(survivalLabel).width) + 10;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.74)';
            ctx.fillRect(8, 8, labelWidth, 16);
            ctx.fillStyle = '#f8fafc';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(survivalLabel, 12, 16);
        }
        ctx.restore();
    },

    _updateCustomMapPreview() {
        const previewEl = document.getElementById('custom-map-preview');
        const canvas = document.getElementById('custom-preview-canvas');
        const nameEl = document.getElementById('custom-map-name');
        if (!previewEl || !canvas) return;

        if (!this._customMapId) {
            previewEl.classList.add('hidden');
            this._drawCustomMapProfileRows(null, null);
            return;
        }
        previewEl.classList.remove('hidden');

        const mapTypes = (typeof Maps !== 'undefined' && Maps && Maps.types && typeof Maps.types === 'object')
            ? Maps.types
            : {};
        const mapData = mapTypes[this._customMapId];
        const mapRules = this._getCustomMapRules(this._customMapId);
        if (nameEl) nameEl.textContent = mapData?.name || this._customMapId;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const groundY = Math.floor(h * 0.62);

        let rendered = false;
        if (typeof Maps !== 'undefined' && Maps && typeof Maps.drawBase === 'function') {
            const prevMap = Maps.currentMap;
            try {
                Maps.currentMap = this._customMapId;
                Maps.drawBase(ctx, w, h, groundY, 0);
                if (typeof Maps.drawDecorations === 'function') {
                    Maps.drawDecorations(ctx, w, h, groundY, 0);
                }
                rendered = true;
            } catch (e) {
                console.warn('[Custom] map preview render failed:', e);
            } finally {
                Maps.currentMap = prevMap;
            }
        }
        if (!rendered) {
            this._drawCustomMapPreviewFallback(ctx, w, h, mapData);
        }

        this._drawCustomMapPreviewMarkers(ctx, w, h, groundY, mapRules);
        this._drawCustomMapProfileRows(this._customMapId, mapRules);
    },

    _getCustomUnitList() {
        const units = CONFIG.units || {};
        const result = [];
        const excludeCategories = ['special', 'civilian'];
        for (const [uid, udata] of Object.entries(units)) {
            if (excludeCategories.includes(udata.category)) continue;
            if (udata.disabled) continue;
            result.push({ id: uid, name: udata.name || uid, category: udata.category || 'unknown' });
        }
        return result;
    },

    _renderCustomSlots(team) {
        const containerId = team === 'ally' ? 'custom-ally-slots' : 'custom-enemy-slots';
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const slots = team === 'ally' ? this._customAllySlots : this._customEnemySlots;
        const unitList = this._getCustomUnitList();

        // 카테고리별 그룹
        const categories = { infantry: '보병', armored: '기갑', air: '항공', drone: '드론' };

        slots.forEach((slot, idx) => {
            const row = document.createElement('div');
            row.className = 'custom-slot-row';

            // 유닛 선택 드롭다운
            const sel = document.createElement('select');
            sel.className = 'custom-slot-select';
            for (const [catId, catName] of Object.entries(categories)) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = catName;
                const catUnits = unitList.filter(u => u.category === catId);
                for (const u of catUnits) {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = u.name;
                    if (u.id === slot.unitId) opt.selected = true;
                    optgroup.appendChild(opt);
                }
                if (catUnits.length > 0) sel.appendChild(optgroup);
            }
            sel.onchange = () => {
                slot.unitId = sel.value;
            };

            // 수량 입력
            const numInput = document.createElement('input');
            numInput.type = 'number';
            numInput.className = 'custom-slot-count';
            numInput.min = 1;
            numInput.max = 30;
            numInput.value = slot.count;
            numInput.onchange = () => {
                slot.count = Math.max(1, Math.min(30, parseInt(numInput.value) || 1));
                numInput.value = slot.count;
            };

            // 삭제 버튼
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'custom-slot-del';
            delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            delBtn.onclick = () => this.removeCustomSlot(team, idx);

            row.appendChild(sel);
            row.appendChild(numInput);
            row.appendChild(delBtn);
            container.appendChild(row);
        });
    },

    addCustomSlot(team) {
        const slots = team === 'ally' ? this._customAllySlots : this._customEnemySlots;
        if (slots.length >= 10) return; // 최대 10슬롯
        slots.push({ unitId: 'infantry', count: 1 });
        this._renderCustomSlots(team);
    },

    removeCustomSlot(team, idx) {
        const slots = team === 'ally' ? this._customAllySlots : this._customEnemySlots;
        if (slots.length <= 1) return; // 최소 1슬롯
        slots.splice(idx, 1);
        this._renderCustomSlots(team);
    },

    startCustomBattle() {
        if (!this._customMapId) {
            alert('맵을 선택하세요.');
            return;
        }
        // 총 유닛 수 검증
        const allyTotal = this._customAllySlots.reduce((s, sl) => s + sl.count, 0);
        const enemyTotal = this._customEnemySlots.reduce((s, sl) => s + sl.count, 0);
        if (allyTotal + enemyTotal > 100) {
            alert('총 유닛 수가 100을 초과합니다. 슬롯을 줄여주세요.');
            return;
        }

        const allyUnits = this._customAllySlots.map(s => ({ unitId: s.unitId, count: s.count }));
        const enemyUnits = this._customEnemySlots.map(s => ({ unitId: s.unitId, count: s.count }));

        this.closeCampaignMap();
        this._customMode = true;
        this.activeCampaignStageId = 9999;
        this.startGame(this._customMapId, {
            campaignStageId: 9999,
            threatLevel: 1,
            skirmish: true,
            skirmishData: {
                id: 9999,
                title: '커스텀 전투',
                type: 'normal',
                difficulty: 1,
                reward: 0,
                mapId: this._customMapId,
                enemyPreset: enemyUnits,
                playerBudget: allyUnits,
                storageSlots: 0,
                civilians: 0,
                narration: '커스텀 전투 - 보상 없음'
            }
        });
    },
    };

    global.GameCustomBattle = GameCustomBattle;
})(window);
