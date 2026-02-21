(function (global) {
    global.CAMPAIGN_SKIRMISH_STAGES = [
        // 1스테이지: 보관 슬롯 제한 해제(배치 수량은 보유 수량 범위)
        { id: 101, title: '도시 소탕전',   type: 'normal', difficulty: 1, x: -200, y: 0,    reward: 800,  mapId: 'skirmish_kabul',
          enemyPreset: [
              { unitId: 'infantry', count: 40 },
              { unitId: 'humvee', count: 5 },
              { unitId: 'engineer', count: 1 }
          ],
          playerPreset: [
              { unitId: 'special_ops', count: 4 },
              { unitId: 'humvee', count: 6 }
          ],
          storageSlots: 1,   // 보관함에서 추가 배치 가능 수
          civilians: 3,
          narration: '현재 무장반란세력들이 도시를 점령하고 시민들에게 큰 피해를 주고 있습니다.\n무장세력들을 제거하세요.'
        },
        // 2스테이지~: 아군 지급 없이 보관함만 사용
        { id: 102, title: '교외 매복',     type: 'normal', difficulty: 1, x: -80,  y: 60,   reward: 1200,  mapId: 'skirmish_desert',
          enemyPreset: [
              { unitId: 'infantry', count: 5 },
              { unitId: 'engineer', count: 2 },
              { unitId: 'mbt', count: 1 }
          ],
          storageSlots: 8,
          civilians: 2,
          narration: '교외 지역에 매복한 무장 세력이 보고되었습니다.\n신속히 소탕하십시오.'
        },
        { id: 103, title: '적 전초기지',   type: 'elite',  difficulty: 2, x: 40,   y: -40,  reward: 2000, mapId: 'forest',
          enemyPreset: [
              { unitId: 'infantry', count: 10 },
              { unitId: 'humvee', count: 2 },
              { unitId: 'spg', count: 1 }
          ],
          storageSlots: 12,
          civilians: 0,
          narration: '적 전초기지가 숲 지대를 점거했습니다.\n전초기지를 제거하고 교전 구역을 확보하십시오.'
        },
        { id: 104, title: '진격전',        type: 'normal', difficulty: 2, x: 140,  y: 30,   reward: 1600,  mapId: 'desert',
          playerPreset: [
              { unitId: 'mbt', count: 8 },
              { unitId: 'apache', count: 2 },
              { unitId: 'apc', count: 1, placement: 'front' }
          ],
          enemyPreset: [
              { unitId: 'infantry', count: 8 },
              { unitId: 'infantry', count: 2 },
              { unitId: 'engineer', count: 2 },
              { unitId: 'mbt', count: 15 },
              { unitId: 'apache', count: 2 },
              { unitId: 'apc', count: 1, placement: 'front' }
          ],
          storageSlots: 12,
          civilians: 0,
          narration: '사막 전선에서 돌파 명령이 내려졌습니다.\n적 저항선을 제압하고 전진하십시오.'
        },
        { id: 105, title: '요새 공략',     type: 'boss',   difficulty: 3, x: 260,  y: -20,  reward: 10000, mapId: 'fortress',
          enemyPreset: [
              { unitId: 'infantry', count: 20 },
              { unitId: 'humvee', count: 4 },
              { unitId: 'apc', count: 8 },
              { unitId: 'mbt', count: 7 },
              { unitId: 'aa_tank', count: 6 },
              { unitId: 'apache', count: 5 },
              { unitId: 'engineer', count: 6 },
              { unitId: 'spg', count: 3 },
              { unitId: 'icbm_enemy', count: 1 }
          ],
          requireEnemyWatchtowerDestroyed: true,
          storageSlots: 15,
          civilians: 0,
          narration: '적 요새 방어선이 확인되었습니다.\n적 감시탑과 방어 병력을 모두 제거해 거점을 장악하십시오.'
        }
    ];
})(window);
