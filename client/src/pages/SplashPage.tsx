import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import NuriAvatar from '../components/nuri/NuriAvatar';

export default function SplashPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      if (user) {
        navigate(user.onboardingCompleted ? '/dashboard' : '/onboarding');
      } else {
        navigate('/login');
      }
    }, 2200);
    return () => clearTimeout(timer);
  }, [user, loading]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#89BEC8] to-[#6AAAB5] relative overflow-hidden">
      {/* Water ripples */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2 border-white/20"
          style={{ width: i * 120, height: i * 60 }}
          initial={{ opacity: 0.6, scale: 0.8 }}
          animate={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
        />
      ))}

      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
        className="flex flex-col items-center gap-4"
      >
        <NuriAvatar state="celebrating" size={140} animate={false} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <h1 className="text-5xl font-extrabold text-white tracking-tight">NutrIA</h1>
          <p className="text-white/80 text-sm mt-1 font-medium">Tu nutria coach con IA</p>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute bottom-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-white/60"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
