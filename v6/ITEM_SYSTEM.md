# 장비 아이템 & 베테랑 UI 전면 개편 계획 (ADC 단계별)

## 목적 & 하이브리드 구조

| 등급 | 방식 | 동작 |
|------|------|------|
| **D** (일반 장비) | **B안 — 장착** | 보관함 저장 → 베테랑에 장착 → 스탯 버프 |
| **C** (전술 장비) | **B안 — 장착** | 보관함 저장 → 베테랑에 장착 → 전술 효과 |
| **A** (미사일 설계도) | **A안 — 교환** | 보관함 저장 → 상점 교환소에서 유닛/무기 구매 |
| **S** (기밀 설계도) | **A안 — 교환** | 보관함 저장 → 상점 교환소에서 특수 유닛/핵무기 구매 |

- D/C: **베테랑 장착 시스템** — 명령키 슬롯에 시각 표시, 스탯 패시브 적용
- A/S: **설계도 교환 시스템** — 상점 `설계도 교환` 탭에서 소모해 특정 유닛/무기 구매
- **베테랑 탭 제거** → 보병/기갑/공중 탭 안에 베테랑 인라인 표시
- 향후 S급 기밀설계도를 골드 현질로 판매

---

## 등급 체계

| 등급 | 이름 | 테마 | 색상 | UI 효과 |
|------|------|------|------|--------|
| **D** | 일반 장비 | 기본 장비류 (방탄복, 사거리 증가 등) | `#9ca3af` 회색 | 기본 테두리 |
| **C** | 전술 장비 | 소모성 전술 도구 (연막탄, 수류탄, 수리키트 등) | `#4ade80` 초록 | 초록 테두리 |
| **A** | 미사일 설계도 | 인게임 실사용 무기 설계도 (미사일, 화력 키트) | `#60a5fa` 파란 | 파란 테두리 |
| **S** | 기밀 설계도 | 최고기밀 설계도 (스텔스, ICBM 탄두 등) | `#fbbf24` 황금 | 황금 테두리 + 글로우 |

---

## 아이템 카탈로그 (등급별 분류)

---

### D등급 — 일반 장비 (기본 스탯 강화)

> 방탄복, 사거리 증가 등 일반적인 장비류. 일반 보급박스에서 주로 드롭.

| itemKey | 이름 | 호환 유닛 | 스탯 효과 |
|---------|------|----------|---------|
| `rifle_d` | 강화 소총 | infantry, special_forces | damage ×1.10 |
| `body_armor_d` | 방탄복 | infantry, special_forces, special_ops | hp ×1.20 |
| `scope_d` | 기본 조준경 | sniper | range ×1.15 |
| `fuel_tank_d` | 연료 탱크 확장 | blackhawk, chinook | range ×1.20 |
| `tow_cable_d` | 견인 케이블 | humvee, apc | hp ×1.15 |
| `drone_module` | 드론 모듈 | drone_operator | droneCharges +1 ※ |

> **※ drone_module**: 명령키에서 자폭드론/AT드론 프로필 그대로 렌더링 (`iconImageUnitKey` 방식)

---

### C등급 — 전술 장비 (소모성 전술 도구)

> 연막탄, 수류탄, 수리키트 등 전술적 효과를 주는 장비. 일반/특수 보급박스에서 드롭.

| itemKey | 이름 | 호환 유닛 | 스탯 효과 |
|---------|------|----------|---------|
| `smoke_grenade` | 연막탄 | infantry, special_forces | stealth 부여 |
| `grenade_kit` | 수류탄 키트 | infantry, special_forces, engineer | splash 부여, splashRadius +30 |
| `repair_kit_c` | 수리 키트 | humvee, apc, mbt | hp ×1.20 |
| `medkit_c` | 의료 키트 | engineer | hp ×1.25 |
| `drone_battery_c` | 드론 배터리 팩 | drone_operator | range ×1.20, maxCount +1 |
| `flare_kit` | 플레어 키트 | apache, blackhawk, fighter | (피격 시 미사일 회피율 +20%) |

---

### A등급 — 미사일 설계도 (상점 교환 → 유닛/무기 구매)

> 보관함에 저장 후, 상점 `설계도 교환` 탭에서 소모해 특정 유닛/무기를 구매.
> 특수 보급박스/기밀문서에서 드롭.

| itemKey | 이름 | 교환 비용 | 교환 결과 (획득 유닛/무기) |
|---------|------|---------|------------------------|
| `bp_tactical_missile` | 전술미사일 설계도 | A설계도 ×1 | `tactical_missile` 유닛 ×1 |
| `bp_emp` | EMP 설계도 | A설계도 ×1 | `emp` 유닛 ×1 |
| `bp_hellfire` | 헬파이어 설계도 | A설계도 ×2 | `apache` 미사일 강화 팩 ×1 |
| `bp_aa_upgrade` | 대공 미사일 설계도 | A설계도 ×1 | `aa_tank` 업그레이드 ×1 |
| `bp_spg_shell` | 강화 포탄 설계도 | A설계도 ×1 | `spg` 강화 포탄 팩 ×1 |
| `bp_agm` | 공대지 미사일 설계도 | A설계도 ×1 | `apache`/`bomber` AGM 팩 ×1 |
| `bp_aam` | 공대공 미사일 설계도 | A설계도 ×1 | `fighter` AAM 팩 ×1 |

> **A설계도 공통 통화:** A등급 설계도는 모두 **A설계도 포인트** 1개로 취급.
> 상점에서 `state.blueprints.a` 차감 방식.

---

### S등급 — 기밀 설계도 (상점 교환 → 특수/핵 유닛 구매)

> 가장 희귀. 기밀문서에서 주로 드롭. 향후 골드 현질로도 판매 예정.
> 상점 `기밀 교환` 탭에서 소모해 최강 유닛/무기 구매.

| itemKey | 이름 | 교환 비용 | 교환 결과 |
|---------|------|---------|---------|
| `bp_nuke` | 핵미사일 기밀설계도 | S설계도 ×1 | `nuke` 유닛 ×1 |
| `bp_icbm_upgrade` | ICBM 탄두 기밀설계도 | S설계도 ×1 | `icbm` missileDamage ×1.50 영구 적용 |
| `bp_stealth` | 스텔스 코팅 기밀설계도 | S설계도 ×1 | `fighter`/`stealth_drone` stealth 영구 부여 |
| `bp_machinegun` | 기관총 기밀설계도 | S설계도 ×1 | 보병 전체 damage +40% 영구 적용 |
| `bp_composite_armor` | 증가장갑 기밀설계도 | S설계도 ×1 | `mbt` hp ×1.40 영구 적용 |
| `bp_precision` | 정밀 유도 기밀설계도 | S설계도 ×2 | `bomber`/`apache` splashRadius +50 영구 |
| `bp_suicide_upgrade` | 자폭드론 기밀설계도 | S설계도 ×1 | `drone_suicide` damage ×1.50 영구 |

> **S설계도 공통 통화:** S등급 설계도는 모두 **S설계도 포인트** 1개로 취급.
> 상점에서 `state.blueprints.s` 차감 방식.
> 영구 적용 효과는 `state.permanentUpgrades` 에 저장.

---

## 드롭률

| 등급 | 일반 보급박스 | 특수 보급박스 | 기밀문서 |
|------|------------|------------|--------|
| D | 55% | 20% | 0% |
| C | 30% | 40% | 0% |
| A | 12% | 32% | 40% |
| S | 3% | 8% | 60% |

---

## 베테랑 탭 UI 개편 방향

### 현재 문제
```
현재: [보병] [기갑] [공중] [베테랑]  ← 4탭, 탭이 많아 가독성 나쁨
```

### 목표
```
목표: [보병] [기갑] [공중]  ← 3탭 유지
      보병 탭 안:
      [infantry] [infantry LV.2 "홍길동"] [engineer] [sniper LV.3 "이순신"] ...
                 ↑ 베테랑이 기본 유닛 바로 옆에 인라인으로 표시
```

### 혼잡 문제 해결안 (동일 유닛 베테랑 다수 보유 시)

```
[infantry] [inf LV.3 "철수"] [inf LV.2 "영희"] [+1▼]  [engineer] [sniper] ...
                                                 ↑
                             클릭 시 드롭다운으로 나머지 베테랑 표시
```

- 같은 유닛 타입 베테랑은 **레벨 높은 순** 정렬
- 기본 유닛 카드 바로 뒤에 베테랑 카드 삽입
- 베테랑 카드는 기본 카드보다 좁은 compact 형태
- 동일 타입 베테랑 3개 이상 → 2개만 노출 + `+N▼` 더보기

### 베테랑 카드 구조

```
┌──────────────┐
│ [V] LV.2     │  ← 금색 V 뱃지 + 레벨
│ 홍길동        │  ← 이름 (8자 말줄임)
│ ■■□           │  ← 슬롯 인디케이터 (3개 중 장착 수)
│    x3         │  ← 재고
└──────────────┘
```

---

## 구현 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/modes/city-sim/items.js` | **신규** - ITEM_DEFS 전체 정의 (D/A/S 등급) |
| `src/modes/city-sim/state.js` | `state.items` 인벤토리, loadout → `{ slot1, slot2, slot3 }` |
| `game.js` | `applyVeteranStats()` → `applyItemMods()` 3슬롯 적용 |
| `hud.js` | `resolveCommandRoleMap()` 아이템 연동, `getMappedCommandMeta()` item 타입 처리 |
| `src/modes/city-sim/gacha.js` | 드롭풀 item 타입 추가, `_applyRewards()` 확장 |
| `src/modes/city-sim/unit-upgrade.js` | 장착 모달 UI 실구현 (현재 stub) |
| `ui.js` | 탭 렌더링에 베테랑 인라인 삽입, 더보기 버튼 |
| `style.css` | 등급별 명령키 테두리, 베테랑 카드 스타일, S급 글로우 |

---

# ADC 단계별 구현 계획

## A단계: 데이터 기반 구축 (P0)

### A-01: `src/modes/city-sim/items.js` 신규 생성

전체 ITEM_DEFS 정의. 구조:
```js
const ITEM_DEFS = {

  // ── D등급: 일반 장비 ─────────────────────────────────────────
  rifle_d:      { id:'rifle_d',      name:'강화 소총',       grade:'D', color:'#9ca3af', icon:'fa-gun',           compat:['infantry','special_forces'],                  statMods:{ damage:1.10 } },
  body_armor_d: { id:'body_armor_d', name:'방탄복',          grade:'D', color:'#9ca3af', icon:'fa-shield-halved',  compat:['infantry','special_forces','special_ops'],    statMods:{ hp:1.20 } },
  scope_d:      { id:'scope_d',      name:'기본 조준경',     grade:'D', color:'#9ca3af', icon:'fa-crosshairs',     compat:['sniper'],                                     statMods:{ range:1.15 } },
  fuel_tank_d:  { id:'fuel_tank_d',  name:'연료 탱크 확장',  grade:'D', color:'#9ca3af', icon:'fa-gas-pump',       compat:['blackhawk','chinook'],                        statMods:{ range:1.20 } },
  tow_cable_d:  { id:'tow_cable_d',  name:'견인 케이블',     grade:'D', color:'#9ca3af', icon:'fa-wrench',         compat:['humvee','apc'],                               statMods:{ hp:1.15 } },
  drone_module: { id:'drone_module', name:'드론 모듈',       grade:'D', color:'#9ca3af', icon:null,
                  iconImageUnitKey:'drone_suicide',  // 명령키에 자폭드론 프로필 렌더링
                  compat:['drone_operator'], statMods:{ droneCharges:1 } },

  // ── C등급: 전술 장비 ─────────────────────────────────────────
  smoke_grenade:  { id:'smoke_grenade',  name:'연막탄',          grade:'C', color:'#4ade80', icon:'fa-smog',           compat:['infantry','special_forces'],                  statMods:{ stealth:true } },
  grenade_kit:    { id:'grenade_kit',    name:'수류탄 키트',     grade:'C', color:'#4ade80', icon:'fa-bomb',            compat:['infantry','special_forces','engineer'],       statMods:{ splash:true, splashRadiusFlat:30 } },
  repair_kit_c:   { id:'repair_kit_c',   name:'수리 키트',       grade:'C', color:'#4ade80', icon:'fa-wrench',          compat:['humvee','apc','mbt'],                         statMods:{ hp:1.20 } },
  medkit_c:       { id:'medkit_c',       name:'의료 키트',       grade:'C', color:'#4ade80', icon:'fa-kit-medical',     compat:['engineer'],                                   statMods:{ hp:1.25 } },
  drone_battery_c:{ id:'drone_battery_c',name:'드론 배터리 팩',  grade:'C', color:'#4ade80', icon:'fa-battery-full',    compat:['drone_operator'],                             statMods:{ range:1.20, maxCountBonus:1 } },
  flare_kit:      { id:'flare_kit',      name:'플레어 키트',     grade:'C', color:'#4ade80', icon:'fa-star',            compat:['apache','blackhawk','fighter'],               statMods:{ missileEvade:0.20 } },

  // ── A등급: 미사일 설계도 ──────────────────────────────────────
  agm_kit_a:      { id:'agm_kit_a',      name:'공대지 미사일 설계도',  grade:'A', color:'#60a5fa', icon:'fa-rocket',       compat:['apache','bomber'],          statMods:{ damage:1.25 } },
  aam_kit_a:      { id:'aam_kit_a',       name:'공대공 미사일 설계도',  grade:'A', color:'#60a5fa', icon:'fa-rocket',       compat:['fighter'],                  statMods:{ damage:1.30, range:1.20 } },
  hellfire_a:     { id:'hellfire_a',      name:'헬파이어 설계도',       grade:'A', color:'#60a5fa', icon:'fa-fire',         compat:['apache'],                   statMods:{ missileDamage:1.40 } },
  aa_missile_a:   { id:'aa_missile_a',    name:'대공 미사일 설계도',    grade:'A', color:'#60a5fa', icon:'fa-rocket',       compat:['aa_tank'],                  statMods:{ damage:1.30, range:1.15 } },
  spg_shell_a:    { id:'spg_shell_a',     name:'강화 포탄 설계도',      grade:'A', color:'#60a5fa', icon:'fa-bullseye',     compat:['spg'],                      statMods:{ damage:1.25, splashRadiusFlat:20 } },
  firepower_kit_a:{ id:'firepower_kit_a', name:'화력 강화 설계도',      grade:'A', color:'#60a5fa', icon:'fa-fire',         compat:['mbt','spg'],                statMods:{ damage:1.20 } },
  rifle_a:        { id:'rifle_a',         name:'정예 소총 설계도',      grade:'A', color:'#60a5fa', icon:'fa-gun',          compat:['infantry','special_forces'],statMods:{ damage:1.25 } },
  scope_a:        { id:'scope_a',         name:'저격 조준경 설계도',    grade:'A', color:'#60a5fa', icon:'fa-crosshairs',   compat:['sniper'],                   statMods:{ range:1.30, damage:1.10 } },

  // ── S등급: 기밀 설계도 ───────────────────────────────────────
  scope_s:          { id:'scope_s',          name:'정밀 조준경 기밀설계도',      grade:'S', color:'#fbbf24', icon:'fa-crosshairs',        compat:['sniper'],                       statMods:{ range:1.35, damage:1.15 } },
  body_armor_s:     { id:'body_armor_s',      name:'중형 방탄복 기밀설계도',      grade:'S', color:'#fbbf24', icon:'fa-shield-halved',     compat:['special_ops','special_forces'], statMods:{ hp:1.45 } },
  tactical_vest_s:  { id:'tactical_vest_s',   name:'전술 조끼 기밀설계도',       grade:'S', color:'#fbbf24', icon:'fa-vest',              compat:['special_ops','sniper'],         statMods:{ hp:1.20, damage:1.25 } },
  composite_armor_s:{ id:'composite_armor_s', name:'증가장갑 기밀설계도',        grade:'S', color:'#fbbf24', icon:'fa-shield',            compat:['mbt'],                          statMods:{ hp:1.40, speed:0.90 } },
  hellfire_s:       { id:'hellfire_s',        name:'헬파이어 기밀설계도',        grade:'S', color:'#fbbf24', icon:'fa-fire-flame-curved', compat:['apache'],                       statMods:{ missileDamage:1.60 } },
  precision_kit_s:  { id:'precision_kit_s',   name:'정밀 유도 기밀설계도',       grade:'S', color:'#fbbf24', icon:'fa-bullseye',          compat:['bomber','apache'],              statMods:{ splashRadiusFlat:50, damage:1.15 } },
  stealth_coat_s:   { id:'stealth_coat_s',    name:'스텔스 코팅 기밀설계도',     grade:'S', color:'#fbbf24', icon:'fa-eye-slash',         compat:['fighter','stealth_drone'],      statMods:{ stealth:true } },
  aa_missile_s:     { id:'aa_missile_s',      name:'대공 미사일 기밀설계도',     grade:'S', color:'#fbbf24', icon:'fa-rocket',            compat:['aa_tank'],                      statMods:{ damage:1.35, range:1.15 } },
  icbm_warhead_s:   { id:'icbm_warhead_s',    name:'ICBM 탄두 기밀설계도',      grade:'S', color:'#fbbf24', icon:'fa-radiation',         compat:['icbm'],                         statMods:{ missileDamage:1.50 } },
  machinegun_s:     { id:'machinegun_s',       name:'기관총 기밀설계도',          grade:'S', color:'#fbbf24', icon:'fa-gun',               compat:['infantry','special_forces'],    statMods:{ damage:1.40, range:1.10 } },
  suicide_kit_s:    { id:'suicide_kit_s',      name:'자폭드론 기밀설계도',        grade:'S', color:'#fbbf24', icon:'fa-burst',             compat:['drone_suicide'],                statMods:{ damage:1.50, splashRadiusFlat:40 } },
};

const ITEM_GRADE_COLOR = { D:'#9ca3af', C:'#4ade80', A:'#60a5fa', S:'#fbbf24' };
const ITEM_GRADE_CLASS  = { D:'item-grade-d', C:'item-grade-c', A:'item-grade-a', S:'item-grade-s' };
```

### A-02: `src/modes/city-sim/state.js` 수정

```js
// D/C 장비 인벤토리
state.items = {};
// 예: { body_armor_d: 2, smoke_grenade: 1, repair_kit_c: 3 }

// A/S 설계도 포인트 (통화)
state.blueprints = { a: 0, s: 0 };

// S등급 교환으로 획득한 영구 업그레이드
state.permanentUpgrades = {};
// 예: { bp_stealth: true, bp_machinegun: true, bp_icbm_upgrade: true }

// veteran.loadout 구조 변경 (D/C 장비만 장착)
// 기존: { itemKey: 'drone_module' }
// 변경: { slot1: null, slot2: null, slot3: null }

// 마이그레이션 (기존 저장 데이터 호환)
function migrateVeteranLoadout(vet) {
  if (vet.loadout?.itemKey !== undefined) {
    vet.loadout = { slot1: vet.loadout.itemKey || null, slot2: null, slot3: null };
  }
}
```

### A-03: 기존 `VETERAN_ITEM_COMPAT` 제거

`state.js`의 `VETERAN_ITEM_COMPAT` 상수 삭제 → `ITEM_DEFS[key].compat` 으로 완전 대체.

**완료 조건:**
- ITEM_DEFS 전체 D/C 아이템 정의 완성
- A/S 설계도 `bp_*` 키 정의 완성
- state.items / state.blueprints / state.permanentUpgrades 초기화 & 저장/로드
- 기존 drone_module 베테랑 → slot1 자동 이전

---

## B단계: 베테랑 탭 UI 개편 (P0)

### B-01: 베테랑 탭(tab-special) 제거

`hud.js`에서 베테랑 탭 show/hide 로직 정리.
`hud-tab-special` 버튼 숨김 또는 완전 제거.

### B-02: `ui.js` - 탭 렌더링에 베테랑 인라인 삽입

```js
function renderUnitCategoryWithVeterans(unitList, veteransByUnitKey) {
  const buttons = [];
  for (const unitDef of unitList) {
    // 1. 기본 유닛 카드
    buttons.push(renderBaseUnitBtn(unitDef));

    // 2. 해당 unitKey 베테랑 (레벨 내림차순)
    const vets = (veteransByUnitKey[unitDef.id] || [])
      .sort((a, b) => b.level - a.level);

    const shown  = vets.slice(0, 2);
    const hidden = vets.slice(2);

    for (const v of shown)  buttons.push(renderVeteranInlineBtn(v));
    if (hidden.length > 0)  buttons.push(renderVeteranMoreBtn(unitDef.id, hidden));
  }
  return buttons;
}
```

### B-03: 베테랑 인라인 카드 렌더링

```js
function renderVeteranInlineBtn(vet) {
  const slotFilled = [vet.loadout.slot1, vet.loadout.slot2, vet.loadout.slot3]
    .filter(Boolean).length;
  // 슬롯 인디케이터 ■■□
  const dots = [0,1,2].map(i =>
    `<span class="vet-slot-dot ${i < slotFilled ? 'filled' : ''}"></span>`
  ).join('');

  return `
    <button class="unit-btn veteran-inline" data-veteran-id="${vet.id}">
      <span class="vet-level-badge">LV.${vet.level}</span>
      <canvas class="unit-icon-canvas" ...></canvas>
      <span class="vet-name">${vet.name.slice(0,8)}</span>
      <span class="vet-slot-dots">${dots}</span>
      <span class="unit-count">x${stock}</span>
    </button>`;
}
```

### B-04: 더보기 버튼 & 드롭다운

```js
function renderVeteranMoreBtn(unitKey, hiddenVets) {
  return `<button class="unit-btn veteran-more-btn"
            data-unit-key="${unitKey}"
            data-hidden-vets="${JSON.stringify(hiddenVets.map(v=>v.id))}">
    +${hiddenVets.length}▼
  </button>`;
}
// 클릭 시 → 드롭다운 팝오버로 나머지 베테랑 표시
```

**완료 조건:**
1. 보병/기갑/공중 3탭만 존재, 베테랑 탭 없음
2. 각 탭에서 기본 유닛 바로 옆에 베테랑 카드 표시
3. 베테랑 3개 이상 시 `+N▼` 더보기 정상 동작
4. 베테랑 카드 클릭 → 장착 모달(unit-upgrade) 열림

---

## C단계: 아이템 드롭 & 인벤토리 (P1)

### C-01: `gacha.js` 드롭풀 통합

```js
// ── 일반 보급박스 (D 55%, C 30%, A 12%, S 3%) ─────────────────
// BOX_LEVEL1_REWARD_POOL 추가
{ type:'item', itemKey:'rifle_d',        grade:'D', weight:20 },
{ type:'item', itemKey:'body_armor_d',   grade:'D', weight:18 },
{ type:'item', itemKey:'fuel_tank_d',    grade:'D', weight:10 },
{ type:'item', itemKey:'tow_cable_d',    grade:'D', weight:10 },  // D: 55%
{ type:'item', itemKey:'smoke_grenade',  grade:'C', weight:14 },
{ type:'item', itemKey:'grenade_kit',    grade:'C', weight:10 },
{ type:'item', itemKey:'repair_kit_c',   grade:'C', weight:8  },  // C: 30%
{ type:'item', itemKey:'agm_kit_a',      grade:'A', weight:5  },
{ type:'item', itemKey:'rifle_a',        grade:'A', weight:4  },  // A: 12%
{ type:'item', itemKey:'scope_s',        grade:'S', weight:1  },  // S: 3%

// ── 특수 보급박스 (D 20%, C 40%, A 32%, S 8%) ─────────────────
// BOX_LEVEL2_REWARD_POOL 추가
{ type:'item', itemKey:'body_armor_d',   grade:'D', weight:10 },
{ type:'item', itemKey:'scope_d',        grade:'D', weight:8  },  // D: 20%
{ type:'item', itemKey:'smoke_grenade',  grade:'C', weight:15 },
{ type:'item', itemKey:'grenade_kit',    grade:'C', weight:12 },
{ type:'item', itemKey:'medkit_c',       grade:'C', weight:10 },
{ type:'item', itemKey:'flare_kit',      grade:'C', weight:8  },  // C: 40%
{ type:'item', itemKey:'agm_kit_a',      grade:'A', weight:8  },
{ type:'item', itemKey:'aam_kit_a',      grade:'A', weight:7  },
{ type:'item', itemKey:'aa_missile_a',   grade:'A', weight:6  },
{ type:'item', itemKey:'firepower_kit_a',grade:'A', weight:5  },  // A: 32%
{ type:'item', itemKey:'hellfire_s',     grade:'S', weight:2  },
{ type:'item', itemKey:'body_armor_s',   grade:'S', weight:2  },  // S: 8%

// ── 기밀문서 (A 40%, S 60%) ──────────────────────────────────
// CONFIDENTIAL_REWARD_POOL 추가
{ type:'item', itemKey:'scope_a',        grade:'A', weight:12 },
{ type:'item', itemKey:'hellfire_a',     grade:'A', weight:10 },
{ type:'item', itemKey:'spg_shell_a',    grade:'A', weight:9  },  // A: 40%
{ type:'item', itemKey:'scope_s',        grade:'S', weight:10 },
{ type:'item', itemKey:'hellfire_s',     grade:'S', weight:9  },
{ type:'item', itemKey:'stealth_coat_s', grade:'S', weight:8  },
{ type:'item', itemKey:'icbm_warhead_s', grade:'S', weight:8  },
{ type:'item', itemKey:'body_armor_s',   grade:'S', weight:7  },
{ type:'item', itemKey:'machinegun_s',   grade:'S', weight:6  },
{ type:'item', itemKey:'precision_kit_s',grade:'S', weight:5  },
{ type:'item', itemKey:'tactical_vest_s',grade:'S', weight:5  },  // S: 60%
```

### C-02: `_applyRewards()` 분기 처리

```js
case 'item':
  const def = ITEM_DEFS[reward.itemKey];
  if (def.grade === 'D' || def.grade === 'C') {
    // D/C: 장비 인벤토리에 누적
    state.items[reward.itemKey] = (state.items[reward.itemKey] ?? 0) + 1;
  } else if (def.grade === 'A') {
    // A: A설계도 포인트 +1
    state.blueprints.a = (state.blueprints.a ?? 0) + 1;
  } else if (def.grade === 'S') {
    // S: S설계도 포인트 +1
    state.blueprints.s = (state.blueprints.s ?? 0) + 1;
  }
  showItemToast(def);
  break;
```

### C-03: 설계도 교환 탭 (`gacha.js` 상점 확장)

상점에 새 탭 `blueprint` 추가:

```
상점 탭: [보급상점] [설계도 교환] [기밀 교환] [교환소]
                      ↑ A설계도 소모   ↑ S설계도 소모
```

**A설계도 교환 목록 (`SHOP_TABS.blueprint`):**
```js
{ id:'buy_tactical_missile', name:'전술미사일', costBpA:1, rewardUnit:'tactical_missile', amount:1 },
{ id:'buy_emp',              name:'EMP',        costBpA:1, rewardUnit:'emp',              amount:1 },
{ id:'buy_hellfire_pack',    name:'헬파이어 팩', costBpA:2, rewardUnit:'apache_ammo',      amount:1 },
{ id:'buy_agm_pack',         name:'AGM 팩',     costBpA:1, rewardUnit:'agm_ammo',         amount:1 },
{ id:'buy_aam_pack',         name:'AAM 팩',     costBpA:1, rewardUnit:'aam_ammo',         amount:1 },
```

**S설계도 교환 목록 (`SHOP_TABS.classified`):**
```js
{ id:'buy_nuke',          name:'핵미사일',      costBpS:1, rewardUnit:'nuke',           amount:1 },
{ id:'buy_icbm_upgrade',  name:'ICBM 탄두 강화', costBpS:1, permanentKey:'bp_icbm_upgrade' },
{ id:'buy_stealth',       name:'스텔스 코팅',    costBpS:1, permanentKey:'bp_stealth' },
{ id:'buy_machinegun',    name:'기관총 기밀',    costBpS:1, permanentKey:'bp_machinegun' },
{ id:'buy_precision',     name:'정밀 유도',      costBpS:2, permanentKey:'bp_precision' },
```

### C-04: `state.permanentUpgrades` 전투 적용 (`game.js`)

```js
// 스폰 시 permanentUpgrades 체크
if (state.permanentUpgrades.bp_stealth && ['fighter','stealth_drone'].includes(unit.unitKey)) {
  unit.stealth = true;
}
if (state.permanentUpgrades.bp_icbm_upgrade && unit.unitKey === 'icbm') {
  unit.missileDamage = Math.floor(unit.missileDamage * 1.50);
}
if (state.permanentUpgrades.bp_machinegun && ['infantry','special_forces'].includes(unit.unitKey)) {
  unit.damage = Math.floor(unit.damage * 1.40);
}
// ... 등
```

### C-05: 획득 토스트 연출

| 등급 | 토스트 |
|------|-------|
| D | 회색 `획득: 방탄복 [D]` |
| C | 초록 `획득: 수류탄 키트 [C]` |
| A | 파란 `획득: A설계도 +1 🔵 (전술미사일 교환 가능)` |
| S | 황금 + 반짝 `★ 획득: S설계도 +1 🟡 (핵미사일 교환 가능)` |

**완료 조건:**
1. 보급박스 → D/C는 items에, A/S는 blueprints 포인트로 누적
2. 상점 설계도 교환 탭 동작 확인
3. S설계도로 핵미사일 구매 → state.permanentUpgrades 저장 & 전투 적용 확인

---

## D단계: 장착 UI & 명령키 연동 (P1)

### D-01: `unit-upgrade.js` 장착 모달 실구현

```
┌──────────────────────────────────────────────────────────┐
│  홍길동  (보병 LV.2)                               [닫기] │
├──────────────────────────────────────────────────────────┤
│  장착 슬롯                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │[A] 방탄복│  │  빈슬롯  │  │  빈슬롯  │              │
│  │ hp ×1.30 │  │   [+]    │  │   [+]    │              │
│  │  [해제]  │  │          │  │          │              │
│  └──────────┘  └──────────┘  └──────────┘              │
├──────────────────────────────────────────────────────────┤
│  보유 아이템 (이 유닛 호환만 표시)                        │
│  [D 강화소총 x2]  [A 방탄복 x1]  [S 기관총 x1]          │
└──────────────────────────────────────────────────────────┘
```

- 비어있는 슬롯 클릭 → 인벤토리에서 호환 아이템 선택
- 장착된 슬롯 [해제] 클릭 → 슬롯 비우고 아이템 인벤토리로 반환
- 비호환 아이템은 회색으로 비활성화

### D-02: `hud.js` 명령키 연동

**`resolveCommandRoleMap()` 수정:**
```js
if (ctx.selectedVeteranMeta) {
  const { slot1, slot2, slot3 } = ctx.selectedVeteranMeta.loadout;
  if (!map.skill1   && slot1) map.skill1   = `item:${slot1}`;
  if (!map.skill2   && slot2) map.skill2   = `item:${slot2}`;
  if (!map.interact && slot3) map.interact = `item:${slot3}`;
}
```

**`getMappedCommandMeta()` 수정:**
```js
if (cmd?.startsWith('item:')) {
  const itemKey = cmd.slice(5);
  const def = ITEM_DEFS[itemKey];
  if (!def) return null;
  return {
    label: def.name,
    // drone_module은 iconImageUnitKey로 드론 프로필 렌더링
    icon: def.iconImageUnitKey ? null : `<i class="fa-solid ${def.icon}"></i>`,
    iconImageUnitKey: def.iconImageUnitKey ?? null,
    gradeColor: def.color,
    gradeClass: ITEM_GRADE_CLASS[def.grade],
    disabled: true,   // 클릭 불가 (패시브)
    isItem: true,
  };
}
```

**`renderMappedRoleButton()` 수정:**
- `meta.isItem === true` 이면 버튼에 `is-item-slot` + `item-grade-*` 클래스 적용
- `meta.iconImageUnitKey` 있으면 → `drawUnitCanvas(iconImageUnitKey)` 호출 (기존 드론 렌더 재사용)

**완료 조건:**
1. 베테랑 카드 클릭 → 장착 모달 열림
2. 호환 아이템만 목록 표시 (비호환 필터링)
3. 아이템 장착 → 명령키에 아이콘 + 등급 테두리 표시
4. 명령키 아이템 버튼 클릭 → 아무 동작 없음
5. drone_module → 명령키에 자폭드론 프로필 그림 표시

---

## E단계: 전투 스탯 적용 (P1)

### E-01: `game.js` - `applyItemMods()` 함수 추가

```js
function applyItemMods(unit, loadout) {
  if (!loadout) return;
  const slots = [loadout.slot1, loadout.slot2, loadout.slot3].filter(Boolean);
  for (const itemKey of slots) {
    const def = ITEM_DEFS[itemKey];
    if (!def || !def.compat.includes(unit.unitKey)) continue;
    const m = def.statMods;
    if (m.hp)               unit.hp           = Math.floor(unit.hp * m.hp);
    if (m.damage)           unit.damage        = Math.floor(unit.damage * m.damage);
    if (m.range)            unit.range         = Math.floor(unit.range * m.range);
    if (m.speed)            unit.speed         = unit.speed * m.speed;
    if (m.missileDamage)    unit.missileDamage = Math.floor((unit.missileDamage || unit.damage) * m.missileDamage);
    if (m.stealth)          unit.stealth       = true;
    if (m.splash)           unit.splash        = true;
    if (m.splashRadiusFlat) unit.splashRadius  = (unit.splashRadius || 0) + m.splashRadiusFlat;
    if (m.droneCharges)     unit.droneCharges  = Math.max(3, (unit.droneCharges || 2) + m.droneCharges);
    if (m.maxCountBonus)    unit.maxCount      = (unit.maxCount || 1) + m.maxCountBonus;
  }
}
```

`applyVeteranStats()` 내부에서 기존 hp/damage 베테랑 보너스 적용 후 `applyItemMods()` 호출.

### E-02: 스탯 중첩 규칙

- 동일 스탯 여러 아이템: **곱셈 중첩** (각각 배율 적용)
  - body_armor_a (hp ×1.30) + body_armor_s (hp ×1.45) → ×1.30 × ×1.45 = ×1.885
- stealth: 하나라도 있으면 true
- splashRadius: 합산

### E-03: 밸런스 가이드

| 등급 | 단일 스탯 최대 배율 |
|------|-----------------|
| D | ×1.15 이하 |
| A | ×1.20 ~ ×1.35 |
| S | ×1.35 ~ ×1.60 |

**완료 조건:**
1. S급 방탄복 infantry → HP ×1.45 실제 적용 확인
2. 3개 아이템 동시 장착 → 전부 중첩 적용
3. 비호환 아이템 → 스탯 반영 안됨

---

## F단계: 스타일 & 폴리시 (P2)

### F-01: `style.css` - 명령키 등급 스타일

```css
.hud-cmd-btn.is-item-slot {
  cursor: default;
  pointer-events: none;
}

/* D등급 — 일반 장비 (회색) */
.hud-cmd-btn.item-grade-d {
  border: 2px solid #9ca3af;
  opacity: 0.80;
}

/* C등급 — 전술 장비 (초록) */
.hud-cmd-btn.item-grade-c {
  border: 2px solid #4ade80;
  box-shadow: 0 0 5px #4ade8044;
}

/* A등급 — 미사일 설계도 (파란) */
.hud-cmd-btn.item-grade-a {
  border: 2px solid #60a5fa;
  box-shadow: 0 0 6px #60a5fa55;
}

/* S등급 — 기밀 설계도 (황금 + 글로우) */
.hud-cmd-btn.item-grade-s {
  border: 2px solid #fbbf24;
  box-shadow: 0 0 10px #fbbf2488;
  animation: item-s-pulse 2s ease-in-out infinite alternate;
}

@keyframes item-s-pulse {
  from { box-shadow: 0 0 6px  #fbbf2466; }
  to   { box-shadow: 0 0 16px #fbbf24cc; }
}
```

### F-02: `style.css` - 베테랑 인라인 카드

```css
.unit-btn.veteran-inline {
  width: 52px;
  border-left: 3px solid #fbbf24;
  position: relative;
}

.veteran-inline .vet-level-badge {
  position: absolute;
  top: 2px; left: 2px;
  font-size: 9px; color: #fbbf24; font-weight: bold;
}

.vet-slot-dots { display: flex; gap: 2px; }
.vet-slot-dot  { width: 5px; height: 5px; border-radius: 50%; background: #374151; }
.vet-slot-dot.filled { background: #fbbf24; }

.unit-btn.veteran-more-btn {
  width: 28px; font-size: 10px;
  color: #9ca3af; border: 1px dashed #374151;
}
```

### F-03: `style.css` - 아이템 획득 토스트

```css
.item-toast              { padding: 6px 12px; border-radius: 6px; font-size: 13px; }
.item-toast.grade-d      { background: #374151; color: #9ca3af; }
.item-toast.grade-a      { background: #1e3a5f; color: #60a5fa; }
.item-toast.grade-s      { background: #3d2b00; color: #fbbf24; font-weight: bold; }
```

**완료 조건:**
1. D/A/S 명령키 테두리 색상 명확히 구분
2. S급 글로우 2초 주기, 과하지 않게
3. 베테랑 인라인 카드와 기본 카드 명확히 구분
4. 아이템 획득 토스트 등급별 색상 표시

---

## 전체 구현 순서 & 우선순위

| 단계 | 항목 | 파일 | 우선순위 |
|------|------|------|--------|
| **A-01** | ITEM_DEFS (D/C 장비 + A/S 설계도 bp_*) | `items.js` 신규 | P0 |
| **A-02** | state.items / state.blueprints / state.permanentUpgrades | `state.js` | P0 |
| **A-03** | VETERAN_ITEM_COMPAT 제거 | `state.js` | P0 |
| **B-01** | 베테랑 탭 제거 | `hud.js` | P0 |
| **B-02** | 탭 렌더링 베테랑 인라인 삽입 | `ui.js` | P0 |
| **B-03** | 베테랑 인라인 카드 렌더링 | `ui.js` | P0 |
| **B-04** | 더보기 `+N▼` 드롭다운 | `ui.js` | P0 |
| **C-01** | 드롭풀 D/C/A/S 타입 분리 추가 | `gacha.js` | P1 |
| **C-02** | `_applyRewards()` 등급별 분기 | `gacha.js` | P1 |
| **C-03** | 상점 `설계도 교환` / `기밀 교환` 탭 추가 | `gacha.js` | P1 |
| **C-04** | permanentUpgrades 전투 적용 | `game.js` | P1 |
| **C-05** | 획득 토스트 등급별 연출 | `gacha.js` / `hud.js` | P1 |
| **D-01** | 베테랑 장착 모달 UI (D/C만 표시) | `unit-upgrade.js` | P1 |
| **D-02** | 명령키 연동 (D/C 장착 아이템 표시) | `hud.js` | P1 |
| **E-01** | `applyItemMods()` D/C 스탯 적용 | `game.js` | P1 |
| **E-02** | 스탯 중첩 밸런스 검증 | `game.js` | P1 |
| **F-01** | 명령키 D/C/A/S 등급 CSS | `style.css` | P2 |
| **F-02** | 베테랑 인라인 카드 CSS | `style.css` | P2 |
| **F-03** | 토스트 등급 CSS | `style.css` | P2 |

---

## 검토 결과 — 수정 필요 항목

---

### ❌ 문제 1: A/S 등급 ITEM_DEFS 코드 구조 불일치

**현재:** A/S 아이템이 `compat`, `statMods` 필드를 가짐 (장착 시스템 구조)
**실제 의도:** A/S는 교환 포인트 통화 → `compat`/`statMods` 불필요

**수정안:**
```js
// A/S 등급은 장착용이 아니므로 구조가 달라야 함
bp_tactical_missile: {
  id: 'bp_tactical_missile', name: '전술미사일 설계도', grade: 'A',
  color: '#60a5fa', icon: 'fa-rocket',
  type: 'blueprint',               // ← 장착이 아닌 교환용 표시
  exchangeResult: { unitKey: 'tactical_missile', amount: 1 }
},
bp_nuke: {
  id: 'bp_nuke', name: '핵미사일 기밀설계도', grade: 'S',
  color: '#fbbf24', icon: 'fa-radiation',
  type: 'blueprint',
  exchangeResult: { permanentKey: 'bp_nuke', unitKey: 'nuke', amount: 1 }
}
```

---

### ❌ 문제 2: A설계도 포인트 통합 방식이 드롭의 의미를 없앰

**현재 설계:** `bp_agm`, `bp_emp`, `bp_hellfire` 등 7종이 드롭되지만 전부 "A설계도 +1 포인트"로 변환
→ 드롭 시 구체적 이름이 의미 없어짐. `박스에서 A설계도 뽑음 → +1포인트 → 원하는 거 구매` 와 같음

**두 가지 선택지:**

| 방식 | 동작 | 장점 | 단점 |
|------|------|------|------|
| **현재 (포인트 통합)** | 뽑으면 포인트 +1, 원하는 것 구매 | 단순, 편함 | 드롭 연출 의미 없어짐 |
| **개별 설계도 저장** | 뽑으면 해당 설계도 보관함에 저장, 그 설계도로만 교환 가능 | 드롭에 의미 생김, 수집 재미 | 복잡, 원치 않는 것만 쌓일 수 있음 |

> **권장:** 포인트 통합 방식 유지하되, **드롭 연출**에서 구체적 설계도 이름 보여주고 "A설계도 +1"이라고 토스트 추가 표시

---

### ❌ 문제 3: C등급이 "소모성"인데 실제로는 영구 패시브

**현재:** C등급 이름이 "소모성 전술 도구"지만 장착하면 영구적으로 stealth, splash 부여
→ 수류탄이 "소모성"이면 전투 중 한 번 쓰고 사라져야 자연스러움

**선택지:**
- **패시브로 유지 (권장):** 이름을 "소모성"이 아닌 "전술 장비"로만 표현. 구현 복잡도 낮음
- **실제 소모로 변경:** 전투 시작 시 1회 사용 후 수량 -1. 구현 복잡도 높음

---

### ❌ 문제 4: S등급 영구 업그레이드 중복 구매 처리 미정의

**현재:** `bp_stealth`를 2번 사면? → `permanentUpgrades.bp_stealth = true` 이미 true인데 또 true
**문제:** 포인트 낭비. 이미 구매한 항목 표시가 없음

**수정안:**
```js
// 상점에서 이미 구매한 permanentUpgrade 항목은 "구매 완료" 표시 + 구매 불가 처리
const alreadyOwned = state.permanentUpgrades[item.permanentKey];
if (alreadyOwned) { showLockedBadge('이미 적용됨'); return; }
```

---

### ❌ 문제 5: flare_kit의 `missileEvade` 스탯 — 미구현 시스템

**현재:** flare_kit이 "미사일 회피율 +20%" 효과
**문제:** 현재 game.js에 미사일 회피 판정 로직이 없음. 구현하려면 projectile 히트 판정 로직 수정 필요

**선택지:**
- 삭제하고 단순 hp 버프로 변경 (권장, 단기적)
- 구현하되 E단계에 별도 항목 추가 (중기적)

---

### ❌ 문제 6: 코드 오류 — E-03 밸런스 가이드 C등급 누락

**현재:**
```
| D | ×1.15 이하 |
| A | ×1.20 ~ ×1.35 |
| S | ×1.35 ~ ×1.60 |
```
→ C등급 빠져있음

**수정:**
```
| D | ×1.10 ~ ×1.20 |
| C | ×1.15 ~ ×1.25 |
| A | ×1.20 ~ ×1.35 (설계도 교환 결과) |
| S | ×1.35 ~ ×1.60 (영구 적용) |
```

---

### ❌ 문제 7: CSS F-03 토스트에 C등급 없음

```css
/* 현재 누락 → 추가 필요 */
.item-toast.grade-c { background: #14532d; color: #4ade80; }
```

---

### ❌ 문제 8: 드롭풀 itemKey 네이밍 불일치

드롭풀에서 `agm_kit_a`, `rifle_a` 사용 → 카탈로그에서 `bp_agm`, `bp_tactical_missile` 사용
→ 동일한 키 네이밍으로 통일 필요 (카탈로그 → 드롭풀 순서로 정리)

---

### ❌ 문제 9: 구현 파일 목록에 `D/A/S` 오타

line 163: `D/A/S 등급` → `D/C/A/S 등급` 으로 수정 필요

---

## 추가 검토 — 있으면 좋을 아이디어

---

### 💡 아이디어 1: 아이템 분해 & 합성 시스템

> D등급 중복 아이템이 쌓일 때 처리 방법

```
D등급 ×3 → 분해 → C등급 ×1 교환 가능
C등급 ×2 → 분해 → A설계도 포인트 +1
```

- 인벤토리 과부하 방지
- 중복 드롭에 의미 부여
- 현질 없이도 상위 등급 획득 경로 제공 (단, 매우 오래 걸림)

---

### 💡 아이디어 2: 인벤토리 최대 보관 한도

```js
const ITEM_INVENTORY_CAP = { D: 20, C: 15 };  // D/C 등급별 최대 보관량
// 초과 시: "인벤토리 가득 참 — 분해하거나 골드로 확장하세요"
```

- 현질 포인트: 골드로 인벤토리 확장
- 플레이어에게 "정리"의 필요성 부여

---

### 💡 아이디어 3: 설계도 보관함 UI (상점 내)

A/S 설계도 포인트를 숫자로만 보여주는 게 아니라 별도 "설계도 보관함" 패널:

```
┌─────────────────────────────────┐
│  🔵 A설계도: 3개    🟡 S설계도: 1개  │
│                                 │
│  교환 가능 목록:                  │
│  [전술미사일 A×1] [EMP A×1]      │
│  [핵미사일 S×1 ★]                │
└─────────────────────────────────┘
```

---

### 💡 아이디어 4: drone_module UX 문제 재검토

현재: drone_module 장착 시 명령키에 자폭드론 프로필 표시 (`disabled:true`)
→ 플레이어 입장에서 "드론 버튼이 있는데 왜 안 눌러지지?"라고 혼란 가능

**대안:** drone_module 장착 시 명령키에 표시 대신, 베테랑 카드에 "드론 +1" 뱃지만 표시

---

### 💡 아이디어 5: 베테랑 레벨업 시 아이템 슬롯 잠금 해제 구조

현재: 레벨 2이면 바로 3슬롯 다 열림
**대안:**
```
LV.2 → 슬롯 1개
LV.3 → 슬롯 2개
LV.4 → 슬롯 3개 (모두 해제)
```
→ 레벨업 동기 부여 강화, 현질 포인트 (골드로 슬롯 조기 개방)

---

## 미결 사항

- [ ] A설계도: 포인트 통합 vs 개별 저장 최종 결정
- [ ] C등급: "소모성" 이름 변경 or 실제 소모 구현 결정
- [ ] flare_kit: 단순 hp버프로 대체 or 회피 로직 구현 결정
- [ ] drone_module: 명령키 표시 유지 vs 뱃지만 표시 결정
- [ ] 베테랑 슬롯: 처음부터 3개 vs 레벨업으로 잠금 해제 결정
- [ ] 인벤토리 최대치 설정 여부
- [ ] 아이템 분해 합성 시스템 포함 여부
- [ ] 더보기 `+N▼` 드롭다운 방향 (위/아래)
