import React, { useState } from 'react';
import { Check, Flame, GraduationCap, Pencil, X } from 'lucide-react';
import type { UserLevelInfo } from '../utils/gamification';

interface UserProfileCardProps {
  userName: string;
  xp: number;
  levelInfo: UserLevelInfo;
  onSaveName: (nextName: string) => boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  userName,
  xp,
  levelInfo,
  onSaveName,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(userName);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStartEdit = () => {
    setDraftName(userName);
    setErrorMsg(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftName(userName);
    setErrorMsg(null);
    setIsEditing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onSaveName(draftName);
    if (!ok) {
      setErrorMsg('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    setErrorMsg(null);
    setIsEditing(false);
  };

  return (
    <section
      aria-labelledby="user-profile-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Identity & Name Editor */}
        <div className="flex items-start gap-4 sm:items-center">
          <div
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-700 font-display text-base font-bold text-white"
          >
            {getInitials(userName)}
          </div>

          <div className="min-w-0 flex-1">
            <p
              id="user-profile-heading"
              className="text-xs font-medium text-slate-500"
            >
              Perfil do Aluno
            </p>

            {!isEditing ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
                <h2
                  data-testid="user-profile-name"
                  className="text-lg font-bold tracking-tight text-slate-900 truncate max-w-xs sm:max-w-md"
                >
                  {userName}
                </h2>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  aria-label="Editar nome do aluno"
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar nome
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="student-name-input" className="sr-only">
                    Nome do aluno
                  </label>
                  <input
                    id="student-name-input"
                    type="text"
                    autoFocus
                    maxLength={40}
                    value={draftName}
                    onChange={(e) => {
                      setDraftName(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Digite seu nome"
                    className="min-h-[40px] w-full sm:w-64 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancelar
                  </button>
                </div>
                {errorMsg && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {errorMsg}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Accumulated XP & Current Level */}
        <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:gap-8 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
          <div>
            <p className="text-xs text-slate-500">XP acumulado</p>
            <p
              data-testid="user-profile-xp"
              className="mt-0.5 flex items-center gap-1.5 text-lg font-bold font-mono tabular-nums text-amber-700"
            >
              <Flame className="h-4 w-4 text-amber-600" />
              {xp} XP
            </p>
          </div>

          <div className="min-w-[210px]">
            <div className="flex items-center justify-between gap-3">
              <p
                data-testid="user-profile-level"
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"
              >
                <GraduationCap className="h-4 w-4 text-blue-700" />
                {levelInfo.title}
              </p>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-blue-700 transition-all duration-300"
                  style={{ width: `${levelInfo.progressPercentage}%` }}
                />
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap">
                {levelInfo.nextLevelXp !== null
                  ? `${xp}/${levelInfo.nextLevelXp} XP`
                  : 'Nível máximo'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
