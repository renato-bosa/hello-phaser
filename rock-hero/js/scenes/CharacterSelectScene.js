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
        this.returnData = data?.returnData || {
            worldId: data?.worldId,
            levelIndex: data?.levelIndex
        };
        
        // Personagem atualmente selecionado
        this.selectedIndex = 0;
        this.selectedCharacterId = GameData.loadSelectedCharacter();
    }

    preload() {
        // Carrega sprites de todos os personagens (definição centralizada em GameData)
        GameData.loadCharacterSprites(this);
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
        
        // Aplica filtro pixel art em todos os sprites de personagens
        GameData.applyPixelArtFilter(this);
        
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
                // Sprite do personagem (usa key centralizada do GameData)
                const textureKey = GameData.getCharacterTextureKey(character.id, 'idle');
                const sprite = this.add.sprite(0, spriteY, textureKey);
                sprite.setScale(2.5);
                container.add(sprite);
                
                // Guarda referência para animação
                container.setData('sprite', sprite);
                container.setData('characterId', character.id);
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
        
        // Detecta mobile
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Instruções
        this.add.text(centerX - 150, panelY, '← →  Navegar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#ffff00'
        }).setOrigin(0.5);
        
        this.add.text(centerX + 50, panelY, isMobile ? 'O  Confirmar' : 'ENTER  Confirmar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#00ff00'
        }).setOrigin(0.5);
        
        this.add.text(centerX + 200, panelY, isMobile ? 'X  Voltar' : 'ESC  Voltar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#ff6666'
        }).setOrigin(0.5);
    }

    createAnimations() {
        // Cria animações para todos os personagens com prefixo 'char-' 
        // para não conflitar com animações do gameplay
        GameData.CHARACTERS.forEach(character => {
            GameData.createCharacterAnimations(this, character.id, `char-${character.id}-`);
        });
        
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
        
        // Suporte a controles virtuais (mobile) - verificado no update()
        this.virtualControls = GameData.getVirtualControls();
        this.lastNavTime = 0;
    }

    update(time) {
        // O = confirmar
        if (this.virtualControls.jumpJustPressed) {
            this.virtualControls.jumpJustPressed = false;
            this.confirmSelection();
        }

        // X = voltar
        if (this.virtualControls.backJustPressed) {
            this.virtualControls.backJustPressed = false;
            this.goBack();
        }
        
        // Navegação com throttle
        if (time - this.lastNavTime > 200) {
            if (this.virtualControls.left) {
                this.navigate(-1);
                this.lastNavTime = time;
            } else if (this.virtualControls.right) {
                this.navigate(1);
                this.lastNavTime = time;
            }
        }
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
