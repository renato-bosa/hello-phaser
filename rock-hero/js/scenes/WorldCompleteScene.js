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
        // Carrega sprites do personagem resgatado
        const character = GameData.getCharacter(this.worldData.rescuedCharacter);
        
        if (character.id === 'baterista') {
            // Spritesheet do baterista (idle/walking para animação)
            this.load.spritesheet('baterista-idle', 'assets/spritesheets/baterista-andando-pra-direita-6fps.png', {
                frameWidth: 32,
                frameHeight: 32
            });
        }
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
        // Controles virtuais mobile (mais eficiente que timer separado)
        if (this.virtualControls && this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
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
        // "MUNDO X COMPLETO!"
        const titleText = this.add.text(centerX, centerY - 180, `🎉 ${this.worldData.name.toUpperCase()} COMPLETO! 🎉`, {
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
        const character = GameData.getCharacter(this.worldData.rescuedCharacter);
        
        // Cria animação do personagem (6fps = 166ms por frame)
        if (!this.anims.exists('rescued-character-idle')) {
            this.anims.create({
                key: 'rescued-character-idle',
                frames: this.anims.generateFrameNumbers('baterista-idle', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1
            });
        }

        // Círculo de luz atrás do personagem
        const glow = this.add.circle(centerX, centerY - 30, 60, 0xffd700, 0.3);
        this.tweens.add({
            targets: glow,
            scale: { from: 1, to: 1.3 },
            alpha: { from: 0.3, to: 0.1 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // Sprite do personagem
        const sprite = this.add.sprite(centerX, centerY - 30, 'baterista-idle');
        sprite.setScale(4); // Escala maior para destaque
        sprite.play('rescued-character-idle');

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
        const nameText = this.add.text(centerX, centerY + 50, character.name.toUpperCase(), {
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
        const instrumentText = this.add.text(centerX, centerY + 75, `🥁 ${character.instrument}`, {
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
        const message = this.add.text(centerX, centerY + 110, this.worldData.celebrationMessage, {
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
            delay: 1600
        });

        // Mensagem de personagem desbloqueado
        const unlockMsg = this.add.text(centerX, centerY + 140, '✨ NOVO PERSONAGEM DESBLOQUEADO! ✨', {
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
        // Tempo total do mundo
        if (this.totalTime > 0) {
            const timeText = this.add.text(centerX, centerY + 170, 
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
        const buttonY = centerY + 210;

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

        // Verifica se há próximo mundo
        const nextWorldId = this.worldData.id + 1;
        const nextWorld = GameData.WORLDS.find(w => w.id === nextWorldId);
        
        if (nextWorld) {
            // Vai ao mapa do próximo mundo (primeira fase)
            GameData.saveMapPosition(nextWorldId, nextWorld.levels[0]);
            this.scene.start('WorldMapScene', { worldId: nextWorldId, levelIndex: nextWorld.levels[0] });
        } else {
            // Não há próximo mundo - mantém no mundo atual na última fase completada
            const lastLevelOfWorld = this.worldData.levels[this.worldData.levels.length - 1];
            GameData.saveMapPosition(this.worldData.id, lastLevelOfWorld);
            this.scene.start('WorldMapScene', { worldId: this.worldData.id, levelIndex: lastLevelOfWorld });
        }
    }
}

// Exporta globalmente
window.WorldCompleteScene = WorldCompleteScene;
