/**
 * Carrega as músicas em paralelo à interface, usando o cache global do Phaser.
 * Permanece ativa nas transições, sem exibir conteúdo. Também mantém o relógio
 * e as tweens da música da UI vivos enquanto o mapa troca de mundo.
 */
class MusicPreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MusicPreloadScene', active: true, visible: false });
    }

    create() {
        MusicManager.initializeBackgroundLoader(this);
    }
}
