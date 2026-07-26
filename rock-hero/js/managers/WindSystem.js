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
 * Fase φ aleatória por run. No cruzamento do zero o vento acalma e
 * depois cresce no outro lado — dispara a rajada de poeira.
 *
 * Visual: poeira contínua (opacidade baixa) + rajada na inversão.
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
        this.dustCooldownMs = cfg.DUST_COOLDOWN_MS;

        this.startTime = scene.time.now;
        this.direction = 0;   // sample assinado (−1…+1)
        this.intensity = 0;   // |sample|
        this.force = 0;

        // Sinal estável da direção (−1 / 0 / +1) para detectar inversões
        this._dirSign = 0;
        this._lastBurstTime = -Infinity;
        this._lastAmbientTime = 0;
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

        this._checkDirectionFlip(time);
        this._updateAmbientDust(time);
    }

    /**
     * Detecta inversão de polaridade com histerese (deadzone) e dispara rajada.
     */
    _checkDirectionFlip(time) {
        let newSign = this._dirSign;
        if (this.direction > this.flipDeadzone) {
            newSign = 1;
        } else if (this.direction < -this.flipDeadzone) {
            newSign = -1;
        }

        if (newSign !== 0 && this._dirSign !== 0 && newSign !== this._dirSign) {
            if (time - this._lastBurstTime >= this.dustCooldownMs) {
                this._lastBurstTime = time;
                this._spawnDustCloud(newSign, { burst: true });
            }
        }

        if (newSign !== 0) {
            this._dirSign = newSign;
        }
    }

    /**
     * Fluxo contínuo de poeira na direção estável atual (opacidade menor).
     * Cadência sobe com a intensidade (|sample|).
     */
    _updateAmbientDust(time) {
        if (this._dirSign === 0) return;

        const cfg = GC.WIND;
        const interval = cfg.DUST_AMBIENT_INTERVAL_MS / Math.max(this.intensity, 0.15);
        if (time - this._lastAmbientTime < interval) return;

        this._lastAmbientTime = time;
        this._spawnDustCloud(this._dirSign, {
            burst: false,
            count: cfg.DUST_AMBIENT_PER_TICK
        });
    }

    /**
     * Nuvem de poeira em espaço de tela, varrendo no sentido do sopro.
     * @param {number} sign +1 → direita, −1 → esquerda
     * @param {{ burst?: boolean, count?: number }} opts
     */
    _spawnDustCloud(sign, opts = {}) {
        const scene = this.scene;
        const cam = scene.cameras.main;
        const cfg = GC.WIND;
        const burst = opts.burst === true;
        const count = opts.count ?? (burst ? cfg.DUST_COUNT : cfg.DUST_AMBIENT_PER_TICK);
        const baseAlpha = burst ? cfg.DUST_ALPHA : cfg.DUST_AMBIENT_ALPHA;
        const stagger = burst ? cfg.DUST_STAGGER_MS : 0;

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
            const duration = cfg.DUST_DURATION_MS * Phaser.Math.FloatBetween(0.75, 1.15);

            scene.tweens.add({
                targets: particle,
                x: endX + Phaser.Math.Between(-20, 20),
                y: y + drift,
                alpha: 0,
                scale: Phaser.Math.FloatBetween(0.4, 1.1),
                duration,
                delay: i * stagger,
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
