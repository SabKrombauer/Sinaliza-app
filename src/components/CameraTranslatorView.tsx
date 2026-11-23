import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Delete,
  Play,
  RefreshCw,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import type { HandLandmarker as HandLandmarkerType } from '@mediapipe/tasks-vision';
import {
  appendCaptionToken,
  classifyHandLandmarks,
  generateCanonicalLandmarks,
  pruneExpiredCaptions,
  SignStabilizer,
  type CaptionWord,
  type ClassificationResult,
  type LandmarkPoint,
} from '../utils/librasClassifier';
import { LiveSignGate } from '../utils/liveSignGate';

type DemoPreset = 'ola' | 'tudo-bem' | 'amor' | 'obrigado' | 'nao' | 'sim' | 'L' | 'V';

const DEMO_PRESETS: Array<{ id: DemoPreset; label: string }> = [
  { id: 'ola', label: 'Olá' },
  { id: 'tudo-bem', label: 'Tudo bem' },
  { id: 'obrigado', label: 'Obrigado(a)' },
  { id: 'amor', label: 'Eu te amo' },
  { id: 'sim', label: 'Sim' },
  { id: 'nao', label: 'Não' },
  { id: 'L', label: 'Letra L' },
  { id: 'V', label: 'Letra V' },
];

const API_URL = (import.meta.env.VITE_LIBRAS_API_URL || '').replace(/\/$/, '');
const API_INTERVAL_MS = 250;
const API_CONFIDENCE_THRESHOLD = 0.72;

type PredictionResponse = { sinal: string | null; confianca: number; maos_detectadas: number };

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  width: number,
  height: number,
  mirrored: boolean
) {
  const mapX = (x: number) => (mirrored ? (1 - x) * width : x * width);
  const mapY = (y: number) => y * height;

  // Draw reference joints connections
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#38BDF8';
  ctx.lineCap = 'round';

  for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
    const a = landmarks[startIdx];
    const b = landmarks[endIdx];
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(mapX(a.x), mapY(a.y));
    ctx.lineTo(mapX(b.x), mapY(b.y));
    ctx.stroke();
  }

  // Draw 21 landmark keypoints
  landmarks.forEach((pt, idx) => {
    const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
    ctx.beginPath();
    ctx.arc(mapX(pt.x), mapY(pt.y), isTip ? 5.5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isTip ? '#FBBF24' : '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
  });
}

export const CameraTranslatorView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stabilizerRef = useRef(new SignStabilizer(5, 1400));
  const wristHistoryRef = useRef<LandmarkPoint[]>([]);
  const rafRef = useRef<number>(0);
  const requestInFlightRef = useRef(false);
  const liveGateRef = useRef(new LiveSignGate(2, API_CONFIDENCE_THRESHOLD));
  const cameraSessionRef = useRef(0);

  const [mode, setMode] = useState<'idle' | 'camera' | 'demo'>('idle');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraStatus, setCameraStatus] = useState<string>(
    'Câmera desligada. Ative a câmera ou teste o reconhecimento no Modo Demonstração.'
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeDemoPreset, setActiveDemoPreset] = useState<DemoPreset>('ola');

  const [liveCandidate, setLiveCandidate] = useState<ClassificationResult | null>(null);
  const [captions, setCaptions] = useState<CaptionWord[]>([]);
  const [retentionSeconds, setRetentionSeconds] = useState<number>(10);
  const [keepHistory, setKeepHistory] = useState<boolean>(true);

  // Prune expired captions periodically when keepHistory is false
  useEffect(() => {
    if (keepHistory) return;
    const timer = window.setInterval(() => {
      setCaptions((prev) => pruneExpiredCaptions(prev, retentionSeconds * 1000, false));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [keepHistory, retentionSeconds]);

  const stopAllCapture = useCallback(() => {
    cameraSessionRef.current += 1;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stabilizerRef.current.reset();
    liveGateRef.current.reset();
    wristHistoryRef.current = [];
    setLiveCandidate(null);
    setMode('idle');
    setCameraStatus('Captura encerrada.');
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startLiveCamera = async (targetFacing: 'user' | 'environment' = facingMode) => {
    stopAllCapture();
    setCameraError(null);
    setCameraStatus('Solicitando acesso à câmera e carregando modelo de mãos...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Este navegador não permite acesso à câmera neste contexto. Utilize o Modo Demonstração abaixo para testar o reconhecimento.'
      );
      setCameraStatus('Câmera indisponível neste dispositivo.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: targetFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setMode('camera');
      setCameraStatus('Inicializando detector de 21 pontos da mão (MediaPipe)...');

      // Lazy-load MediaPipe HandLandmarker
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      let handLandmarker: HandLandmarkerType;
      try {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      } catch {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      }

      if (!API_URL) setCameraError('Defina VITE_LIBRAS_API_URL em .env.local para usar o modelo Python.');
      setCameraStatus(
        API_URL
          ? 'Câmera ativa · MediaPipe + modelo treinado do DuoManos'
          : 'Câmera ativa · Configure VITE_LIBRAS_API_URL para reconhecer sinais reais'
      );

      const session = cameraSessionRef.current;
      const analyzeWithPython = async (video: HTMLVideoElement) => {
        if (requestInFlightRef.current || !API_URL) return;
        requestInFlightRef.current = true;
        try {
          const frame = document.createElement('canvas');
          frame.width = 480;
          frame.height = Math.max(1, Math.round(480 * video.videoHeight / video.videoWidth));
          const ctx = frame.getContext('2d');
          if (!ctx) return;
          // Envie o frame sem espelhar: o Python aplica o mesmo flip usado na coleta.
          ctx.drawImage(video, 0, 0, frame.width, frame.height);
          const blob = await new Promise<Blob | null>((resolve) =>
            frame.toBlob(resolve, 'image/jpeg', 0.6)
          );
          if (!blob) return;
          const payload = new FormData();
          payload.append('imagem', blob, 'frame.jpg');
          const response = await fetch(`${API_URL}/reconhecer`, {
            method: 'POST',
            body: payload,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const prediction: PredictionResponse = await response.json();
          if (session !== cameraSessionRef.current) return;
          setCameraStatus(
            `Câmera ativa · ${prediction.maos_detectadas} mão(s) detectada(s) · Modelo DuoManos`
          );

          // Mostra a previsão mesmo abaixo do limiar: ajuda a diagnosticar
          // sinais que não foram bem aprendidos, como os movimentos de "OI".
          const accepted = prediction.sinal && prediction.confianca >= API_CONFIDENCE_THRESHOLD;
          if (!accepted) {
            setLiveCandidate(
              prediction.sinal
                ? {
                    signId: prediction.sinal.toLowerCase(),
                    label: prediction.sinal.toUpperCase(),
                    gloss: prediction.sinal.toUpperCase(),
                    confidence: prediction.confianca,
                    handshapeHint: 'Previsão ainda abaixo do limiar para adicionar texto',
                  }
                : null
            );
            liveGateRef.current.push(null, 0);
            setCameraError(null);
            return;
          }
          const classification: ClassificationResult = {
            signId: prediction.sinal.toLowerCase(),
            label: prediction.sinal.toUpperCase(),
            gloss: prediction.sinal.toUpperCase(),
            confidence: prediction.confianca,
            handshapeHint: 'Previsão do modelo treinado do DuoManos',
          };
          setLiveCandidate(classification);
          const confirmed = liveGateRef.current.push(classification.label, prediction.confianca);
          if (confirmed) {
            // Uma repeticao real, com pausa entre sinais, pode ser escrita novamente.
            // A funcao de demonstracao deduplica palavras consecutivas, por isso
            // usamos um registro separado para o modelo real.
            setCaptions((prev) => [
              ...prev,
              { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: confirmed, timestamp: Date.now() },
            ].slice(-16));
          }
          setCameraError(null);
        } catch (error) {
          if (session === cameraSessionRef.current) {
            setCameraError('Não foi possível conectar à API Python. Confira o endereço, CORS e a rede.');
            setCameraStatus('Conexão com o modelo indisponível');
          }
        } finally {
          requestInFlightRef.current = false;
        }
      };

      let lastRequestAt = 0;

      let lastVideoTime = -1;
      const detectLoop = () => {
        const video = videoRef.current;
        const canvas = overlayCanvasRef.current;
        if (!video || !canvas || !streamRef.current) return;

        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const result = handLandmarker.detectForVideo(video, performance.now());

          const rect = canvas.getBoundingClientRect();
          const w = Math.max(rect.width, 320);
          const h = Math.max(rect.height, 240);
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, w, h);

            if (result.landmarks && result.landmarks.length > 0) {
              const primaryHand = result.landmarks[0] as LandmarkPoint[];
              wristHistoryRef.current = [
                ...wristHistoryRef.current.slice(-11),
                primaryHand[0],
              ];

              for (const hand of result.landmarks) {
                drawHandSkeleton(
                  ctx,
                  hand as LandmarkPoint[],
                  w,
                  h,
                  targetFacing === 'user'
                );
              }

              // As regras heurísticas permanecem apenas no Modo Demonstração.
              // Na câmera real usamos exclusivamente o modelo Python treinado.
            } else {
              setLiveCandidate(null);
              // A API é quem confirma as ausências, não cada frame do navegador.
            }
          }
          const now = performance.now();
          if (API_URL && now - lastRequestAt >= API_INTERVAL_MS && !requestInFlightRef.current) {
            lastRequestAt = now;
            void analyzeWithPython(video);
          }
        }

        rafRef.current = requestAnimationFrame(detectLoop);
      };

      rafRef.current = requestAnimationFrame(detectLoop);
    } catch {
      stopAllCapture();
      setCameraError(
        'Não foi possível acessar a câmera (permissão negada ou dispositivo sem webcam). Use o Modo Demonstração para visualizar o rastreamento de pontos.'
      );
      setCameraStatus('Aguardando permissão de câmera ou uso do Modo Demonstração.');
    }
  };

  const startDemoSimulation = useCallback(
    (preset: DemoPreset) => {
      stopAllCapture();
      setCameraError(null);
      setActiveDemoPreset(preset);
      setMode('demo');
      setCameraStatus(`Modo Demonstração ativo · Simulando pontos 3D do sinal "${DEMO_PRESETS.find((p) => p.id === preset)?.label}"`);

      let startMs = performance.now();
      let lastAnalysisMs = 0;

      const tickDemo = (now: number) => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const w = Math.max(rect.width, 320);
        const h = Math.max(rect.height, 240);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);

          // Draw subtle torso/face reference guides to show body landmarks context
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.26, 36, 44, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(w * 0.34, h * 0.62);
          ctx.quadraticCurveTo(w * 0.5, h * 0.52, w * 0.66, h * 0.62);
          ctx.stroke();

          const phase = ((now - startMs) / 1400) % 1;
          const { landmarks, history } = generateCanonicalLandmarks(preset, phase);
          drawHandSkeleton(ctx, landmarks, w, h, false);

          if (now - lastAnalysisMs > 120) {
            lastAnalysisMs = now;
            const classification = classifyHandLandmarks(landmarks, history);
            setLiveCandidate(classification);
            const confirmed = stabilizerRef.current.push(classification, Date.now());
            if (confirmed) {
              setCaptions((prev) => appendCaptionToken(prev, confirmed.label));
            }
          }
        }

        rafRef.current = requestAnimationFrame(tickDemo);
      };

      rafRef.current = requestAnimationFrame(tickDemo);
    },
    [stopAllCapture]
  );

  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (mode === 'camera') {
      void startLiveCamera(nextFacing);
    }
  };

  const fullPhraseText = captions.map((c) => c.text).join(' ');

  const handleSpeakCaptions = () => {
    if (!fullPhraseText || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(fullPhraseText);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section aria-labelledby="camera-heading" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-blue-700">
            Visão Computacional · Libras para Texto
          </p>
          <h1
            id="camera-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]"
          >
            Reconhecimento de sinais pela câmera
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            O MediaPipe rastreia as mãos e o modelo treinado do DuoManos identifica sinais isolados cadastrados. Esta versão ainda não traduz conversas completas em Libras.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode !== 'camera' ? (
            <button
              type="button"
              onClick={() => void startLiveCamera()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              <Camera className="h-4 w-4" />
              Ativar Câmera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopAllCapture}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors whitespace-nowrap"
            >
              <Square className="h-4 w-4" />
              Desligar Câmera
            </button>
          )}

          <button
            type="button"
            onClick={handleFlipCamera}
            aria-label="Alternar câmera frontal ou traseira"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <RefreshCw className="h-4 w-4" />
            {facingMode === 'user' ? 'Câmera Frontal' : 'Câmera Traseira'}
          </button>
        </div>
      </div>

      {/* Main Split Stage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Camera Viewport & Persistent Subtitles (8 cols) */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 lg:col-span-8">
          {/* Status Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              {mode === 'camera' && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              )}
              <span>{cameraStatus}</span>
            </div>
            {liveCandidate && (
              <span className="font-mono text-amber-300">
                Detectando: {liveCandidate.label} ({Math.round(liveCandidate.confidence * 100)}%)
              </span>
            )}
          </div>

          {/* Video + Landmark Overlay Canvas */}
          <div className="relative h-[280px] sm:h-[340px] bg-slate-900 overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${
                mode === 'camera' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              } ${facingMode === 'user' ? '-scale-x-100' : ''}`}
            />

            <canvas
              ref={overlayCanvasRef}
              data-testid="camera-landmark-canvas"
              className="absolute inset-0 h-full w-full pointer-events-none"
            />

            {mode === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-blue-400 mb-3">
                  <CameraOff className="h-7 w-7" />
                </div>
                <p className="text-base font-semibold text-white">
                  Pronto para reconhecer sinais em Libras
                </p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                  Clique em &ldquo;Ativar Câmera&rdquo; para usar sua webcam ou selecione um sinal no painel &ldquo;Modo Demonstração&rdquo; para testar a análise de pontos sem câmera.
                </p>
                {cameraError && (
                  <p className="mt-3 max-w-md rounded-xl border border-amber-500/40 bg-amber-950/60 px-3.5 py-2.5 text-xs text-amber-200">
                    {cameraError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* High-Contrast Persistent Translation Subtitle Deck */}
          <div
            aria-live="polite"
            data-testid="camera-caption-box"
            className="border-t border-slate-800 bg-slate-950 px-5 py-4"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
              <span>Texto dos sinais reconhecidos</span>
              <span className="font-mono">
                {keepHistory ? 'Exibição contínua' : `Permanência: ${retentionSeconds}s`}
              </span>
            </div>
            <p className="min-h-[34px] text-xl sm:text-2xl font-bold leading-snug text-white">
              {fullPhraseText || 'Os sinais reconhecidos aparecerão aqui...'}
            </p>
            {liveCandidate && (
              <p className="mt-1 text-xs text-sky-300">
                Configuração identificada: {liveCandidate.handshapeHint}
              </p>
            )}
          </div>

          {/* Caption Management Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSpeakCaptions}
                disabled={!fullPhraseText}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-40 whitespace-nowrap"
              >
                <Volume2 className="h-4 w-4" />
                Ouvir frase
              </button>
              <button
                type="button"
                onClick={() => setCaptions((prev) => prev.slice(0, -1))}
                disabled={captions.length === 0}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
              >
                <Delete className="h-4 w-4" />
                Apagar última
              </button>
              <button
                type="button"
                onClick={() => setCaptions([])}
                disabled={captions.length === 0}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
              >
                <Trash2 className="h-4 w-4" />
                Limpar tela
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepHistory}
                  onChange={(e) => setKeepHistory(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 text-blue-600 focus:ring-blue-600"
                />
                <span>Manter histórico visível</span>
              </label>
              {!keepHistory && (
                <select
                  aria-label="Tempo de permanência da legenda"
                  value={retentionSeconds}
                  onChange={(e) => setRetentionSeconds(Number(e.target.value))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                >
                  <option value={6}>6s</option>
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Demo Simulator & Supported Signs Reference (4 cols) */}
        <div className="flex flex-col gap-5 lg:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Modo Demonstração (Simulador)
              </h2>
              {mode === 'demo' && (
                <button
                  type="button"
                  onClick={stopAllCapture}
                  className="text-xs font-semibold text-rose-700 hover:underline whitespace-nowrap"
                >
                  Parar
                </button>
              )}
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Teste o classificador de pontos de referência sem precisar ligar a webcam. Cada botão injeta coordenadas anatômicas reais no algoritmo de reconhecimento.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_PRESETS.map((preset) => {
                const isRunningThis = mode === 'demo' && activeDemoPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => startDemoSimulation(preset.id)}
                    className={`flex min-h-[44px] items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      isRunningThis
                        ? 'border-blue-700 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <Play className="h-3.5 w-3.5 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Sinais reconhecidos pela câmera
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Posicione a mão bem iluminada à frente do tronco ou rosto. O modelo reconhece em tempo real:
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700">
              <li>· Cumprimentos: Olá, Tudo bem, Obrigado(a)</li>
              <li>· Respostas e expressões: Sim, Não, Eu, Eu te amo, Água</li>
              <li>· Alfabeto manual e números: B, D, F, I, L, O, S, U, V, W, Y, 1–5</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
