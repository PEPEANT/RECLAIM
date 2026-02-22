(function (global) {
    function openPolicy(game) {
        if (typeof CitySimMarket !== 'undefined'
            && CitySimMarket
            && typeof CitySimMarket.openPolicy === 'function') {
            CitySimMarket.openPolicy(game);
            return;
        }
        if (!game || typeof game.openCityActionModal !== 'function') return;
        game.openCityActionModal('\uC815\uCC45', '\uC138\uAE08/\uBCF5\uC9C0/\uAD70\uC0AC \uC815\uCC45 \uC218\uCE58\uB294 \uB2E4\uC74C \uB2E8\uACC4\uC5D0\uC11C \uC5F0\uACB0\uB429\uB2C8\uB2E4.');
    }

    function getStockPrice(key, options) {
        if (typeof CitySimMarket !== 'undefined'
            && CitySimMarket
            && typeof CitySimMarket.getStockPrice === 'function') {
            return CitySimMarket.getStockPrice(key, options);
        }
        return 0;
    }

    global.CitySimStocks = {
        openPolicy,
        getStockPrice
    };
})(window);
