import { useCallback, useEffect, useState } from 'react';
import {
  calculateLevelProgress,
  calculateOverallProgress,
  calculateStreak,
  formatLocalDate,
  getDailyGoalProgress,
  getUserLevelInfo,
  getWeeklyActivity,
  getWordOfTheDay,
  sanitizeDailyXpGoal,
  sanitizeUserName,
  type UserStudyState,
} from '../utils/gamification';

const STORAGE_KEY = 'sinaliza_libras_progress_v1';
const DEFAULT_USER_NAME = 'Estudante de Libras';

function buildSeedState(): UserStudyState {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  return {
    userName: DEFAULT_USER_NAME,
    completedModuleIds: [],
    practicedSignIds: [],
    studyDates: [yesterdayStr],
    xp: 25,
    xpByDate: { [yesterdayStr]: 25 },
    dailyXpGoal: 50,
  };
}

function loadState(): UserStudyState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildSeedState();
    const parsed = JSON.parse(raw) as Partial<UserStudyState>;
    const studyDates = Array.isArray(parsed.studyDates) ? parsed.studyDates : [];
    const xp = typeof parsed.xp === 'number' ? parsed.xp : 0;

    let xpByDate: Record<string, number> = {};
    if (parsed.xpByDate && typeof parsed.xpByDate === 'object' && !Array.isArray(parsed.xpByDate)) {
      xpByDate = parsed.xpByDate as Record<string, number>;
    } else if (xp > 0) {
      const anchorDate = studyDates[studyDates.length - 1] || formatLocalDate(new Date());
      xpByDate = { [anchorDate]: xp };
    }

    return {
      userName:
        typeof parsed.userName === 'string' && sanitizeUserName(parsed.userName)
          ? sanitizeUserName(parsed.userName)!
          : DEFAULT_USER_NAME,
      completedModuleIds: Array.isArray(parsed.completedModuleIds) ? parsed.completedModuleIds : [],
      practicedSignIds: Array.isArray(parsed.practicedSignIds) ? parsed.practicedSignIds : [],
      studyDates,
      xp,
      xpByDate,
      dailyXpGoal:
        typeof parsed.dailyXpGoal === 'number'
          ? sanitizeDailyXpGoal(parsed.dailyXpGoal)
          : 50,
    };
  } catch {
    return buildSeedState();
  }
}

export function useStudyProgress() {
  const [state, setState] = useState<UserStudyState>(() => loadState());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const updateUserName = useCallback((rawName: string): boolean => {
    const clean = sanitizeUserName(rawName);
    if (!clean) return false;
    setState((prev) => ({
      ...prev,
      userName: clean,
    }));
    return true;
  }, []);

  const recordActivityToday = useCallback((signId?: string, bonusXp = 15) => {
    const todayStr = formatLocalDate(new Date());
    setState((prev) => {
      const nextDates = prev.studyDates.includes(todayStr)
        ? prev.studyDates
        : [...prev.studyDates, todayStr];
      const nextSigns =
        signId && !prev.practicedSignIds.includes(signId)
          ? [...prev.practicedSignIds, signId]
          : prev.practicedSignIds;
      const xpGain = signId && prev.practicedSignIds.includes(signId) ? 0 : bonusXp;
      const nextXpByDate =
        xpGain > 0
          ? { ...prev.xpByDate, [todayStr]: (prev.xpByDate[todayStr] || 0) + xpGain }
          : prev.xpByDate;

      return {
        ...prev,
        studyDates: nextDates,
        practicedSignIds: nextSigns,
        xp: prev.xp + xpGain,
        xpByDate: nextXpByDate,
      };
    });
  }, []);

  const completeModule = useCallback((moduleId: string, xpReward: number, signIds: string[]) => {
    const todayStr = formatLocalDate(new Date());
    setState((prev) => {
      const alreadyDone = prev.completedModuleIds.includes(moduleId);
      const nextModules = alreadyDone
        ? prev.completedModuleIds
        : [...prev.completedModuleIds, moduleId];
      const nextDates = prev.studyDates.includes(todayStr)
        ? prev.studyDates
        : [...prev.studyDates, todayStr];
      const nextSigns = Array.from(new Set([...prev.practicedSignIds, ...signIds]));
      const xpGain = alreadyDone ? 10 : xpReward;

      return {
        ...prev,
        completedModuleIds: nextModules,
        practicedSignIds: nextSigns,
        studyDates: nextDates,
        xp: prev.xp + xpGain,
        xpByDate: {
          ...prev.xpByDate,
          [todayStr]: (prev.xpByDate[todayStr] || 0) + xpGain,
        },
      };
    });
  }, []);

  const updateDailyXpGoal = useCallback((nextGoal: number) => {
    const cleanGoal = sanitizeDailyXpGoal(nextGoal);
    setState((prev) => ({
      ...prev,
      dailyXpGoal: cleanGoal,
    }));
  }, []);

  const hydrateState = useCallback((nextState: UserStudyState) => {
    setState(nextState);
  }, []);

  const resetProgress = useCallback(() => {
    setState((prev) => ({
      userName: prev.userName,
      completedModuleIds: [],
      practicedSignIds: [],
      studyDates: [],
      xp: 0,
      xpByDate: {},
      dailyXpGoal: prev.dailyXpGoal,
    }));
  }, []);

  const wordOfTheDay = getWordOfTheDay(new Date());
  const todayStr = formatLocalDate(new Date());
  const streak = calculateStreak(state.studyDates, todayStr);
  const weeklyActivity = getWeeklyActivity(state.studyDates, todayStr);
  const levelProgress = calculateLevelProgress(state.completedModuleIds);
  const overallProgress = calculateOverallProgress(state.completedModuleIds);
  const userLevelInfo = getUserLevelInfo(state.xp);
  const dailyGoalProgress = getDailyGoalProgress(state.xpByDate, state.dailyXpGoal, todayStr);
  const isWordOfDayPracticed = state.practicedSignIds.includes(wordOfTheDay.id);

  return {
    state,
    wordOfTheDay,
    streak,
    weeklyActivity,
    levelProgress,
    overallProgress,
    userLevelInfo,
    dailyGoalProgress,
    isWordOfDayPracticed,
    updateUserName,
    updateDailyXpGoal,
    hydrateState,
    resetProgress,
    recordActivityToday,
    completeModule,
  };
}
