/**
 * INTERACTION.JS
 * Mouse and keyboard interaction handling (Illustrator-style)
 */

const Interaction = {
    canvas: null,

    /**
     * Initialize interaction handlers
     * @param {HTMLCanvasElement} canvasElement - Canvas element
     */
    init(canvasElement) {
        this.canvas = canvasElement;
        this.bindCanvasEvents();
        this.bindKeyboardEvents();
    },

    /**
     * Get mouse position in canvas coordinates (accounting for pan offset)
     * @param {MouseEvent} e - Mouse event
     * @returns {Object} { x, y } position
     */
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scale = EditorState.scale;
        const x = (e.clientX - rect.left - this.canvas.width / 2 - EditorState.viewOffsetX) / scale;
        const y = (e.clientY - rect.top - this.canvas.height / 2 - EditorState.viewOffsetY) / scale;
        return { x: Math.round(x), y: Math.round(y) };
    },

    /**
     * Get raw mouse position (not rounded, for precise calculations)
     * @param {MouseEvent} e - Mouse event
     * @returns {Object} { x, y } position
     */
    getMousePosRaw(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scale = EditorState.scale;
        const x = (e.clientX - rect.left - this.canvas.width / 2 - EditorState.viewOffsetX) / scale;
        const y = (e.clientY - rect.top - this.canvas.height / 2 - EditorState.viewOffsetY) / scale;
        return { x, y };
    },

    /**
     * Get raw screen position (for panning, not affected by scale)
     * @param {MouseEvent} e - Mouse event
     * @returns {Object} { x, y } position
     */
    getScreenPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    },

    /**
     * Get effective hit radius (with minimum so zoom-out still allows precise selection)
     * @returns {number} Hit radius in canvas coordinates
     */
    getHitRadius() {
        const scale = EditorState.scale;
        const base = (CANVAS_CONFIG.hitRadius || 10) / scale;
        const min = (CANVAS_CONFIG.hitRadiusMin != null ? CANVAS_CONFIG.hitRadiusMin : 5);
        return Math.max(base, min);
    },

    // ========================================
    // HIT TESTING
    // ========================================

    /**
     * Distance from point to line segment
     * @param {Object} p - Point { x, y }
     * @param {Object} a - Segment start { x, y }
     * @param {Object} b - Segment end { x, y }
     * @returns {number} Distance
     */
    pointToSegmentDistance(p, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;

        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = a.x + t * dx;
        const projY = a.y + t * dy;

        return Math.hypot(p.x - projX, p.y - projY);
    },

    /**
     * Get projection point on a line segment
     * @param {Object} p - Point { x, y }
     * @param {Object} a - Segment start { x, y }
     * @param {Object} b - Segment end { x, y }
     * @returns {Object} { x, y, t } - Projection point and parameter t (0-1)
     */
    pointToSegmentProjection(p, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;

        if (lenSq === 0) return { x: a.x, y: a.y, t: 0 };

        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        return {
            x: Math.round(a.x + t * dx),
            y: Math.round(a.y + t * dy),
            t: t
        };
    },

    /**
     * Hit test for transform handles (bounding box corners and edges)
     * @param {Object} pos - Mouse position
     * @returns {Object|null} { type: 'scale'|'rotate'|'scale-edge', idx, cursor }
     */
    hitTransformHandle(pos) {
        const bounds = EditorState.getSelectionBounds();
        if (!bounds || bounds.width < 1 || bounds.height < 1) return null;

        const scale = EditorState.scale;
        const handleSize = 8 / scale;
        const rotateOffset = 25 / scale;

        // Corner handles (for scale)
        const corners = [
            { x: bounds.x, y: bounds.y, cursor: 'nw-resize', idx: 0 },
            { x: bounds.x + bounds.width, y: bounds.y, cursor: 'ne-resize', idx: 1 },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'se-resize', idx: 2 },
            { x: bounds.x, y: bounds.y + bounds.height, cursor: 'sw-resize', idx: 3 }
        ];

        for (const corner of corners) {
            if (Math.hypot(pos.x - corner.x, pos.y - corner.y) < handleSize) {
                return { type: 'scale', idx: corner.idx, cursor: corner.cursor, bounds };
            }
        }

        // Rotation handle (top center, above bbox)
        const rotateHandle = { x: bounds.cx, y: bounds.y - rotateOffset };
        if (Math.hypot(pos.x - rotateHandle.x, pos.y - rotateHandle.y) < handleSize) {
            return { type: 'rotate', cursor: 'crosshair', bounds };
        }

        // Edge handles (for edge-based scale)
        const edges = [
            { x: bounds.cx, y: bounds.y, cursor: 'n-resize', idx: 0 },
            { x: bounds.x + bounds.width, y: bounds.cy, cursor: 'e-resize', idx: 1 },
            { x: bounds.cx, y: bounds.y + bounds.height, cursor: 's-resize', idx: 2 },
            { x: bounds.x, y: bounds.cy, cursor: 'w-resize', idx: 3 }
        ];

        for (const edge of edges) {
            if (Math.hypot(pos.x - edge.x, pos.y - edge.y) < handleSize) {
                return { type: 'scale-edge', idx: edge.idx, cursor: edge.cursor, bounds };
            }
        }

        return null;
    },

    /**
     * Get virtual edges for a part (for polygon/line/wheels from points; for rect/rotor as 4 segments)
     * @param {Object} part - Part data
     * @param {string} partName - Part name
     * @returns {Array<{p1:Object,p2:Object}>} Edges
     */
    getPartEdges(part, partName) {
        if (part.points && part.points.length >= 2) {
            const edges = [];
            const numEdges = part.type === 'polygon' ? part.points.length : part.points.length - 1;
            for (let i = 0; i < numEdges; i++) {
                edges.push({
                    p1: part.points[i],
                    p2: part.points[(i + 1) % part.points.length]
                });
            }
            return edges;
        }
        if (part.type === 'rect' || part.type === 'rotor') {
            return [
                { p1: { x: part.x, y: part.y }, p2: { x: part.x + part.w, y: part.y } },
                { p1: { x: part.x + part.w, y: part.y }, p2: { x: part.x + part.w, y: part.y + part.h } },
                { p1: { x: part.x + part.w, y: part.y + part.h }, p2: { x: part.x, y: part.y + part.h } },
                { p1: { x: part.x, y: part.y + part.h }, p2: { x: part.x, y: part.y } }
            ];
        }
        return [];
    },

    /**
     * Hit test for part edges (segments between points, or rect/rotor virtual edges)
     * @param {Object} pos - Mouse position
     * @returns {Object|null} { partName, edgeIdx, isRectOrRotor }
     */
    hitEdge(pos) {
        const parts = EditorState.getParts();
        const scale = EditorState.scale;
        const hitRadius = this.getHitRadius();

        for (const [name, part] of Object.entries(parts)) {
            const edges = this.getPartEdges(part, name);
            for (let i = 0; i < edges.length; i++) {
                const { p1, p2 } = edges[i];
                const dist = this.pointToSegmentDistance(pos, p1, p2);
                if (dist < hitRadius) {
                    return {
                        partName: name,
                        edgeIdx: i,
                        isRectOrRotor: part.type === 'rect' || part.type === 'rotor'
                    };
                }
            }
        }

        return null;
    },

    /**
     * Hit test for part points (including virtual handles for circle/arc)
     * @param {Object} pos - Mouse position
     * @returns {Object|null} { partName, pointIdx, handleType }
     */
    hitPoint(pos) {
        const parts = EditorState.getParts();
        const hitRadius = this.getHitRadius();

        for (const [name, part] of Object.entries(parts)) {
            if (part.points) {
                for (let i = 0; i < part.points.length; i++) {
                    const p = part.points[i];
                    if (Math.hypot(pos.x - p.x, pos.y - p.y) < hitRadius) {
                        return { partName: name, pointIdx: i, handleType: 'point' };
                    }
                }
            } else if (part.type === 'circle' || part.type === 'arc') {
                // Check radius handle first (right side of circle)
                const radiusHandleX = part.x + part.r;
                const radiusHandleY = part.y;
                if (Math.hypot(pos.x - radiusHandleX, pos.y - radiusHandleY) < hitRadius) {
                    return { partName: name, pointIdx: -2, handleType: 'radius' };
                }
                // Check center handle
                if (Math.hypot(pos.x - part.x, pos.y - part.y) < hitRadius) {
                    return { partName: name, pointIdx: -1, handleType: 'center' };
                }
            } else if (part.type === 'rect' || part.type === 'rotor') {
                // Check corner handles for rect
                const corners = [
                    { x: part.x, y: part.y, idx: 0 },
                    { x: part.x + part.w, y: part.y, idx: 1 },
                    { x: part.x + part.w, y: part.y + part.h, idx: 2 },
                    { x: part.x, y: part.y + part.h, idx: 3 }
                ];
                for (const corner of corners) {
                    if (Math.hypot(pos.x - corner.x, pos.y - corner.y) < hitRadius) {
                        return { partName: name, pointIdx: corner.idx, handleType: 'corner' };
                    }
                }
                // Check center
                const cx = part.x + part.w / 2;
                const cy = part.y + part.h / 2;
                if (Math.hypot(pos.x - cx, pos.y - cy) < hitRadius) {
                    return { partName: name, pointIdx: -1, handleType: 'center' };
                }
            } else if (part.type === 'group') {
                if (Math.hypot(pos.x - part.x, pos.y - part.y) < hitRadius) {
                    return { partName: name, pointIdx: -1, handleType: 'center' };
                }
            }
        }

        return null;
    },

    /**
     * Hit test for whole parts (inside test). For groups with children, returns { partName, childName } when a child is hit.
     * @param {Object} pos - Mouse position
     * @returns {string|{partName:string,childName:string}|null} Part name, or { partName, childName } for group child
     */
    hitPart(pos) {
        const parts = EditorState.getParts();

        const partEntries = Object.entries(parts).sort((a, b) => {
            const zA = a[1].zIndex || 0;
            const zB = b[1].zIndex || 0;
            return zB - zA;
        });

        for (const [name, part] of partEntries) {
            if (part.type === 'group' && part.children && typeof part.children === 'object') {
                const localPos = { x: pos.x - part.x, y: pos.y - part.y };
                for (const [childName, child] of Object.entries(part.children)) {
                    if (this.isPointInPart(localPos, child)) {
                        return { partName: name, childName };
                    }
                }
            }
            if (this.isPointInPart(pos, part)) {
                return name;
            }
        }

        return null;
    },

    /**
     * Check if point is inside a part
     * @param {Object} pos - Point { x, y }
     * @param {Object} part - Part data
     * @returns {boolean}
     */
    isPointInPart(pos, part) {
        switch (part.type) {
            case 'rect':
            case 'rotor':
                return pos.x >= part.x && pos.x <= part.x + part.w &&
                       pos.y >= part.y && pos.y <= part.y + part.h;

            case 'circle':
                return Math.hypot(pos.x - part.x, pos.y - part.y) <= part.r;

            case 'arc':
                const dist = Math.hypot(pos.x - part.x, pos.y - part.y);
                return dist <= part.r && pos.y <= part.y;

            case 'polygon':
                return this.isPointInPolygon(pos, part.points);

            case 'line':
                if (!part.points || part.points.length < 2) return false;
                for (let i = 0; i < part.points.length - 1; i++) {
                    const d = this.pointToSegmentDistance(pos, part.points[i], part.points[i + 1]);
                    if (d < (part.width || 2) + 3) return true;
                }
                return false;

            case 'group':
                if (part.children && typeof part.children === 'object') {
                    const localPos = { x: pos.x - part.x, y: pos.y - part.y };
                    for (const child of Object.values(part.children)) {
                        if (this.isPointInPart(localPos, child)) return true;
                    }
                }
                return pos.x >= part.x - 15 && pos.x <= part.x + 25 &&
                       pos.y >= part.y - 8 && pos.y <= part.y + 8;

            case 'wheels':
                if (!part.points) return false;
                for (const w of part.points) {
                    if (Math.hypot(pos.x - w.x, pos.y - w.y) <= 7) return true;
                }
                return false;

            default:
                return false;
        }
    },

    /**
     * Point in polygon test (ray casting)
     * @param {Object} pos - Point { x, y }
     * @param {Array} points - Polygon points
     * @returns {boolean}
     */
    isPointInPolygon(pos, points) {
        if (!points || points.length < 3) return false;

        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;

            if (((yi > pos.y) !== (yj > pos.y)) &&
                (pos.x < (xj - xi) * (pos.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    },

    // ========================================
    // EVENT HANDLERS
    // ========================================

    /**
     * Bind canvas mouse events
     */
    bindCanvasEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    },

    /**
     * Handle mouse down
     * @param {MouseEvent} e - Mouse event
     */
    onMouseDown(e) {
        const pos = this.getMousePos(e);
        const rawPos = this.getMousePosRaw(e);
        const tool = EditorState.activeTool;
        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;

        // Store drag start position
        EditorState.dragStart = { ...rawPos };

        // === Direct Select Tool (A key) - Point/Edge selection ===
        if (tool === 'direct_select') {
            // First check for transform handles if something is selected
            const handleHit = this.hitTransformHandle(pos);
            if (handleHit) {
                EditorState.saveToHistory();
                EditorState.dragging = {
                    type: handleHit.type,
                    idx: handleHit.idx,
                    bounds: handleHit.bounds,
                    startPos: rawPos
                };
                EditorState.transformOrigin = { x: handleHit.bounds.cx, y: handleHit.bounds.cy };
                this.canvas.style.cursor = handleHit.cursor;
                return;
            }

            // Check for point hit
            const pointHit = this.hitPoint(pos);
            if (pointHit) {
                if (isShift && pointHit.handleType === 'point') {
                    EditorState.selectPoint(pointHit.partName, pointHit.pointIdx, true);
                } else if (pointHit.handleType === 'point') {
                    EditorState.selectPoint(pointHit.partName, pointHit.pointIdx, false);
                } else {
                    // For other handle types (center, radius, corner), just select the part
                    EditorState.selectPart(pointHit.partName);
                }
                EditorState.dragging = {
                    type: pointHit.pointIdx >= 0 ? 'point' : 'pos',
                    part: pointHit.partName,
                    idx: pointHit.pointIdx,
                    handleType: pointHit.handleType,
                    startPos: rawPos
                };
                UIPanel.buildPartsPanel();
                return;
            }

            // Check for edge hit
            const edgeHit = this.hitEdge(pos);
            if (edgeHit) {
                EditorState.selectEdge(edgeHit.partName, edgeHit.edgeIdx, isShift);
                EditorState.dragging = {
                    type: 'edge',
                    part: edgeHit.partName,
                    idx: edgeHit.edgeIdx,
                    startPos: rawPos
                };
                UIPanel.buildPartsPanel();
                return;
            }

            // No hit - start box selection or deselect
            if (!isShift) {
                EditorState.clearSelection();
            }
            EditorState.boxSelect = { x1: rawPos.x, y1: rawPos.y, x2: rawPos.x, y2: rawPos.y };
            EditorState.dragging = { type: 'box', startPos: rawPos };
            UIPanel.buildPartsPanel();
            return;
        }

        // === Select Tool (V key) - Part selection ===
        if (tool === 'select') {
            // First check for transform handles
            const handleHit = this.hitTransformHandle(pos);
            if (handleHit) {
                EditorState.saveToHistory();
                EditorState.dragging = {
                    type: handleHit.type,
                    idx: handleHit.idx,
                    bounds: handleHit.bounds,
                    startPos: rawPos
                };
                EditorState.transformOrigin = { x: handleHit.bounds.cx, y: handleHit.bounds.cy };
                this.canvas.style.cursor = handleHit.cursor;
                return;
            }

            // Check for part hit (or group child hit)
            const partHit = this.hitPart(pos);
            if (partHit) {
                const partName = typeof partHit === 'object' ? partHit.partName : partHit;
                if (typeof partHit === 'object' && partHit.childName) {
                    if (!isShift) EditorState.selectGroupChild(partHit.partName, partHit.childName);
                } else if (isShift) {
                    EditorState.toggleSelection(partName);
                } else if (!EditorState.isPartSelected(partName)) {
                    EditorState.selectPart(partName);
                }
                EditorState.dragging = {
                    type: 'move-parts',
                    startPos: rawPos
                };
                UIPanel.buildPartsPanel();
                return;
            }

            // No hit - start box selection or deselect
            if (!isShift) {
                EditorState.clearSelection();
            }
            EditorState.boxSelect = { x1: rawPos.x, y1: rawPos.y, x2: rawPos.x, y2: rawPos.y };
            EditorState.dragging = { type: 'box', startPos: rawPos };
            UIPanel.buildPartsPanel();
            return;
        }

        // === Move Tool (M key) ===
        if (tool === 'move') {
            if (EditorState.selectedParts.size > 0) {
                EditorState.dragging = {
                    type: 'move-parts',
                    startPos: rawPos
                };
            }
            return;
        }

        // === Hand Tool (Space) - Pan ===
        if (tool === 'hand') {
            const screenPos = this.getScreenPos(e);
            EditorState.dragging = {
                type: 'pan',
                startScreenX: screenPos.x,
                startScreenY: screenPos.y,
                startOffsetX: EditorState.viewOffsetX,
                startOffsetY: EditorState.viewOffsetY
            };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // === Pen Tool (P key) - Add points to edges or create new paths ===
        if (tool === 'pen') {
            this.handlePenToolClick(pos, rawPos, isShift);
            return;
        }

        // === Hitbox Tool (H key) - Edit hardpoints and hitbox ===
        if (tool === 'hitbox') {
            this.handleHitboxToolClick(pos, rawPos, isShift, isCtrl);
            return;
        }

        // Fallback: old behavior for other tools
        this.onMouseDownLegacy(e, pos);
    },

    /**
     * Handle hitbox tool click - select/create/drag hardpoints
     * @param {Object} pos - Mouse position
     * @param {Object} rawPos - Raw mouse position
     * @param {boolean} isShift - Shift key for add mode
     * @param {boolean} isCtrl - Ctrl key for delete mode
     */
    handleHitboxToolClick(pos, rawPos, isShift, isCtrl) {
        const unitData = EditorState.unitData;
        if (!unitData) {
            Toast.show('먼저 유닛을 선택하세요.', 'error');
            return;
        }

        // Initialize hardpoints if not exist
        if (!unitData.hardpoints) {
            unitData.hardpoints = {};
        }

        // Check if clicking on existing hardpoint
        const hitHardpoint = this.hitHardpoint(pos);

        if (hitHardpoint) {
            if (isCtrl) {
                // Delete hardpoint
                EditorState.saveToHistory();
                delete unitData.hardpoints[hitHardpoint];
                EditorState.selectedHardpoint = null;
                UIPanel.buildPartsPanel();
                UIPanel.updateJsonOutput();
                CanvasRenderer.draw();
                Toast.show(`"${hitHardpoint}" 삭제됨`, 'success');
            } else {
                // Select and start drag
                EditorState.selectedHardpoint = hitHardpoint;
                EditorState.dragging = {
                    type: 'hardpoint',
                    name: hitHardpoint,
                    startPos: rawPos
                };
                CanvasRenderer.draw();
            }
            return;
        }

        // Click on empty space - create new hardpoint
        const name = isShift ? `muzzle${Object.keys(unitData.hardpoints).length + 1}` : 'muzzle';
        const finalName = unitData.hardpoints[name] ? `${name}_${Date.now() % 1000}` : name;

        EditorState.saveToHistory();
        unitData.hardpoints[finalName] = { x: pos.x, y: pos.y };
        EditorState.selectedHardpoint = finalName;

        UIPanel.buildPartsPanel();
        UIPanel.updateJsonOutput();
        CanvasRenderer.draw();
        Toast.show(`하드포인트 "${finalName}" 추가됨`, 'success');
    },

    /**
     * Hit test for hardpoints
     * @param {Object} pos - Mouse position
     * @returns {string|null} Hardpoint name or null
     */
    hitHardpoint(pos) {
        const unitData = EditorState.unitData;
        if (!unitData?.hardpoints) return null;

        const scale = EditorState.scale;
        const hitRadius = 10 / scale;

        for (const [name, hp] of Object.entries(unitData.hardpoints)) {
            if (Math.hypot(pos.x - hp.x, pos.y - hp.y) < hitRadius) {
                return name;
            }
        }

        return null;
    },

    /**
     * Confirm pen draft and create new part
     */
    confirmPenDraft() {
        const draft = EditorState.penDraft;
        if (!draft || draft.points.length < 2) return;

        const type = draft.mode === 'line' ? 'line' : 'polygon';
        const name = EditorState.generatePartName(type);

        // Need at least 3 points for polygon
        if (type === 'polygon' && draft.points.length < 3) {
            Toast.show('다각형은 최소 3개 점이 필요합니다.', 'error');
            return;
        }

        EditorState.saveToHistory();
        EditorState.addPart(name, {
            type: type,
            points: draft.points.map(p => ({ x: p.x, y: p.y })),
            color: type === 'line' ? '#94a3b8' : EditorState.teamColor,
            ...(type === 'line' ? { width: 2, lineStyle: 'solid' } : {})
        });

        EditorState.penDraft = null;
        EditorState.selectPart(name);

        UIPanel.buildPartsPanel();
        UIPanel.updateJsonOutput();
        UIPanel.updateProfile();
        CanvasRenderer.draw();
        Toast.show(`${type === 'line' ? '선' : '다각형'} 생성됨`, 'success');
    },

    /**
     * Handle pen tool click - insert point on edge or start new path
     * @param {Object} pos - Rounded mouse position
     * @param {Object} rawPos - Raw mouse position
     * @param {boolean} isShift - Shift key pressed
     */
    handlePenToolClick(pos, rawPos, isShift) {
        // First, check if clicking on an existing edge (to insert point)
        const edgeHit = this.hitEdge(pos);

        if (edgeHit) {
            let part = EditorState.getPart(edgeHit.partName);
            // Convert rect/rotor to polygon first so we can add a point on the edge
            if (edgeHit.isRectOrRotor && part && (part.type === 'rect' || part.type === 'rotor')) {
                EditorState.saveToHistory();
                EditorState.replacePartWithPolygon(edgeHit.partName);
                part = EditorState.getPart(edgeHit.partName);
            }
            if (part && part.points) {
                const p1 = part.points[edgeHit.edgeIdx];
                const p2 = part.points[(edgeHit.edgeIdx + 1) % part.points.length];

                // Get projection point on the edge
                const proj = this.pointToSegmentProjection(pos, p1, p2);

                if (!edgeHit.isRectOrRotor) EditorState.saveToHistory();
                part.points.splice(edgeHit.edgeIdx + 1, 0, { x: proj.x, y: proj.y });
                if (edgeHit.isRectOrRotor) EditorState.saveToHistory();

                // Select the new point for immediate dragging
                EditorState.selectPoint(edgeHit.partName, edgeHit.edgeIdx + 1, false);

                // Start dragging the new point
                EditorState.dragging = {
                    type: 'point',
                    part: edgeHit.partName,
                    idx: edgeHit.edgeIdx + 1,
                    startPos: rawPos,
                    moved: false
                };

                EditorState.emit('partUpdated', { partName: edgeHit.partName, data: part });
                UIPanel.buildPartsPanel();
                UIPanel.updateJsonOutput();
                CanvasRenderer.draw();
                Toast.show('점 추가됨', 'success');
                return;
            }
        }

        // Not on edge - handle new path creation
        if (EditorState.penDraft) {
            // Add point to existing draft
            EditorState.penDraft.points.push({ x: pos.x, y: pos.y });
            CanvasRenderer.draw();
            Toast.show(`점 ${EditorState.penDraft.points.length}개`, 'info');
        } else {
            // Start new draft path
            EditorState.penDraft = {
                points: [{ x: pos.x, y: pos.y }],
                mode: isShift ? 'line' : 'polygon'  // Shift = polyline, default = polygon
            };
            CanvasRenderer.draw();
            Toast.show('새 패스 시작 (Enter: 확정, Esc: 취소)', 'info');
        }
    },

    /**
     * Legacy mouse down handler for backwards compatibility
     */
    onMouseDownLegacy(e, pos) {
        const parts = EditorState.getParts();
        const hitRadius = this.getHitRadius();

        // Check for handle hits
        for (const [name, part] of Object.entries(parts)) {
            if (part.type === 'polygon' || part.type === 'wheels' || part.type === 'line') {
                if (!part.points) continue;
                for (let i = 0; i < part.points.length; i++) {
                    const p = part.points[i];
                    if (Math.hypot(pos.x - p.x, pos.y - p.y) < hitRadius) {
                        EditorState.selectPart(name);
                        EditorState.dragging = { part: name, idx: i, type: 'point' };
                        return;
                    }
                }
            } else if (part.type === 'rect' || part.type === 'rotor') {
                if (Math.hypot(pos.x - part.x, pos.y - part.y) < hitRadius) {
                    EditorState.selectPart(name);
                    EditorState.dragging = { part: name, idx: -1, type: 'pos' };
                    return;
                }
            } else if (part.type === 'circle' || part.type === 'arc') {
                if (Math.hypot(pos.x - part.x, pos.y - part.y) < hitRadius) {
                    EditorState.selectPart(name);
                    EditorState.dragging = { part: name, idx: -1, type: 'pos' };
                    return;
                }
            } else if (part.type === 'group') {
                if (Math.hypot(pos.x - part.x, pos.y - part.y) < hitRadius) {
                    EditorState.selectPart(name);
                    EditorState.dragging = { part: name, idx: -1, type: 'pos' };
                    return;
                }
            }
        }

        // No hit - deselect
        EditorState.selectPart(null);
    },

    /**
     * Handle mouse move
     * @param {MouseEvent} e - Mouse event
     */
    onMouseMove(e) {
        const pos = this.getMousePos(e);
        const rawPos = this.getMousePosRaw(e);

        // Update position display
        const posLabel = document.getElementById('statusPos');
        if (posLabel) {
            posLabel.textContent = `Pos: ${pos.x}, ${pos.y}`;
        }

        // Update cursor based on hover
        if (!EditorState.dragging) {
            this.updateCursor(pos);
        }

        // Handle dragging
        if (!EditorState.dragging) return;

        const dragType = EditorState.dragging.type;

        // === Pan (Hand Tool) ===
        if (dragType === 'pan') {
            const screenPos = this.getScreenPos(e);
            const dx = screenPos.x - EditorState.dragging.startScreenX;
            const dy = screenPos.y - EditorState.dragging.startScreenY;

            EditorState.viewOffsetX = EditorState.dragging.startOffsetX + dx;
            EditorState.viewOffsetY = EditorState.dragging.startOffsetY + dy;

            CanvasRenderer.draw();
            return;
        }

        // === Box Selection ===
        if (dragType === 'box' && EditorState.boxSelect) {
            EditorState.boxSelect.x2 = rawPos.x;
            EditorState.boxSelect.y2 = rawPos.y;
            CanvasRenderer.draw();
            return;
        }

        // === Hardpoint Drag ===
        if (dragType === 'hardpoint') {
            const hpName = EditorState.dragging.name;
            const hp = EditorState.unitData?.hardpoints?.[hpName];
            if (!hp) return;

            if (!EditorState.dragging.moved) {
                EditorState.saveToHistory();
                EditorState.dragging.moved = true;
            }

            hp.x = pos.x;
            hp.y = pos.y;

            UIPanel.updateJsonOutput();
            CanvasRenderer.draw();
            return;
        }

        // === Move Selected Parts ===
        if (dragType === 'move-parts') {
            if (!EditorState.dragging.moved) {
                EditorState.saveToHistory();
                EditorState.dragging.moved = true;
            }

            const dx = pos.x - Math.round(EditorState.dragging.startPos.x);
            const dy = pos.y - Math.round(EditorState.dragging.startPos.y);

            if (EditorState.selectedChild && EditorState.selectedPart) {
                const part = EditorState.getPart(EditorState.selectedPart, EditorState.selectedChild);
                if (part) this.movePart(part, dx, dy);
            } else {
                for (const partName of EditorState.selectedParts) {
                    const part = EditorState.getPart(partName);
                    if (!part) continue;
                    this.movePart(part, dx, dy);
                }
            }

            EditorState.dragging.startPos = rawPos;
            EditorState.emit('partUpdated', {});
            UIPanel.buildPartsPanel();
            UIPanel.updateJsonOutput();
            return;
        }

        // === Rotate ===
        if (dragType === 'rotate' && EditorState.transformOrigin) {
            if (!EditorState.dragging.moved) {
                EditorState.dragging.moved = true;
            }

            const origin = EditorState.transformOrigin;
            const startAngle = Math.atan2(
                EditorState.dragging.startPos.y - origin.y,
                EditorState.dragging.startPos.x - origin.x
            );
            const currentAngle = Math.atan2(rawPos.y - origin.y, rawPos.x - origin.x);
            const deltaAngle = currentAngle - startAngle;

            this.rotateSelection(deltaAngle, origin);
            EditorState.dragging.startPos = rawPos;
            return;
        }

        // === Scale ===
        if (dragType === 'scale' && EditorState.dragging.bounds) {
            if (!EditorState.dragging.moved) {
                EditorState.dragging.moved = true;
            }

            const bounds = EditorState.dragging.bounds;
            const origin = { x: bounds.cx, y: bounds.cy };

            const startDist = Math.hypot(
                EditorState.dragging.startPos.x - origin.x,
                EditorState.dragging.startPos.y - origin.y
            );
            const currentDist = Math.hypot(rawPos.x - origin.x, rawPos.y - origin.y);

            if (startDist > 0) {
                const scaleFactor = currentDist / startDist;
                this.scaleSelection(scaleFactor, origin);
                EditorState.dragging.startPos = rawPos;
            }
            return;
        }

        // === Point/Edge Drag ===
        if (dragType === 'point' || dragType === 'pos') {
            const { part: partName, idx, handleType } = EditorState.dragging;
            const part = EditorState.getPart(partName);
            if (!part) return;

            if (!EditorState.dragging.moved) {
                EditorState.saveToHistory();
                EditorState.dragging.moved = true;
            }

            if (dragType === 'point' && idx >= 0 && part.points) {
                // Regular point
                part.points[idx] = { ...pos };
            } else if (handleType === 'radius' && (part.type === 'circle' || part.type === 'arc')) {
                // Radius handle - adjust radius based on distance from center
                const newRadius = Math.max(1, Math.hypot(pos.x - part.x, pos.y - part.y));
                part.r = Math.round(newRadius);
            } else if (handleType === 'corner' && (part.type === 'rect' || part.type === 'rotor')) {
                // Corner handle for rect - resize from corner
                const cornerIdx = idx;
                const dx = pos.x - Math.round(EditorState.dragging.startPos.x);
                const dy = pos.y - Math.round(EditorState.dragging.startPos.y);

                if (cornerIdx === 0) { // Top-left
                    part.x += dx; part.y += dy;
                    part.w -= dx; part.h -= dy;
                } else if (cornerIdx === 1) { // Top-right
                    part.y += dy;
                    part.w += dx; part.h -= dy;
                } else if (cornerIdx === 2) { // Bottom-right
                    part.w += dx; part.h += dy;
                } else if (cornerIdx === 3) { // Bottom-left
                    part.x += dx;
                    part.w -= dx; part.h += dy;
                }

                // Ensure minimum size
                if (part.w < 1) part.w = 1;
                if (part.h < 1) part.h = 1;

                EditorState.dragging.startPos = rawPos;
            } else if (dragType === 'pos' || idx === -1 || handleType === 'center') {
                part.x = pos.x;
                part.y = pos.y;
            }

            EditorState.emit('partUpdated', { partName, data: part });
            UIPanel.buildPartsPanel();
            UIPanel.updateJsonOutput();
            return;
        }

        // === Edge Drag (move both endpoints) ===
        if (dragType === 'edge') {
            const { part: partName, idx } = EditorState.dragging;
            const part = EditorState.getPart(partName);
            if (!part || !part.points) return;

            if (!EditorState.dragging.moved) {
                EditorState.saveToHistory();
                EditorState.dragging.moved = true;
            }

            const dx = pos.x - Math.round(EditorState.dragging.startPos.x);
            const dy = pos.y - Math.round(EditorState.dragging.startPos.y);

            const p1Idx = idx;
            const p2Idx = (idx + 1) % part.points.length;

            part.points[p1Idx].x += dx;
            part.points[p1Idx].y += dy;
            part.points[p2Idx].x += dx;
            part.points[p2Idx].y += dy;

            EditorState.dragging.startPos = rawPos;
            EditorState.emit('partUpdated', { partName, data: part });
            UIPanel.buildPartsPanel();
            UIPanel.updateJsonOutput();
            return;
        }

        // Legacy handler
        this.onMouseMoveLegacy(e, pos, rawPos);
    },

    /**
     * Legacy mouse move for backwards compatibility
     */
    onMouseMoveLegacy(e, pos, rawPos) {
        if (!EditorState.dragging) return;

        const { part: partName, idx, type } = EditorState.dragging;
        const part = EditorState.getPart(partName);
        if (!part) return;

        if (type === 'point' && idx >= 0 && part.points) {
            if (!EditorState.dragging.moved) {
                EditorState.saveToHistory();
                EditorState.dragging.moved = true;
            }
            part.points[idx] = { ...pos };
            EditorState.emit('partUpdated', { partName, data: part });
            UIPanel.buildPartsPanel();
            UIPanel.updateJsonOutput();
        } else if (type === 'pos') {
            if (!EditorState.dragging.moved) {
                EditorState.saveToHistory();
                EditorState.dragging.moved = true;
            }
            part.x = pos.x;
            part.y = pos.y;
            EditorState.emit('partUpdated', { partName, data: part });
            UIPanel.buildPartsPanel();
            UIPanel.updateJsonOutput();
        }
    },

    /**
     * Handle mouse up
     * @param {MouseEvent} e - Mouse event (optional)
     */
    onMouseUp(e) {
        // Handle box selection
        if (EditorState.dragging?.type === 'box' && EditorState.boxSelect) {
            this.finishBoxSelection(e?.shiftKey || false);
        }

        EditorState.dragging = null;
        EditorState.boxSelect = null;
        EditorState.transformOrigin = null;
        this.canvas.style.cursor = 'crosshair';
    },

    /**
     * Finish box selection - select all parts within the box
     * @param {boolean} additive - Add to existing selection
     */
    finishBoxSelection(additive) {
        const box = EditorState.boxSelect;
        if (!box) return;

        const minX = Math.min(box.x1, box.x2);
        const maxX = Math.max(box.x1, box.x2);
        const minY = Math.min(box.y1, box.y2);
        const maxY = Math.max(box.y1, box.y2);

        // Skip if box is too small
        if (maxX - minX < 2 && maxY - minY < 2) return;

        if (!additive) {
            EditorState.selectedParts.clear();
            EditorState.selectedPart = null;
        }

        const parts = EditorState.getParts();

        for (const [name, part] of Object.entries(parts)) {
            if (this.isPartInBox(part, minX, minY, maxX, maxY)) {
                EditorState.selectedParts.add(name);
                if (!EditorState.selectedPart) {
                    EditorState.selectedPart = name;
                }
            }
        }

        EditorState.emit('selectionChanged', { parts: EditorState.selectedParts });
        UIPanel.buildPartsPanel();
        CanvasRenderer.draw();
    },

    /**
     * Check if a part is within a selection box
     * @param {Object} part - Part data
     * @param {number} minX - Box min X
     * @param {number} minY - Box min Y
     * @param {number} maxX - Box max X
     * @param {number} maxY - Box max Y
     * @returns {boolean}
     */
    isPartInBox(part, minX, minY, maxX, maxY) {
        if (part.points) {
            // Check if any point is in the box
            return part.points.some(p =>
                p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
            );
        } else if (part.type === 'rect' || part.type === 'rotor') {
            return part.x >= minX && part.x + part.w <= maxX &&
                   part.y >= minY && part.y + part.h <= maxY;
        } else if (part.type === 'circle' || part.type === 'arc') {
            return part.x >= minX && part.x <= maxX &&
                   part.y >= minY && part.y <= maxY;
        } else if (part.type === 'group') {
            return part.x >= minX && part.x <= maxX &&
                   part.y >= minY && part.y <= maxY;
        }
        return false;
    },

    /**
     * Update cursor based on what's under the mouse
     * @param {Object} pos - Mouse position
     */
    updateCursor(pos) {
        const tool = EditorState.activeTool;

        // Check transform handles first
        if (EditorState.selectedParts.size > 0) {
            const handleHit = this.hitTransformHandle(pos);
            if (handleHit) {
                this.canvas.style.cursor = handleHit.cursor;
                return;
            }
        }

        // Tool-specific cursors
        if (tool === 'hand') {
            this.canvas.style.cursor = 'grab';
        } else if (tool === 'direct_select') {
            const pointHit = this.hitPoint(pos);
            if (pointHit) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'crosshair';
            }
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    },

    /**
     * Handle double click (e.g., to enter isolation mode or add point)
     * @param {MouseEvent} e - Mouse event
     */
    onDoubleClick(e) {
        const pos = this.getMousePos(e);
        const tool = EditorState.activeTool;

        // Direct select: double-click on edge to add point
        if (tool === 'direct_select') {
            const edgeHit = this.hitEdge(pos);
            if (edgeHit) {
                this.addPointToEdge(edgeHit.partName, edgeHit.edgeIdx, pos);
            }
        }
    },

    /**
     * Add a point to an edge
     * @param {string} partName - Part name
     * @param {number} edgeIdx - Edge index
     * @param {Object} pos - Position for new point
     */
    addPointToEdge(partName, edgeIdx, pos) {
        const part = EditorState.getPart(partName);
        if (!part || !part.points) return;

        EditorState.saveToHistory();
        part.points.splice(edgeIdx + 1, 0, { x: pos.x, y: pos.y });
        EditorState.emit('partUpdated', { partName, data: part });
        UIPanel.buildPartsPanel();
        UIPanel.updateJsonOutput();
        Toast.show('점 추가됨', 'success');
    },

    // ========================================
    // TRANSFORM HELPERS
    // ========================================

    /**
     * Move a part by delta
     * @param {Object} part - Part data
     * @param {number} dx - Delta X
     * @param {number} dy - Delta Y
     */
    movePart(part, dx, dy) {
        if (part.points) {
            for (const p of part.points) {
                p.x += dx;
                p.y += dy;
            }
        } else if (part.x !== undefined) {
            part.x += dx;
            part.y += dy;
        }
    },

    /**
     * Rotate selection around origin
     * @param {number} angle - Angle in radians
     * @param {Object} origin - Rotation origin { x, y }
     */
    rotateSelection(angle, origin) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        for (const partName of EditorState.selectedParts) {
            const part = EditorState.getPart(partName);
            if (!part) continue;

            if (part.points) {
                for (const p of part.points) {
                    const rx = p.x - origin.x;
                    const ry = p.y - origin.y;
                    p.x = origin.x + rx * cos - ry * sin;
                    p.y = origin.y + rx * sin + ry * cos;
                }
            } else if (part.x !== undefined) {
                const rx = part.x - origin.x;
                const ry = part.y - origin.y;
                part.x = origin.x + rx * cos - ry * sin;
                part.y = origin.y + rx * sin + ry * cos;
            }
        }

        EditorState.emit('partUpdated', {});
        UIPanel.buildPartsPanel();
        UIPanel.updateJsonOutput();
    },

    /**
     * Flip selection horizontally (mirror on X axis)
     */
    flipSelectionH() {
        if (EditorState.selectedParts.size === 0) {
            Toast.show('먼저 파츠를 선택하세요.', 'error');
            return;
        }

        const bounds = EditorState.getSelectionBounds();
        if (!bounds) return;

        EditorState.saveToHistory();
        const cx = bounds.cx;

        for (const partName of EditorState.selectedParts) {
            const part = EditorState.getPart(partName);
            if (!part) continue;

            if (part.points) {
                for (const p of part.points) {
                    p.x = cx + (cx - p.x);
                }
            } else if (part.x !== undefined) {
                // For rect/rotor, flip position relative to center
                if (part.w !== undefined) {
                    part.x = cx + (cx - part.x - part.w);
                } else {
                    part.x = cx + (cx - part.x);
                }
            }
        }

        EditorState.emit('partUpdated', {});
        UIPanel.buildPartsPanel();
        UIPanel.updateJsonOutput();
        CanvasRenderer.draw();
        Toast.show('좌우 반전됨', 'success');
    },

    /**
     * Flip selection vertically (mirror on Y axis)
     */
    flipSelectionV() {
        if (EditorState.selectedParts.size === 0) {
            Toast.show('먼저 파츠를 선택하세요.', 'error');
            return;
        }

        const bounds = EditorState.getSelectionBounds();
        if (!bounds) return;

        EditorState.saveToHistory();
        const cy = bounds.cy;

        for (const partName of EditorState.selectedParts) {
            const part = EditorState.getPart(partName);
            if (!part) continue;

            if (part.points) {
                for (const p of part.points) {
                    p.y = cy + (cy - p.y);
                }
            } else if (part.y !== undefined) {
                // For rect/rotor, flip position relative to center
                if (part.h !== undefined) {
                    part.y = cy + (cy - part.y - part.h);
                } else {
                    part.y = cy + (cy - part.y);
                }
            }
        }

        EditorState.emit('partUpdated', {});
        UIPanel.buildPartsPanel();
        UIPanel.updateJsonOutput();
        CanvasRenderer.draw();
        Toast.show('상하 반전됨', 'success');
    },

    /**
     * Scale selection around origin
     * @param {number} factor - Scale factor
     * @param {Object} origin - Scale origin { x, y }
     */
    scaleSelection(factor, origin) {
        for (const partName of EditorState.selectedParts) {
            const part = EditorState.getPart(partName);
            if (!part) continue;

            if (part.points) {
                for (const p of part.points) {
                    p.x = origin.x + (p.x - origin.x) * factor;
                    p.y = origin.y + (p.y - origin.y) * factor;
                }
            } else if (part.x !== undefined) {
                part.x = origin.x + (part.x - origin.x) * factor;
                part.y = origin.y + (part.y - origin.y) * factor;

                if (part.w !== undefined) {
                    part.w *= factor;
                    part.h *= factor;
                }
                if (part.r !== undefined) {
                    part.r *= factor;
                }
            }
        }

        EditorState.emit('partUpdated', {});
        UIPanel.buildPartsPanel();
        UIPanel.updateJsonOutput();
    },

    /**
     * Handle mouse wheel (zoom)
     * @param {WheelEvent} e - Wheel event
     */
    onWheel(e) {
        if (e.altKey || e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.5 : 0.5;
            EditorState.setScale(EditorState.scale + delta);

            const zoomLabel = document.getElementById('zoomLevel');
            if (zoomLabel) {
                zoomLabel.textContent = `${Math.round(EditorState.scale * 100 / 3)}%`;
            }
        }
    },

    /**
     * Bind keyboard events
     */
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    },

    /**
     * Handle key down
     * @param {KeyboardEvent} e - Keyboard event
     */
    onKeyDown(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();

        // Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) {
            const action = CTRL_SHORTCUTS[key];
            if (action) {
                e.preventDefault();
                this.executeAction(action);
            }
            return;
        }

        // Shift+Z for redo
        if (e.shiftKey && key === 'z') {
            e.preventDefault();
            this.executeAction('redo');
            return;
        }

        // Shift shortcuts (e.g., Shift+F for vertical flip)
        if (e.shiftKey && typeof SHIFT_SHORTCUTS !== 'undefined') {
            const shiftAction = SHIFT_SHORTCUTS[key];
            if (shiftAction) {
                e.preventDefault();
                this.executeAction(shiftAction);
                return;
            }
        }

        // Tool shortcuts
        const tool = SHORTCUTS[key];
        if (tool) {
            if (tool.startsWith('toggle')) {
                this.executeAction(tool);
            } else {
                EditorState.setTool(tool);
                UIPanel.updateToolbar();
                UIPanel.updateOptionBar();
            }
            return;
        }

        // Escape to deselect or cancel pen draft
        if (key === 'escape') {
            if (EditorState.penDraft) {
                EditorState.penDraft = null;
                CanvasRenderer.draw();
                Toast.show('패스 취소됨', 'info');
                return;
            }
            EditorState.clearSelection();
            EditorState.activeMenu = null;
            MenuBar.render();
            UIPanel.buildPartsPanel();
        }

        // Enter to confirm pen draft
        if (key === 'enter') {
            if (EditorState.penDraft && EditorState.penDraft.points.length >= 2) {
                this.confirmPenDraft();
                return;
            }
        }

        // Delete to remove selected parts
        if (key === 'delete' || key === 'backspace') {
            if (EditorState.selectedParts.size > 0) {
                e.preventDefault();
                EditorState.saveToHistory();
                for (const partName of EditorState.selectedParts) {
                    EditorState.removePart(partName);
                }
                UIPanel.buildPartsPanel();
                UIPanel.updateJsonOutput();
                UIPanel.updateProfile();
                Toast.show('삭제됨', 'success');
            }
        }

        // Arrow keys to nudge selection
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            if (EditorState.selectedParts.size > 0) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                let dx = 0, dy = 0;
                if (key === 'arrowup') dy = -step;
                if (key === 'arrowdown') dy = step;
                if (key === 'arrowleft') dx = -step;
                if (key === 'arrowright') dx = step;

                EditorState.saveToHistory();
                for (const partName of EditorState.selectedParts) {
                    const part = EditorState.getPart(partName);
                    if (part) this.movePart(part, dx, dy);
                }
                EditorState.emit('partUpdated', {});
                UIPanel.buildPartsPanel();
                UIPanel.updateJsonOutput();
            }
        }
    },

    /**
     * Execute an action
     * @param {string} action - Action name
     */
    executeAction(action) {
        switch (action) {
            case 'saveUnit':
                UnitLoader.saveUnit();
                break;
            case 'undo':
                if (EditorState.undo()) {
                    UIPanel.buildPartsPanel();
                    UIPanel.updateJsonOutput();
                    Toast.show('실행 취소', 'info');
                }
                break;
            case 'redo':
                if (EditorState.redo()) {
                    UIPanel.buildPartsPanel();
                    UIPanel.updateJsonOutput();
                    Toast.show('다시 실행', 'info');
                }
                break;
            case 'copy':
                UnitLoader.copyToClipboard();
                break;
            case 'paste':
                UnitLoader.pasteFromClipboard();
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
            case 'zoomIn':
                EditorState.setScale(EditorState.scale + 0.5);
                UIPanel.updateZoomLevel();
                break;
            case 'zoomOut':
                EditorState.setScale(EditorState.scale - 0.5);
                UIPanel.updateZoomLevel();
                break;
            case 'zoomReset':
                EditorState.setScale(3);
                UIPanel.updateZoomLevel();
                break;
            case 'newUnit':
                const name = prompt('유닛 ID를 입력하세요:', 'new_unit');
                if (name) {
                    UnitLoader.createNewUnit(name);
                    UIPanel.renderUnitList();
                    UIPanel.showCurrentUnitInfo();
                    UIPanel.buildPartsPanel();
                    UIPanel.updateJsonOutput();
                    UIPanel.updateProfile();
                }
                break;
            case 'openUnit':
                const modal = document.getElementById('unitSelectModal');
                if (modal) {
                    modal.style.display = 'flex';
                    UIPanel.renderUnitGrid();
                }
                break;
            case 'exportJson':
                UnitLoader.exportSimplified();
                break;
            case 'toggleTransform':
                EditorState.showTransform = !EditorState.showTransform;
                UIPanel.togglePanel('transform');
                break;
            case 'toggleAnimation':
                EditorState.showAnimation = !EditorState.showAnimation;
                UIPanel.togglePanel('animation');
                break;
            case 'flipH':
                this.flipSelectionH();
                break;
            case 'flipV':
                this.flipSelectionV();
                break;
            case 'showShortcuts':
                alert(`단축키 정보:
V - 선택 도구 (파츠 전체 선택)
A - 직접 선택 (점/엣지 선택)
M - 이동
X - 엑스레이 모드
F - 좌우 반전
Shift+F - 상하 반전
Space - 패닝 (화면 이동)
Shift+클릭 - 다중 선택
더블클릭 - 엣지에 점 추가
화살표 - 선택 이동 (Shift: 10px)
Ctrl+S - 저장
Ctrl+Z - 실행 취소
Ctrl+Y - 다시 실행
Delete - 삭제`);
                break;
            default:
                console.log('Unknown action:', action);
        }
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.Interaction = Interaction;
}
