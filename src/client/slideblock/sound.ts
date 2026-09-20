let audio: AudioContext | undefined;

function context(): AudioContext {
  if (!audio) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audio = new Ctor();
  }
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

/**
 * iOS/Safari only unlocks (or even finishes constructing) an AudioContext
 * inside the call stack of a real user gesture, and `resume()` is async — so
 * priming it on the earliest possible pointerdown gives the promise time to
 * settle before the first knock() actually needs to be heard.
 */
export function unlock(): void {
  context();
}

/** Wood-on-wood knock: a band-passed click over a quick pitched body thump. */
export function knock(strength: number): void {
  const ac = context();
  const now = ac.currentTime;

  const click = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.05), ac.sampleRate);
  const samples = click.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 8;
  }
  const source = ac.createBufferSource();
  source.buffer = click;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1400 + Math.random() * 500;
  band.Q.value = 2.2;
  const clickGain = ac.createGain();
  clickGain.gain.value = 0.9 * strength;
  source.connect(band).connect(clickGain).connect(ac.destination);

  const body = ac.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(260 + Math.random() * 40, now);
  body.frequency.exponentialRampToValueAtTime(120, now + 0.07);
  const bodyGain = ac.createGain();
  bodyGain.gain.setValueAtTime(0.5 * strength, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  body.connect(bodyGain).connect(ac.destination);

  source.start(now);
  body.start(now);
  body.stop(now + 0.1);
}

/** Rising marimba arpeggio for a freed board. */
export function marimba(): void {
  const ac = context();
  const now = ac.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const start = now + i * 0.09;

    const tone = ac.createOscillator();
    tone.frequency.value = freq;
    const toneGain = ac.createGain();
    toneGain.gain.setValueAtTime(0.0001, start);
    toneGain.gain.exponentialRampToValueAtTime(0.25, start + 0.008);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
    tone.connect(toneGain).connect(ac.destination);

    const strike = ac.createOscillator();
    strike.frequency.value = freq * 4;
    const strikeGain = ac.createGain();
    strikeGain.gain.setValueAtTime(0.07, start);
    strikeGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    strike.connect(strikeGain).connect(ac.destination);

    tone.start(start);
    tone.stop(start + 0.75);
    strike.start(start);
    strike.stop(start + 0.15);
  });
}
