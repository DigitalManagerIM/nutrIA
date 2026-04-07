import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NuriAvatar from '../components/nuri/NuriAvatar';
import NuriBubble from '../components/nuri/NuriBubble';
import BottomNav from '../components/common/BottomNav';
import NuriFAB from '../components/nuri/NuriFAB';
import NuriNotification from '../components/nuri/NuriNotification';

type MealType = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';
type Stage = 'form' | 'analyzing' | 'result';

interface ItemDetail { nombre: string; cantidad: string; calorias: number; proteina: number; carbos: number; grasa: number; source?: 'usda' | 'estimate'; usdaFood?: string; }
interface Analysis { items: string[]; itemsDetail?: ItemDetail[]; calories: number; protein: number; carbs: number; fat: number; comment: string; analisis_personalizado?: string; usdaItemsCount?: number; }
interface FavoriteMeal { id: string; mealName: string | null; mealType: string; aiAnalysis: { calories?: number; protein?: number } | null; }

const MEAL_TYPES: { value: MealType; label: string; sublabel: string; emoji: string }[] = [
  { value: 'breakfast',       label: 'Desayuno',  sublabel: '',            emoji: '🌅' },
  { value: 'morning_snack',   label: 'Almuerzo',  sublabel: 'media mañana', emoji: '☀️' },
  { value: 'lunch',           label: 'Comida',    sublabel: 'mediodía',     emoji: '🍽️' },
  { value: 'afternoon_snack', label: 'Merienda',  sublabel: 'media tarde',  emoji: '🍌' },
  { value: 'dinner',          label: 'Cena',      sublabel: '',            emoji: '🌙' },
];

export default function FoodLogPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('form');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [mealDetails, setMealDetails] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [nuriAdvice, setNuriAdvice] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [logId, setLogId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);

  useEffect(() => {
    api.get('/food/favorites').then(({ data }) => setFavorites(data.data.favorites || [])).catch(() => {});
  }, []);

  const applyFavorite = (fav: FavoriteMeal) => {
    setMealType(fav.mealType as MealType);
    setMealDetails(fav.mealName || '');
  };

  const handleToggleFavorite = async () => {
    if (!logId) return;
    try {
      const { data } = await api.put(`/food/log/${logId}/favorite`);
      setIsFavorite(data.data.isFavorite);
      if (data.data.isFavorite) {
        api.get('/food/favorites').then(({ data: d }) => setFavorites(d.data.favorites || [])).catch(() => {});
      }
    } catch { /* ignore */ }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    setError('');
    setStage('analyzing');
    try {
      const form = new FormData();
      form.append('mealType', mealType);
      if (mealDetails) form.append('mealName', mealDetails);
      if (file) form.append('image', file);

      const { data } = await api.post('/food/log', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setAnalysis(data.data.aiAnalysis);
      setLogId(data.data.foodLog.id);
      setIsFavorite(false);
      setNewAchievements(data.data.newAchievements || []);
      if (data.data.nuriAdvice) setNuriAdvice(data.data.nuriAdvice);
      setStage('result');
    } catch {
      setError('Error al analizar. Inténtalo de nuevo.');
      setStage('form');
    }
  };

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-b from-primary to-[#0096B7] px-6 pt-10 pb-6">
        <NuriBubble
          message={stage === 'analyzing' ? 'Ohhh, eso tiene buena pinta. Déjame analizar...' : '¡Ñam! A ver qué me traes hoy...'}
          state={stage === 'analyzing' ? 'thinking' : 'chef'}
          onDark
        />
      </div>

      <div className="px-4 py-4">
        <AnimatePresence mode="wait">
          {stage === 'form' && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Favorites quick-select */}
              {favorites.length > 0 && (
                <div className="card">
                  <h3 className="font-bold text-gray-700 mb-2 text-sm">⭐ Comidas favoritas</h3>
                  <div className="flex flex-wrap gap-2">
                    {favorites.slice(0, 6).map(fav => (
                      <button key={fav.id} onClick={() => applyFavorite(fav)}
                        className="text-xs bg-accent/10 text-accent border border-accent/20 px-3 py-1.5 rounded-full font-medium active:bg-accent/20 transition-colors">
                        {fav.mealName || fav.mealType}{fav.aiAnalysis?.calories ? ` · ${Math.round(fav.aiAnalysis.calories)} kcal` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Meal type */}
              <div className="card">
                <h3 className="font-bold text-gray-700 mb-3">¿Qué comida es?</h3>
                <div className="grid grid-cols-5 gap-1.5">
                  {MEAL_TYPES.map((mt) => (
                    <button key={mt.value} onClick={() => setMealType(mt.value)}
                      className={`flex flex-col items-center py-2.5 rounded-card border-2 transition-all
                        ${mealType === mt.value ? 'border-primary bg-primary/10' : 'border-gray-100'}`}>
                      <span className="text-xl">{mt.emoji}</span>
                      <span className={`text-[10px] font-semibold mt-0.5 leading-tight text-center ${mealType === mt.value ? 'text-primary' : 'text-gray-600'}`}>{mt.label}</span>
                      {mt.sublabel && <span className={`text-[8px] leading-tight text-center ${mealType === mt.value ? 'text-primary/70' : 'text-gray-400'}`}>{mt.sublabel}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo */}
              <div className="card">
                <h3 className="font-bold text-gray-700 mb-3">Foto del plato</h3>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="preview" className="w-full h-48 object-cover rounded-card" />
                    <button onClick={() => { setPreview(null); setFile(null); }}
                      className="absolute top-2 right-2 bg-white/90 rounded-full w-8 h-8 flex items-center justify-center text-alert font-bold text-lg shadow">
                      ×
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full h-40 border-2 border-dashed border-gray-200 rounded-card flex flex-col items-center justify-center gap-2 text-gray-400 active:bg-gray-50">
                    <span className="text-4xl">📷</span>
                    <span className="text-sm font-medium">Toca para añadir foto</span>
                  </button>
                )}
              </div>

              {/* Details */}
              <div className="card">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Detalles del plato <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" className="input-field" placeholder="Ej: pan integral con salmón ahumado, leche desnatada..."
                  value={mealDetails} onChange={(e) => setMealDetails(e.target.value)} />
              </div>

              {error && <p className="text-alert text-sm text-center">{error}</p>}

              <motion.button onClick={handleSubmit} className="btn-primary w-full" whileTap={{ scale: 0.97 }}>
                {file ? '🦦 Analizar con NutrIA' : '📝 Registrar sin foto'}
              </motion.button>
            </motion.div>
          )}

          {stage === 'analyzing' && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center py-16 gap-6">
              <NuriAvatar state="thinking" size={120} />
              <div className="text-center">
                <p className="font-bold text-gray-700 text-lg">NutrIA está analizando...</p>
                <p className="text-sm text-gray-400 mt-1">Identificando ingredientes y calculando macros</p>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-2.5 h-2.5 rounded-full bg-primary"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }} />
                ))}
              </div>
            </motion.div>
          )}

          {stage === 'result' && analysis && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* NutrIA comment */}
              <NuriBubble message={analysis.comment || '¡Registrado! 🦦'} state="chef" />

              {/* Macros totals */}
              <div className="card">
                <h3 className="font-bold text-gray-700 mb-3">Análisis nutricional</h3>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Calorías', value: analysis.calories, unit: 'kcal', color: 'bg-orange-100 text-accent' },
                    { label: 'Proteína', value: analysis.protein, unit: 'g', color: 'bg-blue-100 text-primary' },
                    { label: 'Carbos', value: analysis.carbs, unit: 'g', color: 'bg-green-100 text-secondary' },
                    { label: 'Grasa', value: analysis.fat, unit: 'g', color: 'bg-yellow-100 text-yellow-600' },
                  ].map((m) => (
                    <div key={m.label} className={`${m.color} rounded-card p-2 text-center`}>
                      <p className="text-lg font-extrabold">{Math.round(m.value)}</p>
                      <p className="text-[10px] font-semibold opacity-70">{m.unit}</p>
                      <p className="text-[10px]">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Items detail table */}
                {analysis.itemsDetail && analysis.itemsDetail.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500">Desglose por alimento</p>
                      {(analysis.usdaItemsCount ?? 0) > 0 && (
                        <span className="text-[10px] bg-secondary/10 text-secondary font-bold px-2 py-0.5 rounded-full">
                          📊 {analysis.usdaItemsCount}/{analysis.itemsDetail.length} verificados USDA
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {analysis.itemsDetail.map((item, i) => (
                        <div key={i} className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0 gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-gray-700 leading-tight">{item.nombre}</p>
                              {item.source === 'usda' && (
                                <span className="text-[9px] bg-secondary/15 text-secondary font-bold px-1 py-0.5 rounded flex-shrink-0">USDA</span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400">{item.cantidad}</p>
                            {item.source === 'usda' && item.usdaFood && (
                              <p className="text-[9px] text-gray-300 italic truncate" title={item.usdaFood}>↳ {item.usdaFood}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-bold text-accent">{Math.round(item.calorias)} kcal</p>
                            <p className="text-[10px] text-gray-400">{Math.round(item.proteina)}P · {Math.round(item.carbos)}C · {Math.round(item.grasa)}G</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : analysis.items.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Identificado:</p>
                    <p className="text-sm text-gray-600">{analysis.items.join(', ')}</p>
                  </div>
                )}
              </div>

              {/* Personalised analysis */}
              {analysis.analisis_personalizado && (
                <div className="card bg-primary/5 border border-primary/15">
                  <div className="flex items-start gap-2">
                    <NuriAvatar state="scientist" size={28} animate={false} className="flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-700 leading-relaxed">{analysis.analisis_personalizado}</p>
                  </div>
                </div>
              )}

              {newAchievements.length > 0 && (
                <motion.div className="card bg-gold/10 border border-gold/40"
                  initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                  <p className="font-bold text-gold">🏆 ¡Logro desbloqueado!</p>
                  {newAchievements.map((a) => <p key={a} className="text-sm text-gray-600 mt-1">{a}</p>)}
                </motion.div>
              )}

              <motion.button onClick={() => navigate('/dashboard')} className="btn-primary w-full" whileTap={{ scale: 0.97 }}>
                ¡Perfecto, guardar!
              </motion.button>
              <button onClick={handleToggleFavorite}
                className={`w-full text-sm py-2.5 rounded-card border-2 font-semibold transition-all ${isFavorite ? 'border-accent text-accent bg-accent/10' : 'border-gray-200 text-gray-400 bg-white'}`}>
                {isFavorite ? '⭐ Guardado como favorito' : '☆ Guardar como favorito'}
              </button>
              <button onClick={() => { setStage('form'); setAnalysis(null); setPreview(null); setFile(null); }}
                className="btn-ghost w-full text-gray-400 text-sm">
                Registrar otro
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
      <NuriFAB />

      {nuriAdvice && (
        <NuriNotification message={nuriAdvice} onClose={() => setNuriAdvice(null)} />
      )}
    </div>
  );
}
