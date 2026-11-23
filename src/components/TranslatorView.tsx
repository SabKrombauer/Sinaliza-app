import React, { useEffect, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Search,
  Volume2,
  BookOpen,
} from 'lucide-react';
import { LIBRAS_SIGNS } from '../data/librasSigns';
import {
  parseVlibrasApiResponse,
  translateTextToLibras,
  type TranslationResult,
} from '../utils/vlibrasGloss';
import { VLibrasPlayer, type VLibrasAvatarId } from './VLibrasPlayer';

interface TranslatorViewProps {
  initialPhrase?: string;
  defaultAvatar?: VLibrasAvatarId;
  defaultSpeed?: 0.7 | 1 | 1.4;
  onPracticeSign?: (signId: string) => void;
}

const AVATARS: Array<{ id: VLibrasAvatarId; label: string }> = [
  { id: 'icaro', label: 'Ícaro' },
  { id: 'hosana', label: 'Hosana' },
  { id: 'guga', label: 'Guga' },
];

export const TranslatorView: React.FC<TranslatorViewProps> = ({
  initialPhrase = 'Olá, tudo bem?',
  defaultAvatar = 'icaro',
  defaultSpeed = 1,
  onPracticeSign,
}) => {
  const [query, setQuery] = useState(initialPhrase);
  const [translation, setTranslation] = useState<TranslationResult>(() =>
    translateTextToLibras(initialPhrase)
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [playFullPhrase, setPlayFullPhrase] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<0.7 | 1 | 1.4>(defaultSpeed);
  const [avatar, setAvatar] = useState<VLibrasAvatarId>(defaultAvatar);
  const [replayKey, setReplayKey] = useState(0);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  useEffect(() => {
    setAvatar(defaultAvatar);
  }, [defaultAvatar]);

  useEffect(() => {
    setSpeed(defaultSpeed);
  }, [defaultSpeed]);

  const tokens = translation.tokens;
  const activeToken = tokens[activeIndex] || tokens[0];
  const activeSign = activeToken?.sign || LIBRAS_SIGNS.find((s) => s.id === 'ola')!;
  const playerGloss = playFullPhrase
    ? translation.glossSentence.replace(/\?/g, '').trim() || activeSign.gloss
    : activeToken?.gloss || activeSign.gloss;

  // Sync if navigated here with a new initialPhrase
  useEffect(() => {
    if (initialPhrase && initialPhrase !== query) {
      setQuery(initialPhrase);
      setTranslation(translateTextToLibras(initialPhrase));
      setActiveIndex(0);
      setPlayFullPhrase(true);
      setIsPlaying(true);
      setReplayKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhrase]);

  const handleTranslate = async (textToTranslate: string) => {
    const trimmed = textToTranslate.trim();
    if (!trimmed) return;

    const localResult = translateTextToLibras(trimmed);
    setTranslation(localResult);
    setActiveIndex(0);
    setPlayFullPhrase(true);
    setIsPlaying(true);
    setReplayKey((k) => k + 1);
    setIsLoadingApi(true);

    try {
      const res = await fetch(`/api/vlibras/translate?text=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = (await res.json()) as { gloss?: string | null };
        const parsedGloss = parseVlibrasApiResponse(data.gloss);
        if (parsedGloss) {
          setTranslation(translateTextToLibras(trimmed, parsedGloss));
        }
      }
    } catch {
      // Keep local gloss translation cleanly
    } finally {
      setIsLoadingApi(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleTranslate(query);
  };

  const handleSpeakPortuguese = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translation.sourceText);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section aria-labelledby="translator-heading" className="space-y-6">
      {/* Intro & Avatar Selector Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-blue-700">
            Tradutor Português · Libras
          </p>
          <h1
            id="translator-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]"
          >
            Tradução de palavras e frases com VLibras
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Digite uma palavra ou frase em português para traduzir para Libras e acompanhar o intérprete 3D oficial do VLibras diretamente no palco.
          </p>
        </div>

        {/* Avatar Picker (Ícaro / Hosana / Guga) */}
        <div
          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start lg:self-auto"
          role="group"
          aria-label="Selecionar avatar VLibras"
        >
          {AVATARS.map((av) => {
            const active = avatar === av.id;
            return (
              <button
                key={av.id}
                type="button"
                onClick={() => setAvatar(av.id)}
                className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {av.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Zone Translator Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Left Zone (7 cols): Embedded VLibras 3D Player Stage */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-7">
          {/* Stage Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>VLibras 3D (spbgovbr-vlibras)</span>
                <span aria-hidden="true">·</span>
                <span>
                  {translation.sourceEngine === 'vlibras-api'
                    ? 'API VLibras'
                    : 'Motor de Glosa Libras'}
                </span>
                {isLoadingApi && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-blue-700">Sincronizando...</span>
                  </>
                )}
              </div>
              <p className="mt-0.5 truncate text-base font-semibold text-slate-900">
                {playFullPhrase
                  ? translation.glossSentence || activeSign.gloss
                  : `${activeToken?.gloss} — ${activeSign.word}`}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? 'Pausar sinalização' : 'Reproduzir sinalização'}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? 'Pausar' : 'Reproduzir'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayFullPhrase(true);
                  setIsPlaying(true);
                  setReplayKey((k) => k + 1);
                }}
                aria-label="Reiniciar sequência de sinais"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Embedded Official VLibras 3D Stage */}
          <div className="relative h-[320px] sm:h-[380px] lg:h-[420px] bg-slate-50">
            <VLibrasPlayer
              gloss={playerGloss}
              isPlaying={isPlaying}
              speed={speed}
              avatar={avatar}
              replayKey={replayKey}
              title="Tradutor 3D VLibras"
            />
          </div>

          {/* Stage Footer: Speed & Speech Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <div className="flex items-center gap-1.5" role="group" aria-label="Velocidade da animação">
              <span className="text-xs font-medium text-slate-600 mr-1">Velocidade:</span>
              {([0.7, 1, 1.4] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setSpeed(spd)}
                  className={`min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-medium font-mono tabular-nums transition-colors ${
                    speed === spd
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSpeakPortuguese}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <Volume2 className="h-4 w-4 text-blue-700" />
              Ouvir frase em português
            </button>
          </div>
        </div>

        {/* Right Zone (5 cols): Search Input, Gloss Sequencer & Linguistic Inspector */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {/* Input Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <form onSubmit={handleSubmit} className="space-y-3">
              <label
                htmlFor="translator-input"
                className="block text-sm font-semibold text-slate-900"
              >
                Texto em português para traduzir
              </label>
              <div className="relative">
                <textarea
                  id="translator-input"
                  rows={3}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex.: Olá, tudo bem? Eu quero aprender Libras."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <Search className="h-4 w-4" />
                  Traduzir para Libras
                </button>
              </div>
            </form>
          </div>

          {/* Gloss Timeline & Sign Details Card */}
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Sequência em Glosa (Libras)
                </h2>
                <span className="text-xs font-mono text-slate-500">
                  {tokens.length} {tokens.length === 1 ? 'sinal' : 'sinais'}
                </span>
              </div>
              <p
                data-testid="gloss-sentence"
                className="mt-1.5 rounded-xl bg-slate-50 px-3.5 py-2.5 font-mono text-sm font-medium text-slate-900 border border-slate-200/70"
              >
                {translation.glossSentence || 'Digite uma frase acima para traduzir'}
              </p>
            </div>

            {/* Interactive Token Strip */}
            {tokens.length > 0 && (
              <div className="flex flex-wrap gap-1.5" role="list" aria-label="Sinais da frase">
                <button
                  type="button"
                  onClick={() => {
                    setPlayFullPhrase(true);
                    setIsPlaying(true);
                    setReplayKey((k) => k + 1);
                  }}
                  className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    playFullPhrase
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Frase completa
                </button>
                {tokens.map((tok, idx) => {
                  const active = !playFullPhrase && idx === activeIndex;
                  return (
                    <button
                      key={tok.id}
                      type="button"
                      onClick={() => {
                        setPlayFullPhrase(false);
                        setActiveIndex(idx);
                        setIsPlaying(true);
                        setReplayKey((k) => k + 1);
                      }}
                      className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tok.gloss}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Phonological Sign Breakdown */}
            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-blue-700" />
                  Parâmetros do sinal: {activeSign.word}
                </h3>
                {onPracticeSign && (
                  <button
                    type="button"
                    onClick={() => onPracticeSign(activeSign.id)}
                    className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                  >
                    Registrar prática
                  </button>
                )}
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-slate-500">Configuração de mão</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{activeSign.handshape}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ponto de articulação</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{activeSign.location}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Movimento</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{activeSign.movement}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Expressão facial</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{activeSign.facialExpression}</dd>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-slate-600 pt-1">
                {activeSign.description}
              </p>

              {translation.notes.length > 0 && (
                <ul className="space-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  {translation.notes.map((note, i) => (
                    <li key={i}>· {note}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
