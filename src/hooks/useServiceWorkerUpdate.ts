'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pure, unit-testable decision helper for the controlled PWA-update prompt.
 *
 * A prompt is warranted when:
 *  - a new service worker is already `waiting` (installed but held back because the
 *    install handler no longer calls `skipWaiting()` unconditionally), OR
 *  - a freshly-`installed` worker appears while a controller is already active
 *    (i.e. this is an UPDATE over an existing SW, not the very first install).
 *
 * The first install (no existing controller) must NOT prompt — there is no old
 * bundle to replace, the page already runs the latest code.
 */
export function shouldPromptUpdate({
  hasWaiting,
  newWorkerState,
  hasController,
}: {
  hasWaiting: boolean;
  newWorkerState?: string;
  hasController: boolean;
}): boolean {
  if (hasWaiting) return true;
  if (newWorkerState === 'installed' && hasController) return true;
  return false;
}

const POLL_MS = 60_000;

interface ServiceWorkerUpdate {
  updateAvailable: boolean;
  dismissed: boolean;
  applyUpdate: () => void;
  dismiss: () => void;
}

/**
 * Detects a waiting new version of the service worker and lets the UI apply it on
 * demand. State-only (no localStorage): a session dismissal simply hides the banner
 * until the next detected update.
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdate {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const reloadedRef = useRef(false);

  useEffect(() => {
    // SSR / unsupported-browser guards.
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    const flagUpdate = (waiting: ServiceWorker | null) => {
      if (cancelled) return;
      waitingRef.current = waiting;
      setUpdateAvailable(true);
      // Reset a prior dismissal so a genuinely new update re-appears.
      setDismissed(false);
    };

    // When the fresh SW takes control, reload once so the page runs the new bundle.
    const onControllerChange = () => {
      if (reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || cancelled) return;

      const hasController = !!navigator.serviceWorker.controller;

      // An update may already be waiting (installed before this hook mounted).
      if (
        reg.waiting &&
        shouldPromptUpdate({ hasWaiting: true, hasController })
      ) {
        flagUpdate(reg.waiting);
      }

      // A new worker starts installing after this point.
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (
            shouldPromptUpdate({
              hasWaiting: false,
              newWorkerState: newWorker.state,
              hasController: !!navigator.serviceWorker.controller,
            })
          ) {
            flagUpdate(reg.waiting ?? newWorker);
          }
        });
      });

      // Poll for updates so long-lived tabs pick up a new deploy.
      pollId = setInterval(() => {
        reg.update().catch(() => {});
      }, POLL_MS);
    });

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = waitingRef.current;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      // The 'controllerchange' listener reloads once the new SW takes control.
    } else {
      // No waiting worker tracked (edge case) — reload directly.
      if (!reloadedRef.current) {
        reloadedRef.current = true;
        window.location.reload();
      }
    }
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { updateAvailable, dismissed, applyUpdate, dismiss };
}
