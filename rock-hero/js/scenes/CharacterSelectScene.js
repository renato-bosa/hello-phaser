/**
 * CHARACTER SELECT SCENE - Seleção de Personagem
 * 
 * Permite escolher entre os personagens desbloqueados.
 * Acessível do WorldMap sem perder progresso.
 */

class CharacterSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterSelectScene' });
    }

    init(data) {
        // Dados para retorno
        this.returnTo = data?.returnTo || 'WorldMapScene';
        this.returnData = {
            worldId: data?.worldId,
            levelIndex: data?.levelIndex
        };
        
        // Personagem atualmente selecionado
        this.selectedIndex = 0;
        this.selectedCharacterId = GameData.loadSelectedCharacter();
    }

    preload() {
        // Carrega sprites dos personagens
        // Vocalista
        this.load.spritesheet('hero-idle', 'assets/spritesheets/still-hero.png', {
            frameWidth: 32, frameHeight: 32
        });
        
        // Baterista
        this.load.spritesheet('baterista-walk', 'assets/spritesheets/baterista-andando-pra-direita-6fps.png', {
            frameWidth: 32, frameHeight: 32
        });
    }

    create() {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Obtém personagens disponíveis
        this.characters = GameData.CHARACTERS;
        this.unlockedCharacters = GameData.getAvailableCharacters();
        
        // Encontra índice do personagem atual
        this.selectedIndex = this.characters.findIndex(c => c.id === this.selectedCharacterId);
        if (this.selectedIndex < 0) this.selectedIndex = 0;
        
        // Cria elementos visuais
        this.createBackground(width, height);
        this.createTitle(centerX);
        this.createCharacterCards(centerX, centerY);
        this.createControls(centerX, height);
        
        // Setup de controles
        this.setupControls();
        
        // Destaca personagem atual
        this.highlightCharacter(this.selectedIndex);
        
        // Cria animações
        this.createAnimations();
    }

    createBackground(width, height) {
        // Fundo gradiente
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
        bg.fillRect(0, 0, width, height);
        
        // Padrão decorativo
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            this.add.circle(x, y, 2, 0xffffff, 0.2);
        }
    }

    createTitle(centerX) {
        // Título
        this.add.text(centerX, 40, 'SELECIONE SEU PERSONAGEM', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Subtítulo
        this.add.text(centerX, 65, 'Resgatar companheiros desbloqueia novos personagens!', {
            fontFamily: 'Arial',
            fontSize: '11px',
            color: '#888888'
        }).setOrigin(0.5);
    }

    createCharacterCards(centerX, centerY) {
        this.characterCards = [];
        
        const cardWidth = 140;
        const cardHeight = 180;
        const spacing = 20;
        const totalWidth = (this.characters.length * cardWidth) + ((this.characters.length - 1) * spacing);
        const startX = centerX - totalWidth / 2 + cardWidth / 2;
        
        this.characters.forEach((character, index) => {
            const x = startX + index * (cardWidth + spacing);
            const y = centerY - 10;
            
            const isUnlocked = GameData.isCharacterUnlocked(character.id);
            
            // Container do card
            const container = this.add.container(x, y);
            
            // Fundo do card
            const cardBg = this.add.rectangle(0, 0, cardWidth, cardHeight, 
                isUnlocked ? 0x2a2a4a : 0x1a1a2a, 1);
            cardBg.setStrokeStyle(3, isUnlocked ? 0x4a4a6a : 0x333333);
            container.add(cardBg);
            
            // Área do sprite
            const spriteY = -40;
            
            if (isUnlocked) {
                // Sprite do personagem
                let sprite;
                if (character.id === 'vocalista') {
                    sprite = this.add.sprite(0, spriteY, 'hero-idle');
                } else if (character.id === 'baterista') {
                    sprite = this.add.sprite(0, spriteY, 'baterista-walk');
                }
                
                if (sprite) {
                    sprite.setScale(2.5);
                    container.add(sprite);
                    
                    // Guarda referência para animação
                    container.setData('sprite', sprite);
                    container.setData('characterId', character.id);
                }
            } else {
                // Silhueta (personagem bloqueado)
                const silhouette = this.add.rectangle(0, spriteY, 50, 70, 0x333333);
                container.add(silhouette);
                
                // Ícone de cadeado
                const lock = this.add.text(0, spriteY, '🔒', {
                    fontSize: '28px'
                }).setOrigin(0.5);
                container.add(lock);
            }
            
            // Nome do personagem
            const nameText = this.add.text(0, 30, character.name, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '10px',
                color: isUnlocked ? '#ffffff' : '#666666'
            }).setOrigin(0.5);
            container.add(nameText);
            
            // Instrumento
            const instrumentText = this.add.text(0, 50, character.instrument, {
                fontFamily: 'Arial',
                fontSize: '11px',
                color: isUnlocked ? '#aaaaaa' : '#444444'
            }).setOrigin(0.5);
            container.add(instrumentText);
            
            // Informação de desbloqueio (se bloqueado)
            if (!isUnlocked) {
                const world = GameData.WORLDS.find(w => w.rescuedCharacter === character.id);
                if (world) {
                    const unlockText = this.add.text(0, 75, `Complete o ${world.name}`, {
                        fontFamily: 'Arial',
                        fontSize: '9px',
                        color: '#666666',
                        align: 'center'
                    }).setOrigin(0.5);
                    container.add(unlockText);
                }
            }
            
            // Guarda referência
            this.characterCards.push({
                container,
                cardBg,
                character,
                isUnlocked,
                index
            });
        });
    }

    createControls(centerX, height) {
        // Painel inferior
        const panelY = height - 40;
        
        this.add.rectangle(centerX, panelY, 500, 50, 0x000000, 0.7)
            .setStrokeStyle(2, 0x444444);
        
        // Instruções
        this.add.text(centerX - 150, panelY, '← →  Navegar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#ffff00'
        }).setOrigin(0.5);
        
        this.add.text(centerX + 50, panelY, 'ENTER  Confirmar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#00ff00'
        }).setOrigin(0.5);
        
        // ESC para voltar
        this.add.text(centerX + 200, panelY, 'ESC  Voltar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#ff6666'
        }).setOrigin(0.5);
    }

    createAnimations() {
        // Animação do vocalista (idle)
        if (!this.anims.exists('char-vocalista-idle')) {
            this.anims.create({
                key: 'char-vocalista-idle',
                frames: this.anims.generateFrameNumbers('hero-idle', { start: 0, end: 1 }),
                frameRate: 4,
                repeat: -1
            });
        }
        
        // Animação do baterista
        if (!this.anims.exists('char-baterista-idle')) {
            this.anims.create({
                key: 'char-baterista-idle',
                frames: this.anims.generateFrameNumbers('baterista-walk', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1
            });
        }
        
        // Inicia animações nos sprites
        this.characterCards.forEach(card => {
            if (card.isUnlocked) {
                const sprite = card.container.getData('sprite');
                const charId = card.container.getData('characterId');
                if (sprite && charId) {
                    sprite.play(`char-${charId}-idle`);
                }
            }
        });
    }

    setupControls() {
        // Navegação
        this.input.keyboard.on('keydown-LEFT', () => this.navigate(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.navigate(1));
        
        // Confirmar
        this.input.keyboard.on('keydown-ENTER', () => this.confirmSelection());
        this.input.keyboard.on('keydown-SPACE', () => this.confirmSelection());
        
        // Voltar
        this.input.keyboard.on('keydown-ESC', () => this.goBack());
    }

    navigate(direction) {
        const newIndex = this.selectedIndex + direction;
        
        if (newIndex >= 0 && newIndex < this.characters.length) {
            this.selectedIndex = newIndex;
            this.highlightCharacter(newIndex);
            SoundManager.play('menuNavigate');
        }
    }

    highlightCharacter(index) {
        this.characterCards.forEach((card, i) => {
            const isSelected = i === index;
            const baseColor = card.isUnlocked ? 0x4a4a6a : 0x333333;
            const selectedColor = card.isUnlocked ? 0x6a6a9a : 0x444444;
            
            // Cor da borda
            card.cardBg.setStrokeStyle(
                isSelected ? 4 : 3,
                isSelected ? 0xffffff : baseColor
            );
            
            // Escala
            this.tweens.add({
                targets: card.container,
                scale: isSelected ? 1.05 : 1,
                duration: 150,
                ease: 'Power2'
            });
        });
    }

    confirmSelection() {
        const selectedCard = this.characterCards[this.selectedIndex];
        
        if (!selectedCard.isUnlocked) {
            SoundManager.play('warning');
            
            // Shake no card bloqueado
            this.tweens.add({
                targets: selectedCard.container,
                x: selectedCard.container.x + 5,
                duration: 50,
                yoyo: true,
                repeat: 3
            });
            return;
        }
        
        // Salva seleção
        const characterId = selectedCard.character.id;
        GameData.saveSelectedCharacter(characterId);
        
        SoundManager.play('menuSelect');
        
        // Efeito visual de confirmação
        this.tweens.add({
            targets: selectedCard.container,
            scale: 1.2,
            duration: 200,
            yoyo: true,
            onComplete: () => {
                this.goBack();
            }
        });
    }

    goBack() {
        this.scene.start(this.returnTo, this.returnData);
    }
}

// Exporta globalmente
window.CharacterSelectScene = CharacterSelectScene;
