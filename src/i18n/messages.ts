import type { AbstractIntlMessages } from 'next-intl';
import fr from '../../messages/fr.json';
import en from '../../messages/en.json';
import type { Locale } from './config';

/**
 * Both locales bundled into the client so the language can switch INSTANTLY
 * (no navigation/reload). The cost is shipping both message sets in the JS
 * bundle — a deliberate trade for real-time switching.
 */
// Cast via unknown: the JSON contains arrays of objects (e.g. landing.testimonials,
// read with t.raw), which next-intl supports at runtime but AbstractIntlMessages
// (string | nested record) doesn't model in its type.
export const MESSAGES = { fr, en } as unknown as Record<Locale, AbstractIntlMessages>;
