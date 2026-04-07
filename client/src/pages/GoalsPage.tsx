import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import NuriAvatar from '../components/nuri/NuriAvatar';
import BottomNav from '../components/common/BottomNav';
import NuriFAB from '../components/nuri/NuriFAB';

const GOALS = [
  { value: 'lose_fat',      label: 'Perder grasa',    emoji: '🔥', desc: 'Déficit calórico, proteína alta' },
  { value: 'recomposition', label: 'Recomposición',   emoji: '⚡', desc: 'Mantenimiento + mucha proteína' },
  { value: 'gain_muscle',   label: 'Ganar músculo',   emoji: '💪', desc: 'Superávit moderado' },
  { value: 'maintain',      label: 'Mantener',        emoji: '⚖️', desc: 'Calorías de mantenimiento' },
  { value: 'health',        label: 'Mejorar salud',   emoji: '❤️', desc: 'Equilibrio y bienestar' },
];

const STRATEGIES = [
  { value: 'aggressive_deficit', label: 'Déficit agresivo', desc: '-500 kcal/día', emoji: '🔥' },
  { value: 'moderate_deficit',   label: 'Déficit moderado', desc: '-300 kcal/día', emoji: '📉' },
  { value: 'maintenance',        label: 'Mantenimiento',    desc: 'TDEE',           emoji: '⚖️' },
  { value: 'light_surplus',      label: 'Superávit ligero', desc: '+200 kcal/día',  emoji: '📈' },
  { value: 'surplus',            label: 'Superávit',        desc: '+400 kcal/día',  emoji: '💪' },
];

const MACRO_DISTS = [
  { value: 'high_protein', label: 'Alta en proteína', desc: '35P / 35C / 30G', emoji: '🥩' },
  { value: 'balanced',     label: 'Equilibrada',      desc: '30P / 40C / 30G', emoji: '⚖️' },
  { value: 'high_carb',    label: 'Alta en carbos',   desc: '25P / 50C / 25G', emoji: '🍚' },
  { value: 'keto',         label: 'Keto',             desc: '30P / 10C / 60G', emoji: '🥑' },
];

// Map goal to suggested strategy
const SUGGESTED: Record<string, string> = {
  lose_fat: 'moderate_deficit',
  recomposition: 'maintenance',
  gain_muscle: 'light_surplus',
  maintain: 'maintenance',
  health: 'maintenance',
};

interface GoalsData {
  goal: string | null;
  targetCalories: number | null;
  targetProtein: number | null;
  targetCarbs: number | null;
  targetFat: number | null;
  sex?: string | null;
  age?: number | null;
  heightCm?: number | null;
  activityLevel?: string | null;
  currentWeightKg?: number | null;
}

interface Calculated { tmb: number; tdee: number; targetCalories: number; targetProtein: number; targetCarbs: number; targetFat: number; }

export default function GoalsPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<GoalsData>({ goal: null, targetCalories: null, targetProtein: null, targetCarbs: null, targetFat: null });
  const [strategy, setStrategy] = useState('moderate_deficit');
  const [macroDist, setMacroDist] = useState('high_protein');
  const [preview, setPreview] = useState<Calculated | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  const hasPhysicalData = !!(data.sex && data.age && data.heightCm && data.currentWeightKg);

  useEffect(() => {
    api.get('/goals').then(({ data: res }) => {
      setData(res.data);
    }).finally(() => setLoading(false));
  }, []);

  // When goal changes, suggest a strategy
  useEffect(() => {
    if (data.goal && SUGGESTED[data.goal]) setStrategy(SUGGESTED[data.goal]);
  }, [data.goal]);

  // Auto-preview calculation when strategy/distribution changes
  useEffect(() => {
    if (!hasPhysicalData || mode !== 'auto') return;
    api.put('/goals', { strategy, macroDistribution: macroDist })
      .then(({ data: res }) => { if (res.data.calculated) setPreview(res.data.calculated); })
      .catch(() => {});
  }, [strategy, macroDist, mode]);

  const handleSave = async () => {
    if (mode === 'manual' && (!data.targetCalories || !data.targetProtein || !data.targetCarbs || !data.targetFat)) {
      setError('Completa todos los campos de macros');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (mode === 'auto') {
        await api.put('/goals', { goal: data.goal, strategy, macroDistribution: macroDist });
      } else {
        await api.put('/goals', { goal: data.goal, targetCalories: data.targetCalories, targetProtein: data.targetProtein, targetCarbs: data.targetCarbs, targetFat: data.targetFat });
      }
      await refreshUser();
      setSaved(true);
      setTimeout(() => { setSaved(false); navigate('/dashboard'); }, 1800);
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const current = mode === 'auto' && preview ? preview : data;
  const totalFromMacros = current.targetProtein && current.targetCarbs && current.targetFat
    ? Math.round(current.targetProtein * 4 + current.targetCarbs * 4 + current.targetFat * 9)
    : null;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-4xl animate-bounce">🦦</div>
    </div>
  );

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-[#0096B7] px-5 pt-10 pb-5 flex items-center gap-3">
        <NuriAvatar state="scientist" size={52} />
        <div>
          <h1 className="text-white font-extrabold text-xl">Mis objetivos</h1>
          <p className="text-white/70 text-xs">NutrIA recalcula tus macros automáticamente</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Goal selector */}
        <div className="card">
          <h3 className="font-bold text-gray-700 mb-3">Objetivo principal</h3>
          <div className="grid grid-cols-1 gap-2">
            {GOALS.map((g) => (
              <motion.button key={g.value}
                onClick={() => setData(d => ({ ...d, goal: g.value }))}
                className={`w-full flex items-center gap-3 p-3 rounded-card border-2 transition-all text-left
                  ${data.goal === g.value ? 'border-primary bg-primary/5' : 'border-gray-100'}`}
                whileTap={{ scale: 0.98 }}>
                <span className="text-xl">{g.emoji}</span>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${data.goal === g.value ? 'text-primary' : 'text-gray-700'}`}>{g.label}</p>
                  <p className="text-xs text-gray-400">{g.desc}</p>
                </div>
                {data.goal === g.value && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs">✓</div>}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setMode('auto')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'auto' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}>
            🤖 Calcular automáticamente
          </button>
          <button onClick={() => setMode('manual')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'manual' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}>
            ✏️ Introducir manualmente
          </button>
        </div>

        {mode === 'auto' ? (
          <>
            {!hasPhysicalData && (
              <div className="card bg-alert/10 border border-alert/30 text-center py-4">
                <p className="text-sm text-alert font-semibold">Faltan datos físicos</p>
                <p className="text-xs text-gray-500 mt-1">Necesito tu peso, altura y edad para calcular. Están en el onboarding.</p>
              </div>
            )}

            {/* Strategy */}
            <div className="card">
              <h3 className="font-bold text-gray-700 mb-3">Estrategia</h3>
              <div className="space-y-2">
                {STRATEGIES.map(s => (
                  <button key={s.value} onClick={() => setStrategy(s.value)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-card border-2 transition-all text-left
                      ${strategy === s.value ? 'border-primary bg-primary/5' : 'border-gray-100'}`}>
                    <span className="text-lg">{s.emoji}</span>
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${strategy === s.value ? 'text-primary' : 'text-gray-700'}`}>{s.label}</p>
                      <p className="text-xs text-gray-400">{s.desc}</p>
                    </div>
                    {strategy === s.value && <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white text-[10px]">✓</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Macro distribution */}
            <div className="card">
              <h3 className="font-bold text-gray-700 mb-3">Distribución de macros</h3>
              <div className="grid grid-cols-2 gap-2">
                {MACRO_DISTS.map(m => (
                  <button key={m.value} onClick={() => setMacroDist(m.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-card border-2 transition-all
                      ${macroDist === m.value ? 'border-primary bg-primary/5' : 'border-gray-100'}`}>
                    <span className="text-2xl">{m.emoji}</span>
                    <p className={`font-semibold text-xs ${macroDist === m.value ? 'text-primary' : 'text-gray-700'}`}>{m.label}</p>
                    <p className="text-[10px] text-gray-400">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {preview && (
              <motion.div className="card bg-secondary/5 border border-secondary/20"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-xs font-semibold text-secondary mb-3">Resultado calculado (Mifflin-St Jeor)</p>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: 'Calorías', value: preview.targetCalories, unit: 'kcal', color: 'bg-orange-50 text-accent' },
                    { label: 'Proteína', value: preview.targetProtein, unit: 'g', color: 'bg-blue-50 text-primary' },
                    { label: 'Carbos', value: preview.targetCarbs, unit: 'g', color: 'bg-green-50 text-secondary' },
                    { label: 'Grasa', value: preview.targetFat, unit: 'g', color: 'bg-yellow-50 text-yellow-600' },
                  ].map(m => (
                    <div key={m.label} className={`${m.color} rounded-xl p-2 text-center`}>
                      <p className="text-base font-extrabold">{m.value}</p>
                      <p className="text-[10px] opacity-60">{m.unit}</p>
                      <p className="text-[9px] font-semibold">{m.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 text-center">TMB: {preview.tmb} kcal · TDEE: {preview.tdee} kcal</p>
              </motion.div>
            )}
          </>
        ) : (
          <div className="card">
            <h3 className="font-bold text-gray-700 mb-3">Plan calórico manual</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Calorías totales (kcal)</label>
                <input type="number" className="input-field" placeholder="Ej: 2000"
                  value={data.targetCalories ?? ''}
                  onChange={(e) => setData(d => ({ ...d, targetCalories: e.target.value ? parseInt(e.target.value) : null }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'targetProtein', label: 'Proteína', color: 'text-blue-600' },
                  { key: 'targetCarbs',   label: 'Carbos',   color: 'text-secondary' },
                  { key: 'targetFat',     label: 'Grasa',    color: 'text-yellow-600' },
                ].map(({ key, label, color }) => (
                  <div key={key}>
                    <label className={`block text-xs font-semibold mb-1 ${color}`}>{label} (g)</label>
                    <input type="number" className="input-field text-center" placeholder="0"
                      value={(data as unknown as Record<string, number | null>)[key] ?? ''}
                      onChange={(e) => setData(d => ({ ...d, [key]: e.target.value ? parseFloat(e.target.value) : null }))} />
                  </div>
                ))}
              </div>
              {totalFromMacros !== null && (
                <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-card ${
                  data.targetCalories && Math.abs(totalFromMacros - data.targetCalories) > 50
                    ? 'bg-alert/10 text-alert' : 'bg-secondary/10 text-secondary'
                }`}>
                  <span>Calorías de macros:</span>
                  <span className="font-bold">{totalFromMacros} kcal</span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-alert text-sm text-center">{error}</p>}

        <AnimatePresence>
          {saved && (
            <motion.div className="text-center text-secondary font-bold text-sm py-2"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              ✅ ¡Objetivos guardados! Redirigiendo...
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button onClick={handleSave} className="btn-primary w-full" whileTap={{ scale: 0.97 }} disabled={saving}>
          {saving ? '🦦 Guardando...' : 'Guardar objetivos'}
        </motion.button>

        <button onClick={() => navigate(-1)} className="btn-ghost w-full text-gray-400 text-sm">
          ← Volver
        </button>
      </div>

      <BottomNav />
      <NuriFAB />
    </div>
  );
}
