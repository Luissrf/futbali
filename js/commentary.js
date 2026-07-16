// Voice narrator disabled — kept as a no-op stub so every call site elsewhere (main.js) still works.
const COMMENTARY = (() => {
  const STAR_NAME = 'Monreal';
  const noop = () => {};
  return {
    STAR_NAME,
    unlock: noop,
    goalHuman: noop,
    goalRival: noop,
    tackle: noop,
    nearMiss: noop,
    kickoff: noop,
    halftime: noop,
    fulltime: noop,
    streak: noop,
    say: noop,
  };
})();
