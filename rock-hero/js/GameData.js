/**
 * GAME DATA - Fachada centralizada (em refatoração — ver REFACTOR-GameData.md)
 *
 * Em transição para uma arquitetura modular. Atualmente delega para:
 * - GameConfig    (constantes estáticas: CHARACTERS, WORLDS, LEVELS, DEFAULTS, ...)
 * - TimeFormatter (formatação de tempo/data)
 * - MapDebug      (logs condicionais para debug do mapa)
 *
 * Em fases futuras serão extraídos:
 * - SaveManager     (sistema de slots / localStorage)
 * - ProgressTracker (regras de progresso: fases, mundos, personagens, vidas, recordes)
 * - FeatureFlags    (feature flags + overrides por fase)
 * - SpriteLoader    (helpers de sprites Phaser)
 * - GameState       (state runtime + VERSION + virtualControls)
 */

const GameData = {
    // ==================== VERSÃO ====================
    VERSION: `v${window.GAME_VERSION || '0.0'}`,

    // Helper para cache-busting em caminhos de assets
    assetUrl(path) {
        return `${path}?v=${this.VERSION}`;
    },

    /**
     * Debug do cursor no mapa (ativar com ?mapDebug=true na URL — ver game.js).
     * Delega para MapDebug.enabled.
     */
    get DEBUG_MAP_POSITION() { return MapDebug.enabled; },
    set DEBUG_MAP_POSITION(v) { MapDebug.enabled = v; },

    /**
     * Logs condicionais para posição do mapa / inconsistências.
     * Delegam para MapDebug.
     */
    logMapDebug(message, details = null) { MapDebug.log(message, details); },
    logMapWarn(message, details = null)  { MapDebug.warn(message, details); },

    // ==================== FEATURE FLAGS ====================
    // Delegam para FeatureFlags. O getter de FEATURES retorna a referência viva
    // de FeatureFlags.flags, então mutações via `GameData.FEATURES[key] = v`
    // (usadas pelo menu) continuam funcionando sem mudanças.
    get FEATURES()                  { return FeatureFlags.flags; },
    get levelFeatureOverrides()     { return FeatureFlags.overrides; },
    set levelFeatureOverrides(v)    { FeatureFlags.setOverrides(v); },
    initFeatureFlags()              { FeatureFlags.init(); },
    isFeatureEnabled(featureName)   { return FeatureFlags.isEnabled(featureName); },

    // ==================== CONFIGURAÇÕES DE SLOTS ====================
    // Delegam para GameConfig
    get MAX_SLOTS()           { return GameConfig.MAX_SLOTS; },
    get STORAGE_KEY_SLOTS()   { return GameConfig.STORAGE_KEYS.SLOTS; },
    get STORAGE_KEY_ACTIVE()  { return GameConfig.STORAGE_KEYS.ACTIVE; },

    // ==================== PERSONAGENS ====================
    // Delega para GameConfig.CHARACTERS
    get CHARACTERS() { return GameConfig.CHARACTERS; },

    // ==================== MUNDOS ====================
    // Delega para GameConfig.WORLDS
    get WORLDS() { return GameConfig.WORLDS; },

    // ==================== FASES ====================
    // Delega para GameConfig.LEVELS
    get LEVELS() { return GameConfig.LEVELS; },

    // ==================== VALORES PADRÃO ====================
    // Delega para GameConfig.DEFAULTS
    get DEFAULTS() { return GameConfig.DEFAULTS; },

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
    // CRUD puro de localStorage delega para SaveManager.
    // Orquestradores (createNewGame, deleteSlot, setActiveSlot, getActiveSlot,
    // loadSlotIntoState) ficam aqui porque mantêm o cache `state.activeSlot`
    // e populam state em memória. Migrarão para GameState na Fase 6.

    createEmptySlot(slotId) {
        return SaveManager.createEmptySlot(slotId);
    },

    getAllSlots() {
        return SaveManager.getAllSlots();
    },

    saveAllSlots(slots) {
        SaveManager.saveAllSlots(slots);
    },

    getSlot(slotId) {
        return SaveManager.getSlot(slotId);
    },

    saveSlot(slotId, slotData) {
        SaveManager.saveSlot(slotId, slotData);
    },

    /**
     * Cria um novo jogo em um slot: monta o slot, persiste,
     * marca como ativo e carrega no state em memória.
     */
    createNewGame(slotId, playerName) {
        const slot = SaveManager.createEmptySlot(slotId);
        slot.playerName = playerName || 'Anônimo';
        slot.createdAt = new Date().toISOString();
        slot.lastPlayedAt = slot.createdAt;

        SaveManager.saveSlot(slotId, slot);
        this.setActiveSlot(slotId);
        this.loadSlotIntoState(slot);

        return slot;
    },

    /**
     * Remove um slot e, se era o ativo, limpa o estado ativo.
     */
    deleteSlot(slotId) {
        SaveManager.deleteSlot(slotId);

        if (this.state.activeSlot === slotId) {
            this.state.activeSlot = null;
            SaveManager.clearActiveSlotId();
        }
    },

    /**
     * Marca o slot como ativo (cache em memória + storage).
     */
    setActiveSlot(slotId) {
        this.state.activeSlot = slotId;
        SaveManager.setActiveSlotId(slotId);
    },

    /**
     * Retorna o slot ativo, usando cache de memória com fallback para storage.
     */
    getActiveSlot() {
        if (this.state.activeSlot) {
            return this.state.activeSlot;
        }
        const stored = SaveManager.getActiveSlotId();
        if (stored !== null) {
            this.state.activeSlot = stored;
            return stored;
        }
        return null;
    },

    /**
     * Copia campos relevantes de um slot para `state` em memória.
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
     * Carrega o slot ativo (se existir) para o state em memória.
     * @returns {boolean} true se algum slot foi carregado.
     */
    loadActiveSlotIntoState() {
        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = SaveManager.getSlot(slotId);
            if (slot) {
                this.loadSlotIntoState(slot);
                return true;
            }
        }
        return false;
    },

    updateLastPlayed() {
        SaveManager.updateLastPlayed(this.getActiveSlot());
    },

    hasAnyProgress() {
        return SaveManager.hasAnyProgress();
    },

    getSlotSummary(slotId) {
        return SaveManager.getSlotSummary(slotId);
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
    // Delegam para TimeFormatter

    formatTime(ms)              { return TimeFormatter.time(ms); },
    formatDate(dateString)      { return TimeFormatter.date(dateString); },
    formatDateShort(dateString) { return TimeFormatter.dateShort(dateString); },

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
    // Delegam para SpriteLoader (helpers Phaser para sprites de personagens)

    loadCharacterSprites(scene, characterIds = null) {
        SpriteLoader.loadCharacterSprites(scene, characterIds);
    },

    createCharacterAnimations(scene, characterId, prefix = '', recreate = false) {
        SpriteLoader.createCharacterAnimations(scene, characterId, prefix, recreate);
    },

    getCharacterTextureKey(characterId, state = 'idle') {
        return SpriteLoader.getCharacterTextureKey(characterId, state);
    },

    applyPixelArtFilter(scene, characterIds = null) {
        SpriteLoader.applyPixelArtFilter(scene, characterIds);
    },

    applyLinearFilter(scene, characterIds = null) {
        SpriteLoader.applyLinearFilter(scene, characterIds);
    },

    /**
     * Salva o personagem selecionado no slot ativo + atualiza state em memória.
     */
    saveSelectedCharacter(characterId) {
        SaveManager.saveSelectedCharacter(this.getActiveSlot(), characterId);
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

    getCurrentWorld() {
        const slotId = this.getActiveSlot();
        if (!slotId) return this.WORLDS[0];
        const slot = this.getSlot(slotId);
        const worldId = slot?.mapPosition?.worldId || 1;
        return this.WORLDS.find(w => w.id === worldId) || this.WORLDS[0];
    },

    // ==================== VIDAS ====================

    getLives() {
        const slotId = this.getActiveSlot();
        if (!slotId) return GC.LIVES.INITIAL;
        const slot = this.getSlot(slotId);
        if (!slot) return GC.LIVES.INITIAL;
        return slot.lives ?? GC.LIVES.INITIAL;
    },

    setLives(count) {
        const slotId = this.getActiveSlot();
        if (!slotId) return;
        const slot = this.getSlot(slotId);
        if (!slot) return;
        slot.lives = Math.max(0, count);
        this.saveSlot(slotId, slot);
    },

    addLife() {
        const lives = this.getLives();
        this.setLives(lives + 1);
        return lives + 1;
    },

    loseLife() {
        const lives = this.getLives();
        const newLives = Math.max(0, lives - 1);
        this.setLives(newLives);
        return newLives;
    },

    /**
     * Reseta o progresso de um mundo: remove fases e o mundo de completedLevels/completedWorlds,
     * reposiciona o cursor na primeira fase do mundo.
     */
    resetWorldProgress(worldId) {
        const slotId = this.getActiveSlot();
        if (!slotId) return;
        const slot = this.getSlot(slotId);
        if (!slot) return;

        const world = this.WORLDS.find(w => w.id === worldId);
        if (!world) return;

        const worldLevelSet = new Set(world.levels);
        slot.completedLevels = (slot.completedLevels || []).filter(l => !worldLevelSet.has(l));
        slot.completedWorlds = (slot.completedWorlds || []).filter(w => w !== worldId);

        slot.mapPosition = { worldId: worldId, levelIndex: world.levels[0] };

        // Restaura vidas ao valor inicial
        slot.lives = GC.LIVES.INITIAL;

        this.saveSlot(slotId, slot);
    },

    /**
     * Salva a posição do cursor no mapa do slot ativo.
     * worldId é sempre derivado de levelIndex quando possível (evita { worldId: 1, levelIndex: 5 }).
     * @param {string} [source] - só para log com ?mapDebug=true (ex.: 'victory:nextLevel', 'worldMap.navigate')
     */
    saveMapPosition(worldId, levelIndex, source = '') {
        const worldForLevel = this.getWorldForLevel(levelIndex);
        const resolvedWorldId = worldForLevel ? worldForLevel.id : (worldId ?? 1);

        if (this.DEBUG_MAP_POSITION) {
            const payload = {
                source: source || '(não informado)',
                callerWorldId: worldId,
                levelIndex,
                resolvedWorldId,
                levelKey: this.LEVELS[levelIndex]?.key ?? '(inválido)'
            };
            if (worldForLevel && worldId != null && Number(worldId) !== Number(resolvedWorldId)) {
                this.logMapWarn('saveMapPosition: worldId do chamador diferente do mundo da fase (corrigido)', payload);
            } else if (!worldForLevel && levelIndex != null) {
                this.logMapWarn('saveMapPosition: getWorldForLevel(levelIndex) null — usando fallback de worldId', payload);
            } else {
                this.logMapDebug('saveMapPosition', payload);
            }
        }

        const slotId = this.getActiveSlot();
        if (slotId) {
            const slot = this.getSlot(slotId);
            if (slot) {
                slot.mapPosition = { worldId: resolvedWorldId, levelIndex };
                this.saveSlot(slotId, slot);
            }
        } else if (this.DEBUG_MAP_POSITION) {
            this.logMapWarn('saveMapPosition: sem slot ativo — state ainda atualizado', { resolvedWorldId, levelIndex });
        }
        this.state.currentWorld = resolvedWorldId;
        this.state.mapCursorLevel = levelIndex;
    },

    /**
     * Carrega a posição do cursor no mapa do slot ativo
     */
    loadMapPosition() {
        const slotId = this.getActiveSlot();
        if (!slotId) {
            this.logMapDebug('loadMapPosition: sem slot ativo → padrão', { worldId: 1, levelIndex: 0 });
            return { worldId: 1, levelIndex: 0 };
        }

        const slot = this.getSlot(slotId);
        if (!slot || !slot.mapPosition) {
            this.logMapDebug('loadMapPosition: slot sem mapPosition → padrão', { slotId, hasSlot: !!slot });
            return { worldId: 1, levelIndex: 0 };
        }

        let { worldId, levelIndex } = slot.mapPosition;
        const rawFromSlot = { worldId, levelIndex };

        const correctWorld = this.getWorldForLevel(levelIndex);
        if (correctWorld && correctWorld.id !== worldId) {
            this.logMapWarn('loadMapPosition: INCONSISTÊNCIA slot — worldId não corresponde à fase; corrigindo e salvando', {
                antes: { ...rawFromSlot },
                esperadoWorldId: correctWorld.id,
                levelIndex
            });
            worldId = correctWorld.id;
            slot.mapPosition = { worldId, levelIndex };
            this.saveSlot(slotId, slot);
        }

        const world = this.WORLDS.find(w => w.id === worldId);
        if (!world || !this.isWorldUnlocked(worldId)) {
            this.logMapWarn('loadMapPosition: mundo bloqueado ou inválido → padrão', {
                worldId,
                levelIndex,
                worldExists: !!world
            });
            return { worldId: 1, levelIndex: 0 };
        }

        if (this.isLevelUnlocked(levelIndex)) {
            this.logMapDebug('loadMapPosition: ok', { worldId, levelIndex, levelKey: this.LEVELS[levelIndex]?.key });
            return { worldId, levelIndex };
        }

        const fallbackLevel = this.getNextUnlockedLevel(worldId);
        this.logMapWarn('loadMapPosition: fase ainda bloqueada — usando próximo nível desbloqueado do mundo', {
            worldId,
            requestedLevelIndex: levelIndex,
            fallbackLevelIndex: fallbackLevel,
            reason: 'isLevelUnlocked(levelIndex) === false'
        });
        return { worldId, levelIndex: fallbackLevel };
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
