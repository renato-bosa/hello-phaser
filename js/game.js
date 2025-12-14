/**
 * ROCK HERO - Configuração Principal do Phaser 3
 * 
 * Este arquivo configura o jogo e inicia o Phaser.
 */

const config = {
    // Tipo de renderização (AUTO escolhe WebGL ou Canvas automaticamente)
    type: Phaser.AUTO,
    
    // Tamanho base do jogo (mesmo tamanho do mapa: 20 tiles × 32px)
    width: 640,
    height: 352,
    
    // Onde o jogo será renderizado
    parent: 'game-container',
    
    // Configuração de pixel art (mantém pixels nítidos, sem blur)
    pixelArt: true,
    
    // Configuração de escala - ocupa toda a tela mantendo proporção
    scale: {
        mode: Phaser.Scale.FIT,           // Escala para caber na tela
        autoCenter: Phaser.Scale.CENTER_BOTH, // Centraliza horizontal e vertical
    },
    
    // Configuração da física - Arcade Physics
    physics: {
        default: 'arcade',
        arcade: {
            // Gravidade puxando para baixo
            gravity: { y: 800 },
            // Debug: true mostra as hitboxes (útil para desenvolvimento)
            debug: false
        }
    },
    
    // Cenas do jogo (por enquanto só temos uma)
    scene: [GameScene]
};

// Cria e inicia o jogo!
const game = new Phaser.Game(config);
