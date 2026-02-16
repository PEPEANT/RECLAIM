# City Sim Rendering Guidelines

## 목적
- 시티맵 오브젝트 렌더링을 게임 로직과 분리해 유지보수 비용을 낮춘다.
- 모바일/PC 모두에서 렌더 성능을 안정적으로 유지한다.

## 핵심 원칙
1. 렌더러 분리
- 건물/오브젝트 그림 로직은 `src/modes/city-sim/building.js`에만 둔다.
- `construction.js`는 배치/판정/상태 갱신만 담당한다.

2. 캐시 우선
- 렌더러는 타일 키 + 사이즈 기준으로 스프라이트(Data URL)를 캐시한다.
- 같은 타일을 반복 그릴 때 캔버스 재렌더를 피한다.

3. 단일 책임
- 상태 저장: `state.js`
- 저장/로드: `save.js`
- 배치/구매/충돌 판정: `construction.js`
- 비주얼 자산 생성: `building.js`

## 배치 UX 규칙
- 도로/나무는 즉시 배치(빠른 작업 우선).
- 다른 오브젝트와 겹치면 타일 프리뷰를 빨간색으로 표시한다.
- 겹침 사유(빈 공간 아님/자금 부족/한도 초과)를 힌트로 즉시 노출한다.

## 확장 규칙
- 신규 건물 추가 시:
  - `construction.js`의 `BUILDING_DEFS`, `TILE_META`에 키를 추가
  - `building.js`의 DRAWERS에 같은 키의 draw 함수를 추가
- draw 함수는 `size` 기준 상대 좌표로 작성해 해상도 의존성을 없앤다.

