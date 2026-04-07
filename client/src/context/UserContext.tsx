import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface GamificationStatus {
  xp: number;
  level: number;
  levelName: string;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  xpProgressPct: number;
  streaks: Array<{ type: string; currentCount: number; bestCount: number }>;
}

interface UserContextValue {
  gamification: GamificationStatus | null;
  refreshGamification: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [gamification, setGamification] = useState<GamificationStatus | null>(null);

  const refreshGamification = async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/gamification/status');
      setGamification(data.data);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    if (user?.onboardingCompleted) {
      refreshGamification();
    }
  }, [user?.id]);

  return (
    <UserContext.Provider value={{ gamification, refreshGamification }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
