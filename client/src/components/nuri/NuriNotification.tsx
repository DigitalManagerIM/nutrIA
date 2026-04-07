import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  message: string;
  onClose: () => void;
}

export default function NuriNotification({ message, onClose }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/30" />
        <motion.div
          className="relative w-full max-w-app bg-white rounded-2xl shadow-2xl overflow-hidden"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-primary to-secondary px-5 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl flex-shrink-0">
              🦦
            </div>
            <div>
              <p className="text-white font-bold text-sm">NutrIA dice...</p>
              <p className="text-white/70 text-[10px]">Consejo personalizado</p>
            </div>
          </div>

          {/* Message */}
          <div className="px-5 py-4">
            <p className="text-gray-700 text-sm leading-relaxed">{message}</p>
          </div>

          <div className="px-5 pb-4">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-primary text-white font-bold rounded-card text-sm active:scale-95 transition-transform"
            >
              ¡Entendido! 👍
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
