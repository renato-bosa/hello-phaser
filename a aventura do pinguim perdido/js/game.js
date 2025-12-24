// Configuração do jogo - A Aventura do Pinguim Perdido
// Usando Matter.js para física com polígonos

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#87CEEB', // Azul céu como fallback
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 704
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            debug: false // Ativado para ver os polígonos de colisão
        }
    },
    plugins: {
        global: [{
            key: 'rexVirtualJoystick',
            plugin: rexvirtualjoystickplugin,
            start: true
        }]
    },
    scene: [GameScene]
};

const game = new Phaser.Game(config);

