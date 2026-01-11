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
        this.load.spritesheet('hero-idle', 'assets/spritesheets/still-hero.png', {
            frameWidth: 32,
            frameHeight: 32
        });
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

    update() {
        // Controles virtuais mobile (mais eficiente que timer separado)
        if (this.currentView === 'menu' && this.virtualControls && this.handleSelectFn) {
            if (this.virtualControls.jumpJustPressed) {
                this.virtualControls.jumpJustPressed = false;
                this.handleSelectFn();
            }
        }
    }

    // ==================== CRIAÇÃO DE UI ====================

    createBackground() {
        this.add.rectangle(this.centerX, this.centerY, 640, 352, 0x1a1a2e);
    }

    createHeroSprite() {
        // Cria animação se não existir
        if (!this.anims.exists('hero-idle-menu')) {
            this.anims.create({
                key: 'hero-idle-menu',
                frames: this.anims.generateFrameNumbers('hero-idle', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1
            });
        }

        // Sprite animado à esquerda (camada de fundo)
        // Posição horizontal: 12% da largura visível (considerando zoom se houver)
        const zoom = this.cameras.main.zoom || 1;
        const visibleWidth = this.cameras.main.width / zoom;
        const heroX = visibleWidth * 0.12;
        
        // Garante filtro NEAREST (pixel art nítido) - pode ter sido alterado pelo GameScene
        this.textures.get('hero-idle').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        this.heroSprite = this.add.sprite(heroX, this.centerY, 'hero-idle');
        this.heroSprite.setScale(3);
        this.heroSprite.setDepth(0);
        this.heroSprite.play('hero-idle-menu');

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
        // Verifica se há slot ativo para mostrar "Continuar"
        const activeSlotId = GameData.getActiveSlot();
        const activeSlot = activeSlotId ? GameData.getSlot(activeSlotId) : null;
        const hasAnySlots = GameData.hasAnyProgress();
        
        let yOffset = hasAnySlots ? -30 : 0;
        
        // Container para botões (facilita limpeza)
        this.buttonContainer = this.add.container(0, 0).setDepth(10);

        // Botão "Continuar" (se houver slot ativo)
        if (activeSlot) {
            const completedCount = activeSlot.completedLevels?.length || 0;
            const totalLevels = GameData.LEVELS.length;
            
            this.continueBtn = this.createButton(
                this.centerX, 
                this.centerY + yOffset, 
                `▶ CONTINUAR (${activeSlot.playerName})`,
                '#00ffff',
                () => this.continueGame()
            );
            this.menuButtons.push(this.continueBtn);
            yOffset += 35;
        }

        // Botão "Jogar" ou "Nova Partida" (vai para seleção de slots)
        const playButtonText = hasAnySlots ? '🎮 PARTIDAS SALVAS' : '🎮 JOGAR';
        this.playBtn = this.createButton(
            this.centerX, 
            this.centerY + yOffset, 
            playButtonText,
            '#00ff00',
            () => this.openSlotSelect()
        );
        this.menuButtons.push(this.playBtn);
        yOffset += 35;

        // Botão "Personagem" (só aparece se tiver slot ativo com mais de 1 personagem)
        if (activeSlot) {
            const unlockedChars = activeSlot.unlockedCharacters || ['vocalista'];
            if (unlockedChars.length > 1) {
                this.characterBtn = this.createButton(
                    this.centerX, 
                    this.centerY + yOffset, 
                    '🎸 Selecionar Integrante',
                    '#ff66ff',
                    () => this.openCharacterSelect()
                );
                this.menuButtons.push(this.characterBtn);
                yOffset += 35;
            }
        }

        // Botão "Ranking"
        this.rankingBtn = this.createButton(
            this.centerX, 
            this.centerY + yOffset, 
            '🏆 RANKING',
            '#ffd700',
            () => this.showRanking()
        );
        this.menuButtons.push(this.rankingBtn);

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
        const text = isMobile ? '↑↓: Navegar | Pulo: Selecionar' : '↑↓: Navegar | Enter: Selecionar';
        
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
    }

    // ==================== CONTROLES ====================

    setupControls() {
        // Cria teclas
        const upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        const downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // Navegação
        upKey.on('down', () => {
            if (this.currentView === 'menu') {
                const prevIndex = this.selectedIndex;
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                if (this.selectedIndex !== prevIndex) {
                    SoundManager.play('menuNavigate');
                }
                this.updateButtonStyles();
            }
        });

        downKey.on('down', () => {
            if (this.currentView === 'menu') {
                const prevIndex = this.selectedIndex;
                this.selectedIndex = Math.min(this.menuButtons.length - 1, this.selectedIndex + 1);
                if (this.selectedIndex !== prevIndex) {
                    SoundManager.play('menuNavigate');
                }
                this.updateButtonStyles();
            }
        });

        // Seleção
        const handleSelect = () => {
            if (this.currentView === 'menu') {
                SoundManager.play('menuSelect');
                this.menuButtons[this.selectedIndex].callback();
            }
        };

        enterKey.on('down', handleSelect);
        spaceKey.on('down', handleSelect);
        
        // Suporte a controles virtuais (mobile) - verificado no update()
        this.virtualControls = GameData.getVirtualControls();
        this.handleSelectFn = handleSelect;

        // ESC para voltar
        escKey.on('down', () => {
            if (this.currentView === 'ranking') {
                SoundManager.play('menuNavigate');
                this.closeOverlay();
            }
        });

        // Guarda referências para limpeza
        this.keyListeners = [upKey, downKey, enterKey, spaceKey, escKey];
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
     * Continua o jogo no slot ativo
     */
    continueGame() {
        const activeSlotId = GameData.getActiveSlot();
        if (!activeSlotId) {
            // Sem slot ativo, vai para seleção
            this.openSlotSelect();
            return;
        }

        const slot = GameData.getSlot(activeSlotId);
        if (!slot) {
            this.openSlotSelect();
            return;
        }

        // Carrega o slot para o estado
        GameData.loadSlotIntoState(slot);
        GameData.updateLastPlayed();

        // Vai ao mapa do mundo
        this.scene.start('WorldMapScene');
    }

    /**
     * Abre a tela de seleção de slots
     */
    openSlotSelect() {
        this.scene.start('SlotSelectScene', {
            returnTo: 'MenuScene'
        });
    }

    /**
     * Abre seleção de personagem
     */
    openCharacterSelect() {
        SoundManager.play('menuSelect');
        this.scene.start('CharacterSelectScene', {
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

        this.currentView = 'menu';
    }

    // Limpeza ao sair da cena
    shutdown() {
        this.cleanup();
    }
}
