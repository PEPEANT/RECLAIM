/**
 * STATE.JS
 * Central state management for the editor
 */

const EditorState = {
    // === Current Unit Data ===
    currentUnitId: null,
    unitData: null,
    originalData: null,  // For reset functionality

    // === Editor State ===
    scale: 3,
    activeTool: 'select',

    // === Selection System (Illustrator-like) ===
    selectedPart: null,           // Legacy: single part name
    selectedParts: new Set(),     // Multi-select: part names
    selectedChild: null,          // When a group child is selected: child name (e.g. 'base')
    selectedPoints: new Map(),    // Map<partName, Set<pointIndex>>
    selectedEdges: new Map(),     // Map<partName, Set<edgeIndex>> (edge = segment between points)
    selectionMode: 'part',        // 'part' | 'point' | 'edge'

    // === Transform State ===
    transformMode: null,          // null | 'move' | 'rotate' | 'scale'
    transformOrigin: null,        // { x, y } - pivot point for rotation/scale
    transformStartAngle: 0,
    transformStartScale: 1,

    // === Drag State ===
    dragging: null,               // { type: 'point'|'pos'|'handle'|'box', ... }
    dragStart: null,              // { x, y } - mouse position at drag start
    boxSelect: null,              // { x1, y1, x2, y2 } - box selection rectangle

    // === Pen Tool State ===
    penDraft: null,               // { points: [{x,y}...], mode: 'polygon'|'line' } - for new path creation

    // === Hardpoints (muzzle positions, etc.) ===
    // Stored in unitData as: unitData.hardpoints = { muzzle: {x,y}, ... }
    selectedHardpoint: null,      // Currently selected hardpoint name

    // === View State ===
    xrayMode: false,
    showGrid: true,
    showHandles: true,
    viewOffsetX: 0,
    viewOffsetY: 0,

    // === Panel State ===
    activeTab: 'units',
    showTransform: false,
    showAnimation: false,
    activeMenu: null,

    // === Team Color ===
    teamColor: DEFAULT_TEAM_COLOR,

    // === Rotor Animation ===
    rotorAngle: 0,

    // === History (Undo/Redo) ===
    history: [],
    historyIndex: -1,
    maxHistorySize: 50,

    // === Available Units ===
    availableUnits: [],

    // === Event Listeners ===
    _listeners: {},

    /**
     * Subscribe to state changes
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    },

    /**
     * Emit state change event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
    },

    /**
     * Set current unit
     * @param {string} unitId - Unit ID
     * @param {Object} data - Unit data
     */
    setUnit(unitId, data) {
        this.currentUnitId = unitId;
        this.unitData = JSON.parse(JSON.stringify(data));
        this.originalData = JSON.parse(JSON.stringify(data));
        this.clearSelection();
        this.clearHistory();
        this.emit('unitChanged', { unitId, data: this.unitData });
    },

    /**
     * Update unit data
     * @param {Object} updates - Partial updates
     */
    updateUnit(updates) {
        if (!this.unitData) return;
        Object.assign(this.unitData, updates);
        this.emit('unitUpdated', this.unitData);
    },

    /**
     * Get current parts
     * @returns {Object} Parts object
     */
    getParts() {
        return this.unitData?.parts || {};
    },

    /**
     * Get a specific part (or group child)
     * @param {string} partName - Part name
     * @param {string} [childName] - If part is group, optional child name
     * @returns {Object|null} Part data
     */
    getPart(partName, childName) {
        const part = this.unitData?.parts?.[partName] || null;
        if (!part) return null;
        if (childName && part.children && part.children[childName]) {
            return part.children[childName];
        }
        return part;
    },

    /**
     * Update a part
     * Note: Caller is responsible for calling saveToHistory() before this
     * @param {string} partName - Part name
     * @param {Object} updates - Partial updates
     */
    updatePart(partName, updates) {
        if (!this.unitData?.parts?.[partName]) return;
        Object.assign(this.unitData.parts[partName], updates);
        this.emit('partUpdated', { partName, data: this.unitData.parts[partName] });
    },

    /**
     * Add a new part
     * Note: Caller is responsible for calling saveToHistory() before this
     * @param {string} partName - Part name
     * @param {Object} partData - Part data
     */
    addPart(partName, partData) {
        if (!this.unitData) return;
        this.unitData.parts[partName] = partData;
        this.emit('partAdded', { partName, data: partData });
    },

    /**
     * Remove a part
     * Note: Caller is responsible for calling saveToHistory() before this
     * @param {string} partName - Part name
     */
    removePart(partName) {
        if (!this.unitData?.parts?.[partName]) return;
        delete this.unitData.parts[partName];
        this.selectedParts.delete(partName);
        this.selectedPoints.delete(partName);
        this.selectedEdges.delete(partName);
        if (this.selectedPart === partName) {
            this.selectedPart = this.selectedParts.size > 0
                ? [...this.selectedParts][0]
                : null;
        }
        this.emit('partRemoved', { partName });
    },

    /**
     * Replace a rect (or rotor) part with a polygon with the same corners (for pen-tool point insertion)
     * Note: Caller should call saveToHistory() before this
     * @param {string} partName - Part name
     * @returns {boolean} true if replaced
     */
    replacePartWithPolygon(partName) {
        const part = this.unitData?.parts?.[partName];
        if (!part || (part.type !== 'rect' && part.type !== 'rotor')) return false;

        const points = [
            { x: part.x, y: part.y },
            { x: part.x + part.w, y: part.y },
            { x: part.x + part.w, y: part.y + part.h },
            { x: part.x, y: part.y + part.h }
        ];
        const newPart = {
            type: 'polygon',
            points,
            color: part.color || 'team',
            zIndex: part.zIndex
        };
        this.unitData.parts[partName] = newPart;
        this.emit('partUpdated', { partName, data: newPart });
        return true;
    },

    /**
     * Select a part (legacy single selection)
     * @param {string} partName - Part name or null
     */
    selectPart(partName) {
        this.selectedPart = partName;
        this.selectedChild = null;
        this.selectionMode = 'part';
        this.selectedParts.clear();
        this.selectedPoints.clear();
        this.selectedEdges.clear();
        if (partName) {
            this.selectedParts.add(partName);
        }
        this.emit('selectionChanged', { partName, parts: this.selectedParts });
    },

    /**
     * Select a group child (for partial selection of group)
     * @param {string} partName - Group part name
     * @param {string} childName - Child name
     */
    selectGroupChild(partName, childName) {
        this.selectedPart = partName;
        this.selectedChild = childName;
        this.selectionMode = 'part';
        this.selectedParts.clear();
        this.selectedPoints.clear();
        this.selectedEdges.clear();
        this.selectedParts.add(partName);
        this.emit('selectionChanged', { partName, childName, parts: this.selectedParts });
    },

    /**
     * Add part to selection (Shift-click)
     * @param {string} partName - Part name
     */
    addToSelection(partName) {
        if (!partName) return;
        this.selectionMode = 'part';
        this.selectedParts.add(partName);
        this.selectedPart = partName; // Update legacy
        this.emit('selectionChanged', { partName, parts: this.selectedParts });
    },

    /**
     * Remove part from selection
     * @param {string} partName - Part name
     */
    removeFromSelection(partName) {
        this.selectedParts.delete(partName);
        this.selectionMode = 'part';
        if (this.selectedPart === partName) {
            this.selectedPart = this.selectedParts.size > 0
                ? [...this.selectedParts][0]
                : null;
        }
        this.emit('selectionChanged', { partName: this.selectedPart, parts: this.selectedParts });
    },

    /**
     * Toggle part selection
     * @param {string} partName - Part name
     */
    toggleSelection(partName) {
        if (this.selectedParts.has(partName)) {
            this.removeFromSelection(partName);
        } else {
            this.addToSelection(partName);
        }
    },

    /**
     * Clear all selections
     */
    clearSelection() {
        this.selectedPart = null;
        this.selectedChild = null;
        this.selectedParts.clear();
        this.selectedPoints.clear();
        this.selectedEdges.clear();
        this.selectionMode = 'part';
        this.emit('selectionChanged', { partName: null, parts: this.selectedParts });
    },

    /**
     * Select point on a part
     * @param {string} partName - Part name
     * @param {number} pointIdx - Point index
     * @param {boolean} additive - Add to existing selection
     */
    selectPoint(partName, pointIdx, additive = false) {
        if (!additive) {
            this.selectedPoints.clear();
            this.selectedEdges.clear();
            this.selectedParts.clear();
        }
        if (!this.selectedPoints.has(partName)) {
            this.selectedPoints.set(partName, new Set());
        }
        this.selectedPoints.get(partName).add(pointIdx);
        this.selectionMode = 'point';
        this.selectedPart = partName;
        this.selectedParts.add(partName);
        this.emit('selectionChanged', { partName, pointIdx, points: this.selectedPoints });
    },

    /**
     * Select edge on a part
     * @param {string} partName - Part name
     * @param {number} edgeIdx - Edge index (edge between point[i] and point[i+1])
     * @param {boolean} additive - Add to existing selection
     */
    selectEdge(partName, edgeIdx, additive = false) {
        if (!additive) {
            this.selectedEdges.clear();
            this.selectedPoints.clear();
            this.selectedParts.clear();
        }
        if (!this.selectedEdges.has(partName)) {
            this.selectedEdges.set(partName, new Set());
        }
        this.selectedEdges.get(partName).add(edgeIdx);
        this.selectionMode = 'edge';
        this.selectedPart = partName;
        this.selectedParts.add(partName);
        this.emit('selectionChanged', { partName, edgeIdx, edges: this.selectedEdges });
    },

    /**
     * Check if a part is selected
     * @param {string} partName - Part name
     * @returns {boolean}
     */
    isPartSelected(partName) {
        return this.selectedParts.has(partName);
    },

    /**
     * Check if a point is selected
     * @param {string} partName - Part name
     * @param {number} pointIdx - Point index
     * @returns {boolean}
     */
    isPointSelected(partName, pointIdx) {
        return this.selectedPoints.has(partName) &&
               this.selectedPoints.get(partName).has(pointIdx);
    },

    /**
     * Check if an edge is selected
     * @param {string} partName - Part name
     * @param {number} edgeIdx - Edge index
     * @returns {boolean}
     */
    isEdgeSelected(partName, edgeIdx) {
        return this.selectedEdges.has(partName) &&
               this.selectedEdges.get(partName).has(edgeIdx);
    },

    /**
     * Get bounding box of selected parts
     * @returns {Object|null} { x, y, width, height, cx, cy }
     */
    getSelectionBounds() {
        if (this.selectedParts.size === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        // When a group child is selected, use only that child's bounds in world coords
        if (this.selectedChild && this.selectedPart) {
            const groupPart = this.getPart(this.selectedPart);
            const child = this.getPart(this.selectedPart, this.selectedChild);
            if (groupPart && child && groupPart.x != null && groupPart.y != null) {
                const ox = groupPart.x, oy = groupPart.y;
                if (child.points) {
                    for (const p of child.points) {
                        minX = Math.min(minX, ox + p.x);
                        minY = Math.min(minY, oy + p.y);
                        maxX = Math.max(maxX, ox + p.x);
                        maxY = Math.max(maxY, oy + p.y);
                    }
                } else if (child.type === 'rect' || child.type === 'rotor') {
                    minX = ox + child.x;
                    minY = oy + child.y;
                    maxX = ox + child.x + child.w;
                    maxY = oy + child.y + child.h;
                } else if (child.type === 'circle' || child.type === 'arc') {
                    minX = ox + child.x - child.r;
                    minY = oy + child.y - child.r;
                    maxX = ox + child.x + child.r;
                    maxY = oy + child.y + child.r;
                }
                if (minX !== Infinity) {
                    return {
                        x: minX, y: minY,
                        width: maxX - minX, height: maxY - minY,
                        cx: (minX + maxX) / 2, cy: (minY + maxY) / 2
                    };
                }
            }
        }

        for (const partName of this.selectedParts) {
            const part = this.getPart(partName);
            if (!part) continue;

            if (part.points) {
                for (const p of part.points) {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                }
            } else if (part.type === 'rect' || part.type === 'rotor') {
                minX = Math.min(minX, part.x);
                minY = Math.min(minY, part.y);
                maxX = Math.max(maxX, part.x + part.w);
                maxY = Math.max(maxY, part.y + part.h);
            } else if (part.type === 'circle' || part.type === 'arc') {
                minX = Math.min(minX, part.x - part.r);
                minY = Math.min(minY, part.y - part.r);
                maxX = Math.max(maxX, part.x + part.r);
                maxY = Math.max(maxY, part.y + part.r);
            } else if (part.type === 'group') {
                const ox = part.x != null ? part.x : 0, oy = part.y != null ? part.y : 0;
                if (part.children && typeof part.children === 'object') {
                    for (const child of Object.values(part.children)) {
                        if (child.type === 'rect' || child.type === 'rotor') {
                            minX = Math.min(minX, ox + child.x);
                            minY = Math.min(minY, oy + child.y);
                            maxX = Math.max(maxX, ox + child.x + (child.w || 0));
                            maxY = Math.max(maxY, oy + child.y + (child.h || 0));
                        }
                    }
                }
                if (!part.children || Object.keys(part.children).length === 0) {
                    minX = Math.min(minX, ox - 10);
                    minY = Math.min(minY, oy - 10);
                    maxX = Math.max(maxX, ox + 10);
                    maxY = Math.max(maxY, oy + 10);
                }
            }
        }

        if (minX === Infinity) return null;

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2
        };
    },

    /**
     * Set active tool
     * @param {string} toolId - Tool ID
     */
    setTool(toolId) {
        this.activeTool = toolId;
        this.emit('toolChanged', { toolId });
    },

    /**
     * Toggle X-Ray mode
     */
    toggleXray() {
        this.xrayMode = !this.xrayMode;
        this.emit('xrayToggled', { enabled: this.xrayMode });
    },

    /**
     * Set zoom scale
     * @param {number} scale - New scale
     */
    setScale(scale) {
        this.scale = Math.max(1, Math.min(10, scale));
        this.emit('scaleChanged', { scale: this.scale });
    },

    /**
     * Reset unit to original state
     */
    resetUnit() {
        if (!this.originalData) return;
        this.unitData = JSON.parse(JSON.stringify(this.originalData));
        this.clearSelection();
        this.clearHistory();
        this.emit('unitReset', { data: this.unitData });
    },

    // === History Management ===

    /**
     * Save current state to history
     */
    saveToHistory() {
        if (!this.unitData) return;

        // Remove future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Add current state
        this.history.push(JSON.stringify(this.unitData));

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    },

    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex <= 0) return false;
        this.historyIndex--;
        this.unitData = JSON.parse(this.history[this.historyIndex]);
        this.emit('historyChanged', { action: 'undo', data: this.unitData });
        return true;
    },

    /**
     * Redo last undone action
     */
    redo() {
        if (this.historyIndex >= this.history.length - 1) return false;
        this.historyIndex++;
        this.unitData = JSON.parse(this.history[this.historyIndex]);
        this.emit('historyChanged', { action: 'redo', data: this.unitData });
        return true;
    },

    /**
     * Clear history
     */
    clearHistory() {
        this.history = [JSON.stringify(this.unitData)];
        this.historyIndex = 0;
    },

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.historyIndex > 0;
    },

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    },

    // === Utility Methods ===

    /**
     * Generate unique part name
     * @param {string} prefix - Name prefix
     * @returns {string} Unique part name
     */
    generatePartName(prefix) {
        if (!this.unitData?.parts) return `${prefix}_1`;
        let idx = 1;
        let name = `${prefix}_${idx}`;
        while (this.unitData.parts[name]) {
            idx++;
            name = `${prefix}_${idx}`;
        }
        return name;
    },

    /**
     * Get selected part data (or selected group child)
     * @returns {Object|null} Selected part data
     */
    getSelectedPart() {
        if (!this.selectedPart || !this.unitData?.parts) return null;
        return this.getPart(this.selectedPart, this.selectedChild || undefined);
    },

    /**
     * Export current unit data as JSON string
     * @param {boolean} pretty - Pretty print
     * @param {boolean} fullFormat - If true, export full unit (id, name, type, metadata, parts); otherwise parts-only simplified
     * @returns {string} JSON string
     */
    exportJson(pretty = true, fullFormat = false) {
        if (!this.unitData) return fullFormat ? '{}' : '{}';

        if (fullFormat) {
            const full = {
                id: this.unitData.id || this.currentUnitId || 'unit',
                name: this.unitData.name || this.unitData.id || 'unit',
                type: this.unitData.type || 'infantry',
                metadata: this.unitData.metadata || {
                    author: 'editor',
                    version: '1.0',
                    lastModified: new Date().toISOString().split('T')[0]
                },
                parts: this.unitData.parts ? JSON.parse(JSON.stringify(this.unitData.parts)) : {}
            };
            return pretty ? JSON.stringify(full, null, 2) : JSON.stringify(full);
        }

        // Simplified format (parts only, for game use)
        const output = {};
        for (const [name, part] of Object.entries(this.unitData.parts)) {
            if (part.type === 'polygon' || part.type === 'wheels') {
                output[name] = part.points;
            } else if (part.type === 'line') {
                output[name] = {
                    type: 'line',
                    points: part.points,
                    width: part.width || 2,
                    lineStyle: part.lineStyle || 'solid',
                    color: part.color || 'team'
                };
            } else if (part.type === 'group') {
                output[name] = { x: part.x, y: part.y };
            } else if (part.type === 'rect' || part.type === 'rotor') {
                output[name] = { x: part.x, y: part.y, w: part.w, h: part.h };
            } else if (part.type === 'circle' || part.type === 'arc') {
                output[name] = { x: part.x, y: part.y, r: part.r };
            }
        }

        return pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.EditorState = EditorState;
}
