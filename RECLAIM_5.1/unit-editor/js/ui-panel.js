/**
 * UI-PANEL.JS
 * Sidebar panel rendering and updates
 */

const UIPanel = {
    /**
     * Initialize UI panels
     */
    init() {
        this.bindTabEvents();
        this.bindToolEvents();
        this.updateToolbar();
        this.renderUnitList();
        // Keep parts panel and transform panel in sync after selection/drag
        EditorState.on('selectionChanged', () => {
            this.buildPartsPanel();
            this.updateTransformPanel();
        });
        EditorState.on('partUpdated', () => {
            this.buildPartsPanel();
            this.updateTransformPanel();
        });
    },

    /**
     * Bind tab button events
     */
    bindTabEvents() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
    },

    /**
     * Switch active tab
     * @param {string} tabId - Tab ID
     */
    switchTab(tabId) {
        EditorState.activeTab = tabId;

        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === tabId + 'Pane');
        });

        // Render tab-specific content
        if (tabId === 'layers') {
            this.renderLayersPanel();
        } else if (tabId === 'units') {
            this.renderUnitList();
        } else if (tabId === 'parts') {
            this.buildPartsPanel();
        }
    },

    /**
     * Bind tool-related button events
     */
    bindToolEvents() {
        // Color picker apply
        document.getElementById('applyColor')?.addEventListener('click', () => {
            const part = EditorState.getSelectedPart();
            const picker = document.getElementById('colorPicker');
            if (!part) {
                Toast.show('먼저 파츠를 선택하세요.', 'error');
                return;
            }
            EditorState.saveToHistory();
            part.color = picker.value;
            EditorState.emit('partUpdated', { partName: EditorState.selectedPart, data: part });
            this.updateJsonOutput();
            CanvasRenderer.draw();
        });

        // Apply team color
        document.getElementById('applyTeam')?.addEventListener('click', () => {
            const part = EditorState.getSelectedPart();
            if (!part) {
                Toast.show('먼저 파츠를 선택하세요.', 'error');
                return;
            }
            EditorState.saveToHistory();
            part.color = 'team';
            EditorState.emit('partUpdated', { partName: EditorState.selectedPart, data: part });
            this.updateJsonOutput();
            CanvasRenderer.draw();
        });

        // Add line
        document.getElementById('addLine')?.addEventListener('click', () => {
            if (!EditorState.unitData) {
                Toast.show('먼저 유닛을 선택하세요.', 'error');
                return;
            }
            const picker = document.getElementById('colorPicker') || document.getElementById('toolbarColorPicker');
            const style = document.getElementById('lineStyle')?.value || 'solid';
            const name = EditorState.generatePartName('line');
            EditorState.saveToHistory();
            EditorState.addPart(name, {
                type: 'line',
                points: [{ x: -10, y: 0 }, { x: 10, y: 0 }],
                color: picker?.value || '#3b82f6',
                width: 2,
                lineStyle: style
            });
            EditorState.selectPart(name);
            this.buildPartsPanel();
            this.updateJsonOutput();
            this.updateProfile();
            CanvasRenderer.draw();
            Toast.show('Line 추가됨', 'success');
        });

        // Add shape
        document.getElementById('addShape')?.addEventListener('click', () => {
            if (!EditorState.unitData) {
                Toast.show('먼저 유닛을 선택하세요.', 'error');
                return;
            }
            const shapeType = document.getElementById('shapeType')?.value || 'rect';
            const picker = document.getElementById('colorPicker') || document.getElementById('toolbarColorPicker');
            const name = EditorState.generatePartName(shapeType);

            let partData;
            switch (shapeType) {
                case 'rect':
                    partData = { type: 'rect', x: -6, y: -6, w: 12, h: 12, color: picker?.value || '#3b82f6' };
                    break;
                case 'circle':
                    partData = { type: 'circle', x: 0, y: 0, r: 6, color: picker?.value || '#3b82f6' };
                    break;
                case 'arc':
                    partData = { type: 'arc', x: 0, y: 0, r: 8, color: picker?.value || '#3b82f6' };
                    break;
                case 'polygon':
                    partData = {
                        type: 'polygon',
                        points: [{ x: -8, y: -6 }, { x: 8, y: -6 }, { x: 8, y: 6 }, { x: -8, y: 6 }],
                        color: picker?.value || '#3b82f6'
                    };
                    break;
            }

            if (partData) {
                EditorState.saveToHistory();
                EditorState.addPart(name, partData);
                EditorState.selectPart(name);
                this.buildPartsPanel();
                this.updateJsonOutput();
                this.updateProfile();
                CanvasRenderer.draw();
                Toast.show(`${shapeType} 추가됨`, 'success');
            }
        });

        // Zoom controls
        document.getElementById('zoomIn')?.addEventListener('click', () => {
            EditorState.setScale(EditorState.scale + 0.5);
            this.updateZoomLevel();
        });

        document.getElementById('zoomOut')?.addEventListener('click', () => {
            EditorState.setScale(EditorState.scale - 0.5);
            this.updateZoomLevel();
        });

        // Copy JSON
        document.getElementById('copyJson')?.addEventListener('click', () => {
            UnitLoader.copyToClipboard();
        });

        // Paste JSON
        document.getElementById('pasteJson')?.addEventListener('click', () => {
            UnitLoader.pasteFromClipboard().then(() => {
                this.buildPartsPanel();
                this.updateJsonOutput();
                CanvasRenderer.draw();
            });
        });

        // Unit type change
        document.getElementById('unitTypeSelect')?.addEventListener('change', (e) => {
            if (EditorState.unitData) {
                EditorState.unitData.type = e.target.value;
                EditorState.emit('unitUpdated', EditorState.unitData);
            }
        });

        // New unit button
        document.getElementById('newUnitBtn')?.addEventListener('click', () => {
            const name = prompt('유닛 ID를 입력하세요:', 'new_unit');
            if (name) {
                UnitLoader.createNewUnit(name);
                this.renderUnitList();
                this.showCurrentUnitInfo();
                this.buildPartsPanel();
                this.updateJsonOutput();
            }
        });

        // Save unit button
        document.getElementById('saveUnitBtn')?.addEventListener('click', () => {
            UnitLoader.saveUnit();
        });

        // Reset unit button
        document.getElementById('resetUnitBtn')?.addEventListener('click', () => {
            EditorState.resetUnit();
            this.buildPartsPanel();
            this.updateJsonOutput();
            CanvasRenderer.draw();
            Toast.show('초기화됨', 'success');
        });

        // Transform inputs
        this.bindTransformInputs();
    },

    /**
     * Bind transform input events
     */
    bindTransformInputs() {
        ['transformX', 'transformY', 'transformW', 'transformH'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    const part = EditorState.getSelectedPart();
                    if (!part) return;

                    const prop = id.replace('transform', '').toLowerCase();
                    const val = parseFloat(input.value) || 0;

                    if (prop === 'x' || prop === 'y') {
                        part[prop] = val;
                    } else if (prop === 'w') {
                        part.w = val;
                    } else if (prop === 'h') {
                        part.h = val;
                    }

                    EditorState.emit('partUpdated', { partName: EditorState.selectedPart, data: part });
                    this.updateJsonOutput();
                    CanvasRenderer.draw();
                });
            }
        });
    },

    /**
     * Update toolbar with tools and color picker
     */
    updateToolbar() {
        const toolbar = document.getElementById('toolbar');
        if (!toolbar) return;

        toolbar.innerHTML = '';

        // Add tools
        TOOLS.forEach((tool, idx) => {
            // Add divider after certain tools
            if (idx === 5 || idx === 10) {
                const divider = document.createElement('div');
                divider.className = 'toolbar-divider';
                toolbar.appendChild(divider);
            }

            const btn = document.createElement('button');
            btn.className = `tool-btn ${EditorState.activeTool === tool.id ? 'active' : ''}`;
            btn.innerHTML = `
                <span class="tool-icon">${tool.icon}</span>
                <span class="tooltip">${tool.label} (${tool.shortcut})</span>
            `;
            btn.addEventListener('click', () => {
                EditorState.setTool(tool.id);
                this.updateToolbar();
                this.updateOptionBar();
            });
            toolbar.appendChild(btn);
        });

        // Add divider before color picker
        const divider = document.createElement('div');
        divider.className = 'toolbar-divider';
        toolbar.appendChild(divider);

        // Add color picker at the bottom
        const colorWrapper = document.createElement('div');
        colorWrapper.className = 'toolbar-color';
        colorWrapper.innerHTML = `
            <input type="color" id="toolbarColorPicker" value="${EditorState.teamColor}" title="색상 선택">
            <span class="tooltip">색상 선택</span>
        `;
        toolbar.appendChild(colorWrapper);

        // Sync color pickers
        const toolbarPicker = document.getElementById('toolbarColorPicker');
        const sidePicker = document.getElementById('colorPicker');

        toolbarPicker?.addEventListener('input', (e) => {
            if (sidePicker) sidePicker.value = e.target.value;
            // Apply to selected part if any
            const part = EditorState.getSelectedPart();
            if (part && part.color !== 'team') {
                EditorState.saveToHistory();
                part.color = e.target.value;
                EditorState.emit('partUpdated', { partName: EditorState.selectedPart, data: part });
                this.buildPartsPanel();
                this.updateJsonOutput();
                CanvasRenderer.draw();
            }
        });

        // Sync side panel picker with toolbar picker
        sidePicker?.addEventListener('input', (e) => {
            if (toolbarPicker) toolbarPicker.value = e.target.value;
        });

        // Listen for selection changes to sync color picker
        EditorState.on('selectionChanged', () => {
            this.syncColorPickerWithSelection();
        });
    },

    /**
     * Sync color picker with selected part color
     */
    syncColorPickerWithSelection() {
        const part = EditorState.getSelectedPart();
        const toolbarPicker = document.getElementById('toolbarColorPicker');
        const sidePicker = document.getElementById('colorPicker');

        if (part && part.color && part.color !== 'team') {
            if (toolbarPicker) toolbarPicker.value = part.color;
            if (sidePicker) sidePicker.value = part.color;
        }
    },

    /**
     * Update option bar based on current tool
     */
    updateOptionBar() {
        const tool = TOOLS.find(t => t.id === EditorState.activeTool);
        if (!tool) return;

        const iconEl = document.getElementById('currentToolIcon');
        const nameEl = document.getElementById('currentToolName');
        const optionsEl = document.getElementById('toolOptions');

        if (iconEl) iconEl.innerHTML = tool.icon;
        if (nameEl) nameEl.textContent = tool.label;

        // Tool-specific options and hints
        if (optionsEl) {
            if (EditorState.activeTool === 'select') {
                optionsEl.innerHTML = `
                    <label><input type="checkbox" id="autoSelectCheck"> 자동 선택</label>
                    <span class="tool-hint">점/엣지 편집: A(직접 선택)</span>
                `;
            } else if (EditorState.activeTool === 'direct_select') {
                optionsEl.innerHTML = `<span class="tool-hint">점·엣지 드래그로 편집</span>`;
            } else {
                optionsEl.innerHTML = '';
            }
        }
    },

    /**
     * Render unit list in sidebar
     */
    renderUnitList() {
        const list = document.getElementById('unitList');
        if (!list) return;

        list.innerHTML = '';

        const units = EditorState.availableUnits;
        if (!units || units.length === 0) {
            list.innerHTML = '<div class="empty-list">유닛 목록 로딩중...</div>';
            return;
        }

        units.forEach(unit => {
            const item = document.createElement('div');
            item.className = `unit-list-item ${EditorState.currentUnitId === unit.id ? 'active' : ''}`;
            item.innerHTML = `
                <span class="unit-icon">${this.getUnitIcon(unit.type)}</span>
                <div class="unit-info">
                    <span class="unit-name">${unit.name}</span>
                    <span class="unit-type">${unit.type}</span>
                </div>
                <span class="unit-arrow">${ICONS.chevronRight}</span>
            `;
            item.addEventListener('click', async () => {
                await UnitLoader.loadUnit(unit.id);
                this.renderUnitList();
                this.showCurrentUnitInfo();
                this.updateProfile();
                this.buildPartsPanel();
                this.updateJsonOutput();
                this.switchTab('parts');
                CanvasRenderer.draw();
            });
            list.appendChild(item);
        });
    },

    /**
     * Show current unit info section
     */
    showCurrentUnitInfo() {
        const infoSection = document.getElementById('currentUnitInfo');
        if (infoSection && EditorState.unitData) {
            infoSection.style.display = 'block';
        }
    },

    /**
     * Update unit profile display
     */
    updateProfile() {
        const unit = EditorState.unitData;
        if (!unit) return;

        const nameEl = document.getElementById('profileName');
        const partsEl = document.getElementById('profileParts');
        const typeSelect = document.getElementById('unitTypeSelect');
        const statusParts = document.getElementById('statusParts');

        if (nameEl) nameEl.textContent = unit.name || unit.id || 'Unit';
        if (partsEl) partsEl.textContent = `파츠: ${Object.keys(unit.parts || {}).length}`;
        if (typeSelect) typeSelect.value = unit.type || 'infantry';
        if (statusParts) statusParts.textContent = `${Object.keys(unit.parts || {}).length} 파츠`;

        this.showCurrentUnitInfo();
    },

    /**
     * Build parts panel
     */
    buildPartsPanel() {
        const panel = document.getElementById('partsPanel');
        if (!panel) return;

        const parts = EditorState.getParts();
        panel.innerHTML = '';

        if (!parts || Object.keys(parts).length === 0) {
            panel.innerHTML = '<div class="empty-parts">파츠 없음</div>';
            return;
        }

        for (const [name, part] of Object.entries(parts)) {
            const section = document.createElement('div');
            section.className = 'part-section';

            const hasPoints = part.type === 'polygon' || part.type === 'wheels' || part.type === 'line';
            const isSelected = EditorState.selectedPart === name;

            // Header
            let headerHtml = `
                <div class="part-header ${isSelected ? 'active' : ''}" data-part="${name}">
                    <h3>${name} <span class="part-type-badge">${part.type}</span></h3>
                    <div class="part-actions">
                        ${hasPoints ? `<button class="add-btn" data-part="${name}">+</button>` : ''}
                        <button class="del-part-btn" data-part="${name}">✕</button>
                    </div>
                </div>
            `;

            // Content based on type
            let contentHtml = '<div class="point-list">';

            if (hasPoints && part.points) {
                part.points.forEach((p, i) => {
                    contentHtml += `
                        <div class="point-row">
                            <span class="point-idx">${i}</span>
                            <input type="number" value="${p.x}" data-part="${name}" data-idx="${i}" data-axis="x">
                            <input type="number" value="${p.y}" data-part="${name}" data-idx="${i}" data-axis="y">
                            <button class="del-btn" data-part="${name}" data-idx="${i}">✕</button>
                        </div>
                    `;
                });

                if (part.type === 'line') {
                    contentHtml += `
                        <div class="point-row">
                            <span class="point-idx">w</span>
                            <input type="number" value="${part.width || 2}" data-part="${name}" data-prop="width">
                            <span class="point-idx">st</span>
                            <select data-part="${name}" data-prop="lineStyle">
                                <option value="solid" ${part.lineStyle === 'solid' ? 'selected' : ''}>Solid</option>
                                <option value="dash" ${part.lineStyle === 'dash' ? 'selected' : ''}>Dash</option>
                                <option value="dot" ${part.lineStyle === 'dot' ? 'selected' : ''}>Dot</option>
                            </select>
                        </div>
                    `;
                }
            } else if (part.type === 'group') {
                contentHtml += `
                    <div class="point-row">
                        <span class="point-idx">x</span>
                        <input type="number" value="${part.x}" data-part="${name}" data-prop="x">
                        <span class="point-idx">y</span>
                        <input type="number" value="${part.y}" data-part="${name}" data-prop="y">
                    </div>
                `;
            } else if (part.type === 'rect' || part.type === 'rotor') {
                contentHtml += `
                    <div class="point-row">
                        <span class="point-idx">x</span>
                        <input type="number" value="${part.x}" data-part="${name}" data-prop="x">
                        <span class="point-idx">y</span>
                        <input type="number" value="${part.y}" data-part="${name}" data-prop="y">
                    </div>
                    <div class="point-row">
                        <span class="point-idx">w</span>
                        <input type="number" value="${part.w}" data-part="${name}" data-prop="w">
                        <span class="point-idx">h</span>
                        <input type="number" value="${part.h}" data-part="${name}" data-prop="h">
                    </div>
                `;
            } else if (part.type === 'circle' || part.type === 'arc') {
                contentHtml += `
                    <div class="point-row">
                        <span class="point-idx">x</span>
                        <input type="number" value="${part.x}" data-part="${name}" data-prop="x">
                        <span class="point-idx">y</span>
                        <input type="number" value="${part.y}" data-part="${name}" data-prop="y">
                    </div>
                    <div class="point-row">
                        <span class="point-idx">r</span>
                        <input type="number" step="0.5" value="${part.r}" data-part="${name}" data-prop="r">
                    </div>
                `;
            }

            // Color row
            const colorValue = part.color === 'team' ? EditorState.teamColor : (part.color || '#333');
            contentHtml += `
                <div class="point-row color-row">
                    <span class="point-idx">색</span>
                    <input type="color" value="${colorValue}" data-part="${name}" data-prop="color">
                    <button class="team-color-btn ${part.color === 'team' ? 'active' : ''}" data-part="${name}">팀</button>
                </div>
            `;

            contentHtml += '</div>';
            section.innerHTML = headerHtml + contentHtml;
            panel.appendChild(section);
        }

        // Bind events
        this.bindPartsPanelEvents(panel);

        // Update transform panel if part is selected
        this.updateTransformPanel();
    },

    /**
     * Update transform panel with selected part values
     */
    updateTransformPanel() {
        const part = EditorState.getSelectedPart();
        if (!part) return;

        const xInput = document.getElementById('transformX');
        const yInput = document.getElementById('transformY');
        const wInput = document.getElementById('transformW');
        const hInput = document.getElementById('transformH');

        if (xInput) xInput.value = part.x || 0;
        if (yInput) yInput.value = part.y || 0;
        if (wInput) wInput.value = part.w || 0;
        if (hInput) hInput.value = part.h || part.r || 0;
    },

    /**
     * Bind events for parts panel
     * @param {HTMLElement} panel - Parts panel element
     */
    bindPartsPanelEvents(panel) {
        // Header click to select
        panel.querySelectorAll('.part-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.classList.contains('add-btn') || e.target.classList.contains('del-part-btn')) return;
                EditorState.selectPart(header.dataset.part);
                this.buildPartsPanel();
                CanvasRenderer.draw();
            });
        });

        // Input changes
        panel.querySelectorAll('input[type="number"]').forEach(inp => {
            inp.addEventListener('input', () => {
                const partName = inp.dataset.part;
                const part = EditorState.getPart(partName);
                if (!part) return;

                const val = parseFloat(inp.value) || 0;

                if (inp.dataset.idx !== undefined) {
                    const idx = parseInt(inp.dataset.idx);
                    const axis = inp.dataset.axis;
                    if (part.points && part.points[idx]) {
                        part.points[idx][axis] = val;
                    }
                } else if (inp.dataset.prop) {
                    part[inp.dataset.prop] = val;
                }

                EditorState.emit('partUpdated', { partName, data: part });
                this.updateJsonOutput();
                CanvasRenderer.draw();
            });
        });

        // Color input changes
        panel.querySelectorAll('input[type="color"]').forEach(inp => {
            inp.addEventListener('input', () => {
                const partName = inp.dataset.part;
                const part = EditorState.getPart(partName);
                if (!part) return;

                part.color = inp.value;
                EditorState.emit('partUpdated', { partName, data: part });
                this.updateJsonOutput();
                CanvasRenderer.draw();
            });
        });

        // Team color buttons
        panel.querySelectorAll('.team-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const partName = btn.dataset.part;
                const part = EditorState.getPart(partName);
                if (!part) return;

                part.color = 'team';
                EditorState.emit('partUpdated', { partName, data: part });
                this.buildPartsPanel();
                this.updateJsonOutput();
                CanvasRenderer.draw();
            });
        });

        // Select changes
        panel.querySelectorAll('select').forEach(sel => {
            sel.addEventListener('change', () => {
                const partName = sel.dataset.part;
                const part = EditorState.getPart(partName);
                if (!part) return;

                part[sel.dataset.prop] = sel.value;
                EditorState.emit('partUpdated', { partName, data: part });
                this.updateJsonOutput();
                CanvasRenderer.draw();
            });
        });

        // Add point buttons
        panel.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const partName = btn.dataset.part;
                const part = EditorState.getPart(partName);
                if (!part || !part.points) return;

                EditorState.saveToHistory();
                const last = part.points[part.points.length - 1];
                part.points.push({ x: last.x + 5, y: last.y + 5 });
                EditorState.emit('partUpdated', { partName, data: part });
                this.buildPartsPanel();
                this.updateJsonOutput();
                CanvasRenderer.draw();
            });
        });

        // Delete point buttons
        panel.querySelectorAll('.del-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const partName = btn.dataset.part;
                const part = EditorState.getPart(partName);
                const idx = parseInt(btn.dataset.idx);
                if (!part || !part.points || part.points.length <= 3) {
                    Toast.show('최소 3개의 점이 필요합니다.', 'error');
                    return;
                }

                EditorState.saveToHistory();
                part.points.splice(idx, 1);
                EditorState.emit('partUpdated', { partName, data: part });
                this.buildPartsPanel();
                this.updateJsonOutput();
                CanvasRenderer.draw();
            });
        });

        // Delete part buttons
        panel.querySelectorAll('.del-part-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const partName = btn.dataset.part;
                if (confirm(`"${partName}" 파츠를 삭제하시겠습니까?`)) {
                    EditorState.saveToHistory();
                    EditorState.removePart(partName);
                    this.buildPartsPanel();
                    this.updateJsonOutput();
                    this.updateProfile();
                    CanvasRenderer.draw();
                    Toast.show('파츠 삭제됨', 'success');
                }
            });
        });
    },

    /**
     * Update JSON output (full unit format for consistency with copy/paste)
     */
    updateJsonOutput() {
        const output = document.getElementById('jsonOutput');
        if (output) {
            output.value = EditorState.exportJson(true, true);
        }
    },

    /**
     * Update zoom level display
     */
    updateZoomLevel() {
        const label = document.getElementById('zoomLevel');
        if (label) {
            label.textContent = `${Math.round(EditorState.scale * 100 / 3)}%`;
        }
    },

    /**
     * Update X-Ray mode status display
     */
    updateXrayStatus() {
        const statusBadge = document.getElementById('xrayStatus');
        const statusIndicator = document.getElementById('statusXray');
        const body = document.body;

        if (statusBadge) {
            statusBadge.textContent = `X-Ray: ${EditorState.xrayMode ? 'ON' : 'OFF'}`;
            statusBadge.classList.toggle('active', EditorState.xrayMode);
        }

        if (statusIndicator) {
            statusIndicator.style.display = EditorState.xrayMode ? 'inline' : 'none';
        }

        body.classList.toggle('xray-mode', EditorState.xrayMode);
    },

    /**
     * Toggle panel visibility
     * @param {string} panelName - Panel name
     */
    togglePanel(panelName) {
        if (panelName === 'transform') {
            EditorState.showTransform = !EditorState.showTransform;
            const panel = document.getElementById('transformPanel');
            if (panel) {
                panel.style.display = EditorState.showTransform ? 'block' : 'none';
            }
        } else if (panelName === 'animation') {
            EditorState.showAnimation = !EditorState.showAnimation;
            const panel = document.getElementById('animationPanel');
            if (panel) {
                panel.style.display = EditorState.showAnimation ? 'flex' : 'none';
            }
        }
    },

    /**
     * Get icon for unit type
     * @param {string} type - Unit type
     * @returns {string} Icon HTML
     */
    getUnitIcon(type) {
        const icons = {
            infantry: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="6" r="4"/><path d="M12 12c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z"/></svg>',
            vehicle: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><rect x="2" y="8" width="20" height="8" rx="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
            air: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>',
            drone: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><rect x="8" y="10" width="8" height="4" rx="1"/></svg>'
        };
        return icons[type] || icons.infantry;
    },

    /**
     * Render unit grid for modal
     */
    renderUnitGrid() {
        const grid = document.getElementById('unitGrid');
        if (!grid) return;

        grid.innerHTML = '';
        const units = EditorState.availableUnits;

        if (!units || units.length === 0) {
            grid.innerHTML = '<div class="empty-list">유닛이 없습니다</div>';
            return;
        }

        units.forEach(unit => {
            const card = document.createElement('div');
            card.className = `unit-card ${EditorState.currentUnitId === unit.id ? 'active' : ''}`;
            card.innerHTML = `
                <div class="icon">${this.getUnitIcon(unit.type)}</div>
                <div class="name">${unit.name}</div>
                <div class="type">${unit.type}</div>
            `;
            card.addEventListener('click', async () => {
                await UnitLoader.loadUnit(unit.id);
                this.renderUnitList();
                this.showCurrentUnitInfo();
                this.updateProfile();
                this.buildPartsPanel();
                this.updateJsonOutput();
                this.switchTab('parts');
                CanvasRenderer.draw();

                // Close modal
                const modal = document.getElementById('unitSelectModal');
                if (modal) modal.style.display = 'none';
            });
            grid.appendChild(card);
        });
    },

    /**
     * Render layers panel with drag-and-drop support
     */
    renderLayersPanel() {
        const list = document.getElementById('layersList');
        if (!list) return;

        list.innerHTML = '';
        const parts = EditorState.getParts();

        if (!parts || Object.keys(parts).length === 0) {
            list.innerHTML = '<div class="empty-list">파츠 없음</div>';
            return;
        }

        // Sort by zIndex
        const sortedParts = Object.entries(parts).sort((a, b) => {
            const zA = a[1].zIndex || 0;
            const zB = b[1].zIndex || 0;
            return zB - zA; // Higher z-index first
        });

        sortedParts.forEach(([name, part], index) => {
            const item = document.createElement('div');
            item.className = `layer-item ${EditorState.selectedPart === name ? 'selected' : ''}`;
            item.draggable = true;
            item.dataset.partName = name;
            item.dataset.index = index;
            item.innerHTML = `
                <span class="layer-drag-handle">${ICONS.menu || '☰'}</span>
                <span class="layer-visibility">${ICONS.eye}</span>
                <span class="layer-name">${name}</span>
                <span class="layer-type">${part.type}</span>
            `;

            // Click to select
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('layer-drag-handle')) return;
                EditorState.selectPart(name);
                this.buildPartsPanel();
                this.renderLayersPanel();
                CanvasRenderer.draw();
            });

            // Drag events
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', name);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                list.querySelectorAll('.layer-item').forEach(el => {
                    el.classList.remove('drag-over');
                });
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');

                const draggedName = e.dataTransfer.getData('text/plain');
                const targetName = name;

                if (draggedName !== targetName) {
                    this.reorderLayers(draggedName, targetName, sortedParts);
                }
            });

            list.appendChild(item);
        });
    },

    /**
     * Reorder layers by updating zIndex values
     * @param {string} draggedName - Name of dragged part
     * @param {string} targetName - Name of target part
     * @param {Array} sortedParts - Current sorted parts array
     */
    reorderLayers(draggedName, targetName, sortedParts) {
        EditorState.saveToHistory();

        // Find indices
        const draggedIdx = sortedParts.findIndex(([name]) => name === draggedName);
        const targetIdx = sortedParts.findIndex(([name]) => name === targetName);

        if (draggedIdx === -1 || targetIdx === -1) return;

        // Remove dragged item and insert at target position
        const [draggedItem] = sortedParts.splice(draggedIdx, 1);
        sortedParts.splice(targetIdx, 0, draggedItem);

        // Reassign zIndex based on new order (higher index = lower zIndex)
        const parts = EditorState.getParts();
        const maxZ = sortedParts.length;

        sortedParts.forEach(([name], idx) => {
            if (parts[name]) {
                parts[name].zIndex = maxZ - idx;
            }
        });

        EditorState.emit('partUpdated', {});
        this.renderLayersPanel();
        this.updateJsonOutput();
        CanvasRenderer.draw();
        Toast.show('레이어 순서 변경됨', 'success');
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.UIPanel = UIPanel;
}
