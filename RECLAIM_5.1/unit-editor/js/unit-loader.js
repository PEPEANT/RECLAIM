/**
 * UNIT-LOADER.JS
 * Handles loading, saving, and managing unit JSON files
 */

const UnitLoader = {
    // Base path for unit files
    basePath: 'units/',

    // Cached unit list
    unitList: null,

    /**
     * Load the unit index file
     * @returns {Promise<Object>} Unit index data
     */
    async loadIndex() {
        try {
            const response = await fetch(this.basePath + 'index.json');
            if (!response.ok) throw new Error('Failed to load unit index');
            const data = await response.json();
            this.unitList = data.units;
            EditorState.availableUnits = this.unitList;
            return data;
        } catch (error) {
            console.error('Error loading unit index:', error);
            // Return fallback data if index fails to load
            return this.getFallbackIndex();
        }
    },

    /**
     * Get fallback unit index (hardcoded defaults)
     * @returns {Object} Fallback unit index
     */
    getFallbackIndex() {
        const fallback = {
            version: "2.0",
            units: [
                { id: "special_forces", name: "특수부대", type: "infantry" },
                { id: "apc", name: "APC", type: "vehicle" },
                { id: "uh60", name: "블랙호크", type: "air" }
            ]
        };
        this.unitList = fallback.units;
        EditorState.availableUnits = this.unitList;
        return fallback;
    },

    /**
     * Load a specific unit by ID
     * @param {string} unitId - Unit ID
     * @returns {Promise<Object>} Unit data
     */
    async loadUnit(unitId) {
        try {
            const response = await fetch(this.basePath + unitId + '.json');
            if (!response.ok) throw new Error(`Failed to load unit: ${unitId}`);
            const data = await response.json();
            EditorState.setUnit(unitId, data);
            return data;
        } catch (error) {
            console.error('Error loading unit:', error);
            // Try fallback
            return this.getFallbackUnit(unitId);
        }
    },

    /**
     * Get fallback unit data (hardcoded defaults from original editor)
     * @param {string} unitId - Unit ID
     * @returns {Object} Fallback unit data
     */
    getFallbackUnit(unitId) {
        const fallbackUnits = {
            special_forces: {
                id: 'special_forces',
                name: '특수부대',
                type: 'infantry',
                parts: {
                    backpack: { type: 'rect', x: -10, y: -20, w: 6, h: 14, color: '#0f172a' },
                    body: { type: 'rect', x: -6, y: -20, w: 12, h: 20, color: 'team' },
                    armor: { type: 'rect', x: -6, y: -20, w: 12, h: 10, color: '#111827' },
                    head: { type: 'circle', x: 0, y: -24, r: 5, color: 'team' },
                    helmet: { type: 'arc', x: 0, y: -25, r: 5.5, color: '#000' },
                    goggles: { type: 'rect', x: 2, y: -26, w: 4, h: 2, color: '#334155' },
                    gun: { type: 'rect', x: 2, y: -18, w: 10, h: 3, color: '#000' },
                    gunBarrel: { type: 'rect', x: 12, y: -18, w: 4, h: 1.5, color: '#000' }
                }
            },
            apc: {
                id: 'apc',
                name: 'APC',
                type: 'vehicle',
                parts: {
                    body: { type: 'polygon', points: [
                        {x:35,y:-5},{x:29,y:-11},{x:25,y:-15},{x:-25,y:-15},
                        {x:-35,y:-10},{x:-35,y:-5},{x:-35,y:0},{x:-31,y:7},{x:27,y:7}
                    ], color: 'team' },
                    window: { type: 'polygon', points: [
                        {x:24,y:-13},{x:32,y:-6},{x:26,y:-6}
                    ], color: '#1e293b' },
                    turret: {
                        type: 'group',
                        x: -3,
                        y: -20,
                        children: {
                            base: { type: 'rect', x: -10, y: -5, w: 20, h: 10, color: '#020617' },
                            gun: { type: 'rect', x: 10, y: -2, w: 16, h: 4, color: '#000' },
                            hatch: { type: 'rect', x: -5, y: -4, w: 10, h: 2, color: '#334155' }
                        }
                    },
                    wheels: { type: 'wheels', points: [
                        {x:-21,y:7},{x:-1,y:7},{x:17,y:7}
                    ]}
                }
            },
            uh60: {
                id: 'uh60',
                name: '블랙호크',
                type: 'air',
                parts: {
                    tailBg: { type: 'rect', x: -45, y: -5, w: 30, h: 6, color: '#1e293b' },
                    tailRotor: { type: 'rotor', x: -45, y: -5, w: 4, h: 20 },
                    body: { type: 'polygon', points: [
                        {x:25,y:0},{x:20,y:-8},{x:-20,y:-10},{x:-25,y:5},{x:20,y:5}
                    ], color: '#334155' },
                    cockpit: { type: 'rect', x: -10, y: -5, w: 15, h: 8, color: '#0f172a' },
                    engine: { type: 'rect', x: 15, y: -6, w: 6, h: 4, color: '#000' },
                    mainRotor: { type: 'rect', x: -35, y: -12, w: 70, h: 2, color: '#000' },
                    rotorHub: { type: 'rect', x: -2, y: -14, w: 4, h: 4, color: '#000' }
                }
            }
        };

        const data = fallbackUnits[unitId] || fallbackUnits.special_forces;
        EditorState.setUnit(unitId, data);
        return data;
    },

    /**
     * Save unit to local download
     * @param {Object} unitData - Unit data to save (optional, uses current if not provided)
     */
    saveUnit(unitData = null) {
        const data = unitData || EditorState.unitData;
        if (!data) {
            console.error('No unit data to save');
            return;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.id || 'unit'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Toast.show('유닛 저장 완료!', 'success');
    },

    /**
     * Export unit as simplified JSON (for game use)
     */
    exportSimplified() {
        const json = EditorState.exportJson(true);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${EditorState.currentUnitId || 'unit'}_export.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Toast.show('JSON 내보내기 완료!', 'success');
    },

    /**
     * Import unit from file
     * @param {File} file - File object
     * @returns {Promise<Object>} Imported unit data
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // Validate basic structure
                    if (!data.id || !data.parts) {
                        throw new Error('Invalid unit file format');
                    }
                    EditorState.setUnit(data.id, data);
                    Toast.show('유닛 불러오기 완료!', 'success');
                    resolve(data);
                } catch (err) {
                    Toast.show('유효하지 않은 파일 형식', 'error');
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    },

    /**
     * Import simplified JSON and convert to full format
     * @param {string} jsonText - JSON string
     * @param {string} unitId - Unit ID to use
     * @param {string} unitType - Unit type
     */
    importSimplified(jsonText, unitId = 'imported', unitType = 'infantry') {
        try {
            const data = JSON.parse(jsonText);

            // Convert simplified format to full format
            const fullData = {
                id: unitId,
                name: unitId,
                type: unitType,
                metadata: {
                    author: 'imported',
                    version: '1.0',
                    lastModified: new Date().toISOString().split('T')[0]
                },
                parts: {}
            };

            // Infer part types from structure
            for (const [name, val] of Object.entries(data)) {
                if (Array.isArray(val)) {
                    // Array of points - could be polygon or wheels
                    if (name.toLowerCase().includes('wheel')) {
                        fullData.parts[name] = { type: 'wheels', points: val };
                    } else {
                        fullData.parts[name] = { type: 'polygon', points: val, color: 'team' };
                    }
                } else if (typeof val === 'object') {
                    if (val.type === 'line') {
                        fullData.parts[name] = val;
                    } else if (val.points) {
                        fullData.parts[name] = { ...val, type: 'polygon' };
                    } else if (val.r !== undefined) {
                        fullData.parts[name] = { ...val, type: 'circle' };
                    } else if (val.w !== undefined && val.h !== undefined) {
                        fullData.parts[name] = { ...val, type: 'rect' };
                    } else if (val.x !== undefined && val.y !== undefined) {
                        fullData.parts[name] = { ...val, type: 'group' };
                    }
                }
            }

            EditorState.setUnit(unitId, fullData);
            Toast.show('JSON 불러오기 완료!', 'success');
            return fullData;
        } catch (err) {
            Toast.show('유효하지 않은 JSON', 'error');
            throw err;
        }
    },

    /**
     * Create a new empty unit
     * @param {string} unitId - Unit ID
     * @param {string} unitType - Unit type
     */
    createNewUnit(unitId = 'new_unit', unitType = 'infantry') {
        const data = {
            id: unitId,
            name: unitId,
            type: unitType,
            metadata: {
                author: 'editor',
                version: '1.0',
                lastModified: new Date().toISOString().split('T')[0]
            },
            parts: {
                body: {
                    type: 'rect',
                    x: -10,
                    y: -10,
                    w: 20,
                    h: 20,
                    color: 'team',
                    zIndex: 0
                }
            }
        };

        EditorState.setUnit(unitId, data);

        // Add new unit to list so it appears in sidebar and modal
        if (!EditorState.availableUnits) EditorState.availableUnits = [];
        const exists = EditorState.availableUnits.some(u => u.id === unitId);
        if (!exists) {
            EditorState.availableUnits.push({ id: unitId, name: unitId, type: unitType });
            if (this.unitList) this.unitList.push({ id: unitId, name: unitId, type: unitType });
        }

        Toast.show('새 유닛 생성!', 'success');
        return data;
    },

    /**
     * Copy current unit data to clipboard (full unit format so paste works correctly)
     */
    async copyToClipboard() {
        const json = EditorState.exportJson(true, true);
        try {
            await navigator.clipboard.writeText(json);
            Toast.show('JSON 복사됨!', 'success');
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = json;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            Toast.show('JSON 복사됨!', 'success');
        }
    },

    /**
     * Paste unit data from clipboard
     * - If data has .parts (object), treat as full unit and replace current unit
     * - Otherwise treat as parts-only map and merge into current unit's parts
     */
    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            const data = JSON.parse(text);

            if (data && typeof data.parts === 'object' && !Array.isArray(data.parts)) {
                // Full unit format: replace current unit
                const unitId = data.id || 'pasted';
                EditorState.setUnit(unitId, data);
                if (typeof UIPanel !== 'undefined') {
                    UIPanel.buildPartsPanel();
                    UIPanel.updateJsonOutput();
                    UIPanel.updateProfile();
                }
                if (typeof CanvasRenderer !== 'undefined') CanvasRenderer.draw();
                Toast.show('유닛 붙여넣기 완료!', 'success');
                return;
            }

            // Parts-only (simplified) format: merge into current unit
            if (EditorState.unitData && EditorState.unitData.parts) {
                EditorState.saveToHistory();
                for (const [name, val] of Object.entries(data)) {
                    if (EditorState.unitData.parts[name]) {
                        if (Array.isArray(val)) {
                            EditorState.unitData.parts[name].points = val;
                        } else if (typeof val === 'object') {
                            Object.assign(EditorState.unitData.parts[name], val);
                        }
                    }
                }
                EditorState.emit('unitUpdated', EditorState.unitData);
                if (typeof UIPanel !== 'undefined') {
                    UIPanel.buildPartsPanel();
                    UIPanel.updateJsonOutput();
                }
                if (typeof CanvasRenderer !== 'undefined') CanvasRenderer.draw();
                Toast.show('붙여넣기 완료!', 'success');
            }
        } catch (err) {
            Toast.show('유효하지 않은 JSON', 'error');
        }
    },

    /**
     * Get unit list grouped by type
     * @returns {Object} Units grouped by type
     */
    getUnitsByType() {
        const grouped = {
            infantry: [],
            vehicle: [],
            air: [],
            drone: []
        };

        if (this.unitList) {
            this.unitList.forEach(unit => {
                if (grouped[unit.type]) {
                    grouped[unit.type].push(unit);
                }
            });
        }

        return grouped;
    }
};

/**
 * Toast notification helper
 */
const Toast = {
    element: null,
    timeout: null,

    init() {
        this.element = document.getElementById('toast');
    },

    show(message, type = 'info') {
        if (!this.element) this.init();
        if (!this.element) return;

        // Clear existing timeout
        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        // Remove existing classes
        this.element.classList.remove('show', 'error', 'success');

        // Set message and type
        this.element.textContent = message;
        if (type === 'error') {
            this.element.classList.add('error');
        } else if (type === 'success') {
            this.element.classList.add('success');
        }

        // Show toast
        this.element.classList.add('show');

        // Hide after delay
        this.timeout = setTimeout(() => {
            this.element.classList.remove('show');
        }, 2000);
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.UnitLoader = UnitLoader;
    window.Toast = Toast;
}
