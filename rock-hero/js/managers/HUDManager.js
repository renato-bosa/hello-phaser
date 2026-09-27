/**
 * HUDManager - Interface de gameplay
 * Responsável por: timer, melhor tempo, contador de estrelas, corações, vidas,
 * indicador de vento, itens na mão, debug velocity
 */
class HUDManager {
    constructor(scene) {
        this.scene = scene;
        this.timerText = null;
        this.bestTimeText = null;
        this.starHUD = null;
        this.starText = null;
        this.heldContainer = null;
        this._heldSignature = '';
        this.debugVelocityText = null;
        this.heartTexts = [];
        this.livesText = null;
        this.windContainer = null;
        this.windArrow = null;
        this.windBars = [];
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

        this._createHeartsDisplay();
        this._createLivesDisplay();
        this._createWindIndicator();
        this._createHeldItems();

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

    /**
     * Indicador canto inferior esquerdo: seta de direção + barras de intensidade.
     * Só é criado quando a fase tem WindSystem ativo.
     */
    _createWindIndicator() {
        const scene = this.scene;
        if (!scene.windSystem) return;

        const cam = scene.cameras.main;
        const barCount = GC.WIND.INDICATOR_BARS;
        this.windContainer = scene.add.container(18, cam.height - 22)
            .setScrollFactor(0)
            .setDepth(GC.DEPTH.HUD)
            .setAlpha(0.85);

        this.windArrow = scene.add.text(0, 0, '→', {
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#a8d4ff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0.5);
        this.windContainer.add(this.windArrow);

        this.windBars = [];
        for (let i = 0; i < barCount; i++) {
            const bar = scene.add.rectangle(22 + i * 8, 0, 5, 4 + i * 3, 0x4a6a8a, 1)
                .setOrigin(0, 0.5)
                .setStrokeStyle(1, 0x000000);
            this.windContainer.add(bar);
            this.windBars.push(bar);
        }
    }

    updateWindIndicator() {
        if (!this.windContainer || !this.scene.windSystem) return;

        const wind = this.scene.windSystem;
        const dir = wind.direction;
        const intensity = wind.intensity;

        this.windArrow.setText(dir >= 0 ? '→' : '←');

        const lit = Math.round(intensity * this.windBars.length);
        this.windBars.forEach((bar, i) => {
            const on = i < lit;
            bar.setFillStyle(on ? 0xa8d4ff : 0x2a3a4a, on ? 1 : 0.5);
        });

        // Some levemente quando o vento está quase nulo
        const strength = Math.abs(wind.force) / GC.WIND.MAX_SPEED;
        this.windContainer.setAlpha(0.35 + 0.55 * strength);
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

    _createHeartsDisplay() {
        const scene = this.scene;
        const cam = scene.cameras.main;
        const hearts = scene.playerController.hearts;
        const maxHearts = GC.HEARTS.MAX;

        this.heartTexts = [];
        for (let i = 0; i < maxHearts; i++) {
            const heartChar = i < hearts ? '❤️' : '🖤';
            const ht = scene.add.text(cam.centerX - 30 + i * 22, 6, heartChar, {
                fontSize: '16px',
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(GC.DEPTH.HUD);
            this.heartTexts.push(ht);
        }
    }

    _createLivesDisplay() {
        const scene = this.scene;
        const cam = scene.cameras.main;
        const lives = GameData.getLives();
        this.livesText = scene.add.text(cam.centerX, 26, `x${lives}`, {
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(GC.DEPTH.HUD).setAlpha(0.8);
    }

    /**
     * Quadradinhos dos itens na mão (pedra, chave). Sem item, não desenha caixa vazia.
     * Fica abaixo do contador de estrelas quando a fase tem um.
     */
    _createHeldItems() {
        const scene = this.scene;
        const y = this.starHUD ? 40 : 8;
        this.heldContainer = scene.add.container(10, y)
            .setScrollFactor(0)
            .setDepth(GC.DEPTH.HUD);
    }

    updateHeldItems() {
        const items = this._heldItemTextures();
        const signature = items.join('|');
        if (signature === this._heldSignature) return;
        this._heldSignature = signature;
        this._renderHeldItems(items);
    }

    _heldItemTextures() {
        const scene = this.scene;
        const items = [];

        if (scene.slingshotManager?.hasStone && scene.textures.exists('pedra-estilingue')) {
            items.push('pedra-estilingue');
        }

        const holdingKey = scene.hasPrisonKey
            && scene.prisonState !== 'opening'
            && scene.prisonState !== 'open';
        if (holdingKey) {
            const worldId = GameData.LEVELS[scene.currentLevel]?.world || 1;
            const keyTexture = scene.textures.exists(`prison-key-w${worldId}`)
                ? `prison-key-w${worldId}`
                : 'prison-key-w1';
            if (scene.textures.exists(keyTexture)) items.push(keyTexture);
        }

        return items;
    }

    _renderHeldItems(items) {
        this.heldContainer.removeAll(true);
        const slot = 28;
        const gap = 4;
        const pad = 4;
        items.forEach((textureKey, i) => {
            const x = i * (slot + gap);
            const bg = this.scene.add.rectangle(x, 0, slot, slot, 0x000000, 0.55)
                .setOrigin(0, 0)
                .setStrokeStyle(2, 0xffffff, 0.9);
            const icon = this.scene.add.image(0, 0, textureKey).setOrigin(0.5);
            const max = slot - pad * 2;
            const metrics = this._opaqueMetrics(textureKey);
            const scale = Math.min(max / metrics.bw, max / metrics.bh);
            icon.setScale(scale);
            // O desenho da chave fica no rodapé do frame 32×32. Centraliza o
            // miolo opaco, não o quadro inteiro, para não cortar embaixo.
            icon.setPosition(
                x + slot / 2 - metrics.ox * scale,
                slot / 2 - metrics.oy * scale
            );
            this.heldContainer.add([bg, icon]);
        });
    }

    /** Centro e tamanho dos pixels visíveis, em relação ao centro do frame. */
    _opaqueMetrics(textureKey) {
        if (!this._opaqueMetricsCache) this._opaqueMetricsCache = {};
        if (this._opaqueMetricsCache[textureKey]) return this._opaqueMetricsCache[textureKey];

        const src = this.scene.textures.get(textureKey).getSourceImage();
        const w = src.width;
        const h = src.height;
        const fallback = { ox: 0, oy: 0, bw: w || 1, bh: h || 1 };
        if (!w || !h) {
            this._opaqueMetricsCache[textureKey] = fallback;
            return fallback;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(src, 0, 0);
        let pixels;
        try {
            pixels = ctx.getImageData(0, 0, w, h).data;
        } catch (e) {
            this._opaqueMetricsCache[textureKey] = fallback;
            return fallback;
        }

        let minX = w;
        let minY = h;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (pixels[(y * w + x) * 4 + 3] <= 20) continue;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
        if (maxX < 0) {
            this._opaqueMetricsCache[textureKey] = fallback;
            return fallback;
        }

        const metrics = {
            ox: (minX + maxX) / 2 - w / 2,
            oy: (minY + maxY) / 2 - h / 2,
            bw: maxX - minX + 1,
            bh: maxY - minY + 1
        };
        this._opaqueMetricsCache[textureKey] = metrics;
        return metrics;
    }

    updateHearts(current) {
        const max = GC.HEARTS.MAX;
        for (let i = 0; i < max; i++) {
            if (this.heartTexts[i]) {
                this.heartTexts[i].setText(i < current ? '❤️' : '🖤');
            }
        }
    }

    updateLives(count) {
        if (this.livesText) {
            this.livesText.setText(`x${count}`);
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
