// ============================================
// BriefingAnimation — 작전설명 캐릭터 팝업
// city-sim 우측 하단 크로마키 캔버스 렌더링
// ============================================

(function (global) {
    'use strict';

    const BRIEFING_KEY = 'reclaim_briefing_v1';
    const BASE_PATH    = 'src/modes/city-sim/animated/';

    // 현재 준비된 클립만 포함 (없는 파일 있으면 onerror 연속 → 즉시 종료)
    const CLIPS = [
        'offloer_01.mp4',
        // 'offlcer_02.mp4',  // 추가 예정
        // 'offlcer_03.mp4',  // 추가 예정
    ];

    // 크로마키 파라미터
    const CHROMA = {
        keyColor: { r: 46, g: 139, b: 87 }, // #2E8B57
        softRadius:       70,  // 키 컬러와 이 거리 이하면 점진 제거
        hardRadius:       34,  // 키 컬러와 매우 가까울 때만 완전 제거
        minGreen:         48,
        minDiff:          20,
        greenToRedRatio:  1.12,
        greenToBlueRatio: 1.08,
        softStart:        28,
        hardCut:          102,
        despillStrength:  0.56,
    };

    // 팝업 캔버스 최대 크기 (화면 높이 기준)
    const POPUP_MAX_H_RATIO = 0.82; // 화면 높이의 82% (팝업 자체 확대)
    const POPUP_MAX_W_RATIO = 0.36; // 화면 너비의 36% (팝업 자체 확대)
    const POPUP_SUBJECT_SCALE = 1.0;  // 머리 잘림 방지: draw 확대 비활성
    const POPUP_SHIFT_X_RATIO = -0.18; // 인물을 더 왼쪽으로 이동
    const POPUP_SHIFT_Y_PX = 4;        // 인물을 살짝 아래로 이동

    // ── 상태 ─────────────────────────────────────
    let popup      = null;
    let dispCanvas = null;
    let dispCtx    = null;
    let offscreen  = null;
    let offCtx     = null;
    let videoEl    = null;
    let rafId      = null;
    let stopped    = true;
    let currentIdx = 0;
    let fadeAlpha  = 0;
    let fadingOut  = false;

    // ──────────────────────────────────────────────
    // 크로마키 픽셀 처리
    // ──────────────────────────────────────────────
    function processChromaKey(imgData) {
        const d = imgData.data;
        const {
            keyColor,
            softRadius,
            hardRadius,
            minGreen,
            minDiff,
            greenToRedRatio,
            greenToBlueRatio,
            softStart,
            hardCut,
            despillStrength
        } = CHROMA;
        const range = Math.max(1, hardCut - softStart);
        const radiusRange = Math.max(1, softRadius - hardRadius);

        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const maxRB = Math.max(r, b);
            const greenness = g - maxRB;

            const dr = r - keyColor.r;
            const dg = g - keyColor.g;
            const db = b - keyColor.b;
            const dist = Math.sqrt((dr * dr) + (dg * dg) + (db * db));

            const isGreenCandidate = (
                g >= minGreen &&
                greenness >= minDiff &&
                g >= r * greenToRedRatio &&
                g >= b * greenToBlueRatio
            );

            const byGreenness = isGreenCandidate
                ? Math.max(0, Math.min(1, (greenness - softStart) / range))
                : 0;
            const byDistance = (dist <= softRadius)
                ? Math.max(0, Math.min(1, (softRadius - dist) / radiusRange))
                : 0;

            // 알파 제거는 키 컬러 근접도 중심으로만 적용 (녹색 옷 오검출 완화)
            if (dist <= softRadius && g > r && g > b) {
                const keyStrength = byDistance;
                if (dist <= hardRadius) {
                    d[i + 3] = 0;
                } else {
                    const alpha = Math.round((1 - keyStrength) * 255);
                    d[i + 3] = alpha < 8 ? 0 : alpha;
                }
                d[i + 1] = Math.round(Math.max(0, g - (greenness * despillStrength * Math.max(0.2, keyStrength))));
            } else if (isGreenCandidate) {
                // 키 컬러에서 먼 녹색은 알파 유지하고 색번짐만 줄임
                const spill = Math.max(0.1, byGreenness);
                d[i + 1] = Math.round(Math.max(0, g - (greenness * despillStrength * spill)));
            } else if (greenness > 8) {
                d[i + 1] = Math.round(Math.max(0, g - greenness * despillStrength * 0.4));
            }
        }
        return imgData;
    }

    // ──────────────────────────────────────────────
    // DOM 생성
    // ──────────────────────────────────────────────
    function buildDOM() {
        if (!document.getElementById('briefing-popup')) {
            const el = document.createElement('div');
            el.id        = 'briefing-popup';
            el.className = 'briefing-popup hidden';
            el.innerHTML = `
                <button id="briefing-popup-close" class="briefing-popup-close" aria-label="닫기">✕</button>
                <canvas id="briefing-popup-canvas" class="briefing-popup-canvas"></canvas>
                <div class="briefing-popup-shadow"></div>
            `;
            document.body.appendChild(el);
            document.getElementById('briefing-popup-close').addEventListener('click', _finish);
        }

        popup      = document.getElementById('briefing-popup');
        dispCanvas = document.getElementById('briefing-popup-canvas');
        dispCtx    = dispCanvas.getContext('2d');
        if (!offscreen) {
            offscreen = document.createElement('canvas');
            offCtx    = offscreen.getContext('2d', { willReadFrequently: true });
        }
    }

    // ──────────────────────────────────────────────
    // 클립 로드
    // ──────────────────────────────────────────────
    function loadClip(idx) {
        if (stopped) return;
        if (idx >= CLIPS.length) { _finish(); return; }

        currentIdx = idx;
        fadingOut  = false;
        if (idx === 0) fadeAlpha = 0;

        _cleanupVideo();

        videoEl             = document.createElement('video');
        videoEl.playsInline = true;
        videoEl.preload     = 'auto';
        videoEl.muted       = false; // 대사 오디오 ON
        videoEl.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.body.appendChild(videoEl);

        videoEl.onended = () => {
            if (stopped) return;
            fadingOut = true;
        };
        videoEl.onerror = () => {
            if (stopped) return;
            console.warn('[Briefing] 클립 로드 실패:', CLIPS[idx]);
            _cleanupVideo();
            loadClip(idx + 1);
        };

        videoEl.src = BASE_PATH + CLIPS[idx];
        videoEl.load();

        // 소리 있는 자동재생 → 브라우저 차단 시 muted로 폴백
        const p = videoEl.play();
        if (p !== undefined) {
            p.catch(() => {
                if (stopped || !videoEl) return;
                console.warn('[Briefing] 오디오 자동재생 차단 → muted 폴백');
                videoEl.muted = true;
                videoEl.play().catch(err => {
                    console.error('[Briefing] muted 재생도 실패:', err);
                });
            });
        }
    }

    function _cleanupVideo() {
        if (!videoEl) return;
        videoEl.onended = null;
        videoEl.onerror = null;
        videoEl.pause();
        try { videoEl.src = ''; } catch (_) {}
        if (videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
        videoEl = null;
    }

    // ──────────────────────────────────────────────
    // 렌더 루프
    // ──────────────────────────────────────────────
    function renderLoop() {
        if (stopped) return;

        const FADE_SPEED = 0.05;

        if (fadingOut && fadeAlpha <= 0) {
            _cleanupVideo();
            loadClip(currentIdx + 1);
            rafId = requestAnimationFrame(renderLoop);
            return;
        }

        fadeAlpha = fadingOut
            ? Math.max(0, fadeAlpha - FADE_SPEED)
            : Math.min(1, fadeAlpha + FADE_SPEED);

        if (videoEl && videoEl.readyState >= 2) {
            const vw = videoEl.videoWidth  || 640;
            const vh = videoEl.videoHeight || 480;

            if (offscreen.width !== vw || offscreen.height !== vh) {
                offscreen.width  = vw;
                offscreen.height = vh;
            }

            // 비율 유지 + 화면 크기 상한
            const maxW = Math.round(window.innerWidth  * POPUP_MAX_W_RATIO);
            const maxH = Math.round(window.innerHeight * POPUP_MAX_H_RATIO);
            let dw = maxW;
            let dh = Math.round(dw * vh / vw);
            if (dh > maxH) { dh = maxH; dw = Math.round(dh * vw / vh); }

            if (dispCanvas.width !== dw || dispCanvas.height !== dh) {
                dispCanvas.width  = dw;
                dispCanvas.height = dh;
            }

            offCtx.clearRect(0, 0, vw, vh);
            offCtx.drawImage(videoEl, 0, 0, vw, vh);

            try {
                const imgData = offCtx.getImageData(0, 0, vw, vh);
                processChromaKey(imgData);
                offCtx.putImageData(imgData, 0, 0);
            } catch (_) {
                // crossOrigin 미설정 시 크로마키 생략하고 원본 출력
            }

            dispCtx.clearRect(0, 0, dw, dh);
            dispCtx.save();
            dispCtx.globalAlpha = Math.max(0, Math.min(1, fadeAlpha));
            const renderW = Math.round(dw * POPUP_SUBJECT_SCALE);
            const renderH = Math.round(dh * POPUP_SUBJECT_SCALE);
            const baseX = Math.round((dw - renderW) / 2);
            const baseY = Math.round(dh - renderH);
            const shiftX = Math.round(dw * POPUP_SHIFT_X_RATIO);
            const shiftY = POPUP_SHIFT_Y_PX;
            dispCtx.drawImage(
                offscreen,
                0,
                0,
                vw,
                vh,
                baseX + shiftX,
                baseY + shiftY,
                renderW,
                renderH
            );
            dispCtx.restore();
        }

        rafId = requestAnimationFrame(renderLoop);
    }

    // ──────────────────────────────────────────────
    // 종료
    // ──────────────────────────────────────────────
    function _finish() {
        stopped = true;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        _cleanupVideo();
        markPlayed();
        if (popup) popup.classList.add('hidden');
    }

    // ──────────────────────────────────────────────
    // 플래그 (localStorage)
    // ──────────────────────────────────────────────
    function hasPlayed()  { try { return localStorage.getItem(BRIEFING_KEY) === '1'; } catch (_) { return false; } }
    function markPlayed() { try { localStorage.setItem(BRIEFING_KEY, '1'); } catch (_) {} }
    function resetFlag()  { try { localStorage.removeItem(BRIEFING_KEY); } catch (_) {} }
    function shouldPlay() { return !hasPlayed(); }

    // ──────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────
    function play(opts) {
        const force = !!(opts && opts.force);
        if (!force && !shouldPlay()) return;

        console.log('[Briefing] play() 호출, force=', force);

        if (!stopped) {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            _cleanupVideo();
        }

        buildDOM();
        stopped    = false;
        currentIdx = 0;
        fadeAlpha  = 0;
        fadingOut  = false;
        popup.classList.remove('hidden');

        console.log('[Briefing] 팝업 표시, 클립 로드 시작');
        loadClip(0);
        rafId = requestAnimationFrame(renderLoop);
    }

    function stop() { _finish(); }

    global.BriefingAnimation = { play, stop, shouldPlay, resetFlag };

    console.log('[Briefing] BriefingAnimation 로드 완료');

})(window);
