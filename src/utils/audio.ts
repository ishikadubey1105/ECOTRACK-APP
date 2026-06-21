// Web Audio API synthesizer for gamified feedback sounds
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!audioCtx) {
    // Standard AudioContext initialization with webkit fallback
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  
  // Resume context in case it was suspended by browser autoplay policy
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  return audioCtx;
}

export function playGamificationSound(type: 'challenge' | 'levelUp'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'challenge') {
      // Pleasant upbeat double chime (e.g., E5 -> A5)
      // First tone (E5: ~659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.4);

      // Second tone (A5: ~880 Hz, slightly delayed)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.2, now + 0.17);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);

    } else if (type === 'levelUp') {
      // Majestic ascending major arpeggio (C4 -> E4 -> G4 -> C5)
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      
      notes.forEach((freq, index) => {
        const toneTime = now + (index * 0.1);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = index === 3 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, toneTime);
        
        gain.gain.setValueAtTime(0, toneTime);
        gain.gain.linearRampToValueAtTime(0.12, toneTime + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, toneTime + 0.6);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(toneTime);
        osc.stop(toneTime + 0.7);
      });

      // Warm retro sub bass support layer to make the Level Up tone feel massive
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(130.81, now); // C3
      
      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime(0.15, now + 0.15);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      
      subOsc.start(now);
      subOsc.stop(now + 0.9);
    }
  } catch (error) {
    console.warn('Web Audio API is not supported or blocked in this browser context:', error);
  }
}
