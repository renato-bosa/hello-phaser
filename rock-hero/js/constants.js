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
        COYOTE_DURATION_MS: 150,
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
        MIN_VOLUME: 0.15,
        MAX_VOLUME: 0.45,
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
        // Como o tomate, mas patrulha curta (1 bloco p/ cada lado = 2 no total)
        // e salto = metade da altura do sapo verde (−420 → −210).
        SAPO_ROXO: {
            PATROL_DISTANCE: 32,
            SPEED: 60,
            JUMP_DISTANCE: 32,
            JUMP_FORCE: -210,
            ANIM_FPS: 6,
        },
        // Chefe do Mundo 1: mesma patrulha do sapo roxo, em sprite 64x64.
        SAPO_CHEFE_LARANJA: {
            PATROL_DISTANCE: 64,
            SPEED: 60,
            JUMP_DISTANCE: 32,
            JUMP_FORCE: -210,
            ANIM_FPS: 6,
            MAX_HEALTH: 4,
            CRUSHED_DURATION_MS: 700,
            ATTACK_BASE_DURATION_MS: 2000,
            ATTACK_DURATION_GROWTH: 1.5,
            ATTACK_SPEED_MULTIPLIER: 2.4,
            FLASH_INTERVAL_MS: 90,
            ELECTRIC_BOLT_COUNT: 9,
            ELECTRIC_EFFECT_ALPHA: 0.78,
            ELECTRIC_GLOW_COLOR: 0x33ddff,
            ELECTRIC_CORE_COLOR: 0xeeffff,
            CRUSHED_SCALE_X: 1.25,
            CRUSHED_SCALE_Y: 0.45,
            ATTACK_SCALE_X: 1.08,
            ATTACK_SCALE_Y: 0.92,
            DEATH_CHARGE_MS: 1040,
            DEATH_POP_MS: 850,
            DEATH_EFFECT_DURATION_SCALE: 2.5,
            DEATH_SOUND_FREQUENCY: 620,
            DEATH_SOUND_DURATION: 1.1,
            DEATH_SOUND_DECAY: 1.0,
            DEATH_SOUND_SLIDE: -420,
            BODY_WIDTH: 52,
            BODY_HEIGHT: 56,
            BODY_OFFSET_X: 6,
            BODY_OFFSET_Y: 8,
        },
        SAPO_VERDE: {
            JUMP_FORCE: -420,
            JUMP_INTERVAL_MS: 1500,
            ANIM_FPS: 6,
        },
        TOUPEIRA: {
            SCALE: 1.1,
            ACTIVATION_DISTANCE: 160, // 5 blocos de 32 px
            EMERGE_DELAY_MS: 250,
            SPEED: 70,
            ANIM_FPS: 6,
            BODY_WIDTH: 24,
            BODY_HEIGHT: 24,
            BODY_OFFSET_X: 4,
            BODY_OFFSET_Y: 8,
            // Sondagem à frente dos pés (px): borda para buracos; ~1 tile p/ achar pouso acima.
            LOOK_AHEAD_EDGE_PX: 4,
            LOOK_AHEAD_STEP_PX: 32,
            MAX_DROP_TILES: 1,
            MAX_STEP_TILES: 1,
            STEP_JUMP_MARGIN_PX: 6,   // folga mínima acima de 1 tile
            STEP_JUMP_COOLDOWN_MS: 350,
        },
        // Chefe do Mundo 2: perseguição de toupeira + buracos + ataque elétrico.
        TOUPEIRA_CHEFE: {
            SCALE: 1.0,
            ACTIVATION_DISTANCE: 200,
            EMERGE_DELAY_MS: 250,
            EMERGE_PROCEDURAL_MS: 280,
            REAPPEAR_DELAY_MS: 300,
            EMERGE_SHAKE_MS: 500,
            EMERGE_SHAKE_INTENSITY: 0.007,
            SPEED: 70,
            FLEE_SPEED_MULTIPLIER: 4.0,
            ATTACK_SPEED_MULTIPLIER: 4.0,
            ANIM_FPS: 6,
            MAX_HEALTH: 4,
            CRUSHED_DURATION_MS: 700,
            CRUSHED_SCALE_X: 1.25,
            CRUSHED_SCALE_Y: 0.45,
            ATTACK_BASE_DURATION_MS: 2000,
            ATTACK_DURATION_GROWTH: 1.5,
            HOLE_REACH_DISTANCE: 36,
            // 64×64 ≈ 2× a toupeira comum → degraus/quedas de até 2 tiles
            LOOK_AHEAD_EDGE_PX: 4,
            LOOK_AHEAD_STEP_PX: 64,
            MAX_DROP_TILES: 2,
            MAX_STEP_TILES: 2,
            STEP_JUMP_MARGIN_PX: 8,
            STEP_JUMP_COOLDOWN_MS: 350,
            CAN_JUMP_PRISON: true,
            PRISON_JUMP_MARGIN_PX: 12,
            PRISON_LOOK_AHEAD_PX: 56,
            FLASH_INTERVAL_MS: 90,
            ELECTRIC_BOLT_COUNT: 9,
            ELECTRIC_EFFECT_ALPHA: 0.78,
            ELECTRIC_GLOW_COLOR: 0x33ddff,
            ELECTRIC_CORE_COLOR: 0xeeffff,
            ATTACK_SCALE_X: 1.08,
            ATTACK_SCALE_Y: 0.92,
            DEATH_CHARGE_MS: 1040,
            DEATH_POP_MS: 850,
            DEATH_EFFECT_DURATION_SCALE: 2.5,
            DEATH_SOUND_FREQUENCY: 620,
            DEATH_SOUND_DURATION: 1.1,
            DEATH_SOUND_DECAY: 1.0,
            DEATH_SOUND_SLIDE: -420,
            BODY_WIDTH: 48,
            BODY_HEIGHT: 52,
            BODY_OFFSET_X: 8,
            BODY_OFFSET_Y: 12,
            WALK_TEXTURE: 'toupeiroudo-64x64-6fps',
            WALK_ANIM: 'toupeira-chefe-walk',
            FRAME_END: 3,
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
        BONECO: {
            SCALE: 2,               // mesmo sprite 32×32, só ampliado na tela
            PATROL_DISTANCE: 32,    // 1 bloco para cada lado
            SPEED: 40,
            ANIM_FPS: 14,
            FRAME_END: 6,           // frames 0–6 preenchidos no sheet
            VULNERABLE_FRAMES: { start: 1, end: 2 },
            VULNERABLE_MS: 1000,
            // Estouro na 2ª pisada
            POP_DURATION_MS: 180,
            POP_GLOW_RADIUS: 10,
            POP_GLOW_SCALE: 5,
            POP_GLOW_MS: 280,
            POP_SPARKLE_COUNT: 18,
            POP_SPARKLE_MIN_SIZE: 2,
            POP_SPARKLE_MAX_SIZE: 6,
            POP_SPARKLE_MIN_DIST: 28,
            POP_SPARKLE_MAX_DIST: 70,
            POP_SPARKLE_MS: 420,
            POP_COLORS: [0xff4d4d, 0xffd447, 0xffffff, 0xff8844, 0xff66aa],
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

        CAMERA_PUNCH_SCALE: 2.5,
        CAMERA_PUNCH_MS: 400,

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

        CONFETTI_COUNT: 21,
        CONFETTI_COUNT_RECORD: 42,
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

    // Vento horizontal (WindSystem): uma senoide controla tudo.
    // sample = sin(ωt + φ) ∈ [-1, 1]
    //   polaridade (sign) → direção
    //   |sample|          → intensidade
    //   force = sample × MAX_SPEED
    // PERIOD_S = ciclo completo (ida+volta). Cada lado dura ~PERIOD_S/2.
    WIND: {
        MAX_SPEED: 70,              // px/s no pico (|sample| = 1)
        PERIOD_S: 20,               // ciclo completo (~10s soprando cada lado)
        INDICATOR_BARS: 3,

        // Poeira: fluxo contínuo cuja opacidade e densidade acompanham a
        // intensidade do vento (|sample|). Densa/opaca no pico, some na calmaria.
        DIR_FLIP_DEADZONE: 0.12,    // |sample| abaixo disso = neutro (segura o último lado)
        DUST_MIN_INTENSITY: 0.15,   // abaixo disso não gera poeira (perto do zero)
        DUST_MIN_SIZE: 2,
        DUST_MAX_SIZE: 8,
        DUST_DURATION_MS: 1000,
        DUST_Y_DRIFT: 18,
        DUST_MAX_ALPHA: 0.5,        // opacidade no pico do vento (intensity = 1)
        DUST_INTERVAL_MS: 70,       // base entre partículas (÷ intensity: mais forte = mais densa)
        DUST_PER_TICK: 1,           // partículas por tick
        DUST_COLORS: [0xc4b59a, 0xd4c4a8, 0xb8a890, 0xe8dcc8],
        DUST_DEPTH: 50,             // acima do gameplay, abaixo do HUD
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

    // Item coletável que restaura 1 coração (só coleta se hearts < MAX)
    HEART_PICKUP: {
        BODY_SIZE: 20,          // coração 20×20 no centro do frame 32×32
        BODY_OFFSET: 6,         // (32 - 20) / 2
        BOB_OFFSET_Y: 4,
        BOB_DURATION_MS: 1000,
    },

    LIVES: {
        INITIAL: 5,
    },

    DEPTH: {
        PLAYER: 10,
        FG_DECORATION: 15,
        HUD: 100,
        OVERLAY: 200,
        OVERLAY_TEXT: 201,
        COUNTDOWN: 300,
        DEBUG: 999,
    },
};
