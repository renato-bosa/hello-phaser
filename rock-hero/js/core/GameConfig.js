/**
 * GAME CONFIG - Constantes estáticas e dados imutáveis
 *
 * Centraliza dados de configuração que NÃO mudam em runtime:
 * - Lista de personagens (CHARACTERS)
 * - Lista de mundos (WORLDS)
 * - Lista de fases (LEVELS)
 * - Valores padrão (DEFAULTS)
 * - Limites do sistema (MAX_SLOTS)
 * - Chaves de localStorage (STORAGE_KEYS)
 * - Defaults de feature flags (FEATURES_DEFAULTS)
 *
 * Sem lógica, sem state mutável. É a "fonte da verdade" estática do jogo.
 */

const GameConfig = {
    // ==================== SLOTS ====================
    MAX_SLOTS: 4,
    STORAGE_KEYS: {
        SLOTS: 'rockHero_slots',
        ACTIVE: 'rockHero_activeSlot'
    },

    // ==================== FEATURE FLAGS DEFAULTS ====================
    // Valores iniciais das feature flags. FeatureFlags (Fase 4) usa
    // este objeto como ponto de partida e permite override via URL/menu.
    FEATURES_DEFAULTS: {
        // ===== EFEITOS VISUAIS =====
        playerTrail: true,
        starParticles: false,
        dustEffect: false,
        jumpNeonBurst: false,
        landNeonBurst: false,
        neonLineTrail: false,
        screenShake: false,
        victorySlowMo: false,

        // ===== MECÂNICAS DE FÍSICA =====
        doubleJump: false,
        waterPhysics: true,
        autoScroll: false,
        upsideDown: false,
    },

    // ==================== PERSONAGENS ====================
    // Definição centralizada de sprites - todas as cenas usam isso
    CHARACTERS: [
        {
            id: 'vocalista',
            name: 'Vocalista',
            instrument: 'Voz',
            unlockedByDefault: true,
            sprites: {
                idle: {
                    key: 'hero-idle',
                    file: 'assets/spritesheets/still-hero.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                walk: {
                    key: 'hero-walk',
                    file: 'assets/spritesheets/walking-hero2.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 14
                },
                jump: {
                    key: 'hero-jump',
                    file: 'assets/spritesheets/jumping-hero.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                }
                // Vocalista não tem walk-left separado, usa flip
            }
        },
        {
            id: 'baterista',
            name: 'Baterista',
            instrument: 'Bateria',
            unlockedByDefault: false,
            unlockedByWorld: 1,
            sprites: {
                idle: {
                    key: 'baterista-idle',
                    file: 'assets/spritesheets/baterista-parado-animado-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                walk: {
                    key: 'baterista-walk',
                    file: 'assets/spritesheets/baterista-andando-pra-direita-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                'walk-left': {
                    key: 'baterista-walk-left',
                    file: 'assets/spritesheets/baterista-andando-pra-esq-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                jump: null // TODO: criar sprite de pulo (usa idle por enquanto)
            }
        },
        {
            id: 'baixista',
            name: 'Baixista',
            instrument: 'Baixo',
            unlockedByDefault: false,
            unlockedByWorld: 2,
            sprites: {
                idle: {
                    key: 'baixista-idle',
                    file: 'assets/spritesheets/baixista-parado-animado-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                walk: {
                    key: 'baixista-walk',
                    file: 'assets/spritesheets/baixista-andando2-dir-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                'walk-left': {
                    key: 'baixista-walk-left',
                    file: 'assets/spritesheets/baixista-andando-esq-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                jump: null // TODO: criar sprite de pulo (usa idle por enquanto)
            }
        },
        {
            id: 'guitarrista',
            name: 'Guitarrista',
            instrument: 'Guitarra',
            unlockedByDefault: false,
            unlockedByWorld: 3,
            sprites: {
                idle: {
                    key: 'guitarrista-idle',
                    file: 'assets/spritesheets/Guitarrista-parado-2-animado3-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                walk: {
                    key: 'guitarrista-walk',
                    file: 'assets/spritesheets/Guitarrista-andando-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                'walk-left': {
                    key: 'guitarrista-walk-left',
                    file: 'assets/spritesheets/Guitarrista-andando-6fps.png',
                    frameWidth: 32, frameHeight: 32,
                    startFrame: 0, endFrame: 3,
                    frameRate: 6
                },
                jump: null // TODO: criar sprite de pulo (usa idle por enquanto)
            }
        }
        // Futuros personagens: tecladista...
    ],

    // ==================== MUNDOS ====================
    WORLDS: [
        {
            id: 1,
            name: 'Mundo 1',
            subtitle: 'O Resgate do Baterista',
            levels: [0, 1, 2, 3, 4], // Índices das fases (0-4 = fases 0-1 até 4)
            rescuedCharacter: 'baterista',
            celebrationMessage: 'Você resgatou o Baterista!',
            // Visual no WorldMap
            theme: 'grass',
            bgColor: 0x87CEEB, // Azul céu (fallback caso bgImage não carregue)
            pathColor: 0x8B4513, // Marrom terra
            bgImage: 'assets/spritesheets/worldmap-backgrounds/world1.png'
        },
        {
            id: 2,
            name: 'Mundo 2',
            subtitle: 'O Resgate do Baixista',
            levels: [5, 6, 7, 8, 9], // 5 fases (map5 a map10)
            rescuedCharacter: 'baixista',
            celebrationMessage: 'Você resgatou o Baixista!',
            // Visual no WorldMap (tema caverna/noturno)
            theme: 'cave',
            bgColor: 0x1a1a2e, // Azul escuro noturno
            pathColor: 0x4a4a6a // Cinza arroxeado
        },
        {
            id: 3,
            name: 'Mundo 3',
            subtitle: 'O Resgate do Guitarrista',
            levels: [10, 11, 12, 13, 14], // 5 fases (map11, map12, map16, map17, map18)
            rescuedCharacter: 'guitarrista',
            celebrationMessage: 'Você resgatou o Guitarrista!',
            // Visual no WorldMap (tema aquático)
            theme: 'water',
            bgColor: 0x0a2a4a, // Azul profundo
            pathColor: 0x2288aa // Azul água
        },
        {
            id: 4,
            name: 'Mundo 4',
            subtitle: 'Mecânicas Experimentais',
            levels: [15, 16, 17],
            rescuedCharacter: 'vocalista',
            celebrationMessage: 'Mecânicas dominadas!',
            theme: 'special',
            bgColor: 0x1a0a2e,
            pathColor: 0x8844aa
        }
    ],

    // ==================== FASES ====================
    LEVELS: [
        {
            key: 'map0-0',
            file: 'assets/map0-0.json',
            name: 'Primeiros Passos',
            zoom: 1,
            roundPixels: true,
            world: 1,
            // Posição no WorldMap (relativa ao mundo)
            mapPosition: { x: 80, y: 200 },
            connectsTo: [1] // Conecta à fase 1
        },
        {
            key: 'map0-1',
            file: 'assets/map0-1.json',
            name: 'Descobrindo o mundo',
            zoom: 1.0,
            roundPixels: true,
            world: 1,
            mapPosition: { x: 160, y: 190 },
            connectsTo: [2] // Conecta à fase 2
        },
        {
            key: 'map2',
            file: 'assets/map-2--expansion and speed.json',
            name: 'Pulos decisivos',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 240, y: 180 },
            connectsTo: [3]
        },
        {
            key: 'map3',
            file: 'assets/map-3--desafio do luigi.json',
            name: 'Sapos e lava',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 340, y: 220 },
            connectsTo: [4]
        },
        {
            key: 'map4',
            file: 'assets/map-4--big-jumps.json',
            name: 'Os Pulos Maiores',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 440, y: 180 },
            connectsTo: [] // Última fase do mundo
        },
        // ==================== MUNDO 2 ====================
        {
            key: 'map5',
            file: 'assets/map-5--caverna.json',
            name: 'Cristais Fascinantes',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 80, y: 200 },
            connectsTo: [6]
        },
        {
            key: 'map6',
            file: 'assets/map-6--caverna2.json',
            name: 'Ative o turbo!',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 170, y: 160 },
            connectsTo: [7]
        },
        {
            key: 'map7',
            file: 'assets/map-7--planicie.json',
            name: 'Caos de anfíbios',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 270, y: 210 },
            connectsTo: [8]
        },
        {
            key: 'map8',
            file: 'assets/map-8.json',
            name: 'Simples',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 370, y: 180 },
            connectsTo: [9] // Conecta à fase 10 (map10)
        },
        /*
        {
            key: 'map9',
            file: 'assets/map9.json',
            name: 'Águas Profundas',
            zoom: 1.0,
            roundPixels: true,
            world: 2,
            mapPosition: { x: 580, y: 220 },
            connectsTo: []
        },
        */
        {
            key: 'map10',
            file: 'assets/map-10.json',
            name: 'Ruínas Submersas',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 460, y: 220 },
            connectsTo: [] // Última fase do mundo 2
        },
        {
            key: 'map11',
            file: 'assets/map-11.json',
            name: 'Labirinto de Lava',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 85, y: 200 },
            connectsTo: [11], // Conecta ao map12 (índice 11)
            // Features ativadas automaticamente nesta fase
            features: { doubleJump: true, neonLineTrail: true }
        },
        {
            key: 'map12',
            file: 'assets/map-12.json',
            name: 'Abismo Submerso',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 195, y: 215 },
            connectsTo: [12]
        },
        {
            key: 'map16',
            file: 'assets/map-16.json',
            name: 'Ascensão Abissal',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 305, y: 185 },
            connectsTo: [13],
            features: { doubleJump: true, neonLineTrail: true }
        },
        {
            key: 'map17',
            file: 'assets/map-17.json',
            name: 'Areia e Profundezas',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 415, y: 215 },
            connectsTo: [14],
            features: { doubleJump: true, neonLineTrail: true }
        },
        {
            key: 'map18',
            file: 'assets/map-18.json',
            name: 'Abismo Final',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 515, y: 195 },
            connectsTo: [],
            features: { doubleJump: true, neonLineTrail: true }
        },
        // ==================== MUNDO 4 — Mecânicas Experimentais ====================
        {
            key: 'map19',
            file: 'assets/map-19.json',
            name: 'Ponta-Cabeça',
            zoom: 1.0,
            roundPixels: true,
            world: 4,
            mapPosition: { x: 120, y: 200 },
            connectsTo: [16],
            features: { upsideDown: true }
        },
        {
            key: 'map20',
            file: 'assets/map-20-auto-rolagem.json',
            name: 'Sem Parar!',
            zoom: 1.0,
            roundPixels: true,
            world: 4,
            mapPosition: { x: 370, y: 200 },
            connectsTo: [17],
            features: { autoScroll: true }
        },
        {
            key: 'map21',
            file: 'assets/map-21-nuvens.json',
            name: 'Entre Nuvens',
            zoom: 1.0,
            roundPixels: true,
            world: 4,
            mapPosition: { x: 560, y: 200 },
            connectsTo: []
        }
    ],

    // ==================== CUTSCENES ====================
    // Sequências de imagens pré-renderizadas exibidas via CutsceneScene.
    //
    // Cada cutscene tem:
    // - frames: array de { file } — caminho da imagem pré-renderizada
    // - unlockMs: ms mínimos antes de liberar avanço manual em cada frame
    // - fadeMs: duração do crossfade entre frames
    // - bgColor: cor de fundo (letterbox se imagem não cobrir o canvas)
    //
    // Para adicionar uma nova cutscene: criar nova entrada + chamar
    //   scene.start('CutsceneScene', { cutsceneId: 'X', next: { scene: 'Y', data: {} } })
    CUTSCENES: {
        opening: {
            frames: [
                { file: 'assets/spritesheets/cutscenes/cut-scene1-abertura-1-6.png' },
                { file: 'assets/spritesheets/cutscenes/cut-scene1-abertura-2-6.png' },
                { file: 'assets/spritesheets/cutscenes/cut-scene1-abertura-3-6.png' },
                { file: 'assets/spritesheets/cutscenes/cut-scene1-abertura-4-6.png' },
                { file: 'assets/spritesheets/cutscenes/cut-scene1-abertura-5-6.png' },
                { file: 'assets/spritesheets/cutscenes/cut-scene1-abertura-6-6.png' }
            ],
            unlockMs: 2000,
            fadeMs: 600,
            bgColor: 0x000000
        }
    },

    // ==================== VALORES PADRÃO ====================
    DEFAULTS: {
        zoom: 1.0,
        roundPixels: true,
        gravity: 800,
        playerSpeed: { min: 160, max: 260 },
        jumpForce: -480
    }
};

window.GameConfig = GameConfig;
