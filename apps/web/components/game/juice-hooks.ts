"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Smoothly animates a numeric value to its current target over `durationMs`.
 * Returns the animated value to render. Skips animation on the first mount.
 */
export function useAnimatedNumber(target: number, durationMs = 400): number {
  const [displayed, setDisplayed] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const targetRef = useRef(target);

  useEffect(() => {
    if (targetRef.current === target) return;
    fromRef.current = displayed;
    targetRef.current = target;
    startRef.current = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - (startRef.current ?? now)) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const v = Math.round(fromRef.current + (targetRef.current - fromRef.current) * eased);
      setDisplayed(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // `displayed` is intentionally not in the dep list — it's snapshot into
    // fromRef when the target changes; reading it on every render would
    // re-fire this effect every animation frame and restart the tween.
  }, [target, durationMs]);

  return displayed;
}

/**
 * Returns `true` for `durationMs` after `value` changes (excluding the first
 * mount). Used to trigger short visual stings on state transitions.
 */
export function usePulseOnChange<T>(value: T, durationMs = 700): boolean {
  const previous = useRef(value);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), durationMs);
    return () => clearTimeout(t);
  }, [value, durationMs]);
  return pulsing;
}

/**
 * Like usePulseOnChange but reports the direction of change ("up" / "down" /
 * null), so colour can match (e.g. money green-flash on gain, red-flash on loss).
 */
export function useNumberPulse(value: number, durationMs = 700): "up" | "down" | null {
  const previous = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (previous.current === value) return;
    const next: "up" | "down" = value > previous.current ? "up" : "down";
    previous.current = value;
    setDir(next);
    const t = setTimeout(() => setDir(null), durationMs);
    return () => clearTimeout(t);
  }, [value, durationMs]);
  return dir;
}
