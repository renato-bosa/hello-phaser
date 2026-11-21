const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function navigation(worldId = 2) {
    let slot;
    const controls = {}, destinations = [], writes = [], timers = [];
    let now = 0, restarts = 0;
    const context = vm.createContext({ console, Phaser: { Scene: class {} },
        SaveManager: { getSlot: () => slot, saveSlot: (_, value) => { slot = value; } },
        MapDebug: { enabled: false, log() {}, warn() {} },
        SoundManager: { play() {} },
        MusicManager: { startUi() {}, restartUiScene() { restarts++; } }
    });
    context.window = context;
    for (const file of ['core/GameConfig.js', 'data/ProgressTracker.js', 'scenes/WorldMapScene.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
    }
    const { GameConfig: config, ProgressTracker: progress, WorldMapScene } = context;
    slot = {
        completedLevels: config.WORLDS.flatMap(world => world.levels),
        completedWorlds: config.WORLDS.map(world => world.id), bestTimes: {},
        mapPosition: { worldId, levelIndex: config.WORLDS.find(world => world.id === worldId).levels[0] }
    };
    context.GameData = {
        WORLDS: config.WORLDS, state: { selectedCharacter: 'vocalista' },
        loadMapPosition: () => progress.loadMapPosition(1),
        saveMapPosition(world, level, source) {
            writes.push({ world, level });
            progress.saveMapPosition(1, world, level, source);
        },
        isWorldUnlocked: id => progress.isWorldUnlocked(1, id),
        getWorldLevelsWithStatus: id => progress.getWorldLevelsWithStatus(1, id),
        getVirtualControls: () => controls, loadPlayerName: () => 'Teste',
        loadSelectedCharacter() {}, getCharacterShowcaseState: () => 'idle',
        getCharacterTextureKey: () => 'vocalista'
    };
    function display(x = 0, y = 0) {
        const object = Object.assign(new EventEmitter(), { x, y });
        let proxy;
        proxy = new Proxy(object, { get(target, key) {
            return key in target ? target[key] : () => proxy;
        } });
        return proxy;
    }
    const map = new WorldMapScene();
    Object.assign(map, {
        events: new EventEmitter(), input: { keyboard: new EventEmitter() },
        cameras: { main: { width: 640, height: 352 } }, textures: { exists: () => false },
        add: new Proxy({}, { get: () => display }), tweens: { add() {}, killTweensOf() {} },
        time: {
            get now() { return now; },
            delayedCall(delay, callback) { timers.push({ at: now + delay, callback }); }
        },
        scene: { start(name, data) { destinations.push({ name, data }); } }
    });
    // Mantém os controles, nós, portais e cursor reais; dispensa painéis decorativos.
    for (const method of ['applyWorldMapResolution', 'restoreGameResolution', 'createBackground',
        'createTitle', 'createPaths', 'drawPath', 'createUI', 'createCharacterButton',
        'createRankingButton', 'createInfoPanel', 'updateInfoPanel']) map[method] = () => {};
    function enterMap() {
        map.input.keyboard.removeAllListeners();
        map.events.removeAllListeners();
        map.init({});
        map.create();
    }
    function advanceTo(time) {
        while (timers.length && timers[0].at <= time) {
            const timer = timers.shift();
            now = timer.at;
            timer.callback();
        }
        now = time;
    }
    function selectPortal(targetId) {
        map.currentNodeIndex = map.allNodes.findIndex(node => node.targetWorld?.id === targetId);
        assert.notEqual(map.currentNodeIndex, -1);
        map.selectNode();
    }
    enterMap();
    return { map, config, controls, destinations, writes, timers, enterMap,
        advanceTo, selectPortal, restarts: () => restarts };
}

test('teclado e cartões não mudam o destino nem duplicam a troca durante a transição', () => {
    const h = navigation();
    const { map } = h;
    const character = map._createCardButton(0, 0, 10, 10, 0, 0, () => map.openCharacterSelect());
    const ranking = map._createCardButton(0, 0, 10, 10, 0, 0, () => map.showRanking());
    h.selectPortal(3);
    const selected = map.currentNodeIndex;
    for (let attempt = 0; attempt < 3; attempt++) {
        for (const key of ['ENTER', 'SPACE', 'LEFT', 'RIGHT', 'P', 'T', 'ESC']) {
            map.input.keyboard.emit(`keydown-${key}`);
        }
        character.bg.emit('pointerdown');
        ranking.bg.emit('pointerdown');
        map.transitionToWorld(h.config.WORLDS[0]);
    }
    assert.equal(map.currentView, 'transition');
    assert.equal(map.currentNodeIndex, selected);
    assert.equal(h.timers.length, 1);
    assert.equal(h.destinations.length, 0);
    h.advanceTo(799);
    assert.equal(h.writes.length, 0);
    h.advanceTo(800);
    assert.equal(h.restarts(), 1);
    assert.deepEqual(h.writes, [{ world: 3, level: 10 }]);
    h.enterMap();
    map.input.keyboard.emit('keydown-RIGHT');
    assert.equal(map.cursorLevelIndex, 11);
    map.input.keyboard.emit('keydown-ENTER');
    assert.equal(h.destinations[0].name, 'GameScene');
    assert.equal(h.destinations[0].data.level, 11);
});

test('toques durante a transição e o carregamento são descartados, inclusive O e X simultâneos', () => {
    const h = navigation();
    const { map, controls } = h;
    map.currentNodeIndex = 0; // Portal para o mundo anterior.
    Object.assign(controls, { jumpJustPressed: true, backJustPressed: true, right: true });
    map.update(1000);
    assert.equal(map.currentView, 'transition');
    assert.equal(map.currentNodeIndex, 0);
    assert.equal(h.destinations.length, 0);
    controls.jumpJustPressed = controls.backJustPressed = true;
    map.update(1300);
    assert.equal(controls.jumpJustPressed, false);
    assert.equal(controls.backJustPressed, false);
    assert.equal(h.timers.length, 1);
    h.advanceTo(800);
    controls.jumpJustPressed = controls.backJustPressed = true; // Durante o preload.
    controls.right = false;
    h.enterMap();
    map.update(2000);
    assert.equal(map.currentView, 'map');
    assert.equal(h.destinations.length, 0);
    controls.backJustPressed = true;
    map.update(2100);
    assert.equal(h.destinations[0].name, 'MenuScene');
});

test('todos os portais chegam à primeira fase ao avançar e à última ao voltar', () => {
    for (let origin = 1; origin <= 5; origin++) {
        for (const target of [origin - 1, origin + 1].filter(id => id >= 1 && id <= 5)) {
            const h = navigation(origin);
            const world = h.config.WORLDS.find(item => item.id === target);
            const expected = world.levels[target < origin ? world.levels.length - 1 : 0];
            h.selectPortal(target);
            h.advanceTo(800);
            h.enterMap();
            assert.equal(h.map.currentWorldId, target);
            assert.equal(h.map.cursorLevelIndex, expected);
            assert.equal(h.map.allNodes[h.map.currentNodeIndex].index, expected);
            assert.equal(h.map.currentView, 'map');
        }
    }
});

test('portal bloqueado não inicia transição e ESC continua fechando os tempos antes de sair', () => {
    const h = navigation();
    const { map } = h;
    map.currentNodeIndex = map.allNodes.length - 1;
    map.allNodes[map.currentNodeIndex].isUnlocked = false;
    map.selectNode();
    assert.equal(map.currentView, 'map');
    assert.equal(h.timers.length, 0);
    map.currentView = 'ranking';
    map.rankingWorldElements = [];
    map.input.keyboard.emit('keydown-ESC');
    assert.equal(map.currentView, 'map');
    assert.equal(h.destinations.length, 0);
    map.input.keyboard.emit('keydown-ESC');
    assert.equal(h.destinations[0].name, 'MenuScene');
});
