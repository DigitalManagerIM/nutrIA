import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const leftTabs = [
  { to: '/dashboard', icon: '🏠', label: 'Inicio' },
  { to: '/food',      icon: '🍽️', label: 'Nutrición' },
];

const rightTabs = [
  { to: '/training', icon: '🏋️', label: 'Entreno' },
  { to: '/stats',    icon: '👤', label: 'Mi Perfil' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showRegister, setShowRegister] = useState(false);

  const hiddenPaths = ['/onboarding'];
  if (hiddenPaths.includes(location.pathname)) return null;

  return (
    <>
      {/* Register quick-action sheet */}
      <AnimatePresence>
        {showRegister && (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRegister(false)}
          >
            <div className="absolute inset-0 bg-black/40" />
            <motion.div
              className="relative w-full max-w-app bg-white rounded-t-3xl px-6 pt-4 pb-28 space-y-3"
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <p className="text-center font-bold text-gray-700 text-sm mb-2">¿Qué quieres registrar?</p>
              <button
                onClick={() => { setShowRegister(false); navigate('/food'); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-primary/10 active:bg-primary/20 transition-colors"
              >
                <span className="text-3xl">🍽️</span>
                <div className="text-left">
                  <p className="font-bold text-gray-800">Registrar comida</p>
                  <p className="text-xs text-gray-500">Foto o descripción del plato</p>
                </div>
              </button>
              <button
                onClick={() => { setShowRegister(false); navigate('/weight'); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-secondary/10 active:bg-secondary/20 transition-colors"
              >
                <span className="text-3xl">⚖️</span>
                <div className="text-left">
                  <p className="font-bold text-gray-800">Registrar peso</p>
                  <p className="text-xs text-gray-500">Manual o báscula inteligente</p>
                </div>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app bg-white border-t border-gray-100 pb-safe z-40">
        <div className="flex items-end justify-around h-16 px-2">
          {leftTabs.map(tab => {
            const active = location.pathname === tab.to;
            return (
              <NavLink key={tab.to} to={tab.to} className="flex-1 flex flex-col items-center justify-center min-h-[48px] relative pt-1">
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full"
                  />
                )}
                <span className={`text-xl ${active ? 'scale-110' : 'opacity-50'} transition-all`}>{tab.icon}</span>
                <span className={`text-[10px] font-semibold mt-0.5 ${active ? 'text-primary' : 'text-gray-400'}`}>{tab.label}</span>
              </NavLink>
            );
          })}

          {/* Central register button */}
          <div className="flex-1 flex flex-col items-center justify-end pb-2">
            <motion.button
              onClick={() => setShowRegister(true)}
              className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center -mt-6 border-4 border-white"
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-white text-2xl font-bold leading-none">+</span>
            </motion.button>
          </div>

          {rightTabs.map(tab => {
            const active = location.pathname === tab.to;
            return (
              <NavLink key={tab.to} to={tab.to} className="flex-1 flex flex-col items-center justify-center min-h-[48px] relative pt-1">
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full"
                  />
                )}
                <span className={`text-xl ${active ? 'scale-110' : 'opacity-50'} transition-all`}>{tab.icon}</span>
                <span className={`text-[10px] font-semibold mt-0.5 ${active ? 'text-primary' : 'text-gray-400'}`}>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
