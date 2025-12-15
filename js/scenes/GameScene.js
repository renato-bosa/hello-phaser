/**
 * GAME SCENE - Cena Principal do Jogo
 * 
 * Uma cena no Phaser tem 3 métodos principais:
 * - preload(): Carrega assets (imagens, sons, mapas)
 * - create(): Cria objetos do jogo (sprites, física, animações)
 * - update(): Roda a cada frame (60x por segundo) - lógica do jogo
 */

// Lista de mapas do jogo (fases)
const LEVELS = [
    { key: 'map1', file: 'assets/map.json', name: 'Fase 1' },
    { key: 'map2', file: 'assets/map-2--expansion and speed.json', name: 'Fase 2' }
];

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
        this.load.image('bricks', 'assets/spritesheets/bricks.png');
        this.load.image('abstract-background', 'assets/spritesheets/abstract-background.png');
        this.load.image('black', 'assets/spritesheets/black.png');
        this.load.image('green-flag', 'assets/spritesheets/green-flag.png');
        this.load.image('yellow-flag', 'assets/spritesheets/yellow-flag.png');
        this.load.image('lava', 'assets/spritesheets/lava.png');
        this.load.image('lava-roxa', 'assets/spritesheets/lava-roxa.png');
        
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
        
        // Conecta as imagens aos tilesets do mapa
        // O primeiro parâmetro é o nome do tileset no Tiled
        // O segundo é a key da imagem carregada no preload
        const tilesetGrass = map.addTilesetImage('grass', 'grass');
        const tilesetBricks = map.addTilesetImage('bricks', 'bricks');
        const tilesetLava = map.addTilesetImage('lava', 'lava');
        const tilesetLavaRoxa = map.addTilesetImage('lava-roxa', 'lava-roxa');
        
        // Tenta carregar ambos os tilesets de fundo (cada mapa usa um diferente)
        const tilesetAbstractBg = map.addTilesetImage('abstract-background', 'abstract-background');
        const tilesetBlackBg = map.addTilesetImage('black', 'black');
        
        // Cria as camadas do mapa (usa os tilesets disponíveis)
        const bgTilesets = [tilesetAbstractBg, tilesetBlackBg].filter(t => t !== null);
        const bgLayer = map.createLayer('bg', bgTilesets);
        
        // Tilesets da camada de sólidos (incluindo lava)
        const solidTilesets = [tilesetGrass, tilesetBricks, tilesetLava, tilesetLavaRoxa].filter(t => t !== null);
        const solidsLayer = map.createLayer('solids', solidTilesets);
        
        // Ativa colisão nos tiles que têm a propriedade 'collider' = true
        solidsLayer.setCollisionByProperty({ collider: true });
        
        // Guarda referência para usar no update
        this.solidsLayer = solidsLayer;
        
        // ===== OBJETOS DO MAPA (spawn, goal, checkpoints) =====
        const objectsLayer = map.getObjectLayer('objects');
        
        let playerSpawn = { x: 100, y: 100 }; // Posição padrão
        let goalPosition = { x: 500, y: 100 };
        const checkpoints = []; // Lista de checkpoints
        
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
        
        // ===== CÂMERA E LIMITES DO MUNDO =====
        // Define os limites do mundo físico (jogador não sai do mapa)
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.player.setCollideWorldBounds(true);
        
        // Define os limites da câmera (não mostra além do mapa)
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        
        // Câmera segue o jogador suavemente
        // Os valores 0.1, 0.1 controlam a suavidade (lerp) - menor = mais suave
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        
        // ===== CONTROLES =====
        // Cria os cursores (setas do teclado)
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Adiciona tecla de espaço separadamente para o pulo
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Flag para controlar se já ganhou
        this.hasWon = false;
        
        // Flag para o pulo variável
        this.isJumping = false;
        
        // Variáveis para aceleração de caminhada
        this.currentSpeed = 160;    // Velocidade atual
        this.lastDirection = 0;     // -1 = esquerda, 0 = parado, 1 = direita
        
        // Flag para evitar múltiplos respawns
        this.isRespawning = false;
    }

    /**
     * Cria todas as animações do herói
     */
    createAnimations() {
        // Animação: Parado (idle)
        this.anims.create({
            key: 'idle',
            frames: this.anims.generateFrameNumbers('hero-idle', { start: 0, end: 3 }),
            frameRate: 6,
            repeat: -1 // Loop infinito
        });
        
        // Animação: Andando
        this.anims.create({
            key: 'walk',
            frames: this.anims.generateFrameNumbers('hero-walk', { start: 0, end: 3 }),
            frameRate: 14,
            repeat: -1
        });
        
        // Pulo: não usa animação, troca frame manualmente baseado na velocidade
        // Frame 1 = subindo, Frame 2 = descendo
    }

    /**
     * UPDATE - Roda a cada frame (lógica do jogo)
     */
    update(time, delta) {
        // Se já ganhou, não processa mais controles
        if (this.hasWon) return;
        
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
        
        if (this.cursors.left.isDown) {
            direction = -1;
        } else if (this.cursors.right.isDown) {
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
                                Phaser.Input.Keyboard.JustDown(this.spaceKey);
        // isDown = true enquanto o botão está segurado
        const jumpHeld = this.cursors.up.isDown || this.spaceKey.isDown;
        
        // Reseta a flag quando tocar no chão
        if (onGround) {
            this.isJumping = false;
        }
        
        // Inicia o pulo APENAS se acabou de apertar (não se está segurando)
        if (jumpJustPressed && onGround) {
            player.setVelocityY(JUMP_FORCE);
            this.isJumping = true;
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
     * Chamado quando o herói toca a bandeira
     */
    reachGoal() {
        if (this.hasWon) return;
        
        this.hasWon = true;
        
        // Para o jogador
        this.player.setVelocity(0, 0);
        this.player.anims.play('idle', true);
        
        // Verifica se há próxima fase
        const nextLevel = this.currentLevel + 1;
        const hasNextLevel = nextLevel < LEVELS.length;
        
        // Mostra mensagem
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        
        // Fundo semi-transparente (fixo na câmera)
        const overlay = this.add.rectangle(centerX, centerY, 640, 352, 0x000000, 0.7)
            .setScrollFactor(0).setDepth(101);
        
        if (hasNextLevel) {
            // Ainda há fases!
            const winText = this.add.text(centerX, centerY - 30, '✅ FASE COMPLETA!', {
                fontSize: '32px',
                fontFamily: 'Arial',
                color: '#00ff00',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            const nextText = this.add.text(centerX, centerY + 30, 'Pressione ESPAÇO para a próxima fase', {
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
            const winText = this.add.text(centerX, centerY - 30, '🎉 VOCÊ ZEROU O JOGO! 🎉', {
                fontSize: '28px',
                fontFamily: 'Arial',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            const restartText = this.add.text(centerX, centerY + 30, 'Pressione ESPAÇO para jogar novamente', {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            
            // Aguarda espaço para reiniciar do começo
            this.input.keyboard.once('keydown-SPACE', () => {
                this.scene.restart({ level: 0 });
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
