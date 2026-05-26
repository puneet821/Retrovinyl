/**
 * Audio Engine using Web Audio API for EQ Presets.
 */

let audioContext: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;

// Nodes
let bassFilter: BiquadFilterNode | null = null;
let vocalFilter: BiquadFilterNode | null = null;
let convolverNode: ConvolverNode | null = null;
let dryGain: GainNode | null = null;
let wetGain: GainNode | null = null;

/**
 * Initializes the Web Audio context and connects it to the HTMLAudioElement.
 * Must be called after a user gesture (like clicking Play).
 */
export function initAudioEngine(audioElement: HTMLAudioElement) {
  if (audioContext) return; // Already initialized

  // Create context
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  audioContext = new AudioContextClass();

  // Create nodes
  sourceNode = audioContext.createMediaElementSource(audioElement);
  
  bassFilter = audioContext.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 150; // Hz
  bassFilter.gain.value = 0; // Default flat

  vocalFilter = audioContext.createBiquadFilter();
  vocalFilter.type = 'peaking';
  vocalFilter.frequency.value = 2500; // Hz
  vocalFilter.Q.value = 1.0;
  vocalFilter.gain.value = 0; // Default flat

  convolverNode = audioContext.createConvolver();
  convolverNode.buffer = createReverbImpulse(audioContext);

  dryGain = audioContext.createGain();
  wetGain = audioContext.createGain();
  
  dryGain.gain.value = 1;
  wetGain.gain.value = 0; // Default flat (no reverb)

  // Routing:
  // Source -> Bass -> Vocal -> (Split to Dry and Wet)
  // Dry -> Destination
  // Wet -> Convolver -> Destination
  
  sourceNode.connect(bassFilter);
  bassFilter.connect(vocalFilter);
  
  vocalFilter.connect(dryGain);
  dryGain.connect(audioContext.destination);

  vocalFilter.connect(convolverNode);
  convolverNode.connect(wetGain);
  wetGain.connect(audioContext.destination);
}

/**
 * Applies the selected EQ mode.
 */
export function applyEqMode(mode: 'FLAT' | 'BASS' | 'VOCAL' | 'HALL') {
  if (!audioContext || !bassFilter || !vocalFilter || !dryGain || !wetGain) return;

  // Wake up audio context if suspended
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  // Reset all
  bassFilter.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
  vocalFilter.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
  dryGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.1);
  wetGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);

  switch (mode) {
    case 'FLAT':
      // Already reset
      break;
    case 'BASS':
      bassFilter.gain.setTargetAtTime(12, audioContext.currentTime, 0.1); // +12dB bass boost
      break;
    case 'VOCAL':
      vocalFilter.gain.setTargetAtTime(8, audioContext.currentTime, 0.1); // +8dB mid boost
      break;
    case 'HALL':
      // To simulate hall, we use 60% dry, 40% wet reverb
      dryGain.gain.setTargetAtTime(0.7, audioContext.currentTime, 0.1);
      wetGain.gain.setTargetAtTime(0.8, audioContext.currentTime, 0.1);
      break;
  }
}

/**
 * Creates a synthetic impulse response for a Hall reverb effect.
 */
function createReverbImpulse(context: AudioContext) {
  const sampleRate = context.sampleRate;
  const length = sampleRate * 2.5; // 2.5 seconds reverb tail
  const impulse = context.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    // Exponential decay with some white noise
    const decay = Math.exp(-i / (sampleRate * 0.5));
    left[i] = (Math.random() * 2 - 1) * decay;
    right[i] = (Math.random() * 2 - 1) * decay;
  }
  return impulse;
}
