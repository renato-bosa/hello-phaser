/**
 * PlayerController - Controle do jogador
 * Responsável por: criação do sprite, movimento, pulo, água, speed boost, respawn
 */
class PlayerController {
    constructor(scene) {
        this.scene = scene;
        this.player = null;
        this.selectedCharacter = null;

        this.coyoteTime = 0;
        this.jumpBufferTime = 0;
        this.isJumping = false;
        this.currentSpeed = GC.PLAYER.MIN_SPEED;
        this.lastDirection = 0;
        this.isRespawning = false;
        this.hasDoubleJumped = false;

        this.speedBoostActive = false;
        this.speedBoostSpeed = 0;
        this.speedBoostEndTime = 0;
        this.speedBoostTimer = null;

        this.isInWater = false;
        this.wasInWaterPrev = false;
        this.justEnteredWater = false;
    }

    create() {
        this.selectedCharacter = GameData.loadSelectedCharacter();
        const characterData = GameData.getCharacter(this.selectedCharacter);

        this.player = this.scene.physics.add.sprite(
            this.scene.playerSpawn.x,
            this.scene.playerSpawn.y,
            characterData.sprites.idle
        );
        this.player.setBounce(0);
        this.player.body.setMaxVelocity(GC.PLAYER.MAX_VELOCITY_X, GC.PLAYER.MAX_VELOCITY_Y);
        this.player.body.setSize(GC.PLAYER.BODY_WIDTH, GC.PLAYER.BODY_HEIGHT);
        this.player.body.setOffset(GC.PLAYER.BODY_OFFSET_X, GC.PLAYER.BODY_OFFSET_Y);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(GC.DEPTH.PLAYER);

        GameData.createCharacterAnimations(this.scene, this.selectedCharacter, '', true);
        this.player.anims.play('idle', true);
    }

    update(delta) {
        const player = this.player;
        const scene = this.scene;
        const onGround = player.body.blocked.down;

        // --- Detecção de água ---
        const inWater = this.isInWater || false;
        this.isInWater = false;

        const justEnteredWater = inWater && !this.wasInWaterPrev;
        this.wasInWaterPrev = inWater;
        this.justEnteredWater = justEnteredWater;

        if (justEnteredWater && player.body.velocity.y > GC.WATER.SURFACE_IMPACT_MAX_SPEED) {
            player.setVelocityY(GC.WATER.SURFACE_IMPACT_MAX_SPEED);
        }

        const waterMul = inWater ? GC.WATER.SPEED_MULTIPLIER : 1.0;
        const minSpeed = GC.PLAYER.MIN_SPEED * waterMul;
        const maxSpeed = GC.PLAYER.MAX_SPEED * waterMul;
        const jumpForce = inWater ? GC.WATER.JUMP_FORCE : GC.PLAYER.JUMP_FORCE;
        const fallGravExtra = inWater ? GC.WATER.FALL_GRAVITY_EXTRA : GC.PLAYER.FALL_GRAVITY_EXTRA;
        const dt = delta / 1000;

        // --- Movimento horizontal ---
        const moveLeft = scene.cursors.left.isDown || scene.virtualControls.left;
        const moveRight = scene.cursors.right.isDown || scene.virtualControls.right;
        let direction = moveLeft ? -1 : (moveRight ? 1 : 0);

        if (this.speedBoostActive && this.speedBoostSpeed && direction !== 0) {
            player.setVelocityX(direction * this.speedBoostSpeed);
            this._playWalkAnimation(direction, onGround);
        } else {
            if (this.speedBoostActive && direction === 0) {
                this.cancelSpeedBoost();
            }

            if (direction !== this.lastDirection) {
                this.currentSpeed = minSpeed;
            }
            this.lastDirection = direction;

            if (direction !== 0) {
                this.currentSpeed = Math.min(this.currentSpeed + GC.PLAYER.ACCELERATION * dt, maxSpeed);
                player.setVelocityX(direction * this.currentSpeed);
                this._playWalkAnimation(direction, onGround);
            } else {
                player.setVelocityX(0);
                if (onGround) player.anims.play('idle', true);
            }
        }

        // --- Pulo ---
        const jumpJustPressed = Phaser.Input.Keyboard.JustDown(scene.spaceKey) ||
                                scene.virtualControls.jumpJustPressed;
        const jumpHeld = scene.spaceKey.isDown || scene.virtualControls.jumpHeld;

        if (scene.virtualControls.jumpJustPressed) {
            scene.virtualControls.jumpJustPressed = false;
        }

        if (onGround) {
            this.coyoteTime = GC.PLAYER.COYOTE_DURATION_MS;
            this.isJumping = false;
        } else {
            this.coyoteTime -= delta;
        }

        if (jumpJustPressed) {
            this.jumpBufferTime = GC.PLAYER.JUMP_BUFFER_DURATION_MS;
        } else {
            this.jumpBufferTime -= delta;
        }

        const canCoyoteJump = this.coyoteTime > 0;
        const hasBufferedJump = this.jumpBufferTime > 0;
        const shouldJump = (jumpJustPressed && canCoyoteJump) || (onGround && hasBufferedJump);

        if (shouldJump && !this.isJumping) {
            player.setVelocityY(jumpForce);
            this.isJumping = true;
            this.coyoteTime = 0;
            this.jumpBufferTime = 0;
            SoundManager.play('jump');
        }

        if (!jumpHeld && this.isJumping && player.body.velocity.y < 0) {
            player.setVelocityY(player.body.velocity.y * GC.PLAYER.JUMP_CUT_MULTIPLIER);
            this.isJumping = false;
            SoundManager.stop('jump');
        }

        // --- Gravidade extra na queda ---
        if (!onGround && player.body.velocity.y > 0) {
            const extraGravity = scene.physics.world.gravity.y * fallGravExtra * dt;
            player.setVelocityY(player.body.velocity.y + extraGravity);

            if (inWater && player.body.velocity.y > GC.WATER.MAX_FALL_SPEED) {
                player.setVelocityY(GC.WATER.MAX_FALL_SPEED);
            }
        }

        // --- Física de água ---
        if (inWater && GameData.isFeatureEnabled('waterPhysics')) {
            player.body.gravity.y = GC.WATER.BODY_GRAVITY_OFFSET;

            if (player.body.velocity.y >= 0) {
                this.isJumping = false;
            }
            if (jumpJustPressed && !this.isJumping) {
                player.setVelocityY(GC.WATER.SWIM_FORCE);
                this.isJumping = true;
                SoundManager.play('jump');
            }
        } else {
            player.body.gravity.y = 0;
        }

        // --- Double Jump ---
        if (GameData.isFeatureEnabled('doubleJump')) {
            if (onGround) {
                this.hasDoubleJumped = false;
            }
            if (jumpJustPressed && !onGround && !this.hasDoubleJumped) {
                player.setVelocityY(GC.PLAYER.DOUBLE_JUMP_FORCE);
                this.hasDoubleJumped = true;
                this.isJumping = true;
                SoundManager.play('jump');
            }
        }

        // --- Animação no ar ---
        if (!onGround) {
            player.anims.stop();
            const charData = GameData.getCharacter(this.selectedCharacter);
            const jumpSprite = charData.sprites.jump;

            if (jumpSprite && jumpSprite.key === 'hero-jump') {
                player.setTexture('hero-jump', player.body.velocity.y < 0 ? 1 : 2);
            } else if (jumpSprite) {
                player.setTexture(jumpSprite.key, 0);
            } else {
                const idleKey = GameData.getCharacterTextureKey(this.selectedCharacter, 'idle');
                player.setTexture(idleKey, 0);
            }
        }
    }

    _playWalkAnimation(direction, onGround) {
        if (this.selectedCharacter === 'baterista') {
            this.player.setFlipX(false);
            if (onGround) {
                const walkAnim = direction < 0 ? 'walk-left' : 'walk';
                this.player.anims.play(walkAnim, true);
            }
        } else {
            this.player.setFlipX(direction < 0);
            if (onGround) this.player.anims.play('walk', true);
        }
    }

    // --- Trampolim ---

    handleTrampolineCollision(player, trampoline) {
        if (player.body.velocity.y >= 0 && !trampoline.justBounced) {
            player.setVelocityY(GC.TRAMPOLINE.BOUNCE_FORCE);
            this.isJumping = true;
            SoundManager.play('jumpTrampoline');

            trampoline.justBounced = true;
            this.scene.time.delayedCall(GC.TRAMPOLINE.COOLDOWN_MS, () => {
                trampoline.justBounced = false;
            });

            this.scene.tweens.add({
                targets: trampoline,
                scaleY: 0.6,
                duration: 80,
                yoyo: true,
                ease: 'Power2'
            });
        }
    }

    // --- Speed Boost ---

    handleSpeedBoost(player, boost) {
        if (boost.lastUsed && this.scene.time.now - boost.lastUsed < GC.SPEED_BOOST.COOLDOWN_MS) return;
        boost.lastUsed = this.scene.time.now;

        this.speedBoostActive = true;
        this.speedBoostSpeed = GC.SPEED_BOOST.SPEED;
        this.speedBoostEndTime = this.scene.time.now + GC.SPEED_BOOST.DURATION_MS;

        const direction = player.flipX ? -1 : 1;
        player.setVelocityX(direction * GC.SPEED_BOOST.SPEED);
        player.setTint(GC.SPEED_BOOST.PLAYER_TINT);

        if (this.speedBoostTimer) {
            this.speedBoostTimer.remove();
        }

        this.speedBoostTimer = this.scene.time.delayedCall(GC.SPEED_BOOST.DURATION_MS, () => {
            this.speedBoostActive = false;
            this.speedBoostSpeed = 0;
            player.clearTint();
            this.speedBoostTimer = null;
        });

        this.scene.tweens.add({
            targets: boost,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 2,
            onComplete: () => boost.setAlpha(0.9)
        });

        SoundManager.play('speedBoost');
    }

    cancelSpeedBoost() {
        if (!this.speedBoostActive) return;

        this.speedBoostActive = false;
        this.speedBoostSpeed = 0;
        this.player.clearTint();

        if (this.speedBoostTimer) {
            this.speedBoostTimer.remove();
            this.speedBoostTimer = null;
        }
    }

    // --- Respawn ---

    respawnAtCheckpoint() {
        if (this.isRespawning) return;
        this.isRespawning = true;
        SoundManager.play('damage');

        const player = this.player;
        player.body.enable = false;

        const startX = player.x;
        const startY = player.y;
        const endX = this.scene.currentCheckpoint.x;
        const endY = this.scene.currentCheckpoint.y;
        const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const duration = Math.max(
            GC.RESPAWN.MIN_DURATION_MS,
            Math.min(GC.RESPAWN.MAX_DURATION_MS, distance * GC.RESPAWN.DISTANCE_SPEED_FACTOR)
        );

        player.setTint(GC.RESPAWN.HURT_TINT);

        this.scene.tweens.add({
            targets: player,
            x: endX,
            y: endY,
            duration: duration,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
                const progress = tween.progress;
                const arc = Math.sin(progress * Math.PI) * GC.RESPAWN.ARC_HEIGHT;
                const linearY = Phaser.Math.Linear(startY, endY, progress);
                player.y = linearY - arc;
                player.angle = progress * 360;
            },
            onComplete: () => {
                player.angle = 0;
                player.clearTint();
                player.body.enable = true;
                player.setVelocity(0, 0);
                this.isRespawning = false;
            }
        });
    }

    showCheckpointMessage() {
        const scene = this.scene;
        const text = scene.add.text(scene.cameras.main.centerX, 80, '🚩 CHECKPOINT!', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.HUD);

        scene.tweens.add({
            targets: text,
            alpha: 0,
            y: 60,
            duration: 500,
            delay: 800,
            onComplete: () => text.destroy()
        });
    }

    freeze() {
        this.player.setVelocity(0, 0);
        this.player.anims.play('idle', true);
    }

    destroy() {
        this.cancelSpeedBoost();
    }
}
