/**
 * SPRITE LOADER - Helpers Phaser para sprites de personagens
 *
 * Encapsula operações específicas de Phaser relacionadas aos personagens:
 * - Carregar spritesheets no preload() de uma cena
 * - Criar animações (idle, walk, jump, walk-left)
 * - Resolver texture key para um estado específico
 * - Aplicar filtros NEAREST (pixel art) ou LINEAR (suavizado)
 *
 * Depende de:
 * - GameConfig (para lista CHARACTERS)
 * - GameState (assetUrl para cache-busting)
 *
 * Uso:
 *   SpriteLoader.loadCharacterSprites(this);                    // todos
 *   SpriteLoader.loadCharacterSprites(this, 'vocalista');       // um
 *   SpriteLoader.loadCharacterSprites(this, ['voc', 'bat']);    // lista
 *   SpriteLoader.createCharacterAnimations(this, 'vocalista');
 *   SpriteLoader.applyPixelArtFilter(this);
 */

const SpriteLoader = {
    /**
     * Helper interno: encontra personagem por id (fallback: primeiro da lista).
     */
    _getCharacter(id) {
        return GameConfig.CHARACTERS.find(c => c.id === id) || GameConfig.CHARACTERS[0];
    },

    /**
     * Helper interno: resolve o argumento `characterIds` (null/string/array)
     * em uma lista de objetos character.
     */
    _resolveCharacters(characterIds) {
        if (characterIds === null || characterIds === undefined) {
            return GameConfig.CHARACTERS;
        }
        if (typeof characterIds === 'string') {
            return [this._getCharacter(characterIds)];
        }
        return characterIds.map(id => this._getCharacter(id));
    },

    /**
     * Carrega spritesheets de personagens no preload() de uma cena.
     * Deduplicação por sprite.key (evita carregar 2x a mesma textura).
     *
     * @param {Phaser.Scene} scene - A cena Phaser
     * @param {string|string[]|null} characterIds - IDs dos personagens, ou null para todos
     */
    loadCharacterSprites(scene, characterIds = null) {
        const loadedKeys = new Set();
        const characters = this._resolveCharacters(characterIds);

        characters.forEach(character => {
            if (!character || !character.sprites) return;

            Object.values(character.sprites).forEach(sprite => {
                if (!sprite || loadedKeys.has(sprite.key)) return;
                loadedKeys.add(sprite.key);

                scene.load.spritesheet(sprite.key, GameState.assetUrl(sprite.file), {
                    frameWidth: sprite.frameWidth,
                    frameHeight: sprite.frameHeight
                });
            });
        });
    },

    /**
     * Cria animações Phaser para um personagem específico.
     * Para cada estado (idle, walk, jump, walk-left...) cria uma animação
     * com chave `prefix + state`.
     *
     * @param {Phaser.Scene} scene - A cena Phaser
     * @param {string} characterId - ID do personagem
     * @param {string} prefix - Prefixo para nomes das animações (ex: 'player-' ou '')
     * @param {boolean} recreate - Se deve recriar animações existentes
     */
    createCharacterAnimations(scene, characterId, prefix = '', recreate = false) {
        const character = this._getCharacter(characterId);
        if (!character || !character.sprites) return;

        // Para cada estado (idle, walk, jump, walk-left...)
        Object.entries(character.sprites).forEach(([state, sprite]) => {
            // Sprite null = estado não tem sprite próprio (ex: jump usando idle)
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
     * Retorna a texture key para um estado específico de um personagem.
     * Útil ao criar sprite inicial (ex: `scene.add.sprite(x, y, key)`).
     * Fallback: idle do personagem, ou 'hero-idle' se nada existir.
     *
     * @param {string} characterId - ID do personagem
     * @param {string} state - Estado desejado (idle, walk, jump, walk-left)
     * @returns {string} - Key da textura
     */
    getCharacterTextureKey(characterId, state = 'idle') {
        const character = this._getCharacter(characterId);
        if (!character || !character.sprites) return 'hero-idle';

        const sprite = character.sprites[state];
        if (!sprite) {
            return character.sprites.idle?.key || 'hero-idle';
        }
        return sprite.key;
    },

    /**
     * Aplica um filtro Phaser (NEAREST ou LINEAR) em todas as texturas
     * dos personagens especificados.
     *
     * @param {Phaser.Scene} scene - A cena Phaser
     * @param {string|string[]|null} characterIds - IDs ou null para todos
     * @param {number} filterMode - Phaser.Textures.FilterMode (NEAREST ou LINEAR)
     */
    _applyFilter(scene, characterIds, filterMode) {
        const characters = this._resolveCharacters(characterIds);

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
     * Aplica filtro NEAREST (pixel art nítido).
     * Ideal para sprites ampliados (scale > 1) ou zoom >= 1.
     */
    applyPixelArtFilter(scene, characterIds = null) {
        this._applyFilter(scene, characterIds, Phaser.Textures.FilterMode.NEAREST);
    },

    /**
     * Aplica filtro LINEAR (suavizado).
     * Ideal para sprites reduzidos (zoom < 1) para evitar aliasing.
     */
    applyLinearFilter(scene, characterIds = null) {
        this._applyFilter(scene, characterIds, Phaser.Textures.FilterMode.LINEAR);
    }
};

window.SpriteLoader = SpriteLoader;
