/**
 * EnemyManager - Gerencia inimigos (sapos, seahorse, boneco)
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
            } else if (e.type === 'sapo') {
                this._createSapo(e.x, e.y);
            } else if (e.type === 'seahorse') {
                this._createSeahorse(e.x, e.y);
            } else if (e.type === 'boneco') {
                this._createBoneco(e.x, e.y);
            }
        });
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

    /** Sapo com patrulha horizontal + pulos (tomate / roxo). */
    _createSapoPatrol(x, y, { texture, animKey, cfg, type }) {
        const scene = this.scene;
        const sapo = scene.physics.add.sprite(x, y, texture);

        sapo.body.setSize(GC.ENEMY.BODY_WIDTH, GC.ENEMY.BODY_HEIGHT);
        sapo.body.setOffset(GC.ENEMY.BODY_OFFSET_X, 0);
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
    _createBoneco(x, y) {
        const scene = this.scene;
        const cfg = GC.ENEMY.BONECO;
        const scale = cfg.SCALE;
        // Spawn Tiled (x,y) é o centro de um tile 32×32 — pés ficavam em y+16.
        const feetY = y + 16;
        const boneco = scene.physics.add.sprite(x, feetY, 'boneco');

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
            startX: x,
            leftLimit: x - cfg.PATROL_DISTANCE,
            rightLimit: x + cfg.PATROL_DISTANCE,
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

            // Sapo tomate: patrulha + pula
            this._updatePatrol(enemy, data, onGround, { jump: true });
        });
    }

    /**
     * Patrulha horizontal compartilhada (sapo / boneco).
     * @param {{ jump?: boolean }} opts jump=true aplica pulos periódicos do sapo
     */
    _updatePatrol(enemy, data, onGround, opts = {}) {
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

    handleCollision(player, enemy) {
        if (!enemy || !enemy.active) return;

        const isStompable = enemy.patrolData?.type !== 'seahorse';

        if (isStompable) {
            const playerBottom = player.body.bottom;
            const enemyCenter = enemy.body.center.y;
            const isStomping = player.body.velocity.y > 0 &&
                               playerBottom <= enemyCenter + GC.PLAYER.STOMP_TOLERANCE;

            if (isStomping) {
                if (enemy.patrolData?.type === 'boneco') {
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

        if (!this.scene.playerController.isRespawning) {
            this.scene.playerController.takeDamage();
        }
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
