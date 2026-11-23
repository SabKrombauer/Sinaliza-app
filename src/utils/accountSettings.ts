import {
  formatLocalDate,
  sanitizeDailyXpGoal,
  sanitizeUserName,
  type UserStudyState,
} from './gamification';

export type AvatarPreference = 'icaro' | 'hosana' | 'guga';
export type SpeedPreference = 0.7 | 1 | 1.4;

export interface AppSettings {
  defaultAvatar: AvatarPreference;
  defaultSpeed: SpeedPreference;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultAvatar: 'icaro',
  defaultSpeed: 1,
};

export interface SyncedUserAccountPayload {
  ownerId: string;
  userName: string;
  xp: number;
  dailyXpGoal: number;
  completedModuleIds: string[];
  practicedSignIds: string[];
  studyDates: string[];
  xpByDate: Record<string, number>;
  settings: AppSettings;
}

const VALID_AVATARS: AvatarPreference[] = ['icaro', 'hosana', 'guga'];
const VALID_SPEEDS: SpeedPreference[] = [0.7, 1, 1.4];
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeAppSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_APP_SETTINGS };
  }
  const obj = raw as Partial<AppSettings>;
  const defaultAvatar = VALID_AVATARS.includes(obj.defaultAvatar as AvatarPreference)
    ? (obj.defaultAvatar as AvatarPreference)
    : DEFAULT_APP_SETTINGS.defaultAvatar;
  const defaultSpeed = VALID_SPEEDS.includes(obj.defaultSpeed as SpeedPreference)
    ? (obj.defaultSpeed as SpeedPreference)
    : DEFAULT_APP_SETTINGS.defaultSpeed;

  return {
    defaultAvatar,
    defaultSpeed,
  };
}

function sanitizeStringArray(arr: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  const unique = new Set<string>();
  for (const item of arr) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.length > 0 && trimmed.length <= maxLen) {
        unique.add(trimmed);
      }
    }
  }
  const list = Array.from(unique);
  return list.length > maxItems ? list.slice(list.length - maxItems) : list;
}

function sanitizeXpByDate(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([k, v]) => DATE_KEY_RE.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const bounded = entries.length > 366 ? entries.slice(entries.length - 366) : entries;
  const clean: Record<string, number> = {};
  for (const [k, v] of bounded) {
    clean[k] = Math.min(100000, Math.floor(v as number));
  }
  return clean;
}

export function sanitizeAccountSyncPayload(
  uid: string,
  studyState: UserStudyState,
  settings: AppSettings
): SyncedUserAccountPayload {
  const cleanName = sanitizeUserName(studyState.userName) || 'Estudante de Libras';
  const cleanXp = Math.max(0, Math.min(1000000, Math.floor(studyState.xp || 0)));
  const cleanGoal = sanitizeDailyXpGoal(studyState.dailyXpGoal);
  const completedModuleIds = sanitizeStringArray(studyState.completedModuleIds, 100, 64);
  const practicedSignIds = sanitizeStringArray(studyState.practicedSignIds, 500, 80);
  const studyDates = sanitizeStringArray(studyState.studyDates, 366, 10).filter((d) =>
    DATE_KEY_RE.test(d)
  );
  const xpByDate = sanitizeXpByDate(studyState.xpByDate);

  return {
    ownerId: uid,
    userName: cleanName,
    xp: cleanXp,
    dailyXpGoal: cleanGoal,
    completedModuleIds,
    practicedSignIds,
    studyDates,
    xpByDate,
    settings: sanitizeAppSettings(settings),
  };
}

export function mergeStudyProgress(
  local: UserStudyState,
  remote: Partial<UserStudyState> | null,
  googleDisplayName?: string | null
): UserStudyState {
  if (!remote) {
    const cleanGoogleName = googleDisplayName ? sanitizeUserName(googleDisplayName) : null;
    const resolvedName =
      local.userName === 'Estudante de Libras' && cleanGoogleName
        ? cleanGoogleName
        : sanitizeUserName(local.userName) || 'Estudante de Libras';
    return {
      ...local,
      userName: resolvedName,
    };
  }

  const completedModuleIds = sanitizeStringArray(
    [...(remote.completedModuleIds || []), ...local.completedModuleIds],
    100,
    64
  );
  const practicedSignIds = sanitizeStringArray(
    [...(remote.practicedSignIds || []), ...local.practicedSignIds],
    500,
    80
  );
  const studyDates = sanitizeStringArray(
    [...(remote.studyDates || []), ...local.studyDates],
    366,
    10
  )
    .filter((d) => DATE_KEY_RE.test(d))
    .sort();

  const localXpMap = sanitizeXpByDate(local.xpByDate);
  const remoteXpMap = sanitizeXpByDate(remote.xpByDate);
  const mergedXpByDate: Record<string, number> = { ...remoteXpMap };
  for (const [dateKey, val] of Object.entries(localXpMap)) {
    mergedXpByDate[dateKey] = Math.max(mergedXpByDate[dateKey] || 0, val);
  }

  // Ensure today's date stays valid if local had activity
  const todayStr = formatLocalDate(new Date());
  if (localXpMap[todayStr] && !studyDates.includes(todayStr) && studyDates.length < 366) {
    studyDates.push(todayStr);
    studyDates.sort();
  }

  const remoteXp = typeof remote.xp === 'number' ? Math.max(0, Math.floor(remote.xp)) : 0;
  const localXp = Math.max(0, Math.floor(local.xp || 0));
  const mapSum = Object.values(mergedXpByDate).reduce((acc, v) => acc + v, 0);
  const xp = Math.min(1000000, Math.max(localXp, remoteXp, mapSum));

  const remoteName = typeof remote.userName === 'string' ? sanitizeUserName(remote.userName) : null;
  const localName = sanitizeUserName(local.userName);
  const googleName = googleDisplayName ? sanitizeUserName(googleDisplayName) : null;

  const userName =
    remoteName && remoteName !== 'Estudante de Libras'
      ? remoteName
      : localName && localName !== 'Estudante de Libras'
        ? localName
        : googleName || remoteName || localName || 'Estudante de Libras';

  const dailyXpGoal =
    typeof remote.dailyXpGoal === 'number'
      ? sanitizeDailyXpGoal(remote.dailyXpGoal)
      : sanitizeDailyXpGoal(local.dailyXpGoal);

  return {
    userName,
    completedModuleIds,
    practicedSignIds,
    studyDates,
    xp,
    xpByDate: mergedXpByDate,
    dailyXpGoal,
  };
}

export function mergeAppSettings(
  local: AppSettings,
  remote: unknown
): AppSettings {
  if (!remote || typeof remote !== 'object') {
    return sanitizeAppSettings(local);
  }
  return sanitizeAppSettings(remote);
}
