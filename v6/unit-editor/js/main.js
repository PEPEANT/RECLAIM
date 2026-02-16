/**
 * MAIN.JS
 * Application initialization and startup
 */

const App = {
    /**
     * Initialize the application
     */
    async init() {
        console.log('Unit Editor v2.0 initializing...');

        try {
            // Initialize Toast first
            Toast.init();

            // Initialize canvas
            const canvas = document.getElementById('canvas');
            if (!canvas) {
                throw new Error('Canvas element not found');
            }
            CanvasRenderer.init(canvas);
            Interaction.init(canvas);

            // Initialize UI
            UIPanel.init();
            MenuBar.init();

            // Initialize Preview Mode modules
            if (typeof PreviewPanel !== 'undefined') {
                PreviewPanel.init();
            }
            if (typeof PreviewMode !== 'undefined') {
                PreviewMode.init();
            }

            // Bind mode toggle events
            this.bindModeToggle();

            // Load unit index
            await UnitLoader.loadIndex();

            // Load default unit
            await this.loadDefaultUnit();

            // Start animation loop
            CanvasRenderer.startAnimation();

            // Update all UI elements
            this.refreshUI();

            console.log('Unit Editor initialized successfully!');
            Toast.show('에디터 준비 완료!', 'success');

        } catch (error) {
            console.error('Initialization error:', error);
            Toast.show('초기화 오류: ' + error.message, 'error');
        }
    },

    /**
     * Load default unit
     */
    async loadDefaultUnit() {
        // Try to load special_forces as default
        try {
            await UnitLoader.loadUnit('special_forces');
        } catch (error) {
            console.warn('Failed to load default unit, using fallback');
            UnitLoader.getFallbackUnit('special_forces');
        }
    },

    /**
     * Refresh all UI elements
     */
    refreshUI() {
        UIPanel.renderUnitList();
        UIPanel.updateProfile();
        UIPanel.buildPartsPanel();
        UIPanel.updateJsonOutput();
        UIPanel.updateToolbar();
        UIPanel.updateOptionBar();
        UIPanel.updateZoomLevel();
        UIPanel.updateXrayStatus();
    },

    /**
     * Bind mode toggle button events
     */
    bindModeToggle() {
        const modeToggle = document.getElementById('modeToggle');
        if (!modeToggle) return;

        const buttons = modeToggle.querySelectorAll('.mode-toggle-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                if (!mode) return;

                // Update button states
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Change editor mode
                EditorState.setEditorMode(mode);

                // Show toast notification
                if (mode === 'preview') {
                    Toast.show('미리보기 모드로 전환', 'info');
                } else {
                    Toast.show('편집 모드로 전환', 'info');
                }
            });
        });

        // Listen for mode changes from other sources
        EditorState.on('editorModeChanged', ({ mode }) => {
            buttons.forEach(b => {
                b.classList.toggle('active', b.dataset.mode === mode);
            });
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.App = App;
}
