const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));

function gameContext() {
    const storage = new Map();
    const context = vm.createContext({ console, GC: { LIVES: { INITIAL: 5 } },
        SoundManager: { play() {} }, localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, String(value))
        } });
    context.window = context;
    for (const file of ['core/GameConfig.js', 'data/SaveManager.js', 'data/ProgressTracker.js',
        'managers/BobFamilyManager.js', 'managers/VictoryScreen.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
    }
    const api = vm.runInContext('({ GameConfig, SaveManager, ProgressTracker, BobFamilyManager, VictoryScreen })', context);
    api.SaveManager.saveSlot(1, api.SaveManager.createEmptySlot(1));
    context.GameData = {
        BOB_FAMILY: api.GameConfig.BOB_FAMILY,
        getRescuedFamily: () => api.ProgressTracker.getRescuedFamily(1),
        markLevelComplete: (level, ids) => api.ProgressTracker.markLevelComplete(1, level, ids),
        saveRecord: () => ({ isRecord: false })
    };
    return api;
}

test('resgate só é salvo junto da conclusão, depois de cumprir também as estrelas', () => {
    const { BobFamilyManager, VictoryScreen, SaveManager } = gameContext();
    const scene = { events: { once() {}, off() {} }, currentLevel: 22, currentView: 'gameplay',
        totalStars: 2, starsCollected: 0, elapsedTime: 1234,
        playerController: { hearts: 3, player: { setVelocity() {}, anims: { play() {} } } },
        hudManager: { updateFamilyDisplay() {} } };
    const family = scene.familyManager = new BobFamilyManager(scene);
    family.removeDisplay = family.showReunion = family.showMessage = () => {};
    const target = { id: 'brother-1', rescued: false, sprite: { body: { enable: true } } };
    family.targets.push(target);
    const victory = new VictoryScreen(scene);
    let warnings = 0;
    family.warnMissingRescue = victory._showStarsWarning = () => warnings++;
    victory._celebrate = () => {};
    victory.reachGoal();
    assert.equal(warnings, 1);
    assert.deepEqual(plain(SaveManager.getSlot(1).completedLevels), []);
    family.rescue(target);
    family.rescue(target);
    assert.deepEqual(plain(family.getPendingIds()), ['brother-1']);
    assert.equal(target.sprite.body.enable, false);
    assert.deepEqual(plain(SaveManager.getSlot(1).rescuedFamily), []);
    victory.reachGoal();
    assert.equal(warnings, 2);
    assert.deepEqual(plain(SaveManager.getSlot(1).rescuedFamily), []);
    scene.starsCollected = 2;
    victory.reachGoal();
    assert.deepEqual(plain(SaveManager.getSlot(1).completedLevels), [22]);
    assert.deepEqual(plain(SaveManager.getSlot(1).rescuedFamily), ['brother-1']);
    assert.deepEqual(plain(SaveManager.getSlot(1).unlockedCharacters), ['vocalista']);
});

test('sair antes da vitória descarta o resgate e a pausa não permite novos contatos', () => {
    const { BobFamilyManager, SaveManager } = gameContext();
    const scene = { events: { once() {}, off() {} }, currentView: 'pause',
        playerController: { hearts: 3 }, hudManager: { updateFamilyDisplay() {} } };
    const family = new BobFamilyManager(scene);
    family.removeDisplay = family.showReunion = family.showMessage = () => {};
    const target = { id: 'brother-1', rescued: false, sprite: { body: { enable: true } } };
    family.rescue(target);
    assert.equal(family.pending.size, 0);
    scene.currentView = 'gameplay';
    family.rescue(target);
    assert.equal(family.pending.size, 1);
    family.destroy();
    assert.equal(family.pending.size, 0);
    assert.deepEqual(plain(SaveManager.getSlot(1).rescuedFamily), []);
    assert.equal(new BobFamilyManager(scene).saved.size, 0);
});

test('save antigo aceita resgate em fase já completa; repetição não duplica nem afeta outro slot', () => {
    const { ProgressTracker: progress, SaveManager: saves } = gameContext();
    const old = saves.getSlot(1);
    delete old.rescuedFamily;
    old.completedLevels = [22];
    saves.saveSlot(1, old);
    saves.saveSlot(2, saves.createEmptySlot(2));
    assert.deepEqual(plain(progress.getRescuedFamily(1)), []);
    progress.markLevelComplete(1, 22, ['brother-1', 'unknown']);
    progress.markLevelComplete(1, 22, ['brother-1']);
    progress.markLevelComplete(1, 0, ['sister']);
    assert.deepEqual(plain(progress.getRescuedFamily(1)), ['brother-1']);
    assert.deepEqual(plain(progress.getRescuedFamily(2)), []);
    assert.deepEqual(plain(saves.getSlot(1).unlockedCharacters), ['vocalista']);
});

test('reset do mundo e do slot seguem as regras existentes de perda de progresso', () => {
    const { ProgressTracker: progress } = gameContext();
    progress.markLevelComplete(1, 22, ['brother-1']);
    progress.resetWorldProgress(1, 4);
    assert.deepEqual(plain(progress.getRescuedFamily(1)), ['brother-1']);
    progress.resetWorldProgress(1, 5);
    assert.deepEqual(plain(progress.getRescuedFamily(1)), []);
    assert.equal(progress.isLevelComplete(1, 22), false);
    progress.markLevelComplete(1, 22, ['brother-1']);
    progress.clearProgress(1);
    assert.deepEqual(plain(progress.getRescuedFamily(1)), []);
});

test('os quatro mapas têm um resgate por fase na sequência combinada e nenhuma cópia sólida', () => {
    const { GameConfig: config } = gameContext();
    const world = config.WORLDS.find(w => w.id === 5);
    world.levels.forEach((levelIndex, index) => {
        const file = path.join(root, config.LEVELS[levelIndex].file);
        const map = JSON.parse(fs.readFileSync(file));
        const familyTiles = map.tilesets.filter(t => config.BOB_FAMILY.some(f => f.texture === t.name));
        const objects = map.layers.find(l => l.name === 'objects').objects
            .filter(o => familyTiles.some(t => t.firstgid === o.gid));
        assert.equal(objects.length, 1);
        assert.equal(familyTiles.find(t => t.firstgid === objects[0].gid).name, config.BOB_FAMILY[index].texture);
        assert.ok(objects[0].y > 0 && objects[0].y <= map.height * map.tileheight);
        const ids = new Set(map.tilesets.filter(t => familyTiles.includes(t) || t.name === 'octopus').map(t => t.firstgid));
        assert.equal(map.layers.find(l => l.name === 'solids').data.some(gid => ids.has(gid)), false);
        map.tilesets.forEach(t => assert.ok(fs.existsSync(path.resolve(path.dirname(file), t.image))));
    });
});
