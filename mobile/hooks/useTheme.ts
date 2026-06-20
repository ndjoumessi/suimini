/**
 * Theme hook — resolves the active Atelier palette from the user's preference
 * (system / light / dark) and exposes a font loader for the root layout.
 */
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useFonts } from 'expo-font';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { palette, type ThemeName, type Palette } from '@/lib/theme';
import { createKVStorage } from '@/lib/storage';

const mmkv = createKVStorage('suimini-theme');
const themeStorage = {
  getItem: (k: string) => mmkv.getString(k) ?? null,
  setItem: (k: string, v: string) => mmkv.set(k, v),
  removeItem: (k: string) => mmkv.delete(k),
};

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeStore {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    { name: 'suimini-theme-pref', storage: createJSONStorage(() => themeStorage) },
  ),
);

export interface ThemeValue {
  scheme: ThemeName;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

export function useTheme(): ThemeValue {
  const system = useColorScheme();
  const { preference, setPreference } = useThemeStore();
  const scheme: ThemeName =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return { scheme, colors: palette(scheme), preference, setPreference };
}

/** Loads the Atelier font families. Keys MUST match `fonts` in lib/theme.ts. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    BricolageGrotesque: BricolageGrotesque_700Bold,
    HankenGrotesk: HankenGrotesk_400Regular,
    HankenGroteskBold: HankenGrotesk_700Bold,
    IBMPlexMono: IBMPlexMono_400Regular,
    IBMPlexMonoBold: IBMPlexMono_600SemiBold,
  });
  return loaded;
}
