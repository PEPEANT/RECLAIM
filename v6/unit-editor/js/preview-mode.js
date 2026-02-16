/**
 * PREVIEW-MODE.JS
 * Controls preview mode functionality
 */

const PreviewMode = {
    animationTimer: null,
    audioInitialized: false,

    /**
     * Initialize preview mode
     */
    init() {
        // Listen for mode changes
        EditorState.on('editorModeChanged', ({ mode }) => {
            if (mode === 'preview') {
                this.enterPreviewMode();
            } else {
                this.exitPreviewMode();
            }
        });

        // Listen for unit changes to update mode controls
        EditorState.on('unitChanged', () => {
            if (EditorState.editorMode === 'preview') {
                this.updateUnitModeDefault();
            }
        });
    },

    /**
     * Enter preview mode
     */
    enterPreviewMode() {
        // Disable editing interactions
        if (typeof Interaction !== 'undefined' && Interaction.disable) {
            Interaction.disable();
        }

        // Add preview-mode class to body
        document.body.classList.add('preview-mode');

        // Show preview controls panel
        if (typeof PreviewPanel !== 'undefined') {
            PreviewPanel.show();
        }

        // Set default unit mode
        this.updateUnitModeDefault();

        // Start rotor animation loop
        this.startAnimation();

        // Initialize audio if needed
        this.initAudio();

        // Redraw canvas
        if (typeof CanvasRenderer !== 'undefined') {
            CanvasRenderer.draw();
        }
    },

    /**
     * Exit preview mode
     */
    exitPreviewMode() {
        // Re-enable editing
        if (typeof Interaction !== 'undefined' && Interaction.enable) {
            Interaction.enable();
        }

        // Remove preview-mode class
        document.body.classList.remove('preview-mode');

        // Hide preview controls
        if (typeof PreviewPanel !== 'undefined') {
            PreviewPanel.hide();
        }

        // Stop animations
        this.stopAnimation();

        // Redraw canvas
        if (typeof CanvasRenderer !== 'undefined') {
            CanvasRenderer.draw();
        }
    },

    /**
     * Update unit mode default based on current unit
     */
    updateUnitModeDefault() {
        const modeInfo = EditorState.getUnitModeInfo();
        if (modeInfo) {
            EditorState.setPreviewUnitMode(modeInfo.default);
        } else {
            EditorState.setPreviewUnitMode(null);
        }
    },

    /**
     * Start animation loop for rotors
     */
    startAnimation() {
        const animate = () => {
            EditorState.rotorAngle += 0.15;
            if (typeof CanvasRenderer !== 'undefined') {
                CanvasRenderer.draw();
            }
            this.animationTimer = requestAnimationFrame(animate);
        };
        animate();
    },

    /**
     * Stop animation loop
     */
    stopAnimation() {
        if (this.animationTimer) {
            cancelAnimationFrame(this.animationTimer);
            this.animationTimer = null;
        }
    },

    /**
     * Initialize audio system (lazy load)
     */
    async initAudio() {
        if (typeof AudioSystem === 'undefined') {
            console.warn('AudioSystem not loaded');
            return;
        }

        try {
            // Initialize if not already
            if (!AudioSystem.ctx) {
                AudioSystem.init();
            }

            // Resume AudioContext if suspended (browser autoplay policy)
            if (AudioSystem.ctx && AudioSystem.ctx.state === 'suspended') {
                await AudioSystem.ctx.resume();
                console.log('AudioContext resumed');
            }

            this.audioInitialized = true;
        } catch (e) {
            console.warn('AudioSystem init failed:', e);
        }
    },

    /**
     * Ensure audio is ready before playing (call on user interaction)
     */
    async ensureAudioReady() {
        if (typeof AudioSystem === 'undefined') return false;

        try {
            if (!AudioSystem.ctx) {
                AudioSystem.init();
            }
            if (AudioSystem.ctx && AudioSystem.ctx.state === 'suspended') {
                await AudioSystem.ctx.resume();
            }
            return true;
        } catch (e) {
            console.warn('Audio resume failed:', e);
            return false;
        }
    },

    // ==================== Test Actions ====================

    /**
     * Play attack animation and sound
     */
    async playAttackAnimation() {
        const unitId = EditorState.currentUnitId;
        if (!unitId) return;

        // Play sound if enabled
        if (EditorState.previewState.soundEnabled) {
            // Ensure audio is ready (user interaction)
            await this.ensureAudioReady();
            this.playAttackSound(unitId);
        }

        // Visual feedback (flash effect)
        this.showAttackEffect();
    },

    /**
     * Play attack sound based on unit type
     * Uses editor-specific paths (../bgm/) since editor is in unit-editor/ folder
     */
    playAttackSound(unitId) {
        const mode = EditorState.previewState.unitMode;

        // Sound file mapping for attack sounds
        const soundMap = {
            'infantry': '../bgm/gun.mp3',
            'special_forces': '../bgm/gun2.mp3',
            'humvee': '../bgm/machine_gun.mp3',
            'apc': '../bgm/flak.mp3',
            'blackhawk': '../bgm/machine_gun.mp3',
            'uh60': '../bgm/machine_gun.mp3',
            'aa_tank': '../bgm/flak.mp3',
            'turret': '../bgm/flak.mp3',
            'mbt': '../bgm/gun.mp3',
            'spg': '../bgm/self.mp3',
            'apache': '../bgm/self.mp3',
            'drone_operator': '../bgm/gun.mp3',
            'fighter': '../bgm/gun.mp3'
        };

        // Engineer special handling
        if (unitId === 'engineer' || unitId === 'rpg') {
            if (mode === 'firing') {
                this.playEditorSound('../bgm/rocket-launcher-301426.mp3', 0.6);
            } else {
                this.playEditorSound('../bgm/gun3.mp3', 0.5);
            }
            return;
        }

        // Get sound file or fallback
        const soundFile = soundMap[unitId] || '../bgm/gun.mp3';
        this.playEditorSound(soundFile, 0.5);
    },

    /**
     * Play sound file with editor-specific path
     * @param {string} path - Sound file path (relative to unit-editor/)
     * @param {number} volume - Volume (0-1)
     */
    playEditorSound(path, volume = 0.5) {
        try {
            const audio = new Audio(path);
            audio.volume = volume;
            const playPromise = audio.play();
            if (playPromise) {
                playPromise.catch(e => console.warn('Sound play failed:', e));
            }
        } catch (e) {
            console.warn('Sound error:', e);
        }
    },

    /**
     * Show attack visual effect
     */
    showAttackEffect() {
        // Flash the canvas briefly
        const canvas = document.getElementById('editor-canvas');
        if (!canvas) return;

        canvas.style.filter = 'brightness(1.3)';
        setTimeout(() => {
            canvas.style.filter = '';
        }, 100);
    },

    /**
     * Play death animation and sound
     */
    async playDeathAnimation() {
        const unitId = EditorState.currentUnitId;
        if (!unitId) return;

        // Play sound if enabled
        if (EditorState.previewState.soundEnabled) {
            // Ensure audio is ready (user interaction)
            await this.ensureAudioReady();
            this.playDeathSound(unitId);
        }

        // Visual feedback (shake + red flash)
        this.showDeathEffect();
    },

    /**
     * Play death sound based on unit type
     * Uses editor-specific paths (../bgm/) since editor is in unit-editor/ folder
     */
    playDeathSound(unitId) {
        // Sound file mapping for death/explosion sounds
        const soundMap = {
            'nuke': '../bgm/boom/boom-1.mp3',
            'tactical_drone': '../bgm/boom/boom-2.mp3',
            'drone_at': '../bgm/boom/death-exp3.mp3',
            'stealth_drone': '../bgm/boom/boom-3.mp3',
            'tactical_missile': '../bgm/boom/boom-3.mp3',
            'bomber': '../bgm/boom/boom-3.mp3',
            'spg': '../bgm/boom/boom-3.mp3',
            'drone_suicide': '../bgm/boom/death-exp2.mp3',
            'fighter': '../bgm/boom/death-exp.mp3',
            'apache': '../bgm/boom/death-exp.mp3',
            'blackhawk': '../bgm/boom/death-exp.mp3',
            'uh60': '../bgm/boom/death-exp.mp3',
            'chinook': '../bgm/boom/death-exp.mp3'
        };

        // Get sound file or fallback
        const soundFile = soundMap[unitId] || '../bgm/boom/boom-2.mp3';
        this.playEditorSound(soundFile, 0.7);
    },

    /**
     * Show death visual effect
     */
    showDeathEffect() {
        const canvas = document.getElementById('editor-canvas');
        if (!canvas) return;

        // Red flash + shake
        canvas.style.filter = 'brightness(1.5) sepia(0.5)';
        canvas.style.transform = 'translateX(5px)';

        setTimeout(() => {
            canvas.style.transform = 'translateX(-5px)';
        }, 50);

        setTimeout(() => {
            canvas.style.transform = 'translateX(3px)';
        }, 100);

        setTimeout(() => {
            canvas.style.filter = '';
            canvas.style.transform = '';
        }, 150);
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PreviewMode = PreviewMode;
}
