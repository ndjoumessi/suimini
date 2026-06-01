'use client';
import { useEffect, useMemo } from 'react';
import { FamilyTree } from '@/types';
import { getUpcomingAnniversaries } from '@/lib/treeUtils';

const ASKED_KEY = 'suimini_notif_asked';
const SENT_KEY = 'suimini_notif_sent';

interface SentRecord { date: string; ids: string[]; }

function loadSent(): SentRecord {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(SENT_KEY);
    if (raw) {
      const rec = JSON.parse(raw) as SentRecord;
      if (rec.date === today) return rec;
    }
  } catch { /* ignore */ }
  return { date: today, ids: [] };
}

/**
 * Requests notification permission once, then on each load sends a Web Notification
 * for every living member whose birthday falls today or within the next 3 days.
 * Returns the number of such upcoming birthdays (for the animated sidebar badge).
 */
export function useBirthdayNotifications(tree: FamilyTree | null): number {
  const birthdays = useMemo(() => {
    if (!tree) return [];
    return getUpcomingAnniversaries(tree.persons, tree.relationships, 3)
      .filter(a => a.type === 'birthday' && a.daysUntil >= 0 && a.daysUntil <= 3);
  }, [tree]);

  useEffect(() => {
    if (typeof window === 'undefined' || birthdays.length === 0) return;
    if (!('Notification' in window)) return;

    const sendNotifications = () => {
      if (Notification.permission !== 'granted') return;
      const sent = loadSent();
      birthdays.forEach(a => {
        const id = `${a.person.id}-${a.daysUntil}`;
        if (sent.ids.includes(id)) return;
        const when = a.daysUntil === 0 ? "aujourd'hui" : a.daysUntil === 1 ? 'demain' : `dans ${a.daysUntil} jours`;
        const ageText = a.age != null ? ` fête ses ${a.age} ans ${when}` : ` a son anniversaire ${when}`;
        try {
          new Notification('🎂 Anniversaire à venir', {
            body: `${a.person.firstName} ${a.person.lastName}${ageText} !`,
            icon: a.person.profilePhoto,
            tag: id,
          });
        } catch { /* ignore */ }
        sent.ids.push(id);
      });
      localStorage.setItem(SENT_KEY, JSON.stringify(sent));
    };

    if (Notification.permission === 'granted') {
      sendNotifications();
    } else if (Notification.permission === 'default' && !localStorage.getItem(ASKED_KEY)) {
      localStorage.setItem(ASKED_KEY, '1');
      Notification.requestPermission().then(p => { if (p === 'granted') sendNotifications(); }).catch(() => {});
    }
  }, [birthdays]);

  return birthdays.length;
}
