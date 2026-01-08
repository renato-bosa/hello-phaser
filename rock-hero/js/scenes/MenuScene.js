/**
 * MENU SCENE - Menu Principal do Jogo
 * 
 * Responsabilidades:
 * - Exibir menu principal
 * - Navegação entre opções
 * - Iniciar novo jogo ou continuar
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
        this.currentView = 'menu'; // 'menu', 'ranking', 'nameInput'
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
        // Posição horizontal: 25% da largura visível (considerando zoom se houver)
        const zoom = this.cameras.main.zoom || 1;
        const visibleWidth = this.cameras.main.width / zoom;
        const heroX = visibleWidth * 0.25;
        
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
        this.title = this.add.text(this.centerX, this.centerY - 100, 'ROCK HERO', {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(10);

        // Animação de pulo
        this.tweens.add({
            targets: this.title,
            y: this.title.y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createMenuButtons() {
        const hasProgress = GameData.hasProgress();
        let yOffset = hasProgress ? -20 : 0;
        
        // Container para botões (facilita limpeza)
        this.buttonContainer = this.add.container(0, 0).setDepth(10);

        // Botão "Continuar" (se houver progresso)
        if (hasProgress) {
            const progress = GameData.loadProgress();
            const levelName = GameData.LEVELS[progress.level]?.name || `Fase ${progress.level + 1}`;
            
            this.continueBtn = this.createButton(
                this.centerX, 
                this.centerY + yOffset, 
                `▶ CONTINUAR (${levelName})`,
                '#00ffff',
                () => this.continueGame()
            );
            this.menuButtons.push(this.continueBtn);
            yOffset += 30;
        }

        // Botão "Novo Jogo"
        this.newGameBtn = this.createButton(
            this.centerX, 
            this.centerY + yOffset, 
            'NOVO JOGO',
            '#00ff00',
            () => this.showNameInput()
        );
        this.menuButtons.push(this.newGameBtn);
        yOffset += 30;

        // Botão "Ranking"
        this.rankingBtn = this.createButton(
            this.centerX, 
            this.centerY + yOffset, 
            '🏆 RANKING',
            '#ffd700',
            () => this.showRanking()
        );
        this.menuButtons.push(this.rankingBtn);

        // Cursor de seleção
        this.cursor = this.add.text(this.centerX - 120, this.menuButtons[0].y, '▶', {
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
            fontSize: '24px',
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
        this.instructions = this.add.text(
            this.centerX, 
            this.centerY + 100, 
            '↑↓: Navegar | Enter: Selecionar', 
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

        // ESC para voltar
        escKey.on('down', () => {
            if (this.currentView === 'ranking' || this.currentView === 'nameInput') {
                SoundManager.play('menuBack');
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

    continueGame() {
        const progress = GameData.loadProgress();
        if (progress) {
            // Atualiza estado global
            GameData.state.currentLevel = progress.level;
            GameData.state.playerName = progress.playerName;
            
            // Inicia a cena do jogo
            this.scene.start('GameScene', {
                level: progress.level,
                playerName: progress.playerName
            });
        }
    }

    showNameInput() {
        this.currentView = 'nameInput';
        this.overlayElements = [];

        // Overlay escuro
        const overlay = this.add.rectangle(
            this.centerX, this.centerY, 640, 352, 0x000000, 0.9
        ).setDepth(100);
        this.overlayElements.push(overlay);

        // Título
        const promptText = this.add.text(this.centerX, this.centerY - 50, 'Digite seu nome:', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(101);
        this.overlayElements.push(promptText);

        // Input HTML
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.maxLength = 15;
        inputElement.placeholder = 'Seu nome';
        inputElement.value = localStorage.getItem('rockHero_playerName') || '';
        
        // Estilo do input
        Object.assign(inputElement.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            padding: '10px',
            fontSize: '18px',
            textAlign: 'center',
            border: '3px solid #4a90d9',
            borderRadius: '5px',
            backgroundColor: '#1a1a2e',
            color: '#ffffff',
            zIndex: '10000',
            marginTop: '20px'
        });

        document.body.appendChild(inputElement);
        inputElement.focus();
        inputElement.select();
        this.nameInput = inputElement;

        // Botão confirmar
        const confirmBtn = this.add.text(this.centerX, this.centerY + 50, '[Confirmar]', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
        this.overlayElements.push(confirmBtn);

        const handleSubmit = () => {
            const playerName = inputElement.value.trim() || 'Anônimo';
            
            // Salva e inicia
            GameData.saveProgress(0, playerName);
            
            // Remove input HTML
            document.body.removeChild(inputElement);
            
            // Inicia o jogo
            this.scene.start('GameScene', {
                level: 0,
                playerName: playerName
            });
        };

        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                document.body.removeChild(inputElement);
                this.closeOverlay();
            }
        });

        confirmBtn.on('pointerdown', handleSubmit);
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
        const title = this.add.text(this.centerX, this.centerY - 160, '🏆 RANKING DE HI-SCORES 🏆', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(101);
        this.overlayElements.push(title);

        // Renderiza tabelas para cada fase
        let currentY = this.centerY - 120;
        
        for (let level = 0; level < GameData.LEVELS.length; level++) {
            currentY = this.renderRankingTable(level, currentY);
            currentY += 20; // Espaço entre tabelas
        }

        // Instrução para fechar
        const closeText = this.add.text(this.centerX, this.centerY + 140, 'Pressione ESC para voltar', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#aaaaaa'
        }).setOrigin(0.5).setDepth(101);
        this.overlayElements.push(closeText);
    }

    renderRankingTable(level, startY) {
        const records = GameData.getTopRecords(level, 4);
        const levelName = GameData.LEVELS[level]?.name || `Fase ${level + 1}`;
        let y = startY;

        // Título da fase
        const faseTitle = this.add.text(this.centerX, y, levelName.toUpperCase(), {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#00ff00',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);
        this.overlayElements.push(faseTitle);
        y += 25;

        // Cabeçalho
        const headers = [
            { text: 'TEMPO', x: this.centerX - 150 },
            { text: 'JOGADOR', x: this.centerX },
            { text: 'DATA/HORA', x: this.centerX + 150 }
        ];

        headers.forEach(h => {
            const header = this.add.text(h.x, y, h.text, {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#ffd700',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101);
            this.overlayElements.push(header);
        });
        y += 20;

        // Recordes
        if (records.length > 0) {
            records.forEach(record => {
                // Tempo
                const timeText = this.add.text(this.centerX - 150, y, GameData.formatTime(record.time), {
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: '#00ffff'
                }).setOrigin(0.5).setDepth(101);
                this.overlayElements.push(timeText);

                // Jogador
                const playerText = this.add.text(this.centerX, y, record.playerName || 'Anônimo', {
                    fontSize: '12px',
                    fontFamily: 'Arial',
                    color: '#ffffff'
                }).setOrigin(0.5).setDepth(101);
                this.overlayElements.push(playerText);

                // Data
                const dateText = this.add.text(this.centerX + 150, y, GameData.formatDate(record.date), {
                    fontSize: '11px',
                    fontFamily: 'Arial',
                    color: '#aaaaaa'
                }).setOrigin(0.5).setDepth(101);
                this.overlayElements.push(dateText);

                y += 18;
            });
        } else {
            const noRecord = this.add.text(this.centerX, y, 'Nenhum recorde ainda', {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: '#666666'
            }).setOrigin(0.5).setDepth(101);
            this.overlayElements.push(noRecord);
            y += 18;
        }

        return y;
    }

    closeOverlay() {
        // Remove elementos visuais
        if (this.overlayElements) {
            this.overlayElements.forEach(el => {
                if (el && el.destroy) el.destroy();
            });
            this.overlayElements = [];
        }

        // Remove input HTML se existir
        if (this.nameInput && this.nameInput.parentNode) {
            document.body.removeChild(this.nameInput);
            this.nameInput = null;
        }

        this.currentView = 'menu';
    }

    // Limpeza ao sair da cena
    shutdown() {
        this.cleanup();
    }
}
