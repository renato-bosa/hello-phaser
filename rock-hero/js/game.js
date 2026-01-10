/**
 * ROCK HERO - Configuração Principal do Phaser 3
 * 
 * Arquitetura:
 * - GameData.js: Dados compartilhados (rankings, progresso, config)
 * - MenuScene.js: Menu principal
 * - GameScene.js: Gameplay
 * 
 * Debug: Adicione ?fps=true na URL para mostrar contador de FPS
 */

// Verifica se deve mostrar FPS
const showFPS = window.location.search.includes('fps=true');

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
    
    // Contador de FPS nativo do Phaser (mais preciso)
    fps: {
        target: 60,
        forceSetTimeOut: false
    },
    
    // Ordem: MenuScene primeiro (cena inicial)
    scene: [MenuScene, WorldMapScene, CharacterSelectScene, GameScene, WorldCompleteScene],
    
    // Callbacks para debug de FPS
    callbacks: {
        postBoot: function(game) {
            if (showFPS) {
                // Cria elemento HTML para mostrar FPS
                const fpsDiv = document.createElement('div');
                fpsDiv.id = 'fps-counter';
                fpsDiv.style.cssText = `
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    background: rgba(0,0,0,0.8);
                    color: #00ff00;
                    padding: 5px 10px;
                    font-family: monospace;
                    font-size: 14px;
                    z-index: 9999;
                    border-radius: 4px;
                `;
                document.body.appendChild(fpsDiv);
                
                // Atualiza FPS a cada frame
                setInterval(() => {
                    const fps = Math.round(game.loop.actualFps);
                    const color = fps >= 55 ? '#00ff00' : fps >= 30 ? '#ffff00' : '#ff0000';
                    fpsDiv.innerHTML = `FPS: <span style="color:${color}">${fps}</span>`;
                }, 100);
            }
        }
    }
};

// Inicia o jogo
const game = new Phaser.Game(config);
