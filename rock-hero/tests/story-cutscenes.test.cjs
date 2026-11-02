const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function contextFor(rescued = []) {
    const context = vm.createContext({ console, Phaser: { Scene: class {} } });
    context.window = context;
    for (const name of ['core/GameConfig.js', 'managers/VictoryScreen.js', 'scenes/WorldCompleteScene.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', name), 'utf8'), context);
    }
    const api = vm.runInContext('({ GameConfig, VictoryScreen, WorldCompleteScene })', context);
    const calls = [];
    context.GameData = {
        BOB_FAMILY: api.GameConfig.BOB_FAMILY,
        WORLDS: api.GameConfig.WORLDS,
        getRescuedFamily: () => rescued,
        markWorldComplete: id => calls.push(['complete', id]),
        unlockCharacter: id => calls.push(['unlock', id]),
        saveMapPosition: (world, level) => calls.push(['position', world, level])
    };
    return { ...api, calls };
}

function transition(worldId, rescued = []) {
    const { GameConfig, VictoryScreen } = contextFor(rescued);
    let destination;
    const scene = { playerName: 'Teste', events: { once() {} },
        scene: { start: (name, data) => { destination = { name, data }; } } };
    const victory = new VictoryScreen(scene);
    victory._buildPhaseCompletePanel = () => {};
    victory._bindContinueInput = callback => callback();
    victory._showWorldCompleteTransition(320, 176, 1234, '', '', GameConfig.WORLDS.find(w => w.id === worldId), 'ENTER');
    return destination;
}

test('mundos 1 a 4 exibem a narrativa antes da recompensa e preservam o destino', () => {
    for (const world of [1, 2, 3, 4]) {
        const result = transition(world);
        assert.equal(result.name, 'CutsceneScene');
        assert.equal(result.data.cutsceneId, `world${world}Complete`);
        assert.equal(result.data.next.scene, 'WorldCompleteScene');
        assert.equal(result.data.next.data.world.id, world);
    }
});

test('o final da volta para casa exige todos os familiares salvos', () => {
    const missing = transition(5, ['brother-1', 'brother-2', 'little-brother']);
    assert.equal(missing.name, 'WorldCompleteScene');
    assert.equal(missing.data.endingShown, false);
    const complete = transition(5, ['brother-1', 'brother-2', 'sister', 'little-brother']);
    assert.equal(complete.name, 'CutsceneScene');
    assert.equal(complete.data.cutsceneId, 'world5Complete');
    assert.equal(complete.data.next.data.endingShown, true);
});

test('a recompensa do mundo 4 libera o mundo 5 sem desbloquear um personagem fictício', () => {
    const { GameConfig, WorldCompleteScene, calls } = contextFor();
    const scene = new WorldCompleteScene();
    scene.init({ world: GameConfig.WORLDS.find(w => w.id === 4) });
    let destination;
    scene.scene = { start: (name, data) => { destination = { name, data }; } };
    scene.continue();
    assert.equal(scene.isPortalWorld, true);
    assert.deepEqual(calls, [['complete', 4], ['position', 5, 22]]);
    assert.equal(destination.name, 'CharacterSelectScene');
    assert.equal(destination.data.returnData.worldId, 5);
});

test('as três sequências têm seus quadros locais, mantendo as quatro cenas originais do resgate', () => {
    const { GameConfig } = contextFor();
    for (const [id, length] of [['world3Complete', 7], ['world4Complete', 5], ['world5Complete', 6]]) {
        const config = GameConfig.CUTSCENES[id];
        assert.equal(config.frames.length, length);
        config.frames.forEach(frame => assert.ok(fs.existsSync(path.join(root, frame.file)), frame.file));
    }
    GameConfig.CUTSCENES.world3Complete.frames.slice(0, 4).forEach((frame, index) => {
        assert.ok(frame.file.endsWith(`cut-scene4-${index + 1}-de-5.png`));
        assert.equal(frame.updateCounter, true);
    });
});
