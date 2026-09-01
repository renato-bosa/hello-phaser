/**
 * EnemyManager - Gerencia inimigos (sapos, seahorse, boneco, toupeira)
 * Responsável por: criação, patrulha, pulo, colisão e morte de inimigos
 * Sapos: tomate (patrulha larga), roxo (patrulha curta + salto médio), verde (parado + salto alto)
 */
class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = null;
        this.bubbles = null;
    }

    create(enemyData) {
        this.enemies = this.scene.physics.add.group();
        this.bubbles = this.scene.physics.add.group();

        enemyData.forEach(e => {
            if (e.type === 'sapo-verde') {
                this._createSapoVerde(e.x, e.y);
            } else if (e.type === 'sapo-roxo') {
                this._createSapoRoxo(e.x, e.y);
            } else if (e.type === 'sapo-chefe-laranja') {
                this._createSapoChefeLaranja(e.x, e.y);
            } else if (e.type === 'sapo') {
                this._createSapo(e.x, e.y);
            } else if (e.type === 'seahorse') {
                this._createSeahorse(e.x, e.y);
            } else if (e.type === 'boneco') {
                this._createBoneco(e);
            } else if (e.type === 'toupeira') {
                this._createToupeira(e);
            } else if (e.type === 'toupeira-chefe') {
                this._createToupeiraChefe(e);
            }
        });
    }

    _createToupeira(data) {
        const scene = this.scene;
        const cfg = GC.ENEMY.TOUPEIRA;
        const mole = scene.physics.add.sprite(data.x, data.y, data.holeTexture, 0);

        mole.body.setSize(cfg.BODY_WIDTH, cfg.BODY_HEIGHT);
        mole.body.setOffset(cfg.BODY_OFFSET_X, cfg.BODY_OFFSET_Y);
        mole.body.allowGravity = false;
        mole.body.setCollideWorldBounds(true);
        mole.body.checkCollision.none = true;
        mole.body.moves = false;
        mole.body.enable = false;

        if (data.transform) {
            mole.setFlipX(!!data.transform.flipX);
            mole.setFlipY(!!data.transform.flipY);
            if (data.transform.rotation) mole.setAngle(data.transform.rotation);
        }

        mole.patrolData = {
            type: 'toupeira',
            state: 'hidden',
            holeTexture: data.holeTexture,
            holeTransform: data.transform || null,
            activationDistanceSq: cfg.ACTIVATION_DISTANCE * cfg.ACTIVATION_DISTANCE,
            emergeAt: 0,
            speed: cfg.SPEED,
            direction: 1,
            lastStepJumpAt: 0
        };

        this.enemies.add(mole);
    }

    _activateToupeira(mole, data, currentTime) {
        if (data.state !== 'hidden') return;
        data.state = 'emerging';
        data.emergeAt = currentTime + GC.ENEMY.TOUPEIRA.EMERGE_DELAY_MS;
        mole.setFrame(1);
    }

    _startToupeiraChase(mole, data, player) {
        const scene = this.scene;
        const cfg = GC.ENEMY.TOUPEIRA;
        data.state = 'chasing';

        // O marcador do Tiled representa tamb?m o buraco permanente. Quando a
        // toupeira come?a a andar, recria o frame 0 atr?s dela para n?o levar
        // o buraco junto ao trocar a textura do inimigo.
        const hole = scene.add.sprite(mole.x, mole.y, data.holeTexture, 0);
        // Mant?m o buraco acima do mapa, mas atr?s da toupeira e do jogador.
        hole.setDepth(GC.DEPTH.PLAYER - 2);
        if (data.holeTransform) {
            hole.setFlipX(!!data.holeTransform.flipX);
            hole.setFlipY(!!data.holeTransform.flipY);
            if (data.holeTransform.rotation) hole.setAngle(data.holeTransform.rotation);
        }
        data.hole = hole;

        mole.setTexture('toupeira-walk', 0);
        // Escala a partir dos p?s, como o boneco, sem enterrar o sprite.
        mole.y += mole.height / 2;
        mole.setOrigin(0.5, 1);
        mole.setScale(cfg.SCALE);
        mole.setDepth(GC.DEPTH.PLAYER - 1);
        mole.body.enable = true;
        mole.body.moves = true;
        mole.body.allowGravity = true;
        mole.body.checkCollision.none = false;
        mole.body.setSize(cfg.BODY_WIDTH, cfg.BODY_HEIGHT);
        mole.body.setOffset(cfg.BODY_OFFSET_X, cfg.BODY_OFFSET_Y);

        if (!scene.anims.exists('toupeira-walk')) {
            scene.anims.create({
                key: 'toupeira-walk',
                frames: scene.anims.generateFrameNumbers('toupeira-walk', { start: 0, end: 3 }),
                frameRate: cfg.ANIM_FPS,
                repeat: -1
            });
        }
        mole.anims.play('toupeira-walk', true);

        data.direction = player && player.x < mole.x ? -1 : 1;
        mole.setFlipX(data.direction === -1);
        mole.setVelocityX(data.speed * data.direction);
    }

    _updateToupeira(mole, data, player, currentTime, onGround) {
        if (!player || !player.active) return;

        if (data.state === 'hidden') {
            const dx = player.x - mole.x;
            const dy = player.y - mole.y;
            if (dx * dx + dy * dy < data.activationDistanceSq) {
                this._activateToupeira(mole, data, currentTime);
            }
            return;
        }

        if (data.state === 'emerging') {
            if (currentTime >= data.emergeAt) {
                this._startToupeiraChase(mole, data, player);
            }
            return;
        }

        const desiredDirection = player.x < mole.x ? -1 : 1;
        data.direction = desiredDirection;
        mole.setFlipX(desiredDirection === -1);

        if (onGround) {
            const blockedAhead = desiredDirection > 0
                ? mole.body.blocked.right
                : mole.body.blocked.left;
            const terrainCfg = GC.ENEMY.TOUPEIRA;
            const terrain = this._analyzeToupeiraTerrainAhead(mole, desiredDirection, blockedAhead, terrainCfg);

            if (terrain.kind === 'deep_hole') {
                mole.setVelocityX(0);
                return;
            }

            if (terrain.kind === 'step_up') {
                const tileSize = this._getTileSize();
                const jumpHeight = terrain.jumpHeightPx
                    ?? (tileSize * terrain.stepTiles + terrainCfg.STEP_JUMP_MARGIN_PX);
                const cooldown = terrainCfg.STEP_JUMP_COOLDOWN_MS;
                if (currentTime - data.lastStepJumpAt >= cooldown) {
                    mole.setVelocityY(this._computeStepJumpForce(jumpHeight));
                    data.lastStepJumpAt = currentTime;
                }
            }
            // shallow_hole e clear: segue andando (cai ou continua reto).
        }

        mole.setVelocityX(data.speed * desiredDirection);
    }

    _createToupeiraChefe(spawn) {
        const scene = this.scene;
        const cfg = GC.ENEMY.TOUPEIRA_CHEFE;
        const holes = (spawn.holes && spawn.holes.length)
            ? spawn.holes.slice()
            : [{ x: spawn.x, y: spawn.y }];

        let startHole = holes[0];
        let bestDist = Infinity;
        holes.forEach(h => {
            const d = (h.x - spawn.x) ** 2 + (h.y - spawn.y) ** 2;
            if (d < bestDist) {
                bestDist = d;
                startHole = h;
            }
        });

        const mole = scene.physics.add.sprite(startHole.x, startHole.y, cfg.WALK_TEXTURE, 0);
        mole.setOrigin(0.5, 1);
        mole.setScale(cfg.SCALE);
        mole.setAlpha(0);
        mole.setDepth(GC.DEPTH.PLAYER - 1);
        mole.body.setSize(cfg.BODY_WIDTH, cfg.BODY_HEIGHT);
        mole.body.setOffset(cfg.BODY_OFFSET_X, cfg.BODY_OFFSET_Y);
        mole.body.allowGravity = false;
        mole.body.setCollideWorldBounds(true);
        mole.body.checkCollision.none = true;
        mole.body.moves = false;
        mole.body.enable = false;

        mole.patrolData = {
            type: 'toupeira-chefe',
            state: 'hidden',
            bossCfg: cfg,
            holes,
            currentHole: startHole,
            activationDistanceSq: cfg.ACTIVATION_DISTANCE * cfg.ACTIVATION_DISTANCE,
            emergeAt: 0,
            speed: cfg.SPEED,
            baseSpeed: cfg.SPEED,
            direction: 1,
            health: cfg.MAX_HEALTH,
            hitsTaken: 0,
            stateUntil: 0,
            nextFlashAt: 0,
            flashOn: false,
            lastStepJumpAt: 0,
            electricGraphics: null
        };

        this.enemies.add(mole);
    }

    _updateToupeiraChefe(mole, data, player, currentTime, onGround) {
        if (!player || !player.active) return;
        if (data.state === 'dying') return;

        if (data.state === 'hidden') {
            const dx = player.x - mole.x;
            const dy = player.y - mole.y;
            if (dx * dx + dy * dy < data.activationDistanceSq) {
                this._scheduleToupeiraChefeEmerge(mole, data, currentTime, 'chasing');
            }
            return;
        }

        if (data.state === 'emerging') {
            if (currentTime >= data.emergeAt) {
                this._emergeToupeiraChefe(mole, data, player, data.emergeInto || 'chasing');
            }
            return;
        }

        if (data.state === 'burrowing') {
            mole.setVelocity(0, 0);
            if (currentTime >= data.emergeAt) {
                const nextHole = this._pickOtherHole(data);
                data.currentHole = nextHole;
                mole.setPosition(nextHole.x, nextHole.y);
                this._scheduleToupeiraChefeEmerge(mole, data, currentTime, 'attack');
            }
            return;
        }

        if (data.state === 'crushed') {
            mole.setVelocityX(0);
            this._flashBoss(mole, data, currentTime, 0xffffff, 0xcc8844);
            if (currentTime >= data.stateUntil) {
                const cfg = data.bossCfg;
                data.state = 'fleeing';
                data.fleeHole = this._nearestHole(data, mole.x, mole.y);
                data.speed = data.baseSpeed * cfg.FLEE_SPEED_MULTIPLIER;
                data.direction = data.fleeHole.x < mole.x ? -1 : 1;
                mole.setFlipX(data.direction === -1);
                mole.clearTint();
                mole.anims.resume();
                mole.setScale(cfg.SCALE);
                mole.setVelocityX(data.speed * data.direction);
            }
            return;
        }

        if (data.state === 'fleeing') {
            this._updateToupeiraChefeFlee(mole, data, currentTime);
            return;
        }

        if (data.state === 'attack') {
            this._flashBoss(mole, data, currentTime, 0xd8ffff, 0xffffd8, false);
            this._updateBossElectricEffect(mole, data);
            this._chaseLikeToupeira(mole, data, player, onGround);
            if (currentTime >= data.stateUntil) {
                data.state = 'chasing';
                data.stateUntil = 0;
                data.speed = data.baseSpeed;
                data.flashOn = false;
                mole.clearTint();
                this._stopBossElectricEffect(data);
                mole.setScale(data.bossCfg.SCALE);
            }
            return;
        }

        // chasing
        this._chaseLikeToupeira(mole, data, player, onGround);
    }

    _chaseLikeToupeira(mole, data, player, onGround) {
        const desiredDirection = player.x < mole.x ? -1 : 1;
        data.direction = desiredDirection;
        mole.setFlipX(desiredDirection === -1);

        if (onGround) {
            const blockedAhead = desiredDirection > 0
                ? mole.body.blocked.right
                : mole.body.blocked.left;
            // Chefe usa os próprios limites de degrau/queda; toupeira comum cai no default.
            const terrainCfg = data.bossCfg || GC.ENEMY.TOUPEIRA;
            const terrain = this._analyzeToupeiraTerrainAhead(mole, desiredDirection, blockedAhead, terrainCfg);

            if (terrain.kind === 'deep_hole') {
                mole.setVelocityX(0);
                return;
            }

            if (terrain.kind === 'step_up') {
                const tileSize = this._getTileSize();
                const jumpHeight = terrain.jumpHeightPx
                    ?? (tileSize * terrain.stepTiles
                        + (terrainCfg.STEP_JUMP_MARGIN_PX ?? GC.ENEMY.TOUPEIRA.STEP_JUMP_MARGIN_PX));
                const cooldown = terrainCfg.STEP_JUMP_COOLDOWN_MS ?? GC.ENEMY.TOUPEIRA.STEP_JUMP_COOLDOWN_MS;
                const now = this.scene.time.now;
                if (now - data.lastStepJumpAt >= cooldown) {
                    mole.setVelocityY(this._computeStepJumpForce(jumpHeight));
                    data.lastStepJumpAt = now;
                }
            }
        }

        mole.setVelocityX(data.speed * desiredDirection);
    }

    _updateToupeiraChefeFlee(mole, data, currentTime) {
        const target = data.fleeHole || data.currentHole;
        if (!target) {
            this._enterToupeiraChefeBurrow(mole, data, currentTime);
            return;
        }

        const dx = target.x - mole.x;
        data.direction = dx < 0 ? -1 : 1;
        mole.setFlipX(data.direction === -1);

        const onGround = mole.body.blocked.down;
        if (onGround) {
            const blockedAhead = data.direction > 0
                ? mole.body.blocked.right
                : mole.body.blocked.left;
            const terrainCfg = data.bossCfg;
            const terrain = this._analyzeToupeiraTerrainAhead(mole, data.direction, blockedAhead, terrainCfg);
            if (terrain.kind === 'step_up') {
                const tileSize = this._getTileSize();
                const jumpHeight = terrain.jumpHeightPx
                    ?? (tileSize * terrain.stepTiles + terrainCfg.STEP_JUMP_MARGIN_PX);
                if (currentTime - data.lastStepJumpAt >= terrainCfg.STEP_JUMP_COOLDOWN_MS) {
                    mole.setVelocityY(this._computeStepJumpForce(jumpHeight));
                    data.lastStepJumpAt = currentTime;
                }
            }
        }

        mole.setVelocityX(data.speed * data.direction);

        if (Math.abs(dx) <= data.bossCfg.HOLE_REACH_DISTANCE) {
            this._enterToupeiraChefeBurrow(mole, data, currentTime);
        }
    }

    _enterToupeiraChefeBurrow(mole, data, currentTime) {
        const cfg = data.bossCfg;
        const hole = data.fleeHole || data.currentHole;
        data.currentHole = hole;
        data.state = 'burrowing';
        data.emergeAt = currentTime + cfg.REAPPEAR_DELAY_MS;
        this._stopBossElectricEffect(data);
        mole.clearTint();
        mole.anims.stop();
        mole.setVelocity(0, 0);
        mole.setAlpha(0);
        mole.body.enable = false;
        mole.body.moves = false;
        mole.body.allowGravity = false;
        mole.body.checkCollision.none = true;
        if (hole) mole.setPosition(hole.x, hole.y);
    }

    _scheduleToupeiraChefeEmerge(mole, data, currentTime, nextState) {
        const cfg = data.bossCfg;
        data.state = 'emerging';
        data.emergeAt = currentTime + cfg.EMERGE_SHAKE_MS;
        data.emergeInto = nextState;
        this.scene.cameras.main.shake(cfg.EMERGE_SHAKE_MS, cfg.EMERGE_SHAKE_INTENSITY);
    }

    _emergeToupeiraChefe(mole, data, player, nextState) {
        const cfg = data.bossCfg;
        const hole = data.currentHole || { x: mole.x, y: mole.y };

        mole.setPosition(hole.x, hole.y);
        mole.setOrigin(0.5, 1);
        mole.setTexture(cfg.WALK_TEXTURE, 0);
        mole.setScale(cfg.SCALE * 0.45);
        mole.setAlpha(0);
        mole.setDepth(GC.DEPTH.PLAYER - 1);

        mole.body.enable = true;
        mole.body.moves = true;
        mole.body.allowGravity = true;
        mole.body.checkCollision.none = false;
        mole.body.setSize(cfg.BODY_WIDTH, cfg.BODY_HEIGHT);
        mole.body.setOffset(cfg.BODY_OFFSET_X, cfg.BODY_OFFSET_Y);

        if (!this.scene.anims.exists(cfg.WALK_ANIM)) {
            this.scene.anims.create({
                key: cfg.WALK_ANIM,
                frames: this.scene.anims.generateFrameNumbers(cfg.WALK_TEXTURE, {
                    start: 0,
                    end: cfg.FRAME_END
                }),
                frameRate: cfg.ANIM_FPS,
                repeat: -1
            });
        }
        mole.anims.play(cfg.WALK_ANIM, true);

        data.direction = player && player.x < mole.x ? -1 : 1;
        mole.setFlipX(data.direction === -1);

        this.scene.tweens.add({
            targets: mole,
            alpha: 1,
            scaleX: nextState === 'attack' ? cfg.ATTACK_SCALE_X : cfg.SCALE,
            scaleY: nextState === 'attack' ? cfg.ATTACK_SCALE_Y : cfg.SCALE,
            duration: cfg.EMERGE_PROCEDURAL_MS,
            ease: 'Back.easeOut'
        });

        if (nextState === 'attack') {
            data.state = 'attack';
            const attackDuration = cfg.ATTACK_BASE_DURATION_MS *
                Math.pow(cfg.ATTACK_DURATION_GROWTH, Math.max(0, data.hitsTaken - 1));
            data.stateUntil = this.scene.time.now + attackDuration;
            data.speed = data.baseSpeed * cfg.ATTACK_SPEED_MULTIPLIER;
            this._startBossElectricEffect(mole, data);
        } else {
            data.state = 'chasing';
            data.speed = data.baseSpeed;
        }

        mole.setVelocityX(data.speed * data.direction);
        data.emergeInto = null;
    }

    _pickOtherHole(data) {
        const holes = data.holes || [];
        if (holes.length <= 1) return data.currentHole || holes[0];
        const others = holes.filter(h => h !== data.currentHole &&
            !(data.currentHole && h.x === data.currentHole.x && h.y === data.currentHole.y));
        const pool = others.length ? others : holes;
        return Phaser.Utils.Array.GetRandom(pool);
    }

    _nearestHole(data, x, y) {
        const holes = data.holes || [];
        if (!holes.length) return { x, y };
        let best = holes[0];
        let bestDist = Infinity;
        holes.forEach(h => {
            const d = (h.x - x) ** 2 + (h.y - y) ** 2;
            if (d < bestDist) {
                bestDist = d;
                best = h;
            }
        });
        return best;
    }

    _createSapo(x, y) {
        this._createSapoPatrol(x, y, {
            texture: 'sapo-tomate',
            animKey: 'sapo-walk',
            cfg: GC.ENEMY.SAPO
        });
    }

    _createSapoRoxo(x, y) {
        this._createSapoPatrol(x, y, {
            texture: 'sapo-roxo',
            animKey: 'sapo-roxo-walk',
            cfg: GC.ENEMY.SAPO_ROXO,
            type: 'sapo-roxo'
        });
    }

    _createSapoChefeLaranja(x, y) {
        const cfg = GC.ENEMY.SAPO_CHEFE_LARANJA;
        const boss = this._createSapoPatrol(x, y, {
            texture: 'sapo-chefe-laranja',
            animKey: 'sapo-chefe-laranja-walk',
            cfg,
            type: 'sapo-chefe-laranja',
            body: cfg
        });
        boss.patrolData.health = cfg.MAX_HEALTH;
        boss.patrolData.hitsTaken = 0;
        boss.patrolData.state = 'normal';
        boss.patrolData.stateUntil = 0;
        boss.patrolData.baseSpeed = cfg.SPEED;
        boss.patrolData.nextFlashAt = 0;
        boss.patrolData.flashOn = false;
        boss.patrolData.bossCfg = cfg;
    }

    /** Sapo com patrulha horizontal + pulos (tomate / roxo). */
    _createSapoPatrol(x, y, { texture, animKey, cfg, type, body = GC.ENEMY }) {
        const scene = this.scene;
        const sapo = scene.physics.add.sprite(x, y, texture);

        sapo.body.setSize(body.BODY_WIDTH, body.BODY_HEIGHT);
        sapo.body.setOffset(body.BODY_OFFSET_X, body.BODY_OFFSET_Y || 0);
        sapo.body.allowGravity = true;
        sapo.body.setCollideWorldBounds(true);

        sapo.patrolData = {
            type: type || undefined,
            startX: x,
            leftLimit: x - cfg.PATROL_DISTANCE,
            rightLimit: x + cfg.PATROL_DISTANCE,
            speed: cfg.SPEED,
            direction: 1,
            lastJumpX: x,
            jumpDistance: cfg.JUMP_DISTANCE,
            jumpForce: cfg.JUMP_FORCE
        };

        sapo.setVelocityX(cfg.SPEED);

        if (!scene.anims.exists(animKey)) {
            scene.anims.create({
                key: animKey,
                frames: scene.anims.generateFrameNumbers(texture, { start: 0, end: 5 }),
                frameRate: cfg.ANIM_FPS,
                repeat: -1
            });
        }
        sapo.anims.play(animKey, true);
        this.enemies.add(sapo);
        return sapo;
    }

    _createSapoVerde(x, y) {
        const scene = this.scene;
        const sapo = scene.physics.add.sprite(x, y, 'sapo-verde');

        sapo.body.setSize(GC.ENEMY.BODY_WIDTH, GC.ENEMY.BODY_HEIGHT);
        sapo.body.setOffset(GC.ENEMY.BODY_OFFSET_X, 0);
        sapo.body.allowGravity = true;
        sapo.body.setCollideWorldBounds(true);

        const cfg = GC.ENEMY.SAPO_VERDE;
        sapo.patrolData = {
            type: 'sapo-verde',
            startX: x,
            startY: y,
            speed: 0,
            direction: 1,
            jumpForce: cfg.JUMP_FORCE,
            jumpInterval: cfg.JUMP_INTERVAL_MS,
            lastJumpTime: 0
        };

        if (!scene.anims.exists('sapo-verde-idle')) {
            scene.anims.create({
                key: 'sapo-verde-idle',
                frames: scene.anims.generateFrameNumbers('sapo-verde', { start: 0, end: 5 }),
                frameRate: cfg.ANIM_FPS,
                repeat: -1
            });
        }
        sapo.anims.play('sapo-verde-idle', true);
        this.enemies.add(sapo);
    }

    _createSeahorse(x, y) {
        const scene = this.scene;
        const cfg = GC.ENEMY.SEAHORSE;
        const seahorse = scene.physics.add.sprite(x, y, 'seahorse');

        seahorse.body.setSize(cfg.BODY_WIDTH, cfg.BODY_HEIGHT);
        seahorse.body.setOffset(cfg.BODY_OFFSET_X, cfg.BODY_OFFSET_Y);
        seahorse.body.allowGravity = false;
        seahorse.body.immovable = true;

        seahorse.patrolData = { type: 'seahorse' };

        if (!scene.anims.exists('seahorse-idle')) {
            scene.anims.create({
                key: 'seahorse-idle',
                frames: scene.anims.generateFrameNumbers('seahorse', { start: 0, end: 4 }),
                frameRate: cfg.ANIM_FPS,
                repeat: -1
            });
        }
        seahorse.anims.play('seahorse-idle', true);

        seahorse.on('animationupdate', (anim, frame) => {
            if (anim.key !== 'seahorse-idle') return;
            if (frame.index === cfg.BUBBLE_FRAME_INDEX) {
                this._spawnSeahorseBubble(seahorse);
            }
        });

        this.enemies.add(seahorse);
    }

    /**
     * Boneco de posto: patrulha 1 bloco ± spawn; 2 stomps para matar
     * (1º → vulnerável 1s com frames 1–2 e patrulha pausada; 2º → morte).
     *
     * Escala a partir dos pés (origin bottom) para não enterrar no chão.
     * setSize usa medidas do frame; o Arcade multiplica pela scale do sprite.
     */
    _createBoneco(data) {
        const scene = this.scene;
        const cfg = GC.ENEMY.BONECO;
        const scale = cfg.SCALE;
        // Usa a altura real para converter o centro do objeto na posicao dos pes.
        const feetY = data.y + data.height / 2;
        const boneco = scene.physics.add.sprite(data.x, feetY, 'boneco');

        boneco.setOrigin(0.5, 1);
        boneco.setScale(scale);
        // NÃO multiplicar por scale: Phaser já aplica scaleX/scaleY no body.
        boneco.body.setSize(GC.ENEMY.BODY_WIDTH, GC.ENEMY.BODY_HEIGHT);
        boneco.body.setOffset(GC.ENEMY.BODY_OFFSET_X, 0);
        boneco.body.allowGravity = true;
        boneco.body.setCollideWorldBounds(true);

        boneco.patrolData = {
            type: 'boneco',
            state: 'normal',
            vulnerableUntil: 0,
            startX: data.x,
            leftLimit: data.x - cfg.PATROL_DISTANCE,
            rightLimit: data.x + cfg.PATROL_DISTANCE,
            speed: cfg.SPEED,
            direction: 1
        };

        boneco.setVelocityX(cfg.SPEED);

        if (!scene.anims.exists('boneco-idle')) {
            scene.anims.create({
                key: 'boneco-idle',
                frames: scene.anims.generateFrameNumbers('boneco', {
                    start: 0,
                    end: cfg.FRAME_END
                }),
                frameRate: cfg.ANIM_FPS,
                repeat: -1
            });
        }
        if (!scene.anims.exists('boneco-vulnerable')) {
            scene.anims.create({
                key: 'boneco-vulnerable',
                frames: scene.anims.generateFrameNumbers('boneco', {
                    start: cfg.VULNERABLE_FRAMES.start,
                    end: cfg.VULNERABLE_FRAMES.end
                }),
                frameRate: cfg.ANIM_FPS,
                repeat: -1
            });
        }
        boneco.anims.play('boneco-idle', true);
        this.enemies.add(boneco);
    }

    _spawnSeahorseBubble(seahorse) {
        if (!seahorse.active) return;
        const cfg = GC.ENEMY.SEAHORSE;
        const facingLeft = !seahorse.flipX;
        const dir = facingLeft ? -1 : 1;
        const x = seahorse.x + dir * cfg.MUZZLE_OFFSET_X;
        const y = seahorse.y + cfg.MUZZLE_OFFSET_Y;

        const bubble = this.bubbles.create(x, y, 'seahorse-bubble');
        bubble.body.allowGravity = false;
        bubble.body.setCircle(GC.BUBBLE.BODY_RADIUS,
            GC.BUBBLE.SIZE / 2 - GC.BUBBLE.BODY_RADIUS,
            GC.BUBBLE.SIZE / 2 - GC.BUBBLE.BODY_RADIUS);
        bubble.setVelocityX(dir * GC.BUBBLE.SPEED);

        this.scene.time.delayedCall(GC.BUBBLE.LIFETIME_MS, () => {
            if (bubble && bubble.active) bubble.destroy();
        });
    }

    handleBubbleHitTile(bubble) {
        if (bubble && bubble.active) bubble.destroy();
    }

    handleBubbleHitPlayer(player, bubble) {
        if (!bubble || !bubble.active) return;
        bubble.destroy();
        if (!this.scene.playerController.isRespawning) {
            this.scene.playerController.takeDamage();
        }
    }

    update(currentTime) {
        if (!this.enemies) return;

        const player = this.scene.playerController.player;

        this.enemies.children.iterate(enemy => {
            if (!enemy || !enemy.active || !enemy.patrolData) return;

            const data = enemy.patrolData;
            const onGround = enemy.body.blocked.down;

            // Sapo verde: fica parado, só pula
            if (data.type === 'toupeira') {
                this._updateToupeira(enemy, data, player, currentTime, onGround);
                return;
            }

            if (data.type === 'toupeira-chefe') {
                this._updateToupeiraChefe(enemy, data, player, currentTime, onGround);
                return;
            }

            if (data.type === 'sapo-verde') {
                if (onGround && currentTime - data.lastJumpTime >= data.jumpInterval) {
                    enemy.setVelocityY(data.jumpForce);
                    data.lastJumpTime = currentTime;
                }
                enemy.setVelocityX(0);

                if (player && player.active) {
                    enemy.setFlipX(player.x < enemy.x);
                }
                return;
            }

            // Cavalo marinho: fica parado, vira pra direção do player e cospe bolhas
            if (data.type === 'seahorse') {
                if (player && player.active) {
                    enemy.setFlipX(player.x > enemy.x);
                }
                return;
            }

            // Boneco: vulnerável pausa patrulha; timeout volta ao normal
            if (data.type === 'boneco') {
                if (data.state === 'vulnerable') {
                    enemy.setVelocityX(0);
                    if (currentTime >= data.vulnerableUntil) {
                        data.state = 'normal';
                        data.vulnerableUntil = 0;
                        enemy.anims.play('boneco-idle', true);
                        enemy.setVelocityX(data.speed * data.direction);
                        enemy.setFlipX(data.direction === -1);
                    }
                    return;
                }
                this._updatePatrol(enemy, data, onGround, { jump: false });
                return;
            }

            if (data.type === 'sapo-chefe-laranja') {
                this._updateSapoChefe(enemy, data, player, currentTime, onGround);
                return;
            }

            // Sapo roxo: patrulha, pula e evita beiradas.
            if (data.type === 'sapo-roxo') {
                this._updatePatrol(enemy, data, onGround, {
                    jump: true,
                    avoidLedges: true
                });
                return;
            }

            // Sapo tomate: patrulha + pula (pode cair em buracos)
            this._updatePatrol(enemy, data, onGround, { jump: true });
        });
    }

    _updateSapoChefe(enemy, data, player, currentTime, onGround) {
        const cfg = GC.ENEMY.SAPO_CHEFE_LARANJA;

        if (data.state === 'dying') return;

        if (data.state === 'crushed') {
            enemy.setVelocityX(0);
            this._flashBoss(enemy, data, currentTime, 0xffffff, 0xffaa33);
            if (currentTime >= data.stateUntil) {
                data.state = 'attack';
                const attackDuration = cfg.ATTACK_BASE_DURATION_MS *
                    Math.pow(cfg.ATTACK_DURATION_GROWTH, data.hitsTaken - 1);
                data.stateUntil = currentTime + attackDuration;
                data.speed = data.baseSpeed * cfg.ATTACK_SPEED_MULTIPLIER;
                data.direction = player?.x < enemy.x ? -1 : 1;
                data.lastJumpX = enemy.x;
                enemy.setScale(cfg.ATTACK_SCALE_X, cfg.ATTACK_SCALE_Y);
                enemy.clearTint();
                enemy.anims.resume();
                this._startBossElectricEffect(enemy, data);
                enemy.setVelocityX(data.speed * data.direction);
            }
            return;
        }

        if (data.state === 'attack') {
            this._flashBoss(enemy, data, currentTime, 0xd8ffff, 0xffffd8, false);
            this._updateBossElectricEffect(enemy, data);
            this._updatePatrol(enemy, data, onGround, {
                jump: true,
                avoidLedges: true
            });
            if (currentTime >= data.stateUntil) {
                data.state = 'normal';
                data.stateUntil = 0;
                data.speed = data.baseSpeed;
                data.flashOn = false;
                enemy.clearTint();
                this._stopBossElectricEffect(data);
                enemy.setScale(1);
                enemy.setVelocityX(data.speed * data.direction);
            }
            return;
        }

        this._updatePatrol(enemy, data, onGround, {
            jump: true,
            avoidLedges: true
        });
    }

    _flashBoss(enemy, data, currentTime, colorA, colorB, fill = true) {
        const cfg = data.bossCfg || GC.ENEMY.SAPO_CHEFE_LARANJA;
        if (currentTime < data.nextFlashAt) return;
        data.nextFlashAt = currentTime + cfg.FLASH_INTERVAL_MS;
        data.flashOn = !data.flashOn;
        const color = data.flashOn ? colorA : colorB;
        if (fill) enemy.setTintFill(color);
        else enemy.setTint(color);

        if (data.electricGraphics) this._drawBossElectricBolts(enemy, data);
    }

    _startBossElectricEffect(enemy, data) {
        this._stopBossElectricEffect(data);
        const cfg = data.bossCfg || GC.ENEMY.SAPO_CHEFE_LARANJA;
        const graphics = this.scene.add.graphics()
            .setDepth(enemy.depth + 1)
            .setAlpha(cfg.ELECTRIC_EFFECT_ALPHA);
        data.electricGraphics = graphics;
        this._updateBossElectricEffect(enemy, data);
        this._drawBossElectricBolts(enemy, data);
    }

    _updateBossElectricEffect(enemy, data) {
        const graphics = data.electricGraphics;
        if (!graphics) return;
        // Centro visual do sprite (origem nos pés da toupeira-chefe ≠ centro).
        const centerX = enemy.x - enemy.displayWidth * (enemy.originX - 0.5);
        const centerY = enemy.y - enemy.displayHeight * (enemy.originY - 0.5);
        graphics.setPosition(centerX, centerY);
        graphics.setDepth(enemy.depth + 1);
    }

    _drawBossElectricBolts(enemy, data) {
        const graphics = data.electricGraphics;
        if (!graphics) return;
        const cfg = data.bossCfg || GC.ENEMY.SAPO_CHEFE_LARANJA;
        const halfW = enemy.displayWidth / 2 + 2;
        const halfH = enemy.displayHeight / 2 + 2;
        graphics.clear();

        for (let i = 0; i < cfg.ELECTRIC_BOLT_COUNT; i++) {
            const angle = (Math.PI * 2 * i / cfg.ELECTRIC_BOLT_COUNT) + Phaser.Math.FloatBetween(-0.18, 0.18);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const radius = 1 / Math.sqrt((cos * cos) / (halfW * halfW) + (sin * sin) / (halfH * halfH));
            const length = Phaser.Math.Between(8, 16);
            const startX = cos * radius;
            const startY = sin * radius;
            const endX = cos * (radius + length);
            const endY = sin * (radius + length);
            const jitter = Phaser.Math.Between(-5, 5);
            const midX = (startX + endX) / 2 + jitter * -sin;
            const midY = (startY + endY) / 2 + jitter * cos;

            graphics.lineStyle(3, cfg.ELECTRIC_GLOW_COLOR, 0.55);
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(midX, midY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();

            graphics.lineStyle(1.5, cfg.ELECTRIC_CORE_COLOR, 0.95);
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(midX, midY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();
        }
    }

    _strokeBossElectricShape(graphics, segments, halfW, halfH, width, color, alpha) {
        graphics.lineStyle(width, color, alpha);
        graphics.strokeEllipse(0, 0, halfW * 2, halfH * 2);
        segments.forEach(segment => {
            graphics.beginPath();
            graphics.moveTo(segment.startX, segment.startY);
            graphics.lineTo(segment.midX, segment.midY);
            graphics.lineTo(segment.endX, segment.endY);
            graphics.strokePath();
        });
    }

    _stopBossElectricEffect(data) {
        if (!data.electricGraphics) return;
        data.electricGraphics.destroy();
        data.electricGraphics = null;
    }

    /**
     * Patrulha horizontal compartilhada (sapo / boneco).
     * @param {{ jump?: boolean, avoidLedges?: boolean }} opts
     *   jump=true → pulos periódicos do sapo
     *   avoidLedges=true → vira na beirada (só sapo roxo)
     */
    _updatePatrol(enemy, data, onGround, opts = {}) {
        // Beirada antes do pulo: evita saltar em direção ao buraco.
        if (opts.avoidLedges && onGround && this._isLedgeAhead(enemy, data.direction)) {
            data.direction *= -1;
            enemy.setVelocityX(data.speed * data.direction);
            enemy.setFlipX(data.direction === -1);
        }

        if (opts.jump) {
            const distanceFromLastJump = Math.abs(enemy.x - data.lastJumpX);
            if (distanceFromLastJump >= data.jumpDistance && onGround) {
                enemy.setVelocityY(data.jumpForce);
                data.lastJumpX = enemy.x;
            }
        }

        const margin = GC.ENEMY.MAP_EDGE_MARGIN;
        const mapRightEdge = this.scene.map ? this.scene.map.widthInPixels - margin : 9999;

        const hitRightWall = enemy.body.blocked.right || enemy.x >= mapRightEdge;
        const hitLeftWall = enemy.body.blocked.left || enemy.x <= margin;

        if (hitRightWall && data.direction === 1) {
            data.direction = -1;
            enemy.setVelocityX(data.speed * data.direction);
            enemy.setFlipX(true);
            data.rightLimit = Math.min(data.rightLimit, enemy.x - margin);
        } else if (hitLeftWall && data.direction === -1) {
            data.direction = 1;
            enemy.setVelocityX(data.speed * data.direction);
            enemy.setFlipX(false);
            data.leftLimit = Math.max(data.leftLimit, enemy.x + margin);
        } else if (enemy.x >= data.rightLimit && data.direction === 1) {
            data.direction = -1;
            enemy.setVelocityX(data.speed * data.direction);
            enemy.setFlipX(true);
        } else if (enemy.x <= data.leftLimit && data.direction === -1) {
            data.direction = 1;
            enemy.setVelocityX(data.speed * data.direction);
            enemy.setFlipX(false);
        }

        if (Math.abs(enemy.body.velocity.x) < data.speed * 0.5 && onGround) {
            enemy.setVelocityX(data.speed * data.direction);
        }
    }

    _getTileSize() {
        return this.scene.map?.tileWidth || 32;
    }

    /** Há colisor sólido na camada `solids` neste ponto do mundo? */
    _probeSolidAt(worldX, worldY) {
        const solids = this.scene.solidsLayer;
        if (!solids) return false;

        const tile = solids.getTileAtWorldXY(worldX, worldY, true);
        if (!tile || tile.index === -1) return false;
        return tile.collides;
    }

    /**
     * Impulso vertical mínimo para subir exatamente `heightPx` com a gravidade atual.
     * v = sqrt(2 * g * h)
     */
    _computeStepJumpForce(heightPx) {
        const gravity = Math.abs(this.scene.physics.world.gravity.y);
        return -Math.sqrt(2 * gravity * heightPx);
    }

    /**
     * Altura de pulo (px) para superar a prisão à frente, ou 0.
     * A prisão é um staticSprite — não aparece na sonda de tiles `solids`.
     */
    _getPrisonJumpHeightPx(enemy, direction, terrainCfg) {
        if (!terrainCfg?.CAN_JUMP_PRISON) return 0;
        const prison = this.scene.prison;
        if (!prison?.active || !prison.body?.enable) return 0;
        if (this.scene.prisonState !== 'locked' && this.scene.prisonState !== 'opening') return 0;

        const body = enemy.body;
        const pb = prison.body;
        const lookAhead = terrainCfg.PRISON_LOOK_AHEAD_PX || 56;

        const ahead = direction > 0
            ? pb.left <= body.right + lookAhead && pb.right >= body.right - 4
            : pb.right >= body.left - lookAhead && pb.left <= body.left + 4;
        if (!ahead) return 0;

        // Mesmo chão aproximado (não pula prisão em outro patamar)
        if (Math.abs(pb.bottom - body.bottom) > 48) return 0;

        const clearance = (body.bottom - pb.top) + (terrainCfg.PRISON_JUMP_MARGIN_PX || 12);
        return Math.max(clearance, prison.displayHeight + (terrainCfg.PRISON_JUMP_MARGIN_PX || 12));
    }

    /**
     * Menor altura de degrau (em tiles) com pouso à frente, ou 0 se não houver
     * dentro de MAX_STEP_TILES. Varre em X porque a face vertical ocupa a coluna
     * imediata — o chão de cima fica nas colunas seguintes.
     */
    _findStepUpTiles(enemy, direction, terrainCfg) {
        const cfg = terrainCfg || GC.ENEMY.TOUPEIRA;
        const tileSize = this._getTileSize();
        const body = enemy.body;
        const startX = direction > 0
            ? body.right + cfg.LOOK_AHEAD_EDGE_PX
            : body.left - cfg.LOOK_AHEAD_EDGE_PX;
        const endX = direction > 0
            ? body.right + cfg.LOOK_AHEAD_STEP_PX
            : body.left - cfg.LOOK_AHEAD_STEP_PX;
        const stepPx = 8;
        const maxTiles = cfg.MAX_STEP_TILES || 1;

        for (let tiles = 1; tiles <= maxTiles; tiles++) {
            const landingY = body.bottom + 2 - tileSize * tiles;
            for (let x = startX; direction > 0 ? x <= endX : x >= endX; x += direction * stepPx) {
                if (this._probeSolidAt(x, landingY)) return tiles;
            }
        }
        return 0;
    }

    /**
     * Terreno à frente da toupeira:
     * - clear        → chão contínuo no mesmo nível
     * - shallow_hole → queda de até MAX_DROP_TILES (continua andando)
     * - step_up      → degrau / prisão (pula o necessário)
     * - deep_hole    → buraco mais profundo (para)
     */
    _analyzeToupeiraTerrainAhead(enemy, direction, blockedAhead = false, terrainCfg = null) {
        const cfg = terrainCfg || GC.ENEMY.TOUPEIRA;
        const tileSize = this._getTileSize();
        const body = enemy.body;
        const feetY = body.bottom + 2;
        const edgeProbeX = direction > 0
            ? body.right + cfg.LOOK_AHEAD_EDGE_PX
            : body.left - cfg.LOOK_AHEAD_EDGE_PX;
        const floorAheadSameLevel = this._probeSolidAt(edgeProbeX, feetY);
        const stepTiles = this._findStepUpTiles(enemy, direction, cfg);
        const prisonJumpPx = this._getPrisonJumpHeightPx(enemy, direction, cfg);

        // Prisão: obstáculo de física (não aparece em `solids`). Pula ao aproximar.
        if (prisonJumpPx > 0) {
            return { kind: 'step_up', stepTiles: 0, jumpHeightPx: prisonJumpPx };
        }

        // Degrau de tile: pouso acima. A face do bloco conta como "chão" na sonda
        // horizontal — por isso também disparamos ao encostar (blockedAhead).
        if (stepTiles > 0 && (!floorAheadSameLevel || blockedAhead)) {
            return { kind: 'step_up', stepTiles };
        }

        if (floorAheadSameLevel) {
            return { kind: 'clear' };
        }

        const maxDrop = cfg.MAX_DROP_TILES || 1;
        for (let tiles = 1; tiles <= maxDrop; tiles++) {
            if (this._probeSolidAt(edgeProbeX, feetY + tileSize * tiles)) {
                return { kind: 'shallow_hole' };
            }
        }

        return { kind: 'deep_hole' };
    }

    /**
     * True se não há tile sólido colidível logo à frente dos pés (buraco/beirada).
     */
    _isLedgeAhead(enemy, direction) {
        const solids = this.scene.solidsLayer;
        if (!solids) return false;

        const body = enemy.body;
        const lookAhead = 4;
        const probeX = direction > 0
            ? body.right + lookAhead
            : body.left - lookAhead;
        const probeY = body.bottom + 2;

        const tile = solids.getTileAtWorldXY(probeX, probeY, true);
        if (!tile || tile.index === -1) return true;
        return !tile.collides;
    }

    handleCollision(player, enemy) {
        if (!enemy || !enemy.active) return;

        const enemyType = enemy.patrolData?.type;
        if (enemyType === 'toupeira' && enemy.patrolData.state !== 'chasing') return;

        if (enemyType === 'toupeira-chefe') {
            const bossState = enemy.patrolData.state;
            // Fuga / buraco / emergência: invulnerável e inofensivo.
            if (bossState === 'hidden' || bossState === 'emerging' ||
                bossState === 'fleeing' || bossState === 'burrowing' || bossState === 'dying' ||
                bossState === 'crushed') {
                return;
            }
            if (bossState === 'attack') {
                this._damagePlayer();
                return;
            }
        }

        if (enemyType === 'sapo-chefe-laranja') {
            const bossState = enemy.patrolData.state;
            if (bossState === 'attack') {
                this._damagePlayer();
                return;
            }
            if (bossState === 'crushed') return;
        }

        const isStompable = enemyType !== 'seahorse';

        if (isStompable) {
            const playerBottom = player.body.bottom;
            const enemyCenter = enemy.body.center.y;
            const isStomping = player.body.velocity.y > 0 &&
                               playerBottom <= enemyCenter + GC.PLAYER.STOMP_TOLERANCE;

            if (isStomping) {
                if (enemyType === 'sapo-chefe-laranja') {
                    this._hitSapoChefe(enemy);
                } else if (enemyType === 'toupeira-chefe') {
                    this._hitToupeiraChefe(enemy);
                } else if (enemy.patrolData?.type === 'boneco') {
                    if (enemy.patrolData.state === 'vulnerable') {
                        this._killBoneco(enemy);
                    } else {
                        this._stunBoneco(enemy);
                    }
                } else {
                    this._killEnemy(enemy);
                }
                player.setVelocityY(GC.PLAYER.STOMP_BOUNCE);
                return;
            }
        }

        this._damagePlayer();
    }

    _damagePlayer() {
        if (!this.scene.playerController.isRespawning) {
            this.scene.playerController.takeDamage();
        }
    }

    _hitToupeiraChefe(enemy) {
        const data = enemy.patrolData;
        const cfg = data?.bossCfg || GC.ENEMY.TOUPEIRA_CHEFE;
        if (!data || data.state !== 'chasing') return;

        data.health -= 1;
        data.hitsTaken += 1;
        SoundManager.play('damage');

        if (data.health <= 0) {
            this._killToupeiraChefe(enemy);
            return;
        }

        data.state = 'crushed';
        data.stateUntil = this.scene.time.now + cfg.CRUSHED_DURATION_MS;
        data.nextFlashAt = 0;
        data.flashOn = false;
        enemy.setVelocity(0, 0);
        enemy.anims.pause();
        enemy.setScale(cfg.CRUSHED_SCALE_X, cfg.CRUSHED_SCALE_Y);
        enemy.setTintFill(0xffffff);
        this._stopBossElectricEffect(data);
    }

    _killToupeiraChefe(enemy) {
        const cfg = enemy.patrolData?.bossCfg || GC.ENEMY.TOUPEIRA_CHEFE;
        const data = enemy.patrolData;
        if (!data || data.state === 'dying') return;

        data.state = 'dying';
        this._stopBossElectricEffect(data);
        enemy.body.enable = false;
        enemy.setVelocity(0, 0);
        enemy.anims.pause();
        enemy.clearTint();
        SoundManager.play('damage');

        this.scene.tweens.add({
            targets: enemy,
            scaleX: { from: 1.05, to: 1.35 },
            scaleY: { from: 0.95, to: 0.7 },
            alpha: { from: 1, to: 0.65 },
            duration: cfg.DEATH_CHARGE_MS / 4,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeInOut',
            onUpdate: tween => {
                enemy.setTintFill(tween.totalProgress > 0.45 ? 0xffffff : 0xffcc66);
            },
            onComplete: () => this._explodeToupeiraChefe(enemy)
        });
    }

    _explodeToupeiraChefe(enemy) {
        if (!enemy.active) return;
        const cfg = enemy.patrolData?.bossCfg || GC.ENEMY.TOUPEIRA_CHEFE;
        const effects = this.scene.effectsManager;
        const x = enemy.x;
        const y = enemy.y - enemy.displayHeight / 2;

        const durationScale = cfg.DEATH_EFFECT_DURATION_SCALE;
        effects.createEnemyPopBurst(x, y, durationScale);
        effects.createEnemyPopBurst(x - 18, y - 12, durationScale);
        effects.createEnemyPopBurst(x + 18, y - 12, durationScale);
        effects.createEnemyPopBurst(x, y + 16, durationScale);
        SoundManager.play('enemyPop', {
            frequency: cfg.DEATH_SOUND_FREQUENCY,
            duration: cfg.DEATH_SOUND_DURATION,
            decay: cfg.DEATH_SOUND_DECAY,
            slide: cfg.DEATH_SOUND_SLIDE,
            filterQ: 1.1
        });
        this.scene.cameras.main.shake(520, 0.007);

        enemy.clearTint();
        this.scene.tweens.add({
            targets: enemy,
            scaleX: enemy.scaleX * 1.8,
            scaleY: enemy.scaleY * 1.8,
            alpha: 0,
            duration: cfg.DEATH_POP_MS,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                enemy.destroy();
                this.scene.spawnPrisonKey(x, y);
            }
        });
    }

    _hitSapoChefe(enemy) {
        const data = enemy.patrolData;
        const cfg = GC.ENEMY.SAPO_CHEFE_LARANJA;
        if (!data || data.state !== 'normal') return;

        data.health -= 1;
        data.hitsTaken += 1;
        SoundManager.play('damage');

        if (data.health <= 0) {
            this._killSapoChefe(enemy);
            return;
        }

        data.state = 'crushed';
        data.stateUntil = this.scene.time.now + cfg.CRUSHED_DURATION_MS;
        data.nextFlashAt = 0;
        data.flashOn = false;
        enemy.setVelocity(0, 0);
        enemy.anims.pause();
        enemy.setScale(cfg.CRUSHED_SCALE_X, cfg.CRUSHED_SCALE_Y);
        enemy.setTintFill(0xffffff);
    }

    _killSapoChefe(enemy) {
        const cfg = GC.ENEMY.SAPO_CHEFE_LARANJA;
        const data = enemy.patrolData;
        if (!data || data.state === 'dying') return;

        data.state = 'dying';
        this._stopBossElectricEffect(data);
        enemy.body.enable = false;
        enemy.setVelocity(0, 0);
        enemy.anims.pause();
        enemy.clearTint();
        SoundManager.play('damage');

        // Curta carga branca e pulsante antes do estouro, para dar peso ? derrota.
        this.scene.tweens.add({
            targets: enemy,
            scaleX: { from: 1.05, to: 1.35 },
            scaleY: { from: 0.95, to: 0.7 },
            alpha: { from: 1, to: 0.65 },
            duration: cfg.DEATH_CHARGE_MS / 4,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeInOut',
            onUpdate: tween => {
                enemy.setTintFill(tween.totalProgress > 0.45 ? 0xffffff : 0xffcc66);
            },
            onComplete: () => this._explodeSapoChefe(enemy)
        });
    }

    _explodeSapoChefe(enemy) {
        if (!enemy.active) return;
        const cfg = GC.ENEMY.SAPO_CHEFE_LARANJA;
        const effects = this.scene.effectsManager;
        const x = enemy.x;
        const y = enemy.y;

        // Reaproveita o estouro do boneco em camadas para preencher o chefe 64x64.
        const durationScale = cfg.DEATH_EFFECT_DURATION_SCALE;
        effects.createEnemyPopBurst(x, y, durationScale);
        effects.createEnemyPopBurst(x - 18, y - 12, durationScale);
        effects.createEnemyPopBurst(x + 18, y - 12, durationScale);
        effects.createEnemyPopBurst(x, y + 16, durationScale);
        SoundManager.play('enemyPop', {
            frequency: cfg.DEATH_SOUND_FREQUENCY,
            duration: cfg.DEATH_SOUND_DURATION,
            decay: cfg.DEATH_SOUND_DECAY,
            slide: cfg.DEATH_SOUND_SLIDE,
            filterQ: 1.1
        });
        this.scene.cameras.main.shake(520, 0.007);

        enemy.clearTint();
        this.scene.tweens.add({
            targets: enemy,
            scaleX: enemy.scaleX * 1.8,
            scaleY: enemy.scaleY * 1.8,
            alpha: 0,
            duration: cfg.DEATH_POP_MS,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                enemy.destroy();
                this.scene.spawnPrisonKey(x, y);
            }
        });
    }

    _stunBoneco(enemy) {
        const data = enemy.patrolData;
        if (!data || data.state === 'vulnerable') return;

        data.state = 'vulnerable';
        data.vulnerableUntil = this.scene.time.now + GC.ENEMY.BONECO.VULNERABLE_MS;
        enemy.setVelocityX(0);
        enemy.anims.play('boneco-vulnerable', true);
        SoundManager.play('damage');
    }

    /**
     * Morte do boneco (2ª pisada): estouro sonoro + visual, some rápido.
     * Origin nos pés → centro do sprite em y - displayHeight/2.
     */
    _killBoneco(enemy) {
        const cfg = GC.ENEMY.BONECO;
        const cx = enemy.x;
        const cy = enemy.y - enemy.displayHeight / 2;

        this.scene.effectsManager.createEnemyPopBurst(cx, cy);
        SoundManager.play('enemyPop');

        enemy.body.enable = false;
        this.scene.tweens.add({
            targets: enemy,
            scaleX: enemy.scaleX * 1.5,
            scaleY: enemy.scaleY * 1.5,
            alpha: 0,
            duration: cfg.POP_DURATION_MS,
            ease: 'Cubic.easeOut',
            onComplete: () => enemy.destroy()
        });
    }

    _killEnemy(enemy) {
        if (enemy.patrolData) this._stopBossElectricEffect(enemy.patrolData);
        this.scene.tweens.add({
            targets: enemy,
            scaleY: enemy.scaleY * 0.2,
            scaleX: enemy.scaleX * 1.3,
            alpha: 0,
            y: enemy.y + 16,
            duration: GC.ENEMY.KILL_DURATION_MS,
            ease: 'Power2',
            onComplete: () => enemy.destroy()
        });

        enemy.body.enable = false;
        SoundManager.play('damage');
    }
}
