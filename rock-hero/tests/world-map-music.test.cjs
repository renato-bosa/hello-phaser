const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

// Emissor com o argumento de contexto usado pelo Phaser.
class Events {
    listeners = [];
    once(name, callback, context) {
        this.listeners.push({ name, callback, context });
    }
    off(name, callback, context) {
        this.listeners = this.listeners.filter(item => item.name !== name ||
            (callback && (item.callback !== callback || item.context !== context)));
    }
    emit(name) {
        for (const item of this.listeners.filter(item => item.name === name)) {
            this.off(name, item.callback, item.context);
            item.callback.call(item.context);
        }
    }
}

function timing() {
    const timers = [], tweens = [];
    return {
        timers, tweens,
        time: { delayedCall(delay, callback) {
            const timer = { delay, callback, removed: false, remove() { this.removed = true; } };
            timers.push(timer);
            return timer;
        } },
        tweensManager: {
            add(config) { tweens.push(config); },
            killTweensOf(sound) {
                for (const tween of tweens) if (tween.targets === sound) tween.removed = true;
            }
        },
        shutdown() {
            timers.forEach(timer => timer.remove());
            tweens.forEach(tween => { tween.removed = true; });
        }
    };
}

function mapMusic({ loaded = true, locked = false, enabled = true } = {}) {
    const cache = new Set(loaded ? ['music', 'level-music'] : []);
    const sounds = [], destinations = [];
    const soundManager = new Events();
    soundManager.locked = locked;
    soundManager.add = (key, config) => {
        const sound = Object.assign(new Events(), {
            key, volume: config.volume, duration: 120, seek: 0, playCalls: 0,
            play() {
                this.playCalls++;
                if (soundManager.locked) return false;
                this.isPlaying = true;
                this.seek = 0;
                return true;
            },
            stop() { this.isPlaying = false; this.seek = 0; },
            destroy() { this.destroyed = true; }
        });
        sounds.push(sound);
        return sound;
    };
    const worlds = [1, 2, 3].map(id => ({ id, name: `Mundo ${id}`, levels: [id * 5] }));
    let savedPosition = { worldId: 1, levelIndex: 5 };
    const context = vm.createContext({
        console: { log() {}, warn() {}, info() {} }, Phaser: { Scene: class {} },
        GameConfig: { MUSIC_TRACKS: [], MUSIC: {
            ui: { default: 'music' }, gameplay: { default: 'level-music' }
        } },
        GameData: {
            WORLDS: worlds, loadMapPosition: () => savedPosition,
            saveMapPosition(worldId, levelIndex) { savedPosition = { worldId, levelIndex }; },
            loadSelectedCharacter() {}, getWorldLevelsWithStatus: () => [],
            loadPlayerName: () => 'Teste'
        },
        SoundManager: { play() {} }
    });
    context.window = context;
    for (const file of ['managers/MusicManager.js', 'scenes/WorldMapScene.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
    }
    const { MusicManager: music, WorldMapScene } = context;
    music.enabled = enabled;
    const persistent = timing(), local = timing();
    music._loaderScene = { time: persistent.time, tweens: persistent.tweensManager };
    const map = new WorldMapScene();
    let active = true;
    const display = () => ({
        setOrigin() { return this; }, setDepth() { return this; }, setAlpha() { return this; }
    });
    Object.assign(map, {
        events: new Events(), sys: { isActive: () => active }, sound: soundManager,
        cache: { audio: { exists: key => cache.has(key) } },
        time: local.time, tweens: local.tweensManager,
        cameras: { main: { width: 640, height: 352 } },
        add: { rectangle: display, text: display }
    });
    // Apenas os desenhos e controles são dispensados; create e a transição são reais.
    for (const method of ['applyWorldMapResolution', 'restoreGameResolution',
        'createBackground', 'createTitle', 'createPaths', 'createLevelNodes',
        'createWorldPortals', 'createPlayerCursor', 'createUI', 'createCharacterButton',
        'createRankingButton', 'createInfoPanel', 'setupControls', 'updateInfoPanel']) {
        map[method] = () => {};
    }
    function shutdown() {
        active = false;
        map.events.emit('shutdown');
        local.shutdown();
    }
    function enterMap() {
        map.init({});
        map.create();
        active = true;
    }
    map.scene = {
        restart: shutdown,
        start(name, data) { destinations.push({ name, data }); shutdown(); }
    };
    function changeWorld(id = 2) {
        map.transitionToWorld(worlds.find(world => world.id === id));
        const transition = local.timers.at(-1);
        assert.equal(transition.delay, 800);
        transition.callback();
    }
    enterMap();
    return { music, map, cache, sounds, soundManager, persistent, local,
        destinations, enterMap, changeWorld };
}

test('trocas de mundo preservam o mesmo áudio, sua posição e o próximo crossfade', () => {
    const { music, map, sounds, persistent, enterMap, changeWorld } = mapMusic();
    const sound = music.currentSound, timer = music._scheduledCrossfadeTimer;
    sound.seek = 42.5;
    for (const worldId of [2, 3, 2, 1]) {
        changeWorld(worldId);
        assert.equal(sound.isPlaying, true);
        assert.equal(timer.removed, false);
        enterMap();
        assert.equal(map.currentWorldId, worldId);
        assert.equal(music.currentSound, sound);
        assert.equal(sound.seek, 42.5);
        assert.equal(sound.playCalls, 1);
        assert.equal(music._scheduledCrossfadeTimer, timer);
        const listeners = map.events.listeners.filter(item => item.context === music);
        assert.equal(listeners.filter(item => item.name === 'shutdown').length, 1);
        assert.equal(listeners.filter(item => item.name === 'destroy').length, 1);
    }
    assert.equal(sounds.length, 1);
    assert.equal(persistent.timers.length, 1);
    changeWorld();
    map.events.emit('destroy'); // Destruição definitiva, mesmo no meio da troca.
    assert.equal(sound.destroyed, true);
    assert.equal(timer.removed, true);
});

test('uma troca durante o crossfade preserva as duas faixas e conclui os fades', () => {
    const { music, persistent, enterMap, changeWorld } = mapMusic();
    const oldSound = music.currentSound;
    music._scheduledCrossfadeTimer.callback();
    const newSound = music.currentSound;
    newSound.seek = 1;
    assert.notEqual(newSound, oldSound);
    changeWorld();
    enterMap();
    assert.equal(oldSound.isPlaying, true);
    assert.equal(newSound.isPlaying, true);
    assert.equal(newSound.seek, 1);
    assert.equal(persistent.tweens.length, 2);
    for (const tween of persistent.tweens) {
        assert.equal(tween.removed, undefined);
        tween.targets.volume = tween.volume;
        if (tween.onComplete) tween.onComplete();
    }
    assert.equal(oldSound.destroyed, true);
    assert.equal(newSound.volume, music.volume);
    assert.equal(music._activeSounds.length, 1);
});

test('download concluído durante a troca começa a tocar ao exibir o novo mapa', () => {
    const { music, cache, sounds, enterMap, changeWorld } = mapMusic({ loaded: false });
    changeWorld();
    cache.add('music');
    music._onTrackLoaded('music', 'audio');
    assert.equal(music.currentSound, null);
    enterMap();
    assert.equal(music.currentSound.isPlaying, true);
    assert.equal(sounds.length, 1);
});

test('áudio aguardando interação continua aguardando sem duplicar o desbloqueio', () => {
    const { music, soundManager, enterMap, changeWorld } = mapMusic({ locked: true });
    const sound = music.currentSound;
    changeWorld();
    enterMap();
    assert.equal(music.currentSound, sound);
    assert.equal(sound.playCalls, 1);
    assert.equal(soundManager.listeners.length, 1);
    soundManager.locked = false;
    soundManager.emit('unlocked');
    assert.equal(sound.isPlaying, true);
    assert.equal(sound.playCalls, 2);
    assert.ok(music._scheduledCrossfadeTimer);
});

test('entrar na fase encerra a música do mapa e limpa seus timers e fades', () => {
    const { music, map, sounds, persistent, destinations, enterMap, changeWorld } = mapMusic();
    changeWorld();
    enterMap();
    music._scheduledCrossfadeTimer.callback();
    const nextTimer = music._scheduledCrossfadeTimer;
    map.allNodes = [{ type: 'level', index: 10, isUnlocked: true }];
    map.currentNodeIndex = 0;
    map.selectNode();
    assert.equal(destinations[0].name, 'GameScene');
    assert.equal(music.currentSound, null);
    assert.ok(sounds.every(sound => sound.destroyed));
    assert.equal(nextTimer.removed, true);
    assert.ok(persistent.tweens.every(tween => tween.removed));
    music.startGameplay(map, 10);
    assert.equal(music.currentKey, 'level-music');
    assert.equal(music.currentSound.isPlaying, true);
});

test('trocar mundos respeita música desligada e permite religá-la no novo mapa', () => {
    const { music, sounds, enterMap, changeWorld } = mapMusic({ enabled: false });
    changeWorld();
    enterMap();
    assert.equal(sounds.length, 0);
    music.setEnabled(true);
    assert.equal(music.currentSound.isPlaying, true);
    assert.equal(sounds.length, 1);
});
