const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const parse = require('phaser/src/tilemaps/parsers/tiled/ParseJSONTiled');
const root = path.join(__dirname, '..');
const load = name => JSON.parse(fs.readFileSync(path.join(root, 'assets', name + '.json')));
const cave = 'map-5--caverna';
const boss = 'map-chefe-mundo1';

function loadClass(file, name, globals) {
    return vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8') + `\n${name};`, globals);
}
const Phaser = { Scene: class {}, Math: {
    Distance: { Between: (x, y, a, b) => Math.hypot(a - x, b - y) },
    Linear: (a, b, t) => a + (b - a) * t
} };
const GC = vm.runInNewContext(fs.readFileSync(path.join(root, 'js/constants.js'), 'utf8') + '\nGC;');
const GameScene = loadClass('js/scenes/GameScene.js', 'GameScene', { Phaser });
const PlayerController = loadClass('js/managers/PlayerController.js', 'PlayerController', {
    Phaser, GC, SoundManager: { play() {} }
});

test('Phaser 3.80.1 copies per-tile properties, without inheriting tileset properties', () => {
    assert.equal(require('phaser/package.json').version, '3.80.1');
    const raw = load(boss);
    const ts = raw.tilesets.find(ts => ts.name === 'lava-roxa-animated');
    ts.properties = [{ name: 'tileset_only_probe', type: 'bool', value: true }];
    const map = parse('probe', raw);
    const tile = map.layers.find(l => l.name === 'solids').data[12][4];
    assert.equal(tile.properties.tileset_only_probe, undefined);
    assert.equal(tile.properties.jump_back_to_checkpoint, true);
});

for (const [name, ranges] of [[cave, [[52, 55, 9], [65, 68, 11]]], [boss, [[9, 12, 28]]]]) {
    test(`${name}: every lava placement and animation frame has the damage property`, () => {
        const raw = load(name);
        assert.ok(!JSON.stringify(raw).includes('jumpback_to_checkpoint'));
        const map = parse(name, raw);
        map.key = name;
        const solids = map.layers.find(l => l.name === 'solids');
        for (const [first, last, count] of ranges) {
            const tileset = map.tilesets.find(ts => ts.firstgid === first);
            for (let gid = first; gid <= last; gid++) {
                assert.equal(tileset.tileProperties[gid - first]?.jump_back_to_checkpoint, true, `GID ${gid}`);
            }
            const tiles = solids.data.flat().filter(t => t.index >= first && t.index <= last);
            assert.equal(tiles.length, count);
            for (const tile of tiles) {
                assert.equal(tile.properties.jump_back_to_checkpoint, true, `${tile.x},${tile.y}`);
            }
            // The game's animation changes only index; properties stay on the Tile instance.
            const callbacks = [];
            const scene = { time: { addEvent: event => callbacks.push(event.callback) },
                cache: { tilemap: { get: () => ({ data: raw }) } },
                getTilesetProperties: GameScene.prototype.getTilesetProperties,
                _getTilesetFrameCountFromTexture: () => 4 };
            const layer = { forEachTile: fn => tiles.forEach(fn) };
            if (name === boss) GameScene.prototype.setupTileAnimations.call(scene, layer, tileset);
            else GameScene.prototype.setupAutoTileAnimations.call(scene, map, layer);
            assert.ok(callbacks.length > 0);
            for (let frame = 0; frame < 4; frame++) {
                callbacks.forEach(fn => fn());
                for (const tile of tiles) assert.equal(tile.properties.jump_back_to_checkpoint, true);
            }
        }
    });

    test(`${name}: collision calls real damage and checkpoint methods (simulated tween)`, () => {
        const map = parse(name, load(name));
        const tiles = map.layers.find(l => l.name === 'solids').data.flat();
        for (const [first] of ranges) {
            const tile = tiles.find(t => t.index === first);
            const tweens = [];
            let deaths = 0;
            const scene = { hasWon: false, time: { now: 100 }, currentCheckpoint: { x: 64, y: 96 },
                hudManager: { updateHearts() {} }, onPlayerDied: () => deaths++,
                tweens: { add: config => tweens.push(config) } };
            const pc = new PlayerController(scene);
            scene.playerController = pc;
            pc.hearts = 3;
            pc.player = { x: 400, y: 500, body: { enable: true }, setTint() {}, clearTint() {}, setVelocity() {} };
            const collide = () => GameScene.prototype.handleTileCollision.call(scene, pc.player, tile);
            GameScene.prototype.handleTileCollision.call(scene, pc.player, { properties: {} });
            assert.equal(pc.hearts, 3);
            collide();
            assert.equal(pc.hearts, 2);
            assert.equal(pc.isRespawning, true);
            assert.equal(pc.player.body.enable, false);
            assert.equal(tweens.length, 1);
            assert.equal(tweens[0].x, scene.currentCheckpoint.x);
            assert.equal(tweens[0].y, scene.currentCheckpoint.y);
            collide();
            assert.equal(pc.hearts, 2);
            // Complete the tween deterministically, without claiming to run browser physics.
            pc.player.x = tweens[0].x;
            pc.player.y = tweens[0].y;
            tweens[0].onComplete();
            assert.equal(pc.isRespawning, false);
            assert.equal(pc.player.body.enable, true);
            collide();
            assert.equal(pc.hearts, 2); // Still invincible.
            pc.isInvincible = false;
            scene.hasWon = true;
            collide();
            assert.equal(pc.hearts, 2);
            scene.hasWon = false;
            pc.hearts = 1;
            collide();
            assert.equal(pc.hearts, 0);
            assert.equal(deaths, 1);
            assert.equal(tweens.length, 1); // Last heart follows death flow, not checkpoint flow.
        }
    });
}
