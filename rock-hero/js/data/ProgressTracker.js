/**
 * PROGRESS TRACKER - Progresso do jogador no slot
 *
 * Responsabilidade: ler e modificar campos de progresso (`completedLevels`,
 * `completedWorlds`, `unlockedCharacters`, `bestTimes`, `lives`, `mapPosition`,
 * `playerName`) em um slot específico do `SaveManager`.
 *
 * Todos os métodos que mexem em progresso recebem `slotId` explícito como 1º
 * argumento (puro). Métodos que **não** precisam de slot (`getCharacter`,
 * `getWorldForLevel`, `checkWorldCompletion`) são lookups sobre `GameConfig`
 * e ficam aqui pelo agrupamento semântico.
 *
 * Depende de:
 * - `SaveManager` (CRUD de slots)
 * - `GameConfig` (CHARACTERS, WORLDS, LEVELS — para validações e iterações)
 * - `MapDebug` (logs condicionais em saveMapPosition/loadMapPosition)
 * - `GC` (constants.js — usado em getLives/resetWorldProgress; lazy)
 *
 * NÃO toca em estado em memória (`GameData.state`). Os wrappers em `GameData`
 * sincronizam `state.playerName`, `state.selectedCharacter`, `state.currentWorld`,
 * `state.mapCursorLevel` quando relevante. Esse acoplamento migra para
 * `GameState` na Fase 6.
 */

const ProgressTracker = {
    // ==================== PLAYER NAME ====================

    savePlayerName(slotId, playerName) {
        if (!slotId) return;
        const slot = SaveManager.getSlot(slotId);
        if (slot) {
            slot.playerName = playerName;
            SaveManager.saveSlot(slotId, slot);
        }
    },

    loadPlayerName(slotId) {
        if (slotId) {
            const slot = SaveManager.getSlot(slotId);
            if (slot) {
                return slot.playerName || 'Anônimo';
            }
        }
        return 'Anônimo';
    },

    // ==================== LEVELS ====================

    markLevelComplete(slotId, levelIndex) {
        if (!slotId) return;
        const slot = SaveManager.getSlot(slotId);
        if (!slot) return;

        if (!slot.completedLevels) slot.completedLevels = [];

        if (!slot.completedLevels.includes(levelIndex)) {
            slot.completedLevels.push(levelIndex);
            slot.completedLevels.sort((a, b) => a - b);
            SaveManager.saveSlot(slotId, slot);
        }
    },

    /**
     * Retorna cópia (não-referência) da lista de fases completadas.
     */
    getCompletedLevels(slotId) {
        if (slotId) {
            const slot = SaveManager.getSlot(slotId);
            if (slot && slot.completedLevels) {
                return [...slot.completedLevels];
            }
        }
        return [];
    },

    isLevelComplete(slotId, levelIndex) {
        return this.getCompletedLevels(slotId).includes(levelIndex);
    },

    /**
     * Uma fase está desbloqueada se:
     * - É a fase 0 (sempre desbloqueada), OU
     * - É a primeira fase de um mundo desbloqueado, OU
     * - A fase anterior do mesmo mundo está completa
     */
    isLevelUnlocked(slotId, levelIndex) {
        if (levelIndex === 0) return true;

        const level = GameConfig.LEVELS[levelIndex];
        if (!level) return false;

        const world = this.getWorldForLevel(levelIndex);
        if (!world) return false;

        const levelIndexInWorld = world.levels.indexOf(levelIndex);
        if (levelIndexInWorld === 0) {
            return this.isWorldUnlocked(slotId, world.id);
        }

        const previousLevelIndex = world.levels[levelIndexInWorld - 1];
        return this.isLevelComplete(slotId, previousLevelIndex);
    },

    /**
     * Retorna o índice da primeira fase do mundo que ainda não foi completada,
     * ou a última fase do mundo se todas estão completas.
     */
    getNextUnlockedLevel(slotId, worldId) {
        const world = GameConfig.WORLDS.find(w => w.id === worldId);
        if (!world) return 0;

        for (const levelIndex of world.levels) {
            if (!this.isLevelComplete(slotId, levelIndex)) {
                return levelIndex;
            }
        }

        return world.levels[world.levels.length - 1];
    },

    hasProgress(slotId) {
        return this.getCompletedLevels(slotId).length > 0;
    },

    /**
     * Reseta o slot inteiro para o estado pós-criação (mantém o slot existente,
     * só zera progresso/personagens/best times/lives/mapPosition).
     */
    clearProgress(slotId) {
        if (!slotId) return;
        const slot = SaveManager.getSlot(slotId);
        if (slot) {
            slot.completedLevels = [];
            slot.completedWorlds = [];
            slot.unlockedCharacters = ['vocalista'];
            slot.selectedCharacter = 'vocalista';
            slot.mapPosition = { worldId: 1, levelIndex: 0 };
            slot.bestTimes = {};
            SaveManager.saveSlot(slotId, slot);
        }
    },

    // ==================== WORLDS ====================

    markWorldComplete(slotId, worldId) {
        if (!slotId) return;
        const slot = SaveManager.getSlot(slotId);
        if (!slot) return;

        if (!slot.completedWorlds) slot.completedWorlds = [];

        if (!slot.completedWorlds.includes(worldId)) {
            slot.completedWorlds.push(worldId);
            SaveManager.saveSlot(slotId, slot);
        }
    },

    getCompletedWorlds(slotId) {
        if (slotId) {
            const slot = SaveManager.getSlot(slotId);
            if (slot && slot.completedWorlds) {
                return [...slot.completedWorlds];
            }
        }
        return [];
    },

    isWorldComplete(slotId, worldId) {
        return this.getCompletedWorlds(slotId).includes(worldId);
    },

    /**
     * Um mundo está desbloqueado se for o mundo 1 ou se o mundo anterior foi completado.
     */
    isWorldUnlocked(slotId, worldId) {
        if (worldId === 1) return true;
        const previousWorld = GameConfig.WORLDS.find(w => w.id === worldId - 1);
        return previousWorld ? this.isWorldComplete(slotId, previousWorld.id) : false;
    },

    /**
     * PURO — sem slot. Se `levelIndex` é a ÚLTIMA fase de algum mundo, retorna esse mundo.
     * Senão null. Usado para disparar tela "World Complete".
     */
    checkWorldCompletion(levelIndex) {
        for (const world of GameConfig.WORLDS) {
            const lastLevelOfWorld = Math.max(...world.levels);
            if (levelIndex === lastLevelOfWorld) {
                return world;
            }
        }
        return null;
    },

    /**
     * PURO — sem slot. Retorna o mundo ao qual a fase pertence (null se não houver).
     */
    getWorldForLevel(levelIndex) {
        return GameConfig.WORLDS.find(w => w.levels.includes(levelIndex)) || null;
    },

    /**
     * Mundo atual do slot (lido de `mapPosition.worldId`). Fallback: mundo 1.
     */
    getCurrentWorld(slotId) {
        if (!slotId) return GameConfig.WORLDS[0];
        const slot = SaveManager.getSlot(slotId);
        const worldId = slot?.mapPosition?.worldId || 1;
        return GameConfig.WORLDS.find(w => w.id === worldId) || GameConfig.WORLDS[0];
    },

    /**
     * Remove um mundo e suas fases de `completedLevels`/`completedWorlds`,
     * reposiciona o cursor na primeira fase do mundo e restaura as vidas.
     */
    resetWorldProgress(slotId, worldId) {
        if (!slotId) return;
        const slot = SaveManager.getSlot(slotId);
        if (!slot) return;

        const world = GameConfig.WORLDS.find(w => w.id === worldId);
        if (!world) return;

        const worldLevelSet = new Set(world.levels);
        slot.completedLevels = (slot.completedLevels || []).filter(l => !worldLevelSet.has(l));
        slot.completedWorlds = (slot.completedWorlds || []).filter(w => w !== worldId);
        slot.mapPosition = { worldId, levelIndex: world.levels[0] };
        slot.lives = GC.LIVES.INITIAL;

        SaveManager.saveSlot(slotId, slot);
    },

    /**
     * Retorna as fases de um mundo enriquecidas com flags de progresso.
     * Usado pelo WorldMapScene para renderizar marcadores.
     */
    getWorldLevelsWithStatus(slotId, worldId) {
        const world = GameConfig.WORLDS.find(w => w.id === worldId);
        if (!world) return [];

        return world.levels.map(levelIndex => {
            const level = GameConfig.LEVELS[levelIndex];
            return {
                ...level,
                index: levelIndex,
                isComplete: this.isLevelComplete(slotId, levelIndex),
                isUnlocked: this.isLevelUnlocked(slotId, levelIndex),
                bestTime: this.getBestTime(slotId, levelIndex)
            };
        });
    },

    // ==================== CHARACTERS ====================

    /**
     * PURO — sem slot. Lookup em CHARACTERS, fallback: primeiro da lista.
     */
    getCharacter(characterId) {
        return GameConfig.CHARACTERS.find(c => c.id === characterId) || GameConfig.CHARACTERS[0];
    },

    unlockCharacter(slotId, characterId) {
        if (!slotId) return;
        const slot = SaveManager.getSlot(slotId);
        if (!slot) return;

        if (!slot.unlockedCharacters) slot.unlockedCharacters = ['vocalista'];

        if (!slot.unlockedCharacters.includes(characterId)) {
            slot.unlockedCharacters.push(characterId);
            SaveManager.saveSlot(slotId, slot);
        }
    },

    getUnlockedCharacters(slotId) {
        if (slotId) {
            const slot = SaveManager.getSlot(slotId);
            if (slot && slot.unlockedCharacters) {
                return [...slot.unlockedCharacters];
            }
        }
        return ['vocalista'];
    },

    isCharacterUnlocked(slotId, characterId) {
        const character = GameConfig.CHARACTERS.find(c => c.id === characterId);
        if (!character) return false;
        if (character.unlockedByDefault) return true;
        return this.getUnlockedCharacters(slotId).includes(characterId);
    },

    getAvailableCharacters(slotId) {
        return GameConfig.CHARACTERS.filter(c => this.isCharacterUnlocked(slotId, c.id));
    },

    /**
     * Retorna o characterId do slot SE válido e desbloqueado. Senão null.
     * O wrapper em GameData decide se aplica fallback 'vocalista' e se atualiza state.
     * (Preserva o comportamento original: state só é tocado se houver match no slot.)
     */
    loadSelectedCharacter(slotId) {
        if (!slotId) return null;
        const slot = SaveManager.getSlot(slotId);
        if (slot && slot.selectedCharacter && this.isCharacterUnlocked(slotId, slot.selectedCharacter)) {
            return slot.selectedCharacter;
        }
        return null;
    },

    // ==================== LIVES ====================

    getLives(slotId) {
        if (!slotId) return GC.LIVES.INITIAL;
        const slot = SaveManager.getSlot(slotId);
        if (!slot) return GC.LIVES.INITIAL;
        return slot.lives ?? GC.LIVES.INITIAL;
    },

    setLives(slotId, count) {
        if (!slotId) return;
        const slot = SaveManager.getSlot(slotId);
        if (!slot) return;
        slot.lives = Math.max(0, count);
        SaveManager.saveSlot(slotId, slot);
    },

    addLife(slotId) {
        const lives = this.getLives(slotId);
        this.setLives(slotId, lives + 1);
        return lives + 1;
    },

    loseLife(slotId) {
        const lives = this.getLives(slotId);
        const newLives = Math.max(0, lives - 1);
        this.setLives(slotId, newLives);
        return newLives;
    },

    // ==================== BEST TIMES ====================

    getBestTime(slotId, level) {
        if (!slotId) return null;
        const slot = SaveManager.getSlot(slotId);
        if (slot && slot.bestTimes) {
            return slot.bestTimes[level] ?? null;
        }
        return null;
    },

    /**
     * Soma de todos os best times. Retorna null se alguma fase ainda não tem tempo.
     */
    getTotalBestTime(slotId) {
        let total = 0;
        for (let i = 0; i < GameConfig.LEVELS.length; i++) {
            const best = this.getBestTime(slotId, i);
            if (best === null) return null;
            total += best;
        }
        return total;
    },

    /**
     * Salva tempo SE for melhor que o anterior (ou se não houver anterior).
     * Retorna { saved, position, isRecord } — `position` é sempre 1 no modelo atual de 1 best time por fase.
     */
    saveRecord(slotId, level, time) {
        if (!slotId) return { saved: false, position: 0, isRecord: false };
        const slot = SaveManager.getSlot(slotId);
        if (!slot) return { saved: false, position: 0, isRecord: false };

        if (!slot.bestTimes) slot.bestTimes = {};

        const previousBest = slot.bestTimes[level];
        const isNewRecord = previousBest === undefined || time < previousBest;

        if (isNewRecord) {
            slot.bestTimes[level] = time;
            SaveManager.saveSlot(slotId, slot);
        }

        return { saved: isNewRecord, position: 1, isRecord: isNewRecord };
    },

    /**
     * Para compat: retorna array de records de uma fase (sempre 0 ou 1 item no modelo atual).
     */
    getTopRecords(slotId, level, _limit = 4) {
        if (!slotId) return [];
        const slot = SaveManager.getSlot(slotId);
        if (!slot || !slot.bestTimes) return [];

        const time = slot.bestTimes[level];
        if (time !== undefined) {
            return [{
                time,
                playerName: slot.playerName,
                date: slot.lastPlayedAt
            }];
        }
        return [];
    },

    // ==================== MAP POSITION ====================

    /**
     * Salva a posição do cursor. `worldId` do chamador pode ser ignorado se inconsistente
     * com `getWorldForLevel(levelIndex)`. Retorna `{ worldId, levelIndex }` já resolvido
     * (o wrapper em GameData usa isso para atualizar `state.currentWorld`/`mapCursorLevel`).
     *
     * @param {number|null} slotId
     * @param {number} worldId    - hint do chamador, usado como fallback
     * @param {number} levelIndex
     * @param {string} [source]   - rótulo opcional para logs com ?mapDebug=true
     * @returns {{worldId:number, levelIndex:number}}
     */
    saveMapPosition(slotId, worldId, levelIndex, source = '') {
        const worldForLevel = this.getWorldForLevel(levelIndex);
        const resolvedWorldId = worldForLevel ? worldForLevel.id : (worldId ?? 1);

        if (MapDebug.enabled) {
            const payload = {
                source: source || '(não informado)',
                callerWorldId: worldId,
                levelIndex,
                resolvedWorldId,
                levelKey: GameConfig.LEVELS[levelIndex]?.key ?? '(inválido)'
            };
            if (worldForLevel && worldId != null && Number(worldId) !== Number(resolvedWorldId)) {
                MapDebug.warn('saveMapPosition: worldId do chamador diferente do mundo da fase (corrigido)', payload);
            } else if (!worldForLevel && levelIndex != null) {
                MapDebug.warn('saveMapPosition: getWorldForLevel(levelIndex) null — usando fallback de worldId', payload);
            } else {
                MapDebug.log('saveMapPosition', payload);
            }
        }

        if (slotId) {
            const slot = SaveManager.getSlot(slotId);
            if (slot) {
                slot.mapPosition = { worldId: resolvedWorldId, levelIndex };
                SaveManager.saveSlot(slotId, slot);
            }
        } else {
            MapDebug.warn('saveMapPosition: sem slot ativo — state ainda atualizado', { resolvedWorldId, levelIndex });
        }

        return { worldId: resolvedWorldId, levelIndex };
    },

    /**
     * Carrega a posição do cursor com auto-correção:
     * - Se `worldId` salvo não bate com o mundo de `levelIndex`, corrige e salva.
     * - Se o mundo está bloqueado, retorna padrão (mundo 1, fase 0).
     * - Se a fase está bloqueada, retorna próxima desbloqueada do mundo.
     */
    loadMapPosition(slotId) {
        if (!slotId) {
            MapDebug.log('loadMapPosition: sem slot ativo → padrão', { worldId: 1, levelIndex: 0 });
            return { worldId: 1, levelIndex: 0 };
        }

        const slot = SaveManager.getSlot(slotId);
        if (!slot || !slot.mapPosition) {
            MapDebug.log('loadMapPosition: slot sem mapPosition → padrão', { slotId, hasSlot: !!slot });
            return { worldId: 1, levelIndex: 0 };
        }

        let { worldId, levelIndex } = slot.mapPosition;
        const rawFromSlot = { worldId, levelIndex };

        const correctWorld = this.getWorldForLevel(levelIndex);
        if (correctWorld && correctWorld.id !== worldId) {
            MapDebug.warn('loadMapPosition: INCONSISTÊNCIA slot — worldId não corresponde à fase; corrigindo e salvando', {
                antes: { ...rawFromSlot },
                esperadoWorldId: correctWorld.id,
                levelIndex
            });
            worldId = correctWorld.id;
            slot.mapPosition = { worldId, levelIndex };
            SaveManager.saveSlot(slotId, slot);
        }

        const world = GameConfig.WORLDS.find(w => w.id === worldId);
        if (!world || !this.isWorldUnlocked(slotId, worldId)) {
            MapDebug.warn('loadMapPosition: mundo bloqueado ou inválido → padrão', {
                worldId,
                levelIndex,
                worldExists: !!world
            });
            return { worldId: 1, levelIndex: 0 };
        }

        if (this.isLevelUnlocked(slotId, levelIndex)) {
            MapDebug.log('loadMapPosition: ok', { worldId, levelIndex, levelKey: GameConfig.LEVELS[levelIndex]?.key });
            return { worldId, levelIndex };
        }

        const fallbackLevel = this.getNextUnlockedLevel(slotId, worldId);
        MapDebug.warn('loadMapPosition: fase ainda bloqueada — usando próximo nível desbloqueado do mundo', {
            worldId,
            requestedLevelIndex: levelIndex,
            fallbackLevelIndex: fallbackLevel,
            reason: 'isLevelUnlocked(levelIndex) === false'
        });
        return { worldId, levelIndex: fallbackLevel };
    }
};

window.ProgressTracker = ProgressTracker;
