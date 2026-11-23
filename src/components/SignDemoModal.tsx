import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { CATEGORY_LABELS, LEVEL_META, type LibrasSign } from '../data/librasSigns';
import {
  catalogItemToSign,
  formatEntryLabel,
  type VlibrasCatalogItem,
  type VlibrasGlossKind,
} from '../utils/vlibrasCatalog';
import { VLibrasPlayer, type VLibrasAvatarId } from './VLibrasPlayer';

interface SignDemoModalProps {
  item: VlibrasCatalogItem;
  defaultAvatar?: VLibrasAvatarId;
  defaultSpeed?: 0.7 | 1 | 1.4;
  isPracticed: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onPracticeSign?: (signId: string) => void;
  onSendToTranslator: (word: string) => void;
  onSpeak: (text: string) => void;
}

const KIND_LABELS: Record<VlibrasGlossKind, string> = {
  simple: 'Sinal lexical',
  compound: 'Expressão composta',
  contextual: 'Sentido específico',
  inflected: 'Verbo direcional',
};

const AVATARS: Array<{ id: VLibrasAvatarId; label: string }> = [
  { id: 'icaro', label: 'Ícaro' },
  { id: 'hosana', label: 'Hosana' },
  { id: 'guga', label: 'Guga' },
];

export const SignDemoModal: React.FC<SignDemoModalProps> = ({
  item,
  defaultAvatar = 'icaro',
  defaultSpeed = 1,
  isPracticed,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onClose,
  onPracticeSign,
  onSendToTranslator,
  onSpeak,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [speed, setSpeed] = useState<0.7 | 1 | 1.4>(defaultSpeed);
  const [avatar, setAvatar] = useState<VLibrasAvatarId>(defaultAvatar);
  const [replayKey, setReplayKey] = useState(0);

  const sign: LibrasSign = catalogItemToSign(item);
  const label = formatEntryLabel(item);

  // Reset playback state cleanly whenever navigating to another sign in the gallery
  useEffect(() => {
    setIsPlaying(true);
    setReplayKey((k) => k + 1);
  }, [item.gloss]);

  // Continuous loop timer when "Repetição contínua" is active
  useEffect(() => {
    if (!isPlaying || !isLooping) return;
    const intervalMs = speed === 0.7 ? 5200 : speed === 1.4 ? 3200 : 4000;
    const timer = window.setInterval(() => {
      setReplayKey((k) => k + 1);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, isLooping, speed, item.gloss]);

  // Keyboard shortcuts: Escape to close, ArrowLeft/ArrowRight to browse gallery signs
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        onClose();
      } else if (ev.key === 'ArrowLeft' && canPrev) {
        onPrev();
      } else if (ev.key === 'ArrowRight' && canNext) {
        onNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, canPrev, canNext, onPrev, onNext]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-demo-modal-title"
      data-testid="sign-demo-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">
              Demonstração em vídeo 3D · {LEVEL_META[item.level].label} ·{' '}
              {item.curatedSign
                ? CATEGORY_LABELS[item.curatedSign.category]
                : KIND_LABELS[item.kind]}{' '}
              · <span className="font-mono text-slate-700">{item.gloss}</span>
            </p>
            <h2
              id="sign-demo-modal-title"
              data-testid="sign-demo-modal-title"
              className="mt-0.5 truncate text-lg sm:text-xl font-bold text-slate-900"
            >
              {label}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!canPrev}
              onClick={onPrev}
              aria-label="Sinal anterior da galeria"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={onNext}
              aria-label="Próximo sinal da galeria"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar demonstração"
              data-testid="sign-demo-modal-close"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            {/* Left (7 cols): Video-Style Demonstration Player */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-7">
              <div className="relative h-72 sm:h-88 bg-slate-50">
                <VLibrasPlayer
                  gloss={item.gloss}
                  isPlaying={isPlaying}
                  speed={speed}
                  avatar={avatar}
                  showSubtitles={true}
                  replayKey={replayKey}
                  title={`Demonstração do sinal ${label}`}
                />
              </div>

              {/* Transport Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    aria-label={isPlaying ? 'Pausar demonstração' : 'Reproduzir demonstração'}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {isPlaying ? 'Pausar' : 'Reproduzir'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(true);
                      setReplayKey((k) => k + 1);
                    }}
                    aria-label="Repetir demonstração"
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Repetir
                  </button>

                  <button
                    type="button"
                    aria-pressed={isLooping}
                    onClick={() => setIsLooping((l) => !l)}
                    className={`inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      isLooping
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Repeat className="h-3.5 w-3.5" />
                    Loop
                  </button>
                </div>

                {/* Speed Controls */}
                <div className="flex items-center gap-1" role="group" aria-label="Velocidade do vídeo">
                  {([0.7, 1, 1.4] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSpeed(spd)}
                      className={`min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-mono font-semibold tabular-nums transition-colors ${
                        speed === spd
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar Picker */}
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <span className="text-xs font-medium text-slate-600">Intérprete 3D:</span>
                <div className="inline-flex items-center gap-1" role="group" aria-label="Escolher avatar da demonstração">
                  {AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setAvatar(av.id)}
                      className={`min-h-[32px] rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                        avatar === av.id
                          ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {av.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right (5 cols): Phonological Details & Actions */}
            <div className="space-y-4 lg:col-span-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed text-slate-700">{sign.description}</p>
                <button
                  type="button"
                  onClick={() => onSpeak(item.word)}
                  aria-label={`Ouvir pronúncia de ${item.word}`}
                  className="inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 border-t border-slate-100 pt-3.5 text-xs">
                <div>
                  <dt className="text-slate-500">Configuração de mão</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{sign.handshape}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ponto de articulação</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{sign.location}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Movimento</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{sign.movement}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Expressão facial</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{sign.facialExpression}</dd>
                </div>
              </dl>

              <p className="rounded-xl bg-blue-50/70 p-3 text-xs leading-relaxed text-slate-700">
                <strong className="font-semibold text-blue-900">Observação: </strong>
                {sign.culturalNote}
              </p>

              <div className="flex flex-col gap-2 pt-1">
                {onPracticeSign && (
                  <button
                    type="button"
                    onClick={() => onPracticeSign(sign.id)}
                    className={`inline-flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      isPracticed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isPracticed ? 'Sinal já praticado' : 'Registrar prática (+15 XP)'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSendToTranslator(item.word.replace(/\s*\(.*\)$/, ''));
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors"
                >
                  Abrir no Tradutor VLibras
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
