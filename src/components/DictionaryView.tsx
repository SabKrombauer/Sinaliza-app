import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Play, Search } from 'lucide-react';
import {
  CATEGORY_LABELS,
  LIBRAS_SIGNS,
  type StudyLevelId,
} from '../data/librasSigns';
import {
  catalogItemToSign,
  formatEntryLabel,
  formatVlibrasEntry,
  queryVlibrasCatalog,
  type VlibrasCatalogItem,
  type VlibrasGlossKind,
} from '../utils/vlibrasCatalog';
import { SignDemoModal } from './SignDemoModal';
import { SignVisualPreview } from './SignVisualPreview';
import type { VLibrasAvatarId } from './VLibrasPlayer';

interface DictionaryViewProps {
  defaultAvatar?: VLibrasAvatarId;
  defaultSpeed?: 0.7 | 1 | 1.4;
  onSendToTranslator: (word: string) => void;
  onPracticeSign?: (signId: string) => void;
  practicedSignIds?: string[];
}

interface CatalogApiResponse {
  source: 'vlibras-oficial' | 'acervo-local';
  totalCatalogCount: number;
  filteredCount: number;
  page: number;
  totalPages: number;
  items: VlibrasCatalogItem[];
}

const ALPHABET_BUCKETS = [
  'all',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0-9',
];

const KIND_LABELS: Record<VlibrasGlossKind, string> = {
  simple: 'Sinal lexical',
  compound: 'Expressão composta',
  contextual: 'Sentido específico',
  inflected: 'Verbo direcional',
};

const LOCAL_SEED_ITEMS: VlibrasCatalogItem[] = LIBRAS_SIGNS.map((s) => formatVlibrasEntry(s.gloss));

export const DictionaryView: React.FC<DictionaryViewProps> = ({
  defaultAvatar = 'icaro',
  defaultSpeed = 1,
  onSendToTranslator,
  onPracticeSign,
  practicedSignIds = [],
}) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [letterFilter, setLetterFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'curated' | VlibrasGlossKind>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | StudyLevelId>('all');
  const [page, setPage] = useState(1);

  const initialSeed = useMemo(
    () => queryVlibrasCatalog(LOCAL_SEED_ITEMS, { page: 1, limit: 36 }),
    []
  );

  const [catalogData, setCatalogData] = useState<CatalogApiResponse>({
    source: 'acervo-local',
    ...initialSeed,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [modalItemIndex, setModalItemIndex] = useState<number | null>(null);

  // Debounce typing to keep server search snappy
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchCatalog() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: debouncedSearch,
          letter: letterFilter,
          kind: kindFilter,
          level: levelFilter,
          page: String(page),
          limit: '36',
        });
        const res = await fetch(`/api/vlibras/catalog?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as CatalogApiResponse;
          setCatalogData(data);
        }
      } catch {
        if (!cancelled) {
          const fallback = queryVlibrasCatalog(LOCAL_SEED_ITEMS, {
            q: debouncedSearch,
            letter: letterFilter,
            kind: kindFilter,
            level: levelFilter,
            page,
            limit: 36,
          });
          setCatalogData({ source: 'acervo-local', ...fallback });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchCatalog();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedSearch, letterFilter, kindFilter, levelFilter, page]);

  // Close modal if page changes and index goes out of bounds
  useEffect(() => {
    setModalItemIndex(null);
  }, [page, debouncedSearch, letterFilter, kindFilter, levelFilter]);

  const handleSpeak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    window.speechSynthesis.speak(u);
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setLetterFilter('all');
    setKindFilter('all');
    setLevelFilter('all');
    setPage(1);
  };

  const modalItem =
    modalItemIndex !== null && catalogData.items[modalItemIndex]
      ? catalogData.items[modalItemIndex]
      : null;

  const modalSign = modalItem ? catalogItemToSign(modalItem) : null;

  return (
    <section aria-labelledby="dictionary-heading" className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-blue-700">
            Dicionário Visual VLibras · {catalogData.totalCatalogCount.toLocaleString('pt-BR')} sinais disponíveis
          </p>
          <h1
            id="dictionary-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]"
          >
            Galeria visual de sinais em Libras
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Explore os sinais do repositório oficial VLibras e clique em qualquer cartão para abrir o modal com a demonstração em vídeo 3D.
          </p>
        </div>

        <p
          data-testid="dictionary-count-summary"
          className="text-xs font-mono tabular-nums text-slate-500"
        >
          {catalogData.filteredCount.toLocaleString('pt-BR')} resultados
          {catalogData.totalPages > 1
            ? ` · Página ${catalogData.page} de ${catalogData.totalPages}`
            : ''}
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Pesquisar sinal no dicionário VLibras"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar em todo o dicionário VLibras (ex.: escola, saúde, música, claro)..."
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrar por nível"
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value as 'all' | StudyLevelId);
                setPage(1);
              }}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">Todos os níveis</option>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>

            <select
              aria-label="Filtrar por tipo de sinal"
              value={kindFilter}
              onChange={(e) => {
                setKindFilter(e.target.value as 'all' | 'curated' | VlibrasGlossKind);
                setPage(1);
              }}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">Todo o acervo VLibras</option>
              <option value="curated">Com guia fonológico detalhado</option>
              <option value="simple">Palavras simples</option>
              <option value="compound">Expressões compostas</option>
              <option value="contextual">Sentidos específicos (&amp;)</option>
              <option value="inflected">Verbos direcionais</option>
            </select>
          </div>
        </div>

        {/* Alphabetical A-Z Index Strip */}
        <div
          className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3"
          role="group"
          aria-label="Índice alfabético do dicionário VLibras"
        >
          {ALPHABET_BUCKETS.map((bucket) => {
            const active = letterFilter === bucket;
            return (
              <button
                key={bucket}
                type="button"
                onClick={() => {
                  setLetterFilter(bucket);
                  setPage(1);
                }}
                className={`min-h-[34px] min-w-[34px] rounded-lg px-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {bucket === 'all' ? 'Todos' : bucket}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Gallery Grid */}
      {isLoading && catalogData.items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando galeria visual do dicionário VLibras...
        </div>
      ) : catalogData.items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Nenhum sinal encontrado para os filtros atuais
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tente buscar outra palavra ou limpar os filtros de letra, nível e tipo.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <>
          <div
            data-testid="dictionary-visual-gallery"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {catalogData.items.map((item, idx) => {
              const label = formatEntryLabel(item);
              const itemSign = catalogItemToSign(item);
              const isPracticed = practicedSignIds.includes(itemSign.id);
              const isModalOpenForThis = modalItemIndex === idx;

              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid="dictionary-gallery-card"
                  aria-label={`Abrir demonstração do sinal ${label}`}
                  onClick={() => setModalItemIndex(idx)}
                  className={`group flex flex-col overflow-hidden rounded-2xl border bg-white text-left transition-colors ${
                    isModalOpenForThis
                      ? 'border-blue-700 ring-2 ring-blue-700/15'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <SignVisualPreview item={item} isPracticed={isPracticed} />

                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="truncate">
                          {item.curatedSign
                            ? CATEGORY_LABELS[item.curatedSign.category]
                            : KIND_LABELS[item.kind]}
                        </span>
                        <span className="font-mono text-slate-600 truncate max-w-[120px]">
                          {item.gloss}
                        </span>
                      </div>

                      <h2 className="mt-1.5 text-base font-bold text-slate-900 line-clamp-1">
                        {label}
                      </h2>

                      <p className="mt-1 text-xs text-slate-600 line-clamp-1">
                        {item.curatedSign
                          ? item.curatedSign.handshape
                          : 'Demonstração 3D oficial VLibras'}
                      </p>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                        <Play className="h-3.5 w-3.5" />
                        Ver demonstração
                      </span>
                      {isPracticed && (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Praticado
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {catalogData.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <button
                type="button"
                disabled={catalogData.page <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                Página {catalogData.page} de {catalogData.totalPages}
              </span>
              <button
                type="button"
                disabled={catalogData.page >= catalogData.totalPages}
                onClick={() => {
                  setPage((p) => Math.min(catalogData.totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Video Demonstration Modal */}
      {modalItem && modalSign && modalItemIndex !== null && (
        <SignDemoModal
          item={modalItem}
          defaultAvatar={defaultAvatar}
          defaultSpeed={defaultSpeed}
          isPracticed={practicedSignIds.includes(modalSign.id)}
          canPrev={modalItemIndex > 0}
          canNext={modalItemIndex < catalogData.items.length - 1}
          onPrev={() => setModalItemIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() =>
            setModalItemIndex((i) =>
              i !== null && i < catalogData.items.length - 1 ? i + 1 : i
            )
          }
          onClose={() => setModalItemIndex(null)}
          onPracticeSign={onPracticeSign}
          onSendToTranslator={onSendToTranslator}
          onSpeak={handleSpeak}
        />
      )}
    </section>
  );
};
