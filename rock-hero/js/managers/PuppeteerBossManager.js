/**
 * Chefe do Mundo 4 (feature `puppeteerBoss`).
 *
 * Fase 1: duas mãos de marionetista lançam bonecos que perseguem o herói
 * pelo chão; pisar em KILLS_TO_SWAP deles troca o herói pelo Bob.
 * Fase 2: o Bob flutua acima do chão e atira para cima com o botão de pulo.
 * Bonecos que tocam o chão somem; as mãos têm vida e, quando as duas caem,
 * a fase termina pela vitória normal.
 */
class PuppeteerBossManager {
    constructor(scene) {
        this.scene = scene;
        // puppets → swap (herói sai, Bob entra) → bob → defeated
        this.phase = 'puppets';
        this.hands = [];
        this.kills = 0;
        this.nextSpawnAt = 0;
        this.nextHandIndex = 0;
        this.bullets = null;
        this.lastShotAt = -Infinity;
        this.hoverY = 0;
        this.counterText = null;
        this.handBars = null;
    }

    create(handSpawns) {
        const scene = this.scene;
        const cfg = GC.PUPPETEER_BOSS;
        const bounds = scene.physics.world.bounds;

        handSpawns.forEach((spawn, i) => {
            const sprite = scene.physics.add.image(spawn.x, spawn.y, 'puppeteer-hand');
            sprite.setDisplaySize(spawn.width, spawn.height);
            sprite.setDepth(GC.DEPTH.PLAYER + 1);
            scene._applyTilesetTransform(sprite, spawn.transform);
            sprite.body.allowGravity = false;
            sprite.body.moves = false;
            const sway = scene.tweens.add({
                targets: sprite,
                y: spawn.y + cfg.HAND_SWAY_PX,
                duration: cfg.HAND_SWAY_MS,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: i * cfg.HAND_SWAY_MS / 2
            });
            this.hands.push({ sprite, sway, hp: cfg.HAND_HEALTH, alive: true });
        });

        const bobHeight = scene.textures.getFrame('puppeteer-bob')?.height || 32;
        const tileHeight = scene.solidsLayer?.tilemap?.tileHeight || 32;
        this.hoverY = this._findFloorY(bounds.centerX) - cfg.BOB_HOVER_TILES * tileHeight - bobHeight / 2;

        this._ensureBulletTexture();
        this.bullets = scene.physics.add.group({ allowGravity: false });
        scene.physics.add.overlap(this.bullets, scene.enemyManager.enemies,
            (bullet, puppet) => this._onBulletHitPuppet(bullet, puppet));
        this.hands.forEach(hand => {
            scene.physics.add.overlap(hand.sprite, this.bullets,
                (_sprite, bullet) => this._onBulletHitHand(hand, bullet));
        });

        this.handBars = scene.add.graphics().setDepth(GC.DEPTH.PLAYER + 2);

        // Em coordenadas do mundo: o HUD fixo encolhe junto com o zoom da arena.
        this.counterText = scene.add.text(bounds.centerX, 20, '', {
            fontSize: '24px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5, 0).setDepth(GC.DEPTH.HUD);
        this._updateCounter();

        this.nextSpawnAt = scene.time.now + cfg.FIRST_SPAWN_DELAY_MS;
    }

    update(now) {
        this._updateSpawning(now);
        this._cullBullets();
        this._drawHandBars();
    }

    isBobPhase() {
        return this.phase === 'bob' || this.phase === 'defeated';
    }

    onPuppetLanded(puppet) {
        if (this.isBobPhase()) this.scene.enemyManager.vanishPuppet(puppet);
    }

    onPuppetStomped() {
        if (this.phase !== 'puppets') return;
        this.kills++;
        this._updateCounter();
        if (this.kills >= GC.PUPPETEER_BOSS.KILLS_TO_SWAP) this._startSwap();
    }

    // ==================== BONECOS ====================

    _updateSpawning(now) {
        if (this.phase !== 'puppets' && this.phase !== 'bob') return;
        if (now < this.nextSpawnAt) return;

        const cfg = GC.PUPPETEER_BOSS;
        this.nextSpawnAt = now + cfg.SPAWN_INTERVAL_MS;
        if (this.scene.enemyManager.countAlivePuppets() >= cfg.MAX_ALIVE) return;

        const hand = this._nextLaunchingHand();
        if (hand) this._launchFrom(hand);
    }

    _nextLaunchingHand() {
        const count = this.hands.length;
        for (let i = 0; i < count; i++) {
            const index = (this.nextHandIndex + i) % count;
            if (this.hands[index].alive) {
                this.nextHandIndex = (index + 1) % count;
                return this.hands[index];
            }
        }
        return null;
    }

    _launchFrom(hand) {
        const cfg = GC.PUPPETEER_BOSS;
        const sprite = hand.sprite;
        const vx = Phaser.Math.Between(-cfg.LAUNCH_VX_MAX, cfg.LAUNCH_VX_MAX);
        const jitter = Phaser.Math.FloatBetween(-cfg.PUPPET_SPEED_JITTER, cfg.PUPPET_SPEED_JITTER);
        const gravityY = this.phase === 'bob' ? cfg.PUPPET_FALL_GRAVITY_Y : 0;

        this.scene.enemyManager.spawnPuppet(
            sprite.x, sprite.y + sprite.displayHeight / 2,
            vx, cfg.LAUNCH_VY, cfg.PUPPET_SPEED * (1 + jitter), gravityY
        );

        this.scene.tweens.add({
            targets: sprite,
            angle: { from: -8, to: 8 },
            duration: 90,
            yoyo: true,
            onComplete: () => sprite.setAngle(0)
        });
    }

    _updateCounter() {
        const total = GC.PUPPETEER_BOSS.KILLS_TO_SWAP;
        this.counterText.setText(`🎭 ${Math.min(this.kills, total)}/${total}`);
    }

    // ==================== TROCA DE PERSONAGEM ====================

    _startSwap() {
        const scene = this.scene;
        const pc = scene.playerController;
        this.phase = 'swap';

        scene.enemyManager.vanishAllPuppets();
        scene.tweens.add({
            targets: this.counterText,
            alpha: 0,
            duration: 400,
            delay: 600,
            onComplete: () => this.counterText.setVisible(false)
        });

        pc.player.setCollideWorldBounds(false);
        pc.controlOverride = () => this._updateRunOut();
    }

    _updateRunOut() {
        const scene = this.scene;
        const pc = scene.playerController;
        const player = pc.player;
        if (pc.isRespawning) return;

        player.setFlipX(true);
        player.setVelocityX(-GC.PUPPETEER_BOSS.RUN_OUT_SPEED);
        if (player.body.blocked.down) player.anims.play('walk', true);

        if (player.getBounds().right < scene.cameras.main.worldView.x) {
            this._bringBob();
        }
    }

    _bringBob() {
        const scene = this.scene;
        const cfg = GC.PUPPETEER_BOSS;
        const pc = scene.playerController;
        const player = pc.player;

        pc.controlOverride = () => {};
        pc.respawnOnDamage = false;
        pc.hearts = GC.HEARTS.MAX;
        scene.hudManager.updateHearts(pc.hearts);

        player.anims.stop();
        player.setTexture('puppeteer-bob');
        player.setFlipX(false);
        player.setAngle(0);
        player.body.allowGravity = false;
        player.setVelocity(0, 0);
        player.body.setSize(cfg.BOB_BODY_WIDTH, cfg.BOB_BODY_HEIGHT);
        player.body.setOffset(cfg.BOB_BODY_OFFSET_X, cfg.BOB_BODY_OFFSET_Y);
        player.setPosition(scene.cameras.main.worldView.right + player.width, this.hoverY);

        this._showBanner('BOB AO RESGATE!');
        SoundManager.play('powerUp');

        scene.tweens.add({
            targets: player,
            x: scene.physics.world.bounds.centerX,
            duration: cfg.BOB_ENTER_MS,
            ease: 'Cubic.easeOut',
            onComplete: () => this._startBobPhase()
        });
    }

    _startBobPhase() {
        const scene = this.scene;
        const pc = scene.playerController;
        this.phase = 'bob';

        pc.player.setCollideWorldBounds(true);
        scene.currentCheckpoint = { x: pc.player.x, y: this.hoverY };
        pc.controlOverride = () => this._updateBob();
        this.nextSpawnAt = scene.time.now + GC.PUPPETEER_BOSS.FIRST_SPAWN_DELAY_MS;
    }

    _showBanner(message) {
        const scene = this.scene;
        const bounds = scene.physics.world.bounds;
        const text = scene.add.text(bounds.centerX, bounds.centerY - 40, message, {
            fontSize: '32px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffe066',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(GC.DEPTH.HUD);

        scene.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 30,
            duration: 600,
            delay: 1200,
            onComplete: () => text.destroy()
        });
    }

    // ==================== BOB ====================

    _updateBob() {
        const scene = this.scene;
        const cfg = GC.PUPPETEER_BOSS;
        const pc = scene.playerController;
        const player = pc.player;
        if (pc.isRespawning) return;

        const vc = scene.virtualControls;
        const left = scene.cursors.left.isDown || vc.left;
        const right = scene.cursors.right.isDown || vc.right;
        const dir = (right ? 1 : 0) - (left ? 1 : 0);
        const now = scene.time.now;

        player.setVelocity(dir * cfg.BOB_SPEED, 0);
        player.setAngle(dir * cfg.BOB_BANK_DEG);
        player.y = this.hoverY + Math.sin((now / cfg.BOB_WOBBLE_MS) * Math.PI * 2) * cfg.BOB_WOBBLE_PX;

        vc.jumpJustPressed = false;
        if (this.phase === 'bob' && (scene.spaceKey.isDown || vc.jumpHeld)) {
            this._tryFire(now);
        }
    }

    _tryFire(now) {
        const cfg = GC.PUPPETEER_BOSS;
        if (now - this.lastShotAt < cfg.FIRE_COOLDOWN_MS) return;
        if (this.bullets.countActive(true) >= cfg.MAX_BULLETS) return;
        this.lastShotAt = now;

        const player = this.scene.playerController.player;
        const bullet = this.bullets.create(player.x, player.y - player.displayHeight / 2, 'puppeteer-bullet');
        bullet.setDepth(GC.DEPTH.PLAYER - 1);
        bullet.setVelocityY(-cfg.BULLET_SPEED);
        SoundManager.play('shoot');
    }

    _cullBullets() {
        if (!this.bullets) return;
        this.bullets.getChildren().slice().forEach(bullet => {
            if (bullet.y < -bullet.height) bullet.destroy();
        });
    }

    _ensureBulletTexture() {
        const scene = this.scene;
        const cfg = GC.PUPPETEER_BOSS;
        if (scene.textures.exists('puppeteer-bullet')) return;
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(cfg.BULLET_COLOR, 1);
        g.fillRect(0, 0, cfg.BULLET_WIDTH, cfg.BULLET_HEIGHT);
        g.generateTexture('puppeteer-bullet', cfg.BULLET_WIDTH, cfg.BULLET_HEIGHT);
        g.destroy();
    }

    _onBulletHitPuppet(bullet, puppet) {
        if (!bullet.active || !puppet.body?.enable) return;
        if (puppet.patrolData?.type !== 'puppet') return;
        bullet.destroy();
        this.scene.enemyManager.vanishPuppet(puppet);
        SoundManager.play('enemyPop');
    }

    // ==================== MÃOS ====================

    _onBulletHitHand(hand, bullet) {
        if (!bullet.active || !hand.alive || this.phase !== 'bob') return;
        const cfg = GC.PUPPETEER_BOSS;
        bullet.destroy();

        hand.hp--;
        SoundManager.play('damage');
        hand.sprite.setTintFill(0xffffff);
        this.scene.time.delayedCall(cfg.HAND_HIT_FLASH_MS, () => {
            if (hand.alive) hand.sprite.clearTint();
        });

        if (hand.hp <= 0) this._destroyHand(hand);
    }

    _destroyHand(hand) {
        const scene = this.scene;
        const sprite = hand.sprite;
        hand.alive = false;
        hand.sway.stop();
        sprite.body.enable = false;
        sprite.clearTint();

        scene.effectsManager.createEnemyPopBurst(sprite.x, sprite.y, 1.5);
        SoundManager.play('enemyPop');
        scene.cameras.main.shake(200, 0.006);

        const origin = { x: sprite.x, y: sprite.y };
        scene.tweens.add({
            targets: sprite,
            y: sprite.y + 80,
            angle: 40,
            alpha: 0,
            duration: 700,
            ease: 'Quad.easeIn',
            onComplete: () => sprite.destroy()
        });

        if (this.hands.every(h => !h.alive)) this._onDefeated(origin);
    }

    _onDefeated(origin) {
        const scene = this.scene;
        this.phase = 'defeated';
        scene.enemyManager.vanishAllPuppets();
        // Chamado de dentro do overlap mão×tiros: esvaziar o grupo agora
        // destruiria corpos que a física ainda vai percorrer neste passo.
        scene.time.delayedCall(0, () => this.bullets.clear(true, true));

        scene.time.delayedCall(GC.PUPPETEER_BOSS.DEFEAT_DELAY_MS, () => {
            if (scene.hasWon || scene.playerController.isRespawning) return;
            scene.victoryScreen.reachGoal(origin);
            // reachGoal toca o 'idle' do personagem; o Bob não tem animação.
            const player = scene.playerController.player;
            player.anims.stop();
            player.setTexture('puppeteer-bob');
        });
    }

    _drawHandBars() {
        const g = this.handBars;
        if (!g) return;
        g.clear();
        if (!this.isBobPhase()) return;

        const cfg = GC.PUPPETEER_BOSS;
        const w = cfg.HAND_BAR_WIDTH;
        const h = cfg.HAND_BAR_HEIGHT;
        this.hands.forEach(hand => {
            if (!hand.alive) return;
            const sprite = hand.sprite;
            const x = sprite.x - w / 2;
            const y = sprite.y + sprite.displayHeight / 2 + cfg.HAND_BAR_GAP;
            g.fillStyle(0x000000, 0.6);
            g.fillRect(x - 1, y - 1, w + 2, h + 2);
            g.fillStyle(0xff4d6d, 1);
            g.fillRect(x, y, w * hand.hp / cfg.HAND_HEALTH, h);
        });
    }

    // ==================== UTIL ====================

    _findFloorY(x) {
        const layer = this.scene.solidsLayer;
        const bounds = this.scene.physics.world.bounds;
        if (!layer) return bounds.bottom;
        const map = layer.tilemap;
        const tileX = map.worldToTileX(x);
        for (let tileY = 0; tileY < map.height; tileY++) {
            const tile = layer.getTileAt(tileX, tileY);
            if (tile && tile.collides) return tile.pixelY;
        }
        return bounds.bottom;
    }
}
