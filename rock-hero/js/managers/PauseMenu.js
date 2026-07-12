/**
 * PauseMenu - Menu de pausa
 * Responsável por: overlay de pausa, navegação, ações (continuar, mapa, personagem, sair)
 */
class PauseMenu {
    constructor(scene) {
        this.scene = scene;
        this.selectedIndex = 0;
        this.buttons = [];
        this.keyListeners = [];
    }

    show() {
        const scene = this.scene;
        scene.currentView = 'paused';
        GameData.saveProgress(scene.currentLevel, scene.playerName);

        scene.physics.pause();
        scene.pausedAtTime = scene.time.now;
        MusicManager.pause();

        const centerX = scene.cameras.main.centerX;
        const centerY = scene.cameras.main.centerY;

        const overlay = scene.add.rectangle(centerX, centerY, 640, 352, 0x000000, 0.8)
            .setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY);
        scene.overlayElements.push(overlay);

        const title = scene.add.text(centerX, centerY - 100, '⏸ PAUSADO', {
            fontSize: '32px', fontFamily: '"Press Start 2P", Arial', color: '#ffffff',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
        scene.overlayElements.push(title);

        this.selectedIndex = 0;
        this.buttons = [];

        const buttonConfigs = [
            { text: '▶ Continuar Jogando', color: '#00ff00', action: () => this.resume() },
            { text: '🗺 Voltar ao Mapa', color: '#4ecdc4', action: () => this._goToWorldMap() },
            { text: '👤 Trocar Personagem', color: '#a855f7', action: () => this._changeCharacter() },
            { text: '🚪 Sair do Jogo', color: '#ff6b6b', action: () => this._goToMenu() }
        ];

        const startY = centerY - 40;
        const spacing = 38;

        buttonConfigs.forEach((config, index) => {
            const btn = scene.add.text(centerX, startY + (index * spacing), config.text, {
                fontSize: '18px', fontFamily: '"Press Start 2P", Arial', color: config.color,
                stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT).setInteractive({ useHandCursor: true });

            btn.defaultColor = config.color;
            btn.action = config.action;

            btn.on('pointerover', () => {
                if (this.selectedIndex !== index) SoundManager.play('menuNavigate');
                this.selectedIndex = index;
                this._updateStyles();
            });
            btn.on('pointerdown', () => {
                SoundManager.play('menuSelect');
                config.action();
            });

            this.buttons.push(btn);
            scene.overlayElements.push(btn);
        });

        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const instrText = isMobile
            ? '← →: Navegar | O: Selecionar | X: Voltar'
            : '↑↓: Navegar | Enter: Selecionar | ESC: Voltar';
        const instructions = scene.add.text(centerX, centerY + 130, instrText, {
            fontSize: '10px', fontFamily: 'Arial', color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
        scene.overlayElements.push(instructions);

        this._updateStyles();
        this._setupControls();
    }

    handleInput() {
        const vc = this.scene.virtualControls;

        if (vc.backJustPressed) {
            vc.backJustPressed = false;
            this.resume();
        }
        if (vc.jumpJustPressed) {
            vc.jumpJustPressed = false;
            SoundManager.play('menuSelect');
            this.buttons[this.selectedIndex].action();
        }
        if (vc.left) {
            vc.left = false;
            const prev = this.selectedIndex;
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            if (this.selectedIndex !== prev) {
                SoundManager.play('menuNavigate');
                this._updateStyles();
            }
        }
        if (vc.right) {
            vc.right = false;
            const prev = this.selectedIndex;
            this.selectedIndex = Math.min(this.buttons.length - 1, this.selectedIndex + 1);
            if (this.selectedIndex !== prev) {
                SoundManager.play('menuNavigate');
                this._updateStyles();
            }
        }
    }

    _setupControls() {
        const scene = this.scene;
        const upKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        const downKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        const enterKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        upKey.on('down', () => {
            if (scene.currentView === 'paused') {
                const prev = this.selectedIndex;
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                if (this.selectedIndex !== prev) SoundManager.play('menuNavigate');
                this._updateStyles();
            }
        });

        downKey.on('down', () => {
            if (scene.currentView === 'paused') {
                const prev = this.selectedIndex;
                this.selectedIndex = Math.min(this.buttons.length - 1, this.selectedIndex + 1);
                if (this.selectedIndex !== prev) SoundManager.play('menuNavigate');
                this._updateStyles();
            }
        });

        enterKey.on('down', () => {
            if (scene.currentView === 'paused') {
                SoundManager.play('menuSelect');
                this.buttons[this.selectedIndex].action();
            }
        });

        this.keyListeners = [upKey, downKey, enterKey];
    }

    _updateStyles() {
        this.buttons.forEach((btn, index) => {
            if (index === this.selectedIndex) {
                btn.setStyle({ color: '#ffffff' });
                btn.setScale(1.1);
            } else {
                btn.setStyle({ color: btn.defaultColor });
                btn.setScale(1);
            }
        });
    }

    resume() {
        const scene = this.scene;

        if (scene.pausedAtTime) {
            const pauseDuration = scene.time.now - scene.pausedAtTime;
            scene.levelStartTime += pauseDuration;
            scene.pausedAtTime = null;
        }

        scene.physics.resume();
        scene.currentView = 'gameplay';
        MusicManager.resume();
        this._clearOverlay();
        this.clearListeners();
    }

    _goToMenu() {
        this._clearOverlay();
        this.clearListeners();
        this.scene.scene.start('MenuScene');
    }

    _goToWorldMap() {
        this._clearOverlay();
        this.clearListeners();

        const scene = this.scene;
        const levelConfig = GameData.LEVELS[scene.currentLevel];
        const worldId = levelConfig?.world || 1;
        GameData.saveMapPosition(worldId, scene.currentLevel, 'pause:goToWorldMap');
        scene.scene.start('WorldMapScene', {});
    }

    _changeCharacter() {
        this._clearOverlay();
        this.clearListeners();

        const scene = this.scene;
        scene.scene.start('CharacterSelectScene', {
            returnTo: 'GameScene',
            returnData: {
                level: scene.currentLevel,
                playerName: scene.playerName
            }
        });
    }

    _clearOverlay() {
        this.scene.overlayElements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        this.scene.overlayElements = [];
    }

    clearListeners() {
        this.keyListeners.forEach(key => {
            if (key && key.destroy) key.destroy();
        });
        this.keyListeners = [];
    }
}
