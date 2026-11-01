/**
 * MusicManager — Trilha sonora (BGM) de fundo.
 *
 * Contrasta com SoundManager (SFX procedural via Web Audio API cru): aqui
 * usamos o subsistema Phaser Sound para reproduzir arquivos MP3 completos.
 *
 * Modelo atual (v1 — foco em gameplay):
 *   - MusicPreloadScene baixa as faixas em segundo plano desde a abertura.
 *     Menus não aguardam os MP3s; fases aguardam a faixa sorteada e cutscenes,
 *     sua própria trilha.
 *   - Cada entrada em fase sorteia uma faixa da pool elegível e toca.
 *   - Quando a faixa se aproxima do fim, cross-fade com a próxima (a antiga
 *     desce, a nova sobe, sobrepostas durante `crossfadeDurationMs`).
 *   - Ao sair da fase (shutdown ou stop explícito) a música para.
 *   - Pause/resume acompanham o PauseMenu (inclusive durante crossfade).
 *
 * Resolução de pool (ordem de precedência — pronto para expansão futura):
 *   1) GameConfig.MUSIC.gameplay.byLevel[levelIndex]
 *   2) GameConfig.MUSIC.gameplay.byWorld[worldId]
 *   3) GameConfig.MUSIC.gameplay.default
 *   4) Todas as faixas de GameConfig.MUSIC_TRACKS (fallback global)
 *
 * Cada valor pode ser uma string única ('rock-theme1') ou array de strings
 * (['rock-theme1', 'theme2']). Um único item ainda dispara sorteio (repete).
 *
 * URL flags:
 *   ?music=false        → desliga BGM (ex: dev)
 *   ?musicVolume=0.6    → volume inicial (0..1)
 *   ?crossfadeMs=1500   → duração do cross-fade em ms (default 2000, 0 desliga)
 *
 * Uso típico:
 *   MusicPreloadScene.create(): MusicManager.initializeBackgroundLoader(scene)
 *   scene.create():   MusicManager.startGameplay(scene, levelIndex)
 *                     MusicManager.startCutscene(scene, cutsceneId)
 *   scene.shutdown(): MusicManager.stop()
 *   PauseMenu.show(): MusicManager.pause()
 *   PauseMenu.resume(): MusicManager.resume()
 */

const MusicManager = {
    // ==================== CONFIGURAÇÃO ====================

    volume: 0.4,
    enabled: true,
    _initialized: false,

    // Duração do cross-fade quando trocamos de faixa naturalmente (fim de uma
    // → próxima do sorteio). Zero desliga (usa hard-cut baseado em 'complete').
    // Recomendado 1000–2500ms. Também usável via URL: ?crossfadeMs=1500.
    crossfadeDurationMs: 2500,

    // Ao sortear a próxima faixa, evitamos as últimas N já tocadas — assim uma
    // música recém-ouvida não volta a tocar tão cedo (inclusive entre fases,
    // porque o histórico não é zerado em `stop()`). Se a pool for menor que
    // N+1, a janela se ajusta para `pool.length - 1` para sempre restar ao
    // menos uma faixa elegível.
    recentHistoryLimit: 3,

    // ==================== ESTADO INTERNO ====================

    scene: null,          // Cena "dona" da sound instance atual
    currentSound: null,   // Phaser.Sound.BaseSound sendo tocado a "full volume"
    currentKey: null,     // key da faixa em execução (topo de recentHistory)
    currentPool: [],      // keys elegíveis pro contexto atual
    contextType: null,    // 'gameplay' (futuro: 'menu', 'worldMap', ...)
    contextData: null,    // { levelIndex } etc
    recentHistory: [],    // últimas keys tocadas, mais recente primeiro

    // Todos os sounds vivos gerenciados por nós (current + qualquer um em
    // fade-out durante crossfade). Usado por pause/resume/stop para operar
    // sobre TODOS os sounds ativos, não apenas o "atual".
    _activeSounds: [],
    _scheduledCrossfadeTimer: null,   // TimerEvent que dispara o crossfade

    // Contexto de gameplay preservado enquanto a música está desligada, para
    // que religar pelo menu volte a tocar a fase atual em vez de esperar a
    // próxima. Ver setEnabled().
    _suspendedContext: null,

    // Loader de uma cena persistente, separado da cena que reproduz a faixa.
    // O download continua mesmo quando menu, cutscene ou gameplay encerram.
    _loaderScene: null,
    _pendingTracks: new Set(),
    _paused: false,
    _pendingUnlock: null,

    // ==================== API PÚBLICA ====================

    /**
     * Inicializa o loader que vive durante toda a sessão do jogo.
     */
    initializeBackgroundLoader(scene) {
        this._loaderScene = scene;
        // Deixa espaço para sprites, mapas e imagens das cutscenes.
        scene.load.maxParallelDownloads = 2;
        scene.load.on('filecomplete', this._onTrackLoaded, this);
        scene.load.on('complete', this._onBackgroundLoadComplete, this);
        scene.load.on('loaderror', this._onTrackLoadError, this);
        scene.events.once('shutdown', this._releaseBackgroundLoader, this);
        scene.events.once('destroy', this._releaseBackgroundLoader, this);
        this.preload();
    },

    /**
     * Enfileira apenas faixas ausentes, sem duplicar downloads em andamento.
     * Não usa o loader das telas. Cada tela decide se precisa aguardar a trilha.
     */
    preload(priorityKey = null) {
        this._ensureInit();
        const scene = this._loaderScene;
        if (!this.enabled || !scene) return;

        const tracks = (GameConfig && GameConfig.MUSIC_TRACKS) || [];
        let queued = false;
        tracks.forEach(t => {
            if (!t || !t.key || !t.file) return;
            if (!scene.cache.audio.exists(t.key) && !this._pendingTracks.has(t.key)) {
                this._pendingTracks.add(t.key);
                scene.load.audio(t.key, GameData.assetUrl(t.file));
                queued = true;
            }
        });
        // Prioriza a faixa necessária sem cancelar downloads já em andamento.
        if (priorityKey) {
            scene.load.list.entries.sort((a, b) =>
                Number(b.key === priorityKey) - Number(a.key === priorityKey));
        }
        if (queued && !scene.load.isLoading()) scene.load.start();
    },

    _onTrackLoaded(key, type) {
        if (type !== 'audio') return;
        this._pendingTracks.delete(key);
        // Uma faixa que terminou tarde só pode iniciar no contexto atual.
        // Pausa, música desligada e saída da cena continuam sendo respeitadas.
        if (this.scene?.sys.isActive() && !this.currentSound && this.currentPool.includes(key)) {
            this._playRandom();
        }
    },

    _onBackgroundLoadComplete() {
        // Inclui falhas de download/decodificação: uma próxima entrada em
        // cena ou ativação da música pode tentar novamente, sem loop de retry.
        this._pendingTracks.clear();
    },

    _onTrackLoadError(file) {
        // Permite retentar esta faixa sem aguardar os demais downloads.
        this._pendingTracks.delete(file.key);
        console.warn(`MusicManager: falha ao carregar '${file.key}'. É possível tentar novamente.`);
    },

    _releaseBackgroundLoader() {
        const scene = this._loaderScene;
        if (!scene) return;
        scene.load.off('filecomplete', this._onTrackLoaded, this);
        scene.load.off('complete', this._onBackgroundLoadComplete, this);
        scene.load.off('loaderror', this._onTrackLoadError, this);
        scene.events.off('shutdown', this._releaseBackgroundLoader, this);
        scene.events.off('destroy', this._releaseBackgroundLoader, this);
        this._pendingTracks.clear();
        this._loaderScene = null;
    },

    /**
     * Escolhe a faixa de entrada considerando toda a pool, sem filtrar cache.
     * O caller guarda esta key até o download e a reprodução estarem prontos.
     */
    pickGameplayTrack(levelIndex) {
        this._ensureInit();
        return this.enabled ? this._pickFromPool(this._resolveGameplayPool(levelIndex)) : null;
    },

    /**
     * Inicia BGM para uma fase, usando a faixa de entrada já sorteada, se dada.
     * Se a faixa terminar antes da fase, sorteia outra automaticamente.
     */
    startGameplay(scene, levelIndex, initialKey = null) {
        this._ensureInit();
        this.stop();
        if (!this.enabled) {
            // Guarda o contexto mesmo desligado: se o jogador religar a música
            // no menu de pausa desta fase, setEnabled() sabe o que tocar.
            this._suspendedContext = { scene, levelIndex };
            console.warn(`MusicManager: startGameplay(level=${levelIndex}) ignorado — enabled=false.`);
            return;
        }

        this._suspendedContext = null;
        this.scene = scene;
        this.contextType = 'gameplay';
        this.contextData = { levelIndex };
        this.currentPool = this._resolveGameplayPool(levelIndex);
        this._paused = scene.currentView === 'paused';
        this.preload();

        // Auto-cleanup: quando a cena for encerrada (por scene.start em outra
        // cena, restart, etc.) o Phaser emite 'shutdown'. Amarrar aqui garante
        // que a música pare mesmo se o caller esquecer de chamar `stop()`
        // explicitamente no `GameScene.shutdown()`. Chamadas duplicadas de
        // `stop()` são idempotentes.
        scene.events.once('shutdown', this._onSceneShutdown, this);
        scene.events.once('destroy', this._onSceneShutdown, this);

        if (this.currentPool.length === 0) {
            console.warn('MusicManager: nenhuma faixa elegível para este contexto.');
            return;
        }

        if (initialKey) this._playKey(initialKey);
        else this._playRandom();
    },

    /**
     * Inicia BGM para uma cutscene. Pool vem de CUTSCENES[id].music
     * (string ou array de keys em MUSIC_TRACKS). Sem `music` → no-op.
     */
    startCutscene(scene, cutsceneId) {
        this._ensureInit();
        this.stop();
        if (!this.enabled) {
            console.warn(`MusicManager: startCutscene(${cutsceneId}) ignorado — enabled=false.`);
            return;
        }

        const cutscene = GameConfig?.CUTSCENES?.[cutsceneId];
        const music = cutscene?.music;
        if (!music) return;

        this._suspendedContext = null;
        this.scene = scene;
        this.contextType = 'cutscene';
        this.contextData = { cutsceneId };
        this.currentPool = Array.isArray(music) ? music.slice() : [music];
        this.preload();

        scene.events.once('shutdown', this._onSceneShutdown, this);
        scene.events.once('destroy', this._onSceneShutdown, this);

        if (this.currentPool.length === 0) return;

        this._playRandom();
    },

    /**
     * Para completamente a BGM e limpa estado. Cancela crossfade agendado,
     * mata tweens e destrói todos os sounds ativos (o atual e qualquer
     * um em fade-out durante crossfade).
     * Idempotente — seguro chamar mesmo sem música tocando.
     */
    stop() {
        // Desliga listeners de scene events (não vaza referências pra cenas antigas).
        if (this.scene && this.scene.events) {
            this.scene.events.off('shutdown', this._onSceneShutdown, this);
            this.scene.events.off('destroy', this._onSceneShutdown, this);
        }
        this._clearPendingUnlock();
        this._cancelScheduledCrossfade();
        this._destroyAllActiveSounds();
        this.currentSound = null;
        this.currentKey = null;
        this.currentPool = [];
        this.contextType = null;
        this.contextData = null;
        this.scene = null;
        this._paused = false;
    },

    /**
     * Listener registrado nos eventos 'shutdown'/'destroy' da cena atual.
     * Serve como rede de segurança: mesmo se o caller esquecer de chamar
     * `MusicManager.stop()`, a música pára ao encerrar a cena.
     */
    _onSceneShutdown() {
        this.stop();
    },

    /** Pausa TODOS sounds ativos (inclusive durante crossfade) + o timer. */
    pause() {
        this._paused = true;
        this._activeSounds.forEach(s => {
            if (s && s.isPlaying) s.pause();
        });
        if (this._scheduledCrossfadeTimer) {
            this._scheduledCrossfadeTimer.paused = true;
        }
    },

    /** Retoma TODOS sounds ativos (inclusive durante crossfade) + o timer. */
    resume() {
        this._paused = false;
        this._activeSounds.forEach(s => {
            if (s && s.isPaused) s.resume();
            else if (s && s === this.currentSound && !s.isPlaying) this._startSound(s, this.currentKey);
        });
        if (this._scheduledCrossfadeTimer) {
            this._scheduledCrossfadeTimer.paused = false;
        }
        if (!this.currentSound) this._playRandom();
    },

    setVolume(v) {
        const clamped = Math.max(0, Math.min(1, Number(v) || 0));
        this.volume = clamped;
        // Ajusta apenas o sound "current" no volume alvo — os que estão em
        // fade-out têm suas tweens próprias e não devem ser tocados aqui.
        if (this.currentSound && this.currentSound.setVolume) {
            this.currentSound.setVolume(clamped);
        }
    },

    /**
     * Liga/desliga a BGM. Desligar para tudo; religar retoma a fase corrente
     * (do início da faixa, já que o sound anterior foi destruído) em vez de
     * ficar em silêncio até a próxima fase.
     */
    setEnabled(b) {
        this._ensureInit();

        const next = !!b;
        if (next === this.enabled) return;

        if (!next) {
            // `stop()` limpa scene/contextData, então preserva antes.
            this._suspendedContext = this.contextType === 'gameplay' && this.scene
                ? { scene: this.scene, levelIndex: this.contextData?.levelIndex }
                : null;
            this.enabled = false;
            this.stop();
            return;
        }

        this.enabled = true;
        this.preload();

        const suspended = this._suspendedContext;
        this._suspendedContext = null;

        // Só retoma se a cena guardada ainda estiver viva (o jogador pode ter
        // voltado ao mapa ou ao menu enquanto a música estava desligada).
        if (suspended && suspended.scene && suspended.scene.sys && suspended.scene.sys.isActive()) {
            this.startGameplay(suspended.scene, suspended.levelIndex);
        }
    },

    isEnabled() {
        this._ensureInit();
        return this.enabled;
    },

    // ==================== INTERNAL ====================

    _ensureInit() {
        if (this._initialized) return;
        this._initialized = true;

        // Preferência persistida do jogador (menu principal / menu de pausa).
        // As flags de URL abaixo têm precedência, por serem ferramenta de dev.
        try {
            if (typeof Settings !== 'undefined') {
                this.enabled = Settings.get('musicEnabled') !== false;
            }
        } catch (e) {
            // storage indisponível — mantém o default
        }

        // URL flags — lidas uma única vez no primeiro uso.
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('music') === 'false') this.enabled = false;
            const volParam = params.get('musicVolume');
            if (volParam !== null && volParam !== '') {
                const v = parseFloat(volParam);
                if (!isNaN(v)) this.volume = Math.max(0, Math.min(1, v));
            }
            const xfadeParam = params.get('crossfadeMs');
            if (xfadeParam !== null && xfadeParam !== '') {
                const ms = parseInt(xfadeParam, 10);
                if (!isNaN(ms) && ms >= 0) this.crossfadeDurationMs = ms;
            }
        } catch (e) {
            // sem window / URLSearchParams (ambiente inesperado) — ignora
        }
    },

    /**
     * Resolve as faixas elegíveis para o contexto de gameplay num level.
     * Ordem: byLevel → byWorld → default → pool global.
     */
    _resolveGameplayPool(levelIndex) {
        const config = (GameConfig && GameConfig.MUSIC && GameConfig.MUSIC.gameplay) || {};

        if (config.byLevel && config.byLevel[levelIndex] != null) {
            return this._normalizePool(config.byLevel[levelIndex]);
        }

        const world = (GameConfig.WORLDS || []).find(
            w => Array.isArray(w.levels) && w.levels.includes(levelIndex)
        );
        if (world && config.byWorld && config.byWorld[world.id] != null) {
            return this._normalizePool(config.byWorld[world.id]);
        }

        if (config.default != null) {
            return this._normalizePool(config.default);
        }

        return (GameConfig.MUSIC_TRACKS || [])
            .filter(t => t && t.key)
            .map(t => t.key);
    },

    _normalizePool(value) {
        if (Array.isArray(value)) return value.filter(k => typeof k === 'string' && k.length);
        if (typeof value === 'string' && value.length) return [value];
        return [];
    },

    /**
     * Sorteia a próxima faixa evitando as últimas N já tocadas (janela dada
     * por `recentHistoryLimit`). Se a pool for pequena, a janela é reduzida
     * para `pool.length - 1` — garantindo que sempre haja ao menos uma faixa
     * elegível quando a pool tem 2+ itens; se a pool tem 1 item, ele é
     * devolvido (repete).
     */
    _pickNext() {
        // Trocas durante a reprodução usam o cache para manter o crossfade.
        // A entrada da fase usa pickGameplayTrack(), com a pool completa.
        return this._pickFromPool(this.currentPool.filter(key => this.scene?.cache.audio.exists(key)));
    },

    _pickFromPool(pool) {
        if (!pool || pool.length === 0) return null;
        if (pool.length === 1) return pool[0];

        const avoidCount = Math.min(this.recentHistoryLimit, pool.length - 1);
        const avoid = new Set(this.recentHistory.slice(0, avoidCount));
        const eligible = pool.filter(k => !avoid.has(k));

        // `eligible` sempre tem >= 1 item: pool.length >= 2 e avoidCount <= pool.length - 1.
        return eligible[Math.floor(Math.random() * eligible.length)];
    },

    /**
     * Registra a faixa como recém-tocada no topo do histórico, removendo
     * ocorrências duplicadas anteriores (mantém a recência correta).
     */
    _recordInHistory(key) {
        const filtered = this.recentHistory.filter(k => k !== key);
        this.recentHistory = [key, ...filtered].slice(0, this.recentHistoryLimit);
    },

    _playRandom() {
        if (!this.enabled || this._paused || !this.scene) return;
        const key = this._pickNext();
        if (!key) return;
        this._playKey(key);
    },

    /**
     * Inicia uma nova faixa sem crossfade — usado para a PRIMEIRA faixa após
     * `startGameplay`. Se já existe uma faixa "current", ela é destruída
     * imediatamente (hard-cut).
     */
    _playKey(key) {
        const scene = this.scene;
        // Não usamos `scene.sys.isActive()` porque durante `create()` o status
        // ainda é CREATING (não RUNNING). Basta a cena existir e ter sound.
        if (!scene || !scene.sys || !scene.sound) {
            console.warn(`MusicManager: cena inválida ao tentar tocar '${key}'.`);
            return;
        }

        if (!scene.cache.audio.exists(key)) {
            console.warn(`MusicManager: faixa '${key}' ausente no cache (preload não executado?).`);
            return;
        }

        // Cancela qualquer crossfade agendado e mata sound(s) antigos.
        this._cancelScheduledCrossfade();
        this._destroyAllActiveSounds();

        const sound = this._createSound(key, this.volume);
        this.currentSound = sound;
        this.currentKey = key;
        this._recordInHistory(key);

        // Fallback: se por algum motivo o crossfade não iniciar (timer
        // desligado, sound muito curto), 'complete' encadeia a próxima como
        // hard-cut.
        sound.once('complete', () => this._onSoundCompleted(sound));

        this._startSound(sound, key);
    },

    /**
     * Handler de 'complete' do sound. Só encadeia se este sound ainda for o
     * "current" (não foi substituído por crossfade anterior).
     */
    _onSoundCompleted(sound) {
        this._removeFromActive(sound);
        if (this.currentSound !== sound) return;
        this.currentSound = null;
        this._playRandom();
    },

    /**
     * Agenda o início do crossfade N ms antes do fim da faixa. O timer é
     * pausável (respeita PauseMenu). Se a faixa é curta demais (duração <=
     * crossfade), pula o agendamento e deixa o hard-cut assumir.
     */
    _scheduleCrossfade(sound) {
        this._cancelScheduledCrossfade();

        if (!this.crossfadeDurationMs || this.crossfadeDurationMs <= 0) return;
        if (!sound || !sound.duration) return;

        const durationMs = sound.duration * 1000;
        const startDelay = durationMs - this.crossfadeDurationMs;
        if (startDelay <= 0) return;

        this._scheduledCrossfadeTimer = this.scene.time.delayedCall(startDelay, () => {
            this._scheduledCrossfadeTimer = null;
            // Só faz sentido crossfadar se este sound ainda é o "current".
            if (this.currentSound !== sound) return;
            this._crossfadeToNext(sound);
        });
    },

    _cancelScheduledCrossfade() {
        if (this._scheduledCrossfadeTimer) {
            this._scheduledCrossfadeTimer.remove(false);
            this._scheduledCrossfadeTimer = null;
        }
    },

    /**
     * Inicia o crossfade: sorteia próxima faixa, começa em volume 0 e faz
     * duas tweens simultâneas — a antiga descendo até 0 (então destruída),
     * a nova subindo até `this.volume`. Ambas continuam tocando durante a
     * sobreposição.
     */
    _crossfadeToNext(oldSound) {
        const scene = this.scene;
        if (!scene) return;

        const newKey = this._pickNext();
        if (!newKey) return;
        if (!scene.cache.audio.exists(newKey)) {
            console.warn(`MusicManager: faixa '${newKey}' ausente no cache (crossfade abortado).`);
            return;
        }

        // Cria e inicia nova faixa em volume 0.
        const newSound = this._createSound(newKey, 0);
        this.currentSound = newSound;
        this.currentKey = newKey;
        this._recordInHistory(newKey);

        // Remove o listener de 'complete' da antiga: ela vai ser destruída
        // pela tween, não pelo evento natural (evita double-play).
        try { oldSound.off('complete'); } catch (e) {}

        // O 'complete' da nova encadeia o hard-cut fallback se o crossfade
        // seguinte não for agendado (edge case).
        newSound.once('complete', () => this._onSoundCompleted(newSound));

        this._startSound(newSound, newKey);

        // Fade em S-curve (lento nas pontas, rápido no meio) — soa mais
        // natural que fade linear. Alternativas se quiser um S mais/menos
        // pronunciado: 'Cubic.easeInOut' (moderado), 'Quart.easeInOut' (forte).
        const ease = 'Sine.easeInOut';

        // Fade-out da antiga: quando termina, destrói.
        scene.tweens.add({
            targets: oldSound,
            volume: 0,
            duration: this.crossfadeDurationMs,
            ease,
            onComplete: () => this._destroySound(oldSound)
        });

        // Fade-in da nova até o volume alvo.
        scene.tweens.add({
            targets: newSound,
            volume: this.volume,
            duration: this.crossfadeDurationMs,
            ease
        });

        // O crossfade seguinte é agendado dentro de `_startSound`, somente
        // após confirmarmos que a nova faixa realmente começou a tocar.
    },

    /**
     * Tenta iniciar a reprodução. Se o AudioContext estiver travado (política
     * de autoplay do browser), agenda a reprodução para o próximo evento de
     * unlock (primeira interação do usuário — clique, tecla, toque).
     */
    _startSound(sound, key) {
        if (!this.enabled || this._paused || this.currentSound !== sound) return;
        this._clearPendingUnlock();
        const scene = this.scene;
        const soundManager = scene.sound;

        let started = false;
        try {
            started = sound.play();
        } catch (e) {
            console.warn(`MusicManager: exceção ao tocar '${key}'`, e);
        }

        if (started) {
            console.log(`♫ MusicManager: tocando '${key}'`);
            // Só agenda o crossfade agora — se estava locked antes, o timer
            // não conta enquanto a música não tocar.
            if (this.currentSound === sound) this._scheduleCrossfade(sound);
            return;
        }

        // sound.play() retornou false — normalmente por AudioContext suspended.
        // O Phaser dispara 'unlocked' no seu Sound Manager global assim que o
        // usuário interage com a página. Aguardamos e retentamos.
        console.info(
            `MusicManager: '${key}' aguardando destravar (locked=${soundManager.locked}, ` +
            `ctxState=${soundManager.context?.state}). Toque/clique/tecla vai iniciar.`
        );

        const onUnlock = () => {
            this._pendingUnlock = null;
            if (this.currentSound !== sound || !this.enabled || this._paused) return;
            try {
                sound.play();
                console.log(`♫ MusicManager: '${key}' iniciou após unlock`);
                if (this.currentSound === sound) this._scheduleCrossfade(sound);
            } catch (e) {
                console.warn('MusicManager: falha ao retentar após unlock', e);
            }
        };
        this._pendingUnlock = { soundManager, sound, onUnlock };
        soundManager.once('unlocked', onUnlock);
    },

    _clearPendingUnlock() {
        const pending = this._pendingUnlock;
        if (!pending) return;
        pending.soundManager.off('unlocked', pending.onUnlock);
        this._pendingUnlock = null;
    },

    /**
     * Cria um Sound Phaser e o registra em `_activeSounds`. Volume inicial
     * é fornecido pelo chamador (`this.volume` para faixa nova sem fade,
     * `0` para faixa entrando em crossfade).
     */
    _createSound(key, initialVolume) {
        const sound = this.scene.sound.add(key, { volume: initialVolume, loop: false });
        this._activeSounds.push(sound);
        return sound;
    },

    /** Destrói um sound específico, mata tweens e remove de `_activeSounds`. */
    _destroySound(sound) {
        if (!sound) return;
        if (this._pendingUnlock?.sound === sound) this._clearPendingUnlock();
        this._removeFromActive(sound);
        if (this.scene && this.scene.tweens) {
            try { this.scene.tweens.killTweensOf(sound); } catch (e) {}
        }
        try { sound.off('complete'); } catch (e) {}
        try { sound.stop(); } catch (e) {}
        try { sound.destroy(); } catch (e) {}
    },

    _destroyAllActiveSounds() {
        // Copia (slice) porque `_destroySound` muta o array durante a iteração.
        this._activeSounds.slice().forEach(s => this._destroySound(s));
        this._activeSounds = [];
    },

    _removeFromActive(sound) {
        const idx = this._activeSounds.indexOf(sound);
        if (idx >= 0) this._activeSounds.splice(idx, 1);
    }
};

if (typeof window !== 'undefined') {
    window.MusicManager = MusicManager;
}
