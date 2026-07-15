// Voice announcer using the browser's built-in speech synthesis (no audio files needed).
// Hypes up the human star player by name whenever they do something good.
const COMMENTARY = (() => {
  const STAR_NAME = 'Monreal';
  let voice = null;
  let lastSpeakAt = 0;
  const MIN_GAP = 2.4;

  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    voice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('es')) || voices[0] || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text, force) {
    if (!('speechSynthesis' in window)) return;
    const now = performance.now() / 1000;
    if (!force && now - lastSpeakAt < MIN_GAP) return;
    lastSpeakAt = now;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = 'es-ES';
    u.rate = 1.05;
    u.pitch = 1.08;
    speechSynthesis.speak(u);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const LINES = {
    goalHuman: [
      `¡GOOOOL! ¡Eso es, ${STAR_NAME}!`,
      `¡Qué golazo de ${STAR_NAME}!`,
      `¡Increíble, ${STAR_NAME} la clava adentro!`,
      `¡Lo está haciendo muy bien, ${STAR_NAME}!`,
      `¡Vamos que se puede, ${STAR_NAME}!`,
    ],
    goalRival: ['¡Gol del rival! Hay que reaccionar.', 'Nos empataron, ¡vamos con todo!', 'Duro golpe, pero el partido sigue.'],
    tackle: [`¡Qué recuperación de ${STAR_NAME}!`, `¡Ahí está, bien plantado, ${STAR_NAME}!`],
    nearMiss: [`¡Uy, casi! Buen intento, ${STAR_NAME}`, '¡Qué tapada del arquero!', '¡Se estrelló en el palo!'],
    kickoff: ['¡Comienza el partido!', '¡Arranca el balón, buena suerte!'],
    halftime: ['Fin del primer tiempo.'],
    fulltimeWin: [`¡Victoria! ${STAR_NAME} fue la figura del partido.`],
    fulltimeLose: ['El partido terminó, a levantarse para el próximo.'],
    fulltimeDraw: ['Empate al final del partido.'],
    streak: [`¡${STAR_NAME} está en racha, nadie lo para hoy!`, `¡${STAR_NAME} imparable!`],
  };

  return {
    STAR_NAME,
    unlock() {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    },
    goalHuman() { speak(pick(LINES.goalHuman), true); },
    goalRival() { speak(pick(LINES.goalRival), true); },
    tackle() { speak(pick(LINES.tackle), false); },
    nearMiss() { speak(pick(LINES.nearMiss), false); },
    kickoff() { speak(pick(LINES.kickoff), true); },
    halftime() { speak(pick(LINES.halftime), true); },
    fulltime(result) {
      const key = result === 'win' ? 'fulltimeWin' : result === 'lose' ? 'fulltimeLose' : 'fulltimeDraw';
      speak(pick(LINES[key]), true);
    },
    streak() { speak(pick(LINES.streak), true); },
    say(text) { speak(text, true); },
  };
})();
