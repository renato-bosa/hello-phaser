/**
 * Carrega as músicas em paralelo à interface, usando o cache global do Phaser.
 * Permanece ativa nas transições, sem exibir conteúdo nem reproduzir áudio.
 */
class MusicPreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MusicPreloadScene', active: true, visible: false });
    }

    create() {
        MusicManager.initializeBackgroundLoader(this);
    }
}
