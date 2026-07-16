/**
 * Crash-proof key-value storage.
 *
 * MMKV is a native module: it is unavailable in **Expo Go** (and in any build
 * where autolinking hasn't run). Calling `new MMKV()` there throws *at module
 * load time*, which cascades — every route importing the store/hooks fails to
 * evaluate and Expo Router reports "missing the required default export".
 *
 * This factory isolates that risk: it tries MMKV, and on any failure falls back
 * to an in-memory map exposing the exact surface we use (`getString` / `set` /
 * `delete`). The app then boots everywhere; persistence is simply per-session
 * when the native module is absent (e.g. Expo Go). Use a dev build for real
 * on-device persistence.
 */
import * as SecureStore from 'expo-secure-store';

export interface KVStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

function createMemoryStorage(): KVStorage {
  const map = new Map<string, string>();
  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
    delete: (key) => {
      map.delete(key);
    },
  };
}

// Sécu F3 — chiffrement au repos du stockage de session (MMKV n'est PAS chiffré
// par défaut : les tokens Supabase étaient écrits en clair sur le disque).
const KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Génère une clé de 16 caractères ASCII = 16 octets exactement (limite MMKV :
 * "Encryption keys can have a maximum length of 16 bytes"). L'entropie de la
 * clé compte moins que sa PROTECTION : elle vit dans le Keychain (iOS) /
 * Keystore (Android) via expo-secure-store — exclus des sauvegardes non
 * chiffrées, protégés matériellement quand disponible. C'est cette couche qui
 * fait le travail, pas le générateur aléatoire. */
function randomKey16(): string {
  let out = '';
  for (let i = 0; i < 16; i++) out += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
  return out;
}

/**
 * Récupère (en la créant si besoin) une clé de chiffrement MMKV persistée dans
 * le Keychain/Keystore. Best-effort et SYNCHRONE (API sync JSI d'expo-secure-store,
 * dispo car `newArchEnabled` + plugin config déjà posés dans app.json) : toute
 * indisponibilité (Expo Go sans dev build, etc.) renvoie `undefined` → l'appelant
 * continue SANS chiffrement plutôt que de planter (même philosophie de repli
 * gracieux que createKVStorage ci-dessous).
 */
export function getOrCreateEncryptionKey(secureStoreKeyName: string): string | undefined {
  try {
    let key = SecureStore.getItem(secureStoreKeyName);
    if (!key) {
      key = randomKey16();
      SecureStore.setItem(secureStoreKeyName, key);
    }
    return key;
  } catch (err) {
    if (__DEV__) {
      console.warn(
        `[storage] SecureStore indisponible — chiffrement au repos désactivé pour « ${secureStoreKeyName} ».`,
        err,
      );
    }
    return undefined;
  }
}

/**
 * Returns an MMKV-backed store, or an in-memory fallback if MMKV can't load.
 *
 * `encryptionKeyName` (optionnel, sécu F3) : si fourni, l'instance est chiffrée
 * au repos via une clé Keychain/Keystore (voir getOrCreateEncryptionKey).
 * L'instance est TOUJOURS construite SANS `encryptionKey` d'abord — pour lire
 * un éventuel contenu déjà écrit EN CLAIR par une version antérieure — puis
 * `recrypt()` (synchrone) migre en place : jamais de perte de session
 * existante, jamais de déconnexion forcée lors de la mise à jour de l'app.
 * Scopé au SEUL store de session (`suimini-auth`) : les autres instances
 * (thème, i18n, tokens push, cache arbre) ne portent pas de secret équivalent.
 */
export function createKVStorage(id: string, encryptionKeyName?: string): KVStorage {
  try {
    // Required lazily so a missing native module degrades instead of crashing
    // the whole import graph.
    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = new MMKV({ id });
    // Touch the instance once: on Expo Go the throw happens on first access.
    mmkv.getString('__probe__');
    if (encryptionKeyName) {
      const key = getOrCreateEncryptionKey(encryptionKeyName);
      if (key) mmkv.recrypt(key);
    }
    return mmkv;
  } catch {
    if (__DEV__) {
      console.warn(
        `[storage] MMKV indisponible (Expo Go ?) — repli mémoire pour « ${id} ».`,
      );
    }
    return createMemoryStorage();
  }
}
