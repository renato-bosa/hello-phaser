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
            mapFile: 'fase 1 - teste.json',
            bgFile: 'fase 1.png',
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
        
        if (objectsLayer) {
            console.log(`Carregando ${objectsLayer.objects.length} objetos...`);
            
            objectsLayer.objects.forEach((obj, index) => {
                const name = obj.name || `object_${index}`;
                
                // Verifica se é um ponto de spawn
                const isSpawn = obj.gid || 
                                obj.name?.toLowerCase().includes('spawn') || 
                                obj.name?.toLowerCase().includes('player') ||
                                obj.type?.toLowerCase().includes('spawn') ||
                                obj.type?.toLowerCase().includes('player');
                
                if (isSpawn && obj.gid) {
                    spawnX = obj.x + obj.width / 2;
                    spawnY = obj.y - obj.height / 2;
                    console.log(`  - Spawn encontrado: (${Math.round(spawnX)}, ${Math.round(spawnY)})`);
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
    }

    createPolygonBody(x, y, polygonPoints, name) {
        const absolutePoints = polygonPoints.map(p => ({ 
            x: x + p.x, 
            y: y + p.y 
        }));

        const minX = Math.min(...absolutePoints.map(p => p.x));
        const maxX = Math.max(...absolutePoints.map(p => p.x));
        const minY = Math.min(...absolutePoints.map(p => p.y));
        const maxY = Math.max(...absolutePoints.map(p => p.y));
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const centeredPoints = absolutePoints.map(p => ({
            x: p.x - centerX,
            y: p.y - centerY
        }));

        const body = this.matter.add.fromVertices(
            centerX,
            centerY,
            centeredPoints,
            {
                isStatic: true,
                friction: 0.8,
                restitution: 0.1,
                label: name
            }
        );

        if (body) {
            this.matter.body.setPosition(body, { x: centerX, y: centerY });
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
