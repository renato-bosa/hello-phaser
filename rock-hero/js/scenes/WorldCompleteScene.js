/**
 * WORLD COMPLETE SCENE - Tela de Comemoração
 * 
 * Exibida quando o jogador completa todas as fases de um mundo
 * e resgata um novo integrante da banda.
 */

class WorldCompleteScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WorldCompleteScene' });
    }

    init(data) {
        this.worldData = data.world;
        this.playerName = data.playerName || 'Anônimo';
        this.totalTime = data.totalTime || 0;
    }

    preload() {
        // Carrega sprites do personagem resgatado (definição centralizada em GameData)
        GameData.loadCharacterSprites(this, this.worldData.rescuedCharacter);
    }

    create() {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Fundo escuro com gradiente
        this.createBackground(width, height);

        // Container principal com todos os elementos
        this.mainContainer = this.add.container(centerX, centerY);

        // Efeito de partículas de confete
        this.createConfetti(width, height);

        // Título "MUNDO COMPLETO!"
        this.createTitle(centerX, centerY);

        // Personagem resgatado com animação
        this.createRescuedCharacter(centerX, centerY);

        // Mensagem de resgate
        this.createRescueMessage(centerX, centerY);

        // Estatísticas
        this.createStats(centerX, centerY);

        // Botão de continuar
        this.createContinueButton(centerX, centerY);

        // Som de vitória/fanfarra
        if (typeof SoundManager !== 'undefined') {
            SoundManager.play('goalReached');
            // Toca um som extra de "novo personagem"
            this.time.delayedCall(500, () => {
                SoundManager.play('newRecord');
            });
        }

        // Input para continuar
        this.input.keyboard.on('keydown-ENTER', () => this.continue());
        this.input.keyboard.on('keydown-SPACE', () => this.continue());
        this.input.keyboard.on('keydown-ESC', () => this.continue());
        
        // Suporte a controles virtuais (mobile) - verificado no update()
        this.virtualControls = GameData.getVirtualControls();
    }

    update() {
        // O = continuar
        if (this.virtualControls && this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
            this.continue();
        }
        // X = continuar (também funciona como voltar)
        if (this.virtualControls && this.virtualControls.backJustPressed) {
            this.virtualControls.backJustPressed = false;
            this.continue();
        }
    }

    createBackground(width, height) {
        // Fundo gradiente escuro
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x16213e, 0x16213e, 1);
        bg.fillRect(0, 0, width, height);

        // Adiciona estrelas decorativas no fundo
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.Between(1, 3);
            const alpha = Phaser.Math.FloatBetween(0.3, 0.8);
            
            const star = this.add.circle(x, y, size, 0xffffff, alpha);
            
            // Animação de brilho
            this.tweens.add({
                targets: star,
                alpha: { from: alpha, to: alpha * 0.3 },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1
            });
        }
    }

    createConfetti(width, height) {
        // Partículas de confete colorido
        const colors = [0xff6b6b, 0xffd93d, 0x6bcf7f, 0x4ecdc4, 0xa855f7, 0xf472b6];
        
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(-50, -10);
            const color = Phaser.Math.RND.pick(colors);
            
            const confetti = this.add.rectangle(x, y, 8, 12, color);
            confetti.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
            
            // Animação de queda
            this.tweens.add({
                targets: confetti,
                y: height + 50,
                rotation: confetti.rotation + Phaser.Math.FloatBetween(2, 6),
                duration: Phaser.Math.Between(3000, 6000),
                delay: Phaser.Math.Between(0, 2000),
                repeat: -1
            });
        }
    }

    createTitle(centerX, centerY) {
        const { height } = this.cameras.main;
        
        // "MUNDO X COMPLETO!" - posicionado a 8% do topo
        const titleY = height * 0.08;
        const titleText = this.add.text(centerX, titleY, `🎉 ${this.worldData.name.toUpperCase()} COMPLETO! 🎉`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '24px',
            color: '#ffd700',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Animação de pulso
        this.tweens.add({
            targets: titleText,
            scale: { from: 1, to: 1.05 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        // Efeito de entrada
        titleText.setAlpha(0);
        titleText.setScale(0.5);
        this.tweens.add({
            targets: titleText,
            alpha: 1,
            scale: 1,
            duration: 800,
            ease: 'Back.easeOut'
        });
    }

    createRescuedCharacter(centerX, centerY) {
        const { height } = this.cameras.main;
        const character = GameData.getCharacter(this.worldData.rescuedCharacter);
        
        // Posições baseadas em percentual da altura
        const spriteY = height * 0.38;      // 38% - sprite do personagem
        const nameY = height * 0.60;        // 58% - nome
        const instrumentY = height * 0.65;  // 65% - instrumento
        
        // Usa dados centralizados do GameData
        const idleSprite = character.sprites.idle;
        const spriteKey = idleSprite.key;
        const frameRate = idleSprite.frameRate;
        const endFrame = idleSprite.endFrame;
        
        // Cria animação do personagem
        const animKey = `rescued-${character.id}-idle`;
        if (!this.anims.exists(animKey)) {
            this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers(spriteKey, { start: idleSprite.startFrame, end: endFrame }),
                frameRate: frameRate,
                repeat: -1
            });
        }

        // Círculo de luz atrás do personagem (cor baseada no personagem)
        const glowColor = character.id === 'baixista' ? 0x00aaff : 0xffd700;
        const glow = this.add.circle(centerX, spriteY, 60, glowColor, 0.3);
        this.tweens.add({
            targets: glow,
            scale: { from: 1, to: 1.3 },
            alpha: { from: 0.3, to: 0.1 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // Sprite do personagem
        // Aplica filtro pixel art nítido
        GameData.applyPixelArtFilter(this, character.id);
        
        const sprite = this.add.sprite(centerX, spriteY, spriteKey);
        sprite.setScale(4); // Escala maior para destaque
        sprite.play(animKey);

        // Efeito de entrada
        sprite.setAlpha(0);
        sprite.setScale(0);
        this.tweens.add({
            targets: sprite,
            alpha: 1,
            scale: 4,
            duration: 1000,
            delay: 500,
            ease: 'Back.easeOut'
        });

        // Nome do personagem abaixo
        const nameText = this.add.text(centerX, nameY, character.name.toUpperCase(), {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        nameText.setAlpha(0);
        this.tweens.add({
            targets: nameText,
            alpha: 1,
            duration: 500,
            delay: 1200
        });

        // Instrumento
        const instrumentText = this.add.text(centerX, instrumentY, `🥁 ${character.instrument}`, {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#aaaaaa',
            align: 'center'
        }).setOrigin(0.5);

        instrumentText.setAlpha(0);
        this.tweens.add({
            targets: instrumentText,
            alpha: 1,
            duration: 500,
            delay: 1400
        });
    }

    createRescueMessage(centerX, centerY) {
        const { height } = this.cameras.main;
        
        // Posições baseadas em percentual
        const messageY = height * 0.20;    // 20% - acima do sprite
        const unlockY = height * 0.72;     // 72%
        
        const message = this.add.text(centerX, messageY, this.worldData.celebrationMessage, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#4ecdc4',
            align: 'center'
        }).setOrigin(0.5);

        message.setAlpha(0);
        this.tweens.add({
            targets: message,
            alpha: 1,
            duration: 500,
            delay: 500
        });

        // Mensagem de personagem desbloqueado
        const unlockMsg = this.add.text(centerX, unlockY, '✨ NOVO PERSONAGEM DESBLOQUEADO! ✨', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#a855f7',
            align: 'center'
        }).setOrigin(0.5);

        unlockMsg.setAlpha(0);
        this.tweens.add({
            targets: unlockMsg,
            alpha: 1,
            duration: 500,
            delay: 1800
        });

        // Animação de brilho no texto de desbloqueio
        this.tweens.add({
            targets: unlockMsg,
            alpha: { from: 1, to: 0.5 },
            duration: 500,
            yoyo: true,
            repeat: -1,
            delay: 2300
        });
    }

    createStats(centerX, centerY) {
        const { height } = this.cameras.main;
        const statsY = height * 0.80; // 80%
        
        // Tempo total do mundo
        if (this.totalTime > 0) {
            const timeText = this.add.text(centerX, statsY, 
                `Tempo Total: ${GameData.formatTime(this.totalTime)}`, {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#888888',
                align: 'center'
            }).setOrigin(0.5);

            timeText.setAlpha(0);
            this.tweens.add({
                targets: timeText,
                alpha: 1,
                duration: 500,
                delay: 2000
            });
        }
    }

    createContinueButton(centerX, centerY) {
        const { height } = this.cameras.main;
        const buttonY = height * 0.92; // 92% - próximo ao fundo

        // Botão de continuar
        const button = this.add.container(centerX, buttonY);
        
        const bg = this.add.rectangle(0, 0, 200, 40, 0x4ecdc4, 1);
        bg.setStrokeStyle(2, 0xffffff);
        
        const text = this.add.text(0, 0, 'CONTINUAR', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#000000',
            align: 'center'
        }).setOrigin(0.5);

        button.add([bg, text]);
        button.setAlpha(0);

        // Entrada com delay
        this.tweens.add({
            targets: button,
            alpha: 1,
            duration: 500,
            delay: 2500
        });

        // Interatividade
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => {
            bg.setFillStyle(0x6ee7b7);
        });
        bg.on('pointerout', () => {
            bg.setFillStyle(0x4ecdc4);
        });
        bg.on('pointerdown', () => this.continue());

        // Hint de tecla
        const hint = this.add.text(centerX, buttonY + 35, 'Pressione ENTER ou ESPAÇO', {
            fontFamily: 'Arial',
            fontSize: '10px',
            color: '#666666',
            align: 'center'
        }).setOrigin(0.5);

        hint.setAlpha(0);
        this.tweens.add({
            targets: hint,
            alpha: 1,
            duration: 500,
            delay: 2700
        });
    }

    continue() {
        // Marca o mundo como completo e desbloqueia o personagem
        GameData.markWorldComplete(this.worldData.id);
        GameData.unlockCharacter(this.worldData.rescuedCharacter);

        // Destino após escolher personagem: próximo mundo ou mapa atual
        let worldId, levelIndex;
        const nextWorldId = this.worldData.id + 1;
        const nextWorld = GameData.WORLDS.find(w => w.id === nextWorldId);
        
        if (nextWorld) {
            worldId = nextWorldId;
            levelIndex = nextWorld.levels[0];
            GameData.saveMapPosition(worldId, levelIndex);
        } else {
            worldId = this.worldData.id;
            levelIndex = this.worldData.levels[this.worldData.levels.length - 1];
            GameData.saveMapPosition(worldId, levelIndex);
        }

        // Mostra tela de escolha de personagem antes de seguir
        this.scene.start('CharacterSelectScene', {
            returnTo: 'WorldMapScene',
            returnData: { worldId, levelIndex }
        });
    }
}

// Exporta globalmente
window.WorldCompleteScene = WorldCompleteScene;
