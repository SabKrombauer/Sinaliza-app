import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutGoogle,
} from '../firebase';
import {
  DEFAULT_APP_SETTINGS,
  mergeAppSettings,
  mergeStudyProgress,
  sanitizeAccountSyncPayload,
  sanitizeAppSettings,
  type AppSettings,
} from '../utils/accountSettings';
import type { UserStudyState } from '../utils/gamification';

const SETTINGS_STORAGE_KEY = 'sinaliza_libras_settings_v1';

export type AccountSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

function loadLocalSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    return sanitizeAppSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

interface UseAccountSyncOptions {
  studyState: UserStudyState;
  hydrateStudyState: (nextState: UserStudyState) => void;
}

export function useAccountSync({ studyState, hydrateStudyState }: UseAccountSyncOptions) {
  const [settings, setSettings] = useState<AppSettings>(() => loadLocalSettings());
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<AccountSyncStatus>('local');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const studyStateRef = useRef(studyState);
  studyStateRef.current = studyState;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const hydratedUidRef = useRef<string | null>(null);
  const lastUploadedJsonRef = useRef<string>('');

  // Persist local settings changes immediately
  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  // Listen to Firebase Auth state & perform initial Firestore sync on sign-in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthReady(true);

      if (!user) {
        hydratedUidRef.current = null;
        lastUploadedJsonRef.current = '';
        setSyncStatus('local');
        return;
      }

      const accountPath = `users/${user.uid}/private/account`;
      const docRef = doc(db, 'users', user.uid, 'private', 'account');
      setSyncStatus('syncing');
      setAuthError(null);

      try {
        let snap;
        try {
          snap = await getDoc(docRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, accountPath);
        }

        const currentStudy = studyStateRef.current;
        const currentSettings = settingsRef.current;

        if (snap.exists()) {
          const remoteData = snap.data() as Partial<UserStudyState> & { settings?: unknown };
          const mergedStudy = mergeStudyProgress(currentStudy, remoteData, user.displayName);
          const mergedSettings = mergeAppSettings(currentSettings, remoteData.settings);

          hydrateStudyState(mergedStudy);
          setSettings(mergedSettings);

          const payload = sanitizeAccountSyncPayload(user.uid, mergedStudy, mergedSettings);
          const payloadJson = JSON.stringify(payload);
          lastUploadedJsonRef.current = payloadJson;

          try {
            await updateDoc(docRef, {
              userName: payload.userName,
              xp: payload.xp,
              dailyXpGoal: payload.dailyXpGoal,
              completedModuleIds: payload.completedModuleIds,
              practicedSignIds: payload.practicedSignIds,
              studyDates: payload.studyDates,
              xpByDate: payload.xpByDate,
              settings: payload.settings,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, accountPath);
          }
        } else {
          const mergedStudy = mergeStudyProgress(currentStudy, null, user.displayName);
          hydrateStudyState(mergedStudy);
          const payload = sanitizeAccountSyncPayload(user.uid, mergedStudy, currentSettings);
          lastUploadedJsonRef.current = JSON.stringify(payload);

          try {
            await setDoc(docRef, {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, accountPath);
          }
        }

        hydratedUidRef.current = user.uid;
        setSyncStatus('synced');
        setLastSyncedAt(
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        );
      } catch (err) {
        setSyncStatus('error');
        setAuthError(
          err instanceof Error && err.message.includes('Missing or insufficient permissions')
            ? 'Sem permissão para sincronizar os dados na nuvem. Verifique as regras do Firestore.'
            : 'Não foi possível sincronizar seus dados com a nuvem agora.'
        );
      }
    });

    return () => unsubscribe();
  }, [hydrateStudyState]);

  // Debounced cloud sync whenever studyState or settings change while signed in
  useEffect(() => {
    if (!authUser || hydratedUidRef.current !== authUser.uid) return;

    const payload = sanitizeAccountSyncPayload(authUser.uid, studyState, settings);
    const serialized = JSON.stringify(payload);
    if (serialized === lastUploadedJsonRef.current) return;

    const timer = window.setTimeout(async () => {
      const accountPath = `users/${authUser.uid}/private/account`;
      const docRef = doc(db, 'users', authUser.uid, 'private', 'account');
      setSyncStatus('syncing');

      try {
        try {
          await updateDoc(docRef, {
            userName: payload.userName,
            xp: payload.xp,
            dailyXpGoal: payload.dailyXpGoal,
            completedModuleIds: payload.completedModuleIds,
            practicedSignIds: payload.practicedSignIds,
            studyDates: payload.studyDates,
            xpByDate: payload.xpByDate,
            settings: payload.settings,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, accountPath);
        }

        lastUploadedJsonRef.current = serialized;
        setSyncStatus('synced');
        setLastSyncedAt(
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        );
      } catch {
        setSyncStatus('error');
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [authUser, studyState, settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => sanitizeAppSettings({ ...prev, ...patch }));
  }, []);

  const connectWithGoogle = useCallback(async (): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      return true;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Login cancelado. Clique em "Conectar com o Google" para tentar novamente.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site.'
        );
      } else {
        setAuthError('Não foi possível conectar sua conta Google neste momento.');
      }
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const disconnectGoogle = useCallback(async (): Promise<void> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signOutGoogle();
    } catch {
      setAuthError('Erro ao desconectar sua conta Google.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  return {
    authUser,
    authReady,
    authLoading,
    authError,
    syncStatus,
    lastSyncedAt,
    settings,
    updateSettings,
    connectWithGoogle,
    disconnectGoogle,
  };
}
