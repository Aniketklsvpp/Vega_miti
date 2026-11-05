export const TOKENS = {
  parchment: '#F3EBDD',
  parchmentLight: '#FAF6EE',
  parchmentDark: '#E5DBC7',
  ink: '#1F2A33',
  inkMuted: '#526573',
  inkLight: '#8C9BA5',
  riverTeal: '#2F7F8F',
  riverTealLight: '#E8F2F4',
  ochre: '#B8893B',
  ochreLight: '#F7F0E3',
  extremeVermilion: '#D8432B',
  extremeVermilionLight: '#FBECE9',
  border: '#DDD1BF',
  borderSubtle: '#EAE1D2',

  bgMain: '#F3EBDD',
  surface: '#FAF6EE',
  surfaceSecondary: '#EAE1D2',
  primaryNavy: '#1F2A33',
  riverBlue: '#2F7F8F',
  accentTeal: '#2F7F8F',
  secondaryText: '#526573',
  warning: '#B8893B',
  extremeDischarge: '#D8432B',
} as const

export type ColorTokens = typeof TOKENS
