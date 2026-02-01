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
