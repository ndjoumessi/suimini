'use client';
import { useEffect, useRef } from 'react';

const SELECTOR = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Reference-count scroll-lock so stacked overlays don't release the body early.
let lockCount = 0;

/**
 * Accessibility helper for modal overlays:
 * - traps Tab focus inside the container,
 * - closes on Escape,
 * - locks body scroll while open,
 * - restores focus to the previously-focused element on unmount.
 *
 * Attach the returned ref to the modal container (also give it tabIndex={-1}).
 */
export function useOverlay<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Scroll lock
    lockCount += 1;
    document.body.classList.add('modal-open');

    const focusable = (): HTMLElement[] =>
      node ? Array.from(node.querySelectorAll<HTMLElement>(SELECTOR)).filter(el => el.offsetParent !== null || el === document.activeElement) : [];

    // Move focus inside the overlay
    const first = focusable()[0];
    (first || node)?.focus?.();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
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
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.body.classList.remove('modal-open');
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return ref;
}
