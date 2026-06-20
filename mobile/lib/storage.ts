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

/** Returns an MMKV-backed store, or an in-memory fallback if MMKV can't load. */
export function createKVStorage(id: string): KVStorage {
  try {
    // Required lazily so a missing native module degrades instead of crashing
    // the whole import graph.
    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = new MMKV({ id });
    // Touch the instance once: on Expo Go the throw happens on first access.
    mmkv.getString('__probe__');
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
