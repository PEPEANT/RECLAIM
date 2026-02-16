(function (global) {
    const state = {
        connected: false
    };

    function connect() {
        state.connected = true;
        return state.connected;
    }

    function disconnect() {
        state.connected = false;
        return state.connected;
    }

    function isConnected() {
        return state.connected;
    }

    global.CitySimNetwork = {
        connect,
        disconnect,
        isConnected
    };
})(window);

