import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import NuriAvatar from '../components/nuri/NuriAvatar';
import NuriBubble from '../components/nuri/NuriBubble';
import BottomNav from '../components/common/BottomNav';
import NuriFAB from '../components/nuri/NuriFAB';

// ──────────────────── Types ────────────────────
interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  technique: string;
  alternatives: string[];
}
interface TrainingDay {
  dayNumber: number;
  name: string;
  muscleGroups: string[];
  exercises: Exercise[];
}
interface TrainingPlanContent {
  name: string;
  description: string;
  days: TrainingDay[];
  weeklyStructure: string;
  progressionNotes: string;
  nuriMessage: string;
}
interface TrainingPlan { id: string; name: string; description: string; content: TrainingPlanContent; createdAt: string; }
interface TrainingPreferences {
  daysPerWeek: number; sessionMinutes: number; equipment: string;
  experienceLevel: string; focusMuscles: string[]; injuries: string | null;
}
interface SetLog { done: boolean; weight: string; }

// ──────────────────── Constants ────────────────────
const EQUIPMENT_OPTIONS = [
  { value: 'gym',          label: 'Gimnasio',      emoji: '🏋️', desc: 'Máquinas, barras, mancuernas' },
  { value: 'home_full',    label: 'Casa completo',  emoji: '🏠', desc: 'Barra + mancuernas + banco' },
  { value: 'home_minimal', label: 'Casa básico',    emoji: '🪑', desc: 'Mancuernas o bandas elásticas' },
  { value: 'none',         label: 'Sin equipo',     emoji: '🤸', desc: 'Solo peso corporal' },
];
const EXPERIENCE_OPTIONS = [
  { value: 'beginner',     label: 'Principiante', emoji: '🌱', desc: 'Menos de 1 año entrenando' },
  { value: 'intermediate', label: 'Intermedio',   emoji: '💪', desc: '1-3 años de experiencia' },
  { value: 'advanced',     label: 'Avanzado',     emoji: '🏆', desc: 'Más de 3 años' },
];
const MUSCLE_GROUPS = [
  { value: 'chest',     label: 'Pecho',    emoji: '🫀' },
  { value: 'back',      label: 'Espalda',  emoji: '🔙' },
  { value: 'legs',      label: 'Piernas',  emoji: '🦵' },
  { value: 'shoulders', label: 'Hombros',  emoji: '🦴' },
  { value: 'arms',      label: 'Brazos',   emoji: '💪' },
  { value: 'core',      label: 'Core',     emoji: '🎯' },
  { value: 'glutes',    label: 'Glúteos',  emoji: '🍑' },
  { value: 'calves',    label: 'Gemelos',  emoji: '🦶' },
];

type AppView = 'loading' | 'wizard' | 'generating' | 'plan' | 'session';

const FREE_TYPES = [
  { value: 'free_cardio',   label: 'Cardio',          emoji: '🏃', kcalPerHour: 500 },
  { value: 'free_strength', label: 'Pesas/fuerza',    emoji: '🏋️', kcalPerHour: 300 },
  { value: 'class',         label: 'Clase dirigida',  emoji: '🤸', kcalPerHour: 350 },
  { value: 'sport',         label: 'Deporte',         emoji: '⚽', kcalPerHour: 450 },
  { value: 'hiit',          label: 'HIIT',            emoji: '🔥', kcalPerHour: 600 },
  { value: 'yoga',          label: 'Yoga/Pilates',    emoji: '🧘', kcalPerHour: 200 },
  { value: 'walk',          label: 'Caminar',         emoji: '🚶', kcalPerHour: 250 },
  { value: 'cycling',       label: 'Ciclismo',        emoji: '🚴', kcalPerHour: 400 },
];

// ──────────────────── Main Component ────────────────────
export default function TrainingPage() {
  const [view, setView] = useState<AppView>('loading');
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [preferences, setPreferences] = useState<TrainingPreferences | null>(null);
  const [recentLogs, setRecentLogs] = useState<{ dayName: string; completedAt: string; durationMin?: number }[]>([]);
  const [activeDay, setActiveDay] = useState<TrainingDay | null>(null);
  const [nuriMsg, setNuriMsg] = useState('');
  const [error, setError] = useState('');
  const [showFreeWorkout, setShowFreeWorkout] = useState(false);
  const [freeType, setFreeType] = useState('free_cardio');
  const [freeDesc, setFreeDesc] = useState('');
  const [freeDuration, setFreeDuration] = useState('45');
  const [freeSaving, setFreeSaving] = useState(false);
  const [freeSuccess, setFreeSuccess] = useState(false);

  // Wizard state
  const [wizStep, setWizStep] = useState(0);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [equipment, setEquipment] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [focusMuscles, setFocusMuscles] = useState<string[]>([]);
  const [injuries, setInjuries] = useState('');

  useEffect(() => { loadTraining(); }, []);

  const loadTraining = async () => {
    try {
      const { data } = await api.get('/training/plan');
      setPreferences(data.data.preferences);
      setRecentLogs(data.data.recentLogs || []);
      if (data.data.plan) {
        setPlan(data.data.plan);
        setView('plan');
      } else if (data.data.preferences) {
        await doGenerate();
      } else {
        setView('wizard');
      }
    } catch {
      setView('wizard');
    }
  };

  const handleFreeWorkout = async () => {
    if (!freeDuration || isNaN(parseInt(freeDuration))) return;
    setFreeSaving(true);
    try {
      const typeInfo = FREE_TYPES.find(t => t.value === freeType);
      const minutes = parseInt(freeDuration);
      const caloriesBurned = typeInfo ? Math.round((typeInfo.kcalPerHour / 60) * minutes) : 0;
      const sessionName = freeDesc.trim() || typeInfo?.label || 'Entrenamiento libre';
      await api.post('/training/log', {
        dayName: sessionName,
        exercises: [],
        durationMin: minutes,
        type: freeType,
        description: freeDesc.trim() || null,
        caloriesBurned,
      });
      setFreeSuccess(true);
      setFreeDesc('');
      setFreeDuration('45');
      await loadTraining();
      setTimeout(() => { setFreeSuccess(false); setShowFreeWorkout(false); }, 2000);
    } finally {
      setFreeSaving(false);
    }
  };

  const doGenerate = async () => {
    setView('generating');
    setError('');
    try {
      const { data } = await api.post('/training/generate');
      setPlan(data.data.plan);
      setNuriMsg(data.data.nuriMessage || '');
      setView('plan');
    } catch {
      setError('Error al generar el plan. Inténtalo de nuevo.');
      setView('plan');
    }
  };

  const handleWizardFinish = async () => {
    if (!equipment || !experienceLevel) return;
    setView('generating');
    try {
      await api.post('/training/preferences', {
        daysPerWeek, sessionMinutes, equipment, experienceLevel,
        focusMuscles, injuries: injuries || null,
      });
      await doGenerate();
    } catch {
      setError('Error al guardar preferencias.');
      setView('wizard');
    }
  };

  const toggleMuscle = (m: string) =>
    setFocusMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  // ── LOADING ──
  if (view === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light">
      <div className="text-4xl animate-bounce">🦦</div>
    </div>
  );

  // ── ACTIVE SESSION ──
  if (view === 'session' && activeDay) return (
    <ActiveSession
      day={activeDay}
      planId={plan?.id || null}
      onFinish={() => { setActiveDay(null); setView('plan'); loadTraining(); }}
    />
  );

  // ── GENERATING ──
  if (view === 'generating') return (
    <div className="min-h-screen bg-bg-light flex flex-col items-center justify-center gap-6 px-6">
      <NuriAvatar state="thinking" size={120} />
      <div className="text-center">
        <p className="font-bold text-gray-800 text-xl">NutrIA está diseñando tu plan...</p>
        <p className="text-sm text-gray-400 mt-1">Calculando volumen, frecuencia y ejercicios óptimos</p>
      </div>
      <div className="space-y-2 w-full max-w-xs">
        {['Analizando tu perfil...', 'Seleccionando ejercicios...', 'Calculando progresiones...'].map((t, i) => (
          <motion.div key={t} className="flex items-center gap-2 text-sm text-gray-500"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.8 }}>
            <motion.div className="w-2 h-2 rounded-full bg-primary"
              animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.3 }} />
            {t}
          </motion.div>
        ))}
      </div>
    </div>
  );

  // ── WIZARD ──
  if (view === 'wizard') return (
    <TrainingWizard
      wizStep={wizStep} setWizStep={setWizStep}
      daysPerWeek={daysPerWeek} setDaysPerWeek={setDaysPerWeek}
      sessionMinutes={sessionMinutes} setSessionMinutes={setSessionMinutes}
      equipment={equipment} setEquipment={setEquipment}
      experienceLevel={experienceLevel} setExperienceLevel={setExperienceLevel}
      focusMuscles={focusMuscles} toggleMuscle={toggleMuscle}
      injuries={injuries} setInjuries={setInjuries}
      onFinish={handleWizardFinish}
      error={error}
    />
  );

  // ── PLAN VIEW ──
  const content = plan?.content as TrainingPlanContent | undefined;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const completedDayNames = new Set(
    recentLogs.filter(l => new Date(l.completedAt) >= weekAgo).map(l => l.dayName)
  );

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-b from-primary to-[#0096B7] px-5 pt-10 pb-5">
        {nuriMsg ? (
          <NuriBubble message={nuriMsg} state="fitness" onDark />
        ) : (
          <div className="flex items-center gap-3">
            <NuriAvatar state="fitness" size={52} />
            <div>
              <h1 className="text-white font-extrabold text-xl">Mi plan de entreno</h1>
              <p className="text-white/70 text-xs">{content?.name || plan?.name}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">

        {error && <div className="card bg-alert/10 border border-alert/30 text-alert text-sm text-center py-3">{error}</div>}

        {/* Plan info */}
        {content && (
          <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-sm text-gray-600 leading-relaxed">{content.description}</p>
            {preferences && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{preferences.daysPerWeek} días/sem</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{preferences.sessionMinutes} min/sesión</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{preferences.equipment.replace('_', ' ')}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{preferences.experienceLevel}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Training days */}
        {content?.days.map((day, i) => {
          const isCompleted = completedDayNames.has(day.name);
          return (
            <motion.div key={day.dayNumber} className="card"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-1.5">
                    {isCompleted && <span className="text-secondary text-sm">✅</span>}
                    <h3 className="font-bold text-gray-800 text-sm leading-tight">{day.name}</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{day.exercises.length} ejercicios · {day.muscleGroups.join(', ')}</p>
                </div>
                <motion.button
                  onClick={() => { setActiveDay(day); setView('session'); setNuriMsg(''); }}
                  className="btn-primary text-xs px-3 py-1.5 flex-shrink-0"
                  whileTap={{ scale: 0.95 }}>
                  Empezar →
                </motion.button>
              </div>
              <div className="space-y-1 border-t border-gray-50 pt-2">
                {day.exercises.slice(0, 3).map((ex, j) => (
                  <div key={j} className="flex items-center justify-between text-xs text-gray-600 py-0.5">
                    <span className="font-medium truncate flex-1">{ex.name}</span>
                    <span className="text-gray-400 ml-2 flex-shrink-0">{ex.sets}×{ex.reps}</span>
                  </div>
                ))}
                {day.exercises.length > 3 && (
                  <p className="text-xs text-gray-400 text-center pt-1">+{day.exercises.length - 3} más</p>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Weekly structure & progression */}
        {content?.weeklyStructure && (
          <motion.div className="card bg-primary/5 border border-primary/20"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <p className="text-xs font-bold text-primary mb-1">📅 Distribución semanal</p>
            <p className="text-xs text-gray-600 leading-relaxed">{content.weeklyStructure}</p>
          </motion.div>
        )}
        {content?.progressionNotes && (
          <motion.div className="card bg-accent/5 border border-accent/20"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            <p className="text-xs font-bold text-accent mb-1">📈 Progresión</p>
            <p className="text-xs text-gray-600 leading-relaxed">{content.progressionNotes}</p>
          </motion.div>
        )}

        {/* Recent history */}
        {recentLogs.length > 0 && (
          <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <h3 className="font-bold text-gray-700 mb-3">🗂️ Historial reciente</h3>
            <div className="space-y-2">
              {recentLogs.slice(0, 5).map((log, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{log.dayName}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(log.completedAt).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {log.durationMin && <span className="text-xs text-gray-400">{log.durationMin} min</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Register free workout */}
        <motion.button
          onClick={() => setShowFreeWorkout(true)}
          className="card w-full flex items-center gap-3 active:scale-98 transition-transform"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">➕</span>
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-700 text-sm">Registrar entrenamiento libre</p>
            <p className="text-xs text-gray-400">Cardio, yoga, deporte, clase dirigida...</p>
          </div>
        </motion.button>

        <button onClick={() => { setPlan(null); setView('wizard'); setWizStep(0); setNuriMsg(''); }}
          className="btn-ghost w-full text-gray-400 text-sm">
          🔄 Cambiar preferencias y regenerar
        </button>
      </div>

      <BottomNav />
      <NuriFAB />

      {/* Free workout modal */}
      <AnimatePresence>
        {showFreeWorkout && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowFreeWorkout(false)} />
            <motion.div className="relative w-full max-w-app bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4"
              initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} transition={{ type: 'spring', damping: 28, stiffness: 280 }}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
              <div className="flex items-center gap-3">
                <NuriAvatar state="fitness" size={40} animate={false} />
                <div>
                  <p className="font-bold text-gray-800">Registrar entrenamiento</p>
                  <p className="text-xs text-gray-400">Te estimo las calorías quemadas</p>
                </div>
              </div>

              {freeSuccess ? (
                <motion.div className="text-center py-6" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                  <p className="text-4xl mb-2">🎉</p>
                  <p className="font-bold text-secondary text-lg">¡Entrenamiento registrado!</p>
                  <p className="text-xs text-gray-400 mt-1">¡Esa es mi nutria! Sigue así</p>
                </motion.div>
              ) : (
                <>
                  {/* Type selector */}
                  <div className="grid grid-cols-4 gap-2">
                    {FREE_TYPES.map(t => (
                      <button key={t.value} onClick={() => setFreeType(t.value)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-card border-2 transition-all
                          ${freeType === t.value ? 'border-primary bg-primary/5' : 'border-gray-100'}`}>
                        <span className="text-xl">{t.emoji}</span>
                        <span className={`text-[9px] font-semibold leading-tight text-center ${freeType === t.value ? 'text-primary' : 'text-gray-600'}`}>{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Description */}
                  <input type="text" className="input-field text-sm" placeholder='Ej: "45 min running por el Retiro"'
                    value={freeDesc} onChange={e => setFreeDesc(e.target.value)} />

                  {/* Duration */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Duración (minutos)</label>
                    <input type="number" className="input-field" placeholder="45"
                      value={freeDuration} onChange={e => setFreeDuration(e.target.value)} />
                    {freeDuration && !isNaN(parseInt(freeDuration)) && (
                      <p className="text-xs text-secondary mt-1">
                        Estimado: ~{Math.round(((FREE_TYPES.find(t => t.value === freeType)?.kcalPerHour || 350) / 60) * parseInt(freeDuration))} kcal quemadas
                      </p>
                    )}
                  </div>

                  <button onClick={handleFreeWorkout} disabled={freeSaving || !freeDuration}
                    className="btn-primary w-full text-sm disabled:opacity-40">
                    {freeSaving ? '🦦 Guardando...' : '✅ Registrar entrenamiento'}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────── Wizard Component ────────────────────
function TrainingWizard(props: {
  wizStep: number; setWizStep: (n: number) => void;
  daysPerWeek: number; setDaysPerWeek: (n: number) => void;
  sessionMinutes: number; setSessionMinutes: (n: number) => void;
  equipment: string; setEquipment: (s: string) => void;
  experienceLevel: string; setExperienceLevel: (s: string) => void;
  focusMuscles: string[]; toggleMuscle: (s: string) => void;
  injuries: string; setInjuries: (s: string) => void;
  onFinish: () => void; error: string;
}) {
  const {
    wizStep, setWizStep, daysPerWeek, setDaysPerWeek, sessionMinutes, setSessionMinutes,
    equipment, setEquipment, experienceLevel, setExperienceLevel,
    focusMuscles, toggleMuscle, injuries, setInjuries, onFinish, error,
  } = props;

  const totalSteps = 4;
  const canNext = () => (wizStep === 1 ? !!equipment : wizStep === 2 ? !!experienceLevel : true);

  return (
    <div className="pb-24 min-h-screen bg-bg-light">
      <div className="bg-gradient-to-b from-primary to-[#0096B7] px-5 pt-10 pb-5">
        <NuriBubble message="¡Vamos a crear tu plan de entreno personalizado! 🏋️ Responde unas preguntas rápidas." state="fitness" onDark />
      </div>

      <div className="px-4 pt-4 pb-0">
        <div className="flex gap-1 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= wizStep ? 'bg-primary' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
        <AnimatePresence mode="wait">

          {wizStep === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
              <div className="card">
                <h2 className="font-bold text-gray-800 mb-4">¿Cuántos días entrenas por semana?</h2>
                <div className="grid grid-cols-5 gap-2">
                  {[2, 3, 4, 5, 6].map(n => (
                    <button key={n} onClick={() => setDaysPerWeek(n)}
                      className={`py-3 rounded-card font-bold text-lg transition-all border-2
                        ${daysPerWeek === n ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2 className="font-bold text-gray-800 mb-4">¿Cuánto tiempo por sesión?</h2>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 45, 60, 90].map(n => (
                    <button key={n} onClick={() => setSessionMinutes(n)}
                      className={`py-3 rounded-card font-semibold text-sm transition-all border-2
                        ${sessionMinutes === n ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600'}`}>
                      {n}m
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {wizStep === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <div className="card">
                <h2 className="font-bold text-gray-800 mb-4">¿Con qué equipamiento cuentas?</h2>
                <div className="space-y-2">
                  {EQUIPMENT_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setEquipment(opt.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-card border-2 transition-all text-left
                        ${equipment === opt.value ? 'border-primary bg-primary/5' : 'border-gray-100'}`}>
                      <span className="text-2xl">{opt.emoji}</span>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${equipment === opt.value ? 'text-primary' : 'text-gray-700'}`}>{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.desc}</p>
                      </div>
                      {equipment === opt.value && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs">✓</div>}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {wizStep === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <div className="card">
                <h2 className="font-bold text-gray-800 mb-4">¿Cuál es tu nivel de experiencia?</h2>
                <div className="space-y-2">
                  {EXPERIENCE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setExperienceLevel(opt.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-card border-2 transition-all text-left
                        ${experienceLevel === opt.value ? 'border-primary bg-primary/5' : 'border-gray-100'}`}>
                      <span className="text-2xl">{opt.emoji}</span>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${experienceLevel === opt.value ? 'text-primary' : 'text-gray-700'}`}>{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.desc}</p>
                      </div>
                      {experienceLevel === opt.value && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs">✓</div>}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {wizStep === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
              <div className="card">
                <h2 className="font-bold text-gray-800 mb-1">¿Qué músculos quieres priorizar?</h2>
                <p className="text-xs text-gray-400 mb-3">Opcional — sin selección será equilibrado</p>
                <div className="grid grid-cols-4 gap-2">
                  {MUSCLE_GROUPS.map(mg => (
                    <button key={mg.value} onClick={() => toggleMuscle(mg.value)}
                      className={`flex flex-col items-center py-2.5 rounded-card border-2 transition-all
                        ${focusMuscles.includes(mg.value) ? 'border-primary bg-primary/10' : 'border-gray-100'}`}>
                      <span className="text-xl">{mg.emoji}</span>
                      <span className={`text-[10px] font-semibold mt-0.5 ${focusMuscles.includes(mg.value) ? 'text-primary' : 'text-gray-600'}`}>{mg.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2 className="font-bold text-gray-800 mb-2">Lesiones o limitaciones <span className="font-normal text-gray-400 text-sm">(opcional)</span></h2>
                <textarea
                  className="input-field resize-none h-20"
                  placeholder="Ej: Lesión de hombro derecho, dolor lumbar crónico..."
                  value={injuries}
                  onChange={e => setInjuries(e.target.value)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="text-alert text-sm text-center">{error}</p>}

        <div className="flex gap-3 pb-4">
          {wizStep > 0 && (
            <button onClick={() => setWizStep(wizStep - 1)} className="btn-ghost flex-1 text-gray-500">← Atrás</button>
          )}
          {wizStep < totalSteps - 1 ? (
            <motion.button
              onClick={() => canNext() && setWizStep(wizStep + 1)}
              className={`btn-primary flex-1 ${!canNext() ? 'opacity-50' : ''}`}
              whileTap={{ scale: canNext() ? 0.97 : 1 }}>
              Siguiente →
            </motion.button>
          ) : (
            <motion.button onClick={onFinish} className="btn-primary flex-1" whileTap={{ scale: 0.97 }}>
              🦦 Generar mi plan
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────── Active Session Component ────────────────────
function ActiveSession({ day, planId, onFinish }: { day: TrainingDay; planId: string | null; onFinish: () => void }) {
  const [sets, setSets] = useState<SetLog[][]>(
    day.exercises.map(ex => Array.from({ length: ex.sets }, () => ({ done: false, weight: '' })))
  );
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [expandedEx, setExpandedEx] = useState<number | null>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTime]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const toggleSet = (ei: number, si: number) => setSets(prev => {
    const next = prev.map(s => [...s]);
    next[ei][si] = { ...next[ei][si], done: !next[ei][si].done };
    return next;
  });

  const updateWeight = (ei: number, si: number, w: string) => setSets(prev => {
    const next = prev.map(s => [...s]);
    next[ei][si] = { ...next[ei][si], weight: w };
    return next;
  });

  const totalSets = sets.reduce((a, ex) => a + ex.length, 0);
  const doneSets = sets.reduce((a, ex) => a + ex.filter(s => s.done).length, 0);

  const handleFinish = async () => {
    setSaving(true);
    try {
      const exerciseLogs = day.exercises.map((ex, i) => ({
        name: ex.name,
        sets: sets[i].map((s, j) => ({ setNumber: j + 1, done: s.done, weight: s.weight || null })),
      }));
      await api.post('/training/log', {
        trainingPlanId: planId,
        dayName: day.name,
        exercises: exerciseLogs,
        durationMin: Math.floor(elapsed / 60),
      });
    } finally {
      setSaving(false);
      onFinish();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-light">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-[#0096B7] px-4 pt-10 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-white font-extrabold text-base leading-tight">{day.name}</h1>
            <p className="text-white/70 text-xs">{day.exercises.length} ejercicios · {day.muscleGroups.join(', ')}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-[10px]">Tiempo</p>
            <p className="text-white font-bold font-mono text-2xl">{fmt(elapsed)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div className="h-full bg-white rounded-full"
              animate={{ width: `${totalSets > 0 ? (doneSets / totalSets) * 100 : 0}%` }} />
          </div>
          <span className="text-white text-xs font-bold">{doneSets}/{totalSets} series</span>
        </div>
      </div>

      {/* Exercises */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-28">
        {day.exercises.map((ex, i) => {
          const exDone = sets[i].every(s => s.done);
          const isExpanded = expandedEx === i;
          return (
            <motion.div key={i}
              className={`card transition-all ${exDone ? 'opacity-60' : ''}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <button className="w-full flex items-center justify-between" onClick={() => setExpandedEx(isExpanded ? null : i)}>
                <div className="flex items-center gap-2 text-left">
                  {exDone && <span className="text-secondary">✅</span>}
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{ex.name}</p>
                    <p className="text-xs text-gray-400">{ex.sets}×{ex.reps} · Descanso: {ex.rest}</p>
                  </div>
                </div>
                <span className="text-gray-300 text-sm ml-2">{isExpanded ? '▲' : '▼'}</span>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-2 mb-3 p-2 bg-primary/5 rounded-card">
                      <p className="text-xs text-primary">💡 {ex.technique}</p>
                    </div>
                    <div className="space-y-2">
                      {sets[i].map((s, j) => (
                        <div key={j} className={`flex items-center gap-2 p-2 rounded-card transition-all ${s.done ? 'bg-secondary/10' : 'bg-gray-50'}`}>
                          <span className="text-xs font-bold text-gray-500 w-8 text-center">S{j + 1}</span>
                          <input type="number" placeholder="kg"
                            className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1 focus:border-primary focus:outline-none bg-white"
                            value={s.weight} onChange={e => updateWeight(i, j, e.target.value)} />
                          <span className="text-xs text-gray-400 flex-1">{ex.reps} reps</span>
                          <motion.button onClick={() => toggleSet(i, j)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all
                              ${s.done ? 'bg-secondary text-white' : 'bg-gray-200 text-gray-400'}`}
                            whileTap={{ scale: 0.85 }}>
                            {s.done ? '✓' : '○'}
                          </motion.button>
                        </div>
                      ))}
                    </div>
                    {ex.alternatives.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-2">Alternativas: {ex.alternatives.join(' · ')}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        <button onClick={onFinish} className="btn-ghost flex-shrink-0 text-gray-400 text-sm px-4">Cancelar</button>
        <motion.button onClick={handleFinish} disabled={saving} className="btn-primary flex-1" whileTap={{ scale: 0.97 }}>
          {saving ? '🦦 Guardando...' : `✅ Terminar (${doneSets}/${totalSets})`}
        </motion.button>
      </div>
    </div>
  );
}
