import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

interface DayData { date: string; calories: number; target: number; }

interface Props {
  data: DayData[];
  target: number;
  onClose: () => void;
}

export default function CalorieChart({ data, target, onClose }: Props) {
  const adherenceDays = data.filter(d => d.calories >= target * 0.85 && d.calories <= target * 1.15).length;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col bg-white"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="bg-gradient-to-r from-accent to-orange-500 px-5 pt-12 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-extrabold text-lg">🔥 Calorías semanales</h2>
            <p className="text-white/70 text-xs">vs tu objetivo de {target} kcal</p>
          </div>
          <button onClick={onClose} className="text-white text-3xl font-bold w-10 h-10 flex items-center justify-center">×</button>
        </div>

        <div className="flex-1 px-2 py-4 overflow-y-auto space-y-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, Math.max(...data.map(d => d.calories), target) * 1.1]} />
                <Tooltip
                  formatter={(val) => [`${Math.round(val as number)} kcal`]}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <ReferenceLine y={target} stroke="#58CC02" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: 'Objetivo', position: 'right', fontSize: 10, fill: '#58CC02' }} />
                <Bar dataKey="calories" radius={[4, 4, 0, 0]} name="Calorías">
                  {data.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.calories === 0 ? '#e5e7eb' :
                      entry.calories > target * 1.15 ? '#FF4B4B' :
                      entry.calories >= target * 0.85 ? '#58CC02' :
                      '#FF9600'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-2 px-2 flex-wrap text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-secondary inline-block" />En objetivo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent inline-block" />Bajo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-alert inline-block" />Exceso</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" />Sin datos</span>
          </div>

          <div className="mx-2 card">
            <h3 className="font-bold text-gray-700 text-sm mb-2">Adherencia esta semana</h3>
            <div className="flex items-center gap-3">
              <p className="text-4xl font-extrabold text-primary">{adherenceDays}<span className="text-base font-normal text-gray-400">/7</span></p>
              <div>
                <p className="text-sm font-semibold text-gray-700">días en objetivo</p>
                <p className="text-xs text-gray-400">±15% del objetivo calórico</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
