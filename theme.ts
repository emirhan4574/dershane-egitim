import { Platform } from 'react-native';

/** Okunaklı sistem yazı tipi (özel display font yok) */
const systemFont =
  Platform.OS === 'web'
    ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    : undefined;

export const colors = {
  bg: '#F0F4F8',
  bgSoft: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  ink: '#0F172A',
  muted: '#64748B',
  line: '#E2E8F0',
  lineSoft: '#F1F5F9',
  brand: '#0D9488',
  brandDeep: '#0F766E',
  brandSoft: '#2DD4BF',
  brandMist: '#CCFBF1',
  accent: '#0D9488',
  accentDeep: '#0F766E',
  accentSoft: '#CCFBF1',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
  teacher: '#0D9488',
  student: '#0284C7',
  panel: '#F8FAFC',
  stripe: '#1E293B',
  rail: '#0F172A',
  railText: '#F8FAFC',
  railMuted: '#94A3B8',
  glow: 'transparent',
  statGreen: '#22C55E',
  statPink: '#EC4899',
  statOrange: '#F97316',
  statGold: '#EAB308',
  loginDeep: '#0F766E',
  loginMid: '#14B8A6',
  loginSoft: '#5EEAD4',
  loginSky: '#E0F2FE',
};

export const fonts = {
  display: systemFont as string | undefined,
  displaySemi: systemFont as string | undefined,
  body: systemFont as string | undefined,
  bodyMed: systemFont as string | undefined,
  bodySemi: systemFont as string | undefined,
  bodyBold: systemFont as string | undefined,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
};
