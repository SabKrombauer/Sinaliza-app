export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface FingerState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export interface HandAnalysis {
  fingers: FingerState;
  thumbIndexDistance: number;
  indexMiddleSpread: number;
  palmOrientation: 'upright' | 'sideways' | 'downward';
  motionSpeed: number;
  horizontalOscillation: number;
}

export interface ClassificationResult {
  signId: string;
  label: string;
  gloss: string;
  confidence: number;
  handshapeHint: string;
}

export interface CaptionWord {
  id: string;
  text: string;
  timestamp: number;
}

const FINGER_INDICES = {
  thumb: { mcp: 2, pip: 3, tip: 4 },
  index: { mcp: 5, pip: 6, tip: 8 },
  middle: { mcp: 9, pip: 10, tip: 12 },
  ring: { mcp: 13, pip: 14, tip: 16 },
  pinky: { mcp: 17, pip: 18, tip: 20 },
};

function dist2D(a: LandmarkPoint, b: LandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Computes scale-invariant finger extension states from 21 MediaPipe hand landmarks.
 */
export function analyzeHandLandmarks(
  landmarks: LandmarkPoint[],
  wristHistory: LandmarkPoint[] = []
): HandAnalysis | null {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const palmScale = Math.max(dist2D(wrist, middleMcp), 0.04);

  const isExtended = (mcpIdx: number, pipIdx: number, tipIdx: number) => {
    const tipDist = dist2D(wrist, landmarks[tipIdx]);
    const pipDist = dist2D(wrist, landmarks[pipIdx]);
    const mcpDist = dist2D(wrist, landmarks[mcpIdx]);
    return tipDist > pipDist * 1.08 && tipDist > mcpDist * 1.25;
  };

  // Thumb extension compares distance to pinky MCP (17) and index MCP (5)
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  const pinkyMcp = landmarks[17];
  const thumbOutDist = dist2D(thumbTip, pinkyMcp) / palmScale;
  const thumbBaseDist = dist2D(thumbMcp, pinkyMcp) / palmScale;
  const thumbExtended = thumbOutDist > thumbBaseDist * 1.22 && dist2D(thumbTip, landmarks[5]) / palmScale > 0.42;

  const indexExtended = isExtended(
    FINGER_INDICES.index.mcp,
    FINGER_INDICES.index.pip,
    FINGER_INDICES.index.tip
  );
  const middleExtended = isExtended(
    FINGER_INDICES.middle.mcp,
    FINGER_INDICES.middle.pip,
    FINGER_INDICES.middle.tip
  );
  const ringExtended = isExtended(
    FINGER_INDICES.ring.mcp,
    FINGER_INDICES.ring.pip,
    FINGER_INDICES.ring.tip
  );
  const pinkyExtended = isExtended(
    FINGER_INDICES.pinky.mcp,
    FINGER_INDICES.pinky.pip,
    FINGER_INDICES.pinky.tip
  );

  const thumbIndexDistance = dist2D(landmarks[4], landmarks[8]) / palmScale;
  const indexMiddleSpread = dist2D(landmarks[8], landmarks[12]) / palmScale;

  const dy = middleMcp.y - wrist.y;
  const dx = Math.abs(middleMcp.x - wrist.x);
  let palmOrientation: HandAnalysis['palmOrientation'] = 'upright';
  if (dy > 0.04) palmOrientation = 'downward';
  else if (dx > Math.abs(dy) * 1.15) palmOrientation = 'sideways';

  let motionSpeed = 0;
  let horizontalOscillation = 0;
  if (wristHistory.length >= 4) {
    let totalMove = 0;
    let minX = wristHistory[0].x;
    let maxX = wristHistory[0].x;
    for (let i = 1; i < wristHistory.length; i++) {
      totalMove += dist2D(wristHistory[i - 1], wristHistory[i]);
      minX = Math.min(minX, wristHistory[i].x);
      maxX = Math.max(maxX, wristHistory[i].x);
    }
    motionSpeed = totalMove / (wristHistory.length - 1) / palmScale;
    horizontalOscillation = (maxX - minX) / palmScale;
  }

  return {
    fingers: {
      thumb: thumbExtended,
      index: indexExtended,
      middle: middleExtended,
      ring: ringExtended,
      pinky: pinkyExtended,
    },
    thumbIndexDistance,
    indexMiddleSpread,
    palmOrientation,
    motionSpeed,
    horizontalOscillation,
  };
}

/**
 * Classifies 21-point hand landmarks into Libras signs & manual alphabet letters.
 */
export function classifyHandLandmarks(
  landmarks: LandmarkPoint[],
  wristHistory: LandmarkPoint[] = []
): ClassificationResult | null {
  const analysis = analyzeHandLandmarks(landmarks, wristHistory);
  if (!analysis) return null;

  const { thumb, index, middle, ring, pinky } = analysis.fingers;
  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length;

  // 1. All 5 fingers extended
  if (thumb && index && middle && ring && pinky) {
    if (analysis.horizontalOscillation > 0.22 || analysis.motionSpeed > 0.05) {
      return {
        signId: 'ola',
        label: 'Olá',
        gloss: 'OLÁ',
        confidence: 0.94,
        handshapeHint: 'Mão aberta (5) em movimento lateral',
      };
    }
    return {
      signId: 'num-5',
      label: 'Cinco / Obrigado',
      gloss: 'OBRIGADO',
      confidence: 0.87,
      handshapeHint: 'Mão aberta com cinco dedos estendidos',
    };
  }

  // 2. Four fingers extended, thumb tucked -> Letra B / Obrigado
  if (!thumb && index && middle && ring && pinky) {
    if (landmarks[9].y < 0.38) {
      return {
        signId: 'obrigado',
        label: 'Obrigado(a)',
        gloss: 'OBRIGADO',
        confidence: 0.91,
        handshapeHint: 'Mão plana (B) na altura da testa',
      };
    }
    return {
      signId: 'alpha-b',
      label: 'Letra B',
      gloss: 'B',
      confidence: 0.92,
      handshapeHint: 'Quatro dedos estendidos unidos, polegar dobrado',
    };
  }

  // 3. Thumb + Index + Pinky -> Amor (ILY)
  if (thumb && index && !middle && !ring && pinky) {
    return {
      signId: 'amor',
      label: 'Eu te amo',
      gloss: 'AMOR',
      confidence: 0.95,
      handshapeHint: 'Polegar, indicador e mínimo estendidos (ILY)',
    };
  }

  // 4. Thumb + Index -> Letra L / Água
  if (thumb && index && !middle && !ring && !pinky) {
    if (landmarks[4].y < 0.46 && landmarks[4].x > 0.35 && landmarks[4].x < 0.65) {
      return {
        signId: 'agua',
        label: 'Água',
        gloss: 'ÁGUA',
        confidence: 0.89,
        handshapeHint: 'Configuração em L próxima ao queixo',
      };
    }
    return {
      signId: 'alpha-l',
      label: 'Letra L',
      gloss: 'L',
      confidence: 0.93,
      handshapeHint: 'Polegar e indicador em ângulo reto (90°)',
    };
  }

  // 5. Thumb + Pinky -> Letra Y
  if (thumb && !index && !middle && !ring && pinky) {
    return {
      signId: 'alpha-y',
      label: 'Letra Y',
      gloss: 'Y',
      confidence: 0.92,
      handshapeHint: 'Polegar e dedo mínimo estendidos',
    };
  }

  // 6. Only Thumb extended -> Tudo bem
  if (thumb && !index && !middle && !ring && !pinky) {
    return {
      signId: 'tudo-bem',
      label: 'Tudo bem',
      gloss: 'TUDO-BEM',
      confidence: 0.9,
      handshapeHint: 'Polegar estendido (positivo)',
    };
  }

  // 7. Only Index extended -> Não / Eu / Você / 1
  if (!thumb && index && !middle && !ring && !pinky) {
    if (analysis.horizontalOscillation > 0.16) {
      return {
        signId: 'nao',
        label: 'Não',
        gloss: 'NÃO',
        confidence: 0.91,
        handshapeHint: 'Indicador em balanço lateral de negação',
      };
    }
    if (landmarks[8].y > 0.6) {
      return {
        signId: 'eu',
        label: 'Eu',
        gloss: 'EU',
        confidence: 0.86,
        handshapeHint: 'Indicador apontando na região do peito',
      };
    }
    return {
      signId: 'alpha-d',
      label: 'Um / Letra D',
      gloss: 'UM',
      confidence: 0.88,
      handshapeHint: 'Indicador estendido verticalmente',
    };
  }

  // 8. Index + Middle -> U or V
  if (!thumb && index && middle && !ring && !pinky) {
    if (analysis.indexMiddleSpread > 0.32) {
      return {
        signId: 'alpha-v',
        label: 'Letra V / Dois',
        gloss: 'V',
        confidence: 0.91,
        handshapeHint: 'Indicador e médio estendidos e separados',
      };
    }
    return {
      signId: 'alpha-u',
      label: 'Letra U',
      gloss: 'U',
      confidence: 0.9,
      handshapeHint: 'Indicador e médio estendidos e unidos',
    };
  }

  // 9. Index + Middle + Ring -> W / 3
  if (!thumb && index && middle && ring && !pinky) {
    return {
      signId: 'alpha-w',
      label: 'Letra W / Três',
      gloss: 'W',
      confidence: 0.9,
      handshapeHint: 'Indicador, médio e anelar estendidos',
    };
  }

  // 10. Middle + Ring + Pinky -> F
  if (!index && middle && ring && pinky) {
    return {
      signId: 'alpha-f',
      label: 'Letra F',
      gloss: 'F',
      confidence: 0.88,
      handshapeHint: 'Médio, anelar e mínimo estendidos; indicador junto ao polegar',
    };
  }

  // 11. Only Pinky -> Letra I
  if (!thumb && !index && !middle && !ring && pinky) {
    return {
      signId: 'alpha-i',
      label: 'Letra I',
      gloss: 'I',
      confidence: 0.92,
      handshapeHint: 'Apenas o dedo mínimo estendido',
    };
  }

  // 12. Closed fist -> S / A / Sim / O
  if (extendedCount === 0) {
    if (analysis.thumbIndexDistance < 0.28) {
      return {
        signId: 'alpha-o',
        label: 'Letra O',
        gloss: 'O',
        confidence: 0.84,
        handshapeHint: 'Pontas dos dedos unidas formando círculo',
      };
    }
    if (analysis.motionSpeed > 0.04) {
      return {
        signId: 'sim',
        label: 'Sim',
        gloss: 'SIM',
        confidence: 0.89,
        handshapeHint: 'Punho em S com movimento afirmativo',
      };
    }
    return {
      signId: 'alpha-s',
      label: 'Letra S / A',
      gloss: 'S',
      confidence: 0.85,
      handshapeHint: 'Punho fechado (configuração S/A)',
    };
  }

  return null;
}

/**
 * Multi-frame consensus buffer to avoid flickering detections.
 */
export class SignStabilizer {
  private windowSize: number;
  private buffer: ClassificationResult[] = [];
  private lastEmittedId: string | null = null;
  private lastEmittedAt = 0;
  private cooldownMs: number;

  constructor(windowSize = 5, cooldownMs = 1500) {
    this.windowSize = windowSize;
    this.cooldownMs = cooldownMs;
  }

  push(candidate: ClassificationResult | null, now = Date.now()): ClassificationResult | null {
    if (!candidate) {
      if (this.buffer.length > 0) this.buffer.shift();
      return null;
    }

    this.buffer.push(candidate);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    const counts = new Map<string, number>();
    for (const item of this.buffer) {
      counts.set(item.signId, (counts.get(item.signId) || 0) + 1);
    }

    const threshold = Math.ceil(this.windowSize * 0.6);
    if ((counts.get(candidate.signId) || 0) >= threshold) {
      const sameRecent =
        this.lastEmittedId === candidate.signId && now - this.lastEmittedAt < this.cooldownMs;
      if (!sameRecent) {
        this.lastEmittedId = candidate.signId;
        this.lastEmittedAt = now;
        return candidate;
      }
    }
    return null;
  }

  reset() {
    this.buffer = [];
    this.lastEmittedId = null;
    this.lastEmittedAt = 0;
  }
}

/**
 * Maintains readable caption tokens on screen with configurable retention duration.
 */
export function appendCaptionToken(
  current: CaptionWord[],
  newText: string,
  now = Date.now(),
  maxTokens = 16
): CaptionWord[] {
  const trimmed = newText.trim();
  if (!trimmed) return current;
  const last = current[current.length - 1];
  if (last && last.text.toLowerCase() === trimmed.toLowerCase()) {
    // Refresh timestamp while continuing to hold the same sign without duplicating text
    const refreshed = [...current];
    refreshed[refreshed.length - 1] = { ...last, timestamp: now };
    return refreshed;
  }
  const updated = [...current, { id: `${now}-${Math.random().toString(36).slice(2, 6)}`, text: trimmed, timestamp: now }];
  if (updated.length > maxTokens) {
    return updated.slice(updated.length - maxTokens);
  }
  return updated;
}

export function pruneExpiredCaptions(
  current: CaptionWord[],
  retentionMs: number,
  keepHistory: boolean,
  now = Date.now()
): CaptionWord[] {
  if (keepHistory) return current;
  return current.filter((item) => now - item.timestamp <= retentionMs);
}

/**
 * Generates canonical 21-point hand landmarks for simulation/demo mode & testing.
 */
export function generateCanonicalLandmarks(
  preset: 'ola' | 'tudo-bem' | 'amor' | 'obrigado' | 'nao' | 'sim' | 'L' | 'V',
  phase = 0
): { landmarks: LandmarkPoint[]; history: LandmarkPoint[] } {
  const waveX = preset === 'ola' || preset === 'nao' ? Math.sin(phase * Math.PI * 2) * 0.08 : 0;
  const nodY = preset === 'sim' ? Math.sin(phase * Math.PI * 2) * 0.04 : 0;
  const baseY = preset === 'obrigado' ? 0.28 : 0.5;
  const cx = 0.5 + waveX;
  const cy = baseY + nodY;

  // Helper to generate finger chain from MCP -> PIP -> DIP -> TIP
  const makeFinger = (
    mcpX: number,
    mcpY: number,
    extended: boolean,
    angleRad = 0,
    length = 0.22
  ): [LandmarkPoint, LandmarkPoint, LandmarkPoint, LandmarkPoint] => {
    if (extended) {
      const dx = Math.sin(angleRad);
      const dy = -Math.cos(angleRad);
      return [
        { x: mcpX, y: mcpY, z: 0 },
        { x: mcpX + dx * length * 0.42, y: mcpY + dy * length * 0.42, z: 0 },
        { x: mcpX + dx * length * 0.72, y: mcpY + dy * length * 0.72, z: 0 },
        { x: mcpX + dx * length, y: mcpY + dy * length, z: 0 },
      ];
    }
    // Curled finger folds back toward palm center
    return [
      { x: mcpX, y: mcpY, z: 0 },
      { x: mcpX, y: mcpY - 0.03, z: -0.02 },
      { x: mcpX, y: mcpY + 0.03, z: -0.03 },
      { x: mcpX, y: mcpY + 0.06, z: -0.02 },
    ];
  };

  const configMap: Record<
    typeof preset,
    { thumb: boolean; index: boolean; middle: boolean; ring: boolean; pinky: boolean; spread: number }
  > = {
    ola: { thumb: true, index: true, middle: true, ring: true, pinky: true, spread: 0.22 },
    'tudo-bem': { thumb: true, index: false, middle: false, ring: false, pinky: false, spread: 0.1 },
    amor: { thumb: true, index: true, middle: false, ring: false, pinky: true, spread: 0.25 },
    obrigado: { thumb: false, index: true, middle: true, ring: true, pinky: true, spread: 0.06 },
    nao: { thumb: false, index: true, middle: false, ring: false, pinky: false, spread: 0.08 },
    sim: { thumb: false, index: false, middle: false, ring: false, pinky: false, spread: 0.05 },
    L: { thumb: true, index: true, middle: false, ring: false, pinky: false, spread: 0.12 },
    V: { thumb: false, index: true, middle: true, ring: false, pinky: false, spread: 0.26 },
  };

  const cfg = configMap[preset];
  const wrist: LandmarkPoint = { x: cx, y: cy + 0.14, z: 0 };

  // Thumb (1..4)
  const thumbChain: [LandmarkPoint, LandmarkPoint, LandmarkPoint, LandmarkPoint] = cfg.thumb
    ? [
        { x: cx - 0.05, y: cy + 0.09, z: 0 },
        { x: cx - 0.09, y: cy + 0.04, z: 0 },
        { x: cx - 0.13, y: cy - 0.01, z: 0 },
        { x: cx - 0.17, y: cy - 0.06, z: 0 },
      ]
    : [
        { x: cx - 0.04, y: cy + 0.09, z: 0 },
        { x: cx - 0.03, y: cy + 0.04, z: -0.01 },
        { x: cx + 0.01, y: cy + 0.02, z: -0.02 },
        { x: cx + 0.04, y: cy + 0.03, z: -0.02 },
      ];

  const indexChain = makeFinger(cx - 0.055, cy - 0.02, cfg.index, -cfg.spread * 0.7, 0.21);
  const middleChain = makeFinger(cx - 0.018, cy - 0.03, cfg.middle, 0, 0.23);
  const ringChain = makeFinger(cx + 0.022, cy - 0.025, cfg.ring, cfg.spread * 0.45, 0.21);
  const pinkyChain = makeFinger(cx + 0.06, cy - 0.01, cfg.pinky, cfg.spread * 0.9, 0.17);

  const landmarks: LandmarkPoint[] = [
    wrist,
    ...thumbChain,
    ...indexChain,
    ...middleChain,
    ...ringChain,
    ...pinkyChain,
  ];

  const history: LandmarkPoint[] = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const wx = preset === 'ola' || preset === 'nao' ? Math.sin((phase + t) * Math.PI * 2) * 0.08 : 0;
    const wy = preset === 'sim' ? Math.sin((phase + t) * Math.PI * 2) * 0.04 : 0;
    return { x: 0.5 + wx, y: baseY + 0.14 + wy, z: 0 };
  });

  return { landmarks, history };
}
