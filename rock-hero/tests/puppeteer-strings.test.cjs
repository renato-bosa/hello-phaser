const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const markers = [[9, 7], [18, 8], [5, 13], [3, 18], [26, 18]];

function handStrings() {
    const context = vm.createContext({ console, Phaser: { Textures: { FilterMode: { NEAREST: 0 } } } });
    context.window = context;
    for (const file of ['constants.js', 'managers/PuppeteerBossManager.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
    }
    const Manager = vm.runInContext('PuppeteerBossManager', context);
    const original = new Uint8ClampedArray(32 * 32 * 4);
    for (const [x, y] of markers) original.set([181, 230, 29, 255], (y * 32 + x) * 4);
    original.set([94, 94, 94, 255], 0); // Pixel da mão que deve permanecer intacto.
    original.set([181, 230, 29, 0], 4); // RGB de um pixel transparente não é marcador.
    let texture, uploads = 0, reads = 0;
    const removed = [];
    const scene = {
        events: { off(...args) { removed.push(args); } },
        textures: {
            exists: () => !!texture,
            get: key => key === 'puppeteer-hand' ? texture : { getSourceImage: () => ({ width: 32, height: 32 }) },
            createCanvas(key, width, height) {
                const pixels = { data: original.slice() };
                texture = {
                    key, width, height, customData: {}, pixels,
                    context: {
                        drawImage() {},
                        getImageData() { reads++; return pixels; },
                        putImageData(value) { assert.equal(value, pixels); }
                    },
                    refresh() { uploads++; }, setFilter(value) { this.filter = value; }
                };
                return texture;
            }
        }
    };
    const manager = new Manager(scene);
    manager._prepareHandTexture();
    const graphics = {
        rects: [], styles: [], fills: [], destroyed: 0,
        clear() { this.rects = []; this.styles = []; this.fills = []; },
        fillStyle(color, alpha) { this.styles.push({ color, alpha }); },
        fillRect(x, y, width, height) {
            const rect = { x, y, width, height };
            this.rects.push(rect);
            this.fills.push({ ...rect, ...this.styles.at(-1) });
        },
        destroy() { this.destroyed++; }
    };
    manager.handStrings = graphics;
    const sprite = {
        x: 100, y: 200, width: 32, height: 32, displayOriginX: 16, displayOriginY: 16,
        scaleX: 2, scaleY: 2, rotation: 0, flipX: false, flipY: false,
        active: true, visible: true, alpha: 1, tintFill: false, tintTopLeft: 0xffffff
    };
    manager.hands = [{ sprite }];
    return { manager, sprite, graphics, original, texture, removed, scene, Manager,
        uploads: () => uploads, reads: () => reads };
}

test('marcadores viram cinco origens e somem apenas da textura exibida, preservando dimensões e cache', () => {
    const h = handStrings();
    assert.equal(h.manager.stringAnchors.length, 5);
    assert.equal(h.texture.width, 32);
    assert.equal(h.texture.height, 32);
    assert.equal(h.texture.filter, 0);
    assert.deepEqual(Array.from(h.texture.pixels.data.slice(0, 4)), [94, 94, 94, 255]);
    markers.forEach(([x, y], i) => {
        const anchor = h.manager.stringAnchors[i];
        assert.equal(anchor.x, x + 0.5);
        assert.equal(anchor.y, y + 0.5);
        assert.equal(anchor.length, 32 - y);
        const alpha = (y * 32 + x) * 4 + 3;
        assert.equal(h.texture.pixels.data[alpha], 0);
        assert.equal(h.original[alpha], 255);
    });
    const nextBoss = new h.Manager(h.scene);
    nextBoss._prepareHandTexture();
    assert.equal(nextBoss.stringAnchors, h.manager.stringAnchors);
    assert.equal(h.uploads(), 1);
    assert.equal(h.reads(), 1);
});

test('fios preservam o trecho original e acrescentam 30% com opacidade decrescente até zero', () => {
    const { manager, graphics } = handStrings();
    manager._drawHandStrings();
    const originals = [
        { x: 86, y: 182, width: 2, height: 50 },
        { x: 104, y: 184, width: 2, height: 48 },
        { x: 78, y: 194, width: 2, height: 38 },
        { x: 74, y: 204, width: 2, height: 28 },
        { x: 120, y: 204, width: 2, height: 28 }
    ];
    for (const original of originals) {
        const parts = graphics.fills.filter(rect => rect.x === original.x);
        assert.deepEqual(parts[0], { ...original, color: 0xc3bc8a, alpha: 1 });
        const tail = parts.slice(1);
        assert.ok(tail.length > 1);
        assert.equal(tail[0].y, original.y + original.height);
        assert.equal(tail[0].alpha, 1);
        assert.equal(tail.at(-1).alpha, 0);
        const bottom = tail.at(-1).y + tail.at(-1).height;
        assert.ok(Math.abs(bottom - (original.y + original.height * 1.3)) < 1e-9);
        tail.forEach((part, i) => {
            assert.equal(part.width, original.width);
            assert.equal(part.color, 0xc3bc8a);
            if (i > 0) {
                assert.ok(part.alpha < tail[i - 1].alpha);
                assert.ok(Math.abs(part.y - tail[i - 1].y - tail[i - 1].height) < 1e-9);
            }
        });
    }
});

test('origens acompanham rotação, espelhamento e deslocamento, mantendo os fios verticais', () => {
    const { manager, sprite, graphics } = handStrings();
    sprite.rotation = Math.PI / 2;
    manager._drawHandStrings();
    assert.deepEqual(graphics.rects[0], { x: 116, y: 186, width: 2, height: 50 });
    sprite.flipX = true;
    manager._drawHandStrings();
    assert.deepEqual(graphics.rects[0], { x: 116, y: 212, width: 2, height: 50 });
    sprite.flipY = true;
    sprite.y += 6;
    manager._drawHandStrings();
    assert.deepEqual(graphics.rects[0], { x: 82, y: 218, width: 2, height: 50 });
    assert.ok(graphics.rects.every(rect => rect.width === 2));
});

test('fios acompanham as piscadas e a derrota e são removidos ao encerrar a cena', () => {
    const { manager, sprite, graphics, removed } = handStrings();
    for (const tint of [0xaa44ff, 0xff3333, 0xffffff]) {
        sprite.tintFill = true;
        sprite.tintTopLeft = tint;
        manager._drawHandStrings();
        assert.ok(graphics.styles.every(style => style.color === tint && style.alpha >= 0 && style.alpha <= 1));
        assert.equal(graphics.styles[0].alpha, 1);
        assert.equal(graphics.styles.at(-1).alpha, 0);
    }
    sprite.tintFill = false;
    sprite.tintTopLeft = 0x55556a;
    sprite.alpha = 0.5;
    manager._drawHandStrings();
    assert.ok(graphics.styles.every(style => style.color === 0x413f39 && style.alpha >= 0 && style.alpha <= 0.5));
    assert.equal(graphics.styles[0].alpha, 0.5);
    assert.equal(graphics.styles.at(-1).alpha, 0);
    sprite.visible = false;
    manager._drawHandStrings();
    assert.equal(graphics.rects.length, 0);
    sprite.visible = true;
    sprite.active = false;
    manager._drawHandStrings();
    assert.equal(graphics.rects.length, 0);
    manager.destroy();
    assert.equal(removed[0][0], 'postupdate');
    assert.equal(removed[0][1], manager._drawHandStrings);
    assert.equal(removed[0][2], manager);
    assert.equal(manager.handStrings, null);
    manager.destroy();
    assert.equal(graphics.destroyed, 1);
});
