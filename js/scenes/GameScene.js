/**
 * GAME SCENE - Cena Principal do Jogo
 * 
 * Uma cena no Phaser tem 3 métodos principais:
 * - preload(): Carrega assets (imagens, sons, mapas)
 * - create(): Cria objetos do jogo (sprites, física, animações)
 * - update(): Roda a cada frame (60x por segundo) - lógica do jogo
 */

class GameScene extends Phaser.Scene {
    constructor() {
        // Nome único da cena
        super({ key: 'GameScene' });
    }

    /**
     * PRELOAD - Carrega todos os assets antes do jogo começar
     */
    preload() {
        // Carrega o mapa do Tiled (formato JSON)
        this.load.tilemapTiledJSON('map', 'assets/map.json');
        
        // Carrega os tilesets (imagens dos tiles)
        this.load.image('grass', 'assets/spritesheets/grass.png');
        this.load.image('bricks', 'assets/spritesheets/bricks.png');
        this.load.image('abstract-background', 'assets/spritesheets/abstract-background.png');
        this.load.image('green-flag', 'assets/spritesheets/green-flag.png');
        
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
        // Cria o tilemap a partir do JSON carregado
        const map = this.make.tilemap({ key: 'map' });
        
        // Conecta as imagens aos tilesets do mapa
        // O primeiro parâmetro é o nome do tileset no Tiled
        // O segundo é a key da imagem carregada no preload
        const tilesetGrass = map.addTilesetImage('grass', 'grass');
        const tilesetBricks = map.addTilesetImage('bricks', 'bricks');
        const tilesetBg = map.addTilesetImage('abstract-background', 'abstract-background');
        
        // Cria as camadas do mapa
        // O nome deve ser igual ao nome da camada no Tiled
        const bgLayer = map.createLayer('bg', [tilesetBg]);
        const solidsLayer = map.createLayer('solids', [tilesetGrass, tilesetBricks]);
        
        // Ativa colisão nos tiles que têm a propriedade 'collider' = true
        solidsLayer.setCollisionByProperty({ collider: true });
        
        // Guarda referência para usar no update
        this.solidsLayer = solidsLayer;
        
        // ===== OBJETOS DO MAPA (spawn, goal) =====
        const objectsLayer = map.getObjectLayer('objects');
        
        let playerSpawn = { x: 100, y: 100 }; // Posição padrão
        let goalPosition = { x: 500, y: 100 };
        
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
        });
        
        // ===== BANDEIRA (OBJETIVO) =====
        this.goal = this.physics.add.staticSprite(goalPosition.x, goalPosition.y, 'green-flag');
        
        // Ajusta a hitbox da bandeira (pode ajustar os valores conforme necessário)
        this.goal.body.setSize(14, 28);  // Largura menor, altura um pouco menor
        this.goal.body.setOffset(9, 4); // Centraliza: (32-14)/2 = 9, 4px do topo
        
        // ===== HERÓI =====
        // Cria o sprite do herói com física
        this.player = this.physics.add.sprite(playerSpawn.x, playerSpawn.y, 'hero-idle');
        
        // Configura o corpo físico do herói
        this.player.setCollideWorldBounds(true); // Não sai da tela
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
        this.physics.add.collider(this.player, solidsLayer);
        
        // Herói toca a bandeira = vitória!
        this.physics.add.overlap(this.player, this.goal, this.reachGoal, null, this);
        
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
     * Chamado quando o herói toca a bandeira
     */
    reachGoal() {
        if (this.hasWon) return;
        
        this.hasWon = true;
        
        // Para o jogador
        this.player.setVelocity(0, 0);
        this.player.anims.play('idle', true);
        
        // Mostra mensagem de vitória
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        
        // Fundo semi-transparente
        const overlay = this.add.rectangle(centerX, centerY, 640, 352, 0x000000, 0.7);
        
        // Texto de vitória
        const winText = this.add.text(centerX, centerY - 30, '🎉 VOCÊ VENCEU! 🎉', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Instrução para reiniciar
        const restartText = this.add.text(centerX, centerY + 30, 'Pressione ESPAÇO para jogar novamente', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Aguarda espaço para reiniciar
        this.input.keyboard.once('keydown-SPACE', () => {
            this.hasWon = false;
            this.scene.restart();
        });
    }
}
