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
        // Carrega todos os mapas
        GameData.LEVELS.forEach(level => {
            this.load.tilemapTiledJSON(level.key, level.file);
        });
        
        // ========== CARREGAMENTO AUTOMÁTICO DE TILESETS ==========
        // Carrega dinamicamente todos os tilesets de todos os mapas
        this.loadTilesetsFromMaps();

        // ========== SPRITESHEETS DE GAMEPLAY ==========
        this.load.spritesheet('star', 'assets/spritesheets/yellow-star-animated.png', {
            frameWidth: 32, frameHeight: 32
        });
        
        // Sprites do Vocalista (personagem padrão)
        this.load.spritesheet('hero-idle', 'assets/spritesheets/still-hero.png', {
            frameWidth: 32, frameHeight: 32
        });
        this.load.spritesheet('hero-walk', 'assets/spritesheets/walking-hero.png', {
            frameWidth: 32, frameHeight: 32
        });
        this.load.spritesheet('hero-jump', 'assets/spritesheets/jumping-hero.png', {
            frameWidth: 32, frameHeight: 32
        });
        
        // Sprites do Baterista
        this.load.spritesheet('baterista-idle', 'assets/spritesheets/baterista-parado-animado-6fps.png', {
            frameWidth: 32, frameHeight: 32
        });
        this.load.spritesheet('baterista-walk', 'assets/spritesheets/baterista-andando-pra-direita-6fps.png', {
            frameWidth: 32, frameHeight: 32
        });
        this.load.spritesheet('baterista-walk-left', 'assets/spritesheets/baterista-andando-pra-esq-6fps.png', {
            frameWidth: 32, frameHeight: 32
        });
        
        // Sprites do Baixista (usando placeholder por enquanto)
        this.load.spritesheet('baixista-idle', 'assets/spritesheets/baixista-parado.png', {
            frameWidth: 32, frameHeight: 32
        });
        
        // ========== INIMIGOS ==========
        // Sapo-tomate (6 frames de animação de pulo)
        this.load.spritesheet('sapo-tomate', 'assets/spritesheets/sapo-tomate-6fps.png', {
            frameWidth: 32, frameHeight: 32
        });
    }

    /**
     * Carrega automaticamente TODOS os tilesets referenciados nos mapas JSON
     * Isso elimina a necessidade de adicionar tilesets manualmente ao código
     */
    loadTilesetsFromMaps() {
        const loadedTilesets = new Set();
        
        // Aliases: nome usado no código → nome no tileset do Tiled
        // Usado quando o código espera um nome diferente do que está no mapa
        const TILESET_ALIASES = {
            'trampoline-thick': 'trampoline', // código usa 'trampoline', Tiled usa 'trampoline-thick'
        };
        
        GameData.LEVELS.forEach(level => {
            // Usa XMLHttpRequest síncrono para ler o JSON do mapa
            // (durante o preload, isso é seguro e simples)
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', level.file, false); // false = síncrono
                xhr.send();
                
                if (xhr.status === 200) {
                    const mapData = JSON.parse(xhr.responseText);
                    
                    if (mapData.tilesets) {
                        mapData.tilesets.forEach(ts => {
                            const tilesetName = ts.name;
                            
                            // Evita carregar o mesmo tileset múltiplas vezes
                            if (loadedTilesets.has(tilesetName)) return;
                            loadedTilesets.add(tilesetName);
                            
                            // Extrai o nome do arquivo da imagem (caminho relativo no JSON)
                            if (ts.image) {
                                // Converte "spritesheets/nome.png" → "assets/spritesheets/nome.png"
                                const imagePath = 'assets/' + ts.image.replace(/\\/g, '/');
                                
                                // Carrega com o nome original do tileset
                                this.load.image(tilesetName, imagePath);
                                
                                // Se existe um alias, carrega também com o nome alternativo
                                if (TILESET_ALIASES[tilesetName]) {
                                    this.load.image(TILESET_ALIASES[tilesetName], imagePath);
                                }
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn(`Não foi possível carregar tilesets do mapa: ${level.file}`, e);
            }
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
        map.createLayer('bg', allTilesets);
        
        // Camada de decoração de background (se existir)
        const bgDecoLayer = map.getLayer('bg_decoration');
        if (bgDecoLayer) {
            this.bgDecorationLayer = map.createLayer('bg_decoration', allTilesets);
            // Animação das bolhas de lava
            const lavaBubblesTileset = map.tilesets.find(ts => ts.name === 'lava-bubbles-4fps');
            if (lavaBubblesTileset) {
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
                enemies.push({ 
                    x: obj.x + 16, 
                    y: obj.y - 16,
                    type: 'sapo'
                });
            }
        });

        this.currentCheckpoint = this.playerSpawn;

        // Cria objetos do jogo
        this.createGoal();
        this.createCheckpoints();
        this.createTrampolines(trampolines);
        this.createStars(stars);
        this.createEnemies(enemies);
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
            if (e.type === 'sapo') {
                this.createSapo(e.x, e.y);
            }
        });
    }

    createSapo(x, y) {
        const sapo = this.physics.add.sprite(x, y, 'sapo-tomate');
        
        // Configuração física
        sapo.body.setSize(24, 20);
        sapo.body.setOffset(4, 12);
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

    updateEnemies() {
        if (!this.enemies) return;
        
        this.enemies.children.iterate(enemy => {
            if (!enemy || !enemy.active || !enemy.patrolData) return;
            
            const data = enemy.patrolData;
            const onGround = enemy.body.blocked.down;
            
            // Pula a cada bloco (32px)
            const distanceFromLastJump = Math.abs(enemy.x - data.lastJumpX);
            if (distanceFromLastJump >= data.jumpDistance && onGround) {
                enemy.setVelocityY(data.jumpForce);
                data.lastJumpX = enemy.x;
            }
            
            // Verifica se atingiu os limites da patrulha
            if (enemy.x >= data.rightLimit && data.direction === 1) {
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
            
            // Garante que está andando (pode parar se colidir com algo)
            if (enemy.body.velocity.x === 0 && onGround) {
                enemy.setVelocityX(data.speed * data.direction);
            }
        });
    }

    handleEnemyCollision(player, enemy) {
        // Jogador encosta no inimigo = dano
        if (!this.isRespawning) {
            SoundManager.play('death');
            this.respawnAtCheckpoint();
        }
    }

    setupCamera(map, levelConfig) {
        const zoom = levelConfig.zoom ?? GameData.DEFAULTS.zoom;
        const roundPixels = levelConfig.roundPixels ?? GameData.DEFAULTS.roundPixels;

        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setZoom(zoom);
        this.cameras.main.setRoundPixels(roundPixels);
        
        // Filtro de texturas
        const filterMode = roundPixels 
            ? Phaser.Textures.FilterMode.NEAREST 
            : Phaser.Textures.FilterMode.LINEAR;
        ['hero-idle', 'hero-walk', 'hero-jump'].forEach(key => {
            this.textures.get(key).setFilter(filterMode);
        });
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

    // ==================== JOGADOR ====================

    createPlayer() {
        // Obtém o personagem selecionado
        this.selectedCharacter = GameData.loadSelectedCharacter();
        const characterData = GameData.getCharacter(this.selectedCharacter);
        
        // Determina sprite inicial baseado no personagem
        const idleSprite = characterData.sprites.idle;
        
        this.player = this.physics.add.sprite(this.playerSpawn.x, this.playerSpawn.y, idleSprite);
        this.player.setBounce(0);
        this.player.body.setMaxVelocity(400, 1000);
        this.player.body.setSize(14, 30);
        this.player.body.setOffset(9, 2);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(10); // Acima das camadas de decoração
    }

    createAnimations() {
        // Animações baseadas no personagem selecionado
        let playerAnims;
        
        if (this.selectedCharacter === 'baterista') {
            playerAnims = [
                { key: 'idle', texture: 'baterista-idle', frames: [0, 3], rate: 6 },
                { key: 'walk', texture: 'baterista-walk', frames: [0, 3], rate: 6 },
                { key: 'walk-left', texture: 'baterista-walk-left', frames: [0, 3], rate: 6 }
            ];
        } else if (this.selectedCharacter === 'baixista') {
            // Baixista (usando sprite parado como placeholder para todas as animações)
            playerAnims = [
                { key: 'idle', texture: 'baixista-idle', frames: [0, 3], rate: 6 },
                { key: 'walk', texture: 'baixista-idle', frames: [0, 3], rate: 6 },
                { key: 'walk-left', texture: 'baixista-idle', frames: [0, 3], rate: 6 }
            ];
        } else {
            // Vocalista (padrão)
            playerAnims = [
                { key: 'idle', texture: 'hero-idle', frames: [0, 3], rate: 6 },
                { key: 'walk', texture: 'hero-walk', frames: [0, 3], rate: 14 }
            ];
        }
        
        // Cria animações do personagem
        playerAnims.forEach(anim => {
            // Remove animação existente para recriar com sprite correto
            if (this.anims.exists(anim.key)) {
                this.anims.remove(anim.key);
            }
            this.anims.create({
                key: anim.key,
                frames: this.anims.generateFrameNumbers(anim.texture, { 
                    start: anim.frames[0], 
                    end: anim.frames[1] 
                }),
                frameRate: anim.rate,
                repeat: -1
            });
        });
        
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

        // Constantes
        const MIN_SPEED = 160;
        const MAX_SPEED = 260;
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

        if (direction !== this.lastDirection) {
            this.currentSpeed = MIN_SPEED;
        }
        this.lastDirection = direction;
        
        if (direction !== 0) {
            this.currentSpeed = Math.min(this.currentSpeed + ACCELERATION * dt, MAX_SPEED);
            player.setVelocityX(direction * this.currentSpeed);
            
            // Para baterista, usa animação específica de direção
            // Para outros personagens, usa flip
            if (this.selectedCharacter === 'baterista') {
                player.setFlipX(false); // Não usa flip
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
            
            if (jumpSprite === 'hero-jumping') {
                // Vocalista tem sprite de pulo com frames específicos
                player.setTexture('hero-jump', player.body.velocity.y < 0 ? 1 : 2);
            } else {
                // Outros personagens usam seu sprite de pulo (ou idle como placeholder)
                player.setTexture(jumpSprite, 0);
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
