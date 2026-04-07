import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import NuriAvatar from '../components/nuri/NuriAvatar';
import MacroBar from '../components/nutrition/MacroBar';
import BottomNav from '../components/common/BottomNav';
import NuriFAB from '../components/nuri/NuriFAB';
import type { InitialEvaluation } from '../types/evaluation';

interface DailyTotals { calories: number; protein: number; carbs: number; fat: number; }
interface FoodLog {
  id: string; mealType: string; mealName: string | null;
  aiAnalysis: { calories?: number; protein?: number; carbs?: number; fat?: number } | null;
  adjustedData: { calories?: number; protein?: number; carbs?: number; fat?: number } | null;
  userAdjusted: boolean; loggedAt: string;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: '🌅 Desayuno',
  morning_snack: '☀️ Almuerzo',
  lunch: '🍽️ Comida',
  afternoon_snack: '🍌 Merienda',
  dinner: '🌙 Cena',
  snack: '🍎 Snack',
};

function getTodayLabel(): string {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'Europe/Madrid',
  });
}

function getGreeting(name: string): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return `¡Buenos días, ${name}! ¿Desayunamos juntos? Yo ya me comí 3 truchas.`;
  if (h >= 12 && h < 18) return `¡Buenas, ${name}! ¿Qué tal va ese día? Cuéntame qué has comido.`;
  if (h >= 18) return `¡Buenas noches, ${name}! Vamos a repasar el día antes de descansar.`;
  return `¿Tú no duermes, ${name}? NutrIA necesita sus horas...`;
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [totals, setTotals] = useState<DailyTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [nuriAdvice, setNuriAdvice] = useState('');
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [evaluation, setEvaluation] = useState<InitialEvaluation | null>(null);
  const [refreshingDiag, setRefreshingDiag] = useState(false);
  const [diagRefreshed, setDiagRefreshed] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const targetCalories = user?.targetCalories || 2000;
  const targetProtein = user?.targetProtein || 150;
  const targetCarbs = user?.targetCarbs || 200;
  const targetFat = user?.targetFat || 65;

  const loadDaily = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data } = await api.get(`/food/daily/${today}`);
      setTotals(data.data.totals);
      setLogs(data.data.logs);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    loadDaily();
    if (!user?.targetCalories) refreshUser();
    // Load evaluation for diagnostic card
    api.get('/stats').then(({ data }) => {
      if (data.data.evaluation) setEvaluation(data.data.evaluation);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || totals.calories === 0) return;
    const remaining = targetCalories - totals.calories;
    const proteinPct = (totals.protein / targetProtein) * 100;
    if (proteinPct < 50) {
      setNuriAdvice(`Llevas ${Math.round(totals.calories)} kcal y solo ${Math.round(totals.protein)}g de proteína. ¡Más pescadito!`);
    } else if (remaining > 0) {
      setNuriAdvice(`Llevas ${Math.round(totals.calories)} kcal, te quedan ~${Math.round(remaining)} kcal. ¡Vas bien!`);
    } else {
      setNuriAdvice(`¡Objetivo calórico cumplido! ${Math.round(totals.calories)} kcal. ¡Esa es mi nutria!`);
    }
  }, [totals, user]);

  const caloriePct = Math.min((totals.calories / targetCalories) * 100, 100);

  function buildTips(): { icon: string; text: string }[] {
    const tips: { icon: string; text: string }[] = [];
    const remaining = targetCalories - totals.calories;
    const proteinRemaining = targetProtein - totals.protein;
    const proteinPct = (totals.protein / targetProtein) * 100;

    if (proteinPct < 40 && totals.calories > 0) {
      tips.push({ icon: '🎯', text: `Llevas solo ${Math.round(totals.protein)}g de ${targetProtein}g de proteína. Añade una fuente proteica en tu próxima comida.` });
    } else if (proteinRemaining > 0) {
      tips.push({ icon: '💪', text: `Te faltan ${Math.round(proteinRemaining)}g de proteína para llegar a tu objetivo de ${targetProtein}g.` });
    }

    if (remaining > 500) {
      tips.push({ icon: '🔥', text: `Te quedan ${Math.round(remaining)} kcal para hoy. Distribuye bien las comidas que te queden.` });
    } else if (remaining > 0 && remaining <= 300) {
      tips.push({ icon: '✅', text: `¡Muy cerca! Solo ${Math.round(remaining)} kcal para llegar a tu objetivo diario de ${targetCalories} kcal.` });
    } else if (remaining < 0) {
      tips.push({ icon: '⚠️', text: `Has superado tu objetivo en ${Math.round(-remaining)} kcal. Intenta no picar más esta noche.` });
    }

    const fatPct = (totals.fat / targetFat) * 100;
    if (fatPct > 110 && totals.calories > 0) {
      tips.push({ icon: '🫒', text: `Llevas ${Math.round(totals.fat)}g de grasa (objetivo: ${targetFat}g). Modera las grasas en las próximas comidas.` });
    }

    if (tips.length === 0 && totals.calories === 0) {
      tips.push({ icon: '☀️', text: `¡Empieza el día registrando tu desayuno! Te ayudaré a llegar a tus ${targetCalories} kcal diarias.` });
    }

    return tips.slice(0, 3);
  }

  const tips = buildTips();

  const handleDeleteLog = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/food/log/${id}`);
      setConfirmDeleteId(null);
      await loadDaily();
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefreshDiagnostic = async () => {
    setRefreshingDiag(true);
    try {
      await api.post('/onboarding/evaluate');
      const { data } = await api.get('/stats');
      if (data.data.evaluation) {
        setEvaluation(data.data.evaluation);
        setDiagRefreshed(true);
        await refreshUser();
        setTimeout(() => setDiagRefreshed(false), 4000);
      }
    } catch { /* silently fail */ }
    finally { setRefreshingDiag(false); }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-[#0096B7] px-5 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-3">
          <NuriAvatar state="normal" size={56} className="flex-shrink-0" />
          <div>
            <p className="text-white/70 text-xs capitalize">{getTodayLabel()}</p>
            <p className="text-white font-bold text-base leading-tight">
              {nuriAdvice || getGreeting(user?.name || 'campeón')}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">

        {/* Calorie progress */}
        <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-between items-baseline mb-2">
            <h3 className="font-bold text-gray-700">Calorías hoy</h3>
            <span className={`text-sm font-bold ${totals.calories > targetCalories ? 'text-alert' : 'text-gray-500'}`}>
              {Math.round(totals.calories)} / {targetCalories} kcal
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-3">
            <motion.div
              className={`h-full rounded-full ${totals.calories > targetCalories ? 'bg-alert' : 'bg-gradient-to-r from-secondary to-primary'}`}
              initial={{ width: 0 }}
              animate={{ width: `${caloriePct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <div className="flex gap-2">
            <MacroBar label="Proteína" current={totals.protein} target={targetProtein} color="#FF9600" />
            <MacroBar label="Carbos" current={totals.carbs} target={targetCarbs} color="#00B4D8" />
            <MacroBar label="Grasa" current={totals.fat} target={targetFat} color="#58CC02" />
          </div>
          {!user?.targetCalories && (
            <p className="text-xs text-gray-400 text-center mt-2">Completa el onboarding para obtener tus objetivos personalizados</p>
          )}
        </motion.div>

        {/* NutrIA te recomienda hoy */}
        {tips.length > 0 && (
          <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
              <NuriAvatar state="normal" size={22} animate={false} />
              NutrIA te recomienda hoy
            </h3>
            <div className="space-y-2">
              {tips.map((tip, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-base flex-shrink-0 mt-0.5">{tip.icon}</span>
                  <p className="text-xs text-gray-600 leading-relaxed">{tip.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Diagnostic card (CAMBIO 7) */}
        {evaluation && (
          <motion.button
            className="card w-full text-left active:scale-98 transition-transform"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            onClick={() => setShowDiagnostic(true)}
          >
            <div className="flex items-center gap-3">
              <NuriAvatar state="scientist" size={44} animate={false} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-700 text-sm">Diagnóstico de NutrIA</p>
                <p className="text-xs text-gray-500 truncate">{evaluation.nuriMessage?.slice(0, 60)}...</p>
              </div>
              <div className="text-primary text-lg">→</div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">Toca para ver el informe completo</p>
          </motion.button>
        )}

        {/* Today's meals */}
        {logs.length > 0 ? (
          <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="font-bold text-gray-700 mb-3">Comidas de hoy</h3>
            <div className="space-y-2">
              {logs.map(log => {
                const analysis = log.userAdjusted ? log.adjustedData : log.aiAnalysis;
                const isConfirming = confirmDeleteId === log.id;
                const isDeleting = deletingId === log.id;
                return (
                  <div key={log.id} className="border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between py-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700 truncate">
                          {log.mealName || MEAL_LABELS[log.mealType] || log.mealType}
                        </p>
                        <div className="flex gap-2 mt-0.5">
                          {analysis?.protein != null && <span className="text-[10px] text-accent font-medium">{Math.round(analysis.protein)}g P</span>}
                          {analysis?.carbs != null && <span className="text-[10px] text-primary font-medium">{Math.round(analysis.carbs)}g C</span>}
                          {analysis?.fat != null && <span className="text-[10px] text-secondary font-medium">{Math.round(analysis.fat)}g G</span>}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {analysis?.calories ? `${Math.round(analysis.calories)} kcal` : '—'}
                      </span>
                      <button
                        onClick={() => setConfirmDeleteId(isConfirming ? null : log.id)}
                        className="text-gray-300 hover:text-alert active:text-alert transition-colors p-1 flex-shrink-0"
                        aria-label="Eliminar comida"
                      >
                        🗑️
                      </button>
                    </div>
                    <AnimatePresence>
                      {isConfirming && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2 pb-2">
                            <p className="text-xs text-gray-500 flex-1">¿Eliminar esta comida?</p>
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              disabled={isDeleting}
                              className="text-xs font-bold text-white bg-alert px-3 py-1 rounded-full disabled:opacity-50"
                            >
                              {isDeleting ? '...' : 'Sí, eliminar'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs font-semibold text-gray-400 px-2 py-1"
                            >
                              Cancelar
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            {logs.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Total: <strong className="text-gray-700">{Math.round(totals.calories)} kcal</strong></span>
                <span><strong className="text-accent">{Math.round(totals.protein)}g</strong> P · <strong className="text-primary">{Math.round(totals.carbs)}g</strong> C · <strong className="text-secondary">{Math.round(totals.fat)}g</strong> G</span>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div className="card text-center py-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <p className="text-4xl mb-2">🍽️</p>
            <p className="text-gray-500 text-sm">Aún no has registrado nada hoy.</p>
            <button onClick={() => navigate('/food')} className="btn-primary mt-4 text-sm px-6 py-2">
              Registrar primera comida
            </button>
          </motion.div>
        )}

        {/* Stats shortcut */}
        <motion.button
          className="card w-full flex items-center justify-between active:scale-98 transition-transform"
          onClick={() => navigate('/stats')}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <span className="font-semibold text-sm text-gray-700">Ver estadísticas completas</span>
          </div>
          <span className="text-gray-400">→</span>
        </motion.button>

      </div>

      <BottomNav />
      <NuriFAB />

      {/* Diagnostic Modal */}
      <AnimatePresence>
        {showDiagnostic && evaluation && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-bg-light"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Modal header */}
            <div className="bg-gradient-to-r from-primary to-[#0096B7] px-5 pt-12 pb-4 flex items-center gap-3">
              <NuriAvatar state="scientist" size={48} animate={false} />
              <div className="flex-1">
                <h2 className="text-white font-extrabold text-lg">Informe de NutrIA</h2>
                <p className="text-white/70 text-xs">Diagnóstico personalizado</p>
              </div>
              <button onClick={() => setShowDiagnostic(false)}
                className="text-white/80 w-8 h-8 flex items-center justify-center text-2xl font-bold">×</button>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-8">

              {/* Nuri message */}
              <div className="card bg-primary/5 border border-primary/20">
                <p className="text-sm text-gray-700 leading-relaxed italic">"{evaluation.nuriMessage}"</p>
              </div>

              {/* State */}
              <div className="card">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">📊 Estado actual</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{evaluation.summary}</p>
                {evaluation.currentState?.bmi && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full font-semibold">IMC: {evaluation.currentState.bmi}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{evaluation.currentState.bmiCategory}</span>
                    {evaluation.currentState.estimatedBodyFatPct && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">~{evaluation.currentState.estimatedBodyFatPct}% grasa</span>
                    )}
                  </div>
                )}
              </div>

              {/* Macros */}
              <div className="card">
                <h3 className="font-bold text-gray-800 mb-3">🎯 Plan calórico</h3>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: 'Calorías', value: evaluation.dailyCalories, unit: 'kcal', color: 'bg-orange-50 text-accent' },
                    { label: 'Proteína', value: Math.round(evaluation.dailyProtein), unit: 'g', color: 'bg-blue-50 text-primary' },
                    { label: 'Carbos', value: Math.round(evaluation.dailyCarbs), unit: 'g', color: 'bg-green-50 text-secondary' },
                    { label: 'Grasa', value: Math.round(evaluation.dailyFat), unit: 'g', color: 'bg-yellow-50 text-yellow-600' },
                  ].map(m => (
                    <div key={m.label} className={`${m.color} rounded-xl p-2 text-center`}>
                      <p className="text-base font-extrabold">{m.value}</p>
                      <p className="text-[10px] opacity-60">{m.unit}</p>
                      <p className="text-[10px] font-semibold">{m.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 text-center">
                  TMB: {evaluation.calorieBreakdown?.bmr} · TDEE: {evaluation.calorieBreakdown?.tdee} · {evaluation.calorieBreakdown?.adjustment}
                </p>
              </div>

              {/* Goals */}
              {evaluation.goals && (
                <div className="card">
                  <h3 className="font-bold text-gray-800 mb-3">🚀 Objetivos realistas</h3>
                  <div className="space-y-2">
                    {[
                      { label: '3 meses', value: evaluation.goals.threeMonths, color: 'text-secondary' },
                      { label: '6 meses', value: evaluation.goals.sixMonths, color: 'text-primary' },
                      { label: '12 meses', value: evaluation.goals.twelveMonths, color: 'text-accent' },
                    ].map(g => g.value && (
                      <div key={g.label} className="flex gap-2">
                        <span className={`text-xs font-bold ${g.color} w-14 flex-shrink-0 pt-0.5`}>{g.label}</span>
                        <p className="text-xs text-gray-600 leading-relaxed">{g.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blood test */}
              {evaluation.bloodTestAnalysis?.alertas && evaluation.bloodTestAnalysis.alertas.length > 0 && (
                <div className="card border border-alert/30 bg-alert/5">
                  <h3 className="font-bold text-alert mb-2">🩸 Alertas analítica</h3>
                  {evaluation.bloodTestAnalysis.resumen && <p className="text-xs text-gray-600 mb-2">{evaluation.bloodTestAnalysis.resumen}</p>}
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

              {/* Supplements */}
              {evaluation.supplementAnalysis?.resumen && (
                <div className="card">
                  <h3 className="font-bold text-gray-800 mb-2">💊 Suplementación</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{evaluation.supplementAnalysis.resumen}</p>
                  {evaluation.supplementAnalysis.faltan.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-gray-500 w-full">Te vendría bien añadir:</span>
                      {evaluation.supplementAnalysis.faltan.map(s => (
                        <span key={s} className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recommendations */}
              {evaluation.recommendations?.length > 0 && (
                <div className="card">
                  <h3 className="font-bold text-gray-800 mb-2">💡 Recomendaciones</h3>
                  <ul className="space-y-1.5">
                    {evaluation.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-2 items-start text-xs text-gray-600">
                        <span className="text-primary font-bold flex-shrink-0">→</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Refresh diagnosis */}
              <div className="card bg-gray-50 border border-gray-100">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl flex-shrink-0">🔄</span>
                  <div>
                    <p className="text-sm font-bold text-gray-700">Actualizar diagnóstico</p>
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                      NutrIA analizará todos tus datos actuales: peso, medidas, analíticas, historial de comidas y perfil completo para generar un diagnóstico nuevo.
                    </p>
                  </div>
                </div>
                {diagRefreshed && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-xs text-secondary font-semibold text-center mb-2">
                    ✅ ¡Diagnóstico actualizado con todos tus datos!
                  </motion.p>
                )}
                <motion.button
                  onClick={handleRefreshDiagnostic}
                  disabled={refreshingDiag}
                  className="w-full py-2.5 rounded-card border-2 border-primary text-primary font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.97 }}
                >
                  {refreshingDiag ? (
                    <>
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>🔄</motion.span>
                      Analizando todos tus datos...
                    </>
                  ) : '🧬 Actualizar diagnóstico ahora'}
                </motion.button>
              </div>

              <button
                onClick={() => { setShowDiagnostic(false); navigate('/stats'); }}
                className="btn-primary w-full text-sm"
              >
                Ver Mi Perfil completo →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
