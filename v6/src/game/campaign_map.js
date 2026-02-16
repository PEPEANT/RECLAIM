// src/game/campaign_map.js - Campaign map rendering and drag handlers
(function (global) {
    'use strict';

    const GameCampaignMap = {
    cycleCampaignStage(direction) {
        this.ensureCampaignProgress();
        const data = this._activeCampaign();
        if (!data || !Array.isArray(data.stages) || data.stages.length === 0) return;

        const dir = Number(direction) < 0 ? -1 : 1;
        let currentIndex = this._getCampaignStageIndex(data, data.selectedStageId);
        if (currentIndex < 0) {
            const fallback = this._getCampaignSelectedStage(data);
            currentIndex = fallback
                ? this._getCampaignStageIndex(data, fallback.id)
                : 0;
        }
        if (currentIndex < 0) currentIndex = 0;

        const nextIndex = Math.max(0, Math.min(data.stages.length - 1, currentIndex + dir));
        const nextStage = data.stages[nextIndex];
        if (!nextStage) return;

        data.selectedStageId = nextStage.id;
        this.campaignBriefVisible = true;
        this._centerCampaignViewOnStage(data, nextStage);
        this.renderCampaignMap();
    },

    applyCampaignView() {
        const world = document.getElementById('campaign-map-world');
        if (!world) return;

        const data = this._activeCampaign();
        const view = data.view || { x: 0, y: 0, scale: 1.2 };
        const x = Math.round(Number(view.x) || 0);
        const y = Math.round(Number(view.y) || 0);
        const scale = Math.max(0.8, Math.min(2.5, Number(view.scale) || 1.2));
        world.style.transform = `translate(${x}px, ${y}px) scale(${scale.toFixed(2)})`;
    },

    _resetCampaignDragState() {
        this._campaignDrag.active = false;
        this._campaignDrag.pointerId = null;
        this._campaignDrag.pointerType = '';
        this._campaignDrag.downOnStageNode = false;
        this._campaignDrag.startX = 0;
        this._campaignDrag.startY = 0;
        this._campaignDrag.originX = 0;
        this._campaignDrag.originY = 0;
        this._campaignDrag.moved = false;
        this._campaignDrag.justDragged = false;

        const root = document.getElementById('campaign-map-root');
        if (root) root.classList.remove('dragging');
    },

    bindCampaignEvents() {
        if (this._campaignBound) return;

        const root = document.getElementById('campaign-map-root');
        const svg = document.getElementById('campaign-map-svg');
        if (!root || !svg) return;

        const beginCampaignDrag = (clientX, clientY, pointerId, pointerType = '', downOnStageNode = false) => {
            const data = this._activeCampaign();
            const view = data.view || { x: 0, y: 0, scale: 1.2 };
            this._campaignDrag.active = true;
            this._campaignDrag.pointerId = pointerId;
            this._campaignDrag.pointerType = String(pointerType || '');
            this._campaignDrag.downOnStageNode = !!downOnStageNode;
            this._campaignDrag.startX = clientX;
            this._campaignDrag.startY = clientY;
            this._campaignDrag.originX = Number(view.x) || 0;
            this._campaignDrag.originY = Number(view.y) || 0;
            this._campaignDrag.moved = false;
            this._campaignDrag.justDragged = false;
            root.classList.add('dragging');
        };

        root.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -e.deltaY * 0.0012;
            this.campaignZoom(delta);
        }, { passive: false });

        root.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            const downOnStageNode = !!(e.target && typeof e.target.closest === 'function' && e.target.closest('.campaign-stage-node'));
            beginCampaignDrag(e.clientX, e.clientY, e.pointerId, e.pointerType, downOnStageNode);
            // Stage node click reliability on desktop: avoid capturing pointer on direct node clicks.
            if (!(downOnStageNode && e.pointerType === 'mouse')) {
                try { root.setPointerCapture(e.pointerId); } catch (_) { }
            }
        });

        root.addEventListener('pointermove', (e) => {
            if (!this._campaignDrag.active || this._campaignDrag.pointerId !== e.pointerId) return;
            const dx = e.clientX - this._campaignDrag.startX;
            const dy = e.clientY - this._campaignDrag.startY;
            const pType = this._campaignDrag.pointerType || e.pointerType || '';
            const threshold = this._campaignDrag.downOnStageNode
                ? (pType === 'mouse' ? 12 : 8)
                : (pType === 'mouse' ? 8 : 6);
            if (!this._campaignDrag.moved && Math.hypot(dx, dy) > threshold) {
                this._campaignDrag.moved = true;
            }
            const data = this._activeCampaign();
            data.view = {
                ...data.view,
                x: this._campaignDrag.originX + dx,
                y: this._campaignDrag.originY + dy
            };
            this.applyCampaignView();
        });

        const endDrag = (e) => {
            if (!this._campaignDrag.active) return;
            if (e && this._campaignDrag.pointerId != null && e.pointerId != null && this._campaignDrag.pointerId !== e.pointerId) return;
            if (this._campaignDrag.pointerId != null) {
                try { root.releasePointerCapture(this._campaignDrag.pointerId); } catch (_) { }
            }
            this._campaignDrag.justDragged = !!this._campaignDrag.moved;
            this._campaignDrag.active = false;
            this._campaignDrag.pointerId = null;
            this._campaignDrag.pointerType = '';
            this._campaignDrag.downOnStageNode = false;
            root.classList.remove('dragging');
        };

        root.addEventListener('pointerup', endDrag);
        root.addEventListener('pointercancel', endDrag);
        window.addEventListener('pointerup', endDrag, true);
        window.addEventListener('pointercancel', endDrag, true);
        window.addEventListener('blur', () => this._resetCampaignDragState());

        if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
            root.addEventListener('touchstart', (e) => {
                if (!e.touches || e.touches.length !== 1) return;
                const t = e.touches[0];
                const downOnStageNode = !!(e.target && typeof e.target.closest === 'function' && e.target.closest('.campaign-stage-node'));
                beginCampaignDrag(t.clientX, t.clientY, 'touch', 'touch', downOnStageNode);
                e.preventDefault();
            }, { passive: false });

            root.addEventListener('touchmove', (e) => {
                if (!this._campaignDrag.active || this._campaignDrag.pointerId !== 'touch') return;
                if (!e.touches || e.touches.length < 1) return;
                const t = e.touches[0];
                const dx = t.clientX - this._campaignDrag.startX;
                const dy = t.clientY - this._campaignDrag.startY;
                const threshold = this._campaignDrag.downOnStageNode ? 8 : 6;
                if (!this._campaignDrag.moved && Math.hypot(dx, dy) > threshold) {
                    this._campaignDrag.moved = true;
                }
                const data = this._activeCampaign();
                data.view = {
                    ...data.view,
                    x: this._campaignDrag.originX + dx,
                    y: this._campaignDrag.originY + dy
                };
                this.applyCampaignView();
                e.preventDefault();
            }, { passive: false });

            const touchEndDrag = () => {
                if (!this._campaignDrag.active || this._campaignDrag.pointerId !== 'touch') return;
                this._campaignDrag.justDragged = !!this._campaignDrag.moved;
                this._campaignDrag.active = false;
                this._campaignDrag.pointerId = null;
                this._campaignDrag.pointerType = '';
                this._campaignDrag.downOnStageNode = false;
                root.classList.remove('dragging');
            };
            root.addEventListener('touchend', touchEndDrag);
            root.addEventListener('touchcancel', touchEndDrag);
        }

        svg.addEventListener('click', (e) => {
            if (this._campaignDrag.justDragged) {
                this._campaignDrag.justDragged = false;
                return;
            }
            const node = e.target.closest('.campaign-stage-node');
            if (!node) return;
            const stageId = Math.floor(Number(node.dataset.stageId) || 0);
            if (!stageId) return;
            this.selectCampaignStage(stageId);
        });

        this._campaignBound = true;
    },

    renderCampaignMap() {
        this.ensureCampaignProgress();
        document.querySelectorAll('.campaign-tab-btn[data-tab]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === this.activeCampaignTab);
        });
        this.updateCampaignTabLockUi();

        const data = this._activeCampaign();
        const stages = data.stages;
        const isOccupation = this.activeCampaignTab === 'occupation';
        const isSkirmish = this.activeCampaignTab === 'skirmish';

        const fundsEl = document.getElementById('campaign-funds');
        const threatEl = document.getElementById('campaign-threat-level');
        const clearedEl = document.getElementById('campaign-cleared-count');
        const money = Math.max(0, Math.floor(Number(this.citySim?.res?.money) || 0));
        const clearedCount = stages.filter((stage) => stage.status === 'cleared').length;
        const threatLevel = this.getCampaignThreatLevel();
        const threatRatio = Math.max(0, Math.min(1, (threatLevel - 1) / 6));

        const campaignScreen = document.getElementById('campaign-screen');
        if (campaignScreen) {
            if (isSkirmish) {
                // 국지전: 사막 섬 톤
                const topR = Math.round(160 + threatRatio * 18);
                const topG = Math.round(126 - threatRatio * 20);
                const topB = Math.round(82 - threatRatio * 14);
                const midR = Math.round(120 + threatRatio * 22);
                const midG = Math.round(88 - threatRatio * 18);
                const midB = Math.round(55 - threatRatio * 10);
                const botR = Math.round(76 + threatRatio * 22);
                const botG = Math.round(52 - threatRatio * 12);
                const botB = Math.round(34 - threatRatio * 8);
                campaignScreen.style.background = `radial-gradient(circle at 38% 24%, rgb(${topR}, ${topG}, ${topB}) 0%, rgb(${midR}, ${midG}, ${midB}) 54%, rgb(${botR}, ${botG}, ${botB}) 100%)`;
            } else {
                const topR = Math.round(11 + threatRatio * 28);
                const topG = Math.round(51 - threatRatio * 26);
                const topB = Math.round(95 - threatRatio * 36);
                const midR = Math.round(4 + threatRatio * 18);
                const midG = Math.round(26 - threatRatio * 12);
                const midB = Math.round(51 - threatRatio * 18);
                const botR = Math.round(2 + threatRatio * 26);
                const botG = Math.round(13 - threatRatio * 5);
                const botB = Math.round(28 - threatRatio * 10);
                campaignScreen.style.background = `radial-gradient(circle at 30% 18%, rgb(${topR}, ${topG}, ${topB}) 0%, rgb(${midR}, ${midG}, ${midB}) 52%, rgb(${botR}, ${botG}, ${botB}) 100%)`;
            }
        }

        if (fundsEl) fundsEl.textContent = money.toLocaleString('ko-KR');
        if (threatEl) threatEl.textContent = `위협 ${threatLevel}`;
        if (clearedEl) clearedEl.textContent = `클리어 ${clearedCount}/${stages.length}`;

        const svg = document.getElementById('campaign-map-svg');
        if (!svg) return;

        const svgNS = 'http://www.w3.org/2000/svg';
        const mk = (tag, attrs = {}) => {
            const el = document.createElementNS(svgNS, tag);
            Object.keys(attrs).forEach((key) => el.setAttribute(key, String(attrs[key])));
            return el;
        };

        if (!this._getStageByIdInData(data, data.selectedStageId)) {
            const current = stages.find((stage) => stage.status === 'current');
            data.selectedStageId = current ? current.id : stages[0]?.id || null;
        }

        svg.innerHTML = '';
        svg.setAttribute('viewBox', '-400 -400 800 800');

        if (isSkirmish) {
            // 국지전: 사막 섬 형태 (넓고 평평한 대지)
            const fieldPath = 'M -320 60 Q -340 -10 -280 -80 Q -200 -130 -80 -120 Q 40 -140 140 -110 Q 240 -90 300 -50 Q 340 0 320 60 Q 300 110 200 120 Q 80 140 -40 130 Q -160 140 -240 110 Q -310 90 -320 60 Z';
            const fieldShadow = mk('path', {
                d: fieldPath,
                fill: 'none',
                stroke: '#f59e0b',
                'stroke-width': '6',
                opacity: '0.16',
                transform: 'translate(8, 8)'
            });
            const field = mk('path', {
                d: fieldPath,
                fill: '#7a5b32',
                stroke: '#eab308',
                'stroke-width': '2'
            });
            svg.appendChild(fieldShadow);
            svg.appendChild(field);

            // 사막 언덕/사질 패치 장식
            const dunes = [
                { x: -260, y: -60 }, { x: -150, y: -90 }, { x: -30, y: -80 },
                { x: 90, y: -95 }, { x: 200, y: -65 }, { x: 270, y: -30 },
                { x: -200, y: 80 }, { x: -80, y: 100 }, { x: 60, y: 95 },
                { x: 180, y: 85 }, { x: -100, y: 20 }, { x: 120, y: -10 }
            ];
            for (const d of dunes) {
                const dune = mk('ellipse', {
                    cx: d.x,
                    cy: d.y,
                    rx: 12 + Math.abs(d.x % 8),
                    ry: 5 + Math.abs(d.y % 4),
                    fill: '#9a6c3f',
                    opacity: '0.33'
                });
                svg.appendChild(dune);
            }

            // 건조 관목/바위 점묘
            const drySpots = [
                { x: -235, y: -20 }, { x: -95, y: -42 }, { x: 40, y: -28 },
                { x: 160, y: -44 }, { x: 236, y: -8 }, { x: -165, y: 52 },
                { x: -22, y: 70 }, { x: 116, y: 62 }, { x: 205, y: 36 }
            ];
            for (const s of drySpots) {
                const spot = mk('circle', {
                    cx: s.x,
                    cy: s.y,
                    r: 3 + Math.abs(s.x % 3),
                    fill: '#5b4630',
                    opacity: '0.4'
                });
                svg.appendChild(spot);
            }

            // 길/트랙 장식 (산발적 배치)
            const track = mk('path', {
                d: 'M -250 10 Q -120 -20 0 5 Q 130 30 260 -5',
                fill: 'none',
                stroke: '#c08457',
                'stroke-width': '3',
                'stroke-dasharray': '12 8',
                opacity: '0.32'
            });
            svg.appendChild(track);
        } else {
            // 점령전: 섬 형태
            const islandShadow = mk('path', {
                d: 'M -100 220 Q -180 150 -120 50 Q -150 -50 -50 -150 Q 50 -220 150 -150 Q 200 -50 150 50 Q 180 180 80 220 Z',
                fill: 'none',
                stroke: '#fbbf24',
                'stroke-width': '6',
                opacity: '0.2',
                transform: 'translate(10, 10)'
            });
            const island = mk('path', {
                d: 'M -100 220 Q -180 150 -120 50 Q -150 -50 -50 -150 Q 50 -220 150 -150 Q 200 -50 150 50 Q 180 180 80 220 Z',
                fill: '#14532d',
                stroke: '#4ade80',
                'stroke-width': '2'
            });
            svg.appendChild(islandShadow);
            svg.appendChild(island);
        }

        // 연결선
        stages.forEach((stage, idx) => {
            if (idx >= stages.length - 1) return;
            const next = stages[idx + 1];
            const unlocked = stage.status === 'cleared';
            const line = mk('path', {
                d: `M ${stage.x} ${stage.y} L ${next.x} ${next.y}`,
                stroke: unlocked ? (isSkirmish ? '#4ade80' : '#fbbf24') : '#1e293b',
                'stroke-width': '3',
                'stroke-dasharray': '8 6',
                fill: 'none'
            });
            svg.appendChild(line);
        });

        // 스테이지 노드
        stages.forEach((stage, idx) => {
            const isSelected = Number(data.selectedStageId) === stage.id;
            const isLocked = stage.status === 'locked';
            const isCurrent = stage.status === 'current';
            const isCleared = stage.status === 'cleared';

            let fill = '#334155';
            let stroke = '#64748b';
            if (isCurrent) {
                fill = isSkirmish ? '#16a34a' : '#ef4444';
                stroke = isSkirmish ? '#86efac' : '#fca5a5';
            } else if (isCleared) {
                fill = '#eab308';
                stroke = '#fef08a';
            }

            if (isCurrent) {
                const pulse = mk('circle', {
                    cx: stage.x,
                    cy: stage.y,
                    r: 26,
                    fill: 'none',
                    stroke: isSkirmish ? '#16a34a' : '#ef4444',
                    'stroke-width': '2',
                    opacity: '0.35'
                });
                svg.appendChild(pulse);
            }

            const g = mk('g', {
                transform: `translate(${stage.x}, ${stage.y})`,
                class: 'campaign-stage-node',
                'data-stage-id': stage.id
            });

            const body = mk('circle', {
                cx: 0,
                cy: 0,
                r: stage.type === 'boss' ? 22 : 16,
                fill,
                stroke: isSelected ? '#ffffff' : stroke,
                'stroke-width': isSelected ? 4 : 3
            });
            g.appendChild(body);

            const alphaIndex = Math.max(0, idx) % 26;
            const alphaCycle = Math.floor(Math.max(0, idx) / 26);
            const iconText = `${String.fromCharCode(65 + alphaIndex)}${alphaCycle > 0 ? String(alphaCycle + 1) : ''}`;
            const icon = mk('text', {
                x: 0,
                y: 5,
                'text-anchor': 'middle',
                'font-size': 12,
                'font-weight': 800,
                fill: isLocked ? '#94a3b8' : '#ffffff'
            });
            icon.textContent = iconText;
            g.appendChild(icon);

            const titleBg = mk('rect', {
                x: -58,
                y: 26,
                width: 116,
                height: 18,
                rx: 4,
                fill: isCurrent ? (isSkirmish ? 'rgba(22,101,52,0.92)' : 'rgba(127,29,29,0.92)') : (isCleared ? 'rgba(113,63,18,0.92)' : 'rgba(15,23,42,0.86)'),
                stroke: isCurrent ? (isSkirmish ? 'rgba(74,222,128,0.6)' : 'rgba(248,113,113,0.6)') : (isCleared ? 'rgba(250,204,21,0.5)' : 'rgba(71,85,105,0.7)'),
                'stroke-width': 1
            });
            g.appendChild(titleBg);

            const label = mk('text', {
                x: 0,
                y: 38,
                'text-anchor': 'middle',
                'font-size': 10,
                'font-weight': 700,
                fill: '#e2e8f0'
            });
            label.textContent = stage.title;
            g.appendChild(label);

            if (isCleared) {
                for (let i = 0; i < 3; i++) {
                    const dot = mk('circle', {
                        cx: -14 + (i * 14),
                        cy: -30,
                        r: 3,
                        fill: i < stage.stars ? '#facc15' : '#4b5563'
                    });
                    g.appendChild(dot);
                }
            }

            svg.appendChild(g);
        });

        this.renderCampaignBriefing();
        this.applyCampaignView();
    },

    renderCampaignBriefing() {
        const panel = document.getElementById('campaign-briefing');
        if (!panel) return;
        if (this.campaignBriefVisible !== true) {
            panel.classList.add('hidden');
            return;
        }

        const data = this._activeCampaign();
        const stage = this._getStageByIdInData(data, data.selectedStageId);
        if (!stage) {
            panel.classList.add('hidden');
            return;
        }

        const typeLabel = stage.type === 'boss' ? '보스작전' : (stage.type === 'elite' ? '정예작전' : '일반작전');

        const titleEl = document.getElementById('campaign-brief-title');
        const typeEl = document.getElementById('campaign-brief-type');
        const mapEl = document.getElementById('campaign-brief-map');
        const progressEl = document.getElementById('campaign-brief-progress');
        const rewardEl = document.getElementById('campaign-brief-reward');
        const rewardNowEl = document.getElementById('campaign-brief-reward-now');
        const prevBtn = document.getElementById('campaign-prev-btn');
        const nextBtn = document.getElementById('campaign-next-btn');
        const startBtn = document.getElementById('campaign-start-btn');
        const stageIndex = this._getCampaignStageIndex(data, stage.id);
        const totalCount = Array.isArray(data.stages) ? data.stages.length : 1;
        const firstClearReward = Math.max(0, Math.floor(Number(stage.reward) || 0));
        const claimableNow = (stage.status !== 'locked' && stage.status !== 'cleared') ? firstClearReward : 0;
        const mapLabel = this._getCampaignMapLabel(stage.mapId);

        if (titleEl) titleEl.textContent = stage.title;
        if (typeEl) typeEl.textContent = `${typeLabel} -> LV.${stage.difficulty}`;
        if (mapEl) mapEl.textContent = `작전 맵: ${mapLabel}`;
        if (progressEl) progressEl.textContent = `작전 진행: ${Math.max(1, stageIndex + 1)}/${Math.max(1, totalCount)}`;
        if (rewardEl) rewardEl.textContent = `첫 클리어 보상금: ${firstClearReward.toLocaleString('ko-KR')}원`;
        if (rewardNowEl) rewardNowEl.textContent = `현재 획득 가능 보상금: ${claimableNow.toLocaleString('ko-KR')}원`;
        if (prevBtn) prevBtn.disabled = stageIndex <= 0;
        if (nextBtn) nextBtn.disabled = stageIndex < 0 || stageIndex >= (totalCount - 1);

        if (startBtn) {
            const locked = stage.status === 'locked';
            startBtn.disabled = locked;
            if (locked) startBtn.textContent = '잠금 해제 필요';
            else if (stage.status === 'cleared') startBtn.textContent = '재작전 시작';
            else startBtn.textContent = '작전 시작';
        }

        panel.classList.remove('hidden');
    },

    selectCampaignStage(stageId) {
        const data = this._activeCampaign();
        const stage = this._getStageByIdInData(data, stageId);
        if (!stage) return;
        data.selectedStageId = stage.id;
        this.campaignBriefVisible = true;
        this._centerCampaignViewOnStage(data, stage);

        this.renderCampaignMap();
    },

    campaignZoom(delta) {
        const data = this._activeCampaign();
        const prev = Number(data.view?.scale) || 1.2;
        const next = Math.max(0.8, Math.min(2.5, prev + (Number(delta) || 0)));
        if (Math.abs(next - prev) < 0.0001) return;
        data.view = {
            ...data.view,
            scale: Math.round(next * 100) / 100
        };
        this.applyCampaignView();
    },

    startSelectedCampaignBattle() {
        this.ensureCampaignProgress();
        const data = this._activeCampaign();
        const stage = this._getStageByIdInData(data, data.selectedStageId);
        if (!stage || stage.status === 'locked') return;

        this.activeCampaignStageId = stage.id;
        const threat = this.getCampaignThreatLevel();
        const isSkirmish = this.activeCampaignTab === 'skirmish';
        const battleMapId = this._resolveBattleMapId(stage, this.activeCampaignTab);
        this.closeCampaignMap();
        this.startGame(battleMapId, {
            campaignStageId: stage.id,
            campaignMode: this.activeCampaignTab,
            threatLevel: threat,
            skirmish: isSkirmish,
            skirmishData: isSkirmish ? stage : null
        });
    },
    };

    global.GameCampaignMap = GameCampaignMap;
})(window);
