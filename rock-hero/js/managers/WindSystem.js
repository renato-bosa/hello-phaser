/**
 * WindSystem - Vento horizontal variável ao longo da fase
 *
 * Uma senoide única controla direção e intensidade:
 *   sample = sin(ωt + φ) ∈ [-1, 1]
 *   direction  = sample          (polaridade → lado)
 *   intensity  = |sample|        (amplitude → força relativa)
 *   force      = sample × MAX_SPEED
 *
 * Ciclo completo = PERIOD_S (~10s cada lado com PERIOD_S=20).
 * Fase φ aleatória por run.
 *
 * Visual: poeira contínua na direção do vento, com opacidade e densidade
 * proporcionais à intensidade — densa/opaca no pico, some na calmaria
 * (perto do cruzamento do zero). Sem rajada especial na inversão, já que
 * ali a intensidade é mínima por definição.
 *
 * Não afeta inimigos. A aplicação no player fica no PlayerController
 * (vento no ar e ao andar; no chão parado a força é ignorada).
 */
class WindSystem {
    constructor(scene) {
        this.scene = scene;
        this.active = true;

        const cfg = GC.WIND;
        this.phase = Math.random() * Math.PI * 2;
        this.omega = (Math.PI * 2) / cfg.PERIOD_S;
        this.maxSpeed = cfg.MAX_SPEED;
        this.flipDeadzone = cfg.DIR_FLIP_DEADZONE;

        this.startTime = scene.time.now;
        this.direction = 0;   // sample assinado (−1…+1)
        this.intensity = 0;   // |sample|
        this.force = 0;

        // Sinal estável da direção (−1 / 0 / +1); segura o último lado na deadzone
        this._dirSign = 0;
        this._lastDustTime = 0;
    }

    /**
     * Atualiza a senoide. Chamar uma vez por frame de gameplay.
     */
    update(time) {
        if (!this.active) return;

        const t = (time - this.startTime) / 1000;
        const sample = Math.sin(this.omega * t + this.phase);

        this.direction = sample;
        this.intensity = Math.abs(sample);
        this.force = sample * this.maxSpeed;

        this._updateDirSign();
        this._updateDust(time);
    }

    /**
     * Atualiza o lado do vento com histerese: só troca quando ultrapassa a
     * deadzone, evitando flicker perto do zero.
     */
    _updateDirSign() {
        if (this.direction > this.flipDeadzone) {
            this._dirSign = 1;
        } else if (this.direction < -this.flipDeadzone) {
            this._dirSign = -1;
        }
    }

    /**
     * Fluxo de poeira na direção atual. Cadência e opacidade sobem com a
     * intensidade; abaixo de DUST_MIN_INTENSITY não gera nada.
     */
    _updateDust(time) {
        if (this._dirSign === 0) return;

        const cfg = GC.WIND;
        if (this.intensity < cfg.DUST_MIN_INTENSITY) return;

        const interval = cfg.DUST_INTERVAL_MS / this.intensity;
        if (time - this._lastDustTime < interval) return;

        this._lastDustTime = time;
        this._spawnDust(this._dirSign, this.intensity, cfg.DUST_PER_TICK);
    }

    /**
     * Emite partículas de poeira varrendo a tela no sentido do sopro.
     * @param {number} sign +1 → direita, −1 → esquerda
     * @param {number} intensity 0…1, escala a opacidade
     * @param {number} count quantidade de partículas
     */
    _spawnDust(sign, intensity, count) {
        const scene = this.scene;
        const cam = scene.cameras.main;
        const cfg = GC.WIND;
        const baseAlpha = cfg.DUST_MAX_ALPHA * intensity;

        const fromLeft = sign > 0;
        const startX = fromLeft ? -30 : cam.width + 30;
        const endX = fromLeft ? cam.width + 50 : -50;

        for (let i = 0; i < count; i++) {
            const y = Phaser.Math.Between(12, cam.height - 12);
            const size = Phaser.Math.Between(cfg.DUST_MIN_SIZE, cfg.DUST_MAX_SIZE);
            const color = Phaser.Math.RND.pick(cfg.DUST_COLORS);
            const alpha = baseAlpha * Phaser.Math.FloatBetween(0.55, 1);

            const particle = scene.add.circle(startX, y, size, color, alpha)
                .setScrollFactor(0)
                .setDepth(cfg.DUST_DEPTH);

            const drift = Phaser.Math.Between(-cfg.DUST_Y_DRIFT, cfg.DUST_Y_DRIFT);
            // Vento mais forte varre a poeira mais rápido pela tela
            const duration = (cfg.DUST_DURATION_MS / Math.max(intensity, 0.3))
                * Phaser.Math.FloatBetween(0.75, 1.15);

            scene.tweens.add({
                targets: particle,
                x: endX + Phaser.Math.Between(-20, 20),
                y: y + drift,
                alpha: 0,
                scale: Phaser.Math.FloatBetween(0.4, 1.1),
                duration,
                ease: 'Sine.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }

    /** Força horizontal atual em px/s. 0 se inativo. */
    getForce() {
        return this.active ? this.force : 0;
    }

    isActive() {
        return this.active;
    }
}

window.WindSystem = WindSystem;
