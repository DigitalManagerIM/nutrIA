import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NuriAvatar from '../components/nuri/NuriAvatar';
import NuriBubble from '../components/nuri/NuriBubble';
import BottomNav from '../components/common/BottomNav';
import NuriFAB from '../components/nuri/NuriFAB';
import WeightChart from '../components/stats/WeightChart';
import CalorieChart from '../components/stats/CalorieChart';
import type { InitialEvaluation } from '../types/evaluation';

/* ─── Types ─────────────────────────────────────────── */
interface WeightPoint { weightKg: number; bodyFatPct: number | null; muscleMassKg: number | null; recordedAt: string; }

interface BloodValor { nombre: string; valor: number; unidad: string; rango_min?: number; rango_max?: number; estado: 'normal' | 'alto' | 'bajo'; }
interface BloodTestData { valores?: BloodValor[]; notas?: string; fecha_estimada?: string; }

interface Measurement { chestCm: number | null; waistCm: number | null; hipCm: number | null; armCm: number | null; thighCm: number | null; measuredAt: string; }

interface ProfileUser {
  id: string; name: string; email: string;
  sex: string | null; age: number | null; heightCm: number | null;
  activityLevel: string | null; sleepHours: number | null; stressLevel: number | null; workType: string | null;
  supplements: string | null; intermittentFasting: boolean; fastingHours: number | null; mealPattern: string | null;
  goal: string | null; targetCalories: number | null; targetProtein: number | null; targetCarbs: number | null; targetFat: number | null;
  xp: number; level: number;
}

interface StatsData {
  user: { name: string; goal: string | null; targetCalories: number | null; targetProtein: number | null; targetCarbs: number | null; targetFat: number | null; xp: number; level: number; };
  evaluation: InitialEvaluation | null;
  evaluationDate: string | null;
  weightHistory: WeightPoint[];
  foodLogCount: number;
  weeklyAdherence: boolean[];
  latestBloodTest: { extractedData: BloodTestData | null; uploadedAt: string; testDate: string | null } | null;
}

/* ─── Constants ──────────────────────────────────────── */
const GOAL_LABELS: Record<string, string> = {
  lose_fat: '🔥 Perder grasa', recomposition: '⚡ Recomposición',
  gain_muscle: '💪 Ganar músculo', maintain: '⚖️ Mantener', health: '❤️ Mejorar salud',
};

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const ACTIVITY_OPTIONS = [
  { v: 'sedentary',    l: '🪑 Sedentario',   d: 'Poco o nada de ejercicio' },
  { v: 'light',        l: '🚶 Ligero',        d: '1-3 días/semana' },
  { v: 'moderate',     l: '🏃 Moderado',      d: '3-5 días/semana' },
  { v: 'active',       l: '🏋️ Activo',        d: '6-7 días/semana' },
  { v: 'very_active',  l: '⚡ Muy activo',    d: 'Atleta o trabajo físico' },
];

const MEAL_PATTERN_OPTIONS = [
  { v: '3_meals',  l: '🍽️ 3 comidas',      d: 'Desayuno, comida y cena' },
  { v: '5_meals',  l: '🥗 5 comidas',       d: '3 principales + 2 snacks' },
  { v: 'if_16_8',  l: '⏱️ Ayuno 16:8',     d: 'Ventana de 8h para comer' },
  { v: 'if_18_6',  l: '⏱️ Ayuno 18:6',     d: 'Ventana de 6h para comer' },
  { v: 'if_20_4',  l: '⏱️ Ayuno 20:4',     d: 'Ventana de 4h para comer' },
  { v: 'flexible', l: '🔀 Flexible',        d: 'Sin patrón fijo' },
];

/* ─── Component ──────────────────────────────────────── */
export default function StatsPage() {
  const navigate = useNavigate();

  // Stats data (from existing /stats endpoint)
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');

  // Profile data (from new /profile endpoint)
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [latestMeasurement, setLatestMeasurement] = useState<Measurement | null>(null);
  const [latestEvaluation, setLatestEvaluation] = useState<{ content: InitialEvaluation; createdAt: string } | null>(null);

  // UI state
  const [showWeightChart, setShowWeightChart] = useState(false);
  const [showCalorieChart, setShowCalorieChart] = useState(false);
  const [calorieWeekData, setCalorieWeekData] = useState<{ date: string; calories: number; target: number }[]>([]);

  // Blood test
  const [showBloodUpload, setShowBloodUpload] = useState(false);
  const [bloodUploading, setBloodUploading] = useState(false);
  const [bloodFiles, setBloodFiles] = useState<File[]>([]);
  const [bloodExtracted, setBloodExtracted] = useState<BloodValor[] | null>(null);
  const [showAllBlood, setShowAllBlood] = useState(false);
  const bloodRef = useRef<HTMLInputElement>(null);

  // Lifestyle edit section
  const [editingLifestyle, setEditingLifestyle] = useState(false);
  const [lsActivityLevel, setLsActivityLevel] = useState('');
  const [lsSleepHours, setLsSleepHours] = useState('');
  const [lsStressLevel, setLsStressLevel] = useState('');
  const [lsWorkType, setLsWorkType] = useState('');
  const [lsSupplements, setLsSupplements] = useState('');
  const [lsMealPattern, setLsMealPattern] = useState('');
  const [lsSaving, setLsSaving] = useState(false);
  const [lsSaved, setLsSaved] = useState(false);

  // Measurements section
  const [editingMeasurements, setEditingMeasurements] = useState(false);
  const [mChest, setMChest] = useState('');
  const [mWaist, setMWaist] = useState('');
  const [mHip, setMHip] = useState('');
  const [mArm, setMArm] = useState('');
  const [mThigh, setMThigh] = useState('');
  const [mSaving, setMSaving] = useState(false);
  const [mSaved, setMSaved] = useState(false);

  /* ─── Load data ─── */
  useEffect(() => {
    Promise.all([
      api.get('/stats'),
      api.get('/profile'),
    ]).then(([statsRes, profileRes]) => {
      const s = statsRes.data.data;
      setStats(s);
      if (s.user?.targetCalories) buildCalorieWeek(s.user.targetCalories).then(setCalorieWeekData);

      const p = profileRes.data.data;
      setProfile(p.user);
      setLatestMeasurement(p.latestMeasurement || null);
      if (p.latestEvaluation) setLatestEvaluation(p.latestEvaluation);

      // Pre-fill lifestyle form
      setLsActivityLevel(p.user.activityLevel || '');
      setLsSleepHours(p.user.sleepHours ? String(p.user.sleepHours) : '');
      setLsStressLevel(p.user.stressLevel ? String(p.user.stressLevel) : '');
      setLsWorkType(p.user.workType || '');
      setLsSupplements(p.user.supplements || '');
      setLsMealPattern(p.user.mealPattern || '');
    }).catch(() => setError('No se pudieron cargar los datos'))
      .finally(() => setStatsLoading(false));
  }, []);

  /* ─── Helpers ─── */
  async function buildCalorieWeek(target: number) {
    const days: { date: string; calories: number; target: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      try {
        const { data } = await api.get(`/food/daily/${dateStr}`);
        days.push({ date: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), calories: Math.round(data.data.totals.calories), target });
      } catch {
        days.push({ date: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), calories: 0, target });
      }
    }
    return days;
  }

  const handleBloodFile = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) setBloodFiles(prev => [...prev, ...selected]);
    e.target.value = '';
  };

  const handleBloodUpload = async () => {
    if (bloodFiles.length === 0) return;
    setBloodUploading(true);
    try {
      const form = new FormData();
      bloodFiles.forEach(f => form.append('files', f));
      const { data } = await api.post('/blood-test', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const ed = data.data.extractedData as BloodTestData;
      setBloodExtracted(ed.valores || []);
      const [statsRes, profileRes] = await Promise.all([api.get('/stats'), api.get('/profile')]);
      setStats(statsRes.data.data);
      if (profileRes.data.data.latestEvaluation) setLatestEvaluation(profileRes.data.data.latestEvaluation);
    } finally {
      setBloodUploading(false);
      setBloodFiles([]);
    }
  };

  const handleSaveLifestyle = async () => {
    setLsSaving(true);
    try {
      await api.put('/profile/lifestyle', {
        activityLevel: lsActivityLevel,
        sleepHours: lsSleepHours || null,
        stressLevel: lsStressLevel || null,
        workType: lsWorkType,
        supplements: lsSupplements,
        mealPattern: lsMealPattern,
      });
      setLsSaved(true);
      setEditingLifestyle(false);
      setTimeout(() => setLsSaved(false), 3000);
      // Reload profile + evaluation after re-eval (slight delay to let server finish)
      setTimeout(async () => {
        const res = await api.get('/profile');
        const p = res.data.data;
        setProfile(p.user);
        if (p.latestEvaluation) setLatestEvaluation(p.latestEvaluation);
      }, 2500);
    } finally {
      setLsSaving(false);
    }
  };

  const handleSaveMeasurements = async () => {
    setMSaving(true);
    try {
      const { data } = await api.put('/profile/measurements', {
        chestCm: mChest || undefined,
        waistCm: mWaist || undefined,
        hipCm: mHip || undefined,
        armCm: mArm || undefined,
        thighCm: mThigh || undefined,
      });
      setLatestMeasurement(data.data.measurement);
      setMSaved(true);
      setEditingMeasurements(false);
      setMChest(''); setMWaist(''); setMHip(''); setMArm(''); setMThigh('');
      setTimeout(() => setMSaved(false), 3000);
    } finally {
      setMSaving(false);
    }
  };

  /* ─── Loading / error ─── */
  if (statsLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light">
      <div className="text-center space-y-3">
        <div className="text-4xl animate-bounce">🦦</div>
        <p className="text-gray-500 text-sm">NutrIA está preparando tu ficha...</p>
      </div>
    </div>
  );

  if (error || !stats) return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <p className="text-alert">{error || 'Error cargando datos'}</p>
        <button onClick={() => window.location.reload()} className="btn-primary text-sm px-4 py-2">Reintentar</button>
      </div>
    </div>
  );

  const { user, evaluation: statsEval, evaluationDate, weightHistory, foodLogCount, weeklyAdherence, latestBloodTest } = stats;
  const evaluation = latestEvaluation?.content || statsEval;
  const evalDate = latestEvaluation?.createdAt || evaluationDate;
  const latestWeight = weightHistory[weightHistory.length - 1];
  const firstWeight = weightHistory[0];
  const weightDelta = latestWeight && firstWeight && weightHistory.length > 1 ? (latestWeight.weightKg - firstWeight.weightKg).toFixed(1) : null;

  /* ─── Blood test helpers ─── */
  const renderBloodRow = (v: BloodValor, i: number) => (
    <div key={i} className={`flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 ${v.estado !== 'normal' ? 'bg-alert/5 -mx-1 px-1 rounded' : ''}`}>
      <span className={`text-xs ${v.estado !== 'normal' ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{v.nombre}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-800">{v.valor} {v.unidad}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
          v.estado === 'normal' ? 'bg-secondary/20 text-secondary' :
          v.estado === 'alto' ? 'bg-alert/20 text-alert' : 'bg-blue-100 text-blue-600'
        }`}>{v.estado === 'normal' ? '✓' : v.estado === 'alto' ? '↑alto' : '↓bajo'}</span>
      </div>
    </div>
  );

  return (
    <div className="pb-24 bg-bg-light min-h-screen">

      {/* ── Header ── */}
      <div className="bg-gradient-to-b from-primary to-[#0096B7] px-6 pt-10 pb-6">
        <NuriBubble
          message="Aquí está toda tu ficha. ¡Todo lo que sé de ti en un sitio!"
          state="scientist"
          onDark
        />
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ── NutrIA Diagnosis ── */}
        {evaluation && (
          <motion.div className="space-y-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {evaluation.summary && (
              <div className="card bg-primary/5 border border-primary/15">
                <div className="flex items-start gap-2 mb-2">
                  <NuriAvatar state="scientist" size={30} animate={false} className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-sm">Diagnóstico de NutrIA</p>
                    {evalDate && <p className="text-[10px] text-gray-400">Actualizado {new Date(evalDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                  </div>
                </div>
                <p className="text-xs text-primary font-semibold italic mb-1">"{evaluation.nuriMessage}"</p>
                <p className="text-xs text-gray-600 leading-relaxed">{evaluation.summary}</p>
                {evaluation.currentState?.bmi && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-xs bg-white border border-primary/20 px-2 py-0.5 rounded-full font-semibold">IMC: {evaluation.currentState.bmi}</span>
                    <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full">{evaluation.currentState.bmiCategory}</span>
                    {evaluation.currentState.estimatedBodyFatPct && (
                      <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full">~{evaluation.currentState.estimatedBodyFatPct}% grasa</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {evaluation.bloodTestAnalysis?.alertas && evaluation.bloodTestAnalysis.alertas.length > 0 && (
              <div className="card border border-alert/30 bg-alert/5">
                <p className="font-bold text-alert text-sm mb-2">🩸 Alertas analítica</p>
                <div className="space-y-2">
                  {evaluation.bloodTestAnalysis.alertas.map((a, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${a.estado === 'alto' ? 'bg-alert/20 text-alert' : 'bg-blue-100 text-blue-600'}`}>
                        {a.estado === 'alto' ? '↑' : '↓'} {a.parametro}
                      </span>
                      <p className="text-xs text-gray-600">{a.recomendacion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {evaluation.recommendations && evaluation.recommendations.length > 0 && (
              <div className="card">
                <p className="font-bold text-gray-800 text-sm mb-2">💡 Recomendaciones</p>
                <ul className="space-y-1.5">
                  {evaluation.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 items-start text-xs text-gray-600">
                      <span className="text-primary font-bold flex-shrink-0 mt-0.5">→</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {!evaluation && (
          <div className="card text-center py-8">
            <p className="text-4xl mb-2">🦦</p>
            <p className="text-gray-500 text-sm">Completa el onboarding para ver tu diagnóstico</p>
          </div>
        )}

        {/* ── Objetivos diarios ── */}
        {user.targetCalories && (
          <motion.button className="card w-full text-left" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onClick={() => setShowCalorieChart(true)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">🎯 Objetivos diarios</h3>
              {user.goal && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">{GOAL_LABELS[user.goal] ?? user.goal}</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Calorías', value: user.targetCalories, unit: 'kcal', color: 'bg-orange-50 text-accent' },
                { label: 'Proteína', value: Math.round(user.targetProtein ?? 0), unit: 'g', color: 'bg-blue-50 text-primary' },
                { label: 'Carbos', value: Math.round(user.targetCarbs ?? 0), unit: 'g', color: 'bg-green-50 text-secondary' },
                { label: 'Grasa', value: Math.round(user.targetFat ?? 0), unit: 'g', color: 'bg-yellow-50 text-yellow-600' },
              ].map(m => (
                <div key={m.label} className={`${m.color} rounded-xl p-2.5 text-center`}>
                  <p className="text-lg font-extrabold">{m.value}</p>
                  <p className="text-[10px] opacity-60">{m.unit}</p>
                  <p className="text-[10px] font-semibold">{m.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-primary mt-2 text-center">Toca para ver gráfica →</p>
          </motion.button>
        )}

        <motion.button className="card w-full flex items-center justify-between" onClick={() => navigate('/goals')} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div className="text-left">
              <p className="font-semibold text-sm text-gray-700">Editar objetivos y macros</p>
              <p className="text-xs text-gray-400">Ajusta tu plan calórico manualmente</p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </motion.button>

        {/* ── Mis datos personales ── */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">👤 Mis datos</h3>
            <button onClick={() => setEditingLifestyle(p => !p)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${editingLifestyle ? 'bg-gray-100 text-gray-500' : 'bg-primary/10 text-primary'}`}>
              {editingLifestyle ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          {!editingLifestyle ? (
            /* Read-only view */
            <div className="space-y-2">
              {profile && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { l: 'Edad', v: profile.age ? `${profile.age} años` : '—' },
                      { l: 'Talla', v: profile.heightCm ? `${profile.heightCm} cm` : '—' },
                      { l: 'Sexo', v: profile.sex === 'male' ? 'Hombre' : profile.sex === 'female' ? 'Mujer' : '—' },
                    ].map(d => (
                      <div key={d.l} className="bg-gray-50 rounded-xl p-2.5 text-center">
                        <p className="text-sm font-bold text-gray-800">{d.v}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{d.l}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {[
                      { l: '🏃 Actividad', v: ACTIVITY_OPTIONS.find(a => a.v === profile.activityLevel)?.l || profile.activityLevel || '—' },
                      { l: '🍽️ Alimentación', v: MEAL_PATTERN_OPTIONS.find(m => m.v === profile.mealPattern)?.l || profile.mealPattern || '—' },
                      { l: '😴 Sueño', v: profile.sleepHours ? `${profile.sleepHours}h/noche` : '—' },
                      { l: '😓 Estrés', v: profile.stressLevel ? `${profile.stressLevel}/5` : '—' },
                      { l: '💊 Suplementación', v: profile.supplements || 'Ninguna' },
                    ].map(row => (
                      <div key={row.l} className="flex items-start justify-between py-1 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-500">{row.l}</span>
                        <span className="text-xs font-semibold text-gray-700 text-right max-w-[55%]">{row.v}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {lsSaved && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-secondary font-semibold text-center pt-1">
                  ✅ Guardado · NutrIA actualizará tu diagnóstico en breve
                </motion.p>
              )}
            </div>
          ) : (
            /* Edit form */
            <div className="space-y-4">
              {/* Meal pattern */}
              <div>
                <label className="label-field text-xs">🍽️ Tipo de alimentación</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  {MEAL_PATTERN_OPTIONS.map(opt => (
                    <button key={opt.v} onClick={() => setLsMealPattern(opt.v)}
                      className={`text-left px-3 py-2 rounded-xl border-2 transition-all ${lsMealPattern === opt.v ? 'border-primary bg-primary/10' : 'border-gray-100 bg-white'}`}>
                      <p className={`text-xs font-semibold ${lsMealPattern === opt.v ? 'text-primary' : 'text-gray-700'}`}>{opt.l}</p>
                      <p className="text-[10px] text-gray-400">{opt.d}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity level */}
              <div>
                <label className="label-field text-xs">🏃 Nivel de actividad</label>
                <div className="space-y-1.5 mt-1">
                  {ACTIVITY_OPTIONS.map(opt => (
                    <button key={opt.v} onClick={() => setLsActivityLevel(opt.v)}
                      className={`w-full text-left px-3 py-2 rounded-xl border-2 transition-all ${lsActivityLevel === opt.v ? 'border-primary bg-primary/10' : 'border-gray-100 bg-white'}`}>
                      <p className={`font-semibold text-xs ${lsActivityLevel === opt.v ? 'text-primary' : 'text-gray-700'}`}>{opt.l}</p>
                      <p className="text-[10px] text-gray-400">{opt.d}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Supplements */}
              <div>
                <label className="label-field text-xs">💊 Suplementación</label>
                <input type="text" className="input-field mt-1 text-sm" placeholder="Ej: creatina 5g, vitamina D, omega-3..."
                  value={lsSupplements} onChange={e => setLsSupplements(e.target.value)} />
              </div>

              {/* Sleep + stress in a row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field text-xs">😴 Sueño (h/noche)</label>
                  <input type="number" className="input-field mt-1 text-sm" placeholder="7" min="3" max="12"
                    value={lsSleepHours} onChange={e => setLsSleepHours(e.target.value)} />
                </div>
                <div>
                  <label className="label-field text-xs">😓 Estrés (1-5)</label>
                  <div className="flex gap-1 mt-1">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setLsStressLevel(String(n))}
                        className={`flex-1 h-9 rounded-lg border-2 font-bold text-xs transition-all ${lsStressLevel === String(n) ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 text-gray-400'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <motion.button onClick={handleSaveLifestyle} disabled={lsSaving}
                className="btn-primary w-full text-sm disabled:opacity-50" whileTap={{ scale: 0.97 }}>
                {lsSaving ? '⏳ Guardando...' : '💾 Guardar y actualizar diagnóstico'}
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* ── Medidas corporales ── */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">📏 Medidas corporales</h3>
            <button onClick={() => setEditingMeasurements(p => !p)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${editingMeasurements ? 'bg-gray-100 text-gray-500' : 'bg-primary/10 text-primary'}`}>
              {editingMeasurements ? 'Cancelar' : '+ Añadir'}
            </button>
          </div>

          {/* Last measurement display */}
          {latestMeasurement ? (
            <div className="mb-3">
              <p className="text-[10px] text-gray-400 mb-2">
                Última medición: {new Date(latestMeasurement.measuredAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { l: 'Pecho', v: latestMeasurement.chestCm },
                  { l: 'Cintura', v: latestMeasurement.waistCm },
                  { l: 'Cadera', v: latestMeasurement.hipCm },
                  { l: 'Brazo', v: latestMeasurement.armCm },
                  { l: 'Muslo', v: latestMeasurement.thighCm },
                ].map(m => (
                  <div key={m.l} className={`rounded-xl p-2 text-center ${m.v ? 'bg-secondary/10' : 'bg-gray-50'}`}>
                    <p className={`text-sm font-extrabold ${m.v ? 'text-secondary' : 'text-gray-300'}`}>{m.v ? `${m.v}` : '—'}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">{m.v ? 'cm' : ''}</p>
                    <p className="text-[9px] font-semibold text-gray-500">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : !editingMeasurements && (
            <div className="text-center py-3 mb-2">
              <p className="text-xs text-gray-400">No hay medidas registradas aún</p>
              <p className="text-[10px] text-gray-300 mt-0.5">NutrIA las tendrá en cuenta para afinar tu diagnóstico</p>
            </div>
          )}

          {/* Measurement input form */}
          <AnimatePresence>
            {editingMeasurements && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="pt-1 space-y-3">
                  <p className="text-xs text-gray-500">Rellena solo las que quieras. Todas en centímetros.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { l: 'Pecho (cm)', v: mChest, set: setMChest },
                      { l: 'Cintura (cm)', v: mWaist, set: setMWaist },
                      { l: 'Cadera (cm)', v: mHip, set: setMHip },
                      { l: 'Brazo (cm)', v: mArm, set: setMArm },
                    ].map(f => (
                      <div key={f.l}>
                        <label className="label-field text-xs">{f.l}</label>
                        <input type="number" className="input-field mt-1 text-sm" placeholder="—"
                          value={f.v} onChange={e => f.set(e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="label-field text-xs">Muslo (cm)</label>
                    <input type="number" className="input-field mt-1 text-sm" placeholder="—"
                      value={mThigh} onChange={e => setMThigh(e.target.value)} />
                  </div>
                  <motion.button onClick={handleSaveMeasurements} disabled={mSaving}
                    className="btn-primary w-full text-sm disabled:opacity-50" whileTap={{ scale: 0.97 }}>
                    {mSaving ? '⏳ Guardando...' : '📏 Guardar medidas'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {mSaved && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-secondary font-semibold text-center pt-2">
              ✅ Medidas guardadas · NutrIA actualizará tu diagnóstico
            </motion.p>
          )}
        </motion.div>

        {/* ── Analítica de sangre ── */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">🩸 Analítica de sangre</h3>
            <button onClick={() => setShowBloodUpload(true)}
              className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">
              + Subir nueva
            </button>
          </div>
          <input ref={bloodRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleBloodFile} />

          {latestBloodTest ? (() => {
            const valores = latestBloodTest.extractedData?.valores || [];
            const abnormal = valores.filter(v => v.estado !== 'normal');
            const normal = valores.filter(v => v.estado === 'normal');
            return (
              <>
                <p className="text-[10px] text-gray-400 mb-2">
                  {latestBloodTest.testDate
                    ? `Analítica del ${new Date(latestBloodTest.testDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : `Subida el ${new Date(latestBloodTest.uploadedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`}
                </p>
                {latestBloodTest.extractedData?.notas && (
                  <div className="flex items-start gap-2 mb-3 bg-primary/5 rounded-xl p-2.5 border border-primary/15">
                    <NuriAvatar state="scientist" size={22} animate={false} className="flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-700 leading-relaxed italic">{latestBloodTest.extractedData.notas}</p>
                  </div>
                )}
                {abnormal.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-alert mb-1.5">⚠️ Fuera de rango ({abnormal.length})</p>
                    <div className="space-y-0.5">{abnormal.map(renderBloodRow)}</div>
                  </div>
                )}
                {normal.length > 0 && (
                  <div>
                    {abnormal.length > 0 && (
                      <button onClick={() => setShowAllBlood(p => !p)}
                        className="text-xs font-semibold text-primary flex items-center gap-1 mb-1.5">
                        {showAllBlood ? '▾ Ocultar valores normales' : `▸ Ver completa (${normal.length} valores normales)`}
                      </button>
                    )}
                    <AnimatePresence>
                      {(showAllBlood || abnormal.length === 0) && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          {abnormal.length === 0 && <p className="text-xs font-semibold text-secondary mb-1.5">✅ Todos los valores en rango normal</p>}
                          <div className="space-y-0.5">{normal.map(renderBloodRow)}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {valores.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No se extrajeron valores</p>}
              </>
            );
          })() : (
            <div className="text-center py-4">
              <NuriAvatar state="scientist" size={48} animate={false} className="mx-auto mb-2" />
              <p className="text-gray-500 text-sm font-semibold">Sube tu analítica</p>
              <p className="text-xs text-gray-400 mt-1">NutrIA personalizará tus consejos con tus datos reales</p>
              <button onClick={() => setShowBloodUpload(true)} className="btn-primary mt-3 text-sm px-5 py-2">Subir analítica</button>
            </div>
          )}
        </motion.div>

        {/* ── Blood upload modal ── */}
        <AnimatePresence>
          {showBloodUpload && (
            <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/50" onClick={() => { setShowBloodUpload(false); setBloodFiles([]); setBloodExtracted(null); }} />
              <motion.div className="relative w-full max-w-app bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4"
                initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
                <div className="flex items-center gap-3">
                  <NuriAvatar state="scientist" size={44} animate={false} />
                  <div>
                    <p className="font-bold text-gray-800">Subir analítica de sangre</p>
                    <p className="text-xs text-gray-400">PDF, JPG o PNG · Puedes subir varias páginas</p>
                  </div>
                </div>
                {bloodExtracted ? (
                  <div className="space-y-3">
                    <p className="text-xs text-secondary font-semibold">✅ Analítica procesada — {bloodExtracted.length} valores extraídos</p>
                    <div className="max-h-56 overflow-y-auto space-y-1.5">
                      {bloodExtracted.map((v, i) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                          <span className="text-xs text-gray-700">{v.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{v.valor} {v.unidad}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${v.estado === 'normal' ? 'bg-secondary/20 text-secondary' : v.estado === 'alto' ? 'bg-alert/20 text-alert' : 'bg-blue-100 text-blue-600'}`}>
                              {v.estado === 'normal' ? '✓' : v.estado === 'alto' ? '↑' : '↓'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setShowBloodUpload(false); setBloodExtracted(null); }} className="btn-primary w-full text-sm">Cerrar</button>
                  </div>
                ) : bloodUploading ? (
                  <div className="text-center py-6">
                    <div className="flex justify-center gap-1 mb-3">
                      {[0,1,2].map(i => (
                        <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
                          animate={{ opacity: [0.3,1,0.3] }} transition={{ delay: i*0.2, repeat: Infinity, duration: 0.9 }} />
                      ))}
                    </div>
                    <p className="text-sm text-gray-500">Analizando con IA...</p>
                  </div>
                ) : (
                  <>
                    {bloodFiles.length > 0 ? (
                      <div className="space-y-2">
                        {bloodFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 p-2.5 bg-primary/5 border border-primary/20 rounded-card">
                            <span className="text-lg">{f.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                            <p className="text-xs text-gray-700 font-medium flex-1 truncate">{f.name}</p>
                            <button onClick={() => setBloodFiles(prev => prev.filter((_, j) => j !== i))} className="text-alert font-bold text-lg leading-none">×</button>
                          </div>
                        ))}
                        <button onClick={() => bloodRef.current?.click()} className="w-full py-2 border border-dashed border-gray-200 rounded-card text-xs text-gray-400 text-center">+ Añadir más páginas</button>
                      </div>
                    ) : (
                      <button onClick={() => bloodRef.current?.click()} className="w-full h-32 border-2 border-dashed border-gray-200 rounded-card flex flex-col items-center justify-center gap-2 text-gray-400">
                        <span className="text-3xl">🩸</span>
                        <span className="text-sm font-medium">PDF o fotos de la analítica</span>
                        <span className="text-xs">Puedes añadir varias páginas</span>
                      </button>
                    )}
                    <button onClick={handleBloodUpload} disabled={bloodFiles.length === 0} className="btn-primary w-full text-sm disabled:opacity-40">
                      Analizar con NutrIA {bloodFiles.length > 1 ? `(${bloodFiles.length} archivos)` : ''}
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Evolución del peso ── */}
        {weightHistory.length > 0 && (
          <motion.button className="card w-full text-left" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onClick={() => setShowWeightChart(true)}>
            <h3 className="font-bold text-gray-800 mb-3">⚖️ Evolución del peso</h3>
            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-800">{latestWeight.weightKg} <span className="text-sm font-normal text-gray-400">kg</span></p>
                <p className="text-xs text-gray-400">Actual</p>
              </div>
              {weightDelta && (
                <div className="text-center">
                  <p className={`text-xl font-extrabold ${parseFloat(weightDelta) < 0 ? 'text-secondary' : 'text-accent'}`}>
                    {parseFloat(weightDelta) > 0 ? '+' : ''}{weightDelta} kg
                  </p>
                  <p className="text-xs text-gray-400">vs inicio</p>
                </div>
              )}
              {latestWeight.bodyFatPct && (
                <div className="text-center">
                  <p className="text-xl font-extrabold text-primary">{latestWeight.bodyFatPct}%</p>
                  <p className="text-xs text-gray-400">Grasa corporal</p>
                </div>
              )}
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {[...weightHistory].reverse().slice(0, 5).map((w, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-500 py-0.5">
                  <span>{new Date(w.recordedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                  <span className="font-semibold text-gray-700">{w.weightKg} kg</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-primary mt-2 text-center">Toca para ver gráfica completa →</p>
          </motion.button>
        )}

        {/* ── Adherencia ── */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="font-bold text-gray-800 mb-3">📅 Adherencia últimos 7 días</h3>
          <div className="flex justify-between gap-1">
            {weeklyAdherence.map((logged, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-sm font-bold ${logged ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-300'}`}>
                  {logged ? '✓' : '·'}
                </div>
                <span className="text-[10px] text-gray-400">{DAY_LABELS[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">{weeklyAdherence.filter(Boolean).length}/7 días registrados</p>
            <span className="text-xs font-bold text-secondary">{Math.round((weeklyAdherence.filter(Boolean).length / 7) * 100)}% adherencia</span>
          </div>
        </motion.div>

        {/* ── Actividad total ── */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="font-bold text-gray-800 mb-3">📈 Actividad total</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/5 rounded-xl p-3 text-center">
              <p className="text-3xl font-extrabold text-primary">{foodLogCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">comidas registradas</p>
            </div>
            <div className="bg-accent/10 rounded-xl p-3 text-center">
              <p className="text-3xl font-extrabold text-accent">{weightHistory.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">pesajes registrados</p>
            </div>
          </div>
        </motion.div>

      </div>

      <BottomNav />
      <NuriFAB />

      {showWeightChart && <WeightChart data={weightHistory} onClose={() => setShowWeightChart(false)} />}
      {showCalorieChart && <CalorieChart data={calorieWeekData} target={user.targetCalories ?? 2000} onClose={() => setShowCalorieChart(false)} />}
    </div>
  );
}
