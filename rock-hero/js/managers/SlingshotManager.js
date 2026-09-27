/**
 * Estilingue da fase do cavalo-marinho chefe.
 * Só é criado quando a fase liga `estilingue`.
 * Um ponto de pedra aleatório fica ativo por vez. Com a pedra na mão,
 * encostar no estilingue abre a mira; o botão de pulo lança.
 */
class SlingshotManager {
    constructor(scene) {
        this.scene = scene;
        this.spawnPoints = [];
        this.lastSpawnIndex = -1;
        this.hasStone = false;
        this.restingStone = null;
        this.projectile = null;
        this.slingshot = null;
        this.facing = 1;
        this.playerAtSlingshot = false;
        this.aiming = false;
        this.bossDown = false;
        this.aim = null;
    }

    create(slingshotData, spawnPoints) {
        const scene = this.scene;
        this.spawnPoints = spawnPoints.slice();
        this.facing = slingshotData.transform?.flipX ? -1 : 1;

        this.slingshot = scene.physics.add.staticSprite(
            slingshotData.x, slingshotData.y, 'estilingue'
        );
        this.slingshot.setDepth(GC.DEPTH.PLAYER - 1);
        this.slingshot.refreshBody();
        if (slingshotData.transform?.flipX) this.slingshot.setFlipX(true);
        if (slingshotData.transform?.flipY) this.slingshot.setFlipY(true);

        scene.physics.add.overlap(scene.playerController.player, this.slingshot, () => {
            this.playerAtSlingshot = true;
        });

        this.aim = scene.add.graphics().setDepth(GC.DEPTH.PLAYER + 2);
        this._spawnRestingStone();
    }

    /**
     * Chamado antes do PlayerController. Se a mira está ativa e o pulo
     * foi pressionado, lança a pedra e pede para o pulo ser ignorado.
     */
    consumeFireInput() {
        this.aiming = this.playerAtSlingshot && this.hasStone && !this.projectile?.active;
        this.playerAtSlingshot = false;
        if (!this.aiming) return false;

        const vc = this.scene.virtualControls;
        const pressed = Phaser.Input.Keyboard.JustDown(this.scene.spaceKey) || vc.jumpJustPressed;
        if (!pressed) return false;

        this._fire();
        this.aiming = false;
        return true;
    }

    update() {
        this._drawAim();
    }

    onBossDefeated() {
        this.bossDown = true;
        this.aiming = false;
    }

    _spawnRestingStone() {
        if (this.bossDown || this.hasStone || this.projectile?.active) return;
        if (!this.spawnPoints.length) return;
        if (!this.scene.textures.exists('pedra-estilingue')) return;

        let index = Phaser.Math.Between(0, this.spawnPoints.length - 1);
        if (this.spawnPoints.length > 1 && index === this.lastSpawnIndex) {
            index = (index + 1 + Phaser.Math.Between(0, this.spawnPoints.length - 2)) % this.spawnPoints.length;
        }
        this.lastSpawnIndex = index;
        const point = this.spawnPoints[index];

        const stone = this.scene.physics.add.staticSprite(point.x, point.y, 'pedra-estilingue');
        stone.setDepth(GC.DEPTH.PLAYER);
        stone.refreshBody();
        this.restingStone = stone;

        this.scene.physics.add.overlap(this.scene.playerController.player, stone, () => {
            this._collectStone();
        });
    }

    _collectStone() {
        if (this.hasStone || !this.restingStone?.active) return;
        this.hasStone = true;
        this.restingStone.destroy();
        this.restingStone = null;
        SoundManager.play('collectStar');
    }

    _aimVector() {
        const cfg = GC.SLINGSHOT;
        const osc = Math.sin((this.scene.time.now / cfg.AIM_PERIOD_MS) * Math.PI * 2);
        const deg = cfg.AIM_CENTER_DEG + osc * cfg.AIM_AMPLITUDE_DEG;
        const rad = Phaser.Math.DegToRad(deg);
        return {
            x: Math.cos(rad) * this.facing,
            y: Math.sin(rad)
        };
    }

    _drawAim() {
        if (!this.aim) return;
        this.aim.clear();
        if (!this.aiming || !this.slingshot?.active) return;

        const v = this._aimVector();
        const len = GC.SLINGSHOT.AIM_LENGTH;
        const x = this.slingshot.x;
        const y = this.slingshot.y;
        const tipX = x + v.x * len;
        const tipY = y + v.y * len;

        this.aim.lineStyle(2, 0xfff2a8, 0.95);
        this.aim.beginPath();
        this.aim.moveTo(x, y);
        this.aim.lineTo(tipX, tipY);
        this.aim.strokePath();
        this.aim.fillStyle(0xfff2a8, 1);
        this.aim.fillCircle(tipX, tipY, 3);
    }

    _fire() {
        if (!this.hasStone || this.projectile?.active || !this.slingshot) return;
        const scene = this.scene;
        const v = this._aimVector();
        const speed = GC.SLINGSHOT.STONE_SPEED;

        const stone = scene.physics.add.sprite(this.slingshot.x, this.slingshot.y, 'pedra-estilingue');
        stone.setDepth(GC.DEPTH.PLAYER + 1);
        stone.body.allowGravity = false;
        stone.body.setSize(18, 18, true);
        stone.setVelocity(v.x * speed, v.y * speed);
        this.projectile = stone;
        this.hasStone = false;

        scene.physics.add.collider(stone, scene.solidsLayer, () => this._destroyProjectile(true));
        if (scene.enemyManager?.enemies) {
            scene.physics.add.overlap(stone, scene.enemyManager.enemies, (proj, enemy) => {
                if (!proj.active || proj.getData('spent')) return;
                if (enemy.patrolData?.type !== 'cavalo-marinho-chefe') return;
                proj.setData('spent', true);
                scene.enemyManager.hitCavaloMarinhoChefe(enemy);
                this._destroyProjectile(true);
            });
        }
    }

    _destroyProjectile(respawn) {
        if (this.projectile?.active) this.projectile.destroy();
        this.projectile = null;
        if (!respawn || this.bossDown) return;
        this.scene.time.delayedCall(0, () => this._spawnRestingStone());
    }
}
