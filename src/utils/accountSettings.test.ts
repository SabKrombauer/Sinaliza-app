import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APP_SETTINGS,
  mergeAppSettings,
  mergeStudyProgress,
  sanitizeAccountSyncPayload,
  sanitizeAppSettings,
} from './accountSettings';
import type { UserStudyState } from './gamification';

test('sanitizeAppSettings falls back cleanly on invalid input', () => {
  assert.deepEqual(sanitizeAppSettings(null), DEFAULT_APP_SETTINGS);
  assert.deepEqual(
    sanitizeAppSettings({
      defaultAvatar: 'invalid',
      defaultSpeed: 5,
    }),
    DEFAULT_APP_SETTINGS
  );
  assert.deepEqual(
    sanitizeAppSettings({
      defaultAvatar: 'hosana',
      defaultSpeed: 1.4,
    }),
    {
      defaultAvatar: 'hosana',
      defaultSpeed: 1.4,
    }
  );
});

test('sanitizeAccountSyncPayload enforces blueprint bounds and strips invalid keys', () => {
  const hugeSigns = Array.from({ length: 620 }, (_, i) => `sinal-${i}`);
  const state: UserStudyState = {
    userName: '   Ana   Maria   ',
    completedModuleIds: ['mod-1', 'mod-1', ''],
    practicedSignIds: hugeSigns,
    studyDates: ['2026-11-18', 'not-a-date', '2026-11-19'],
    xp: 120.7,
    xpByDate: { '2026-11-18': 40, bad: 99, '2026-11-19': 80 },
    dailyXpGoal: 80,
  };

  const payload = sanitizeAccountSyncPayload('uid-123', state, {
    defaultAvatar: 'guga',
    defaultSpeed: 0.7,
  });

  assert.equal(payload.ownerId, 'uid-123');
  assert.equal(payload.userName, 'Ana Maria');
  assert.equal(payload.xp, 120);
  assert.equal(payload.completedModuleIds.length, 1);
  assert.equal(payload.practicedSignIds.length, 500);
  assert.deepEqual(payload.studyDates, ['2026-11-18', '2026-11-19']);
  assert.deepEqual(payload.xpByDate, { '2026-11-18': 40, '2026-11-19': 80 });
  assert.equal(payload.settings.defaultAvatar, 'guga');
});

test('mergeStudyProgress combines local and remote history without data loss', () => {
  const local: UserStudyState = {
    userName: 'Estudante de Libras',
    completedModuleIds: ['mod-1'],
    practicedSignIds: ['ola'],
    studyDates: ['2026-11-19'],
    xp: 45,
    xpByDate: { '2026-11-19': 45 },
    dailyXpGoal: 50,
  };

  const remote: Partial<UserStudyState> = {
    userName: 'Carlos Silva',
    completedModuleIds: ['mod-2'],
    practicedSignIds: ['obrigado', 'ola'],
    studyDates: ['2026-11-18'],
    xp: 60,
    xpByDate: { '2026-11-18': 60, '2026-11-19': 15 },
    dailyXpGoal: 80,
  };

  const merged = mergeStudyProgress(local, remote, 'Carlos Google');
  assert.equal(merged.userName, 'Carlos Silva');
  assert.deepEqual(merged.completedModuleIds, ['mod-2', 'mod-1']);
  assert.deepEqual(merged.practicedSignIds, ['obrigado', 'ola']);
  assert.deepEqual(merged.studyDates, ['2026-11-18', '2026-11-19']);
  assert.equal(merged.xp, 105);
  assert.equal(merged.dailyXpGoal, 80);

  const settings = mergeAppSettings(DEFAULT_APP_SETTINGS, {
    defaultAvatar: 'hosana',
    defaultSpeed: 0.7,
  });
  assert.equal(settings.defaultAvatar, 'hosana');
});
