import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Flame,
  Shield,
  Volume2,
  VolumeX,
  Swords,
  RefreshCw,
  SkipBack,
  SkipForward,
  X,
  Check,
  Trophy,
  AlertTriangle,
  Plus,
  Minus,
  Bell,
} from 'lucide-react';
import { soundEngine } from '../../assets/soundEngine';

type PresetId = 'sparring' | 'drill' | 'hiit' | 'custom';
type TimerPhase = 'prep' | 'work' | 'rest';
type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

const PREP_SECONDS = 5;

interface TimerConfig {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  tenSecondAlert: boolean;
}

interface PresetOption {
  id: Exclude<PresetId, 'custom'>;
  label: string;
  shortLabel: string;
  description: string;
  config: Omit<TimerConfig, 'tenSecondAlert'>;
}

const PRESETS: PresetOption[] = [
  {
    id: 'sparring',
    label: 'Sparring (Rola)',
    shortLabel: 'Sparring',
    description: '5 min luta · 1 min descanso · 10 rounds',
    config: { workSeconds: 300, restSeconds: 60, rounds: 10 },
  },
  {
    id: 'drill',
    label: 'Drill (Repetição)',
    shortLabel: 'Drill',
    description: '1 min treino · 30s descanso · 8 rounds',
    config: { workSeconds: 60, restSeconds: 30, rounds: 8 },
  },
  {
    id: 'hiit',
    label: 'HIIT / Condic.',
    shortLabel: 'HIIT',
    description: '20s alta intens. · 10s descanso · 8 rounds',
    config: { workSeconds: 20, restSeconds: 10, rounds: 8 },
  },
];

function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export default function JiuJitsuTimerPage() {
  const [activePreset, setActivePreset] = useState<PresetId>('sparring');
  const [config, setConfig] = useState<TimerConfig>({
    workSeconds: 360,
    restSeconds: 60,
    rounds: 5,
    tenSecondAlert: true,
  });

  const [status, setStatus] = useState<TimerStatus>('idle');
  const [phase, setPhase] = useState<TimerPhase>('work');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [timeLeft, setTimeLeft] = useState<number>(360);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Refs for drift-free interval & audio trigger tracking
  const intervalRef = useRef<number | null>(null);
  const remainingMsRef = useRef<number>(360 * 1000);
  const targetEndMsRef = useRef<number>(0);
  const lastSecondTriggeredRef = useRef<number | null>(null);
  const statusRef = useRef<TimerStatus>(status);
  const phaseRef = useRef<TimerPhase>(phase);
  const roundRef = useRef<number>(currentRound);
  const configRef = useRef<TimerConfig>(config);
  const mutedRef = useRef<boolean>(isMuted);

  // Keep refs synchronized with latest state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    roundRef.current = currentRound;
  }, [currentRound]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Screen Wake Lock while timer is running so phones stay awake on the gym mat
  useEffect(() => {
    let wakeLock: { release: () => Promise<void> } | null = null;
    let active = true;

    async function requestWakeLock() {
      if (status !== 'running') return;
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          const lock = await nav.wakeLock.request('screen');
          if (active) {
            wakeLock = lock;
          } else {
            void lock.release();
          }
        }
      } catch {
        // Wake Lock API unsupported or blocked by battery saver
      }
    }

    void requestWakeLock();

    return () => {
      active = false;
      if (wakeLock) {
        void wakeLock.release().catch(() => {});
      }
    };
  }, [status]);

  // Pede confirmação antes de atualizar/fechar a página enquanto o timer estiver rodando ou pausado
useEffect(() => {
  const isTimerActive = status === 'running' || status === 'paused';
  if (!isTimerActive) return;

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = ''; // Obrigatório para disparar o alerta nativo do navegador
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [status]);

// Evita o gesto de "puxar para baixo para atualizar" no celular
useEffect(() => {
  const prevHtml = document.documentElement.style.overscrollBehaviorY;
  const prevBody = document.body.style.overscrollBehaviorY;

  document.documentElement.style.overscrollBehaviorY = 'none';
  document.body.style.overscrollBehaviorY = 'none';

  return () => {
    document.documentElement.style.overscrollBehaviorY = prevHtml;
    document.body.style.overscrollBehaviorY = prevBody;
  };
}, []);

  // Handle phase/round completion transition cleanly
  const handlePhaseFinish = useCallback(() => {
    const cfg = configRef.current;
    const curPhase = phaseRef.current;
    const curRound = roundRef.current;
    const muted = mutedRef.current;

    lastSecondTriggeredRef.current = null;

    if (curPhase === 'prep') {
      // Preparation finished -> Start Round 1 Fight
      setPhase('work');
      phaseRef.current = 'work';
      remainingMsRef.current = cfg.workSeconds * 1000;
      targetEndMsRef.current = Date.now() + cfg.workSeconds * 1000;
      setTimeLeft(cfg.workSeconds);
      soundEngine.playFightStartGong(muted);
      return;
    }

    if (curPhase === 'work') {
      if (curRound >= cfg.rounds) {
        // Final round completed -> Workout Finished
        clearTimerInterval();
        remainingMsRef.current = 0;
        setTimeLeft(0);
        setStatus('completed');
        soundEngine.playWorkoutComplete(muted);
        return;
      }

      if (cfg.restSeconds > 0) {
        // Transition to Rest phase
        setPhase('rest');
        phaseRef.current = 'rest';
        remainingMsRef.current = cfg.restSeconds * 1000;
        targetEndMsRef.current = Date.now() + cfg.restSeconds * 1000;
        setTimeLeft(cfg.restSeconds);
        soundEngine.playRestBell(muted);
      } else {
        // Zero rest -> jump directly to next Fight round
        const nextRound = curRound + 1;
        setCurrentRound(nextRound);
        roundRef.current = nextRound;
        setPhase('work');
        phaseRef.current = 'work';
        remainingMsRef.current = cfg.workSeconds * 1000;
        targetEndMsRef.current = Date.now() + cfg.workSeconds * 1000;
        setTimeLeft(cfg.workSeconds);
        soundEngine.playFightStartGong(muted);
      }
    } else {
      // Rest finished -> Next Fight Round
      const nextRound = curRound + 1;
      setCurrentRound(nextRound);
      roundRef.current = nextRound;
      setPhase('work');
      phaseRef.current = 'work';
      remainingMsRef.current = cfg.workSeconds * 1000;
      targetEndMsRef.current = Date.now() + cfg.workSeconds * 1000;
      setTimeLeft(cfg.workSeconds);
      soundEngine.playFightStartGong(muted);
    }
  }, [clearTimerInterval]);

  // Main precision interval effect
  useEffect(() => {
    if (status !== 'running') {
      clearTimerInterval();
      return;
    }

    targetEndMsRef.current = Date.now() + remainingMsRef.current;

    intervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const diffMs = targetEndMsRef.current - now;
      remainingMsRef.current = Math.max(0, diffMs);

      const nextSeconds = Math.ceil(diffMs / 1000);

      if (diffMs <= 0) {
        handlePhaseFinish();
        return;
      }

      setTimeLeft((prev) => {
        if (prev !== nextSeconds) {
          // Trigger per-second audio cues only once per whole second
          if (lastSecondTriggeredRef.current !== nextSeconds) {
            lastSecondTriggeredRef.current = nextSeconds;
            const cfg = configRef.current;
            const muted = mutedRef.current;

            if (phaseRef.current === 'prep') {
              if (nextSeconds <= PREP_SECONDS && nextSeconds >= 1) {
                soundEngine.playCountdownTick(muted);
              }
            } else if (phaseRef.current === 'work') {
              if (cfg.tenSecondAlert && nextSeconds === 10 && cfg.workSeconds > 10) {
                soundEngine.playTenSecondsAlert(muted);
              } else if (nextSeconds <= 3 && nextSeconds >= 1) {
                soundEngine.playCountdownTick(muted);
              }
            } else if (phaseRef.current === 'rest') {
              if (nextSeconds <= 3 && nextSeconds >= 1) {
                soundEngine.playCountdownTick(muted);
              } else {
                soundEngine.playRestTick(muted);
              }
            }
          }
          return nextSeconds;
        }
        return prev;
      });
    }, 100);

    return () => {
      clearTimerInterval();
    };
  }, [status, clearTimerInterval, handlePhaseFinish]);

  // Primary Controls
  const handleStartPause = useCallback(() => {
    soundEngine.unlock();

    if (status === 'idle' || status === 'completed') {
      remainingMsRef.current = PREP_SECONDS * 1000;
      lastSecondTriggeredRef.current = PREP_SECONDS;
      phaseRef.current = 'prep';
      roundRef.current = 1;
      setPhase('prep');
      setCurrentRound(1);
      setTimeLeft(PREP_SECONDS);
      setStatus('running');
      soundEngine.playCountdownTick(isMuted);
    } else if (status === 'running') {
      const remaining = Math.max(0, targetEndMsRef.current - Date.now());
      remainingMsRef.current = remaining;
      setTimeLeft(Math.ceil(remaining / 1000));
      setStatus('paused');
    } else if (status === 'paused') {
      lastSecondTriggeredRef.current = null;
      setStatus('running');
    }
  }, [status, isMuted]);

  const handleReset = useCallback(() => {
    clearTimerInterval();
    lastSecondTriggeredRef.current = null;
    remainingMsRef.current = config.workSeconds * 1000;
    phaseRef.current = 'work';
    roundRef.current = 1;
    setStatus('idle');
    setPhase('work');
    setCurrentRound(1);
    setTimeLeft(config.workSeconds);
  }, [clearTimerInterval, config.workSeconds]);

  const handlePrevRound = useCallback(() => {
    soundEngine.unlock();
    lastSecondTriggeredRef.current = null;

    if (status === 'completed') {
      remainingMsRef.current = config.workSeconds * 1000;
      phaseRef.current = 'work';
      roundRef.current = config.rounds;
      setStatus('paused');
      setPhase('work');
      setCurrentRound(config.rounds);
      setTimeLeft(config.workSeconds);
      return;
    }

    if (phase === 'prep') {
      remainingMsRef.current = PREP_SECONDS * 1000;
      targetEndMsRef.current = Date.now() + PREP_SECONDS * 1000;
      lastSecondTriggeredRef.current = PREP_SECONDS;
      setTimeLeft(PREP_SECONDS);
      if (status === 'running') soundEngine.playCountdownTick(isMuted);
      return;
    }

    if (phase === 'rest') {
      remainingMsRef.current = config.workSeconds * 1000;
      targetEndMsRef.current = Date.now() + config.workSeconds * 1000;
      phaseRef.current = 'work';
      setPhase('work');
      setTimeLeft(config.workSeconds);
      if (status === 'running') soundEngine.playFightStartGong(isMuted);
      return;
    }

    const prevRound = Math.max(1, currentRound - 1);
    remainingMsRef.current = config.workSeconds * 1000;
    targetEndMsRef.current = Date.now() + config.workSeconds * 1000;
    phaseRef.current = 'work';
    roundRef.current = prevRound;
    setCurrentRound(prevRound);
    setPhase('work');
    setTimeLeft(config.workSeconds);
    if (status === 'running') soundEngine.playFightStartGong(isMuted);
  }, [status, phase, currentRound, config.workSeconds, config.rounds, isMuted]);

  const handleNextRound = useCallback(() => {
    soundEngine.unlock();
    lastSecondTriggeredRef.current = null;

    if (status === 'completed') return;

    if (phase === 'prep') {
      // Skip prep directly into Round 1
      remainingMsRef.current = config.workSeconds * 1000;
      targetEndMsRef.current = Date.now() + config.workSeconds * 1000;
      phaseRef.current = 'work';
      setPhase('work');
      setTimeLeft(config.workSeconds);
      if (status === 'running') soundEngine.playFightStartGong(isMuted);
      return;
    }

    if (currentRound < config.rounds) {
      const nextRound = currentRound + 1;
      remainingMsRef.current = config.workSeconds * 1000;
      targetEndMsRef.current = Date.now() + config.workSeconds * 1000;
      phaseRef.current = 'work';
      roundRef.current = nextRound;
      setCurrentRound(nextRound);
      setPhase('work');
      setTimeLeft(config.workSeconds);
      if (status === 'running') {
        soundEngine.playFightStartGong(isMuted);
      } else if (status === 'idle') {
        setStatus('paused');
      }
    } else {
      clearTimerInterval();
      remainingMsRef.current = 0;
      setTimeLeft(0);
      setStatus('completed');
      soundEngine.playWorkoutComplete(isMuted);
    }
  }, [status, phase, currentRound, config.rounds, config.workSeconds, clearTimerInterval, isMuted]);

  // Preset & Configuration handlers
  const applyPreset = useCallback(
    (presetId: PresetId) => {
      soundEngine.unlock();
      if (presetId === 'custom') {
        setActivePreset('custom');
        setIsSettingsOpen(true);
        return;
      }

      const found = PRESETS.find((p) => p.id === presetId);
      if (!found) return;

      clearTimerInterval();
      lastSecondTriggeredRef.current = null;
      const nextConfig: TimerConfig = {
        ...found.config,
        tenSecondAlert: config.tenSecondAlert,
      };
      setActivePreset(presetId);
      setConfig(nextConfig);
      remainingMsRef.current = nextConfig.workSeconds * 1000;
      phaseRef.current = 'work';
      roundRef.current = 1;
      setStatus('idle');
      setPhase('work');
      setCurrentRound(1);
      setTimeLeft(nextConfig.workSeconds);
    },
    [clearTimerInterval, config.tenSecondAlert]
  );

  const updateCustomConfig = useCallback(
    (updater: (prev: TimerConfig) => TimerConfig, enforceMinWork = true) => {
      clearTimerInterval();
      lastSecondTriggeredRef.current = null;
      setActivePreset('custom');

      const next = updater(configRef.current);
      const normalized: TimerConfig = {
        workSeconds: enforceMinWork ? Math.max(5, next.workSeconds) : Math.max(0, next.workSeconds),
        restSeconds: Math.max(0, next.restSeconds),
        rounds: clamp(next.rounds, 1, 20),
        tenSecondAlert: next.tenSecondAlert,
      };

      configRef.current = normalized;
      setConfig(normalized);
      remainingMsRef.current = Math.max(5, normalized.workSeconds) * 1000;
      phaseRef.current = 'work';
      roundRef.current = 1;
      setStatus('idle');
      setPhase('work');
      setCurrentRound(1);
      setTimeLeft(Math.max(5, normalized.workSeconds));
    },
    [clearTimerInterval]
  );

  const ensureValidWorkDuration = useCallback(() => {
    if (configRef.current.workSeconds < 5) {
      updateCustomConfig((c) => ({ ...c, workSeconds: 5 }), true);
    }
  }, [updateCustomConfig]);

  const toggleMute = useCallback(() => {
    soundEngine.unlock();
    setIsMuted((prev) => !prev);
  }, []);

  // Keyboard shortcuts for desktop convenience
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (isSettingsOpen) {
        if (e.key === 'Escape') {
          ensureValidWorkDuration();
          setIsSettingsOpen(false);
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleStartPause();
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      } else if (e.key === 'ArrowLeft') {
        handlePrevRound();
      } else if (e.key === 'ArrowRight') {
        handleNextRound();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isSettingsOpen,
    ensureValidWorkDuration,
    handleStartPause,
    handleReset,
    toggleMute,
    handlePrevRound,
    handleNextRound,
  ]);

  // Derived Progress & Visual State Math
  const workMins = Math.floor(config.workSeconds / 60);
  const workSecs = config.workSeconds % 60;
  const restMins = Math.floor(config.restSeconds / 60);
  const restSecs = config.restSeconds % 60;

  const currentPhaseDuration =
    phase === 'prep'
      ? PREP_SECONDS
      : phase === 'work'
      ? config.workSeconds
      : Math.max(1, config.restSeconds);

  const phaseProgress =
    status === 'completed'
      ? 1
      : clamp((currentPhaseDuration - timeLeft) / currentPhaseDuration, 0, 1);

  // Total workout seconds (N rounds of work + (N - 1) intervals of rest)
  const totalWorkoutSeconds =
    config.rounds * config.workSeconds + Math.max(0, config.rounds - 1) * config.restSeconds;

  const calculateElapsedWorkoutSeconds = (): number => {
    if (status === 'completed') return totalWorkoutSeconds;
    if (phase === 'prep') return 0;

    const completedFullRounds = currentRound - 1;
    const priorSeconds =
      completedFullRounds * (config.workSeconds + config.restSeconds);

    if (phase === 'work') {
      return priorSeconds + (config.workSeconds - timeLeft);
    }
    return priorSeconds + config.workSeconds + (config.restSeconds - timeLeft);
  };

  const elapsedWorkoutSeconds = clamp(calculateElapsedWorkoutSeconds(), 0, totalWorkoutSeconds);
  const remainingWorkoutSeconds = Math.max(0, totalWorkoutSeconds - elapsedWorkoutSeconds);
  const totalProgress =
    totalWorkoutSeconds > 0 ? clamp(elapsedWorkoutSeconds / totalWorkoutSeconds, 0, 1) : 0;

  const isTenSecondWarning =
    config.tenSecondAlert &&
    phase === 'work' &&
    status !== 'idle' &&
    status !== 'completed' &&
    timeLeft <= 10 &&
    timeLeft > 0;

  // Phase visual styling
  const getPhasePresentation = () => {
    if (status === 'completed') {
      return {
        label: 'TREINO CONCLUÍDO',
        subLabel: 'OSS! Todos os rounds finalizados',
        containerClass: 'bg-emerald-950/30 border-emerald-500/60 text-emerald-400',
        clockClass: 'text-emerald-400',
        barClass: 'bg-emerald-500',
        icon: <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />,
      };
    }
    if (status === 'paused') {
      return {
        label: `PAUSADO · ${
          phase === 'prep' ? 'PREPARO' : phase === 'work' ? 'EM LUTA' : 'DESCANSO'
        }`,
        subLabel: 'Toque em Retomar para continuar o relógio',
        containerClass: 'bg-amber-950/20 border-amber-500/50 text-amber-400',
        clockClass: 'text-gray-300',
        barClass: 'bg-amber-500',
        icon: <Pause className="w-4 h-4 text-amber-400 shrink-0" />,
      };
    }
    if (status === 'idle') {
      return {
        label: 'PRONTO PARA INICIAR',
        subLabel: `${config.rounds} rounds · Luta ${formatMMSS(config.workSeconds)} · Descanso ${formatMMSS(config.restSeconds)}`,
        containerClass: 'bg-[#1A1A1A] border-[#333] text-gray-300',
        clockClass: 'text-white',
        barClass: 'bg-orange-600',
        icon: <Swords className="w-4 h-4 text-orange-600 shrink-0" />,
      };
    }
    if (phase === 'prep') {
      return {
        label: 'PREPARE-SE',
        subLabel: 'Começa em instantes...',
        containerClass: 'bg-amber-950/30 border-amber-500/70 text-amber-400',
        clockClass: 'text-amber-400',
        barClass: 'bg-amber-500',
        icon: <Bell className="w-4 h-4 text-amber-400 shrink-0" />,
      };
    }
    if (phase === 'work') {
      if (isTenSecondWarning) {
        return {
          label: '10 SEGUNDOS PARA ACABAR!',
          subLabel:
            currentRound < config.rounds
              ? `Prepare-se · Próximo: ${config.restSeconds > 0 ? `Descanso ${formatMMSS(config.restSeconds)}` : `Round ${currentRound + 1}`}`
              : 'Reta final do último round!',
          containerClass: 'bg-rose-950/40 border-rose-500/80 text-rose-400',
          clockClass: 'text-rose-500',
          barClass: 'bg-rose-500',
          icon: <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />,
        };
      }
      return {
        label: 'EM LUTA',
        subLabel:
          currentRound < config.rounds
            ? `Próximo: ${config.restSeconds > 0 ? `Descanso ${formatMMSS(config.restSeconds)}` : `Round ${currentRound + 1}`}`
            : 'Último round do treino',
        containerClass: 'bg-orange-600/15 border-orange-600/70 text-orange-500',
        clockClass: 'text-white',
        barClass: 'bg-orange-600',
        icon: <Flame className="w-4 h-4 text-orange-500 shrink-0" />,
      };
    }
    return {
      label: 'DESCANSO',
      subLabel: `Próximo: Round ${currentRound + 1} (${formatMMSS(config.workSeconds)})`,
      containerClass: 'bg-sky-950/30 border-sky-500/60 text-sky-400',
      clockClass: 'text-sky-400',
      barClass: 'bg-sky-500',
      icon: <Shield className="w-4 h-4 text-sky-400 shrink-0" />,
    };
  };

  const phaseUI = getPhasePresentation();

  return (
    <div className="flex-grow bg-[#0A0A0A] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <motion.main
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[460px] sm:max-w-[540px] bg-[#111111] border-2 border-[#333] rounded-[44px] px-5 pt-9 pb-6 sm:p-8 sm:pt-10 shadow-[0_0_50px_rgba(225,29,72,0.1)] overflow-hidden"
      >
        {/* Top hardware aesthetic notch */}
        <div
          aria-hidden="true"
          className="h-5 w-28 bg-[#222] absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl border-x border-b border-[#333]"
        />

        {/* Header */}
        {/* <header className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Ativar som do cronômetro' : 'Silenciar som do cronômetro'}
              title={isMuted ? 'Ativar som (M)' : 'Silenciar som (M)'}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-[#0A0A0A] border-rose-500/50 text-rose-400 hover:border-rose-500'
                  : 'bg-[#1A1A1A] border-[#333] text-gray-300 hover:border-orange-600 hover:text-white'
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (isSettingsOpen) ensureValidWorkDuration();
                setIsSettingsOpen((prev) => !prev);
              }}
              aria-label={isSettingsOpen ? 'Fechar configurações' : 'Abrir configurações'}
              aria-expanded={isSettingsOpen}
              title="Configurações"
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                isSettingsOpen
                  ? 'bg-orange-600 border-orange-600 text-white hover:bg-orange-700'
                  : 'bg-[#1A1A1A] border-[#333] text-gray-300 hover:border-orange-600 hover:text-white'
              }`}
            >
              {isSettingsOpen ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
            </button>
          </div>
        </header> */}

        <AnimatePresence mode="wait">
          {isSettingsOpen ? (
            /* SETTINGS & PRESETS VIEW */
            <motion.section
              key="settings-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
              aria-label="Configurações do cronômetro"
            >
              {/* Quick Presets */}
              <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Modos Rápidos de Treino
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">
                    {activePreset === 'custom' ? 'Customizado' : 'Predefinido'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((preset) => {
                    const isSelected = activePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset.id)}
                        className={`text-left p-3 rounded-xl border transition-colors cursor-pointer min-h-[58px] ${
                          isSelected
                            ? 'bg-orange-600/15 border-orange-600 text-white'
                            : 'bg-[#0A0A0A] border-[#333] text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-black uppercase tracking-tight truncate">
                            {preset.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-gray-400 font-semibold mt-1 leading-tight">
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setActivePreset('custom')}
                    className={`text-left p-3 rounded-xl border transition-colors cursor-pointer min-h-[58px] ${
                      activePreset === 'custom'
                        ? 'bg-orange-600/15 border-orange-600 text-white'
                        : 'bg-[#0A0A0A] border-[#333] text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black uppercase tracking-tight truncate">
                        Customizado
                      </span>
                      {activePreset === 'custom' && (
                        <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 font-semibold mt-1 leading-tight">
                      Ajuste livre de tempos e rounds
                    </p>
                  </button>
                </div>
              </div>

              {/* Work & Rest Duration Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Fight Time */}
                <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Swords className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      Tempo de Luta
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Work Minutes */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 text-center">
                        Minutos
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Diminuir minutos de luta"
                          onClick={() =>
                            updateCustomConfig((c) => ({
                              ...c,
                              workSeconds: Math.max(5, c.workSeconds - 60),
                            }))
                          }
                          className="min-h-[44px] min-w-[36px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          aria-label="Minutos de luta"
                          value={workMins}
                          onChange={(e) => {
                            const mins = clamp(parseInt(e.target.value || '0', 10) || 0, 0, 59);
                            updateCustomConfig(
                              (c) => ({
                                ...c,
                                workSeconds: mins * 60 + (c.workSeconds % 60),
                              }),
                              false
                            );
                          }}
                          onBlur={ensureValidWorkDuration}
                          className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] focus:border-orange-600 focus:outline-none text-white font-mono font-bold text-center text-base rounded-xl tabular-nums"
                        />
                        <button
                          type="button"
                          aria-label="Aumentar minutos de luta"
                          onClick={() =>
                            updateCustomConfig((c) => ({
                              ...c,
                              workSeconds: Math.min(59 * 60 + 59, c.workSeconds + 60),
                            }))
                          }
                          className="min-h-[44px] min-w-[36px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Work Seconds */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 text-center">
                        Segundos
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Diminuir segundos de luta"
                          onClick={() =>
                            updateCustomConfig((c) => ({
                              ...c,
                              workSeconds: Math.max(5, c.workSeconds - 5),
                            }))
                          }
                          className="min-h-[44px] min-w-[36px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          aria-label="Segundos de luta"
                          value={workSecs}
                          onChange={(e) => {
                            const secs = clamp(parseInt(e.target.value || '0', 10) || 0, 0, 59);
                            updateCustomConfig(
                              (c) => ({
                                ...c,
                                workSeconds: Math.floor(c.workSeconds / 60) * 60 + secs,
                              }),
                              false
                            );
                          }}
                          onBlur={ensureValidWorkDuration}
                          className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] focus:border-orange-600 focus:outline-none text-white font-mono font-bold text-center text-base rounded-xl tabular-nums"
                        />
                        <button
                          type="button"
                          aria-label="Aumentar segundos de luta"
                          onClick={() =>
                            updateCustomConfig((c) => ({
                              ...c,
                              workSeconds: Math.min(59 * 60 + 59, c.workSeconds + 5),
                            }))
                          }
                          className="min-h-[44px] min-w-[36px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rest Time */}
                <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCw className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      Descanso
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Rest Minutes */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 text-center">
                        Minutos
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Diminuir minutos de descanso"
                          onClick={() =>
                            updateCustomConfig((c) => ({
                              ...c,
                              restSeconds: Math.max(0, c.restSeconds - 60),
                            }))
                          }
                          className="min-h-[44px] min-w-[36px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          aria-label="Minutos de descanso"
                          value={restMins}
                          onChange={(e) => {
                            const mins = clamp(parseInt(e.target.value || '0', 10) || 0, 0, 30);
                            updateCustomConfig((c) => ({
                              ...c,
                              restSeconds: mins * 60 + (c.restSeconds % 60),
                            }));
                          }}
                          className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] focus:border-orange-600 focus:outline-none text-white font-mono font-bold text-center text-base rounded-xl tabular-nums"
                        />
                        <button
                          type="button"
                          aria-label="Aumentar minutos de descanso"
                          onClick={() =>
                            updateCustomConfig((c) => ({
                              ...c,
                              restSeconds: Math.min(30 * 60, c.restSeconds + 60),
                            }))
                          }
                          className="min-h-[44px] min-w-[36px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Rest Seconds */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 text-center">
                        Segundos
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Diminuir segundos de descanso"
                          onClick={() =>
                            updateCustomConfig((c) => ({
                              ...c,
                              restSeconds: Math.max(0, c.restSeconds - 5),
                            }))
                          }
                          className="min-h-[44px] min-w-[36px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          aria-label="Segundos de descanso"
                          value={restSecs}
                          onChange={(e) => {
                            const secs = clamp(parseInt(e.target.value || '0', 10) || 0, 0, 59);
                            updateCustomConfig((c) => ({
                              ...c,
                              restSeconds: Math.floor(c.restSeconds / 60) * 60 + secs,
                            }));
                          }}
                          className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] focus:border-orange-600 focus:outline-none text-white font-mono font-bold text-center text-base rounded-xl tabular-nums"
                        />
                        <button
                          type="button"
                          aria-label="Aumentar segundos de descanso"
                          onClick={() =>
                            updateCustomConfig((c) => ({
                              ...c,
                              restSeconds: Math.min(30 * 60, c.restSeconds + 5),
                            }))
                          }
                          className="min-h-[44px] min-w-[36px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rounds Picker */}
              <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-white block">
                      Quantidade de Rounds
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      Tempo total estimado: {formatMMSS(totalWorkoutSeconds)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Diminuir rounds"
                      onClick={() =>
                        updateCustomConfig((c) => ({
                          ...c,
                          rounds: clamp(c.rounds - 1, 1, 20),
                        }))
                      }
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-mono font-black text-xl text-orange-500 tabular-nums">
                      {config.rounds}
                    </span>
                    <button
                      type="button"
                      aria-label="Aumentar rounds"
                      onClick={() =>
                        updateCustomConfig((c) => ({
                          ...c,
                          rounds: clamp(c.rounds + 1, 1, 20),
                        }))
                      }
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={20}
                  value={config.rounds}
                  aria-label="Selecionar quantidade de rounds"
                  onChange={(e) => {
                    const val = clamp(parseInt(e.target.value, 10) || 1, 1, 20);
                    updateCustomConfig((c) => ({ ...c, rounds: val }));
                  }}
                  className="w-full accent-orange-600 cursor-pointer h-2 bg-[#0A0A0A] rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-bold text-gray-500 mt-1 tabular-nums">
                  <span>1 round</span>
                  <span>10 rounds</span>
                  <span>20 rounds</span>
                </div>
              </div>

              {/* Alerts & Audio Test */}
              <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({ ...c, tenSecondAlert: !c.tenSecondAlert }))
                  }
                  className="flex items-center gap-3 text-left cursor-pointer min-h-[44px]"
                >
                  <div
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                      config.tenSecondAlert
                        ? 'bg-orange-600 justify-end'
                        : 'bg-[#0A0A0A] border border-[#333] justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white block" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-white block">
                      Aviso nos últimos 10s
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 block">
                      Alerta sonoro e visual no fim do treino
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.unlock();
                      if (isMuted) setIsMuted(false);
                      soundEngine.playFightStartGong(false);
                    }}
                    className="min-h-[44px] px-3.5 py-2 bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <Bell className="w-4 h-4 text-orange-500" />
                    <span>Gongo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.unlock();
                      if (isMuted) setIsMuted(false);
                      soundEngine.playTenSecondsAlert(false);
                    }}
                    className="min-h-[44px] px-3.5 py-2 bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Aviso 10s</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  ensureValidWorkDuration();
                  setIsSettingsOpen(false);
                }}
                className="w-full min-h-[52px] bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wider text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Aplicar e Voltar ao Timer
              </button>
            </motion.section>
          ) : (
            /* MAIN TIMER VIEW */
            <motion.section
              key="timer-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              {/* Quick Mode Selector Strip */}
              <div
                className="grid grid-cols-4 gap-1.5 p-1 bg-[#0A0A0A] border border-[#333] rounded-2xl"
                role="group"
                aria-label="Modos rápidos de treino"
              >
                {PRESETS.map((preset) => {
                  const active = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`min-h-[40px] px-2 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap truncate ${
                        active
                          ? 'bg-orange-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
                      }`}
                    >
                      {preset.shortLabel}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => applyPreset('custom')}
                  className={`min-h-[40px] px-2 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap truncate ${
                    activePreset === 'custom'
                      ? 'bg-orange-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Phase Indicator Banner */}
              <motion.div
                key={phaseUI.label}
                initial={{ opacity: 0.7, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.16 }}
                className={`rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 ${phaseUI.containerClass}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {phaseUI.icon}
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                      {phaseUI.label}
                    </p>
                    <p className="text-[11px] text-gray-400 font-semibold truncate">
                      {phaseUI.subLabel}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Round
                  </span>
                  <span className="font-mono font-black text-base sm:text-lg text-white tabular-nums">
                    {currentRound} / {config.rounds}
                  </span>
                </div>
              </motion.div>

              {/* Main Countdown Display */}
              <div
                className={`bg-[#1A1A1A] border rounded-2xl px-4 py-6 sm:py-8 text-center transition-colors ${
                  isTenSecondWarning
                    ? 'border-rose-500/70 shadow-[inset_0_0_32px_rgba(244,63,94,0.12)]'
                    : status === 'running' && phase === 'prep'
                    ? 'border-amber-500/60 shadow-[inset_0_0_32px_rgba(245,158,11,0.1)]'
                    : status === 'running' && phase === 'work'
                    ? 'border-orange-600/60'
                    : status === 'running' && phase === 'rest'
                    ? 'border-sky-500/50'
                    : 'border-[#333]'
                }`}
              >
                <motion.div
                  animate={
                    isTenSecondWarning || (status === 'running' && phase === 'prep')
                      ? { scale: [1, 1.03, 1] }
                      : { scale: 1 }
                  }
                  transition={
                    isTenSecondWarning || (status === 'running' && phase === 'prep')
                      ? { repeat: Infinity, duration: 0.85, ease: 'easeInOut' }
                      : { duration: 0.15 }
                  }
                  className={`font-mono font-black tabular-nums tracking-tight leading-none text-[4.5rem] sm:text-[6.25rem] select-none ${phaseUI.clockClass}`}
                  aria-live="polite"
                >
                  {formatMMSS(timeLeft)}
                </motion.div>

                {/* Phase Progress Bar */}
                <div className="mt-6 space-y-2">
                  <div className="w-full h-3 bg-[#0A0A0A] border border-[#333] rounded-xl overflow-hidden">
                    <motion.div
                      className={`h-full origin-left ${phaseUI.barClass}`}
                      initial={false}
                      animate={{ scaleX: phaseProgress }}
                      transition={{ duration: 0.15, ease: 'linear' }}
                    />
                  </div>

                  {/* Round Segments & Total Workout Progress */}
                  <div className="pt-1">
                    <div
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${config.rounds}, minmax(0, 1fr))`,
                      }}
                      aria-label={`Progresso de rounds: ${currentRound} de ${config.rounds}`}
                    >
                      {Array.from({ length: config.rounds }, (_, idx) => {
                        const roundNum = idx + 1;
                        const isDone =
                          status === 'completed' || roundNum < currentRound;
                        const isCurrent =
                          status !== 'completed' && roundNum === currentRound;

                        return (
                          <div
                            key={roundNum}
                            className={`h-2 rounded-sm transition-colors ${
                              isDone
                                ? 'bg-orange-600'
                                : isCurrent
                                ? phase === 'prep'
                                  ? 'bg-amber-500/60 border border-amber-400'
                                  : phase === 'rest'
                                  ? 'bg-sky-500/70 border border-sky-400'
                                  : 'bg-orange-600/45 border border-orange-500'
                                : 'bg-[#0A0A0A] border border-[#333]'
                            }`}
                          />
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 mt-2 tabular-nums">
                      <span>
                        Progresso total: {Math.round(totalProgress * 100)}%
                      </span>
                      <span>
                        Restante: {formatMMSS(remainingWorkoutSeconds)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary Controls */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handlePrevRound}
                    aria-label="Voltar round"
                    title="Voltar round (←)"
                    className="min-h-[56px] w-14 sm:w-16 flex items-center justify-center bg-[#1A1A1A] border border-[#333] hover:border-orange-600 text-white rounded-xl transition-colors cursor-pointer shrink-0 active:scale-95"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleStartPause}
                    className="flex-1 min-h-[56px] bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wider text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2.5 shadow-[0_8px_24px_rgba(234,88,12,0.25)] active:scale-[0.98]"
                  >
                    {status === 'running' ? (
                      <>
                        <Pause className="w-5 h-5 fill-current" />
                        <span>Pausar</span>
                      </>
                    ) : status === 'paused' ? (
                      <>
                        <Play className="w-5 h-5 fill-current" />
                        <span>Retomar</span>
                      </>
                    ) : status === 'completed' ? (
                      <>
                        <RotateCcw className="w-5 h-5" />
                        <span>Novo Treino</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" />
                        <span>Iniciar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleNextRound}
                    disabled={status === 'completed'}
                    aria-label="Avançar round"
                    title="Avançar round (→)"
                    className="min-h-[56px] w-14 sm:w-16 flex items-center justify-center bg-[#1A1A1A] border border-[#333] hover:border-orange-600 disabled:opacity-40 disabled:hover:border-[#333] text-white rounded-xl transition-colors cursor-pointer shrink-0 active:scale-95"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                {/* Secondary Action Row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="min-h-[46px] px-4 bg-[#0A0A0A] border border-[#333] hover:border-gray-500 text-gray-300 hover:text-white font-bold uppercase text-xs tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reiniciar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="min-h-[46px] px-4 bg-[#0A0A0A] border border-[#333] hover:border-orange-600 text-gray-300 hover:text-white font-bold uppercase text-xs tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-orange-500" />
                    <span>Configurações</span>
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </motion.main>

      {/* Quiet desktop keyboard hints */}
      {/* <footer className="hidden md:flex items-center gap-4 mt-5 text-[11px] font-bold tracking-wider uppercase text-gray-500">
        <span>Espaço: Iniciar / Pausar</span>
        <span aria-hidden="true">·</span>
        <span>R: Reiniciar</span>
        <span aria-hidden="true">·</span>
        <span>M: Som</span>
        <span aria-hidden="true">·</span>
        <span>← / →: Rounds</span>
      </footer> */}
    </div>
  );
}
