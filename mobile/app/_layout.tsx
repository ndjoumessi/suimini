import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { useAppFonts, useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { isRailwayRealtimeEnabled, connectTreeRelay } from '@/lib/realtimeRelay';
import {
  registerForPushNotifications,
  savePushToken,
  setupNotificationListeners,
} from '@/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Redirects between the (auth) and (tabs) groups based on session state. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isDemo, loading, session } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const refreshFromRemote = useStore((s) => s.refreshFromRemote);
  const seedDemo = useStore((s) => s.seedDemo);
  const activeTreeId = useStore((s) => s.activeTreeId);
  const lastForegroundRefreshRef = useRef(0);
  const lastRelayRefreshRef = useRef(0);

  useEffect(() => {
    seedDemo();
  }, [seedDemo]);

  // Notification listeners live for the whole app session (foreground + tap).
  useEffect(() => setupNotificationListeners(), []);

  // A REAL session (launch with a restored session OR fresh login) loads the
  // user's own trees from Supabase and registers for push. Demo skips silently.
  useEffect(() => {
    const accessToken = session?.access_token;
    if (isDemo || !accessToken) return;
    let active = true;
    refreshFromRemote();
    (async () => {
      const token = await registerForPushNotifications();
      if (active && token) await savePushToken(token, accessToken);
    })();
    return () => {
      active = false;
    };
  }, [isDemo, session?.access_token, refreshFromRemote]);

  // Resync au retour au premier plan (équivalent mobile du garde-fou
  // "visibilitychange" du store web — voir useFamilyStore.ts). Le canal
  // Realtime web n'existe pas côté mobile et, de toute façon, écoute des
  // tables SUPABASE qui ne bougent plus depuis le passage à 100%
  // `DB_BACKEND=railway` (les écritures d'un autre appareil — ex. l'app web,
  // ou ce même compte sur un autre téléphone — n'étaient donc JAMAIS
  // rattrapées avant un relancement complet de l'app). Seuil anti-rafale de
  // 10s (aligné sur STALE_MS côté web) pour ne pas re-fetcher à chaque
  // micro va-et-vient d'AppState.
  useEffect(() => {
    if (isDemo || !session?.access_token) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const now = Date.now();
      if (now - lastForegroundRefreshRef.current < 10_000) return;
      lastForegroundRefreshRef.current = now;
      refreshFromRemote();
    });
    return () => sub.remove();
  }, [isDemo, session?.access_token, refreshFromRemote]);

  // Temps réel Railway (ADDITIF, derrière EXPO_PUBLIC_REALTIME_BACKEND=railway).
  // Complète le resync d'AppState ci-dessus : met à jour l'arbre affiché EN DIRECT
  // pendant qu'un autre appareil (ex. l'app web) le modifie, sans attendre un
  // retour au premier plan. Flag absent → cet effet ne fait RIEN. Le contenu réel
  // est rechargé par refreshFromRemote (API authentifiée), le relais ne transporte
  // aucune donnée. Voir docs/railway-realtime-plan.md.
  useEffect(() => {
    if (isDemo || !session?.access_token || !activeTreeId) return;
    if (!isRailwayRealtimeEnabled() || !supabase) return;
    const sb = supabase;
    const handle = connectTreeRelay({
      url: process.env.EXPO_PUBLIC_REALTIME_URL as string,
      treeId: activeTreeId,
      getToken: async () => {
        const { data } = await sb.auth.getSession();
        return data.session?.access_token ?? null;
      },
      onChange: () => {
        const now = Date.now();
        // Anti-rafale : un UPSERT distant émet plusieurs signaux ; le relais coalesce
        // déjà, on garde un petit garde-fou local (refreshFromRemote recharge tout).
        if (now - lastRelayRefreshRef.current < 3_000) return;
        lastRelayRefreshRef.current = now;
        refreshFromRemote();
      },
    });
    return () => handle.close();
  }, [isDemo, session?.access_token, activeTreeId, refreshFromRemote]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, isDemo, loading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const { colors, scheme } = useTheme();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="person/[id]"
                options={{ presentation: 'card' }}
              />
              <Stack.Screen
                name="person/edit"
                options={{ presentation: 'modal' }}
              />
            </Stack>
          </AuthGate>
        </View>
        </SafeAreaProvider>
      </I18nextProvider>
    </GestureHandlerRootView>
  );
}
