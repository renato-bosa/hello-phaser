/**
 * MENU SCENE - Menu Principal do Jogo
 * 
 * Responsabilidades:
 * - Exibir menu principal
 * - Navegação entre opções
 * - Redirecionar para seleção de slots
 * - Mostrar ranking
 */

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        // Carrega apenas sprite do vocalista para o menu (definição centralizada em GameData)
        GameData.loadCharacterSprites(this, 'vocalista');
    }

    create() {
        // Limpa qualquer estado anterior
        this.cleanup();
        
        // Configurações básicas
        this.centerX = this.cameras.main.centerX;
        this.centerY = this.cameras.main.centerY;
        
        // Estado da cena
        this.currentView = 'menu'; // 'menu', 'ranking'
        this.selectedIndex = 0;
        this.menuButtons = [];
        
        // Cria elementos visuais
        this.createBackground();
        this.createHeroSprite();
        this.createTitle();
        this.createMenuButtons();
        this.createInstructions();
        
        // Configura controles
        this.setupControls();
    }

    cleanup() {
        // Remove listeners anteriores se existirem
        if (this.keyListeners) {
            this.keyListeners.forEach(key => {
                if (key && key.destroy) key.destroy();
            });
        }
        this.keyListeners = [];
        
        // Limpa arrays
        this.overlayElements = [];
    }

    update(time) {
        if (!this.virtualControls) return;
        
        // O = confirmar (mesmo que ENTER)
        if (this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
            if (this.handleSelectFn) {
                this.handleSelectFn();
            }
        }

        // X = voltar (mesmo que ESC)
        if (this.virtualControls.backJustPressed) {
            this.virtualControls.backJustPressed = false;
            if (this.currentView === 'ranking' || this.currentView === 'effects') {
                SoundManager.play('menuNavigate');
                this.closeOverlay();
            }
        }

        // Navegação via d-pad (left/right) com throttle
        if (time - this.lastNavTime > 200) {
            if (this.virtualControls.left) {
                this.lastNavTime = time;
                if (this.currentView === 'menu') {
                    const prevIndex = this.selectedIndex;
                    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                    if (this.selectedIndex !== prevIndex) {
                        SoundManager.play('menuNavigate');
                        this.updateButtonStyles();
                    }
                } else if (this.currentView === 'effects') {
                    const prevIndex = this.effectSelectedIndex;
                    this.effectSelectedIndex = Math.max(0, this.effectSelectedIndex - 1);
                    if (this.effectSelectedIndex !== prevIndex) {
                        SoundManager.play('menuNavigate');
                        this.updateEffectSelection();
                    }
                }
            } else if (this.virtualControls.right) {
                this.lastNavTime = time;
                if (this.currentView === 'menu') {
                    const prevIndex = this.selectedIndex;
                    this.selectedIndex = Math.min(this.menuButtons.length - 1, this.selectedIndex + 1);
                    if (this.selectedIndex !== prevIndex) {
                        SoundManager.play('menuNavigate');
                        this.updateButtonStyles();
                    }
                } else if (this.currentView === 'effects') {
                    const prevIndex = this.effectSelectedIndex;
                    this.effectSelectedIndex = Math.min(this.effectToggles.length - 1, this.effectSelectedIndex + 1);
                    if (this.effectSelectedIndex !== prevIndex) {
                        SoundManager.play('menuNavigate');
                        this.updateEffectSelection();
                    }
                }
            }
        }
    }

    // ==================== CRIAÇÃO DE UI ====================

    createBackground() {
        this.add.rectangle(this.centerX, this.centerY, 640, 352, 0x1a1a2e);
    }

    createHeroSprite() {
        const textureKey = GameData.getCharacterTextureKey('vocalista', 'idle');
        
        // Cria animação específica do menu (prefixo para não conflitar com gameplay)
        if (!this.anims.exists('menu-idle')) {
            const sprite = GameData.getCharacter('vocalista').sprites.idle;
            this.anims.create({
                key: 'menu-idle',
                frames: this.anims.generateFrameNumbers(textureKey, { 
                    start: sprite.startFrame, 
                    end: sprite.endFrame 
                }),
                frameRate: sprite.frameRate,
                repeat: -1
            });
        }

        // Sprite animado à esquerda (camada de fundo)
        // Posição horizontal: 12% da largura visível (considerando zoom se houver)
        const zoom = this.cameras.main.zoom || 1;
        const visibleWidth = this.cameras.main.width / zoom;
        const heroX = visibleWidth * 0.12;
        
        // Garante filtro NEAREST (pixel art nítido) - pode ter sido alterado pelo GameScene
        this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        this.heroSprite = this.add.sprite(heroX, this.centerY, textureKey);
        this.heroSprite.setScale(3);
        this.heroSprite.setDepth(0);
        this.heroSprite.play('menu-idle');

        // Flutuação
        this.tweens.add({
            targets: this.heroSprite,
            y: this.heroSprite.y - 5,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createTitle() {
        // Cria o título com fonte padrão inicialmente
        this.title = this.add.text(this.centerX, this.centerY - 100, 'Rock Hero', {
            fontSize: '48px',
            fontFamily: 'Arial', // Fallback inicial
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(10);

        // Aguarda a fonte Rock Salt carregar e então aplica
        if (document.fonts && document.fonts.load) {
            document.fonts.load('42px "Rock Salt"').then(() => {
                // Fonte carregada - atualiza o estilo
                if (this.title && this.title.active) {
                    this.title.setFontFamily('"Rock Salt", cursive');
                }
            }).catch(() => {
                // Se falhar, mantém Arial
                console.log('Fonte Rock Salt não disponível, usando fallback');
            });
        }

        // Animação de pulo suave
        this.tweens.add({
            targets: this.title,
            y: this.title.y - 8,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createMenuButtons() {
        let yOffset = 0;
        
        // Container para botões (facilita limpeza)
        this.buttonContainer = this.add.container(0, 0).setDepth(10);

        // Botão "Jogar" (sempre vai para seleção de slots)
        this.playBtn = this.createButton(
            this.centerX, 
            this.centerY + yOffset, 
            '🎮 JOGAR',
            '#00ff00',
            () => this.openSlotSelect()
        );
        this.menuButtons.push(this.playBtn);
        yOffset += 35;

        // Botão "Ranking"
        this.rankingBtn = this.createButton(
            this.centerX, 
            this.centerY + yOffset, 
            '🏆 RANKING',
            '#ffd700',
            () => this.showRanking()
        );
        this.menuButtons.push(this.rankingBtn);
        yOffset += 35;

        // Botão "Configs"
        this.effectsBtn = this.createButton(
            this.centerX, 
            this.centerY + yOffset, 
            '⚙ CONFIGS',
            '#00ffaa',
            () => this.showEffectsMenu()
        );
        this.menuButtons.push(this.effectsBtn);

        // Cursor de seleção (posicionado à esquerda dos botões)
        this.cursor = this.add.text(this.centerX - 170, this.menuButtons[0].y, '▶', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(11);

        // Animação do cursor
        this.tweens.add({
            targets: this.cursor,
            alpha: 0.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        this.updateButtonStyles();
    }

    createButton(x, y, text, color, callback) {
        const btn = this.add.text(x, y, text, {
            fontSize: '22px',
            fontFamily: 'Arial',
            color: color,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

        btn.defaultColor = color;
        btn.callback = callback;

        btn.on('pointerover', () => {
            const prevIndex = this.selectedIndex;
            this.selectedIndex = this.menuButtons.indexOf(btn);
            if (this.selectedIndex !== prevIndex) {
                SoundManager.play('menuNavigate');
            }
            this.updateButtonStyles();
        });

        btn.on('pointerdown', () => {
            if (this.currentView === 'menu') {
                callback();
            }
        });

        this.buttonContainer.add(btn);
        return btn;
    }

    createInstructions() {
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const text = isMobile ? '← →: Navegar | O: Selecionar' : '↑↓: Navegar | Enter: Selecionar';
        
        this.instructions = this.add.text(
            this.centerX, 
            this.centerY + 120, 
            text, 
            {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#aaaaaa'
            }
        ).setOrigin(0.5).setDepth(10);

        // Versão do jogo (canto inferior direito)
        this.add.text(this.cameras.main.width - 8, this.cameras.main.height - 8, GameData.VERSION, {
            fontSize: '10px',
            fontFamily: 'Arial',
            color: '#555555'
        }).setOrigin(1, 1).setDepth(10);
    }

    // ==================== CONTROLES ====================

    setupControls() {
        // Cria teclas
        const upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        const downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        const leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        const rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // Navegação (up/left = anterior, down/right = próximo)
        const navigateUp = () => {
            if (this.currentView === 'menu') {
                const prevIndex = this.selectedIndex;
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                if (this.selectedIndex !== prevIndex) {
                    SoundManager.play('menuNavigate');
                }
                this.updateButtonStyles();
            } else if (this.currentView === 'effects') {
                const prevIndex = this.effectSelectedIndex;
                this.effectSelectedIndex = Math.max(0, this.effectSelectedIndex - 1);
                if (this.effectSelectedIndex !== prevIndex) {
                    SoundManager.play('menuNavigate');
                    this.updateEffectSelection();
                }
            }
        };

        const navigateDown = () => {
            if (this.currentView === 'menu') {
                const prevIndex = this.selectedIndex;
                this.selectedIndex = Math.min(this.menuButtons.length - 1, this.selectedIndex + 1);
                if (this.selectedIndex !== prevIndex) {
                    SoundManager.play('menuNavigate');
                }
                this.updateButtonStyles();
            } else if (this.currentView === 'effects') {
                const prevIndex = this.effectSelectedIndex;
                this.effectSelectedIndex = Math.min(this.effectToggles.length - 1, this.effectSelectedIndex + 1);
                if (this.effectSelectedIndex !== prevIndex) {
                    SoundManager.play('menuNavigate');
                    this.updateEffectSelection();
                }
            }
        };

        upKey.on('down', navigateUp);
        leftKey.on('down', navigateUp);
        downKey.on('down', navigateDown);
        rightKey.on('down', navigateDown);

        // Seleção
        const handleSelect = () => {
            if (this.currentView === 'menu') {
                SoundManager.play('menuSelect');
                this.menuButtons[this.selectedIndex].callback();
            } else if (this.currentView === 'effects') {
                const toggle = this.effectToggles[this.effectSelectedIndex];
                this.toggleEffect(toggle.key, toggle.bg, toggle.text);
            }
        };

        enterKey.on('down', handleSelect);
        
        // Suporte a controles virtuais (mobile) - verificado no update()
        this.virtualControls = GameData.getVirtualControls();
        this.handleSelectFn = handleSelect;
        this.lastNavTime = 0;

        // ESC para voltar
        escKey.on('down', () => {
            if (this.currentView === 'ranking' || this.currentView === 'effects') {
                SoundManager.play('menuNavigate');
                this.closeOverlay();
            }
        });

        // Guarda referências para limpeza
        this.keyListeners = [upKey, downKey, leftKey, rightKey, enterKey, escKey];
    }

    updateButtonStyles() {
        this.menuButtons.forEach((btn, index) => {
            if (index === this.selectedIndex) {
                btn.setStyle({ color: '#ffffff' });
                btn.setScale(1.1);
            } else {
                btn.setStyle({ color: btn.defaultColor });
                btn.setScale(1);
            }
        });

        // Atualiza posição do cursor
        if (this.cursor && this.menuButtons[this.selectedIndex]) {
            this.cursor.y = this.menuButtons[this.selectedIndex].y;
        }
    }

    // ==================== AÇÕES DO MENU ====================

    /**
     * Abre a tela de seleção de slots
     */
    openSlotSelect() {
        this.scene.start('SlotSelectScene', {
            returnTo: 'MenuScene'
        });
    }

    showRanking() {
        this.currentView = 'ranking';
        this.overlayElements = [];

        // Overlay
        const overlay = this.add.rectangle(
            this.centerX, this.centerY, 640, 352, 0x000000, 0.95
        ).setDepth(100);
        this.overlayElements.push(overlay);

        // Título
        const title = this.add.text(this.centerX, 40, '🏆 RANKING DE HI-SCORES 🏆', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(101);
        this.overlayElements.push(title);

        // Subtítulo
        const subtitle = this.add.text(this.centerX, 65, 
            GameData.getActiveSlot() 
                ? `Partida: ${GameData.loadPlayerName()}`
                : 'Nenhuma partida selecionada', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#888888'
        }).setOrigin(0.5).setDepth(101);
        this.overlayElements.push(subtitle);

        // Renderiza melhores tempos
        if (GameData.getActiveSlot()) {
            this.renderBestTimes();
        } else {
            const noData = this.add.text(this.centerX, this.centerY, 
                'Selecione uma partida para ver seus tempos', {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#666666'
            }).setOrigin(0.5).setDepth(101);
            this.overlayElements.push(noData);
        }

        // Instrução para fechar
        const closeText = this.add.text(this.centerX, this.centerY + 140, 
            'Pressione ESC para voltar', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#aaaaaa'
        }).setOrigin(0.5).setDepth(101);
        this.overlayElements.push(closeText);
    }

    renderBestTimes() {
        const startY = 90;
        const colWidth = 150;
        const startX = this.centerX - (GameData.WORLDS.length * colWidth) / 2 + colWidth / 2;

        GameData.WORLDS.forEach((world, worldIndex) => {
            const x = startX + worldIndex * colWidth;
            
            // Título do mundo
            const worldTitle = this.add.text(x, startY, world.name, {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#00ffff',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101);
            this.overlayElements.push(worldTitle);

            // Fases do mundo
            let y = startY + 25;
            world.levels.forEach(levelIndex => {
                const level = GameData.LEVELS[levelIndex];
                const bestTime = GameData.getBestTime(levelIndex);
                const isComplete = GameData.isLevelComplete(levelIndex);
                
                // Nome da fase
                const levelName = this.add.text(x - 50, y, level.name, {
                    fontSize: '11px',
                    fontFamily: 'Arial',
                    color: isComplete ? '#ffffff' : '#666666'
                }).setOrigin(0, 0.5).setDepth(101);
                this.overlayElements.push(levelName);

                // Tempo
                const timeText = bestTime !== null 
                    ? GameData.formatTime(bestTime) 
                    : '--:--.---';
                const timeDisplay = this.add.text(x + 50, y, timeText, {
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: bestTime !== null ? '#00ff00' : '#444444'
                }).setOrigin(1, 0.5).setDepth(101);
                this.overlayElements.push(timeDisplay);

                y += 20;
            });
        });

        // Tempo total (se todas fases completas)
        const totalTime = GameData.getTotalBestTime();
        if (totalTime !== null) {
            const totalText = this.add.text(this.centerX, this.centerY + 100, 
                `⏱️ Tempo Total: ${GameData.formatTime(totalTime)}`, {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#ffd700',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101);
            this.overlayElements.push(totalText);
        }
    }

    closeOverlay() {
        // Remove elementos visuais
        if (this.overlayElements) {
            this.overlayElements.forEach(el => {
                if (el && el.destroy) el.destroy();
            });
            this.overlayElements = [];
        }

        // Limpa referências do menu de efeitos
        this.effectToggles = [];

        this.currentView = 'menu';
    }

    // ==================== MENU DE CONFIGURAÇÕES ====================

    showEffectsMenu() {
        this.currentView = 'effects';
        this.overlayElements = [];
        this.effectToggles = [];
        this.effectSelectedIndex = 0;

        // Overlay
        const overlay = this.add.rectangle(
            this.centerX, this.centerY, 640, 352, 0x000000, 0.95
        ).setDepth(100);
        this.overlayElements.push(overlay);

        // Título
        const title = this.add.text(this.centerX, 35, '⚙ CONFIGURAÇÕES ⚙', {
            fontSize: '20px',
            fontFamily: '"Press Start 2P", Arial',
            color: '#00ffaa',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(101);
        this.overlayElements.push(title);

        // Configuração das duas colunas
        const columns = [
            {
                title: '✨ Efeitos Visuais',
                color: '#00ffaa',
                x: this.centerX - 155,
                items: [
                    { key: 'playerTrail', name: 'Rastro Sprite', desc: 'Cópias semi-transparentes' },
                    { key: 'neonLineTrail', name: 'Linha Neon', desc: 'Linha brilhante na trajetória' },
                    { key: 'jumpNeonBurst', name: 'Burst Pular', desc: 'Partículas neon ao pular' },
                    { key: 'landNeonBurst', name: 'Burst Pousar', desc: 'Partículas neon ao pousar' },
                ]
            },
            {
                title: '⚡ Mecânicas de Física',
                color: '#ffaa00',
                x: this.centerX + 155,
                items: [
                    { key: 'doubleJump', name: 'Double-Jump', desc: 'Pular novamente no ar' },
                    { key: 'waterPhysics', name: 'Física de Água', desc: 'Gravidade e movimento reduzidos' },
                ]
            }
        ];

        const startY = 80;
        const spacing = 55;
        let globalIndex = 0;

        columns.forEach((column) => {
            // Título da coluna
            const colTitle = this.add.text(column.x, startY - 20, column.title, {
                fontSize: '12px',
                fontFamily: '"Press Start 2P", Arial',
                color: column.color,
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5).setDepth(101);
            this.overlayElements.push(colTitle);

            column.items.forEach((effect, itemIndex) => {
                const y = startY + itemIndex * spacing + 20;
                const isEnabled = GameData.FEATURES[effect.key];
                const currentIndex = globalIndex;

                // Container para o toggle
                const toggleContainer = this.add.container(column.x, y).setDepth(101);

                // Nome do efeito
                const nameText = this.add.text(-110, -8, effect.name, {
                    fontSize: '11px',
                    fontFamily: '"Press Start 2P", Arial',
                    color: '#ffffff'
                }).setOrigin(0, 0.5);
                toggleContainer.add(nameText);

                // Descrição
                const descText = this.add.text(-110, 10, effect.desc, {
                    fontSize: '9px',
                    fontFamily: 'Arial',
                    color: '#666666'
                }).setOrigin(0, 0.5);
                toggleContainer.add(descText);

                // Botão toggle
                const toggleBg = this.add.rectangle(100, 0, 50, 22, isEnabled ? 0x00ff00 : 0x333333)
                    .setStrokeStyle(2, 0xffffff);
                toggleContainer.add(toggleBg);

                const toggleText = this.add.text(100, 0, isEnabled ? 'ON' : 'OFF', {
                    fontSize: '9px',
                    fontFamily: '"Press Start 2P", Arial',
                    color: isEnabled ? '#000000' : '#888888'
                }).setOrigin(0.5);
                toggleContainer.add(toggleText);

                // Indicador de seleção
                const selector = this.add.text(-130, 0, '▶', {
                    fontSize: '14px',
                    fontFamily: 'Arial',
                    color: column.color
                }).setOrigin(0.5).setAlpha(currentIndex === 0 ? 1 : 0);
                toggleContainer.add(selector);

                this.overlayElements.push(toggleContainer);

                // Interatividade
                toggleBg.setInteractive({ useHandCursor: true });
                toggleBg.on('pointerdown', () => {
                    this.toggleEffect(effect.key, toggleBg, toggleText);
                });
                toggleBg.on('pointerover', () => {
                    if (this.effectSelectedIndex !== currentIndex) {
                        SoundManager.play('menuNavigate');
                    }
                    this.effectSelectedIndex = currentIndex;
                    this.updateEffectSelection();
                });

                this.effectToggles.push({
                    key: effect.key,
                    bg: toggleBg,
                    text: toggleText,
                    selector: selector
                });

                globalIndex++;
            });
        });

        // Instrução para fechar
        const closeText = this.add.text(this.centerX, this.centerY + 145, 
            '↑↓: Navegar | Enter: Alternar | ESC: Voltar', {
            fontSize: '10px',
            fontFamily: 'Arial',
            color: '#aaaaaa'
        }).setOrigin(0.5).setDepth(101);
        this.overlayElements.push(closeText);
    }

    updateEffectSelection() {
        this.effectToggles.forEach((toggle, index) => {
            toggle.selector.setAlpha(index === this.effectSelectedIndex ? 1 : 0);
        });
    }

    toggleEffect(key, bg, text) {
        GameData.FEATURES[key] = !GameData.FEATURES[key];
        const isEnabled = GameData.FEATURES[key];

        bg.setFillStyle(isEnabled ? 0x00ff00 : 0x333333);
        text.setText(isEnabled ? 'ON' : 'OFF');
        text.setColor(isEnabled ? '#000000' : '#888888');

        SoundManager.play('menuSelect');
    }

    // Limpeza ao sair da cena
    shutdown() {
        this.cleanup();
    }
}
