import { useState } from 'react';
import { BookOpen, Camera, Download, GraduationCap, Languages, User } from 'lucide-react';
import { AccountSettingsView } from './components/AccountSettingsView';
import { CameraTranslatorView } from './components/CameraTranslatorView';
import { DictionaryView } from './components/DictionaryView';
import { InstallAppModal } from './components/InstallAppModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { StudiesView } from './components/StudiesView';
import { TranslatorView } from './components/TranslatorView';
import { useAccountSync } from './hooks/useAccountSync';
import { useStudyProgress } from './hooks/useStudyProgress';

type AppTab = 'tradutor' | 'estudos' | 'camera' | 'dicionario' | 'conta';

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: typeof Languages }> = [
  { id: 'tradutor', label: 'Tradutor', icon: Languages },
  { id: 'estudos', label: 'Estudos', icon: GraduationCap },
  { id: 'camera', label: 'Câmera', icon: Camera },
  { id: 'dicionario', label: 'Dicionário', icon: BookOpen },
  { id: 'conta', label: 'Conta', icon: User },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('tradutor');
  const [translatorPhrase, setTranslatorPhrase] = useState<string>('Olá, tudo bem?');
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const {
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
  } = useStudyProgress();

  const {
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
  } = useAccountSync({
    studyState: state,
    hydrateStudyState: hydrateState,
  });

  const showNotice = (msg: string) => {
    setFeedbackNotice(msg);
    window.setTimeout(() => {
      setFeedbackNotice((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const handlePracticeSign = (signId: string) => {
    recordActivityToday(signId, 15);
    showNotice('Prática registrada na sua sequência de estudos.');
  };

  const handleSendToTranslator = (word: string) => {
    setTranslatorPhrase(word);
    setActiveTab('tradutor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-slate-900">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 md:h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('tradutor')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-700 rounded-md"
          >
            Sinaliza
          </button>

          {/* Zone 2: 4 concise single-line navigation links */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-7"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-blue-700"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setInstallModalOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Instalar App
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-12 lg:px-8">
        {activeTab === 'tradutor' && (
          <TranslatorView
            initialPhrase={translatorPhrase}
            defaultAvatar={settings.defaultAvatar}
            defaultSpeed={settings.defaultSpeed}
            onPracticeSign={handlePracticeSign}
          />
        )}
        {activeTab === 'estudos' && (
          <StudiesView
            userName={state.userName}
            userLevelInfo={userLevelInfo}
            wordOfTheDay={wordOfTheDay}
            isWordOfDayPracticed={isWordOfDayPracticed}
            practicedSignIds={state.practicedSignIds}
            streak={streak}
            xp={state.xp}
            xpByDate={state.xpByDate}
            weeklyActivity={weeklyActivity}
            levelProgress={levelProgress}
            overallProgress={overallProgress}
            dailyGoalProgress={dailyGoalProgress}
            completedModuleIds={state.completedModuleIds}
            onUpdateUserName={(nextName) => {
              const updated = updateUserName(nextName);
              if (updated) showNotice('Nome do perfil atualizado.');
              return updated;
            }}
            onUpdateDailyXpGoal={(nextGoal) => {
              updateDailyXpGoal(nextGoal);
              showNotice(`Meta diária definida para ${nextGoal} XP.`);
            }}
            onPracticeWordOfDay={(id) => handlePracticeSign(id)}
            onCompleteModule={(modId, xpReward, signIds) => {
              completeModule(modId, xpReward, signIds);
              showNotice(`Módulo concluído! +${xpReward} XP adicionados.`);
            }}
            onTranslateWord={handleSendToTranslator}
          />
        )}
        {activeTab === 'camera' && <CameraTranslatorView />}
        {activeTab === 'dicionario' && (
          <DictionaryView
            onSendToTranslator={handleSendToTranslator}
            onPracticeSign={handlePracticeSign}
            practicedSignIds={state.practicedSignIds}
          />
        )}
        {activeTab === 'conta' && (
          <AccountSettingsView
            authUser={authUser}
            authReady={authReady}
            authLoading={authLoading}
            authError={authError}
            syncStatus={syncStatus}
            lastSyncedAt={lastSyncedAt}
            userName={state.userName}
            xp={state.xp}
            streak={streak}
            userLevelInfo={userLevelInfo}
            dailyGoalProgress={dailyGoalProgress}
            settings={settings}
            onConnectGoogle={async () => {
              const ok = await connectWithGoogle();
              if (ok) showNotice('Conta Google conectada com sucesso.');
              return ok;
            }}
            onDisconnectGoogle={async () => {
              await disconnectGoogle();
              showNotice('Conta Google desconectada.');
            }}
            onUpdateUserName={(nextName) => {
              const updated = updateUserName(nextName);
              if (updated) showNotice('Nome do perfil atualizado.');
              return updated;
            }}
            onUpdateDailyXpGoal={(nextGoal) => {
              updateDailyXpGoal(nextGoal);
              showNotice(`Meta diária definida para ${nextGoal} XP.`);
            }}
            onUpdateSettings={(patch) => {
              updateSettings(patch);
              showNotice('Configurações salvas.');
            }}
            onResetProgress={() => {
              resetProgress();
              showNotice('Progresso de estudos reiniciado.');
            }}
          />
        )}
      </main>

      {/* Quiet Editorial Footer (Desktop) */}
      <footer className="hidden md:block border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 text-xs text-slate-500 lg:px-8">
          <span>Sinaliza Libras · Inclusão e aprendizado em Língua Brasileira de Sinais</span>
          <span>Integração VLibras · Reconhecimento de sinais por pontos de referência</span>
        </div>
      </footer>

      {/* Mobile Ergonomic Bottom Tab Bar (Thumb Zone) */}
      <nav
        aria-label="Navegação móvel"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden pb-safe"
      >
        <div className="grid h-[58px] grid-cols-5 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  window.scrollTo({ top: 0 });
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-blue-700 font-semibold' : 'text-slate-600'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Feedback Notice */}
      {feedbackNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 right-4 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg md:top-20 md:bottom-auto md:right-6"
        >
          {feedbackNotice}
        </div>
      )}

      <OfflineIndicator />
      <InstallAppModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} />
    </div>
  );
}
