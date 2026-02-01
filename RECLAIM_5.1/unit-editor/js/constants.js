/**
 * CONSTANTS.JS
 * Editor constants, tool definitions, and type enums
 */

// SVG Icons (Lucide-style)
const ICONS = {
    select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>',
    direct_select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>',
    move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>',
    bone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.5 5.5a3.5 3.5 0 00-5 0L5.5 13.5a3.5 3.5 0 005 5l8-8a3.5 3.5 0 000-5z"/><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    hitbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>',
    shape_rect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    shape_circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    script: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 00-2-2 2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2 2 2 0 00-2 2v6M10 10.5V6a2 2 0 00-2-2 2 2 0 00-2 2v8"/><path d="M18 8a2 2 0 012 2v7c0 4-3 5-6 5s-6-1-6-5v-1a2 2 0 012-2h0"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    color: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
    fileJson: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 16s.5-2 2-2c1.5 0 2 2 2 2s.5-2 2-2c1.5 0 2 2 2 2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
    flipH: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M16 7l5 5-5 5M8 7l-5 5 5 5"/></svg>',
    flipV: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M7 8l5-5 5 5M7 16l5 5 5-5"/></svg>'
};

// Tool definitions with SVG icons
const TOOLS = [
    { id: 'select', icon: ICONS.select, label: '선택 도구', shortcut: 'V' },
    { id: 'direct_select', icon: ICONS.direct_select, label: '직접 선택', shortcut: 'A' },
    { id: 'move', icon: ICONS.move, label: '이동', shortcut: 'M' },
    { id: 'bone', icon: ICONS.bone, label: '뼈대/리깅', shortcut: 'B' },
    { id: 'hitbox', icon: ICONS.hitbox, label: '히트박스', shortcut: 'H' },
    { id: 'shape_rect', icon: ICONS.shape_rect, label: '사각형', shortcut: 'U' },
    { id: 'shape_circle', icon: ICONS.shape_circle, label: '원형', shortcut: 'L' },
    { id: 'pen', icon: ICONS.pen, label: '패스 도구', shortcut: 'P' },
    { id: 'text', icon: ICONS.text, label: '텍스트', shortcut: 'T' },
    { id: 'script', icon: ICONS.script, label: '스크립트', shortcut: 'S' },
    { id: 'hand', icon: ICONS.hand, label: '손 도구', shortcut: 'Space' },
    { id: 'zoom', icon: ICONS.zoom, label: '돋보기', shortcut: 'Z' }
];

// Unit type categories
const UNIT_TYPES = ['infantry', 'vehicle', 'air', 'drone'];

// Line style options
const LINE_STYLES = ['solid', 'dash', 'dot'];

// Shape type options
const SHAPE_TYPES = ['rect', 'circle', 'arc', 'polygon'];

// Part type definitions
const PART_TYPES = {
    rect: { label: '사각형', hasPoints: false, props: ['x', 'y', 'w', 'h', 'color'] },
    circle: { label: '원', hasPoints: false, props: ['x', 'y', 'r', 'color'] },
    arc: { label: '반원', hasPoints: false, props: ['x', 'y', 'r', 'color'] },
    polygon: { label: '다각형', hasPoints: true, props: ['points', 'color'] },
    line: { label: '선', hasPoints: true, props: ['points', 'color', 'width', 'lineStyle'] },
    wheels: { label: '바퀴', hasPoints: true, props: ['points'] },
    group: { label: '그룹', hasPoints: false, props: ['x', 'y'] },
    rotor: { label: '로터', hasPoints: false, props: ['x', 'y', 'w', 'h'] }
};

// Menu definitions
const MENUS = [
    {
        label: '파일(File)',
        items: [
            { label: '새 유닛', shortcut: 'Ctrl+N', action: 'newUnit' },
            { label: '열기', shortcut: 'Ctrl+O', action: 'openUnit' },
            { type: 'divider' },
            { label: '저장', shortcut: 'Ctrl+S', action: 'saveUnit' },
            { label: '다른 이름으로 저장', action: 'saveUnitAs' },
            { type: 'divider' },
            { label: '내보내기 (JSON)', action: 'exportJson' },
            { label: '불러오기 (JSON)', action: 'importJson' }
        ]
    },
    {
        label: '편집(Edit)',
        items: [
            { label: '실행 취소', shortcut: 'Ctrl+Z', action: 'undo' },
            { label: '다시 실행', shortcut: 'Ctrl+Y', action: 'redo' },
            { type: 'divider' },
            { label: '잘라내기', shortcut: 'Ctrl+X', action: 'cut' },
            { label: '복사', shortcut: 'Ctrl+C', action: 'copy' },
            { label: '붙여넣기', shortcut: 'Ctrl+V', action: 'paste' },
            { type: 'divider' },
            { label: '모두 선택', shortcut: 'Ctrl+A', action: 'selectAll' },
            { label: '선택 해제', shortcut: 'Esc', action: 'deselect' }
        ]
    },
    {
        label: '보기(View)',
        items: [
            { label: '확대', shortcut: 'Ctrl++', action: 'zoomIn' },
            { label: '축소', shortcut: 'Ctrl+-', action: 'zoomOut' },
            { label: '100%로 보기', shortcut: 'Ctrl+0', action: 'zoomReset' },
            { type: 'divider' },
            { label: '엑스레이 모드', shortcut: 'X', action: 'toggleXray', checkable: true, stateKey: 'xrayMode' },
            { label: '그리드 표시', shortcut: "Ctrl+'", action: 'toggleGrid', checkable: true, stateKey: 'showGrid' },
            { label: '핸들 표시', action: 'toggleHandles', checkable: true, stateKey: 'showHandles' }
        ]
    },
    {
        label: '윈도우(Window)',
        items: [
            { label: '변형 패널', action: 'toggleTransform', checkable: true, stateKey: 'showTransform' },
            { label: '애니메이션 타임라인', action: 'toggleAnimation', checkable: true, stateKey: 'showAnimation' },
            { type: 'divider' },
            { label: '레이어', action: 'showLayers' },
            { label: '속성', action: 'showProperties' }
        ]
    },
    {
        label: '도움말(Help)',
        items: [
            { label: '단축키 정보', action: 'showShortcuts' },
            { label: '사용 가이드', action: 'showGuide' },
            { type: 'divider' },
            { label: '버전 정보', action: 'showAbout' }
        ]
    }
];

// Keyboard shortcuts mapping
const SHORTCUTS = {
    'v': 'select',
    'a': 'direct_select',
    'm': 'move',
    'b': 'bone',
    'h': 'hitbox',
    'u': 'shape_rect',
    'l': 'shape_circle',
    'p': 'pen',
    't': 'text',
    's': 'script',
    ' ': 'hand',
    'z': 'zoom',
    'x': 'toggleXray',
    'f': 'flipH'
};

// Shift shortcuts
const SHIFT_SHORTCUTS = {
    'f': 'flipV'
};

// Ctrl shortcuts
const CTRL_SHORTCUTS = {
    's': 'saveUnit',
    'z': 'undo',
    'y': 'redo',
    'c': 'copy',
    'v': 'paste',
    'x': 'cut',
    'a': 'selectAll',
    'n': 'newUnit',
    'o': 'openUnit',
    '+': 'zoomIn',
    '=': 'zoomIn',
    '-': 'zoomOut',
    '0': 'zoomReset',
    "'": 'toggleGrid'
};

// Default team color
const DEFAULT_TEAM_COLOR = '#3b82f6';

// Canvas settings
const CANVAS_CONFIG = {
    defaultWidth: 600,
    defaultHeight: 500,
    gridSize: 20,
    gridColor: '#1e293b',
    backgroundColor: '#0f172a',
    handleRadius: 3,
    hitRadius: 10,
    hitRadiusMin: 5   // minimum hit radius in canvas coords (zoom-out friendly)
};

// Color palette for handles
const HANDLE_COLORS = {
    polygon: '#60a5fa',
    line: '#60a5fa',
    wheels: '#60a5fa',
    rect: '#22c55e',
    rotor: '#22c55e',
    circle: '#f59e0b',
    arc: '#f59e0b',
    group: '#ef4444'
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ICONS = ICONS;
    window.TOOLS = TOOLS;
    window.UNIT_TYPES = UNIT_TYPES;
    window.LINE_STYLES = LINE_STYLES;
    window.SHAPE_TYPES = SHAPE_TYPES;
    window.PART_TYPES = PART_TYPES;
    window.MENUS = MENUS;
    window.SHORTCUTS = SHORTCUTS;
    window.SHIFT_SHORTCUTS = SHIFT_SHORTCUTS;
    window.CTRL_SHORTCUTS = CTRL_SHORTCUTS;
    window.DEFAULT_TEAM_COLOR = DEFAULT_TEAM_COLOR;
    window.CANVAS_CONFIG = CANVAS_CONFIG;
    window.HANDLE_COLORS = HANDLE_COLORS;
}
