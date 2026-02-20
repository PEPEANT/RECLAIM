(function () {
    if (typeof window.game === 'undefined') return;
    Object.assign(window.game, {
        switchCampaignTab: function (tab) {
            if (tab !== 'occupation' && tab !== 'skirmish' && tab !== 'custom') return;
            this.ensureCampaignProgress();
            if (!this.isCampaignTabUnlocked(tab)) {
                this.updateCampaignTabLockUi();
                return;
            }

            // 커스텀 탭: 커스텀 설정 화면 표시
            const customScreen = document.getElementById('custom-battle-screen');
            const campaignRoot = document.getElementById('campaign-map-root');
            if (tab === 'custom') {
                this.activeCampaignTab = tab;
                document.querySelectorAll('.campaign-tab-btn').forEach((btn) => {
                    btn.classList.toggle('active', btn.dataset.tab === tab);
                });
                if (campaignRoot) campaignRoot.classList.add('hidden');
                const briefing = document.getElementById('campaign-briefing');
                if (briefing) briefing.classList.add('hidden');
                if (customScreen) {
                    customScreen.classList.remove('hidden');
                    this.renderCustomBattleScreen();
                }
                return;
            }

            // 국지전/점령전: 기존 캠페인 맵 표시
            if (customScreen) customScreen.classList.add('hidden');
            if (campaignRoot) campaignRoot.classList.remove('hidden');
            this.activeCampaignTab = tab;
            this.campaignBriefVisible = true;
            document.querySelectorAll('.campaign-tab-btn').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.tab === tab);
            });
            this.updateCampaignTabLockUi();
            const data = this._activeCampaign();
            const stage = this._getCampaignSelectedStage(data);
            if (stage) {
                data.selectedStageId = stage.id;
            }
            this._centerCampaignViewOnIsland(data);
            this.renderCampaignMap();
        },

        openCampaignMap: function () {
            this.hideCityScreen();
            this.campaignBriefVisible = true;
            this._resetCampaignDragState();

            if (typeof LobbyBackground !== 'undefined') {
                LobbyBackground.stop();
            }

            document.getElementById('lobby-screen')?.classList.add('hidden');
            document.getElementById('difficulty-select-screen')?.classList.add('hidden');
            document.getElementById('map-select-screen')?.classList.add('hidden');
            document.getElementById('unitdex-screen')?.classList.add('hidden');
            document.getElementById('campaign-screen')?.classList.remove('hidden');
            this.playMapSelectBgm();

            this.bindCampaignEvents();
            this.activeCampaignTab = 'skirmish';
            this.ensureCampaignProgress();
            const data = this._activeCampaign();
            const stage = this._getCampaignSelectedStage(data);
            if (stage) {
                data.selectedStageId = stage.id;
            }
            this._centerCampaignViewOnIsland(data);
            this.renderCampaignMap();
        }
    });
})();
