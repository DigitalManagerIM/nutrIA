import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface WeightPoint { weightKg: number; bodyFatPct: number | null; muscleMassKg: number | null; recordedAt: string; }

type Range = '7d' | '1m' | '3m' | '6m' | 'all';

const RANGES: { key: Range; label: string }[] = [
  { key: '7d', label: '7 días' },
  { key: '1m', label: '1 mes' },
  { key: '3m', label: '3 meses' },
  { key: '6m', label: '6 meses' },
  { key: 'all', label: 'Todo' },
];

function filterByRange(data: WeightPoint[], range: Range): WeightPoint[] {
  if (range === 'all') return data;
  const now = Date.now();
  const ms = { '7d': 7, '1m': 30, '3m': 90, '6m': 180 }[range] * 86400000;
  return data.filter(d => now - new Date(d.recordedAt).getTime() <= ms);
}

function movingAverage(data: WeightPoint[], window = 7): number[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    return parseFloat((slice.reduce((s, d) => s + d.weightKg, 0) / slice.length).toFixed(2));
  });
}

interface Props {
  data: WeightPoint[];
  onClose: () => void;
}

export default function WeightChart({ data, onClose }: Props) {
  const [range, setRange] = useState<Range>('1m');
  const filtered = filterByRange([...data].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()), range);
  const ma = movingAverage(filtered);

  const chartData = filtered.map((d, i) => ({
    date: new Date(d.recordedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
    peso: d.weightKg,
    media: ma[i],
    grasa: d.bodyFatPct,
  }));

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col bg-white"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="bg-gradient-to-r from-primary to-[#0096B7] px-5 pt-12 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-extrabold text-lg">⚖️ Evolución del peso</h2>
            <p className="text-white/70 text-xs">Histórico completo</p>
          </div>
          <button onClick={onClose} className="text-white text-3xl font-bold w-10 h-10 flex items-center justify-center">×</button>
        </div>

        <div className="flex gap-1 px-4 py-3 overflow-x-auto flex-shrink-0">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-all ${range === r.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex-1 px-2 py-2 overflow-y-auto">
          {chartData.length < 2 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Necesitas más registros para ver la gráfica
            </div>
          ) : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip
                      formatter={(val, name) => [
                        `${val} kg`,
                        name === 'peso' ? 'Peso' : 'Media 7d'
                      ]}
                      labelStyle={{ fontSize: 11 }}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Line type="monotone" dataKey="peso" stroke="#00B4D8" strokeWidth={2} dot={{ r: 3 }} name="peso" />
                    <Line type="monotone" dataKey="media" stroke="#FF9600" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="media" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex gap-3 px-2 mt-1 mb-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-4 h-0.5 bg-primary inline-block rounded" />Peso
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-4 h-0.5 bg-accent inline-block rounded" />Media 7 días
                </div>
              </div>

              {/* Body fat if available */}
              {chartData.some(d => d.grasa) && (
                <>
                  <p className="text-xs font-bold text-gray-600 px-2 mb-1">% Grasa corporal</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip formatter={(val) => [`${val}%`, '% Grasa']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Line type="monotone" dataKey="grasa" stroke="#58CC02" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {/* Stats table */}
              <div className="mx-2 mt-4 card">
                <h3 className="font-bold text-gray-700 text-sm mb-2">Resumen del período</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Inicio', value: `${filtered[0]?.weightKg} kg` },
                    { label: 'Actual', value: `${filtered[filtered.length - 1]?.weightKg} kg` },
                    {
                      label: 'Cambio',
                      value: `${filtered.length > 1 ? (filtered[filtered.length - 1].weightKg - filtered[0].weightKg > 0 ? '+' : '') + (filtered[filtered.length - 1].weightKg - filtered[0].weightKg).toFixed(1) : '—'} kg`,
                      color: filtered.length > 1 && filtered[filtered.length - 1].weightKg - filtered[0].weightKg < 0 ? 'text-secondary' : 'text-accent',
                    },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-2">
                      <p className={`font-bold text-sm ${s.color || 'text-gray-800'}`}>{s.value}</p>
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
