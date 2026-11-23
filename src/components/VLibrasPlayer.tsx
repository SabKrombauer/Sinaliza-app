import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export type VLibrasAvatarId = 'icaro' | 'hosana' | 'guga';

interface VLibrasPlayerProps {
  gloss: string;
  isPlaying?: boolean;
  speed?: number;
  avatar?: VLibrasAvatarId;
  showSubtitles?: boolean;
  replayKey?: number;
  title?: string;
}

function getBundleBaseUrl(): string {
  if (typeof window === 'undefined') return '/api/vlibras/bundles/';
  return `${window.location.origin}/api/vlibras/bundles/`;
}

function normalizeGlossForUnity(rawGloss: string): string {
  return rawGloss
    .trim()
    .replace(/\bO-QUÊ\b/gi, 'O_QUE')
    .replace(/\bBOA-TARDE\b/gi, 'BOA TARDE')
    .replace(/\bBOM-DIA\b/gi, 'BOM_DIA')
    .replace(/\bBOA-NOITE\b/gi, 'BOA_NOITE')
    .replace(/\bPOR-FAVOR\b/gi, 'POR_FAVOR')
    .replace(/\bTUDO-BEM\b/gi, 'TUDO_BEM');
}

export const VLibrasPlayer: React.FC<VLibrasPlayerProps> = ({
  gloss,
  isPlaying = true,
  speed = 1,
  avatar = 'icaro',
  showSubtitles = false,
  replayKey = 0,
  title = 'Intérprete 3D VLibras',
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const latestRef = useRef({ gloss, speed, avatar, showSubtitles });
  latestRef.current = { gloss, speed, avatar, showSubtitles };

  const sendUnityCommand = useCallback(
    (object: string, method: string, params?: string | number) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({ type: 'unity', object, method, params }, '*');
    },
    []
  );

  // Listen to Unity WebGL events from the embedded VLibras player iframe
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const msg = ev.data as { type?: string; event?: string; data?: unknown };
      if (!msg || msg.type !== 'vlibras_unity_event') return;

      if (msg.event === 'update_progress') {
        const val = typeof msg.data === 'number' ? msg.data : 0;
        setProgress(Math.min(100, Math.round(val * 100)));
      } else if (msg.event === 'on_load_player') {
        const cur = latestRef.current;
        setProgress(100);
        setIsLoaded(true);
        setErrorState(null);
        // Configure same-origin proxied dictionary bundles & idle animations
        sendUnityCommand('PlayerManager', 'setBaseUrl', getBundleBaseUrl());
        sendUnityCommand('PlayerManager', 'initRandomAnimationsProcess');
        sendUnityCommand('PlayerManager', 'setSubtitlesState', cur.showSubtitles ? 1 : 0);
        sendUnityCommand('PlayerManager', 'setSlider', cur.speed);
        sendUnityCommand('PlayerManager', 'Change', cur.avatar);
        const normalized = normalizeGlossForUnity(cur.gloss);
        if (normalized) {
          sendUnityCommand('PlayerManager', 'playNow', normalized);
        }
      } else if (msg.event === 'on_error') {
        const err = String(msg.data || 'webgl_error');
        if (err === 'webgl_unsupported') {
          setErrorState('Este navegador não oferece suporte ao motor WebGL 3D do VLibras.');
        } else if (err === 'loader_unavailable') {
          setErrorState('Não foi possível carregar os arquivos do VLibras nesta rede.');
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendUnityCommand]);

  // Play new gloss whenever gloss or replayKey changes once loaded
  useEffect(() => {
    const normalized = normalizeGlossForUnity(gloss);
    if (!isLoaded || !normalized) return;
    sendUnityCommand('PlayerManager', 'setBaseUrl', getBundleBaseUrl());
    sendUnityCommand('PlayerManager', 'playNow', normalized);
  }, [gloss, replayKey, isLoaded, sendUnityCommand]);

  // Sync play/pause state
  useEffect(() => {
    if (!isLoaded) return;
    sendUnityCommand('PlayerManager', 'setPauseState', isPlaying ? 0 : 1);
  }, [isPlaying, isLoaded, sendUnityCommand]);

  // Sync playback speed
  useEffect(() => {
    if (!isLoaded) return;
    sendUnityCommand('PlayerManager', 'setSlider', speed);
  }, [speed, isLoaded, sendUnityCommand]);

  // Sync avatar (Ícaro, Hosana, Guga)
  useEffect(() => {
    if (!isLoaded) return;
    sendUnityCommand('PlayerManager', 'Change', avatar);
  }, [avatar, isLoaded, sendUnityCommand]);

  // Sync subtitles visibility
  useEffect(() => {
    if (!isLoaded) return;
    sendUnityCommand('PlayerManager', 'setSubtitlesState', showSubtitles ? 1 : 0);
  }, [showSubtitles, isLoaded, sendUnityCommand]);

  const handleRetry = () => {
    setIsLoaded(false);
    setProgress(0);
    setErrorState(null);
    setReloadNonce((n) => n + 1);
  };

  return (
    <div
      data-testid="vlibras-player-stage"
      data-active-gloss={gloss}
      data-player-loaded={isLoaded ? 'true' : 'false'}
      className="relative h-full w-full overflow-hidden bg-slate-50"
    >
      {!errorState && (
        <iframe
          key={reloadNonce}
          ref={iframeRef}
          src="/vlibras-player.html"
          title={title}
          allow="webgl"
          className="h-full w-full border-0 block"
        />
      )}

      {/* Clean Loading Overlay until Unity WebGL fires on_load_player */}
      {!isLoaded && !errorState && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/95 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Carregando intérprete 3D VLibras...
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Repositório oficial spbgovbr-vlibras · Avatar {avatar === 'icaro' ? 'Ícaro' : avatar === 'hosana' ? 'Hosana' : 'Guga'}
          </p>
          <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-blue-700 transition-all duration-300"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-xs tabular-nums text-slate-600">
            {progress}%
          </p>
        </div>
      )}

      {/* Error State with Retry */}
      {errorState && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Motor 3D VLibras indisponível
          </p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-600">
            {errorState}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recarregar player VLibras
          </button>
        </div>
      )}
    </div>
  );
};
