import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import NuriBubble from '../components/nuri/NuriBubble';
import BottomNav from '../components/common/BottomNav';
import NuriFAB from '../components/nuri/NuriFAB';

interface WeightEntry { id: string; weightKg: number; bodyFatPct?: number | null; muscleMassKg?: number | null; recordedAt: string; source: string; }

export default function WeightPage() {
  const [useSmartScale, setUseSmartScale] = useState(false);
  const [weightKg, setWeightKg] = useState('');
  const [scaleFile, setScaleFile] = useState<File | null>(null);
  const [scalePreview, setScalePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedEntry, setSavedEntry] = useState<{ weightKg: number; trend: number | null; bodyFatPct?: number | null; muscleMassKg?: number | null } | null>(null);
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/weight/history?limit=10').then(({ data }) => setHistory(data.data.entries)).catch(() => {});
  }, []);

  const handleScaleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setScaleFile(f);
    setScalePreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!useSmartScale && (!weightKg || isNaN(parseFloat(weightKg)))) {
      setError('Introduce un peso válido'); return;
    }
    if (useSmartScale && !scaleFile) {
      setError('Sube la foto de tu báscula'); return;
    }
    setError('');
    setLoading(true);
    try {
      let data;
      if (useSmartScale && scaleFile) {
        const form = new FormData();
        form.append('image', scaleFile);
        const res = await api.post('/weight/log', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        data = res.data;
      } else {
        const res = await api.post('/weight/log', { weightKg: parseFloat(weightKg) });
        data = res.data;
      }
      setSavedEntry({
        weightKg: data.data.entry?.weightKg ?? parseFloat(weightKg),
        trend: data.data.trend,
        bodyFatPct: data.data.entry?.bodyFatPct,
        muscleMassKg: data.data.entry?.muscleMassKg,
      });
      setSaved(true);
      const hist = await api.get('/weight/history?limit=10');
      setHistory(hist.data.data.entries);
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSaved(false);
    setSavedEntry(null);
    setWeightKg('');
    setScaleFile(null);
    setScalePreview(null);
    setError('');
  };

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-b from-primary to-[#0096B7] px-6 pt-10 pb-6">
        <NuriBubble
          message={saved
            ? '¡Peso anotado! Así es como se lleva un seguimiento serio. ¡Esa es mi nutria!'
            : '¿Cuánto marcan los kilos hoy? ¡Sé honesto/a, que soy una científica!'}
          state="scientist"
          onDark
        />
      </div>

      <div className="px-4 py-4 space-y-4">
        {!saved ? (
          <motion.div className="card space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-bold text-gray-700">Registrar peso</h3>

            {/* Smart scale toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-card">
              <div>
                <p className="font-semibold text-sm text-gray-700">📱 Báscula inteligente</p>
                <p className="text-xs text-gray-400">Subir foto para extraer todos los datos</p>
              </div>
              <button
                onClick={() => setUseSmartScale(!useSmartScale)}
                className={`w-12 h-6 rounded-full transition-all relative ${useSmartScale ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <motion.div
                  className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow"
                  animate={{ x: useSmartScale ? 26 : 2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {useSmartScale ? (
                <motion.div key="smart" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScaleFile} />
                  {scalePreview ? (
                    <div className="relative">
                      <img src={scalePreview} alt="Báscula" className="w-full h-48 object-cover rounded-card" />
                      <button onClick={() => { setScaleFile(null); setScalePreview(null); }}
                        className="absolute top-2 right-2 bg-white/90 rounded-full w-8 h-8 flex items-center justify-center text-alert font-bold shadow">×</button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full h-40 border-2 border-dashed border-primary/40 rounded-card flex flex-col items-center justify-center gap-2 text-primary/60 active:bg-primary/5">
                      <span className="text-4xl">📷</span>
                      <span className="text-sm font-semibold">Subir foto de la báscula</span>
                      <span className="text-xs text-gray-400">NutrIA extraerá % grasa, músculo, agua...</span>
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.1"
                      className="input-field flex-1 text-3xl font-bold text-center"
                      placeholder="75.0"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                    />
                    <span className="text-xl font-bold text-gray-400">kg</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && <p className="text-alert text-sm text-center">{error}</p>}

            <motion.button onClick={handleSubmit} className="btn-primary w-full" whileTap={{ scale: 0.97 }} disabled={loading}>
              {loading
                ? (useSmartScale ? '🦦 Analizando báscula...' : '🦦 Guardando...')
                : (useSmartScale ? '📊 Analizar con NutrIA' : 'Guardar peso')}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div className="card text-center py-6 space-y-3" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
            <p className="text-5xl">⚖️</p>
            <p className="text-3xl font-extrabold text-primary">{savedEntry?.weightKg} kg</p>
            {savedEntry?.trend !== null && savedEntry?.trend !== undefined && (
              <p className={`text-sm font-semibold ${savedEntry.trend < 0 ? 'text-secondary' : savedEntry.trend > 0 ? 'text-alert' : 'text-gray-400'}`}>
                {savedEntry.trend < 0 ? `▼ ${Math.abs(savedEntry.trend).toFixed(1)} kg` : savedEntry.trend > 0 ? `▲ ${savedEntry.trend.toFixed(1)} kg` : '= Sin cambios'}
                {' '}vs última vez
              </p>
            )}
            {savedEntry?.bodyFatPct && (
              <div className="flex justify-center gap-3 text-sm">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">💧 {savedEntry.bodyFatPct}% grasa</span>
                {savedEntry.muscleMassKg && <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full font-semibold">💪 {savedEntry.muscleMassKg}kg músculo</span>}
              </div>
            )}
            <button onClick={reset} className="btn-ghost text-sm text-gray-400 w-full">
              Registrar otro
            </button>
          </motion.div>
        )}

        {history.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-gray-700 mb-3">Historial reciente</h3>
            <div className="space-y-2">
              {history.slice(0, 7).map((entry, i) => {
                const prev = history[i + 1];
                const diff = prev ? entry.weightKg - prev.weightKg : null;
                return (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-gray-700">{entry.weightKg} kg</p>
                        {entry.source === 'smart_scale_photo' && <span className="text-[10px] bg-primary/10 text-primary px-1 rounded">📱</span>}
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(entry.recordedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right">
                      {diff !== null && (
                        <span className={`text-sm font-semibold ${diff < 0 ? 'text-secondary' : diff > 0 ? 'text-alert' : 'text-gray-400'}`}>
                          {diff < 0 ? `▼ ${Math.abs(diff).toFixed(1)}` : diff > 0 ? `▲ ${diff.toFixed(1)}` : '—'}
                        </span>
                      )}
                      {entry.bodyFatPct && <p className="text-[10px] text-gray-400">{entry.bodyFatPct}% grasa</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
      <NuriFAB />
    </div>
  );
}
