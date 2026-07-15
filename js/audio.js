// Synthesized sound effects via WebAudio — no external asset files needed.
const SFX = (() => {
  let ctx = null;
  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, duration, type, gainStart, glideTo) {
    const c = ensureCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + duration);
    gain.gain.setValueAtTime(gainStart || 0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  function noise(duration, gainStart) {
    const c = ensureCtx();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(gainStart || 0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(gain).connect(c.destination);
    src.start();
  }

  return {
    kick() { noise(0.08, 0.25); tone(180, 0.08, 'square', 0.15); },
    pass() { tone(520, 0.07, 'triangle', 0.1); },
    bounce() { tone(260, 0.05, 'sine', 0.08); },
    whistle() { tone(1500, 0.25, 'square', 0.12, 1900); },
    whistleLong() { tone(1500, 0.6, 'square', 0.14, 1700); setTimeout(() => tone(1500, 0.6, 'square', 0.14, 1700), 650); },
    goal() {
      [0, 120, 240, 380].forEach((t, i) => setTimeout(() => tone(440 + i * 110, 0.3, 'sawtooth', 0.12), t));
      setTimeout(() => noise(0.5, 0.1), 100);
    },
    postHit() { tone(900, 0.12, 'square', 0.15, 300); },
    click() { tone(700, 0.05, 'sine', 0.08); },
  };
})();
