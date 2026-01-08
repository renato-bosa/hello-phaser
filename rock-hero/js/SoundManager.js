/**
 * SOUND MANAGER - Sistema de Áudio Procedural
 * 
 * Gera efeitos sonoros estilo 8-bit usando Web Audio API.
 * Sons são sintetizados em tempo real, sem necessidade de arquivos externos.
 * 
 * Uso:
 *   SoundManager.play('jump');
 *   SoundManager.play('menuNavigate');
 */

const SoundManager = {
    // ==================== CONFIGURAÇÃO ====================
    
    masterVolume: 0.4,
    enabled: true,
    initialized: false,
    audioContext: null,
    
    // ==================== DEFINIÇÃO DOS SONS ====================
    
    /**
     * Configuração de cada som
     * - type: 'sine', 'square', 'sawtooth', 'triangle', 'noise'
     * - frequency: frequência inicial em Hz
     * - duration: duração em segundos
     * - volume: volume relativo (0-1)
     * - attack: tempo de attack em segundos
     * - decay: tempo de decay em segundos
     * - slide: variação de frequência (positivo = sobe, negativo = desce)
     * - vibratoDepth: profundidade do vibrato
     * - vibratoSpeed: velocidade do vibrato
     * - delay: tempo do delay/eco em segundos
     * - delayFeedback: volume do eco (0-1)
     */
    sounds: {
        // === UI / MENU ===
        menuNavigate: {
            type: 'square',
            frequency: 440,
            duration: 0.05,
            volume: 0.3,
            attack: 0.005,
            decay: 0.04,
            slide: 200
        },
        menuSelect: {
            type: 'square',
            frequency: 520,
            duration: 0.12,
            volume: 0.35,
            attack: 0.01,
            decay: 0.1,
            slide: 100
        },
        menuBack: {
            type: 'square',
            frequency: 300,
            duration: 0.1,
            volume: 0.3,
            attack: 0.005,
            decay: 0.08,
            slide: -100
        },
        
        // === COUNTDOWN ===
        countdownTick: {
            type: 'square',
            frequency: 440,
            duration: 0.15,
            volume: 0.4,
            attack: 0.01,
            decay: 0.12,
            delay: 0.06,
            delayFeedback: 0.1,
            /*slide: -50*/
        },
        countdownGo: {
            type: 'square',
            frequency: 660,
            duration: 0.3,
            volume: 0.5,
            attack: 0.01,
            decay: 0.25,
            slide: 300,
            delay: 0.06,
            delayFeedback: 0.1,
        },
        
        // === GAMEPLAY ===
        jump: {
            type: 'square',
            frequency: 150,
            duration: 0.15,
            volume: 0.35,
            attack: 0.01,
            decay: 0.12,
            slide: 400
        },
        jumpTrampoline: {
            type: 'sawtooth',
            frequency: 200,
            duration: 0.25,
            volume: 0.4,
            attack: 0.01,
            decay: 0.2,
            slide: 600
        },
        collectStar: {
            type: 'square',
            frequency: 880,
            duration: 0.18,     // Um pouco mais longo para notas distintas
            volume: 0.35,
            attack: 0.005,
            decay: 0.05,        // Decay curto para notas "staccato"
            sequence: [880, 1100, 1320], // Arpejo C#-F-G# (brilhante)
            delay: 0.08,        // Delay curto
            delayFeedback: 0.4  // Eco suave
        },
        checkpoint: {
            type: 'sawtooth',
            frequency: 440,
            duration: 0.05,
            volume: 0.25,
            attack: 0.03,
            decay: 0.1,
            //slide: 50,
            sequence: [1760, 880, 440, 554.37], // Arpejo de acorde maior: A (440), C# (554.37), E (659.25), A (880)
            //delay: 0.3,        // Delay curto
            //delayFeedback: 0.1  // Eco suave
        },
        goalReached: {
            type: 'square',
            frequency: 523,
            duration: 0.5,
            volume: 0.3,
            attack: 0.01,
            decay: 0.4,
            sequence: [523, 659, 784, 1047] // C-E-G-C (acorde maior)
        },
        damage: {
            type: 'sawtooth',
            frequency: 200,
            duration: 0.3,
            volume: 0.4,
            attack: 0.01,
            decay: 0.25,
            slide: -150,
            vibratoDepth: 30,
            vibratoSpeed: 20
        },
        
        // === FEEDBACK ===
        warning: {
            type: 'square',
            frequency: 220,
            duration: 0.2,
            volume: 0.4,
            attack: 0.01,
            decay: 0.15,
            sequence: [220, 180] // Duas notas descendentes
        },
        newRecord: {
            type: 'square',
            frequency: 523,
            duration: 0.6,
            volume: 0.5,
            attack: 0.01,
            decay: 0.5,
            sequence: [523, 659, 784, 1047, 1319] // Fanfarra
        }
    },
    
    // ==================== INICIALIZAÇÃO ====================
    
    init() {
        if (this.initialized) return true;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            console.log('SoundManager: Inicializado com Web Audio API.');
            return true;
        } catch (e) {
            console.warn('SoundManager: Web Audio API não suportada.');
            this.enabled = false;
            return false;
        }
    },
    
    // ==================== GERAÇÃO DE SOM ====================
    
    /**
     * Gera e toca um som procedural
     */
    generateAndPlay(config) {
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        // Se tem sequência de notas, toca como arpejo
        if (config.sequence && config.sequence.length > 0) {
            const noteDelay = config.duration / config.sequence.length;
            config.sequence.forEach((freq, i) => {
                this.playSingleTone({
                    ...config,
                    frequency: freq,
                    duration: noteDelay * 1.2, // Pequeno overlap
                    startTime: now + (i * noteDelay)
                });
            });
            return;
        }
        
        this.playSingleTone({ ...config, startTime: now });
    },
    
    /**
     * Toca um único tom
     */
    playSingleTone(config) {
        const ctx = this.audioContext;
        const startTime = config.startTime || ctx.currentTime;
        
        // Oscilador
        const osc = ctx.createOscillator();
        osc.type = config.type || 'square';
        osc.frequency.setValueAtTime(config.frequency, startTime);
        
        // Slide de frequência
        if (config.slide) {
            osc.frequency.linearRampToValueAtTime(
                config.frequency + config.slide,
                startTime + config.duration
            );
        }
        
        // Vibrato
        if (config.vibratoDepth && config.vibratoSpeed) {
            const vibrato = ctx.createOscillator();
            const vibratoGain = ctx.createGain();
            vibrato.frequency.value = config.vibratoSpeed;
            vibratoGain.gain.value = config.vibratoDepth;
            vibrato.connect(vibratoGain);
            vibratoGain.connect(osc.frequency);
            vibrato.start(startTime);
            vibrato.stop(startTime + config.duration);
        }
        
        // Envelope de volume (ADSR simplificado)
        const gainNode = ctx.createGain();
        const volume = (config.volume || 0.5) * this.masterVolume;
        const attack = config.attack || 0.01;
        const decay = config.decay || config.duration;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + attack);
        gainNode.gain.linearRampToValueAtTime(0, startTime + attack + decay);
        
        // Conecta oscilador ao gain
        osc.connect(gainNode);
        
        // Delay (eco)
        if (config.delay && config.delay > 0) {
            const delayNode = ctx.createDelay(1.0);
            const feedbackGain = ctx.createGain();
            
            delayNode.delayTime.value = config.delay;
            feedbackGain.gain.value = config.delayFeedback || 0.3;
            
            // Sinal direto (dry)
            gainNode.connect(ctx.destination);
            
            // Sinal com delay (wet) - feedback loop
            gainNode.connect(delayNode);
            delayNode.connect(feedbackGain);
            feedbackGain.connect(delayNode); // Loop de feedback
            feedbackGain.connect(ctx.destination);
        } else {
            // Sem delay - conexão direta
            gainNode.connect(ctx.destination);
        }
        
        osc.start(startTime);
        osc.stop(startTime + config.duration + 0.1);
    },
    
    // ==================== REPRODUÇÃO ====================
    
    /**
     * Toca um efeito sonoro
     * @param {string} soundKey - Nome do som (ex: 'jump', 'menuSelect')
     * @param {object} options - Opções adicionais { volume }
     */
    play(soundKey, options = {}) {
        if (!this.enabled) return;
        
        // Inicializa na primeira interação
        if (!this.initialized) {
            if (!this.init()) return;
        }
        
        // Resume contexto se suspenso (requisito do navegador)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const soundConfig = this.sounds[soundKey];
        if (!soundConfig) {
            console.warn(`SoundManager: Som "${soundKey}" não encontrado.`);
            return;
        }
        
        // Aplica volume customizado se fornecido
        const config = { ...soundConfig };
        if (options.volume !== undefined) {
            config.volume = options.volume;
        }
        
        this.generateAndPlay(config);
    },
    
    /**
     * Para um som (placeholder - sons curtos não precisam parar)
     */
    stop(soundKey) {
        // Sons são muito curtos para precisar parar
    },
    
    /**
     * Para todos os sons
     */
    stopAll() {
        // Sons são muito curtos para precisar parar
    },
    
    // ==================== CONTROLES DE VOLUME ====================
    
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    },
    
    setEnabled(enabled) {
        this.enabled = enabled;
    },
    
    toggleSound() {
        this.enabled = !this.enabled;
        return this.enabled;
    },
    
    isEnabled() {
        return this.enabled;
    }
};

// Exporta globalmente
window.SoundManager = SoundManager;
