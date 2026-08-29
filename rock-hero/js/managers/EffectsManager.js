/**
 * EffectsManager - Efeitos visuais
 * Responsável por: trail do jogador, neon burst, neon line trail, efeitos de água
 */
class EffectsManager {
    constructor(scene) {
        this.scene = scene;

        this.trailSprites = [];
        this.lastTrailTime = 0;

        this.neonLinePoints = [];
        this.neonLineGraphics = null;

        this.wasOnGround = undefined;
        this.lastNeonPointTime = 0;
    }

    update(time) {
        if (GameData.isFeatureEnabled('playerTrail')) {
            this._updatePlayerTrail();
        }
        if (GameData.isFeatureEnabled('jumpNeonBurst') || GameData.isFeatureEnabled('landNeonBurst')) {
            this._updateNeonBurstEffects();
        }
        if (GameData.isFeatureEnabled('neonLineTrail') ||
            this.scene.playerController.hasSneakerPower()) {
            this._updateNeonLineTrail();
        }
        if (GameData.isFeatureEnabled('waterPhysics')) {
            this._updateWaterEffects();
        }
    }

    _updatePlayerTrail() {
        const scene = this.scene;
        const player = scene.playerController.player;
        const now = scene.time.now;

        const isMoving = Math.abs(player.body.velocity.x) > GC.TRAIL.MOVE_THRESHOLD ||
                         Math.abs(player.body.velocity.y) > GC.TRAIL.MOVE_THRESHOLD;

        if (isMoving && now - this.lastTrailTime > GC.TRAIL.INTERVAL_MS) {
            this.lastTrailTime = now;

            const trailSprite = scene.add.image(player.x, player.y, 'player-trail');
            trailSprite.setFlipX(player.flipX);
            trailSprite.setScale(player.scaleX, player.scaleY);
            trailSprite.setAlpha(GC.TRAIL.INITIAL_ALPHA);
            trailSprite.setTint(GC.TRAIL.TINT);
            trailSprite.setDepth(player.depth - 1);

            scene.tweens.add({
                targets: trailSprite,
                alpha: 0,
                scale: trailSprite.scale * GC.TRAIL.SHRINK_SCALE,
                duration: GC.TRAIL.FADE_DURATION_MS,
                ease: 'Power2',
                onComplete: () => {
                    trailSprite.destroy();
                    this.trailSprites = this.trailSprites.filter(s => s !== trailSprite);
                }
            });

            this.trailSprites.push(trailSprite);

            while (this.trailSprites.length > GC.TRAIL.MAX_SPRITES) {
                const oldSprite = this.trailSprites.shift();
                if (oldSprite && oldSprite.destroy) oldSprite.destroy();
            }
        }
    }

    _updateNeonBurstEffects() {
        const player = this.scene.playerController.player;
        const onGround = player.body.blocked.down;

        if (this.wasOnGround === undefined) this.wasOnGround = false;

        if (GameData.isFeatureEnabled('landNeonBurst')) {
            if (onGround && !this.wasOnGround && Math.abs(player.body.velocity.y) < 50) {
                this._createNeonDustParticle(
                    player.x,
                    player.y + GC.NEON_BURST.PLAYER_OFFSET_Y,
                    GC.NEON_BURST.COLORS,
                    GC.NEON_BURST.LAND
                );
            }
        }

        if (GameData.isFeatureEnabled('jumpNeonBurst')) {
            if (!onGround && this.wasOnGround) {
                this._createNeonDustParticle(
                    player.x,
                    player.y + GC.NEON_BURST.PLAYER_OFFSET_Y,
                    GC.NEON_BURST.COLORS,
                    GC.NEON_BURST.JUMP
                );
            }
        }

        this.wasOnGround = onGround;
    }

    /**
     * Brilho mágico ao coletar uma estrela: núcleo claro + auréola dourada que
     * expandem e apagam, mais faíscas que sobem e se dissipam em tempos
     * diferentes.
     *
     * Disparado por evento (GameScene.collectStar), não pelo update() — por
     * isso é público e checa a própria feature flag.
     */
    createStarCollectGlow(x, y) {
        if (!GameData.isFeatureEnabled('starParticles')) return;

        const cfg = GC.STAR_COLLECT;
        // Acima do jogador: o brilho não deve ficar escondido atrás dele
        const depth = GC.DEPTH.PLAYER + 1;

        this._createExpandingGlow(
            x, y, cfg.GLOW_RADIUS, cfg.GLOW_COLOR, cfg.GLOW_ALPHA,
            cfg.GLOW_SCALE, cfg.GLOW_DURATION_MS, depth
        );
        this._createExpandingGlow(
            x, y, cfg.HALO_RADIUS, cfg.HALO_COLOR, cfg.HALO_ALPHA,
            cfg.HALO_SCALE, cfg.HALO_DURATION_MS, depth + 1
        );

        this._createSparkleBurst(x, y, depth + 1, this._sparkleOptions(cfg));
    }

    /**
     * Celebração ao completar a fase, disparada na posição da bandeira:
     * auréola dourada + faíscas + confete + punch de câmera. Quando há recorde,
     * usa contagens/cores reforçadas e adiciona uma 2ª pulsação sincronizada
     * com o som 'newRecord'.
     *
     * Disparado por evento (VictoryScreen), não pelo update(). Ao contrário de
     * createStarCollectGlow, a feature flag é checada por quem chama, porque lá
     * ela também decide se existe o respiro antes do overlay.
     */
    createVictoryBurst(x, y, isRecord) {
        const scene = this.scene;
        const cfg = GC.VICTORY;
        const depth = GC.DEPTH.PLAYER + 1;

        this._createExpandingGlow(
            x, y, cfg.GLOW_RADIUS, cfg.GLOW_COLOR, cfg.GLOW_ALPHA,
            cfg.GLOW_SCALE, cfg.GLOW_DURATION_MS, depth
        );

        this._createSparkleBurst(x, y, depth + 1, this._sparkleOptions(cfg, isRecord ? {
            count: cfg.SPARKLE_COUNT_RECORD,
            colors: cfg.SPARKLE_COLORS_RECORD
        } : {}));

        this._createVictoryConfetti(
            x, y, isRecord ? cfg.CONFETTI_COUNT_RECORD : cfg.CONFETTI_COUNT, depth
        );

        this._punchCamera(cfg.CAMERA_PUNCH_SCALE, cfg.CAMERA_PUNCH_MS);

        if (isRecord) {
            scene.time.delayedCall(cfg.RECORD_PULSE_DELAY_MS, () => {
                this._createExpandingGlow(
                    x, y, cfg.GLOW_RADIUS, cfg.RECORD_GLOW_COLOR, cfg.GLOW_ALPHA,
                    cfg.GLOW_SCALE * cfg.RECORD_GLOW_SCALE_BOOST, cfg.GLOW_DURATION_MS, depth
                );
            });
        }
    }

    /**
     * Estouro do boneco na 2ª pisada: flash + faíscas radiais coloridas.
     */
    createEnemyPopBurst(x, y, durationScale = 1) {
        const cfg = GC.ENEMY.BONECO;
        const depth = GC.DEPTH.PLAYER + 2;

        this._createExpandingGlow(
            x, y, cfg.POP_GLOW_RADIUS, 0xffffff, 0.9,
            cfg.POP_GLOW_SCALE * 0.6, cfg.POP_GLOW_MS * 0.6 * durationScale, depth + 1
        );
        this._createExpandingGlow(
            x, y, cfg.POP_GLOW_RADIUS, 0xffd447, 0.7,
            cfg.POP_GLOW_SCALE, cfg.POP_GLOW_MS * durationScale, depth
        );

        this._createSparkleBurst(x, y, depth + 1, {
            count: cfg.POP_SPARKLE_COUNT,
            minSize: cfg.POP_SPARKLE_MIN_SIZE,
            maxSize: cfg.POP_SPARKLE_MAX_SIZE,
            minDistance: cfg.POP_SPARKLE_MIN_DIST,
            maxDistance: cfg.POP_SPARKLE_MAX_DIST,
            rise: 8,
            angleJitter: 0.4,
            minDuration: cfg.POP_SPARKLE_MS * 0.7 * durationScale,
            maxDuration: cfg.POP_SPARKLE_MS * durationScale,
            stagger: 40 * durationScale,
            colors: cfg.POP_COLORS
        });
    }

    /**
     * Zoom rápido de ida e volta. Usa o zoom atual como base porque cada fase
     * tem o seu (GameConfig.LEVELS[].zoom), e o restaura no fim para evitar
     * acúmulo de erro de ponto flutuante.
     */
    _punchCamera(scaleFactor, durationMs) {
        const cam = this.scene.cameras.main;
        const baseZoom = cam.zoom;

        this.scene.tweens.add({
            targets: cam,
            zoom: baseZoom * scaleFactor,
            duration: durationMs,
            yoyo: true,
            ease: 'Sine.easeOut',
            onComplete: () => { cam.zoom = baseZoom; }
        });
    }

    _createVictoryConfetti(x, y, count, depth) {
        const scene = this.scene;
        const cfg = GC.VICTORY;

        for (let i = 0; i < count; i++) {
            const piece = scene.add.rectangle(
                x, y,
                Phaser.Math.Between(3, 5),
                Phaser.Math.Between(5, 8),
                Phaser.Math.RND.pick(cfg.CONFETTI_COLORS)
            );
            piece.setDepth(depth);
            piece.angle = Phaser.Math.Between(0, 360);

            const startY = y;
            const spread = Phaser.Math.Between(-cfg.CONFETTI_SPREAD_X, cfg.CONFETTI_SPREAD_X);
            const rise = Phaser.Math.Between(cfg.CONFETTI_MIN_RISE, cfg.CONFETTI_MAX_RISE);
            const fall = Phaser.Math.Between(cfg.CONFETTI_MIN_FALL, cfg.CONFETTI_MAX_FALL);
            const spin = Phaser.Math.Between(-cfg.CONFETTI_SPIN, cfg.CONFETTI_SPIN);

            scene.tweens.add({
                targets: piece,
                x: x + spread,
                alpha: { from: 1, to: 0, ease: 'Quad.easeIn' },
                duration: Phaser.Math.Between(cfg.CONFETTI_MIN_DURATION_MS, cfg.CONFETTI_MAX_DURATION_MS),
                ease: 'Sine.easeOut',
                onUpdate: (tween) => {
                    // Arco senoidal na subida + queda acelerada, mesmo idioma
                    // usado no respawn do jogador
                    const p = tween.progress;
                    piece.y = startY - Math.sin(p * Math.PI) * rise + (p * p) * fall;
                    piece.angle += spin;
                },
                onComplete: () => piece.destroy()
            });
        }
    }

    /**
     * Traduz um bloco de constantes com prefixo SPARKLE_ para as opções de
     * `_createSparkleBurst`. `overrides` permite variar contagem/cores sem
     * duplicar o bloco (usado no reforço de recorde).
     */
    _sparkleOptions(cfg, overrides = {}) {
        return {
            count: cfg.SPARKLE_COUNT,
            minSize: cfg.SPARKLE_MIN_SIZE,
            maxSize: cfg.SPARKLE_MAX_SIZE,
            minDistance: cfg.SPARKLE_MIN_DISTANCE,
            maxDistance: cfg.SPARKLE_MAX_DISTANCE,
            rise: cfg.SPARKLE_RISE,
            angleJitter: cfg.SPARKLE_ANGLE_JITTER,
            minDuration: cfg.SPARKLE_MIN_DURATION_MS,
            maxDuration: cfg.SPARKLE_MAX_DURATION_MS,
            stagger: cfg.SPARKLE_STAGGER_MS,
            colors: cfg.SPARKLE_COLORS,
            ...overrides
        };
    }

    _createExpandingGlow(x, y, radius, color, alpha, targetScale, duration, depth) {
        const glow = this.scene.add.circle(x, y, radius, color, alpha);
        glow.setDepth(depth);

        this.scene.tweens.add({
            targets: glow,
            scale: targetScale,
            alpha: 0,
            duration: duration,
            ease: 'Cubic.easeOut',
            onComplete: () => glow.destroy()
        });
    }

    /**
     * Faíscas radiais que sobem e se dissipam em tempos diferentes.
     * Compartilhado pelo brilho da estrela e pela celebração de vitória — as
     * durações aleatórias e o `stagger` são o que faz dissipar em vez de estourar.
     */
    _createSparkleBurst(x, y, depth, opts) {
        const scene = this.scene;

        for (let i = 0; i < opts.count; i++) {
            // Jitter no ângulo: sem ele N faíscas formam um anel perfeito
            const baseAngle = (Math.PI * 2 / opts.count) * i;
            const angle = baseAngle + Phaser.Math.FloatBetween(-opts.angleJitter, opts.angleJitter);
            const distance = Phaser.Math.Between(opts.minDistance, opts.maxDistance);
            const size = Phaser.Math.Between(opts.minSize, opts.maxSize);

            const sparkle = scene.add.circle(
                x, y, size, Phaser.Math.RND.pick(opts.colors), 0.95
            );
            sparkle.setDepth(depth);

            scene.tweens.add({
                targets: sparkle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance - opts.rise,
                scale: 0,
                alpha: 0,
                duration: Phaser.Math.Between(opts.minDuration, opts.maxDuration),
                delay: Phaser.Math.Between(0, opts.stagger),
                ease: 'Sine.easeOut',
                onComplete: () => sparkle.destroy()
            });
        }
    }

    _createNeonDustParticle(x, y, colors, options = {}) {
        const scene = this.scene;
        const player = scene.playerController.player;
        const count = options.count || 3;
        const baseSpeedY = options.speedY || -40;
        const baseSpeedX = options.speedX || 30;
        const burst = options.burst || false;

        for (let i = 0; i < count; i++) {
            const color = Phaser.Math.RND.pick(colors);
            const size = Phaser.Math.Between(2, 5);

            const particle = scene.add.circle(
                x + Phaser.Math.Between(-6, 6), y, size, color, 0.9
            );
            particle.setDepth(player.depth - 1);

            const glow = scene.add.circle(
                particle.x, particle.y, size * 2, color, 0.3
            );
            glow.setDepth(particle.depth - 1);

            const vx = burst
                ? Phaser.Math.Between(-baseSpeedX, baseSpeedX)
                : baseSpeedX + Phaser.Math.Between(-10, 10);
            const vy = baseSpeedY + Phaser.Math.Between(-20, 20);

            scene.tweens.add({
                targets: [particle, glow],
                x: particle.x + vx * 0.5,
                y: particle.y + vy,
                alpha: 0,
                scale: 0.3,
                duration: Phaser.Math.Between(200, 400),
                ease: 'Power2',
                onComplete: () => {
                    particle.destroy();
                    glow.destroy();
                }
            });
        }
    }

    _updateNeonLineTrail() {
        const scene = this.scene;
        const player = scene.playerController.player;
        const now = scene.time.now;

        if (!this.neonLineGraphics) {
            this.neonLineGraphics = scene.add.graphics();
            this.neonLineGraphics.setDepth(player.depth - 2);
        }

        if (!this.lastNeonPointTime) this.lastNeonPointTime = 0;

        const isMoving = Math.abs(player.body.velocity.x) > GC.NEON_LINE.MOVE_THRESHOLD ||
                         Math.abs(player.body.velocity.y) > GC.NEON_LINE.MOVE_THRESHOLD;

        if (isMoving && now - this.lastNeonPointTime > GC.NEON_LINE.POINT_INTERVAL_MS) {
            this.lastNeonPointTime = now;
            this.neonLinePoints.push({ x: player.x, y: player.y, time: now, alpha: 1 });

            while (this.neonLinePoints.length > GC.NEON_LINE.MAX_POINTS) {
                this.neonLinePoints.shift();
            }
        }

        this.neonLinePoints.forEach(point => {
            point.alpha = Math.max(0, point.alpha - GC.NEON_LINE.FADE_SPEED);
        });
        this.neonLinePoints = this.neonLinePoints.filter(p => p.alpha > 0);

        this.neonLineGraphics.clear();

        if (this.neonLinePoints.length >= 2) {
            this.neonLineGraphics.lineStyle(GC.NEON_LINE.GLOW_WIDTH, GC.NEON_LINE.GLOW_COLOR, GC.NEON_LINE.GLOW_ALPHA);
            this._drawSmoothLine(this.neonLineGraphics, this.neonLinePoints);

            this.neonLineGraphics.lineStyle(GC.NEON_LINE.LINE_WIDTH, GC.NEON_LINE.COLOR, GC.NEON_LINE.LINE_ALPHA);
            this._drawSmoothLine(this.neonLineGraphics, this.neonLinePoints);

            this.neonLineGraphics.lineStyle(GC.NEON_LINE.CORE_WIDTH, GC.NEON_LINE.CORE_COLOR, GC.NEON_LINE.CORE_ALPHA);
            this._drawSmoothLine(this.neonLineGraphics, this.neonLinePoints);
        }
    }

    clearNeonLineTrail() {
        this.neonLinePoints = [];
        if (this.neonLineGraphics) {
            this.neonLineGraphics.clear();
        }
    }

    _drawSmoothLine(graphics, points) {
        if (points.length < 2) return;

        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }

        graphics.strokePath();
    }

    _updateWaterEffects() {
        const pc = this.scene.playerController;
        const player = pc.player;
        const inWater = pc.wasInWaterPrev || false;

        if (pc.justEnteredWater) {
            this._createWaterSplash(player.x, player.y);
        }

        if (inWater) {
            player.setTint(GC.WATER.PLAYER_TINT);

            if (Phaser.Math.Between(0, 100) < GC.WATER.BUBBLE_CHANCE_PERCENT) {
                this._createWaterBubble(
                    player.x + Phaser.Math.Between(-8, 8),
                    player.y + Phaser.Math.Between(-8, 8)
                );
            }
        } else {
            player.clearTint();
        }
    }

    _createWaterSplash(x, y) {
        const scene = this.scene;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const speed = 100 + Math.random() * 50;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - 50;

            const particle = scene.add.circle(x, y, 2, 0x4499ff, 0.8);
            scene.tweens.add({
                targets: particle,
                x: x + vx * 0.3,
                y: y + vy * 0.3,
                alpha: 0,
                duration: 400,
                ease: 'Cubic.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }

    _createWaterBubble(x, y) {
        const bubble = this.scene.add.circle(x, y, 2, 0xaaeeff, 0.6);
        this.scene.tweens.add({
            targets: bubble,
            y: y - 20 - Math.random() * 30,
            x: x + (Math.random() - 0.5) * 10,
            scale: 0.5,
            alpha: 0,
            duration: 800 + Math.random() * 400,
            ease: 'Sine.easeOut',
            onComplete: () => bubble.destroy()
        });
    }

    destroy() {
        this.trailSprites.forEach(s => { if (s && s.destroy) s.destroy(); });
        this.trailSprites = [];
        if (this.neonLineGraphics) {
            this.neonLineGraphics.destroy();
            this.neonLineGraphics = null;
        }
        this.neonLinePoints = [];
    }
}
