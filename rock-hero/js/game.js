/**
 * ROCK HERO - Configuração Principal do Phaser 3
 * 
 * Arquitetura:
 * - GameData.js: Dados compartilhados (rankings, progresso, config)
 * - MenuScene.js: Menu principal
 * - GameScene.js: Gameplay
 */

const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 352,
    parent: 'game-container',
    pixelArt: true,
    
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            fps: 120, // Evita tunneling
            debug: false
        }
    },
    
    // Ordem: MenuScene primeiro (cena inicial)
    scene: [MenuScene, GameScene]
};

// Inicia o jogo
const game = new Phaser.Game(config);
