/**
 * PREVIEW-PANEL.JS
 * UI panel for preview mode controls
 */

const PreviewPanel = {
    panelElement: null,
    initialized: false,

    /**
     * Initialize the preview panel
     */
    init() {
        if (this.initialized) return;
        this.createPanel();
        this.initialized = true;

        // Listen for preview state changes
        EditorState.on('previewStateChanged', () => {
            this.updateControls();
        });

        // Listen for unit changes
        EditorState.on('unitChanged', () => {
            if (EditorState.editorMode === 'preview') {
                this.updateUnitModeControls();
            }
        });
    },

    /**
     * Create the preview control panel DOM
     */
    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'previewControlPanel';
        panel.className = 'preview-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div class="preview-panel-header">
                <h3>미리보기 컨트롤</h3>
            </div>
            <div class="preview-panel-content">
                <!-- Team Selection -->
                <div class="control-group">
                    <label>팀 선택</label>
                    <div class="button-group">
                        <button id="previewTeamPlayer" class="team-btn active" data-team="player">
                            <span class="team-dot player"></span> Player
                        </button>
                        <button id="previewTeamEnemy" class="team-btn" data-team="enemy">
                            <span class="team-dot enemy"></span> Enemy
                        </button>
                    </div>
                </div>

                <!-- Facing Direction -->
                <div class="control-group">
                    <label>방향</label>
                    <div class="button-group">
                        <button id="previewFacingRight" class="facing-btn active" data-facing="1">
                            → 오른쪽
                        </button>
                        <button id="previewFacingLeft" class="facing-btn" data-facing="-1">
                            ← 왼쪽
                        </button>
                    </div>
                </div>

                <!-- Sound Toggle -->
                <div class="control-group">
                    <label>사운드</label>
                    <button id="previewSoundToggle" class="toggle-btn active">
                        <span class="sound-icon">🔊</span> ON
                    </button>
                </div>

                <!-- 2-Mode Unit Controls (shown only for applicable units) -->
                <div class="control-group" id="previewUnitModeGroup" style="display: none;">
                    <label>유닛 모드</label>
                    <div class="button-group" id="previewUnitModeButtons"></div>
                </div>

                <!-- Test Actions -->
                <div class="control-group">
                    <label>테스트 액션</label>
                    <button id="previewTestAttack" class="action-btn attack">
                        ⚔️ 공격 테스트
                    </button>
                    <button id="previewTestDeath" class="action-btn danger">
                        💥 사망 테스트
                    </button>
                </div>

                <!-- Info -->
                <div class="control-group preview-info">
                    <div class="info-row">
                        <span class="info-label">현재 유닛:</span>
                        <span id="previewUnitName" class="info-value">-</span>
                    </div>
                </div>
            </div>
        `;

        // Find sidebar and append
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.appendChild(panel);
        } else {
            document.body.appendChild(panel);
        }

        this.panelElement = panel;
        this.bindEvents();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Team selection
        document.getElementById('previewTeamPlayer')?.addEventListener('click', () => {
            EditorState.setPreviewTeam('player');
        });

        document.getElementById('previewTeamEnemy')?.addEventListener('click', () => {
            EditorState.setPreviewTeam('enemy');
        });

        // Facing direction
        document.getElementById('previewFacingRight')?.addEventListener('click', () => {
            EditorState.setPreviewFacing(1);
        });

        document.getElementById('previewFacingLeft')?.addEventListener('click', () => {
            EditorState.setPreviewFacing(-1);
        });

        // Sound toggle
        document.getElementById('previewSoundToggle')?.addEventListener('click', () => {
            EditorState.togglePreviewSound();
        });

        // Test actions
        document.getElementById('previewTestAttack')?.addEventListener('click', () => {
            if (typeof PreviewMode !== 'undefined') {
                PreviewMode.playAttackAnimation();
            }
        });

        document.getElementById('previewTestDeath')?.addEventListener('click', () => {
            if (typeof PreviewMode !== 'undefined') {
                PreviewMode.playDeathAnimation();
            }
        });
    },

    /**
     * Show the preview panel
     */
    show() {
        if (!this.initialized) {
            this.init();
        }

        if (this.panelElement) {
            this.panelElement.style.display = 'block';
            this.updateControls();
            this.updateUnitModeControls();
            this.updateUnitInfo();
        }
    },

    /**
     * Hide the preview panel
     */
    hide() {
        if (this.panelElement) {
            this.panelElement.style.display = 'none';
        }
    },

    /**
     * Update all control states
     */
    updateControls() {
        this.updateTeamButtons();
        this.updateFacingButtons();
        this.updateSoundButton();
    },

    /**
     * Update team selection buttons
     */
    updateTeamButtons() {
        const team = EditorState.previewState.team;
        const playerBtn = document.getElementById('previewTeamPlayer');
        const enemyBtn = document.getElementById('previewTeamEnemy');

        if (playerBtn) {
            playerBtn.classList.toggle('active', team === 'player');
        }
        if (enemyBtn) {
            enemyBtn.classList.toggle('active', team === 'enemy');
        }
    },

    /**
     * Update facing direction buttons
     */
    updateFacingButtons() {
        const facing = EditorState.previewState.facing;
        const rightBtn = document.getElementById('previewFacingRight');
        const leftBtn = document.getElementById('previewFacingLeft');

        if (rightBtn) {
            rightBtn.classList.toggle('active', facing === 1);
        }
        if (leftBtn) {
            leftBtn.classList.toggle('active', facing === -1);
        }
    },

    /**
     * Update sound toggle button
     */
    updateSoundButton() {
        const enabled = EditorState.previewState.soundEnabled;
        const btn = document.getElementById('previewSoundToggle');

        if (btn) {
            btn.classList.toggle('active', enabled);
            btn.innerHTML = enabled
                ? '<span class="sound-icon">🔊</span> ON'
                : '<span class="sound-icon">🔇</span> OFF';
        }
    },

    /**
     * Update unit mode controls (for 2-mode units)
     */
    updateUnitModeControls() {
        const modeGroup = document.getElementById('previewUnitModeGroup');
        const modeButtons = document.getElementById('previewUnitModeButtons');

        if (!modeGroup || !modeButtons) return;

        const modeInfo = EditorState.getUnitModeInfo();

        if (!modeInfo) {
            modeGroup.style.display = 'none';
            return;
        }

        // Show the mode group
        modeGroup.style.display = 'block';

        // Generate buttons
        const currentMode = EditorState.previewState.unitMode || modeInfo.default;
        modeButtons.innerHTML = modeInfo.modes.map((mode, idx) => {
            const isActive = mode === currentMode;
            return `<button class="mode-btn ${isActive ? 'active' : ''}" data-mode="${mode}">
                ${modeInfo.labels[idx]}
            </button>`;
        }).join('');

        // Bind mode button events
        modeButtons.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                EditorState.setPreviewUnitMode(mode);

                // Update button states
                modeButtons.querySelectorAll('.mode-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.mode === mode);
                });

                // Redraw
                if (typeof CanvasRenderer !== 'undefined') {
                    CanvasRenderer.draw();
                }
            });
        });
    },

    /**
     * Update unit info display
     */
    updateUnitInfo() {
        const nameEl = document.getElementById('previewUnitName');
        if (nameEl) {
            const unitId = EditorState.currentUnitId;
            const unitData = EditorState.unitData;
            nameEl.textContent = unitData?.name || unitId || '-';
        }
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PreviewPanel = PreviewPanel;
}
