/**
 * TIME FORMATTER - Funções puras de formatação de tempo e data
 *
 * Sem dependências, sem estado mutável. Pode ser usado em qualquer contexto.
 *
 * Uso:
 *   TimeFormatter.time(123456)         → "2:03.456"
 *   TimeFormatter.date(isoString)      → "06/06/2026 12:00"
 *   TimeFormatter.dateShort(isoString) → "06/06"
 */

const TimeFormatter = {
    /**
     * Formata milissegundos como "M:SS.mmm" (ex: "1:23.456")
     */
    time(ms) {
        const totalSeconds = ms / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const millis = Math.floor(ms % 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    },

    /**
     * Formata ISO string como "DD/MM/AAAA HH:MM"
     */
    date(dateString) {
        try {
            const date = new Date(dateString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (e) {
            return '--/--/---- --:--';
        }
    },

    /**
     * Formata ISO string como "DD/MM"
     */
    dateShort(dateString) {
        try {
            const date = new Date(dateString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${day}/${month}`;
        } catch (e) {
            return '--/--';
        }
    }
};

window.TimeFormatter = TimeFormatter;
