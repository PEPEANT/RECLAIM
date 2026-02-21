# Unit Render V2: 전차 우선 전개 계획

## 목표
- Unit Render V2를 `mbt`부터 시작한다.
- 1단계에서는 맵/배경 렌더링을 변경하지 않는다.
- 런타임에서 레거시 fallback이 가능한 안전한 교체를 진행한다.

## 핵심 결정
- 전 유닛 일괄 덮어쓰기는 하지 않는다.
- **점진 교체** 방식으로 진행한다.
1. `mbt` 전용 신규 렌더러 추가
2. 레거시 렌더러 fallback 유지
3. 검증 후 다음 유닛으로 확장

## 1단계 범위 (고정)
- 대상 유닛: `mbt`만
- 배경 크기: 변경 없음
- 카메라 시스템: 변경 없음
- 지면 정렬: 기존 `groundY` 로직 재사용
- 충돌/판정: 우선 기존값 유지 (시각 인플레이션만 적용)

## 전차 필수 구현 명세 (고정 요구사항)
1. 플레이어 조종 시 포탑 조준 각도 제한 구현
2. 포탑 조준 상한은 `-45도` 기준으로 적용
3. 좌/우 방향 모두 공격 가능하도록 포탑 발사 로직 지원
4. 신규 포구 화염/연기/탄착 폭발 이펙트 적용
5. 발사 -> 비행 -> 충돌 -> 폭발까지 누락 없이 연결

위 5개는 체크리스트가 아니라 필수 요구사항이며, 누락 시 해당 유닛은 `qa` 단계로 승격하지 않는다.

## 권장 구조
```text
src/render/unit-v2/
  index.js
  registry.js
  common/
    scale.js
    team_palette.js
  units/
    mbt/
      index.js
      render_tracks.js
      render_hull.js
      render_turret.js
      fx.js
```

## 런타임 계약
- 유닛 필드:
- `unit.renderVersion` (`'legacy' | 'v2'`, optional)
- `unit.renderScale` (number, optional)

- 기본 정책:
- 기존 유닛은 레거시 경로 유지
- `mbt`만 `renderVersion = 'v2'`로 활성화 가능

## 렌더 분기 흐름
```js
// classes.js (개념)
const canUseV2 = UnitRenderV2 && UnitRenderV2.canRender(this);
if (this.renderVersion === 'v2' && canUseV2) {
  const ok = UnitRenderV2.draw(this, ctx);
  if (ok) return;
}
// fallback
LegacyUnitRenderer.draw(this, ctx);
```

## 스케일 전략
- V2 공통 스케일 축:
- `WORLD_SCALE` (전역 월드 정책, 1단계 선택)
- `UNIT_RENDER_SCALE` (유닛 시각 인플레이션)
- `BG_SCALE` (배경 인플레이션, 1단계 미사용)

- 1단계 규칙:
- `mbt`는 `UNIT_RENDER_SCALE`만 사용해 시각 확대
- 게임플레이 판정 크기는 우선 유지

## 최소 연동 지점
- `classes.js`
- 기존 하드코딩 MBT 분기 전에 V2 디스패치 훅 추가

- `game.js`
- 필요 시 기능 플래그 기반으로 스폰된 `mbt`에 `renderVersion='v2'` 부여

## 기능 플래그
- 즉시 ON/OFF 가능한 게이트 1개 사용:
- `window.RENDER_V2_MBT = true | false`

예시:
```js
if (unit.stats.id === 'mbt' && window.RENDER_V2_MBT === true) {
  unit.renderVersion = 'v2';
}
```

## 검증 체크리스트
1. 모든 맵에서 MBT 렌더 정상 출력
2. 접지 안정성 유지 (뜨거나 묻히지 않음)
3. 포탑 회전/반동 애니메이션 정상
4. 포구와 발사체 시작점 정렬 정상
5. 좌/우 조준 발사 모두 정상 동작
6. 탄착 시 신규 폭발 이펙트가 정상 재생
7. V2 비활성화 시 콘솔 에러 없음
8. 플래그 OFF 시 레거시 MBT 즉시 복귀

## 롤백 계획
- `window.RENDER_V2_MBT = false` 적용
- V2 파일은 유지, 런타임만 레거시 경로 사용
- 데이터 마이그레이션 불필요

## 다음 단계 (MBT 안정화 이후)
1. `spg`
2. `apc`
3. `aa_tank`
4. 보병/항공 유닛 확장

## 메모
- 월드 전체 스케일 인플레이션은 MBT V2 안정화 후 별도 단계로 진행한다.
- 렌더러 교체와 배경/카메라 스케일 개편을 한 릴리즈에서 같이 진행하지 않는다.
