const Lang = {
    current: 'ko', // ko, en
    data: {
        ko: {
            // Main Menu
            title: "수복",
            subtitle: "RECLAIM",
            campaign: "작전 개시",
            campaign_desc: "적 점령지 탈환 작전",
            online: "멀티플레이",
            online_desc: "접근 불가 (보안 프로토콜)",
            settings: "환경 설정",
            options: "설정 (Settings)", // Added key from index.html
            menu_play: "작전 개시",
            menu_play_desc: "싱글 작전 시작",
            menu_unitdex: "유닛 도감",
            menu_unitdex_desc: "유닛 정보",
            menu_uniteditor: "유닛 에디터",
            menu_uniteditor_desc: "유닛/맵 편집",
            menu_options: "옵션",
            menu_options_desc: "언어 및 사운드",
            menu_exit: "게임 종료",
            menu_exit_desc: "프로그램 종료",
            project_title: "PROJECT: 수복",
            start_operation: "작전 시작",

            // Map Select
            difficulty_select: "난이도 선택",
            map_select: "작전 구역 선택",
            diff_recruit: "쉬움 (Easy)",
            diff_veteran: "보통 (Normal)",
            diff_elite: "어려움 (Hard)",
            back: "뒤로",
            next: "다음",
            map_plain: "평원",
            map_city: "도시",
            map_mountain: "산악",
            map_village: "마을",
            map_city_desc: "적 공세를 막아내며 버티는 전쟁",
            map_plain_desc: "넓은 들판을 밀어붙이는 소모전",
            map_mountain_desc: "기지가 먼저 무너지느냐가 관건",
            map_village_desc: "적의 수장을 먼저 제거하는 쪽이 승자",

            // Game UI
            enemy_analysis: "적군 정찰",
            spawn_indicator: "전진 기지 모드 (보병/드론)",
            return_hq: "본부 복귀",
            enemy_analysis_title: "적군 전력 분석",
            target_select: "목표 지점을 선택하십시오",
            mission_objective_btn: "임무 목표",
            mission_objective_title: "작전 목표",
            confirm: "확인",
            cmd_retreat: "후퇴",
            cmd_stop: "정지",
            cmd_attack: "공격",
            cmd_camera: "카메라",
            cmd_move: "이동",
            cmd_recon: "정찰",
            cmd_smoke: "연막",
            cmd_eject: "배출",
            hud_placeholder: "유닛/건물을 선택하세요",
            rotate_title: "가로 모드로 전환하세요",
            rotate_desc: "이 게임은 가로 모드에서만 플레이할 수 있습니다.",

            // [NEW] Mode Selection
            mode_pc: "PC 모드",
            mode_pc_desc: "원본 해상도 (전체 화면)",
            mode_mobile: "모바일 모드",
            mode_mobile_desc: "비율 유지 (짤림 방지)",

            // Options
            options_title: "환경 설정 (SETTINGS)",
            audio_settings: "오디오 설정",
            lang_settings: "언어 설정 (LANGUAGE)",
            lang_ko: "한국어",
            lang_en: "English",
            master_vol: "전체 볼륨",
            bgm_vol: "배경 음악",
            sfx_vol: "효과음",
            exit_game: "나가기",
            close: "닫기",
            back_to_lobby: "메인으로 복귀 (Back)", // [New]
            back_to_lobby_short: "메인으로",

            // Categories
            cat_all: "전체",
            cat_infantry: "보병",
            cat_armored: "기갑",
            cat_air: "공중",
            cat_drone: "드론",
            cat_special: "특수",

            // News Overlay
            news_location: "전장지대 민간 통제구역 | 14:02",
            news_breaking: "긴급속보",
            news_headline: "붉은네모국 대통령 특수군사작전 선포",
            news_ticker: "대규모 병력 이동 포착 / 주요 도로 마비 / 비상경계 상향 / 경제 불안 확산",


            // In-Game Messages
            msg_hq_captured: "본부 점령 완료!",
            msg_bunker_captured: "벙커 점령!",
            msg_bunker_lost: "벙커 함락!",
            msg_emp_ready: "EMP 준비 완료",
            msg_nuke_ready: "전술핵 투하 승인",
            msg_no_resource: "자원이 부족합니다.",

            // Exit Confirmation
            exit_confirm_title: "게임 종료",
            exit_confirm_desc: "정말 게임을 종료하시겠습니까?",
            yes: "예",
            no: "아니오",

            // Loading
            loading_system: "시스템 초기화 중...",
            loading_assets: "전술 데이터 로드 중...",
            loading_complete: "접속 준비 완료",
            click_to_start: "클릭하여 시작",

            // Units Names & Desc
            unit_infantry_name: "보병 분대",
            unit_infantry_desc: "기본 보병입니다. 다목적 전투 수행.",
            unit_engineer_name: "공병",
            unit_engineer_desc: "기갑/공중에는 유도 미사일, 보병에는 기관총으로 대응합니다.",
            unit_rpg_name: "로켓병",
            unit_rpg_desc: "장갑차량 공격에 효과적인 로켓 보병입니다.",
            unit_special_forces_name: "특수부대",
            unit_special_forces_desc: "은신/고화력을 갖춘 최정예 보병입니다.",
            unit_humvee_name: "전술 차량",
            unit_humvee_desc: "빠른 이동속도를 가진 정찰 및 지원 차량입니다.",
            unit_mbt_name: "주력 전차",
            unit_mbt_desc: "강력한 화력과 장갑을 갖춘 주력 전차입니다.",
            unit_spg_name: "자주포",
            unit_spg_desc: "원거리에서 적을 타격하는 포병 전력입니다.",
            unit_aa_tank_name: "대공 전차",
            unit_aa_tank_desc: "공중 유닛을 전문적으로 요격합니다.",
            unit_apc_name: "장갑차",
            unit_apc_desc: "보병을 수송하며 전투 지속력을 높입니다.",
            unit_apache_name: "공격 헬기",
            unit_apache_desc: "지상 목표물을 공격하는 공중 화력 지원 헬기입니다.",
            unit_fighter_name: "제공 전투기",
            unit_fighter_desc: "공중 제압을 위한 고속 전투기입니다 (대공/대공전차).",
            unit_bomber_name: "전략 폭격기",
            unit_bomber_desc: "융단 폭격을 통해 적 지상군을 초토화합니다.",
            unit_recon_name: "정찰기",
            unit_recon_desc: "고고도 정찰 드론. 적군 전력 분석 기능.",
            unit_drone_operator_name: "드론병",
            unit_drone_operator_desc: "드론을 운용하는 특수 보병입니다.",
            unit_drone_suicide_name: "자폭드론",
            unit_drone_suicide_desc: "적에게 돌진하여 자폭하는 소형 드론입니다.",
            unit_drone_at_name: "대전차드론",
            unit_drone_at_desc: "장갑 목표물에게 높은 피해를 주는 드론입니다.",
            unit_tactical_drone_name: "전술 드론",
            unit_stealth_drone_name: "스텔스 드론",
            unit_stealth_drone_desc: "지정 지점으로 고고도 침투 후 급강하 폭발합니다 (광역 피해).",
            unit_tactical_drone_desc: "특정 목표를 지정하여 타격하는 드론입니다.",
            unit_bomber_drone_name: "폭격 드론",
            unit_bomber_drone_desc: "지상 목표물에 폭탄을 투하하고 복귀합니다.",
            unit_emp_name: "EMP 충격파",
            unit_emp_desc: "적 기계 유닛을 일시적으로 마비시킵니다.",
            unit_nuke_name: "전술핵",
            unit_nuke_desc: "광범위한 지역을 파괴하는 최종 병기입니다.",
            unit_tactical_missile_name: "전술미사일",
            unit_tactical_missile_desc: "본부에서 발사되는 정밀 타격 미사일입니다.",
            unit_blackhawk_name: "UH-60 블랙호크",
            unit_blackhawk_desc: "특수부대 투입 후, 전장에 남아 화력을 지원합니다.",
            unit_chinook_name: "CH-47 치누크",
            unit_chinook_desc: "대규모 보병을 투입한 뒤, 신속히 이탈합니다.",

            // [3.8] 작업자/건설 이름
            unit_worker_name: "작업자",
            build_watchtower_name: "감시탑"
        },
        en: {
            // Main Menu
            title: "RECLAIM",
            subtitle: "Project: Restoration",
            campaign: "CAMPAIGN",
            campaign_desc: "Reclaim the lost territories",
            online: "MULTIPLAYER",
            online_desc: "Access Denied (Security Protocol)",
            settings: "SETTINGS",
            options: "SETTINGS",
            menu_play: "PLAY",
            menu_play_desc: "Start Operation",
            menu_unitdex: "UNIT ENCYCLOPEDIA",
            menu_unitdex_desc: "Unit Index",
            menu_uniteditor: "UNIT EDITOR",
            menu_uniteditor_desc: "Unit/Map Edit",
            menu_options: "OPTIONS",
            menu_options_desc: "Language & Audio",
            menu_exit: "GAME EXIT",
            menu_exit_desc: "Quit Game",
            project_title: "PROJECT: RECLAIM",
            start_operation: "Start Operation",

            // Map Select
            map_select: "SELECT OPERATION ZONE",
            diff_recruit: "Recruit",
            diff_veteran: "Veteran",
            diff_elite: "Elite",
            back: "Back",
            next: "Next",
            map_plain: "PLAINS",
            map_city: "CITY",
            map_mountain: "MOUNTAIN",
            map_village: "VILLAGE",
            map_beach: "BEACH",
            map_city_desc: "Hold the line against enemy assaults",
            map_plain_desc: "Push across wide plains in a war of attrition",
            map_mountain_desc: "The base that falls first decides the outcome",
            map_village_desc: "Strike the enemy leader first to claim victory",

            // Game UI
            enemy_analysis: "Reconnaissance",
            spawn_indicator: "Forward Base Mode",
            return_hq: "Return to HQ",
            enemy_analysis_title: "Enemy Analysis",
            target_select: "Select a target",
            mission_objective_btn: "Mission",
            mission_objective_title: "Mission Objective",
            confirm: "Confirm",
            cmd_retreat: "Retreat",
            cmd_stop: "Stop",
            cmd_attack: "Attack",
            cmd_camera: "Camera",
            cmd_move: "Move",
            cmd_recon: "Recon",
            cmd_smoke: "Smoke",
            cmd_eject: "Eject",
            hud_placeholder: "Select a unit/building",
            rotate_title: "Please rotate",
            rotate_desc: "This game is playable only in landscape mode.",

            // [NEW] Mode Selection
            mode_pc: "PC MODE",
            mode_pc_desc: "Full Resolution (Native)",
            mode_mobile: "MOBILE MODE",
            mode_mobile_desc: "Safe Aspect Ratio (Letterbox)",

            // Options
            options_title: "SETTINGS",
            audio_settings: "AUDIO CONFIG",
            lang_settings: "LANGUAGE",
            lang_ko: "Korean",
            lang_en: "English",
            master_vol: "Master Volume",
            bgm_vol: "BGM Volume",
            sfx_vol: "SFX Volume",
            exit_game: "Return to Main Menu",
            close: "Close",
            back_to_lobby_short: "Main Menu",

            // Categories
            cat_all: "All",
            cat_infantry: "Infantry",
            cat_armored: "Armored",
            cat_air: "Air",
            cat_drone: "Drone",
            cat_special: "Special",

            // News Overlay
            news_location: "Battle Zone Civil Control | 14:02",
            news_breaking: "Breaking",
            news_headline: "Special Military Operation Declared",
            news_ticker: "Troop movements detected / Major routes blocked / Alert level raised / Market volatility",

            // In-Game Messages
            msg_hq_captured: "HQ Secured!",
            msg_bunker_captured: "Bunker Captured!",
            msg_bunker_lost: "Bunker Lost!",
            msg_emp_ready: "EMP Ready",
            msg_nuke_ready: "Tactical Nuke Ready",
            msg_no_resource: "Insufficient Resources.",

            // Exit Confirmation
            exit_confirm_title: "Exit Game?",
            exit_confirm_desc: "Do you want to exit the game?",
            yes: "Yes",
            no: "No",

            // Loading
            loading_system: "Initializing System...",
            loading_assets: "Loading Tactical Data...",
            loading_complete: "Ready to Link",
            click_to_start: "Click to Start",

            // Units
            unit_infantry_name: "Infantry Squad",
            unit_infantry_desc: "Basic infantry unit. Versatile combatant.",
            unit_engineer_name: "Engineer",
            unit_engineer_desc: "Fires guided missiles at armor/air and uses a rifle versus infantry.",
            unit_rpg_name: "Rocket Trooper",
            unit_rpg_desc: "Specialized in anti-armor combat.",
            unit_special_forces_name: "Special Forces",
            unit_special_forces_desc: "Elite infantry with stealth and high DPS.",
            unit_humvee_name: "Humvee",
            unit_humvee_desc: "Fast tactical vehicle for recon and support.",
            unit_mbt_name: "Main Battle Tank",
            unit_mbt_desc: "Heavily armored tank with massive firepower.",
            unit_spg_name: "Artillery",
            unit_spg_desc: "Long-range indirect fire support.",
            unit_aa_tank_name: "AA Tank",
            unit_aa_tank_desc: "Specialized anti-air defense vehicle.",
            unit_apc_name: "APC",
            unit_apc_desc: "Armored personnel carrier. Deploys infantry on damage.",
            unit_apache_name: "Attack Helicopter",
            unit_apache_desc: "Air support unit attacking ground targets.",
            unit_fighter_name: "Jet Fighter",
            unit_fighter_desc: "High-speed air superiority fighter.",
            unit_bomber_name: "Strategic Bomber",
            unit_bomber_desc: "High-altitude carpet bombing run.",
            unit_recon_name: "Recon Drone",
            unit_recon_desc: "High-altitude reconnaissance. Reveals enemy force.",
            unit_drone_operator_name: "Drone Operator",
            unit_drone_operator_desc: "Operates drones and returns to rifle mode after recall.",
            unit_drone_suicide_name: "Suicide Drone",
            unit_drone_suicide_desc: "Cheap drone that explodes on contact.",
            unit_drone_at_name: "Anti-Tank Drone",
            unit_drone_at_desc: "Drone equipped with anti-armor warhead.",
            unit_tactical_drone_name: "Tactical Drone",
            unit_stealth_drone_name: "Stealth Drone",
            unit_stealth_drone_desc: "Flies high to a designated point, then dives and detonates with area damage.",
            unit_tactical_drone_desc: "Precision strike drone against specific targets.",
            unit_bomber_drone_name: "Bomber Drone",
            unit_bomber_drone_desc: "Drops bombs on targets and returns to base.",
            unit_emp_name: "EMP Blast",
            unit_emp_desc: "Disables mechanical units temporarily.",
            unit_nuke_name: "Tactical Nuke",
            unit_nuke_desc: "Devastating area-of-effect weapon.",
            unit_tactical_missile_name: "Tactical Missile",
            unit_tactical_missile_desc: "Precision strike missile launched from HQ.",
            unit_blackhawk_name: "UH-60 Blackhawk",
            unit_blackhawk_desc: "Deploys Special Forces and switches to combat mode.",
            unit_chinook_name: "CH-47 Chinook",
            unit_chinook_desc: "Deploys mass infantry, then ascends and exits.",

            // [3.8] Worker/Building names
            unit_worker_name: "Worker",
            build_watchtower_name: "Watchtower"
        }
    },

    getText(key) {
        return (this.data[this.current] && this.data[this.current][key]) || key;
    },

    setLang(lang) {
        if (this.data[lang]) {
            this.current = lang;
            this.updateDOM();
            // [NEW] Trigger dynamic UI refresh if game is running
            if (typeof ui !== 'undefined' && ui.updateUnitButtons) {
                // Force refresh of unit buttons text
                if (typeof game !== 'undefined' && game.renderUI) game.renderUI();
            }
        }
    },

    updateDOM() {
        document.querySelectorAll('[data-lang]').forEach(el => {
            const key = el.getAttribute('data-lang');
            el.innerText = this.getText(key);
        });
    }
};




