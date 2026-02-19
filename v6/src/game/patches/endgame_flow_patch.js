(function () {
    if (typeof window.game === 'undefined') return;
    Object.assign(window.game, {
        _stopPersistentBattleSfx() {
            const visited = new Set();
            const unitLists = [this.players, this.enemies, this.civilians];

            unitLists.forEach((list) => {
                if (!Array.isArray(list)) return;
                list.forEach((unit) => {
                    if (!unit || visited.has(unit)) return;
                    visited.add(unit);
                    if (typeof unit._stopTankMGSound === 'function') {
                        try { unit._stopTankMGSound(); } catch (_) { }
                    }
                });
            });

            if (typeof AudioSystem !== 'undefined' && typeof AudioSystem.stopIcbmRaise === 'function') {
                try { AudioSystem.stopIcbmRaise(true); } catch (_) { }
            }
        },

        // [FIX] 메모리 누수 방지 - 게임 종료 시 타이머 정리
        _cleanupTimers() {
            // 전투 루프 정지 시 잔류 사운드(MBT 기관총/ICBM 상승음) 정리
            this._stopPersistentBattleSfx();

            // AI 타이머 정리
            if (typeof AI !== 'undefined') {
                if (AI._nukeWarningTimeout) { clearTimeout(AI._nukeWarningTimeout); AI._nukeWarningTimeout = null; }
                if (AI._tacticalWarningTimeout) { clearTimeout(AI._tacticalWarningTimeout); AI._tacticalWarningTimeout = null; }
            }
            // 폭격기 에어레이드 타이머 정리
            if (this.airRaidBomberTimeout) { clearTimeout(this.airRaidBomberTimeout); this.airRaidBomberTimeout = null; }
            // 미니맵 인터벌 정리
            if (this._minimapInterval) { clearInterval(this._minimapInterval); this._minimapInterval = null; }
            // 유닛 생산 홀드 타이머 정리
            if (this.holdTimer) { clearInterval(this.holdTimer); this.holdTimer = null; }
            // 뉴스 타이머 정리
            if (typeof NewsOverlay !== 'undefined') {
                if (NewsOverlay._showTimer) { clearTimeout(NewsOverlay._showTimer); NewsOverlay._showTimer = null; }
                if (NewsOverlay._hideTimer) { clearTimeout(NewsOverlay._hideTimer); NewsOverlay._hideTimer = null; }
            }
            if (typeof NewsIntro !== 'undefined' && NewsIntro._timer) {
                clearTimeout(NewsIntro._timer); NewsIntro._timer = null;
            }
        },

        endGame(result, title, desc) {
            if (this.isGameOver) return;
            this.isGameOver = true;
            this.running = false;
            this._uiRecoverySuspendUntil = Date.now() + 3000;

            // 국지전 모드 정리
            try {
                this._cleanupSkirmishSession();
            } catch (err) {
                console.warn('[endGame] skirmish cleanup failed:', err);
            }

            // [FIX] 메모리 누수 방지 - 타이머 정리
            try {
                this._cleanupTimers();
            } catch (err) {
                console.warn('[endGame] timer cleanup failed:', err);
            }

            try {
                if (result === 'win') {
                    if (typeof Maps !== 'undefined' && Maps.currentMap) {
                        this.markMapCleared(Maps.currentMap);
                    }
                }
            } catch (err) {
                console.warn('[endGame] map clear mark failed:', err);
            }

            const campaignStageId = Math.floor(Number(this.activeCampaignStageId) || 0);
            if (campaignStageId > 0) {
                try {
                    this.completeCampaignStage(campaignStageId, result === 'win');
                } catch (err) {
                    console.warn('[endGame] completeCampaignStage failed:', err);
                }
                this.activeCampaignStageId = null;
            }
            this._campaignBattleTab = '';

            // [NEW] 게임 오버(승/패 무관)에도 난이도/맵 진행도 저장
            if (typeof app !== 'undefined' && app.saveNow) {
                try {
                    app.saveNow();
                } catch (err) {
                    console.warn('[endGame] app save failed:', err);
                }
            }

            // [R 4.2] 작전실패 시 하단 유닛생성바 숨김
            this.cancelTargeting();
            document.getElementById('unit-panel-container')?.classList.add('hidden');
            document.getElementById('hud-footer')?.classList.add('hidden');
            if (typeof HUD !== 'undefined') HUD.hide();
            if (typeof NewsIntro !== 'undefined') NewsIntro.hide();
            if (typeof NewsOverlay !== 'undefined') NewsOverlay.hide();

            const s = document.getElementById('end-screen');
            const titleEl = document.getElementById('end-title');
            const descEl = document.getElementById('end-desc');
            if (s) {
                s.classList.remove('hidden');
                s.style.display = 'flex';
            }
            if (titleEl) {
                titleEl.innerText = title;
                titleEl.className = `text-5xl font-bold mb-4 ${result === 'win' ? 'text-blue-500' : 'text-red-500'}`;
            }
            if (descEl) {
                descEl.innerText = desc;
            }
        },

        backToLobby() {
            this.running = false;
            this.isGameOver = false;
            this._uiRecoverySuspendUntil = Date.now() + 1500;

            if (this.loopId) {
                cancelAnimationFrame(this.loopId);
                this.loopId = null;
            }

            if (typeof this._cleanupTimers === 'function') {
                try { this._cleanupTimers(); } catch (err) { console.warn('[backToLobby] timer cleanup failed:', err); }
            }

            if (typeof this.saveCitySimState === 'function') {
                try { this.saveCitySimState(); } catch (err) { console.warn('[backToLobby] city save failed:', err); }
            }
            if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
                try { app.saveNow(); } catch (err) { console.warn('[backToLobby] app save failed:', err); }
            }

            try { this._cleanupSkirmishSession(); } catch (err) { console.warn('[backToLobby] skirmish cleanup failed:', err); }
            try { this._forceHideBattleUI(); } catch (err) { console.warn('[backToLobby] battle ui cleanup failed:', err); }

            document.getElementById('map-select-screen')?.classList.add('hidden');
            document.getElementById('difficulty-select-screen')?.classList.add('hidden');
            document.getElementById('campaign-screen')?.classList.add('hidden');
            document.getElementById('unitdex-screen')?.classList.add('hidden');
            try { this.hideCityScreen(); } catch (err) { console.warn('[backToLobby] hideCityScreen failed:', err); }
            document.getElementById('unit-cmd-wrapper')?.classList.add('hidden');
            document.getElementById('unit-cmd-panel')?.classList.add('hidden');

            // [FIX] 로비로 복귀
            document.getElementById('lobby-screen')?.classList.remove('hidden');

            // [NEW] 로비 배경 재시작
            if (typeof LobbyBackground !== 'undefined') {
                LobbyBackground.start();
            }

            // Switch back to Lobby BGM
            if (typeof AudioSystem !== 'undefined') {
                if (typeof AudioSystem.stopIcbmRaise === 'function') AudioSystem.stopIcbmRaise(true);
                AudioSystem.playMP3(0);
            }
        }
    });
})();
