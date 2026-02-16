(function (global) {
    function open(game) {
        if (!game || typeof game.openCityActionModal !== 'function') return;
        game.openCityActionModal(
            '업그레이드',
            '건물/유닛 업그레이드 트리는 다음 단계에서 연결됩니다.'
        );
    }

    global.CitySimUnitUpgrade = {
        open
    };
})(window);
