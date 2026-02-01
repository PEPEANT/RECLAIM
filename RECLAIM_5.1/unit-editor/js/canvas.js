/**
 * CANVAS.JS
 * Canvas rendering logic for the unit editor
 */

const CanvasRenderer = {
    canvas: null,
    ctx: null,
    animationId: null,

    /**
     * Initialize the canvas
     * @param {HTMLCanvasElement} canvasElement - Canvas element
     */
    init(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        // Listen for state changes
        EditorState.on('unitChanged', () => this.draw());
        EditorState.on('unitUpdated', () => this.draw());
        EditorState.on('partUpdated', () => this.draw());
        EditorState.on('partAdded', () => this.draw());
        EditorState.on('partRemoved', () => this.draw());
        EditorState.on('unitReset', () => this.draw());
        EditorState.on('historyChanged', () => this.draw());
        EditorState.on('scaleChanged', () => this.draw());
        EditorState.on('xrayToggled', () => this.draw());
        EditorState.on('selectionChanged', () => this.draw());
    },

    /**
     * Apply line style to context
     * @param {string} style - Line style (solid, dash, dot)
     */
    applyLineStyle(style) {
        const scale = EditorState.scale;
        if (style === 'dash') {
            this.ctx.setLineDash([6 / scale, 4 / scale]);
        } else if (style === 'dot') {
            this.ctx.setLineDash([2 / scale, 4 / scale]);
        } else {
            this.ctx.setLineDash([]);
        }
    },

    /**
     * Get color value (handle 'team' color)
     * @param {string} color - Color value
     * @returns {string} Resolved color
     */
    getColor(color) {
        return color === 'team' ? EditorState.teamColor : color;
    },

    /**
     * Draw the entire canvas
     */
    draw() {
        const { ctx, canvas } = this;
        if (!ctx || !canvas) return;

        const { unitData, scale, xrayMode, showGrid, showHandles } = EditorState;

        // Clear canvas
        ctx.fillStyle = CANVAS_CONFIG.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Save context and transform (apply view offset for panning)
        ctx.save();
        ctx.translate(
            canvas.width / 2 + EditorState.viewOffsetX,
            canvas.height / 2 + EditorState.viewOffsetY
        );
        ctx.scale(scale, scale);

        // Draw grid in unit coords so it moves with pan/zoom
        if (showGrid) {
            this.drawGrid();
        }

        // If no unit data, stop here (but grid already drawn)
        if (!unitData || !unitData.parts) {
            ctx.restore();
            return;
        }

        // Draw all parts
        const parts = Object.entries(unitData.parts);

        // Sort by zIndex if available
        parts.sort((a, b) => {
            const zA = a[1].zIndex || 0;
            const zB = b[1].zIndex || 0;
            return zA - zB;
        });

        for (const [name, part] of parts) {
            this.drawPart(name, part, xrayMode);
        }

        // Draw handles if enabled
        if (showHandles) {
            // First draw edges for selected parts (so points appear on top)
            for (const [name, part] of parts) {
                this.drawEdgeHandles(name, part);
            }
            // Then draw point handles
            for (const [name, part] of parts) {
                this.drawHandles(name, part);
            }
        }

        // Draw transform gizmo (bounding box with handles)
        this.drawTransformGizmo();

        // Draw box selection rectangle
        this.drawBoxSelection();

        // Draw pen draft (new path being created)
        this.drawPenDraft();

        // Draw hardpoints (muzzle, etc.)
        this.drawHardpoints();

        // Draw hitboxes
        this.drawHitboxes();

        ctx.restore();
    },

    /**
     * Draw hardpoint markers (muzzle positions, etc.)
     */
    drawHardpoints() {
        const unitData = EditorState.unitData;
        if (!unitData?.hardpoints) return;

        const { ctx } = this;
        const scale = EditorState.scale;
        const isHitboxTool = EditorState.activeTool === 'hitbox';

        for (const [name, hp] of Object.entries(unitData.hardpoints)) {
            const isSelected = EditorState.selectedHardpoint === name;
            const size = 8 / scale;

            // Draw crosshair
            ctx.strokeStyle = isSelected ? '#00ffff' : '#ff6b6b';
            ctx.lineWidth = 2 / scale;

            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(hp.x - size, hp.y);
            ctx.lineTo(hp.x + size, hp.y);
            ctx.stroke();

            // Vertical line
            ctx.beginPath();
            ctx.moveTo(hp.x, hp.y - size);
            ctx.lineTo(hp.x, hp.y + size);
            ctx.stroke();

            // Circle
            ctx.beginPath();
            ctx.arc(hp.x, hp.y, size * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = isSelected ? '#00ffff' : '#ff6b6b';
            ctx.stroke();

            // Direction indicator (arrow pointing right)
            if (hp.direction !== undefined) {
                const angle = (hp.direction || 0) * Math.PI / 180;
                const arrowLen = size * 1.5;
                ctx.beginPath();
                ctx.moveTo(hp.x, hp.y);
                ctx.lineTo(
                    hp.x + Math.cos(angle) * arrowLen,
                    hp.y + Math.sin(angle) * arrowLen
                );
                ctx.strokeStyle = '#ffcc00';
                ctx.stroke();
            }

            // Label
            ctx.fillStyle = isSelected ? '#00ffff' : '#ff6b6b';
            ctx.font = `bold ${9 / scale}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(name, hp.x + size + 2 / scale, hp.y - 2 / scale);
        }
    },

    /**
     * Draw hitbox overlays
     */
    drawHitboxes() {
        const unitData = EditorState.unitData;
        if (!unitData?.hitbox) return;

        const { ctx } = this;
        const scale = EditorState.scale;
        const hb = unitData.hitbox;

        // Semi-transparent fill
        ctx.fillStyle = 'rgba(255, 100, 100, 0.15)';
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1.5 / scale;
        ctx.setLineDash([4 / scale, 4 / scale]);

        if (hb.type === 'rect') {
            ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
            ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
        } else if (hb.type === 'circle') {
            ctx.beginPath();
            ctx.arc(hb.x, hb.y, hb.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (hb.type === 'polygon' && hb.points) {
            ctx.beginPath();
            hb.points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Draw "HITBOX" label
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${8 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        const labelX = hb.x + (hb.w || hb.r || 0) / 2;
        const labelY = hb.y - 5 / scale;
        ctx.fillText('HITBOX', labelX, labelY);
    },

    /**
     * Draw pen tool draft (path being created)
     */
    drawPenDraft() {
        const draft = EditorState.penDraft;
        if (!draft || draft.points.length === 0) return;

        const { ctx } = this;
        const scale = EditorState.scale;
        const points = draft.points;

        // Draw lines between points (dashed for preview)
        ctx.setLineDash([4 / scale, 4 / scale]);
        ctx.strokeStyle = draft.mode === 'line' ? '#94a3b8' : '#3b82f6';
        ctx.lineWidth = 2 / scale;
        ctx.beginPath();

        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });

        // Close path preview for polygon
        if (draft.mode === 'polygon' && points.length >= 3) {
            ctx.lineTo(points[0].x, points[0].y);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Draw point handles
        points.forEach((p, i) => {
            const radius = 5 / scale;

            // Outer glow
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius + 2 / scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.fill();

            // Main point
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#22c55e' : '#3b82f6';  // First point is green
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2 / scale;
            ctx.fill();
            ctx.stroke();

            // Point index
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${8 / scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i.toString(), p.x, p.y);
        });

        // Draw hint text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `${10 / scale}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const lastPoint = points[points.length - 1];
        ctx.fillText(
            `${draft.mode === 'polygon' ? '다각형' : '선'} (${points.length}점)`,
            lastPoint.x + 10 / scale,
            lastPoint.y - 10 / scale
        );
    },

    /**
     * Draw transform gizmo for selected parts
     */
    drawTransformGizmo() {
        const bounds = EditorState.getSelectionBounds();
        if (!bounds || bounds.width < 1 || bounds.height < 1) return;

        const { ctx } = this;
        const scale = EditorState.scale;
        const handleSize = 6 / scale;
        const rotateOffset = 25 / scale;

        // Draw bounding box
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([4 / scale, 4 / scale]);
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.setLineDash([]);

        // Draw corner handles
        const corners = [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y + bounds.height }
        ];

        corners.forEach(corner => {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5 / scale;
            ctx.beginPath();
            ctx.rect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
            ctx.fill();
            ctx.stroke();
        });

        // Draw edge handles
        const edges = [
            { x: bounds.cx, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.cy },
            { x: bounds.cx, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.cy }
        ];

        edges.forEach(edge => {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5 / scale;
            ctx.beginPath();
            ctx.rect(edge.x - handleSize / 2, edge.y - handleSize / 2, handleSize, handleSize);
            ctx.fill();
            ctx.stroke();
        });

        // Draw rotation handle (circle above top center)
        const rotateX = bounds.cx;
        const rotateY = bounds.y - rotateOffset;

        // Line from bbox top to rotation handle
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.moveTo(bounds.cx, bounds.y);
        ctx.lineTo(rotateX, rotateY);
        ctx.stroke();

        // Rotation handle circle
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5 / scale;
        ctx.beginPath();
        ctx.arc(rotateX, rotateY, handleSize / 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw rotation icon inside handle
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.arc(rotateX, rotateY, handleSize / 3, -Math.PI / 4, Math.PI);
        ctx.stroke();
    },

    /**
     * Draw box selection rectangle
     */
    drawBoxSelection() {
        const box = EditorState.boxSelect;
        if (!box) return;

        const { ctx } = this;
        const scale = EditorState.scale;

        const x = Math.min(box.x1, box.x2);
        const y = Math.min(box.y1, box.y2);
        const w = Math.abs(box.x2 - box.x1);
        const h = Math.abs(box.y2 - box.y1);

        // Fill
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(x, y, w, h);

        // Stroke
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([4 / scale, 2 / scale]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
    },

    /**
     * Draw the grid (in unit coordinates, so it moves with pan/zoom)
     */
    drawGrid() {
        const { ctx } = this;
        const gridStep = 10;  // units per grid cell
        const extent = 400;   // draw from -extent to +extent in unit space

        ctx.strokeStyle = CANVAS_CONFIG.gridColor;
        ctx.lineWidth = 0.5;

        for (let x = -extent; x <= extent; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, -extent);
            ctx.lineTo(x, extent);
            ctx.stroke();
        }
        for (let y = -extent; y <= extent; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(-extent, y);
            ctx.lineTo(extent, y);
            ctx.stroke();
        }
    },

    /**
     * Draw a single part
     * @param {string} name - Part name
     * @param {Object} part - Part data
     * @param {boolean} xrayMode - X-Ray mode enabled
     */
    drawPart(name, part, xrayMode) {
        const { ctx } = this;
        const color = this.getColor(part.color);
        const scale = EditorState.scale;

        switch (part.type) {
            case 'rect':
                ctx.fillStyle = xrayMode ? 'rgba(100,100,100,0.3)' : color;
                ctx.fillRect(part.x, part.y, part.w, part.h);
                if (xrayMode) {
                    ctx.strokeStyle = '#60a5fa';
                    ctx.lineWidth = 1 / scale;
                    ctx.strokeRect(part.x, part.y, part.w, part.h);
                }
                break;

            case 'circle':
                ctx.fillStyle = xrayMode ? 'rgba(100,100,100,0.3)' : color;
                ctx.beginPath();
                ctx.arc(part.x, part.y, part.r, 0, Math.PI * 2);
                ctx.fill();
                if (xrayMode) {
                    ctx.strokeStyle = '#60a5fa';
                    ctx.lineWidth = 1 / scale;
                    ctx.stroke();
                }
                break;

            case 'arc':
                ctx.fillStyle = xrayMode ? 'rgba(100,100,100,0.3)' : color;
                ctx.beginPath();
                ctx.arc(part.x, part.y, part.r, Math.PI, 0);
                ctx.fill();
                if (xrayMode) {
                    ctx.strokeStyle = '#60a5fa';
                    ctx.lineWidth = 1 / scale;
                    ctx.stroke();
                }
                break;

            case 'polygon':
                if (!part.points || part.points.length < 3) break;
                ctx.fillStyle = xrayMode ? 'rgba(100,100,100,0.3)' : color;
                ctx.beginPath();
                part.points.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();
                ctx.fill();
                if (color === EditorState.teamColor || xrayMode) {
                    ctx.strokeStyle = xrayMode ? '#60a5fa' : 'rgba(0,0,0,0.2)';
                    ctx.lineWidth = 1 / scale;
                    ctx.stroke();
                }
                break;

            case 'line':
                if (!part.points || part.points.length < 2) break;
                ctx.strokeStyle = color || '#94a3b8';
                ctx.lineWidth = (part.width || 2) / scale;
                this.applyLineStyle(part.lineStyle);
                ctx.beginPath();
                part.points.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
                ctx.setLineDash([]);
                break;

            case 'wheels':
                if (!part.points) break;
                part.points.forEach(w => {
                    // Outer wheel
                    ctx.fillStyle = '#0f172a';
                    ctx.beginPath();
                    ctx.arc(w.x, w.y, 6.5, 0, Math.PI * 2);
                    ctx.fill();
                    // Middle
                    ctx.fillStyle = '#475569';
                    ctx.beginPath();
                    ctx.arc(w.x, w.y, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    // Center
                    ctx.fillStyle = '#000';
                    ctx.beginPath();
                    ctx.arc(w.x, w.y, 1, 0, Math.PI * 2);
                    ctx.fill();
                });
                break;

            case 'group':
                if (part.children && typeof part.children === 'object') {
                    ctx.save();
                    ctx.translate(part.x, part.y);
                    for (const [childName, child] of Object.entries(part.children)) {
                        this.drawPart(childName, child, xrayMode);
                    }
                    ctx.restore();
                }
                break;

            case 'rotor':
                ctx.save();
                ctx.translate(part.x, part.y);
                ctx.rotate(EditorState.rotorAngle * 3);
                ctx.fillStyle = '#000';
                ctx.fillRect(-part.w / 2, -part.h / 2, part.w, part.h);
                ctx.restore();
                break;
        }
    },

    /**
     * Draw edge handles (line segments between points) for selected parts
     * @param {string} name - Part name
     * @param {Object} part - Part data
     */
    drawEdgeHandles(name, part) {
        const { ctx } = this;
        const scale = EditorState.scale;
        const isPartSelected = EditorState.isPartSelected(name);
        const isDirectSelect = EditorState.activeTool === 'direct_select';

        // Only draw edge highlights for parts with points
        if (!part.points || part.points.length < 2) return;
        if (!isPartSelected && !isDirectSelect) return;

        const numEdges = part.type === 'polygon' ? part.points.length : part.points.length - 1;

        for (let i = 0; i < numEdges; i++) {
            const p1 = part.points[i];
            const p2 = part.points[(i + 1) % part.points.length];
            const isEdgeSelected = EditorState.isEdgeSelected(name, i);

            // Draw edge line
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);

            if (isEdgeSelected) {
                // Selected edge - thick cyan line
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 4 / scale;
                ctx.stroke();
            } else if (isPartSelected && isDirectSelect) {
                // Part selected in direct select mode - thin dashed line
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
                ctx.lineWidth = 2 / scale;
                ctx.setLineDash([4 / scale, 4 / scale]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw edge midpoint indicator for direct select
            if (isDirectSelect && isPartSelected) {
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const midSize = 3 / scale;

                ctx.fillStyle = isEdgeSelected ? '#00ffff' : 'rgba(59, 130, 246, 0.5)';
                ctx.beginPath();
                ctx.rect(midX - midSize, midY - midSize, midSize * 2, midSize * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1 / scale;
                ctx.stroke();
            }
        }
    },

    /**
     * Draw handles for a part (improved visibility)
     * @param {string} name - Part name
     * @param {Object} part - Part data
     */
    drawHandles(name, part) {
        const { ctx } = this;
        const scale = EditorState.scale;
        const isPartSelected = EditorState.isPartSelected(name);
        const isDirectSelect = EditorState.activeTool === 'direct_select';

        // Larger handles for better visibility
        const baseRadius = 4 / scale;
        const selectedRadius = 6 / scale;

        // Get handle color based on type
        const handleColor = HANDLE_COLORS[part.type] || '#60a5fa';

        // Draw handles based on part type
        if (part.type === 'polygon' || part.type === 'wheels' || part.type === 'line') {
            if (!part.points) return;

            part.points.forEach((p, i) => {
                const isPointSelected = EditorState.isPointSelected(name, i);
                const radius = isPointSelected ? selectedRadius : baseRadius;

                // Draw outer ring for selected points
                if (isPointSelected) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, radius + 2 / scale, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                    ctx.fill();
                }

                // Main point circle
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

                if (isPointSelected) {
                    // Selected point - cyan fill
                    ctx.fillStyle = '#00ffff';
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2 / scale;
                } else if (isPartSelected) {
                    // Part selected - white fill
                    ctx.fillStyle = '#fff';
                    ctx.strokeStyle = handleColor;
                    ctx.lineWidth = 2 / scale;
                } else {
                    // Unselected - type color
                    ctx.fillStyle = handleColor;
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1 / scale;
                }

                ctx.fill();
                ctx.stroke();

                // Draw point index number in direct select mode
                if (isDirectSelect && isPartSelected) {
                    ctx.fillStyle = isPointSelected ? '#000' : '#333';
                    ctx.font = `bold ${8 / scale}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(i.toString(), p.x, p.y);
                }
            });
        } else if (part.type === 'rect' || part.type === 'rotor') {
            // Draw corner handles for rect
            const corners = [
                { x: part.x, y: part.y },
                { x: part.x + part.w, y: part.y },
                { x: part.x + part.w, y: part.y + part.h },
                { x: part.x, y: part.y + part.h }
            ];

            corners.forEach((corner, i) => {
                const radius = isPartSelected ? selectedRadius : baseRadius;

                ctx.beginPath();
                ctx.arc(corner.x, corner.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = isPartSelected ? '#fff' : handleColor;
                ctx.strokeStyle = isPartSelected ? handleColor : '#fff';
                ctx.lineWidth = 1.5 / scale;
                ctx.fill();
                ctx.stroke();
            });

            // Draw center handle
            const cx = part.x + part.w / 2;
            const cy = part.y + part.h / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, baseRadius * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = isPartSelected ? handleColor : 'rgba(255,255,255,0.5)';
            ctx.fill();
        } else if (part.type === 'circle' || part.type === 'arc') {
            const radius = isPartSelected ? selectedRadius : baseRadius;

            // Center handle
            ctx.beginPath();
            ctx.arc(part.x, part.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = isPartSelected ? '#fff' : handleColor;
            ctx.strokeStyle = isPartSelected ? handleColor : '#fff';
            ctx.lineWidth = 1.5 / scale;
            ctx.fill();
            ctx.stroke();

            // Radius handle (on the edge)
            if (isPartSelected) {
                ctx.beginPath();
                ctx.arc(part.x + part.r, part.y, baseRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = handleColor;
                ctx.lineWidth = 1.5 / scale;
                ctx.fill();
                ctx.stroke();
            }
        } else if (part.type === 'group') {
            const ox = part.x != null ? part.x : 0, oy = part.y != null ? part.y : 0;
            const isChildSelected = EditorState.selectedPart === name && EditorState.selectedChild;
            const child = isChildSelected && part.children ? part.children[EditorState.selectedChild] : null;

            if (child && (child.type === 'rect' || child.type === 'rotor')) {
                // Draw handles for selected group child (in world coords)
                const corners = [
                    { x: ox + child.x, y: oy + child.y },
                    { x: ox + child.x + child.w, y: oy + child.y },
                    { x: ox + child.x + child.w, y: oy + child.y + child.h },
                    { x: ox + child.x, y: oy + child.y + child.h }
                ];
                corners.forEach((corner) => {
                    ctx.beginPath();
                    ctx.arc(corner.x, corner.y, selectedRadius, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.strokeStyle = handleColor;
                    ctx.lineWidth = 1.5 / scale;
                    ctx.fill();
                    ctx.stroke();
                });
            } else {
                const radius = isPartSelected ? selectedRadius : baseRadius;
                ctx.beginPath();
                ctx.arc(part.x, part.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = isPartSelected ? '#fff' : handleColor;
                ctx.strokeStyle = isPartSelected ? handleColor : '#fff';
                ctx.lineWidth = 1.5 / scale;
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(part.x - radius, part.y);
                ctx.lineTo(part.x + radius, part.y);
                ctx.moveTo(part.x, part.y - radius);
                ctx.lineTo(part.x, part.y + radius);
                ctx.strokeStyle = isPartSelected ? handleColor : '#fff';
                ctx.lineWidth = 1 / scale;
                ctx.stroke();
            }
        }
    },

    /**
     * Start animation loop
     */
    startAnimation() {
        const animate = () => {
            EditorState.rotorAngle += 0.1;
            this.draw();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    },

    /**
     * Stop animation loop
     */
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CanvasRenderer = CanvasRenderer;
}
