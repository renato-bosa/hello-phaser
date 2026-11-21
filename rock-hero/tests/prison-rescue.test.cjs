const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function rescueScene() {
    const saved = [], sounds = [], timers = [];
    const context = vm.createContext({ console, Phaser: { Scene: class {} },
        SoundManager: { play: name => sounds.push(name) },
        GameData: {
            isFeatureEnabled: () => true,
            markLevelComplete: level => saved.push(level),
            saveRecord: () => ({ isRecord: false })
        }
    });
    context.window = context;
    for (const file of ['constants.js', 'managers/PlayerController.js',
        'managers/VictoryScreen.js', 'scenes/GameScene.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
    }
    const { GameScene, PlayerController, VictoryScreen } = vm.runInContext(
        '({ GameScene, PlayerController, VictoryScreen })', context);
    const scene = new GameScene();
    Object.assign(scene, {
        currentView: 'gameplay', currentLevel: 25, hasWon: false,
        hasPrisonKey: true, prisonState: 'locked', totalStars: 0, starsCollected: 0,
        elapsedTime: 12000, playerName: 'Teste',
        events: { once() {} },
        time: { now: 0, delayedCall(delay, callback) { timers.push({ at: this.now + delay, callback }); } },
        tweens: { add() {} },
        anims: { exists: () => true },
        cameras: { main: { shake() {} } },
        effectsManager: { createVictoryBurst() {} },
        hudManager: { updateHeldItems() {}, updateHearts() {} },
        virtualControls: { right: true, jumpJustPressed: true, backJustPressed: true },
        cursors: { right: { isDown: true } }, spaceKey: { isDown: true }
    });
    const player = {
        body: { enable: true, velocity: { x: 260, y: -100 } }, alpha: 0.3,
        setVelocity(x, y) { this.body.velocity = { x, y }; },
        clearTint() {}, setAlpha(alpha) { this.alpha = alpha; },
        anims: { play() {} }
    };
    scene.playerController = new PlayerController(scene);
    scene.playerController.player = player;
    scene.playerController.hearts = 1;
    scene.prison = {
        active: true, x: 200, y: 100, body: { enable: true },
        anims: { stop() {}, play() {} }, setTexture() {}, setFrame() {}
    };
    scene.victoryScreen = new VictoryScreen(scene);
    let overlays = 0, warnings = 0;
    scene.victoryScreen._showVictoryOverlay = () => overlays++;
    scene.victoryScreen._showStarsWarning = () => warnings++;
    function advanceTo(now) {
        timers.sort((a, b) => a.at - b.at);
        while (timers.length && timers[0].at <= now) {
            const timer = timers.shift();
            scene.time.now = timer.at;
            timer.callback();
            timers.sort((a, b) => a.at - b.at);
        }
        scene.time.now = now;
    }
    return { scene, player, saved, sounds, timers, advanceTo,
        overlays: () => overlays, warnings: () => warnings };
}

test('contato com a prisão bloqueia movimento e dano até concluir o resgate, mesmo com um coração', () => {
    const { scene, player, saved, sounds, advanceTo, overlays } = rescueScene();
    const pc = scene.playerController;
    pc.speedBoostActive = true;
    let boostCancelled = false;
    pc.speedBoostTimer = { remove: () => { boostCancelled = true; } };
    scene.tryOpenPrison();
    assert.equal(scene.currentView, 'rescuing');
    assert.equal(scene.prisonState, 'opening');
    assert.equal(player.body.enable, false);
    assert.deepEqual(player.body.velocity, { x: 0, y: 0 });
    assert.equal(player.alpha, 1);
    assert.equal(boostCancelled, true);

    // Teclado, toque e pausa continuam pressionados durante toda a animação.
    pc.update = () => assert.fail('O controle do jogador não deve rodar durante o resgate');
    scene.pauseMenu = { show: () => assert.fail('Não deve pausar o resgate') };
    const verifyProtected = () => {
        scene.update(scene.time.now, 16);
        scene.handleTileCollision(player, { properties: { jump_back_to_checkpoint: true } });
        pc.takeDamage(); // Inimigos/projéteis usam o mesmo ponto de entrada.
        scene.onPlayerDied(); // Callback tardio não pode iniciar a tela de morte.
        assert.equal(pc.hearts, 1);
        assert.equal(pc.isRespawning, false);
        assert.equal(player.body.enable, false);
        assert.deepEqual(player.body.velocity, { x: 0, y: 0 });
    };
    verifyProtected();
    scene.tryOpenPrison(); // Contato repetido não agenda um segundo resgate.
    advanceTo(1999);
    assert.equal(scene.prisonState, 'opening');
    assert.deepEqual(saved, []);
    advanceTo(2000);
    assert.equal(scene.prisonState, 'open');
    verifyProtected();
    advanceTo(2799);
    assert.equal(scene.hasWon, false);
    advanceTo(2800);
    assert.equal(scene.hasWon, true);
    assert.equal(scene.currentView, 'victory');
    verifyProtected();
    advanceTo(100000);
    verifyProtected();
    assert.deepEqual(saved, [scene.currentLevel]);
    assert.equal(overlays(), 1);
    assert.equal(sounds.includes('damage'), false);
    assert.equal(sounds.includes('death'), false);
});

test('sem a chave não começa o resgate e o dano continua funcionando', () => {
    const { scene, player, timers, sounds } = rescueScene();
    scene.hasPrisonKey = false;
    scene.playerController.hearts = 2;
    scene.playerController.respawnOnDamage = false;
    scene.tryOpenPrison();
    assert.equal(scene.currentView, 'gameplay');
    assert.equal(player.body.enable, true);
    assert.equal(timers.length, 0);
    scene.playerController.takeDamage();
    assert.equal(scene.playerController.hearts, 1);
    assert.equal(sounds.includes('damage'), true);
});

test('morte ou respawn anteriores ao contato impedem o resgate e a vitória', () => {
    for (const state of [{ hearts: 0 }, { isRespawning: true }]) {
        const { scene, timers, saved } = rescueScene();
        Object.assign(scene.playerController, state);
        scene.tryOpenPrison();
        scene.victoryScreen.reachGoal();
        assert.equal(scene.prisonState, 'locked');
        assert.equal(scene.hasWon, false);
        assert.equal(timers.length, 0);
        assert.deepEqual(saved, []);
    }
});

test('objetivos pendentes não prendem o jogador em um resgate que não pode terminar', () => {
    const { scene, player, warnings } = rescueScene();
    scene.totalStars = 1;
    scene.tryOpenPrison();
    assert.equal(warnings(), 1);
    assert.equal(scene.prisonState, 'locked');
    assert.equal(player.body.enable, true);
    assert.equal(scene.currentView, 'gameplay');
    scene.starsCollected = 1;
    let missingFamily = true, familyWarnings = 0;
    scene.familyManager = {
        hasMissingRescues: () => missingFamily,
        warnMissingRescue: () => familyWarnings++
    };
    scene.tryOpenPrison();
    assert.equal(familyWarnings, 1);
    assert.equal(scene.currentView, 'gameplay');
    missingFamily = false;
    scene.tryOpenPrison();
    assert.equal(scene.currentView, 'rescuing');
    assert.equal(player.body.enable, false);
});
