const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function chase() {
    const context = vm.createContext({ console });
    context.window = context;
    for (const file of ['constants.js', 'managers/EnemyManager.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
    }
    const { EnemyManager, GC } = vm.runInContext('({ EnemyManager, GC })', context);
    const enemies = [], impulses = [];
    const scene = {
        map: { tileWidth: 32 },
        solidAt: (_x, y) => y >= 216,
        solidsLayer: { getTileAtWorldXY: (x, y) => ({ index: 0, collides: scene.solidAt(x, y) }) },
        physics: { world: { gravity: { y: 800 } }, add: { sprite: makeSprite } },
        anims: { exists: () => true }, tweens: { add() {} },
        effectsManager: { createEnemyPopBurst() {} },
        puppeteerBoss: {
            bob: false, landings: 0,
            isBobPhase() { return this.bob; },
            onPuppetLanded(puppet) {
                this.landings++;
                if (this.bob) manager.vanishPuppet(puppet);
            }
        }
    };
    function makeSprite(x, y) {
        const sprite = {
            x, y, active: true, scaleX: 1, scaleY: 1, anims: { play() {} },
            setDepth() {}, setFlipX(value) { this.flipX = value; },
            setVelocity(vx, vy) { this.body.velocity = { x: vx, y: vy }; },
            setVelocityX(vx) { this.body.velocity.x = vx; },
            setVelocityY(vy) { this.body.velocity.y = vy; impulses.push(vy); }
        };
        sprite.body = {
            enable: true, blocked: { down: false, left: false, right: false },
            velocity: { x: 0, y: 0 }, gravity: { y: 0 },
            setSize(width, height) { this.width = width; this.height = height; },
            setOffset(x, y) { this.offsetX = x; this.offsetY = y; },
            setCollideWorldBounds() {}, setGravityY(y) { this.gravity.y = y; },
            get left() { return sprite.x - 16 + this.offsetX; },
            get right() { return this.left + this.width; },
            get top() { return sprite.y - 16 + this.offsetY; },
            get bottom() { return this.top + this.height; },
            get center() { return { x: this.left + this.width / 2, y: this.top + this.height / 2 }; }
        };
        return sprite;
    }
    const manager = new EnemyManager(scene);
    manager.enemies = { add: sprite => enemies.push(sprite), getChildren: () => enemies };
    const puppet = manager.spawnPuppet(100, 200, 40, 120, 83);
    const player = { active: true, x: 140, body: { center: { x: 140, y: 204 } } };
    function target(x, y = 204) { player.x = x; player.body.center = { x, y }; }
    function update(time, grounded) {
        puppet.body.blocked.down = grounded;
        manager._updatePuppet(puppet, puppet.patrolData, player, time, grounded);
    }
    return { manager, scene, puppet, player, target, update, impulses, cfg: GC.PUPPETEER_BOSS };
}

test('voo lançado pela mão permanece intacto; salto de aproximação só começa após pousar', () => {
    const { puppet, update, impulses, scene } = chase();
    update(1000, false);
    assert.equal(puppet.patrolData.state, 'falling');
    assert.deepEqual(puppet.body.velocity, { x: 40, y: 120 });
    assert.equal(impulses.length, 0);
    update(1016, true);
    assert.equal(scene.puppeteerBoss.landings, 1);
    assert.equal(puppet.patrolData.state, 'chasing');
    assert.equal(puppet.body.velocity.x, 83);
    assert.equal(puppet.body.velocity.y, -Math.sqrt(2 * 800 * 48));
});

test('bonecos saltam nas duas direções e ajustam a altura ao alvo, com limite de três blocos', () => {
    for (const x of [60, 140]) {
        const { puppet, target, update } = chase();
        target(x, 144); // Centro do jogador 60 px acima do boneco.
        update(1000, true);
        assert.equal(puppet.body.velocity.x, x < 100 ? -83 : 83);
        assert.equal(puppet.flipX, x < 100);
        assert.equal(puppet.body.velocity.y, -Math.sqrt(2 * 800 * 66));
    }
    const { puppet, target, update } = chase();
    target(140, 24);
    update(1000, true);
    assert.equal(puppet.body.velocity.y, -Math.sqrt(2 * 800 * 96));
});

test('alvo distante ou abaixo do boneco mantém a perseguição no chão', () => {
    for (const [x, y] of [[197, 204], [140, 250]]) {
        const { puppet, target, update, impulses } = chase();
        target(x, y);
        puppet.body.velocity.y = 0;
        update(1000, true);
        assert.equal(puppet.body.velocity.x, 83);
        assert.equal(impulses.length, 0);
    }
});

test('salto não se repete no ar nem antes do intervalo de 900 ms após pousar', () => {
    const { puppet, update, impulses } = chase();
    update(1000, true);
    const firstImpulse = puppet.body.velocity.y;
    update(1200, false);
    assert.equal(puppet.body.velocity.y, firstImpulse);
    puppet.body.velocity.y = 0;
    update(1700, true);
    update(1899, true);
    assert.equal(puppet.body.velocity.y, 0);
    assert.equal(impulses.length, 1);
    update(1900, true);
    assert.equal(impulses.length, 2);
    assert.equal(puppet.body.velocity.y, firstImpulse);
});

test('fila e buracos profundos impedem o salto; subir degraus mantém prioridade', () => {
    const queued = chase();
    const leader = queued.manager.spawnPuppet(110, 200, 0, 0, 70);
    leader.patrolData.state = 'chasing';
    queued.update(1000, true);
    assert.equal(queued.impulses.length, 0);
    assert.equal(queued.puppet.body.velocity.x, -83 * 0.5);

    const edge = chase();
    edge.scene.solidAt = () => false;
    edge.update(1000, true);
    assert.equal(edge.impulses.length, 0);
    assert.equal(edge.puppet.body.velocity.x, 0);

    const step = chase();
    step.scene.solidAt = (x, y) => y >= 216 || (x >= 120 && y >= 184);
    step.puppet.body.blocked.right = true;
    step.update(1000, true);
    assert.equal(step.puppet.body.velocity.y, -Math.sqrt(2 * 800 * 38));
    assert.equal(step.puppet.patrolData.lastChaseJumpAt, -Infinity);
});

test('na fase do Bob, bonecos continuam desaparecendo ao pousar sem saltar', () => {
    const { scene, puppet, update, impulses } = chase();
    scene.puppeteerBoss.bob = true;
    update(1000, true);
    assert.equal(puppet.body.enable, false);
    assert.equal(puppet.patrolData.state, 'vanishing');
    assert.equal(impulses.length, 0);
});

test('toupeiras continuam andando no chão plano sem receber o salto de aproximação dos bonecos', () => {
    const { manager, puppet, player, impulses } = chase();
    puppet.patrolData.type = 'toupeira';
    puppet.patrolData.state = 'chasing';
    manager._updateToupeira(puppet, puppet.patrolData, player, 1000, true);
    assert.equal(puppet.body.velocity.x, 83);
    assert.equal(impulses.length, 0);
});
