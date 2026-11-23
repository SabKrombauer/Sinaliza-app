import { LIBRAS_SIGNS, STUDY_MODULES, type LibrasSign, type StudyLevelId } from '../data/librasSigns';

export interface UserStudyState {
  userName: string;
  completedModuleIds: string[];
  practicedSignIds: string[];
  studyDates: string[]; // YYYY-MM-DD local dates
  xp: number;
  xpByDate: Record<string, number>;
  dailyXpGoal: number;
}

export interface DailyGoalProgress {
  todayXp: number;
  dailyGoal: number;
  percentage: number;
  remainingXp: number;
  reached: boolean;
}

export interface XpChartPoint {
  dateStr: string;
  label: string;
  dayShort: string;
  dailyXp: number;
  cumulativeXp: number;
}

export interface UserLevelInfo {
  levelNumber: number;
  title: string;
  tierLabel: 'Iniciante' | 'Intermediário' | 'Avançado';
  currentLevelMinXp: number;
  nextLevelXp: number | null;
  progressPercentage: number;
}

export interface DayActivity {
  dateStr: string;
  dayShort: string;
  active: boolean;
  isToday: boolean;
}

export interface LevelProgress {
  level: StudyLevelId;
  completedModules: number;
  totalModules: number;
  percentage: number;
}

export function formatLocalDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Deterministic daily sign selection (excludes single-letter alphabet cards for richer daily learning).
 */
export function getWordOfTheDay(date = new Date()): LibrasSign {
  const nonAlphabet = LIBRAS_SIGNS.filter((s) => !s.isAlphabet);
  const pool = nonAlphabet.length > 0 ? nonAlphabet : LIBRAS_SIGNS;
  const dateStr = formatLocalDate(date);
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

/**
 * Calculates current consecutive-day study streak ending today or yesterday.
 */
export function calculateStreak(studyDates: string[], todayStr = formatLocalDate()): number {
  if (!studyDates.length) return 0;
  const uniqueSet = new Set(studyDates);

  const parseDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  let cursor = parseDate(todayStr);
  if (!uniqueSet.has(todayStr)) {
    // Allow streak to remain alive if user studied yesterday and hasn't studied today yet
    cursor.setDate(cursor.getDate() - 1);
    if (!uniqueSet.has(formatLocalDate(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (uniqueSet.has(formatLocalDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Returns the 7-day rolling window ending today for the streak visualizer.
 */
export function getWeeklyActivity(studyDates: string[], todayStr = formatLocalDate()): DayActivity[] {
  const uniqueSet = new Set(studyDates);
  const [y, m, d] = todayStr.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const days: DayActivity[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - offset);
    const ds = formatLocalDate(dt);
    days.push({
      dateStr: ds,
      dayShort: dayNames[dt.getDay()],
      active: uniqueSet.has(ds),
      isToday: ds === todayStr,
    });
  }
  return days;
}

export function calculateLevelProgress(completedModuleIds: string[]): LevelProgress[] {
  const completedSet = new Set(completedModuleIds);
  const levels: StudyLevelId[] = ['iniciante', 'intermediario', 'avancado'];

  return levels.map((level) => {
    const mods = STUDY_MODULES.filter((m) => m.level === level);
    const done = mods.filter((m) => completedSet.has(m.id)).length;
    const total = mods.length;
    return {
      level,
      completedModules: done,
      totalModules: total,
      percentage: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });
}

export function calculateOverallProgress(completedModuleIds: string[]): number {
  const total = STUDY_MODULES.length;
  if (total === 0) return 0;
  const completedSet = new Set(completedModuleIds);
  const done = STUDY_MODULES.filter((m) => completedSet.has(m.id)).length;
  return Math.round((done / total) * 100);
}

const LEVEL_TIERS: Array<{
  levelNumber: number;
  title: string;
  tierLabel: 'Iniciante' | 'Intermediário' | 'Avançado';
  minXp: number;
}> = [
  { levelNumber: 1, title: 'Nível 1 · Primeiros Sinais', tierLabel: 'Iniciante', minXp: 0 },
  { levelNumber: 2, title: 'Nível 2 · Comunicador Inicial', tierLabel: 'Iniciante', minXp: 80 },
  { levelNumber: 3, title: 'Nível 3 · Praticante Intermediário', tierLabel: 'Intermediário', minXp: 180 },
  { levelNumber: 4, title: 'Nível 4 · Fluência Cotidiana', tierLabel: 'Intermediário', minXp: 320 },
  { levelNumber: 5, title: 'Nível 5 · Intérprete Avançado', tierLabel: 'Avançado', minXp: 480 },
];

export function getUserLevelInfo(xp: number): UserLevelInfo {
  const safeXp = Math.max(0, Math.floor(xp));
  let currentIdx = 0;
  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    if (safeXp >= LEVEL_TIERS[i].minXp) {
      currentIdx = i;
    }
  }

  const current = LEVEL_TIERS[currentIdx];
  const next = LEVEL_TIERS[currentIdx + 1] || null;
  const progressPercentage = next
    ? Math.min(
        100,
        Math.round(((safeXp - current.minXp) / (next.minXp - current.minXp)) * 100)
      )
    : 100;

  return {
    levelNumber: current.levelNumber,
    title: current.title,
    tierLabel: current.tierLabel,
    currentLevelMinXp: current.minXp,
    nextLevelXp: next ? next.minXp : null,
    progressPercentage,
  };
}

export function sanitizeUserName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2) return null;
  return trimmed.slice(0, 40);
}

/**
 * Builds an ordered daily cumulative XP time-series ending on todayStr.
 * Handles both explicit xpByDate history and prior-window baseline XP.
 */
export function buildCumulativeXpSeries(
  xpByDate: Record<string, number>,
  totalXp: number,
  days = 7,
  todayStr = formatLocalDate()
): XpChartPoint[] {
  const safeDays = Math.max(2, Math.min(30, days));
  const [y, m, d] = todayStr.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const windowDates: Date[] = [];
  for (let offset = safeDays - 1; offset >= 0; offset--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - offset);
    windowDates.push(dt);
  }

  let windowSum = 0;
  for (const dt of windowDates) {
    const ds = formatLocalDate(dt);
    windowSum += Math.max(0, xpByDate[ds] || 0);
  }

  // Baseline XP accumulated before the selected window
  let runningTotal = Math.max(0, totalXp - windowSum);

  return windowDates.map((dt) => {
    const ds = formatLocalDate(dt);
    const dailyXp = Math.max(0, xpByDate[ds] || 0);
    runningTotal += dailyXp;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return {
      dateStr: ds,
      label: ds === todayStr ? 'Hoje' : `${dd}/${mm}`,
      dayShort: dayNames[dt.getDay()],
      dailyXp,
      cumulativeXp: runningTotal,
    };
  });
}

export const DAILY_XP_GOAL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 30, label: '30 XP/dia · Leve' },
  { value: 50, label: '50 XP/dia · Regular' },
  { value: 80, label: '80 XP/dia · Intensa' },
  { value: 120, label: '120 XP/dia · Imersão' },
];

export function sanitizeDailyXpGoal(rawGoal: number): number {
  const allowed = DAILY_XP_GOAL_OPTIONS.map((o) => o.value);
  if (allowed.includes(rawGoal)) return rawGoal;
  if (!Number.isFinite(rawGoal) || rawGoal <= 0) return 50;
  return Math.max(10, Math.min(500, Math.round(rawGoal)));
}

export function getDailyGoalProgress(
  xpByDate: Record<string, number>,
  dailyXpGoal: number,
  todayStr = formatLocalDate()
): DailyGoalProgress {
  const goal = sanitizeDailyXpGoal(dailyXpGoal);
  const todayXp = Math.max(0, xpByDate[todayStr] || 0);
  const percentage = Math.min(100, Math.round((todayXp / goal) * 100));
  const remainingXp = Math.max(0, goal - todayXp);

  return {
    todayXp,
    dailyGoal: goal,
    percentage,
    remainingXp,
    reached: todayXp >= goal,
  };
}
