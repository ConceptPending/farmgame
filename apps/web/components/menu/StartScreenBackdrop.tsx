"use client";

/**
 * Faint pixel-farm horizon shown behind the start-screen cards. Pure inline
 * SVG + CSS — no image assets. Low-contrast so the cards stay the eye's
 * target; the slow cloud drift is the only motion, deliberately slower than
 * the eye can lock onto.
 */
export function StartScreenBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes farmgame-cloud-drift-a { from { transform: translateX(-120px); } to { transform: translateX(110vw); } }
        @keyframes farmgame-cloud-drift-b { from { transform: translateX(-180px); } to { transform: translateX(115vw); } }
        @keyframes farmgame-cloud-drift-c { from { transform: translateX(-90px); } to { transform: translateX(108vw); } }
      `}</style>

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMax slice"
        style={{ position: "absolute", inset: 0 }}
      >
        {/* Distant tree silhouettes on the horizon */}
        <g opacity="0.32">
          {Array.from({ length: 14 }).map((_, i) => {
            const x = 60 + i * 70 + (i % 3) * 18;
            const y = 460 + (i % 2) * 8;
            return (
              <g key={i} fill="#244635">
                <rect x={x - 1} y={y + 6} width="2" height="10" />
                <ellipse cx={x} cy={y + 4} rx="6" ry="8" />
              </g>
            );
          })}
        </g>

        {/* Rolling hill — two overlapping humps */}
        <path
          d="M-20 540 Q 200 460 420 510 T 820 480 T 1020 520 L 1020 720 L -20 720 Z"
          fill="#2d5a3a"
          opacity="0.55"
        />
        <path
          d="M-20 590 Q 250 530 500 580 T 920 560 L 1020 600 L 1020 720 L -20 720 Z"
          fill="#1d4429"
          opacity="0.55"
        />

        {/* Faint planted-field rows on the foreground hill */}
        <g stroke="#4a7a64" strokeWidth="1.5" strokeOpacity="0.35">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1={-20} y1={620 + i * 10} x2={1020} y2={605 + i * 10} />
          ))}
        </g>

        {/* River band running across the middle of the hills */}
        <path d="M-20 560 Q 300 540 600 555 T 1020 545 L 1020 580 Q 720 600 420 580 T -20 595 Z" fill="#3a6b8a" opacity="0.45" />
        {/* Tiny river highlights */}
        <g fill="#7faecf" opacity="0.5">
          <rect x="220" y="563" width="20" height="1.5" rx="0.5" />
          <rect x="450" y="572" width="26" height="1.5" rx="0.5" />
          <rect x="700" y="568" width="18" height="1.5" rx="0.5" />
        </g>

        {/* Tiny barn silhouette on the hill */}
        <g transform="translate(700 488)" fill="#5a2a22" opacity="0.85">
          <rect x="0" y="6" width="24" height="14" />
          <polygon points="-2,6 12,-2 26,6" />
          <rect x="9" y="11" width="6" height="9" fill="#3a1a14" />
        </g>
        {/* A small silo next to it */}
        <g transform="translate(728 484)" fill="#7a6650" opacity="0.85">
          <rect x="0" y="4" width="7" height="20" />
          <ellipse cx="3.5" cy="4" rx="3.5" ry="2" fill="#8a7660" />
        </g>
      </svg>

      {/* Drifting clouds — each animates left to right at its own speed/depth. */}
      <Cloud topPercent={14} sizePx={70} animation="farmgame-cloud-drift-a 95s linear infinite" opacity={0.16} />
      <Cloud topPercent={9} sizePx={50} animation="farmgame-cloud-drift-b 130s linear infinite" delaySec={-30} opacity={0.13} />
      <Cloud topPercent={22} sizePx={90} animation="farmgame-cloud-drift-c 115s linear infinite" delaySec={-60} opacity={0.18} />
    </div>
  );
}

function Cloud({
  topPercent,
  sizePx,
  animation,
  delaySec = 0,
  opacity,
}: {
  topPercent: number;
  sizePx: number;
  animation: string;
  delaySec?: number;
  opacity: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${topPercent}%`,
        left: 0,
        width: sizePx,
        height: sizePx * 0.45,
        animation,
        animationDelay: `${delaySec}s`,
        opacity,
        pointerEvents: "none",
      }}
    >
      <svg viewBox="0 0 100 45" width="100%" height="100%">
        <ellipse cx="30" cy="28" rx="22" ry="14" fill="#ffffff" />
        <ellipse cx="55" cy="22" rx="26" ry="17" fill="#ffffff" />
        <ellipse cx="78" cy="30" rx="18" ry="12" fill="#ffffff" />
      </svg>
    </div>
  );
}
