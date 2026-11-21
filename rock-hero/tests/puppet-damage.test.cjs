const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function battle() {
    const sounds = [], bursts = [], tweens = [];
    const context = vm.createContext({ console, SoundManager: { play: name => sounds.push(name) } });
    context.window = context;
    for (const file of ['constants.js', 'managers/EnemyManager.js', 'managers/PuppeteerBossManager.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
    }
    const { EnemyManager, PuppeteerBossManager } = vm.runInContext(
        '({ EnemyManager, PuppeteerBossManager })', context);
    const scene = {
        anims: { exists: () => true },
        effectsManager: { createEnemyPopBurst: (...args) => bursts.push(args) },
        tweens: { add: tween => tweens.push(tween) },
        physics: { add: { sprite: (x, y) => ({
            x, y, active: true, scaleX: 1, scaleY: 1,
            anims: { play() {} }, setDepth() {},
            setVelocity(x, y) { this.body.velocity = { x, y }; },
            body: {
                enable: true, setSize() {}, setOffset() {},
                setCollideWorldBounds() {}, setGravityY() {}
            },
            destroy() { this.active = false; }
        }) } }
    };
    const enemies = [];
    scene.enemyManager = new EnemyManager(scene);
    scene.enemyManager.enemies = { add: puppet => enemies.push(puppet), getChildren: () => enemies };
    const boss = new PuppeteerBossManager(scene);
    boss.phase = 'bob';
    const spawn = () => scene.enemyManager.spawnPuppet(100, 100, 40, 120, 70, -400);
    const bullet = () => ({ active: true, destroy() { this.active = false; } });
    return { scene, boss, spawn, bullet, sounds, bursts, tweens };
}

test('primeiro tiro é consumido e o boneco continua vivo; segundo tiro elimina com efeito único', () => {
    const { scene, boss, spawn, bullet, sounds, bursts, tweens } = battle();
    const puppet = spawn();
    const first = bullet(), second = bullet();
    boss._onBulletHitPuppet(first, puppet);
    assert.equal(first.active, false);
    assert.equal(puppet.body.enable, true);
    assert.equal(puppet.patrolData.state, 'falling');
    assert.deepEqual(puppet.body.velocity, { x: 40, y: 120 });
    assert.equal(scene.enemyManager.countAlivePuppets(), 1);
    assert.equal(bursts.length, 0);
    assert.equal(tweens.length, 0);
    assert.deepEqual(sounds, ['damage']);

    boss._onBulletHitPuppet(second, puppet);
    assert.equal(second.active, false);
    assert.equal(puppet.body.enable, false);
    assert.equal(puppet.patrolData.state, 'vanishing');
    assert.equal(scene.enemyManager.countAlivePuppets(), 0);
    assert.equal(bursts.length, 1);
    assert.equal(tweens.length, 1);
    assert.deepEqual(sounds, ['damage', 'enemyPop']);
    tweens[0].onComplete();
    assert.equal(puppet.active, false);
});

test('cada boneco precisa receber seus próprios dois tiros, inclusive os recém-criados', () => {
    const { boss, spawn, bullet } = battle();
    const first = spawn();
    boss._onBulletHitPuppet(bullet(), first);
    const second = spawn();
    boss._onBulletHitPuppet(bullet(), second);
    assert.equal(first.body.enable, true);
    assert.equal(second.body.enable, true);
    boss._onBulletHitPuppet(bullet(), first);
    assert.equal(first.body.enable, false);
    assert.equal(second.body.enable, true);
    boss._onBulletHitPuppet(bullet(), second);
    assert.equal(second.body.enable, false);
});

test('mesmo tiro não conta duas vezes nem acerta dois bonecos; boneco eliminado não consome outro tiro', () => {
    const { boss, spawn, bullet, bursts } = battle();
    const first = spawn(), second = spawn();
    const shot = bullet();
    boss._onBulletHitPuppet(shot, first);
    boss._onBulletHitPuppet(shot, first);
    boss._onBulletHitPuppet(shot, second);
    assert.equal(first.body.enable, true);
    boss._onBulletHitPuppet(bullet(), second);
    assert.equal(second.body.enable, true);
    boss._onBulletHitPuppet(bullet(), first);
    const extra = bullet();
    boss._onBulletHitPuppet(extra, first);
    assert.equal(extra.active, true);
    assert.equal(bursts.length, 1);
});
