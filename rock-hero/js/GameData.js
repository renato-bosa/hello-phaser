/**
 * GAME DATA - Fachada centralizada (refatoração — ver REFACTOR-GameData.md)
 *
 * Após Fase 6, este arquivo é apenas uma camada de delegação para módulos especializados:
 * - GameConfig      → constantes estáticas (CHARACTERS, WORLDS, LEVELS, DEFAULTS, ...)
 * - TimeFormatter   → formatação de tempo/data
 * - MapDebug        → logs condicionais para debug do mapa
 * - SpriteLoader    → helpers Phaser de sprites de personagens
 * - SaveManager     → CRUD de slots em localStorage
 * - FeatureFlags    → feature flags + overrides por fase
 * - ProgressTracker → progresso do jogador no slot (fases/mundos/personagens/vidas/recordes/mapa)
 * - GameState       → state runtime em memória + VERSION + assetUrl + virtualControls
 *
 * O método `getActiveSlot()` mantém um cache local de `state.activeSlot` para
 * evitar reler localStorage a cada chamada — é por isso que orquestradores como
 * `createNewGame`, `deleteSlot`, `setActiveSlot`, `loadSlotIntoState` ainda
 * vivem aqui (em vez de SaveManager): eles sincronizam o cache com storage.
 */

const GameData = {
    // ==================== VERSÃO + ASSETS ====================
    // Delegam para GameState

    get VERSION() { return GameState.VERSION; },
    assetUrl(path) { return GameState.assetUrl(path); },

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

    // ==================== STATE RUNTIME ====================
    // Getter retorna a referência viva de GameState.state, então mutações em
    // `GameData.state.X = Y` continuam funcionando transparentemente.
    get state() { return GameState.state; },

    // ==================== SISTEMA DE SLOTS ====================
    // CRUD puro de localStorage delega para SaveManager.
    // Orquestradores (createNewGame, deleteSlot, setActiveSlot, getActiveSlot,
    // loadSlotIntoState) ficam aqui porque mantêm o cache `state.activeSlot`
    // e populam state em memória. Migrarão para GameState na Fase 6.

    getSlot(slotId) { return SaveManager.getSlot(slotId); },

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

    updateLastPlayed()    { SaveManager.updateLastPlayed(this.getActiveSlot()); },
    hasAnyProgress()      { return SaveManager.hasAnyProgress(); },
    getSlotSummary(slotId){ return SaveManager.getSlotSummary(slotId); },

    // ==================== PROGRESSO (usa slot ativo) ====================
    // Wrappers finos que resolvem o slot ativo e delegam para ProgressTracker.
    // Métodos que também sincronizam `state` fazem isso APÓS a chamada.

    savePlayerName(playerName) {
        ProgressTracker.savePlayerName(this.getActiveSlot(), playerName);
        this.state.playerName = playerName;
    },

    loadPlayerName() {
        return ProgressTracker.loadPlayerName(this.getActiveSlot());
    },

    markLevelComplete(levelIndex) {
        ProgressTracker.markLevelComplete(this.getActiveSlot(), levelIndex);
    },

    getCompletedLevels() {
        return ProgressTracker.getCompletedLevels(this.getActiveSlot());
    },

    isLevelComplete(levelIndex) {
        return ProgressTracker.isLevelComplete(this.getActiveSlot(), levelIndex);
    },

    isLevelUnlocked(levelIndex) {
        return ProgressTracker.isLevelUnlocked(this.getActiveSlot(), levelIndex);
    },

    isWorldUnlocked(worldId) {
        return ProgressTracker.isWorldUnlocked(this.getActiveSlot(), worldId);
    },

    getNextUnlockedLevel(worldId) {
        return ProgressTracker.getNextUnlockedLevel(this.getActiveSlot(), worldId);
    },

    hasProgress() {
        return ProgressTracker.hasProgress(this.getActiveSlot());
    },

    clearProgress() {
        ProgressTracker.clearProgress(this.getActiveSlot());
        this.state.currentLevel = 0;
        this.state.currentWorld = 1;
        this.state.mapCursorLevel = 0;
    },

    /**
     * Compat: API antiga ainda usada por PauseMenu (salva nome + level atual + timestamp).
     * Pode virar inline futuramente quando PauseMenu for atualizado.
     */
    saveProgress(level, playerName) {
        this.savePlayerName(playerName);
        this.state.currentLevel = level;
        this.updateLastPlayed();
    },

    // ==================== RANKINGS (por slot) ====================

    getTopRecords(level, limit = 4) {
        return ProgressTracker.getTopRecords(this.getActiveSlot(), level, limit);
    },

    saveRecord(level, time, _playerName, _topN = 4) {
        return ProgressTracker.saveRecord(this.getActiveSlot(), level, time);
    },

    getBestTime(level) {
        return ProgressTracker.getBestTime(this.getActiveSlot(), level);
    },

    getTotalBestTime() {
        return ProgressTracker.getTotalBestTime(this.getActiveSlot());
    },

    // ==================== FORMATAÇÃO ====================
    // Delegam para TimeFormatter

    formatTime(ms)              { return TimeFormatter.time(ms); },
    formatDate(dateString)      { return TimeFormatter.date(dateString); },
    formatDateShort(dateString) { return TimeFormatter.dateShort(dateString); },

    // ==================== MUNDOS E PERSONAGENS ====================
    // Lookups PUROS (sem slot): checkWorldCompletion, getWorldForLevel, getCharacter
    // Lookups COM slot: unlockCharacter, getUnlockedCharacters, isCharacterUnlocked

    checkWorldCompletion(levelIndex) { return ProgressTracker.checkWorldCompletion(levelIndex); },
    getWorldForLevel(levelIndex)     { return ProgressTracker.getWorldForLevel(levelIndex); },
    getCharacter(characterId)        { return ProgressTracker.getCharacter(characterId); },

    unlockCharacter(characterId) {
        ProgressTracker.unlockCharacter(this.getActiveSlot(), characterId);
    },

    getUnlockedCharacters() {
        return ProgressTracker.getUnlockedCharacters(this.getActiveSlot());
    },

    isCharacterUnlocked(characterId) {
        return ProgressTracker.isCharacterUnlocked(this.getActiveSlot(), characterId);
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
     * Carrega o personagem selecionado do slot ativo + atualiza state se válido.
     * (ProgressTracker retorna null se inválido/inexistente; aqui aplicamos fallback
     * 'vocalista' SEM tocar `state`, preservando o comportamento original.)
     */
    loadSelectedCharacter() {
        const characterId = ProgressTracker.loadSelectedCharacter(this.getActiveSlot());
        if (characterId) {
            this.state.selectedCharacter = characterId;
            return characterId;
        }
        return 'vocalista';
    },

    getAvailableCharacters() {
        return ProgressTracker.getAvailableCharacters(this.getActiveSlot());
    },

    markWorldComplete(worldId)  { ProgressTracker.markWorldComplete(this.getActiveSlot(), worldId); },
    getCompletedWorlds()        { return ProgressTracker.getCompletedWorlds(this.getActiveSlot()); },
    isWorldComplete(worldId)    { return ProgressTracker.isWorldComplete(this.getActiveSlot(), worldId); },
    getCurrentWorld()           { return ProgressTracker.getCurrentWorld(this.getActiveSlot()); },

    // ==================== VIDAS ====================

    getLives()      { return ProgressTracker.getLives(this.getActiveSlot()); },
    setLives(count) { ProgressTracker.setLives(this.getActiveSlot(), count); },
    addLife()       { return ProgressTracker.addLife(this.getActiveSlot()); },
    loseLife()      { return ProgressTracker.loseLife(this.getActiveSlot()); },

    resetWorldProgress(worldId) {
        ProgressTracker.resetWorldProgress(this.getActiveSlot(), worldId);
    },

    // ==================== MAP POSITION ====================

    /**
     * Salva a posição do cursor do mapa e sincroniza state.
     * ProgressTracker faz auto-correção do worldId baseada em getWorldForLevel(levelIndex).
     */
    saveMapPosition(worldId, levelIndex, source = '') {
        const resolved = ProgressTracker.saveMapPosition(this.getActiveSlot(), worldId, levelIndex, source);
        this.state.currentWorld = resolved.worldId;
        this.state.mapCursorLevel = resolved.levelIndex;
    },

    loadMapPosition() {
        return ProgressTracker.loadMapPosition(this.getActiveSlot());
    },

    getWorldLevelsWithStatus(worldId) {
        return ProgressTracker.getWorldLevelsWithStatus(this.getActiveSlot(), worldId);
    },

    // ==================== CONTROLES VIRTUAIS ====================
    // Delega para GameState

    getVirtualControls() {
        return GameState.getVirtualControls();
    }
};

// Exporta globalmente
window.GameData = GameData;
