import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWordOfTheDay,
  calculateStreak,
  getWeeklyActivity,
  calculateLevelProgress,
  calculateOverallProgress,
  getUserLevelInfo,
  sanitizeUserName,
  buildCumulativeXpSeries,
  sanitizeDailyXpGoal,
  getDailyGoalProgress,
} from './gamification';

test('getWordOfTheDay returns deterministic non-alphabet sign per calendar date', () => {
  const d1 = new Date(2026, 10, 19);
  const d2 = new Date(2026, 10, 19);
  const sign1 = getWordOfTheDay(d1);
  const sign2 = getWordOfTheDay(d2);
  assert.equal(sign1.id, sign2.id);
  assert.notEqual(sign1.isAlphabet, true);
});

test('calculateStreak counts consecutive days ending today or yesterday', () => {
  assert.equal(calculateStreak([], '2026-11-19'), 0);
  assert.equal(calculateStreak(['2026-11-17', '2026-11-18', '2026-11-19'], '2026-11-19'), 3);
  // Alive from yesterday
  assert.equal(calculateStreak(['2026-11-17', '2026-11-18'], '2026-11-19'), 2);
  // Broken gap
  assert.equal(calculateStreak(['2026-11-15', '2026-11-19'], '2026-11-19'), 1);
});

test('getWeeklyActivity returns 7 days with active flags', () => {
  const week = getWeeklyActivity(['2026-11-18', '2026-11-19'], '2026-11-19');
  assert.equal(week.length, 7);
  assert.equal(week[6].isToday, true);
  assert.equal(week[6].active, true);
  assert.equal(week[5].active, true);
  assert.equal(week[4].active, false);
});

test('calculateLevelProgress and calculateOverallProgress compute mastery percentages', () => {
  const levels = calculateLevelProgress(['mod-alfabeto', 'mod-numeros']);
  const beginner = levels.find((l) => l.level === 'iniciante')!;
  assert.equal(beginner.completedModules, 2);
  assert.equal(beginner.totalModules, 4);
  assert.equal(beginner.percentage, 50);
  assert.ok(calculateOverallProgress(['mod-alfabeto', 'mod-numeros']) > 0);
});

test('getUserLevelInfo computes current level, tier, and next threshold', () => {
  const lvl1 = getUserLevelInfo(25);
  assert.equal(lvl1.levelNumber, 1);
  assert.equal(lvl1.tierLabel, 'Iniciante');
  assert.equal(lvl1.nextLevelXp, 80);

  const lvl3 = getUserLevelInfo(200);
  assert.equal(lvl3.levelNumber, 3);
  assert.equal(lvl3.tierLabel, 'Intermediário');

  const maxLvl = getUserLevelInfo(600);
  assert.equal(maxLvl.levelNumber, 5);
  assert.equal(maxLvl.nextLevelXp, null);
  assert.equal(maxLvl.progressPercentage, 100);
});

test('sanitizeUserName validates and normalizes student names', () => {
  assert.equal(sanitizeUserName('   '), null);
  assert.equal(sanitizeUserName('A'), null);
  assert.equal(sanitizeUserName('  Marina   Silva  '), 'Marina Silva');
  assert.equal(sanitizeUserName('X'.repeat(55))?.length, 40);
});

test('buildCumulativeXpSeries accumulates daily XP and preserves pre-window baseline', () => {
  const series = buildCumulativeXpSeries(
    {
      '2026-11-01': 30, // prior to 7-day window ending 2026-11-19
      '2026-11-17': 25,
      '2026-11-19': 40,
    },
    95,
    7,
    '2026-11-19'
  );
  assert.equal(series.length, 7);
  assert.equal(series[0].cumulativeXp, 30);
  assert.equal(series[4].dateStr, '2026-11-17');
  assert.equal(series[4].dailyXp, 25);
  assert.equal(series[4].cumulativeXp, 55);
  assert.equal(series[6].label, 'Hoje');
  assert.equal(series[6].dailyXp, 40);
  assert.equal(series[6].cumulativeXp, 95);
});

test('sanitizeDailyXpGoal and getDailyGoalProgress compute goal progress and completion', () => {
  assert.equal(sanitizeDailyXpGoal(50), 50);
  assert.equal(sanitizeDailyXpGoal(120), 120);
  assert.equal(sanitizeDailyXpGoal(-10), 50);

  const partial = getDailyGoalProgress({ '2026-11-19': 25 }, 50, '2026-11-19');
  assert.equal(partial.todayXp, 25);
  assert.equal(partial.percentage, 50);
  assert.equal(partial.remainingXp, 25);
  assert.equal(partial.reached, false);

  const reached = getDailyGoalProgress({ '2026-11-19': 95 }, 80, '2026-11-19');
  assert.equal(reached.percentage, 100);
  assert.equal(reached.remainingXp, 0);
  assert.equal(reached.reached, true);
});
