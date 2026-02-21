(function () {
    if (typeof window.game === 'undefined') return;

    const orig = {
        showLobby: window.game && window.game.showLobby,
        prepareBootGate: window.game && window.game.prepareBootGate,
        runBoot: window.game && window.game.runBoot,
        warmupAudioByGesture: window.game && window.game.warmupAudioByGesture,
        ensureCinematicApi: window.game && window.game.ensureCinematicApi,
    };

    let bootStarted = false;
    let cinematicLoaderStarted = false;
    let gatePrepared = false;
    let gateConsumed = false;

    Object.assign(window.game, {
        showLobby: function () {
            if (typeof orig.showLobby === 'function') {
                return orig.showLobby.apply(this, arguments);
            }
            const lobbyScreen = document.getElementById('lobby-screen');
            if (lobbyScreen) lobbyScreen.classList.remove('hidden');

            if (typeof LobbyBackground !== 'undefined') {
                LobbyBackground.init();
                LobbyBackground.start();
            }

            if (typeof AudioSystem !== 'undefined') {
                AudioSystem.init();
                AudioSystem.playMP3(0);
            }
        },

        ensureCinematicApi: function (done) {
            if (typeof orig.ensureCinematicApi === 'function') {
                return orig.ensureCinematicApi.apply(this, arguments);
            }
            if (typeof Cinematic !== 'undefined' && typeof Cinematic.play === 'function') {
                done(true);
                return;
            }
            if (cinematicLoaderStarted) {
                setTimeout(() => {
                    done(typeof Cinematic !== 'undefined' && typeof Cinematic.play === 'function');
                }, 300);
                return;
            }
            cinematicLoaderStarted = true;

            const candidates = [
                'src/ui/cinematic.js?v=20260221c4',
                'src/ui/cinematic.js'
            ];

            const loadNext = (idx) => {
                if (idx >= candidates.length) {
                    done(typeof Cinematic !== 'undefined' && typeof Cinematic.play === 'function');
                    return;
                }

                const s = document.createElement('script');
                s.src = candidates[idx];
                s.async = false;
                s.onload = () => {
                    if (typeof Cinematic !== 'undefined' && typeof Cinematic.play === 'function') {
                        done(true);
                    } else {
                        loadNext(idx + 1);
                    }
                };
                s.onerror = () => loadNext(idx + 1);
                document.head.appendChild(s);
            };

            loadNext(0);
        },

        runBoot: function () {
            if (typeof orig.runBoot === 'function') {
                return orig.runBoot.apply(this, arguments);
            }
            if (bootStarted) return;
            bootStarted = true;
            console.log('[Boot] cinematic bootstrap start');

            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) loadingScreen.classList.add('hidden');

            const lobbyScreen = document.getElementById('lobby-screen');
            if (lobbyScreen) lobbyScreen.classList.add('hidden');

            setTimeout(() => {
                this.ensureCinematicApi((ok) => {
                    if (!ok) {
                        console.error('[Boot] Cinematic API missing after script load attempts');
                        console.warn('[Boot] Cinematic API missing, fallback lobby');
                        this.showLobby();
                        return;
                    }

                    try {
                        sessionStorage.removeItem('reclaim_cinematic_watched');
                    } catch (err) {
                        console.warn('[Boot] sessionStorage remove failed:', err);
                    }

                    if (typeof Cinematic.reset === 'function') {
                        try {
                            Cinematic.reset();
                        } catch (err) {
                            console.warn('[Boot] Cinematic.reset failed:', err);
                        }
                    }

                    try {
                        console.log('[Boot] Cinematic.play(force=true) invoke');
                        Cinematic.play(() => {
                            console.log('[Cinematic] Playback complete');
                            this.showLobby();
                        }, { force: true });
                    } catch (err) {
                        console.error('[Cinematic] Play failed:', err);
                        this.showLobby();
                    }
                });
            }, 120);
        },

        warmupAudioByGesture: async function () {
            if (typeof orig.warmupAudioByGesture === 'function') {
                return orig.warmupAudioByGesture.apply(this, arguments);
            }
            if (typeof AudioSystem === 'undefined') return;
            if (typeof AudioSystem.init === 'function') AudioSystem.init();
            if (AudioSystem.ctx && AudioSystem.ctx.state === 'suspended' && typeof AudioSystem.ctx.resume === 'function') {
                try {
                    await AudioSystem.ctx.resume();
                } catch (err) {
                    console.warn('[Boot] Audio context resume failed:', err);
                }
            }
        },

        prepareBootGate: function () {
            if (typeof orig.prepareBootGate === 'function') {
                return orig.prepareBootGate.apply(this, arguments);
            }
            if (gatePrepared) return;
            gatePrepared = true;

            const gate = document.getElementById('boot-gate');
            const playBtn = document.getElementById('boot-play-btn');
            if (!gate || !playBtn) {
                this.runBoot();
                return;
            }

            const startBoot = async () => {
                if (gateConsumed) return;
                gateConsumed = true;
                playBtn.disabled = true;

                await this.warmupAudioByGesture();

                gate.classList.add('hidden');
                this.runBoot();
            };

            playBtn.addEventListener('click', () => {
                startBoot();
            }, { once: true });

            gate.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    startBoot();
                }
            });
        }
    });
})();
