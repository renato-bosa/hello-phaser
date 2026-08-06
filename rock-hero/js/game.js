/**
 * ROCK HERO - Configuração Principal do Phaser 3
 * 
 * Arquitetura:
 * - GameData.js: Dados compartilhados (rankings, progresso, config)
 * - MenuScene.js: Menu principal
 * - GameScene.js: Gameplay
 * 
 * Debug:
 * - ?fps=true         → Mostra contador de FPS
 * - ?debug=true       → Mostra hitboxes (bodies + tiles da layer solids)
 * - ?mapDebug=true    → Logs no console: cursor do mapa / saveMapPosition / loadMapPosition
 * - ?dev=true         → Exibe o botão "DEV OPTIONS" no menu principal (toggles de efeitos/mecânicas)
 * - ?wind=true        → Ativa vento horizontal variável (desliga sozinho em água/auto-scroll)
 * - ?music=false      → Desliga a trilha sonora (BGM) — útil durante desenvolvimento
 * - ?musicVolume=0.6  → Volume inicial da trilha sonora (0..1). Default: 0.4
 * - ?crossfadeMs=1500 → Duração do cross-fade entre faixas (ms). Default: 2000. Zero = corte seco.
 * - ?levelOrder=proposta → Força ordem de fases da proposta (também via DEV OPTIONS)
 * - ?waterPhysicsVariant=experimental → Física de água com limiter de queda (DEV OPTIONS)
 */

// Parâmetros de debug via URL
const urlParams = new URLSearchParams(window.location.search);
const showFPS = urlParams.get('fps') === 'true';
const showDebug = urlParams.get('debug') === 'true';

// Ordem de fases: URL sobrescreve Settings (sem persistir o param sozinho).
(function applyLevelOrderFromSettings() {
    const urlOrder = urlParams.get('levelOrder');
    let order = Settings.get('levelOrder') || GameConfig.LEVEL_ORDER.DEFAULT;
    if (urlOrder === GameConfig.LEVEL_ORDER.PROPOSTA || urlOrder === GameConfig.LEVEL_ORDER.DEFAULT) {
        order = urlOrder;
    }
    if (order !== GameConfig.LEVEL_ORDER.DEFAULT) {
        GameConfig.LEVEL_ORDER.apply(order);
    }
})();

// Variante de física de água via URL (persiste em Settings para o toggle do menu).
(function applyWaterPhysicsVariantFromUrl() {
    const urlVariant = urlParams.get('waterPhysicsVariant');
    if (urlVariant === 'experimental' || urlVariant === 'current') {
        Settings.set('waterPhysicsVariant', urlVariant);
    }
})();

// Inicializa feature flags (funcionalidades experimentais)
GameData.initFeatureFlags();

// Debug posição do mapa (GameData.logMapDebug / saveMapPosition / loadMapPosition)
GameData.DEBUG_MAP_POSITION = urlParams.get('mapDebug') === 'true';

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
            debug: showDebug, // Mostra hitboxes quando ?debug=true
            debugShowBody: showDebug,
            debugShowStaticBody: showDebug,
            debugShowVelocity: showDebug,
            debugBodyColor: 0x00ff00,
            debugStaticBodyColor: 0x0000ff,
            debugVelocityColor: 0xff0000
        }
    },
    
    // Contador de FPS nativo do Phaser (mais preciso)
    fps: {
        target: 60,
        forceSetTimeOut: false
    },
    
    // Ordem: MenuScene primeiro (cena inicial)
    scene: [MenuScene, SlotSelectScene, CutsceneScene, WorldMapScene, CharacterSelectScene, GameScene, WorldCompleteScene],
    
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
