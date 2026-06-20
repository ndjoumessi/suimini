import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { useAppFonts, useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/lib/store';
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

  useEffect(() => {
    seedDemo();
  }, [seedDemo]);

  // Notification listeners live for the whole app session (foreground + tap).
  useEffect(() => setupNotificationListeners(), []);

  // Register for push once a REAL session exists. Demo mode skips silently.
  useEffect(() => {
    const accessToken = session?.access_token;
    if (isDemo || !accessToken) return;
    let active = true;
    (async () => {
      const token = await registerForPushNotifications();
      if (active && token) await savePushToken(token, accessToken);
    })();
    return () => {
      active = false;
    };
  }, [isDemo, session?.access_token]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/home');
      // Demo is fully local — never hit Supabase.
      if (!isDemo) refreshFromRemote();
    }
  }, [isAuthenticated, isDemo, loading, segments, router, refreshFromRemote]);

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
            </Stack>
          </AuthGate>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
