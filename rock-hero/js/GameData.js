/**
 * GAME DATA - Módulo Centralizado de Dados
 * 
 * Gerencia:
 * - Sistema de Slots (4 partidas independentes)
 * - Rankings (hi-scores)
 * - Progresso salvo
 * - Configurações de níveis
 * - Estado do jogo
 */

const GameData = {
    // ==================== CONFIGURAÇÕES DE SLOTS ====================
    MAX_SLOTS: 4,
    STORAGE_KEY_SLOTS: 'rockHero_slots',
    STORAGE_KEY_ACTIVE: 'rockHero_activeSlot',

    // ==================== PERSONAGENS ====================
    CHARACTERS: [
        {
            id: 'vocalista',
            name: 'Vocalista',
            instrument: 'Voz',
            unlockedByDefault: true,
            sprites: {
                idle: 'hero-idle',
                walk: 'hero-walking',
                jump: 'hero-jumping'
            }
        },
        {
            id: 'baterista',
            name: 'Baterista',
            instrument: 'Bateria',
            unlockedByDefault: false,
            unlockedByWorld: 1,
            sprites: {
                idle: 'baterista-idle',
                walk: 'baterista-walking',
                jump: 'baterista-idle' // TODO: criar sprite de pulo
            }
        },
        {
            id: 'baixista',
            name: 'Baixista',
            instrument: 'Baixo',
            unlockedByDefault: false,
            unlockedByWorld: 2,
            sprites: {
                idle: 'baixista-idle',
                walk: 'baixista-idle',  // placeholder
                jump: 'baixista-idle'   // placeholder
            }
        }
        // Futuros personagens: guitarrista, tecladista...
    ],

    // ==================== MUNDOS ====================
    WORLDS: [
        {
            id: 1,
            name: 'Mundo 1',
            subtitle: 'O Resgate do Baterista',
            levels: [0, 1, 2, 3], // Índices das fases (0-3 = fases 1-4)
            rescuedCharacter: 'baterista',
            celebrationMessage: 'Você resgatou o Baterista!',
            // Visual no WorldMap
            theme: 'grass',
            bgColor: 0x87CEEB, // Azul céu
            pathColor: 0x8B4513 // Marrom terra
        },
        {
            id: 2,
            name: 'Mundo 2',
            subtitle: 'O Resgate do Baixista',
            levels: [4, 5, 6, 7], // Índices das fases (4-7 = fases 5-8)
            rescuedCharacter: 'baixista',
            celebrationMessage: 'Você resgatou o Baixista!',
            // Visual no WorldMap (tema caverna/noturno)
            theme: 'cave',
            bgColor: 0x1a1a2e, // Azul escuro noturno
            pathColor: 0x4a4a6a // Cinza arroxeado
        }
        // Futuros mundos: Mundo 3 (Guitarrista), Mundo 4 (Tecladista)...
    ],

    // Configuração das fases
    LEVELS: [
        { 
            key: 'map1', 
            file: 'assets/map.json', 
            name: 'Fase 1',
            zoom: 1.0,
            roundPixels: true,
            world: 1,
            // Posição no WorldMap (relativa ao mundo)
            mapPosition: { x: 80, y: 200 },
            connectsTo: [1] // Conecta à fase 2
        },
        { 
            key: 'map2', 
            file: 'assets/map-2--expansion and speed.json', 
            name: 'Fase 2',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 200, y: 180 },
            connectsTo: [2]
        },
        { 
            key: 'map3', 
            file: 'assets/map-3--desafio do luigi.json', 
            name: 'Desafio do Luigi',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 340, y: 220 },
            connectsTo: [3]
        },
        {
            key: 'map4',
            file: 'assets/map-4--big-jumps.json',
            name: 'Big Jump',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 480, y: 180 },
            connectsTo: [] // Última fase do mundo
        },
        // ==================== MUNDO 2 ====================
        { 
            key: 'map5', 
            file: 'assets/map-5--caverna.json',
            name: 'Caverna Sombria',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 80, y: 200 },
            connectsTo: [5]
        },
        { 
            key: 'map6', 
            file: 'assets/map-6--caverna2.json',
            name: 'Cristais Perigosos',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 200, y: 160 },
            connectsTo: [6]
        },
        { 
            key: 'map7', 
            file: 'assets/map.json', // TODO: criar mapa próprio
            name: 'Abismo Rochoso',
            zoom: 1.0,
            roundPixels: true,
            world: 2,
            mapPosition: { x: 340, y: 210 },
            connectsTo: [7]
        },
        { 
            key: 'map8', 
            file: 'assets/map.json', // TODO: criar mapa próprio
            name: 'Covil do Guitarrista',
            zoom: 1.0,
            roundPixels: true,
            world: 2,
            mapPosition: { x: 480, y: 180 },
            connectsTo: [] // Última fase do mundo
        }
    ],

    // Valores padrão
    DEFAULTS: {
        zoom: 1.0,
        roundPixels: true,
        gravity: 800,
        playerSpeed: { min: 160, max: 260 },
        jumpForce: -480
    },

    // Estado atual do jogo (em memória, não localStorage)
    state: {
        currentLevel: 0,
        currentWorld: 1,
        playerName: 'Anônimo',
        isPaused: false,
        elapsedTime: 0,
        selectedCharacter: 'vocalista',
        mapCursorLevel: 0, // Posição do cursor no WorldMap
        activeSlot: null, // Slot ativo (1-4)
        // Referência à cena do jogo (para resume)
        gameSceneRef: null
    },

    // ==================== SISTEMA DE SLOTS ====================

    /**
     * Cria um novo slot vazio
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
            bestTimes: {} // { levelIndex: time }
        };
    },

    /**
     * Retorna todos os slots (4 slots, alguns podem ser null se vazios)
     */
    getAllSlots() {
        const stored = localStorage.getItem(this.STORAGE_KEY_SLOTS);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error('Erro ao carregar slots:', e);
            }
        }
        // Retorna array com 4 slots vazios
        return [null, null, null, null];
    },

    /**
     * Salva todos os slots
     */
    saveAllSlots(slots) {
        localStorage.setItem(this.STORAGE_KEY_SLOTS, JSON.stringify(slots));
    },

    /**
     * Retorna um slot específico
     */
    getSlot(slotId) {
        const slots = this.getAllSlots();
        return slots[slotId - 1] || null;
    },

    /**
     * Salva um slot específico
     */
    saveSlot(slotId, slotData) {
        const slots = this.getAllSlots();
        slots[slotId - 1] = slotData;
        this.saveAllSlots(slots);
    },

    /**
     * Cria um novo jogo em um slot
     */
    createNewGame(slotId, playerName) {
        const slot = this.createEmptySlot(slotId);
        slot.playerName = playerName || 'Anônimo';
        slot.createdAt = new Date().toISOString();
        slot.lastPlayedAt = slot.createdAt;
        
        this.saveSlot(slotId, slot);
        this.setActiveSlot(slotId);
        this.loadSlotIntoState(slot);
        
        return slot;
    },

    /**
     * Deleta um slot
     */
    deleteSlot(slotId) {
        const slots = this.getAllSlots();
        slots[slotId - 1] = null;
        this.saveAllSlots(slots);
        
        // Se era o slot ativo, limpa
        if (this.state.activeSlot === slotId) {
            this.state.activeSlot = null;
            localStorage.removeItem(this.STORAGE_KEY_ACTIVE);
        }
    },

    /**
     * Define o slot ativo
     */
    setActiveSlot(slotId) {
        this.state.activeSlot = slotId;
        localStorage.setItem(this.STORAGE_KEY_ACTIVE, slotId.toString());
    },

    /**
     * Retorna o slot ativo
     */
    getActiveSlot() {
        if (this.state.activeSlot) {
            return this.state.activeSlot;
        }
        const stored = localStorage.getItem(this.STORAGE_KEY_ACTIVE);
        if (stored) {
            this.state.activeSlot = parseInt(stored);
            return this.state.activeSlot;
        }
        return null;
    },

    /**
     * Carrega um slot para a memória (state)
     */
    loadSlotIntoState(slot) {
        if (!slot) return;
        
        this.state.playerName = slot.playerName;
        this.state.selectedCharacter = slot.selectedCharacter;
        this.state.currentWorld = slot.mapPosition?.worldId || 1;
        this.state.mapCursorLevel = slot.mapPosition?.levelIndex || 0;
        this.state.activeSlot = slot.id;
    },

    /**
     * Carrega o slot ativo para o estado
     */
    loadActiveSlotIntoState() {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot) {
                this.loadSlotIntoState(slot);
                return true;
            }
        }
        return false;
    },

    /**
     * Atualiza o timestamp de último jogo do slot ativo
     */
    updateLastPlayed() {
        const slotId = this.getActiveSlot();
        if (!slotId) return;
        
        const slot = this.getSlot(slotId);
        if (slot) {
            slot.lastPlayedAt = new Date().toISOString();
            this.saveSlot(slotId, slot);
        }
    },

    /**
     * Verifica se há algum slot com progresso
     */
    hasAnyProgress() {
        const slots = this.getAllSlots();
        return slots.some(slot => slot !== null);
    },

    /**
     * Retorna informações resumidas de um slot para exibição
     */
    getSlotSummary(slotId) {
        const slot = this.getSlot(slotId);
        if (!slot) {
            return {
                isEmpty: true,
                slotId: slotId
            };
        }
        
        const completedLevels = slot.completedLevels?.length || 0;
        const totalLevels = this.LEVELS.length;
        const completedWorlds = slot.completedWorlds?.length || 0;
        const totalWorlds = this.WORLDS.length;
        
        return {
            isEmpty: false,
            slotId: slotId,
            playerName: slot.playerName || 'Anônimo',
            completedLevels: completedLevels,
            totalLevels: totalLevels,
            completedWorlds: completedWorlds,
            totalWorlds: totalWorlds,
            lastPlayedAt: slot.lastPlayedAt,
            unlockedCharacters: slot.unlockedCharacters?.length || 1
        };
    },

    // ==================== PROGRESSO (usa slot ativo) ====================
    
    /**
     * Salva o nome do jogador no slot ativo
     */
    savePlayerName(playerName) {
        const slotId = this.getActiveSlot();
        if (!slotId) return;
        
        const slot = this.getSlot(slotId);
        if (slot) {
            slot.playerName = playerName;
            this.saveSlot(slotId, slot);
        }
        this.state.playerName = playerName;
    },

    /**
     * Carrega o nome do jogador do slot ativo
     */
    loadPlayerName() {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot) {
                return slot.playerName || 'Anônimo';
            }
        }
        return 'Anônimo';
    },

    /**
     * Marca uma fase como completa no slot ativo
     */
    markLevelComplete(levelIndex) {
        const slotId = this.getActiveSlot();
        if (!slotId) return;
        
        const slot = this.getSlot(slotId);
        if (!slot) return;
        
        if (!slot.completedLevels) slot.completedLevels = [];
        
        if (!slot.completedLevels.includes(levelIndex)) {
            slot.completedLevels.push(levelIndex);
            slot.completedLevels.sort((a, b) => a - b);
            this.saveSlot(slotId, slot);
        }
    },

    /**
     * Retorna lista de fases completadas do slot ativo
     */
    getCompletedLevels() {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot && slot.completedLevels) {
                return [...slot.completedLevels];
            }
        }
        return [];
    },

    /**
     * Verifica se uma fase foi completada
     */
    isLevelComplete(levelIndex) {
        return this.getCompletedLevels().includes(levelIndex);
    },

    /**
     * Verifica se uma fase está desbloqueada
     */
    isLevelUnlocked(levelIndex) {
        if (levelIndex === 0) return true;
        
        const level = this.LEVELS[levelIndex];
        if (!level) return false;
        
        const world = this.getWorldForLevel(levelIndex);
        if (!world) return false;
        
        const levelIndexInWorld = world.levels.indexOf(levelIndex);
        if (levelIndexInWorld === 0) {
            return this.isWorldUnlocked(world.id);
        }
        
        const previousLevelIndex = world.levels[levelIndexInWorld - 1];
        return this.isLevelComplete(previousLevelIndex);
    },

    /**
     * Verifica se um mundo está desbloqueado
     */
    isWorldUnlocked(worldId) {
        if (worldId === 1) return true;
        
        const previousWorld = this.WORLDS.find(w => w.id === worldId - 1);
        return previousWorld ? this.isWorldComplete(previousWorld.id) : false;
    },

    /**
     * Retorna a próxima fase não-completa de um mundo
     */
    getNextUnlockedLevel(worldId) {
        const world = this.WORLDS.find(w => w.id === worldId);
        if (!world) return 0;
        
        for (const levelIndex of world.levels) {
            if (!this.isLevelComplete(levelIndex)) {
                return levelIndex;
            }
        }
        
        return world.levels[world.levels.length - 1];
    },

    /**
     * Verifica se há progresso salvo no slot ativo
     */
    hasProgress() {
        return this.getCompletedLevels().length > 0;
    },

    /**
     * Limpa o progresso do slot ativo (usado apenas internamente)
     */
    clearProgress() {
        const slotId = this.getActiveSlot();
        if (!slotId) return;
        
        const slot = this.getSlot(slotId);
        if (slot) {
            slot.completedLevels = [];
            slot.completedWorlds = [];
            slot.unlockedCharacters = ['vocalista'];
            slot.selectedCharacter = 'vocalista';
            slot.mapPosition = { worldId: 1, levelIndex: 0 };
            slot.bestTimes = {};
            this.saveSlot(slotId, slot);
        }
        
        this.state.currentLevel = 0;
        this.state.currentWorld = 1;
        this.state.mapCursorLevel = 0;
    },

    /**
     * Compatibilidade: saveProgress
     */
    saveProgress(level, playerName) {
        this.savePlayerName(playerName);
        this.state.currentLevel = level;
        this.updateLastPlayed();
    },

    /**
     * Compatibilidade: loadProgress
     */
    loadProgress() {
        const playerName = this.loadPlayerName();
        const completedLevels = this.getCompletedLevels();
        const nextLevel = completedLevels.length > 0 
            ? Math.max(...completedLevels) + 1 
            : 0;
        
        return {
            level: Math.min(nextLevel, this.LEVELS.length - 1),
            playerName: playerName
        };
    },

    // ==================== RANKINGS (por slot) ====================

    getTopRecords(level, limit = 4) {
        const slotId = this.getActiveSlot();
        if (!slotId) return [];
        
        const slot = this.getSlot(slotId);
        if (!slot || !slot.bestTimes) return [];
        
        // Para compatibilidade, retorna no formato de array
        const time = slot.bestTimes[level];
        if (time !== undefined) {
            return [{
                time: time,
                playerName: slot.playerName,
                date: slot.lastPlayedAt
            }];
        }
        return [];
    },

    /**
     * Salva um tempo no slot ativo
     */
    saveRecord(level, time, playerName, topN = 4) {
        const slotId = this.getActiveSlot();
        if (!slotId) return { saved: false, position: 0, isRecord: false };
        
        const slot = this.getSlot(slotId);
        if (!slot) return { saved: false, position: 0, isRecord: false };
        
        if (!slot.bestTimes) slot.bestTimes = {};
        
        const previousBest = slot.bestTimes[level];
        const isNewRecord = previousBest === undefined || time < previousBest;
        
        if (isNewRecord) {
            slot.bestTimes[level] = time;
            this.saveSlot(slotId, slot);
        }
        
        return {
            saved: isNewRecord,
            position: 1,
            isRecord: isNewRecord
        };
    },

    getBestTime(level) {
        const slotId = this.getActiveSlot();
        if (!slotId) return null;
        
        const slot = this.getSlot(slotId);
        if (slot && slot.bestTimes) {
            return slot.bestTimes[level] ?? null;
        }
        return null;
    },

    getTotalBestTime() {
        let total = 0;
        for (let i = 0; i < this.LEVELS.length; i++) {
            const best = this.getBestTime(i);
            if (best === null) return null;
            total += best;
        }
        return total;
    },

    // ==================== FORMATAÇÃO ====================

    formatTime(ms) {
        const totalSeconds = ms / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const millis = Math.floor(ms % 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    },

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (e) {
            return '--/--/---- --:--';
        }
    },

    formatDateShort(dateString) {
        try {
            const date = new Date(dateString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${day}/${month}`;
        } catch (e) {
            return '--/--';
        }
    },

    // ==================== MUNDOS E PERSONAGENS ====================

    checkWorldCompletion(levelIndex) {
        for (const world of this.WORLDS) {
            const lastLevelOfWorld = Math.max(...world.levels);
            if (levelIndex === lastLevelOfWorld) {
                return world;
            }
        }
        return null;
    },

    getWorldForLevel(levelIndex) {
        return this.WORLDS.find(w => w.levels.includes(levelIndex)) || null;
    },

    /**
     * Desbloqueia um personagem no slot ativo
     */
    unlockCharacter(characterId) {
        const slotId = this.getActiveSlot();
        if (!slotId) return;
        
        const slot = this.getSlot(slotId);
        if (!slot) return;
        
        if (!slot.unlockedCharacters) slot.unlockedCharacters = ['vocalista'];
        
        if (!slot.unlockedCharacters.includes(characterId)) {
            slot.unlockedCharacters.push(characterId);
            this.saveSlot(slotId, slot);
        }
    },

    /**
     * Retorna lista de personagens desbloqueados do slot ativo
     */
    getUnlockedCharacters() {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot && slot.unlockedCharacters) {
                return [...slot.unlockedCharacters];
            }
        }
        return ['vocalista'];
    },

    isCharacterUnlocked(characterId) {
        const character = this.CHARACTERS.find(c => c.id === characterId);
        if (!character) return false;
        if (character.unlockedByDefault) return true;
        return this.getUnlockedCharacters().includes(characterId);
    },

    getCharacter(characterId) {
        return this.CHARACTERS.find(c => c.id === characterId) || this.CHARACTERS[0];
    },

    /**
     * Salva o personagem selecionado no slot ativo
     */
    saveSelectedCharacter(characterId) {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot) {
                slot.selectedCharacter = characterId;
                this.saveSlot(slotId, slot);
            }
        }
        this.state.selectedCharacter = characterId;
    },

    /**
     * Carrega o personagem selecionado do slot ativo
     */
    loadSelectedCharacter() {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot && slot.selectedCharacter && this.isCharacterUnlocked(slot.selectedCharacter)) {
                this.state.selectedCharacter = slot.selectedCharacter;
                return slot.selectedCharacter;
            }
        }
        return 'vocalista';
    },

    getAvailableCharacters() {
        return this.CHARACTERS.filter(c => this.isCharacterUnlocked(c.id));
    },

    /**
     * Marca um mundo como completado no slot ativo
     */
    markWorldComplete(worldId) {
        const slotId = this.getActiveSlot();
        if (!slotId) return;
        
        const slot = this.getSlot(slotId);
        if (!slot) return;
        
        if (!slot.completedWorlds) slot.completedWorlds = [];
        
        if (!slot.completedWorlds.includes(worldId)) {
            slot.completedWorlds.push(worldId);
            this.saveSlot(slotId, slot);
        }
    },

    getCompletedWorlds() {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot && slot.completedWorlds) {
                return [...slot.completedWorlds];
            }
        }
        return [];
    },

    isWorldComplete(worldId) {
        return this.getCompletedWorlds().includes(worldId);
    },

    /**
     * Salva a posição do cursor no mapa do slot ativo
     */
    saveMapPosition(worldId, levelIndex) {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot) {
                slot.mapPosition = { worldId, levelIndex };
                this.saveSlot(slotId, slot);
            }
        }
        this.state.currentWorld = worldId;
        this.state.mapCursorLevel = levelIndex;
    },

    /**
     * Carrega a posição do cursor no mapa do slot ativo
     */
    loadMapPosition() {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot && slot.mapPosition) {
                const { worldId, levelIndex } = slot.mapPosition;
                
                // Valida se a posição é válida
                const world = this.WORLDS.find(w => w.id === worldId);
                if (world && this.isWorldUnlocked(worldId)) {
                    if (this.isLevelUnlocked(levelIndex)) {
                        return { worldId, levelIndex };
                    }
                    return { worldId, levelIndex: this.getNextUnlockedLevel(worldId) };
                }
            }
        }
        return { worldId: 1, levelIndex: 0 };
    },

    getWorldLevelsWithStatus(worldId) {
        const world = this.WORLDS.find(w => w.id === worldId);
        if (!world) return [];
        
        return world.levels.map(levelIndex => {
            const level = this.LEVELS[levelIndex];
            return {
                ...level,
                index: levelIndex,
                isComplete: this.isLevelComplete(levelIndex),
                isUnlocked: this.isLevelUnlocked(levelIndex),
                bestTime: this.getBestTime(levelIndex)
            };
        });
    },

    // ==================== CONTROLES VIRTUAIS ====================

    getVirtualControls() {
        return window.virtualControls || {
            left: false,
            right: false,
            jump: false,
            jumpHeld: false,
            jumpJustPressed: false,
            restart: false
        };
    }
};

// Exporta globalmente
window.GameData = GameData;
