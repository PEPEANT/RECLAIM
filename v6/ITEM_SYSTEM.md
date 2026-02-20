# 아이템 시스템 MVP — 심플 1차 구현

## 아이템 목록 (8종)

| itemKey | 이름 | 등급 | 색상 |
|---------|------|------|------|
| `rifle_d` | M249 | **D** | `#9ca3af` 회색 |
| `body_armor_d` | 방탄복 | **D** | `#9ca3af` 회색 |
| `scope_d` | 조준경 | **D** | `#9ca3af` 회색 |
| `smoke_grenade` | 연막탄 | **C** | `#4ade80` 초록 |
| `medkit_c` | 의료 키트 | **C** | `#4ade80` 초록 |
| `drone_suicide_item` | 자폭드론 | **C** | `#4ade80` 초록 |
| `drone_at_item` | AT드론 | **C** | `#4ade80` 초록 |
| `bp_missile` | 미사일 설계도 | **A** | `#60a5fa` 파란 |

---

## 등급 체계

| 등급 | 색상 | UI |
|------|------|-----|
| D | `#9ca3af` 회색 | 회색 테두리 |
| C | `#4ade80` 초록 | 초록 테두리 |
| A | `#60a5fa` 파란 | 파란 테두리 |

---

## 보관함 저장 구조

```js
// state.items — itemKey: 수량
state.items = {
  rifle_d: 2,
  smoke_grenade: 1,
  bp_missile: 1,
  // ...
};
```

- D/C/A 전부 보관함에 개수로 쌓임
- 보관함 UI에서 등급 뱃지 함께 표시

---

## 드롭률 (낮은 확률로 추가)

| 등급 | 일반보급상자 | 특수보급상자 |
|------|-----------|-----------|
| D | 12% | 15% |
| C | 6% | 12% |
| A | 2% | 5% |

- 기존 유닛/골드 드롭은 그대로 유지
- 아이템은 추가 확률로 드롭 (기존 보상에 얹히는 방식)

### 일반보급상자 아이템 풀
| itemKey | 등급 | 가중치 |
|---------|------|-------|
| `rifle_d` | D | 5 |
| `body_armor_d` | D | 5 |
| `scope_d` | D | 4 |
| `smoke_grenade` | C | 3 |
| `medkit_c` | C | 2 |
| `drone_suicide_item` | C | 1 |

### 특수보급상자 아이템 풀
| itemKey | 등급 | 가중치 |
|---------|------|-------|
| `body_armor_d` | D | 4 |
| `scope_d` | D | 3 |
| `smoke_grenade` | C | 4 |
| `medkit_c` | C | 3 |
| `drone_suicide_item` | C | 3 |
| `drone_at_item` | C | 2 |
| `bp_missile` | A | 1 |

---

## 기밀문서 — 3개 중 1개 선택

기밀문서를 열면:
1. 아이템 풀에서 랜덤으로 **3개 후보** 뽑기
2. 모달에 카드 3장 표시 (등급 + 이름 + 색상)
3. 플레이어가 원하는 1개 클릭 → 보관함에 추가
4. 나머지 2개는 소멸

### 기밀문서 아이템 풀
| itemKey | 등급 | 가중치 |
|---------|------|-------|
| `smoke_grenade` | C | 5 |
| `medkit_c` | C | 5 |
| `drone_suicide_item` | C | 5 |
| `drone_at_item` | C | 5 |
| `bp_missile` | A | 8 |
| `body_armor_d` | D | 4 |
| `scope_d` | D | 3 |

> 기밀문서는 기존 `CONFIDENTIAL_REWARD_POOL`을 대체하지 않고,
> **기존 유닛 풀(전술미사일/EMP/핵)을 그대로 두고** 3-pick-1 UI만 적용.

---

## 보관함 UI — 등급 표시

보관함 카드에 우상단 뱃지:
```
┌─────────┐
│  [D]    │  ← 등급 뱃지 (회색/초록/파란)
│ 방탄복  │
│  x2     │
└─────────┘
```

---

## 구현 파일 목록 (1차)

| 파일 | 작업 |
|------|------|
| `src/modes/city-sim/items.js` | ITEM_DEFS 8종 정의 (신규) |
| `src/modes/city-sim/state.js` | `state.items` 초기화 & 저장/로드 |
| `src/modes/city-sim/gacha.js` | 드롭풀에 아이템 추가, 기밀문서 3-pick-1 모달 |
| `src/modes/city-sim/construction.js` | 보관함 카드에 등급 뱃지 렌더링 |
| `style.css` | 등급별 뱃지 색상 CSS |

---

## 구현 순서

1. **`items.js`** — ITEM_DEFS 8종 정의
2. **`state.js`** — `state.items` 추가 (초기화, 저장, 로드)
3. **`gacha.js`** — 드롭풀 아이템 추가 + 기밀문서 3-pick-1 모달
4. **`construction.js`** — 보관함 카드 등급 뱃지
5. **`style.css`** — 등급 CSS

---

## 나중에 추가 (2차 이후)

- 아이템을 베테랑에 장착 → 스탯 버프
- 미사일 설계도 교환 탭 (상점)
- S등급 / 영구 업그레이드
- 아이템 분해/합성
