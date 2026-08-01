/**
 * CUTSCENE SCENE - Exibe sequências de imagens pré-renderizadas
 *
 * Cena Phaser parametrizada. Recebe `cutsceneId` (chave em GameConfig.CUTSCENES)
 * e `next` (cena para onde ir ao final). Sem dependência do conteúdo —
 * tudo dirigido por dados de config.
 *
 * Comportamento (definido em GameConfig.CUTSCENES[id]):
 * - Cada frame fica bloqueado por `unlockMs` ms (4s default).
 * - Após `unlockMs`, surge prompt "▶ Pressione O para continuar".
 * - Avanço manual via O / Enter / Space / Click / → (sem auto-advance).
 * - Voltar frame via ← (sem unlock; no-op no primeiro slide).
 * - Crossfade de `fadeMs` ms entre frames.
 * - Sem skip da cutscene inteira — usuário passa frame a frame.
 * - Indicador de progresso (●●○○○○) no rodapé.
 * - Letterbox: imagens são escaladas para caber preservando aspect ratio;
 *   cor de fundo (`bgColor`) preenche o resto.
 *
 * Uso:
 *   this.scene.start('CutsceneScene', {
 *       cutsceneId: 'opening',
 *       next: { scene: 'WorldMapScene', data: {} }
 *   });
 */

class CutsceneScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CutsceneScene' });
    }

    init(data) {
        this.cutsceneId = data?.cutsceneId || 'opening';
        this.nextScene = data?.next?.scene || 'MenuScene';
        this.nextData = data?.next?.data || {};

        this.config = GameConfig.CUTSCENES[this.cutsceneId];
        if (!this.config) {
            console.warn(`CutsceneScene: cutscene "${this.cutsceneId}" não encontrada — pulando.`);
            this.scene.start(this.nextScene, this.nextData);
            return;
        }

        this.currentFrameIdx = 0;
        this.canAdvance = false;
        this.isTransitioning = false;
        this.currentImage = null;
        this.previousImage = null;
    }

    preload() {
        if (!this.config) return;

        this.config.frames.forEach((frame, i) => {
            const key = this._frameKey(i);
            if (!this.textures.exists(key)) {
                this.load.image(key, GameState.assetUrl(frame.file));
            }
        });

        MusicManager.preload(this);
    }

    create() {
        if (!this.config) return;

        const cam = this.cameras.main;
        const bgColor = this.config.bgColor ?? 0x000000;

        // Fundo (letterbox)
        this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, bgColor);

        // Container que vai segurar as imagens (facilita troca/crossfade)
        this.frameContainer = this.add.container(cam.centerX, cam.centerY);

        // Indicador de progresso (●○○○○○) — no rodapé
        this._createProgressDots();

        // Prompt "Pressione O" — fica invisível até o unlock
        this._createAdvancePrompt();

        // Listeners de input — só pra avanço manual
        this._setupControls();

        this.virtualControls = GameState.getVirtualControls();

        MusicManager.startCutscene(this, this.cutsceneId);

        // Mostra primeiro frame
        this._showFrame(0);
    }

    update() {
        if (!this.virtualControls) return;

        // Avanço via overlay mobile (botão O)
        if (this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
            this._tryAdvance();
        }
    }

    // ==================== CONTROLES ====================

    _setupControls() {
        const handleAdvance = () => this._tryAdvance();
        const handleBack = () => this._tryBack();

        const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        const oKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O);
        const rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        const leftKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);

        enterKey.on('down', handleAdvance);
        spaceKey.on('down', handleAdvance);
        oKey.on('down', handleAdvance);
        rightKey.on('down', handleAdvance);
        leftKey.on('down', handleBack);

        this.input.on('pointerdown', handleAdvance);

        this.keyListeners = [enterKey, spaceKey, oKey, rightKey, leftKey];
    }

    _tryAdvance() {
        if (!this.canAdvance || this.isTransitioning) return;

        SoundManager.play('menuSelect');

        const nextIdx = this.currentFrameIdx + 1;
        if (nextIdx >= this.config.frames.length) {
            this._finish();
        } else {
            this._showFrame(nextIdx);
        }
    }

    _tryBack() {
        // Voltar não exige unlock — só bloqueia durante crossfade
        if (this.isTransitioning) return;
        if (this.currentFrameIdx <= 0) return;

        SoundManager.play('menuNavigate');
        this._showFrame(this.currentFrameIdx - 1);
    }

    // ==================== TRANSIÇÕES ====================

    _showFrame(idx) {
        this.isTransitioning = true;
        this.canAdvance = false;

        // Esconde prompt enquanto transita
        if (this.advancePrompt) {
            this.tweens.killTweensOf(this.advancePrompt);
            this.advancePrompt.setAlpha(0).setScale(1);
        }

        const key = this._frameKey(idx);
        const newImage = this._createImageFitted(key);
        newImage.setAlpha(0);
        this.frameContainer.add(newImage);

        const fadeMs = this.config.fadeMs ?? 600;

        // Crossfade: imagem antiga sai, nova entra
        if (this.currentImage) {
            const oldImage = this.currentImage;
            this.tweens.add({
                targets: oldImage,
                alpha: 0,
                duration: fadeMs,
                onComplete: () => oldImage.destroy()
            });
        }

        this.tweens.add({
            targets: newImage,
            alpha: 1,
            duration: fadeMs,
            onComplete: () => {
                this.currentFrameIdx = idx;
                this.currentImage = newImage;
                this.isTransitioning = false;
                this._scheduleUnlock();
                this._updateProgressDots();
            }
        });
    }

    _scheduleUnlock() {
        if (this.unlockTimer) {
            this.unlockTimer.remove();
            this.unlockTimer = null;
        }
        const unlockMs = this.config.unlockMs ?? 4000;
        this.unlockTimer = this.time.delayedCall(unlockMs, () => {
            this.canAdvance = true;
            this._showAdvancePrompt();
        });
    }

    _finish() {
        if (this.unlockTimer) this.unlockTimer.remove();
        this.scene.start(this.nextScene, this.nextData);
    }

    // ==================== HELPERS DE LAYOUT ====================

    /**
     * Cria a imagem escalada para caber no canvas mantendo aspect ratio.
     * Usa filtro LINEAR (cutscenes são imagens pré-renderizadas, não pixel art).
     */
    _createImageFitted(textureKey) {
        const cam = this.cameras.main;

        if (this.textures.exists(textureKey)) {
            this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
        }

        const img = this.add.image(0, 0, textureKey).setOrigin(0.5);
        const tex = img.texture.getSourceImage();
        const texW = tex.width || img.width;
        const texH = tex.height || img.height;

        // Escala para caber preservando aspect ratio (letterbox)
        const scale = Math.min(cam.width / texW, cam.height / texH);
        img.setScale(scale);

        return img;
    }

    _frameKey(idx) {
        return `cutscene-${this.cutsceneId}-${idx}`;
    }

    // ==================== UI: PROGRESSO E PROMPT ====================

    _createProgressDots() {
        const cam = this.cameras.main;
        const total = this.config.frames.length;
        const spacing = 14;
        const totalWidth = (total - 1) * spacing;
        const startX = cam.centerX - totalWidth / 2;
        const y = cam.height - 28;

        this.progressDots = [];
        for (let i = 0; i < total; i++) {
            const dot = this.add.circle(startX + i * spacing, y, 4, 0xffffff, 0.3)
                .setStrokeStyle(1, 0x000000, 0.6);
            this.progressDots.push(dot);
        }
    }

    _updateProgressDots() {
        if (!this.progressDots) return;
        this.progressDots.forEach((dot, i) => {
            const active = i <= this.currentFrameIdx;
            dot.setFillStyle(0xffffff, active ? 1 : 0.3);
        });
    }

    _createAdvancePrompt() {
        const cam = this.cameras.main;

        // Padding extra evita que a glifo seja cortado em algumas fontes/renderers
        this.advancePrompt = this.add.text(cam.centerX, cam.height - 10, '▶', {
            fontSize: '8px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            padding: { top: 2, bottom: 2 }
        }).setOrigin(0.5, 0.5).setAlpha(0);
    }

    _showAdvancePrompt() {
        if (!this.advancePrompt) return;

        this.tweens.add({
            targets: this.advancePrompt,
            alpha: 1,
            duration: 400,
            ease: 'Sine.easeOut'
        });

        // Pulsação sutil para chamar atenção
        this.tweens.add({
            targets: this.advancePrompt,
            scale: { from: 1, to: 1.08 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    // ==================== CLEANUP ====================

    shutdown() {
        if (this.unlockTimer) {
            this.unlockTimer.remove();
            this.unlockTimer = null;
        }
        if (this.keyListeners) {
            this.keyListeners.forEach(k => k && k.destroy && k.destroy());
            this.keyListeners = [];
        }
        this.input.off('pointerdown');
        this.tweens.killAll();
        MusicManager.stop();
    }
}
