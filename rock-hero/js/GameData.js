/**
 * GAME DATA - Módulo Centralizado de Dados
 * 
 * Gerencia:
 * - Rankings (hi-scores)
 * - Progresso salvo
 * - Configurações de níveis
 * - Estado do jogo
 */

const GameData = {
    // Configuração das fases
    LEVELS: [
        { 
            key: 'map1', 
            file: 'assets/map.json', 
            name: 'Fase 1',
            zoom: 1.0,
            roundPixels: true
        },
        { 
            key: 'map2', 
            file: 'assets/map-2--expansion and speed.json', 
            name: 'Fase 2',
            zoom: 0.9,
            roundPixels: false
        },
        { 
            key: 'map3', 
            file: 'assets/map-3--desafio do luigi.json', 
            name: 'Desafio do Luigi',
            zoom: 0.9,
            roundPixels: false
        }
    ],

    // Valores padrão
    DEFAULTS: {
        zoom: 1.0,
        roundPixels: true,
        gravity: 800,
        playerSpeed: { min: 160, max: 260 },
        jumpForce: -480
    },

    // Estado atual do jogo (em memória, não localStorage)
    state: {
        currentLevel: 0,
        playerName: 'Anônimo',
        isPaused: false,
        elapsedTime: 0,
        // Referência à cena do jogo (para resume)
        gameSceneRef: null
    },

    // ==================== PROGRESSO ====================
    
    saveProgress(level, playerName) {
        localStorage.setItem('rockHero_savedLevel', level.toString());
        localStorage.setItem('rockHero_playerName', playerName);
        // Atualiza estado em memória também
        this.state.currentLevel = level;
        this.state.playerName = playerName;
    },

    loadProgress() {
        const savedLevel = localStorage.getItem('rockHero_savedLevel');
        const savedPlayerName = localStorage.getItem('rockHero_playerName');
        
        if (savedLevel !== null && savedPlayerName !== null) {
            return {
                level: parseInt(savedLevel),
                playerName: savedPlayerName
            };
        }
        return null;
    },

    hasProgress() {
        const progress = this.loadProgress();
        return progress !== null && progress.level >= 0;
    },

    clearProgress() {
        localStorage.removeItem('rockHero_savedLevel');
        this.state.currentLevel = 0;
    },

    // ==================== RANKINGS ====================

    getTopRecords(level, limit = 4) {
        const key = `rockHero_records_level${level}`;
        const stored = localStorage.getItem(key);
        
        if (stored) {
            try {
                const records = JSON.parse(stored);
                return records.slice(0, limit);
            } catch (e) {
                // Fallback para formato antigo
                return this._migrateLegacyRecords(level);
            }
        }
        return [];
    },

    /**
     * Salva um tempo se ele estiver entre os top N
     * @param {number} level - Índice da fase
     * @param {number} time - Tempo em ms
     * @param {string} playerName - Nome do jogador
     * @param {number} topN - Quantos melhores tempos manter (default: 4)
     * @returns {object} { saved: boolean, position: number, isRecord: boolean }
     */
    saveRecord(level, time, playerName, topN = 4) {
        const key = `rockHero_records_level${level}`;
        
        // Obtém lista atual
        let records = this.getTopRecords(level, 100); // Pega todos
        
        // Verifica se entra no ranking antes de adicionar
        const wouldRank = records.length < topN || time < records[records.length - 1]?.time || records.length === 0;
        
        // Novo recorde
        const newRecord = {
            time: time,
            playerName: playerName || 'Anônimo',
            date: new Date().toISOString()
        };
        
        // Adiciona e ordena
        records.push(newRecord);
        records.sort((a, b) => a.time - b.time);
        
        // Encontra posição do novo tempo
        const position = records.findIndex(r => r.time === time && r.date === newRecord.date) + 1;
        
        // Mantém top N
        records = records.slice(0, topN);
        
        // Só salva se entrou no ranking
        const saved = position <= topN;
        if (saved) {
            localStorage.setItem(key, JSON.stringify(records));
        }
        
        return {
            saved: saved,
            position: position,
            isRecord: position === 1
        };
    },

    getBestTime(level) {
        const records = this.getTopRecords(level, 1);
        return records.length > 0 ? records[0].time : null;
    },

    getTotalBestTime() {
        let total = 0;
        for (let i = 0; i < this.LEVELS.length; i++) {
            const best = this.getBestTime(i);
            if (best === null) return null;
            total += best;
        }
        return total;
    },

    _migrateLegacyRecords(level) {
        const oldKey = `rockHero_record_level${level}`;
        const oldStored = localStorage.getItem(oldKey);
        if (oldStored) {
            try {
                const oldRecord = JSON.parse(oldStored);
                return [oldRecord];
            } catch (e) {
                const time = parseFloat(oldStored);
                if (!isNaN(time)) {
                    return [{ time: time, playerName: 'Anônimo', date: new Date().toISOString() }];
                }
            }
        }
        return [];
    },

    // ==================== FORMATAÇÃO ====================

    formatTime(ms) {
        const totalSeconds = ms / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const millis = Math.floor(ms % 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    },

    formatDate(dateString) {
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

    // ==================== CONTROLES VIRTUAIS ====================

    getVirtualControls() {
        return window.virtualControls || {
            left: false,
            right: false,
            jump: false,
            jumpHeld: false,
            jumpJustPressed: false,
            restart: false
        };
    }
};

// Exporta globalmente
window.GameData = GameData;

