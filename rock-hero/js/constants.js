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
        DOUBLE_JUMP_FORCE: -400,
        STOMP_BOUNCE: -400,
        STOMP_TOLERANCE: 8,
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
            ANIM_FPS: 4,
            BUBBLE_FRAME_INDEX: 3,
            MUZZLE_OFFSET_X: 12,
            MUZZLE_OFFSET_Y: -4,
        },
    },

    BUBBLE: {
        SIZE: 16,
        BODY_RADIUS: 6,
        SPEED: 140,
        LIFETIME_MS: 4000,
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
