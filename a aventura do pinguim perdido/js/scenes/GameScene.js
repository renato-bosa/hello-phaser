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
            mapFile: 'fase 1 - teste3.json',
            bgFile: 'fase 1 - sem bola.png',
            zoom: 1.5,
            canFly: false  // Só pula no chão
        },
        {
            key: 'fase2',
            folder: 'mapa 2',
            mapFile: 'fase 2 - teste.json',
            bgFile: 'fase 2.png',
            zoom: 1.5,
            canFly: false  // Só pula no chão
            // canFly: true  // Para fases de água/nado - permite pular no ar
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
            this.load.image('pinguim', 'sprites/pinguim.png');
        }
        
        // Carrega sprites adicionais
        if (!this.textures.exists('bola')) {
            this.load.spritesheet('bola', 'sprites/bola.png', {
                frameWidth: 64,
                frameHeight: 64
            });
        }
        
        // Carrega sprite da foca (128x128 - 2x2 blocos)
        if (!this.textures.exists('foca')) {
            this.load.image('foca', 'sprites/foca.png');
        }
    }

    create() {
        const level = GameScene.LEVELS[this.currentLevel];
        const levelKey = level.key;
        
        // === LIMPA DADOS DA FASE ANTERIOR ===
        this.cleanupPreviousLevel();
        
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
        this.isRespawning = false; // Flag para evitar múltiplos respawns
        
        this.player = this.matter.add.image(spawnX, spawnY, 'pinguim');
        this.player.setCircle(25);
        this.player.setBounce(0.1);
        this.player.setFriction(0.5);
        this.player.setFixedRotation();

        // === DETECÇÃO DE COLISÃO COM PROJÉTEIS E INIMIGOS ===
        this.matter.world.on('collisionstart', (event) => {
            event.pairs.forEach((pair) => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;
                
                const playerBody = this.player.body;
                const isPlayerInvolved = bodyA === playerBody || bodyB === playerBody;
                
                if (isPlayerInvolved) {
                    const otherBody = bodyA === playerBody ? bodyB : bodyA;
                    
                    // Verifica se é uma bola (pelo label)
                    if (otherBody.label === 'bola') {
                        this.onPlayerHit();
                    }
                    
                    // Verifica se pisou na cabeça de um inimigo
                    if (otherBody.label === 'enemy_head') {
                        // Só conta como "pisar" se o jogador está caindo
                        if (this.player.body.velocity.y > 0) {
                            const enemy = this.enemies?.find(e => e.headBody === otherBody);
                            if (enemy) this.onEnemyStomp(enemy);
                        }
                    }
                    
                    // Verifica se encostou no corpo do inimigo
                    if (otherBody.label === 'enemy_body') {
                        const enemy = this.enemies?.find(e => e.bodyBody === otherBody);
                        if (enemy && enemy.alive) {
                            this.onPlayerHit();
                        }
                    }
                }
            });
        });

        // === CONTROLES ===
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.jumpCooldown = 0;
        this.isOnGround = false;
        this.canFly = level.canFly || false; // Modo nado/voo
        this.groundContacts = 0; // Contador de contatos com o chão

        // Detecta quando toca o chão
        this.matter.world.on('collisionstart', (event) => {
            event.pairs.forEach((pair) => {
                if (this.isPlayerTouchingGround(pair)) {
                    this.groundContacts++;
                    this.isOnGround = true;
                }
            });
        });

        // Detecta quando sai do chão
        this.matter.world.on('collisionend', (event) => {
            event.pairs.forEach((pair) => {
                if (this.isPlayerTouchingGround(pair)) {
                    this.groundContacts--;
                    if (this.groundContacts <= 0) {
                        this.groundContacts = 0;
                        this.isOnGround = false;
                    }
                }
            });
        });

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

    // Limpa dados da fase anterior (inimigos, projéteis, etc)
    cleanupPreviousLevel() {
        // Limpa inimigos e suas bolas
        if (this.enemies) {
            this.enemies.forEach(enemy => {
                // Remove bolas do inimigo
                if (enemy.balls) {
                    enemy.balls.forEach(ball => {
                        if (ball.sprite) ball.sprite.destroy();
                        if (ball.body) this.matter.world.remove(ball.body);
                    });
                }
                // Remove hitboxes do inimigo
                if (enemy.headBody) this.matter.world.remove(enemy.headBody);
                if (enemy.bodyBody) this.matter.world.remove(enemy.bodyBody);
            });
            this.enemies = [];
        }
        
        // Limpa projéteis avulsos
        if (this.projectiles) {
            this.projectiles.forEach(proj => {
                if (proj.sprite) proj.sprite.destroy();
                if (proj.body) this.matter.world.remove(proj.body);
            });
            this.projectiles = [];
        }
        
        // Limpa sprites de objetos
        if (this.objectSprites) {
            this.objectSprites.forEach(sprite => {
                if (sprite) sprite.destroy();
            });
            this.objectSprites = [];
        }
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
                scale: 0.5,       // 50% do tamanho do sprite
                static: true,     // Hitbox estático (só para colisão)
                projectile: true, // Movimento manual (sem física)
                speed: 2,         // Velocidade de movimento
                respawn: true     // Respawna quando sai da tela
            },
            'foca': {
                enemy: true,           // É um inimigo
                oscillate: true,       // Move para cima e para baixo
                oscillateSpeed: 0.5,   // Velocidade da oscilação
                oscillateRange: 30,    // Amplitude do movimento (pixels)
                stompable: true,       // Pode ser pisado na cabeça
                shootsBalls: true,     // Lança bolas
                shootInterval: 2500,   // Intervalo base entre lançamentos (ms)
                shootVariation: 0.1,   // Variação aleatória (10%)
                stunDuration: 1500     // Tempo atordoada após pisão (ms)
            },
        };
        
        // Verifica se existe configuração para este objeto
        const config = hitboxConfigs[name] || hitboxConfigs[type];
        
        if (!config) return null; // Sem hitbox automático para este tipo
        
        const size = Math.min(obj.width, obj.height);
        let body = null;
        
        // === INIMIGOS (como a foca) ===
        if (config.enemy) {
            this.createEnemy(obj, centerX, centerY, config);
            return null; // Inimigo cria seus próprios hitboxes
        }
        
        if (config.shape === 'circle') {
            const radius = (size * config.scale) / 2;
            body = this.matter.add.circle(centerX, centerY, radius, {
                isStatic: true, // Sempre estático - movimento será manual
                isSensor: config.projectile || false, // Projéteis são sensores (não empurram)
                friction: 0.8,
                restitution: 0.1,
                label: obj.name || 'auto_hitbox'
            });
            console.log(`    ↳ Hitbox circular: raio=${Math.round(radius)}px`);
        } else if (config.shape === 'rectangle') {
            const w = obj.width * config.scale;
            const h = obj.height * config.scale;
            body = this.matter.add.rectangle(centerX, centerY, w, h, {
                isStatic: config.static,
                friction: 0.01,
                frictionAir: 0,
                restitution: 0.8,
                label: obj.name || 'auto_hitbox'
            });
            console.log(`    ↳ Hitbox retangular: ${Math.round(w)}x${Math.round(h)}px, static=${config.static}`);
        }
        
        // Se é um projétil, armazena para controle (será lançado depois)
        if (body && config.projectile) {
            if (!this.projectiles) this.projectiles = [];
            
            const projectile = {
                body: body,
                sprite: this.objectSprites[this.objectSprites.length - 1], // Último sprite criado
                spawnX: centerX,
                spawnY: centerY,
                speed: config.speed || 3,
                respawn: config.respawn || false,
                launched: false // Será lançado no primeiro update
            };
            
            this.projectiles.push(projectile);
        }
        
        return body;
    }

    // Lança um projétil em direção ao jogador (calcula direção)
    launchProjectile(projectile) {
        if (!this.player) return;
        
        // Calcula direção para o jogador
        const dx = this.player.x - projectile.sprite.x;
        const dy = this.player.y - projectile.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Armazena velocidade normalizada
        projectile.vx = (dx / distance) * projectile.speed;
        projectile.vy = (dy / distance) * projectile.speed;
    }

    // Respawna projétil na posição original
    respawnProjectile(projectile) {
        projectile.waiting = true;
        
        // Volta para posição inicial
        projectile.sprite.x = projectile.spawnX;
        projectile.sprite.y = projectile.spawnY;
        
        // Move hitbox junto
        this.matter.body.setPosition(projectile.body, {
            x: projectile.spawnX,
            y: projectile.spawnY
        });
        
        // Delay antes de relançar
        this.time.delayedCall(1000, () => {
            projectile.waiting = false;
            projectile.launched = false;
        });
    }

    // Cria um inimigo com hitboxes e comportamentos especiais
    createEnemy(obj, centerX, centerY, config) {
        if (!this.enemies) this.enemies = [];
        
        const sprite = this.objectSprites[this.objectSprites.length - 1];
        
        // Dimensões do inimigo
        const width = obj.width;
        const height = obj.height;
        
        // Hitbox da cabeça (pisável) - parte superior
        const headHeight = height * 0.3;
        const headY = centerY - (height / 2) + (headHeight / 2);
        const headBody = this.matter.add.rectangle(centerX, headY, width * 0.8, headHeight, {
            isStatic: true,
            isSensor: true,
            label: 'enemy_head'
        });
        
        // Hitbox do corpo (dano) - parte inferior e laterais
        const bodyHeight = height * 0.7;
        const bodyY = centerY + (height / 2) - (bodyHeight / 2);
        const bodyBody = this.matter.add.rectangle(centerX, bodyY, width * 0.9, bodyHeight, {
            isStatic: true,
            isSensor: true,
            label: 'enemy_body'
        });
        
        const enemy = {
            sprite: sprite,
            headBody: headBody,
            bodyBody: bodyBody,
            spawnX: centerX,
            spawnY: centerY,
            config: config,
            phase: Math.random() * Math.PI * 2, // Fase inicial aleatória
            alive: true,
            stunned: false,
            stunnedUntil: 0,
            lastShot: 0,
            balls: [] // Bolas lançadas por este inimigo
        };
        
        this.enemies.push(enemy);
        
        console.log(`    ↳ Inimigo criado: cabeça pisável + corpo com dano${config.shootsBalls ? ' + lança bolas' : ''}`);
    }

    // Atualiza todos os inimigos
    updateEnemies() {
        if (!this.enemies) return;
        
        const time = this.time.now / 1000; // Tempo em segundos
        const now = this.time.now;
        
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            
            // Verifica se saiu do atordoamento
            if (enemy.stunned && now > enemy.stunnedUntil) {
                enemy.stunned = false;
                enemy.sprite.setTint(0xffffff); // Remove tint
                enemy.lastShot = now; // Aguarda antes de lançar novamente
                enemy.nextShotInterval = 500; // Espera 0.5s após recuperar
            }
            
            // Movimento de oscilação vertical (mais lento se atordoado)
            if (enemy.config.oscillate) {
                const speed = enemy.stunned ? enemy.config.oscillateSpeed * 0.3 : enemy.config.oscillateSpeed;
                const offset = Math.sin(time * speed + enemy.phase) * enemy.config.oscillateRange;
                const newY = enemy.spawnY + offset;
                
                // Move sprite
                enemy.sprite.y = newY;
                
                // Move hitboxes junto
                const headOffset = -(enemy.sprite.displayHeight / 2) + (enemy.sprite.displayHeight * 0.15);
                const bodyOffset = (enemy.sprite.displayHeight / 2) - (enemy.sprite.displayHeight * 0.35);
                
                this.matter.body.setPosition(enemy.headBody, { 
                    x: enemy.sprite.x, 
                    y: newY + headOffset 
                });
                this.matter.body.setPosition(enemy.bodyBody, { 
                    x: enemy.sprite.x, 
                    y: newY + bodyOffset 
                });
            }
            
            // Lança bolas periodicamente (se não estiver atordoado)
            if (enemy.config.shootsBalls && !enemy.stunned) {
                // Calcula intervalo com variação aleatória
                const baseInterval = enemy.config.shootInterval;
                const variation = enemy.config.shootVariation || 0;
                const randomFactor = 1 + (Math.random() * 2 - 1) * variation; // Entre (1-var) e (1+var)
                const interval = enemy.nextShotInterval || baseInterval;
                
                if (now - enemy.lastShot > interval) {
                    this.enemyShootBall(enemy);
                    enemy.lastShot = now;
                    // Calcula próximo intervalo com variação
                    enemy.nextShotInterval = baseInterval * randomFactor;
                }
            }
            
            // Atualiza bolas lançadas por este inimigo
            this.updateEnemyBalls(enemy);
        });
    }

    // Inimigo lança uma bola
    enemyShootBall(enemy) {
        if (!this.player) return;
        
        // Posição de lançamento (um pouco acima da foca)
        const startX = enemy.sprite.x;
        const startY = enemy.sprite.y - enemy.sprite.displayHeight * 0.3;
        
        // Cria sprite da bola
        const ball = this.add.sprite(startX, startY, 'bola', 0);
        
        // Animação da bola
        const animKey = 'bola_anim';
        if (!this.anims.exists(animKey)) {
            this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers('bola', { start: 0, end: 1 }),
                frameRate: 8,
                repeat: -1
            });
        }
        ball.play(animKey);
        
        // Calcula direção para o jogador
        const dx = this.player.x - startX;
        const dy = this.player.y - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const speed = 2.5;
        const ballData = {
            sprite: ball,
            vx: (dx / distance) * speed,
            vy: (dy / distance) * speed,
            body: this.matter.add.circle(startX, startY, 20, {
                isStatic: true,
                isSensor: true,
                label: 'bola'
            })
        };
        
        enemy.balls.push(ballData);
    }

    // Atualiza bolas de um inimigo
    updateEnemyBalls(enemy) {
        const margin = 100;
        
        for (let i = enemy.balls.length - 1; i >= 0; i--) {
            const ball = enemy.balls[i];
            
            // Move a bola
            ball.sprite.x += ball.vx;
            ball.sprite.y += ball.vy;
            ball.sprite.rotation += 0.15;
            
            // Move hitbox junto
            this.matter.body.setPosition(ball.body, {
                x: ball.sprite.x,
                y: ball.sprite.y
            });
            
            // Remove se saiu da tela
            const outOfBounds = 
                ball.sprite.x < -margin || 
                ball.sprite.x > this.mapWidth + margin || 
                ball.sprite.y < -margin || 
                ball.sprite.y > this.mapHeight + margin;
            
            if (outOfBounds) {
                ball.sprite.destroy();
                this.matter.world.remove(ball.body);
                enemy.balls.splice(i, 1);
            }
        }
    }

    // Jogador pisou na cabeça de um inimigo
    onEnemyStomp(enemy) {
        if (!enemy.alive || enemy.stunned) return;
        
        // Atordoa o inimigo
        enemy.stunned = true;
        enemy.stunnedUntil = this.time.now + (enemy.config.stunDuration || 1500);
        
        // Efeito visual - esmaga temporariamente
        enemy.sprite.setTint(0xffff00); // Fica amarelo
        
        this.tweens.add({
            targets: enemy.sprite,
            scaleY: 0.6,
            duration: 100,
            ease: 'Power2',
            yoyo: true,
            onComplete: () => {
                // Volta ao normal após o "squash"
                enemy.sprite.scaleY = 1;
            }
        });
        
        // Pequeno pulo ao pisar
        this.player.setVelocityY(-8);
        
        console.log('Inimigo atordoado!');
    }

    // Verifica se a colisão é do jogador com uma superfície abaixo dele
    isPlayerTouchingGround(pair) {
        const playerBody = this.player?.body;
        if (!playerBody) return false;

        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // Verifica se o jogador está envolvido
        const isPlayerInvolved = bodyA === playerBody || bodyB === playerBody;
        if (!isPlayerInvolved) return false;

        const otherBody = bodyA === playerBody ? bodyB : bodyA;

        // Ignora sensores (como projéteis)
        if (otherBody.isSensor) return false;
        
        // Ignora bolas
        if (otherBody.label === 'bola') return false;

        // Verifica se a colisão é por baixo do jogador
        // O jogador está "no chão" se o ponto de contato está abaixo do centro dele
        const playerCenterY = playerBody.position.y;
        const contactY = pair.collision.supports[0]?.y || otherBody.position.y;
        
        return contactY > playerCenterY;
    }

    // Jogador foi atingido por um projétil
    onPlayerHit() {
        if (this.isRespawning) return; // Evita múltiplos hits
        
        this.isRespawning = true;
        
        // Desativa controles temporariamente
        this.player.setStatic(true);
        
        // Efeito visual - pisca vermelho
        this.player.setTint(0xff0000);
        
        // Calcula arco de arremesso para o spawn
        const startX = this.player.x;
        const startY = this.player.y;
        const endX = this.spawnX;
        const endY = this.spawnY;
        
        // Altura do arco (quanto mais longe, mais alto)
        const distance = Math.abs(endX - startX);
        const arcHeight = Math.min(150, distance * 0.3);
        
        // Animação de arremesso em arco
        const duration = 800;
        
        this.tweens.add({
            targets: this.player,
            x: endX,
            y: endY,
            duration: duration,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
                // Calcula posição Y com arco parabólico
                const progress = tween.progress;
                const arcOffset = Math.sin(progress * Math.PI) * arcHeight;
                this.player.y = Phaser.Math.Linear(startY, endY, progress) - arcOffset;
                
                // Gira o jogador durante o arremesso
                this.player.rotation += 0.2;
            },
            onComplete: () => {
                // Restaura jogador
                this.player.rotation = 0;
                this.player.setStatic(false);
                this.player.setTint(0xffffff); // Remove tint vermelho
                
                // Pequena invencibilidade após respawn
                this.time.delayedCall(500, () => {
                    this.isRespawning = false;
                });
                
                // Pisca o jogador para indicar invencibilidade
                this.tweens.add({
                    targets: this.player,
                    alpha: 0.3,
                    duration: 100,
                    yoyo: true,
                    repeat: 4
                });
            }
        });
    }

    // Atualiza todos os projéteis (movimento manual)
    updateProjectiles() {
        if (!this.projectiles || !this.player) return;
        
        const margin = 50;
        
        this.projectiles.forEach(proj => {
            if (proj.waiting) return;
            
            // Lança se ainda não foi lançado
            if (!proj.launched) {
                this.launchProjectile(proj);
                proj.launched = true;
            }
            
            // Move sprite manualmente (sem física)
            if (proj.sprite && proj.vx !== undefined) {
                proj.sprite.x += proj.vx;
                proj.sprite.y += proj.vy;
                proj.sprite.rotation += 0.15; // Gira enquanto voa
                
                // Move hitbox junto com sprite
                this.matter.body.setPosition(proj.body, {
                    x: proj.sprite.x,
                    y: proj.sprite.y
                });
            }
            
            // Respawna se saiu da tela
            if (proj.respawn && proj.sprite) {
                const x = proj.sprite.x;
                const y = proj.sprite.y;
                
                const outOfBounds = 
                    x < -margin || 
                    x > this.mapWidth + margin || 
                    y < -margin || 
                    y > this.mapHeight + margin;
                
                if (outOfBounds) {
                    this.respawnProjectile(proj);
                }
            }
        });
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

        // Pulo - só funciona no chão (exceto em fases com canFly)
        this.jumpCooldown -= delta;
        
        const canJump = this.canFly || this.isOnGround;
        
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && canJump && this.jumpCooldown <= 0) {
            this.player.setVelocityY(-jumpForce);
            this.jumpCooldown = this.canFly ? 200 : 100; // Cooldown menor no modo nado
            this.isOnGround = false; // Sai do chão ao pular
        }

        // === ATUALIZA PROJÉTEIS E INIMIGOS ===
        this.updateProjectiles();
        this.updateEnemies();

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
