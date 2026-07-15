// Coins, daily missions, one-time achievements, and cosmetic unlocks — all persisted locally
// on this device via localStorage (no server/account, per-device progress only).

const MISSION_POOL = [
  { id: 'goals2', kind: 'matchStat', statKey: 'goals', target: 2, text: 'Meté al menos 2 goles en un partido', reward: 15 },
  { id: 'goals4', kind: 'matchStat', statKey: 'goals', target: 4, text: 'Meté al menos 4 goles en un partido', reward: 28 },
  { id: 'win1', kind: 'matchStat', statKey: 'win', target: 1, text: 'Ganá un partido', reward: 15 },
  { id: 'tackles3', kind: 'matchStat', statKey: 'tackles', target: 3, text: 'Recuperá la pelota 3 veces en un partido', reward: 18 },
  { id: 'hardWin', kind: 'matchStat', statKey: 'hardWin', target: 1, text: 'Ganá un partido en dificultad Difícil', reward: 28 },
  { id: 'roundWin', kind: 'matchStat', statKey: 'tournamentRoundWin', target: 1, text: 'Ganá una ronda de torneo', reward: 20 },
  { id: 'secondHalf', kind: 'matchStat', statKey: 'secondHalfGoal', target: 1, text: 'Meté un gol en el segundo tiempo', reward: 15 },
  { id: 'matches3', kind: 'cumulative', statKey: 'matchesPlayedToday', target: 3, text: 'Jugá 3 partidos hoy', reward: 15 },
  { id: 'wins2', kind: 'cumulative', statKey: 'winsToday', target: 2, text: 'Ganá 2 partidos hoy', reward: 25 },
  { id: 'countries3', kind: 'cumulative', statKey: 'distinctCountriesToday', target: 3, text: 'Jugá con 3 países distintos hoy', reward: 20 },
];

const ACHIEVEMENTS = [
  { id: 'first_goal', text: 'Primer gol', reward: 20 },
  { id: 'first_win', text: 'Primera victoria', reward: 25 },
  { id: 'first_tournament', text: 'Primer campeón de torneo', reward: 60 },
  { id: 'ten_matches', text: 'Jugaste 10 partidos', reward: 40 },
  { id: 'hat_trick', text: 'Hat-trick: 3 goles en un partido', reward: 35 },
  { id: 'ball_collector', text: 'Desbloqueaste los 4 balones', reward: 50 },
  { id: 'kit_collector', text: 'Desbloqueaste las 3 camisetas', reward: 30 },
  { id: 'two_player_win', text: 'Ganaste un partido de 2 jugadores', reward: 25 },
];

const SHOP_PRICES = {
  ballSkin: { classic: 0, gold: 120, fire: 160, disco: 200 },
  kit: { sash: 0, stripes: 90, solid: 70 },
};

// Secret redeemable codes — entered by the player in the "Códigos secretos" screen. Matching is
// accent/case/punctuation-insensitive (see normalizeCode), so "Me Gustas ❤️" and "megustas" both hit 'love'.
const SECRET_CODES = [
  { id: 'love', keys: ['ALI'], coins: 100, unlock: { kind: 'ballSkin', id: 'brasil' }, message: 'Me gustas ❤️ +100 🪙 y el balón especial de Brasil 🇧🇷' },
  { id: 'star', keys: ['MONREAL'], coins: 50, message: '⭐ ¡Monreal te manda un saludo! +50 🪙' },
  { id: 'welcome', keys: ['FUTBALI'], coins: 40, message: '⚽ +40 🪙 de bienvenida a FUTBALI' },
  { id: 'champion', keys: ['CAMPEON', 'CAMPEÓN'], coins: 60, message: '🏆 +60 🪙 de campeón honorario' },
  { id: 'ghost', keys: ['FANTASMA', 'FANTASMAS'], coins: 20, unlock: { kind: 'ghostTeam' }, message: '👻 +20 🪙 y el equipo secreto Fantasmas FC' },
  { id: 'golazo', keys: ['GOLAZO'], coins: 30, message: '⚽ ¡GOLAZO! +30 🪙' },
];

function normalizeCode(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÑ]/g, '');
}

const PROGRESS = (() => {
  const STORAGE_KEY = 'futali_progress_v1';

  function defaultData() {
    return {
      coins: 0,
      unlockedBallSkins: ['classic'],
      unlockedKits: ['sash'],
      achievements: {},
      stats: { matches: 0, wins: 0, goals: 0, tournamentChamps: 0 },
      daily: { date: null, missions: [], countriesUsed: [] },
      teamName: '',
      redeemedCodes: [],
    };
  }

  let data;
  try {
    data = Object.assign(defaultData(), JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
  } catch (e) {
    data = defaultData();
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function seededShuffle(arr, seed) {
    const a = arr.slice();
    let s = seed || 1;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function ensureDaily() {
    const today = todayStr();
    if (data.daily.date !== today) {
      const picked = seededShuffle(MISSION_POOL, hashStr(today)).slice(0, 3);
      data.daily = { date: today, missions: picked.map((t) => ({ id: t.id, progress: 0, done: false })), countriesUsed: [] };
      save();
    }
  }
  ensureDaily();

  function missionTemplate(id) { return MISSION_POOL.find((m) => m.id === id); }

  function bumpCumulative(statKey, amount) {
    ensureDaily();
    const mission = data.daily.missions.find((m) => {
      const t = missionTemplate(m.id);
      return t && t.kind === 'cumulative' && t.statKey === statKey && !m.done;
    });
    if (!mission) return null;
    mission.progress += amount;
    const t = missionTemplate(mission.id);
    if (mission.progress >= t.target) {
      mission.done = true;
      data.coins += t.reward;
      save();
      return { text: t.text, reward: t.reward };
    }
    save();
    return null;
  }

  function checkMatchStatMissions(tally) {
    ensureDaily();
    const completed = [];
    for (const mission of data.daily.missions) {
      if (mission.done) continue;
      const t = missionTemplate(mission.id);
      if (t.kind !== 'matchStat') continue;
      if ((tally[t.statKey] || 0) >= t.target) {
        mission.done = true;
        mission.progress = t.target;
        data.coins += t.reward;
        completed.push({ text: t.text, reward: t.reward });
      }
    }
    if (completed.length) save();
    return completed;
  }

  function unlockAchievement(id) {
    if (data.achievements[id]) return null;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return null;
    data.achievements[id] = true;
    data.coins += a.reward;
    save();
    return { text: a.text, reward: a.reward };
  }

  function checkCollectionAchievements() {
    const unlocked = [];
    if (data.unlockedBallSkins.length >= BALL_SKINS.length) {
      const r = unlockAchievement('ball_collector');
      if (r) unlocked.push(r);
    }
    if (data.unlockedKits.length >= KIT_STYLES.length) {
      const r = unlockAchievement('kit_collector');
      if (r) unlocked.push(r);
    }
    return unlocked;
  }

  return {
    get coins() { return data.coins; },
    get dailyMissions() {
      ensureDaily();
      return data.daily.missions.map((m) => ({ ...m, ...missionTemplate(m.id) }));
    },
    isUnlocked(kind, id) {
      return (kind === 'ballSkin' ? data.unlockedBallSkins : data.unlockedKits).includes(id);
    },
    priceOf(kind, id) { return SHOP_PRICES[kind][id] || 0; },

    tryPurchase(kind, id) {
      const list = kind === 'ballSkin' ? data.unlockedBallSkins : data.unlockedKits;
      if (list.includes(id)) return { ok: true, already: true };
      const price = SHOP_PRICES[kind][id] || 0;
      if (data.coins < price) return { ok: false, needed: price - data.coins };
      data.coins -= price;
      list.push(id);
      save();
      const unlocks = checkCollectionAchievements();
      return { ok: true, unlocks };
    },

    // called once when a match kicks off, to reset the "distinct countries today" tracker entry
    recordCountryPlayed(code) {
      ensureDaily();
      if (!data.daily.countriesUsed.includes(code)) {
        data.daily.countriesUsed.push(code);
        save();
        return bumpCumulative('distinctCountriesToday', data.daily.countriesUsed.length >= 0 ? 1 : 0);
      }
      return null;
    },

    // tally: { goals, tackles, win, hardWin, tournamentRoundWin, secondHalfGoal }
    // returns { coinsEarned, missions: [...], achievements: [...] }
    finishMatch(tally) {
      ensureDaily();
      let coinsEarned = 8 + tally.goals * 3 + (tally.win ? 15 : tally.draw ? 5 : 0);
      data.coins += coinsEarned;
      data.stats.matches++;
      data.stats.goals += tally.goals;
      if (tally.win) data.stats.wins++;

      const missions = checkMatchStatMissions(tally);
      const m1 = bumpCumulative('matchesPlayedToday', 1);
      if (m1) missions.push(m1);
      if (tally.win) {
        const m2 = bumpCumulative('winsToday', 1);
        if (m2) missions.push(m2);
      }
      missions.forEach((m) => { coinsEarned += m.reward; });

      const achievements = [];
      if (data.stats.goals >= 1) { const r = unlockAchievement('first_goal'); if (r) achievements.push(r); }
      if (data.stats.wins >= 1) { const r = unlockAchievement('first_win'); if (r) achievements.push(r); }
      if (data.stats.matches >= 10) { const r = unlockAchievement('ten_matches'); if (r) achievements.push(r); }
      if (tally.goals >= 3) { const r = unlockAchievement('hat_trick'); if (r) achievements.push(r); }
      if (tally.win && tally.twoPlayer) { const r = unlockAchievement('two_player_win'); if (r) achievements.push(r); }
      achievements.forEach((a) => { coinsEarned += a.reward; });

      save();
      return { coinsEarned, missions, achievements };
    },

    recordTournamentChampion() {
      data.stats.tournamentChamps++;
      const coinsEarned = 60;
      data.coins += coinsEarned;
      const achievement = unlockAchievement('first_tournament');
      save();
      return { coinsEarned, achievement };
    },

    get teamName() { return data.teamName || ''; },
    setTeamName(name) {
      data.teamName = (name || '').trim().slice(0, 16);
      save();
    },

    // input: raw text the player typed. Returns { ok, reason: 'used'|'invalid', message, coins, unlock }
    redeemCode(input) {
      const norm = normalizeCode(input);
      if (!norm) return { ok: false, reason: 'invalid' };
      const found = SECRET_CODES.find((c) => c.keys.includes(norm));
      if (!found) return { ok: false, reason: 'invalid' };
      if (data.redeemedCodes.includes(found.id)) return { ok: false, reason: 'used', message: found.message };

      data.redeemedCodes.push(found.id);
      data.coins += found.coins;
      if (found.unlock && found.unlock.kind === 'ballSkin' && !data.unlockedBallSkins.includes(found.unlock.id)) {
        data.unlockedBallSkins.push(found.unlock.id);
      }
      save();
      return { ok: true, message: found.message, coins: found.coins, unlock: found.unlock };
    },
  };
})();
