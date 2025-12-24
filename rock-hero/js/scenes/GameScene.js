/**
 * GAME SCENE - Cena Principal do Jogo
 * 
 * Uma cena no Phaser tem 3 métodos principais:
 * - preload(): Carrega assets (imagens, sons, mapas)
 * - create(): Cria objetos do jogo (sprites, física, animações)
 * - update(): Roda a cada frame (60x por segundo) - lógica do jogo
 */

// Lista de mapas do jogo (fases) com configurações customizáveis
const LEVELS = [
    { 
        key: 'map1', 
        file: 'assets/map.json', 
        name: 'Fase 1',
        // Configurações opcionais (usa valores padrão se não definido)
        zoom: 1.0,          // Zoom da câmera (1.0 = normal, 0.75 = mais longe)
        roundPixels: true   // true = pixels nítidos, false = suavizado
    },
    { 
        key: 'map2', 
        file: 'assets/map-2--expansion and speed.json', 
        name: 'Fase 2',
        zoom: 0.9,         // Câmera mais afastada para ver mais do mapa
        roundPixels: false  // Suaviza para evitar artefatos com zoom fracionário
    }
];

// Valores padrão para propriedades de fase
const LEVEL_DEFAULTS = {
    zoom: 1.0,
    roundPixels: true,
    gravity: 800,
    playerSpeed: { min: 160, max: 260 },
    jumpForce: -480
};

class GameScene extends Phaser.Scene {
    constructor() {
        // Nome único da cena
        super({ key: 'GameScene' });
    }
    
    // Inicializa dados da cena (chamado antes do preload)
    init(data) {
        // Nível atual (pode vir de outra cena ou começa em 0)
        this.currentLevel = data.level !== undefined ? data.level : 0;
    }

    /**
     * PRELOAD - Carrega todos os assets antes do jogo começar
     */
    preload() {
        // Carrega todos os mapas do jogo
        LEVELS.forEach(level => {
            this.load.tilemapTiledJSON(level.key, level.file);
        });
        
        // Carrega os tilesets (imagens dos tiles)
        this.load.image('grass', 'assets/spritesheets/grass.png');
        this.load.image('grass-with-barrier', 'assets/spritesheets/grass-with-barrier.png');
        this.load.image('bricks', 'assets/spritesheets/bricks.png');
        this.load.image('abstract-background', 'assets/spritesheets/abstract-background.png');
        this.load.image('black', 'assets/spritesheets/black.png');
        this.load.image('green-flag', 'assets/spritesheets/green-flag.png');
        this.load.image('yellow-flag', 'assets/spritesheets/yellow-flag.png');
        this.load.image('lava', 'assets/spritesheets/lava.png');
        this.load.image('lava-roxa', 'assets/spritesheets/lava-roxa.png');
        this.load.image('lava-roxa-animated', 'assets/spritesheets/lava-roxa-animated.png');
        this.load.image('trampoline', 'assets/spritesheets/trampoline-thick.png');
        this.load.image('abstract-blue', 'assets/spritesheets/abstract-blue.png');
        
        // Carrega spritesheet da estrela (3x3 = 9 frames de 32x32)
        this.load.spritesheet('star', 'assets/spritesheets/yellow-star-animated.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        
        // Carrega os spritesheets do herói
        // frameWidth e frameHeight: tamanho de cada frame individual
        this.load.spritesheet('hero-idle', 'assets/spritesheets/still-hero.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        
        this.load.spritesheet('hero-walk', 'assets/spritesheets/walking-hero.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        
        this.load.spritesheet('hero-jump', 'assets/spritesheets/jumping-hero.png', {
            frameWidth: 32,
            frameHeight: 32
        });
    }

    /**
     * CREATE - Cria os objetos do jogo
     */
    create() {
        // ===== MAPA =====
        // Pega a configuração do nível atual
        const levelConfig = LEVELS[this.currentLevel];
        
        // Mostra o nome da fase brevemente
        this.showLevelName(levelConfig.name);
        
        // Cria o tilemap a partir do JSON carregado
        const map = this.make.tilemap({ key: levelConfig.key });
        
        // Helper: adiciona todos os tilesets com o nome (lida com duplicatas no Tiled)
        const addTileset = (name, imageKey) => {
            const matchingTilesets = map.tilesets.filter(ts => ts.name === name);
            if (matchingTilesets.length === 0) return null;
            
            // Adiciona cada instância do tileset (pode haver duplicatas)
            const added = [];
            matchingTilesets.forEach((ts, index) => {
                // Para duplicatas, usa o firstgid como diferenciador
                const result = map.addTilesetImage(name, imageKey || name, undefined, undefined, undefined, undefined, ts.firstgid);
                if (result) added.push(result);
            });
            
            return added.length > 0 ? added[0] : null; // Retorna o primeiro para compatibilidade
        };
        
        // Helper alternativo: adiciona todos e retorna array
        const addAllTilesets = (name, imageKey) => {
            const matchingTilesets = map.tilesets.filter(ts => ts.name === name);
            return matchingTilesets.map(ts => 
                map.addTilesetImage(name, imageKey || name, undefined, undefined, undefined, undefined, ts.firstgid)
            ).filter(t => t !== null);
        };
        
        // Conecta as imagens aos tilesets do mapa (só os que existem)
        const tilesetGrass = addTileset('grass');
        const tilesetGrassBarrier = addTileset('grass-with-barrier');
        const tilesetBricks = addTileset('bricks');
        const tilesetLava = addTileset('lava');
        const tilesetLavaRoxa = addTileset('lava-roxa');
        const tilesetLavaRoxaAnim = addTileset('lava-roxa-animated');
        
        // Tilesets de fundo (cada mapa pode usar um diferente)
        const tilesetAbstractBg = addTileset('abstract-background');
        const tilesetBlackBg = addTileset('black');
        const tilesetsAbstractBlue = addAllTilesets('abstract-blue'); // Pode ter múltiplos
        
        // Cria as camadas do mapa (usa os tilesets disponíveis)
        const bgTilesets = [tilesetAbstractBg, tilesetBlackBg, ...tilesetsAbstractBlue].filter(t => t !== null);
        const bgLayer = map.createLayer('bg', bgTilesets);
        
        // Tilesets da camada de sólidos (incluindo lava e novos tiles)
        const solidTilesets = [
            tilesetGrass, 
            tilesetGrassBarrier,
            tilesetBricks, 
            tilesetLava, 
            tilesetLavaRoxa,
            tilesetLavaRoxaAnim
        ].filter(t => t !== null);
        const solidsLayer = map.createLayer('solids', solidTilesets);
        
        // Ativa colisão nos tiles que têm a propriedade 'collider' = true
        solidsLayer.setCollisionByProperty({ collider: true });
        
        // Guarda referência para usar no update
        this.solidsLayer = solidsLayer;
        
        // ===== ANIMAÇÃO DE TILES (Phaser não suporta nativamente) =====
        this.setupTileAnimations(solidsLayer, tilesetLavaRoxaAnim);
        
        // ===== OBJETOS DO MAPA (spawn, goal, checkpoints) =====
        const objectsLayer = map.getObjectLayer('objects');
        
        let playerSpawn = { x: 100, y: 100 }; // Posição padrão
        let goalPosition = { x: 500, y: 100 };
        const checkpoints = []; // Lista de checkpoints
        
        const trampolines = []; // Lista de trampolins
        const stars = []; // Lista de estrelas
        
        // Procura os objetos no mapa
        objectsLayer.objects.forEach(obj => {
            // Pega a propriedade 'type' que definimos no Tiled
            const type = obj.properties?.find(p => p.name === 'type')?.value;
            
            if (type === 'player_spawn') {
                // No Tiled, a posição Y é na base do objeto, então ajustamos
                playerSpawn = { x: obj.x + 16, y: obj.y - 16 };
            } else if (type === 'goal') {
                goalPosition = { x: obj.x + 16, y: obj.y - 16 };
            }
            
            // Checkpoint = bandeira amarela (gid 11)
            if (obj.gid === 11) {
                checkpoints.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            
            // Trampolim (gid 16)
            if (obj.gid === 16) {
                trampolines.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            
            // Estrela (gid 17 a 25, pois o tileset tem 9 frames)
            if (obj.gid >= 17 && obj.gid <= 25) {
                stars.push({ x: obj.x + 16, y: obj.y - 16 });
            }
        });
        
        // ===== CHECKPOINT - Guarda posições para depois =====
        this.checkpointPositions = checkpoints;
        this.currentCheckpoint = playerSpawn; // Começa no spawn
        
        // ===== BANDEIRA (OBJETIVO) =====
        this.goal = this.physics.add.staticSprite(goalPosition.x, goalPosition.y, 'green-flag');
        
        // Ajusta a hitbox da bandeira (pode ajustar os valores conforme necessário)
        this.goal.body.setSize(14, 28);  // Largura menor, altura um pouco menor
        this.goal.body.setOffset(10, 4); // Centraliza: (32-14)/2 = 9, 4px do topo
        
        // ===== HERÓI =====
        // Cria o sprite do herói com física
        this.player = this.physics.add.sprite(playerSpawn.x, playerSpawn.y, 'hero-idle');
        
        // Configura o corpo físico do herói
        this.player.setBounce(0); // Sem quicar
        this.player.body.setMaxVelocity(400, 1000); // Limita velocidade (X, Y) para evitar tunneling
        
        // Ajusta a hitbox (área de colisão)
        // Sprite é 32x32, mas o personagem tem apenas 14px de largura
        this.player.body.setSize(14, 30);
        // Centraliza a hitbox menor dentro do sprite
        this.player.body.setOffset(9, 2); // (32-14)/2 = 9
        
        // ===== ANIMAÇÕES =====
        this.createAnimations();
        
        // Inicia com a animação de parado
        this.player.anims.play('idle', true);
        
        // ===== COLISÕES =====
        // Herói colide com a camada de sólidos
        this.physics.add.collider(this.player, solidsLayer, this.handleTileCollision, null, this);
        
        // Herói toca a bandeira = vitória!
        this.physics.add.overlap(this.player, this.goal, this.reachGoal, null, this);
        
        // ===== CHECKPOINTS (BANDEIRA AMARELA) =====
        this.checkpoints = [];
        this.checkpointPositions.forEach(cp => {
            const flag = this.physics.add.staticSprite(cp.x, cp.y, 'yellow-flag');
            flag.checkpointPos = cp;
            flag.activated = false;
            this.checkpoints.push(flag);
            
            // Quando o jogador toca o checkpoint
            this.physics.add.overlap(this.player, flag, () => {
                if (!flag.activated) {
                    flag.activated = true;
                    flag.setTint(0x00ff00); // Fica verde quando ativado
                    this.currentCheckpoint = flag.checkpointPos;
                    this.showCheckpointMessage();
                }
            });
        });
        
        // ===== TRAMPOLINS (SUPER-PULO) =====
        this.trampolines = this.physics.add.staticGroup();
        trampolines.forEach(t => {
            // Cria sprite estático manualmente para controlar hitbox
            const trampoline = this.physics.add.staticSprite(t.x, t.y, 'trampoline');
            // Ajusta hitbox do trampolim (largura, altura)
            trampoline.body.setSize(32, 5);     // Mais largo, bem fino
            trampoline.body.setOffset(0, 27);   // Posiciona na parte de cima
            // Adiciona ao grupo depois de configurar
            this.trampolines.add(trampoline);
        });
        
        // Colisão com trampolim = super pulo
        this.physics.add.collider(this.player, this.trampolines, this.handleTrampolineCollision, null, this);
        
        // ===== ESTRELAS (COLECIONÁVEIS) =====
        this.stars = this.physics.add.group();
        stars.forEach(s => {
            const star = this.stars.create(s.x, s.y, 'star');
            star.body.allowGravity = false; // Estrela flutua
            star.anims.play('star-spin', true);
        });
        
        // Coleta de estrelas
        this.physics.add.overlap(this.player, this.stars, this.collectStar, null, this);
        
        // Contador de estrelas coletadas
        this.starsCollected = 0;
        this.totalStars = stars.length;
        
        // Cria HUD de estrelas (só se houver estrelas no mapa)
        if (this.totalStars > 0) {
            this.createStarHUD();
        }
        
        // ===== CÂMERA E LIMITES DO MUNDO =====
        // Define os limites do mundo físico (jogador não sai do mapa)
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.player.setCollideWorldBounds(true);
        
        // Define os limites da câmera (não mostra além do mapa)
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        
        // Câmera segue o jogador suavemente
        // Os valores 0.1, 0.1 controlam a suavidade (lerp) - menor = mais suave
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        
        // Aplica zoom customizado da fase (ou padrão)
        const zoom = levelConfig.zoom ?? LEVEL_DEFAULTS.zoom;
        this.cameras.main.setZoom(zoom);
        
        // Configura renderização de pixels (suaviza quando zoom < 1)
        const roundPixels = levelConfig.roundPixels ?? LEVEL_DEFAULTS.roundPixels;
        this.cameras.main.setRoundPixels(roundPixels);
        
        // Muda o filtro das texturas baseado na configuração da fase
        // NEAREST = pixels nítidos (padrão), LINEAR = suavizado (bom para zoom < 1)
        const filterMode = roundPixels 
            ? Phaser.Textures.FilterMode.NEAREST 
            : Phaser.Textures.FilterMode.LINEAR;
        
        this.textures.get('hero-idle').setFilter(filterMode);
        this.textures.get('hero-walk').setFilter(filterMode);
        this.textures.get('hero-jump').setFilter(filterMode);
        
        // ===== CONTROLES =====
        // Cria os cursores (setas do teclado)
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Adiciona tecla de espaço separadamente para o pulo
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Tecla H para ver ranking (durante o jogo)
        this.hKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
        this.hKey.on('down', () => {
            if (!this.hasWon) {
                this.showRanking();
            }
        });
        
        // Referência aos controles virtuais (mobile)
        this.virtualControls = window.virtualControls || {
            left: false,
            right: false,
            jump: false,
            jumpHeld: false,
            jumpJustPressed: false,
            restart: false
        };
        
        // Flag para controlar se já ganhou
        this.hasWon = false;
        
        // ===== CRONÔMETRO =====
        this.levelStartTime = this.time.now;
        this.elapsedTime = 0;
        this.createTimerUI();
        
        // Flag para o pulo variável
        this.isJumping = false;
        
        // Variáveis para aceleração de caminhada
        this.currentSpeed = 160;    // Velocidade atual
        this.lastDirection = 0;     // -1 = esquerda, 0 = parado, 1 = direita
        
        // Flag para evitar múltiplos respawns
        this.isRespawning = false;
        
        // ===== GAME FEEL: Coyote Time & Jump Buffer =====
        this.coyoteTime = 0;        // Tempo restante de "coyote time"
        this.jumpBufferTime = 0;    // Tempo restante de "jump buffer"
        this.wasOnGround = false;   // Estava no chão no frame anterior?
    }

    /**
     * Cria todas as animações do herói (só se não existirem)
     */
    createAnimations() {
        // Animação: Parado (idle)
        if (!this.anims.exists('idle')) {
            this.anims.create({
                key: 'idle',
                frames: this.anims.generateFrameNumbers('hero-idle', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1 // Loop infinito
            });
        }
        
        // Animação: Andando
        if (!this.anims.exists('walk')) {
            this.anims.create({
                key: 'walk',
                frames: this.anims.generateFrameNumbers('hero-walk', { start: 0, end: 3 }),
                frameRate: 14,
                repeat: -1
            });
        }
        
        // Pulo: não usa animação, troca frame manualmente baseado na velocidade
        // Frame 1 = subindo, Frame 2 = descendo
        
        // Animação: Estrela girando
        if (!this.anims.exists('star-spin')) {
            this.anims.create({
                key: 'star-spin',
                frames: this.anims.generateFrameNumbers('star', { start: 0, end: 8 }),
                frameRate: 12,
                repeat: -1
            });
        }
    }

    /**
     * Configura animação de tiles (Phaser não suporta nativamente do Tiled)
     */
    setupTileAnimations(layer, tileset) {
        // Se o tileset não existe neste mapa, sai
        if (!tileset) return;
        
        const firstGid = tileset.firstgid;
        const frameCount = 4; // Número de frames da animação
        const frameDuration = 200; // ms por frame
        
        let currentFrame = 0;
        
        // Timer que troca os frames periodicamente
        this.time.addEvent({
            delay: frameDuration,
            loop: true,
            callback: () => {
                // Próximo frame (loop de 0 a 3)
                currentFrame = (currentFrame + 1) % frameCount;
                
                // Percorre todos os tiles da camada
                layer.forEachTile(tile => {
                    if (tile.index >= firstGid && tile.index < firstGid + frameCount) {
                        // Este tile é do tileset animado - troca o frame
                        tile.index = firstGid + currentFrame;
                    }
                });
            }
        });
    }

    /**
     * UPDATE - Roda a cada frame (lógica do jogo)
     */
    update(time, delta) {
        // Atualiza cronômetro
        if (!this.hasWon) {
            this.updateTimer();
        }
        
        // Se já ganhou, verifica apenas input para continuar
        if (this.hasWon) {
            // Suporte mobile: botão de pulo avança para próxima fase
            if (this.virtualControls.jumpJustPressed) {
                this.virtualControls.jumpJustPressed = false;
                this.scene.restart({ level: this.nextLevelOnContinue });
            }
            return;
        }
        
        const player = this.player;
        const onGround = player.body.blocked.down; // Está no chão?
        
        // Velocidade de movimento
        const MIN_SPEED = 160;           // Velocidade inicial
        const MAX_SPEED = 260;           // Velocidade máxima (com embalo)
        const ACCELERATION = 200;        // Quão rápido pega embalo (pixels/s²)
        const JUMP_FORCE = -480;         // Força do pulo (+20% para compensar gravidade maior)
        const JUMP_CUT_MULTIPLIER = 0.4; // Quanto da velocidade mantém ao soltar (40%)
        const FALL_GRAVITY_MULT = 0.5;   // Gravidade extra na descida (1 + 0.5 = 1.5x)
        
        // Tempo do frame em segundos
        const dt = delta / 1000;
        
        // ===== MOVIMENTO HORIZONTAL COM ACELERAÇÃO =====
        let direction = 0; // -1 = esquerda, 0 = parado, 1 = direita
        
        // Movimento (teclado + touch)
        const moveLeft = this.cursors.left.isDown || this.virtualControls.left;
        const moveRight = this.cursors.right.isDown || this.virtualControls.right;
        
        if (moveLeft) {
            direction = -1;
        } else if (moveRight) {
            direction = 1;
        }
        
        // Reseta velocidade se mudou de direção ou parou
        if (direction !== this.lastDirection) {
            this.currentSpeed = MIN_SPEED;
        }
        this.lastDirection = direction;
        
        if (direction !== 0) {
            // Aumenta velocidade gradualmente até o máximo (embalo)
            this.currentSpeed = Math.min(this.currentSpeed + ACCELERATION * dt, MAX_SPEED);
            player.setVelocityX(direction * this.currentSpeed);
            player.setFlipX(direction < 0);
            
            if (onGround) {
                player.anims.play('walk', true);
            }
        } else {
            // Parado
            player.setVelocityX(0);
            
            if (onGround) {
                player.anims.play('idle', true);
            }
        }
        
        // ===== PULO VARIÁVEL (estilo Super Mario World) =====
        // JustDown = true apenas no frame que apertou (não enquanto segura)
        const jumpJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) || 
                                Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
                                this.virtualControls.jumpJustPressed;
        // isDown = true enquanto o botão está segurado
        const jumpHeld = this.cursors.up.isDown || this.spaceKey.isDown || this.virtualControls.jumpHeld;
        
        // Reseta o flag de "just pressed" do touch após processar
        if (this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
        }
        
        // Restart via controle virtual (mobile)
        if (this.virtualControls.restart) {
            this.virtualControls.restart = false;
            this.scene.restart({ level: this.currentLevel });
        }
        
        // ===== COYOTE TIME (permite pular logo após sair da plataforma) =====
        const COYOTE_DURATION = 100; // ms de tolerância após sair da plataforma
        
        if (onGround) {
            this.coyoteTime = COYOTE_DURATION; // Reseta quando no chão
        } else {
            this.coyoteTime -= delta; // Diminui quando no ar
        }
        
        const canCoyoteJump = this.coyoteTime > 0;
        
        // ===== JUMP BUFFER (registra pulo antes de chegar no chão) =====
        const JUMP_BUFFER_DURATION = 100; // ms de tolerância antes de tocar o chão
        
        if (jumpJustPressed) {
            this.jumpBufferTime = JUMP_BUFFER_DURATION; // Registra tentativa de pulo
        } else {
            this.jumpBufferTime -= delta; // Diminui com o tempo
        }
        
        const hasBufferedJump = this.jumpBufferTime > 0;
        
        // Reseta a flag quando tocar no chão
        if (onGround) {
            this.isJumping = false;
        }
        
        // Inicia o pulo se:
        // - Acabou de apertar E (está no chão OU tem coyote time)
        // - OU está no chão E tem pulo no buffer
        const shouldJump = (jumpJustPressed && canCoyoteJump) || (onGround && hasBufferedJump);
        
        if (shouldJump && !this.isJumping) {
            player.setVelocityY(JUMP_FORCE);
            this.isJumping = true;
            this.coyoteTime = 0;      // Consome o coyote time
            this.jumpBufferTime = 0;  // Consome o buffer
        }
        
        // Se soltou o botão enquanto está subindo, corta a velocidade
        // Isso faz o pulo ser mais curto!
        if (!jumpHeld && this.isJumping && player.body.velocity.y < 0) {
            player.setVelocityY(player.body.velocity.y * JUMP_CUT_MULTIPLIER);
            this.isJumping = false;
        }
        
        // ===== GRAVIDADE AUMENTADA NA DESCIDA (1.5x) =====
        if (!onGround && player.body.velocity.y > 0) {
            // Aplica gravidade extra quando está caindo
            const extraGravity = this.physics.world.gravity.y * FALL_GRAVITY_MULT * (delta / 1000);
            player.setVelocityY(player.body.velocity.y + extraGravity);
        }
        
        // ===== ANIMAÇÃO NO AR =====
        // Troca o frame baseado na direção vertical
        if (!onGround) {
            player.anims.stop(); // Para qualquer animação rodando
            
            if (player.body.velocity.y < 0) {
                // Subindo - Frame 1
                player.setTexture('hero-jump', 1);
            } else {
                // Descendo - Frame 2
                player.setTexture('hero-jump', 2);
            }
        }
    }

    /**
     * Mostra o nome da fase no início
     */
    showLevelName(name) {
        const text = this.add.text(this.cameras.main.centerX, 50, name, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        
        // Fade out após 2 segundos
        this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 500,
            delay: 1500,
            onComplete: () => text.destroy()
        });
    }

    /**
     * Cria UI do cronômetro
     */
    createTimerUI() {
        // Texto do cronômetro (canto superior direito)
        this.timerText = this.add.text(this.cameras.main.width - 16, 16, '⏱ 0:00.000', {
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        
        // Mostra recorde da fase (se existir)
        const bestTime = this.getBestTime(this.currentLevel);
        if (bestTime !== null) {
            this.bestTimeText = this.add.text(this.cameras.main.width - 16, 38, `🏆 ${this.formatTime(bestTime)}`, {
                fontSize: '14px',
                fontFamily: 'monospace',
                color: '#ffd700',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        }
    }

    /**
     * Atualiza o display do cronômetro
     */
    updateTimer() {
        if (this.hasWon) return;
        
        this.elapsedTime = this.time.now - this.levelStartTime;
        this.timerText.setText(`⏱ ${this.formatTime(this.elapsedTime)}`);
    }

    /**
     * Formata tempo em milissegundos para M:SS.mmm
     */
    formatTime(ms) {
        const totalSeconds = ms / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const millis = Math.floor(ms % 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    }

    /**
     * Obtém o melhor tempo de uma fase do localStorage
     */
    getBestTime(level) {
        const key = `rockHero_bestTime_level${level}`;
        const stored = localStorage.getItem(key);
        return stored ? parseFloat(stored) : null;
    }

    /**
     * Salva o tempo se for um novo recorde
     */
    saveBestTime(level, time) {
        const key = `rockHero_bestTime_level${level}`;
        const currentBest = this.getBestTime(level);
        
        if (currentBest === null || time < currentBest) {
            localStorage.setItem(key, time.toString());
            return true; // É um novo recorde!
        }
        return false;
    }

    /**
     * Obtém o tempo total (soma de todos os melhores tempos)
     */
    getTotalBestTime() {
        let total = 0;
        for (let i = 0; i < LEVELS.length; i++) {
            const best = this.getBestTime(i);
            if (best !== null) {
                total += best;
            } else {
                return null; // Ainda não completou todas as fases
            }
        }
        return total;
    }

    /**
     * Mostra tela de ranking de hi-scores
     */
    showRanking() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        
        // Fundo semi-transparente
        const overlay = this.add.rectangle(centerX, centerY, 640, 400, 0x000000, 0.9)
            .setScrollFactor(0).setDepth(200);
        
        // Título
        const title = this.add.text(centerX, centerY - 160, '🏆 RANKING DE HI-SCORES 🏆', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        
        // Lista de tempos por fase
        let yOffset = -100;
        let hasAnyRecord = false;
        
        for (let i = 0; i < LEVELS.length; i++) {
            const bestTime = this.getBestTime(i);
            const levelName = LEVELS[i].name || `Fase ${i + 1}`;
            
            if (bestTime !== null) {
                hasAnyRecord = true;
                const timeText = this.formatTime(bestTime);
                this.add.text(centerX, centerY + yOffset, `${levelName}: ${timeText}`, {
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
                yOffset += 30;
            } else {
                this.add.text(centerX, centerY + yOffset, `${levelName}: --:--.---`, {
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    color: '#666666',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
                yOffset += 30;
            }
        }
        
        // Tempo total
        const totalBest = this.getTotalBestTime();
        if (totalBest !== null) {
            yOffset += 20;
            this.add.text(centerX, centerY + yOffset, `━━━━━━━━━━━━━━━━━━━━`, {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#888888'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
            yOffset += 30;
            this.add.text(centerX, centerY + yOffset, `Tempo Total: ${this.formatTime(totalBest)}`, {
                fontSize: '22px',
                fontFamily: 'monospace',
                color: '#00ffff',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        }
        
        // Instrução para fechar
        const closeText = this.add.text(centerX, centerY + 150, 'Pressione ESC para fechar', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#aaaaaa'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        
        // Listener para fechar
        const closeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        closeKey.once('down', () => {
            overlay.destroy();
            title.destroy();
            closeText.destroy();
            closeKey.destroy();
            // Destroi todos os textos de ranking
            this.children.list.forEach(child => {
                if (child.depth === 201 && child !== title && child !== closeText) {
                    child.destroy();
                }
            });
        });
    }

    /**
     * Chamado quando o herói toca a bandeira
     */
    reachGoal() {
        if (this.hasWon) return;
        
        this.hasWon = true;
        
        // Para o jogador
        this.player.setVelocity(0, 0);
        this.player.anims.play('idle', true);
        
        // Salva o tempo final e verifica se é recorde
        const finalTime = this.elapsedTime;
        const isNewRecord = this.saveBestTime(this.currentLevel, finalTime);
        const bestTime = this.getBestTime(this.currentLevel);
        
        // Verifica se há próxima fase
        const nextLevel = this.currentLevel + 1;
        const hasNextLevel = nextLevel < LEVELS.length;
        
        // Mostra mensagem
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        
        // Fundo semi-transparente (fixo na câmera)
        const overlay = this.add.rectangle(centerX, centerY, 640, 400, 0x000000, 0.8)
            .setScrollFactor(0).setDepth(101);
        
        // Guarda o próximo nível para uso no update (suporte mobile)
        this.nextLevelOnContinue = hasNextLevel ? nextLevel : 0;
        
        // Detecta se é dispositivo touch
        const isMobile = window.virtualControls && (
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            window.location.search.includes('mobile=true')
        );
        const continueText = isMobile ? 'Toque no botão de PULO para continuar' : 'Pressione ESPAÇO para continuar';
        
        if (hasNextLevel) {
            // Ainda há fases!
            const winText = this.add.text(centerX, centerY - 60, '✅ FASE COMPLETA!', {
                fontSize: '32px',
                fontFamily: 'Arial',
                color: '#00ff00',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            // Tempo atual
            const timeColor = isNewRecord ? '#ffd700' : '#ffffff';
            const recordLabel = isNewRecord ? ' 🏆 NOVO RECORDE!' : '';
            this.add.text(centerX, centerY - 15, `⏱ Tempo: ${this.formatTime(finalTime)}${recordLabel}`, {
                fontSize: '20px',
                fontFamily: 'monospace',
                color: timeColor,
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            // Melhor tempo (se não for recorde)
            if (!isNewRecord && bestTime) {
                this.add.text(centerX, centerY + 15, `🏆 Recorde: ${this.formatTime(bestTime)}`, {
                    fontSize: '16px',
                    fontFamily: 'monospace',
                    color: '#aaaaaa'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            }
            
            const nextText = this.add.text(centerX, centerY + 55, continueText, {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            // Aguarda espaço para próxima fase
            this.input.keyboard.once('keydown-SPACE', () => {
                this.scene.restart({ level: nextLevel });
            });
        } else {
            // Última fase - vitória total!
            const winText = this.add.text(centerX, centerY - 80, '🎉 VOCÊ ZEROU O JOGO! 🎉', {
                fontSize: '28px',
                fontFamily: 'Arial',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            // Tempo da fase
            const timeColor = isNewRecord ? '#ffd700' : '#ffffff';
            const recordLabel = isNewRecord ? ' 🏆 NOVO RECORDE!' : '';
            this.add.text(centerX, centerY - 35, `⏱ Fase: ${this.formatTime(finalTime)}${recordLabel}`, {
                fontSize: '18px',
                fontFamily: 'monospace',
                color: timeColor,
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            // Tempo total (soma dos melhores tempos)
            const totalBest = this.getTotalBestTime();
            if (totalBest !== null) {
                this.add.text(centerX, centerY + 5, `🏅 Tempo Total: ${this.formatTime(totalBest)}`, {
                    fontSize: '22px',
                    fontFamily: 'monospace',
                    color: '#00ffff',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            }
            
            const restartText = this.add.text(centerX, centerY + 55, continueText, {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            // Botão para ver ranking
            const rankingText = this.add.text(centerX, centerY + 85, 'Pressione H para ver o ranking', {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#ffd700'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            // Aguarda espaço para reiniciar do começo
            this.input.keyboard.once('keydown-SPACE', () => {
                this.scene.restart({ level: 0 });
            });
            
            // Tecla H para ver ranking
            const hKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
            hKey.on('down', () => {
                this.showRanking();
            });
        }
    }

    /**
     * Chamado quando o herói colide com um tile
     */
    handleTileCollision(player, tile) {
        // Verifica se o tile tem a propriedade 'jump_back_to_checkpoint'
        if (tile.properties && tile.properties.jump_back_to_checkpoint) {
            this.respawnAtCheckpoint();
        }
    }
    
    /**
     * Chamado quando o herói colide com trampolim
     */
    handleTrampolineCollision(player, trampoline) {
        // Só aplica super-pulo se estiver caindo ou parado em cima
        // E se não acabou de pular (evita loop infinito)
        if (player.body.velocity.y >= 0 && !trampoline.justBounced) {
            const SUPER_JUMP_FORCE = -990; // Super pulo (dobro da altura)
            player.setVelocityY(SUPER_JUMP_FORCE);
            this.isJumping = true;
            
            // Flag para evitar múltiplos pulos
            trampoline.justBounced = true;
            this.time.delayedCall(200, () => {
                trampoline.justBounced = false;
            });
            
            // Efeito visual no trampolim
            this.tweens.add({
                targets: trampoline,
                scaleY: 0.6,
                duration: 80,
                yoyo: true,
                ease: 'Power2'
            });
        }
    }
    
    /**
     * Chamado quando o herói coleta uma estrela
     */
    collectStar(player, star) {
        // Remove a estrela do jogo
        star.disableBody(true, true);
        
        // Incrementa contador
        this.starsCollected++;
        
        // Atualiza HUD
        this.updateStarHUD();
        
        // Efeito visual de coleta
        this.tweens.add({
            targets: this.starHUD,
            scale: 1.3,
            duration: 100,
            yoyo: true,
            ease: 'Power2'
        });
    }

    /**
     * Cria o HUD de estrelas no canto da tela
     */
    createStarHUD() {
        // Container para o HUD (fixo na tela)
        this.starHUD = this.add.container(50, 30).setScrollFactor(0).setDepth(100);
        
        // Ícone da estrela
        const starIcon = this.add.sprite(0, 0, 'star', 0);
        starIcon.setScale(1.2);
        
        // Texto do contador
        this.starText = this.add.text(24, 0, '0', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0.5);
        
        this.starHUD.add([starIcon, this.starText]);
    }
    
    /**
     * Atualiza o contador de estrelas no HUD
     */
    updateStarHUD() {
        if (this.starText) {
            this.starText.setText(`${this.starsCollected}`);
        }
    }

    /**
     * Mostra mensagem de checkpoint ativado
     */
    showCheckpointMessage() {
        const text = this.add.text(this.cameras.main.centerX, 80, '🚩 CHECKPOINT!', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        
        // Fade out após 1 segundo
        this.tweens.add({
            targets: text,
            alpha: 0,
            y: 60,
            duration: 500,
            delay: 800,
            onComplete: () => text.destroy()
        });
    }

    /**
     * Arremessa o jogador de volta ao checkpoint
     */
    respawnAtCheckpoint() {
        // Evita múltiplos respawns
        if (this.isRespawning) return;
        this.isRespawning = true;
        
        // Desativa a física temporariamente para o tween controlar a posição
        this.player.body.enable = false;
        
        // Posição atual e destino
        const startX = this.player.x;
        const startY = this.player.y;
        const endX = this.currentCheckpoint.x;
        const endY = this.currentCheckpoint.y;
        
        // Altura do arco (quanto maior, mais alto o arremesso)
        const arcHeight = 150;
        
        // Duração do voo (baseado na distância)
        const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const duration = Math.max(400, Math.min(800, distance * 0.8));
        
        // Faz o jogador piscar/brilhar durante o voo
        this.player.setTint(0xff6666);
        
        // Animação de arremesso em arco
        this.tweens.add({
            targets: this.player,
            x: endX,
            y: endY,
            duration: duration,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
                // Calcula a posição no arco (parábola)
                const progress = tween.progress;
                // Fórmula do arco: sobe no início, desce no final
                const arc = Math.sin(progress * Math.PI) * arcHeight;
                
                // Ajusta Y para criar o arco (subtrai porque Y cresce para baixo)
                const linearY = Phaser.Math.Linear(startY, endY, progress);
                this.player.y = linearY - arc;
                
                // Gira o sprite durante o voo
                this.player.angle = progress * 360;
            },
            onComplete: () => {
                // Restaura o jogador
                this.player.angle = 0;
                this.player.clearTint();
                this.player.body.enable = true;
                this.player.setVelocity(0, 0);
                this.isRespawning = false;
            }
        });
    }
}
