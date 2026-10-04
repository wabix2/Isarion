import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * The app currently ships one cohesive palette, keyed `light` for
 * backward compatibility with existing imports, whose background
 * (#0A0C12) matches the app's declared splash/icon background in
 * app.json. If a distinct light-mode palette is added later under a
 * `dark` key, this hook already switches on the device's appearance
 * setting automatically — no call sites need to change.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette =
    scheme === 'dark' && 'dark' in colors
      ? (colors as Record<string, typeof colors.light>).dark
      : colors.light;
  return { ...palette, radius: colors.radius };
}
