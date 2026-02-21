# 보병 계열 V2 디자인 통합 구현 계획 (2026-02-21)

## 1. 목표
- 사용자 제공 최종 보병 디자인(서기/앉기/엎드리기, 병과별 장비)을 게임 런타임 렌더 구조에 맞게 반영한다.
- `sniper`, `special_ops`를 아군 기준 초록색 계열로 통일한다.
- 기존 레거시 렌더에서 V2 렌더로 안전 전환하되, 문제가 있으면 즉시 롤백 가능하게 구성한다.

## 2. 현재 상태 요약
- `infantry`만 V2 렌더가 실사용 중이며, 자세 상태머신은 이미 고도화됨.
- `sniper`, `special_ops` V2 파일은 존재하지만 대부분 `TODO` 상태.
- `index.html`의 V2 스크립트 로더는 현재 `mbt/spg/humvee/infantry`만 로드.
- `classes.js`의 V2 draw 라우팅도 `infantry`까지만 허용.
- 레거시 `sniper/special_ops`는 아군 색상이 파란 계열(`teamColor = #3b82f6`)로 남아 있음.

## 3. 설계 원칙
- 디자인은 사용자 제공 샘플의 실루엣/장비 요소를 기준으로 한다.
- 색상은 팀 기준 팔레트로 분리한다.
- 아군(`player`)은 초록 계열, 적군(`enemy`)은 기존 적색 계열 유지.
- 자세는 HP 단일 조건이 아니라 상황 기반 상태머신을 사용한다.
- 대규모 전투에서 성능 저하가 없도록 캔버스 draw call/상태 접근을 최소화한다.

## 4. 구현 범위
### 포함
- `sniper` V2 렌더 전체 구현
- `special_ops` V2 렌더 전체 구현
- 아군 초록 팔레트 통일
- `index.html` 로더 확장
- `classes.js` V2 draw 라우팅 확장
- 시각 QA 및 대량 스폰 성능 확인

### 제외
- 무기 데미지, 사거리, AI 타겟팅 규칙 변경
- 히트박스/충돌 판정 리워크
- 맵/배경 리소스 변경

## 5. 작업 단계
### Phase A. 명세 고정
1. 병과 ID 정합성 확정: `special_ops`를 기준 ID로 사용.
2. 팔레트 확정:
- 아군 기본: `uniform #556B2F`, `vest #3e4e26`, `helmet #3A4A20`
- 특수부대(아군 변형): 어두운 초록 계열(기존 블랙 톤 일부 유지)
- 저격수(아군 변형): 황갈색이 아닌 초록 위장 톤으로 재정의
3. 사용자 확정안(2026-02-21):
- 저격수: `완전 초록 위장`
- 특수부대: `순수 초록 테마 + 매우 진한 초록 + 무장 강화`

### Phase B. 렌더 구현
1. `src/render/unit-v2/units/sniper/state.js`
- `infantry` 상태머신 구조를 복제/축약해 `standing/crouching/prone` 지원
2. `src/render/unit-v2/units/sniper/render_body.js`
- 저격수 전용 머리/장비/자세 실루엣 구현
3. `src/render/unit-v2/units/sniper/weapons.js`
- 저격총(긴 총열/스코프/양각대) + 자세별 총구 좌표
4. `src/render/unit-v2/units/sniper/fx.js`
- 발사 화염/잔광 최소형
5. `src/render/unit-v2/units/sniper/index.js`
- 의존 모듈 연결 및 registry 등록

6. `src/render/unit-v2/units/special_ops/state.js`
- `infantry` 상태머신 기반으로 특수부대 전투 자세 구현
7. `src/render/unit-v2/units/special_ops/render_body.js`
- NVG/소형 백팩/전술 실루엣 구현
8. `src/render/unit-v2/units/special_ops/weapons.js`
- 소음기 장착 소총 + 자세별 총구 좌표
9. `src/render/unit-v2/units/special_ops/fx.js`
- 소염기형 작은 muzzle flash
10. `src/render/unit-v2/units/special_ops/index.js`
- 의존 모듈 연결 및 registry 등록

### Phase C. 런타임 연결
1. `index.html`
- `sniper/special_ops` V2 스크립트 로드 추가(상태/무기/바디/파츠/fx/index)
2. `classes.js`
- V2 draw 조건에 `sniper`, `special_ops` 추가
- 필요 시 레거시 fallback 유지

### Phase D. 검증
1. 문법/파싱 확인
2. 스모크 테스트
3. 인게임 시나리오 QA
- 정지/이동/사격 중 자세 전환
- 저체력/피격/아군 중첩 상황
- 아군/적군 색상 구분
- HP바/선택 테두리/발위치 정렬
4. 대량 스폰 프레임 드랍 체크

## 6. 리스크와 대응
- 리스크: V2 로드 순서 누락 시 렌더 미출력
- 대응: `index.html` 로더 순서 고정 + fallback 유지

- 리스크: 자세 전환 과도(떨림)
- 대응: 상태 전환 지연 프레임(히스테리시스) 적용

- 리스크: 아군 초록톤 가독성 저하
- 대응: 배경 대비 기준으로 명도 2차 보정

## 7. 완료 기준(Definition of Done)
- `sniper/special_ops`가 V2로 정상 렌더되고 레거시 대비 시각 품질 향상 확인
- 아군 색상은 초록 테마로 일관 적용
- 서기/앉기/엎드리기 전환이 전투 상황에서 자연스럽게 동작
- 파싱/스모크 테스트 통과
- 문제 시 V2 비활성화만으로 즉시 레거시 복귀 가능
