/**
 * Variante de ordem de fases (mundos-proposta)
 *
 * Espelha a ordem padrão atual (`GameConfig.js` ← proposta2).
 * O toggle DEV “Ordem Proposta” continua disponível, mas ambas
 * as variantes são iguais até surgir uma nova proposta.
 *
 * Mapas “Off” (map0-0, map9, map-19-upsidedown) ficam de fora.
 */

window.GameConfigVariants = window.GameConfigVariants || {};

GameConfigVariants.proposta = {
    WORLDS: [
        {
            id: 1,
            name: 'Mundo 1',
            subtitle: 'O Resgate do Baterista',
            levels: [0, 1, 2, 3, 4, 20], // mapas existentes + chefe do Mundo 1
            rescuedCharacter: 'baterista',
            celebrationMessage: 'Você resgatou o Baterista!',
            theme: 'grass',
            bgColor: 0x87CEEB,
            pathColor: 0x8B4513,
            bgImage: 'assets/spritesheets/worldmap-backgrounds/world1.png'
        },
        {
            id: 2,
            name: 'Mundo 2',
            subtitle: 'O Resgate do Baixista',
            levels: [5, 6, 7, 8, 9, 21], // + chefe do Mundo 2
            rescuedCharacter: 'baixista',
            celebrationMessage: 'Você resgatou o Baixista!',
            theme: 'cave',
            bgColor: 0x1a1a2e,
            pathColor: 0x4a4a6a,
            bgImage: 'assets/spritesheets/worldmap-backgrounds/world2.png'
        },
        {
            id: 3,
            name: 'Mundo 3',
            subtitle: 'O Resgate do Guitarrista',
            levels: [10, 11, 12, 13, 14], // map10, map11, map12, map16, map17
            rescuedCharacter: 'guitarrista',
            celebrationMessage: 'Você resgatou o Guitarrista!',
            theme: 'water',
            bgColor: 0x0a2a4a,
            pathColor: 0x2288aa,
            bgImage: 'assets/spritesheets/worldmap-backgrounds/world3.png'
        },
        {
            id: 4,
            name: 'Mundo 4',
            subtitle: 'Mecânicas Experimentais',
            levels: [15, 16, 17, 18, 19], // map18 … map22
            rescuedCharacter: 'vocalista',
            celebrationMessage: 'Mecânicas dominadas!',
            theme: 'special',
            bgColor: 0x1a0a2e,
            pathColor: 0x8844aa,
            bgImage: 'assets/spritesheets/worldmap-backgrounds/world4.png'
        },
        {
            id: 5,
            name: 'Mundo 5',
            subtitle: 'Ecos da Catedral',
            levels: [22, 23, 24], // Catedral do Eco … Carrilhão de Ferro
            rescuedCharacter: 'vocalista',
            celebrationMessage: 'O eco responde!',
            theme: 'special',
            bgColor: 0x0a0618,
            pathColor: 0xaa66cc,
            bgImage: 'assets/spritesheets/worldmap-backgrounds/world4.png'
        }
    ],

    LEVELS: [
        // Mundo 1: map0-1 → map2-0 → map-3 → map-ultima-mundo1 → map-4
        {
            key: 'map0-1',
            file: 'assets/map0-1.json',
            name: 'Descobrindo o mundo',
            zoom: 1.0,
            roundPixels: true,
            world: 1,
            mapPosition: { x: 55, y: 200 },
            connectsTo: [1]
        },
        {
            key: 'map2-0',
            file: 'assets/map2-0.json',
            name: 'Seguindo em frente',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 145, y: 170 },
            connectsTo: [2]
        },
        {
            key: 'map3',
            file: 'assets/map-3--desafio do luigi.json',
            name: 'Sapos e lava',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 235, y: 220 },
            connectsTo: [3]
        },
        {
            key: 'map-ultima-mundo1',
            file: 'assets/map-ultima-mundo1.json',
            name: 'O Último Desafio',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 325, y: 180 },
            connectsTo: [4]
        },
        {
            key: 'map4',
            file: 'assets/map-4--big-jumps.json',
            name: 'Os Pulos Maiores',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 415, y: 200 },
            connectsTo: [20]
        },
        // Mundo 2: map-5 → map-6 → map-2 → map-8 → map-7
        {
            key: 'map5',
            file: 'assets/map-5--caverna.json',
            name: 'Cristais Fascinantes',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 95, y: 200 },
            connectsTo: [6]
        },
        {
            key: 'map6',
            file: 'assets/map-6--caverna2.json',
            name: 'Ative o turbo!',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 180, y: 160 },
            connectsTo: [7]
        },
        {
            key: 'map2',
            file: 'assets/map-2--expansion and speed.json',
            name: 'Pulos decisivos',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 265, y: 210 },
            connectsTo: [8]
        },
        {
            key: 'map8',
            file: 'assets/map-8.json',
            name: 'Simples',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 355, y: 180 },
            connectsTo: [9]
        },
        {
            key: 'map7',
            file: 'assets/map-7--planicie.json',
            name: 'Caos de anfíbios',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 440, y: 220 },
            connectsTo: [21]
        },
        // Mundo 3: map-10 → map-11 → map-12 → map-16 → map-17
        {
            key: 'map10',
            file: 'assets/map-10.json',
            name: 'Ruínas Submersas',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 95, y: 200 },
            connectsTo: [11]
        },
        {
            key: 'map11',
            file: 'assets/map-11.json',
            name: 'Labirinto de Lava',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 195, y: 185 },
            connectsTo: [12],
            features: { doubleJump: true, neonLineTrail: true }
        },
        {
            key: 'map12',
            file: 'assets/map-12.json',
            name: 'Abismo Submerso',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 305, y: 215 },
            connectsTo: [13]
        },
        {
            key: 'map16',
            file: 'assets/map-16.json',
            name: 'Ascensão Abissal',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 415, y: 185 },
            connectsTo: [14],
            features: { doubleJump: true, neonLineTrail: true }
        },
        {
            key: 'map17',
            file: 'assets/map-17.json',
            name: 'Areia e Profundezas',
            zoom: 0.9,
            roundPixels: false,
            world: 3,
            mapPosition: { x: 515, y: 210 },
            connectsTo: [],
            features: { doubleJump: true, neonLineTrail: true }
        },
        // Mundo 4: map-18 → map-19 → map-20 → map-21 → map-22
        {
            key: 'map18',
            file: 'assets/map-18.json',
            name: 'Abismo Final',
            zoom: 0.9,
            roundPixels: false,
            world: 4,
            mapPosition: { x: 95, y: 205 },
            connectsTo: [16],
            features: { doubleJump: true, neonLineTrail: true }
        },
        {
            key: 'map19',
            file: 'assets/map-19.json',
            name: 'Ponta-Cabeça',
            zoom: 1.0,
            roundPixels: true,
            world: 4,
            mapPosition: { x: 200, y: 170 },
            connectsTo: [17],
            features: { upsideDown: true, wind: true }
        },
        {
            key: 'map20',
            file: 'assets/map-20-auto-rolagem.json',
            name: 'Sem Parar!',
            zoom: 1.0,
            roundPixels: true,
            world: 4,
            mapPosition: { x: 305, y: 215 },
            connectsTo: [18],
            features: { autoScroll: true }
        },
        {
            key: 'map21',
            file: 'assets/map-21-nuvens.json',
            name: 'Entre Nuvens',
            zoom: 1.0,
            roundPixels: true,
            world: 4,
            mapPosition: { x: 415, y: 165 },
            connectsTo: [19],
            features: { wind: true }
        },
        {
            key: 'map22',
            file: 'assets/map-22-octopus.json',
            name: 'Mar do Polvo',
            zoom: 0.9,
            roundPixels: false,
            world: 4,
            mapPosition: { x: 520, y: 210 },
            connectsTo: []
        },
        {
            key: 'map-chefe-mundo1',
            file: 'assets/map-chefe-mundo1.json',
            name: 'Chefe do Mundo 1',
            zoom: 0.9,
            roundPixels: false,
            world: 1,
            mapPosition: { x: 520, y: 170 },
            connectsTo: []
        },
        {
            key: 'map-chefe-mundo2',
            file: 'assets/map-chefe-mundo2.json',
            name: 'Chefe do Mundo 2',
            zoom: 0.9,
            roundPixels: false,
            world: 2,
            mapPosition: { x: 525, y: 180 },
            connectsTo: []
        },
        {
            key: 'map23',
            file: 'assets/map-23-catedral-do-eco.json',
            name: 'Catedral do Eco',
            zoom: 0.9,
            roundPixels: false,
            world: 5,
            mapPosition: { x: 150, y: 235 },
            connectsTo: [23],
            features: { doubleJump: true, neonLineTrail: true }
        },
        {
            key: 'map24',
            file: 'assets/map-24-cisternas.json',
            name: 'Cisternas do Órgão',
            zoom: 0.9,
            roundPixels: false,
            world: 5,
            mapPosition: { x: 330, y: 190 },
            connectsTo: [24],
            features: { waterPhysics: true, neonLineTrail: true }
        },
        {
            key: 'map25',
            file: 'assets/map-25-carrilhao.json',
            name: 'Carrilhão de Ferro',
            zoom: 0.9,
            roundPixels: false,
            world: 5,
            mapPosition: { x: 510, y: 240 },
            connectsTo: [],
            features: { doubleJump: true, neonLineTrail: true }
        }
    ]
};
