import { LIBRAS_SIGNS, type LibrasSign } from '../data/librasSigns';

export interface GlossToken {
  id: string;
  gloss: string;
  originalWord: string;
  sign: LibrasSign;
  isFingerspelled: boolean;
  letter?: string;
}

export interface TranslationResult {
  sourceText: string;
  glossSentence: string;
  tokens: GlossToken[];
  sourceEngine: 'vlibras-api' | 'motor-glosa-local';
  notes: string[];
}

const STOP_WORDS = new Set([
  'o',
  'a',
  'os',
  'as',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'para',
  'pra',
  'por',
  'pelo',
  'pela',
  'com',
  'e',
  'que',
  'é',
  'eh',
  'são',
  'está',
  'estao',
  'estão',
  'estou',
  'ser',
  'ao',
  'aos',
  'à',
  'às',
]);

const MULTIWORD_EXPRESSIONS: Array<{ pattern: RegExp; gloss: string; signId: string }> = [
  { pattern: /\btudo\s+bem\b/gi, gloss: 'TUDO-BEM', signId: 'tudo-bem' },
  { pattern: /\bcomo\s+vai\b/gi, gloss: 'TUDO-BEM', signId: 'tudo-bem' },
  { pattern: /\bbom\s+dia\b/gi, gloss: 'BOM-DIA', signId: 'bom-dia' },
  { pattern: /\bboa\s+tarde\b/gi, gloss: 'BOA-TARDE', signId: 'boa-tarde' },
  { pattern: /\bboa\s+noite\b/gi, gloss: 'BOA-NOITE', signId: 'boa-noite' },
  { pattern: /\bpor\s+favor\b/gi, gloss: 'POR-FAVOR', signId: 'por-favor' },
  { pattern: /\bo\s+que\b/gi, gloss: 'O-QUÊ', signId: 'o-que' },
  { pattern: /\bo\s+quê\b/gi, gloss: 'O-QUÊ', signId: 'o-que' },
  { pattern: /\beu\s+te\s+amo\b/gi, gloss: 'AMOR', signId: 'amor' },
  { pattern: /\bate\s+logo\b/gi, gloss: 'TCHAU', signId: 'tchau' },
  { pattern: /\baté\s+logo\b/gi, gloss: 'TCHAU', signId: 'tchau' },
];

const TEMPORAL_MARKERS = new Set(['hoje', 'amanha', 'amanhã', 'ontem', 'agora', 'depois', 'sempre']);

export function normalizePortuguese(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function findSignByWord(rawToken: string): LibrasSign | undefined {
  const norm = normalizePortuguese(rawToken);
  return LIBRAS_SIGNS.find((sign) => {
    if (normalizePortuguese(sign.gloss) === norm) return true;
    if (normalizePortuguese(sign.word) === norm) return true;
    if (sign.aliases?.some((a) => normalizePortuguese(a) === norm)) return true;
    return false;
  });
}

function buildFingerspelledSign(letter: string): LibrasSign {
  const upper = letter.toUpperCase();
  const existing = LIBRAS_SIGNS.find(
    (s) => s.isAlphabet && normalizePortuguese(s.gloss) === normalizePortuguese(upper)
  );
  if (existing) return existing;

  // Fallback geometric approximation for letters not explicitly in camera subset
  const code = upper.charCodeAt(0) % 5;
  const presets: Array<[number, number, number, number, number]> = [
    [0.6, 0.2, 0.2, 0.9, 0.9],
    [0.2, 0.0, 0.0, 0.0, 0.9],
    [0.4, 0.5, 0.5, 0.9, 0.9],
    [0.8, 0.1, 0.9, 0.9, 0.9],
    [0.1, 0.4, 0.4, 0.4, 0.4],
  ];
  return {
    id: `spell-${upper}`,
    word: `Letra ${upper}`,
    gloss: upper,
    category: 'alfabeto',
    level: 'iniciante',
    isAlphabet: true,
    handshape: `Datilologia — Letra ${upper}`,
    location: 'Espaço neutro',
    movement: 'Soletração manual',
    facialExpression: 'Neutra',
    description: `Soletração manual da letra ${upper} em Libras.`,
    culturalNote: 'Palavras sem sinal dicionarizado no vocabulário base são soletradas letra a letra.',
    pose: {
      fingers: presets[code],
      spread: 0.25,
      wristAngle: 0,
      palm: 'front',
      anchor: { x: 0.38, y: 0.05 },
      motion: 'static',
      facial: 'neutral',
    },
  };
}

export function translateTextToLibras(
  inputText: string,
  externalGloss?: string
): TranslationResult {
  const cleaned = inputText.trim();
  if (!cleaned) {
    return {
      sourceText: '',
      glossSentence: '',
      tokens: [],
      sourceEngine: 'motor-glosa-local',
      notes: [],
    };
  }

  const notes: string[] = [];
  let workingText = cleaned;

  // If external VLibras API returned a valid gloss, use its token sequence while resolving signs locally
  if (externalGloss && externalGloss.trim().length > 0) {
    const rawGlossWords = externalGloss
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[.,!?;:()"]/g, ''))
      .filter(Boolean);

    const tokens = resolveGlossTokens(rawGlossWords, notes);
    return {
      sourceText: cleaned,
      glossSentence: rawGlossWords.join(' '),
      tokens,
      sourceEngine: 'vlibras-api',
      notes,
    };
  }

  // Local linguistic Portuguese -> Libras gloss engine
  const isQuestion = cleaned.includes('?');
  const placeholderMap = new Map<string, string>();
  let placeholderIdx = 0;

  for (const expr of MULTIWORD_EXPRESSIONS) {
    workingText = workingText.replace(expr.pattern, () => {
      const key = `__EXPR_${placeholderIdx++}__`;
      placeholderMap.set(key, expr.gloss);
      return ` ${key} `;
    });
  }

  const rawWords = workingText
    .replace(/[.,!?;:()"']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const temporalTokens: string[] = [];
  const mainTokens: string[] = [];
  let strippedStopWords = false;

  for (const w of rawWords) {
    if (placeholderMap.has(w)) {
      mainTokens.push(placeholderMap.get(w)!);
      continue;
    }

    const norm = normalizePortuguese(w);
    if (STOP_WORDS.has(norm)) {
      strippedStopWords = true;
      continue;
    }

    const matched = findSignByWord(norm);
    const glossWord = matched ? matched.gloss : w.toUpperCase();

    if (TEMPORAL_MARKERS.has(norm)) {
      temporalTokens.push(glossWord);
    } else {
      mainTokens.push(glossWord);
    }
  }

  if (strippedStopWords) {
    notes.push('Artigos e preposições do português foram omitidos conforme a gramática da Libras.');
  }
  if (temporalTokens.length > 0) {
    notes.push('Marcadores temporais foram posicionados no início da frase em glosa.');
  }
  if (isQuestion) {
    notes.push('Frase interrogativa: acompanhe com expressão facial interrogativa (sobrancelhas).');
  }

  const orderedGloss = [...temporalTokens, ...mainTokens];
  if (orderedGloss.length === 0 && rawWords.length > 0) {
    orderedGloss.push(rawWords[0].toUpperCase());
  }

  const tokens = resolveGlossTokens(orderedGloss, notes);

  return {
    sourceText: cleaned,
    glossSentence: orderedGloss.join(' ') + (isQuestion ? ' ?' : ''),
    tokens,
    sourceEngine: 'motor-glosa-local',
    notes,
  };
}

function resolveGlossTokens(glossWords: string[], notes: string[]): GlossToken[] {
  const tokens: GlossToken[] = [];
  let usedFingerspelling = false;

  glossWords.forEach((gw, wordIdx) => {
    const matched = findSignByWord(gw);
    if (matched) {
      tokens.push({
        id: `${matched.id}-${wordIdx}`,
        gloss: matched.gloss,
        originalWord: gw,
        sign: matched,
        isFingerspelled: false,
      });
    } else {
      // Decompose into Datilologia (letter-by-letter fingerspelling)
      const letters = gw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]/g, '')
        .split('');

      if (letters.length > 0) {
        usedFingerspelling = true;
      }

      letters.forEach((ch, charIdx) => {
        const letterSign = buildFingerspelledSign(ch);
        tokens.push({
          id: `spell-${wordIdx}-${charIdx}-${ch}`,
          gloss: ch.toUpperCase(),
          originalWord: gw,
          sign: letterSign,
          isFingerspelled: true,
          letter: ch.toUpperCase(),
        });
      });
    }
  });

  if (usedFingerspelling) {
    notes.push('Palavras ou nomes sem sinal direto foram convertidos automaticamente para datilologia (soletração manual).');
  }

  return tokens;
}

export function parseVlibrasApiResponse(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload.trim();
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.gloss === 'string' && obj.gloss.trim().length > 0) {
      return obj.gloss.trim();
    }
    if (typeof obj.text === 'string' && obj.text.trim().length > 0) {
      return obj.text.trim();
    }
  }
  return null;
}
