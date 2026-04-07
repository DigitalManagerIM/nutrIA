import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import NuriBubble from '../components/nuri/NuriBubble';
import BottomNav from '../components/common/BottomNav';
import NuriFAB from '../components/nuri/NuriFAB';

interface Achievement {
  id: string; code: string; name: string; description: string;
  icon: string; xpReward: number; category: string;
  earned: boolean; unlockedAt: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  nutrition: '🍽️ Nutrición',
  training: '💪 Entrenamiento',
  consistency: '🔥 Constancia',
  milestone: '🏆 Hitos',
};

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    api.get('/gamification/achievements').then(({ data }) => {
      setAchievements(data.data.achievements);
    }).finally(() => setLoading(false));
  }, []);

  const categories = ['all', ...Object.keys(CATEGORY_LABELS)];
  const filtered = filter === 'all' ? achievements : achievements.filter((a) => a.category === filter);
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-b from-primary to-[#0096B7] px-6 pt-10 pb-6">
        <NuriBubble
          message={earned > 0 ? `¡Llevas ${earned} logros! ¡Eres una máquina! Sigue así.` : '¡A por los logros! Cada uno vale XP extra. ¿Empezamos?'}
          state="celebrating"
          onDark
        />
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Progress */}
        <div className="card flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center">
            <span className="text-2xl">🏆</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-700">{earned} / {achievements.length} logros</p>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-1.5">
              <motion.div
                className="h-full rounded-full bg-gold"
                initial={{ width: 0 }}
                animate={{ width: `${achievements.length > 0 ? (earned / achievements.length) * 100 : 0}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
                ${filter === cat ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-500'}`}>
              {cat === 'all' ? '🌟 Todos' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Achievement grid */}
        {loading ? (
          <div className="flex justify-center py-8"><div className="text-3xl animate-bounce">🦦</div></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((a, i) => (
              <motion.div
                key={a.id}
                className={`card relative overflow-hidden ${!a.earned ? 'opacity-50 grayscale' : ''}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: a.earned ? 1 : 0.5, scale: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                {a.earned && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-secondary rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                <div className="text-3xl mb-2">{a.icon}</div>
                <p className="font-bold text-sm text-gray-700 leading-tight">{a.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{a.description}</p>
                <div className="mt-2 inline-flex items-center gap-1 bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                  <span className="text-xs font-bold">+{a.xpReward} XP</span>
                </div>
                {a.earned && a.unlockedAt && (
                  <p className="text-[10px] text-gray-300 mt-1">
                    {new Date(a.unlockedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
      <NuriFAB />
    </div>
  );
}
