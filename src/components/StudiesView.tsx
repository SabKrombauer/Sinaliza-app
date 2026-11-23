import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Flame, Play, Search, Shuffle, Sparkles, Target } from 'lucide-react';
import {
  LEVEL_META,
  STUDY_MODULES,
  type LibrasSign,
  type StudyLevelId,
  type StudyModule,
} from '../data/librasSigns';
import {
  DAILY_XP_GOAL_OPTIONS,
  type DailyGoalProgress,
  type DayActivity,
  type LevelProgress,
  type UserLevelInfo,
} from '../utils/gamification';
import { LessonRunnerModal } from './LessonRunnerModal';
import { UserProfileCard } from './UserProfileCard';
import { VLibrasPlayer } from './VLibrasPlayer';
import { XpProgressChart } from './XpProgressChart';

interface StudiesViewProps {
  userName: string;
  userLevelInfo: UserLevelInfo;
  wordOfTheDay: LibrasSign;
  isWordOfDayPracticed: boolean;
  practicedSignIds: string[];
  streak: number;
  xp: number;
  xpByDate: Record<string, number>;
  weeklyActivity: DayActivity[];
  levelProgress: LevelProgress[];
  overallProgress: number;
  dailyGoalProgress: DailyGoalProgress;
  completedModuleIds: string[];
  onUpdateUserName: (nextName: string) => boolean;
  onUpdateDailyXpGoal: (nextGoal: number) => void;
  onPracticeWordOfDay: (signId: string) => void;
  onCompleteModule: (moduleId: string, xpReward: number, signIds: string[]) => void;
  onTranslateWord: (word: string) => void;
}

interface ActiveLessonSession {
  module: StudyModule;
  customSigns?: LibrasSign[];
}

export const StudiesView: React.FC<StudiesViewProps> = ({
  userName,
  userLevelInfo,
  wordOfTheDay,
  isWordOfDayPracticed,
  practicedSignIds,
  streak,
  xp,
  xpByDate,
  weeklyActivity,
  levelProgress,
  overallProgress,
  dailyGoalProgress,
  completedModuleIds,
  onUpdateUserName,
  onUpdateDailyXpGoal,
  onPracticeWordOfDay,
  onCompleteModule,
  onTranslateWord,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<'all' | StudyLevelId>('all');
  const [activeSession, setActiveSession] = useState<ActiveLessonSession | null>(null);
  const [catalogCount, setCatalogCount] = useState<number>(0);
  const [dailySign, setDailySign] = useState<LibrasSign>(wordOfTheDay);

  // Dynamic VLibras catalog practice builder state
  const [deckTopic, setDeckTopic] = useState('');
  const [deckLevel, setDeckLevel] = useState<StudyLevelId>('iniciante');
  const [isGeneratingDeck, setIsGeneratingDeck] = useState(false);
  const [deckError, setDeckError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadDailyVlibrasSign() {
      try {
        const res = await fetch('/api/vlibras/word-of-the-day');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          totalCatalogCount?: number;
          sign?: LibrasSign;
        };
        if (!cancelled) {
          if (typeof data.totalCatalogCount === 'number' && data.totalCatalogCount > 0) {
            setCatalogCount(data.totalCatalogCount);
          }
          if (data.sign) {
            setDailySign(data.sign);
          }
        }
      } catch {
        // Keep deterministic local wordOfTheDay cleanly
      }
    }
    void loadDailyVlibrasSign();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartDynamicDeck = async (level: StudyLevelId, topic = '') => {
    setIsGeneratingDeck(true);
    setDeckError(null);
    try {
      const seed = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const params = new URLSearchParams({
        level,
        topic: topic.trim(),
        seed,
        count: '5',
      });
      const res = await fetch(`/api/vlibras/study-deck?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao carregar lição');
      const data = (await res.json()) as {
        totalCatalogCount?: number;
        module: StudyModule;
        signs: LibrasSign[];
      };
      if (typeof data.totalCatalogCount === 'number' && data.totalCatalogCount > 0) {
        setCatalogCount(data.totalCatalogCount);
      }
      setActiveSession({
        module: data.module,
        customSigns: data.signs,
      });
    } catch {
      setDeckError('Não foi possível montar a prática dinâmica do acervo VLibras agora.');
    } finally {
      setIsGeneratingDeck(false);
    }
  };

  const isDailyPracticed =
    practicedSignIds.includes(dailySign.id) ||
    (dailySign.id === wordOfTheDay.id && isWordOfDayPracticed);

  const levelsToRender: StudyLevelId[] =
    selectedLevel === 'all' ? ['iniciante', 'intermediario', 'avancado'] : [selectedLevel];

  return (
    <section aria-labelledby="studies-heading" className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-blue-700">
            Área de Estudos · Trilha Gamificada
            {catalogCount > 0
              ? ` · ${catalogCount.toLocaleString('pt-BR')} sinais VLibras disponíveis`
              : ''}
          </p>
          <h1
            id="studies-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]"
          >
            Aprenda Libras passo a passo, do básico ao avançado
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Pratique um novo sinal todos os dias, gere desafios com todo o dicionário oficial do VLibras e acompanhe seu progresso por nível.
          </p>
        </div>
      </div>

      {/* Student Profile Summary */}
      <UserProfileCard
        userName={userName}
        xp={xp}
        levelInfo={userLevelInfo}
        onSaveName={onUpdateUserName}
      />

      {/* Gamification Row: Palavra do Dia + Sequência & Progresso */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Palavra do Dia (7 cols) */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-7">
          <div className="grid grid-cols-1 sm:grid-cols-12 flex-1">
            <div className="relative h-64 sm:h-auto sm:min-h-[260px] sm:col-span-5 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-100">
              {!activeSession ? (
                <VLibrasPlayer
                  gloss={dailySign.gloss}
                  title={`Palavra do dia: ${dailySign.word}`}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-xs text-slate-500">
                  Player pausado durante a lição
                </div>
              )}
            </div>
            <div className="flex flex-col justify-between p-5 sm:col-span-7">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-amber-700 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    Palavra do dia
                  </span>
                  <span className="font-mono">
                    {LEVEL_META[dailySign.level].label} · {dailySign.gloss}
                  </span>
                </div>

                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {dailySign.word}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {dailySign.description}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {dailySign.culturalNote}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onPracticeWordOfDay(dailySign.id)}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                    isDailyPracticed
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-blue-700 text-white hover:bg-blue-800'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isDailyPracticed ? 'Praticada hoje' : 'Praticar Palavra do Dia'}
                </button>
                <button
                  type="button"
                  onClick={() => onTranslateWord(dailySign.word.replace(/\s*\(.*\)$/, ''))}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  Ver no Tradutor
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sequência de Estudos & Progresso (5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Sequência de estudos</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    data-testid="study-streak-value"
                    className="text-3xl font-bold font-mono tabular-nums text-slate-900"
                  >
                    {streak}
                  </span>
                  <span className="text-sm font-medium text-slate-600">
                    {streak === 1 ? 'dia consecutivo' : 'dias consecutivos'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-amber-700">
                <Flame className="h-5 w-5 text-amber-600" />
                <span className="text-base font-bold font-mono tabular-nums">{xp} XP</span>
              </div>
            </div>

            {/* 7-day Streak Grid */}
            <div>
              <p className="text-xs text-slate-500 mb-2">Últimos 7 dias</p>
              <div className="grid grid-cols-7 gap-1.5">
                {weeklyActivity.map((day) => (
                  <div
                    key={day.dateStr}
                    className={`flex flex-col items-center justify-center rounded-xl border py-2 text-xs ${
                      day.active
                        ? 'border-blue-200 bg-blue-50 text-blue-800 font-semibold'
                        : day.isToday
                          ? 'border-slate-300 bg-slate-50 text-slate-700'
                          : 'border-slate-100 bg-white text-slate-400'
                    }`}
                  >
                    <span className="text-[11px]">{day.dayShort}</span>
                    <span className="mt-1 text-xs">{day.active ? '●' : '○'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Daily XP Goal Selector & Visual Progress */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label
                htmlFor="daily-xp-goal-select"
                className="text-xs font-medium text-slate-700 flex items-center gap-1.5"
              >
                <Target className="h-4 w-4 text-blue-700" />
                Meta diária de XP
              </label>
              <select
                id="daily-xp-goal-select"
                aria-label="Definir meta diária de XP"
                value={dailyGoalProgress.dailyGoal}
                onChange={(e) => onUpdateDailyXpGoal(Number(e.target.value))}
                className="min-h-[36px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                {DAILY_XP_GOAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs mb-1.5">
              <span
                data-testid="daily-goal-status"
                className={`font-medium flex items-center gap-1 ${
                  dailyGoalProgress.reached ? 'text-emerald-700' : 'text-slate-600'
                }`}
              >
                {dailyGoalProgress.reached ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Meta diária atingida!
                  </>
                ) : (
                  `Faltam ${dailyGoalProgress.remainingXp} XP hoje`
                )}
              </span>
              <span
                data-testid="daily-goal-values"
                className="font-mono font-semibold tabular-nums text-slate-900"
              >
                {dailyGoalProgress.todayXp}/{dailyGoalProgress.dailyGoal} XP ({dailyGoalProgress.percentage}%)
              </span>
            </div>

            <div
              role="progressbar"
              aria-label="Progresso da meta diária de XP"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={dailyGoalProgress.percentage}
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
            >
              <div
                data-testid="daily-goal-progress-bar"
                className={`h-full transition-all duration-300 ${
                  dailyGoalProgress.reached ? 'bg-emerald-600' : 'bg-blue-700'
                }`}
                style={{ width: `${dailyGoalProgress.percentage}%` }}
              />
            </div>
          </div>

          {/* Overall Learning Progress */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-blue-700" />
                Progresso de aprendizagem
              </span>
              <span
                data-testid="overall-progress-pct"
                className="font-mono font-semibold tabular-nums text-slate-900"
              >
                {overallProgress}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-700 transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {completedModuleIds.length} de {STUDY_MODULES.length} módulos ·{' '}
              {practicedSignIds.length} {practicedSignIds.length === 1 ? 'sinal praticado' : 'sinais praticados'}
            </p>
          </div>
        </div>
      </div>

      {/* Cumulative XP Learning Curve (Recharts) */}
      <XpProgressChart xpByDate={xpByDate} totalXp={xp} />

      {/* Dynamic Practice Generator over the Full 23,403-Sign VLibras Catalog */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-medium text-blue-700">
              Prática Dinâmica · Acervo Completo VLibras
              {catalogCount > 0 ? ` (${catalogCount.toLocaleString('pt-BR')} sinais)` : ''}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Gerar lição e quiz com todo o dicionário do VLibras
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Escolha um tema específico (ex.: escola, saúde, música, comida) ou um nível de dificuldade para praticar sinais reais sorteados do catálogo oficial com quiz visual em 3D.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleStartDynamicDeck(deckLevel, deckTopic);
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                aria-label="Tema opcional para prática no acervo VLibras"
                value={deckTopic}
                onChange={(e) => setDeckTopic(e.target.value)}
                placeholder="Tema (ex.: escola, saúde)..."
                className="min-h-[44px] w-full sm:w-52 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <select
              aria-label="Nível da prática dinâmica"
              value={deckLevel}
              onChange={(e) => setDeckLevel(e.target.value as StudyLevelId)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>

            <button
              type="submit"
              disabled={isGeneratingDeck}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Shuffle className="h-4 w-4" />
              {isGeneratingDeck ? 'Montando lição...' : 'Praticar do VLibras'}
            </button>
          </form>
        </div>

        {deckError && (
          <p className="mt-3 text-xs font-medium text-rose-700">{deckError}</p>
        )}
      </div>

      {/* Level Filter Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div
          className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1"
          role="tablist"
          aria-label="Filtrar módulos por nível"
        >
          {(
            [
              { id: 'all', label: 'Todos os níveis' },
              { id: 'iniciante', label: 'Iniciante' },
              { id: 'intermediario', label: 'Intermediário' },
              { id: 'avancado', label: 'Avançado' },
            ] as const
          ).map((tab) => {
            const active = selectedLevel === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedLevel(tab.id)}
                className={`min-h-[40px] rounded-lg px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Study Phases by Level */}
      <div className="space-y-10">
        {levelsToRender.map((lvlId) => {
          const meta = LEVEL_META[lvlId];
          const lvlProg = levelProgress.find((p) => p.level === lvlId);
          const modules = STUDY_MODULES.filter((m) => m.level === lvlId);

          return (
            <div key={lvlId} className="space-y-4">
              {/* Level Banner */}
              <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-12 md:items-stretch">
                <div className="relative h-44 md:h-auto md:col-span-4 bg-slate-100">
                  <img
                    src={meta.image}
                    alt={`Ilustração do ${meta.label} em Libras`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-between p-5 md:col-span-8">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>Fase de aprendizado</span>
                      <span className="font-mono tabular-nums font-medium text-slate-700">
                        {lvlProg?.completedModules ?? 0}/{lvlProg?.totalModules ?? modules.length} concluídos ({lvlProg?.percentage ?? 0}%)
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">{meta.label}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{meta.longDesc}</p>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${lvlProg?.percentage ?? 0}%`,
                          backgroundColor: meta.accentColor,
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isGeneratingDeck}
                      onClick={() => void handleStartDynamicDeck(lvlId)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                    >
                      <Shuffle className="h-3.5 w-3.5 text-blue-700" />
                      Desafio do acervo VLibras
                    </button>
                  </div>
                </div>
              </div>

              {/* Modules Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {modules.map((mod) => {
                  const isCompleted = completedModuleIds.includes(mod.id);
                  return (
                    <div
                      key={mod.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span>
                            {mod.durationMinutes} min · {mod.signIds.length} sinais · +{mod.xpReward} XP
                          </span>
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Concluído
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 text-base font-bold text-slate-900">{mod.title}</h4>
                        <p className="mt-1 text-sm text-slate-600">{mod.subtitle}</p>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
                        <span className="text-xs text-slate-500">
                          {mod.quizzes.length} {mod.quizzes.length === 1 ? 'exercício' : 'exercícios'} práticos
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveSession({ module: mod })}
                          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                            isCompleted
                              ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                              : 'bg-blue-700 text-white hover:bg-blue-800'
                          }`}
                        >
                          <Play className="h-3.5 w-3.5" />
                          {isCompleted ? 'Revisar lição' : 'Iniciar lição'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Lesson Runner Modal */}
      {activeSession && (
        <LessonRunnerModal
          module={activeSession.module}
          customSigns={activeSession.customSigns}
          onClose={() => setActiveSession(null)}
          onComplete={onCompleteModule}
        />
      )}
    </section>
  );
};
