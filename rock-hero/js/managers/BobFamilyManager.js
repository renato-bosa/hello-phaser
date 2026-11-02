/** Resgate por contato. O progresso desta tentativa só é salvo na vitória. */
class BobFamilyManager {
    static preload(scene) {
        const images = [
            ...GameData.BOB_FAMILY.map(f => [f.texture, `assets/spritesheets/${f.texture}.png`]),
            ['family-bob', 'assets/spritesheets/octopus.png']
        ];
        images.forEach(([key, file]) => {
            if (!scene.textures.exists(key)) scene.load.image(key, GameData.assetUrl(file));
        });
    }

    constructor(scene) {
        this.scene = scene;
        this.saved = new Set(GameData.getRescuedFamily());
        this.pending = new Set();
        this.targets = [];
        this.reunion = [];
        this.displays = [];
        this.overlaps = [];
        scene.events.once('shutdown', this.destroy, this);
    }

    create(spawns) {
        const scene = this.scene;
        spawns.forEach(data => {
            if (this.targets.some(t => t.id === data.id)) return;
            const sprite = scene.physics.add.staticSprite(data.x, data.y, data.textureKey)
                .setDisplaySize(data.width, data.height).setDepth(GC.DEPTH.PLAYER - 1);
            sprite.refreshBody();
            scene._applyTilesetTransform(sprite, data.transform);
            this.displays.push(sprite);
            const target = { ...data, sprite, rescued: this.saved.has(data.id), marker: null };
            this.targets.push(target);

            if (target.rescued) {
                sprite.body.enable = false;
                this.showReunion(target, false);
                return;
            }

            target.marker = scene.add.text(data.x, data.y - data.height / 2 - 12, 'RESGATAR', {
                fontFamily: 'Arial', fontSize: '10px', color: '#ffe78a',
                stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(GC.DEPTH.PLAYER + 1);
            this.displays.push(target.marker);
            scene.tweens.add({ targets: target.marker, y: target.marker.y - 4,
                duration: 650, yoyo: true, repeat: -1 });
            this.overlaps.push(scene.physics.add.overlap(scene.playerController.player, sprite,
                () => this.rescue(target)));
        });
        if (this.targets.length) scene.hudManager.createFamilyDisplay(this.getFoundIds());
    }

    getFoundIds() {
        return [...new Set([...this.saved, ...this.pending])];
    }

    getPendingIds() {
        return [...this.pending];
    }

    hasMissingRescues() {
        return this.targets.some(target => !target.rescued);
    }

    rescue(target) {
        const scene = this.scene;
        if (target.rescued || scene.hasWon || scene.currentView !== 'gameplay'
            || scene.playerController.hearts <= 0 || scene.playerController.isRespawning) return;
        target.rescued = true;
        target.sprite.body.enable = false;
        this.pending.add(target.id);
        this.removeDisplay(target.marker);
        SoundManager.play('collectHeart');
        this.showReunion(target, true);
        scene.hudManager.updateFamilyDisplay(this.getFoundIds());
        const family = GameData.BOB_FAMILY.find(f => f.id === target.id);
        this.showMessage(`${family.name} a salvo!\nConclua a fase para salvar o resgate.`);
    }

    showReunion(target, animate) {
        const scene = this.scene;
        this.reunion.forEach(sprite => this.removeDisplay(sprite));
        this.reunion = [];
        const textures = ['family-bob', ...GameData.BOB_FAMILY
            .filter(f => f.id !== target.id && this.getFoundIds().includes(f.id))
            .map(f => f.texture)];
        // A família fica junto do novo integrante, sem corpos de física.
        const spacing = 36;
        const groupWidth = textures.length * spacing;
        const startX = this.reunionStartX(target, textures.length + 1, spacing);
        const allSprites = [target.sprite];
        target.sprite.setX(startX + groupWidth);
        textures.forEach((texture, index) => {
            const sprite = scene.add.image(startX + index * spacing, target.y, texture)
                .setDepth(GC.DEPTH.PLAYER - 1);
            this.reunion.push(sprite);
            this.displays.push(sprite);
            allSprites.push(sprite);
        });
        if (animate) {
            allSprites.forEach((sprite, index) => {
                scene.tweens.add({ targets: sprite, y: sprite.y - 10, duration: 180,
                    delay: index * 80, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
            });
        }
    }

    reunionStartX(target, count, spacing) {
        const scene = this.scene;
        const maxStart = Math.max(16, scene.map.widthInPixels - (count - 1) * spacing - 16);
        let bestStart = target.x;
        let bestScore = -Infinity;
        // Prefere chão sob o grupo e evita desenhar os familiares dentro de paredes.
        // O reencontro é decorativo; não cria plataformas nem colisões adicionais.
        for (let anchor = 0; anchor < count; anchor++) {
            const start = Phaser.Math.Clamp(target.x - anchor * spacing, 16, maxStart);
            let score = 0;
            for (let i = 0; i < count; i++) {
                const x = start + i * spacing;
                if (scene.solidsLayer.getTileAtWorldXY(x, target.y + target.height / 2 + 1)?.collides) score++;
                if (scene.solidsLayer.getTileAtWorldXY(x, target.y)?.collides) score -= 2;
            }
            if (score > bestScore) { bestScore = score; bestStart = start; }
        }
        return bestStart;
    }

    warnMissingRescue() {
        if (this.message?.active) return;
        SoundManager.play('warning');
        this.showMessage('Encontre o familiar do Bob\nantes de concluir esta fase.');
    }

    showMessage(message) {
        this.removeDisplay(this.message);
        const cam = this.scene.cameras.main;
        const text = this.scene.add.text(cam.centerX, cam.height - 60, message, {
            fontFamily: 'Arial', fontSize: '16px', color: '#ffe78a', align: 'center',
            backgroundColor: '#1a102de8', padding: { x: 12, y: 6 },
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.HUD + 1);
        this.message = text;
        this.displays.push(text);
        this.scene.time.delayedCall(3000, () => this.removeDisplay(text));
    }

    removeDisplay(display) {
        if (!display?.active) return;
        this.scene.tweens.killTweensOf(display);
        display.destroy();
    }

    destroy() {
        this.overlaps.forEach(overlap => overlap.destroy());
        this.displays.forEach(display => this.removeDisplay(display));
        this.pending.clear();
        this.scene.events.off('shutdown', this.destroy, this);
    }
}
