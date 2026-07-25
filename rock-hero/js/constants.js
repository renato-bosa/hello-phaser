/**
 * Game Constants (GC)
 * Centraliza todos os valores numéricos de gameplay para fácil tuning.
 */
const GC = {
    PLAYER: {
        MIN_SPEED: 160,
        MAX_SPEED: 260,
        ACCELERATION: 200,
        JUMP_FORCE: -480,
        JUMP_CUT_MULTIPLIER: 0.4,
        FALL_GRAVITY_EXTRA: 0.5,
        COYOTE_DURATION_MS: 100,
        JUMP_BUFFER_DURATION_MS: 100,
        MAX_VELOCITY_X: 2000,
        MAX_VELOCITY_Y: 1000,
        BODY_WIDTH: 14,
        BODY_HEIGHT: 30,
        BODY_OFFSET_X: 9,
        BODY_OFFSET_Y: 2,
        BODY_SPRITE_HEIGHT: 32,  // altura total do frame do sprite (para calcular offset invertido)
        DOUBLE_JUMP_FORCE: -400,
        STOMP_BOUNCE: -400,
        STOMP_TOLERANCE: 8,
    },

    // Passo e pouso são ruído filtrado, não oscilador. O filtro descarta a
    // maior parte do espectro do ruído, então estes volumes precisam ser bem
    // mais altos que os dos sons tonais para soarem equivalentes.
    FOOTSTEP: {
        FREQUENCY: 1400,          // corte do bandpass do passo
        ALT_FOOT_PITCH: 0.85,     // pé alternado soa mais grave
        INTERVAL_SLOW_MS: 290,    // cadência em MIN_SPEED
        INTERVAL_FAST_MS: 170,    // cadência em MAX_SPEED
        VOLUME: 0.32,
        MIN_SPEED: 40,            // abaixo disso conta como parado
    },

    LANDING: {
        MIN_IMPACT_SPEED: 150,    // quedas mais leves não soam
        MAX_IMPACT_SPEED: 750,    // satura o volume
        MIN_VOLUME: 0.3,
        MAX_VOLUME: 0.9,
    },

    WATER: {
        SPEED_MULTIPLIER: 0.5,
        JUMP_FORCE: -150,
        FALL_GRAVITY_EXTRA: 0.1,
        BODY_GRAVITY_OFFSET: -550,
        MAX_FALL_SPEED: 120,
        SURFACE_IMPACT_MAX_SPEED: 55,
        SWIM_FORCE: -300,
        BUBBLE_CHANCE_PERCENT: 5,
        PLAYER_TINT: 0x88ddff,
    },

    TRAMPOLINE: {
        BOUNCE_FORCE: -990,
        COOLDOWN_MS: 200,
        BODY_WIDTH: 32,
        BODY_HEIGHT: 5,
        BODY_OFFSET_Y: 27,
    },

    SPEED_BOOST: {
        DURATION_MS: 500,
        SPEED: 1000,
        COOLDOWN_MS: 300,
        PLAYER_TINT: 0xffff00,
        BODY_WIDTH: 32,
        BODY_HEIGHT: 16,
        BODY_OFFSET_Y: 8,
    },

    ENEMY: {
        BODY_WIDTH: 26,
        BODY_HEIGHT: 32,
        BODY_OFFSET_X: 3,
        MAP_EDGE_MARGIN: 16,
        KILL_DURATION_MS: 200,

        SAPO: {
            PATROL_DISTANCE: 96,
            SPEED: 60,
            JUMP_DISTANCE: 32,
            JUMP_FORCE: -180,
            ANIM_FPS: 6,
        },
        SAPO_VERDE: {
            JUMP_FORCE: -420,
            JUMP_INTERVAL_MS: 1500,
            ANIM_FPS: 6,
        },
        SEAHORSE: {
            BODY_WIDTH: 22,
            BODY_HEIGHT: 30,
            BODY_OFFSET_X: 5,
            BODY_OFFSET_Y: 1,
            ANIM_FPS: 2.5,
            BUBBLE_FRAME_INDEX: 3,
            MUZZLE_OFFSET_X: 12,
            MUZZLE_OFFSET_Y: -4,
        },
    },

    BUBBLE: {
        SIZE: 16,
        BODY_RADIUS: 6,
        SPEED: 45,
        LIFETIME_MS: 3000,
    },

    TRAIL: {
        INTERVAL_MS: 20,
        MAX_SPRITES: 300,
        FADE_DURATION_MS: 3000,
        INITIAL_ALPHA: 0.5,
        TINT: 0x88aaff,
        SHRINK_SCALE: 0.8,
        MOVE_THRESHOLD: 20,
    },

    NEON_LINE: {
        MAX_POINTS: 25,
        POINT_INTERVAL_MS: 16,
        LINE_WIDTH: 4,
        GLOW_WIDTH: 12,
        COLOR: 0x00aaff,
        GLOW_COLOR: 0x0044aa,
        CORE_WIDTH: 2,
        CORE_COLOR: 0xffffff,
        CORE_ALPHA: 0.6,
        LINE_ALPHA: 0.8,
        GLOW_ALPHA: 0.3,
        FADE_SPEED: 0.03,
        MOVE_THRESHOLD: 10,
    },

    NEON_BURST: {
        COLORS: [0x00ffff, 0xff00ff, 0x00ff00, 0xffff00, 0xff6600],
        LAND: { count: 8, speedY: -60, speedX: 80, burst: true },
        JUMP: { count: 5, speedY: 20, speedX: 40, burst: true },
        PLAYER_OFFSET_Y: 14,
    },

    // Brilho ao coletar estrela. Duração longa e easing suave de propósito:
    // é o que separa "magia se dissipando" de "explosão".
    STAR_COLLECT: {
        // Núcleo claro que estoura e apaga rápido
        HALO_RADIUS: 5,
        HALO_SCALE: 3.2,
        HALO_COLOR: 0xfffef0,
        HALO_ALPHA: 0.05,
        HALO_DURATION_MS: 340,

        // Auréola dourada, maior e mais fraca — dá o "glow" em volta do núcleo
        GLOW_RADIUS: 10,
        GLOW_SCALE: 4.2,
        GLOW_COLOR: 0xffd447,
        GLOW_ALPHA: 0.15,
        GLOW_DURATION_MS: 520,

        // Faíscas que sobem e se apagam em tempos diferentes
        SPARKLE_COUNT: 30,
        SPARKLE_MIN_SIZE: 1,
        SPARKLE_MAX_SIZE: 1,
        SPARKLE_MIN_DISTANCE: 55,
        SPARKLE_MAX_DISTANCE: 85,
        SPARKLE_RISE: 12,             // deriva para cima: magia sobe
        SPARKLE_ANGLE_JITTER: 0.35,   // radianos, para não formar anel perfeito
        SPARKLE_MIN_DURATION_MS: 620,
        SPARKLE_MAX_DURATION_MS: 780,
        SPARKLE_STAGGER_MS: 220,       // dissipa aos poucos, não tudo de uma vez
        SPARKLE_COLORS: [0xffffe0, 0xffe9a3, 0xffd447, 0xfff6d0],
    },

    // Celebração ao completar a fase, disparada na bandeira.
    VICTORY: {
        // Respiro entre tocar a bandeira e o overlay aparecer. É o pré-requisito
        // de tudo: sem ele a celebração acontece atrás do retângulo preto, no
        // mesmo frame. No recorde a janela é maior para caber a 2ª pulsação.
        OVERLAY_DELAY_MS: 800,
        OVERLAY_DELAY_RECORD_MS: 1150,

        FLAG_POP_SCALE: 1.35,
        FLAG_POP_MS: 140,

        CAMERA_PUNCH_SCALE: 1.06,
        CAMERA_PUNCH_MS: 120,

        GLOW_RADIUS: 12,
        GLOW_SCALE: 5,
        GLOW_COLOR: 0xffd447,
        GLOW_ALPHA: 0.5,
        GLOW_DURATION_MS: 540,

        // Durações fecham antes do overlay para as faíscas não serem cortadas
        SPARKLE_COUNT: 14,
        SPARKLE_COUNT_RECORD: 24,
        SPARKLE_MIN_SIZE: 1,
        SPARKLE_MAX_SIZE: 4,
        SPARKLE_MIN_DISTANCE: 20,
        SPARKLE_MAX_DISTANCE: 60,
        SPARKLE_RISE: 18,
        SPARKLE_ANGLE_JITTER: 0.35,
        SPARKLE_MIN_DURATION_MS: 420,
        SPARKLE_MAX_DURATION_MS: 700,
        SPARKLE_STAGGER_MS: 80,
        SPARKLE_COLORS: [0xffffff, 0xffe9a3, 0xffd447, 0x9be7ff],
        SPARKLE_COLORS_RECORD: [0xffffff, 0xfff3b0, 0xffd447, 0x7ef0c0],

        CONFETTI_COUNT: 14,
        CONFETTI_COUNT_RECORD: 24,
        CONFETTI_COLORS: [0xff4d6d, 0x4ecdc4, 0xffd447, 0xa855f7, 0x00ff88],
        CONFETTI_SPREAD_X: 90,
        CONFETTI_MIN_RISE: 40,
        CONFETTI_MAX_RISE: 90,
        CONFETTI_MIN_FALL: 90,
        CONFETTI_MAX_FALL: 170,
        CONFETTI_SPIN: 12,
        CONFETTI_MIN_DURATION_MS: 550,
        CONFETTI_MAX_DURATION_MS: 780,

        // 2ª pulsação do recorde. Compartilha o valor com o disparo do som
        // 'newRecord' em VictoryScreen, para os dois ficarem sincronizados.
        RECORD_PULSE_DELAY_MS: 500,
        RECORD_GLOW_COLOR: 0xfff6d0,
        RECORD_GLOW_SCALE_BOOST: 1.3,
    },

    RESPAWN: {
        ARC_HEIGHT: 150,
        MIN_DURATION_MS: 400,
        MAX_DURATION_MS: 800,
        DISTANCE_SPEED_FACTOR: 0.8,
        HURT_TINT: 0xff6666,
    },

    GOAL: {
        BODY_WIDTH: 14,
        BODY_HEIGHT: 28,
        BODY_OFFSET_X: 10,
        BODY_OFFSET_Y: 4,
    },

    MOVING_PLATFORM: {
        SPEED: 80,
    },

    AUTO_SCROLL: {
        SPEED: 80,                      // pixels por segundo
        LEFT_MARGIN: 16,                // distância mínima do player à borda esquerda da câmera
        PUSH_VELOCITY_FACTOR: 3,        // velocidade do empurrão = SPEED × fator (fecha o gap mais rápido)
        SPAWN_CAMERA_OFFSET_RATIO: 0.25,// checkpoint fica a 25% da tela a partir da esquerda
    },

    MUSHROOM: {
        EFFECT_DURATION_MS: 7000,
        FADE_OUT_MS: 800,
        SHADER_SPEED: 1.5,
        SHADER_AMPLITUDE: 0.025,
        SHADER_FREQUENCY: 22.0,
        SHADER_HUE_SPEED: 0.25, // Ciclos completos de matiz por segundo (0 = desliga)
    },

    HEARTS: {
        MAX: 3,
        INVINCIBILITY_MS: 1500,
    },

    LIVES: {
        INITIAL: 5,
    },

    DEPTH: {
        PLAYER: 10,
        FG_DECORATION: 5,
        HUD: 100,
        OVERLAY: 200,
        OVERLAY_TEXT: 201,
        COUNTDOWN: 300,
        DEBUG: 999,
    },
};
