// [FILE] buildings.js: ?? ??? ??? ?? ??/?? ??? ??.
// [RULE] ?멸쾶???덈궡/?곹깭/梨꾪똿 硫붿떆吏??UI ?좎뒪??湲덉?. ChatPanel.push()濡쒕쭔 異쒕젰.
function resolveTeamColor(team, variant = 'primary') {
    if (typeof TeamColors !== 'undefined' && TeamColors && typeof TeamColors.get === 'function') {
        return TeamColors.get(team, variant);
    }
    if (team === 'player') return (variant === 'light') ? '#60a5fa' : '#3b82f6';
    if (team === 'enemy') return (variant === 'light') ? '#8cab43' : '#6b8e23';
    return '#64748b';
}

function resolveTeamOrNeutralColor(team, variant = 'primary') {
    if (team === 'neutral') return '#64748b';
    return resolveTeamColor(team, variant);
}

class Building extends Entity {
    constructor(type, x, y, team) {
        const data = CONFIG.buildings[type];
        super(x, y + (data.yOffset || 0), team, data.hp, data.width, data.height);
        this.type = type; this.name = data.name;
        this.canShoot = (data.canShoot === true) || (type === 'bunker' || type === 'turret');
        this.damage = data.damage || 0; this.range = data.range || 0;
        this.fireRate = data.rate || 0; this.lastShot = 0;
        this.captureProgress = 0;
        this.antiAir = data.antiAir || false;
        this.onlyAir = data.onlyAir || false;
        this.projectileType = data.projectileType || 'machinegun';
        this.allowAir = data.allowAir || false;
        this.ignoreDrone = data.ignoreDrone || false;
        this.airDamageMult = (data.airDamageMult == null) ? 1.0 : data.airDamageMult;
        this.requiresGarrison = (type === 'bunker');
        this.garrisonUnits = [];  // [NEW] ?щ윭 ?좊떅 二쇰몦 媛??
        this.maxGarrison = (type === 'bunker') ? 7 : 0;
        this.garrisonUnit = null; // [LEGACY] ?섏쐞 ?명솚??
        this.isDestroyed = false; // [NEW] ?꾩떆留??뚭눼 嫄대Ъ ?ъ젏??遺덇?
        this.hideHp = true;
        this.hpVisibleUntil = 0;
        this.destroyedAt = -1;
        this.hpBarExtra = data.hpBarExtra || 0;
        this.hpBarOffsetY = data.hpBarOffsetY || 0;
        this.stunTimer = 0;
        // [NEW] Destruction state
        this.destroying = false;
        this.destroyStartFrame = 0;
        this.destroyDuration = 0;
        this._deathFxSpawned = false;
    }

    _isInstantBunkerDestroyAttack(attackType) {
        const type = String(attackType || '').trim().toLowerCase();
        return (type === 'nuke' || type === 'tactical_missile' || type === 'fighter_missile');
    }

    _isHouseBunker() {
        return this.type === 'bunker' && (this.variant === 'luxury' || this.variant === 'legacy');
    }

    _syncBunkerGarrisonCap() {
        if (this.type !== 'bunker') return;
        const cap = this._isHouseBunker() ? 2 : 7;
        if (this.maxGarrison === cap) return;
        this.maxGarrison = cap;

        if (!Array.isArray(this.garrisonUnits)) {
            this.garrisonUnits = [];
        }
        if (this.garrisonUnits.length <= this.maxGarrison) return;

        const groundY = (typeof game !== 'undefined' && game.groundY) ? game.groundY : this.y;
        while (this.garrisonUnits.length > this.maxGarrison) {
            const unit = this.garrisonUnits.pop();
            if (!unit || unit.dead) continue;
            const allies = (unit.team === 'player') ? game.players : game.enemies;
            unit.x = this.x + this.width / 2 + 56;
            if (typeof game !== 'undefined' && game && typeof game.getGroundLaneY === 'function' && game.isGroundLaneUnit && game.isGroundLaneUnit(unit)) {
                unit.y = game.getGroundLaneY(unit);
            } else {
                unit.y = groundY;
            }
            this._markEjectedUnit(unit);
            if (!allies.includes(unit)) allies.push(unit);
        }
        this.garrisonUnit = this.garrisonUnits.length > 0 ? this.garrisonUnits[0] : null;
    }

    _markEjectedUnit(unit) {
        if (!unit) return;
        const nowFrame = (typeof game !== 'undefined' && Number.isFinite(game.frame))
            ? game.frame
            : 0;
        // Prevent immediate re-garrison right after eject.
        unit._bunkerEjectLockUntil = nowFrame + 90;
        unit.attackTarget = null;
    }

    _destroyBunkerInstant() {
        this.isDestroyed = true;
        this.ejectAllGarrison();
        this.team = 'neutral';
        this.hp = 0;
        this.captureProgress = 0;
        this.garrisonUnits = [];
        this.garrisonUnit = null;
        if (typeof game !== 'undefined'
            && game.selectedSpawn === this
            && typeof game.selectSpawn === 'function') {
            game.selectSpawn(null);
        }
    }

    takeDamage(amount, attackType = null) {
        let dmg = Number(amount);
        if (!Number.isFinite(dmg) || dmg <= 0) return;
        if (!Number.isFinite(this.hp)) {
            const fallbackHp = Number.isFinite(Number(this.maxHp)) ? Number(this.maxHp) : 1;
            this.hp = Math.max(1, fallbackHp);
        }

        // [NEW] ?쇨꺽 ??HP諛??쒖떆 + 3珥????④? ?덉빟(?쇨꺽???뚮쭏???곗옣)
        if (dmg > 0) {
            this.hideHp = false;
            this.hpVisibleUntil = game.frame + 180; // 60fps 湲곗? 3珥?
        }

        // [NEW] 二쇰몦 蹂대퀝 ?섏뿉 ?곕Ⅸ 諛⑹뼱??利앷? (蹂대퀝 1湲곕떦 5% ?쇳빐 媛먯냼, 理쒕? 35%)
        if (this.type === 'bunker' && this.garrisonUnits && this.garrisonUnits.length > 0) {
            const defenseBonus = Math.min(0.35, this.garrisonUnits.length * 0.05);
            dmg *= (1 - defenseBonus);
        }

        // [NEW] ??컻??怨듦꺽?몄? ?뺤씤 (?깊겕/??꺽湲?誘몄궗???쒕줎/?섎퉬 ??
        const explosiveAttacks = ['artillery', 'bomb', 'nuke', 'tactical_missile', 'fighter_missile', 'rocket', 'shell', 'engineer_missile', 'drone_explosion', 'humvee_burst'];
        const isExplosive = attackType && explosiveAttacks.includes(attackType);

        if (this.type === 'bunker') {
            if (this._isHouseBunker() && this._isInstantBunkerDestroyAttack(attackType)) {
                this._destroyBunkerInstant();
                return;
            }
            this.hp -= dmg;
            if (this.hp <= 0) {
                if (this._destroyOnBreak === true) {
                    this._destroyBunkerInstant();
                    return;
                }
                // [NEW] ??컻??怨듦꺽?쇰줈 ?뚭눼 ???ъ젏??遺덇? + ?뚭눼 ?곹깭濡?蹂寃?
                if (isExplosive) {
                    this._destroyBunkerInstant();
                    return;
                }

                // 蹂대퀝 怨듦꺽: 湲곗〈泥섎읆 以묐┰?붾쭔 (?ъ젏??媛??
                this.ejectAllGarrison();
                this.team = 'neutral';
                this.hp = this.maxHp * 0.2;
                this.captureProgress = 0;
                this.garrisonUnits = [];
                this.garrisonUnit = null;
                if (game.selectedSpawn === this) game.selectSpawn(null);
            }
        } else {
            if (this.destroying) return;
            this.hp -= dmg;
            if (this.hp <= 0) {
                this.hp = 0;
                if (this.garrisonUnits && this.garrisonUnits.length > 0) {
                    this.ejectAllGarrison();
                }
                this.garrisonUnits = [];
                this.garrisonUnit = null;

                // [NEW] Start destruction animation instead of instant vanish
                this.destroying = true;
                this.destroyStartFrame = game.frame || 0;
                this.destroyDuration = (String(this.type || '').includes('hq')) ? 90 : 55;

                // FX + SFX (once)
                if (!this._deathFxSpawned && game.spawnBuildingDestructionFX) {
                    this._deathFxSpawned = true;
                    game.spawnBuildingDestructionFX(this);
                }

                // [NEW] Trigger Total War on Enemy Turret Death (keep behavior)
                if (this.type === 'turret' && this.team === 'enemy') {
                    if (game.triggerTotalWar) game.triggerTotalWar();
                }
            }
        }
    }

    update(enemies, players) {
        // [NEW] 留덉?留??쇨꺽 ?댄썑 3珥?吏?섎㈃ HP諛??ㅼ떆 ?④? (?? ?좏깮 以묒씠硫??좎?)
        const isSelected = (typeof game !== 'undefined' && game.selectedBuilding === this);
        if (isSelected) {
            this.hideHp = false;
        } else if (this.hpVisibleUntil > 0 && game.frame > this.hpVisibleUntil) {
            this.hideHp = true;
        }
        if (this.dead) return;
        // [NEW] While destroying: stop logic/shooting, wait then remove
        if (this.destroying) {
            const dt = (game.frame || 0) - (this.destroyStartFrame || 0);
            if (dt >= (this.destroyDuration || 0)) {
                this.dead = true;
            }
            return;
        }

        if (this.type === 'bunker') {
            this._syncBunkerGarrisonCap();
            // [NEW] ?꾩떆留듭뿉???뚭눼??嫄대Ъ? ?ъ젏??遺덇?
            if (this.isDestroyed) {
                this.captureProgress = 0;
                return;  // ???댁긽 濡쒖쭅 泥섎━ ?덊븿
            }

            const prevTeam = this.team;
            let pCount = 0, eCount = 0;
            // [FIX] cannotCapture ?먮뒗 移대찓?쇰㎤? ?먮졊?먯꽌 ?쒖쇅
            players.forEach(u => { if (u && !u.dead && Math.abs(u.x - this.x) < 200 && u.stats && !u.stats.type.includes('air') && !u.stats.cannotCapture && !u.isCameraman) pCount++; });
            enemies.forEach(u => { if (u && !u.dead && Math.abs(u.x - this.x) < 200 && u.stats && !u.stats.type.includes('air')) eCount++; });

            if (pCount > eCount) this.captureProgress += 0.5;
            else if (eCount > pCount) this.captureProgress -= 0.5;

            if (pCount === 0 && eCount === 0 && this.team === 'neutral') {
                if (this.captureProgress > 0) this.captureProgress -= 0.1;
                if (this.captureProgress < 0) this.captureProgress += 0.1;
            }

            this.captureProgress = Math.max(-100, Math.min(100, this.captureProgress));

            if (this.captureProgress >= 100 && this.team !== 'player') {
                if (this.garrisonUnits && this.garrisonUnits.length > 0) {
                    this.ejectAllGarrison();
                }
                this.team = 'player'; this.hp = this.maxHp;
            } else if (this.captureProgress <= -100 && this.team !== 'enemy') {
                if (this.garrisonUnits && this.garrisonUnits.length > 0) {
                    this.ejectAllGarrison();
                }
                this.team = 'enemy'; this.hp = this.maxHp;
                if (game.selectedSpawn === this) game.selectSpawn(null);
            }

            if (this.team !== prevTeam) {
                if (this.garrisonUnits && this.garrisonUnits.length > 0) {
                    this.ejectAllGarrison();
                }
                this.garrisonUnits = [];
                this.garrisonUnit = null;
            }
        }

        // [NEW] 嫄곗젏(踰숈빱) garrison: 吏묐え??踰숈빱 2湲?/ ?쇰컲 踰숈빱 7湲?
        if (this.requiresGarrison) {
            // 諛곗뿴 珥덇린???뺤씤
            if (!this.garrisonUnits) this.garrisonUnits = [];
            const nowFrame = (typeof game !== 'undefined' && Number.isFinite(game.frame))
                ? game.frame
                : 0;

            if (this.team === 'neutral' || this.isDestroyed) {
                // 以묐┰?닿굅???뚭눼??嫄대Ъ?대㈃ 二쇰몦 ?좊떅 ?놁쓬
                if (this.garrisonUnits.length > 0) {
                    this.ejectAllGarrison();
                }
                this.garrisonUnit = null;
            } else if (this.garrisonUnits.length < this.maxGarrison) {
                // 理쒕? 二쇰몦 ?섏뿉 ?꾨떖?섏? ?딆븯?쇰㈃ 異붽? 二쇰몦 ?쒕룄
                const allies = (this.team === 'player') ? players : enemies;
                const candidates = [];

                for (const u of allies) {
                    if (!u || u.dead || !u.stats) continue;
                    if (u.stats.operator) continue;
                    if (u.stats.id && u.stats.id.includes('drone')) continue;
                    if (u.stats.type !== 'bio') continue;
                    if (u.stats.category !== 'infantry') continue;
                    if ((Number(u._bunkerEjectLockUntil) || 0) > nowFrame) continue;
                    const dx = Math.abs(u.x - this.x);
                    const dy = Math.abs(u.y - this.y);
                    if (dx < (this.width * 0.6 + 10) && dy < 40) {
                        candidates.push(u);
                    }
                }

                // 媛?ν븳 留뚰겮 二쇰몦
                for (const candidate of candidates) {
                    if (this.garrisonUnits.length >= this.maxGarrison) break;

                    this.garrisonUnits.push(candidate);
                    const idx = allies.indexOf(candidate);
                    if (idx >= 0) allies.splice(idx, 1);
                    if (typeof game !== 'undefined' && game.selectedUnits) {
                        game.selectedUnits.delete(candidate);
                    }
                }

                // [LEGACY] ?섏쐞 ?명솚: 泥?踰덉㎏ ?좊떅??garrisonUnit?먮룄 ???
                this.garrisonUnit = this.garrisonUnits.length > 0 ? this.garrisonUnits[0] : null;
            }
        }

        const canFire = this.canShoot && this.team !== 'neutral' && (!this.requiresGarrison || (this.garrisonUnits && this.garrisonUnits.length > 0));
        if (canFire) {
            const extraCivilians = (this.team === 'enemy' && typeof game !== 'undefined' && Array.isArray(game.civilians) && game.civilians.length)
                ? game.civilians
                : null;
            const targets = this.team === 'player'
                ? enemies
                : (extraCivilians ? players.concat(extraCivilians) : players);
            let target = null;
            let minDist = this.range;

            // [CHANGE] antiAir硫?=?곕젢/?怨듭떆?? 怨듭쨷 ?寃??곗꽑 ?먯깋
            if (this.antiAir) {
                const airTarget = targets.find(t => !t.dead && t.stats && !t.stats.invulnerable && Math.abs(t.x - this.x) < this.range && t.stats.type === 'air');
                if (airTarget) target = airTarget;
            }

            if (!target) {
                for (let t of targets) {
                    if (!t || t.dead) continue;
                    if (t.stats && t.stats.invulnerable) continue;
                    if (this.ignoreDrone && t.stats && !t.stats.operator && (t.stats.category === 'drone' || (t.stats.id && t.stats.id.includes('drone')))) continue;
                    if (this.onlyAir && t.stats && t.stats.type !== 'air') continue;
                    if (!this.antiAir && t.stats && t.stats.type === 'air' && !this.allowAir) continue;
                    const dist = Math.abs(t.x - this.x);
                    if (dist < minDist) { minDist = dist; target = t; }
                }
            }

            // [NEW] 踰숈빱 ?대? 怨듬퀝 誘몄궗??1諛??덉슜
            if (this.type === 'bunker' && target && this.garrisonUnits && this.garrisonUnits.length > 0) {
                if (game.frame - this.lastShot > this.fireRate) {
                    const targetType = target.stats ? target.stats.type : null;
                    const targetId = target.stats ? target.stats.id : null;
                    const isDrone = targetId && (targetId.includes('drone') || targetId === 'tactical_drone');
                    const isArmoredOrAir = targetType === 'mech' || targetType === 'air';

                    const isEngineerMissileLocked = (t) => {
                        if (!t || t.dead) return false;
                        const lock = t._engMissileLock;
                        if (!lock) return false;
                        if (lock.team && lock.team !== this.team) return false;
                        if (Number.isFinite(lock.until) && game.frame > lock.until) {
                            t._engMissileLock = null;
                            return false;
                        }
                        return true;
                    };

                    const lockEngineerMissile = (t) => {
                        if (!t) return;
                        t._engMissileLock = {
                            team: this.team,
                            until: game.frame + 96
                        };
                    };

                    if (isArmoredOrAir && !isDrone && !isEngineerMissileLocked(target)) {
                        const shooter = this.garrisonUnits.find(u =>
                            u && !u.dead && (u.stats?.id === 'engineer' || u.stats?.id === 'rpg') && u.missileReady !== false
                        );
                        if (shooter) {
                            lockEngineerMissile(target);
                            const missileDmgRaw = Number(shooter.stats?.missileDamage);
                            const missileDmg = (Number.isFinite(missileDmgRaw) && missileDmgRaw > 0) ? missileDmgRaw : 120;
                            game.projectiles.push(new Projectile(this.x, this.y - this.height / 2, target, missileDmg, this.team, 'engineer_missile', { source: this }));
                            shooter.missileReady = false; // 1諛??쒗븳
                            this.lastShot = game.frame;
                            return;
                        }
                    }
                }
            }

            if (target && game.frame - this.lastShot > this.fireRate) {
                if (this.team === 'enemy' && game.empTimer > 0) return;
                if (this.stunTimer > 0) return;

                // Fire Projectile
                // If Projectile class is loaded via projectiles.js, this works.
                let dmg = this.damage;
                if (target && target.stats && target.stats.type === 'air' && !this.antiAir) {
                    dmg = Math.floor(dmg * this.airDamageMult);
                }
                if (this.antiAir && target && target.stats && target.stats.id === 'bomber') dmg *= 2.0;
                let spawnY = this.y - this.height / 2;
                if (this.type === 'watchtower') {
                    spawnY = this.y - this.height + 35;
                }
                game.projectiles.push(new Projectile(this.x, spawnY, target, dmg, this.team, this.projectileType, { source: this }));
                this.lastShot = game.frame;

                // 건물 발사음(flak): 벙커/초소는 거의 항상 재생되도록 확률 상향.
                if (typeof AudioSystem !== 'undefined') {
                    const buildingSoundId = (this.type === 'watchtower') ? 'watchtower' : 'flak_turret';
                    const soundChance = (this.type === 'watchtower' || this.type === 'bunker') ? 0.95 : 0.70;
                    if (Math.random() < soundChance) {
                        AudioSystem.playGun('flak', this.x, { unitId: buildingSoundId, sourceUnit: this });
                    }
                }
            }
        }

        if (this.stunTimer > 0) {
            this.stunTimer--;
            if (game.frame % 20 === 0) game.createParticles(this.x, this.y, 1, '#60a5fa');
        }
    }

    // [NEW] 紐⑤뱺 二쇰몦 ?좊떅 諛곗텧
    ejectAllGarrison() {
        if (!this.garrisonUnits || this.garrisonUnits.length === 0) return;

        const spreadOffset = 36;
        const baseOut = (this.width / 2) + 52;
        const groundY = (typeof game !== 'undefined' && game.groundY) ? game.groundY : this.y;

        for (let i = 0; i < this.garrisonUnits.length; i++) {
            const unit = this.garrisonUnits[i];
            if (!unit || unit.dead) continue;

            // [FIX] ?좊떅?????湲곗??쇰줈 ?щ컮瑜?諛곗뿴??異붽?
            const allies = (unit.team === 'player') ? game.players : game.enemies;

            const offsetDir = (i % 2 === 0) ? 1 : -1;
            const offsetStep = Math.floor(i / 2) * spreadOffset;
            unit.x = this.x + offsetDir * (baseOut + offsetStep);
            if (typeof game !== 'undefined' && game && typeof game.getGroundLaneY === 'function' && game.isGroundLaneUnit && game.isGroundLaneUnit(unit)) {
                unit.y = game.getGroundLaneY(unit);
            } else {
                unit.y = groundY;
            }
            this._markEjectedUnit(unit);

            // ?좊떅 諛곗뿴???ㅼ떆 異붽?
            if (!allies.includes(unit)) {
                allies.push(unit);
            }
        }

        this.garrisonUnits = [];
        this.garrisonUnit = null;
    }

    // [NEW] ?뱀젙 ?좊떅 ???1湲곕쭔 諛곗텧
    ejectOneByType(unitType) {
        if (!this.garrisonUnits || this.garrisonUnits.length === 0) return;

        const groundY = (typeof game !== 'undefined' && game.groundY) ? game.groundY : this.y;

        // ?대떦 ??낆쓽 ?좊떅 李얘린
        const idx = this.garrisonUnits.findIndex(u => u && !u.dead && u.stats?.id === unitType);
        if (idx === -1) return;

        const unit = this.garrisonUnits[idx];

        // [FIX] ?좊떅?????湲곗??쇰줈 ?щ컮瑜?諛곗뿴??異붽?
        const allies = (unit.team === 'player') ? game.players : game.enemies;

        // 諛곗뿴?먯꽌 ?쒓굅
        this.garrisonUnits.splice(idx, 1);

        // 嫄대Ъ 諛붽묑 ?덉쟾嫄곕━濡?諛곗텧
        unit.x = this.x + this.width / 2 + 56;
        if (typeof game !== 'undefined' && game && typeof game.getGroundLaneY === 'function' && game.isGroundLaneUnit && game.isGroundLaneUnit(unit)) {
            unit.y = game.getGroundLaneY(unit);
        } else {
            unit.y = groundY;
        }
        this._markEjectedUnit(unit);

        // ?좊떅 諛곗뿴???ㅼ떆 異붽?
        if (!allies.includes(unit)) {
            allies.push(unit);
        }

        // ?섏쐞 ?명솚???낅뜲?댄듃
        this.garrisonUnit = this.garrisonUnits.length > 0 ? this.garrisonUnits[0] : null;
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.save(); ctx.translate(this.x, this.y);

        // [NEW] Destruction visual (fade + slight shake)
        if (this.destroying) {
            const dt = (game.frame || 0) - (this.destroyStartFrame || 0);
            const dur = Math.max(1, this.destroyDuration || 1);
            const k = Math.max(0, Math.min(1, dt / dur));
            ctx.globalAlpha = 1 - k;
            const j = (1 - k) * 2;
            ctx.translate((Math.random() - 0.5) * j, (Math.random() - 0.5) * j);
        }

        // [REMOVED] Bunker Spawn UI
        if (this.type.includes('hq')) {
            // [NEW] 吏꾩쭨 珥앹궗?밸?(?꾨갑) ?꾩슜 ?붿옄?? hq_player / hq_enemy (?移?
            if (this.type === 'hq_player' || this.type === 'hq_enemy') {
                const time = game.frame;
                const isEnemy = (this.team === 'enemy');

                const COLORS = {
                    base: '#3E4C59',
                    dark: '#232F3E',
                    light: '#52606D',
                    accent: resolveTeamColor(this.team),
                    metal: '#95A5A6',
                    glass: '#85C1E9',
                    flag: resolveTeamColor(this.team, 'dark'),
                    turret: '#2C3E50'
                };

                const w = this.width;
                const h = this.height;

                // 濡쒖뺄 湲곗???吏硫?: (0,0)
                const cx = 0;
                const cy = 0;

                // [NEW] ?곴뎔 珥앹궗?밸???醫뚯슦 諛섏쟾(?移?
                ctx.save();
                if (isEnemy) ctx.scale(-1, 1);

                // ?묒? 源껊컻
                const drawSmallFlag = (x, y) => {
                    const poleHeight = 40;
                    const flagWidth = 30;
                    const flagHeight = 18;
                    ctx.fillStyle = '#BDC3C7';
                    ctx.fillRect(x - 1, y - poleHeight, 2, poleHeight);
                    ctx.fillStyle = COLORS.flag;
                    ctx.beginPath();
                    const startX = x + 1;
                    const startY = y - poleHeight + 2;
                    ctx.moveTo(startX, startY);
                    for (let i = 0; i <= flagWidth; i += 2) {
                        const wave = Math.sin((time * 0.2) + (i * 0.3)) * 2;
                        ctx.lineTo(startX + i, startY + wave * (i / flagWidth));
                    }
                    const finalWave = Math.sin((time * 0.2) + (flagWidth * 0.3)) * 2;
                    ctx.lineTo(startX + flagWidth, startY + flagHeight + finalWave);
                    for (let i = flagWidth; i >= 0; i -= 2) {
                        const wave = Math.sin((time * 0.2) + (i * 0.3)) * 2;
                        ctx.lineTo(startX + i, startY + flagHeight + wave * (i / flagWidth));
                    }
                    ctx.closePath();
                    ctx.fill();
                };

                // ?꾨???諛⑹뼱 ?ы깙(?쒓컖)
                const drawModernTurret = (x, y) => {
                    ctx.save();
                    ctx.translate(x, y);
                    const angle = Math.sin(time * 0.03) * 0.1;
                    ctx.fillStyle = COLORS.turret;
                    ctx.fillRect(-15, 0, 30, 10);
                    ctx.rotate(angle);
                    ctx.fillStyle = '#34495E';
                    ctx.beginPath();
                    ctx.moveTo(-10, 0);
                    ctx.lineTo(-12, -15);
                    ctx.lineTo(12, -15);
                    ctx.lineTo(10, 0);
                    ctx.fill();
                    ctx.fillStyle = '#111';
                    ctx.fillRect(5, -12, 25, 4);
                    ctx.fillRect(5, -8, 25, 4);
                    ctx.fillStyle = '#E74C3C';
                    ctx.fillRect(0, -10, 3, 3);
                    ctx.restore();
                };

                // 誘몄궗??諛고꽣由??쒓컖)
                const drawMissileBattery = (x, y) => {
                    ctx.fillStyle = COLORS.metal;
                    ctx.fillRect(x - 15, y - 20, 30, 20);
                    ctx.fillStyle = '#111';
                    for (let i = 0; i < 3; i++) {
                        for (let j = 0; j < 2; j++) {
                            ctx.beginPath();
                            ctx.arc(x - 10 + i * 10, y - 15 + j * 8, 3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    ctx.fillStyle = COLORS.light;
                    ctx.beginPath();
                    ctx.moveTo(x - 15, y - 20);
                    ctx.lineTo(x + 15, y - 25);
                    ctx.lineTo(x + 15, y - 20);
                    ctx.fill();
                };

                // -------- 蹂몄껜 諛곗튂 (?뚮옯??+ 硫붿씤 ???醫? + 諛⑹뼱????) --------
                // 諛붾떏 ?뚮옯??
                ctx.fillStyle = '#2C3E50';
                ctx.fillRect(cx - w * 1.0, cy, w * 2.0, 18);

                // 硫붿씤 ???醫뚯륫)
                const mainX = cx - w * 0.75;
                const mainW = w * 0.70;
                const mainH = h * 1.25;
                ctx.fillStyle = COLORS.base;
                ctx.fillRect(mainX, cy - mainH, mainW, mainH);
                ctx.fillStyle = COLORS.light;
                ctx.fillRect(mainX, cy - mainH, 5, mainH);
                ctx.fillRect(mainX, cy - mainH, mainW, 5);

                // ?듭쑀由?李?
                ctx.fillStyle = COLORS.glass;
                ctx.fillRect(mainX + 10, cy - mainH + 20, mainW - 20, 30);
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath();
                ctx.moveTo(mainX + 10, cy - mainH + 50);
                ctx.lineTo(mainX + mainW - 10, cy - mainH + 20);
                ctx.stroke();

                // ?묒? 臾?
                ctx.fillStyle = '#111';
                ctx.fillRect(mainX + mainW * 0.42, cy - 30, 20, 30);
                ctx.fillStyle = '#555';
                ctx.fillRect(mainX + mainW * 0.42 - 2, cy - 32, 24, 2);

                // ?곌껐遺
                ctx.fillStyle = COLORS.dark;
                ctx.fillRect(mainX + mainW, cy - 80, 20, 80);

                // 諛⑹뼱???곗륫 ?щ떎由ш섦)
                const defX = cx + w * 0.05;
                const defW = w * 0.90;
                const defH = h * 0.75;
                ctx.fillStyle = COLORS.base;
                ctx.beginPath();
                ctx.moveTo(defX, cy);
                ctx.lineTo(defX, cy - defH);
                ctx.lineTo(defX + defW - 20, cy - defH);
                ctx.lineTo(defX + defW, cy);
                ctx.fill();
                ctx.strokeStyle = '#2c3e50';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(defX, cy - defH / 2);
                ctx.lineTo(defX + defW - 10, cy - defH / 2);
                ctx.stroke();

                // ?μ긽: 源껊컻 + ?쇱꽌
                drawSmallFlag(mainX + mainW / 2, cy - mainH);
                ctx.fillStyle = '#333';
                ctx.fillRect(mainX + 20, cy - mainH - 10, 10, 10);
                ctx.fillStyle = COLORS.accent;
                ctx.fillRect(mainX + 26, cy - mainH - 8, 2, 2);

                // ?μ긽: ?怨듯룷??2媛??쒓컖)
                drawModernTurret(defX + defW * 0.35, cy - defH);
                drawModernTurret(defX + defW * 0.70, cy - defH);

                // 以묎컙 ?고겕: 誘몄궗???щ?
                drawMissileBattery(mainX + mainW + 10, cy - 80);

                // 諛⑹뼱??寃쎄퀬??
                const blink = Math.sin(time * 0.1) > 0;
                ctx.fillStyle = blink ? '#E74C3C' : '#550000';
                ctx.beginPath();
                ctx.arc(defX + defW - 10, cy - 20, 3, 0, Math.PI * 2);
                ctx.fill();

                // ?낃뎄 議곕챸
                ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
                ctx.beginPath();
                ctx.moveTo(mainX + mainW * 0.5, cy - 30);
                ctx.lineTo(mainX + mainW * 0.38, cy);
                ctx.lineTo(mainX + mainW * 0.62, cy);
                ctx.fill();

                // [NEW] 誘몃윭 ?댁젣
                ctx.restore();

                ctx.restore();
                this.drawHp(ctx);
                return;
            }

            ctx.fillStyle = this.team === 'player' ? '#1e3a8a' : '#7f1d1d';
            ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
            ctx.fillStyle = resolveTeamColor(this.team);
            ctx.fillRect(-this.width / 2 + 10, -this.height + 20, this.width - 20, 20);
            ctx.strokeStyle = '#64748b'; ctx.beginPath(); ctx.moveTo(0, -this.height); ctx.lineTo(0, -this.height - 40); ctx.stroke();
            if (game.frame % 60 < 30) { ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(0, -this.height - 40, 2, 0, Math.PI * 2); ctx.fill(); }
        }
        else if (this.type === 'defense_line') {
            // Defense line (visual + blocker)
            const time = game.frame || 0;
            const colors = {
                concrete: '#3f4652',
                concreteLight: '#555e6d',
                concreteDark: '#2b3038',
                metal: '#1a1d23',
                highlight: '#4facfe',
                danger: '#ff4b4b',
                warning: '#f0ad4e'
            };

            const BASE_W = 1010;
            const BASE_H = 360;
            let scale = Math.min((this.width || 320) / BASE_W, (this.height || 140) / BASE_H);
            scale *= 1.2;

            const CENTER_X = 205;

            ctx.save();
            if (this.team === 'enemy') ctx.scale(-1, 1);
            ctx.scale(scale, scale);
            ctx.translate(-CENTER_X, 0);

            const drawPolygon = (points, color, strokeColor = null) => {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                if (strokeColor) {
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            };

            // 1) Fortress main body
            const mainBody = [
                { x: -300, y: 0 },
                { x: 150, y: 0 },
                { x: 80, y: -250 },
                { x: -250, y: -250 },
                { x: -300, y: 0 }
            ];
            drawPolygon(mainBody, colors.concrete, colors.concreteDark);

            // Detail line
            ctx.fillStyle = colors.concreteDark;
            ctx.fillRect(-200, -200, 200, 10);

            // Command window glow
            ctx.save();
            ctx.fillStyle = colors.highlight;
            ctx.globalAlpha = 0.8 + Math.sin(time * 0.08) * 0.2;
            ctx.fillRect(-150, -220, 100, 10);
            ctx.restore();

            // 2) Watchtower
            const towerX = 250;
            const towerH = -350;
            ctx.strokeStyle = colors.concreteLight;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(towerX - 20, 0); ctx.lineTo(towerX - 10, towerH);
            ctx.moveTo(towerX + 20, 0); ctx.lineTo(towerX + 10, towerH);
            for (let i = 0; i > towerH; i -= 50) {
                ctx.moveTo(towerX - 20, i);
                ctx.lineTo(towerX + 20, i - 50);
                ctx.moveTo(towerX + 20, i);
                ctx.lineTo(towerX - 20, i - 50);
            }
            ctx.stroke();

            // Watchtower cabin
            ctx.fillStyle = colors.concrete;
            ctx.fillRect(towerX - 30, towerH - 40, 60, 40);
            ctx.fillStyle = colors.concreteDark;
            ctx.fillRect(towerX - 35, towerH - 45, 70, 5);

            // Searchlight sweep
            ctx.save();
            ctx.translate(towerX, towerH - 20);
            const baseAngle = -Math.PI / 2.2;
            const sweepRange = 0.3;
            const angle = baseAngle + Math.sin(time * 0.05) * sweepRange;
            ctx.rotate(angle);
            const grad = ctx.createLinearGradient(0, 0, 0, 450);
            grad.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
            grad.addColorStop(1, 'rgba(255, 255, 200, 0)');
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-50, 450);
            ctx.lineTo(50, 450);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();

            // Tower beacon blink
            if (Math.sin(time * 0.2) > 0) {
                ctx.fillStyle = colors.danger;
                ctx.beginPath();
                ctx.arc(towerX, towerH - 50, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // 3) Iron fence
            const fenceStart = 350;
            const fenceEnd = 500;
            const fenceHeight = -80;
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = fenceStart; x <= fenceEnd; x += 30) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, fenceHeight);
            }
            ctx.moveTo(fenceStart, fenceHeight);
            ctx.lineTo(fenceEnd, fenceHeight);
            ctx.moveTo(fenceStart, fenceHeight / 2);
            ctx.lineTo(fenceEnd, fenceHeight / 2);
            ctx.lineWidth = 1;
            for (let x = fenceStart; x < fenceEnd; x += 15) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x + 15, fenceHeight);
                ctx.moveTo(x + 15, 0);
                ctx.lineTo(x, fenceHeight);
            }
            ctx.stroke();

            // Razor wire
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let x = fenceStart; x < fenceEnd; x += 10) {
                ctx.arc(x + 5, fenceHeight - 5, 8, 0, Math.PI * 2);
            }
            ctx.stroke();

            // 4) Barricades (dragon's teeth)
            const barricadeStart = 550;
            ctx.fillStyle = colors.concreteLight;
            for (let i = 0; i < 3; i++) {
                const bx = barricadeStart + (i * 60);
                ctx.beginPath();
                ctx.moveTo(bx, 0);
                ctx.lineTo(bx + 20, -40);
                ctx.lineTo(bx + 40, 0);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.moveTo(bx + 20, -40);
                ctx.lineTo(bx + 40, 0);
                ctx.lineTo(bx + 20, 0);
                ctx.fill();
                ctx.fillStyle = colors.concreteLight;
            }

            // Ground line
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-400, 0);
            ctx.lineTo(800, 0);
            ctx.stroke();

            ctx.restore();
        }
        else if (this.type === 'fortress_player' || this.type === 'fortress_enemy') {
            // [Modern Fortress Structure Only]
            const time = game.frame;
            const isEnemy = (this.team === 'enemy');
            const colors = {
                concrete: '#3f4652',
                concreteLight: '#555e6d',
                concreteDark: '#2b3038',
                highlight: '#4facfe',
                danger: '#ff4b4b',
                warning: '#f0ad4e'
            };

            // [FIX] ?대━怨??먮낯 ?ㅼ젣 ?ш린 湲곗? + 異붽? 0.5 異뺤냼
            const BASE_W = 560;
            const BASE_H = 320;
            let scale = Math.min((this.width || 120) / BASE_W, (this.height || 90) / BASE_H);
            scale *= 1.35;

            // [NEW] ?뚯쟾 ?덉씠???됱긽: ?꾧뎔=?뚮옉, ?곴뎔=鍮④컯
            const radarColor = isEnemy ? '#ff4b4b' : '#4facfe';
            const blinkColor = radarColor;
            ctx.save();
            ctx.scale(scale, scale);

            const drawPolygon = (points, color, strokeColor = null) => {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                if (strokeColor) {
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            };

            // 1. 硫붿씤 援ъ“臾?(踰숈빱 蹂몄껜)
            const mainBody = [
                { x: -300, y: 0 },
                { x: 200, y: 0 },
                { x: 100, y: -250 },
                { x: -250, y: -250 },
                { x: -300, y: 0 }
            ];
            drawPolygon(mainBody, colors.concrete, colors.concreteDark);

            // 1-1. ?κ컩???뷀뀒??(?ъ꽑 ?⑦꽩)
            ctx.strokeStyle = colors.concreteLight;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(180, 0); ctx.lineTo(90, -220);
            ctx.moveTo(100, 0); ctx.lineTo(10, -220);
            ctx.moveTo(20, 0); ctx.lineTo(-70, -220);
            ctx.stroke();

            // 2. ?꾨㈃ 異붽? ?κ컩 (Reactive Armor)
            const frontArmor = [
                { x: 200, y: 0 },
                { x: 260, y: 0 },
                { x: 220, y: -100 },
                { x: 160, y: -100 }
            ];
            drawPolygon(frontArmor, colors.concreteDark, '#111');

            // 3. ?곷떒 吏???듭젣??(Command Center)
            const commandCenter = [
                { x: -200, y: -250 },
                { x: 0, y: -250 },
                { x: -20, y: -320 },
                { x: -180, y: -320 }
            ];
            drawPolygon(commandCenter, colors.concreteLight, colors.concreteDark);

            // 李쎈Ц
            ctx.fillStyle = `rgba(79, 172, 254, ${0.5 + Math.sin(time * 3) * 0.2})`;
            ctx.fillRect(-160, -290, 120, 15);

            // 4. ?덉씠???덊뀒??(?쇱꽌留??좎?)
            const radarX = -100;
            const radarY = -320;
            const radarAngle = time * 2;
            ctx.save();
            ctx.translate(radarX - 40, radarY - 40);
            ctx.fillStyle = '#444';
            ctx.fillRect(-5, 0, 10, 30);
            ctx.scale(Math.cos(radarAngle), 1);
            ctx.beginPath();
            ctx.ellipse(0, -15, 30, 10, 0, 0, Math.PI * 2);
            ctx.fillStyle = radarColor;
            ctx.fill();
            ctx.restore();

            // ?쇱꽌 ??
            ctx.fillStyle = colors.concreteDark;
            ctx.beginPath();
            ctx.arc(radarX, radarY - 10, 15, Math.PI, 0);
            ctx.fill();

            // ?듭떊 ?덊뀒??
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(radarX, radarY - 25);
            ctx.lineTo(radarX, radarY - 60);
            ctx.stroke();

            // ?덊뀒????源쒕묀??
            const blink = Math.sin(time * 10) > 0;
            if (blink) {
                ctx.fillStyle = blinkColor;
                ctx.beginPath();
                ctx.arc(radarX, radarY - 60, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
        else if (this.type === 'watchtower') {
            const isEnemy = (this.team === 'enemy');
            const currentMapId = String((typeof game !== 'undefined' && game && game.currentMapId) || '').trim();
            const useCoastStyle = (this._coastEmplacement === true) || (currentMapId === 'skirmish_coast');

            ctx.save();
            if (isEnemy) ctx.scale(-1, 1);

            if (useCoastStyle) {
                const sx = this.width / 160;
                const sy = this.height / 90;
                ctx.scale(sx, sy);

                const cx = 0;
                const groundY = 0;

                // Ground plate
                ctx.fillStyle = '#3f4348';
                ctx.fillRect(cx - 80, groundY - 12, 160, 12);

                // Horizontal bunker hull
                ctx.fillStyle = '#5b6268';
                ctx.beginPath();
                ctx.moveTo(cx - 76, groundY - 58);
                ctx.lineTo(cx + 54, groundY - 58);
                ctx.lineTo(cx + 76, groundY - 44);
                ctx.lineTo(cx + 70, groundY - 18);
                ctx.lineTo(cx - 78, groundY - 18);
                ctx.closePath();
                ctx.fill();

                // Roof slab
                ctx.fillStyle = '#6a7278';
                ctx.fillRect(cx - 60, groundY - 66, 98, 10);

                // Rear armor block
                ctx.fillStyle = '#4a5055';
                ctx.fillRect(cx - 78, groundY - 52, 16, 34);

                // Firing slits
                ctx.fillStyle = '#15181b';
                ctx.fillRect(cx - 46, groundY - 46, 18, 5);
                ctx.fillRect(cx - 20, groundY - 43, 16, 4);
                ctx.fillRect(cx + 6, groundY - 40, 14, 4);

                // MG mount + barrel
                ctx.fillStyle = '#262c31';
                ctx.fillRect(cx + 34, groundY - 49, 22, 14);
                ctx.fillRect(cx + 56, groundY - 44, 44, 6);
                ctx.fillRect(cx + 98, groundY - 45, 6, 8);

                // Shoulder shield
                ctx.fillStyle = '#495157';
                ctx.fillRect(cx + 28, groundY - 55, 10, 18);
            } else {
                const sx = this.width / 90;
                const sy = this.height / 220;
                ctx.scale(sx, sy);

                const cx = 0;
                const groundY = 0;

                ctx.fillStyle = '#555';
                ctx.fillRect(cx - 25, groundY - 150, 50, 150);
                ctx.fillStyle = '#444';
                ctx.fillRect(cx - 45, groundY - 150, 90, 10);
                ctx.fillStyle = '#111';
                ctx.fillRect(cx + 25, groundY - 185, 35, 6);
                ctx.fillRect(cx + 55, groundY - 187, 8, 10);
                ctx.fillStyle = '#666';
                ctx.fillRect(cx - 40, groundY - 210, 80, 60);
                ctx.fillStyle = '#333';
                ctx.fillRect(cx + 20, groundY - 220, 20, 70);
                ctx.fillStyle = '#111';
                ctx.fillRect(cx + 20, groundY - 195, 20, 5);
                ctx.fillStyle = '#444';
                ctx.fillRect(cx - 45, groundY - 220, 90, 10);
            }

            ctx.restore();
            ctx.restore();
            this.drawHp(ctx);
            return;
        }
        else if (this.type === 'spawn_flag_player') {
            const time = Number(game.frame) || 0;
            const w = this.width || 72;
            const h = this.height || 96;
            const halfW = w * 0.5;
            const poleTop = -h * 0.95;
            const wave = Math.sin(time * 0.08) * 3;

            // Base stand
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(-halfW * 0.75, -8, halfW * 1.5, 8);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-halfW * 0.58, -h * 0.34, halfW * 1.16, h * 0.34);

            // Pole
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(-2, poleTop, 4, h * 0.95);

            // Flag cloth
            ctx.fillStyle = '#0ea5e9';
            ctx.beginPath();
            ctx.moveTo(2, poleTop + 10);
            ctx.lineTo(halfW * 0.88 + wave, poleTop + 20);
            ctx.lineTo(halfW * 0.72 + wave * 0.7, poleTop + 42);
            ctx.lineTo(2, poleTop + 32);
            ctx.closePath();
            ctx.fill();

            // Emblem dot
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.arc(halfW * 0.27, poleTop + 27, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        else if (this.type === 'bunker') {
            const drawDestroyedFallback = (scale = 1) => {
                const w = 80 * scale;
                const h = 60 * scale;
                ctx.fillStyle = '#1f2937';
                ctx.fillRect(-w / 2, -h * 0.45, w, h * 0.45);
                ctx.fillStyle = '#334155';
                ctx.fillRect(-w / 2, -h * 0.72, w * 0.7, h * 0.3);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-w * 0.14, -h * 0.38, w * 0.28, h * 0.14);
                ctx.fillStyle = '#475569';
                ctx.fillRect(-w * 0.48, -3, w * 0.96, 6);
            };

            if (this.isDestroyed) {
                drawDestroyedFallback(1);
                ctx.restore();
                return;
            }

            ctx.fillStyle = '#334155';
            ctx.fillRect(-40, -60, 80, 60);

            if (this.team === 'neutral') {
                if (this.captureProgress !== 0) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(-40, -70, 80, 6);
                    if (this.captureProgress > 0) {
                        ctx.fillStyle = resolveTeamColor('player');
                        ctx.fillRect(-40, -70, 80 * (this.captureProgress / 100), 6);
                    } else if (this.captureProgress < 0) {
                        ctx.fillStyle = resolveTeamColor('enemy');
                        ctx.fillRect(40 + (80 * (this.captureProgress / 100)), -70, -80 * (this.captureProgress / 100), 6);
                    }
                }
            } else {
                const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
                ctx.fillStyle = '#000';
                ctx.fillRect(-40, -70, 80, 6);
                ctx.fillStyle = hpRatio > 0.3 ? '#22c55e' : resolveTeamColor('enemy');
                ctx.fillRect(-40, -70, 80 * hpRatio, 6);
            }

            ctx.fillStyle = resolveTeamOrNeutralColor(this.team);
            ctx.beginPath();
            ctx.moveTo(-45, -60);
            ctx.lineTo(0, -80);
            ctx.lineTo(45, -60);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-10, -40, 20, 10);

            const garrisonCount = this.garrisonUnits ? this.garrisonUnits.length : 0;
            const isSelected = (typeof game !== 'undefined' && game.selectedBuilding === this);
            if (garrisonCount > 0 || isSelected) {
                const teamColor = resolveTeamOrNeutralColor(this.team);

                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.fillRect(-30, -95, 60, 18);
                ctx.strokeStyle = teamColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(-30, -95, 60, 18);

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${garrisonCount}/${this.maxGarrison}`, 0, -86);

                if (garrisonCount > 0) {
                    const defBonus = Math.min(35, garrisonCount * 5);
                    ctx.fillStyle = '#4ade80';
                    ctx.font = '8px sans-serif';
                    ctx.fillText(`+${defBonus}% DEF`, 0, -72);
                }
            }
        }
        else if (this.type === 'turret') {
            ctx.fillStyle = '#334155'; ctx.fillRect(-20, -40, 40, 40);
            ctx.fillStyle = resolveTeamColor(this.team, 'light');
            ctx.beginPath(); ctx.arc(0, -45, 20, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(this.team === 'player' ? 30 : -30, -55); ctx.stroke();
        }
        // ============================================
        // [NEW] ?뚮젅?댁뼱 嫄댁꽕 嫄대Ъ ?뚮뜑留?
        // ============================================
        else if (this.type === 'barracks') {
            // 蹂대퀝留됱궗 - 援곗궗 留됱궗 ?ㅽ???
            const w = this.width;
            const h = this.height;
            const teamColor = resolveTeamColor(this.team);

            // 硫붿씤 嫄대Ъ
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(-w / 2, -h, w, h);

            // 吏遺?
            ctx.fillStyle = '#374151';
            ctx.beginPath();
            ctx.moveTo(-w / 2 - 5, -h);
            ctx.lineTo(0, -h - 20);
            ctx.lineTo(w / 2 + 5, -h);
            ctx.closePath();
            ctx.fill();

            // 臾?
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(-15, -40, 30, 40);

            // 李쎈Ц??
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(-w / 2 + 10, -h + 15, 20, 15);
            ctx.fillRect(w / 2 - 30, -h + 15, 20, 15);

            // ? ?됱긽 留덊겕
            ctx.fillStyle = teamColor;
            ctx.fillRect(-w / 2, -h, 5, h);
            ctx.fillRect(w / 2 - 5, -h, 5, h);
        }
        // [3.8] watchtower_new ?뚮뜑留??쒓굅??- ?댁젣 watchtower ????ъ슜
        else if (this.type === 'tank_depot') {
            // ?꾩감湲곗? - ???李쎄퀬/李④퀬 ?ㅽ???
            const w = this.width;
            const h = this.height;
            const teamColor = resolveTeamColor(this.team);

            // 硫붿씤 嫄대Ъ (???
            ctx.fillStyle = '#374151';
            ctx.fillRect(-w / 2, -h, w, h);

            // 李쎄퀬 臾?(???뷀꽣)
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(-w / 2 + 20, -h / 2, w - 40, h / 2);

            // ?뷀꽣 ?쇱씤
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 2;
            for (let i = 1; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(-w / 2 + 20, -h / 2 + i * 10);
                ctx.lineTo(w / 2 - 20, -h / 2 + i * 10);
                ctx.stroke();
            }

            // 吏遺?
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(-w / 2 - 5, -h - 10, w + 10, 15);

            // 援대슍
            ctx.fillStyle = '#6b7280';
            ctx.fillRect(w / 2 - 30, -h - 30, 15, 25);

            // ? ?됱긽 ?쒖떆
            ctx.fillStyle = teamColor;
            ctx.fillRect(-w / 2, -h, w, 5);

            // ?깊겕 ?꾩씠肄?(臾???
            ctx.fillStyle = teamColor;
            ctx.fillRect(-20, -h + 20, 40, 8);
            ctx.fillRect(-10, -h + 15, 30, 5);
        }
        ctx.restore();
        // [FIX] bunker ??낆? draw ?대??먯꽌 ?먮졊/泥대젰 諛붾? 吏곸젒 洹몃━誘濡?drawHp ?몄텧 ?덊븿
        if (this.type !== 'bunker') {
            this.drawHp(ctx);
        }
    }
}
