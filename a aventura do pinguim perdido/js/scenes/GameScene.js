// GameScene - Fase de teste para validar proporções
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Carrega o JSON do mapa exportado pelo Tiled
        this.load.json('mapData', 'mapa 1/fase 1 - teste.json');
        
        // Carrega o background (desenho da fase)
        this.load.image('background', 'mapa 1/fase 1.png');
        
        // Carrega o sprite do pinguim
        this.load.image('pinguim', 'mapa 1/pinguim.png');
    }

    create() {
        // Carrega os dados do mapa
        const mapData = this.cache.json.get('mapData');
        
        // === BACKGROUND ===
        // Procura a camada de imagem (imagelayer)
        const bgLayer = mapData.layers.find(layer => layer.type === 'imagelayer');
        if (bgLayer) {
            const offsetX = bgLayer.offsetx || 0;
            const offsetY = bgLayer.offsety || 0;
            // Posiciona usando o offset do Tiled
            // A imagem é centralizada, então ajustamos para o canto
            const bg = this.add.image(0, 0, 'background');
            bg.setOrigin(0, 0);
            bg.setPosition(offsetX, offsetY);
            
            console.log(`Background: offset(${offsetX}, ${offsetY}), size(${bg.width}x${bg.height})`);
        }

        // === OBJETOS DE COLISÃO E SPAWN ===
        // Procura a camada de objetos
        const objectsLayer = mapData.layers.find(layer => layer.type === 'objectgroup');
        
        // Posição de spawn (padrão)
        let spawnX = 200;
        let spawnY = 300;
        
        if (objectsLayer) {
            console.log(`Carregando ${objectsLayer.objects.length} objetos...`);
            
            objectsLayer.objects.forEach((obj, index) => {
                const name = obj.name || `object_${index}`;
                
                // Verifica se é um ponto de spawn (objeto com gid = tile do pinguim)
                // ou com name/type indicando spawn
                const isSpawn = obj.gid || 
                                obj.name?.toLowerCase().includes('spawn') || 
                                obj.name?.toLowerCase().includes('player') ||
                                obj.type?.toLowerCase().includes('spawn') ||
                                obj.type?.toLowerCase().includes('player');
                
                if (isSpawn && obj.gid) {
                    // Objeto de tile - usado como spawn
                    // No Tiled, y é a BASE do tile, não o topo
                    spawnX = obj.x + obj.width / 2;
                    spawnY = obj.y - obj.height / 2;
                    console.log(`  - Spawn encontrado: (${Math.round(spawnX)}, ${Math.round(spawnY)})`);
                } else if (obj.polygon) {
                    // Polígono irregular
                    this.createPolygonBody(obj.x, obj.y, obj.polygon, name);
                    console.log(`  - Polígono: ${name}`);
                } else if (obj.ellipse) {
                    // Círculo/Elipse
                    this.createEllipseBody(obj.x, obj.y, obj.width, obj.height, name);
                    console.log(`  - Elipse: ${name} (${obj.width}x${obj.height})`);
                } else if (obj.width > 0 && obj.height > 0 && !obj.gid) {
                    // Retângulo (não é tile)
                    this.createRectangleBody(obj.x, obj.y, obj.width, obj.height, name);
                    console.log(`  - Retângulo: ${name} (${obj.width}x${obj.height})`);
                }
            });
        }

        // === PERSONAGEM (PINGUIM) ===
        // Salva a posição de spawn para reset
        this.spawnX = spawnX;
        this.spawnY = spawnY;
        
        // Cria o pinguim como um corpo Matter.js na posição de spawn
        this.player = this.matter.add.image(spawnX, spawnY, 'pinguim');
        
        // Configurações do corpo do pinguim
        this.player.setCircle(25); // Hitbox circular para melhor rolamento
        this.player.setBounce(0.1);
        this.player.setFriction(0.5);
        this.player.setFixedRotation(); // Não rotaciona (fica em pé)

        // === CONTROLES ===
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Estado do pulo
        this.canJump = true;
        this.jumpCooldown = 0;

        // === CÂMERA ===
        const mapWidth = mapData.width * mapData.tilewidth;
        const mapHeight = mapData.height * mapData.tileheight;
        
        // Zoom da câmera (1 = normal, 2 = 2x mais perto, 0.5 = 2x mais longe)
        const cameraZoom = 1.5;
        this.cameras.main.setZoom(cameraZoom);
        
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        
        console.log(`Mapa: ${mapWidth}x${mapHeight} pixels, Zoom: ${cameraZoom}x`);

        // === INSTRUÇÕES ===
        this.add.text(16, 16, 'Setas: Mover | Espaço: Pular | R: Reiniciar', {
            fontSize: '18px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0);

        // Tecla R para reiniciar (útil para testar alterações)
        this.input.keyboard.on('keydown-R', () => {
            this.scene.restart();
        });

        // Debug: mostrar posição do mouse ao clicar
        this.input.on('pointerdown', (pointer) => {
            console.log(`Clique em: x=${Math.round(pointer.worldX)}, y=${Math.round(pointer.worldY)}`);
        });
    }

    createPolygonBody(x, y, polygonPoints, name) {
        // Converte para coordenadas absolutas (Tiled usa coordenadas relativas)
        const absolutePoints = polygonPoints.map(p => ({ 
            x: x + p.x, 
            y: y + p.y 
        }));

        // Calcula o centro do bounding box
        const minX = Math.min(...absolutePoints.map(p => p.x));
        const maxX = Math.max(...absolutePoints.map(p => p.x));
        const minY = Math.min(...absolutePoints.map(p => p.y));
        const maxY = Math.max(...absolutePoints.map(p => p.y));
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Converte para coordenadas relativas ao centro (Matter.js precisa disso)
        const centeredPoints = absolutePoints.map(p => ({
            x: p.x - centerX,
            y: p.y - centerY
        }));

        // Cria o corpo Matter.js
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

        // O Matter.js pode reposicionar baseado no centro de massa real
        // Precisamos corrigir para o centro do bounding box
        if (body) {
            this.matter.body.setPosition(body, { x: centerX, y: centerY });
        }

        return body;
    }

    createEllipseBody(x, y, width, height, name) {
        // No Tiled, x e y são o canto superior esquerdo
        // O centro da elipse é x + width/2, y + height/2
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // Para círculos, usa o raio menor
        // Para elipses, Matter.js não suporta nativamente, então aproximamos com um círculo
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
        // No Tiled, x e y são o canto superior esquerdo
        // O centro do retângulo é x + width/2, y + height/2
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
            // Desacelera gradualmente
            this.player.setVelocityX(this.player.body.velocity.x * 0.9);
        }

        // Pulo - com cooldown simples
        this.jumpCooldown -= delta;
        
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.jumpCooldown <= 0) {
            this.player.setVelocityY(-jumpForce);
            this.jumpCooldown = 500; // 500ms entre pulos
        }

        // Limita velocidade máxima de queda
        if (this.player.body.velocity.y > 15) {
            this.player.setVelocityY(15);
        }

        // Reset se cair do mapa
        if (this.player.y > 750) {
            this.player.setPosition(this.spawnX, this.spawnY);
            this.player.setVelocity(0, 0);
        }
    }
}
