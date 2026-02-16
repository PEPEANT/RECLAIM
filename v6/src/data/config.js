// src/data/config.js - 게임 설정 및 유닛/건물 데이터
// [분리] data.js에서 추출 가능 (현재는 data.js 참조)

/*
 * 이 파일은 향후 data.js에서 CONFIG를 완전히 분리할 때 사용됩니다.
 * 현재는 기존 data.js를 그대로 사용하며,
 * 이 파일은 구조 분리 완료 후 CONFIG를 담을 예정입니다.
 *
 * 분리 시 주의사항:
 * - index.html에서 이 파일을 data.js보다 먼저 로드해야 함
 * - window.CONFIG로 전역 등록 필요
 */

// CONFIG 구조 예시:
// const CONFIG = {
//     mapWidth: 6000,
//     groundHeight: 250,
//     startSupply: 1500,
//     supplyRate: 2.0,
//     maxSupply: 2500,
//
//     buildings: { ... },
//     constructable: { ... },
//     units: { ... }
// };
//
// window.CONFIG = CONFIG;
