(function attachCityDrillgroundBubbleConfig(global) {
    'use strict';

    const EVENT_TYPES = Object.freeze([
        'normal',
        'battle_pre',
        'battle_post_victory',
        'battle_post_defeat'
    ]);

    const MODE_TYPES = Object.freeze(['personal', 'group']);

    const DEFAULT_OPTIONS = Object.freeze({
        intervalMs: 8000,
        intervalJitterMs: 1200,
        bubbleDurationMs: 6200,
        minGapMs: 900,
        eventTtlMs: 12 * 60 * 1000,
        initialDelayMinMs: 150,
        initialDelayMaxMs: 500,
        maxQueuedEvents: 16,
        maxConcurrentBubbles: 3,
        lineRepeatWindow: 18,
        eventBurstQueueCount: 6,
        eventBurstMinGapMs: 220,
        eventBurstDurationMs: 7000,
        ambientBattlePreChancePct: 72,
        defaultGroupChancePct: 45,
        battlePreGroupChancePct: 78
    });

    const DEFAULT_DIALOGUES = Object.freeze({
        normal: {
            personal: [
                '장비 확인부터 다시 하자.',
                '오늘도 침착하게 간다.',
                '무전 체크 끝. 이상 무.',
                '집중. 실수는 한 번이면 끝난다.',
                '호흡 정리하고 다음 동작.'
            ],
            group: [
                '라인 다시 맞추자.',
                '무전 한 번씩 확인해.',
                '지금부터는 템포 맞춰서 간다.',
                '서두르지 말고 정확하게.',
                '이동 동선 그대로 유지.'
            ]
        },
        battle_pre: {
            group: [
                '야 전쟁 나면 튈 거냐?',
                '당연하지 ㅋㅋ',
                '그럼 배 타고 가게?',
                '야 너 수영 되냐?',
                '난 일단 신발부터 챙긴다.',
                '도망도 스펙이다…',
                '근데 진짜 전쟁 나면 어디로 가냐?',
                '말 조심해라. 누가 듣는다.',
                '우리 같은 편 맞지?',
                '웃긴데… 안 웃김.',
                '오늘은 정상, 내일은 비상.',
                '내일이 더 무섭다.',
                '전쟁은 멀리 있는 줄 알았는데 아니네.',
                'PX 가실?',
                'PX만이 희망이다.'
            ],
            personal: [
                '나 지금 손 떨리는데… 정상?',
                '나 튈까… 아니 참아야지.',
                '신발끈부터 묶자…',
                '숨 크게… 들이쉬고…',
                '말 조심하자. 나도 들킨다.',
                '내일이 더 무섭다…',
                '전쟁 나면 다 죽는 거야…',
                '살아남는 놈이 이기는 거지…',
                '우크라이나 휴전 언제 하냐… 이런 생각 왜 나냐.',
                '뉴스 끄고 싶다…',
                '현실 아니지? 훈련이지?',
                '집 가고 싶다.',
                '엄마 보고 싶다… (아님)',
                '커피가 생명줄이다.',
                '담배 한 대만…'
            ]
        },
        battle_post_victory: {
            group: [
                '야 우리가 이겼다ㅋㅋ',
                '살아남았다… 일단.',
                '이기긴 했는데 왜 찝찝하냐?',
                '오늘만큼은 밥 맛있다.',
                'PX 가자. 오늘은 축제다.',
                '과자 털자. 승리 보상이다.',
                '야 표정 풀어. 아직 살아있잖아.',
                '이겼는데도 심장이 안 내려와…',
                '다치진 않았지? 체크해라.',
                '그래도… 우리 잘했다.',
                '이겼다! 근데 내일은?',
                '한 판 더 오면 나 못 버틴다ㅋㅋ',
                '커피가 생명줄이다. 승리 커피.',
                '이겼으니 잠 좀 자자… 제발.',
                '기록해라. 오늘은 우리가 이겼다.'
            ],
            personal: [
                '나 살았다… 와…',
                '손 떨림 멈췄다… 이제.',
                '이겼는데 기쁘진 않다.',
                '그래도… 해냈다.',
                '나 방금 잘한 거 맞지?',
                '이제 숨 좀 쉬자…',
                '오늘은 라면 두 개다.',
                'PX? 나도 간다. 무조건.',
                '과자 하나만… 보상이다.',
                '커피… 지금 마시면 천국이다.',
                '나 아직 멀쩡하네… 신기하다.',
                '다음엔 더 잘할 수 있을 듯.',
                '누가 봤냐? 나 방금 멋있었지?',
                'ㅋㅋㅋㅋ 살아남음',
                '이겼으니… 잠 한숨만.'
            ]
        },
        battle_post_defeat: {
            group: [
                '졌다… 씨…',
                '야 다들 살아있냐?',
                '이게 맞냐… 진짜…',
                '현타 온다…',
                '다 죽는 거야… 이러다.',
                '누가 지휘했냐… (농담이다)',
                '말 아껴. 지금 분위기 살벌하다.',
                '뉴스 믿으면 머리만 아프다… 현실이 더 아프네.',
                '휴전이든 뭐든… 빨리 끝났으면.',
                '다음엔… 다르게 하자.',
                '후퇴가 승리다… 라고 치자.',
                'PX는 무슨… 그냥 눕고 싶다.',
                '밥도 안 넘어간다.',
                '우린 괜찮아… 괜찮다고 해야지.',
                '이번 판은… 접자.'
            ],
            personal: [
                '아… 나 죽었네.',
                '이게 맞냐…',
                '현타 오네 진짜…',
                '내가 뭐 했다고…',
                '다 죽는 거야… 결국.',
                '도망도 스펙이라더니… 못 했네.',
                '말 아껴야 했는데…',
                '손이 굳었다…',
                '뉴스 믿으면 머리만 아프다…',
                '휴전이든 뭐든… 빨리 끝났으면.',
                '집 가고 싶다…',
                '웃긴데… 안 웃김.',
                '다음 판엔… 튄다.',
                'PX는 무슨…',
                '그냥… 눕고 싶다.'
            ]
        }
    });

    function sanitizeLines(lines) {
        if (!Array.isArray(lines)) return [];
        const out = [];
        const seen = new Set();
        for (const line of lines) {
            const text = String(line || '').trim();
            if (!text || seen.has(text)) continue;
            seen.add(text);
            out.push(text);
        }
        return out;
    }

    function normalizeType(type) {
        const key = String(type || '').trim().toLowerCase();
        return EVENT_TYPES.includes(key) ? key : 'normal';
    }

    function normalizeMode(mode) {
        const key = String(mode || '').trim().toLowerCase();
        return key === 'group' ? 'group' : 'personal';
    }

    function cloneBundle(bundle) {
        const out = {};
        for (const type of EVENT_TYPES) {
            const src = (bundle && bundle[type] && typeof bundle[type] === 'object') ? bundle[type] : {};
            out[type] = {
                personal: sanitizeLines(src.personal),
                group: sanitizeLines(src.group)
            };
        }
        return out;
    }

    let dialogueBundle = cloneBundle(DEFAULT_DIALOGUES);

    function getDefaultOptions() {
        return { ...DEFAULT_OPTIONS };
    }

    function getDialogueLines(type, mode) {
        const safeType = normalizeType(type);
        const safeMode = normalizeMode(mode);
        const bucket = dialogueBundle[safeType] || { personal: [], group: [] };
        return Array.isArray(bucket[safeMode]) ? bucket[safeMode].slice() : [];
    }

    function setDialogueLines(type, mode, lines) {
        const safeType = normalizeType(type);
        const safeMode = normalizeMode(mode);
        if (!dialogueBundle[safeType]) {
            dialogueBundle[safeType] = { personal: [], group: [] };
        }
        dialogueBundle[safeType][safeMode] = sanitizeLines(lines);
    }

    function replaceDialogueBundle(bundle) {
        if (!bundle || typeof bundle !== 'object') return;
        for (const type of EVENT_TYPES) {
            const srcType = bundle[type];
            if (!srcType || typeof srcType !== 'object') continue;
            if (Array.isArray(srcType.personal)) setDialogueLines(type, 'personal', srcType.personal);
            if (Array.isArray(srcType.group)) setDialogueLines(type, 'group', srcType.group);
        }
    }

    function resetDialogueBundle() {
        dialogueBundle = cloneBundle(DEFAULT_DIALOGUES);
    }

    function getDialogueBundle() {
        return cloneBundle(dialogueBundle);
    }

    global.CitySimDrillgroundBubbleConfig = {
        EVENT_TYPES,
        MODE_TYPES,
        getDefaultOptions,
        getDialogueLines,
        setDialogueLines,
        replaceDialogueBundle,
        resetDialogueBundle,
        getDialogueBundle
    };
})(window);
