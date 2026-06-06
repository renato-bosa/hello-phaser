/**
 * MAP DEBUG - Logs condicionais para debug do cursor do mapa
 *
 * Quando habilitado (via ?mapDebug=true ou MapDebug.enabled = true),
 * loga eventos relacionados ao cursor do mapa, saveMapPosition e
 * loadMapPosition no console com prefixo [MapPos].
 *
 * Uso:
 *   MapDebug.enabled = true;
 *   MapDebug.log('cursor moveu', { from, to });
 *   MapDebug.warn('inconsistência detectada', payload);
 */

const MapDebug = {
    /**
     * Quando true, log() e warn() emitem no console.
     * Ativado em game.js a partir de ?mapDebug=true na URL.
     */
    enabled: false,

    log(message, details = null) {
        if (!this.enabled) return;
        if (details !== null && typeof details === 'object') {
            console.log('[MapPos]', message, details);
        } else {
            console.log('[MapPos]', message);
        }
    },

    warn(message, details = null) {
        if (!this.enabled) return;
        if (details !== null && typeof details === 'object') {
            console.warn('[MapPos]', message, details);
        } else {
            console.warn('[MapPos]', message);
        }
    }
};

window.MapDebug = MapDebug;
