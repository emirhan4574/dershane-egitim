import { ViewStyle } from 'react-native';

/** Masaüstü ekran / ızgara ölçüleri */
export const desktopScreenPad: ViewStyle = {
  padding: 24,
  paddingBottom: 32,
  flexGrow: 1,
  width: '100%',
  maxWidth: 1100,
  alignSelf: 'center',
};

export const desktopStatWidth = '23.5%' as const;

export const desktopQuickWidth = 'auto' as const;
