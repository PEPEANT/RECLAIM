// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
const ui = {
    toastTimer: null,
    elementCache: {}, // [OPTIMIZATION] DOM 요소 캐싱
    lastValues: {},   // [OPTIMIZATION] 이전 프레임 데이터 저장 (값 변경 감지용)

    init() {
        // 초기화 로직
    },

    showToast(msg) {
        // [R 4.2] ChatPanel로 라우팅 (DOM toast 불필요)
        if (typeof ChatPanel !== 'undefined' && ChatPanel._list) {
            ChatPanel.push(msg, 'SYS');
            return;
        }

        // Fallback (초기 로드 전)
        const t = document.getElementById('toast-msg');
        if (!t) return;
        t.innerText = msg; t.classList.remove('hidden'); t.style.opacity = 1;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.classList.add('hidden'), 500); }, 3000);
    },

    toggleBriefing() {
        document.getElementById('briefing-detail').classList.toggle('show');
    },

    // [OPTIMIZATION] 초기 1회 실행: 모든 유닛 버튼 생성 및 캐싱
    initUnitButtons(currentCategory) {
        const container = document.getElementById('unit-list-container');
        container.innerHTML = ''; // 초기화
        this.elementCache = {};
        this.lastValues = {};
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) {
            console.warn('[UI] CONFIG.units not available. Skipping unit button init.');
            return;
        }

        // [P0-2] 드론병이 선택되면 드론 버튼 표시
        let hasOperatorSelected = false;
        if (typeof game !== 'undefined' && game.selectedUnits && game.selectedUnits.size > 0) {
            game.selectedUnits.forEach(u => {
                if (u && !u.dead && u.stats?.operator === true) {
                    hasOperatorSelected = true;
                }
            });
        }

        Object.keys(CONFIG.units).forEach(key => {
            const u = CONFIG.units[key];
            if (!u) {
                console.warn(`[UI] Missing unit config for key: ${key}`);
                return;
            }

            // [R 4.2] 생산바에서 숨김 처리된 유닛은 버튼 생성 스킵
            if (u.hideFromUnitBar === true) return;

            // 버튼 DOM 생성
            const btn = document.createElement('div');
            btn.id = `btn-${key}`;
            btn.className = 'btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg shrink-0 cursor-pointer select-none';
            const isDroneOnly = (u.droneLaunchOnly === true);
            // 드론 버튼은 드론병 선택 시에만 표시
            const isVisible = isDroneOnly ? hasOperatorSelected : (!hasOperatorSelected && u.category === currentCategory);
            btn.style.display = isVisible ? 'flex' : 'none';

            // 캔버스 아이콘 (한 번만 그림)
            const iconCvs = document.createElement('canvas');
            iconCvs.width = 60; iconCvs.height = 40;
            const ctx = iconCvs.getContext('2d');

            let drew = false;
            try {
                ctx.save();
                ctx.translate(30, 25);
                const dummy = new Unit(key, 0, 0, 'player');
                dummy.hideHp = true;
                if (dummy.stats.type === 'air') dummy.y = 0;
                if (u.width > 50) ctx.scale(0.6, 0.6); else ctx.scale(0.8, 0.8);
                dummy.draw(ctx);
                ctx.restore();
                drew = true;
            } catch (_) {
                ctx.restore();
            }

            if (!drew) {
                const w = Math.max(10, Math.min(50, Math.round((Number(u.width) || 30) * 0.9)));
                const h = Math.max(6, Math.min(26, Math.round((Number(u.height) || 16) * 0.9)));
                ctx.fillStyle = u.color || '#38bdf8';
                ctx.globalAlpha = 0.9;
                ctx.fillRect((60 - w) / 2, (40 - h) / 2 + 6, w, h);
                ctx.globalAlpha = 1;
            }

            btn.appendChild(iconCvs);

            // 텍스트 및 오버레이 생성
            const nameSpan = document.createElement('span');
            nameSpan.className = 'font-bold text-[10px] z-10 absolute top-0 w-full text-center bg-black/30 text-white';
            // [Localization]
            nameSpan.setAttribute('data-lang', `unit_${key}_name`);
            nameSpan.innerText = (typeof Lang !== 'undefined') ? Lang.getText(`unit_${key}_name`) : u.name;
            // [R 4.2] 기본 라벨 보존(타겟팅 중 "취소" 토글용)
            nameSpan.dataset.defaultText = nameSpan.innerText;
            btn.appendChild(nameSpan);

            const countSpan = document.createElement('span');
            countSpan.className = 'count-text z-50 absolute bottom-1 right-1';
            countSpan.innerText = '--';
            btn.appendChild(countSpan);

            const cdDiv = document.createElement('div');
            cdDiv.className = 'cooldown-overlay h-0';
            btn.appendChild(cdDiv);

            const qBadge = document.createElement('div');
            qBadge.className = 'queue-badge hidden';
            qBadge.innerText = '0';
            btn.appendChild(qBadge);

            const colorBar = document.createElement('div');
            colorBar.className = 'absolute bottom-0 w-full h-1 z-10';
            colorBar.style.backgroundColor = u.color;
            btn.appendChild(colorBar);

            // 캐시에 저장 (매 프레임 검색 방지)
            this.elementCache[key] = { btn, nameSpan, countSpan, cdDiv, qBadge };
            this.lastValues[key] = { stock: -1, cdRatio: -1, queue: -1, active: null };

            // 이벤트 바인딩
            this.bindButtonEvents(btn, key);
            container.appendChild(btn);
        });
    },

    bindButtonEvents(btn, key) {
        btn.addEventListener('mouseenter', (e) => this.showUnitInfo(key, e));
        btn.addEventListener('mouseleave', () => this.hideUnitInfo());

        const targetingKeys = new Set([
            'tactical_drone',
            'stealth_drone',
            'blackhawk',
            'chinook',
            'tactical_missile',
            'emp',
            'nuke'
        ]);

        const startAction = (e) => {
            e.preventDefault();
            if (targetingKeys.has(key) && game.targetingType === key) {
                game.cancelTargeting();
                return;
            }
            game.startHold(key);
        };
        const endAction = (e) => { e.preventDefault(); game.endHold(key); };

        btn.addEventListener('mousedown', startAction);
        btn.addEventListener('mouseup', endAction);
        btn.addEventListener('mouseleave', endAction);
        btn.addEventListener('touchstart', startAction, { passive: false });
        btn.addEventListener('touchend', endAction, { passive: false });
        btn.addEventListener('touchcancel', endAction, { passive: false }); // [Mobile] Safety
    },

    // [OPTIMIZATION] 매 프레임 호출: 값이 변했을 때만 DOM 수정
    showExitConfirmation() {
        document.getElementById('exit-modal').classList.remove('hidden');
    },

    confirmExit(yes) {
        document.getElementById('exit-modal').classList.add('hidden');
        if (yes) {
            if (game.running) {
                game.backToLobby();
                // Replace state to lobby to keep history clean?
                // Actually backToLobby is enough, but we might want to pop state if it was pushed?
                // Logic: 
                // 1. User pressed Back -> Popstate Event -> Pushed History + Show Modal
                // 2. User Click Yes -> Go Lobby. (History state is now "Game" (top) -> "Lobby")
                // We should probably go back or replace state.
                history.replaceState({ page: 'lobby' }, "Lobby", "#lobby");
            } else {
                // In Lobby -> Exit?
                // Browser can't resize/close usually.
                // Just reload or do nothing?
                // User asked for "Exit?" window. If Yes -> maybe go to google.com or close window
                try {
                    window.close();
                } catch (e) {
                    location.href = 'about:blank';
                }
            }
        } else {
            // Cancel -> Stay.
            // If we pushed state in popstate event, we are effectively "forward" again?
            // If user pressed Back (Popped) -> We Pushed (Returned to state).
            // So we are fine.
        }
    },

    updateUnitButtons(cat, stock, cooldowns, supply, queue) {
        // [P0-2] 드론병이 선택되면 드론 버튼 표시
        let hasOperatorSelected = false;
        let deployableOperatorsCount = 0;
        if (typeof game !== 'undefined' && game.selectedUnits && game.selectedUnits.size > 0) {
            game.selectedUnits.forEach(u => {
                if (u && !u.dead && u.stats?.operator === true) {
                    hasOperatorSelected = true;
                    if (u.droneChargesLeft > 0 && (!u.ownedDrone || u.ownedDrone.dead)) {
                        deployableOperatorsCount++;
                    }
                }
            });
        }

        Object.keys(CONFIG.units).forEach(key => {
            const cache = this.elementCache[key];
            if (!cache) return;

            const u = CONFIG.units[key];
            const isDroneOnly = (u.droneLaunchOnly === true);
            // 드론 버튼은 드론병 선택 시에만 표시
            const isVisible = isDroneOnly ? hasOperatorSelected : (!hasOperatorSelected && u.category === cat);

            // 1. 카테고리 표시/숨김 최적화
            if (cache.btn.style.display !== (isVisible ? 'flex' : 'none')) {
                cache.btn.style.display = isVisible ? 'flex' : 'none';
            }
            if (!isVisible) return; // 안 보이면 업데이트 생략

            const last = this.lastValues[key];

            // [R 4.2] 타겟팅 토글 상태(버튼 라벨: 취소)
            if (cache.nameSpan) {
                const wantCancel = (game.targetingType === key);
                const defaultText = cache.nameSpan.dataset.defaultText || cache.nameSpan.innerText;
                const nextText = wantCancel ? '취소' : defaultText;
                if (cache.nameSpan.innerText !== nextText) {
                    cache.nameSpan.innerText = nextText;
                }
            }

            // 2. 재고/스킬 횟수 업데이트
            let currentCount;
            if (u.droneLaunchOnly) currentCount = deployableOperatorsCount;
            else if (u.isSkill) currentCount = game.skillCharges[u.chargeKey];
            else currentCount = stock[key];

            if (last.stock !== currentCount) {
                if (u.droneLaunchOnly) {
                    cache.countSpan.innerText = `${currentCount}기`;
                } else {
                    cache.countSpan.innerText = u.isSkill ? currentCount + '발' : currentCount;
                }
                last.stock = currentCount;
            }

            // 3. 쿨타임 업데이트
            const currentRatio = cooldowns[key] / u.cooldown;
            // 쿨타임이 0이거나 완료된 상태에서 불필요한 스타일 변경 방지
            if (Math.abs(last.cdRatio - currentRatio) > 0.01) {
                cache.cdDiv.style.height = `${currentRatio * 100}%`;
                last.cdRatio = currentRatio;
            }

            // 4. 대기열 뱃지
            const currentQ = queue ? queue[key] : 0;
            if (last.queue !== currentQ) {
                if (currentQ > 0) {
                    cache.qBadge.innerText = `+${currentQ}`;
                    cache.qBadge.classList.remove('hidden');
                } else {
                    cache.qBadge.classList.add('hidden');
                }
                last.queue = currentQ;
            }

            // 5. 버튼 활성/비활성 상태
            let isActive = true;
            if (u.droneLaunchOnly) {
                if (deployableOperatorsCount <= 0) isActive = false;
            } else if (u.isSkill) {
                if (game.skillCharges[u.chargeKey] <= 0) isActive = false;
            } else {
                if (supply < u.cost || stock[key] <= 0) isActive = false;
            }

            if (last.active !== isActive) {
                if (isActive) cache.btn.classList.remove('btn-disabled');
                else cache.btn.classList.add('btn-disabled');
                last.active = isActive;
            }
        });
    },

    showUnitInfo(key) {
        const u = CONFIG.units[key];
        const panel = document.getElementById('unit-info-panel');
        if (!panel) return;
        if (!panel) return;

        let name = u.name;
        let desc = u.description || '...';

        // [Localization]
        if (typeof Lang !== 'undefined') {
            name = Lang.getText(`unit_${key}_name`);
            desc = Lang.getText(`unit_${key}_desc`);
        }

        document.getElementById('info-name').innerText = name;
        document.getElementById('info-name').style.color = u.color;
        document.getElementById('info-role').innerText = u.role || '유닛';
        document.getElementById('info-desc').innerText = desc;
        panel.classList.add('visible');
    },

    hideUnitInfo() {
        const panel = document.getElementById('unit-info-panel');
        if (panel) panel.classList.remove('visible');
    },

    updateCategoryTab(currentCategory) {
        // [P0-2] 드론병 선택 시 드론 탭 표시
        let hasOperatorSelected = false;
        if (typeof game !== 'undefined' && game.selectedUnits && game.selectedUnits.size > 0) {
            game.selectedUnits.forEach(u => {
                if (u && !u.dead && u.stats?.operator === true) {
                    hasOperatorSelected = true;
                }
            });
        }

        const tabs = document.querySelectorAll('.btn-category');
        const droneOnlyTab = document.getElementById('tab-drone-only');

        if (hasOperatorSelected) {
            // 드론병 선택 시 드론 탭만 표시
            tabs.forEach(btn => {
                if (btn.id === 'tab-drone-only') {
                    btn.classList.remove('hidden');
                    btn.classList.add('active');
                } else {
                    btn.classList.add('hidden');
                    btn.classList.remove('active');
                }
            });
        } else {
            // 일반 상태: 모든 탭 표시 (드론 탭 제외)
            tabs.forEach(btn => {
                btn.classList.remove('hidden');
                btn.classList.remove('active');
            });
            if (droneOnlyTab) droneOnlyTab.classList.add('hidden');
            const tab = document.getElementById(`tab-${currentCategory}`);
            if (tab) tab.classList.add('active');
        }
        // 카테고리가 바뀌면 즉시 버튼 갱신 트리거
        this.updateUnitButtons(currentCategory, game.playerStock, game.cooldowns, game.supply, game.spawnQueue);
    },

    updateEnemyStatus(enemyStock) {
        const headRow = document.getElementById('enemy-status-head-row');
        const countRow = document.getElementById('enemy-status-count-row');
        const stateRow = document.getElementById('enemy-status-state-row');
        if (!headRow || !countRow || !stateRow) return;

        // 표시할 유닛만: "현재 존재하는 유닛" 위주로 보여서 컬럼 폭발 방지
        // (스크롤 없게 하려면 0개 유닛까지 전부 보여주면 화면이 무너짐)
        const entries = Object.entries(enemyStock || {})
            .filter(([k, c]) => CONFIG.units[k] && c > 0)
            .sort((a, b) => (b[1] - a[1])); // 수량 많은 순

        // 초기화
        headRow.innerHTML = '';
        countRow.innerHTML = '';
        stateRow.innerHTML = '';

        if (entries.length === 0) {
            headRow.innerHTML = `<th class="stub">유닛</th><th>없음</th>`;
            countRow.innerHTML = `<th class="stub">수량</th><td class="text-center text-gray-400">0</td>`;
            stateRow.innerHTML = `<th class="stub">상태</th><td class="text-center text-gray-400">-</td>`;
            return;
        }

        // 헤더(유닛명)
        headRow.innerHTML = `<th class="stub">유닛</th>` + entries.map(([k]) => {
            const u = CONFIG.units[k];
            return `<th title="${u.name}">${u.name}</th>`;
        }).join('');

        // 수량
        countRow.innerHTML = `<th class="stub">수량</th>` + entries.map(([k, c]) => {
            return `<td class="text-center num">${c}</td>`;
        }).join('');

        // 상태
        stateRow.innerHTML = `<th class="stub">상태</th>` + entries.map(([k, c]) => {
            let cls = 'ok', txt = '양호';
            if (c <= 0) { cls = 'dead'; txt = '전멸'; }
            else if (c < 3) { cls = 'warn'; txt = '위험'; }
            return `<td class="text-center state ${cls}">${txt}</td>`;
        }).join('');
    },

    setSkillCount(type, count) {
        const el = document.getElementById(`cnt-${type}`);
        if (el) el.innerText = count + "발";
        const btn = document.getElementById(`btn-${type}`);
        if (btn) {
            if (count <= 0) btn.classList.add('used');
            else btn.classList.remove('used');
        }
    },

    // [New] Options Modal Logic
    openOptions() {
        document.getElementById('option-modal').classList.add('active');
        // Update slider values
        if (typeof AudioSystem !== 'undefined') {
            document.getElementById('vol-master-val').innerText = parseInt(AudioSystem.volume.master * 100) + '%';
            document.querySelector("input[oninput*='master']").value = AudioSystem.volume.master * 100;

            document.getElementById('vol-bgm-val').innerText = parseInt(AudioSystem.volume.bgm * 100) + '%';
            document.querySelector("input[oninput*='bgm']").value = AudioSystem.volume.bgm * 100;

            document.getElementById('vol-sfx-val').innerText = parseInt(AudioSystem.volume.sfx * 100) + '%';
            document.querySelector("input[oninput*='sfx']").value = AudioSystem.volume.sfx * 100;
        }

        // Sync Speed Buttons
        if (typeof game !== 'undefined') this.updateSpeedBtns(game.speed);
    },

    closeOptions() {
        document.getElementById('option-modal').classList.remove('active');
    },

    setVolume(type, val) {
        const v = val / 100;
        if (typeof AudioSystem !== 'undefined') {
            if (type === 'bgm') AudioSystem.setBGMVolume(v);
            else AudioSystem.setVolume(type, v);
        }
        document.getElementById(`vol-${type}-val`).innerText = val + '%';
    },

    changeBGM(val) {
        if (typeof AudioSystem !== 'undefined') AudioSystem.playMP3(val);
    },

    updateDiffBtn(btn) {
        const allBtns = document.querySelectorAll('.btn-diff');

        // 1. Reset ALL buttons to "Dimmed" state
        allBtns.forEach(b => {
            // Remove ALL color/active classes
            b.classList.remove(
                'active', 'scale-105', 'scale-110', 'opacity-100', 'z-10', 'ring-2', 'ring-4', 'ring-offset-2', 'ring-offset-slate-950',
                'border-green-500', 'border-blue-500', 'border-red-500',
                'ring-green-500', 'ring-blue-500', 'ring-red-500',
                'bg-green-900', 'bg-blue-900', 'bg-red-900'
            );

            // Add "Inactive" styling
            b.classList.add('border-slate-800', 'bg-slate-900', 'opacity-40', 'scale-95');

            // Reset text/icons to gray
            const icon = b.querySelector('i');
            const text = b.querySelector('span[data-lang]');
            if (icon) icon.className = icon.className.replace(/text-\w+-\d+/g, 'text-gray-600');
            if (text) { text.classList.remove('text-white'); text.classList.add('text-gray-600'); }
        });

        // 2. Highlight SELECTED button
        const diff = btn.getAttribute('data-diff');
        btn.classList.remove('border-slate-800', 'bg-slate-900', 'opacity-40', 'scale-95');
        btn.classList.add('active', 'bg-slate-800', 'scale-110', 'opacity-100', 'z-10', 'ring-4', 'ring-offset-2', 'ring-offset-slate-950');

        const icon = btn.querySelector('i');
        const text = btn.querySelector('span[data-lang]');
        const statusEl = document.getElementById('diff-status-text');

        let diffName = "";
        let colorClass = "";

        if (diff === 'recruit') {
            btn.classList.add('border-green-500', 'ring-green-500');
            if (icon) { icon.classList.remove('text-gray-600'); icon.classList.add('text-green-500'); }
            diffName = "RECRUIT (EASY)";
            colorClass = "text-green-400";
        } else if (diff === 'veteran') {
            btn.classList.add('border-blue-500', 'ring-blue-500');
            if (icon) { icon.classList.remove('text-gray-600'); icon.classList.add('text-blue-500'); }
            diffName = "VETERAN (NORMAL)";
            colorClass = "text-blue-400";
        } else if (diff === 'elite') {
            btn.classList.add('border-red-500', 'ring-red-500');
            if (icon) { icon.classList.remove('text-gray-600'); icon.classList.add('text-red-500'); }
            diffName = "ELITE (HARD)";
            colorClass = "text-red-500";
        }

        if (text) { text.classList.remove('text-gray-600'); text.classList.add('text-white'); }

        // [REMOVED] Status Text update as per request
    },

    updateSpeedBtns(s) {
        // HUD Buttons only (options panel no longer has speed buttons)
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-speed-${s}`);
        if (activeBtn) activeBtn.classList.add('active');
    }
};


