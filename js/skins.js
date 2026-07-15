// Cosmetic customization (ball skins + kit style) and difficulty presets.

const BALL_SKINS = [
  { id: 'classic', name: 'Clásico', base: '#ffffff', shade: '#d8d8d8', pattern: '#222222' },
  { id: 'gold', name: 'Dorado', base: '#ffe27a', shade: '#c9971b', pattern: '#7a4b00' },
  { id: 'fire', name: 'Fuego', base: '#ff9a56', shade: '#d43d1f', pattern: '#7a1500' },
  { id: 'disco', name: 'Disco', base: '#c9d6ff', shade: '#7b8fd6', pattern: '#2e3b8f' },
];

const KIT_STYLES = [
  { id: 'sash', name: 'Franja' },
  { id: 'stripes', name: 'Rayas' },
  { id: 'solid', name: 'Liso' },
];

// secret ball skin — never listed in BALL_SKINS/the shop, only unlockable via the "ALI" redeem code
const BRAZIL_SKIN = { id: 'brasil', name: 'Brasil', base: '#ffd400', shade: '#0a6b2d', pattern: '#1c4fa0' };

const DIFFICULTIES = {
  easy: { name: 'Fácil', speedMul: 0.85, accuracyMul: 0.6, tackleMul: 0.6, gkMul: 0.75 },
  normal: { name: 'Normal', speedMul: 1, accuracyMul: 1, tackleMul: 1, gkMul: 1 },
  hard: { name: 'Difícil', speedMul: 1.16, accuracyMul: 1.45, tackleMul: 1.35, gkMul: 1.2 },
};

function findBallSkin(id) {
  if (id === 'brasil') return BRAZIL_SKIN;
  return BALL_SKINS.find((s) => s.id === id) || BALL_SKINS[0];
}
function findKitStyle(id) { return KIT_STYLES.find((s) => s.id === id) || KIT_STYLES[0]; }
function findDifficulty(id) { return DIFFICULTIES[id] || DIFFICULTIES.normal; }

// current cosmetic/gameplay selections read by entities.js / ai.js at draw & update time
const RUNTIME = {
  ballSkin: BALL_SKINS[0],
  kitStyle: { A: KIT_STYLES[0], B: KIT_STYLES[0] },
  difficulty: DIFFICULTIES.normal,
};
