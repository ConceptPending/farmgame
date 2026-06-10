"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Without this, any render-time throw (corrupt
 * save state, engine bug) unmounts the whole tree to a blank page. The
 * autosave/manual saves in localStorage survive a crash, so a reload is a
 * real recovery path — say so.
 */
export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled game error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "#1a1a2e",
        color: "#e0e0e0",
        fontFamily: "monospace",
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ color: "#ff6b6b", margin: 0 }}>Something broke down on the farm</h1>
      <p style={{ maxWidth: 480, color: "#9db4d0", margin: 0 }}>
        The game hit an unexpected error. Your saves (including the seasonal
        autosave) are safe in this browser — reloading will take you back to
        the start screen where you can continue from one.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 20px",
            background: "#0f3460",
            color: "#e0e0e0",
            border: "1px solid #4ecca3",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 20px",
            background: "#222",
            color: "#9db4d0",
            border: "1px solid #444",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Reload the game
        </button>
      </div>
    </div>
  );
}
