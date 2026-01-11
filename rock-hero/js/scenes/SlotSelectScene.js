/**
 * SLOT SELECT SCENE - Seleção de Partida Salva
 * 
 * Permite gerenciar até 4 slots de save independentes.
 * - Criar novo jogo em slot vazio
 * - Continuar jogo existente
 * - Deletar slot
 */

class SlotSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SlotSelectScene' });
    }

    init(data) {
        this.returnTo = data?.returnTo || 'MenuScene';
        this.selectedSlot = 0; // Índice do slot selecionado (0-3)
        this.mode = 'select'; // 'select', 'confirm_delete', 'name_input'
        this.deleteConfirmSlot = null;
    }

    create() {
        const { width, height } = this.cameras.main;
        this.centerX = width / 2;
        this.centerY = height / 2;

        // Background
        this.createBackground(width, height);

        // Título
        this.createTitle();

        // Slots
        this.createSlots();

        // Controles
        this.createControls();

        // Setup de input
        this.setupInput();

        // Destaca slot inicial
        this.highlightSlot(this.selectedSlot);
    }

    createBackground(width, height) {
        // Gradiente de fundo
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a3a, 0x1a1a3a, 1);
        bg.fillRect(0, 0, width, height);

        // Padrão decorativo
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const alpha = Phaser.Math.FloatBetween(0.1, 0.3);
            this.add.circle(x, y, 2, 0xffffff, alpha);
        }
    }

    createTitle() {
        this.add.text(this.centerX, 35, 'SELECIONE UMA PARTIDA', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(this.centerX, 60, 'Escolha um slot para jogar ou criar nova partida', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#888888'
        }).setOrigin(0.5);
    }

    createSlots() {
        this.slotCards = [];
        
        const slotWidth = 130;
        const slotHeight = 160;
        const spacing = 15;
        const totalWidth = (GameData.MAX_SLOTS * slotWidth) + ((GameData.MAX_SLOTS - 1) * spacing);
        const startX = this.centerX - totalWidth / 2 + slotWidth / 2;
        const y = this.centerY - 10;

        for (let i = 0; i < GameData.MAX_SLOTS; i++) {
            const x = startX + i * (slotWidth + spacing);
            const slotData = GameData.getSlotSummary(i + 1);
            
            const card = this.createSlotCard(x, y, slotWidth, slotHeight, slotData, i);
            this.slotCards.push(card);
        }
    }

    createSlotCard(x, y, width, height, slotData, index) {
        const container = this.add.container(x, y);
        
        // Background do card
        const bg = this.add.rectangle(0, 0, width, height, 
            slotData.isEmpty ? 0x1a1a2a : 0x2a2a4a, 1);
        bg.setStrokeStyle(3, slotData.isEmpty ? 0x333344 : 0x4a4a6a);
        container.add(bg);

        // Número do slot
        const slotNumber = this.add.text(0, -height/2 + 20, `SLOT ${slotData.slotId}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: slotData.isEmpty ? '#555555' : '#ffffff'
        }).setOrigin(0.5);
        container.add(slotNumber);

        if (slotData.isEmpty) {
            // Slot vazio - mostra ícone de "+"
            const plusIcon = this.add.text(0, -10, '+', {
                fontFamily: 'Arial Black',
                fontSize: '48px',
                color: '#444466'
            }).setOrigin(0.5);
            container.add(plusIcon);

            const newGameText = this.add.text(0, 40, 'Novo Jogo', {
                fontFamily: 'Arial',
                fontSize: '11px',
                color: '#666688'
            }).setOrigin(0.5);
            container.add(newGameText);
        } else {
            // Slot com dados - mostra informações
            
            // Nome do jogador
            const nameText = this.add.text(0, -20, slotData.playerName, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '9px',
                color: '#ffffff',
                wordWrap: { width: width - 20 }
            }).setOrigin(0.5);
            container.add(nameText);

            // Progresso (fases)
            const progressText = this.add.text(0, 10, 
                `⭐ ${slotData.completedLevels}/${slotData.totalLevels} fases`, {
                fontFamily: 'Arial',
                fontSize: '10px',
                color: '#aaaacc'
            }).setOrigin(0.5);
            container.add(progressText);

            // Mundos completos
            const worldsText = this.add.text(0, 28, 
                `🌍 ${slotData.completedWorlds}/${slotData.totalWorlds} mundos`, {
                fontFamily: 'Arial',
                fontSize: '10px',
                color: '#aaaacc'
            }).setOrigin(0.5);
            container.add(worldsText);

            // Personagens desbloqueados
            const charsText = this.add.text(0, 46, 
                `🎸 ${slotData.unlockedCharacters} personagem${slotData.unlockedCharacters > 1 ? 's' : ''}`, {
                fontFamily: 'Arial',
                fontSize: '10px',
                color: '#aaaacc'
            }).setOrigin(0.5);
            container.add(charsText);

            // Última vez jogado
            if (slotData.lastPlayedAt) {
                const dateText = this.add.text(0, height/2 - 20, 
                    `Último: ${GameData.formatDateShort(slotData.lastPlayedAt)}`, {
                    fontFamily: 'Arial',
                    fontSize: '9px',
                    color: '#666688'
                }).setOrigin(0.5);
                container.add(dateText);
            }
        }

        // Torna interativo
        bg.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                if (this.mode === 'select') {
                    this.selectedSlot = index;
                    this.highlightSlot(index);
                    SoundManager.play('menuNavigate');
                }
            })
            .on('pointerdown', () => {
                if (this.mode === 'select') {
                    this.selectSlot(index);
                }
            });

        return {
            container,
            bg,
            slotData,
            index
        };
    }

    createControls() {
        const { height } = this.cameras.main;
        const panelY = height - 35;
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Painel de controles
        this.add.rectangle(this.centerX, panelY, 550, 45, 0x000000, 0.7)
            .setStrokeStyle(2, 0x444444);

        // Instruções principais
        this.controlsText = this.add.text(this.centerX - 180, panelY, '← →  Navegar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '9px',
            color: '#ffff00'
        }).setOrigin(0.5);

        this.selectText = this.add.text(this.centerX, panelY, 
            isMobile ? 'PULO  Selecionar' : 'ENTER  Selecionar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '9px',
            color: '#00ff00'
        }).setOrigin(0.5);

        // ESC/Voltar (apenas desktop)
        if (!isMobile) {
            this.add.text(this.centerX + 180, panelY, 'ESC  Voltar', {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '9px',
                color: '#ff6666'
            }).setOrigin(0.5);
        }

        // Texto de deletar (só aparece em slots com dados)
        this.deleteText = this.add.text(this.centerX, panelY + 18, 
            isMobile ? 'Segure para deletar' : 'DEL  Deletar slot', {
            fontFamily: 'Arial',
            fontSize: '9px',
            color: '#ff4444'
        }).setOrigin(0.5).setAlpha(0);
    }

    setupInput() {
        // Navegação
        this.input.keyboard.on('keydown-LEFT', () => this.navigate(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.navigate(1));

        // Seleção
        this.input.keyboard.on('keydown-ENTER', () => this.selectSlot(this.selectedSlot));
        this.input.keyboard.on('keydown-SPACE', () => this.selectSlot(this.selectedSlot));

        // Deletar
        this.input.keyboard.on('keydown-DELETE', () => this.confirmDelete(this.selectedSlot));
        this.input.keyboard.on('keydown-BACKSPACE', () => this.confirmDelete(this.selectedSlot));

        // Voltar
        this.input.keyboard.on('keydown-ESC', () => this.goBack());

        // Controles virtuais
        this.virtualControls = GameData.getVirtualControls();
        this.lastNavTime = 0;
    }

    update(time) {
        // Controles virtuais mobile
        if (this.mode === 'select') {
            if (this.virtualControls.jumpJustPressed) {
                this.virtualControls.jumpJustPressed = false;
                this.selectSlot(this.selectedSlot);
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
    }

    navigate(direction) {
        if (this.mode !== 'select') return;

        const newIndex = this.selectedSlot + direction;
        if (newIndex >= 0 && newIndex < GameData.MAX_SLOTS) {
            this.selectedSlot = newIndex;
            this.highlightSlot(newIndex);
            SoundManager.play('menuNavigate');
        }
    }

    highlightSlot(index) {
        this.slotCards.forEach((card, i) => {
            const isSelected = i === index;
            const isEmpty = card.slotData.isEmpty;
            
            // Cor da borda
            card.bg.setStrokeStyle(
                isSelected ? 4 : 3,
                isSelected ? 0xffffff : (isEmpty ? 0x333344 : 0x4a4a6a)
            );

            // Escala
            this.tweens.add({
                targets: card.container,
                scale: isSelected ? 1.05 : 1,
                duration: 150,
                ease: 'Power2'
            });
        });

        // Mostra/esconde opção de deletar
        const selectedCard = this.slotCards[index];
        this.tweens.add({
            targets: this.deleteText,
            alpha: selectedCard.slotData.isEmpty ? 0 : 0.8,
            duration: 200
        });
    }

    selectSlot(index) {
        if (this.mode !== 'select') return;

        const slotData = this.slotCards[index].slotData;
        
        if (slotData.isEmpty) {
            // Slot vazio - criar novo jogo
            SoundManager.play('menuSelect');
            this.showNameInput(index + 1);
        } else {
            // Slot com dados - carregar e jogar
            SoundManager.play('menuSelect');
            this.loadAndPlay(slotData.slotId);
        }
    }

    loadAndPlay(slotId) {
        // Carrega o slot
        GameData.setActiveSlot(slotId);
        const slot = GameData.getSlot(slotId);
        GameData.loadSlotIntoState(slot);
        GameData.updateLastPlayed();

        // Flash de confirmação
        const card = this.slotCards[slotId - 1];
        this.tweens.add({
            targets: card.container,
            scale: 1.15,
            duration: 150,
            yoyo: true,
            onComplete: () => {
                // Vai para o WorldMap
                this.scene.start('WorldMapScene');
            }
        });
    }

    showNameInput(slotId) {
        this.mode = 'name_input';
        this.newGameSlotId = slotId;

        const { width, height } = this.cameras.main;

        // Overlay escuro (Phaser)
        this.inputOverlay = this.add.rectangle(
            this.centerX, this.centerY,
            width, height, 0x000000, 0.85
        ).setInteractive();

        // Container do input (Phaser)
        this.inputContainer = this.add.container(this.centerX, this.centerY);

        // Background do painel
        const panelBg = this.add.rectangle(0, 0, 350, 180, 0x1a1a2e, 1);
        panelBg.setStrokeStyle(3, 0x4a4aff);
        this.inputContainer.add(panelBg);

        // Título
        const title = this.add.text(0, -65, 'NOVO JOGO', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.inputContainer.add(title);

        // Subtítulo
        const subtitle = this.add.text(0, -40, `Slot ${slotId}`, {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#888888'
        }).setOrigin(0.5);
        this.inputContainer.add(subtitle);

        // Label
        const label = this.add.text(0, -10, 'Digite seu nome:', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#cccccc'
        }).setOrigin(0.5);
        this.inputContainer.add(label);

        // Input HTML REAL (para funcionar em mobile)
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.maxLength = 12;
        inputElement.placeholder = 'Seu nome';
        inputElement.autocomplete = 'off';
        inputElement.autocapitalize = 'words';
        
        // Estilo do input
        Object.assign(inputElement.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '200px',
            padding: '10px 15px',
            fontSize: '16px',
            textAlign: 'center',
            border: '3px solid #4a4aff',
            borderRadius: '8px',
            backgroundColor: '#2a2a4a',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            zIndex: '10000',
            marginTop: '15px',
            outline: 'none'
        });

        document.body.appendChild(inputElement);
        this.nameInputElement = inputElement;
        
        // Foca e seleciona após pequeno delay (garante que está no DOM)
        setTimeout(() => {
            inputElement.focus();
        }, 100);

        // Instruções
        const instructions = this.add.text(0, 55, 'ENTER: Confirmar | ESC: Cancelar', {
            fontFamily: 'Arial',
            fontSize: '10px',
            color: '#666666'
        }).setOrigin(0.5);
        this.inputContainer.add(instructions);

        // Botões visuais
        const confirmBtn = this.add.text(-55, 75, '✓ Confirmar', {
            fontFamily: 'Arial',
            fontSize: '11px',
            color: '#00ff00',
            backgroundColor: '#1a3a1a',
            padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.confirmNewGame());
        this.inputContainer.add(confirmBtn);

        const cancelBtn = this.add.text(55, 75, '✗ Cancelar', {
            fontFamily: 'Arial',
            fontSize: '11px',
            color: '#ff6666',
            backgroundColor: '#3a1a1a',
            padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.cancelNameInput());
        this.inputContainer.add(cancelBtn);

        // Event listeners do input HTML
        inputElement.addEventListener('keydown', this.handleInputKeydown.bind(this));
    }

    handleInputKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.confirmNewGame();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelNameInput();
        }
    }

    confirmNewGame() {
        const name = this.nameInputElement?.value?.trim() || 'Anônimo';
        
        // Cria o novo jogo
        GameData.createNewGame(this.newGameSlotId, name);
        
        SoundManager.play('menuSelect');

        // Remove input overlay
        this.cleanupNameInput();

        // Vai para o WorldMap
        this.scene.start('WorldMapScene');
    }

    cancelNameInput() {
        this.cleanupNameInput();
        this.mode = 'select';
        SoundManager.play('menuNavigate');
    }

    cleanupNameInput() {
        // Remove input HTML
        if (this.nameInputElement) {
            if (this.nameInputElement.parentNode) {
                document.body.removeChild(this.nameInputElement);
            }
            this.nameInputElement = null;
        }
        
        // Remove elementos Phaser
        if (this.inputOverlay) {
            this.inputOverlay.destroy();
            this.inputOverlay = null;
        }
        if (this.inputContainer) {
            this.inputContainer.destroy();
            this.inputContainer = null;
        }
    }

    confirmDelete(index) {
        const slotData = this.slotCards[index].slotData;
        if (slotData.isEmpty) return;

        this.mode = 'confirm_delete';
        this.deleteConfirmSlot = index;

        const { width, height } = this.cameras.main;

        // Overlay
        this.deleteOverlay = this.add.rectangle(
            this.centerX, this.centerY,
            width, height, 0x000000, 0.8
        ).setInteractive();

        // Container
        this.deleteContainer = this.add.container(this.centerX, this.centerY);

        // Background
        const bg = this.add.rectangle(0, 0, 320, 150, 0x2a1a1a, 1);
        bg.setStrokeStyle(3, 0xff4444);
        this.deleteContainer.add(bg);

        // Título
        const title = this.add.text(0, -50, '⚠️ DELETAR SLOT?', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#ff4444'
        }).setOrigin(0.5);
        this.deleteContainer.add(title);

        // Mensagem
        const message = this.add.text(0, -15, 
            `Tem certeza que deseja deletar\no slot ${slotData.slotId} (${slotData.playerName})?`, {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        this.deleteContainer.add(message);

        // Warning
        const warning = this.add.text(0, 20, 'Esta ação não pode ser desfeita!', {
            fontFamily: 'Arial',
            fontSize: '10px',
            color: '#ff6666'
        }).setOrigin(0.5);
        this.deleteContainer.add(warning);

        // Botões
        const confirmBtn = this.add.text(-60, 55, '✓ Deletar', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#ff4444',
            backgroundColor: '#3a1a1a',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.executeDelete());
        this.deleteContainer.add(confirmBtn);

        const cancelBtn = this.add.text(60, 55, '✗ Cancelar', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#aaaaaa',
            backgroundColor: '#2a2a2a',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.cancelDelete());
        this.deleteContainer.add(cancelBtn);

        // Teclas
        this.input.keyboard.once('keydown-Y', () => this.executeDelete());
        this.input.keyboard.once('keydown-N', () => this.cancelDelete());
        this.input.keyboard.once('keydown-ESC', () => this.cancelDelete());
    }

    executeDelete() {
        if (this.deleteConfirmSlot === null) return;

        const slotId = this.deleteConfirmSlot + 1;
        GameData.deleteSlot(slotId);

        SoundManager.play('damage');

        // Remove overlay
        this.cleanupDeleteConfirm();

        // Recria os slots
        this.slotCards.forEach(card => card.container.destroy());
        this.slotCards = [];
        this.createSlots();
        this.highlightSlot(this.selectedSlot);

        this.mode = 'select';
    }

    cancelDelete() {
        this.cleanupDeleteConfirm();
        this.mode = 'select';
        SoundManager.play('menuNavigate');
    }

    cleanupDeleteConfirm() {
        if (this.deleteOverlay) {
            this.deleteOverlay.destroy();
            this.deleteOverlay = null;
        }
        if (this.deleteContainer) {
            this.deleteContainer.destroy();
            this.deleteContainer = null;
        }
        this.deleteConfirmSlot = null;
    }

    goBack() {
        if (this.mode === 'name_input') {
            this.cancelNameInput();
        } else if (this.mode === 'confirm_delete') {
            this.cancelDelete();
        } else {
            this.scene.start(this.returnTo);
        }
    }
}

// Exporta globalmente
window.SlotSelectScene = SlotSelectScene;
