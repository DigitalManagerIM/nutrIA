import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

export default function NuriFAB() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/onboarding') return null;
  // Hide FAB on chat page since chat is now a main tab
  if (location.pathname === '/chat') return null;

  return (
    <motion.button
      className="fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg z-50 overflow-hidden bg-white border-2 border-primary"
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={() => navigate('/chat')}
      animate={{ y: [0, -4, 0], transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' } }}
      aria-label="Hablar con NutrIA"
    >
      <img
        src="/nuri/nutria para chat.png"
        alt="NutrIA"
        className="w-full h-full object-contain p-1"
      />
    </motion.button>
  );
}
