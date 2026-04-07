import { motion } from 'framer-motion';

interface Props {
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  xpProgressPct: number;
  level: number;
  levelName: string;
}

export default function XPBar({ xpInCurrentLevel, xpNeededForNextLevel, xpProgressPct, level, levelName }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-orange-400 flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-sm">{level}</span>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs font-bold text-accent">{levelName}</span>
          <span className="text-xs text-gray-400">{xpInCurrentLevel}/{xpNeededForNextLevel} XP</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-yellow-400"
            initial={{ width: 0 }}
            animate={{ width: `${xpProgressPct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  );
}
