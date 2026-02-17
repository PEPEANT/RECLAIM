(function (global) {
    global.CAMPAIGN_OCCUPATION_STAGES = [
        { id: 1, title: '해안 상륙', type: 'normal', difficulty: 1, x: 0, y: 180, reward: 3000, mapId: 'landing' },
        { id: 2, title: '보급로 확보', type: 'normal', difficulty: 2, x: 60, y: 120, reward: 3600, mapId: 'plain' },
        { id: 3, title: '레이더 기지', type: 'elite', difficulty: 3, x: -40, y: 80, reward: 4500, mapId: 'mountain' },
        { id: 4, title: '협곡 매복', type: 'normal', difficulty: 2, x: 20, y: 20, reward: 5200, mapId: 'plain' },
        { id: 5, title: '적 전초기지', type: 'boss', difficulty: 4, x: -50, y: -60, reward: 6500, mapId: 'village' },
        { id: 6, title: '요새 공략', type: 'normal', difficulty: 3, x: 50, y: -120, reward: 7200, mapId: 'mountain' },
        { id: 7, title: '최종 사령부', type: 'boss', difficulty: 5, x: 0, y: -180, reward: 9000, mapId: 'city' }
    ];
})(window);
