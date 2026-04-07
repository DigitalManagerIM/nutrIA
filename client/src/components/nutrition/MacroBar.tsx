import { motion } from 'framer-motion';

interface Props {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
}

export default function MacroBar({ label, current, target, color, unit = 'g' }: Props) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = current > target;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className={`text-xs font-bold ${over ? 'text-alert' : 'text-gray-500'}`}>
          {Math.round(current)}/{target}{unit}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${over ? 'bg-alert' : ''}`}
          style={{ backgroundColor: over ? undefined : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
