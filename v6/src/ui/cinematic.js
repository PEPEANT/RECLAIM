// ============================================
// RECLAIM Cinematic Player
// 泥?吏꾩엯 ????踰덈쭔 ?ъ깮?섎뒗 ?쒕꽕留덊떛
// ============================================

(function(global) {
    'use strict';

    const CINEMATIC_KEY = 'reclaim_cinematic_watched';
    const INTRO_LOGO_BGM_PATH = '';
    const MAIN_CINEMATIC_BGM_PATH = '';
    const CINEMATIC_ENGINE_PATH = 'bgm/ost/806143.mp3';
    const INTRO_LOGO_VIDEO_PATH = 'assets/tutorial/videos/grok_war.mp4';
    const CINEMATIC_VIDEO_PATH = 'assets/tutorial/videos/grok_war.mp4';
    const INTRO_LOGO_MAX_SECONDS = 3;

    let canvas, ctx;
    let width, height;
    let animationId = null;
    let introLogoAudio = null;
    let mainCinematicAudio = null;
    let cinematicStopped = false;
    let cinematicSessionToken = 0;
    let videoFallbackTimer = null;
    let videoStallTimer = null;
    let skipEnableTimer = null;
    let timer = 0;
    let phase = 'intro'; // intro -> approach -> impact -> wait -> collapsing -> parade -> end
    let impactStartedAt = null;
    let collapseStartedAt = null;
    let paradeStartedAt = null;
    let endStartedAt = null;

    // ?섏씠吏 濡쒕뱶 ??sessionStorage 珥덇린??(??긽 ?쒕꽕留덊떛 ?ъ깮)
    function getSessionStorage() {
        try {
            return global.sessionStorage || null;
        } catch (err) {
            return null;
        }
    }
    function clearWatchedFlag() {
        const ss = getSessionStorage();
        if (!ss) return;
        try {
            ss.removeItem(CINEMATIC_KEY);
        } catch (err) {
            // ignore storage access failures
        }
    }
    clearWatchedFlag();

    // 寃뚯엫 ?ㅻ툕?앺듃
    let drone = { x: -100, y: 0, size: 20 };
    let building = {};
    let fragments = [];
    let particles = [];
    let clouds = [];
    let cityBuildings = []; // 諛곌꼍 ?꾩떆 嫄대Ъ
    let soldiers = []; // ?됱쭊?섎뒗 蹂묒궗??
    let impactSfxAudio = null;
    let engineSfxAudio = null;
    let engineSfxStarted = false;
    let impactSfxPlayed = false;
    let shakeDuration = 0;
    let flashOpacity = 0;

    const CONFIG = {
        droneSpeed: 7.2, // faster intro
        gravity: 0.08,
        waitFrames: 55,
        collapseMinFrames: 85,
        collapseMaxFrames: 260,
        collapseSettledRatio: 0.8,
        collapseStillSpeed: 0.22,
        paradeAdvanceFrames: 260,
        paradeStopFrames: 88,
        paradeDurationFrames: 520,
        endFadeFrames: 45,
        endHoldFrames: 90,
        showEndingLogo: false,
        videoFallbackMs: 7000,
        videoStallTimeoutMs: 4500,
        skyColor: '#87CEEB', // 諛앹? ?섎뒛 (??
        wallColor: '#C0C0C0',
        windowColor: '#4682B4'
    };
    const AIRLINER_NOSE_OFFSET = 95;

    // ?먮쭑 ?곗씠??
    const SUBTITLES = [
        { start: 0, end: 120, text: '최악의 참사를 불러온 비행기 테러 사건이 발생 이후.' },
        { start: 130, end: 240, text: '원블루국에서 발생한 사건은 큰 충격을 안기며' },
        { start: 250, end: 380, text: '두 국가 간의 갈등 속에서 결국 그 배후가 밝혀진다.' },
        { start: 400, end: 520, text: '그 배후에는 붉은 네모 공화국이 있었다' },
        { start: 540, end: 700, text: '원블루공화국은 즉시 특수작전을 개시한다. 작전명은…' }
    ];

    // ============================================
    // Public API
    // ============================================

    function hasWatched() {
        const ss = getSessionStorage();
        if (!ss) return false;
        try {
            return ss.getItem(CINEMATIC_KEY) === 'true';
        } catch (err) {
            return false;
        }
    }

    function markAsWatched() {
        const ss = getSessionStorage();
        if (!ss) return;
        try {
            ss.setItem(CINEMATIC_KEY, 'true');
        } catch (err) {
            // ignore
        }
    }

    function shouldPlay() {
        return !hasWatched();
    }

    function reset() {
        clearWatchedFlag();
    }

    function clearVideoPreviewTimers() {
        if (videoFallbackTimer) {
            clearTimeout(videoFallbackTimer);
            videoFallbackTimer = null;
        }
        if (videoStallTimer) {
            clearInterval(videoStallTimer);
            videoStallTimer = null;
        }
    }

    function clearSkipEnableTimer() {
        if (skipEnableTimer) {
            clearTimeout(skipEnableTimer);
            skipEnableTimer = null;
        }
    }

    function stopIntroLogoBgm() {
        if (!introLogoAudio) return;
        try {
            introLogoAudio.pause();
            introLogoAudio.currentTime = 0;
        } catch (_) { }
        introLogoAudio = null;
    }

    function startIntroLogoBgm() {
        if (!INTRO_LOGO_BGM_PATH) return;
        stopIntroLogoBgm();
        try {
            introLogoAudio = new Audio(INTRO_LOGO_BGM_PATH);
            introLogoAudio.loop = true;
            introLogoAudio.volume = 0.55;
            introLogoAudio.play().catch(err => {
                console.warn('[Cinematic] Intro logo audio autoplay blocked:', err);
            });
        } catch (err) {
            console.warn('[Cinematic] Intro logo audio init failed:', err);
        }
    }

    function stopMainCinematicBgm() {
        if (!mainCinematicAudio) return;
        try {
            mainCinematicAudio.pause();
            mainCinematicAudio.currentTime = 0;
        } catch (_) { }
        mainCinematicAudio = null;
    }

    function startMainCinematicBgm() {
        if (!MAIN_CINEMATIC_BGM_PATH) return;
        try {
            if (!mainCinematicAudio) {
                mainCinematicAudio = new Audio(MAIN_CINEMATIC_BGM_PATH);
                mainCinematicAudio.preload = 'auto';
            } else {
                try {
                    mainCinematicAudio.pause();
                    mainCinematicAudio.currentTime = 0;
                } catch (_) { }
            }
            mainCinematicAudio.loop = false;
            mainCinematicAudio.volume = 0.72;
            try {
                mainCinematicAudio.currentTime = 0;
            } catch (_) { }
            mainCinematicAudio.play().catch(err => {
                console.warn('[Cinematic] Main cinematic audio autoplay blocked:', err);
            });
        } catch (err) {
            console.warn('[Cinematic] Main cinematic audio init failed:', err);
        }
    }

    function setVideoPresentation(videoEl, stage = 'logo') {
        if (!videoEl) return;
        const isMain = stage === 'main';
        videoEl.classList.toggle('cinematic-video-logo', !isMain);
        videoEl.classList.toggle('cinematic-video-main', isMain);
        videoEl.defaultMuted = false;
        videoEl.removeAttribute('muted');
        videoEl.muted = false;
        videoEl.volume = 1;
    }

    function applyVideoSource(videoEl, srcPath) {
        if (!videoEl) return;
        const targetPath = String(srcPath || '').trim();
        if (!targetPath) return;
        try {
            const sourceEl = videoEl.querySelector('source');
            if (sourceEl && sourceEl.getAttribute('src') !== targetPath) {
                sourceEl.setAttribute('src', targetPath);
            }
            if (videoEl.getAttribute('src') !== targetPath) {
                videoEl.setAttribute('src', targetPath);
            }
            videoEl.load();
        } catch (err) {
            console.warn('[Cinematic] video source apply failed:', err);
        }
    }

    function play(onComplete, options = null) {
        const forcePlay = !!(options && options.force === true);
        console.log('[Cinematic] play() called', { forcePlay, shouldPlay: shouldPlay() });
        if (!forcePlay && !shouldPlay()) {
            console.log('[Cinematic] skipped (already watched)');
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        const modal = document.getElementById('cinematic-modal');
        if (!modal) {
            console.warn('[Cinematic] Modal not found');
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        // 紐⑤떖 ?쒖떆
        modal.classList.remove('hidden');

        const sessionToken = ++cinematicSessionToken;
        cinematicStopped = false;
        clearVideoPreviewTimers();
        clearSkipEnableTimer();
        stopIntroLogoBgm();
        stopMainCinematicBgm();

        // 鍮꾨뵒???붿냼 媛?몄삤湲?
        const video = document.getElementById('cinematic-video');
        canvas = document.getElementById('cinematic-canvas');

        if (!canvas) {
            console.error('[Cinematic] Canvas not found');
            stop('canvas_not_found');
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        // ?ㅽ궢 踰꾪듉 ?대깽??(鍮꾨뵒?ㅼ? 罹붾쾭??紐⑤몢 ?ㅽ궢)
        const skipBtn = document.getElementById('cinematic-skip-btn');
        if (skipBtn) {
            skipBtn.disabled = true;
            skipBtn.style.pointerEvents = 'none';
            skipEnableTimer = setTimeout(() => {
                skipEnableTimer = null;
                if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
                skipBtn.disabled = false;
                skipBtn.style.pointerEvents = 'auto';
            }, 900);
            skipBtn.onclick = () => {
                if (sessionToken !== cinematicSessionToken) return;
                if (video) {
                    video.pause();
                    video.currentTime = 0;
                }
                cinematicStopped = true;
                stopIntroLogoBgm();
                stopMainCinematicBgm();
                stop('skip_button');
                markAsWatched();
                if (typeof onComplete === 'function') onComplete();
            };
        }

        // 鍮꾨뵒?ㅺ? ?덉쑝硫?癒쇱? ?ъ깮
        if (video) {
            let canvasStarted = false;
            let mainVideoStarted = false;
            let currentVideoStage = 'logo';
            let playbackCompleted = false;

            const completePlaybackOnce = (reason = 'video_complete') => {
                if (playbackCompleted) return;
                if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
                playbackCompleted = true;
                console.log('[Cinematic] complete playback:', reason);
                stop(reason);
                markAsWatched();
                if (typeof onComplete === 'function') onComplete();
            };

            const startCanvasOnce = (reason = 'unknown') => {
                if (canvasStarted) return;
                if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
                canvasStarted = true;
                // 구버전 캔버스 시네마틱으로 넘어가지 않고 즉시 종료한다.
                completePlaybackOnce(`fallback_${reason}`);
            };

            const armVideoWatchers = (onFail) => {
                clearVideoPreviewTimers();
                videoFallbackTimer = setTimeout(() => {
                    videoFallbackTimer = null;
                    if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
                    if (video.paused || video.currentTime <= 0.05) {
                        onFail('video_fallback_timeout');
                    }
                }, CONFIG.videoFallbackMs);

                let lastVideoTime = Number(video.currentTime) || 0;
                let stallWindowStartedAt = Date.now();
                videoStallTimer = setInterval(() => {
                    if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
                    if (video.ended) return;

                    const currentVideoTime = Number(video.currentTime) || 0;

                    if (currentVideoTime > lastVideoTime + 0.03) {
                        lastVideoTime = currentVideoTime;
                        stallWindowStartedAt = Date.now();
                        return;
                    }
                    if (video.paused) return;
                    if ((Date.now() - stallWindowStartedAt) >= CONFIG.videoStallTimeoutMs) {
                        onFail('video_stalled_timeout');
                    }
                }, 350);
            };

            const startMainVideoOnce = (reason = 'logo_end') => {
                if (mainVideoStarted) return;
                if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
                mainVideoStarted = true;
                currentVideoStage = 'main';
                console.log('[Cinematic] switch to main video:', reason);

                stopIntroLogoBgm();

                setVideoPresentation(video, 'main');
                applyVideoSource(video, CINEMATIC_VIDEO_PATH);
                video.currentTime = 0;
                startMainCinematicBgm();

                armVideoWatchers((failReason) => {
                    startCanvasOnce(`main_${failReason}`);
                });

                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(err => {
                        if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
                        console.warn('[Cinematic] Main video autoplay blocked:', err);
                        startCanvasOnce('main_video_play_rejected');
                    });
                }

            };

            const handleVideoFailure = (reason) => {
                if (currentVideoStage === 'logo' && !mainVideoStarted) {
                    startMainVideoOnce(`logo_${reason}`);
                    return;
                }
                startCanvasOnce(reason);
            };

            video.classList.remove('hidden');
            canvas.classList.add('hidden');

            // Boot trailer: direct-play grok_war.mp4 (single-stage, embedded audio)
            currentVideoStage = 'main';
            mainVideoStarted = true;
            stopIntroLogoBgm();
            setVideoPresentation(video, 'main');
            applyVideoSource(video, CINEMATIC_VIDEO_PATH);
            video.currentTime = 0;
            video.preload = 'metadata';

            video.onended = () => {
                if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
                completePlaybackOnce('main_video_ended');
            };
            video.ontimeupdate = null;
            video.onerror = () => handleVideoFailure('main_video_error');

            armVideoWatchers((failReason) => {
                handleVideoFailure(`main_${failReason}`);
            });

            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
                    console.warn('[Cinematic] Main video autoplay blocked:', err);
                    startCanvasOnce('main_video_play_rejected');
                });
            }
        } else {
            if (sessionToken !== cinematicSessionToken || cinematicStopped) return;
            // 비디오가 없으면 구버전 캔버스 재생 없이 바로 로비로 종료한다.
            stop('video_missing');
            markAsWatched();
            if (typeof onComplete === 'function') onComplete();
        }
    }

    function startCanvasAnimation(onComplete) {
        if (cinematicStopped) return;
        ctx = canvas.getContext('2d');
        console.log('[Cinematic] canvas animation start');
        resize();
        initScene();
        animate(onComplete);
    }

    function stop(reason = 'unknown') {
        console.log('[Cinematic] stop()', reason);
        cinematicSessionToken += 1;
        cinematicStopped = true;
        clearVideoPreviewTimers();
        clearSkipEnableTimer();
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        // 鍮꾨뵒???뺣━
        const video = document.getElementById('cinematic-video');
        if (video) {
            video.pause();
            video.currentTime = 0;
            video.onended = null;
            video.onerror = null;
            video.ontimeupdate = null;
        }
        const skipBtn = document.getElementById('cinematic-skip-btn');
        if (skipBtn) {
            skipBtn.onclick = null;
            skipBtn.disabled = false;
            skipBtn.style.pointerEvents = 'auto';
        }

        // ?ㅻ뵒???뺣━
        stopIntroLogoBgm();
        stopMainCinematicBgm();
        if (impactSfxAudio) {
            impactSfxAudio.pause();
            impactSfxAudio.currentTime = 0;
            impactSfxAudio = null;
        }
        if (engineSfxAudio) {
            engineSfxAudio.pause();
            engineSfxAudio.currentTime = 0;
            engineSfxAudio = null;
        }
        engineSfxStarted = false;
        impactSfxPlayed = false;

        const modal = document.getElementById('cinematic-modal');
        if (modal) modal.classList.add('hidden');
    }

    // ============================================
    // Scene Setup
    // ============================================

    function resize() {
        if (!canvas) return;
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    function initScene() {
        timer = 0;
        phase = 'intro';
        impactStartedAt = null;
        collapseStartedAt = null;
        paradeStartedAt = null;
        endStartedAt = null;
        shakeDuration = 0;
        flashOpacity = 0;
        fragments = [];
        particles = [];
        impactSfxPlayed = false;
        engineSfxStarted = false;
        if (impactSfxAudio) {
            try {
                impactSfxAudio.pause();
                impactSfxAudio.currentTime = 0;
            } catch (_) { }
            impactSfxAudio = null;
        }
        if (engineSfxAudio) {
            try {
                engineSfxAudio.pause();
                engineSfxAudio.currentTime = 0;
            } catch (_) { }
            engineSfxAudio = null;
        }

        // 諛곌꼍 ?꾩떆 嫄대Ъ ?앹꽦 (???됱긽)
        cityBuildings = [];
        const skylinePalette = [
            { wall: '#8a98a4', shade: '#65727d' }, // far
            { wall: '#7b8894', shade: '#545f6a' }, // mid
            { wall: '#6f7c88', shade: '#4a5561' }  // near
        ];
        let cursorX = -260;
        while (cursorX < width + 260) {
            const roll = Math.random();
            const depth = roll < 0.34 ? 0 : (roll < 0.74 ? 1 : 2);
            const bw = depth === 0 ? random(44, 78) : (depth === 1 ? random(56, 98) : random(72, 126));
            const bhRatioMin = depth === 0 ? 0.12 : (depth === 1 ? 0.18 : 0.24);
            const bhRatioMax = depth === 0 ? 0.22 : (depth === 1 ? 0.32 : 0.42);
            const bh = height * random(bhRatioMin, bhRatioMax);
            const palette = skylinePalette[depth];
            cityBuildings.push({
                x: cursorX + random(-6, 10),
                w: bw,
                h: bh,
                depth,
                wallColor: palette.wall,
                shadeColor: palette.shade,
                baseY: height - 40 - (depth === 0 ? 22 : (depth === 1 ? 14 : 8)),
                windowSeed: Math.floor(Math.random() * 10000)
            });
            cursorX += bw + random(10, 22);
        }
        cityBuildings.sort((a, b) => a.depth - b.depth);

        // 蹂묒궗 ?됱쭊 珥덇린??
        soldiers = [];
        const formationRows = 6, formationCols = 6, formationBlocks = 6;
        const centerX = width * 0.5;
        const centerY = height * 0.42;
        for (let b = 0; b < formationBlocks; b++) {
            const blockCol = b % 3;
            const blockRow = Math.floor(b / 3);
            const targetBaseX = centerX - 235 + blockCol * 170;
            const targetBaseY = centerY + blockRow * 122;
            const startBaseY = height + 120 + blockRow * 126;
            for (let r = 0; r < formationRows; r++) {
                for (let c = 0; c < formationCols; c++) {
                    const targetX = targetBaseX + c * 26;
                    const targetY = targetBaseY + r * 24;
                    soldiers.push({
                        startX: targetX + random(-8, 8),
                        targetX,
                        startY: startBaseY + r * 26 + random(0, 20),
                        targetY,
                        delay: b * 14 + r * 4 + c,
                        phase: Math.random() * Math.PI * 2
                    });
                }
            }
        }

        // 嫄대Ъ ?앹꽦
        const w = Math.max(86, Math.min(108, Math.round(width * 0.075)));
        const h = Math.max(320, Math.round(height * 0.66));
        const x = width - w - Math.max(120, Math.round(width * 0.11));
        const y = height - h;

        building = {
            x, y, w, h,
            windows: [],
            damageY: y + h * 0.4,
            rebar: []
        };

        // 李쎈Ц
        const windowRows = 16;
        const windowCols = 4;
        const windowInsetX = 8;
        const windowInsetY = 14;
        const windowGapX = 6;
        const windowGapY = 8;
        const maxWindowFieldH = Math.floor(h * 0.62);
        const winW = Math.max(5, Math.floor((w - (windowInsetX * 2) - (windowGapX * (windowCols - 1))) / windowCols));
        const winH = Math.max(7, Math.floor((maxWindowFieldH - (windowInsetY * 2) - (windowGapY * (windowRows - 1))) / windowRows));

        for (let r = 0; r < windowRows; r++) {
            const ry = windowInsetY + r * (winH + windowGapY);
            if ((ry + winH) > (h - 10)) break;
            for (let c = 0; c < windowCols; c++) {
                const rx = windowInsetX + c * (winW + windowGapX);
                if ((rx + winW) > (w - 6)) continue;
                building.windows.push({
                    rx,
                    ry,
                    w: winW, h: winH,
                    color: CONFIG.windowColor
                });
            }
        }

        // 泥좉렐
        const impactY = building.damageY;
        for (let i = 0; i < 8; i++) {
            building.rebar.push({
                x: x + 10 + Math.random() * (w - 20),
                y: impactY,
                h: -10 - Math.random() * 20,
                angle: (Math.random() - 0.5) * 0.5
            });
        }

        // ?쒕줎 ?꾩튂
        drone.x = -50;
        drone.y = building.damageY;
    }

    function setPhase(nextPhase) {
        phase = nextPhase;
        if (nextPhase === 'impact') impactStartedAt = timer;
        if (nextPhase === 'collapsing') collapseStartedAt = timer;
        if (nextPhase === 'parade') paradeStartedAt = timer;
        if (nextPhase === 'end') endStartedAt = timer;
    }

    function getPhaseElapsed(startedAt) {
        if (!Number.isFinite(startedAt)) return 0;
        return Math.max(0, timer - startedAt);
    }

    function hasCollapseSettled() {
        const structureFragments = fragments.filter(f => f && f.isDebris !== true);
        if (structureFragments.length === 0) return true;

        const groundY = height - 40;
        let settledCount = 0;
        for (let i = 0; i < structureFragments.length; i++) {
            const frag = structureFragments[i];
            if ((frag.delay || 0) > 0) continue;
            const onGround = frag.y >= (groundY - 0.6);
            const stillEnough = Math.abs(frag.vx || 0) <= CONFIG.collapseStillSpeed
                && Math.abs(frag.vy || 0) <= CONFIG.collapseStillSpeed;
            if (onGround && stillEnough) settledCount++;
        }

        return (settledCount / structureFragments.length) >= CONFIG.collapseSettledRatio;
    }

    function shouldAdvanceToParade(collapseElapsed) {
        if (collapseElapsed < CONFIG.collapseMinFrames) return false;
        if (collapseElapsed >= CONFIG.collapseMaxFrames) return true;
        return hasCollapseSettled();
    }

    function wrapSubtitleLineByWidth(text, maxWidthPx) {
        const source = String(text || '').trim();
        if (!source) return [''];
        if (!ctx || !Number.isFinite(maxWidthPx) || maxWidthPx <= 10) return [source];
        if (ctx.measureText(source).width <= maxWidthPx) return [source];

        const chars = Array.from(source);
        const lines = [];
        let current = '';

        for (let i = 0; i < chars.length; i += 1) {
            const ch = chars[i];
            const next = `${current}${ch}`;
            if (!current || ctx.measureText(next).width <= maxWidthPx) {
                current = next;
                continue;
            }
            lines.push(current.trim());
            current = ch;
        }
        if (current) lines.push(current.trim());

        return lines.filter(Boolean);
    }

    function buildSubtitleLines(text, maxWidthPx, maxLines) {
        const raw = String(text || '').split('\n');
        const lines = [];
        raw.forEach((part) => {
            const wrapped = wrapSubtitleLineByWidth(part, maxWidthPx);
            wrapped.forEach((line) => lines.push(line));
        });

        const safeMaxLines = Math.max(1, Math.floor(Number(maxLines) || 1));
        if (lines.length <= safeMaxLines) return lines;

        const trimmed = lines.slice(0, safeMaxLines);
        const lastIndex = trimmed.length - 1;
        let lastChars = Array.from(String(trimmed[lastIndex] || '').trim());
        while (lastChars.length > 1 && ctx && ctx.measureText(`${lastChars.join('')}…`).width > maxWidthPx) {
            lastChars.pop();
        }
        trimmed[lastIndex] = `${lastChars.join('')}…`;
        return trimmed;
    }

    function animate(onComplete) {
        if (!canvas || !ctx || cinematicStopped) return;

        // ?붾㈃ ?붾뱾由?
        let sx = 0, sy = 0;
        if (shakeDuration > 0) {
            sx = random(-2, 2);
            sy = random(-2, 2);
            shakeDuration--;
        }
        const mobileView = width <= 900;
        const sceneScale = mobileView ? 1.06 : 1;
        if (sceneScale !== 1) {
            const focusX = width * 0.52;
            const focusY = height * 0.62;
            ctx.setTransform(
                sceneScale, 0, 0, sceneScale,
                sx + ((1 - sceneScale) * focusX),
                sy + ((1 - sceneScale) * focusY)
            );
        } else {
            ctx.setTransform(1, 0, 0, 1, sx, sy);
        }

        // 諛곌꼍 (諛앹? ??븯??
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#87CEEB');
        skyGrad.addColorStop(0.6, '#b0d8f0');
        skyGrad.addColorStop(1, '#d0e8f5');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // 諛곌꼍 ?꾩떆 ?ㅻ（??
        if (phase !== 'parade') {
            cityBuildings.forEach((b, bi) => {
                const topY = b.baseY - b.h;
                ctx.fillStyle = b.wallColor;
                ctx.fillRect(b.x, topY, b.w, b.h);

                ctx.fillStyle = b.shadeColor;
                ctx.fillRect(b.x + (b.w * 0.12), topY, b.w * 0.88, b.h);

                // 李쎈Ц (?대몢???됱긽)
                const stepX = b.depth === 0 ? 9 : (b.depth === 1 ? 11 : 13);
                const stepY = b.depth === 0 ? 11 : (b.depth === 1 ? 13 : 15);
                const winW = b.depth === 0 ? 2.2 : 3.2;
                const winH = b.depth === 0 ? 3.4 : 5.0;
                let row = 0;
                for (let wy = topY + 8; wy < b.baseY - 8; wy += stepY, row++) {
                    let col = 0;
                    for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += stepX, col++) {
                        // Deterministic mask: no frame-to-frame flicker.
                        const lit = (((b.windowSeed + row * 11 + col * 17 + bi * 29) % 12) >= 8);
                        if (lit) {
                            ctx.fillStyle = b.depth === 0
                                ? 'rgba(72, 97, 120, 0.50)'
                                : 'rgba(70, 98, 124, 0.62)';
                            ctx.fillRect(wx, wy, winW, winH);
                        }
                    }
                }
            });
        }

        // 吏硫?
        ctx.fillStyle = phase === 'parade' ? '#1a1a1a' : '#4a5568';
        ctx.fillRect(0, height - 40, width, 40);

        // 濡쒖쭅
        if (phase === 'intro' || phase === 'approach') {
            startEngineSfx();
            drone.x += CONFIG.droneSpeed;
            drawBuildingFull(false);
            drawDrone();

            if ((drone.x + AIRLINER_NOSE_OFFSET) > building.x) {
                stopEngineSfx();
                setPhase('impact');
                createExplosion(drone.x + AIRLINER_NOSE_OFFSET, drone.y);
                playImpactSfx();
            }
        } else if (phase === 'impact' || phase === 'wait') {
            drawBuildingFull(true);

            // ?곌린
            if (timer % 5 === 0) {
                particles.push({
                    x: building.x + random(0, building.w),
                    y: building.damageY + random(-10, 10),
                    vx: random(-1, 1), vy: -1.5,
                    life: 150, size: random(10, 30),
                    color: 'rgba(50,50,50,0.4)', type: 'smoke'
                });
            }

            const impactElapsed = getPhaseElapsed(impactStartedAt);
            if (phase === 'wait' && impactElapsed > CONFIG.waitFrames) {
                setPhase('collapsing');
                triggerCollapse();
            } else if (phase === 'impact') {
                setPhase('wait');
            }
        } else if (phase === 'collapsing') {
            drawBuildingBaseOnly();
            updateFragments();

            // parade濡??꾪솚
            const collapseElapsed = getPhaseElapsed(collapseStartedAt);
            if (shouldAdvanceToParade(collapseElapsed)) {
                setPhase('parade');
            }
        } else if (phase === 'parade') {
            // ?대몢??諛곌꼍
            ctx.fillStyle = '#0f0f0f';
            ctx.fillRect(0, 0, width, height);

            // 諛붾떏 洹몃━??
            ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
            ctx.lineWidth = 1;
            for (let x = 0; x < width; x += 40) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += 40) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // 醫뚯슦 鍮④컙 源껊컻
            drawBanner(80, 100, height - 200);
            drawBanner(width - 150, 100, height - 200);

            // 蹂묒궗 ?됱쭊
            if (!Number.isFinite(paradeStartedAt)) paradeStartedAt = timer;
            const paradeElapsed = getPhaseElapsed(paradeStartedAt);
            soldiers.forEach(s => {
                const delayFrames = s.delay * 0.6;
                const localElapsed = Math.max(0, paradeElapsed - delayFrames);
                const approachProgress = Math.max(0, Math.min(1, localElapsed / CONFIG.paradeAdvanceFrames));
                const easedProgress = 1 - Math.pow(1 - approachProgress, 2);

                let sx = s.startX + (s.targetX - s.startX) * easedProgress;
                let sy = s.startY + (s.targetY - s.startY) * easedProgress;
                let pace = 0.65;

                if (localElapsed >= CONFIG.paradeAdvanceFrames) {
                    sx = s.targetX;
                    sy = s.targetY;
                    if (localElapsed < CONFIG.paradeAdvanceFrames + CONFIG.paradeStopFrames) {
                        pace = 0;
                    } else {
                        pace = 0.22;
                        const slowWalkFrame = localElapsed - (CONFIG.paradeAdvanceFrames + CONFIG.paradeStopFrames);
                        sy = s.targetY - Math.min(12, slowWalkFrame * 0.03);
                    }
                }

                drawSoldier(sx, sy, timer + s.delay + s.phase, pace);
            });

            // end濡??꾪솚
            if (paradeElapsed > CONFIG.paradeDurationFrames) {
                setPhase('end');
            }
        } else if (phase === 'end') {
            // ?대몢??諛곌꼍 ?좎?
            ctx.fillStyle = '#0f0f0f';
            ctx.fillRect(0, 0, width, height);

            // ?섏씠???꾩썐 諛???댄?
            const endElapsed = getPhaseElapsed(endStartedAt);
            const fadeAlpha = Math.min(1, endElapsed / CONFIG.endFadeFrames);

            if (CONFIG.showEndingLogo && fadeAlpha > 0.3) {
                ctx.fillStyle = `rgba(255,255,255,${fadeAlpha})`;
                ctx.font = 'bold 72px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('RECLAIM', width / 2, height / 2);

                ctx.font = '24px Arial';
                ctx.fillText('수복 작전', width / 2, height / 2 + 60);
            }

            // ??댄????꾩쟾???쒖떆????3珥??湲?
            if (endElapsed > (CONFIG.endFadeFrames + CONFIG.endHoldFrames)) {
                // ?쒕꽕留덊떛 醫낅즺
                stop('timeline_end');
                markAsWatched();
                if (typeof onComplete === 'function') onComplete();
                return;
            }
        }

        updateParticles();

        // ?먮쭑 ?뚮뜑留?
        const currentSubtitle = SUBTITLES.find(sub => timer >= sub.start && timer <= sub.end);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (currentSubtitle) {
            const shortEdge = Math.min(width, height);
            const fontSize = mobileView
                ? Math.max(15, Math.min(20, Math.floor(shortEdge * 0.042)))
                : Math.max(22, Math.min(32, Math.floor(width * 0.03)));
            const lineHeight = Math.max(fontSize + (mobileView ? 6 : 8), Math.round(fontSize * 1.34));
            const maxLines = mobileView ? 3 : 2;
            const maxTextWidth = Math.floor(width * (mobileView ? 0.9 : 0.82));

            ctx.fillStyle = '#FFFFFF';
            ctx.font = `700 ${fontSize}px "Noto Sans KR", Arial, sans-serif`;
            const lines = buildSubtitleLines(currentSubtitle.text, maxTextWidth, maxLines);
            const verticalPad = mobileView ? 8 : 14;
            const subtitleHeight = Math.max(
                (lines.length * lineHeight) + (verticalPad * 2),
                mobileView ? 74 : 110
            );

            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(0, height - subtitleHeight, width, subtitleHeight);

            // ?먮쭑 ?띿뒪??
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `700 ${fontSize}px "Noto Sans KR", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;

            // 以꾨컮轅?泥섎━
            const startY = height - subtitleHeight / 2 - (lines.length - 1) * lineHeight / 2;

            lines.forEach((line, index) => {
                ctx.fillText(line, width / 2, startY + index * lineHeight);
            });

            // 洹몃┝??珥덇린??
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }

        // ?ш킅 (鍮좊Ⅴ寃?媛먯냼)
        if (flashOpacity > 0) {
            ctx.fillStyle = `rgba(255,255,255,${flashOpacity})`;
            ctx.fillRect(0, 0, width, height);
            flashOpacity -= 0.08;
        }

        if (cinematicStopped) return;
        timer++;
        animationId = requestAnimationFrame(() => animate(onComplete));
    }

    // ============================================
    // 洹몃━湲??⑥닔??
    // ============================================

    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    function startEngineSfx() {
        if (cinematicStopped || engineSfxStarted) return;
        engineSfxStarted = true;

        try {
            if (engineSfxAudio) {
                engineSfxAudio.pause();
                engineSfxAudio.currentTime = 0;
            }
            engineSfxAudio = new Audio(CINEMATIC_ENGINE_PATH);
            engineSfxAudio.loop = true;
            engineSfxAudio.volume = 0.7;
            engineSfxAudio.play().catch(err => {
                console.warn('[Cinematic] Engine SFX blocked:', err);
            });
        } catch (err) {
            console.warn('[Cinematic] Engine SFX init failed:', err);
            engineSfxAudio = null;
        }
    }

    function stopEngineSfx() {
        if (!engineSfxAudio) return;
        try { engineSfxAudio.pause(); } catch (_) { }
        try { engineSfxAudio.currentTime = 0; } catch (_) { }
        engineSfxAudio = null;
    }

    function playImpactSfx() {
        if (cinematicStopped) return;
        if (impactSfxPlayed) return;
        impactSfxPlayed = true;

        try {
            if (impactSfxAudio) {
                impactSfxAudio.pause();
                impactSfxAudio.currentTime = 0;
            }
            impactSfxAudio = new Audio('bgm/boom/death-exp.mp3');
            impactSfxAudio.volume = 0.85;
            if (cinematicStopped) return;
            impactSfxAudio.play().catch(err => {
                if (cinematicStopped) return;
                console.warn('[Cinematic] Impact SFX blocked:', err);
            });
        } catch (err) {
            console.warn('[Cinematic] Impact SFX init failed:', err);
        }
    }

    function createExplosion(x, y) {
        flashOpacity = 0.5;
        shakeDuration = 30;

        // ?붿뿼
        for (let i = 0; i < 80; i++) {
            const angle = random(0, Math.PI * 2);
            const speed = random(1, 5);
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: random(60, 100),
                size: random(10, 25),
                color: `hsl(${random(0, 40)}, 100%, 50%)`,
                type: 'fire'
            });
        }

        // ?뚰렪
        for (let i = 0; i < 20; i++) {
            const angle = random(Math.PI / 2, Math.PI * 1.5);
            const speed = random(2, 8);
            fragments.push({
                x, y, w: random(4, 8), h: random(4, 8),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                va: random(-0.1, 0.1), angle: 0,
                color: '#555',
                isDebris: true
            });
        }
    }

    function triggerCollapse() {
        shakeDuration = 20;

        const splitY = building.damageY;
        const topH = splitY - building.y;

        const rows = 8, cols = 4;
        const chunkW = building.w / cols;
        const chunkH = topH / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const fx = building.x + c * chunkW;
                const fy = building.y + r * chunkH;

                fragments.push({
                    x: fx, y: fy, w: chunkW, h: chunkH,
                    vx: random(-1, 1),
                    vy: random(0, 1),
                    va: random(-0.02, 0.02),
                    angle: 0,
                    color: (Math.random() > 0.6) ? CONFIG.windowColor : CONFIG.wallColor,
                    isDebris: false,
                    delay: (rows - r) * 5
                });
            }
        }

        // 癒쇱?
        for (let i = 0; i < 40; i++) {
            particles.push({
                x: building.x + building.w / 2 + random(-20, 20),
                y: splitY,
                vx: random(-2, 2),
                vy: random(-1, 1),
                life: 200,
                size: random(20, 50),
                color: 'rgba(100,100,100,0.5)',
                type: 'smoke'
            });
        }
    }

    function drawDrone() {
        ctx.save();
        ctx.translate(drone.x, drone.y);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;

        // Scale the provided SVG-style airliner down for the cinematic scene.
        ctx.scale(0.33, 0.33);
        ctx.translate(0, -55);

        // Tail stabilizers.
        ctx.fillStyle = '#cbd5e0';
        ctx.beginPath();
        ctx.moveTo(60, 55);
        ctx.lineTo(35, 35);
        ctx.lineTo(20, 35);
        ctx.lineTo(40, 55);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#a0aec0';
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(15, 15);
        ctx.lineTo(5, 15);
        ctx.lineTo(35, 55);
        ctx.closePath();
        ctx.fill();

        // Main fuselage.
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(40, 55);
        ctx.bezierCurveTo(40, 40, 80, 35, 280, 40);
        ctx.bezierCurveTo(310, 42, 310, 68, 280, 70);
        ctx.bezierCurveTo(80, 75, 40, 70, 40, 55);
        ctx.closePath();
        ctx.fill();

        // Cockpit window.
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(275, 43);
        ctx.bezierCurveTo(285, 43, 295, 45, 300, 52);
        ctx.lineTo(275, 52);
        ctx.closePath();
        ctx.fill();

        // Passenger windows.
        ctx.fillStyle = 'rgba(71, 85, 105, 0.6)';
        for (let i = 0; i < 12; i++) {
            const wx = 80 + i * 15;
            ctx.fillRect(wx, 52, 6, 8);
        }

        // Engine pod.
        ctx.fillStyle = '#64748b';
        ctx.fillRect(150, 75, 40, 15);
        ctx.fillStyle = '#334155';
        ctx.fillRect(185, 77, 8, 11);

        // Main wing.
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(130, 65);
        ctx.lineTo(100, 95);
        ctx.lineTo(180, 95);
        ctx.lineTo(210, 65);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#cbd5e0';
        ctx.beginPath();
        ctx.moveTo(140, 65);
        ctx.lineTo(120, 85);
        ctx.lineTo(180, 85);
        ctx.lineTo(195, 65);
        ctx.closePath();
        ctx.fill();

        // Top highlight.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(60, 45);
        ctx.bezierCurveTo(100, 42, 200, 42, 270, 45);
        ctx.stroke();

        ctx.restore();
    }

    function drawBuildingFull(hasHole) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(building.x + 10, building.y, building.w, building.h);

        ctx.fillStyle = CONFIG.wallColor;
        ctx.fillRect(building.x, building.y, building.w, building.h);

        building.windows.forEach(w => {
            if (hasHole && Math.abs((building.y + w.ry) - building.damageY) < 30) return;

            ctx.fillStyle = w.color;
            ctx.fillRect(building.x + w.rx, building.y + w.ry, w.w, w.h);
        });

        if (hasHole) {
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.ellipse(building.x + 20, building.damageY, 30, 25, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 5;
            ctx.stroke();
        }
    }

    function drawBuildingBaseOnly() {
        const cutY = building.damageY;
        const baseH = (building.y + building.h) - cutY;

        ctx.fillStyle = CONFIG.wallColor;
        ctx.fillRect(building.x, cutY, building.w, baseH);

        building.windows.forEach(w => {
            const wy = building.y + w.ry;
            if (wy > cutY) {
                ctx.fillStyle = w.color;
                ctx.fillRect(building.x + w.rx, wy, w.w, w.h);
            }
        });

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        building.rebar.forEach(r => {
            ctx.beginPath();
            ctx.moveTo(r.x, r.y);
            const ex = r.x + Math.sin(r.angle) * r.h * 0.5;
            const ey = r.y + Math.cos(r.angle) * r.h;
            ctx.lineTo(ex, ey);
            ctx.stroke();
        });

        ctx.fillStyle = '#555';
        ctx.fillRect(building.x, cutY, building.w, 5);
    }

    function updateFragments() {
        fragments.forEach(f => {
            if (f.delay > 0) {
                f.delay--;
                ctx.fillStyle = f.color;
                ctx.fillRect(f.x, f.y, f.w, f.h);
                return;
            }

            f.vx *= 0.99;
            f.vy += CONFIG.gravity;
            f.x += f.vx;
            f.y += f.vy;
            f.angle += f.va;

            if (f.y > height - 40) {
                f.y = height - 40;
                f.vy *= -0.3;
                f.vx *= 0.8;
                f.va = 0;
            }

            ctx.save();
            ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
            ctx.rotate(f.angle);
            ctx.fillStyle = f.color;
            ctx.fillRect(-f.w / 2 + 1, -f.h / 2 + 1, f.w - 2, f.h - 2);
            ctx.restore();
        });
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.type === 'smoke') {
                p.size += 0.2;
                p.vy *= 0.99;
            } else {
                p.size *= 0.95;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();

            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // ============================================
    // Parade ?λ㈃ 洹몃━湲?
    // ============================================

    function drawBanner(x, startY, endY) {
        const wavePhase = (timer * 0.05) % (Math.PI * 2);

        ctx.fillStyle = 'rgba(139, 0, 0, 0.8)';
        ctx.strokeStyle = '#FFC107';
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(x, startY);
        for (let y = startY; y <= endY; y += 5) {
            const offset = Math.sin(wavePhase + y * 0.02) * 3;
            ctx.lineTo(x + offset, y);
        }
        ctx.lineTo(x + 60, endY);
        for (let y = endY; y >= startY; y -= 5) {
            const offset = Math.sin(wavePhase + y * 0.02) * 3;
            ctx.lineTo(x + 60 + offset, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 諛⑺뙣 ?꾩씠肄?
        for (let i = 0; i < 3; i++) {
            const sy = startY + 80 + i * 150;
            ctx.fillStyle = '#FFC107';
            ctx.beginPath();
            ctx.moveTo(x + 30, sy);
            ctx.lineTo(x + 20, sy + 10);
            ctx.lineTo(x + 20, sy + 25);
            ctx.lineTo(x + 30, sy + 32);
            ctx.lineTo(x + 40, sy + 25);
            ctx.lineTo(x + 40, sy + 10);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawSoldier(x, y, t, pace = 1) {
        const speed = Math.max(0, Number(pace) || 0);
        const cycle = (t * 0.08 * speed) % (Math.PI * 2);
        const marchOffset = speed > 0 ? Math.sin(cycle) * (0.8 + speed * 2.2) : 0;
        const armSwing = speed > 0 ? Math.sin(cycle) * (8 + speed * 22) : 0;

        y += marchOffset;

        ctx.save();
        ctx.translate(x, y);

        // 洹몃┝??
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // ?щĸ (癒몃━)
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -18, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 援곕났 (鍮④컙??紐명넻)
        ctx.fillStyle = '#b91c1c';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.fillRect(-3, -12, 6, 15);
        ctx.strokeRect(-3, -12, 6, -3);

        // ?쇳뙏 (?붾뱾由?
        ctx.save();
        ctx.translate(-4, -10);
        ctx.rotate((armSwing * Math.PI) / 180);
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(-1, 0, 2, 8);
        ctx.restore();

        // ?ㅻⅨ??(珥?????- 怨좎젙)
        ctx.save();
        ctx.translate(4, -10);
        ctx.rotate((15 * Math.PI) / 180);
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(-1, 0, 2, 8);
        ctx.restore();

        // 珥?(?ㅻⅨ履??닿묠?먯꽌 ?꾨줈)
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(6, -12);
        ctx.lineTo(6, -26);
        ctx.stroke();

        // 珥앷? (?앸?遺?
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(5, -28, 2, 4);

        ctx.restore();
    }

    // ============================================
    // Global Export
    // ============================================

    global.Cinematic = {
        play,
        stop,
        hasWatched,
        shouldPlay,
        markAsWatched,
        reset
    };

})(window);
