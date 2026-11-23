import type { HandPoseKey, LibrasSign, StudyLevelId } from '../data/librasSigns';
import type { VlibrasCatalogItem, VlibrasGlossKind } from './vlibrasCatalog';

export interface SignVisualSpec {
  accentHex: string;
  surfaceClass: string;
  accentTextClass: string;
  badgeText: string;
  motionLabel: string;
  motionType: HandPoseKey['motion'];
  twoHands: boolean;
  fingers: [number, number, number, number, number];
  spread: number;
  wristAngle: number;
  monogram: string;
}

const LEVEL_STYLES: Record<
  StudyLevelId,
  { accentHex: string; surfaceClass: string; accentTextClass: string }
> = {
  iniciante: {
    accentHex: '#1D4ED8',
    surfaceClass: 'bg-blue-50/70',
    accentTextClass: 'text-blue-700',
  },
  intermediario: {
    accentHex: '#0F766E',
    surfaceClass: 'bg-teal-50/70',
    accentTextClass: 'text-teal-800',
  },
  avancado: {
    accentHex: '#B45309',
    surfaceClass: 'bg-amber-50/70',
    accentTextClass: 'text-amber-800',
  },
};

const MOTION_LABELS: Record<HandPoseKey['motion'], string> = {
  static: 'Postura estática',
  'wave-lateral': 'Movimento lateral',
  'forward-arc': 'Arco frontal',
  'chin-forward': 'Do rosto para frente',
  'tap-double': 'Toque duplo',
  circle: 'Trajetória circular',
  'nod-wrist': 'Flexão de punho',
  'shake-side': 'Oscilação negativa',
  'point-self': 'Direção ao corpo',
  'point-other': 'Direção frontal',
  'heart-circle': 'Movimento circular no peito',
  'up-down': 'Alternância vertical',
};

const KIND_MOTION_FALLBACK: Record<VlibrasGlossKind, HandPoseKey['motion']> = {
  simple: 'forward-arc',
  compound: 'wave-lateral',
  contextual: 'circle',
  inflected: 'point-other',
};

function hashText(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildFallbackFingers(gloss: string): [number, number, number, number, number] {
  const h = hashText(gloss);
  const presets: Array<[number, number, number, number, number]> = [
    [0.1, 0.0, 0.0, 0.0, 0.0], // open 5
    [0.7, 0.0, 0.9, 0.9, 0.9], // 1 / pointing
    [0.7, 0.0, 0.0, 0.9, 0.9], // V / U
    [0.05, 0.0, 0.9, 0.9, 0.9], // L
    [0.05, 0.9, 0.9, 0.9, 0.0], // Y
    [0.15, 0.85, 0.85, 0.85, 0.85], // A / S
    [0.45, 0.6, 0.0, 0.0, 0.0], // F
  ];
  return presets[h % presets.length];
}

export function getSignVisualSpec(
  item: VlibrasCatalogItem,
  curatedSign?: LibrasSign
): SignVisualSpec {
  const style = LEVEL_STYLES[item.level];
  const sign = curatedSign || item.curatedSign;

  if (sign) {
    return {
      accentHex: style.accentHex,
      surfaceClass: style.surfaceClass,
      accentTextClass: style.accentTextClass,
      badgeText: sign.isAlphabet ? sign.word : item.gloss,
      motionLabel: MOTION_LABELS[sign.pose.motion],
      motionType: sign.pose.motion,
      twoHands: Boolean(sign.pose.twoHands),
      fingers: sign.pose.fingers,
      spread: sign.pose.spread,
      wristAngle: sign.pose.wristAngle,
      monogram: sign.word.slice(0, 2).toUpperCase(),
    };
  }

  const motionType = KIND_MOTION_FALLBACK[item.kind];
  return {
    accentHex: style.accentHex,
    surfaceClass: style.surfaceClass,
    accentTextClass: style.accentTextClass,
    badgeText: item.gloss,
    motionLabel: MOTION_LABELS[motionType],
    motionType,
    twoHands: item.kind === 'compound' || item.kind === 'inflected',
    fingers: buildFallbackFingers(item.gloss),
    spread: item.kind === 'simple' ? 0.35 : 0.5,
    wristAngle: ((hashText(item.gloss) % 3) - 1) * 10,
    monogram: item.word.slice(0, 2).toUpperCase(),
  };
}
