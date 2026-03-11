/**
 * GAME DATA - Módulo Centralizado de Dados
 * 
 * Gerencia:
 * - Sistema de Slots (4 partidas independentes)
 * - Rankings (hi-scores)
 * - Progresso salvo
 * - Configurações de níveis
 * - Estado do jogo
 * - Feature Flags (funcionalidades experimentais)
 */

const GameData = {
    // ==================== VERSÃO ====================
    VERSION: `v${window.GAME_VERSION || '0.0'}`,

    // Helper para cache-busting em caminhos de assets
    assetUrl(path) {
        return `${path}?v=${this.VERSION}`;
    },

    // ==================== FEATURE FLAGS ====================
    // Sistema para testar novas funcionalidades
    // Pode ser ativado via URL: ?trail=true&particles=true
    // Ou programaticamente: GameData.FEATURES.playerTrail = true
    FEATURES: {
        // ===== EFEITOS VISUAIS =====
        // Efeito de rastro do jogador (estilo "trail do mouse" do Windows)
        playerTrail: true,
        
        // Partículas ao coletar estrelas
        starParticles: false,
        
        // Efeito de poeira ao andar/pular
        dustEffect: false,
        
        // Burst neon ao pular
        jumpNeonBurst: false,
        
        // Burst neon ao pousar
        landNeonBurst: false,
        
        // Linha neon brilhante seguindo a trajetória do jogador
        neonLineTrail: false,
        
        // Screen shake ao tomar dano
        screenShake: false,
        
        // Slow motion ao completar fase
        victorySlowMo: false,
        
        // ===== MECÂNICAS DE FÍSICA =====
        // Double-jump: pular novamente no ar
        doubleJump: false,
        
        // Física de água: gravidade e movimento reduzidos
        waterPhysics: true,
    },

    /**
     * Inicializa feature flags a partir de URL params
     * Chamado no início do jogo (game.js)
     */
    initFeatureFlags() {
        const urlParams = new URLSearchParams(window.location.search);
        
        Object.keys(this.FEATURES).forEach(feature => {
            const urlValue = urlParams.get(feature);
            if (urlValue === 'true') {
                this.FEATURES[feature] = true;
                console.log(`🚩 Feature "${feature}" ativada via URL`);
            } else if (urlValue === 'false') {
                this.FEATURES[feature] = false;
            }
        });
        
        // Log das features ativas
        const activeFeatures = Object.entries(this.FEATURES)
            .filter(([_, v]) => v)
            .map(([k, _]) => k);
        if (activeFeatures.length > 0) {
            console.log('🎮 Features ativas:', activeFeatures.join(', '));
        }
    },

    /**
     * Verifica se uma feature está ativa
     * @param {string} featureName - Nome da feature
     * @returns {boolean}
     */
    isFeatureEnabled(featureName) {
        return this.FEATURES[featureName] === true;
    },

    // ==================== CONFIGURAÇÕES DE SLOTS ====================
    MAX_SLOTS: 4,
    STORAGE_KEY_SLOTS: 'rockHero_slots',
    STORAGE_KEY_ACTIVE: 'rockHero_activeSlot',

    // ==================== PERSONAGENS ====================
    // Definição centralizada de sprites - todas as cenas usam isso
    CHARACTERS: [
        {
            id: 'vocalista',
            name: 'Vocalista',
            instrument: 'Voz',
            unlockedByDefault: true,
            sprites: {
                idle: {
                    key: 'hero-idle',
                    file: 'assets/spritesheets/still-hero.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                walk: {
                    key: 'hero-walk',
                    file: 'assets/spritesheets/walking-hero2.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 14
                },
                jump: {
                    key: 'hero-jump',
                    file: 'assets/spritesheets/jumping-hero.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                }
                // Vocalista não tem walk-left separado, usa flip
            }
        },
        {
            id: 'baterista',
            name: 'Baterista',
            instrument: 'Bateria',
            unlockedByDefault: false,
            unlockedByWorld: 1,
            sprites: {
                idle: {
                    key: 'baterista-idle',
                    file: 'assets/spritesheets/baterista-parado-animado-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                walk: {
                    key: 'baterista-walk',
                    file: 'assets/spritesheets/baterista-andando-pra-direita-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                'walk-left': {
                    key: 'baterista-walk-left',
                    file: 'assets/spritesheets/baterista-andando-pra-esq-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                jump: null // TODO: criar sprite de pulo (usa idle por enquanto)
            }
        },
        {
            id: 'baixista',
            name: 'Baixista',
            instrument: 'Baixo',
            unlockedByDefault: false,
            unlockedByWorld: 2,
            sprites: {
                idle: {
                    key: 'baixista-idle',
                    file: 'assets/spritesheets/baixista-parado-animado-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                walk: {
                    key: 'baixista-walk',
                    file: 'assets/spritesheets/baixista-andando2-dir-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                'walk-left': {
                    key: 'baixista-walk-left',
                    file: 'assets/spritesheets/baixista-andando-esq-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                jump: null // TODO: criar sprite de pulo (usa idle por enquanto)
            }
        },
        {
            id: 'guitarrista',
            name: 'Guitarrista',
            instrument: 'Guitarra',
            unlockedByDefault: false,
            unlockedByWorld: 3,
            sprites: {
                idle: {
                    key: 'guitarrista-idle',
                    file: 'assets/spritesheets/Guitarrista-parado-2-animado3-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                walk: {
                    key: 'guitarrista-walk',
                    file: 'assets/spritesheets/Guitarrista-andando-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                'walk-left': {
                    key: 'guitarrista-walk-left',
                    file: 'assets/spritesheets/Guitarrista-andando-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                jump: null // TODO: criar sprite de pulo (usa idle por enquanto)
            }
        }
        // Futuros personagens: tecladista...
    ],

    // ==================== MUNDOS ====================
    WORLDS: [
        {
            id: 1,
            name: 'Mundo 1',
            subtitle: 'O Resgate do Baterista',
            levels: [0, 1, 2, 3, 4], // Índices das fases (0-4 = fases 0-1 até 4)
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
            levels: [5, 6, 7, 8, 9], // 5 fases (map5 a map10)
            rescuedCharacter: 'baixista',
            celebrationMessage: 'Você resgatou o Baixista!',
            // Visual no WorldMap (tema caverna/noturno)
            theme: 'cave',
            bgColor: 0x1a1a2e, // Azul escuro noturno
            pathColor: 0x4a4a6a // Cinza arroxeado
        },
        {
            id: 3,
            name: 'Mundo 3',
            subtitle: 'O Resgate do Guitarrista',
            levels: [10, 11], // 2 fases (map11, map12)
            rescuedCharacter: 'guitarrista',
            celebrationMessage: 'Você resgatou o Guitarrista!',
            // Visual no WorldMap (tema aquático)
            theme: 'water',
            bgColor: 0x0a2a4a, // Azul profundo
            pathColor: 0x2288aa // Azul água
        }
        // Futuros mundos: Mundo 4 (Tecladista)...
    ],

    // Configuração das fases
    LEVELS: [
        { 
            key: 'map0-0', 
            file: 'assets/map0-0.json', 
            name: 'Primeiros Passos',
            zoom: 1,
            roundPixels: true,
            world: 1,
            // Posição no WorldMap (relativa ao mundo)
            mapPosition: { x: 80, y: 200 },
            connectsTo: [1] // Conecta à fase 1
        },
        { 
            key: 'map0-1', 
            file: 'assets/map0-1.json', 
            name: 'Descobrindo o mundo',
            zoom: 1.0,
            roundPixels: true,
            world: 1,
            mapPosition: { x: 160, y: 190 },
            connectsTo: [2] // Conecta à fase 2
        },
        { 
            key: 'map2', 
            file: 'assets/map-2--expansion and speed.json', 
            name: 'Pulos decisivos',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 240, y: 180 },
            connectsTo: [3]
        },
        { 
            key: 'map3', 
            file: 'assets/map-3--desafio do luigi.json', 
            name: 'Sapos e lava',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 340, y: 220 },
            connectsTo: [4]
        },
        {
            key: 'map4',
            file: 'assets/map-4--big-jumps.json',
            name: 'Os Pulos Maiores',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 440, y: 180 },
            connectsTo: [] // Última fase do mundo
        },
        // ==================== MUNDO 2 ====================
        { 
            key: 'map5', 
            file: 'assets/map-5--caverna.json',
            name: 'Cristais Fascinantes',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 80, y: 200 },
            connectsTo: [6]
        },
        { 
            key: 'map6', 
            file: 'assets/map-6--caverna2.json',
            name: 'Ative o turbo!',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 170, y: 160 },
            connectsTo: [7]
        },
        { 
            key: 'map7', 
            file: 'assets/map-7--planicie.json',
            name: 'Caos de anfíbios',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 270, y: 210 },
            connectsTo: [8]
        },
        { 
            key: 'map8', 
            file: 'assets/map-8.json',
            name: 'Simples',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 370, y: 180 },
            connectsTo: [9] // Conecta à fase 10 (map10)
        },
        /*
        { 
            key: 'map9', 
            file: 'assets/map9.json',
            name: 'Águas Profundas',
            zoom: 1.0,
            roundPixels: true,
            world: 2,
            mapPosition: { x: 580, y: 220 },
            connectsTo: []
        },
        */
        { 
            key: 'map10', 
            file: 'assets/map-10.json',
            name: 'Ruínas Submersas',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 460, y: 220 },
            connectsTo: [] // Última fase do mundo 2
        },
        { 
            key: 'map11', 
            file: 'assets/map-11.json',
            name: 'Labirinto de Lava',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 120, y: 200 },
            connectsTo: [11], // Conecta ao map12 (índice 11)
            // Features ativadas automaticamente nesta fase
            features: { doubleJump: true, neonLineTrail: true }
        },
        { 
            key: 'map12', 
            file: 'assets/map-12.json',
            name: 'Abismo Submerso',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 360, y: 210 },
            connectsTo: []
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

    // ==================== SPRITE LOADING UTILITIES ====================

    /**
     * Carrega spritesheets de personagens no preload() de uma cena
     * @param {Phaser.Scene} scene - A cena Phaser
     * @param {string|string[]|null} characterIds - IDs dos personagens a carregar, ou null para todos
     */
    loadCharacterSprites(scene, characterIds = null) {
        const loadedKeys = new Set();
        
        // Determina quais personagens carregar
        let characters;
        if (characterIds === null) {
            characters = this.CHARACTERS;
        } else if (typeof characterIds === 'string') {
            characters = [this.getCharacter(characterIds)];
        } else {
            characters = characterIds.map(id => this.getCharacter(id));
        }
        
        // Carrega sprites de cada personagem
        characters.forEach(character => {
            if (!character || !character.sprites) return;
            
            Object.values(character.sprites).forEach(sprite => {
                if (!sprite || loadedKeys.has(sprite.key)) return;
                loadedKeys.add(sprite.key);
                
                scene.load.spritesheet(sprite.key, GameData.assetUrl(sprite.file), {
                    frameWidth: sprite.frameWidth,
                    frameHeight: sprite.frameHeight
                });
            });
        });
    },

    /**
     * Cria animações para um personagem específico
     * @param {Phaser.Scene} scene - A cena Phaser
     * @param {string} characterId - ID do personagem
     * @param {string} prefix - Prefixo para nomes das animações (ex: 'player-' ou '')
     * @param {boolean} recreate - Se deve recriar animações existentes
     */
    createCharacterAnimations(scene, characterId, prefix = '', recreate = false) {
        const character = this.getCharacter(characterId);
        if (!character || !character.sprites) return;
        
        const sprites = character.sprites;
        
        // Para cada estado (idle, walk, jump, walk-left...)
        Object.entries(sprites).forEach(([state, sprite]) => {
            // Se sprite é null, pula (ex: jump sem sprite próprio)
            if (!sprite) return;
            
            const animKey = prefix + state;
            
            // Remove animação existente se recreate=true
            if (recreate && scene.anims.exists(animKey)) {
                scene.anims.remove(animKey);
            }
            
            // Cria animação se não existir
            if (!scene.anims.exists(animKey)) {
                scene.anims.create({
                    key: animKey,
                    frames: scene.anims.generateFrameNumbers(sprite.key, {
                        start: sprite.startFrame,
                        end: sprite.endFrame
                    }),
                    frameRate: sprite.frameRate,
                    repeat: -1
                });
            }
        });
    },

    /**
     * Retorna a texture key para um estado específico de um personagem
     * Útil quando precisa da textura diretamente (ex: criar sprite inicial)
     * @param {string} characterId - ID do personagem
     * @param {string} state - Estado desejado (idle, walk, jump, walk-left)
     * @returns {string} - Key da textura
     */
    getCharacterTextureKey(characterId, state = 'idle') {
        const character = this.getCharacter(characterId);
        if (!character || !character.sprites) return 'hero-idle';
        
        const sprite = character.sprites[state];
        if (!sprite) {
            // Fallback para idle se estado não existir
            return character.sprites.idle?.key || 'hero-idle';
        }
        return sprite.key;
    },

    /**
     * Aplica filtro em sprites de personagens
     * @param {Phaser.Scene} scene - A cena Phaser
     * @param {string|string[]|null} characterIds - IDs dos personagens, ou null para todos
     * @param {number} filterMode - Phaser.Textures.FilterMode (NEAREST ou LINEAR)
     */
    _applyFilter(scene, characterIds, filterMode) {
        // Determina quais personagens processar
        let characters;
        if (characterIds === null) {
            characters = this.CHARACTERS;
        } else if (typeof characterIds === 'string') {
            characters = [this.getCharacter(characterIds)];
        } else {
            characters = characterIds.map(id => this.getCharacter(id));
        }
        
        // Aplica filtro em todas as texturas
        characters.forEach(character => {
            if (!character || !character.sprites) return;
            
            Object.values(character.sprites).forEach(sprite => {
                if (sprite && sprite.key && scene.textures.exists(sprite.key)) {
                    scene.textures.get(sprite.key).setFilter(filterMode);
                }
            });
        });
    },

    /**
     * Aplica filtro NEAREST (pixel art nítido) em sprites de personagens
     * Ideal para sprites ampliados (scale > 1) ou zoom >= 1
     * @param {Phaser.Scene} scene - A cena Phaser
     * @param {string|string[]|null} characterIds - IDs dos personagens, ou null para todos
     */
    applyPixelArtFilter(scene, characterIds = null) {
        this._applyFilter(scene, characterIds, Phaser.Textures.FilterMode.NEAREST);
    },

    /**
     * Aplica filtro LINEAR (suavizado) em sprites de personagens
     * Ideal para sprites reduzidos (zoom < 1) para evitar aliasing
     * @param {Phaser.Scene} scene - A cena Phaser
     * @param {string|string[]|null} characterIds - IDs dos personagens, ou null para todos
     */
    applyLinearFilter(scene, characterIds = null) {
        this._applyFilter(scene, characterIds, Phaser.Textures.FilterMode.LINEAR);
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
            back: false,
            backJustPressed: false
        };
    }
};

// Exporta globalmente
window.GameData = GameData;
