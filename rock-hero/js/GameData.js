/**
 * GAME DATA - Módulo Centralizado de Dados
 * 
 * Gerencia:
 * - Rankings (hi-scores)
 * - Progresso salvo
 * - Configurações de níveis
 * - Estado do jogo
 */

const GameData = {
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
            file: 'assets/map.json', // TODO: criar mapa próprio
            name: 'Caverna Sombria',
            zoom: 1.0,
            roundPixels: true,
            world: 2,
            mapPosition: { x: 80, y: 200 },
            connectsTo: [5]
        },
        { 
            key: 'map6', 
            file: 'assets/map.json', // TODO: criar mapa próprio
            name: 'Cristais Perigosos',
            zoom: 1.0,
            roundPixels: true,
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
        // Referência à cena do jogo (para resume)
        gameSceneRef: null
    },

    // ==================== PROGRESSO ====================
    
    /**
     * Salva o nome do jogador
     */
    savePlayerName(playerName) {
        localStorage.setItem('rockHero_playerName', playerName);
        this.state.playerName = playerName;
    },

    /**
     * Carrega o nome do jogador
     */
    loadPlayerName() {
        return localStorage.getItem('rockHero_playerName') || 'Anônimo';
    },

    /**
     * Marca uma fase como completa
     */
    markLevelComplete(levelIndex) {
        const key = 'rockHero_completedLevels';
        let completed = this.getCompletedLevels();
        
        if (!completed.includes(levelIndex)) {
            completed.push(levelIndex);
            completed.sort((a, b) => a - b);
            localStorage.setItem(key, JSON.stringify(completed));
        }
    },

    /**
     * Retorna lista de fases completadas
     */
    getCompletedLevels() {
        const key = 'rockHero_completedLevels';
        const stored = localStorage.getItem(key);
        
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return [];
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
     * - Fase 0 (primeira) sempre desbloqueada
     * - Outras fases: fase anterior precisa estar completa
     */
    isLevelUnlocked(levelIndex) {
        if (levelIndex === 0) return true;
        
        // Verifica se a fase anterior está completa
        const level = this.LEVELS[levelIndex];
        if (!level) return false;
        
        // Encontra a fase anterior no mesmo mundo
        const world = this.getWorldForLevel(levelIndex);
        if (!world) return false;
        
        const levelIndexInWorld = world.levels.indexOf(levelIndex);
        if (levelIndexInWorld === 0) {
            // Primeira fase do mundo - verifica se o mundo está desbloqueado
            return this.isWorldUnlocked(world.id);
        }
        
        // Verifica se a fase anterior está completa
        const previousLevelIndex = world.levels[levelIndexInWorld - 1];
        return this.isLevelComplete(previousLevelIndex);
    },

    /**
     * Verifica se um mundo está desbloqueado
     * - Mundo 1 sempre desbloqueado
     * - Outros mundos: mundo anterior precisa estar completo
     */
    isWorldUnlocked(worldId) {
        if (worldId === 1) return true;
        
        // Verifica se o mundo anterior está completo
        const previousWorld = this.WORLDS.find(w => w.id === worldId - 1);
        return previousWorld ? this.isWorldComplete(previousWorld.id) : false;
    },

    /**
     * Retorna a próxima fase não-completa de um mundo
     * (onde o jogador deve estar no mapa)
     */
    getNextUnlockedLevel(worldId) {
        const world = this.WORLDS.find(w => w.id === worldId);
        if (!world) return 0;
        
        for (const levelIndex of world.levels) {
            if (!this.isLevelComplete(levelIndex)) {
                return levelIndex;
            }
        }
        
        // Todas completas - retorna a última
        return world.levels[world.levels.length - 1];
    },

    /**
     * Verifica se há progresso salvo
     */
    hasProgress() {
        return this.getCompletedLevels().length > 0 || 
               localStorage.getItem('rockHero_playerName') !== null;
    },

    /**
     * Limpa todo o progresso
     */
    clearProgress() {
        localStorage.removeItem('rockHero_completedLevels');
        localStorage.removeItem('rockHero_completedWorlds');
        localStorage.removeItem('rockHero_unlockedCharacters');
        this.state.currentLevel = 0;
        this.state.currentWorld = 1;
        this.state.mapCursorLevel = 0;
    },

    /**
     * Compatibilidade: saveProgress (usado pelo GameScene)
     */
    saveProgress(level, playerName) {
        this.savePlayerName(playerName);
        // Não marca como completo aqui - isso é feito ao completar a fase
        this.state.currentLevel = level;
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

    // ==================== RANKINGS ====================

    getTopRecords(level, limit = 4) {
        const key = `rockHero_records_level${level}`;
        const stored = localStorage.getItem(key);
        
        if (stored) {
            try {
                const records = JSON.parse(stored);
                return records.slice(0, limit);
            } catch (e) {
                // Fallback para formato antigo
                return this._migrateLegacyRecords(level);
            }
        }
        return [];
    },

    /**
     * Salva um tempo se ele estiver entre os top N
     * @param {number} level - Índice da fase
     * @param {number} time - Tempo em ms
     * @param {string} playerName - Nome do jogador
     * @param {number} topN - Quantos melhores tempos manter (default: 4)
     * @returns {object} { saved: boolean, position: number, isRecord: boolean }
     */
    saveRecord(level, time, playerName, topN = 4) {
        const key = `rockHero_records_level${level}`;
        
        // Obtém lista atual
        let records = this.getTopRecords(level, 100); // Pega todos
        
        // Verifica se entra no ranking antes de adicionar
        const wouldRank = records.length < topN || time < records[records.length - 1]?.time || records.length === 0;
        
        // Novo recorde
        const newRecord = {
            time: time,
            playerName: playerName || 'Anônimo',
            date: new Date().toISOString()
        };
        
        // Adiciona e ordena
        records.push(newRecord);
        records.sort((a, b) => a.time - b.time);
        
        // Encontra posição do novo tempo
        const position = records.findIndex(r => r.time === time && r.date === newRecord.date) + 1;
        
        // Mantém top N
        records = records.slice(0, topN);
        
        // Só salva se entrou no ranking
        const saved = position <= topN;
        if (saved) {
            localStorage.setItem(key, JSON.stringify(records));
        }
        
        return {
            saved: saved,
            position: position,
            isRecord: position === 1
        };
    },

    getBestTime(level) {
        const records = this.getTopRecords(level, 1);
        return records.length > 0 ? records[0].time : null;
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

    _migrateLegacyRecords(level) {
        const oldKey = `rockHero_record_level${level}`;
        const oldStored = localStorage.getItem(oldKey);
        if (oldStored) {
            try {
                const oldRecord = JSON.parse(oldStored);
                return [oldRecord];
            } catch (e) {
                const time = parseFloat(oldStored);
                if (!isNaN(time)) {
                    return [{ time: time, playerName: 'Anônimo', date: new Date().toISOString() }];
                }
            }
        }
        return [];
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

    // ==================== MUNDOS E PERSONAGENS ====================

    /**
     * Verifica se completar esta fase conclui um mundo
     * @param {number} levelIndex - Índice da fase completada
     * @returns {object|null} - Dados do mundo completado ou null
     */
    checkWorldCompletion(levelIndex) {
        for (const world of this.WORLDS) {
            const lastLevelOfWorld = Math.max(...world.levels);
            if (levelIndex === lastLevelOfWorld) {
                return world;
            }
        }
        return null;
    },

    /**
     * Retorna o mundo ao qual uma fase pertence
     */
    getWorldForLevel(levelIndex) {
        return this.WORLDS.find(w => w.levels.includes(levelIndex)) || null;
    },

    /**
     * Desbloqueia um personagem
     */
    unlockCharacter(characterId) {
        const unlockedKey = 'rockHero_unlockedCharacters';
        let unlocked = this.getUnlockedCharacters();
        
        if (!unlocked.includes(characterId)) {
            unlocked.push(characterId);
            localStorage.setItem(unlockedKey, JSON.stringify(unlocked));
        }
    },

    /**
     * Retorna lista de personagens desbloqueados
     */
    getUnlockedCharacters() {
        const unlockedKey = 'rockHero_unlockedCharacters';
        const stored = localStorage.getItem(unlockedKey);
        
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return ['vocalista'];
            }
        }
        
        // Por padrão, apenas o vocalista está desbloqueado
        return ['vocalista'];
    },

    /**
     * Verifica se um personagem está desbloqueado
     */
    isCharacterUnlocked(characterId) {
        const character = this.CHARACTERS.find(c => c.id === characterId);
        if (!character) return false;
        if (character.unlockedByDefault) return true;
        return this.getUnlockedCharacters().includes(characterId);
    },

    /**
     * Retorna dados de um personagem pelo ID
     */
    getCharacter(characterId) {
        return this.CHARACTERS.find(c => c.id === characterId) || this.CHARACTERS[0];
    },

    /**
     * Salva o personagem selecionado
     */
    saveSelectedCharacter(characterId) {
        localStorage.setItem('rockHero_selectedCharacter', characterId);
        this.state.selectedCharacter = characterId;
    },

    /**
     * Carrega o personagem selecionado
     */
    loadSelectedCharacter() {
        const saved = localStorage.getItem('rockHero_selectedCharacter');
        if (saved && this.isCharacterUnlocked(saved)) {
            this.state.selectedCharacter = saved;
            return saved;
        }
        return 'vocalista';
    },

    /**
     * Retorna lista de personagens desbloqueados com dados completos
     */
    getAvailableCharacters() {
        return this.CHARACTERS.filter(c => this.isCharacterUnlocked(c.id));
    },

    /**
     * Marca um mundo como completado
     */
    markWorldComplete(worldId) {
        const key = 'rockHero_completedWorlds';
        let completed = this.getCompletedWorlds();
        
        if (!completed.includes(worldId)) {
            completed.push(worldId);
            localStorage.setItem(key, JSON.stringify(completed));
        }
    },

    /**
     * Retorna lista de mundos completados
     */
    getCompletedWorlds() {
        const key = 'rockHero_completedWorlds';
        const stored = localStorage.getItem(key);
        
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return [];
            }
        }
        return [];
    },

    /**
     * Verifica se um mundo foi completado
     */
    isWorldComplete(worldId) {
        return this.getCompletedWorlds().includes(worldId);
    },

    /**
     * Salva a posição do cursor no mapa
     */
    saveMapPosition(worldId, levelIndex) {
        localStorage.setItem('rockHero_mapWorld', worldId.toString());
        localStorage.setItem('rockHero_mapLevel', levelIndex.toString());
        this.state.currentWorld = worldId;
        this.state.mapCursorLevel = levelIndex;
    },

    /**
     * Carrega a posição do cursor no mapa
     */
    loadMapPosition() {
        const worldId = parseInt(localStorage.getItem('rockHero_mapWorld')) || 1;
        const levelIndex = parseInt(localStorage.getItem('rockHero_mapLevel')) || 0;
        
        // Valida se a posição é válida
        const world = this.WORLDS.find(w => w.id === worldId);
        if (!world || !this.isWorldUnlocked(worldId)) {
            return { worldId: 1, levelIndex: 0 };
        }
        
        // Valida se a fase está desbloqueada
        if (!this.isLevelUnlocked(levelIndex)) {
            return { worldId: worldId, levelIndex: this.getNextUnlockedLevel(worldId) };
        }
        
        return { worldId, levelIndex };
    },

    /**
     * Retorna as fases de um mundo com status de desbloqueio/completude
     */
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

