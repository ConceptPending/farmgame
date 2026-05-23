/**
 * Inline-SVG icon set. One source of truth for the small monochrome glyphs the
 * UI uses (toolbar, HUD controls, start screen). Tintable via `color` so each
 * call site can drop in the right role color (cursor white, active teal,
 * money yellow, urgent red, neutral grey-cyan). All icons render in a 24×24
 * viewBox with a 1.5 stroke so they read as one family.
 *
 * Weather emoji deliberately stay where they are — their variety is part of
 * the weather's personality.
 */

export type IconName =
  | "pointer"
  | "buy-land"
  | "field"
  | "plow"
  | "plant"
  | "harvest"
  | "build"
  | "animal"
  | "spray"
  | "remove"
  | "play"
  | "pause"
  | "skip"
  | "bell"
  | "target"
  | "tractor"
  | "wheat"
  | "volume"
  | "volume-mute"
  | "settings"
  | "save"
  | "load";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** When true, fill the icon with `color` (for filled glyphs like play/pause). */
  filled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 16, color = "currentColor", filled, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={filled ? color : "none"}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

// JSX paths kept small + recognizable. Style: blocky geometric shapes that read
// like UI icons, not detailed illustration.
const PATHS: Record<IconName, React.ReactNode> = {
  pointer: (
    // Arrow cursor pointing top-left.
    <path d="M5 3l5 14 2.2-5.4L17 9 5 3z" fill={undefined} />
  ),
  "buy-land": (
    // Land plot with a price tag.
    <>
      <path d="M3 18l6-4 6 3 6-4" />
      <circle cx="17" cy="7" r="3" />
      <path d="M15.4 5.4l-2 2" />
    </>
  ),
  field: (
    // Rectangle with marching-ant tick marks → "designate field".
    <>
      <rect x="4" y="6" width="16" height="12" rx="1" />
      <path d="M4 12h16M9 6v12M14 6v12" />
    </>
  ),
  plow: (
    // Plow blades over furrowed ground.
    <>
      <path d="M3 18h18M3 15h18M3 12h18" strokeOpacity={0.55} />
      <path d="M8 8l3 3 3-3 3 3" />
    </>
  ),
  plant: (
    // Two leaves rising from soil.
    <>
      <path d="M12 21V11" />
      <path d="M12 14c-3 0-4-2-4-5 3 0 4 2 4 5z" />
      <path d="M12 11c3 0 4-2 4-5-3 0-4 2-4 5z" />
    </>
  ),
  harvest: (
    // A sickle.
    <>
      <path d="M5 19c8-1 12-5 14-13" />
      <path d="M11 6l8 0" />
    </>
  ),
  build: (
    // Hammer.
    <>
      <path d="M14 4l6 6-3 3-6-6 3-3z" />
      <path d="M11 7l-8 8 3 3 8-8" />
    </>
  ),
  animal: (
    // Tiny cow head with horns.
    <>
      <path d="M5 9l-1-3 3 1" />
      <path d="M19 9l1-3-3 1" />
      <rect x="5" y="9" width="14" height="9" rx="3" />
      <circle cx="9.5" cy="13.5" r="0.8" fill={undefined} />
      <circle cx="14.5" cy="13.5" r="0.8" fill={undefined} />
    </>
  ),
  spray: (
    // Spray bottle.
    <>
      <rect x="9" y="9" width="6" height="11" rx="1" />
      <path d="M11 9V6h2v3" />
      <path d="M15 7l4-1M15 9l4 0M15 11l4 1" />
    </>
  ),
  remove: (
    // Trash can.
    <>
      <path d="M5 7h14" />
      <path d="M9 7V4h6v3" />
      <path d="M7 7l1 13h8l1-13" />
    </>
  ),
  play: (
    <path d="M7 5l11 7-11 7V5z" />
  ),
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="0.5" />
      <rect x="14" y="5" width="4" height="14" rx="0.5" />
    </>
  ),
  skip: (
    <>
      <path d="M5 5l8 7-8 7V5z" />
      <path d="M14 5l8 7-8 7V5z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 17h12l-1.5-2V11a4.5 4.5 0 1 0-9 0v4z" />
      <path d="M10.5 20a1.5 1.5 0 0 0 3 0" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill={undefined} />
    </>
  ),
  tractor: (
    <>
      <rect x="3" y="9" width="9" height="6" rx="1" />
      <path d="M12 9l3-3h4v9" />
      <circle cx="7" cy="17" r="2.5" />
      <circle cx="17" cy="17" r="3" />
    </>
  ),
  wheat: (
    <>
      <path d="M12 21V8" />
      <path d="M12 8c-3-1-4-3-4-6 3 0 4 2 4 6z" />
      <path d="M12 12c-3-1-4-3-4-6" strokeOpacity={0.6} />
      <path d="M12 8c3-1 4-3 4-6-3 0-4 2-4 6z" />
      <path d="M12 12c3-1 4-3 4-6" strokeOpacity={0.6} />
    </>
  ),
  volume: (
    <>
      <path d="M5 9v6h3l5 4V5L8 9H5z" />
      <path d="M16 8c1.5 1 2 2.5 2 4s-.5 3-2 4" />
      <path d="M18 5c3 2 3 12 0 14" />
    </>
  ),
  "volume-mute": (
    <>
      <path d="M5 9v6h3l5 4V5L8 9H5z" />
      <path d="M16 9l5 5M21 9l-5 5" />
    </>
  ),
  settings: (
    // Gear: blocky 6-tooth wheel + inner ring.
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
  save: (
    // Floppy disk silhouette.
    <>
      <path d="M5 5h11l3 3v11H5V5z" />
      <path d="M8 5v4h8V5" />
      <rect x="8" y="13" width="8" height="6" />
    </>
  ),
  load: (
    // Folder with an upward arrow.
    <>
      <path d="M3 7h6l2 2h10v10H3V7z" />
      <path d="M12 17v-4M9 14l3-3 3 3" />
    </>
  ),
};
