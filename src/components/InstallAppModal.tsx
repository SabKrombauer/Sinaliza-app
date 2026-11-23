import React from 'react';
import { CheckCircle2, Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ open, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 id="install-modal-title" className="text-lg font-bold text-slate-900">
                Instalar no Android e Dispositivos Móveis
              </h2>
              <p className="text-xs text-slate-500">
                Aplicativo Web Progressivo (PWA) pronto para empacotamento APK
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de instalação"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-slate-700">
          {isInstalled ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
              <span>
                O aplicativo já está instalado neste dispositivo e operando em modo independente.
              </span>
            </div>
          ) : isInstallable ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-3">
              <p className="text-sm text-slate-800">
                Instale o <strong>Sinaliza Libras</strong> diretamente na tela inicial do seu Android ou computador com suporte offline.
              </p>
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors"
              >
                <Download className="h-4 w-4" />
                Instalar Aplicativo Agora
              </button>
            </div>
          ) : isIOS ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs leading-relaxed">
              <p className="font-semibold text-slate-900">Como instalar no iPhone / iPad (Safari):</p>
              <p>1. Toque no botão <strong>Compartilhar</strong> na barra do Safari.</p>
              <p>2. Role até <strong>Adicionar à Tela de Início</strong> e confirme.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs leading-relaxed">
              <p className="font-semibold text-slate-900">Instalação direta no Android (Chrome):</p>
              <p>
                Abra este endereço no Google Chrome do Android, toque no menu (⋮) e selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong> para executá-lo em tela cheia com ícone nativo.
              </p>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Distribuição em formato APK (Android)
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Este projeto já inclui Manifesto Web App, ícones mascaráveis (192px e 512px), Service Worker offline e permissão de câmera configurada. Para gerar o pacote <code className="font-mono text-slate-900">.apk</code> instalável:
            </p>
            <ol className="space-y-1 text-xs text-slate-700 font-mono bg-slate-50 rounded-xl p-3 border border-slate-200/70">
              <li>1. npm run build</li>
              <li>2. npx cap init &quot;Sinaliza Libras&quot; br.com.sinaliza.libras</li>
              <li>3. npx cap add android &amp;&amp; npx cap sync</li>
            </ol>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
