# Unit Editor 리팩토링 계획서

## 1. 현재 상태 분석

### 현재 파일 구조
```
unit-editor/
└── simple-editor.html (단일 파일, ~1100줄, CSS+JS 포함)
```

### 현재 기능
- 3개 유닛 하드코딩: `special_forces`, `apc`, `uh60`
- 캔버스 기반 드로잉 (파츠별 렌더링)
- 드래그로 포인트 편집
- JSON 출력/복사/붙여넣기
- 줌 인/아웃
- 파츠 추가 (Line, Shape)

---

## 2. 목표 구조

### 폴더/파일 구조
```
unit-editor/
├── index.html              # 메인 HTML (UI 구조만)
├── css/
│   └── editor.css          # 전체 스타일
├── js/
│   ├── constants.js        # 상수, 도구 정의
│   ├── state.js            # 상태 관리 (currentUnit, scale, selectedPart 등)
│   ├── canvas.js           # 캔버스 렌더링 로직
│   ├── interaction.js      # 마우스/드래그 이벤트
│   ├── ui-panel.js         # 사이드바/패널 UI 렌더링
│   ├── menu-bar.js         # 메뉴바 (파일/편집/보기/윈도우/도움말)
│   ├── animation.js        # 애니메이션 타임라인 (선택적)
│   ├── unit-loader.js      # units/*.json 로드/저장 로직
│   └── main.js             # 초기화 및 이벤트 바인딩
└── units/
    ├── special_forces.json
    ├── apc.json
    ├── uh60.json
    ├── infantry.json
    ├── rpg.json
    ├── mbt.json
    ├── apache.json
    ├── bomber.json
    └── ... (기타 유닛)
```

---

## 3. 유닛 JSON 파일 포맷

### 기본 구조 (units/apc.json 예시)
```json
{
  "id": "apc",
  "name": "APC",
  "type": "vehicle",
  "metadata": {
    "author": "editor",
    "version": "1.0",
    "lastModified": "2025-01-31"
  },
  "parts": {
    "body": {
      "type": "polygon",
      "points": [
        {"x": 35, "y": -5},
        {"x": 29, "y": -11},
        {"x": 25, "y": -15},
        {"x": -25, "y": -15},
        {"x": -35, "y": -10},
        {"x": -35, "y": -5},
        {"x": -35, "y": 0},
        {"x": -31, "y": 7},
        {"x": 27, "y": 7}
      ],
      "color": "team",
      "zIndex": 0
    },
    "window": {
      "type": "polygon",
      "points": [
        {"x": 24, "y": -13},
        {"x": 32, "y": -6},
        {"x": 26, "y": -6}
      ],
      "color": "#1e293b",
      "zIndex": 1
    },
    "turret": {
      "type": "group",
      "x": -3,
      "y": -20,
      "zIndex": 2
    },
    "wheels": {
      "type": "wheels",
      "points": [
        {"x": -21, "y": 7},
        {"x": -1, "y": 7},
        {"x": 17, "y": 7}
      ],
      "zIndex": -1
    }
  }
}
```

### 지원 파츠 타입
| Type | 필수 속성 | 설명 |
|------|-----------|------|
| `rect` | x, y, w, h, color | 사각형 |
| `circle` | x, y, r, color | 원 |
| `arc` | x, y, r, color | 반원 (헬멧 등) |
| `polygon` | points[], color | 다각형 |
| `line` | points[], color, width, lineStyle | 선 (solid/dash/dot) |
| `wheels` | points[] | 바퀴 세트 (차량용) |
| `group` | x, y | 복합 파츠 그룹 (터렛 등) |
| `rotor` | x, y, w, h | 회전 로터 (헬리용) |

---

## 4. 주요 모듈 설계

### 4.1 constants.js
```javascript
const TOOLS = [
  { id: 'select', icon: '⬆', label: '선택 도구 (V)', shortcut: 'v' },
  { id: 'direct_select', icon: '◻', label: '직접 선택 (A)', shortcut: 'a' },
  { id: 'move', icon: '✥', label: '이동 (M)', shortcut: 'm' },
  { id: 'hitbox', icon: '◎', label: '히트박스 (H)', shortcut: 'h' },
  { id: 'shape_rect', icon: '▢', label: '사각형 (U)', shortcut: 'u' },
  { id: 'shape_circle', icon: '○', label: '원형 (L)', shortcut: 'l' },
  { id: 'pen', icon: '✎', label: '패스 도구 (P)', shortcut: 'p' },
  { id: 'hand', icon: '✋', label: '손 도구 (Space)', shortcut: ' ' },
  { id: 'zoom', icon: '🔍', label: '돋보기 (Z)', shortcut: 'z' }
];

const UNIT_TYPES = ['infantry', 'vehicle', 'air', 'drone'];
const LINE_STYLES = ['solid', 'dash', 'dot'];
const SHAPE_TYPES = ['rect', 'circle', 'arc', 'polygon'];
```

### 4.2 state.js
```javascript
const EditorState = {
  // 현재 유닛
  currentUnitId: null,
  unitData: null,
  originalData: null,  // 리셋용

  // 에디터 상태
  scale: 3,
  activeTool: 'select',
  selectedPart: null,
  dragging: null,

  // 뷰 상태
  xrayMode: false,
  showGrid: true,
  showHandles: true,

  // 패널 상태
  activeTab: 'properties',
  showTransform: false,
  showAnimation: false,

  // 히스토리 (Undo/Redo)
  history: [],
  historyIndex: -1,

  // 유닛 목록
  availableUnits: []
};
```

### 4.3 unit-loader.js
```javascript
const UnitLoader = {
  // 유닛 목록 로드
  async loadUnitList() {
    const response = await fetch('units/index.json');
    return await response.json();
  },

  // 단일 유닛 로드
  async loadUnit(unitId) {
    const response = await fetch(`units/${unitId}.json`);
    return await response.json();
  },

  // 유닛 저장 (로컬 다운로드)
  saveUnit(unitData) {
    const blob = new Blob([JSON.stringify(unitData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${unitData.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // 파일 불러오기
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(JSON.parse(e.target.result));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }
};
```

### 4.4 canvas.js
```javascript
const CanvasRenderer = {
  canvas: null,
  ctx: null,
  rotorAngle: 0,

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
  },

  draw() {
    const { unitData, scale, xrayMode, showGrid, showHandles } = EditorState;
    // ... 렌더링 로직
  },

  drawPart(name, part) {
    // 파츠 타입별 렌더링
  },

  drawHandles() {
    // 편집 핸들 렌더링
  },

  animate() {
    this.rotorAngle += 0.1;
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
};
```

### 4.5 menu-bar.js (React 참고 스타일 구현)
```javascript
const MenuBar = {
  menus: [
    {
      label: '파일(File)',
      items: [
        { label: '새 유닛', shortcut: 'Ctrl+N', action: 'newUnit' },
        { label: '열기', shortcut: 'Ctrl+O', action: 'openUnit' },
        { label: '저장', shortcut: 'Ctrl+S', action: 'saveUnit' },
        { label: '내보내기', action: 'exportUnit' }
      ]
    },
    {
      label: '편집(Edit)',
      items: [
        { label: '실행 취소', shortcut: 'Ctrl+Z', action: 'undo' },
        { label: '다시 실행', shortcut: 'Ctrl+Y', action: 'redo' },
        { label: '복사', shortcut: 'Ctrl+C', action: 'copy' },
        { label: '붙여넣기', shortcut: 'Ctrl+V', action: 'paste' }
      ]
    },
    {
      label: '보기(View)',
      items: [
        { label: '엑스레이 모드', shortcut: 'X', action: 'toggleXray', checkable: true },
        { label: '그리드 표시', shortcut: "Ctrl+'", action: 'toggleGrid', checkable: true },
        { label: '핸들 표시', action: 'toggleHandles', checkable: true }
      ]
    },
    {
      label: '윈도우(Window)',
      items: [
        { label: '변형 패널', action: 'toggleTransform', checkable: true },
        { label: '애니메이션 타임라인', action: 'toggleAnimation', checkable: true },
        { label: '레이어', action: 'showLayers' }
      ]
    },
    {
      label: '도움말(Help)',
      items: [
        { label: '단축키 정보', action: 'showShortcuts' }
      ]
    }
  ],

  render() { /* ... */ },
  handleAction(action) { /* ... */ }
};
```

---

## 5. 구현 순서

### Phase 1: 기본 구조 분리
1. [x] 계획서 작성
2. [ ] `index.html` - 기본 HTML 구조
3. [ ] `css/editor.css` - 스타일 분리
4. [ ] `js/constants.js` - 상수 정의
5. [ ] `js/state.js` - 상태 관리

### Phase 2: 유닛 데이터 분리
6. [ ] `units/` 폴더 생성
7. [ ] `units/index.json` - 유닛 목록
8. [ ] 기존 3개 유닛 JSON 파일 생성
9. [ ] 추가 유닛 JSON 파일 생성 (infantry, rpg, mbt 등)
10. [ ] `js/unit-loader.js` - 로더 구현

### Phase 3: 핵심 기능 구현
11. [ ] `js/canvas.js` - 캔버스 렌더링
12. [ ] `js/interaction.js` - 마우스/드래그
13. [ ] `js/ui-panel.js` - 사이드바 패널

### Phase 4: 메뉴 및 고급 기능
14. [ ] `js/menu-bar.js` - 메뉴바 (React 참고)
15. [ ] Undo/Redo 히스토리
16. [ ] 단축키 시스템

### Phase 5: 선택적 기능
17. [ ] `js/animation.js` - 애니메이션 타임라인
18. [ ] 레이어 시스템
19. [ ] 프로필/데이터 관리

### Phase 6: 통합 및 테스트
20. [ ] `js/main.js` - 전체 초기화
21. [ ] 기존 기능 동작 테스트
22. [ ] 최종 정리

---

## 6. 주요 개선 사항

### 6.1 React 참고 UI 요소 적용
- **메뉴바**: 드롭다운 메뉴 + 단축키 표시
- **옵션바**: 현재 도구별 옵션 표시
- **엑스레이 모드**: 와이어프레임/본 뷰
- **패널 토글**: 윈도우 메뉴에서 패널 on/off
- **툴팁**: 도구 버튼 호버 시 설명

### 6.2 유닛 파일 시스템
- 개별 JSON 파일로 유닛 관리
- 유닛 목록 동적 로드
- 파일 불러오기/내보내기 지원
- 로컬스토리지 백업

### 6.3 향후 확장성
- 애니메이션 키프레임 지원 준비
- 히트박스 편집 기능
- 다중 선택 및 그룹화
- 레이어 순서 조정

---

## 7. 파일별 예상 라인 수

| 파일 | 예상 라인 | 설명 |
|------|-----------|------|
| index.html | ~100 | HTML 구조만 |
| css/editor.css | ~400 | 전체 스타일 |
| js/constants.js | ~60 | 상수 정의 |
| js/state.js | ~80 | 상태 관리 |
| js/canvas.js | ~200 | 렌더링 |
| js/interaction.js | ~150 | 이벤트 |
| js/ui-panel.js | ~250 | 패널 UI |
| js/menu-bar.js | ~180 | 메뉴바 |
| js/unit-loader.js | ~100 | 로더 |
| js/main.js | ~100 | 초기화 |
| **총합** | **~1600** | (기존 1100줄에서 확장) |

---

## 8. 참고: 제공된 React 코드 대응

| React 기능 | 순수 JS 구현 방식 |
|-----------|------------------|
| useState | EditorState 객체 + 이벤트 발행 |
| useEffect | addEventListener + init 함수 |
| 컴포넌트 | render 함수 + innerHTML |
| 조건부 렌더링 | if/else + style.display |
| 이벤트 핸들러 | addEventListener |
| props | 함수 파라미터 |

---

## 승인 요청

위 계획대로 진행할까요?
- Phase 1~2 먼저 진행 후 확인
- 전체 한번에 진행
- 수정 요청
