import { motion } from 'framer-motion';

interface Props {
  count: number;
  type?: string;
  compact?: boolean;
}

export default function StreakCounter({ count, compact = false }: Props) {
  const isActive = count >= 3;
  const isDanger = count === 1;

  return (
    <motion.div
      className={`flex items-center gap-1.5 ${compact ? 'px-2 py-1' : 'px-3 py-2'} rounded-full
        ${isActive ? 'bg-orange-50 border border-accent' : isDanger ? 'bg-red-50 border border-alert' : 'bg-gray-50 border border-gray-200'}`}
      whileTap={{ scale: 0.95 }}
    >
      <span className={`${compact ? 'text-base' : 'text-xl'} ${isActive ? 'fire-flicker' : ''}`}>
        {count >= 3 ? '🔥' : count >= 1 ? '⚡' : '💤'}
      </span>
      <span className={`font-bold ${compact ? 'text-sm' : 'text-base'} ${isActive ? 'text-accent' : isDanger ? 'text-alert' : 'text-gray-400'}`}>
        {count}
      </span>
      {!compact && <span className="text-xs text-gray-400">días</span>}
    </motion.div>
  );
}
