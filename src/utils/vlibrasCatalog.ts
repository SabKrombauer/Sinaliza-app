import { LIBRAS_SIGNS, type LibrasSign, type QuizQuestion, type StudyLevelId, type StudyModule } from '../data/librasSigns';
import { normalizePortuguese } from './vlibrasGloss';

export type VlibrasGlossKind = 'simple' | 'compound' | 'contextual' | 'inflected';

export interface VlibrasCatalogItem {
  id: string;
  gloss: string;
  word: string;
  senseTag?: string;
  initialLetter: string;
  kind: VlibrasGlossKind;
  level: StudyLevelId;
  hasCuratedGuide: boolean;
  curatedSign?: LibrasSign;
}

export interface VlibrasTrieNode {
  children?: Record<string, VlibrasTrieNode>;
  end?: boolean;
}

const curatedByGloss = new Map<string, LibrasSign>();
for (const sign of LIBRAS_SIGNS) {
  const key = sign.gloss.toUpperCase().replace(/-/g, '_');
  curatedByGloss.set(key, sign);
  if (sign.gloss.toUpperCase() === 'O-QUÊ') {
    curatedByGloss.set('O_QUE', sign);
  }
}

export function getCuratedSignByGloss(gloss: string): LibrasSign | undefined {
  const upper = gloss.trim().toUpperCase();
  return curatedByGloss.get(upper) || curatedByGloss.get(upper.replace(/-/g, '_'));
}

/**
 * Traverses the official VLibras dictionary JSON trie into a sorted list of gloss strings.
 */
export function parseVlibrasTrie(rootOrContainer: unknown): string[] {
  if (!rootOrContainer || typeof rootOrContainer !== 'object') return [];
  const obj = rootOrContainer as { root?: VlibrasTrieNode } & VlibrasTrieNode;
  const root = obj.root || obj;
  const results: string[] = [];

  const stack: Array<{ node: VlibrasTrieNode; prefix: string }> = [{ node: root, prefix: '' }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.node.end && current.prefix) {
      results.push(current.prefix);
    }
    if (current.node.children) {
      const entries = Object.entries(current.node.children);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [ch, child] = entries[i];
        stack.push({ node: child, prefix: current.prefix + ch });
      }
    }
  }

  return results;
}

function toTitleSegment(raw: string): string {
  const cleaned = raw.replace(/_/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length === 1) return cleaned.toUpperCase();
  const lower = cleaned.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function getAlphabetBucket(gloss: string): string {
  const normalized = normalizePortuguese(gloss).toUpperCase();
  const first = normalized.charAt(0);
  if (first >= 'A' && first <= 'Z') return first;
  if ((first >= '0' && first <= '9') || first === '%' || first === '[') return '0-9';
  return '#';
}

export function classifyGlossKind(gloss: string): VlibrasGlossKind {
  if (/^[123][SP]_/i.test(gloss) || /_[123][SP]$/i.test(gloss)) return 'inflected';
  if (gloss.includes('&')) return 'contextual';
  if (gloss.includes('_')) return 'compound';
  return 'simple';
}

const BEGINNER_KEYWORDS = new Set([
  'CASA', 'AGUA', 'ÁGUA', 'PAI', 'MAE', 'MÃE', 'FILHO', 'FILHA', 'IRMAO', 'IRMÃO',
  'AMIGO', 'ESCOLA', 'LIVRO', 'COMER', 'BEBER', 'DORMIR', 'IR', 'VIR', 'VER', 'DAR',
  'DIA', 'NOITE', 'HOJE', 'ONTEM', 'AMANHA', 'AMANHÃ', 'SOL', 'CHUVA', 'CARRO',
  'GATO', 'CACHORRO', 'BOLA', 'MESA', 'CADEIRA', 'PORTA', 'JANELA', 'COR', 'PRETO',
  'BRANCO', 'ROSA', 'ROXO', 'LARANJA', 'FELIZ', 'TRISTE', 'BOM', 'MAU', 'GRANDE',
  'PEQUENO', 'NOVO', 'VELHO', 'SIM', 'NAO', 'NÃO', 'OI', 'OLÁ', 'OLA', 'TCHAU',
]);

export function estimateGlossLevel(gloss: string, kind: VlibrasGlossKind, curated?: LibrasSign): StudyLevelId {
  if (curated) return curated.level;
  if (gloss.length === 1 || /^[0-9]+$/.test(gloss)) return 'iniciante';
  const norm = normalizePortuguese(gloss).toUpperCase();
  if (BEGINNER_KEYWORDS.has(gloss.toUpperCase()) || BEGINNER_KEYWORDS.has(norm)) {
    return 'iniciante';
  }
  if (kind === 'inflected' || kind === 'contextual' || gloss.length >= 14) {
    return 'avancado';
  }
  if (kind === 'compound' || gloss.length >= 9) {
    return 'intermediario';
  }
  return 'iniciante';
}

export function formatVlibrasEntry(gloss: string): VlibrasCatalogItem {
  const curatedSign = getCuratedSignByGloss(gloss);
  const kind = classifyGlossKind(gloss);

  let word: string;
  let senseTag: string | undefined;

  if (curatedSign) {
    word = curatedSign.word;
  } else if (gloss.includes('&')) {
    const [base, sense] = gloss.split('&');
    word = toTitleSegment(base);
    senseTag = toTitleSegment(sense);
  } else if (kind === 'inflected') {
    const parts = gloss.split('_');
    if (parts.length === 3) {
      word = `${toTitleSegment(parts[1])} (${parts[0]} → ${parts[2]})`;
      senseTag = 'Verbo direcional';
    } else {
      word = toTitleSegment(gloss);
    }
  } else {
    word = toTitleSegment(gloss);
  }

  const level = estimateGlossLevel(gloss, kind, curatedSign);

  return {
    id: `vlibras:${gloss}`,
    gloss,
    word,
    senseTag,
    initialLetter: getAlphabetBucket(gloss),
    kind,
    level,
    hasCuratedGuide: Boolean(curatedSign),
    curatedSign,
  };
}

export function formatEntryLabel(item: Pick<VlibrasCatalogItem, 'word' | 'senseTag'>): string {
  return item.senseTag ? `${item.word} (${item.senseTag})` : item.word;
}

export interface CatalogQueryOptions {
  q?: string;
  letter?: string;
  kind?: 'all' | 'curated' | VlibrasGlossKind;
  level?: 'all' | StudyLevelId;
  page?: number;
  limit?: number;
}

export interface CatalogQueryResult {
  totalCatalogCount: number;
  filteredCount: number;
  page: number;
  totalPages: number;
  items: VlibrasCatalogItem[];
}

export function queryVlibrasCatalog(
  catalog: VlibrasCatalogItem[],
  options: CatalogQueryOptions
): CatalogQueryResult {
  const qNorm = normalizePortuguese(options.q || '');
  const letter = (options.letter || 'all').toUpperCase();
  const kind = options.kind || 'all';
  const level = options.level || 'all';
  const limit = Math.max(1, Math.min(80, options.limit || 36));

  const filtered = catalog.filter((item) => {
    if (letter !== 'ALL' && item.initialLetter !== letter) return false;
    if (level !== 'all' && item.level !== level) return false;
    if (kind === 'curated' && !item.hasCuratedGuide) return false;
    if (kind !== 'all' && kind !== 'curated' && item.kind !== kind) return false;
    if (!qNorm) return true;

    const matchWord = normalizePortuguese(item.word).includes(qNorm);
    const matchGloss = normalizePortuguese(item.gloss.replace(/_/g, ' ')).includes(qNorm);
    const matchSense = item.senseTag ? normalizePortuguese(item.senseTag).includes(qNorm) : false;
    return matchWord || matchGloss || matchSense;
  });

  // Sort curated or exact-prefix matches first when searching
  const sorted = qNorm
    ? [...filtered].sort((a, b) => {
        const aExact = normalizePortuguese(a.word) === qNorm ? 1 : 0;
        const bExact = normalizePortuguese(b.word) === qNorm ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        const aStart = normalizePortuguese(a.word).startsWith(qNorm) ? 1 : 0;
        const bStart = normalizePortuguese(b.word).startsWith(qNorm) ? 1 : 0;
        if (aStart !== bStart) return bStart - aStart;
        return Number(b.hasCuratedGuide) - Number(a.hasCuratedGuide);
      })
    : filtered;

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const safePage = Math.max(1, Math.min(totalPages, options.page || 1));
  const start = (safePage - 1) * limit;

  return {
    totalCatalogCount: catalog.length,
    filteredCount: sorted.length,
    page: safePage,
    totalPages,
    items: sorted.slice(start, start + limit),
  };
}

/**
 * Deterministic hash helper for daily/seeded selection from the full catalog.
 */
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Picks a rich non-symbol daily sign from the full VLibras catalog.
 */
export function pickDailyVlibrasEntry(catalog: VlibrasCatalogItem[], dateStr: string): VlibrasCatalogItem {
  const cleanPool = catalog.filter(
    (item) => item.gloss.length > 2 && item.kind !== 'inflected' && !/^[0-9%\[]/.test(item.gloss)
  );
  const pool = cleanPool.length > 0 ? cleanPool : catalog;
  const idx = hashString(`wotd:${dateStr}`) % pool.length;
  return pool[idx];
}

/**
 * Converts any VLibras catalog item into a playable LibrasSign object for Study/Quiz components.
 */
export function catalogItemToSign(item: VlibrasCatalogItem): LibrasSign {
  if (item.curatedSign) return item.curatedSign;

  const label = formatEntryLabel(item);
  const kindDescription =
    item.kind === 'contextual'
      ? `Sinal contextualizado do acervo VLibras para "${item.word}" no sentido de ${item.senseTag?.toLowerCase()}.`
      : item.kind === 'compound'
        ? `Expressão composta do dicionário oficial VLibras representada pela glosa ${item.gloss}.`
        : item.kind === 'inflected'
          ? `Verbo direcional flexionado no espaço de sinalização (${item.gloss}).`
          : `Sinal lexicalizado do dicionário oficial VLibras correspondente a "${item.word}".`;

  return {
    id: item.id,
    word: label,
    gloss: item.gloss,
    category: item.initialLetter === '0-9' ? 'numeros' : 'expressoes',
    level: item.level,
    handshape: 'Execução 3D oficial VLibras',
    location: 'Espaço de sinalização (avatar 3D)',
    movement: 'Animação em AssetBundle oficial',
    facialExpression: 'Expressão não-manual integrada ao sinal',
    description: kindDescription,
    culturalNote:
      'Sinal carregado diretamente do dicionário oficial spbgovbr-vlibras. Observe a trajetória das mãos, orientação da palma e expressão facial no player 3D.',
    pose: {
      fingers: [0.2, 0.2, 0.2, 0.2, 0.2],
      spread: 0.3,
      wristAngle: 0,
      palm: 'front',
      anchor: { x: 0.35, y: 0 },
      motion: 'static',
      facial: 'neutral',
    },
  };
}

/**
 * Generates an interactive StudyModule (signs + visual 3D recognition quizzes)
 * directly from the full 23,403-sign VLibras catalog.
 */
export function buildDynamicVlibrasStudyModule(
  catalog: VlibrasCatalogItem[],
  options: {
    level: StudyLevelId;
    topic?: string;
    seed?: string;
    count?: number;
  }
): { module: StudyModule; signs: LibrasSign[] } {
  const count = Math.max(3, Math.min(8, options.count || 5));
  const seed = options.seed || 'default';
  const topicNorm = normalizePortuguese(options.topic || '');

  let pool = catalog.filter(
    (item) =>
      item.gloss.length > 1 &&
      !/^\[/.test(item.gloss) &&
      (topicNorm
        ? normalizePortuguese(item.word).includes(topicNorm) ||
          normalizePortuguese(item.gloss.replace(/_/g, ' ')).includes(topicNorm) ||
          (item.senseTag ? normalizePortuguese(item.senseTag).includes(topicNorm) : false)
        : item.level === options.level)
  );

  if (pool.length < count) {
    pool = catalog.filter((item) => item.gloss.length > 1 && item.kind !== 'inflected');
  }

  // Deterministic pseudo-random sampling without duplicates
  const picked: VlibrasCatalogItem[] = [];
  const usedGlosses = new Set<string>();
  const baseHash = hashString(`${options.level}:${topicNorm}:${seed}`);

  for (let attempt = 0; attempt < pool.length && picked.length < count; attempt++) {
    const idx = (baseHash + attempt * 7919) % pool.length;
    const candidate = pool[idx];
    if (!usedGlosses.has(candidate.gloss)) {
      usedGlosses.add(candidate.gloss);
      picked.push(candidate);
    }
  }

  const signs = picked.map(catalogItemToSign);
  const distractorPool = catalog.filter((item) => item.gloss.length > 1 && item.kind !== 'inflected');

  const quizzes: QuizQuestion[] = picked.slice(0, Math.min(4, picked.length)).map((target, qIdx) => {
    const correctLabel = formatEntryLabel(target);
    const optionsSet = new Set<string>([correctLabel]);

    for (let d = 1; optionsSet.size < 4 && d < 50; d++) {
      const distIdx = (hashString(`${seed}:${target.gloss}:${d}`) + qIdx * 131) % distractorPool.length;
      const dist = distractorPool[distIdx];
      if (dist && dist.gloss !== target.gloss) {
        optionsSet.add(formatEntryLabel(dist));
      }
    }

    // Deterministic shuffle of 4 options
    const shuffledOptions = Array.from(optionsSet).sort(
      (a, b) => hashString(`${seed}:${qIdx}:${a}`) - hashString(`${seed}:${qIdx}:${b}`)
    );

    return {
      id: `vlibras-q-${qIdx}-${target.gloss}`,
      type: 'identify',
      prompt: 'Observe a execução do intérprete 3D VLibras ao lado. Qual sinal está sendo realizado?',
      targetSignId: target.id,
      options: shuffledOptions,
      correctAnswer: correctLabel,
      explanation: `A glosa oficial no VLibras é "${target.gloss}", que corresponde a "${correctLabel}".`,
    };
  });

  const levelTitles: Record<StudyLevelId, string> = {
    iniciante: 'Iniciante',
    intermediario: 'Intermediário',
    avancado: 'Avançado',
  };

  const title = topicNorm
    ? `Prática VLibras: "${options.topic?.trim()}"`
    : `Desafio do Acervo VLibras · ${levelTitles[options.level]}`;

  const module: StudyModule = {
    id: `vlibras-deck-${options.level}-${hashString(seed + topicNorm) % 10000}`,
    title,
    subtitle: `${signs.length} sinais reais do dicionário oficial VLibras`,
    level: options.level,
    durationMinutes: Math.max(3, signs.length),
    xpReward: 45 + signs.length * 5,
    signIds: signs.map((s) => s.id),
    grammarTip:
      'Todos os sinais desta sessão vêm diretamente do catálogo oficial spbgovbr-vlibras com execução 3D real.',
    quizzes,
  };

  return { module, signs };
}
