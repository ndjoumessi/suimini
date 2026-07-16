'use client';
import { useEffect, useRef } from 'react';

const SELECTOR = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Reference-count scroll-lock so stacked overlays don't release the body early.
let lockCount = 0;

// LIFO registry of currently-open overlays (by mount order). Escape/Tab must
// only ever be handled by the TOPMOST (most recently opened) overlay — before
// this, every overlay registered its OWN `document` keydown listener and
// merely called `stopPropagation()` on Escape, which does nothing for
// sibling listeners on the same node: two overlays open at once (e.g.
// PersonPanel's era popup over the panel itself) both closed on a single
// Escape press (AUDIT-V5 P1 #11). Each instance now checks "am I the top of
// this stack?" before acting — correct regardless of DOM listener order —
// and additionally calls `stopImmediatePropagation()` so it can't also
// trigger unrelated Escape handlers elsewhere in the app.
const overlayStack: symbol[] = [];

/**
 * Accessibility helper for modal overlays:
 * - traps Tab focus inside the container,
 * - closes on Escape,
 * - locks body scroll while open,
 * - restores focus to the previously-focused element on unmount.
 *
 * Attach the returned ref to the modal container (also give it tabIndex={-1}).
 */
export function useOverlay<T extends HTMLElement = HTMLDivElement>(onClose: () => void, opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;
  const ref = useRef<T>(null);

  useEffect(() => {
    // `enabled` permet aux surfaces semi-modales (ex. PersonPanel, modal plein
    // écran sur mobile seulement) d'activer le trap conditionnellement sans
    // violer les règles des hooks.
    if (!enabled) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const id = Symbol('overlay');
    overlayStack.push(id);
    const isTop = () => overlayStack[overlayStack.length - 1] === id;

    // Scroll lock
    lockCount += 1;
    document.body.classList.add('modal-open');

    // NB : `getClientRects().length` (et non `offsetParent`) — offsetParent est
    // toujours null pour un élément position:fixed, qui serait exclu du trap.
    const focusable = (): HTMLElement[] =>
      node ? Array.from(node.querySelectorAll<HTMLElement>(SELECTOR)).filter(el => el.getClientRects().length > 0 || el === document.activeElement) : [];

    // Move focus inside the overlay
    const first = focusable()[0];
    (first || node)?.focus?.();

    function onKeyDown(e: KeyboardEvent) {
      if (!isTop()) return; // a more recently opened overlay owns the keyboard
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !node) return;
      const items = focusable();
      if (items.length === 0) { e.preventDefault(); return; }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeInside = node.contains(document.activeElement);
      if (e.shiftKey) {
        if (document.activeElement === firstEl || !activeInside) { e.preventDefault(); lastEl.focus(); }
      } else {
        if (document.activeElement === lastEl || !activeInside) { e.preventDefault(); firstEl.focus(); }
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const i = overlayStack.indexOf(id);
      if (i !== -1) overlayStack.splice(i, 1);
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.body.classList.remove('modal-open');
      previouslyFocused?.focus?.();
    };
  }, [onClose, enabled]);

  return ref;
}
