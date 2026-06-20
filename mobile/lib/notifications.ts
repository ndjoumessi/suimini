/**
 * Push notifications (Expo).
 *
 * Architecture (miroir du web) : le web envoie aujourd'hui des notifications
 * LOCALES d'anniversaire (useBirthdayNotifications → Web Notification). Côté
 * mobile, on ajoute le push DISTANT via Expo : on récupère un Expo Push Token et
 * on le transmet au backend, qui pourra pousser via l'API Expo.
 *
 * ⚠️ Pré-requis non encore en place côté serveur :
 *   • Un projectId EAS (app.json → extra.eas.projectId) est requis pour obtenir
 *     un token : lancez `eas init`. Sans lui, registerForPushNotifications()
 *     renvoie null (aucun crash).
 *   • L'endpoint d'enregistrement (`/api/push/register`) et la table des tokens
 *     n'existent pas encore côté web ; savePushToken() est donc « best-effort »
 *     (POST tolérant aux échecs). URL configurable via EXPO_PUBLIC_PUSH_REGISTER_URL.
 *   • Le push distant ne fonctionne pas dans Expo Go (SDK 53+) → build de dev.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { createKVStorage } from './storage';

const store = createKVStorage('suimini-push');
const TOKEN_KEY = 'expo_push_token';
const ENABLED_KEY = 'push_enabled';

const REGISTER_URL =
  process.env.EXPO_PUBLIC_PUSH_REGISTER_URL ??
  'https://suimini.vercel.app/api/push/register';

/** Foreground display behaviour — show banner + list, no badge bump. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export function getStoredPushToken(): string | null {
  return store.getString(TOKEN_KEY) ?? null;
}

export function isPushEnabled(): boolean {
  return store.getString(ENABLED_KEY) === '1';
}

function setEnabled(on: boolean) {
  store.set(ENABLED_KEY, on ? '1' : '0');
}

export async function getPushPermissionStatus(): Promise<PushPermission> {
  if (!Device.isDevice) return 'undetermined';
  const { status } = await Notifications.getPermissionsAsync();
  return status as PushPermission;
}

/** Resolve the EAS project id needed by getExpoPushTokenAsync (null if absent). */
function getProjectId(): string | null {
  const fromExtra =
    (Constants.expoConfig?.extra as any)?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;
  return typeof fromExtra === 'string' && fromExtra.length ? fromExtra : null;
}

/**
 * Asks permission, configures the Android channel, and returns an Expo Push
 * Token — or null if unavailable (simulator, permission denied, no EAS project).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[push] Notifications push indisponibles sur simulateur.');
    return null;
  }

  // Android requires an explicit channel for notifications to surface.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Suimini',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#bf4b2c',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    console.warn('[push] Permission notifications refusée.');
    setEnabled(false);
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn(
      '[push] Aucun projectId EAS (app.json → extra.eas.projectId). ' +
        'Lancez `eas init` pour activer les push distants.',
    );
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    store.set(TOKEN_KEY, token);
    setEnabled(true);
    return token;
  } catch (e: any) {
    console.warn('[push] Échec getExpoPushTokenAsync:', e?.message ?? e);
    return null;
  }
}

/**
 * Transmet le token au backend (best-effort). Authentifie via le Bearer Supabase.
 * Tolère l'absence d'endpoint (404/échec réseau) sans lever d'exception.
 */
export async function savePushToken(
  token: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        provider: 'expo',
      }),
    });
    if (!res.ok) {
      console.warn(`[push] /push/register a répondu ${res.status} (endpoint à créer côté serveur).`);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn('[push] Envoi du token échoué (best-effort):', e?.message ?? e);
    return false;
  }
}

/** Désactive le push localement (oublie le token + le flag). */
export function disablePush(): void {
  store.delete(TOKEN_KEY);
  setEnabled(false);
}

/**
 * Branche les listeners : affichage en foreground + navigation au tap.
 * Le payload `data` peut porter `{ personId }` ou `{ route, params }`.
 * Retourne une fonction de nettoyage.
 */
export function setupNotificationListeners(): () => void {
  const received = Notifications.addNotificationReceivedListener((n) => {
    // Foreground : le handler ci-dessus gère déjà l'affichage. Hook si besoin.
    if (__DEV__) console.log('[push] reçue:', n.request.content.title);
  });

  const responded = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data = resp.notification.request.content.data as
      | { personId?: string; route?: string; params?: Record<string, string> }
      | undefined;
    if (!data) return;
    try {
      if (data.personId) {
        router.push({ pathname: '/person/[id]', params: { id: data.personId } });
      } else if (data.route) {
        router.push(
          (data.params
            ? { pathname: data.route as any, params: data.params }
            : (data.route as any)),
        );
      }
    } catch {
      /* navigation best-effort */
    }
  });

  return () => {
    received.remove();
    responded.remove();
  };
}
