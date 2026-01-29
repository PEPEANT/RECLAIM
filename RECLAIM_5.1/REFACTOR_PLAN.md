# RECLAIM 5.0 코드 분리 및 최적화 계획서

## 목차
1. [유닛 에디터 JS 분리](#1-유닛-에디터-js-분리)
2. [성능 최적화 우선순위](#2-성능-최적화-우선순위)
3. [폴더 구조 개선](#3-폴더-구조-개선)
4. [실행 로드맵](#4-실행-로드맵)

---

## 1. 유닛 에디터 JS 분리

### 1.1 현재 상태 분석
**REC_unit-editor/index.html**
- **총 줄 수**: ~2,500+ 줄 (HTML + CSS + JS 혼재)
- **주요 문제**:
  - MagicBlueprintApp 클래스, UI 렌더링, 저장 로직이 한 파일에 혼재
  - 수정 시 다른 기능이 깨지는 회귀 버그 빈번
  - 특정 기능만 롤백/교체 불가능
  - 코드 검색/네비게이션 어려움

### 1.2 분리 기준
다음 중 **2개 이상** 해당되면 즉시 분리 권장:
- [ ] 파일이 800줄 이상
- [ ] 서로 다른 책임(Canvas/DOM/Storage)이 섞임
- [ ] 고칠 때마다 다른 곳이 같이 깨짐
- [ ] 코드 검색에 시간이 너무 많이 소요

**REC_unit-editor는 모든 조건 충족** → **즉시 분리 추천**

### 1.3 분리 설계

#### 폴더 구조
```
REC_unit-editor/
├── index.html              (껍데기만 - 레이아웃 + 스크립트 로드)
├── editor.css              (스타일 분리 - 선택사항)
└── js/
    ├── editor_boot.js      # 초기화/엔트리 포인트
    ├── editor_app.js       # MagicBlueprintApp 클래스 (캔버스/입력/루프)
    ├── editor_ui.js        # DOM 렌더링 (리스트/패널/모달)
    ├── editor_storage.js   # localStorage 저장/불러오기
    ├── editor_patch.js     # 패치 생성/적용/검증
    ├── editor_skin.js      # 스킨/레이어 편집
    └── editor_utils.js     # 공용 유틸 (R_attach, clamp 등)
```

#### 스크립트 로드 순서 (index.html)
```html
<!-- 1. 게임 공용 데이터 -->
<script src="../data.js"></script>
<script src="../maps.js"></script>
<script src="../classes.js"></script>

<!-- 2. 에디터 모듈 (defer로 로드 순서 보장) -->
<script defer src="js/editor_utils.js"></script>
<script defer src="js/editor_app.js"></script>
<script defer src="js/editor_ui.js"></script>
<script defer src="js/editor_storage.js"></script>
<script defer src="js/editor_patch.js"></script>
<script defer src="js/editor_skin.js"></script>
<script defer src="js/editor_boot.js"></script>
```

### 1.4 모듈별 책임

#### editor_boot.js (엔트리 포인트)
```javascript
// 앱 초기화 및 시작
(function(){
  window.addEventListener('DOMContentLoaded', () => {
    if (!isGameDataReady()) {
      showError("게임 데이터 로드 실패");
      return;
    }

    const app = new MagicBlueprintApp();
    window.app = app; // 디버깅용

    initUI(app);
    loadLastSession(app);
  });
})();
```

#### editor_app.js (MagicBlueprintApp 클래스)
- **책임**: 캔버스 렌더링, 입력 처리, 레이어 관리, 카메라
- **주요 메서드**:
  - `constructor()` - 초기화
  - `render()` - 캔버스 그리기
  - `onPointerDown/Move/Up()` - 입력 처리
  - `hitTestPolygon()` - 충돌 검사
  - `addLayer()`, `deleteLayer()` - 레이어 관리

#### editor_ui.js (DOM UI)
- **책임**: 유닛 리스트, 상세 패널, 모달 렌더링
- **주요 함수**:
  - `renderUnitList(filter)` - 유닛 카드 리스트
  - `openDetailPanel(unitKey)` - 상세 패널 열기
  - `renderFieldInputs(stats)` - 입력 필드 생성
  - `updateStatusText(msg)` - 상태 표시

#### editor_storage.js (저장/불러오기)
- **책임**: LocalStorage, JSON export/import
- **주요 함수**:
  - `saveToLocalStorage(data, debounceMs)` - 디바운스 저장
  - `loadFromLocalStorage()` - 불러오기
  - `exportJSON()` - JSON 추출
  - `importJSON(jsonString)` - JSON 임포트

#### editor_patch.js (패치 관리)
- **책임**: 게임 데이터 패치 생성/적용
- **주요 함수**:
  - `generatePatch(modifiedUnits)` - 패치 diff 생성
  - `applyPatch(patch)` - CONFIG에 적용
  - `resetPatch()` - 패치 초기화
  - `validatePatch(patch)` - 검증

#### editor_skin.js (스킨 편집)
- **책임**: 유닛 스킨/색상/레이어 편집
- **주요 함수**:
  - `enterSkinEditMode(unitKey)` - 스킨 편집 진입
  - `saveSkin(unitKey, skinData)` - 스킨 저장
  - `resetSkin(unitKey)` - 스킨 초기화
  - `drawReferenceUnit()` - 레퍼런스 오버레이

#### editor_utils.js (공용 유틸)
- **책임**: 범용 헬퍼 함수
- **주요 함수**:
  - `clamp(val, min, max)` - 값 제한
  - `debounce(fn, delay)` - 디바운스
  - `throttle(fn, delay)` - 쓰로틀
  - `R_attach(arr, idx)` - 배열 인덱스 보정

### 1.5 안전 분리 체크리스트

#### Phase 1: 준비
- [ ] `REC_unit-editor/js/` 폴더 생성
- [ ] 각 모듈 파일 빈 껍데기 생성
- [ ] `index.html` 스크립트 로드 섹션 준비

#### Phase 2: 유틸부터 분리 (가장 안전)
- [ ] `editor_utils.js`로 공용 함수 이동
  - `clamp`, `debounce`, `R_attach` 등
- [ ] `index.html`에서 해당 부분 제거
- [ ] 브라우저에서 테스트

#### Phase 3: 클래스 분리
- [ ] `editor_app.js`로 MagicBlueprintApp 이동
- [ ] 생성자, 렌더링, 입력 메서드 포함
- [ ] `index.html`에서 제거 → 테스트

#### Phase 4: UI 분리
- [ ] `editor_ui.js`로 DOM 렌더 함수 이동
- [ ] `renderUnitList`, `openDetail` 등
- [ ] 테스트

#### Phase 5: 저장/패치/스킨
- [ ] `editor_storage.js` 분리
- [ ] `editor_patch.js` 분리
- [ ] `editor_skin.js` 분리
- [ ] 각 단계마다 테스트

#### Phase 6: 엔트리 포인트
- [ ] `editor_boot.js` 작성
- [ ] `index.html` 최종 정리
- [ ] 전체 통합 테스트

### 1.6 분리 후 예상 효과

#### 코드 가독성
- ✅ 파일당 200~400줄 → 한눈에 파악 가능
- ✅ 기능별로 파일 분리 → 네비게이션 빠름

#### 유지보수성
- ✅ 특정 기능 수정 시 해당 파일만 수정
- ✅ 회귀 버그 감소 (책임 분리)
- ✅ 롤백/교체 용이

#### 성능
- ✅ 브라우저 캐시 활용 (자주 안 바뀌는 모듈은 캐시됨)
- ✅ 병렬 스크립트 로드 (defer 사용 시)

#### 협업
- ✅ 여러 사람이 동시에 다른 파일 작업 가능
- ✅ Git 충돌 감소

### 1.7 완료 기준 (Exit Criteria)

#### 에디터 JS 분리 완료
- [ ] **index.html 크기**: 인라인 JS가 50~100줄 이하 (초기화 코드만)
- [ ] **기능 100% 유지**:
  - [ ] 유닛 선택/편집/저장/불러오기
  - [ ] 패치 생성/적용/리셋
  - [ ] 스킨 변경 반영
  - [ ] 패널/모달/탭 UI 정상 표시
  - [ ] 캔버스 렌더링/입력 처리
- [ ] **에러 없음**: 콘솔에 에러 0개
- [ ] **성능 유지**: 5분 사용 시 프리즈/렉 없음
- [ ] **파일 구조**: 각 모듈 파일 크기 200~500줄

#### 성능 최적화 완료
- [ ] **측정 기준 수립**:
  - 유닛 100개: 평균 FPS ≥ 55
  - 유닛 500개: 평균 FPS ≥ 30
  - 프레임 타임: < 33ms (30fps 기준)
- [ ] **O(N²) 제거**: 최소 1~2개 확정 + 전/후 수치 비교
- [ ] **DOM 업데이트**: HUD 갱신 빈도 < 10회/초
- [ ] **Chrome DevTools**: Performance 프로파일링 완료

#### 폴더 정리 완료
- [ ] `assets/`, `src/`, `tools/` 폴더 생성
- [ ] 에디터를 `tools/unit-editor/`로 이동
- [ ] 모든 상대 경로 정상 작동
- [ ] Raw.githack 링크 테스트 통과

### 1.8 모듈 전략 (ES Modules vs 전역)

#### 권장 방식: ES Modules
```html
<!-- type="module" 사용 -->
<script type="module" src="js/editor_boot.js"></script>
```

```javascript
// editor_app.js
export class MagicBlueprintApp { ... }

// editor_boot.js
import { MagicBlueprintApp } from './editor_app.js';
const app = new MagicBlueprintApp();
window.app = app; // 디버깅용만 전역
```

**장점**:
- 의존관계 명확
- 전역 오염 최소화
- 트리 쉐이킹 가능 (미래 번들러 도입 시)

#### 대안: 단일 네임스페이스 (기존 호환)
```javascript
// 전역은 단 하나만 허용
window.Editor = {
  app: null,
  ui: {},
  storage: {},
  // ...
};
```

**규칙**:
- ⚠️ `window.Editor` 외 전역 변수 금지
- ⚠️ 각 모듈은 `Editor` 객체에만 등록

---

## 2. 성능 최적화 우선순위

### 2.1 에디터 성능 (즉시 적용 가능)

#### P0: 체감 큰데 위험 낮음

**1) DOM 업데이트 최소화**
```javascript
// ❌ 나쁜 예: 입력 한 글자마다 전체 리스트 재렌더
input.addEventListener('input', () => {
  renderUnitList(); // 전체 리스트 DOM 재생성
});

// ✅ 좋은 예: 필터만 적용
input.addEventListener('input', debounce(() => {
  filterUnitList(input.value); // 기존 DOM 필터링만
}, 150));
```

**2) 포인터 이벤트 쓰로틀**
```javascript
// ❌ 나쁜 예: 매 픽셀마다 호출
canvas.addEventListener('pointermove', (e) => {
  updateCursor(e);
  checkHover(e);
});

// ✅ 좋은 예: 16ms(60fps) 제한
canvas.addEventListener('pointermove', throttle((e) => {
  updateCursor(e);
  checkHover(e);
}, 16));
```

**3) localStorage 디바운스**
```javascript
// ❌ 나쁜 예: 입력마다 즉시 저장
input.addEventListener('input', () => {
  localStorage.setItem('data', JSON.stringify(data));
});

// ✅ 좋은 예: 500ms 대기 후 저장
input.addEventListener('input', debounce(() => {
  localStorage.setItem('data', JSON.stringify(data));
}, 500));
```

#### P1: 데이터 많아질 때 필요

**4) 가상 스크롤 (Virtual Scroll)**
- 유닛 목록이 100개 이상일 때
- 화면에 보이는 20~30개만 DOM 생성
- 스크롤 시 재사용

**5) 캔버스 더티 플래그**
```javascript
// ✅ 변경이 있을 때만 렌더링
class MagicBlueprintApp {
  constructor() {
    this.dirty = true; // 렌더링 필요 플래그
  }

  invalidate() {
    this.dirty = true;
    requestAnimationFrame(() => this.render());
  }

  render() {
    if (!this.dirty) return;
    this.dirty = false;
    // 실제 렌더링...
  }
}
```

### 2.2 게임 성능 (RTS 특화 최적화)

#### P0: 프레임 급락 방지

**1) O(N²) 루프 제거**
```javascript
// ❌ 매우 나쁜 예: 유닛마다 전체 유닛 순회 (N²)
for (const unit of units) {
  for (const other of units) {
    if (distance(unit, other) < range) {
      // 타겟 발견
    }
  }
}

// ✅ 좋은 예: 공간 그리드 사용 (spatial.js)
for (const unit of units) {
  const nearbyUnits = spatialGrid.getNearby(unit.x, unit.y, range);
  for (const other of nearbyUnits) {
    // 타겟 발견
  }
}
```

**2) HUD 업데이트 제한**
```javascript
// ❌ 나쁜 예: 매 프레임 DOM 업데이트
function gameLoop() {
  resourceDisplay.textContent = `자원: ${resources}`;
  unitCountDisplay.textContent = `유닛: ${units.length}`;
  // ...
}

// ✅ 좋은 예: 값이 바뀔 때만 업데이트
let lastResources = -1;
function gameLoop() {
  if (resources !== lastResources) {
    resourceDisplay.textContent = `자원: ${resources}`;
    lastResources = resources;
  }
  // ...
}
```

**3) AI 틱 주기 분리**
```javascript
// ✅ AI는 매 5프레임마다만 실행 (30fps → 6fps)
let aiFrame = 0;
function gameLoop() {
  // 매 프레임 실행
  updatePhysics();
  updateProjectiles();
  render();

  // 5프레임에 1번만 실행
  aiFrame++;
  if (aiFrame % 5 === 0) {
    updateAI();
  }
}
```

#### P1: 렌더링 최적화

**4) 오브젝트 풀링 (Pooling)**
```javascript
// ✅ 투사체/이펙트 재사용으로 GC 부담 감소
class ProjectilePool {
  constructor(size = 100) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      this.pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
    }
  }

  spawn(x, y, vx, vy) {
    const projectile = this.pool.find(p => !p.active);
    if (projectile) {
      Object.assign(projectile, { active: true, x, y, vx, vy });
      return projectile;
    }
    return null; // 풀 고갈
  }

  despawn(projectile) {
    projectile.active = false;
  }
}
```

**5) 텍스트 렌더링 최소화**
```javascript
// ✅ 줌/선택 조건부 텍스트 렌더링
function drawUnit(unit) {
  unit.draw(ctx);

  // 줌 아웃 시 텍스트 생략
  if (camera.scale > 0.5) {
    drawHealthBar(unit);
  }
  if (camera.scale > 0.8 && unit.isSelected) {
    drawUnitName(unit);
  }
}

// ✅ 텍스트 측정 캐싱
const textWidthCache = new Map();
function getTextWidth(text, font) {
  const key = `${text}_${font}`;
  if (!textWidthCache.has(key)) {
    ctx.font = font;
    textWidthCache.set(key, ctx.measureText(text).width);
  }
  return textWidthCache.get(key);
}
```

**6) 배경 캐싱**
```javascript
// ✅ 정적 배경은 한 번만 그려서 재사용
const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d');

// 초기화 시 한 번만 그리기
function drawStaticBackground() {
  bgCtx.fillStyle = '#87CEEB';
  bgCtx.fillRect(0, 0, width, height);
  Maps.drawBackground(bgCtx, ...);
}

// 매 프레임: 캐시된 배경 복사만
function render() {
  ctx.drawImage(bgCanvas, 0, 0);
  // 동적 요소만 그리기
  drawUnits();
  drawUI();
}
```

**5) 텍스트 렌더링 최소화**
```javascript
// ✅ 줌 아웃 시 텍스트 생략
function drawUnit(unit) {
  // 유닛 본체는 항상 그리기
  unit.draw(ctx);

  // 줌 레벨에 따라 텍스트 생략
  if (camera.scale > 0.5) {
    drawHealthBar(unit);
  }
  if (camera.scale > 0.8) {
    drawUnitName(unit);
  }
}
```

#### P2: 장기 구조 개선

**6) ECS (Entity Component System) 도입 고려**
- 현재: 각 유닛이 모든 로직 포함 (OOP)
- 개선: 시스템별로 데이터 분리 (ECS)
- 효과: 캐시 효율 개선, 병렬 처리 용이

---

## 2.3 회귀 방지 체크리스트

### 공통 회귀 패턴 (자주 발생하는 버그)

#### UI 표시 문제
- [ ] **CSS 충돌**: 중복 선택자, z-index 덮어쓰기
- [ ] **표시 토글**: `display:none`, `visibility:hidden`, `opacity:0` 충돌
- [ ] **Flex/Grid 레이아웃**: `min-height: 0` 누락으로 요소 축소
- [ ] **스크롤**: `overflow` 속성 변경으로 스크롤 불가

#### JavaScript 로드 순서
- [ ] **전역 변수 참조**: 로드 순서 문제로 `undefined` 에러
- [ ] **defer/module**: 스크립트 실행 타이밍 변경
- [ ] **DOM 마운트**: `DOMContentLoaded` 전 DOM 접근

#### 이벤트 리스너
- [ ] **중복 등록**: 같은 이벤트가 2번 이상 등록됨
- [ ] **메모리 누수**: 제거된 DOM에 리스너 남아있음
- [ ] **this 바인딩**: 콜백에서 `this` 컨텍스트 손실

#### 데이터 로드
- [ ] **에러 처리**: 데이터 로드 실패 시 fallback UI 없음
- [ ] **비동기 타이밍**: `async/await` 없이 데이터 사용
- [ ] **캐시/localStorage**: 손상된 데이터 파싱 에러

### 회귀 방지 도구

#### 1) 콘솔 에러 모니터링
```javascript
// 에러 자동 수집 (개발 모드)
window.addEventListener('error', (e) => {
  console.error('❌ Global Error:', e.message, e.filename, e.lineno);
  // 추가: 서버로 에러 리포트
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('❌ Unhandled Promise:', e.reason);
});
```

#### 2) 기능 체크리스트 자동화
```javascript
// 에디터 초기화 시 자동 검증
function validateEditorFeatures() {
  const checks = [
    { name: 'Canvas 엘리먼트', test: () => !!document.getElementById('canvas') },
    { name: 'MagicBlueprintApp 클래스', test: () => typeof MagicBlueprintApp !== 'undefined' },
    { name: 'CONFIG 데이터', test: () => !!window.CONFIG && !!CONFIG.units },
    { name: '유닛 리스트 렌더링', test: () => document.querySelectorAll('.unit-card').length > 0 },
  ];

  checks.forEach(check => {
    const result = check.test();
    console.log(`${result ? '✅' : '❌'} ${check.name}`);
  });
}
```

#### 3) 로컬 스토리지 검증
```javascript
// 손상된 데이터 복구
function safeLoadFromLocalStorage(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;

    const data = JSON.parse(raw);
    // 스키마 검증
    if (!validateSchema(data)) {
      console.warn('⚠️ 잘못된 데이터 형식, 기본값 사용');
      return defaultValue;
    }
    return data;
  } catch (e) {
    console.error('❌ localStorage 파싱 실패:', e);
    return defaultValue;
  }
}
```

---

## 3. 폴더 구조 개선

### 3.1 현재 구조 (루트 기준)
```
RECLAIM_5.0/
├── index.html              # 메인 게임
├── data.js                 # 유닛/건물 데이터
├── maps.js                 # 맵 타입
├── classes.js              # Unit/Building 클래스
├── game.js                 # 게임 루프/로직
├── ai.js                   # AI
├── hud.js                  # UI
├── buildings.js            # 건물
├── projectiles.js          # 투사체
├── drones.js               # 드론
├── spatial.js              # 공간 그리드
├── unit_commands.js        # 유닛 명령
├── audio.js                # 오디오
├── chat_panel.js           # 채팅
├── ui.js                   # UI 공통
├── lobby-background.js     # 로비 배경
├── lang.js                 # 다국어
├── src/
│   ├── core/
│   │   └── camera.js
│   └── vfx/
│       └── explosion.js
├── unitdex/                # 유닛 도감
│   ├── lang_kr.js
│   ├── lang_en.js
│   └── unitdex.js
└── REC_unit-editor/        # 유닛 에디터
    └── index.html          # (단일 파일)
```

### 3.2 공유 스키마 (Shared Schema) 추가

#### 문제: 에디터 ↔ 게임 데이터 불일치
- 에디터가 만든 패치가 게임에서 깨짐
- 필드 추가/삭제 시 호환성 문제
- 검증 로직이 각자 따로 존재

#### 해결: `shared/` 레이어 추가
```
RECLAIM_5.0/
└── shared/                 # 🆕 공유 데이터 스키마
    ├── schema_unit.js      # 유닛 데이터 구조
    ├── schema_building.js  # 건물 데이터 구조
    ├── schema_patch.js     # 패치 포맷 정의
    └── validators.js       # 검증/정규화 함수
```

#### schema_unit.js 예시
```javascript
// 유닛 필드 정의 + 기본값 + 검증
export const UNIT_SCHEMA = {
  id: { type: 'string', required: true },
  name: { type: 'string', required: true },
  hp: { type: 'number', default: 100, min: 1, max: 9999 },
  speed: { type: 'number', default: 2, min: 0, max: 20 },
  damage: { type: 'number', default: 10, min: 0 },
  range: { type: 'number', default: 50, min: 0 },
  cost: { type: 'number', default: 100, min: 0 },
  type: { type: 'string', enum: ['ground', 'air', 'naval'], default: 'ground' },
  category: { type: 'string', enum: ['infantry', 'vehicle', 'aircraft'], required: true },
};

export function validateUnit(unit) {
  const errors = [];
  for (const [key, schema] of Object.entries(UNIT_SCHEMA)) {
    // 필수 필드 체크
    if (schema.required && !(key in unit)) {
      errors.push(`필수 필드 누락: ${key}`);
    }

    // 타입 체크
    if (key in unit && typeof unit[key] !== schema.type) {
      errors.push(`잘못된 타입: ${key} (expected ${schema.type})`);
    }

    // 범위 체크
    if (schema.min !== undefined && unit[key] < schema.min) {
      errors.push(`${key}가 최소값보다 작음: ${unit[key]} < ${schema.min}`);
    }
    if (schema.max !== undefined && unit[key] > schema.max) {
      errors.push(`${key}가 최대값보다 큼: ${unit[key]} > ${schema.max}`);
    }

    // enum 체크
    if (schema.enum && !schema.enum.includes(unit[key])) {
      errors.push(`${key}가 허용된 값이 아님: ${unit[key]}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

#### schema_patch.js 예시
```javascript
// 패치 포맷 정의
export const PATCH_VERSION = '1.0';

export function createPatch(changes) {
  return {
    version: PATCH_VERSION,
    timestamp: Date.now(),
    units: changes.units || {},
    buildings: changes.buildings || {},
    maps: changes.maps || {},
  };
}

export function validatePatch(patch) {
  if (!patch.version) return { valid: false, errors: ['버전 없음'] };
  if (patch.version !== PATCH_VERSION) {
    return { valid: false, errors: [`지원하지 않는 버전: ${patch.version}`] };
  }
  // 추가 검증...
  return { valid: true, errors: [] };
}
```

#### 사용 예시 (에디터)
```javascript
// editor_patch.js
import { validateUnit } from '../shared/schema_unit.js';
import { createPatch } from '../shared/schema_patch.js';

function saveUnitChanges(unitKey, modifiedData) {
  // 검증
  const { valid, errors } = validateUnit(modifiedData);
  if (!valid) {
    alert(`저장 실패:\n${errors.join('\n')}`);
    return false;
  }

  // 패치 생성
  const patch = createPatch({
    units: { [unitKey]: modifiedData }
  });

  // 저장
  applyPatch(patch);
  return true;
}
```

### 3.3 목표 구조 (점진적 마이그레이션)
```
RECLAIM_5.0/
├── index.html              # 메인 게임 (최소한으로 유지)
├── assets/                 # 🆕 리소스 (PNG, BGM 등)
│   ├── images/
│   ├── audio/
│   └── fonts/
├── shared/                 # 🆕 공유 스키마/검증
│   ├── schema_unit.js
│   ├── schema_building.js
│   ├── schema_patch.js
│   └── validators.js
├── src/                    # 🆕 게임 런타임 코드
│   ├── core/               # 핵심 시스템
│   │   ├── game.js         # 게임 루프
│   │   ├── camera.js       # 카메라
│   │   ├── input.js        # 입력 처리
│   │   └── time.js         # 시간 관리
│   ├── data/               # 데이터
│   │   ├── units.js        # (현재 data.js)
│   │   ├── buildings.js
│   │   └── maps.js
│   ├── entities/           # 엔티티
│   │   ├── Unit.js         # Unit 클래스
│   │   ├── Building.js
│   │   ├── Projectile.js
│   │   └── Drone.js
│   ├── systems/            # 시스템 (ECS 스타일)
│   │   ├── ai.js
│   │   ├── combat.js
│   │   ├── movement.js
│   │   ├── spatial.js      # 공간 그리드
│   │   └── commands.js     # 유닛 명령
│   ├── ui/                 # UI
│   │   ├── hud.js
│   │   ├── chat.js
│   │   ├── lobby.js        # 로비 배경
│   │   └── unitdex/
│   │       ├── lang_kr.js
│   │       ├── lang_en.js
│   │       └── unitdex.js
│   ├── vfx/                # VFX
│   │   └── explosion.js
│   └── utils/              # 유틸리티
│       ├── audio.js
│       └── lang.js
└── tools/                  # 🆕 개발 도구
    └── unit-editor/        # (현재 REC_unit-editor)
        ├── index.html
        └── js/
            ├── editor_boot.js
            ├── editor_app.js
            ├── editor_ui.js
            ├── editor_storage.js
            ├── editor_patch.js
            ├── editor_skin.js
            └── editor_utils.js
```

### 3.4 마이그레이션 전략 (안전하게)

#### 전략: "신규 파일부터 새 구조로"
- ✅ 기존 파일을 강제로 옮기지 않음 (링크 깨짐 위험)
- ✅ 새 기능 추가 시 `src/` 구조로 작성
- ✅ 기존 파일은 리팩터 타이밍에 점진적으로 이동

#### Phase 1: 폴더 생성
```bash
mkdir assets
mkdir src/core src/data src/entities src/systems src/ui src/vfx src/utils
mkdir tools
```

#### Phase 2: 에디터부터 이동 (가장 독립적)
```bash
mv REC_unit-editor tools/unit-editor
# tools/unit-editor/index.html 에서 상대 경로 수정
# ../data.js → ../../src/data/units.js (나중에)
```

#### Phase 3: 신규 파일은 새 구조로
```javascript
// 예: 새 시스템 추가 시
// src/systems/pathfinding.js 로 생성
```

#### Phase 4: 기존 파일 점진 이동 (선택사항)
```bash
# 예: data.js → src/data/units.js
# 1) src/data/units.js 생성 (복사)
# 2) 루트 data.js를 래퍼로 전환 (하위 호환)
```

```javascript
// data.js (래퍼 - 임시로 남김)
import * as Units from './src/data/units.js';
window.CONFIG = Units.CONFIG;
```

#### 폴더 이동 시 "얇은 래퍼 파일" 전략
```javascript
// 기존: game.js (루트)
// 이동: src/core/game.js

// 1단계: src/core/game.js 생성 (실제 코드 이동)
// 2단계: 루트 game.js를 래퍼로 전환 (하위 호환)

// game.js (래퍼 - 임시로 남김)
import * as Game from './src/core/game.js';
export const { GameLoop, init, render } = Game;

// 또는 전역 방식
window.GameLoop = Game.GameLoop;
```

**이점**:
- 기존 `<script src="game.js">`가 깨지지 않음
- 점진적으로 새 경로로 전환 가능
- 나중에 래퍼만 제거하면 완료

#### 에디터 이동 순서 (중요!)
```
1. ✅ JS 분리 먼저 (REC_unit-editor/js/*)
2. ✅ 동작 안정화 (모든 기능 테스트)
3. ✅ 폴더 이동 (tools/unit-editor/)
4. ✅ 상대 경로 수정
```

**주의**: 한 번에 하면 "뭐가 깨졌는지" 파악 어려움!

### 3.5 상대 경로 관리 팁

#### 문제: 폴더 이동 시 `../` 경로 깨짐
```html
<!-- REC_unit-editor/index.html (기존) -->
<script src="../data.js"></script>

<!-- tools/unit-editor/index.html (이동 후) -->
<script src="../../src/data/units.js"></script>
```

#### 해결책 1: 절대 경로 사용
```html
<script src="/RECLAIM_5.0/src/data/units.js"></script>
```

#### 해결책 2: Base 태그 활용
```html
<head>
  <base href="/RECLAIM_5.0/">
</head>
<script src="src/data/units.js"></script>
```

---

## 4. 실행 로드맵

### 4.1 우선순위 매트릭스

| 작업 | 난이도 | 효과 | 우선순위 |
|------|--------|------|----------|
| 에디터 JS 분리 | 중 | 대 | **P0** |
| 에디터 성능 (디바운스) | 하 | 중 | **P0** |
| 게임 O(N²) 제거 | 중 | 대 | **P1** |
| HUD 업데이트 최적화 | 하 | 중 | **P1** |
| 에디터 tools/ 이동 | 하 | 소 | **P2** |
| 게임 src/ 구조화 | 대 | 중 | **P2** |
| 캔버스 배경 캐싱 | 중 | 중 | **P3** |
| ECS 구조 도입 | 대 | 대 | **P4** |

### 4.2 게이트 기반 실행 (주 단위 대신)

#### 왜 게이트 방식?
- 주 단위는 일정이 틀어지면 전체 붕괴
- 게이트는 "완료 기준 충족 → 다음 단계" 방식
- 각 단계가 독립적으로 검증됨

#### Gate 1: 에디터 JS 분리 ✅
**입구 조건**: 없음 (언제든 시작 가능)

**작업**:
- [ ] `REC_unit-editor/js/` 폴더 생성
- [ ] 7개 모듈 파일 분리 (boot/app/ui/storage/patch/skin/utils)
- [ ] `index.html` 스크립트 로드 정리

**출구 조건** (Exit Criteria):
- [ ] index.html 인라인 JS ≤ 100줄
- [ ] 모든 기능 정상 작동 (유닛 선택/편집/저장/패치/스킨)
- [ ] 콘솔 에러 0개
- [ ] 5분 사용 시 렉 없음

#### Gate 2: 공유 스키마 + 검증 레이어 ✅
**입구 조건**: Gate 1 완료

**작업**:
- [ ] `shared/` 폴더 생성
- [ ] `schema_unit.js`, `validators.js` 작성
- [ ] 에디터 저장 시 검증 적용

**출구 조건**:
- [ ] 잘못된 데이터 저장 시 에러 표시
- [ ] 검증 통과한 데이터만 CONFIG에 반영
- [ ] 패치 버전 관리 시작

#### Gate 3: 게임 성능 병목 제거 ✅
**입구 조건**: Gate 1 완료 (Gate 2와 병렬 가능)

**작업**:
- [ ] Chrome DevTools Performance 프로파일링
- [ ] O(N²) 루프 1~2개 확정
- [ ] spatial.js로 전환
- [ ] 전/후 FPS 측정

**출구 조건**:
- [ ] 유닛 100개: 평균 FPS ≥ 55
- [ ] 유닛 500개: 평균 FPS ≥ 30
- [ ] 프레임 타임 < 33ms

#### Gate 4: 폴더 정리 (선택사항)
**입구 조건**: Gate 1, 2, 3 완료

**작업**:
- [ ] `assets/`, `src/`, `tools/` 폴더 생성
- [ ] 에디터를 `tools/unit-editor/`로 이동
- [ ] 상대 경로 수정

**출구 조건**:
- [ ] 모든 링크 정상 작동
- [ ] Raw.githack 테스트 통과

#### Gate 5: 신규 기능은 새 구조로
**입구 조건**: Gate 4 완료

**작업**:
- [ ] 다음 기능 추가 시 `src/` 구조 따르기
- [ ] 기존 파일 리팩터 기회에 점진 이동

**출구 조건**:
- [ ] 새 파일이 `src/`에 정리됨
- [ ] 문서화 (README 업데이트)

### 4.3 기존 추천 실행 순서 (주 단위 참고용)

#### Week 1: 에디터 분리 (P0)
- [ ] Day 1-2: `REC_unit-editor/js/` 폴더 생성 + 모듈 껍데기
- [ ] Day 3-4: `editor_utils.js`, `editor_app.js` 분리
- [ ] Day 5-6: `editor_ui.js`, `editor_storage.js` 분리
- [ ] Day 7: 통합 테스트 + 버그 수정

**검증 포인트**:
- 에디터가 분리 전과 동일하게 동작하는가?
- 코드 검색/수정이 더 쉬워졌는가?

#### Week 2: 성능 최적화 (P0-P1)
- [ ] Day 1-2: 에디터 디바운스/쓰로틀 적용
- [ ] Day 3-4: 게임 O(N²) 루프 찾아서 spatial.js로 전환
- [ ] Day 5-6: HUD 업데이트 더티 체크 적용
- [ ] Day 7: 프로파일링 + 성능 측정

**검증 포인트**:
- 입력 시 멈칫거림이 사라졌는가?
- 유닛 100개 이상에서도 60fps 유지되는가?

#### Week 3: 폴더 정리 (P2)
- [ ] Day 1-2: 폴더 생성 (`assets/`, `src/`, `tools/`)
- [ ] Day 3-4: 에디터를 `tools/unit-editor/`로 이동
- [ ] Day 5-6: 상대 경로 수정 + 테스트
- [ ] Day 7: 문서화 (README 업데이트)

**검증 포인트**:
- 모든 링크가 정상 작동하는가?
- Raw.githack 링크가 깨지지 않았는가?

#### Week 4: 신규 기능은 새 구조로 (P2)
- [ ] 다음 기능 추가 시 `src/` 구조 따르기
- [ ] 기존 파일 리팩터 기회 있을 때 이동
- [ ] 점진적 개선

### 4.3 체크리스트 (단계별 검증)

#### ✅ 에디터 분리 완료 확인
- [ ] 각 JS 파일이 200~500줄 이내
- [ ] 파일명으로 기능 파악 가능
- [ ] 특정 기능 수정 시 1~2개 파일만 수정
- [ ] 브라우저 콘솔 에러 없음
- [ ] 모든 기능 정상 작동 (저장/불러오기/패치/스킨)

#### ✅ 성능 최적화 완료 확인
- [ ] 입력 시 렉 없음 (디바운스 적용)
- [ ] 유닛 100개에서 60fps 유지
- [ ] Chrome DevTools Profiler로 병목 확인
- [ ] localStorage 쓰기 빈도 < 1회/초

#### ✅ 폴더 정리 완료 확인
- [ ] 새 구조로 파일 정리
- [ ] 상대 경로 정상 작동
- [ ] Raw.githack 링크 정상
- [ ] README 업데이트

---

## 5. 부록: 코드 예시

### 5.1 Debounce 유틸
```javascript
// editor_utils.js
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

### 5.2 Throttle 유틸
```javascript
// editor_utils.js
function throttle(fn, delay) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}
```

### 5.3 더티 플래그 패턴
```javascript
// editor_app.js
class MagicBlueprintApp {
  constructor() {
    this.dirty = true;
  }

  invalidate() {
    if (!this.dirty) {
      this.dirty = true;
      requestAnimationFrame(() => this.render());
    }
  }

  render() {
    if (!this.dirty) return;
    this.dirty = false;

    // 실제 렌더링...
    this.drawLayers();
    this.drawReference();
  }

  // 이벤트 핸들러에서 invalidate() 호출
  onLayerChange() {
    this.invalidate(); // 다음 프레임에 렌더링 예약
  }
}
```

### 5.4 공간 그리드 사용 예시
```javascript
// game.js (기존 O(N²) 개선)

// ❌ Before: O(N²)
for (const unit of this.players) {
  for (const enemy of this.enemies) {
    if (distance(unit, enemy) < unit.range) {
      unit.attack(enemy);
    }
  }
}

// ✅ After: O(N) (spatial.js 활용)
for (const unit of this.players) {
  const nearbyEnemies = spatialGrid.query(
    unit.x - unit.range,
    unit.y - unit.range,
    unit.x + unit.range,
    unit.y + unit.range,
    'enemy'
  );

  for (const enemy of nearbyEnemies) {
    if (distance(unit, enemy) < unit.range) {
      unit.attack(enemy);
    }
  }
}
```

---

## 6. 결론 및 다음 단계

### 핵심 요약
1. **에디터 JS 분리 = 즉시 효과** (코드 가독성, 유지보수성, 안정성)
2. **성능 최적화 = 체감 개선** (디바운스, O(N²) 제거, HUD 최적화)
3. **폴더 정리 = 장기 생산성** (점진적으로 진행)

### 다음 단계 제안
1. **Week 1부터 시작**: 에디터 JS 분리 (가장 ROI 높음)
2. **성능 측정 도구 세팅**: Chrome DevTools Performance 프로파일링
3. **문서화**: 각 모듈의 책임과 API를 간단히 주석으로

### 추가 지원 가능한 것
- 각 모듈별 상세 분리 가이드 (어느 코드 블록을 어디로 옮길지)
- 실제 코드 변환 스크립트 (자동화)
- 성능 프로파일링 결과 분석

---

**작성일**: 2026-01-29
**버전**: 1.0
**대상**: RECLAIM 5.0 유닛 에디터 및 게임 전체
