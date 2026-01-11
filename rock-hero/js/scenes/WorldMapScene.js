/**
 * WORLD MAP SCENE - Mapa do Mundo (estilo Super Mario World)
 * 
 * Navegação visual entre fases de um mundo.
 * Inclui portais para mundos adjacentes como extensão natural do caminho.
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
        
        // Mundos adjacentes
        this.previousWorld = GameData.WORLDS.find(w => w.id === this.currentWorldId - 1);
        this.nextWorld = GameData.WORLDS.find(w => w.id === this.currentWorldId + 1);
        
        // Todos os nós navegáveis (fases + portais)
        this.allNodes = [];
        
        // Cria elementos visuais
        this.createBackground(width, height);
        this.createTitle(width);
        this.createPaths();
        this.createLevelNodes();
        this.createWorldPortals(width, height);
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
        const theme = this.worldData?.theme || 'grass';
        
        if (theme === 'cave') {
            // Tema caverna/noturno
            this.createCaveDecoration(width, height);
        } else {
            // Tema padrão (grama)
            this.createGrassDecoration(width, height);
        }
    }

    createGrassDecoration(width, height) {
        // Nuvens decorativas
        for (let i = 0; i < 5; i++) {
            const x = Phaser.Math.Between(50, width - 50);
            const y = Phaser.Math.Between(30, 100);
            const cloud = this.add.ellipse(x, y, 80, 40, 0xffffff, 0.7);
            
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

    createCaveDecoration(width, height) {
        // Estrelas/cristais no céu noturno
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(10, width - 10);
            const y = Phaser.Math.Between(70, height - 100);
            const size = Phaser.Math.Between(1, 3);
            const star = this.add.circle(x, y, size, 0xffffff, Phaser.Math.FloatBetween(0.3, 0.8));
            
            // Animação de brilho
            this.tweens.add({
                targets: star,
                alpha: { from: star.alpha, to: Phaser.Math.FloatBetween(0.1, 0.5) },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        
        // Cristais roxos decorativos
        for (let i = 0; i < 8; i++) {
            const x = Phaser.Math.Between(50, width - 50);
            const baseY = height - 60;
            const crystalHeight = Phaser.Math.Between(15, 35);
            
            // Cristal (triângulo)
            const crystal = this.add.triangle(
                x, baseY,
                0, 0,
                Phaser.Math.Between(5, 12), -crystalHeight,
                Phaser.Math.Between(10, 20), 0,
                Phaser.Math.Between(0x6a0dad, 0x9932cc),
                0.7
            ).setOrigin(0.5, 1);
            
            // Brilho do cristal
            this.tweens.add({
                targets: crystal,
                alpha: { from: 0.5, to: 0.9 },
                duration: Phaser.Math.Between(1500, 2500),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        
        // Chão rochoso
        const groundHeight = 60;
        this.add.rectangle(0, height - groundHeight, width, groundHeight, 0x2d2d3d).setOrigin(0);
        
        // Pedras decorativas
        for (let x = 0; x < width; x += Phaser.Math.Between(30, 60)) {
            const rockWidth = Phaser.Math.Between(15, 40);
            const rockHeight = Phaser.Math.Between(8, 20);
            this.add.ellipse(
                x + rockWidth/2, 
                height - groundHeight + rockHeight/2, 
                rockWidth, 
                rockHeight, 
                Phaser.Math.Between(0x3d3d4d, 0x4d4d5d)
            );
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
        this.graphics = this.add.graphics();
        const pathColor = this.worldData?.pathColor || 0x8B4513;
        
        // Desenha linhas conectando as fases
        this.levelsData.forEach((level, i) => {
            if (level.connectsTo && level.connectsTo.length > 0) {
                level.connectsTo.forEach(targetIndex => {
                    const targetLevel = this.levelsData.find(l => l.index === targetIndex);
                    if (targetLevel) {
                        this.drawPath(
                            level.mapPosition.x, level.mapPosition.y,
                            targetLevel.mapPosition.x, targetLevel.mapPosition.y,
                            pathColor
                        );
                    }
                });
            }
        });
    }

    drawPath(x1, y1, x2, y2, color) {
        // Linha principal (estrada)
        this.graphics.lineStyle(8, color, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(x1, y1);
        this.graphics.lineTo(x2, y2);
        this.graphics.strokePath();
        
        // Linha de destaque (meio da estrada)
        this.graphics.lineStyle(2, 0xDEB887, 0.5);
        this.graphics.beginPath();
        this.graphics.moveTo(x1, y1);
        this.graphics.lineTo(x2, y2);
        this.graphics.strokePath();
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
            const node = {
                container,
                circle,
                level,
                index: level.index,
                type: 'level',
                isUnlocked: level.isUnlocked,
                mapPosition: level.mapPosition
            };
            this.levelNodes.push(node);
            this.allNodes.push(node);
        });
    }

    createWorldPortals(width, height) {
        this.portalNodes = [];
        
        // Portal para mundo anterior (à esquerda da primeira fase)
        if (this.previousWorld && GameData.isWorldUnlocked(this.previousWorld.id)) {
            const firstLevel = this.levelsData[0];
            const portalX = 30;
            const portalY = firstLevel?.mapPosition?.y || 200;
            
            // Desenha caminho para o portal
            if (firstLevel) {
                this.drawPath(portalX, portalY, firstLevel.mapPosition.x, firstLevel.mapPosition.y, 0x6b4c9a);
            }
            
            // Cria o portal
            const portalNode = this.createPortalNode(
                portalX, portalY,
                this.previousWorld,
                '←',
                0x9966cc
            );
            
            // Adiciona à lista de nós (antes das fases)
            this.portalNodes.push(portalNode);
            this.allNodes.unshift(portalNode); // No início da navegação
        }
        
        // Portal para próximo mundo (à direita da última fase)
        if (this.nextWorld) {
            const lastLevel = this.levelsData[this.levelsData.length - 1];
            const portalX = width - 30;
            const portalY = lastLevel?.mapPosition?.y || 200;
            
            // Verifica se o próximo mundo está desbloqueado
            const isNextUnlocked = GameData.isWorldUnlocked(this.nextWorld.id);
            
            // Desenha caminho para o portal
            if (lastLevel) {
                this.drawPath(lastLevel.mapPosition.x, lastLevel.mapPosition.y, portalX, portalY, 
                    isNextUnlocked ? 0x6b4c9a : 0x444444);
            }
            
            // Cria o portal
            const portalNode = this.createPortalNode(
                portalX, portalY,
                this.nextWorld,
                '→',
                isNextUnlocked ? 0x9966cc : 0x444444,
                !isNextUnlocked
            );
            
            // Adiciona à lista de nós (depois das fases)
            this.portalNodes.push(portalNode);
            this.allNodes.push(portalNode); // No final da navegação
        }
    }

    createPortalNode(x, y, targetWorld, arrow, color, locked = false) {
        const container = this.add.container(x, y);
        
        // Forma de portal (arco/portão)
        const portalWidth = 40;
        const portalHeight = 50;
        
        // Sombra
        const shadow = this.add.ellipse(0, 5, portalWidth + 4, 20, 0x000000, 0.3);
        container.add(shadow);
        
        // Base do portal (retângulo arredondado simulado)
        const portalBg = this.add.rectangle(0, 0, portalWidth, portalHeight, color, locked ? 0.4 : 0.9);
        portalBg.setStrokeStyle(3, locked ? 0x333333 : 0xffffff);
        container.add(portalBg);
        
        // Arco superior
        const arc = this.add.arc(0, -portalHeight/2 + 5, portalWidth/2, 180, 360, false, color, locked ? 0.4 : 0.9);
        arc.setStrokeStyle(3, locked ? 0x333333 : 0xffffff);
        container.add(arc);
        
        // Interior do portal (efeito de profundidade)
        if (!locked) {
            const inner = this.add.rectangle(0, 5, portalWidth - 10, portalHeight - 15, 0x2d1b4e, 0.8);
            container.add(inner);
            
            // Efeito de brilho/energia
            const glow = this.add.ellipse(0, 0, 20, 30, 0xaa88ff, 0.5);
            container.add(glow);
            
            // Animação de energia
            this.tweens.add({
                targets: glow,
                alpha: { from: 0.3, to: 0.7 },
                scaleX: { from: 0.8, to: 1.2 },
                scaleY: { from: 0.9, to: 1.1 },
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        
        // Seta direcional
        const arrowText = this.add.text(0, 0, arrow, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '16px',
            color: locked ? '#666666' : '#ffffff'
        }).setOrigin(0.5);
        container.add(arrowText);
        
        // Nome do mundo de destino
        const worldName = this.add.text(0, 35, targetWorld.name, {
            fontFamily: 'Arial',
            fontSize: '10px',
            color: locked ? '#666666' : '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        container.add(worldName);
        
        // Cadeado se bloqueado
        if (locked) {
            const lock = this.add.text(15, -20, '🔒', {
                fontSize: '14px'
            }).setOrigin(0.5);
            container.add(lock);
        }
        
        return {
            container,
            circle: portalBg, // Usa o retângulo como referência para highlight
            type: 'portal',
            targetWorld: targetWorld,
            isUnlocked: !locked,
            index: `portal_${targetWorld.id}`,
            mapPosition: { x, y },
            name: targetWorld.name,
            subtitle: locked ? 'Complete o mundo atual' : `Ir para ${targetWorld.name}`
        };
    }

    createPlayerCursor() {
        // Encontra a posição inicial do cursor
        let startNode = this.allNodes.find(n => n.index === this.cursorLevelIndex);
        
        // Se não encontrou (pode ser um portal), usa a primeira fase desbloqueada
        if (!startNode) {
            startNode = this.allNodes.find(n => n.type === 'level' && n.isUnlocked);
        }
        if (!startNode) {
            startNode = this.allNodes[0];
        }
        
        this.currentNodeIndex = this.allNodes.indexOf(startNode);
        
        const { x, y } = startNode.mapPosition;
        
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
        
        // Destaque inicial
        this.highlightNode(startNode);
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
            { key: 'PULO', action: 'Selecionar' }
        ] : [
            { key: '← →', action: 'Navegar' },
            { key: 'ESPAÇO', action: 'Selecionar' },
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
        const node = this.allNodes[this.currentNodeIndex];
        if (!node) return;
        
        if (node.type === 'portal') {
            // Info de portal
            this.infoLevelName.setText(node.name);
            
            if (node.isUnlocked) {
                this.infoStatus.setText('🌀 Portal Aberto');
                this.infoStatus.setColor('#aa88ff');
            } else {
                this.infoStatus.setText('🔒 Portal Fechado');
                this.infoStatus.setColor('#888888');
            }
            
            this.infoBestTime.setText(node.subtitle);
            this.infoBestTime.setColor('#aaaaaa');
        } else {
            // Info de fase
            const level = node.level;
            
            this.infoLevelName.setText(level.name);
            
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
            
            if (level.bestTime) {
                this.infoBestTime.setText(`⏱ ${GameData.formatTime(level.bestTime)}`);
                this.infoBestTime.setColor('#00ffff');
            } else {
                this.infoBestTime.setText('');
            }
        }
    }

    setupControls() {
        // Navegação
        this.input.keyboard.on('keydown-LEFT', () => this.navigateNode(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.navigateNode(1));
        
        // Selecionar
        this.input.keyboard.on('keydown-ENTER', () => this.selectNode());
        this.input.keyboard.on('keydown-SPACE', () => this.selectNode());
        
        // Seleção de personagem
        this.input.keyboard.on('keydown-P', () => this.openCharacterSelect());
        
        // Voltar ao menu
        this.input.keyboard.on('keydown-ESC', () => this.backToMenu());
        
        // Suporte a controles virtuais (mobile)
        this.virtualControls = GameData.getVirtualControls();
        this.lastNavTime = 0;
    }

    update(time) {
        // Controles virtuais mobile
        if (this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
            this.selectNode();
        }
        
        // Navegação com throttle
        if (time - this.lastNavTime > 200) {
            if (this.virtualControls.left) {
                this.navigateNode(-1);
                this.lastNavTime = time;
            } else if (this.virtualControls.right) {
                this.navigateNode(1);
                this.lastNavTime = time;
            }
        }
    }

    navigateNode(direction) {
        let newIndex = this.currentNodeIndex + direction;
        
        // Limita aos bounds
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= this.allNodes.length) newIndex = this.allNodes.length - 1;
        
        const newNode = this.allNodes[newIndex];
        
        // Só move se o nó estiver desbloqueado
        if (!newNode.isUnlocked) {
            SoundManager.play('warning');
            return;
        }
        
        if (newIndex !== this.currentNodeIndex) {
            this.currentNodeIndex = newIndex;
            this.moveCursorToNode(newNode);
            SoundManager.play('menuNavigate');
            
            // Salva posição se for uma fase
            if (newNode.type === 'level') {
                this.cursorLevelIndex = newNode.index;
                GameData.saveMapPosition(this.currentWorldId, newNode.index);
            }
        }
    }

    moveCursorToNode(node) {
        const { x, y } = node.mapPosition;
        
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
                this.tweens.add({
                    targets: this.cursor,
                    y: y - 45 - 8,
                    duration: 400,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        });
        
        // Destaque visual
        this.highlightNode(node);
        
        // Atualiza painel de info
        this.updateInfoPanel();
    }

    highlightNode(node) {
        // Remove destaque de todos os nós
        this.allNodes.forEach(n => {
            if (n.type === 'level') {
                n.circle.setStrokeStyle(3, n.level?.isComplete ? 0x008800 : 
                                            n.isUnlocked ? 0xccaa00 : 0x444444);
            } else {
                n.circle.setStrokeStyle(3, n.isUnlocked ? 0xffffff : 0x333333);
            }
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

    selectNode() {
        const node = this.allNodes[this.currentNodeIndex];
        if (!node) return;
        
        if (!node.isUnlocked) {
            SoundManager.play('warning');
            return;
        }
        
        SoundManager.play('menuSelect');
        
        if (node.type === 'portal') {
            // Transição para outro mundo
            this.transitionToWorld(node.targetWorld);
        } else {
            // Inicia a fase
            this.scene.start('GameScene', {
                level: node.index,
                playerName: GameData.loadPlayerName()
            });
        }
    }

    transitionToWorld(targetWorld) {
        // Efeito de transição
        const { width, height } = this.cameras.main;
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0)
            .setOrigin(0).setDepth(100);
        
        // Texto de transição
        const transitionText = this.add.text(width / 2, height / 2, `Entrando no ${targetWorld.name}...`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        
        // Animação de fade
        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
        
        this.tweens.add({
            targets: transitionText,
            alpha: 1,
            duration: 300,
            delay: 200
        });
        
        // Troca de cena após a animação
        this.time.delayedCall(800, () => {
            // Define a posição inicial no novo mundo
            const firstLevel = targetWorld.levels[0];
            GameData.saveMapPosition(targetWorld.id, firstLevel);
            
            this.scene.start('WorldMapScene', {
                worldId: targetWorld.id,
                levelIndex: firstLevel
            });
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
