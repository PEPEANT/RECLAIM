(function (global) {
    function openPolicy(game) {
        if (!game || typeof game.openCityActionModal !== 'function') return;
        game.openCityActionModal(
            '정책',
            '세금/복지/군사 정책 수치는 다음 단계에서 연결됩니다.'
        );
    }

    global.CitySimStocks = {
        openPolicy
    };
})(window);
