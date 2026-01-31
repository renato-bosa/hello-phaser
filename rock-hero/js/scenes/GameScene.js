/**
 * GAME SCENE - Cena Principal do Jogo
 * 
 * Responsabilidades:
 * - Gameplay (movimento, física, colisões)
 * - HUD (timer, estrelas)
 * - Overlays (pause, vitória, ranking)
 */

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }
    
    init(data) {
        // Dados do jogador (vindos do menu ou do estado global)
        this.currentLevel = data.level ?? GameData.state.currentLevel ?? 0;
        this.playerName = data.playerName ?? GameData.state.playerName ?? 'Anônimo';
        
        // Atualiza estado global
        GameData.state.currentLevel = this.currentLevel;
        GameData.state.playerName = this.playerName;
        GameData.state.gameSceneRef = this;
    }

    preload() {
        // ========== CARREGAMENTO AUTOMÁTICO DE TILESETS ==========
        // Configura callback para carregar tilesets quando cada mapa JSON terminar de carregar
        this.setupTilesetAutoLoader();
        
        // Carrega todos os mapas (os tilesets serão carregados automaticamente via callback)
        GameData.LEVELS.forEach(level => {
            this.load.tilemapTiledJSON(level.key, level.file);
        });

        // ========== SPRITESHEETS DE GAMEPLAY ==========
        this.load.spritesheet('star', 'assets/spritesheets/yellow-star-animated.png', {
            frameWidth: 32, frameHeight: 32
        });
        
        // Carrega sprites de TODOS os personagens (definição centralizada em GameData)
        GameData.loadCharacterSprites(this);
        
        // ========== INIMIGOS ==========
        // Sapo-tomate (6 frames de animação de pulo)
        this.load.spritesheet('sapo-tomate', 'assets/spritesheets/sapo-tomate-6fps.png', {
            frameWidth: 32, frameHeight: 32
        });
        // Sapo-verde (6 frames - só pula, não anda)
        this.load.spritesheet('sapo-verde', 'assets/spritesheets/sapo-verde-6fps.png', {
            frameWidth: 32, frameHeight: 32
        });
    }

    /**
     * Configura o carregamento automático de tilesets usando eventos do Phaser Loader
     * Quando cada mapa JSON termina de carregar, extrai os tilesets e adiciona à fila
     * (substitui XMLHttpRequest síncrono - método deprecado)
     */
    setupTilesetAutoLoader() {
        // Set para evitar carregar o mesmo tileset múltiplas vezes
        const loadedTilesets = new Set();
        
        // Aliases: nome usado no código → nome no tileset do Tiled
        const TILESET_ALIASES = {
            'trampoline-thick': 'trampoline',
        };
        
        // Callback executado quando qualquer arquivo termina de carregar
        // Usamos 'filecomplete' genérico e filtramos por tipo
        this.load.on('filecomplete', (key, type, data) => {
            // Só processa arquivos de tilemap JSON
            if (type !== 'tilemapJSON') return;
            
            // Acessa os dados do tilemap do cache do Phaser
            const tilemapData = this.cache.tilemap.get(key);
            if (!tilemapData || !tilemapData.data || !tilemapData.data.tilesets) return;
            
            tilemapData.data.tilesets.forEach(ts => {
                const tilesetName = ts.name;
                
                // Evita carregar o mesmo tileset múltiplas vezes
                if (loadedTilesets.has(tilesetName)) return;
                loadedTilesets.add(tilesetName);
                
                // Extrai o nome do arquivo da imagem (caminho relativo no JSON)
                if (ts.image) {
                    // Converte "spritesheets/nome.png" → "assets/spritesheets/nome.png"
                    const imagePath = 'assets/' + ts.image.replace(/\\/g, '/');
                    
                    // Adiciona à fila de carregamento (Phaser adiciona automaticamente durante preload)
                    this.load.image(tilesetName, imagePath);
                    
                    // Se existe um alias, carrega também com o nome alternativo
                    if (TILESET_ALIASES[tilesetName]) {
                        this.load.image(TILESET_ALIASES[tilesetName], imagePath);
                    }
                }
            });
        });
    }

    create() {
        // Estado da cena
        this.currentView = 'countdown'; // 'countdown', 'gameplay', 'paused', 'victory', 'ranking'
        this.hasWon = false;
        this.overlayElements = [];
        this.keyListeners = [];

        // Cria o jogo
        this.createMap();
        this.createPlayer();
        this.createAnimations();
        this.createHUD();
        this.setupControls();
        this.setupPhysics();

        // Timer (será iniciado após o countdown)
        this.levelStartTime = null;
        this.elapsedTime = 0;
        this.pausedAtTime = null; // Marca quando pausou para compensar

        // Game feel
        this.coyoteTime = 0;
        this.jumpBufferTime = 0;
        this.isJumping = false;
        this.currentSpeed = 160;
        this.lastDirection = 0;
        this.isRespawning = false;

        // Inicia countdown apenas na primeira fase
        if (this.currentLevel === 0) {
            this.startCountdown();
        } else {
            this.currentView = 'gameplay';
        }
    }

    startCountdown() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Estilo do texto de countdown
        const countdownStyle = {
            fontSize: '72px',
            fontFamily: 'Arial Black, Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        };

        // Cria texto de countdown
        const countdownText = this.add.text(centerX, centerY, '3', countdownStyle)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(300)
            .setScale(0);

        // Função para animar cada número
        const animateNumber = (text, callback) => {
            this.tweens.add({
                targets: countdownText,
                scale: { from: 0, to: 1.2 },
                duration: 200,
                ease: 'Back.easeOut',
                onStart: () => {
                    countdownText.setText(text);
                    countdownText.setColor('#ffffff');
                },
                onComplete: () => {
                    this.tweens.add({
                        targets: countdownText,
                        scale: 0.9,
                        alpha: 0.7,
                        duration: 600,
                        onComplete: callback
                    });
                }
            });
        };

        // Sequência: 3 -> 2 -> 1 -> GO!
        SoundManager.play('countdownTick');
        animateNumber('3', () => {
            SoundManager.play('countdownTick');
            animateNumber('2', () => {
                SoundManager.play('countdownTick');
                animateNumber('1', () => {
                    // GO! - libera controle imediatamente
                    this.currentView = 'gameplay';
                    SoundManager.play('countdownGo');
                    this.tweens.add({
                        targets: countdownText,
                        scale: { from: 0, to: 1.5 },
                        duration: 300,
                        ease: 'Back.easeOut',
                        onStart: () => {
                            countdownText.setText('GO!');
                            countdownText.setColor('#00ff00');
                            countdownText.setAlpha(1);
                        },
                        onComplete: () => {
                            this.tweens.add({
                                targets: countdownText,
                                scale: 2,
                                alpha: 0,
                                duration: 400,
                                onComplete: () => {
                                    countdownText.destroy();
                                }
                            });
                        }
                    });
                });
            });
        });
    }

    // ==================== CRIAÇÃO DO MAPA ====================

    createMap() {
        const levelConfig = GameData.LEVELS[this.currentLevel];
        
        // Mostra nome da fase
        this.showLevelName(levelConfig.name);

        // Cria tilemap
        const map = this.make.tilemap({ key: levelConfig.key });

        // Adiciona TODOS os tilesets do mapa (evita problemas com tilesets duplicados)
        const allTilesets = [];
        const addedNames = new Set();
        
        map.tilesets.forEach((ts, index) => {
            // Usa índice para criar nome único quando há duplicatas
            const uniqueKey = addedNames.has(ts.name) ? `${ts.name}_${index}` : ts.name;
            addedNames.add(ts.name);
            
            // Tenta carregar a imagem com o nome original do tileset
            const tileset = map.addTilesetImage(ts.name, ts.name, undefined, undefined, undefined, undefined, ts.firstgid);
            if (tileset) {
                allTilesets.push(tileset);
            }
        });

        // Camadas - usa todos os tilesets para garantir renderização correta
        this.bgLayer = map.createLayer('bg', allTilesets);
        // Animações automáticas no bg (se houver tiles com propriedades fps/frames_random)
        this.setupAutoTileAnimations(map, this.bgLayer);
        
        // Camada de decoração de background (se existir)
        const bgDecoLayer = map.getLayer('bg_decoration');
        if (bgDecoLayer) {
            this.bgDecorationLayer = map.createLayer('bg_decoration', allTilesets);
            // Animações automáticas baseadas em propriedades do Tiled (fps, frames_random)
            this.setupAutoTileAnimations(map, this.bgDecorationLayer);
            // Fallback: animação hardcoded para lava-bubbles (caso não tenha propriedades)
            const lavaBubblesTileset = map.tilesets.find(ts => ts.name === 'lava-bubbles-4fps');
            if (lavaBubblesTileset && !this.getTilesetProperties(lavaBubblesTileset).fps) {
                this.setupLavaBubblesAnimation(this.bgDecorationLayer, lavaBubblesTileset);
            }
        }
        
        this.solidsLayer = map.createLayer('solids', allTilesets);
        
        // ========== COLISÃO AUTOMÁTICA NA CAMADA 'solids' ==========
        // Primeiro: aplica colisão por propriedade (tiles com collider: true no Tiled)
        this.solidsLayer.setCollisionByProperty({ collider: true });
        
        // Segundo: aplica colisão em TODOS os tiles não-vazios da camada 'solids'
        // Isso garante que qualquer tile na camada 'solids' terá colisão
        this.solidsLayer.setCollisionByExclusion([-1, 0]);
        
        // Camada de decoração de foreground (se existir)
        const fgDecoLayer = map.getLayer('fg_decoration');
        if (fgDecoLayer) {
            this.fgDecorationLayer = map.createLayer('fg_decoration', allTilesets);
            this.fgDecorationLayer.setDepth(5); // Acima dos sólidos, mas atrás do jogador
        }

        // Animação de tiles
        const lavaAnimatedTileset = map.tilesets.find(ts => ts.name === 'lava-roxa-animated');
        if (lavaAnimatedTileset) {
            this.setupTileAnimations(this.solidsLayer, lavaAnimatedTileset);
        }

        // Objetos do mapa
        this.parseMapObjects(map);

        // Câmera
        this.setupCamera(map, levelConfig);
    }

    parseMapObjects(map) {
        const objectsLayer = map.getObjectLayer('objects');
        
        this.playerSpawn = { x: 100, y: 100 };
        this.goalPosition = { x: 500, y: 100 };
        this.checkpointPositions = [];
        const trampolines = [];
        const stars = [];
        const enemies = [];
        const speedBoosts = [];

        // ========== DETECÇÃO AUTOMÁTICA DE TIPOS ==========
        // Monta um mapa de gid → nome do tileset para detecção automática
        const gidToTilesetName = {};
        map.tilesets.forEach(ts => {
            // Para cada tile do tileset, mapeia o gid para o nome
            for (let i = 0; i < ts.total; i++) {
                gidToTilesetName[ts.firstgid + i] = ts.name.toLowerCase();
            }
        });

        objectsLayer.objects.forEach(obj => {
            // Primeiro: verifica se tem type definido manualmente nas propriedades
            const type = obj.properties?.find(p => p.name === 'type')?.value;
            
            // Segundo: detecta automaticamente pelo nome do tileset
            const tilesetName = gidToTilesetName[obj.gid] || '';
            
            // ========== PLAYER SPAWN ==========
            // Detecta automaticamente: still-hero, still-hero (2), hero, etc
            if (type === 'player_spawn' || type === 'player-spawn' ||
                tilesetName.includes('still-hero') || tilesetName.includes('still hero')) {
                this.playerSpawn = { x: obj.x + 16, y: obj.y - 16 };
            }
            // ========== GOAL (Bandeira Verde) ==========
            // Detecta automaticamente: green-flag, green flag, etc
            else if (type === 'goal' || 
                     tilesetName.includes('green-flag') || tilesetName.includes('green flag')) {
                this.goalPosition = { x: obj.x + 16, y: obj.y - 16 };
            }
            // ========== CHECKPOINT (Bandeira Amarela) ==========
            else if (type === 'checkpoint' ||
                     tilesetName.includes('yellow-flag') || tilesetName.includes('yellow flag')) {
                this.checkpointPositions.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            // ========== TRAMPOLIM ==========
            else if (type === 'trampoline' ||
                     tilesetName.includes('trampoline')) {
                trampolines.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            // ========== ESTRELAS ==========
            else if (type === 'star' ||
                     tilesetName.includes('star') || tilesetName.includes('estrela')) {
                stars.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            // ========== INIMIGOS (Sapos) ==========
            else if (type === 'enemy' || type === 'sapo' ||
                     tilesetName.includes('sapo') || tilesetName.includes('frog')) {
                // Diferencia sapo-verde (só pula) do sapo-tomate (anda e pula)
                const isSapoVerde = tilesetName.includes('sapo-verde') || tilesetName.includes('verde');
                enemies.push({ 
                    x: obj.x + 16, 
                    y: obj.y - 16,
                    type: isSapoVerde ? 'sapo-verde' : 'sapo'
                });
            }
            // ========== SETAS DE VELOCIDADE (Speed Boost) ==========
            else if (type === 'speed_boost' || type === 'boost' ||
                     tilesetName.includes('setas') || tilesetName.includes('velocidade') ||
                     tilesetName.includes('speed') || tilesetName.includes('boost')) {
                speedBoosts.push({ x: obj.x + 16, y: obj.y - 16 });
            }
        });

        this.currentCheckpoint = this.playerSpawn;

        // Cria objetos do jogo
        this.createGoal();
        this.createCheckpoints();
        this.createTrampolines(trampolines);
        this.createStars(stars);
        this.createEnemies(enemies);
        this.createSpeedBoosts(speedBoosts);
    }

    createGoal() {
        this.goal = this.physics.add.staticSprite(this.goalPosition.x, this.goalPosition.y, 'green-flag');
        this.goal.body.setSize(14, 28);
        this.goal.body.setOffset(10, 4);
    }

    createCheckpoints() {
        this.checkpoints = [];
        this.checkpointPositions.forEach(cp => {
            const flag = this.physics.add.staticSprite(cp.x, cp.y, 'yellow-flag');
            flag.checkpointPos = cp;
            flag.activated = false;
            this.checkpoints.push(flag);
        });
    }

    createTrampolines(positions) {
        this.trampolines = this.physics.add.staticGroup();
        positions.forEach(t => {
            const trampoline = this.physics.add.staticSprite(t.x, t.y, 'trampoline');
            trampoline.body.setSize(32, 5);
            trampoline.body.setOffset(0, 27);
            this.trampolines.add(trampoline);
        });
    }
        
    createStars(positions) {
        this.stars = this.physics.add.group();
        positions.forEach(s => {
            const star = this.stars.create(s.x, s.y, 'star');
            star.body.allowGravity = false;
        });
        this.starsCollected = 0;
        this.totalStars = positions.length;
    }

    // ========== INIMIGOS ==========
    
    createEnemies(enemies) {
        this.enemies = this.physics.add.group();
        
        enemies.forEach(e => {
            if (e.type === 'sapo-verde') {
                this.createSapoVerde(e.x, e.y);
            } else if (e.type === 'sapo') {
                this.createSapo(e.x, e.y);
            }
        });
    }

    createSapo(x, y) {
        const sapo = this.physics.add.sprite(x, y, 'sapo-tomate');
        
        // Configuração física
        // Hitbox cobre mais a parte superior para facilitar pular em cima
        sapo.body.setSize(26, 32);
        sapo.body.setOffset(3, 0);
        sapo.body.allowGravity = true;
        sapo.body.setCollideWorldBounds(true);
        
        // Configuração de patrulha
        // 3 blocos para cada lado = 96px (32px * 3)
        const PATROL_DISTANCE = 96;
        const SPEED = 60;
        const JUMP_DISTANCE = 32; // Pula a cada bloco
        const JUMP_FORCE = -180; // Força do pulo (pequeno pulo)
        
        sapo.patrolData = {
            startX: x,
            leftLimit: x - PATROL_DISTANCE,
            rightLimit: x + PATROL_DISTANCE,
            speed: SPEED,
            direction: 1, // 1 = direita, -1 = esquerda
            lastJumpX: x, // Última posição onde pulou
            jumpDistance: JUMP_DISTANCE,
            jumpForce: JUMP_FORCE
        };
        
        // Inicia movimento
        sapo.setVelocityX(sapo.patrolData.speed * sapo.patrolData.direction);
        
        // Animação
        if (!this.anims.exists('sapo-walk')) {
            this.anims.create({
                key: 'sapo-walk',
                frames: this.anims.generateFrameNumbers('sapo-tomate', { start: 0, end: 5 }),
                frameRate: 6,
                repeat: -1
            });
        }
        sapo.anims.play('sapo-walk', true);
        
        this.enemies.add(sapo);
    }

    /**
     * Cria um sapo verde - fica parado e só pula (3-4 blocos de altura)
     */
    createSapoVerde(x, y) {
        const sapo = this.physics.add.sprite(x, y, 'sapo-verde');
        
        // Hitbox igual ao sapo-tomate
        sapo.body.setSize(26, 32);
        sapo.body.setOffset(3, 0);
        sapo.body.allowGravity = true;
        sapo.body.setCollideWorldBounds(true);
        
        // Configuração de pulo (sem patrulha - fica parado)
        // Pulo de 3-4 blocos = 96-128px
        // Força calculada: v = sqrt(2 * g * h) ≈ -420 para ~3.5 blocos
        const JUMP_FORCE = -420;
        const JUMP_INTERVAL = 1500; // Pula a cada 1.5 segundos
        
        sapo.patrolData = {
            type: 'sapo-verde',
            startX: x,
            startY: y,
            speed: 0, // Não anda
            direction: 1,
            jumpForce: JUMP_FORCE,
            jumpInterval: JUMP_INTERVAL,
            lastJumpTime: 0
        };
        
        // Animação
        if (!this.anims.exists('sapo-verde-idle')) {
            this.anims.create({
                key: 'sapo-verde-idle',
                frames: this.anims.generateFrameNumbers('sapo-verde', { start: 0, end: 5 }),
                frameRate: 6,
                repeat: -1
            });
        }
        sapo.anims.play('sapo-verde-idle', true);
        
        this.enemies.add(sapo);
    }

    updateEnemies() {
        if (!this.enemies) return;
        
        const currentTime = this.time.now;
        
        this.enemies.children.iterate(enemy => {
            if (!enemy || !enemy.active || !enemy.patrolData) return;
            
            const data = enemy.patrolData;
            const onGround = enemy.body.blocked.down;
            
            // ========== SAPO VERDE (fica parado, só pula) ==========
            if (data.type === 'sapo-verde') {
                // Pula baseado em intervalo de tempo
                if (onGround && currentTime - data.lastJumpTime >= data.jumpInterval) {
                    enemy.setVelocityY(data.jumpForce);
                    data.lastJumpTime = currentTime;
                }
                // Mantém parado horizontalmente
                enemy.setVelocityX(0);
                
                // Vira para a direção do jogador
                if (this.player && this.player.active) {
                    enemy.setFlipX(this.player.x < enemy.x);
                }
                return;
            }
            
            // ========== SAPO TOMATE (patrulha + pula) ==========
            // Pula a cada bloco (32px)
            const distanceFromLastJump = Math.abs(enemy.x - data.lastJumpX);
            if (distanceFromLastJump >= data.jumpDistance && onGround) {
                enemy.setVelocityY(data.jumpForce);
                data.lastJumpX = enemy.x;
            }
            
            // Limites do mapa (margem de 16px para não encostar na borda)
            const mapLeftEdge = 16;
            const mapRightEdge = this.map ? this.map.widthInPixels - 16 : 9999;
            
            // Detecta colisão com parede ou borda do mapa
            const hitRightWall = enemy.body.blocked.right || enemy.x >= mapRightEdge;
            const hitLeftWall = enemy.body.blocked.left || enemy.x <= mapLeftEdge;
            
            if (hitRightWall && data.direction === 1) {
                // Bateu na parede/borda à direita, vira para esquerda
                data.direction = -1;
                enemy.setVelocityX(data.speed * data.direction);
                enemy.setFlipX(true);
                // Atualiza limite para não tentar voltar para a parede
                data.rightLimit = Math.min(data.rightLimit, enemy.x - 16);
            } else if (hitLeftWall && data.direction === -1) {
                // Bateu na parede/borda à esquerda, vira para direita
                data.direction = 1;
                enemy.setVelocityX(data.speed * data.direction);
                enemy.setFlipX(false);
                // Atualiza limite para não tentar voltar para a parede
                data.leftLimit = Math.max(data.leftLimit, enemy.x + 16);
            }
            // Verifica se atingiu os limites normais da patrulha
            else if (enemy.x >= data.rightLimit && data.direction === 1) {
                // Chegou no limite direito, vira para esquerda
                data.direction = -1;
                enemy.setVelocityX(data.speed * data.direction);
                enemy.setFlipX(true);
            } else if (enemy.x <= data.leftLimit && data.direction === -1) {
                // Chegou no limite esquerdo, vira para direita
                data.direction = 1;
                enemy.setVelocityX(data.speed * data.direction);
                enemy.setFlipX(false);
            }
            
            // Garante que está andando
            if (Math.abs(enemy.body.velocity.x) < data.speed * 0.5 && onGround) {
                enemy.setVelocityX(data.speed * data.direction);
            }
        });
    }

    handleEnemyCollision(player, enemy) {
        if (!enemy || !enemy.active) return;
        
        // Verifica se o jogador está caindo de cima do inimigo
        // Condições: jogador descendo (velocityY > 0) E pés do jogador acima do centro do inimigo
        const playerBottom = player.body.bottom;
        const enemyCenter = enemy.body.center.y;
        const isStomping = player.body.velocity.y > 0 && playerBottom <= enemyCenter + 8;
        
        if (isStomping) {
            // Elimina o inimigo
            this.killEnemy(enemy);
            // Impulso para cima no jogador (quique satisfatório)
            player.setVelocityY(-400);
        } else if (!this.isRespawning) {
            // Jogador encosta no inimigo pelo lado = dano
            SoundManager.play('death');
            this.respawnAtCheckpoint();
        }
    }

    killEnemy(enemy) {
        // Efeito visual de morte
        this.tweens.add({
            targets: enemy,
            scaleY: 0.2,
            scaleX: 1.3,
            alpha: 0,
            y: enemy.y + 16,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                enemy.destroy();
            }
        });
        
        // Desativa colisão imediatamente
        enemy.body.enable = false;
        
        // Som de eliminar inimigo
        SoundManager.play('damage');
    }

    // ========== SETAS DE VELOCIDADE ==========
    
    createSpeedBoosts(positions) {
        this.speedBoosts = this.physics.add.staticGroup();
        
        positions.forEach(pos => {
            const boost = this.physics.add.staticSprite(pos.x, pos.y, 'setas-velocidade');
            boost.body.setSize(32, 16);
            boost.body.setOffset(0, 8);
            boost.setAlpha(0.9);
            this.speedBoosts.add(boost);
        });
    }

    handleSpeedBoost(player, boost) {
        // Só ativa se este boost específico não foi usado recentemente (cooldown de 300ms)
        if (boost.lastUsed && this.time.now - boost.lastUsed < 300) return;
        boost.lastUsed = this.time.now;
        
        // Configuração do boost
        const BOOST_DURATION = 500; // 0,5 segundos
        const BOOST_SPEED = 1000; // Velocidade fixa durante o boost
        
        // Ativa/estende o boost (sem interrupção se já está ativo)
        this.speedBoostActive = true;
        this.speedBoostSpeed = BOOST_SPEED;
        this.speedBoostEndTime = this.time.now + BOOST_DURATION;
        
        // Aplica velocidade imediatamente na direção que o jogador está olhando
        const direction = player.flipX ? -1 : 1;
        player.setVelocityX(direction * BOOST_SPEED);
        
        // Efeito visual no jogador (tint amarelo)
        player.setTint(0xffff00);
        
        // Cancela timer anterior se existir
        if (this.speedBoostTimer) {
            this.speedBoostTimer.remove();
        }
        
        // Cria novo timer para remover o boost
        this.speedBoostTimer = this.time.delayedCall(BOOST_DURATION, () => {
            this.speedBoostActive = false;
            this.speedBoostSpeed = 0;
            player.clearTint();
            this.speedBoostTimer = null;
        });
        
        // Efeito visual no objeto de boost
        this.tweens.add({
            targets: boost,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 2,
            onComplete: () => boost.setAlpha(0.9)
        });
        
        // Som de aceleração
        SoundManager.play('speedBoost');
    }

    cancelSpeedBoost() {
        if (!this.speedBoostActive) return;
        
        this.speedBoostActive = false;
        this.speedBoostSpeed = 0;
        this.player.clearTint();
        
        // Cancela o timer se existir
        if (this.speedBoostTimer) {
            this.speedBoostTimer.remove();
            this.speedBoostTimer = null;
        }
    }

    setupCamera(map, levelConfig) {
        const zoom = levelConfig.zoom ?? GameData.DEFAULTS.zoom;
        const roundPixels = levelConfig.roundPixels ?? GameData.DEFAULTS.roundPixels;

        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setZoom(zoom);
        this.cameras.main.setRoundPixels(roundPixels);
        
        // Filtro de texturas para sprites de personagens
        // zoom < 1: LINEAR para suavizar o downscaling
        // zoom >= 1: NEAREST para pixel art nítido
        if (zoom < 1) {
            GameData.applyLinearFilter(this);
        } else {
            GameData.applyPixelArtFilter(this);
        }
    }

    setupTileAnimations(layer, tileset) {
        if (!tileset) return;
        
        const firstGid = tileset.firstgid;
        let currentFrame = 0;
        
        this.time.addEvent({
            delay: 200,
            loop: true,
            callback: () => {
                currentFrame = (currentFrame + 1) % 4;
                layer.forEachTile(tile => {
                    if (tile.index >= firstGid && tile.index < firstGid + 4) {
                        tile.index = firstGid + currentFrame;
                    }
                });
            }
        });
    }

    setupLavaBubblesAnimation(layer, tileset) {
        if (!tileset || !layer) return;

        const firstGid = tileset.firstgid;
        let currentFrame = 0;

        this.time.addEvent({
            delay: 250, // 4 fps = 250ms por frame
            loop: true,
            callback: () => {
                currentFrame = (currentFrame + 1) % 4;
                layer.forEachTile(tile => {
                    if (tile.index >= firstGid && tile.index < firstGid + 4) {
                        tile.index = firstGid + currentFrame;
                    }
                });
            }
        });
    }

    /**
     * Configura animações automáticas para tiles baseado em propriedades do Tiled
     * 
     * Propriedades do tileset no Tiled:
     * - fps: int - frames por segundo (0 = sem animação)
     * - frames_random: int - range de offset aleatório por tile (0 = todos sincronizados)
     * 
     * Exemplo: fps=8, frames_random=12 → anima a 8fps com offset aleatório de 0-11 frames
     */
    setupAutoTileAnimations(map, layer) {
        if (!layer) return;

        // Agrupa tilesets por fps para otimizar (um timer por fps)
        const animationsByFps = new Map();

        // Acessa os dados raw do JSON do mapa (Phaser não expõe properties diretamente)
        const levelConfig = GameData.LEVELS[GameData.state.currentLevel];
        const mapKey = levelConfig ? levelConfig.key : 'map1';
        const rawMapData = this.cache.tilemap.get(mapKey);
        const rawTilesets = rawMapData?.data?.tilesets || [];

        // Varre todos os tilesets do mapa procurando propriedades de animação
        map.tilesets.forEach((tileset, index) => {
            // Busca os dados raw do tileset correspondente
            const rawTileset = rawTilesets.find(ts => ts.name === tileset.name) || rawTilesets[index];
            
            // Lê propriedades do tileset (do JSON raw)
            const props = this.getTilesetProperties(rawTileset || tileset);
            const fps = props.fps || 0;
            const framesRandom = props.frames_random || 0;

            if (fps <= 0) return; // Animação desativada

            const frameCount = rawTileset?.tilecount || tileset.total || 1;
            const delay = Math.round(1000 / fps);

            // Agrupa por delay (fps) para usar um único timer
            if (!animationsByFps.has(delay)) {
                animationsByFps.set(delay, []);
            }

            animationsByFps.get(delay).push({
                name: tileset.name,
                firstGid: tileset.firstgid,
                frameCount: frameCount,
                framesRandom: framesRandom
            });
        });

        // Para cada grupo de fps, cria um timer
        animationsByFps.forEach((tilesets, delay) => {
            // Mapeia tiles para offsets aleatórios (se necessário)
            const tileOffsets = new Map();

            layer.forEachTile(tile => {
                tilesets.forEach(ts => {
                    if (tile.index >= ts.firstGid && tile.index < ts.firstGid + ts.frameCount) {
                        const key = `${tile.x},${tile.y}`;
                        const randomOffset = ts.framesRandom > 0 
                            ? Math.floor(Math.random() * ts.framesRandom)
                            : 0;
                        
                        tileOffsets.set(key, {
                            offset: randomOffset,
                            firstGid: ts.firstGid,
                            frameCount: ts.frameCount
                        });
                    }
                });
            });

            if (tileOffsets.size === 0) return;

            let globalFrame = 0;
            const maxFrames = Math.max(...tilesets.map(ts => ts.frameCount));

            this.time.addEvent({
                delay: delay,
                loop: true,
                callback: () => {
                    globalFrame = (globalFrame + 1) % maxFrames;
                    layer.forEachTile(tile => {
                        const key = `${tile.x},${tile.y}`;
                        const data = tileOffsets.get(key);
                        if (data) {
                            const individualFrame = (globalFrame + data.offset) % data.frameCount;
                            tile.index = data.firstGid + individualFrame;
                        }
                    });
                }
            });
        });
    }

    /**
     * Extrai propriedades customizadas de um tileset
     * Funciona tanto com tilesets do Phaser quanto com dados raw do JSON
     * Aceita propriedades no nível do tileset OU no primeiro tile (tiles[0])
     */
    getTilesetProperties(tileset) {
        const props = {};
        
        // Primeiro: tenta propriedades no nível do tileset
        let properties = tileset.properties || tileset.tilesetProperties || [];
        
        // Fallback: tenta propriedades no primeiro tile (tiles[0].properties)
        if ((!properties || properties.length === 0) && tileset.tiles && tileset.tiles[0]) {
            properties = tileset.tiles[0].properties || [];
        }
        
        if (Array.isArray(properties)) {
            properties.forEach(prop => {
                props[prop.name] = prop.value;
            });
        } else if (typeof properties === 'object') {
            Object.assign(props, properties);
        }

        return props;
    }

    // ==================== JOGADOR ====================

    createPlayer() {
        // Obtém o personagem selecionado
        this.selectedCharacter = GameData.loadSelectedCharacter();
        const characterData = GameData.getCharacter(this.selectedCharacter);
        
        // Determina sprite inicial baseado no personagem
        const idleSprite = characterData.sprites.idle;
        
        this.player = this.physics.add.sprite(this.playerSpawn.x, this.playerSpawn.y, idleSprite);
        this.player.setBounce(0);
        this.player.body.setMaxVelocity(2000, 1000); // Permite velocidade alta para boost
        this.player.body.setSize(14, 30);
        this.player.body.setOffset(9, 2);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(10); // Acima das camadas de decoração
    }

    createAnimations() {
        // Cria animações do personagem selecionado (definição centralizada em GameData)
        // recreate=true para recriar ao trocar de personagem entre fases
        GameData.createCharacterAnimations(this, this.selectedCharacter, '', true);
        
        // Animação de estrela (comum para todos)
        if (!this.anims.exists('star-spin')) {
            this.anims.create({
                key: 'star-spin',
                frames: this.anims.generateFrameNumbers('star', { start: 0, end: 8 }),
                frameRate: 12,
                repeat: -1
            });
        }

        this.player.anims.play('idle', true);

        // Estrelas
        this.stars.children.iterate(star => {
            if (star) star.anims.play('star-spin', true);
        });
    }

    setupPhysics() {
        // Colisões
        this.physics.add.collider(this.player, this.solidsLayer, this.handleTileCollision, null, this);
        this.physics.add.overlap(this.player, this.goal, this.reachGoal, null, this);
        this.physics.add.collider(this.player, this.trampolines, this.handleTrampolineCollision, null, this);
        this.physics.add.overlap(this.player, this.stars, this.collectStar, null, this);

        // Inimigos
        if (this.enemies && this.enemies.children.size > 0) {
            // Inimigos colidem com o chão
            this.physics.add.collider(this.enemies, this.solidsLayer);
            // Jogador encosta no inimigo = dano
            this.physics.add.overlap(this.player, this.enemies, this.handleEnemyCollision, null, this);
        }

        // Setas de velocidade (speed boost)
        if (this.speedBoosts && this.speedBoosts.children.size > 0) {
            this.physics.add.overlap(this.player, this.speedBoosts, this.handleSpeedBoost, null, this);
        }

        // Checkpoints
        this.checkpoints.forEach(flag => {
            this.physics.add.overlap(this.player, flag, () => {
                if (!flag.activated) {
                    flag.activated = true;
                    flag.setTint(0x00ff00);
                    this.currentCheckpoint = flag.checkpointPos;
                    SoundManager.play('checkpoint');
                    this.showCheckpointMessage();
                }
            });
        });

        // Câmera segue jogador
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    }

    // ==================== HUD ====================

    createHUD() {
        // Timer
        this.timerText = this.add.text(this.cameras.main.width - 16, 16, '⏱ 0:00.000', {
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

        // Melhor tempo
        const bestTime = GameData.getBestTime(this.currentLevel);
        if (bestTime) {
            this.bestTimeText = this.add.text(this.cameras.main.width - 16, 38, `🏆 ${GameData.formatTime(bestTime)}`, {
                fontSize: '14px',
                fontFamily: 'monospace',
                color: '#ffd700',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        }

        // Estrelas (se houver)
        if (this.totalStars > 0) {
            this.starHUD = this.add.container(50, 30).setScrollFactor(0).setDepth(100);
            const starIcon = this.add.sprite(0, 0, 'star', 0).setScale(1.2);
            this.starText = this.add.text(24, 0, `0/${this.totalStars}`, {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0, 0.5);
            this.starHUD.add([starIcon, this.starText]);
        }
    }

    showLevelName(name) {
        const text = this.add.text(this.cameras.main.centerX, 50, name, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        
        this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 500,
            delay: 1500,
            onComplete: () => text.destroy()
        });
    }

    // ==================== CONTROLES ====================

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // ESC para pausar/voltar
        const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        escKey.on('down', () => {
            if (this.currentView === 'gameplay' && !this.hasWon) {
                SoundManager.play('menuBack');
                this.pauseGame();
            } else if (this.currentView === 'paused') {
                SoundManager.play('menuSelect');
                this.resumeGame();
            } else if (this.currentView === 'ranking') {
                SoundManager.play('menuBack');
                this.closeRanking();
            }
        });
        this.keyListeners.push(escKey);

        // Controles virtuais (mobile)
        this.virtualControls = GameData.getVirtualControls();
    }

    // ==================== UPDATE ====================

    update(time, delta) {
        // Se não está em gameplay, não processa movimento
        if (this.currentView !== 'gameplay' || this.hasWon) {
            // Processa apenas restart no mobile quando pausado
            if (this.virtualControls.restart && this.currentView === 'paused') {
                this.virtualControls.restart = false;
                this.resumeGame();
            }
            // Durante countdown, mantém o jogador parado
            if (this.currentView === 'countdown') {
        this.player.setVelocity(0, 0);
        this.player.anims.play('idle', true);
            }
            return;
        }

        // Inicia o timer no primeiro frame de gameplay
        if (this.levelStartTime === null) {
            this.levelStartTime = this.time.now;
        }

        // Atualiza timer
        this.elapsedTime = this.time.now - this.levelStartTime;
        this.timerText.setText(`⏱ ${GameData.formatTime(this.elapsedTime)}`);

        // Processa movimento
        this.handlePlayerMovement(delta);
        
        // Atualiza inimigos
        this.updateEnemies();

        // Restart via mobile
        if (this.virtualControls.restart) {
            this.virtualControls.restart = false;
            GameData.saveProgress(this.currentLevel, this.playerName);
            this.scene.restart({ level: this.currentLevel, playerName: this.playerName });
        }
    }

    handlePlayerMovement(delta) {
        const player = this.player;
        const onGround = player.body.blocked.down;

        // Constantes base
        const BASE_MIN_SPEED = 160;
        const BASE_MAX_SPEED = 260;
        const ACCELERATION = 200;
        const JUMP_FORCE = -480;
        const JUMP_CUT = 0.4;
        const FALL_GRAVITY = 0.5;
        const COYOTE_DURATION = 100;
        const BUFFER_DURATION = 100;

        const dt = delta / 1000;
        
        // Movimento horizontal
        const moveLeft = this.cursors.left.isDown || this.virtualControls.left;
        const moveRight = this.cursors.right.isDown || this.virtualControls.right;
        let direction = moveLeft ? -1 : (moveRight ? 1 : 0);

        // Se boost está ativo, mantém velocidade fixa
        if (this.speedBoostActive && this.speedBoostSpeed && direction !== 0) {
            // Durante o boost, usa velocidade fixa
            player.setVelocityX(direction * this.speedBoostSpeed);
            
            // Animações durante o boost
            if (this.selectedCharacter === 'baterista') {
                player.setFlipX(false);
                if (onGround) {
                    const walkAnim = direction < 0 ? 'walk-left' : 'walk';
                    player.anims.play(walkAnim, true);
                }
            } else {
                player.setFlipX(direction < 0);
                if (onGround) player.anims.play('walk', true);
            }
        } else {
            // Soltou o botão durante o boost = cancela o boost
            if (this.speedBoostActive && direction === 0) {
                this.cancelSpeedBoost();
            }
            
            // Movimento normal (sem boost)
            if (direction !== this.lastDirection) {
                this.currentSpeed = BASE_MIN_SPEED;
            }
            this.lastDirection = direction;
            
            if (direction !== 0) {
                this.currentSpeed = Math.min(this.currentSpeed + ACCELERATION * dt, BASE_MAX_SPEED);
                player.setVelocityX(direction * this.currentSpeed);
                
                // Para baterista, usa animação específica de direção
                if (this.selectedCharacter === 'baterista') {
                    player.setFlipX(false);
                    if (onGround) {
                        const walkAnim = direction < 0 ? 'walk-left' : 'walk';
                        player.anims.play(walkAnim, true);
                    }
                } else {
                    player.setFlipX(direction < 0);
                    if (onGround) player.anims.play('walk', true);
                }
            } else {
                player.setVelocityX(0);
                if (onGround) player.anims.play('idle', true);
            }
        }

        // Pulo (apenas barra de espaço)
        const jumpJustPressed = Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
                                this.virtualControls.jumpJustPressed;
        const jumpHeld = this.spaceKey.isDown || this.virtualControls.jumpHeld;

        if (this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
        }

        // Coyote time
        if (onGround) {
            this.coyoteTime = COYOTE_DURATION;
            this.isJumping = false;
        } else {
            this.coyoteTime -= delta;
        }

        // Jump buffer
        if (jumpJustPressed) {
            this.jumpBufferTime = BUFFER_DURATION;
        } else {
            this.jumpBufferTime -= delta;
        }
        
        const canCoyoteJump = this.coyoteTime > 0;
        const hasBufferedJump = this.jumpBufferTime > 0;
        const shouldJump = (jumpJustPressed && canCoyoteJump) || (onGround && hasBufferedJump);
        
        if (shouldJump && !this.isJumping) {
            player.setVelocityY(JUMP_FORCE);
            this.isJumping = true;
            this.coyoteTime = 0;
            this.jumpBufferTime = 0;
            SoundManager.play('jump');
        }
        
        // Corte de pulo (interrompe som também)
        if (!jumpHeld && this.isJumping && player.body.velocity.y < 0) {
            player.setVelocityY(player.body.velocity.y * JUMP_CUT);
            this.isJumping = false;
            SoundManager.stop('jump');
        }
        
        // Gravidade extra na queda
        if (!onGround && player.body.velocity.y > 0) {
            const extraGravity = this.physics.world.gravity.y * FALL_GRAVITY * dt;
            player.setVelocityY(player.body.velocity.y + extraGravity);
        }
        
        // Animação no ar
        if (!onGround) {
            player.anims.stop();
            const charData = GameData.getCharacter(this.selectedCharacter);
            const jumpSprite = charData.sprites.jump;
            
            if (jumpSprite && jumpSprite.key === 'hero-jump') {
                // Vocalista tem sprite de pulo com frames específicos
                player.setTexture('hero-jump', player.body.velocity.y < 0 ? 1 : 2);
            } else if (jumpSprite) {
                // Outros personagens usam seu sprite de pulo
                player.setTexture(jumpSprite.key, 0);
            } else {
                // Fallback para idle se não tiver sprite de pulo
                const idleKey = GameData.getCharacterTextureKey(this.selectedCharacter, 'idle');
                player.setTexture(idleKey, 0);
            }
        }
    }

    // ==================== COLISÕES ====================

    handleTileCollision(player, tile) {
        if (tile.properties?.jump_back_to_checkpoint) {
            this.respawnAtCheckpoint();
        }
    }
    
    handleTrampolineCollision(player, trampoline) {
        if (player.body.velocity.y >= 0 && !trampoline.justBounced) {
            player.setVelocityY(-990);
            this.isJumping = true;
            SoundManager.play('jumpTrampoline');
            
            trampoline.justBounced = true;
            this.time.delayedCall(200, () => {
                trampoline.justBounced = false;
            });
            
            this.tweens.add({
                targets: trampoline,
                scaleY: 0.6,
                duration: 80,
                yoyo: true,
                ease: 'Power2'
            });
        }
    }
    
    collectStar(player, star) {
        star.disableBody(true, true);
        this.starsCollected++;
        SoundManager.play('collectStar');
        if (this.starText) {
            this.starText.setText(`${this.starsCollected}/${this.totalStars}`);
        }
        this.tweens.add({
            targets: this.starHUD,
            scale: 1.3,
            duration: 100,
            yoyo: true
        });
    }

    respawnAtCheckpoint() {
        if (this.isRespawning) return;
        this.isRespawning = true;
        SoundManager.play('damage');

        this.player.body.enable = false;
        const startX = this.player.x;
        const startY = this.player.y;
        const endX = this.currentCheckpoint.x;
        const endY = this.currentCheckpoint.y;
        const arcHeight = 150;
        const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const duration = Math.max(400, Math.min(800, distance * 0.8));

        this.player.setTint(0xff6666);

        this.tweens.add({
            targets: this.player,
            x: endX,
            y: endY,
            duration: duration,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
                const progress = tween.progress;
                const arc = Math.sin(progress * Math.PI) * arcHeight;
                const linearY = Phaser.Math.Linear(startY, endY, progress);
                this.player.y = linearY - arc;
                this.player.angle = progress * 360;
            },
            onComplete: () => {
                this.player.angle = 0;
                this.player.clearTint();
                this.player.body.enable = true;
                this.player.setVelocity(0, 0);
                this.isRespawning = false;
            }
        });
    }

    showCheckpointMessage() {
        const text = this.add.text(this.cameras.main.centerX, 80, '🚩 CHECKPOINT!', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        
        this.tweens.add({
            targets: text,
            alpha: 0,
            y: 60,
            duration: 500,
            delay: 800,
            onComplete: () => text.destroy()
        });
    }

    // ==================== VITÓRIA ====================

    reachGoal() {
        if (this.hasWon) return;

        // Se a fase tem estrelas, verifica se todas foram coletadas
        if (this.totalStars > 0 && this.starsCollected < this.totalStars) {
            this.showStarsWarning();
            return;
        }
        
        this.hasWon = true;
        this.currentView = 'victory';
        SoundManager.play('goalReached');
        
        this.player.setVelocity(0, 0);
        this.player.anims.play('idle', true);
        
        const finalTime = this.elapsedTime;
        
        // Marca a fase como completa
        GameData.markLevelComplete(this.currentLevel);
        
        // Salva o tempo (sempre tenta, retorna info sobre posição)
        const result = GameData.saveRecord(this.currentLevel, finalTime, this.playerName);
        
        // Som extra se for novo recorde
        if (result.isRecord) {
            this.time.delayedCall(500, () => SoundManager.play('newRecord'));
        }

        this.showVictoryScreen(finalTime, result);
    }

    showStarsWarning() {
        // Evita mostrar múltiplos avisos
        if (this.starsWarningActive) return;
        this.starsWarningActive = true;
        SoundManager.play('warning');

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        
        const remaining = this.totalStars - this.starsCollected;
        const starWord = remaining === 1 ? 'estrela' : 'estrelas';

        const warningBg = this.add.rectangle(centerX, centerY - 50, 420, 60, 0x000000, 0.85)
            .setScrollFactor(0).setDepth(200);
        
        const warningText = this.add.text(centerX, centerY - 50, 
            `⭐ Faltam ${remaining} ${starWord}!`, {
            fontSize: '24px',
                fontFamily: 'Arial',
                color: '#ffff00',
                stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        // Animação de pulso no HUD de estrelas
        this.tweens.add({
            targets: this.starHUD,
            scale: 1.4,
            duration: 150,
            yoyo: true,
            repeat: 2
        });

        // Remove o aviso após 2 segundos
        this.time.delayedCall(2000, () => {
            warningBg.destroy();
            warningText.destroy();
            this.starsWarningActive = false;
        });
    }

    showVictoryScreen(finalTime, result) {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        const nextLevel = this.currentLevel + 1;
        const hasNextLevel = nextLevel < GameData.LEVELS.length;
        
        // Verifica se esta fase completa um mundo
        const completedWorld = GameData.checkWorldCompletion(this.currentLevel);

        // Overlay
        const overlay = this.add.rectangle(centerX, centerY, 640, 400, 0x000000, 0.8)
            .setScrollFactor(0).setDepth(200);
        this.overlayElements.push(overlay);

        // Detecta mobile
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const continueText = isMobile ? 'Toque no botão de PULO' : 'ESPAÇO';

        // Monta label baseado no resultado
        let rankLabel = '';
        if (result.isRecord) {
            rankLabel = ' 🏆 NOVO RECORDE!';
        } else if (result.saved) {
            rankLabel = ` 🎖️ ${result.position}º lugar!`;
        }
        const timeColor = result.saved ? '#ffd700' : '#ffffff';

        // Se completou um mundo, mostra tela de comemoração
        if (completedWorld) {
            this.showWorldCompleteTransition(centerX, centerY, finalTime, rankLabel, timeColor, completedWorld, continueText);
            return;
        }

        if (hasNextLevel) {
            // Fase completa (sem completar mundo)
            this.add.text(centerX, centerY - 60, '✅ FASE COMPLETA!', {
                fontSize: '32px', fontFamily: 'Arial', color: '#00ff00',
                stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            this.add.text(centerX, centerY - 15, `⏱ Tempo: ${GameData.formatTime(finalTime)}${rankLabel}`, {
                fontSize: '20px', fontFamily: 'monospace', color: timeColor,
                stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            this.add.text(centerX, centerY + 55, `${continueText} para continuar`, {
                fontSize: '16px', fontFamily: 'Arial', color: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            // Volta ao mapa do mundo
            const handleContinue = () => {
                GameData.saveMapPosition(GameData.state.currentWorld, nextLevel);
                this.scene.start('WorldMapScene');
            };

            this.input.keyboard.once('keydown-SPACE', handleContinue);
            this.input.keyboard.once('keydown-ENTER', handleContinue);
            
            // Suporte mobile
            this.time.addEvent({
                delay: 100,
                loop: true,
                callback: () => {
                    if (this.virtualControls.jumpJustPressed) {
                        this.virtualControls.jumpJustPressed = false;
                        handleContinue();
                    }
                }
            });
        } else {
            // Jogo completo (sem mais mundos por enquanto)
            this.add.text(centerX, centerY - 80, '🎉 VOCÊ ZEROU O JOGO! 🎉', {
                fontSize: '28px', fontFamily: 'Arial', color: '#ffff00',
                stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            this.add.text(centerX, centerY - 35, `⏱ Fase: ${GameData.formatTime(finalTime)}${rankLabel}`, {
                fontSize: '18px', fontFamily: 'monospace', color: timeColor,
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            const totalBest = GameData.getTotalBestTime();
            if (totalBest !== null) {
                this.add.text(centerX, centerY + 5, `🏅 Tempo Total: ${GameData.formatTime(totalBest)}`, {
                    fontSize: '22px', fontFamily: 'monospace', color: '#00ffff',
                    stroke: '#000000', strokeThickness: 3
                }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
            }

            this.add.text(centerX, centerY + 55, `${continueText} para voltar ao mapa`, {
                fontSize: '16px', fontFamily: 'Arial', color: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            // Volta ao mapa do mundo (mantém na última fase completada)
            const handleBackToMap = () => {
                GameData.saveMapPosition(GameData.state.currentWorld, this.currentLevel);
                this.scene.start('WorldMapScene');
            };

            this.input.keyboard.once('keydown-SPACE', handleBackToMap);
            this.input.keyboard.once('keydown-ENTER', handleBackToMap);
            
            // Suporte mobile
            this.time.addEvent({
                delay: 100,
                loop: true,
                callback: () => {
                    if (this.virtualControls.jumpJustPressed) {
                        this.virtualControls.jumpJustPressed = false;
                        handleBackToMap();
                    }
                }
            });
        }
    }
    
    /**
     * Mostra transição quando um mundo é completado
     */
    showWorldCompleteTransition(centerX, centerY, finalTime, rankLabel, timeColor, world, continueText) {
        // Mensagem de fase completa
        this.add.text(centerX, centerY - 70, '✅ FASE COMPLETA!', {
            fontSize: '28px', fontFamily: 'Arial', color: '#00ff00',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        this.add.text(centerX, centerY - 30, `⏱ Tempo: ${GameData.formatTime(finalTime)}${rankLabel}`, {
            fontSize: '18px', fontFamily: 'monospace', color: timeColor,
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        // Mensagem especial de mundo completo
        const worldText = this.add.text(centerX, centerY + 20, `🌟 ${world.name.toUpperCase()} COMPLETO! 🌟`, {
            fontSize: '20px', fontFamily: 'Arial', color: '#ffd700',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        // Animação de destaque
        this.tweens.add({
            targets: worldText,
            scale: { from: 1, to: 1.1 },
            duration: 400,
            yoyo: true,
            repeat: -1
        });

        this.add.text(centerX, centerY + 65, `${continueText} para ver a recompensa!`, {
            fontSize: '14px', fontFamily: 'Arial', color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        // Handler para ir à tela de comemoração
        const handleWorldComplete = () => {
            this.scene.start('WorldCompleteScene', {
                world: world,
                playerName: this.playerName,
                totalTime: finalTime
            });
        };

        this.input.keyboard.once('keydown-SPACE', handleWorldComplete);
        this.input.keyboard.once('keydown-ENTER', handleWorldComplete);
        
        // Suporte mobile
        this.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                if (this.virtualControls.jumpJustPressed) {
                    this.virtualControls.jumpJustPressed = false;
                    handleWorldComplete();
                }
            }
        });
    }
    
    // ==================== PAUSE ====================

    pauseGame() {
        this.currentView = 'paused';
        GameData.saveProgress(this.currentLevel, this.playerName);
        
        // Salva o tempo decorrido no momento da pausa
        this.pausedAtTime = this.time.now;

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Overlay
        const overlay = this.add.rectangle(centerX, centerY, 640, 352, 0x000000, 0.7)
            .setScrollFactor(0).setDepth(200);
        this.overlayElements.push(overlay);

        // Título
        const title = this.add.text(centerX, centerY - 60, 'PAUSADO', {
            fontSize: '36px', fontFamily: 'Arial', color: '#ffffff',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        this.overlayElements.push(title);

        // Botões
        this.pauseSelectedIndex = 0;
        this.pauseButtons = [];

        const continueBtn = this.add.text(centerX, centerY - 10, '▶ CONTINUAR', {
            fontSize: '24px', fontFamily: 'Arial', color: '#00ff00',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
        continueBtn.defaultColor = '#00ff00';
        continueBtn.on('pointerover', () => { 
            if (this.pauseSelectedIndex !== 0) SoundManager.play('menuNavigate');
            this.pauseSelectedIndex = 0; 
            this.updatePauseStyles(); 
        });
        continueBtn.on('pointerdown', () => {
            SoundManager.play('menuSelect');
            this.resumeGame();
        });
        this.pauseButtons.push(continueBtn);
        this.overlayElements.push(continueBtn);

        const menuBtn = this.add.text(centerX, centerY + 40, 'MENU PRINCIPAL', {
            fontSize: '24px', fontFamily: 'Arial', color: '#ffd700',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
        menuBtn.defaultColor = '#ffd700';
        menuBtn.on('pointerover', () => { 
            if (this.pauseSelectedIndex !== 1) SoundManager.play('menuNavigate');
            this.pauseSelectedIndex = 1; 
            this.updatePauseStyles(); 
        });
        menuBtn.on('pointerdown', () => {
            SoundManager.play('menuSelect');
            this.goToMenu();
        });
        this.pauseButtons.push(menuBtn);
        this.overlayElements.push(menuBtn);

        // Instruções
        const instructions = this.add.text(centerX, centerY + 100, '↑↓: Navegar | Enter: Selecionar | ESC: Voltar', {
            fontSize: '14px', fontFamily: 'Arial', color: '#aaaaaa'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        this.overlayElements.push(instructions);

        this.updatePauseStyles();

        // Controles do menu de pause
        const upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        const downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        upKey.on('down', () => {
            if (this.currentView === 'paused') {
                const prevIndex = this.pauseSelectedIndex;
                this.pauseSelectedIndex = Math.max(0, this.pauseSelectedIndex - 1);
                if (this.pauseSelectedIndex !== prevIndex) {
                    SoundManager.play('menuNavigate');
                }
                this.updatePauseStyles();
            }
        });

        downKey.on('down', () => {
            if (this.currentView === 'paused') {
                const prevIndex = this.pauseSelectedIndex;
                this.pauseSelectedIndex = Math.min(this.pauseButtons.length - 1, this.pauseSelectedIndex + 1);
                if (this.pauseSelectedIndex !== prevIndex) {
                    SoundManager.play('menuNavigate');
                }
                this.updatePauseStyles();
            }
        });

        enterKey.on('down', () => {
            if (this.currentView === 'paused') {
                SoundManager.play('menuSelect');
                if (this.pauseSelectedIndex === 0) this.resumeGame();
                else this.goToMenu();
            }
        });

        this.pauseKeyListeners = [upKey, downKey, enterKey];
    }

    updatePauseStyles() {
        this.pauseButtons.forEach((btn, index) => {
            if (index === this.pauseSelectedIndex) {
                btn.setStyle({ color: '#ffffff' });
                btn.setScale(1.1);
            } else {
                btn.setStyle({ color: btn.defaultColor });
                btn.setScale(1);
            }
        });
    }

    resumeGame() {
        // Compensa o tempo que ficou pausado
        if (this.pausedAtTime) {
            const pauseDuration = this.time.now - this.pausedAtTime;
            this.levelStartTime += pauseDuration;
            this.pausedAtTime = null;
        }
        
        this.currentView = 'gameplay';
        this.clearOverlay();
        this.clearPauseListeners();
    }

    goToMenu() {
        this.clearOverlay();
        this.clearPauseListeners();
        this.scene.start('MenuScene');
    }

    clearOverlay() {
        this.overlayElements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        this.overlayElements = [];
    }

    clearPauseListeners() {
        if (this.pauseKeyListeners) {
            this.pauseKeyListeners.forEach(key => {
                if (key && key.destroy) key.destroy();
            });
            this.pauseKeyListeners = [];
        }
    }

    // ==================== RANKING ====================

    showRanking() {
        this.currentView = 'ranking';
        
        // Salva o tempo decorrido no momento de abrir o ranking
        this.pausedAtTime = this.time.now;
        
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Overlay
        const overlay = this.add.rectangle(centerX, centerY, 640, 352, 0x000000, 0.95)
            .setScrollFactor(0).setDepth(200);
        this.overlayElements.push(overlay);

        // Título
        const title = this.add.text(centerX, centerY - 160, '🏆 RANKING DE HI-SCORES 🏆', {
            fontSize: '24px', fontFamily: 'Arial', color: '#ffd700',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        this.overlayElements.push(title);

        // Tabelas
        let y = centerY - 120;
        for (let level = 0; level < GameData.LEVELS.length; level++) {
            y = this.renderRankingTable(level, y);
            y += 20;
        }

        // Instrução
        const closeText = this.add.text(centerX, centerY + 150, 'Pressione ESC para fechar', {
            fontSize: '16px', fontFamily: 'Arial', color: '#aaaaaa'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        this.overlayElements.push(closeText);
    }

    renderRankingTable(level, startY) {
        const records = GameData.getTopRecords(level, 4);
        const levelName = GameData.LEVELS[level]?.name || `Fase ${level + 1}`;
        const centerX = this.cameras.main.centerX;
        let y = startY;

        // Título
        const faseTitle = this.add.text(centerX, y, levelName.toUpperCase(), {
            fontSize: '18px', fontFamily: 'Arial', color: '#00ff00', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        this.overlayElements.push(faseTitle);
        y += 25;

        // Cabeçalho
        [{ text: 'TEMPO', x: -150 }, { text: 'JOGADOR', x: 0 }, { text: 'DATA/HORA', x: 150 }].forEach(h => {
            const header = this.add.text(centerX + h.x, y, h.text, {
                fontSize: '14px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
            this.overlayElements.push(header);
        });
        y += 20;

        // Recordes
        if (records.length > 0) {
            records.forEach(record => {
                const timeText = this.add.text(centerX - 150, y, GameData.formatTime(record.time), {
                    fontSize: '12px', fontFamily: 'monospace', color: '#00ffff'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
                this.overlayElements.push(timeText);

                const playerText = this.add.text(centerX, y, record.playerName || 'Anônimo', {
                    fontSize: '12px', fontFamily: 'Arial', color: '#ffffff'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
                this.overlayElements.push(playerText);

                const dateText = this.add.text(centerX + 150, y, GameData.formatDate(record.date), {
                    fontSize: '11px', fontFamily: 'Arial', color: '#aaaaaa'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
                this.overlayElements.push(dateText);

                y += 18;
            });
        } else {
            const noRecord = this.add.text(centerX, y, 'Nenhum recorde ainda', {
                fontSize: '12px', fontFamily: 'Arial', color: '#666666'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
            this.overlayElements.push(noRecord);
            y += 18;
        }

        return y;
    }

    closeRanking() {
        // Compensa o tempo que ficou com ranking aberto
        if (this.pausedAtTime) {
            const pauseDuration = this.time.now - this.pausedAtTime;
            this.levelStartTime += pauseDuration;
            this.pausedAtTime = null;
        }
        
        this.currentView = 'gameplay';
        this.clearOverlay();
    }

    // ==================== CLEANUP ====================

    shutdown() {
        // Limpa listeners
        this.keyListeners.forEach(key => {
            if (key && key.destroy) key.destroy();
        });
        this.clearPauseListeners();
        GameData.state.gameSceneRef = null;
    }
}
