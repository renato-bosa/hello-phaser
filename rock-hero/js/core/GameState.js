/**
 * GAME STATE - Estado runtime em memória + utilitários globais
 *
 * Responsabilidade: dados que vivem **em memória** durante uma sessão de jogo,
 * sem persistência em localStorage (isso é responsabilidade de SaveManager).
 *
 * Contém:
 * - `state`: objeto runtime com posição atual, slot ativo (cache), nome do jogador,
 *   personagem selecionado, pausa, tempo decorrido, etc.
 * - `VERSION`: versão do jogo (lida de `window.GAME_VERSION` setado em `index.html`).
 * - `assetUrl(path)`: helper de cache-busting para URLs de assets (`foo.png?v=0.42`).
 * - `getVirtualControls()`: lê estado dos controles virtuais mobile (overlay HTML).
 *
 * Não depende de outros módulos do jogo. É a base "global" da camada runtime.
 *
 * Removido durante a Fase 6 da refatoração:
 * - `state.gameSceneRef` — anti-pattern (referência direta a uma Phaser Scene
 *   armazenada no estado global). Era escrito por `GameScene` mas nunca lido —
 *   dead code confirmado por `Grep` no projeto inteiro.
 */

const GameState = {
    /**
     * Versão do jogo. `window.GAME_VERSION` é definido inline em `index.html`,
     * fora do controle de scripts (precisa estar disponível antes do bundle).
     */
    VERSION: `v${window.GAME_VERSION || '0.0'}`,

    /**
     * Estado runtime do jogo. NÃO é persistido — recriado a cada reload da página.
     * Slots persistentes vivem em `SaveManager` (localStorage).
     *
     * Campos:
     * - currentLevel        : índice da fase atual (0-based, ref. `GameConfig.LEVELS`)
     * - currentWorld        : id do mundo atual (1-based, ref. `GameConfig.WORLDS`)
     * - playerName          : nome exibido no HUD / fim de fase
     * - isPaused            : true quando o jogo está pausado (PauseMenu)
     * - elapsedTime         : ms decorridos na fase atual (usado para best times)
     * - selectedCharacter   : id do personagem ativo (ref. `GameConfig.CHARACTERS`)
     * - mapCursorLevel      : índice da fase apontada pelo cursor no WorldMap
     * - activeSlot          : id do slot ativo (1-4, ou null se nenhum)
     *                         Cache local — fonte da verdade é `SaveManager.getActiveSlotId()`
     */
    state: {
        currentLevel: 0,
        currentWorld: 1,
        playerName: 'Anônimo',
        isPaused: false,
        elapsedTime: 0,
        selectedCharacter: 'vocalista',
        mapCursorLevel: 0,
        activeSlot: null
    },

    /**
     * Adiciona `?v=VERSION` ao caminho do asset, forçando reload quando a versão muda.
     * Usado por `SpriteLoader` (carregamento de spritesheets) e por código que
     * precisa carregar JSONs/imagens com cache-busting.
     */
    assetUrl(path) {
        return `${path}?v=${this.VERSION}`;
    },

    /**
     * Retorna o objeto de controles virtuais (overlay mobile com D-pad + botões).
     * Setado por `js/virtualControls.js` em `window.virtualControls`. Se o overlay
     * mobile não foi inicializado (desktop, por exemplo), retorna objeto com tudo `false`.
     */
    getVirtualControls() {
        return window.virtualControls || {
            left: false,
            right: false,
            jump: false,
            jumpHeld: false,
            jumpJustPressed: false,
            back: false,
            backJustPressed: false
        };
    }
};

window.GameState = GameState;
