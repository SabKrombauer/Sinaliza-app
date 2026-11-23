import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Trophy, X } from 'lucide-react';
import { LIBRAS_SIGNS, type LibrasSign, type StudyModule } from '../data/librasSigns';
import { VLibrasPlayer } from './VLibrasPlayer';

interface LessonRunnerModalProps {
  module: StudyModule;
  customSigns?: LibrasSign[];
  onClose: () => void;
  onComplete: (moduleId: string, xpReward: number, signIds: string[]) => void;
}

export const LessonRunnerModal: React.FC<LessonRunnerModalProps> = ({
  module,
  customSigns,
  onClose,
  onComplete,
}) => {
  const signLookup = useMemo(() => {
    const map = new Map<string, LibrasSign>();
    for (const s of LIBRAS_SIGNS) map.set(s.id, s);
    if (customSigns) {
      for (const s of customSigns) map.set(s.id, s);
    }
    return map;
  }, [customSigns]);

  const signs = useMemo(
    () =>
      module.signIds
        .map((id) => signLookup.get(id))
        .filter((s): s is LibrasSign => Boolean(s)),
    [module.signIds, signLookup]
  );

  const [phase, setPhase] = useState<'learn' | 'quiz' | 'done'>('learn');
  const [signIdx, setSignIdx] = useState(0);
  const [quizIdx, setQuizIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const currentSign = signs[signIdx] || LIBRAS_SIGNS[0];
  const currentQuiz = module.quizzes[quizIdx];
  const quizTargetSign = currentQuiz?.targetSignId
    ? signLookup.get(currentQuiz.targetSignId) || null
    : null;

  const handleNextLearn = () => {
    if (signIdx < signs.length - 1) {
      setSignIdx((i) => i + 1);
    } else if (module.quizzes.length > 0) {
      setPhase('quiz');
      setQuizIdx(0);
    } else {
      finishLesson();
    }
  };

  const handleConfirmQuiz = () => {
    if (!selectedOption || !currentQuiz) return;
    if (selectedOption === currentQuiz.correctAnswer) {
      setCorrectCount((c) => c + 1);
    }
    setIsConfirmed(true);
  };

  const handleNextQuiz = () => {
    if (quizIdx < module.quizzes.length - 1) {
      setQuizIdx((i) => i + 1);
      setSelectedOption(null);
      setIsConfirmed(false);
    } else {
      finishLesson();
    }
  };

  const finishLesson = () => {
    setPhase('done');
    onComplete(module.id, module.xpReward, module.signIds);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-700">
              {phase === 'learn'
                ? `Estudo visual · Sinal ${signIdx + 1} de ${signs.length}`
                : phase === 'quiz'
                  ? `Prática · Questão ${quizIdx + 1} de ${module.quizzes.length}`
                  : 'Módulo concluído'}
            </p>
            <h2 id="lesson-modal-title" className="truncate text-lg font-bold text-slate-900">
              {module.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar lição"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100">
          <div
            className="h-full bg-blue-700 transition-all duration-300"
            style={{
              width:
                phase === 'done'
                  ? '100%'
                  : phase === 'learn'
                    ? `${Math.round(((signIdx + 1) / (signs.length + module.quizzes.length)) * 100)}%`
                    : `${Math.round(((signs.length + quizIdx + 1) / (signs.length + module.quizzes.length)) * 100)}%`,
            }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {phase === 'learn' && currentSign && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
              <div className="h-64 md:h-72 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 md:col-span-6">
                <VLibrasPlayer gloss={currentSign.gloss} title={`Sinal ${currentSign.word}`} />
              </div>

              <div className="space-y-4 md:col-span-6">
                <div>
                  <span className="text-xs font-mono text-slate-500">{currentSign.gloss}</span>
                  <h3 className="text-2xl font-bold text-slate-900">{currentSign.word}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {currentSign.description}
                  </p>
                </div>

                <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Mão:</dt>
                    <dd className="font-medium text-slate-900 text-right">{currentSign.handshape}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Local:</dt>
                    <dd className="font-medium text-slate-900 text-right">{currentSign.location}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Expressão:</dt>
                    <dd className="font-medium text-slate-900 text-right">{currentSign.facialExpression}</dd>
                  </div>
                </dl>

                <p className="rounded-xl bg-blue-50/70 p-3 text-xs leading-relaxed text-slate-700">
                  <strong className="font-semibold text-blue-900">Dica cultural: </strong>
                  {currentSign.culturalNote}
                </p>
              </div>
            </div>
          )}

          {phase === 'quiz' && currentQuiz && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:items-start">
                {quizTargetSign && (
                  <div className="h-56 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 md:col-span-5">
                    <VLibrasPlayer
                      gloss={quizTargetSign.gloss}
                      title={`Questão: ${quizTargetSign.word}`}
                    />
                  </div>
                )}

                <div className={quizTargetSign ? 'md:col-span-7 space-y-4' : 'md:col-span-12 space-y-4'}>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {currentQuiz.prompt}
                  </h3>

                  <div className="space-y-2.5" role="radiogroup" aria-label="Alternativas da questão">
                    {currentQuiz.options.map((option) => {
                      const isSelected = selectedOption === option;
                      const isCorrect = option === currentQuiz.correctAnswer;
                      let btnStyle = 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
                      if (isConfirmed) {
                        if (isCorrect) {
                          btnStyle = 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold';
                        } else if (isSelected) {
                          btnStyle = 'border-rose-500 bg-rose-50 text-rose-900';
                        }
                      } else if (isSelected) {
                        btnStyle = 'border-blue-700 bg-blue-50 text-blue-900 font-semibold';
                      }

                      return (
                        <button
                          key={option}
                          type="button"
                          disabled={isConfirmed}
                          onClick={() => setSelectedOption(option)}
                          className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${btnStyle}`}
                        >
                          <span>{option}</span>
                          {isConfirmed && isCorrect && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {isConfirmed && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                      <strong className="font-semibold text-slate-900">
                        {selectedOption === currentQuiz.correctAnswer
                          ? 'Correto! '
                          : 'Explicação: '}
                      </strong>
                      {currentQuiz.explanation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Trophy className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Lição concluída com sucesso!
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Você praticou {signs.length} sinais e acertou {correctCount} de {module.quizzes.length} questões.
                </p>
              </div>
              <div className="mx-auto flex max-w-sm justify-center gap-6 border-y border-slate-100 py-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Recompensa</p>
                  <p className="font-bold font-mono tabular-nums text-blue-700">
                    +{module.xpReward} XP
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Frequência</p>
                  <p className="font-bold text-slate-900">Dia registrado</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/70">
          {phase === 'learn' && (
            <>
              <button
                type="button"
                disabled={signIdx === 0}
                onClick={() => setSignIdx((i) => Math.max(0, i - 1))}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                type="button"
                onClick={handleNextLearn}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                {signIdx < signs.length - 1 ? 'Próximo sinal' : 'Ir para o quiz'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {phase === 'quiz' && (
            <>
              <span className="text-xs text-slate-500">{module.grammarTip}</span>
              {!isConfirmed ? (
                <button
                  type="button"
                  disabled={!selectedOption}
                  onClick={handleConfirmQuiz}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Confirmar resposta
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextQuiz}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
                >
                  {quizIdx < module.quizzes.length - 1 ? 'Próxima questão' : 'Concluir lição'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </>
          )}

          {phase === 'done' && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-700 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Voltar para Área de Estudos
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
