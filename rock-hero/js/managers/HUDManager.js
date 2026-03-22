/**
 * HUDManager - Interface de gameplay
 * Responsável por: timer, melhor tempo, contador de estrelas, debug velocity
 */
class HUDManager {
    constructor(scene) {
        this.scene = scene;
        this.timerText = null;
        this.bestTimeText = null;
        this.starHUD = null;
        this.starText = null;
        this.debugVelocityText = null;
    }

    create() {
        const scene = this.scene;
        const cam = scene.cameras.main;

        this.timerText = scene.add.text(cam.width - 16, 5, '⏱ 0:00.000', {
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(GC.DEPTH.HUD).setAlpha(0.8);

        const bestTime = GameData.getBestTime(scene.currentLevel);
        if (bestTime) {
            this.bestTimeText = scene.add.text(cam.width - 16, 30, `🏆 ${GameData.formatTime(bestTime)}`, {
                fontSize: '14px',
                fontFamily: 'monospace',
                color: '#ffd700',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(GC.DEPTH.HUD).setAlpha(0.8);
        }

        if (scene.totalStars > 0) {
            this.starHUD = scene.add.container(20, 16).setScrollFactor(0).setDepth(GC.DEPTH.HUD).setAlpha(0.8);
            const starIcon = scene.add.sprite(0, 0, 'star', 0).setScale(0.8);
            this.starText = scene.add.text(20, 0, `0/${scene.totalStars}`, {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0, 0.5);
            this.starHUD.add([starIcon, this.starText]);
        }

        if (scene.physics.world.drawDebug) {
            this.debugVelocityText = scene.add.text(0, 0, '', {
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#ff4444',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0, 1).setDepth(GC.DEPTH.DEBUG);
        }
    }

    showLevelName(name) {
        const scene = this.scene;
        const text = scene.add.text(scene.cameras.main.centerX, 50, name, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.HUD);

        scene.tweens.add({
            targets: text,
            alpha: 0,
            duration: 500,
            delay: 1500,
            onComplete: () => text.destroy()
        });
    }

    updateTimer(currentTime) {
        const scene = this.scene;
        if (scene.levelStartTime === null) {
            scene.levelStartTime = currentTime;
        }
        scene.elapsedTime = currentTime - scene.levelStartTime;
        this.timerText.setText(`⏱ ${GameData.formatTime(scene.elapsedTime)}`);
    }

    updateStarCount(collected, total) {
        if (this.starText) {
            this.starText.setText(`${collected}/${total}`);
        }
        if (this.starHUD) {
            this.scene.tweens.add({
                targets: this.starHUD,
                scale: 1.3,
                duration: 100,
                yoyo: true
            });
        }
    }

    updateDebugVelocity() {
        if (!this.debugVelocityText) return;

        const player = this.scene.playerController.player;
        const pc = this.scene.playerController;
        const vx = Math.round(player.body.velocity.x);
        const vy = Math.round(player.body.velocity.y);
        const speed = Math.round(Math.sqrt(vx * vx + vy * vy));
        const inWater = pc.isInWater ? ' [WATER]' : '';
        this.debugVelocityText.setText(`${speed}px/s (${vx}, ${vy})${inWater}`);
        this.debugVelocityText.setPosition(player.x + 20, player.y - 20);
    }
}
