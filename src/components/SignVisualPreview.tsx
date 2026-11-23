import React from 'react';
import { Play } from 'lucide-react';
import { LEVEL_META } from '../data/librasSigns';
import { getSignVisualSpec } from '../utils/signVisual';
import type { VlibrasCatalogItem } from '../utils/vlibrasCatalog';

interface SignVisualPreviewProps {
  item: VlibrasCatalogItem;
  isPracticed?: boolean;
}

/**
 * Renders a crisp minimalist hand-configuration and trajectory schematic
 * for each sign card in the visual gallery.
 */
export const SignVisualPreview: React.FC<SignVisualPreviewProps> = ({
  item,
  isPracticed = false,
}) => {
  const spec = getSignVisualSpec(item);
  const [thumb, index, middle, ring, pinky] = spec.fingers;
  const spreadPx = 5 + spec.spread * 7;

  // Finger tip heights mapped cleanly from curl (0 = extended, 1 = curled into palm)
  const fingerLengths = [
    { x: -16 - spec.spread * 4, len: 18 * (1 - thumb * 0.72), angle: -34 - spec.spread * 12 },
    { x: -1.5 * spreadPx, len: 30 * (1 - index * 0.72), angle: -6 * spec.spread },
    { x: -0.5 * spreadPx, len: 33 * (1 - middle * 0.72), angle: -1.5 * spec.spread },
    { x: 0.5 * spreadPx, len: 30 * (1 - ring * 0.72), angle: 2.5 * spec.spread },
    { x: 1.5 * spreadPx, len: 24 * (1 - pinky * 0.72), angle: 7 * spec.spread },
  ];

  const renderHand = (cx: number, cy: number, scale: number, opacity: number) => (
    <g
      transform={`translate(${cx}, ${cy}) rotate(${spec.wristAngle}) scale(${scale})`}
      opacity={opacity}
    >
      {/* Subtle palm contour */}
      <rect
        x="-14"
        y="-8"
        width="28"
        height="26"
        rx="9"
        fill="#FFFFFF"
        stroke={spec.accentHex}
        strokeWidth="1.75"
      />
      {/* Fingers */}
      {fingerLengths.map((f, i) => {
        const baseY = i === 0 ? 4 : -7;
        const rad = (f.angle * Math.PI) / 180;
        const x2 = f.x + Math.sin(rad) * f.len;
        const y2 = baseY - Math.cos(rad) * f.len;
        return (
          <g key={i}>
            <line
              x1={f.x}
              y1={baseY}
              x2={x2}
              y2={y2}
              stroke={spec.accentHex}
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <line
              x1={f.x}
              y1={baseY}
              x2={x2}
              y2={y2}
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.65"
            />
          </g>
        );
      })}
    </g>
  );

  const renderMotionPath = () => {
    switch (spec.motionType) {
      case 'wave-lateral':
      case 'shake-side':
        return (
          <path
            d="M 48 34 Q 80 22 112 34 M 106 30 L 113 34 L 107 39 M 54 30 L 47 34 L 53 39"
            fill="none"
            stroke={spec.accentHex}
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.7"
          />
        );
      case 'circle':
      case 'heart-circle':
        return (
          <path
            d="M 104 48 A 24 20 0 1 1 60 44 M 56 49 L 60 43 L 66 47"
            fill="none"
            stroke={spec.accentHex}
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.7"
          />
        );
      case 'forward-arc':
      case 'chin-forward':
      case 'point-other':
        return (
          <path
            d="M 52 72 Q 82 30 116 40 M 110 35 L 117 40 L 111 45"
            fill="none"
            stroke={spec.accentHex}
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.7"
          />
        );
      case 'up-down':
      case 'nod-wrist':
        return (
          <path
            d="M 118 34 L 118 74 M 114 39 L 118 33 L 122 39 M 114 69 L 118 75 L 122 69"
            fill="none"
            stroke={spec.accentHex}
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.7"
          />
        );
      case 'tap-double':
      case 'point-self':
        return (
          <g stroke={spec.accentHex} fill="none" opacity="0.55">
            <circle cx="80" cy="56" r="24" strokeWidth="1.25" strokeDasharray="3 3" />
            <circle cx="80" cy="56" r="32" strokeWidth="1" strokeDasharray="2 4" />
          </g>
        );
      default:
        return (
          <circle
            cx="80"
            cy="56"
            r="28"
            fill="none"
            stroke={spec.accentHex}
            strokeWidth="1.1"
            strokeDasharray="2 4"
            opacity="0.4"
          />
        );
    }
  };

  return (
    <div
      className={`relative aspect-[16/10] w-full overflow-hidden border-b border-slate-100 ${spec.surfaceClass}`}
    >
      {/* Subtle blueprint dot pattern */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-35"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={`dots-${item.level}`}
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill="#94A3B8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#dots-${item.level})`} />
      </svg>

      {/* Top row metadata (zero-pill unboxed text) */}
      <div className="relative z-10 flex items-center justify-between px-3.5 pt-2.5 text-[11px] font-medium">
        <span className={spec.accentTextClass}>{LEVEL_META[item.level].label}</span>
        <span className="font-mono text-slate-500 truncate max-w-[115px]">
          {isPracticed ? 'Praticado' : spec.motionLabel}
        </span>
      </div>

      {/* Center geometric hand & motion diagram */}
      <div className="relative z-10 flex h-[calc(100%-28px)] items-center justify-center pb-2">
        <svg
          aria-hidden="true"
          viewBox="0 0 160 100"
          className="h-24 w-40 transition-transform duration-200 group-hover:scale-105"
        >
          {renderMotionPath()}
          {spec.twoHands && renderHand(62, 60, 0.84, 0.45)}
          {renderHand(spec.twoHands ? 92 : 80, 58, 0.95, 1)}
        </svg>

        {/* Video play affordance */}
        <span
          aria-hidden="true"
          className="absolute bottom-2.5 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-blue-700 shadow-xs ring-1 ring-slate-200/80 transition-transform duration-200 group-hover:scale-110 group-hover:bg-blue-700 group-hover:text-white group-hover:ring-blue-700"
        >
          <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
        </span>
      </div>
    </div>
  );
};
