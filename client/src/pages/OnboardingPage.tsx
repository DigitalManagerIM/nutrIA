import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import NuriAvatar from '../components/nuri/NuriAvatar';
import NuriBubble from '../components/nuri/NuriBubble';
import type { InitialEvaluation } from '../types/evaluation';

interface BloodValor {
  nombre: string;
  valor: number;
  unidad: string;
  rango_min?: number;
  rango_max?: number;
  estado: 'normal' | 'alto' | 'bajo';
}

// Steps 0-5 shown in progress bar, 6 = loading, 7 = result
const STEP_LABELS = ['Objetivo', 'Básicos', 'Medidas', 'Estilo', 'Analítica', 'Suplementos'];
const TOTAL_STEPS = 6;

const GOAL_OPTIONS = [
  { v: 'lose_fat',       emoji: '🔥', title: 'Perder grasa',      desc: 'Reducir % grasa manteniendo o ganando músculo' },
  { v: 'recomposition',  emoji: '⚡', title: 'Recomposición',     desc: 'Perder grasa y ganar músculo a la vez' },
  { v: 'gain_muscle',    emoji: '💪', title: 'Ganar músculo',     desc: 'Volumen limpio con mínima grasa acumulada' },
  { v: 'maintain',       emoji: '⚖️', title: 'Mantener',         desc: 'Mantener mi composición corporal actual' },
  { v: 'health',         emoji: '❤️', title: 'Mejorar salud',    desc: 'Mejorar energía, analítica y bienestar general' },
];

type NuriState = 'normal' | 'chef' | 'fitness' | 'scientist' | 'celebrating' | 'thinking' | 'worried';

const NURI_CONFIG: Array<{ state: NuriState; msg: string }> = [
  { state: 'normal',      msg: '¡Hola! Soy Nuri, tu nutria personal. Antes de nada, cuéntame qué quieres conseguir. ¡Es mi pregunta favorita!' },
  { state: 'normal',      msg: '¡Encantada! Cuéntame cómo eres físicamente. No te juzgo, soy una nutria objetiva.' },
  { state: 'scientist',   msg: '¡Cinta métrica en mano! Si no la tienes ahora, puedes saltarte esto sin problema.' },
  { state: 'fitness',     msg: 'Necesito saber cómo vives para saber cómo entrenarte. ¡No te juzgo!' },
  { state: 'scientist',   msg: 'Si tienes una analítica reciente, súbemela. Soy casi doctora... bueno, soy una nutria con gafas.' },
  { state: 'chef',        msg: '¿Tomas algo extra? Cuéntame y te digo si vas bien o si te sobra algo.' },
  { state: 'thinking',    msg: '¡Ya tengo todos tus datos! Déjame analizarlos... Esto puede tardar unos segundos.' },
  { state: 'celebrating', msg: '¡Ya te tengo calado/a! Aquí va mi diagnóstico. Sin edulcorar, como me gusta a mí. 🦦' },
];

export default function OnboardingPage() {
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [evaluation, setEvaluation] = useState<InitialEvaluation | null>(null);

  // Step 0: goal
  const [goal, setGoal] = useState('');

  // Step 1: basics
  const [sex, setSex] = useState('');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [hasSmartScale, setHasSmartScale] = useState<boolean | null>(null);
  const [scaleFile, setScaleFile] = useState<File | null>(null);
  const [scalePreview, setScalePreview] = useState<string | null>(null);
  const scaleRef = useRef<HTMLInputElement>(null);

  // Step 2: measurements
  const [chestCm, setChestCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [armCm, setArmCm] = useState('');
  const [thighCm, setThighCm] = useState('');

  // Step 3: lifestyle
  const [activityLevel, setActivityLevel] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [stressLevel, setStressLevel] = useState('');
  const [workType, setWorkType] = useState('');
  const [intermittentFasting, setIntermittentFasting] = useState(false);
  const [fastingHours, setFastingHours] = useState('');

  // Step 4: blood test
  const [bloodFile, setBloodFile] = useState<File | null>(null);
  const [bloodFileName, setBloodFileName] = useState('');
  const [bloodAnalyzing, setBloodAnalyzing] = useState(false);
  const [bloodExtracted, setBloodExtracted] = useState<BloodValor[] | null>(null);
  const bloodRef = useRef<HTMLInputElement>(null);

  // Step 5: supplements
  const [supplements, setSupplements] = useState('');

  // Trigger evaluation when reaching step 6 (loading screen)
  useEffect(() => {
    if (step === 6) {
      runEvaluation();
    }
  }, [step]);

  const goNext = () => { setError(''); setStep(s => s + 1); };
  const skip = () => goNext();

  const handleScaleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setScaleFile(f);
    setScalePreview(URL.createObjectURL(f));
  };

  const handleBloodFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBloodFile(f);
    setBloodFileName(f.name);
  };

  const saveStep = async () => {
    setError('');
    setLoading(true);
    try {
      if (step === 0) {
        if (!goal) { setError('Selecciona tu objetivo primero'); setLoading(false); return; }
        await api.put('/onboarding/goal', { goal });
      } else if (step === 1) {
        await api.put('/onboarding/basics', { sex, age, heightCm, weightKg, hasSmartScale });
        if (hasSmartScale && scaleFile) {
          const form = new FormData();
          form.append('image', scaleFile);
          await api.post('/onboarding/smart-scale', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
      } else if (step === 2) {
        await api.put('/onboarding/measurements', { chestCm, waistCm, hipCm, armCm, thighCm });
      } else if (step === 3) {
        await api.put('/onboarding/lifestyle', { activityLevel, sleepHours, stressLevel, workType, intermittentFasting, fastingHours: fastingHours || null });
      } else if (step === 4) {
        if (bloodFile && !bloodExtracted) {
          // First click: upload and show extracted values
          setBloodAnalyzing(true);
          const form = new FormData();
          form.append('file', bloodFile);
          const { data } = await api.post('/onboarding/blood-test', form, { headers: { 'Content-Type': 'multipart/form-data' } });
          const ed = data.data.extractedData as { valores?: BloodValor[] };
          setBloodExtracted(ed.valores || []);
          setBloodAnalyzing(false);
          setLoading(false);
          return; // don't advance yet — user sees the results first
        }
        // Second click (or no file): advance
      } else if (step === 5) {
        await api.put('/onboarding/supplements', { supplements });
      }
      goNext();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Error al guardar. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const runEvaluation = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/onboarding/evaluate');
      setEvaluation(data.data.evaluation);
      updateUser({ onboardingCompleted: true });
      setStep(7);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Error al generar la evaluación. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const nuriCfg = NURI_CONFIG[Math.min(step, 7)];

  return (
    <div className="min-h-screen flex flex-col bg-bg-light">
      {/* Progress bar (steps 0-5) */}
      {step < TOTAL_STEPS && (
        <div className="bg-white px-6 pt-4 pb-3 shadow-sm sticky top-0 z-10">
          <div className="flex justify-between mb-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${i < step ? 'bg-secondary text-white' : i === step ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-[9px] font-medium hidden sm:block ${i === step ? 'text-primary' : 'text-gray-300'}`}>{label}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
              animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {/* Nuri bubble */}
      {step < 8 && (
        <div className="px-6 pt-5">
          <NuriBubble message={nuriCfg.msg} state={nuriCfg.state} />
        </div>
      )}

      <div className="flex-1 px-5 pt-4 pb-6 flex flex-col">
        <AnimatePresence mode="wait">

          {/* ── STEP 0: Objetivo ── */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-3">
              <h2 className="text-xl font-bold text-gray-800">¿Cuál es tu objetivo?</h2>
              {GOAL_OPTIONS.map(opt => (
                <button key={opt.v} onClick={() => setGoal(opt.v)}
                  className={`w-full text-left px-4 py-3.5 rounded-card border-2 transition-all flex items-center gap-3
                    ${goal === opt.v ? 'border-primary bg-primary/10' : 'border-gray-100 bg-white'}`}>
                  <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                  <div>
                    <p className={`font-bold text-sm ${goal === opt.v ? 'text-primary' : 'text-gray-700'}`}>{opt.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                  {goal === opt.v && <span className="ml-auto text-primary text-lg">✓</span>}
                </button>
              ))}
            </motion.div>
          )}

          {/* ── STEP 1: Datos básicos ── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800">Datos básicos</h2>

              <div>
                <label className="label-field">Sexo</label>
                <div className="flex gap-2 mt-1">
                  {[{ v: 'male', l: '♂ Hombre' }, { v: 'female', l: '♀ Mujer' }, { v: 'other', l: '⚧ Otro' }].map(opt => (
                    <button key={opt.v} onClick={() => setSex(opt.v)}
                      className={`flex-1 py-2.5 rounded-card border-2 font-semibold text-sm transition-all
                        ${sex === opt.v ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Edad', val: age, set: setAge, ph: 'años' },
                  { label: 'Altura (cm)', val: heightCm, set: setHeightCm, ph: 'cm' },
                  { label: 'Peso (kg)', val: weightKg, set: setWeightKg, ph: 'kg' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="label-field">{f.label}</label>
                    <input type="number" className="input-field mt-1" placeholder={f.ph}
                      value={f.val} onChange={e => f.set(e.target.value)} />
                  </div>
                ))}
              </div>

              <div>
                <label className="label-field">¿Tienes báscula inteligente?</label>
                <div className="flex gap-2 mt-1">
                  {[{ v: true, l: '✅ Sí' }, { v: false, l: '❌ No' }].map(opt => (
                    <button key={String(opt.v)} onClick={() => setHasSmartScale(opt.v)}
                      className={`flex-1 py-2.5 rounded-card border-2 font-semibold text-sm transition-all
                        ${hasSmartScale === opt.v ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {hasSmartScale === true && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <input ref={scaleRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScaleFile} />
                    {scalePreview ? (
                      <div className="relative">
                        <img src={scalePreview} alt="Báscula" className="w-full h-40 object-cover rounded-card" />
                        <button onClick={() => { setScaleFile(null); setScalePreview(null); }}
                          className="absolute top-2 right-2 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center text-alert font-bold shadow">×</button>
                      </div>
                    ) : (
                      <button onClick={() => scaleRef.current?.click()}
                        className="w-full h-28 border-2 border-dashed border-primary/40 rounded-card flex flex-col items-center justify-center gap-1.5 text-primary/60 active:bg-primary/5">
                        <span className="text-3xl">📱</span>
                        <span className="text-xs font-medium">Subir foto de la báscula</span>
                        <span className="text-[10px] text-gray-400">La IA extrae % grasa, músculo, agua...</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── STEP 2: Medidas corporales ── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Medidas corporales</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Opcional</span>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-card p-3 flex items-start gap-3">
                <span className="text-2xl">📏</span>
                <div className="text-xs text-gray-600 leading-relaxed">
                  <p><strong>Pecho:</strong> a la altura de los pectorales</p>
                  <p><strong>Cintura:</strong> punto más estrecho, encima del ombligo</p>
                  <p><strong>Cadera:</strong> punto más ancho de los glúteos</p>
                  <p><strong>Brazo:</strong> bíceps contraído</p>
                  <p><strong>Muslo:</strong> a mitad del muslo</p>
                </div>
              </div>

              {[
                { label: 'Pecho', val: chestCm, set: setChestCm, emoji: '💪' },
                { label: 'Cintura', val: waistCm, set: setWaistCm, emoji: '⌛' },
                { label: 'Cadera', val: hipCm, set: setHipCm, emoji: '🔵' },
                { label: 'Brazo', val: armCm, set: setArmCm, emoji: '💪' },
                { label: 'Muslo', val: thighCm, set: setThighCm, emoji: '🦵' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="text-lg w-7">{f.emoji}</span>
                  <label className="text-sm font-semibold text-gray-600 w-16">{f.label}</label>
                  <input type="number" className="input-field flex-1" placeholder="cm"
                    value={f.val} onChange={e => f.set(e.target.value)} />
                  <span className="text-sm text-gray-400">cm</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* ── STEP 3: Estilo de vida ── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800">Estilo de vida</h2>

              <div>
                <label className="label-field">Nivel de actividad física</label>
                <div className="space-y-2 mt-1">
                  {[
                    { v: 'sedentary',   l: '🛋️ Sedentario', d: 'Trabajo de oficina, casi sin ejercicio' },
                    { v: 'light',       l: '🚶 Ligero',      d: '1-2 días de ejercicio a la semana' },
                    { v: 'moderate',    l: '🏃 Moderado',    d: '3-5 días de ejercicio a la semana' },
                    { v: 'active',      l: '💪 Activo',      d: '6-7 días de ejercicio intenso' },
                    { v: 'very_active', l: '🔥 Muy activo',  d: 'Dobles sesiones o trabajo físico intenso' },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => setActivityLevel(opt.v)}
                      className={`w-full text-left px-3 py-2.5 rounded-card border-2 transition-all
                        ${activityLevel === opt.v ? 'border-primary bg-primary/10' : 'border-gray-100 bg-white'}`}>
                      <p className={`font-semibold text-sm ${activityLevel === opt.v ? 'text-primary' : 'text-gray-700'}`}>{opt.l}</p>
                      <p className="text-xs text-gray-400">{opt.d}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Sueño (horas/noche)</label>
                  <input type="number" className="input-field mt-1" placeholder="7" min="3" max="12"
                    value={sleepHours} onChange={e => setSleepHours(e.target.value)} />
                </div>
                <div>
                  <label className="label-field">Estrés percibido (1-5)</label>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setStressLevel(String(n))}
                        className={`flex-1 h-10 rounded-lg border-2 font-bold text-sm transition-all
                          ${stressLevel === String(n) ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 text-gray-400'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="label-field">Tipo de trabajo</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { v: 'sitting',  l: '💻 Sentado' },
                    { v: 'standing', l: '🏪 De pie' },
                    { v: 'physical', l: '🏗️ Físico' },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => setWorkType(opt.v)}
                      className={`flex-1 py-2.5 rounded-card border-2 font-semibold text-xs transition-all
                        ${workType === opt.v ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intermittent fasting */}
              <div>
                <label className="label-field">Ayuno intermitente</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setIntermittentFasting(false)}
                    className={`flex-1 py-2.5 rounded-card border-2 font-semibold text-sm transition-all
                      ${!intermittentFasting ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500'}`}>
                    No practico
                  </button>
                  <button onClick={() => setIntermittentFasting(true)}
                    className={`flex-1 py-2.5 rounded-card border-2 font-semibold text-sm transition-all
                      ${intermittentFasting ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500'}`}>
                    ⏱️ Sí practico
                  </button>
                </div>
                {intermittentFasting && (
                  <div className="mt-2">
                    <label className="label-field text-xs">Ventana de ayuno (horas)</label>
                    <input type="number" className="input-field mt-1" placeholder="16" min="12" max="23"
                      value={fastingHours} onChange={e => setFastingHours(e.target.value)} />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: Analítica de sangre ── */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Analítica de sangre</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Opcional</span>
              </div>

              {/* Analyzing state */}
              {bloodAnalyzing && (
                <div className="card text-center py-8">
                  <NuriAvatar state="scientist" size={64} className="mx-auto mb-3" />
                  <p className="font-bold text-gray-700 text-sm">Analizando tu analítica...</p>
                  <p className="text-xs text-gray-400 mt-1">Esto puede tardar unos segundos</p>
                  <div className="flex justify-center gap-1 mt-4">
                    {[0,1,2].map(i => (
                      <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
                        animate={{ opacity: [0.3,1,0.3] }} transition={{ delay: i*0.2, repeat: Infinity, duration: 0.9 }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted values */}
              {!bloodAnalyzing && bloodExtracted && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-secondary/10 border border-secondary/30 rounded-card p-3">
                    <NuriAvatar state="scientist" size={36} animate={false} />
                    <p className="text-xs text-gray-700 font-medium">¡He leído tu analítica! Estos son los valores que he detectado. Pulsa continuar para seguir.</p>
                  </div>
                  <div className="card">
                    <h3 className="font-bold text-gray-700 text-sm mb-3">Valores extraídos ({bloodExtracted.length})</h3>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {bloodExtracted.map((v, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                          <span className="text-xs text-gray-700">{v.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-800">{v.valor} {v.unidad}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              v.estado === 'normal' ? 'bg-secondary/20 text-secondary' :
                              v.estado === 'alto' ? 'bg-alert/20 text-alert' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {v.estado === 'normal' ? '✓ Normal' : v.estado === 'alto' ? '↑ Alto' : '↓ Bajo'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Upload UI (when no file selected and not extracted yet) */}
              {!bloodAnalyzing && !bloodExtracted && (
                <>
                  <div className="bg-secondary/10 border border-secondary/30 rounded-card p-3 text-xs text-gray-600 leading-relaxed">
                    <p className="font-semibold text-secondary mb-1">¿Para qué sirve esto?</p>
                    <p>NutrIA analizará tu analítica para detectar deficiencias nutricionales y adaptar tus recomendaciones con datos reales.</p>
                    <p className="mt-1 text-gray-400">Acepta JPG, PNG o PDF. Máx 10MB.</p>
                  </div>

                  <input ref={bloodRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleBloodFile} />

                  {bloodFileName ? (
                    <div className="bg-white border-2 border-secondary rounded-card p-4 flex items-center gap-3">
                      <span className="text-3xl">📄</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-700 truncate">{bloodFileName}</p>
                        <p className="text-xs text-secondary">Archivo listo — pulsa Continuar para analizar</p>
                      </div>
                      <button onClick={() => { setBloodFile(null); setBloodFileName(''); }}
                        className="text-alert font-bold text-lg w-7 h-7 flex items-center justify-center">×</button>
                    </div>
                  ) : (
                    <button onClick={() => bloodRef.current?.click()}
                      className="w-full h-40 border-2 border-dashed border-gray-200 rounded-card flex flex-col items-center justify-center gap-2 text-gray-400 active:bg-gray-50 hover:border-primary/40 transition-colors">
                      <NuriAvatar state="scientist" size={52} animate={false} />
                      <span className="font-semibold text-sm">Subir analítica</span>
                      <span className="text-xs text-gray-300">Foto o PDF · Máx 10MB</span>
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── STEP 5: Suplementos ── */}
          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Suplementación</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Opcional</span>
              </div>

              <textarea
                className="input-field h-36 resize-none"
                placeholder="Ej: Proteína de suero 25g, Creatina 5g, Vitamina D 4000UI, Omega-3 1g..."
                value={supplements}
                onChange={e => setSupplements(e.target.value)}
              />

              <div className="bg-accent/10 border border-accent/30 rounded-card p-3 text-xs text-gray-600">
                <p>NutrIA analizará si tus suplementos son adecuados para tu objetivo, si te falta algo importante y si alguno es innecesario.</p>
              </div>
            </motion.div>
          )}

          {/* ── STEP 6: Evaluación IA — Loading ── */}
          {step === 6 && (
            <motion.div key="s6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 gap-6">
              <NuriAvatar state="thinking" size={120} />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-gray-800">NutrIA está analizando...</h2>
                <p className="text-sm text-gray-500">Calculando tus macros, analizando tu analítica y preparando tu plan personalizado</p>
              </div>

              <div className="w-full max-w-xs space-y-2">
                {[
                  'Calculando metabolismo basal...',
                  'Estimando composición corporal...',
                  'Analizando analítica de sangre...',
                  'Calculando macros objetivo...',
                  'Generando recomendaciones...',
                ].map((text, i) => (
                  <motion.div key={text} className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.6 }}>
                    <motion.div className="w-4 h-4 rounded-full bg-primary flex-shrink-0"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ delay: i * 0.6, duration: 0.4 }} />
                    <p className="text-xs text-gray-500">{text}</p>
                  </motion.div>
                ))}
              </div>

              {error && (
                <div className="text-center">
                  <p className="text-alert text-sm">{error}</p>
                  <button onClick={runEvaluation} className="btn-primary mt-3 text-sm px-6 py-2">Reintentar</button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP 7: Evaluation result ── */}
          {step === 7 && evaluation && (
            <motion.div key="s7" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="text-center pb-2">
                <NuriAvatar state="celebrating" size={100} className="mx-auto" />
                <h2 className="text-xl font-bold text-gray-800 mt-2">¡Tu diagnóstico inicial!</h2>
              </div>

              <div className="card bg-primary/5 border border-primary/20">
                <p className="text-sm text-gray-700 leading-relaxed italic">"{evaluation.nuriMessage}"</p>
              </div>

              <div className="card">
                <h3 className="font-bold text-gray-800 mb-3">🎯 Tus objetivos diarios</h3>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Calorías', value: evaluation.dailyCalories, unit: 'kcal', color: 'bg-orange-50 text-accent' },
                    { label: 'Proteína', value: Math.round(evaluation.dailyProtein), unit: 'g', color: 'bg-blue-50 text-primary' },
                    { label: 'Carbos', value: Math.round(evaluation.dailyCarbs), unit: 'g', color: 'bg-green-50 text-secondary' },
                    { label: 'Grasa', value: Math.round(evaluation.dailyFat), unit: 'g', color: 'bg-yellow-50 text-yellow-600' },
                  ].map(m => (
                    <div key={m.label} className={`${m.color} rounded-xl p-2.5 text-center`}>
                      <p className="text-lg font-extrabold">{m.value}</p>
                      <p className="text-[10px] opacity-60">{m.unit}</p>
                      <p className="text-[10px] font-semibold">{m.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                  TMB: {evaluation.calorieBreakdown?.bmr} kcal · TDEE: {evaluation.calorieBreakdown?.tdee} kcal · {evaluation.calorieBreakdown?.adjustment}
                </p>
              </div>

              <div className="card">
                <h3 className="font-bold text-gray-800 mb-2">📊 Estado actual</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{evaluation.summary}</p>
                {evaluation.currentState?.bmi && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <span className="bg-gray-100 px-2 py-1 rounded-full font-semibold">IMC: {evaluation.currentState.bmi}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded-full">{evaluation.currentState.bmiCategory}</span>
                    {evaluation.currentState.estimatedBodyFatPct && (
                      <span className="bg-gray-100 px-2 py-1 rounded-full">~{evaluation.currentState.estimatedBodyFatPct}% grasa</span>
                    )}
                  </div>
                )}
              </div>

              {evaluation.goals && (
                <div className="card">
                  <h3 className="font-bold text-gray-800 mb-3">🚀 Objetivos realistas</h3>
                  <div className="space-y-2">
                    {[
                      { label: '3 meses', value: evaluation.goals.threeMonths, color: 'text-secondary' },
                      { label: '6 meses', value: evaluation.goals.sixMonths, color: 'text-primary' },
                      { label: '12 meses', value: evaluation.goals.twelveMonths, color: 'text-accent' },
                    ].map(g => g.value && (
                      <div key={g.label} className="flex gap-2 items-start">
                        <span className={`text-xs font-bold ${g.color} w-14 flex-shrink-0 pt-0.5`}>{g.label}</span>
                        <p className="text-xs text-gray-600 leading-relaxed">{g.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evaluation.bloodTestAnalysis?.alertas && evaluation.bloodTestAnalysis.alertas.length > 0 && (
                <div className="card border border-alert/30 bg-alert/5">
                  <h3 className="font-bold text-alert mb-2">🩸 Alertas analítica</h3>
                  <div className="space-y-2">
                    {evaluation.bloodTestAnalysis.alertas.map((a, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${a.estado === 'alto' ? 'bg-alert/20 text-alert' : 'bg-blue-100 text-blue-600'}`}>
                          {a.estado === 'alto' ? '↑' : '↓'} {a.parametro}
                        </span>
                        <p className="text-xs text-gray-600">{a.recomendacion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evaluation.supplementAnalysis?.resumen && (
                <div className="card">
                  <h3 className="font-bold text-gray-800 mb-2">💊 Suplementación</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{evaluation.supplementAnalysis.resumen}</p>
                  {evaluation.supplementAnalysis.faltan.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-gray-500">Te vendría bien:</span>
                      {evaluation.supplementAnalysis.faltan.map(s => (
                        <span key={s} className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {evaluation.recommendations && evaluation.recommendations.length > 0 && (
                <div className="card">
                  <h3 className="font-bold text-gray-800 mb-2">💡 Recomendaciones</h3>
                  <ul className="space-y-1.5">
                    {evaluation.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-2 items-start text-xs text-gray-600">
                        <span className="text-primary font-bold flex-shrink-0">→</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <motion.button
                onClick={() => navigate('/dashboard')}
                className="btn-primary w-full"
                whileTap={{ scale: 0.97 }}
              >
                ¡Al dashboard! 🦦
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>

        {error && step !== 6 && (
          <p className="text-alert text-sm text-center mt-3">{error}</p>
        )}

        {/* Bottom buttons (steps 0-5) */}
        {step < TOTAL_STEPS && (
          <div className="flex gap-3 mt-6">
            {/* Skip on optional steps */}
            {[2, 4, 5].includes(step) && (
              <button onClick={skip} className="btn-ghost flex-1 text-gray-400 text-sm">
                Saltar
              </button>
            )}
            <motion.button
              onClick={saveStep}
              className={`btn-primary ${[2, 4, 5].includes(step) ? 'flex-1' : 'w-full'}`}
              whileTap={{ scale: 0.97 }}
              disabled={loading}
            >
              {loading
                ? '🦦 Guardando...'
                : step === TOTAL_STEPS - 1
                ? '¡Generar mi plan!'
                : 'Siguiente →'}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
