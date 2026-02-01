/**
 * MENU-BAR.JS
 * Menu bar rendering and interaction (React-style implementation)
 */

const MenuBar = {
    /**
     * Initialize menu bar
     */
    init() {
        this.render();
        this.bindEvents();
    },

    /**
     * Render menu bar
     */
    render() {
        const container = document.getElementById('menuItems');
        if (!container) return;

        container.innerHTML = '';

        MENUS.forEach(menu => {
            const menuItem = document.createElement('div');
            menuItem.className = `menu-item ${EditorState.activeMenu === menu.label ? 'active' : ''}`;
            menuItem.innerHTML = `
                <span>${menu.label}</span>
                <div class="menu-dropdown">
                    ${this.renderMenuItems(menu.items)}
                </div>
            `;

            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (EditorState.activeMenu === menu.label) {
                    EditorState.activeMenu = null;
                } else {
                    EditorState.activeMenu = menu.label;
                }
                this.render();
            });

            container.appendChild(menuItem);
        });
    },

    /**
     * Render menu items
     * @param {Array} items - Menu items
     * @returns {string} HTML string
     */
    renderMenuItems(items) {
        return items.map(item => {
            if (item.type === 'divider') {
                return '<div class="menu-divider"></div>';
            }

            const isChecked = item.checkable && item.stateKey && EditorState[item.stateKey];
            const checkMark = isChecked ? '<span class="check">✓</span>' : '';

            return `
                <div class="menu-dropdown-item" data-action="${item.action || ''}">
                    ${item.icon ? `<span class="icon">${item.icon}</span>` : ''}
                    <span>${item.label}</span>
                    ${checkMark}
                    ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
                </div>
            `;
        }).join('');
    },

    /**
     * Bind menu events
     */
    bindEvents() {
        // Close menu when clicking outside
        document.addEventListener('click', () => {
            if (EditorState.activeMenu) {
                EditorState.activeMenu = null;
                this.render();
            }
        });

        // Delegate click events for menu items
        document.getElementById('menuItems')?.addEventListener('click', (e) => {
            const item = e.target.closest('.menu-dropdown-item');
            if (item) {
                const action = item.dataset.action;
                if (action) {
                    this.handleAction(action);
                    EditorState.activeMenu = null;
                    this.render();
                }
            }
        });
    },

    /**
     * Handle menu action
     * @param {string} action - Action name
     */
    handleAction(action) {
        switch (action) {
            // File menu
            case 'newUnit':
                Interaction.executeAction('newUnit');
                break;
            case 'openUnit':
                Interaction.executeAction('openUnit');
                break;
            case 'saveUnit':
                UnitLoader.saveUnit();
                break;
            case 'saveUnitAs':
                const newName = prompt('새 유닛 ID를 입력하세요:', EditorState.currentUnitId || 'unit');
                if (newName && EditorState.unitData) {
                    EditorState.unitData.id = newName;
                    EditorState.unitData.name = newName;
                    UnitLoader.saveUnit();
                }
                break;
            case 'exportJson':
                UnitLoader.exportSimplified();
                break;
            case 'importJson':
                this.showImportDialog();
                break;

            // Edit menu
            case 'undo':
                Interaction.executeAction('undo');
                break;
            case 'redo':
                Interaction.executeAction('redo');
                break;
            case 'cut':
                Toast.show('잘라내기 (구현 예정)', 'info');
                break;
            case 'copy':
                UnitLoader.copyToClipboard();
                break;
            case 'paste':
                UnitLoader.pasteFromClipboard();
                break;
            case 'selectAll':
                Toast.show('모두 선택 (구현 예정)', 'info');
                break;
            case 'deselect':
                EditorState.selectPart(null);
                break;

            // View menu
            case 'zoomIn':
                Interaction.executeAction('zoomIn');
                break;
            case 'zoomOut':
                Interaction.executeAction('zoomOut');
                break;
            case 'zoomReset':
                Interaction.executeAction('zoomReset');
                break;
            case 'toggleXray':
                EditorState.toggleXray();
                UIPanel.updateXrayStatus();
                break;
            case 'toggleGrid':
                EditorState.showGrid = !EditorState.showGrid;
                CanvasRenderer.draw();
                break;
            case 'toggleHandles':
                EditorState.showHandles = !EditorState.showHandles;
                CanvasRenderer.draw();
                break;

            // Window menu
            case 'toggleTransform':
                EditorState.showTransform = !EditorState.showTransform;
                UIPanel.togglePanel('transform');
                break;
            case 'toggleAnimation':
                EditorState.showAnimation = !EditorState.showAnimation;
                UIPanel.togglePanel('animation');
                break;
            case 'showLayers':
                UIPanel.switchTab('layers');
                break;
            case 'showProperties':
                UIPanel.switchTab('properties');
                break;

            // Help menu
            case 'showShortcuts':
                Interaction.executeAction('showShortcuts');
                break;
            case 'showGuide':
                Toast.show('사용 가이드 (준비 중)', 'info');
                break;
            case 'showAbout':
                alert(`Unit Blueprint Editor v2.0

React 참고 스타일로 리팩토링된 유닛 에디터입니다.

기능:
- 유닛별 JSON 파일 관리
- 실시간 캔버스 편집
- 엑스레이 모드
- Undo/Redo 지원`);
                break;

            default:
                console.log('Unknown action:', action);
        }
    },

    /**
     * Show import dialog (file input + importFromFile)
     */
    showImportDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await UnitLoader.importFromFile(file);
                    UIPanel.showCurrentUnitInfo();
                    UIPanel.updateProfile();
                    UIPanel.buildPartsPanel();
                    UIPanel.updateJsonOutput();
                    CanvasRenderer.draw();
                    // Add imported unit to list if not already present
                    const id = EditorState.currentUnitId;
                    if (id && EditorState.availableUnits && !EditorState.availableUnits.some(u => u.id === id)) {
                        EditorState.availableUnits.push({
                            id,
                            name: EditorState.unitData?.name || id,
                            type: EditorState.unitData?.type || 'infantry'
                        });
                        UIPanel.renderUnitList();
                    }
                } catch (err) {
                    console.error('Import error:', err);
                }
            }
        });
        input.click();
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.MenuBar = MenuBar;
}
