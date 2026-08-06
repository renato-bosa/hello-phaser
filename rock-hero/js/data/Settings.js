/**
 * SETTINGS - Preferências do jogador em localStorage
 *
 * Diferente de SaveManager (progresso, que vive por slot), estas preferências
 * são GLOBAIS: valem para o jogo inteiro, independente do slot ativo. Trocar
 * de slot ou apagar um save não deve religar a música que o jogador desligou.
 *
 * Responsabilidade ÚNICA: ler/escrever preferências. Não aplica nada — quem
 * consome (MusicManager, via fachada GameData) é que age sobre o valor.
 *
 * Depende de:
 * - GameConfig (STORAGE_KEYS.SETTINGS)
 */

const Settings = {
    DEFAULTS: {
        musicEnabled: true,
        // 'default' | 'proposta' — ordem de fases (GameConfigVariants)
        levelOrder: 'default'
    },

    /**
     * Lê todas as preferências. Chaves ausentes caem no default, então
     * adicionar uma preferência nova não invalida storage antigo.
     */
    load() {
        const stored = localStorage.getItem(GameConfig.STORAGE_KEYS.SETTINGS);
        if (stored) {
            try {
                return { ...this.DEFAULTS, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Erro ao carregar configurações:', e);
            }
        }
        return { ...this.DEFAULTS };
    },

    /**
     * Persiste o objeto completo de preferências. Falha de escrita (modo
     * privado, cota cheia) não pode derrubar o jogo — só perde a persistência.
     */
    save(settings) {
        try {
            localStorage.setItem(GameConfig.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        } catch (e) {
            console.warn('Settings: não foi possível persistir preferências.', e);
        }
    },

    get(key) {
        return this.load()[key];
    },

    set(key, value) {
        const settings = this.load();
        settings[key] = value;
        this.save(settings);
    }
};

window.Settings = Settings;
