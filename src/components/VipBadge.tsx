import { Lock } from "lucide-react";

type Props = {
  level: number;
  /** Primary color (hex). */
  color?: string;
  /** Accent color (hex). */
  accent?: string;
  /** Optional custom image (data URL or https URL). When set, replaces the procedural SVG. */
  badgeUrl?: string | null;
  /** Whether the user has unlocked this tier. Locked tiers render grayscale + lock icon. */
  locked?: boolean;
  /** True when this is the user's CURRENT tier — adds animated ring + sparkles. */
  current?: boolean;
  size?: number;
};

/**
 * Procedurally generated VIP badge. 4 base silhouettes × 5 color bands → 20 unique looks.
 * Each level (1..20) maps deterministically to (shape, palette).
 */
export function VipBadge({ level, color, accent, badgeUrl, locked = false, current = false, size = 96 }: Props) {
  const shape = ((level - 1) % 4) as 0 | 1 | 2 | 3; // shield, star, sun, diamond
  const primary = color || "#d4af37";
  const second = accent || "#ffd96b";
  const gradId = `vipgrad-${level}`;
  const glowId = `vipglow-${level}`;

  const Inner = () => {
    switch (shape) {
      case 0: // Shield
        return (
          <path
            d="M50 6 L88 18 L88 50 C88 72 70 88 50 94 C30 88 12 72 12 50 L12 18 Z"
            fill={`url(#${gradId})`}
            stroke={second}
            strokeWidth={2.5}
          />
        );
      case 1: // 5-point star
        return (
          <polygon
            points="50,6 61,38 95,38 67,58 78,92 50,72 22,92 33,58 5,38 39,38"
            fill={`url(#${gradId})`}
            stroke={second}
            strokeWidth={2.5}
          />
        );
      case 2: // Sun / sunburst
        return (
          <g>
            <circle cx="50" cy="50" r="38" fill={`url(#${gradId})`} stroke={second} strokeWidth={2.5} />
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i * Math.PI * 2) / 12;
              const x1 = 50 + Math.cos(a) * 40;
              const y1 = 50 + Math.sin(a) * 40;
              const x2 = 50 + Math.cos(a) * 48;
              const y2 = 50 + Math.sin(a) * 48;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={second} strokeWidth={3} strokeLinecap="round" />;
            })}
          </g>
        );
      case 3: // Diamond
        return (
          <polygon
            points="50,5 92,38 50,95 8,38"
            fill={`url(#${gradId})`}
            stroke={second}
            strokeWidth={2.5}
          />
        );
    }
  };

  return (
    <div className={`relative inline-block ${current ? "animate-[vippulse_2s_ease-in-out_infinite]" : ""}`} style={{ width: size, height: size }}>
      <style>{`
        @keyframes vippulse { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 8px ${primary}aa); } 50% { transform: scale(1.06); filter: drop-shadow(0 0 18px ${primary}); } }
        @keyframes vipspin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      `}</style>
      {current && (
        <div
          className="absolute inset-[-6px] rounded-full pointer-events-none"
          style={{
            background: `conic-gradient(from 0deg, ${primary}, ${second}, ${primary})`,
            mask: "radial-gradient(transparent 58%, black 60%)",
            WebkitMask: "radial-gradient(transparent 58%, black 60%)",
            animation: "vipspin 4s linear infinite",
          }}
        />
      )}
      {badgeUrl ? (
        <img
          src={badgeUrl}
          alt={`VIP level ${level}`}
          width={size}
          height={size}
          className={`object-contain ${locked ? "grayscale opacity-50" : ""}`}
          style={{ filter: locked ? "" : `drop-shadow(0 4px 14px ${primary}55)` }}
        />
      ) : (
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={locked ? "grayscale opacity-50" : ""}
        style={{ filter: locked ? "" : `drop-shadow(0 4px 14px ${primary}55)` }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={second} />
            <stop offset="55%" stopColor={primary} />
            <stop offset="100%" stopColor={primary} stopOpacity={0.7} />
          </linearGradient>
          <filter id={glowId}><feGaussianBlur stdDeviation="1.5" /></filter>
        </defs>
        <Inner />
        <text
          x="50"
          y="56"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight={900}
          fontSize="22"
          fill="#1a1a1a"
          stroke={second}
          strokeWidth={0.4}
        >
          LV{level}
        </text>
      </svg>
      {locked && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="rounded-full bg-black/70 p-1.5">
            <Lock className="size-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
