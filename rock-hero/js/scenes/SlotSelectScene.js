/**
 * SLOT SELECT SCENE - Seleção de Partida Salva
 * 
 * Permite gerenciar até 4 slots de save independentes.
 * - Criar novo jogo em slot vazio
 * - Continuar jogo existente
 * - Deletar slot
 *
 * Resolução: sobe temporariamente para 2× (1280×704) só nesta cena e
 * restaura 640×352 no shutdown, sem afetar as demais.
 */

class SlotSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SlotSelectScene' });
    }

    /** Escala valores de layout desenhados para a resolução base (640×352). */
    u(n) {
        return n * (this.uiScale || 1);
    }

    font(px) {
        return `${this.u(px)}px`;
    }

    applySlotSelectResolution() {
        GameConfig.UI_RESOLUTION.apply(this);
    }

    restoreGameResolution() {
        GameConfig.UI_RESOLUTION.restore(this);
    }

    init(data) {
        this.returnTo = data?.returnTo || 'MenuScene';
        this.selectedSlot = 0; // Índice do slot selecionado (0-3)
        this.mode = 'select'; // 'select', 'confirm_delete', 'name_input'
        this.deleteConfirmSlot = null;
        this.deleteChoice = 1; // 0 = Deletar, 1 = Cancelar (padrão seguro)
        this._slotLongPressTimer = null;
        this._virtualODeleteTimer = null;
        this._virtualODeleteTriggered = false;
        this._jumpWasDownVirtual = false;
        this.uiScale = 1;
    }

    create() {
        // 2× só nesta cena; shutdown restaura a resolução base do jogo
        this.applySlotSelectResolution();
        this.events.once('shutdown', this.restoreGameResolution, this);

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
            this.add.circle(x, y, this.u(2), 0xffffff, alpha);
        }
    }

    createTitle() {
        this.add.text(this.centerX, this.u(35), 'SELECIONE UMA PARTIDA', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: this.font(16),
            color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(this.centerX, this.u(60), 'Escolha um slot para jogar ou criar nova partida', {
            fontFamily: 'Arial',
            fontSize: this.font(12),
            color: '#888888'
        }).setOrigin(0.5);
    }

    createSlots() {
        this.slotCards = [];
        
        const slotWidth = this.u(130);
        const slotHeight = this.u(160);
        const spacing = this.u(15);
        const totalWidth = (GameData.MAX_SLOTS * slotWidth) + ((GameData.MAX_SLOTS - 1) * spacing);
        const startX = this.centerX - totalWidth / 2 + slotWidth / 2;
        const y = this.centerY - this.u(10);

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
        bg.setStrokeStyle(this.u(3), slotData.isEmpty ? 0x333344 : 0x4a4a6a);
        container.add(bg);

        // Número do slot
        const slotNumber = this.add.text(0, -height/2 + this.u(20), `SLOT ${slotData.slotId}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: this.font(10),
            color: slotData.isEmpty ? '#555555' : '#ffffff'
        }).setOrigin(0.5);
        container.add(slotNumber);

        if (slotData.isEmpty) {
            // Slot vazio - mostra ícone de "+"
            const plusIcon = this.add.text(0, this.u(-10), '+', {
                fontFamily: 'Arial Black',
                fontSize: this.font(48),
                color: '#444466'
            }).setOrigin(0.5);
            container.add(plusIcon);

            const newGameText = this.add.text(0, this.u(40), 'Novo Jogo', {
                fontFamily: 'Arial',
                fontSize: this.font(11),
                color: '#666688'
            }).setOrigin(0.5);
            container.add(newGameText);
        } else {
            // Slot com dados - mostra informações
            
            // Nome do jogador
            const nameText = this.add.text(0, this.u(-20), slotData.playerName, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: this.font(9),
                color: '#ffffff',
                wordWrap: { width: width - this.u(20) }
            }).setOrigin(0.5);
            container.add(nameText);

            // Progresso (fases)
            const progressText = this.add.text(0, this.u(10), 
                `⭐ ${slotData.completedLevels}/${slotData.totalLevels} fases`, {
                fontFamily: 'Arial',
                fontSize: this.font(10),
                color: '#aaaacc'
            }).setOrigin(0.5);
            container.add(progressText);

            // Mundos completos
            const worldsText = this.add.text(0, this.u(28), 
                `🌍 ${slotData.completedWorlds}/${slotData.totalWorlds} mundos`, {
                fontFamily: 'Arial',
                fontSize: this.font(10),
                color: '#aaaacc'
            }).setOrigin(0.5);
            container.add(worldsText);

            // Personagens desbloqueados
            const charsText = this.add.text(0, this.u(46), 
                `🎸 ${slotData.unlockedCharacters} personagem${slotData.unlockedCharacters > 1 ? 's' : ''}`, {
                fontFamily: 'Arial',
                fontSize: this.font(10),
                color: '#aaaacc'
            }).setOrigin(0.5);
            container.add(charsText);

            // Última vez jogado
            if (slotData.lastPlayedAt) {
                const dateText = this.add.text(0, height/2 - this.u(20), 
                    `Último: ${GameData.formatDateShort(slotData.lastPlayedAt)}`, {
                    fontFamily: 'Arial',
                    fontSize: this.font(9),
                    color: '#666688'
                }).setOrigin(0.5);
                container.add(dateText);
            }
        }

        // Torna interativo
        bg.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                if (this.mode === 'select') {
                    if (this.selectedSlot !== index) {
                        this.cancelVirtualOBtnLongPress();
                        this._jumpWasDownVirtual = !!this.virtualControls?.jump;
                    }
                    this.selectedSlot = index;
                    this.highlightSlot(index);
                    SoundManager.play('menuNavigate');
                }
            });

        if (slotData.isEmpty) {
            bg.on('pointerdown', () => {
                if (this.mode === 'select') {
                    this.selectSlot(index);
                }
            });
        } else {
            // Slot com dados: toque rápido = jogar | segure ~550ms = apagar (mobile + mouse)
            bg.on('pointerdown', () => {
                if (this.mode !== 'select') return;
                this.cancelSlotLongPress();
                this._slotLongPressTimer = this.time.delayedCall(550, () => {
                    this._slotLongPressTimer = null;
                    if (this.mode === 'select') {
                        SoundManager.play('menuNavigate');
                        this.confirmDelete(index);
                    }
                });
            });
            bg.on('pointerup', () => {
                if (this._slotLongPressTimer) {
                    this._slotLongPressTimer.remove();
                    this._slotLongPressTimer = null;
                    if (this.mode === 'select') {
                        this.selectSlot(index);
                    }
                }
            });
            bg.on('pointerout', () => {
                if (this._slotLongPressTimer) {
                    this._slotLongPressTimer.remove();
                    this._slotLongPressTimer = null;
                }
            });
            bg.on('pointercancel', () => {
                if (this._slotLongPressTimer) {
                    this._slotLongPressTimer.remove();
                    this._slotLongPressTimer = null;
                }
            });
        }

        return {
            container,
            bg,
            slotData,
            index
        };
    }

    createControls() {
        const { height } = this.cameras.main;
        const panelY = height - this.u(35);
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Painel de controles
        this.add.rectangle(this.centerX, panelY, this.u(550), this.u(45), 0x000000, 0.7)
            .setStrokeStyle(this.u(2), 0x444444);

        // Instruções principais
        this.controlsText = this.add.text(this.centerX - this.u(180), panelY, '← →  Navegar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: this.font(9),
            color: '#ffff00'
        }).setOrigin(0.5);

        this.selectText = this.add.text(this.centerX, panelY, 
            isMobile ? 'O  Selecionar' : 'ENTER  Selecionar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: this.font(9),
            color: '#00ff00'
        }).setOrigin(0.5);

        this.add.text(this.centerX + this.u(180), panelY, 
            isMobile ? 'X  Voltar' : 'ESC  Voltar', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: this.font(9),
            color: '#ff6666'
        }).setOrigin(0.5);

        // Texto de deletar (só aparece em slots com dados)
        this.deleteText = this.add.text(this.centerX, panelY + this.u(18),
            isMobile ? 'Segure o slot ou O (~0,5s) para resetar' : 'DEL  Resetar slot', {
            fontFamily: 'Arial',
            fontSize: this.font(9),
            color: '#ff4444'
        }).setOrigin(0.5).setAlpha(0);
    }

    setupInput() {
        // Navegação (slots ou opções do diálogo de delete)
        this.input.keyboard.on('keydown-LEFT', () => this.navigate(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.navigate(1));

        // Confirmar seleção atual
        this.input.keyboard.on('keydown-ENTER', () => this.confirmSelection());
        this.input.keyboard.on('keydown-SPACE', () => this.confirmSelection());

        // Deletar
        this.input.keyboard.on('keydown-DELETE', () => this.confirmDelete(this.selectedSlot));
        this.input.keyboard.on('keydown-BACKSPACE', () => this.confirmDelete(this.selectedSlot));

        // Voltar
        this.input.keyboard.on('keydown-ESC', () => this.goBack());

        // Controles virtuais
        this.virtualControls = GameData.getVirtualControls();
        this.lastNavTime = 0;

        // Sincroniza com o estado atual do botão para não confundir
        // um "segurar" da cena anterior com um novo toque
        this._jumpWasDownVirtual = !!(this.virtualControls && this.virtualControls.jump);
    }

    update(time) {
        const vc = this.virtualControls;
        if (!vc) return;

        // Controles virtuais mobile — três modos: select, confirm_delete, name_input.
        // Cada modo consome vc.jumpJustPressed e vc.backJustPressed relevantes para si
        // (e sempre limpa o flag, mesmo quando ignorado, para não vazar entre modos).
        if (this.mode === 'select') {
            const card = this.slotCards[this.selectedSlot];
            const slotData = card.slotData;

            // Slot vazio: toque rápido em O = novo jogo
            if (slotData.isEmpty) {
                this.cancelVirtualOBtnLongPress();
                if (vc.jumpJustPressed) {
                    vc.jumpJustPressed = false;
                    this.selectSlot(this.selectedSlot);
                }
                this._jumpWasDownVirtual = !!vc.jump;
            } else {
                // Slot com save: O rápido = jogar | O segurado ~550ms = apagar (igual ao card)
                if (vc.jumpJustPressed) {
                    vc.jumpJustPressed = false;
                }

                const jumpDown = !!vc.jump;
                if (jumpDown && !this._jumpWasDownVirtual) {
                    this.cancelVirtualOBtnLongPress();
                    this._virtualODeleteTriggered = false;
                    this._virtualODeleteTimer = this.time.delayedCall(550, () => {
                        this._virtualODeleteTimer = null;
                        this._virtualODeleteTriggered = true;
                        if (this.mode === 'select') {
                            SoundManager.play('menuNavigate');
                            this.confirmDelete(this.selectedSlot);
                        }
                    });
                }
                if (!jumpDown && this._jumpWasDownVirtual) {
                    if (this._virtualODeleteTimer) {
                        this._virtualODeleteTimer.remove();
                        this._virtualODeleteTimer = null;
                        if (!this._virtualODeleteTriggered) {
                            this.selectSlot(this.selectedSlot);
                        }
                    }
                    this._virtualODeleteTriggered = false;
                }
                this._jumpWasDownVirtual = jumpDown;
            }

            // X = voltar
            if (vc.backJustPressed) {
                vc.backJustPressed = false;
                this.goBack();
            }

            // Navegação com throttle
            if (time - this.lastNavTime > 200) {
                if (vc.left) {
                    this.navigate(-1);
                    this.lastNavTime = time;
                } else if (vc.right) {
                    this.navigate(1);
                    this.lastNavTime = time;
                }
            }
        } else if (this.mode === 'confirm_delete') {
            // O / bolinha = confirma a opção selecionada (Deletar ou Cancelar)
            if (vc.jumpJustPressed) {
                vc.jumpJustPressed = false;
                this.confirmDeleteChoice();
            }
            // X = cancela o diálogo
            if (vc.backJustPressed) {
                vc.backJustPressed = false;
                this.cancelDelete();
            }
            // D-pad ← → escolhe entre Deletar e Cancelar
            if (time - this.lastNavTime > 200) {
                if (vc.left) {
                    this.navigateDeleteChoice(-1);
                    this.lastNavTime = time;
                } else if (vc.right) {
                    this.navigateDeleteChoice(1);
                    this.lastNavTime = time;
                }
            }
        } else if (this.mode === 'name_input') {
            // No name_input o <input> HTML tem foco e recebe as teclas reais. Aqui só
            // tratamos o botão X do overlay mobile (cancelar). Não interpretamos O
            // para não competir com o "Go/Done" do teclado virtual do sistema.
            if (vc.jumpJustPressed) {
                vc.jumpJustPressed = false; // consome para não vazar ao modo select
            }
            if (vc.backJustPressed) {
                vc.backJustPressed = false;
                this.cancelNameInput();
            }
        }
    }

    cancelSlotLongPress() {
        if (this._slotLongPressTimer) {
            this._slotLongPressTimer.remove();
            this._slotLongPressTimer = null;
        }
    }

    cancelVirtualOBtnLongPress() {
        if (this._virtualODeleteTimer) {
            this._virtualODeleteTimer.remove();
            this._virtualODeleteTimer = null;
        }
        this._virtualODeleteTriggered = false;
    }

    navigate(direction) {
        if (this.mode === 'confirm_delete') {
            this.navigateDeleteChoice(direction);
            return;
        }
        if (this.mode !== 'select') return;

        const newIndex = this.selectedSlot + direction;
        if (newIndex >= 0 && newIndex < GameData.MAX_SLOTS) {
            this.cancelVirtualOBtnLongPress();
            this._jumpWasDownVirtual = !!this.virtualControls?.jump;
            this.selectedSlot = newIndex;
            this.highlightSlot(newIndex);
            SoundManager.play('menuNavigate');
        }
    }

    navigateDeleteChoice(direction) {
        if (this.mode !== 'confirm_delete') return;
        const next = Phaser.Math.Clamp(this.deleteChoice + direction, 0, 1);
        if (next === this.deleteChoice) return;
        this.deleteChoice = next;
        this.highlightDeleteChoice();
        SoundManager.play('menuNavigate');
    }

    highlightDeleteChoice() {
        if (!this.deleteConfirmBtn || !this.deleteCancelBtn) return;

        const styleSelected = (btn, isDelete) => {
            btn.setStyle({
                color: isDelete ? '#ff6666' : '#ffffff',
                backgroundColor: isDelete ? '#5a2020' : '#3a3a4a'
            });
            this.tweens.add({
                targets: btn,
                scale: 1.12,
                duration: 100,
                ease: 'Power2'
            });
        };
        const styleIdle = (btn, isDelete) => {
            btn.setStyle({
                color: isDelete ? '#ff4444' : '#aaaaaa',
                backgroundColor: isDelete ? '#3a1a1a' : '#2a2a2a'
            });
            this.tweens.add({
                targets: btn,
                scale: 1,
                duration: 100,
                ease: 'Power2'
            });
        };

        if (this.deleteChoice === 0) {
            styleSelected(this.deleteConfirmBtn, true);
            styleIdle(this.deleteCancelBtn, false);
        } else {
            styleIdle(this.deleteConfirmBtn, true);
            styleSelected(this.deleteCancelBtn, false);
        }
    }

    confirmSelection() {
        if (this.mode === 'confirm_delete') {
            this.confirmDeleteChoice();
            return;
        }
        if (this.mode === 'select') {
            this.selectSlot(this.selectedSlot);
        }
    }

    confirmDeleteChoice() {
        if (this.mode !== 'confirm_delete') return;
        if (this.deleteChoice === 0) {
            this.executeDelete();
        } else {
            this.cancelDelete();
        }
    }

    highlightSlot(index) {
        this.slotCards.forEach((card, i) => {
            const isSelected = i === index;
            const isEmpty = card.slotData.isEmpty;
            
            // Cor da borda
            card.bg.setStrokeStyle(
                isSelected ? this.u(4) : this.u(3),
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
                this.scene.start('WorldMapScene', {});
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
        const panelBg = this.add.rectangle(0, 0, this.u(350), this.u(180), 0x1a1a2e, 1);
        panelBg.setStrokeStyle(this.u(3), 0x4a4aff);
        this.inputContainer.add(panelBg);

        // Título
        const title = this.add.text(0, this.u(-65), 'NOVO JOGO', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: this.font(14),
            color: '#ffffff'
        }).setOrigin(0.5);
        this.inputContainer.add(title);

        // Subtítulo
        const subtitle = this.add.text(0, this.u(-40), `Slot ${slotId}`, {
            fontFamily: 'Arial',
            fontSize: this.font(12),
            color: '#888888'
        }).setOrigin(0.5);
        this.inputContainer.add(subtitle);

        // Label
        const label = this.add.text(0, this.u(-10), 'Digite seu nome:', {
            fontFamily: 'Arial',
            fontSize: this.font(14),
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
        const instructions = this.add.text(0, this.u(55), 'ENTER: Confirmar | ESC: Cancelar', {
            fontFamily: 'Arial',
            fontSize: this.font(10),
            color: '#666666'
        }).setOrigin(0.5);
        this.inputContainer.add(instructions);

        // Botões visuais
        const confirmBtn = this.add.text(this.u(-55), this.u(75), '✓ Confirmar', {
            fontFamily: 'Arial',
            fontSize: this.font(11),
            color: '#00ff00',
            backgroundColor: '#1a3a1a',
            padding: { x: this.u(8), y: this.u(5) }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.confirmNewGame());
        this.inputContainer.add(confirmBtn);

        const cancelBtn = this.add.text(this.u(55), this.u(75), '✗ Cancelar', {
            fontFamily: 'Arial',
            fontSize: this.font(11),
            color: '#ff6666',
            backgroundColor: '#3a1a1a',
            padding: { x: this.u(8), y: this.u(5) }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.cancelNameInput());
        this.inputContainer.add(cancelBtn);

        // Event listeners do input HTML
        inputElement.addEventListener('keydown', this.handleInputKeydown.bind(this));
    }

    handleInputKeydown(event) {
        // stopPropagation evita que o mesmo keydown bubble para o handler global
        // do Phaser (`keydown-ESC` chama goBack()), o que — como cancelNameInput()
        // já mudou this.mode para 'select' — faria goBack cair no else e navegar
        // para o menu principal em vez de só fechar o overlay.
        if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            this.confirmNewGame();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
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

        // Vai para a cutscene de abertura, que ao final encaminha para o WorldMap
        this.scene.start('CutsceneScene', {
            cutsceneId: 'opening',
            next: { scene: 'WorldMapScene', data: {} }
        });
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

        this.cancelVirtualOBtnLongPress();
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
        const bg = this.add.rectangle(0, 0, this.u(320), this.u(150), 0x2a1a1a, 1);
        bg.setStrokeStyle(this.u(3), 0xff4444);
        this.deleteContainer.add(bg);

        // Título
        const title = this.add.text(0, this.u(-50), '⚠️ DELETAR SLOT?', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: this.font(12),
            color: '#ff4444'
        }).setOrigin(0.5);
        this.deleteContainer.add(title);

        // Mensagem
        const message = this.add.text(0, this.u(-15), 
            `Tem certeza que deseja deletar\no slot ${slotData.slotId} (${slotData.playerName})?`, {
            fontFamily: 'Arial',
            fontSize: this.font(12),
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        this.deleteContainer.add(message);

        // Warning
        const warning = this.add.text(0, this.u(20), 'Esta ação não pode ser desfeita!', {
            fontFamily: 'Arial',
            fontSize: this.font(10),
            color: '#ff6666'
        }).setOrigin(0.5);
        this.deleteContainer.add(warning);

        // Botões (navegáveis por ← → / D-pad; Enter / O confirma a opção)
        this.deleteChoice = 1; // padrão: Cancelar
        this.deleteConfirmBtn = this.add.text(this.u(-60), this.u(55), '✓ Deletar', {
            fontFamily: 'Arial',
            fontSize: this.font(12),
            color: '#ff4444',
            backgroundColor: '#3a1a1a',
            padding: { x: this.u(10), y: this.u(5) }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                if (this.mode !== 'confirm_delete') return;
                if (this.deleteChoice !== 0) {
                    this.deleteChoice = 0;
                    this.highlightDeleteChoice();
                    SoundManager.play('menuNavigate');
                }
            })
            .on('pointerdown', () => {
                this.deleteChoice = 0;
                this.confirmDeleteChoice();
            });
        this.deleteContainer.add(this.deleteConfirmBtn);

        this.deleteCancelBtn = this.add.text(this.u(60), this.u(55), '✗ Cancelar', {
            fontFamily: 'Arial',
            fontSize: this.font(12),
            color: '#aaaaaa',
            backgroundColor: '#2a2a2a',
            padding: { x: this.u(10), y: this.u(5) }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                if (this.mode !== 'confirm_delete') return;
                if (this.deleteChoice !== 1) {
                    this.deleteChoice = 1;
                    this.highlightDeleteChoice();
                    SoundManager.play('menuNavigate');
                }
            })
            .on('pointerdown', () => {
                this.deleteChoice = 1;
                this.confirmDeleteChoice();
            });
        this.deleteContainer.add(this.deleteCancelBtn);

        const hint = this.add.text(0, this.u(78), '← →  Escolher  |  ENTER/O  Confirmar', {
            fontFamily: 'Arial',
            fontSize: this.font(10),
            color: '#888888'
        }).setOrigin(0.5);
        this.deleteContainer.add(hint);

        // Ajusta altura do painel para a dica
        bg.setSize(this.u(320), this.u(170));

        this.highlightDeleteChoice();
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
        this.cancelVirtualOBtnLongPress();
        this._jumpWasDownVirtual = !!this.virtualControls?.jump;
    }

    cancelDelete() {
        this.cleanupDeleteConfirm();
        this.mode = 'select';
        this._jumpWasDownVirtual = !!this.virtualControls?.jump;
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
        this.deleteConfirmBtn = null;
        this.deleteCancelBtn = null;
        this.deleteConfirmSlot = null;
        this.deleteChoice = 1;
    }

    goBack() {
        this.cancelSlotLongPress();
        this.cancelVirtualOBtnLongPress();
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
