// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
// ============================================
// Chat Panel System (Ver R 4.3)
// 좌하단 반투명 회색 로그창
// ============================================

const ChatPanel = {
    maxLines: 80,
    autoScroll: true,
    isOpen: true,
    lines: [],

    // DOM 캐시
    _panel: null,
    _body: null,
    _list: null,
    _toggleBtn: null,
    _clearBtn: null,

    /**
     * 초기화: DOM 요소 캐싱 및 이벤트 바인딩
     */
    init() {
        this._panel = document.getElementById('chat-panel');
        this._body = document.getElementById('chat-body');
        this._list = document.getElementById('chat-list');
        this._toggleBtn = document.getElementById('chat-toggle-btn');
        this._clearBtn = document.getElementById('chat-clear-btn');

        if (!this._panel) {
            console.warn('[ChatPanel] #chat-panel not found');
            return;
        }

        // 토글 버튼 이벤트
        if (this._toggleBtn) {
            this._toggleBtn.addEventListener('click', () => this.toggle());
        }

        // 클리어 버튼 이벤트
        if (this._clearBtn) {
            this._clearBtn.addEventListener('click', () => this.clear());
        }

        // 초기 상태 (열림)
        this.setOpen(true);

        console.log('[ChatPanel] Initialized');
    },

    /**
     * 메시지 추가
     * @param {string} msg - 표시할 메시지
     * @param {string} type - 'SYS' | 'WARN' | 'ERR' | 'INFO' (기본: 'SYS')
     */
    push(msg, type = 'SYS') {
        if (!this._list) return;

        // 타임스탬프 (선택적)
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

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
        this.setOpen(!this.isOpen);
    },

    /**
     * 패널 열기/닫기 설정
     * @param {boolean} open
     */
    setOpen(open) {
        this.isOpen = open;
        if (!this._panel) return;

        if (open) {
            this._panel.classList.remove('is-collapsed');
            if (this._toggleBtn) this._toggleBtn.innerText = '−';
        } else {
            this._panel.classList.add('is-collapsed');
            if (this._toggleBtn) this._toggleBtn.innerText = '+';
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
    }
};

// 전역 등록
window.ChatPanel = ChatPanel;
