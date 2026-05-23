"use client";

/**
 * Lightweight tooltip + help-hint primitives. No external dependency.
 *
 * - `Tooltip`: wraps children; shows a bubble on hover/focus.
 * - `HelpHint`: a tiny "?" circle that does the same — drop it next to any
 *   stat label that needs explanation. Keep the text short; the help-text
 *   catalog (`apps/web/lib/help-text.ts`) is the single source of truth.
 *
 * Positioning uses fixed-viewport coordinates measured off the trigger's
 * bounding rect, so the bubble escapes scrollable parents (panel bodies)
 * without needing a portal. It picks above/below based on space.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

interface TooltipProps {
  text: string;
  children: ReactNode;
  /** Extra style for the trigger wrapper (defaults to inline-flex). */
  triggerStyle?: CSSProperties;
}

export function Tooltip({ text, children, triggerStyle }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tipId = useId();
  const [pos, setPos] = useState<{ top: number; left: number; placement: "above" | "below" }>({
    top: 0,
    left: 0,
    placement: "above",
  });

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tipW = 240; // matches maxWidth below
    const tipH = 64; // generous estimate
    const above = r.top - tipH - 6 > 4;
    const top = above ? r.top - 6 : r.bottom + 6;
    // Anchor by the trigger's center, clamp to viewport.
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - tipW - 6));
    setPos({ top, left, placement: above ? "above" : "below" });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-describedby={open ? tipId : undefined}
        style={{ display: "inline-flex", alignItems: "center", ...triggerStyle }}
      >
        {children}
      </span>
      {open && (
        <div
          role="tooltip"
          id={tipId}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: pos.placement === "above" ? "translateY(-100%)" : "none",
            maxWidth: 240,
            padding: "6px 9px",
            fontSize: 11,
            lineHeight: 1.4,
            color: "#e0e6ed",
            background: "rgba(10, 14, 25, 0.97)",
            border: "1px solid #2a3a5a",
            borderRadius: 4,
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.45)",
            pointerEvents: "none",
            zIndex: 500,
          }}
        >
          {text}
        </div>
      )}
    </>
  );
}

interface HelpHintProps {
  text: string;
  /** Optional aria-label override. Defaults to "Help: <first 40 chars>". */
  label?: string;
}

/**
 * The "ⓘ" circle used inline next to stat labels. Sized small (10px) and
 * coloured muted so it disappears until you look for it.
 */
export function HelpHint({ text, label }: HelpHintProps) {
  return (
    <Tooltip text={text}>
      <span
        role="img"
        aria-label={label ?? `Help: ${text.slice(0, 40)}${text.length > 40 ? "…" : ""}`}
        tabIndex={0}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 12,
          height: 12,
          marginLeft: 4,
          fontSize: 9,
          lineHeight: 1,
          fontWeight: 700,
          color: "#7a8a9a",
          background: "transparent",
          border: "1px solid #3a4a6a",
          borderRadius: "50%",
          cursor: "help",
          userSelect: "none",
          outline: "none",
        }}
      >
        ?
      </span>
    </Tooltip>
  );
}
