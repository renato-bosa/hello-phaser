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
        GameData.state.gameSceneRef = this;
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
                    this.load.image(ts.name, GameData.assetUrl(imagePath));
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

        this.playerController = new PlayerController(this);
        this.enemyManager = new EnemyManager(this);
        this.effectsManager = new EffectsManager(this);
        this.hudManager = new HUDManager(this);
        this.pauseMenu = new PauseMenu(this);
        this.victoryScreen = new VictoryScreen(this);

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

            if (type === 'player_spawn' || type === 'player-spawn' ||
                tilesetName.includes('still-hero') || tilesetName.includes('still hero')) {
                this.playerSpawn = { x: obj.x + 16, y: obj.y - 16 };
            }
            else if (type === 'goal' ||
                     tilesetName.includes('green-flag') || tilesetName.includes('green flag')) {
                this.goalPosition = { x: obj.x + 16, y: obj.y - 16 };
            }
            else if (type === 'checkpoint' ||
                     tilesetName.includes('yellow-flag') || tilesetName.includes('yellow flag')) {
                this.checkpointPositions.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            else if (type === 'trampoline' || tilesetName.includes('trampoline')) {
                trampolines.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            else if (type === 'star' || tilesetName.includes('star') || tilesetName.includes('estrela')) {
                stars.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            else if (type === 'enemy' || type === 'sapo' ||
                     tilesetName.includes('sapo') || tilesetName.includes('frog')) {
                const isSapoVerde = tilesetName.includes('sapo-verde') || tilesetName.includes('verde');
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
                speedBoosts.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            else if (type === '1up' || type === 'extra_life' ||
                     tilesetName.includes('1up') || tilesetName.includes('nota') ||
                     tilesetName.includes('extra-life') || tilesetName.includes('extra_life')) {
                extraLives.push({ x: obj.x + 16, y: obj.y - 16 });
            }
            else if (tilesetName.includes('plataforma-deslisante') || tilesetName.includes('plataforma-deslizante') ||
                     tilesetName.includes('plataforma-movel')) {
                const objProps = {};
                if (obj.properties) {
                    obj.properties.forEach(p => { objProps[p.name] = p.value; });
                }
                movingPlatforms.push({
                    x: obj.x + 16,
                    y: obj.y - 16,
                    textureKey: tilesetName,
                    verticalBlocks: objProps['vertical-move_downward_in_blocks'] || 0,
                    horizontalBlocks: objProps['horizontal-move_right_in_blocks'] || 0,
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
        this.createMovingPlatforms(movingPlatforms);
        this.createWaterZones(map);
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

    createGoal() {
        this.goal = this.physics.add.staticSprite(this.goalPosition.x, this.goalPosition.y, 'green-flag');
        this.goal.body.setSize(GC.GOAL.BODY_WIDTH, GC.GOAL.BODY_HEIGHT);
        this.goal.body.setOffset(GC.GOAL.BODY_OFFSET_X, GC.GOAL.BODY_OFFSET_Y);
    }

    createCheckpoints() {
        this.checkpoints = [];
        this.checkpointPositions.forEach(cp => {
            const flag = this.physics.add.staticSprite(cp.x, cp.y, 'yellow-flag');
            flag.checkpointPos = cp;
            flag.activated = false;
            this.checkpoints.push(flag);
        });
    }

    createTrampolines(positions) {
        this.trampolines = this.physics.add.staticGroup();
        positions.forEach(t => {
            const trampoline = this.physics.add.staticSprite(t.x, t.y, 'trampoline');
            trampoline.body.setSize(GC.TRAMPOLINE.BODY_WIDTH, GC.TRAMPOLINE.BODY_HEIGHT);
            trampoline.body.setOffset(0, GC.TRAMPOLINE.BODY_OFFSET_Y);
            this.trampolines.add(trampoline);
        });
    }

    createStars(positions) {
        this.stars = this.physics.add.group();
        positions.forEach(s => {
            const star = this.stars.create(s.x, s.y, 'star');
            star.body.allowGravity = false;
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
            this.speedBoosts.add(boost);
        });
    }

    createExtraLives(positions) {
        this.extraLives = this.physics.add.staticGroup();
        positions.forEach(pos => {
            const item = this.extraLives.create(pos.x, pos.y, 'star', 0);
            item.setTint(0x00ff88);
            item.setScale(0.9);
        });
    }

    collectExtraLife(player, item) {
        item.disableBody(true, true);
        SoundManager.play('collectStar');
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
            platform.body.setSize(32, 6);
            platform.body.setOffset(0, 26);
            platform.body.checkCollision.down = false;
            platform.body.checkCollision.left = false;
            platform.body.checkCollision.right = false;

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
            }
            if (data.distanceX > 0) {
                platform.body.velocity.x = (data.distanceX / 2) * omega * Math.sin(data.phase) * 1000;
            }
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

        this.cameras.main.startFollow(player, true, 0.1, 0.1);
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
        this.playerController.update(delta);
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
        star.disableBody(true, true);
        this.starsCollected++;
        SoundManager.play('collectStar');
        this.hudManager.updateStarCount(this.starsCollected, this.totalStars);
    }

    // ==================== VIDAS E GAME OVER ====================

    onPlayerDied() {
        const pc = this.playerController;
        pc.isRespawning = true;
        pc.player.body.enable = false;
        pc.player.setTint(GC.RESPAWN.HURT_TINT);

        SoundManager.play('death');

        this.tweens.add({
            targets: pc.player,
            alpha: 0,
            y: pc.player.y - 40,
            duration: 600,
            ease: 'Sine.easeIn',
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

    showLostLifeMessage(remainingLives) {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        const overlay = this.add.rectangle(centerX, centerY, 640, 400, 0x000000, 0.75)
            .setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY);

        const title = this.add.text(centerX, centerY - 30, `💀 -1 VIDA`, {
            fontSize: '28px', fontFamily: 'Arial', color: '#ff4444',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);

        const sub = this.add.text(centerX, centerY + 15, `Vidas restantes: ${remainingLives}`, {
            fontSize: '18px', fontFamily: 'Arial', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);

        this.time.delayedCall(2000, () => {
            overlay.destroy();
            title.destroy();
            sub.destroy();
            this._restartLevel();
        });
    }

    _restartLevel() {
        this.scene.restart({ level: this.currentLevel });
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
        GameData.levelFeatureOverrides = null;

        this.keyListeners.forEach(key => {
            if (key && key.destroy) key.destroy();
        });
        this.pauseMenu.clearListeners();
        if (this.effectsManager) this.effectsManager.destroy();
        if (this.playerController) this.playerController.destroy();
        GameData.state.gameSceneRef = null;
    }
}
