/**
 * i18n (i18next + react-i18next). Langue initiale : choix persisté > langue du
 * téléphone (expo-localization) > français. FR/EN supportés.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { fr } from '@/locales/fr';
import { en } from '@/locales/en';
import { createKVStorage } from './storage';

export type Lang = 'fr' | 'en';
export const SUPPORTED: Lang[] = ['fr', 'en'];
export const FALLBACK: Lang = 'fr';

const store = createKVStorage('suimini-i18n');
const LANG_KEY = 'language';

export function getStoredLanguage(): Lang | null {
  const v = store.getString(LANG_KEY);
  return v === 'fr' || v === 'en' ? v : null;
}

function persistLanguage(lang: Lang) {
  store.set(LANG_KEY, lang);
}

/** Langue du téléphone, repliée sur FR si non supportée. */
function deviceLanguage(): Lang {
  try {
    const code = Localization.getLocales()[0]?.languageCode ?? FALLBACK;
    return code === 'en' ? 'en' : 'fr';
  } catch {
    return FALLBACK;
  }
}

const initialLanguage: Lang = getStoredLanguage() ?? deviceLanguage();

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: initialLanguage,
  fallbackLng: FALLBACK,
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false }, // RN n'a pas besoin d'échappement HTML
});

/** Change la langue ET persiste le choix. */
export function changeLanguage(lang: Lang): Promise<unknown> {
  persistLanguage(lang);
  return i18n.changeLanguage(lang);
}

/** Langue active courante ('fr' | 'en'). */
export function currentLanguage(): Lang {
  return (i18n.language as Lang) === 'en' ? 'en' : 'fr';
}

export default i18n;
