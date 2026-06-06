/**
 * FEATURE FLAGS - Sistema de toggle para mecânicas experimentais
 *
 * Permite ativar/desativar funcionalidades (efeitos visuais, mecânicas de física)
 * por 3 caminhos:
 *
 *   1) **Defaults** definidos em `GameConfig.FEATURES_DEFAULTS` (fonte da verdade estática).
 *   2) **URL params** aplicados em `init()` — ex.: `?doubleJump=true&waterPhysics=false`.
 *   3) **Toggle pelo menu** (in-game): UI mutaciona `FeatureFlags.flags[name]` diretamente.
 *
 * Além disso, `overrides` permite que uma FASE específica **force** flags durante
 * sua execução (ex.: map11 sempre com `doubleJump: true`), sem alterar o estado
 * global do menu. `GameScene` define/limpa overrides ao entrar/sair da fase.
 *
 * Depende apenas de `GameConfig` (FEATURES_DEFAULTS).
 *
 * API pública:
 *   FeatureFlags.flags             // objeto runtime mutável
 *   FeatureFlags.overrides         // null ou { feature: bool, ... }
 *   FeatureFlags.init()            // aplica URL params (chamado em game.js boot)
 *   FeatureFlags.isEnabled(name)   // leitura com overrides
 *   FeatureFlags.setOverrides(o)   // define ou limpa (null) overrides
 *   FeatureFlags.clearOverrides()  // atalho para setOverrides(null)
 */

const FeatureFlags = {
    /**
     * Estado runtime das feature flags. Inicializado como cópia rasa dos defaults
     * — uma cópia (não a referência) para que mutações no menu não vazem para o
     * objeto `GameConfig.FEATURES_DEFAULTS` (que deve permanecer imutável).
     */
    flags: { ...GameConfig.FEATURES_DEFAULTS },

    /**
     * Overrides locais à fase atual. `null` significa "sem override, usar flags".
     */
    overrides: null,

    /**
     * Lê URL params e aplica sobre `flags`. Chamado uma vez em `game.js`.
     * NÃO reseta `flags` para defaults — apenas modifica entradas com valores
     * explícitos na URL. Idempotente (chamar duas vezes não altera comportamento).
     */
    init() {
        const urlParams = new URLSearchParams(window.location.search);

        Object.keys(this.flags).forEach(name => {
            const v = urlParams.get(name);
            if (v === 'true') {
                this.flags[name] = true;
                console.log(`🚩 Feature "${name}" ativada via URL`);
            } else if (v === 'false') {
                this.flags[name] = false;
            }
        });

        const active = Object.entries(this.flags)
            .filter(([_, v]) => v)
            .map(([k]) => k);
        if (active.length > 0) {
            console.log('🎮 Features ativas:', active.join(', '));
        }
    },

    /**
     * `true` se a feature está ativa, considerando override de fase primeiro.
     * Usa `hasOwnProperty` para distinguir override explícito (mesmo `false`)
     * de "sem override" — flags ausentes do override caem para `flags`.
     */
    isEnabled(name) {
        if (this.overrides && Object.prototype.hasOwnProperty.call(this.overrides, name)) {
            return this.overrides[name] === true;
        }
        return this.flags[name] === true;
    },

    /**
     * Define o objeto de overrides de fase. Passar `null` ou `undefined` limpa.
     * O objeto inteiro é substituído (não merge).
     */
    setOverrides(overrides) {
        this.overrides = overrides || null;
    },

    /**
     * Limpa overrides de fase (volta a ler `flags`).
     */
    clearOverrides() {
        this.overrides = null;
    }
};

window.FeatureFlags = FeatureFlags;
