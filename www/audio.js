// SmartTracker Soundscape Synthesizer using Web Audio API

class SoundscapeEngine {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
        this.currentSound = 'none';
        
        // Audio nodes references
        this.noiseNode = null;
        this.rainFilterNode = null;
        
        // Forest scheduling timers
        this.forestTimers = [];
        this.isPlaying = false;
    }

    init() {
        if (this.ctx) return;
        
        // Create context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Master gain node
        this.masterVolume = this.ctx.createGain();
        this.masterVolume.gain.setValueAtTime(0.5, this.ctx.currentTime);
        this.masterVolume.connect(this.ctx.destination);
    }

    setVolume(value) {
        if (!this.masterVolume) return;
        // value ranges from 0 to 1
        this.masterVolume.gain.setValueAtTime(value, this.ctx.currentTime);
    }

    async play(soundType) {
        this.init();
        
        // Resume context if suspended (browser security)
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.stopCurrent();
        this.currentSound = soundType;
        this.isPlaying = true;

        if (soundType === 'white') {
            this.playWhiteNoise();
        } else if (soundType === 'rain') {
            this.playRain();
        } else if (soundType === 'forest') {
            this.playForest();
        }
    }

    stopCurrent() {
        this.isPlaying = false;
        
        // Stop noise buffer source
        if (this.noiseNode) {
            try {
                this.noiseNode.stop();
            } catch(e) {}
            this.noiseNode.disconnect();
            this.noiseNode = null;
        }

        // Cancel forest synth interval timers
        this.forestTimers.forEach(timer => {
            clearInterval(timer);
            clearTimeout(timer);
        });
        this.forestTimers = [];
        
        this.currentSound = 'none';
    }

    // --- Noise Buffer Generator ---
    createNoiseBuffer() {
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        return noiseBuffer;
    }

    // --- White Noise ---
    playWhiteNoise() {
        const buffer = this.createNoiseBuffer();
        this.noiseNode = this.ctx.createBufferSource();
        this.noiseNode.buffer = buffer;
        this.noiseNode.loop = true;
        
        this.noiseNode.connect(this.masterVolume);
        this.noiseNode.start(0);
    }

    // --- Rain Synthesizer ---
    playRain() {
        const buffer = this.createNoiseBuffer();
        this.noiseNode = this.ctx.createBufferSource();
        this.noiseNode.buffer = buffer;
        this.noiseNode.loop = true;

        // Bandpass filter to shape the rain sound
        this.rainFilterNode = this.ctx.createBiquadFilter();
        this.rainFilterNode.type = 'bandpass';
        this.rainFilterNode.frequency.setValueAtTime(450, this.ctx.currentTime);
        this.rainFilterNode.Q.setValueAtTime(0.7, this.ctx.currentTime);

        // Lowpass filter for rumbling undertone
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(1200, this.ctx.currentTime);

        // Connect nodes
        this.noiseNode.connect(this.rainFilterNode);
        this.rainFilterNode.connect(lowpass);
        lowpass.connect(this.masterVolume);
        
        this.noiseNode.start(0);

        // Create organic wind/rain swells by modulating the bandpass frequency
        let lastFreq = 450;
        const swellInterval = setInterval(() => {
            if (!this.isPlaying || this.currentSound !== 'rain') {
                clearInterval(swellInterval);
                return;
            }
            // Slowly sweep bandpass center frequency between 350Hz and 600Hz
            const targetFreq = 350 + Math.random() * 250;
            this.rainFilterNode.frequency.exponentialRampToValueAtTime(targetFreq, this.ctx.currentTime + 3);
            lastFreq = targetFreq;
        }, 3000);
        
        this.forestTimers.push(swellInterval);
    }

    // --- Forest Ambient Synthesizer ---
    playForest() {
        // Crickets background synthesizer
        this.startCricketsLoop();
        
        // Random Bird Chirp Scheduler
        const scheduleBirds = () => {
            if (!this.isPlaying || this.currentSound !== 'forest') return;
            
            this.synthesizeBirdChirp();
            
            // Schedule next chirp in 4 to 12 seconds
            const nextChirpDelay = 4000 + Math.random() * 8000;
            const timer = setTimeout(scheduleBirds, nextChirpDelay);
            this.forestTimers.push(timer);
        };
        
        scheduleBirds();
    }

    startCricketsLoop() {
        // Crickets are simulated using a high-pitched oscillator pulsed by a low frequency oscillator
        const osc = this.ctx.createOscillator();
        const amp = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(4200, this.ctx.currentTime); // High pitch chirping
        
        // Pulse gain node
        amp.gain.setValueAtTime(0.015, this.ctx.currentTime); // Very quiet background
        
        osc.connect(amp);
        amp.connect(this.masterVolume);
        osc.start(0);

        // Modulate volume rapidly to create cricket "chirrup" sound
        let isChirping = true;
        const cricketInterval = setInterval(() => {
            if (!this.isPlaying || this.currentSound !== 'forest') {
                osc.stop();
                osc.disconnect();
                amp.disconnect();
                clearInterval(cricketInterval);
                return;
            }
            
            const now = this.ctx.currentTime;
            if (isChirping) {
                // Pulse frequency
                amp.gain.setValueAtTime(0.012, now);
                amp.gain.linearRampToValueAtTime(0.002, now + 0.08);
            } else {
                amp.gain.setValueAtTime(0, now);
            }
            
            // Toggle chirp state
            if (Math.random() < 0.15) {
                isChirping = !isChirping;
            }
        }, 120);

        this.forestTimers.push(cricketInterval);
    }

    synthesizeBirdChirp() {
        const now = this.ctx.currentTime;
        
        // Bird chirps are rapid sweeping sine oscillators
        const osc = this.ctx.createOscillator();
        const amp = this.ctx.createGain();
        
        osc.type = 'sine';
        
        // Random bird starting pitch (1500Hz - 2500Hz)
        const baseFreq = 1800 + Math.random() * 700;
        osc.frequency.setValueAtTime(baseFreq, now);
        
        amp.gain.setValueAtTime(0.001, now);
        
        osc.connect(amp);
        amp.connect(this.masterVolume);
        
        osc.start(now);
        
        // Create 3 rapid sweeping chirps
        let timeOffset = 0;
        const chirpCount = 2 + Math.floor(Math.random() * 2);
        
        for (let i = 0; i < chirpCount; i++) {
            const start = now + timeOffset;
            const duration = 0.08 + Math.random() * 0.05;
            
            amp.gain.setValueAtTime(0, start);
            amp.gain.linearRampToValueAtTime(0.06, start + 0.02);
            amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
            
            // Sweep frequency up, then rapidly down
            osc.frequency.setValueAtTime(baseFreq, start);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, start + 0.03);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, start + duration);
            
            timeOffset += duration + 0.05;
        }
        
        osc.stop(now + timeOffset);
        
        // Clean up nodes after chirping completes
        setTimeout(() => {
            osc.disconnect();
            amp.disconnect();
        }, (timeOffset + 0.5) * 1000);
    }

    // --- Bell Chime for focus completion ---
    playFocusEndChime() {
        this.init();
        const now = this.ctx.currentTime;
        
        // Create sine oscillators at core resonant frequencies (Tibetan Bowl sound)
        const frequencies = [528, 792, 1056, 1320]; // Harmonious ratios
        const gains = [0.15, 0.08, 0.04, 0.02];     // Decaying intensity per harmonic
        
        frequencies.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const amp = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            
            amp.gain.setValueAtTime(0, now);
            amp.gain.linearRampToValueAtTime(gains[index], now + 0.05); // Rapid attack
            amp.gain.exponentialRampToValueAtTime(0.0001, now + 3.5 - (index * 0.4)); // Natural decay
            
            osc.connect(amp);
            amp.connect(this.masterVolume);
            
            osc.start(now);
            osc.stop(now + 4);
            
            setTimeout(() => {
                osc.disconnect();
                amp.disconnect();
            }, 4500);
        });
    }
}

// Instantiate global audio manager
const Soundscape = new SoundscapeEngine();
window.Soundscape = Soundscape;
