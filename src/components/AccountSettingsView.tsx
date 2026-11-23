import React, { useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Flame,
  GraduationCap,
  LogOut,
  Pencil,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import type { AccountSyncStatus } from '../hooks/useAccountSync';
import type {
  AppSettings,
  AvatarPreference,
  SpeedPreference,
} from '../utils/accountSettings';
import {
  DAILY_XP_GOAL_OPTIONS,
  type DailyGoalProgress,
  type UserLevelInfo,
} from '../utils/gamification';

interface AccountSettingsViewProps {
  authUser: FirebaseUser | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  syncStatus: AccountSyncStatus;
  lastSyncedAt: string | null;
  userName: string;
  xp: number;
  streak: number;
  userLevelInfo: UserLevelInfo;
  dailyGoalProgress: DailyGoalProgress;
  settings: AppSettings;
  onConnectGoogle: () => Promise<boolean>;
  onDisconnectGoogle: () => Promise<void>;
  onUpdateUserName: (nextName: string) => boolean;
  onUpdateDailyXpGoal: (nextGoal: number) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onResetProgress: () => void;
}

const AVATAR_OPTIONS: Array<{ id: AvatarPreference; label: string }> = [
  { id: 'icaro', label: 'Ícaro' },
  { id: 'hosana', label: 'Hosana' },
  { id: 'guga', label: 'Guga' },
];

const SPEED_OPTIONS: SpeedPreference[] = [0.7, 1, 1.4];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({
  authUser,
  authReady,
  authLoading,
  authError,
  syncStatus,
  lastSyncedAt,
  userName,
  xp,
  streak,
  userLevelInfo,
  dailyGoalProgress,
  settings,
  onConnectGoogle,
  onDisconnectGoogle,
  onUpdateUserName,
  onUpdateDailyXpGoal,
  onUpdateSettings,
  onResetProgress,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(userName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onUpdateUserName(draftName);
    if (!ok) {
      setNameError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    setNameError(null);
    setIsEditingName(false);
  };

  const photoUrl = authUser?.photoURL && !avatarLoadError ? authUser.photoURL : null;

  return (
    <section aria-labelledby="account-heading" className="space-y-6">
      {/* Header */}
      <div className="max-w-2xl">
        <p className="text-xs font-medium tracking-wide text-blue-700">
          Conta & Configurações
        </p>
        <h1
          id="account-heading"
          className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]"
        >
          Conta Google e preferências de aprendizado
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Conecte sua conta do Google para salvar seu progresso na nuvem e personalize o intérprete 3D e as opções de acessibilidade.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Column (5 cols): Google Account Connection & Profile */}
        <div className="space-y-6 lg:col-span-5">
          {/* Google Account Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-blue-700" />
                Conta Google
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                {authUser ? (
                  syncStatus === 'syncing' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-700" />
                      Sincronizando...
                    </>
                  ) : syncStatus === 'error' ? (
                    <>
                      <CloudOff className="h-3.5 w-3.5 text-rose-700" />
                      Erro de sincronização
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Conectada{lastSyncedAt ? ` · ${lastSyncedAt}` : ''}
                    </>
                  )
                ) : (
                  <>
                    <Cloud className="h-3.5 w-3.5 text-slate-400" />
                    Modo local
                  </>
                )}
              </span>
            </div>

            {authUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3.5 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`Foto de ${authUser.displayName || userName}`}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarLoadError(true)}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-700 font-display text-sm font-bold text-white"
                    >
                      {getInitials(authUser.displayName || userName)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      data-testid="google-account-name"
                      className="text-sm font-bold text-slate-900 truncate"
                    >
                      {authUser.displayName || userName}
                    </p>
                    <p
                      data-testid="google-account-email"
                      className="text-xs text-slate-600 truncate"
                    >
                      {authUser.email}
                    </p>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-600">
                  Seu XP, sequência diária, módulos concluídos e preferências estão sincronizados automaticamente com sua conta Google.
                </p>

                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => void onDisconnectGoogle()}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <LogOut className="h-4 w-4 text-slate-600" />
                  {authLoading ? 'Desconectando...' : 'Desconectar conta'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-slate-600">
                  No momento seu progresso fica salvo apenas neste navegador. Conecte com o Google para manter seus estudos e configurações sincronizados.
                </p>

                <button
                  type="button"
                  data-testid="google-connect-button"
                  disabled={!authReady || authLoading}
                  onClick={() => void onConnectGoogle()}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 rounded-full bg-white p-0.5"
                  >
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  {authLoading ? 'Conectando...' : 'Conectar com o Google'}
                </button>
              </div>
            )}

            {authError && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
              >
                {authError}
              </p>
            )}
          </div>

          {/* Learner Profile Summary & Name Edit */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">Perfil de Estudos</h2>
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold tabular-nums text-amber-700">
                <Flame className="h-4 w-4 text-amber-600" />
                {xp} XP
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-500">Nome exibido no aplicativo</p>
              {!isEditingName ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p
                    data-testid="account-profile-name"
                    className="text-sm font-semibold text-slate-900 truncate"
                  >
                    {userName}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftName(userName);
                      setNameError(null);
                      setIsEditingName(true);
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveName} className="mt-1.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor="account-name-input" className="sr-only">
                      Nome do aluno
                    </label>
                    <input
                      id="account-name-input"
                      type="text"
                      maxLength={40}
                      value={draftName}
                      onChange={(e) => {
                        setDraftName(e.target.value);
                        if (nameError) setNameError(null);
                      }}
                      className="min-h-[40px] flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                    />
                    <button
                      type="submit"
                      aria-label="Salvar nome"
                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-blue-700 text-white hover:bg-blue-800"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancelar edição"
                      onClick={() => setIsEditingName(false)}
                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {nameError && (
                    <p role="alert" className="text-xs font-medium text-rose-700">
                      {nameError}
                    </p>
                  )}
                </form>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3.5 text-xs">
              <div>
                <p className="text-slate-500">Nível atual</p>
                <p className="mt-0.5 font-semibold text-slate-900 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                  <span className="truncate">{userLevelInfo.title}</span>
                </p>
              </div>
              <div>
                <p className="text-slate-500">Sequência</p>
                <p className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                  {streak} {streak === 1 ? 'dia consecutivo' : 'dias consecutivos'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Application & Accessibility Preferences */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-blue-700" />
                Configurações do Aplicativo
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Ajuste o comportamento padrão do tradutor VLibras, metas diárias e recursos de acessibilidade.
              </p>
            </div>

            {/* Setting 1: Default VLibras Avatar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Intérprete VLibras padrão
                </p>
                <p className="text-xs text-slate-500">
                  Avatar 3D carregado automaticamente ao abrir o Tradutor.
                </p>
              </div>
              <div
                role="group"
                aria-label="Intérprete VLibras padrão"
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start sm:self-auto"
              >
                {AVATAR_OPTIONS.map((av) => {
                  const active = settings.defaultAvatar === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onUpdateSettings({ defaultAvatar: av.id })}
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

            {/* Setting 2: Default Playback Speed */}
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Velocidade padrão da sinalização
                </p>
                <p className="text-xs text-slate-500">
                  Ritmo inicial das animações em Libras no player 3D.
                </p>
              </div>
              <div
                role="group"
                aria-label="Velocidade padrão da sinalização"
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start sm:self-auto"
              >
                {SPEED_OPTIONS.map((spd) => {
                  const active = settings.defaultSpeed === spd;
                  return (
                    <button
                      key={spd}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onUpdateSettings({ defaultSpeed: spd })}
                      className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold font-mono tabular-nums transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {spd}x
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Setting 3: Daily XP Goal */}
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label
                  htmlFor="settings-daily-xp-goal"
                  className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"
                >
                  <Target className="h-4 w-4 text-blue-700" />
                  Meta diária de XP
                </label>
                <p className="text-xs text-slate-500">
                  Hoje: {dailyGoalProgress.todayXp}/{dailyGoalProgress.dailyGoal} XP ({dailyGoalProgress.percentage}%)
                </p>
              </div>
              <select
                id="settings-daily-xp-goal"
                aria-label="Meta diária de XP nas configurações"
                value={dailyGoalProgress.dailyGoal}
                onChange={(e) => onUpdateDailyXpGoal(Number(e.target.value))}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                {DAILY_XP_GOAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Setting 4: Reset Study Progress */}
            <div className="border-t border-slate-100 pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Reiniciar progresso de estudos
                  </p>
                  <p className="text-xs text-slate-500">
                    Zera XP, sequência e módulos concluídos mantendo sua conta e configurações.
                  </p>
                </div>

                {!confirmingReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(true)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition-colors whitespace-nowrap self-start sm:self-auto"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reiniciar progresso
                  </button>
                ) : (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        onResetProgress();
                        setConfirmingReset(false);
                      }}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-800 transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Confirmar reinício
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(false)}
                      className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
