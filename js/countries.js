// Selectable national teams: flag emoji (native, no image assets needed) + kit colors.
const COUNTRIES = [
  { code: 'BRA', name: 'Brasil', flag: '🇧🇷', main: '#ffd400', dark: '#0a6b2d', trim: '#0a6b2d' },
  { code: 'ARG', name: 'Argentina', flag: '🇦🇷', main: '#7ec7ee', dark: '#3d3d3d', trim: '#ffd400' },
  { code: 'ESP', name: 'España', flag: '🇪🇸', main: '#e0352b', dark: '#a3271f', trim: '#ffd400' },
  { code: 'FRA', name: 'Francia', flag: '🇫🇷', main: '#1e3a8a', dark: '#12235a', trim: '#e0352b' },
  { code: 'GER', name: 'Alemania', flag: '🇩🇪', main: '#f5f5f5', dark: '#b8b8b8', trim: '#000' },
  { code: 'ITA', name: 'Italia', flag: '🇮🇹', main: '#1c4fa0', dark: '#123167', trim: '#fff' },
  { code: 'ENG', name: 'Inglaterra', flag: '🏴', main: '#f5f5f5', dark: '#c0c0c0', trim: '#1c4fa0' },
  { code: 'POR', name: 'Portugal', flag: '🇵🇹', main: '#c8102e', dark: '#8c0b20', trim: '#0a6b2d' },
  { code: 'URU', name: 'Uruguay', flag: '🇺🇾', main: '#7ec7ee', dark: '#3d3d3d', trim: '#ffd400' },
  { code: 'MEX', name: 'México', flag: '🇲🇽', main: '#0a6b2d', dark: '#054018', trim: '#e0352b' },
  { code: 'COL', name: 'Colombia', flag: '🇨🇴', main: '#ffd400', dark: '#b89600', trim: '#1e3a8a' },
  { code: 'CHI', name: 'Chile', flag: '🇨🇱', main: '#e0352b', dark: '#a3271f', trim: '#1e3a8a' },
  { code: 'NED', name: 'Países Bajos', flag: '🇳🇱', main: '#ff7f00', dark: '#c26100', trim: '#1e3a8a' },
  { code: 'BEL', name: 'Bélgica', flag: '🇧🇪', main: '#e0352b', dark: '#a3271f', trim: '#000' },
  { code: 'CRO', name: 'Croacia', flag: '🇭🇷', main: '#f5f5f5', dark: '#c0c0c0', trim: '#e0352b' },
  { code: 'USA', name: 'Estados Unidos', flag: '🇺🇸', main: '#1e3a8a', dark: '#12235a', trim: '#e0352b' },
  { code: 'JPN', name: 'Japón', flag: '🇯🇵', main: '#1c4fa0', dark: '#123167', trim: '#f5f5f5' },
  { code: 'KOR', name: 'Corea del Sur', flag: '🇰🇷', main: '#f5f5f5', dark: '#c0c0c0', trim: '#e0352b' },
  { code: 'MAR', name: 'Marruecos', flag: '🇲🇦', main: '#c8102e', dark: '#8c0b20', trim: '#0a6b2d' },
  { code: 'SEN', name: 'Senegal', flag: '🇸🇳', main: '#0a6b2d', dark: '#054018', trim: '#ffd400' },
  { code: 'GHA', name: 'Ghana', flag: '🇬🇭', main: '#e0352b', dark: '#a3271f', trim: '#ffd400' },
  { code: 'NGA', name: 'Nigeria', flag: '🇳🇬', main: '#0a6b2d', dark: '#054018', trim: '#f5f5f5' },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺', main: '#ffd400', dark: '#b89600', trim: '#0a6b2d' },
  { code: 'CAN', name: 'Canadá', flag: '🇨🇦', main: '#e0352b', dark: '#a3271f', trim: '#f5f5f5' },
  { code: 'PER', name: 'Perú', flag: '🇵🇪', main: '#e0352b', dark: '#a3271f', trim: '#f5f5f5' },
  { code: 'ECU', name: 'Ecuador', flag: '🇪🇨', main: '#ffd400', dark: '#b89600', trim: '#1e3a8a' },
  { code: 'CRC', name: 'Costa Rica', flag: '🇨🇷', main: '#e0352b', dark: '#a3271f', trim: '#1e3a8a' },
  { code: 'PAR', name: 'Paraguay', flag: '🇵🇾', main: '#e0352b', dark: '#a3271f', trim: '#1e3a8a' },
];

// tiny extra: a hidden joke "country" unlocked via easter egg, never listed in COUNTRIES
const GHOST_TEAM = { code: 'GHO', name: 'Fantasmas FC', flag: '👻', main: '#e8f4f8', dark: '#9fb9c2', trim: '#4a4a4a' };

function findCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
}
