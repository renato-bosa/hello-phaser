/**
 * WORLD MAP SCENE - Mapa do Mundo (estilo Super Mario World)
 * 
 * Navegação visual entre fases de um mundo.
 * Permite selecionar fases desbloqueadas e acessar seleção de personagem.
 */

class WorldMapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WorldMapScene' });
    }

    init(data) {
        // Carrega posição salva ou usa padrão
        const savedPos = GameData.loadMapPosition();
        this.currentWorldId = data?.worldId || savedPos.worldId;
        this.cursorLevelIndex = data?.levelIndex ?? savedPos.levelIndex;
        
        // Carrega personagem selecionado
        GameData.loadSelectedCharacter();
    }

    create() {
        const { width, height } = this.cameras.main;
        
        // Obtém dados do mundo atual
        this.worldData = GameData.WORLDS.find(w => w.id === this.currentWorldId);
        this.levelsData = GameData.getWorldLevelsWithStatus(this.currentWorldId);
        
        // Cria elementos visuais
        this.createBackground(width, height);
        this.createTitle(width);
        this.createPaths();
        this.createLevelNodes();
        this.createPlayerCursor();
        this.createUI(width, height);
        this.createInfoPanel(width, height);
        
        // Setup de controles
        this.setupControls();
        
        // Atualiza info inicial
        this.updateInfoPanel();
        
        // Som de entrada
        if (typeof SoundManager !== 'undefined') {
            SoundManager.play('menuNavigate');
        }
    }

    createBackground(width, height) {
        // Fundo com cor do tema do mundo
        const bgColor = this.worldData?.bgColor || 0x87CEEB;
        this.add.rectangle(0, 0, width, height, bgColor).setOrigin(0);
        
        // Decoração: nuvens ou elementos do tema
        this.createBackgroundDecoration(width, height);
    }

    createBackgroundDecoration(width, height) {
        // Nuvens decorativas
        for (let i = 0; i < 5; i++) {
            const x = Phaser.Math.Between(50, width - 50);
            const y = Phaser.Math.Between(30, 100);
            const cloud = this.add.ellipse(x, y, 80, 40, 0xffffff, 0.7);
            
            // Animação suave de movimento
            this.tweens.add({
                targets: cloud,
                x: cloud.x + Phaser.Math.Between(-20, 20),
                duration: Phaser.Math.Between(3000, 5000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        
        // Grama na base
        const grassHeight = 60;
        this.add.rectangle(0, height - grassHeight, width, grassHeight, 0x228B22).setOrigin(0);
        
        // Detalhes da grama
        for (let x = 0; x < width; x += 20) {
            const bladeHeight = Phaser.Math.Between(5, 15);
            this.add.triangle(
                x, height - grassHeight,
                0, 0,
                5, -bladeHeight,
                10, 0,
                0x32CD32
            ).setOrigin(0, 1);
        }
    }

    createTitle(width) {
        // Nome do mundo
        const titleY = 35;
        
        // Fundo do título
        this.add.rectangle(width / 2, titleY, 400, 50, 0x000000, 0.6)
            .setStrokeStyle(2, 0xffffff);
        
        // Texto do título
        this.add.text(width / 2, titleY - 8, this.worldData?.name || 'Mundo', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Subtítulo
        this.add.text(width / 2, titleY + 12, this.worldData?.subtitle || '', {
            fontFamily: 'Arial',
            fontSize: '11px',
            color: '#cccccc'
        }).setOrigin(0.5);
    }

    createPaths() {
        const graphics = this.add.graphics();
        const pathColor = this.worldData?.pathColor || 0x8B4513;
        
        // Desenha linhas conectando as fases
        this.levelsData.forEach((level, i) => {
            if (level.connectsTo && level.connectsTo.length > 0) {
                level.connectsTo.forEach(targetIndex => {
                    const targetLevel = this.levelsData.find(l => l.index === targetIndex);
                    if (targetLevel) {
                        // Linha principal (estrada)
                        graphics.lineStyle(8, pathColor, 1);
                        graphics.beginPath();
                        graphics.moveTo(level.mapPosition.x, level.mapPosition.y);
                        graphics.lineTo(targetLevel.mapPosition.x, targetLevel.mapPosition.y);
                        graphics.strokePath();
                        
                        // Linha de destaque (meio da estrada)
                        graphics.lineStyle(2, 0xDEB887, 0.5);
                        graphics.beginPath();
                        graphics.moveTo(level.mapPosition.x, level.mapPosition.y);
                        graphics.lineTo(targetLevel.mapPosition.x, targetLevel.mapPosition.y);
                        graphics.strokePath();
                    }
                });
            }
        });
    }

    createLevelNodes() {
        this.levelNodes = [];
        
        this.levelsData.forEach((level, i) => {
            const { x, y } = level.mapPosition;
            
            // Container para o nó
            const container = this.add.container(x, y);
            
            // Determina cor e estilo baseado no status
            let nodeColor, strokeColor, nodeAlpha;
            if (level.isComplete) {
                nodeColor = 0x00ff00; // Verde - completa
                strokeColor = 0x008800;
                nodeAlpha = 1;
            } else if (level.isUnlocked) {
                nodeColor = 0xffff00; // Amarelo - desbloqueada
                strokeColor = 0xccaa00;
                nodeAlpha = 1;
            } else {
                nodeColor = 0x666666; // Cinza - bloqueada
                strokeColor = 0x444444;
                nodeAlpha = 0.5;
            }
            
            // Círculo do nó
            const circle = this.add.circle(0, 0, 22, nodeColor, nodeAlpha);
            circle.setStrokeStyle(3, strokeColor);
            container.add(circle);
            
            // Número da fase
            const levelNumber = (level.index + 1).toString();
            const numberText = this.add.text(0, 0, levelNumber, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '14px',
                color: level.isUnlocked ? '#000000' : '#888888'
            }).setOrigin(0.5);
            container.add(numberText);
            
            // Ícone de status
            if (level.isComplete) {
                const checkmark = this.add.text(14, -14, '✓', {
                    fontSize: '16px',
                    color: '#00ff00',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5);
                container.add(checkmark);
            } else if (!level.isUnlocked) {
                const lock = this.add.text(14, -14, '🔒', {
                    fontSize: '12px'
                }).setOrigin(0.5);
                container.add(lock);
            }
            
            // Melhor tempo (se houver)
            if (level.bestTime && level.isComplete) {
                const timeText = this.add.text(0, 32, GameData.formatTime(level.bestTime), {
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5);
                container.add(timeText);
            }
            
            // Guarda referência
            this.levelNodes.push({
                container,
                circle,
                level,
                index: level.index
            });
        });
    }

    createPlayerCursor() {
        // Encontra a posição inicial do cursor
        const startNode = this.levelNodes.find(n => n.index === this.cursorLevelIndex);
        if (!startNode) return;
        
        const { x, y } = startNode.level.mapPosition;
        
        // Sprite do personagem selecionado
        const character = GameData.getCharacter(GameData.state.selectedCharacter);
        
        // Cursor (triângulo apontando para baixo)
        this.cursor = this.add.container(x, y - 45);
        
        // Triângulo indicador
        const arrow = this.add.triangle(0, 0, 0, 0, 10, -15, -10, -15, 0xff0000);
        arrow.setStrokeStyle(2, 0xffffff);
        this.cursor.add(arrow);
        
        // Animação de bounce
        this.tweens.add({
            targets: this.cursor,
            y: this.cursor.y - 8,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Guarda posição base para animação
        this.cursorBaseY = y - 45;
    }

    createUI(width, height) {
        // Painel inferior com controles
        const panelY = height - 35;
        
        // Fundo do painel
        this.add.rectangle(width / 2, panelY, width - 20, 50, 0x000000, 0.7)
            .setStrokeStyle(2, 0x444444);
        
        // Instruções (detecta mobile)
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const controls = isMobile ? [
            { key: '← →', action: 'Navegar' },
            { key: 'PULO', action: 'Jogar' }
        ] : [
            { key: '← →', action: 'Navegar' },
            { key: 'ESPAÇO', action: 'Jogar' },
            { key: 'P', action: 'Personagem' },
            { key: 'ESC', action: 'Menu' }
        ];
        
        const startX = 60;
        const spacing = 150;
        
        controls.forEach((ctrl, i) => {
            const x = startX + (i * spacing);
            
            // Tecla
            this.add.text(x, panelY - 8, ctrl.key, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '10px',
                color: '#ffff00'
            }).setOrigin(0.5);
            
            // Ação
            this.add.text(x, panelY + 10, ctrl.action, {
                fontFamily: 'Arial',
                fontSize: '11px',
                color: '#aaaaaa'
            }).setOrigin(0.5);
        });
    }

    createInfoPanel(width, height) {
        // Painel de informações da fase selecionada
        const panelX = width - 120;
        const panelY = 120;
        
        // Fundo
        this.infoPanelBg = this.add.rectangle(panelX, panelY, 200, 100, 0x000000, 0.8)
            .setStrokeStyle(2, 0x666666);
        
        // Nome da fase
        this.infoLevelName = this.add.text(panelX, panelY - 30, '', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '11px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 180 }
        }).setOrigin(0.5);
        
        // Status
        this.infoStatus = this.add.text(panelX, panelY, '', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#aaaaaa',
            align: 'center'
        }).setOrigin(0.5);
        
        // Melhor tempo
        this.infoBestTime = this.add.text(panelX, panelY + 25, '', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#00ffff',
            align: 'center'
        }).setOrigin(0.5);
    }

    updateInfoPanel() {
        const node = this.levelNodes.find(n => n.index === this.cursorLevelIndex);
        if (!node) return;
        
        const level = node.level;
        
        // Nome
        this.infoLevelName.setText(level.name);
        
        // Status
        if (level.isComplete) {
            this.infoStatus.setText('✓ Completa');
            this.infoStatus.setColor('#00ff00');
        } else if (level.isUnlocked) {
            this.infoStatus.setText('● Disponível');
            this.infoStatus.setColor('#ffff00');
        } else {
            this.infoStatus.setText('🔒 Bloqueada');
            this.infoStatus.setColor('#888888');
        }
        
        // Melhor tempo
        if (level.bestTime) {
            this.infoBestTime.setText(`⏱ ${GameData.formatTime(level.bestTime)}`);
        } else {
            this.infoBestTime.setText('');
        }
    }

    setupControls() {
        // Navegação
        this.input.keyboard.on('keydown-LEFT', () => this.navigateLevel(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.navigateLevel(1));
        
        // Selecionar fase
        this.input.keyboard.on('keydown-ENTER', () => this.selectLevel());
        this.input.keyboard.on('keydown-SPACE', () => this.selectLevel());
        
        // Seleção de personagem
        this.input.keyboard.on('keydown-P', () => this.openCharacterSelect());
        
        // Voltar ao menu
        this.input.keyboard.on('keydown-ESC', () => this.backToMenu());
        
        // Suporte a controles virtuais (mobile) - verificado no update()
        this.virtualControls = GameData.getVirtualControls();
        this.lastNavTime = 0;
    }

    update(time) {
        // Controles virtuais mobile (mais eficiente que timer separado)
        if (this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
            this.selectLevel();
        }
        
        // Navegação com throttle (evita repetição muito rápida)
        if (time - this.lastNavTime > 200) {
            if (this.virtualControls.left) {
                this.navigateLevel(-1);
                this.lastNavTime = time;
            } else if (this.virtualControls.right) {
                this.navigateLevel(1);
                this.lastNavTime = time;
            }
        }
    }

    navigateLevel(direction) {
        // Encontra próxima fase navegável
        const currentNode = this.levelNodes.find(n => n.index === this.cursorLevelIndex);
        if (!currentNode) return;
        
        // Encontra a posição atual na lista de fases do mundo
        const worldLevels = this.worldData.levels;
        const currentPos = worldLevels.indexOf(this.cursorLevelIndex);
        
        // Calcula nova posição
        let newPos = currentPos + direction;
        if (newPos < 0) newPos = 0;
        if (newPos >= worldLevels.length) newPos = worldLevels.length - 1;
        
        const newLevelIndex = worldLevels[newPos];
        
        // Só move se a fase estiver desbloqueada
        if (!GameData.isLevelUnlocked(newLevelIndex)) {
            SoundManager.play('warning');
            return;
        }
        
        if (newLevelIndex !== this.cursorLevelIndex) {
            this.cursorLevelIndex = newLevelIndex;
            this.moveCursorToLevel(newLevelIndex);
            SoundManager.play('menuNavigate');
        }
    }

    moveCursorToLevel(levelIndex) {
        const node = this.levelNodes.find(n => n.index === levelIndex);
        if (!node) return;
        
        const { x, y } = node.level.mapPosition;
        
        // Para a animação atual
        this.tweens.killTweensOf(this.cursor);
        
        // Move para nova posição
        this.tweens.add({
            targets: this.cursor,
            x: x,
            y: y - 45,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                // Reinicia animação de bounce
                this.cursorBaseY = y - 45;
                this.tweens.add({
                    targets: this.cursor,
                    y: this.cursorBaseY - 8,
                    duration: 400,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        });
        
        // Destaque visual no nó
        this.highlightNode(node);
        
        // Atualiza painel de info
        this.updateInfoPanel();
        
        // Salva posição
        GameData.saveMapPosition(this.currentWorldId, levelIndex);
    }

    highlightNode(node) {
        // Remove destaque de outros nós
        this.levelNodes.forEach(n => {
            n.circle.setStrokeStyle(3, n.level.isComplete ? 0x008800 : 
                                        n.level.isUnlocked ? 0xccaa00 : 0x444444);
        });
        
        // Adiciona destaque ao nó selecionado
        node.circle.setStrokeStyle(4, 0xffffff);
        
        // Efeito de pulso
        this.tweens.add({
            targets: node.circle,
            scale: { from: 1, to: 1.15 },
            duration: 300,
            yoyo: true
        });
    }

    selectLevel() {
        const node = this.levelNodes.find(n => n.index === this.cursorLevelIndex);
        if (!node) return;
        
        if (!node.level.isUnlocked) {
            SoundManager.play('warning');
            return;
        }
        
        SoundManager.play('menuSelect');
        
        // Inicia a fase
        this.scene.start('GameScene', {
            level: this.cursorLevelIndex,
            playerName: GameData.loadPlayerName()
        });
    }

    openCharacterSelect() {
        SoundManager.play('menuSelect');
        this.scene.start('CharacterSelectScene', {
            returnTo: 'WorldMapScene',
            worldId: this.currentWorldId,
            levelIndex: this.cursorLevelIndex
        });
    }

    backToMenu() {
        SoundManager.play('menuBack');
        this.scene.start('MenuScene');
    }
}

// Exporta globalmente
window.WorldMapScene = WorldMapScene;
