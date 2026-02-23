// src/entities/entity.js - 모든 게임 엔티티의 기본 클래스
// [분리] classes.js에서 추출

class Entity {
    constructor(x, y, team, hp, width, height) {
        this.x = x;
        this.y = y;
        this.team = team;
        this.maxHp = hp;
        this.hp = hp;
        this.width = width;
        this.height = height;
        this.dead = false;
        this.hideHp = false;
    }

    drawHp(ctx) {
        if (this.dead) return;
        if (this.hideHp) return;

        const alwaysShow = (typeof game !== 'undefined' && game.selectedBuilding === this);
        const w = this.width;
        const h = 3;
        const extra = (this.hpBarExtra || 0);
        const y = this.y - this.height - 8 - extra + (this.hpBarOffsetY || 0);

        // 배경 바
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(this.x - w / 2, y, w, h);

        // HP 바 (팀별 색상)
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.team === 'player' ? '#2563eb' :
                       (this.team === 'enemy' ? '#dc2626' :
                       (this.team === 'neutral' ? '#94a3b8' : '#eab308'));
        ctx.fillRect(this.x - w / 2, y, w * pct, h);

        // 선택된 건물은 HP 수치 표시
        if (alwaysShow) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.floor(this.hp)} / ${this.maxHp}`, this.x, y - 8);
        }
    }

    takeDamage(damage) {
        if (this.dead) return;
        this.hp -= damage;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
        }
    }
}
