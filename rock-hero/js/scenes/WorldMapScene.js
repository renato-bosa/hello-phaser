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
        const savedPos = GameData.loadMapPosition();

        // savedPos é a fonte da verdade (saveMapPosition é sempre chamado antes de entrar aqui).
        // Ignoramos data do Phaser — pode conter valores stale de cenas anteriores.
        this.currentWorldId = savedPos.worldId;
        this.cursorLevelIndex = savedPos.levelIndex;

        if (GameData.DEBUG_MAP_POSITION) {
            const sceneData = data ? { worldId: data.worldId, levelIndex: data.levelIndex } : null;
            GameData.logMapDebug('WorldMapScene.init', {
                sceneData,
                savedPos,
                applied: { worldId: this.currentWorldId, levelIndex: this.cursorLevelIndex }
            });
            if (sceneData && sceneData.levelIndex != null && sceneData.levelIndex !== savedPos.levelIndex) {
                GameData.logMapWarn('WorldMapScene.init: sceneData.levelIndex difere de savedPos (stale data ignorada)', {
                    sceneDataLevelIndex: sceneData.levelIndex,
                    savedPosLevelIndex: savedPos.levelIndex
                });
            }
            const worldForLevel = GameData.getWorldForLevel(this.cursorLevelIndex);
            if (worldForLevel && Number(worldForLevel.id) !== Number(this.currentWorldId)) {
                GameData.logMapWarn('WorldMapScene.init: levelIndex não pertence ao currentWorldId', {
                    currentWorldId: this.currentWorldId,
                    cursorLevelIndex: this.cursorLevelIndex,
                    worldIdEsperadoParaFase: worldForLevel.id
                });
            }
        }

        // Carrega personagem selecionado
        GameData.loadSelectedCharacter();
    }

    preload() {
        const selectedId = GameData.state.selectedCharacter || GameData.loadSelectedCharacter();
        GameData.loadCharacterSprites(this, selectedId);

        // Pré-carrega a imagem de fundo do mundo atual, se configurada.
        // Mundos sem `bgImage` continuam usando a decoração procedural (fallback).
        const worldData = GameData.WORLDS.find(w => w.id === this.currentWorldId);
        if (worldData && worldData.bgImage) {
            const key = this._worldBgKey(this.currentWorldId);
            if (!this.textures.exists(key)) {
                this.load.image(key, GameData.assetUrl(worldData.bgImage));
            }
        }
    }

    _worldBgKey(worldId) {
        return `worldmap-bg-${worldId}`;
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

        // Estado da cena: 'map' (navegação normal) ou 'ranking' (overlay de tempos aberto).
        // Gates de input em setupControls()/update() consultam este flag.
        this.currentView = 'map';
        this.rankingOverlayElements = [];
        
        // Cria elementos visuais
        this.createBackground(width, height);
        this.createTitle(width);
        this.createPaths();
        this.createLevelNodes();
        this.createWorldPortals(width, height);
        this.createPlayerCursor();
        this.createUI(width, height);
        this.createCharacterButton(width, height);
        this.createRankingButton(width, height);
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
        // Cor base sempre desenhada por trás (evita "vazamento" caso a imagem
        // tenha aspecto diferente do canvas, e serve como fallback se a textura falhar).
        const bgColor = this.worldData?.bgColor || 0x87CEEB;
        this.add.rectangle(0, 0, width, height, bgColor).setOrigin(0);

        const bgKey = this._worldBgKey(this.currentWorldId);
        const hasBgImage = this.worldData?.bgImage && this.textures.exists(bgKey);

        if (hasBgImage) {
            // Imagem pré-renderizada como fundo: aplica "cover" (preserva
            // proporção e preenche o canvas, recortando excedente se necessário).
            const img = this.add.image(width / 2, height / 2, bgKey).setOrigin(0.5);
            const src = img.texture.getSourceImage();
            const scale = Math.max(width / src.width, height / src.height);
            img.setScale(scale);

            // Arte não-pixel: filtro linear para suavizar o upscale/downscale.
            this.textures.get(bgKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
            return;
        }

        // Fallback procedural (mundos sem bgImage configurada)
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
        const rectWidth = 400;
        const rectHalfWidth = rectWidth / 2;

        // Fundo do título
        this.add.rectangle(width / 2, titleY, rectWidth, 50, 0x000000, 0.6)
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

        // Contador de vidas (dentro do retângulo, lado direito).
        // No WorldMap as vidas não mudam, mas guardamos a referência para
        // facilitar futuras mecânicas (extra-life no mapa, portais, etc.).
        const lives = GameData.getLives();
        this.livesText = this.add.text(
            width / 2 + rectHalfWidth - 12, titleY, `🎵 x${lives}`,
            {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '15px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(1, 0.5);
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
            if (GameData.DEBUG_MAP_POSITION) {
                GameData.logMapWarn('createPlayerCursor: sem nó com index === cursorLevelIndex; tentando primeira fase desbloqueada', {
                    cursorLevelIndex: this.cursorLevelIndex,
                    levelNodeIndices: this.allNodes.filter(n => n.type === 'level').map(n => n.index)
                });
            }
            startNode = this.allNodes.find(n => n.type === 'level' && n.isUnlocked);
        }
        if (!startNode) {
            if (GameData.DEBUG_MAP_POSITION) {
                GameData.logMapWarn('createPlayerCursor: nenhuma fase desbloqueada; usando allNodes[0]', {
                    cursorLevelIndex: this.cursorLevelIndex,
                    allNodeTypes: this.allNodes.map(n => n.type)
                });
            }
            startNode = this.allNodes[0];
        }

        this.currentNodeIndex = this.allNodes.indexOf(startNode);

        if (GameData.DEBUG_MAP_POSITION && startNode?.type === 'level' && startNode.index !== this.cursorLevelIndex) {
            GameData.logMapDebug('createPlayerCursor: cursor efetivo difere de cursorLevelIndex (fallback aplicado)', {
                cursorLevelIndexSalvo: this.cursorLevelIndex,
                indiceNoNo: startNode.index
            });
        }
        
        const { x, y } = startNode.mapPosition;
        
        // Cursor (triângulo apontando para baixo)
        this.cursor = this.add.container(x, y - 45);
        
        // Triângulo indicador
        const arrow = this.add.triangle(0, 0, 0, 0, 10, -15, -10, -15, 0xff0000);
        arrow.setStrokeStyle(2, 0xffffff);
        this.cursor.add(arrow);

        // Personagem selecionado, abaixo da seta
        const selectedId = GameData.state.selectedCharacter || GameData.loadSelectedCharacter();
        const idleKey = GameData.getCharacterTextureKey(selectedId, 'idle');
        if (this.textures.exists(idleKey)) {
            GameData.createCharacterAnimations(this, selectedId, 'mapcursor-', true);
            const charSprite = this.add.sprite(0, 22, idleKey).setOrigin(0.5).setScale(1.5);
            charSprite.anims.play('mapcursor-idle', true);
            this.cursor.add(charSprite);
        }

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
            { key: 'O', action: 'Selecionar' },
            { key: 'X', action: 'Voltar' }
        ] : [
            { key: '← →', action: 'Navegar' },
            { key: 'ENTER', action: 'Selecionar' },
            { key: 'P', action: 'Personagem' },
            { key: 'R', action: 'Tempos' },
            { key: 'ESC', action: 'Menu' }
        ];

        // Espaça os controles uniformemente pelo canvas (evita corte quando há
        // muitos itens, como no modo desktop com 5 controles).
        const spacing = (width - 40) / controls.length;
        const startX = 20 + spacing / 2;

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

    /**
     * Constrói um "cartão-botão" (container com sombra + fundo + stroke + conteúdo).
     * Compartilhado entre o botão de personagem (canto sup. esq.) e o de ranking
     * (canto sup. dir.) para garantir simetria visual e comportamento consistente
     * de hover/click.
     *
     * @param {number} cx           centro X do cartão
     * @param {number} cy           centro Y do cartão
     * @param {number} btnW         largura
     * @param {number} btnH         altura
     * @param {number} strokeColor  cor do stroke em estado normal
     * @param {number} strokeHover  cor do stroke em hover
     * @param {Function} onClick    callback do pointerdown
     * @returns {Phaser.GameObjects.Container}
     */
    _createCardButton(cx, cy, btnW, btnH, strokeColor, strokeHover, onClick) {
        const container = this.add.container(cx, cy).setDepth(10);

        // Sombra deslocada para profundidade
        const shadow = this.add.rectangle(3, 3, btnW, btnH, 0x000000, 0.5);
        container.add(shadow);

        // Fundo principal
        const bg = this.add.rectangle(0, 0, btnW, btnH, 0x1a1a2e, 0.9)
            .setStrokeStyle(2, strokeColor);
        container.add(bg);

        // Hit-test no fundo (ícone/label ficam por cima, não interativos, e não bloqueiam)
        bg.setInteractive({ useHandCursor: true });

        bg.on('pointerover', () => {
            if (this.currentView !== 'map') return;
            bg.setStrokeStyle(2, strokeHover);
            bg.setFillStyle(0x2a2a4e, 0.95);
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1.06, duration: 120, ease: 'Power1' });
        });
        bg.on('pointerout', () => {
            bg.setStrokeStyle(2, strokeColor);
            bg.setFillStyle(0x1a1a2e, 0.9);
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Power1' });
        });
        bg.on('pointerdown', () => {
            if (this.currentView !== 'map') return;
            onClick();
        });

        // Expõe o bg para permitir que o chamador adicione filhos por cima
        container.bg = bg;
        return container;
    }

    createCharacterButton(width, height) {
        // Cartão-botão de trocar personagem (canto superior esquerdo).
        // Ícone (🎸) empilhado sobre o nome do personagem selecionado.
        const btnW = 100;
        const btnH = 44;
        const cx = 10 + btnW / 2;
        const cy = 12 + btnH / 2;

        const container = this._createCardButton(
            cx, cy, btnW, btnH,
            0xffcc55, 0xffe088,
            () => this.openCharacterSelect()
        );

        // Ícone do instrumento
        const icon = this.add.text(0, -10, '🎸', { fontSize: '18px' }).setOrigin(0.5);
        container.add(icon);

        // Nome amigável do personagem (usa o display name de GameConfig, não o id).
        const characterId = GameData.loadSelectedCharacter();
        const characterName = GameData.getCharacter(characterId)?.name || characterId;
        const label = this.add.text(0, 11, characterName, {
            fontFamily: 'Arial',
            fontSize: '11px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(label);
    }

    createRankingButton(width, height) {
        // Cartão-botão "Ver meus tempos" (canto superior direito, espelhando o
        // botão de personagem à esquerda). Fica na coluna livre entre o retângulo
        // do título (que termina em x≈520) e a borda direita do canvas.
        const btnW = 110;
        const btnH = 44;
        const cx = width - 5 - btnW / 2;
        const cy = 12 + btnH / 2;

        const container = this._createCardButton(
            cx, cy, btnW, btnH,
            0xffd700, 0xfff099,
            () => this.showRanking()
        );

        const icon = this.add.text(0, -10, '🏆', { fontSize: '18px' }).setOrigin(0.5);
        container.add(icon);

        const label = this.add.text(0, 11, 'Ver meus tempos', {
            fontFamily: 'Arial',
            fontSize: '10px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(label);
    }

    showRanking() {
        if (this.currentView === 'ranking') return;
        this.currentView = 'ranking';
        this.rankingOverlayElements = [];

        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Overlay escuro em cima de todo o mapa. Depth 200 fica acima dos
        // elementos do mapa (nós, portais, HUD superior, tudo ≤ 10).
        // setInteractive() sem callback faz o overlay "engolir" cliques,
        // evitando que os cartões-botão (depth 10) recebam eventos por baixo.
        const overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.95)
            .setDepth(200)
            .setInteractive();
        this.rankingOverlayElements.push(overlay);

        // Título
        const title = this.add.text(centerX, 40, '🏆 MEUS TEMPOS 🏆', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(201);
        this.rankingOverlayElements.push(title);

        // Subtítulo: nome do jogador da partida ativa (chegamos aqui sempre com
        // slot ativo, então não precisamos do fallback "nenhuma partida" que o
        // MenuScene tinha).
        const subtitle = this.add.text(centerX, 65, `Partida: ${GameData.loadPlayerName()}`, {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#888888'
        }).setOrigin(0.5).setDepth(201);
        this.rankingOverlayElements.push(subtitle);

        this.renderBestTimes(centerX, centerY);

        // Instrução de fechar
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const closeText = this.add.text(centerX, centerY + 140,
            isMobile ? 'Pressione X para voltar' : 'Pressione ESC para voltar', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#aaaaaa'
        }).setOrigin(0.5).setDepth(201);
        this.rankingOverlayElements.push(closeText);

        SoundManager.play('menuSelect');
    }

    renderBestTimes(centerX, centerY) {
        const startY = 90;
        const colWidth = 150;
        const startX = centerX - (GameData.WORLDS.length * colWidth) / 2 + colWidth / 2;

        GameData.WORLDS.forEach((world, worldIndex) => {
            const x = startX + worldIndex * colWidth;

            const worldTitle = this.add.text(x, startY, world.name, {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#00ffff',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(201);
            this.rankingOverlayElements.push(worldTitle);

            let y = startY + 25;
            world.levels.forEach(levelIndex => {
                const level = GameData.LEVELS[levelIndex];
                const bestTime = GameData.getBestTime(levelIndex);
                const isComplete = GameData.isLevelComplete(levelIndex);

                const levelName = this.add.text(x - 50, y, level.name, {
                    fontSize: '11px',
                    fontFamily: 'Arial',
                    color: isComplete ? '#ffffff' : '#666666'
                }).setOrigin(0, 0.5).setDepth(201);
                this.rankingOverlayElements.push(levelName);

                const timeText = bestTime !== null
                    ? GameData.formatTime(bestTime)
                    : '--:--.---';
                const timeDisplay = this.add.text(x + 50, y, timeText, {
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: bestTime !== null ? '#00ff00' : '#444444'
                }).setOrigin(1, 0.5).setDepth(201);
                this.rankingOverlayElements.push(timeDisplay);

                y += 20;
            });
        });

        // Tempo total (só aparece se todas as fases tiverem bestTime)
        const totalTime = GameData.getTotalBestTime();
        if (totalTime !== null) {
            const totalText = this.add.text(centerX, centerY + 100,
                `⏱️ Tempo Total: ${GameData.formatTime(totalTime)}`, {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#ffd700',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(201);
            this.rankingOverlayElements.push(totalText);
        }
    }

    closeRankingOverlay() {
        if (this.currentView !== 'ranking') return;
        this.rankingOverlayElements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        this.rankingOverlayElements = [];
        this.currentView = 'map';
        SoundManager.play('menuNavigate');
    }

    createInfoPanel(width, height) {
        // Painel de informações da fase selecionada.
        // Posicionado horizontalmente centralizado, logo abaixo do retângulo do título
        // (título ocupa y=10..60, então deixamos ~6px de respiro antes do painel).
        const panelWidth = 280;
        const panelHeight = 60;
        const panelX = width / 2;
        const panelY = 66 + panelHeight / 2; // top do painel em y=66

        // Fundo
        this.infoPanelBg = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x000000, 0.8)
            .setStrokeStyle(2, 0x666666);

        // Espaçamento vertical entre linhas (mais apertado que o original de 25/30px
        // para acomodar a altura reduzida sem sobreposição).
        const rowGap = 20;

        // Nome da fase
        this.infoLevelName = this.add.text(panelX, panelY - rowGap, '', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '11px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: panelWidth - 20 }
        }).setOrigin(0.5);

        // Status
        this.infoStatus = this.add.text(panelX, panelY, '', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#aaaaaa',
            align: 'center'
        }).setOrigin(0.5);

        // Melhor tempo
        this.infoBestTime = this.add.text(panelX, panelY + rowGap, '', {
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
        // Navegação — só quando não há overlay aberto.
        this.input.keyboard.on('keydown-LEFT', () => {
            if (this.currentView === 'map') this.navigateNode(-1);
        });
        this.input.keyboard.on('keydown-RIGHT', () => {
            if (this.currentView === 'map') this.navigateNode(1);
        });

        // Selecionar
        this.input.keyboard.on('keydown-ENTER', () => {
            if (this.currentView === 'map') this.selectNode();
        });
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.currentView === 'map') this.selectNode();
        });

        // Seleção de personagem
        this.input.keyboard.on('keydown-P', () => {
            if (this.currentView === 'map') this.openCharacterSelect();
        });

        // R: atalho para "Ver meus tempos" (equivalente a tocar/clicar no cartão 🏆).
        // Mantém a operabilidade completa via teclado sem depender de mouse/touch.
        this.input.keyboard.on('keydown-R', () => {
            if (this.currentView === 'map') this.showRanking();
        });

        // ESC: fecha overlay se aberto, senão volta ao menu.
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.currentView === 'ranking') {
                this.closeRankingOverlay();
            } else {
                this.backToMenu();
            }
        });

        // Suporte a controles virtuais (mobile)
        this.virtualControls = GameData.getVirtualControls();
        this.lastNavTime = 0;
    }

    update(time) {
        // O = selecionar (só no mapa; no overlay não faz nada)
        if (this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
            if (this.currentView === 'map') {
                this.selectNode();
            }
        }

        // X = fecha overlay se aberto, senão volta ao menu
        if (this.virtualControls.backJustPressed) {
            this.virtualControls.backJustPressed = false;
            if (this.currentView === 'ranking') {
                this.closeRankingOverlay();
            } else {
                this.backToMenu();
            }
        }

        // Navegação com throttle — só no mapa
        if (this.currentView === 'map' && time - this.lastNavTime > 200) {
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
                GameData.saveMapPosition(this.currentWorldId, newNode.index, 'worldMap.navigate');
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
            GameData.saveMapPosition(targetWorld.id, firstLevel, 'worldMap.portalTransition');
            
            this.scene.start('WorldMapScene', {});
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
