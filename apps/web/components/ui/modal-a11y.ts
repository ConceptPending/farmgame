"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Dialog focus management for the game's modals: when `active` becomes true,
 * moves focus into the dialog node, traps Tab/Shift+Tab inside it, and
 * restores focus to the previously-focused element when the dialog closes.
 *
 * `active` (not mount) drives the lifecycle because several panels stay
 * mounted and toggle between `null` and the dialog — attach the returned ref
 * to the dialog card alongside `role="dialog"`, `aria-modal`, and
 * `tabIndex={-1}`.
 */
export function useModalA11y<T extends HTMLElement>(active = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // The dialog itself takes focus first (tabIndex={-1}); screen readers
    // announce its label, and Tab moves to the first control from there.
    node.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || current === node) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKeyDown);

    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [active]);

  return ref;
}
