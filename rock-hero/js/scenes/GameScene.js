/**
 * GAME SCENE - Cena Principal do Jogo
 *
 * Delega responsabilidades para managers:
 * - PlayerController: movimento, pulo, água, speed boost, respawn
 * - EnemyManager: criação e IA dos inimigos
 * - EffectsManager: trail, neon burst, neon line, efeitos de água
 * - HUDManager: timer, estrelas, debug
 * - PauseMenu: overlay de pausa e navegação
 * - VictoryScreen: vitória, ranking, mundo completo
 * - WindSystem: vento horizontal variável (feature flag `wind`)
 */

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.currentLevel = data.level ?? GameData.state.currentLevel ?? 0;
        this.playerName = data.playerName ?? GameData.state.playerName ?? 'Anônimo';

        GameData.state.currentLevel = this.currentLevel;
        GameData.state.playerName = this.playerName;
    }

    preload() {
        this.setupTilesetAutoLoader();

        GameData.LEVELS.forEach(level => {
            this.load.tilemapTiledJSON(level.key, GameData.assetUrl(level.file));
        });

        this.load.spritesheet('star', GameData.assetUrl('assets/spritesheets/yellow-star-animated.png'), {
            frameWidth: 32, frameHeight: 32
        });

        GameData.loadCharacterSprites(this);

        this.load.image('player-trail', GameData.assetUrl('assets/spritesheets/player-trail1.png'));

        this.load.spritesheet('sapo-tomate', GameData.assetUrl('assets/spritesheets/sapo-tomate-6fps.png'), {
            frameWidth: 32, frameHeight: 32
        });
        this.load.spritesheet('sapo-verde', GameData.assetUrl('assets/spritesheets/sapo-verde-6fps.png'), {
            frameWidth: 32, frameHeight: 32
        });
        this.load.spritesheet('seahorse', GameData.assetUrl('assets/spritesheets/Cavalo marinho.png'), {
            frameWidth: 32, frameHeight: 32
        });
        this.load.spritesheet('boneco', GameData.assetUrl('assets/spritesheets/Boneco-14fps.png'), {
            frameWidth: 32, frameHeight: 32
        });
        this.load.image('red-heart', GameData.assetUrl('assets/spritesheets/red-heart.png'));

        // Trilha sonora — registra faixas MP3 no cache do Phaser
        MusicManager.preload(this);
    }

    _ensureBubbleTexture() {
        if (this.textures.exists('seahorse-bubble')) return;
        const size = GC.BUBBLE.SIZE;
        const r = size / 2 - 1;
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xaaeeff, 0.85);
        g.fillCircle(size / 2, size / 2, r);
        g.lineStyle(1, 0xffffff, 0.9);
        g.strokeCircle(size / 2, size / 2, r);
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(size / 2 - 2, size / 2 - 2, 2);
        g.generateTexture('seahorse-bubble', size, size);
        g.destroy();
    }

    /**
     * Configura o carregamento automático de tilesets usando eventos do Phaser Loader.
     * Quando cada mapa JSON termina de carregar, extrai os tilesets e adiciona à fila.
     */
    setupTilesetAutoLoader() {
        const loadedTilesets = new Set();
        const TILESET_ALIASES = { 'trampoline-thick': 'trampoline' };

        this.load.on('filecomplete', (key, type, data) => {
            if (type !== 'tilemapJSON') return;

            const tilemapData = this.cache.tilemap.get(key);
            if (!tilemapData || !tilemapData.data || !tilemapData.data.tilesets) return;

            tilemapData.data.tilesets.forEach(ts => {
                if (loadedTilesets.has(ts.name)) return;
                loadedTilesets.add(ts.name);

                if (ts.image) {
                    const imagePath = 'assets/' + ts.image.replace(/\\/g, '/');
                    // Tilesets nomeados com sufixo "-Nfps" (e mais de um tile) são carregados
                    // como spritesheet, permitindo animar sprites criados a partir deles.
                    // O tilemap continua renderizando normalmente — addTilesetImage usa a textura base.
                    const isAnimated = /-(\d+)fps$/.test(ts.name) && ts.tilecount > 1;
                    if (isAnimated) {
                        this.load.spritesheet(ts.name, GameData.assetUrl(imagePath), {
                            frameWidth: ts.tilewidth,
                            frameHeight: ts.tileheight
                        });
                    } else {
                        this.load.image(ts.name, GameData.assetUrl(imagePath));
                    }
                    if (TILESET_ALIASES[ts.name]) {
                        this.load.image(TILESET_ALIASES[ts.name], GameData.assetUrl(imagePath));
                    }
                }
            });
        });
    }

    create() {
        this.currentView = 'countdown';
        this.hasWon = false;
        this.overlayElements = [];
        this.keyListeners = [];

        const levelConfig = GameData.LEVELS[this.currentLevel];
        GameData.levelFeatureOverrides = levelConfig.features || null;

        this._ensureBubbleTexture();
        this.createMap();

        if (GameData.isFeatureEnabled('upsideDown')) {
            this.physics.world.gravity.y = -800;
        }

        this.playerController = new PlayerController(this);
        this.enemyManager = new EnemyManager(this);
        this.effectsManager = new EffectsManager(this);
        this.hudManager = new HUDManager(this);
        this.pauseMenu = new PauseMenu(this);
        this.victoryScreen = new VictoryScreen(this);
        this.windSystem = this._createWindSystem();

        this.playerController.create();
        this.enemyManager.create(this._enemyData);
        this._createStarAnimations();
        this.hudManager.create();
        this.hudManager.showLevelName(levelConfig.name);
        this.setupControls();
        this.setupPhysics();

        this.levelStartTime = null;
        this.elapsedTime = 0;
        this.pausedAtTime = null;

        if (this.currentLevel === 0) {
            this.startCountdown();
        } else {
            this.currentView = 'gameplay';
        }

        // Trilha sonora — sorteia e toca uma faixa; se ela terminar antes do
        // fim da fase, o MusicManager encadeia automaticamente. Paramos em
        // `shutdown()`, cobrindo saídas por vitória, morte, game over e pause.
        MusicManager.startGameplay(this, this.currentLevel);
    }

    // ==================== MAPA ====================

    createMap() {
        const levelConfig = GameData.LEVELS[this.currentLevel];
        const map = this.make.tilemap({ key: levelConfig.key });
        this.map = map;

        const allTilesets = [];
        const addedNames = new Set();

        map.tilesets.forEach((ts, index) => {
            addedNames.add(ts.name);
            const tileset = map.addTilesetImage(ts.name, ts.name, undefined, undefined, undefined, undefined, ts.firstgid);
            if (tileset) allTilesets.push(tileset);
        });

        this.bgLayer = map.createLayer('bg', allTilesets);
        this.setupAutoTileAnimations(map, this.bgLayer);

        const bgDecoLayer = map.getLayer('bg_decoration');
        if (bgDecoLayer) {
            this.bgDecorationLayer = map.createLayer('bg_decoration', allTilesets);
            this.setupAutoTileAnimations(map, this.bgDecorationLayer);

            const lavaBubblesTileset = map.tilesets.find(ts => ts.name === 'lava-bubbles-4fps');
            if (lavaBubblesTileset && !this.getTilesetProperties(lavaBubblesTileset).fps) {
                this.setupLavaBubblesAnimation(this.bgDecorationLayer, lavaBubblesTileset);
            }
        }

        this.solidsLayer = map.createLayer('solids', allTilesets);
        this.solidsLayer.setCollisionByProperty({ collider: true });
        this.solidsLayer.setCollisionByExclusion([-1, 0]);

        // Arcade debug não desenha tiles — renderDebug mostra os colliders da layer
        if (this.physics.world.drawDebug) {
            const g = this.add.graphics().setDepth(GC.DEPTH.DEBUG - 1).setAlpha(0.85);
            this.solidsLayer.renderDebug(g, {
                tileColor: null, // não-colidíveis: invisíveis
                collidingTileColor: new Phaser.Display.Color(40, 120, 255, 90),
                faceColor: new Phaser.Display.Color(80, 200, 255, 220)
            });
            this._solidsDebugGraphics = g;
        }

        const fgDecoLayer = map.getLayer('fg_decoration');
        if (fgDecoLayer) {
            this.fgDecorationLayer = map.createLayer('fg_decoration', allTilesets);
            this.fgDecorationLayer.setDepth(GC.DEPTH.FG_DECORATION);
        }

        const lavaAnimatedTileset = map.tilesets.find(ts => ts.name === 'lava-roxa-animated');
        if (lavaAnimatedTileset) {
            this.setupTileAnimations(this.solidsLayer, lavaAnimatedTileset);
        }

        this.parseMapObjects(map);
        this.setupCamera(map, levelConfig);
    }

    parseMapObjects(map) {
        const objectsLayer = map.getObjectLayer('objects');

        this.playerSpawn = { x: 100, y: 100 };
        this.goalPosition = { x: 500, y: 100 };
        this.checkpointPositions = [];
        const trampolines = [];
        const stars = [];
        const enemies = [];
        const speedBoosts = [];
        const extraLives = [];
        const heartPickups = [];
        const mushrooms = [];
        const movingPlatforms = [];

        const gidToTilesetName = {};
        map.tilesets.forEach(ts => {
            for (let i = 0; i < ts.total; i++) {
                gidToTilesetName[ts.firstgid + i] = ts.name.toLowerCase();
            }
        });

        objectsLayer.objects.forEach(obj => {
            const type = obj.properties?.find(p => p.name === 'type')?.value;
            const tilesetName = gidToTilesetName[obj.gid] || '';
            const transform = this._extractTilesetTransform(obj);

            if (type === 'player_spawn' || type === 'player-spawn' ||
                tilesetName.includes('still-hero') || tilesetName.includes('still hero')) {
                // Spawn não usa transform — o sprite do jogador tem orientação própria (flipX dinâmico pela direção do movimento).
                this.playerSpawn = { x: obj.x + 16, y: obj.y - 16 };
            }
            else if (type === 'goal' ||
                     tilesetName.includes('green-flag') || tilesetName.includes('green flag')) {
                this.goalPosition = { x: obj.x + 16, y: obj.y - 16, transform };
            }
            else if (type === 'checkpoint' ||
                     tilesetName.includes('yellow-flag') || tilesetName.includes('yellow flag')) {
                this.checkpointPositions.push({ x: obj.x + 16, y: obj.y - 16, transform });
            }
            else if (type === 'trampoline' || tilesetName.includes('trampoline')) {
                trampolines.push({ x: obj.x + 16, y: obj.y - 16, transform });
            }
            else if (type === 'star' || tilesetName.includes('star') || tilesetName.includes('estrela')) {
                stars.push({ x: obj.x + 16, y: obj.y - 16, transform });
            }
            else if (type === 'boneco' || tilesetName.includes('boneco')) {
                enemies.push({
                    x: obj.x + 16,
                    y: obj.y - 16,
                    type: 'boneco'
                });
            }
            else if (type === 'enemy' || type === 'sapo' ||
                     tilesetName.includes('sapo') || tilesetName.includes('frog')) {
                const isSapoVerde = tilesetName.includes('sapo-verde') || tilesetName.includes('verde');
                // Inimigos com patrulha/AI ignoram transform — `flipX` é controlado pelo EnemyManager em runtime.
                enemies.push({
                    x: obj.x + 16,
                    y: obj.y - 16,
                    type: isSapoVerde ? 'sapo-verde' : 'sapo'
                });
            }
            else if (type === 'seahorse' ||
                     tilesetName.includes('cavalo marinho') || tilesetName.includes('cavalo-marinho') ||
                     tilesetName.includes('seahorse')) {
                enemies.push({
                    x: obj.x + 16,
                    y: obj.y - 16,
                    type: 'seahorse'
                });
            }
            else if (type === 'speed_boost' || type === 'boost' ||
                     tilesetName.includes('setas') || tilesetName.includes('velocidade') ||
                     tilesetName.includes('speed') || tilesetName.includes('boost')) {
                speedBoosts.push({ x: obj.x + 16, y: obj.y - 16, transform });
            }
            else if (type === 'heart' || type === 'health' ||
                     tilesetName.includes('red-heart') || tilesetName.includes('heart')) {
                heartPickups.push({ x: obj.x + 16, y: obj.y - 16, transform });
            }
            else if (type === '1up' || type === 'extra_life' ||
                     tilesetName.includes('1up') || tilesetName.includes('nota') ||
                     tilesetName.includes('extra-life') || tilesetName.includes('extra_life')) {
                extraLives.push({ x: obj.x + 16, y: obj.y - 16, textureKey: tilesetName, transform });
            }
            else if (type === 'mushroom' || tilesetName.includes('mushroom') || tilesetName.includes('cogumelo')) {
                mushrooms.push({ x: obj.x + 16, y: obj.y - 16, textureKey: tilesetName, transform });
            }
            else if (tilesetName.includes('plataforma-deslisante') || tilesetName.includes('plataforma-deslizante') ||
                     tilesetName.includes('plataforma-movel')) {
                const objProps = {};
                if (obj.properties) {
                    obj.properties.forEach(p => { objProps[p.name] = p.value; });
                }
                // Tiled: objeto com gid usa (x,y) no canto inferior-esquerdo;
                // width/height podem ser > tile (redimensionar no editor).
                const w = obj.width || 32;
                const h = obj.height || 32;
                movingPlatforms.push({
                    x: obj.x + w / 2,
                    y: obj.y - h / 2,
                    width: w,
                    height: h,
                    textureKey: tilesetName,
                    verticalBlocks: objProps['vertical-move_downward_in_blocks'] || 0,
                    horizontalBlocks: objProps['horizontal-move_right_in_blocks'] || 0,
                    transform
                });
            }
        });

        this.currentCheckpoint = this.playerSpawn;
        this._enemyData = enemies;

        this.createGoal();
        this.createCheckpoints();
        this.createTrampolines(trampolines);
        this.createStars(stars);
        this.createSpeedBoosts(speedBoosts);
        this.createExtraLives(extraLives);
        this.createHeartPickups(heartPickups);
        this.createMushrooms(mushrooms);
        this.createMovingPlatforms(movingPlatforms);
        this.createWaterZones(map);
    }

    /**
     * Extrai flip/rotação de um objeto Tiled após o parser do Phaser.
     *
     * O Tiled codifica flips nos 3 bits altos do `gid` (0x80000000=H, 0x40000000=V, 0x20000000=anti-diag).
     * O Phaser parseia isso em runtime: mascara o gid e expõe `flippedHorizontal`/`flippedVertical`/`rotation`
     * como propriedades top-level do objeto. Aqui só consolidamos em uma estrutura uniforme.
     *
     * @returns {{ flipX: boolean, flipY: boolean, rotation: number }} rotation em graus
     */
    _extractTilesetTransform(obj) {
        return {
            flipX: !!obj.flippedHorizontal,
            flipY: !!obj.flippedVertical,
            rotation: obj.rotation || 0
        };
    }

    /**
     * Aplica o transform extraído de um objeto Tiled a um sprite criado a partir dele.
     * Afeta apenas a aparência (flipX/flipY/angle) — não muda a hitbox de física,
     * que continua centrada na orientação base do sprite.
     *
     * No-op se sprite ou transform forem nulos.
     */
    _applyTilesetTransform(sprite, transform) {
        if (!sprite || !transform) return;
        if (transform.flipX) sprite.setFlipX(true);
        if (transform.flipY) sprite.setFlipY(true);
        if (transform.rotation) sprite.setAngle(transform.rotation);
    }

    createWaterZones(map) {
        const waterLayer = map.getObjectLayer('water-zone');
        if (!waterLayer || !GameData.isFeatureEnabled('waterPhysics')) {
            this.waterZones = [];
            return;
        }

        this.waterZones = [];
        waterLayer.objects.forEach(obj => {
            const zone = this.add.zone(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width, obj.height);
            this.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
            zone.body.setSize(obj.width, obj.height);
            this.waterZones.push(zone);
        });
    }

    /**
     * True se o mapa tem ao menos uma water-zone com objetos (camada vazia não conta).
     */
    _mapHasWater(map) {
        const layer = map.getObjectLayer('water-zone');
        return !!(layer && layer.objects && layer.objects.length > 0);
    }

    /**
     * Cria WindSystem se a flag `wind` está on (global ou override da fase)
     * e a fase não tem água nem auto-scroll. Caso contrário retorna null.
     *
     * Para ligar vento numa fase específica, adicione em GameConfig.LEVELS:
     *   features: { wind: true }
     */
    _createWindSystem() {
        if (!GameData.isFeatureEnabled('wind')) return null;
        if (GameData.isFeatureEnabled('autoScroll')) {
            console.log('🌬️ Wind desativado: fase com auto-scroll');
            return null;
        }
        if (this._mapHasWater(this.map)) {
            console.log('🌬️ Wind desativado: fase com água');
            return null;
        }
        console.log('🌬️ Wind ativo nesta fase');
        return new WindSystem(this);
    }

    createGoal() {
        this.goal = this.physics.add.staticSprite(this.goalPosition.x, this.goalPosition.y, 'green-flag');
        this.goal.body.setSize(GC.GOAL.BODY_WIDTH, GC.GOAL.BODY_HEIGHT);
        this.goal.body.setOffset(GC.GOAL.BODY_OFFSET_X, GC.GOAL.BODY_OFFSET_Y);
        this._applyTilesetTransform(this.goal, this.goalPosition.transform);
    }

    createCheckpoints() {
        this.checkpoints = [];
        this.checkpointPositions.forEach(cp => {
            const flag = this.physics.add.staticSprite(cp.x, cp.y, 'yellow-flag');
            flag.checkpointPos = cp;
            flag.activated = false;
            this._applyTilesetTransform(flag, cp.transform);
            this.checkpoints.push(flag);
        });
    }

    createTrampolines(positions) {
        this.trampolines = this.physics.add.staticGroup();
        positions.forEach(t => {
            const trampoline = this.physics.add.staticSprite(t.x, t.y, 'trampoline');
            trampoline.body.setSize(GC.TRAMPOLINE.BODY_WIDTH, GC.TRAMPOLINE.BODY_HEIGHT);
            trampoline.body.setOffset(0, GC.TRAMPOLINE.BODY_OFFSET_Y);
            this._applyTilesetTransform(trampoline, t.transform);
            this.trampolines.add(trampoline);
        });
    }

    createStars(positions) {
        this.stars = this.physics.add.group();
        positions.forEach(s => {
            const star = this.stars.create(s.x, s.y, 'star');
            star.body.allowGravity = false;
            this._applyTilesetTransform(star, s.transform);
        });
        this.starsCollected = 0;
        this.totalStars = positions.length;
    }

    createSpeedBoosts(positions) {
        this.speedBoosts = this.physics.add.staticGroup();
        positions.forEach(pos => {
            const boost = this.physics.add.staticSprite(pos.x, pos.y, 'setas-velocidade');
            boost.body.setSize(GC.SPEED_BOOST.BODY_WIDTH, GC.SPEED_BOOST.BODY_HEIGHT);
            boost.body.setOffset(0, GC.SPEED_BOOST.BODY_OFFSET_Y);
            boost.setAlpha(0.9);
            this._applyTilesetTransform(boost, pos.transform);
            this.speedBoosts.add(boost);
        });
    }

    createExtraLives(positions) {
        this.extraLives = this.physics.add.staticGroup();
        positions.forEach(pos => {
            const hasTexture = pos.textureKey && this.textures.exists(pos.textureKey);
            const item = hasTexture
                ? this.extraLives.create(pos.x, pos.y, pos.textureKey)
                : this.extraLives.create(pos.x, pos.y, 'star', 0).setTint(0x00ff88).setScale(0.9);

            if (hasTexture) {
                this._playTilesetAnimation(item, pos.textureKey);
            }
            this._applyTilesetTransform(item, pos.transform);

            this.tweens.add({
                targets: item,
                y: pos.y - 4,
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });
    }

    /**
     * Se o textureKey termina em "-Nfps", cria (uma vez) e toca uma animação em loop
     * usando todos os frames não-vazios do spritesheet. Sprites estáticos do Arcade
     * physics continuam funcionando normalmente — só o frame visual muda.
     *
     * Frames totalmente transparentes no final são ignorados — útil para
     * spritesheets exportados pelo Piskel cujo grid não preenche todas as células
     * (ex.: 5 frames numa imagem 2×3, com a 6ª célula vazia).
     */
    _playTilesetAnimation(sprite, textureKey) {
        const fpsMatch = textureKey.match(/-(\d+)fps$/);
        if (!fpsMatch || !this.textures.exists(textureKey)) return;

        const fps = parseInt(fpsMatch[1], 10);
        const validFrames = this._getNonEmptyFrameCount(textureKey);
        if (validFrames < 2) return;

        const animKey = textureKey + '-loop';
        if (!this.anims.exists(animKey)) {
            this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: validFrames - 1 }),
                frameRate: fps,
                repeat: -1
            });
        }
        if (sprite.anims) {
            sprite.anims.play(animKey, true);
        }
    }

    /**
     * Conta quantos frames de um spritesheet contêm pixels não-transparentes,
     * varrendo do último para o primeiro. Resultado é cacheado por textureKey.
     */
    _getNonEmptyFrameCount(textureKey) {
        if (!this._frameCountCache) this._frameCountCache = {};
        if (this._frameCountCache[textureKey] !== undefined) {
            return this._frameCountCache[textureKey];
        }

        const tex = this.textures.get(textureKey);
        if (!tex) { this._frameCountCache[textureKey] = 0; return 0; }

        const totalFrames = Math.max(0, tex.frameTotal - 1); // exclui __BASE
        const sourceImg = tex.source && tex.source[0] && tex.source[0].image;
        if (!sourceImg || totalFrames < 1) {
            this._frameCountCache[textureKey] = totalFrames;
            return totalFrames;
        }

        try {
            const firstFrame = tex.get(0);
            const frameW = firstFrame.width;
            const frameH = firstFrame.height;

            const canvas = document.createElement('canvas');
            canvas.width = frameW;
            canvas.height = frameH;
            // willReadFrequently: hint para o browser alocar o canvas na CPU,
            // já que vamos chamar getImageData() em loop (uma vez por frame do spritesheet)
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // Varre frames do fim para o início, parando no primeiro não-vazio
            for (let i = totalFrames - 1; i >= 0; i--) {
                const frame = tex.get(i);
                if (!frame) continue;

                ctx.clearRect(0, 0, frameW, frameH);
                ctx.drawImage(sourceImg,
                    frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
                    0, 0, frameW, frameH);
                const data = ctx.getImageData(0, 0, frameW, frameH).data;

                for (let j = 3; j < data.length; j += 4) {
                    if (data[j] > 0) {
                        this._frameCountCache[textureKey] = i + 1;
                        return i + 1;
                    }
                }
            }
            this._frameCountCache[textureKey] = 0;
            return 0;
        } catch (err) {
            // CORS ou outro erro de leitura — usa todos os frames como fallback
            this._frameCountCache[textureKey] = totalFrames;
            return totalFrames;
        }
    }

    collectExtraLife(player, item) {
        item.disableBody(true, true);
        SoundManager.play('collect1up');
        const newLives = GameData.addLife();
        this.hudManager.updateLives(newLives);

        const text = this.add.text(item.x, item.y - 20, '1UP!', {
            fontSize: '16px', fontFamily: 'Arial', color: '#00ff88',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(GC.DEPTH.HUD);

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy()
        });
    }

    createHeartPickups(positions) {
        this.heartPickups = this.physics.add.staticGroup();
        const cfg = GC.HEART_PICKUP;

        positions.forEach(pos => {
            const item = this.heartPickups.create(pos.x, pos.y, 'red-heart');
            item.body.setSize(cfg.BODY_SIZE, cfg.BODY_SIZE);
            item.body.setOffset(cfg.BODY_OFFSET, cfg.BODY_OFFSET);
            this._applyTilesetTransform(item, pos.transform);

            this.tweens.add({
                targets: item,
                y: pos.y - cfg.BOB_OFFSET_Y,
                duration: cfg.BOB_DURATION_MS,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });
    }

    /**
     * Cura +1 coração. Com vida cheia o item fica no chão (não coleta).
     */
    collectHeart(player, item) {
        if (!item || !item.active) return;
        if (this.playerController.hearts >= GC.HEARTS.MAX) return;

        item.disableBody(true, true);
        this.tweens.killTweensOf(item);

        if (!this.playerController.heal(1)) return;

        SoundManager.play('collectHeart');

        const text = this.add.text(item.x, item.y - 20, '+❤', {
            fontSize: '16px', fontFamily: 'Arial', color: '#ff6688',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(GC.DEPTH.HUD);

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy()
        });
    }

    createMushrooms(positions) {
        this.mushrooms = this.physics.add.staticGroup();
        positions.forEach(pos => {
            const hasTexture = pos.textureKey && this.textures.exists(pos.textureKey);
            const item = hasTexture
                ? this.mushrooms.create(pos.x, pos.y, pos.textureKey)
                : this.mushrooms.create(pos.x, pos.y, 'star', 0).setTint(0xff66ff);

            this._applyTilesetTransform(item, pos.transform);

            this.tweens.add({
                targets: item,
                y: pos.y - 4,
                duration: 1100,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });
    }

    collectMushroom(player, item) {
        item.disableBody(true, true);
        SoundManager.play('powerUp');

        const text = this.add.text(item.x, item.y - 20, 'TRIPPY!', {
            fontSize: '14px', fontFamily: '"Press Start 2P", Arial', color: '#ff66ff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(GC.DEPTH.HUD);
        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 900,
            onComplete: () => text.destroy()
        });

        this._activateOscillationEffect(GC.MUSHROOM.EFFECT_DURATION_MS);
    }

    _activateOscillationEffect(durationMs) {
        const cam = this.cameras.main;
        const renderer = this.game.renderer;

        // Pipeline só funciona em WebGL
        if (!renderer || !renderer.pipelines || typeof Phaser.Renderer.WebGL === 'undefined') return;

        const PIPELINE_KEY = 'VerticalOscillationPipeline';

        if (!renderer.pipelines.get(PIPELINE_KEY) && typeof VerticalOscillationPipeline !== 'undefined') {
            renderer.pipelines.addPostPipeline(PIPELINE_KEY, VerticalOscillationPipeline);
        }

        // Cancela timer anterior caso ainda esteja ativo (re-coleta)
        if (this._oscillationTimer) {
            this._oscillationTimer.remove(false);
            this._oscillationTimer = null;
        }
        if (this._oscillationFadeTween) {
            this._oscillationFadeTween.stop();
            this._oscillationFadeTween = null;
        }

        cam.setPostPipeline(PIPELINE_KEY);

        const pipeline = cam.getPostPipeline(PIPELINE_KEY);
        if (pipeline) {
            const targetAmp = GC.MUSHROOM.SHADER_AMPLITUDE;
            const targetHue = GC.MUSHROOM.SHADER_HUE_SPEED;
            pipeline.speed = GC.MUSHROOM.SHADER_SPEED;
            pipeline.frequency = GC.MUSHROOM.SHADER_FREQUENCY;
            pipeline.amplitude = 0;
            pipeline.hueSpeed = 0;

            // Fade-in suave da amplitude e do hue cycling (~250ms)
            this._oscillationFadeTween = this.tweens.addCounter({
                from: 0,
                to: 1,
                duration: 250,
                onUpdate: t => {
                    const v = t.getValue();
                    pipeline.amplitude = targetAmp * v;
                    pipeline.hueSpeed = targetHue * v;
                }
            });
        }

        // Agenda fade-out + remoção ao final
        const fadeMs = GC.MUSHROOM.FADE_OUT_MS;
        const sustainMs = Math.max(0, durationMs - fadeMs);

        this._oscillationTimer = this.time.delayedCall(sustainMs, () => {
            const pipe = cam.getPostPipeline(PIPELINE_KEY);
            if (pipe) {
                const startAmp = pipe.amplitude;
                const startHue = pipe.hueSpeed;
                this._oscillationFadeTween = this.tweens.addCounter({
                    from: 1,
                    to: 0,
                    duration: fadeMs,
                    onUpdate: t => {
                        const v = t.getValue();
                        pipe.amplitude = startAmp * v;
                        pipe.hueSpeed = startHue * v;
                    },
                    onComplete: () => {
                        cam.removePostPipeline(PIPELINE_KEY);
                        this._oscillationTimer = null;
                        this._oscillationFadeTween = null;
                    }
                });
            } else {
                cam.removePostPipeline(PIPELINE_KEY);
                this._oscillationTimer = null;
            }
        });
    }

    createMovingPlatforms(positions) {
        this.movingPlatforms = this.physics.add.group();

        positions.forEach(p => {
            const vDist = p.verticalBlocks * 32;
            const hDist = p.horizontalBlocks * 32;
            const totalDist = Math.max(vDist, hDist);
            if (totalDist <= 0) return;

            const platform = this.movingPlatforms.create(p.x, p.y, p.textureKey);
            platform.body.allowGravity = false;
            platform.body.immovable = true;

            // Respeita width/height do Tiled (estica o tile 32×32).
            // Hitbox: faixa fina na base do sprite (proporcional ao frame),
            // escalada automaticamente pelo displaySize do Arcade.
            const frameW = platform.frame.width;
            const frameH = platform.frame.height;
            const displayW = p.width || frameW;
            const displayH = p.height || frameH;
            platform.setDisplaySize(displayW, displayH);

            const bodySrcH = Math.max(1, Math.round(frameH * (6 / 32)));
            platform.body.setSize(frameW, bodySrcH);
            platform.body.setOffset(0, frameH - bodySrcH);
            platform.body.checkCollision.down = false;
            platform.body.checkCollision.left = false;
            platform.body.checkCollision.right = false;
            this._applyTilesetTransform(platform, p.transform);

            const periodMs = 2 * totalDist / GC.MOVING_PLATFORM.SPEED * 1000;

            platform.moveData = {
                startX: p.x,
                startY: p.y,
                distanceY: vDist,
                distanceX: hDist,
                phase: 0,
                periodMs: periodMs,
            };
        });
    }

    updateMovingPlatforms(delta) {
        if (!this.movingPlatforms) return;

        this.movingPlatforms.children.iterate(platform => {
            if (!platform || !platform.active || !platform.moveData) return;

            const data = platform.moveData;
            const omega = (2 * Math.PI) / data.periodMs;

            data.phase += omega * delta;
            if (data.phase >= 2 * Math.PI) data.phase -= 2 * Math.PI;

            if (data.distanceY > 0) {
                platform.body.velocity.y = (data.distanceY / 2) * omega * Math.sin(data.phase) * 1000;
            } else {
                platform.body.velocity.y = 0;
            }
            if (data.distanceX > 0) {
                platform.body.velocity.x = (data.distanceX / 2) * omega * Math.sin(data.phase) * 1000;
            } else {
                platform.body.velocity.x = 0;
            }
        });
    }

    /**
     * Arcade não “cola” o jogador em plataformas móveis horizontais: o PlayerController
     * redefine velocity.x todo frame. Se estiver em cima de uma plataforma, soma a
     * velocidade dela (roda depois do playerController, como o auto-scroll).
     */
    _applyMovingPlatformCarry() {
        const player = this.playerController?.player;
        if (!player?.body || !this.movingPlatforms) return;

        const upsideDown = GameData.isFeatureEnabled('upsideDown');
        const standing = upsideDown
            ? (player.body.touching.up || player.body.blocked.up)
            : (player.body.touching.down || player.body.blocked.down);
        if (!standing) return;

        let carried = false;
        this.movingPlatforms.children.iterate(platform => {
            if (carried || !platform?.active || !platform.body) return;

            const overlapX = player.body.right > platform.body.left
                && player.body.left < platform.body.right;
            if (!overlapX) return;

            const playerEdge = upsideDown ? player.body.top : player.body.bottom;
            const platformEdge = upsideDown ? platform.body.bottom : platform.body.top;
            if (Math.abs(playerEdge - platformEdge) > 8) return;

            // Só soma X: forçar velocity.y anulava o pulo na plataforma vertical
            // (o Arcade já acompanha a plataforma no eixo Y pela colisão).
            player.body.velocity.x += platform.body.velocity.x;
            carried = true;
        });
    }

    _createStarAnimations() {
        if (!this.anims.exists('star-spin')) {
            this.anims.create({
                key: 'star-spin',
                frames: this.anims.generateFrameNumbers('star', { start: 0, end: 8 }),
                frameRate: 12,
                repeat: -1
            });
        }
        this.stars.children.iterate(star => {
            if (star) star.anims.play('star-spin', true);
        });
    }

    // ==================== ANIMAÇÕES DE TILES ====================

    setupCamera(map, levelConfig) {
        const zoom = levelConfig.zoom ?? GameData.DEFAULTS.zoom;
        const roundPixels = levelConfig.roundPixels ?? GameData.DEFAULTS.roundPixels;

        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setZoom(zoom);
        this.cameras.main.setRoundPixels(roundPixels);

        if (zoom < 1) {
            GameData.applyLinearFilter(this);
        } else {
            GameData.applyPixelArtFilter(this);
        }
    }

    setupTileAnimations(layer, tileset) {
        if (!tileset) return;
        const firstGid = tileset.firstgid;
        let currentFrame = 0;

        this.time.addEvent({
            delay: 200,
            loop: true,
            callback: () => {
                currentFrame = (currentFrame + 1) % 4;
                layer.forEachTile(tile => {
                    if (tile.index >= firstGid && tile.index < firstGid + 4) {
                        tile.index = firstGid + currentFrame;
                    }
                });
            }
        });
    }

    setupLavaBubblesAnimation(layer, tileset) {
        if (!tileset || !layer) return;
        const firstGid = tileset.firstgid;
        let currentFrame = 0;

        this.time.addEvent({
            delay: 250,
            loop: true,
            callback: () => {
                currentFrame = (currentFrame + 1) % 4;
                layer.forEachTile(tile => {
                    if (tile.index >= firstGid && tile.index < firstGid + 4) {
                        tile.index = firstGid + currentFrame;
                    }
                });
            }
        });
    }

    /**
     * Configura animações automáticas para tiles baseado em propriedades do Tiled
     * (fps e frames_random)
     */
    setupAutoTileAnimations(map, layer) {
        if (!layer) return;

        const animationsByFps = new Map();
        const levelConfig = GameData.LEVELS[GameData.state.currentLevel];
        const mapKey = levelConfig ? levelConfig.key : 'map1';
        const rawMapData = this.cache.tilemap.get(mapKey);
        const rawTilesets = rawMapData?.data?.tilesets || [];

        map.tilesets.forEach((tileset, index) => {
            const rawTileset = rawTilesets.find(ts => ts.name === tileset.name) || rawTilesets[index];
            const props = this.getTilesetProperties(rawTileset || tileset);
            const fps = props.fps || 0;
            const framesRandom = props.frames_random || 0;

            if (fps <= 0) return;

            const frameCount = rawTileset?.tilecount || tileset.total || 1;
            const delay = Math.round(1000 / fps);

            if (!animationsByFps.has(delay)) {
                animationsByFps.set(delay, []);
            }

            animationsByFps.get(delay).push({
                name: tileset.name,
                firstGid: tileset.firstgid,
                frameCount: frameCount,
                framesRandom: framesRandom
            });
        });

        animationsByFps.forEach((tilesets, delay) => {
            const tileOffsets = new Map();

            layer.forEachTile(tile => {
                tilesets.forEach(ts => {
                    if (tile.index >= ts.firstGid && tile.index < ts.firstGid + ts.frameCount) {
                        const key = `${tile.x},${tile.y}`;
                        const randomOffset = ts.framesRandom > 0
                            ? Math.floor(Math.random() * ts.framesRandom)
                            : 0;
                        tileOffsets.set(key, {
                            offset: randomOffset,
                            firstGid: ts.firstGid,
                            frameCount: ts.frameCount
                        });
                    }
                });
            });

            if (tileOffsets.size === 0) return;

            let globalFrame = 0;
            const maxFrames = Math.max(...tilesets.map(ts => ts.frameCount));

            this.time.addEvent({
                delay: delay,
                loop: true,
                callback: () => {
                    globalFrame = (globalFrame + 1) % maxFrames;
                    layer.forEachTile(tile => {
                        const key = `${tile.x},${tile.y}`;
                        const data = tileOffsets.get(key);
                        if (data) {
                            const individualFrame = (globalFrame + data.offset) % data.frameCount;
                            tile.index = data.firstGid + individualFrame;
                        }
                    });
                }
            });
        });
    }

    /**
     * Extrai propriedades customizadas de um tileset.
     * Aceita propriedades no nível do tileset OU no primeiro tile (tiles[0]).
     */
    getTilesetProperties(tileset) {
        const props = {};
        let properties = tileset.properties || tileset.tilesetProperties || [];

        if ((!properties || properties.length === 0) && tileset.tiles && tileset.tiles[0]) {
            properties = tileset.tiles[0].properties || [];
        }

        if (Array.isArray(properties)) {
            properties.forEach(prop => { props[prop.name] = prop.value; });
        } else if (typeof properties === 'object') {
            Object.assign(props, properties);
        }

        return props;
    }

    // ==================== FÍSICA E CONTROLES ====================

    setupPhysics() {
        const player = this.playerController.player;

        this.physics.add.collider(player, this.solidsLayer, this.handleTileCollision, null, this);
        this.physics.add.overlap(player, this.goal, () => this.victoryScreen.reachGoal(), null, this);
        this.physics.add.collider(player, this.trampolines,
            (p, t) => this.playerController.handleTrampolineCollision(p, t), null, this);
        this.physics.add.overlap(player, this.stars, this.collectStar, null, this);

        if (this.enemyManager.enemies && this.enemyManager.enemies.children.size > 0) {
            this.physics.add.collider(this.enemyManager.enemies, this.solidsLayer);
            this.physics.add.overlap(player, this.enemyManager.enemies,
                (p, e) => this.enemyManager.handleCollision(p, e), null, this);
        }

        if (this.enemyManager.bubbles) {
            this.physics.add.collider(this.enemyManager.bubbles, this.solidsLayer,
                (b) => this.enemyManager.handleBubbleHitTile(b), null, this);
            this.physics.add.overlap(player, this.enemyManager.bubbles,
                (p, b) => this.enemyManager.handleBubbleHitPlayer(p, b), null, this);
        }

        if (this.speedBoosts && this.speedBoosts.children.size > 0) {
            this.physics.add.overlap(player, this.speedBoosts,
                (p, b) => this.playerController.handleSpeedBoost(p, b), null, this);
        }

        if (this.extraLives && this.extraLives.children.size > 0) {
            this.physics.add.overlap(player, this.extraLives,
                (p, item) => this.collectExtraLife(p, item), null, this);
        }

        if (this.heartPickups && this.heartPickups.children.size > 0) {
            this.physics.add.overlap(player, this.heartPickups,
                (p, item) => this.collectHeart(p, item), null, this);
        }

        if (this.mushrooms && this.mushrooms.children.size > 0) {
            this.physics.add.overlap(player, this.mushrooms,
                (p, item) => this.collectMushroom(p, item), null, this);
        }

        if (this.movingPlatforms && this.movingPlatforms.children.size > 0) {
            this.physics.add.collider(player, this.movingPlatforms);
        }

        this.checkpoints.forEach(flag => {
            this.physics.add.overlap(player, flag, () => {
                if (!flag.activated) {
                    flag.activated = true;
                    flag.setTint(0x00ff00);
                    this.currentCheckpoint = flag.checkpointPos;
                    SoundManager.play('checkpoint');
                    this.playerController.showCheckpointMessage();
                }
            });
        });

        if (this.waterZones && this.waterZones.length > 0) {
            this.waterZones.forEach(zone => {
                this.physics.add.overlap(player, zone, null, () => {
                    this.playerController.isInWater = true;
                    return true;
                }, this);
            });
        }

        if (GameData.isFeatureEnabled('autoScroll')) {
            const cam = this.cameras.main;
            const zoom = cam.zoom;
            cam.scrollX = Math.max(0, player.x - cam.width / (2 * zoom));
            cam.scrollY = Math.max(0, player.y - cam.height / (2 * zoom));
            this.autoScrollMinX = cam.scrollX;
            this._autoScrollWasRespawning = false;
        } else {
            this.cameras.main.startFollow(player, true, 0.1, 0.1);
        }
    }

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        escKey.on('down', () => {
            if (this.currentView === 'gameplay' && !this.hasWon) {
                SoundManager.play('menuBack');
                this.pauseMenu.show();
            } else if (this.currentView === 'paused') {
                SoundManager.play('menuSelect');
                this.pauseMenu.resume();
            } else if (this.currentView === 'ranking') {
                SoundManager.play('menuBack');
                this.victoryScreen.closeRanking();
            }
        });
        this.keyListeners.push(escKey);

        this.virtualControls = GameData.getVirtualControls();
    }

    // ==================== AUTO-SCROLL ====================

    _updateAutoScroll(delta) {
        const cam = this.cameras.main;
        const pc = this.playerController;
        const player = pc.player;
        const dt = delta / 1000;
        const bounds = this.physics.world.bounds;
        const zoom = cam.zoom;
        const visibleW = cam.width / zoom;
        const visibleH = cam.height / zoom;
        const maxScrollX = Math.max(0, bounds.width - visibleW);
        const maxScrollY = Math.max(0, bounds.height - visibleH);
        const isRespawning = pc.isRespawning;

        // Detecta início do respawn: recua o ponto mínimo de scroll até o checkpoint
        if (!this._autoScrollWasRespawning && isRespawning) {
            const cp = this.currentCheckpoint;
            this.autoScrollMinX = Math.max(0, cp.x - visibleW * GC.AUTO_SCROLL.SPAWN_CAMERA_OFFSET_RATIO);
        }
        this._autoScrollWasRespawning = isRespawning;

        if (isRespawning) {
            // Durante respawn: câmera acompanha o jogador (animação de arco) e recua suavemente
            const targetX = Phaser.Math.Clamp(player.x - visibleW / 2, this.autoScrollMinX, maxScrollX);
            cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetX, 0.08);
            const playerCenteredY = player.y - visibleH / 2;
            cam.scrollY = Phaser.Math.Linear(cam.scrollY, playerCenteredY, 0.1);
            cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, maxScrollY);
            return;
        }

        // Avança o scroll automaticamente
        this.autoScrollMinX += GC.AUTO_SCROLL.SPEED * dt;

        // Câmera X: player pode ir à frente, mas nunca fica atrás do mínimo
        const playerCenteredX = player.x - visibleW / 2;
        cam.scrollX = Phaser.Math.Clamp(Math.max(this.autoScrollMinX, playerCenteredX), 0, maxScrollX);

        // Câmera Y: segue o jogador com lerp suave
        const playerCenteredY = player.y - visibleH / 2;
        cam.scrollY = Phaser.Math.Linear(cam.scrollY, playerCenteredY, 0.1);
        cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, maxScrollY);

        // Borda esquerda: o centro do jogador nunca deve ficar à esquerda deste ponto
        const leftBoundary = cam.scrollX + GC.AUTO_SCROLL.LEFT_MARGIN;

        if (player.x < leftBoundary) {
            // Bloqueado à direita com a borda esquerda pressionando → jogador espremido → dano
            if (player.body.blocked.right && !pc.isInvincible) {
                pc.takeDamage();
                return;
            }
            // Empurra via velocidade: a física resolve colisões com paredes naturalmente,
            // sem teleportar o corpo para dentro de tiles sólidos.
            // Factor > 1 para fechar a distância acumulada mais rápido que a rolagem.
            const pushVelocity = GC.AUTO_SCROLL.SPEED * GC.AUTO_SCROLL.PUSH_VELOCITY_FACTOR;
            player.body.velocity.x = Math.max(player.body.velocity.x, pushVelocity);
        }
    }

    // ==================== UPDATE ====================

    update(time, delta) {
        if (this.currentView !== 'gameplay' || this.hasWon) {
            if (this.currentView === 'paused') {
                this.pauseMenu.handleInput();
            }
            if (this.currentView === 'countdown') {
                this.playerController.freeze();
            }
            return;
        }

        if (this.virtualControls.backJustPressed) {
            this.virtualControls.backJustPressed = false;
            this.pauseMenu.show();
        }

        this.updateMovingPlatforms(delta);
        this.hudManager.updateTimer(this.time.now);
        if (this.windSystem) {
            this.windSystem.update(this.time.now);
        }
        this.playerController.update(delta);
        // Plataforma móvel: carrega o jogador depois do input (senão velocity.x é sobrescrito)
        this._applyMovingPlatformCarry();
        // Auto-scroll roda APÓS o playerController para sobrescrever o input com o empurrão
        if (GameData.isFeatureEnabled('autoScroll')) {
            this._updateAutoScroll(delta);
        }
        this.hudManager.updateWindIndicator();
        this.hudManager.updateDebugVelocity();
        this.enemyManager.update(this.time.now);
        this.effectsManager.update(this.time.now);
    }

    // ==================== COUNTDOWN ====================

    startCountdown() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        const countdownStyle = {
            fontSize: '72px',
            fontFamily: 'Arial Black, Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        };

        const countdownText = this.add.text(centerX, centerY, '3', countdownStyle)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(GC.DEPTH.COUNTDOWN)
            .setScale(0);

        const animateNumber = (text, callback) => {
            this.tweens.add({
                targets: countdownText,
                scale: { from: 0, to: 1.2 },
                duration: 200,
                ease: 'Back.easeOut',
                onStart: () => {
                    countdownText.setText(text);
                    countdownText.setColor('#ffffff');
                },
                onComplete: () => {
                    this.tweens.add({
                        targets: countdownText,
                        scale: 0.9,
                        alpha: 0.7,
                        duration: 600,
                        onComplete: callback
                    });
                }
            });
        };

        SoundManager.play('countdownTick');
        animateNumber('3', () => {
            SoundManager.play('countdownTick');
            animateNumber('2', () => {
                SoundManager.play('countdownTick');
                animateNumber('1', () => {
                    this.currentView = 'gameplay';
                    SoundManager.play('countdownGo');
                    this.tweens.add({
                        targets: countdownText,
                        scale: { from: 0, to: 1.5 },
                        duration: 300,
                        ease: 'Back.easeOut',
                        onStart: () => {
                            countdownText.setText('GO!');
                            countdownText.setColor('#00ff00');
                            countdownText.setAlpha(1);
                        },
                        onComplete: () => {
                            this.tweens.add({
                                targets: countdownText,
                                scale: 2,
                                alpha: 0,
                                duration: 400,
                                onComplete: () => countdownText.destroy()
                            });
                        }
                    });
                });
            });
        });
    }

    // ==================== COLISÕES ====================

    handleTileCollision(player, tile) {
        if (tile.properties?.jump_back_to_checkpoint) {
            this.playerController.takeDamage();
        }
    }

    collectStar(player, star) {
        this.effectsManager.createStarCollectGlow(star.x, star.y);
        star.disableBody(true, true);
        this.starsCollected++;
        SoundManager.play('collectStar');
        this.hudManager.updateStarCount(this.starsCollected, this.totalStars);
    }

    // ==================== VIDAS E GAME OVER ====================

    onPlayerDied() {
        const pc = this.playerController;
        const player = pc.player;
        pc.isRespawning = true;
        player.body.enable = false;
        player.anims.stop();
        player.setVelocity(0, 0);
        player.setDepth(GC.DEPTH.PLAYER + 5);

        SoundManager.play('death');

        // 1. Flash branco + tremor de câmera (impacto)
        if (player.setTintFill) {
            player.setTintFill(0xffffff);
        } else {
            player.setTint(0xffffff);
        }
        this.cameras.main.shake(140, 0.012);

        const startX = player.x;
        const startY = player.y;

        // 2. Burst de estrelinhas em volta
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 / 10) * i + Phaser.Math.FloatBetween(-0.2, 0.2);
            const dist = Phaser.Math.Between(45, 80);
            const star = this.add.text(startX, startY, '⭐', {
                fontSize: '16px',
            }).setOrigin(0.5).setDepth(GC.DEPTH.PLAYER + 6);
            this.tweens.add({
                targets: star,
                x: startX + Math.cos(angle) * dist,
                y: startY + Math.sin(angle) * dist,
                alpha: 0,
                scale: { from: 1.3, to: 0.3 },
                angle: Phaser.Math.Between(-360, 360),
                duration: 650,
                ease: 'Cubic.easeOut',
                onComplete: () => star.destroy()
            });
        }

        // 3. Após flash, vira tom de dano e inicia hop + spin
        this.time.delayedCall(90, () => {
            player.setTint(GC.RESPAWN.HURT_TINT);

            // Hop dramático para cima girando
            this.tweens.add({
                targets: player,
                y: startY - 110,
                angle: 360,
                duration: 380,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    // Queda com aceleração + continua girando + fade
                    this.tweens.add({
                        targets: player,
                        y: startY + 320,
                        angle: player.angle + 540,
                        alpha: 0,
                        duration: 620,
                        ease: 'Cubic.easeIn',
                        onComplete: () => {
                            const remainingLives = GameData.loseLife();
                            this.hudManager.updateLives(remainingLives);

                            if (remainingLives <= 0) {
                                this.showGameOverScreen();
                            } else {
                                this.showLostLifeMessage(remainingLives);
                            }
                        }
                    });
                }
            });
        });
    }

    showLostLifeMessage(remainingLives) {
        const cam = this.cameras.main;
        const centerX = cam.centerX;
        const centerY = cam.centerY;
        const FONT = '"Press Start 2P", Arial';
        const DEPTH = GC.DEPTH.OVERLAY_TEXT;

        const overlay = this.add.rectangle(centerX, centerY, cam.width, cam.height, 0x000000, 0)
            .setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY);
        this.tweens.add({ targets: overlay, fillAlpha: 0.78, duration: 250 });

        cam.shake(220, 0.008);

        const heart = this.add.text(centerX, centerY - 60, '❤️', {
            fontSize: '64px',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH);

        // Heartbeat: pulsa, depois quebra
        this.tweens.add({
            targets: heart,
            scale: { from: 1, to: 1.35 },
            duration: 180,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                heart.setText('💔');
                this.tweens.add({
                    targets: heart,
                    angle: { from: -8, to: 8 },
                    duration: 60,
                    yoyo: true,
                    repeat: 4,
                });

                // Estilhaços
                for (let i = 0; i < 8; i++) {
                    const angle = Phaser.Math.DegToRad(Phaser.Math.Between(-180, 0));
                    const dist = Phaser.Math.Between(60, 120);
                    const piece = this.add.text(centerX, centerY - 60, '❤', {
                        fontSize: '20px',
                        color: '#ff3355',
                    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH);
                    this.tweens.add({
                        targets: piece,
                        x: centerX + Math.cos(angle) * dist,
                        y: centerY - 60 + Math.sin(angle) * dist + 80,
                        angle: Phaser.Math.Between(-360, 360),
                        alpha: 0,
                        scale: { from: 1, to: 0.4 },
                        duration: 700,
                        ease: 'Cubic.easeIn',
                        onComplete: () => piece.destroy()
                    });
                }
            }
        });

        const title = this.add.text(centerX, centerY + 20, '-1 VIDA', {
            fontSize: '22px', fontFamily: FONT, color: '#ff4466',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH).setScale(0);
        this.tweens.add({
            targets: title,
            scale: 1,
            duration: 350,
            delay: 280,
            ease: 'Back.easeOut'
        });

        const subLabel = this.add.text(centerX, centerY + 60, 'VIDAS RESTANTES', {
            fontSize: '9px', fontFamily: FONT, color: '#aaaaaa',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH).setAlpha(0);
        this.tweens.add({ targets: subLabel, alpha: 1, duration: 250, delay: 500 });

        // Vidas: x[N] 🎵 (com transição animada do contador)
        const counterY = centerY + 105;
        const counterText = this.add.text(0, 0, `x${remainingLives + 1}`, {
            fontSize: '20px', fontFamily: FONT, color: '#ffffff',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(DEPTH).setAlpha(0);

        const note = this.add.text(0, 0, '🎵', {
            fontSize: '48px',
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH).setAlpha(0);

        // Posiciona o grupo (multiplicador + nota) centralizado
        const gap = 10;
        const totalWidth = counterText.width + gap + note.width;
        counterText.x = centerX - totalWidth / 2 + counterText.width;
        note.x = counterText.x + gap;
        counterText.y = counterY;
        note.y = counterY;

        // Aparição
        this.tweens.add({
            targets: [counterText, note],
            alpha: 1,
            duration: 250,
            delay: 600,
            ease: 'Back.easeOut',
            onComplete: () => {
                // "-1" subindo do contador
                const minusOne = this.add.text(counterText.x - counterText.width / 2, counterY - 8, '-1', {
                    fontSize: '14px', fontFamily: FONT, color: '#ff4466',
                    stroke: '#000000', strokeThickness: 3
                }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH).setAlpha(0);
                this.tweens.add({
                    targets: minusOne,
                    alpha: { from: 1, to: 0 },
                    y: counterY - 40,
                    duration: 700,
                    ease: 'Cubic.easeOut',
                    onComplete: () => minusOne.destroy()
                });

                // Contador faz "tick down" com pulso e cor vermelha brevemente
                this.tweens.add({
                    targets: counterText,
                    scale: { from: 1, to: 1.4 },
                    duration: 140,
                    yoyo: true,
                    ease: 'Sine.easeInOut',
                    onStart: () => {
                        counterText.setText(`x${remainingLives}`);
                        counterText.setColor('#ff4466');
                    },
                    onComplete: () => counterText.setColor('#ffffff')
                });

                // Nota balança junto, como se "ressoasse"
                this.tweens.add({
                    targets: note,
                    scale: { from: 1, to: 1.25 },
                    duration: 140,
                    yoyo: true,
                    ease: 'Sine.easeInOut'
                });
            }
        });

        const elements = [overlay, heart, title, subLabel, counterText, note];

        const dismiss = () => {
            if (!overlay.active) return;
            this.tweens.add({
                targets: elements,
                alpha: 0,
                duration: 250,
                onComplete: () => {
                    elements.forEach(el => el.active && el.destroy());
                    this._returnToWorldMap();
                }
            });
        };

        // Pular com ENTER ou SPACE (após meio segundo, evita pular acidentalmente)
        const enableSkip = this.time.delayedCall(500, () => {
            const enter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
            const space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            const skip = () => dismiss();
            enter.once('down', skip);
            space.once('down', skip);
            this.keyListeners.push(enter, space);
        });

        this.time.delayedCall(5000, dismiss);
    }

    _returnToWorldMap() {
        const levelConfig = GameData.LEVELS[this.currentLevel];
        const worldId = levelConfig?.world || 1;
        GameData.saveMapPosition(worldId, this.currentLevel, 'lostLife:backToMap');
        this.scene.start('WorldMapScene', {});
    }

    showGameOverScreen() {
        this.currentView = 'gameover';

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        const overlay = this.add.rectangle(centerX, centerY, 640, 400, 0x000000, 0.9)
            .setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY);
        this.overlayElements.push(overlay);

        const title = this.add.text(centerX, centerY - 50, 'GAME OVER', {
            fontSize: '40px', fontFamily: 'Arial', color: '#ff0000',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
        this.overlayElements.push(title);

        const currentWorld = GameData.getCurrentWorld ? GameData.getCurrentWorld() : null;
        const worldName = currentWorld ? currentWorld.name : '';
        const desc = this.add.text(centerX, centerY, `Progresso do ${worldName} perdido`, {
            fontSize: '16px', fontFamily: 'Arial', color: '#aaaaaa',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
        this.overlayElements.push(desc);

        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const continueLabel = isMobile ? 'Pressione O' : 'ENTER';
        const hint = this.add.text(centerX, centerY + 50, `${continueLabel} para voltar ao mapa`, {
            fontSize: '14px', fontFamily: 'Arial', color: '#ffffff',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
        this.overlayElements.push(hint);

        const handleGameOver = () => {
            const world = GameData.getCurrentWorld ? GameData.getCurrentWorld() : null;
            if (world) {
                GameData.resetWorldProgress(world.id);
            }
            this.scene.start('WorldMapScene');
        };

        this.time.delayedCall(1500, () => {
            this.input.keyboard.once('keydown-ENTER', handleGameOver);
            this.input.keyboard.once('keydown-SPACE', handleGameOver);

            this.time.addEvent({
                delay: 100,
                loop: true,
                callback: () => {
                    if (this.virtualControls.jumpJustPressed) {
                        this.virtualControls.jumpJustPressed = false;
                        handleGameOver();
                    }
                }
            });
        });
    }

    // ==================== CLEANUP ====================

    shutdown() {
        MusicManager.stop();
        this.physics.world.gravity.y = 800;
        GameData.levelFeatureOverrides = null;

        if (this._oscillationTimer) {
            this._oscillationTimer.remove(false);
            this._oscillationTimer = null;
        }
        if (this._oscillationFadeTween) {
            this._oscillationFadeTween.stop();
            this._oscillationFadeTween = null;
        }
        if (this.cameras && this.cameras.main) {
            this.cameras.main.removePostPipeline('VerticalOscillationPipeline');
        }

        this.keyListeners.forEach(key => {
            if (key && key.destroy) key.destroy();
        });
        this.pauseMenu.clearListeners();
        if (this.effectsManager) this.effectsManager.destroy();
        if (this.playerController) this.playerController.destroy();
    }
}
