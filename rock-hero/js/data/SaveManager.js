/**
 * SAVE MANAGER - Persistência de slots de jogo em localStorage
 *
 * Responsabilidade ÚNICA: ler/escrever dados de slots em localStorage.
 * Não toca em `GameData.state` nem em qualquer estado em memória — é puro storage.
 *
 * Cobertura:
 * - 4 slots (1-4) de save independente
 * - Slot ativo (qual slot está em uso agora)
 * - Factory de slot vazio
 * - Operações granulares: updateLastPlayed, saveSelectedCharacter (recebem slotId)
 * - Queries: hasAnyProgress, getSlotSummary
 *
 * Depende de:
 * - GameConfig (MAX_SLOTS, STORAGE_KEYS, CHARACTERS, WORLDS, LEVELS, DEFAULTS)
 *
 * Camada acima (orquestradores em `GameData` até a Fase 6 do refactor):
 * - createNewGame, deleteSlot, setActiveSlot, getActiveSlot, loadSlotIntoState,
 *   savePlayerName, saveSelectedCharacter (versão sem slotId), etc.
 *   Esses métodos mantêm o cache `state.activeSlot` e chamam SaveManager para storage.
 */

const SaveManager = {
    // ==================== FACTORY ====================

    /**
     * Cria um slot vazio com todos os campos padrão.
     * Não persiste — apenas retorna o objeto.
     */
    createEmptySlot(slotId) {
        return {
            id: slotId,
            playerName: '',
            createdAt: null,
            lastPlayedAt: null,
            completedLevels: [],
            completedWorlds: [],
            unlockedCharacters: ['vocalista'],
            selectedCharacter: 'vocalista',
            mapPosition: { worldId: 1, levelIndex: 0 },
            bestTimes: {},
            lives: 5
        };
    },

    // ==================== SLOTS CRUD ====================

    /**
     * Retorna todos os slots ([slot1, slot2, slot3, slot4]).
     * Slots vazios são `null`. Fallback para array de nulls em caso de erro de parsing.
     */
    getAllSlots() {
        const stored = localStorage.getItem(GameConfig.STORAGE_KEYS.SLOTS);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error('Erro ao carregar slots:', e);
            }
        }
        return new Array(GameConfig.MAX_SLOTS).fill(null);
    },

    /**
     * Persiste o array completo de slots.
     */
    saveAllSlots(slots) {
        localStorage.setItem(GameConfig.STORAGE_KEYS.SLOTS, JSON.stringify(slots));
    },

    /**
     * Retorna um slot específico (1-indexed). null se vazio.
     */
    getSlot(slotId) {
        const slots = this.getAllSlots();
        return slots[slotId - 1] || null;
    },

    /**
     * Persiste um slot específico (1-indexed).
     */
    saveSlot(slotId, slotData) {
        const slots = this.getAllSlots();
        slots[slotId - 1] = slotData;
        this.saveAllSlots(slots);
    },

    /**
     * Remove um slot do storage (escreve null na posição correspondente).
     * NÃO mexe no slot ativo — quem chama deve cuidar disso via clearActiveSlotId().
     */
    deleteSlot(slotId) {
        const slots = this.getAllSlots();
        slots[slotId - 1] = null;
        this.saveAllSlots(slots);
    },

    // ==================== SLOT ATIVO (apenas storage) ====================

    /**
     * Lê o ID do slot ativo no storage. Retorna `null` se não houver.
     * Conversão para `Number` é responsabilidade do chamador (usando parseInt).
     */
    getActiveSlotId() {
        const stored = localStorage.getItem(GameConfig.STORAGE_KEYS.ACTIVE);
        if (stored === null) return null;
        const parsed = parseInt(stored, 10);
        return Number.isFinite(parsed) ? parsed : null;
    },

    /**
     * Escreve o ID do slot ativo no storage.
     */
    setActiveSlotId(slotId) {
        localStorage.setItem(GameConfig.STORAGE_KEYS.ACTIVE, slotId.toString());
    },

    /**
     * Remove o ID do slot ativo do storage.
     */
    clearActiveSlotId() {
        localStorage.removeItem(GameConfig.STORAGE_KEYS.ACTIVE);
    },

    // ==================== OPERAÇÕES GRANULARES ====================

    /**
     * Atualiza o timestamp `lastPlayedAt` do slot informado.
     * No-op se o slot não existir.
     */
    updateLastPlayed(slotId) {
        if (!slotId) return;
        const slot = this.getSlot(slotId);
        if (slot) {
            slot.lastPlayedAt = new Date().toISOString();
            this.saveSlot(slotId, slot);
        }
    },

    /**
     * Salva o personagem selecionado em um slot específico.
     * No-op se o slot não existir.
     * IMPORTANTE: não verifica se o personagem está desbloqueado — chamador é responsável.
     */
    saveSelectedCharacter(slotId, characterId) {
        if (!slotId) return;
        const slot = this.getSlot(slotId);
        if (slot) {
            slot.selectedCharacter = characterId;
            this.saveSlot(slotId, slot);
        }
    },

    // ==================== QUERIES ====================

    /**
     * `true` se houver pelo menos um slot com dados (não-null).
     */
    hasAnyProgress() {
        return this.getAllSlots().some(slot => slot !== null);
    },

    /**
     * Resumo do slot para listagens (CharacterSelect, Menu).
     * Retorna `{ isEmpty: true, slotId }` se o slot estiver vazio.
     */
    getSlotSummary(slotId) {
        const slot = this.getSlot(slotId);
        if (!slot) {
            return { isEmpty: true, slotId };
        }
        return {
            isEmpty: false,
            slotId,
            playerName: slot.playerName || 'Anônimo',
            completedLevels: slot.completedLevels?.length || 0,
            totalLevels: GameConfig.LEVELS.length,
            completedWorlds: slot.completedWorlds?.length || 0,
            totalWorlds: GameConfig.WORLDS.length,
            lastPlayedAt: slot.lastPlayedAt,
            unlockedCharacters: slot.unlockedCharacters?.length || 1
        };
    }
};

window.SaveManager = SaveManager;
