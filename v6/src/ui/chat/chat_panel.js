// [FILE] chat_panel.js: ?? ? ???/?? ??? ???? ?? ?? UI.
// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
// ============================================
// Chat Panel System (Ver R 4.3)
// 좌하단 반투명 회색 로그창
// ============================================

const ChatPanel = {
    // Keep LOG panel disabled in-game.
    enabled: false,
    maxLines: 80,
    autoScroll: true,
    isOpen: true,
    lines: [],
    _bound: false,

    // DOM 캐시
    _panel: null,
    _body: null,
    _list: null,
    _toggleBtn: null,
    _clearBtn: null,

    /**
     * 초기화: DOM 요소 캐싱 및 이벤트 바인딩
     */
    init(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        this._panel = document.getElementById('chat-panel');
        this._body = document.getElementById('chat-body');
        this._list = document.getElementById('chat-list');
        this._toggleBtn = document.getElementById('chat-toggle-btn');
        this._clearBtn = document.getElementById('chat-clear-btn');

        if (!this._panel) {
            console.warn('[ChatPanel] #chat-panel not found');
            return;
        }

        if (this.enabled !== true) {
            this.hide();
            return;
        }

        if (!this._bound) {
            // 축소(접기) 버튼 이벤트
            if (this._clearBtn) {
                this._clearBtn.addEventListener('click', () => this.setOpen(false));
            }

            // 축소 상태의 채팅 버튼 이벤트 (열기)
            if (this._toggleBtn) {
                this._toggleBtn.addEventListener('click', () => this.setOpen(true));
            }

            this._bound = true;
        }

        // 초기 상태 (기본 닫힘, 옵션으로 열림 유지 가능)
        this.setOpen(opts.open === true);
    },

    /**
     * 메시지 추가
     * @param {string} msg - 표시할 메시지
     * @param {string} type - 'SYS' | 'WARN' | 'ERR' | 'INFO' (기본: 'SYS')
     */
    push(msg, type = 'SYS') {
        if (this.enabled !== true) return;
        if (!this._list) return;

        // 타임스탬프 (선택적)
        const now = new Date();
        const time = this._formatDateTime(now);

        // 라인 생성
        const line = document.createElement('div');
        line.className = `chat-line ${type.toLowerCase()}`;
        line.innerHTML = `<span class="chat-time">[${time}]</span> ${this._escapeHtml(msg)}`;

        // 추가
        this._list.appendChild(line);
        this.lines.push({ msg, type, time });

        // 최대 라인 수 초과 시 오래된 것 제거
        while (this._list.children.length > this.maxLines) {
            this._list.removeChild(this._list.firstChild);
            this.lines.shift();
        }

        // 자동 스크롤
        if (this.autoScroll && this._body) {
            this._body.scrollTop = this._body.scrollHeight;
        }
    },

    /**
     * 패널 열기/닫기 토글
     */
    toggle() {
        if (this.enabled !== true) {
            this.hide();
            return;
        }
        this.setOpen(!this.isOpen);
    },

    /**
     * 패널 열기/닫기 설정
     * @param {boolean} open
     */
    setOpen(open) {
        if (this.enabled !== true) {
            this.hide();
            return;
        }
        this.isOpen = open;
        if (!this._panel) return;

        if (open) {
            this._panel.classList.remove('is-collapsed');
            if (this._clearBtn) {
                this._clearBtn.innerText = '<';
                this._clearBtn.title = '닫기';
            }
            if (this._toggleBtn) this._toggleBtn.title = '열기';
        } else {
            this._panel.classList.add('is-collapsed');
            if (this._clearBtn) {
                this._clearBtn.innerText = '<';
                this._clearBtn.title = '닫기';
            }
            if (this._toggleBtn) this._toggleBtn.title = '열기';
        }
    },

    /**
     * 모든 메시지 클리어
     */
    clear() {
        if (!this._list) return;
        this._list.innerHTML = '';
        this.lines = [];
    },

    /**
     * 패널 표시
     */
    show() {
        if (this.enabled !== true) {
            this.hide();
            return;
        }
        if (this._panel) this._panel.classList.remove('hidden');
    },

    /**
     * 패널 숨김
     */
    hide() {
        if (this._panel) this._panel.classList.add('hidden');
    },

    /**
     * HTML 이스케이프
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    _formatDateTime(date) {
        const d = (date instanceof Date) ? date : new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${hh}:${mm}`;
    }
};

// 전역 등록
window.ChatPanel = ChatPanel;
