import { motion } from 'framer-motion';
import NuriAvatar, { NuriState } from './NuriAvatar';

interface Props {
  message: string;
  state?: NuriState;
  avatarSize?: number;
  className?: string;
  /** Use on dark/turquoise backgrounds — renders white text without bubble box */
  onDark?: boolean;
}

export default function NuriBubble({ message, state = 'normal', avatarSize = 64, className = '', onDark = false }: Props) {
  if (onDark) {
    return (
      <motion.div
        className={`flex items-center gap-3 ${className}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <NuriAvatar state={state} size={avatarSize} className="flex-shrink-0" />
        <p className="text-white font-semibold text-sm leading-relaxed drop-shadow-sm">{message}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`flex items-end gap-3 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <NuriAvatar state={state} size={avatarSize} />
      <div className="nuri-bubble max-w-[75%]">
        {/* Bubble tail */}
        <div className="absolute -left-3 bottom-4 w-0 h-0"
          style={{ borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '12px solid rgba(0,180,216,0.2)' }} />
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    </motion.div>
  );
}
