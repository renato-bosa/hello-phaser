// GameScene - Jogo de plataforma do Pinguim
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    // Configuração das fases
    static LEVELS = [
        {
            key: 'fase1',
            folder: 'mapa 1',
            mapFile: 'fase 1 - teste2.json',
            bgFile: 'fase 1 - sem bola.png',
            zoom: 1.5
        },
        {
            key: 'fase2',
            folder: 'mapa 2',
            mapFile: 'fase 2 - teste.json',
            bgFile: 'fase 2.png',
            zoom: 1.5
        }
    ];

    init(data) {
        // Fase atual (0 = primeira fase)
        this.currentLevel = data.level || 0;
    }

    preload() {
        const level = GameScene.LEVELS[this.currentLevel];
        const folder = level.folder;
        const levelKey = level.key;
        
        // Adiciona timestamp para evitar cache durante desenvolvimento
        const timestamp = Date.now();
        
        // Carrega o JSON do mapa exportado pelo Tiled (chave única por fase)
        this.load.json(`mapData_${levelKey}`, `${folder}/${level.mapFile}?t=${timestamp}`);
        
        // Carrega o background (chave única por fase)
        this.load.image(`background_${levelKey}`, `${folder}/${level.bgFile}?t=${timestamp}`);
        
        // Carrega o sprite do pinguim (só precisa carregar uma vez)
        if (!this.textures.exists('pinguim')) {
            this.load.image('pinguim', 'mapa 1/pinguim.png');
        }
        
        // Carrega sprites adicionais
        if (!this.textures.exists('bola')) {
            this.load.spritesheet('bola', 'sprites/bola.png', {
                frameWidth: 64,
                frameHeight: 64
            });
        }
    }

    create() {
        const level = GameScene.LEVELS[this.currentLevel];
        const levelKey = level.key;
        
        // Carrega os dados do mapa
        const mapData = this.cache.json.get(`mapData_${levelKey}`);
        
        // Dimensões do mapa
        this.mapWidth = mapData.width * mapData.tilewidth;
        this.mapHeight = mapData.height * mapData.tileheight;
        
        // === BACKGROUND ===
        const bgLayer = mapData.layers.find(layer => layer.type === 'imagelayer');
        if (bgLayer) {
            const offsetX = bgLayer.offsetx || 0;
            const offsetY = bgLayer.offsety || 0;
            const bg = this.add.image(0, 0, `background_${levelKey}`);
            bg.setOrigin(0, 0);
            bg.setPosition(offsetX, offsetY);
            
            console.log(`Background: offset(${offsetX}, ${offsetY}), size(${bg.width}x${bg.height})`);
        }

        // === OBJETOS DE COLISÃO E SPAWN ===
        const objectsLayer = mapData.layers.find(layer => layer.type === 'objectgroup');
        
        // Posição de spawn (padrão)
        let spawnX = 200;
        let spawnY = 300;
        
        // Armazena sprites visuais de objetos
        this.objectSprites = [];
        
        if (objectsLayer) {
            console.log(`Carregando ${objectsLayer.objects.length} objetos...`);
            
            objectsLayer.objects.forEach((obj, index) => {
                const name = obj.name || `object_${index}`;
                
                // Verifica se é um ponto de spawn do jogador
                // Pode ser pelo nome/tipo OU pelo tileset "pinguim"
                const isPlayerSpawn = obj.name?.toLowerCase().includes('spawn') || 
                                      obj.name?.toLowerCase().includes('player') ||
                                      obj.type?.toLowerCase().includes('spawn') ||
                                      obj.type?.toLowerCase().includes('player') ||
                                      this.isPinguimTile(obj.gid, mapData.tilesets);
                
                if (isPlayerSpawn && obj.gid) {
                    // Ponto de spawn do jogador
                    spawnX = obj.x + obj.width / 2;
                    spawnY = obj.y - obj.height / 2;
                    console.log(`  - Spawn encontrado: (${Math.round(spawnX)}, ${Math.round(spawnY)})`);
                } else if (obj.gid && !isPlayerSpawn) {
                    // Objeto com sprite (como as bolas)
                    this.createObjectSprite(obj, mapData.tilesets);
                    console.log(`  - Sprite: ${name} (gid: ${obj.gid})`);
                } else if (obj.polygon) {
                    this.createPolygonBody(obj.x, obj.y, obj.polygon, name);
                    console.log(`  - Polígono: ${name}`);
                } else if (obj.ellipse) {
                    this.createEllipseBody(obj.x, obj.y, obj.width, obj.height, name);
                    console.log(`  - Elipse: ${name} (${obj.width}x${obj.height})`);
                } else if (obj.width > 0 && obj.height > 0 && !obj.gid) {
                    this.createRectangleBody(obj.x, obj.y, obj.width, obj.height, name);
                    console.log(`  - Retângulo: ${name} (${obj.width}x${obj.height})`);
                }
            });
        }

        // === PERSONAGEM (PINGUIM) ===
        this.spawnX = spawnX;
        this.spawnY = spawnY;
        
        this.player = this.matter.add.image(spawnX, spawnY, 'pinguim');
        this.player.setCircle(25);
        this.player.setBounce(0.1);
        this.player.setFriction(0.5);
        this.player.setFixedRotation();

        // === CONTROLES ===
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.jumpCooldown = 0;

        // === CÂMERA ===
        const cameraZoom = level.zoom || 1;
        this.cameras.main.setZoom(cameraZoom);
        this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        
        console.log(`Fase ${this.currentLevel + 1}: ${this.mapWidth}x${this.mapHeight} pixels, Zoom: ${cameraZoom}x`);

        // === UI ===
        const levelName = `Fase ${this.currentLevel + 1}`;
        this.add.text(16, 16, `${levelName} | Setas: Mover | Espaço: Pular | R: Reiniciar`, {
            fontSize: '18px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0);

        // Tecla R para reiniciar
        this.input.keyboard.on('keydown-R', () => {
            this.scene.restart({ level: this.currentLevel });
        });

        // Debug: mostrar posição do mouse ao clicar
        this.input.on('pointerdown', (pointer) => {
            console.log(`Clique em: x=${Math.round(pointer.worldX)}, y=${Math.round(pointer.worldY)}`);
        });

        // Grid de debug (64x64) - só aparece quando debug está ativado
        if (this.matter.config.debug) {
            this.createDebugGrid(64);
        }
    }

    createDebugGrid(gridSize) {
        const graphics = this.add.graphics();
        graphics.setDepth(1000); // Fica acima de tudo
        
        // Estilo do grid - cinza sutil
        const lineAlpha = 0.3;
        const lineColor = 0x888888;
        const labelColor = '#555555';
        const labelAlpha = 0.5;
        
        // Linhas verticais
        for (let x = 0; x <= this.mapWidth; x += gridSize) {
            const alpha = (x % (gridSize * 4) === 0) ? lineAlpha * 2 : lineAlpha;
            graphics.lineStyle(1, lineColor, alpha);
            graphics.beginPath();
            graphics.moveTo(x, 0);
            graphics.lineTo(x, this.mapHeight);
            graphics.strokePath();
            
            // Labels a cada 4 células (256px)
            if (x % (gridSize * 4) === 0 && x > 0) {
                this.add.text(x + 4, 4, `${x}`, {
                    fontSize: '10px',
                    fill: labelColor,
                    alpha: labelAlpha
                }).setAlpha(labelAlpha);
            }
        }
        
        // Linhas horizontais
        for (let y = 0; y <= this.mapHeight; y += gridSize) {
            const alpha = (y % (gridSize * 4) === 0) ? lineAlpha * 2 : lineAlpha;
            graphics.lineStyle(1, lineColor, alpha);
            graphics.beginPath();
            graphics.moveTo(0, y);
            graphics.lineTo(this.mapWidth, y);
            graphics.strokePath();
            
            // Labels a cada 4 células (256px)
            if (y % (gridSize * 4) === 0 && y > 0) {
                this.add.text(4, y + 4, `${y}`, {
                    fontSize: '10px',
                    fill: labelColor
                }).setAlpha(labelAlpha);
            }
        }
        
        console.log(`Grid ${gridSize}x${gridSize} criado (${Math.ceil(this.mapWidth / gridSize)} x ${Math.ceil(this.mapHeight / gridSize)} células)`);
    }

    // Verifica se o gid corresponde ao tileset do pinguim
    isPinguimTile(gid, tilesets) {
        if (!gid || !tilesets) return false;
        
        for (let i = tilesets.length - 1; i >= 0; i--) {
            if (gid >= tilesets[i].firstgid) {
                const tilesetName = tilesets[i].name.toLowerCase();
                return tilesetName === 'pinguim' || tilesetName.includes('player');
            }
        }
        return false;
    }

    createObjectSprite(obj, tilesets) {
        // Encontra o tileset correto baseado no gid
        let tileset = null;
        let localId = obj.gid;
        
        for (let i = tilesets.length - 1; i >= 0; i--) {
            if (obj.gid >= tilesets[i].firstgid) {
                tileset = tilesets[i];
                localId = obj.gid - tileset.firstgid;
                break;
            }
        }
        
        if (!tileset) return null;
        
        // Extrai o nome do tileset (sem extensão e path)
        const tilesetName = tileset.name.toLowerCase();
        
        // Posição do sprite (Tiled usa canto inferior esquerdo para objetos com gid)
        const spriteX = obj.x + obj.width / 2;
        const spriteY = obj.y - obj.height / 2;
        
        // Cria o sprite
        let sprite;
        
        if (this.textures.exists(tilesetName)) {
            // Verifica se é spritesheet (tem mais de 1 tile)
            if (tileset.tilecount > 1) {
                sprite = this.add.sprite(spriteX, spriteY, tilesetName, localId);
                
                // Cria animação se ainda não existe
                const animKey = `${tilesetName}_anim`;
                if (!this.anims.exists(animKey)) {
                    this.anims.create({
                        key: animKey,
                        frames: this.anims.generateFrameNumbers(tilesetName, { 
                            start: 0, 
                            end: tileset.tilecount - 1 
                        }),
                        frameRate: 8,
                        repeat: -1
                    });
                }
                sprite.play(animKey);
            } else {
                sprite = this.add.image(spriteX, spriteY, tilesetName);
            }
            
            // Ajusta escala se o objeto tem tamanho diferente do tile
            if (obj.width !== tileset.tilewidth || obj.height !== tileset.tileheight) {
                sprite.setDisplaySize(obj.width, obj.height);
            }
            
            sprite.setName(obj.name || tilesetName);
            this.objectSprites.push(sprite);
            
            // === HITBOX AUTOMÁTICO POR TIPO DE OBJETO ===
            this.createAutoHitbox(obj, spriteX, spriteY);
            
            return sprite;
        }
        
        console.warn(`Textura não encontrada: ${tilesetName}`);
        return null;
    }

    // Cria hitbox automático baseado no nome/tipo do objeto
    createAutoHitbox(obj, centerX, centerY) {
        const name = (obj.name || '').toLowerCase();
        const type = (obj.type || '').toLowerCase();
        
        // Configurações de hitbox por tipo de objeto
        const hitboxConfigs = {
            'bola': {
                shape: 'circle',
                scale: 0.5,  // 50% do tamanho do sprite
                static: true
            },
            // Adicione outros tipos aqui conforme necessário:
            // 'moeda': { shape: 'circle', scale: 0.4, static: true },
            // 'inimigo': { shape: 'circle', scale: 0.6, static: false },
        };
        
        // Verifica se existe configuração para este objeto
        const config = hitboxConfigs[name] || hitboxConfigs[type];
        
        if (!config) return null; // Sem hitbox automático para este tipo
        
        const size = Math.min(obj.width, obj.height);
        
        if (config.shape === 'circle') {
            const radius = (size * config.scale) / 2;
            const body = this.matter.add.circle(centerX, centerY, radius, {
                isStatic: config.static,
                friction: 0.8,
                restitution: 0.1,
                label: obj.name || 'auto_hitbox'
            });
            console.log(`    ↳ Hitbox circular automático: raio=${Math.round(radius)}px`);
            return body;
        } else if (config.shape === 'rectangle') {
            const w = obj.width * config.scale;
            const h = obj.height * config.scale;
            const body = this.matter.add.rectangle(centerX, centerY, w, h, {
                isStatic: config.static,
                friction: 0.8,
                restitution: 0.1,
                label: obj.name || 'auto_hitbox'
            });
            console.log(`    ↳ Hitbox retangular automático: ${Math.round(w)}x${Math.round(h)}px`);
            return body;
        }
        
        return null;
    }

    createPolygonBody(x, y, polygonPoints, name) {
        // Converte pontos do Tiled para coordenadas absolutas
        const absolutePoints = polygonPoints.map(p => ({ 
            x: x + p.x, 
            y: y + p.y 
        }));

        // Calcula o centroid (média de todos os pontos)
        // Isso é mais preciso que a bounding box para polígonos irregulares
        const centroidX = absolutePoints.reduce((sum, p) => sum + p.x, 0) / absolutePoints.length;
        const centroidY = absolutePoints.reduce((sum, p) => sum + p.y, 0) / absolutePoints.length;

        // Converte pontos para serem relativos ao centroid
        const relativePoints = absolutePoints.map(p => ({
            x: p.x - centroidX,
            y: p.y - centroidY
        }));

        // Cria o corpo com pontos relativos, posicionado no centroid
        const body = this.matter.add.fromVertices(
            centroidX,
            centroidY,
            relativePoints,
            {
                isStatic: true,
                friction: 0.8,
                restitution: 0.1,
                label: name
            }
        );

        if (body) {
            // O Matter.js pode ter ajustado a posição baseado no centro de massa real
            // Corrigimos para garantir alinhamento com o Tiled
            const offsetX = centroidX - body.position.x;
            const offsetY = centroidY - body.position.y;
            
            if (Math.abs(offsetX) > 0.1 || Math.abs(offsetY) > 0.1) {
                this.matter.body.translate(body, { x: offsetX, y: offsetY });
            }
        }

        return body;
    }

    createEllipseBody(x, y, width, height, name) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const radius = Math.min(width, height) / 2;

        const body = this.matter.add.circle(centerX, centerY, radius, {
            isStatic: true,
            friction: 0.8,
            restitution: 0.1,
            label: name
        });

        return body;
    }

    createRectangleBody(x, y, width, height, name) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        const body = this.matter.add.rectangle(centerX, centerY, width, height, {
            isStatic: true,
            friction: 0.8,
            restitution: 0.1,
            label: name
        });

        return body;
    }

    update(time, delta) {
        if (!this.player || !this.player.body) return;

        const speed = 5;
        const jumpForce = 10;

        // Movimento horizontal
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(this.player.body.velocity.x * 0.9);
        }

        // Pulo
        this.jumpCooldown -= delta;
        
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.jumpCooldown <= 0) {
            this.player.setVelocityY(-jumpForce);
            this.jumpCooldown = 500;
        }

        // Limita velocidade de queda
        if (this.player.body.velocity.y > 15) {
            this.player.setVelocityY(15);
        }

        // Reset se cair do mapa
        if (this.player.y > this.mapHeight + 100) {
            this.player.setPosition(this.spawnX, this.spawnY);
            this.player.setVelocity(0, 0);
        }

        // === TRANSIÇÃO DE FASE ===
        // Ao tocar a lateral ESQUERDA, avança para a próxima fase
        if (this.player.x <= 10) {
            this.goToNextLevel();
        }
    }

    goToNextLevel() {
        const nextLevel = this.currentLevel + 1;
        
        if (nextLevel < GameScene.LEVELS.length) {
            console.log(`Avançando para a Fase ${nextLevel + 1}!`);
            this.scene.restart({ level: nextLevel });
        } else {
            // Última fase - volta para o início ou mostra mensagem de vitória
            console.log('🎉 Parabéns! Você completou todas as fases!');
            
            // Mostra mensagem de vitória
            this.add.text(
                this.cameras.main.centerX, 
                this.cameras.main.centerY, 
                '🎉 PARABÉNS!\nVocê completou o jogo!', 
                {
                    fontSize: '48px',
                    fill: '#ffff00',
                    stroke: '#000000',
                    strokeThickness: 6,
                    align: 'center'
                }
            ).setOrigin(0.5).setScrollFactor(0);
            
            // Para o jogador
            this.player.setVelocity(0, 0);
            this.player.setStatic(true);
        }
    }
}
