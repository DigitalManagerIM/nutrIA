import prisma from '../prisma/client';

// XP thresholds per level (cumulative)
export function xpForLevel(level: number): number {
  // Level 1 = 0 XP, each level requires more XP
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

export const LEVEL_NAMES: Record<string, string> = {
  '1-5': 'Cría de Nutria',
  '6-10': 'Nutria Nadadora',
  '11-20': 'Nutria Cazadora',
  '21-35': 'Nutria Alfa',
  '36-50': 'Nutria Legendaria',
  '51+': 'Nutria Inmortal',
};

export function getLevelName(level: number): string {
  if (level <= 5) return LEVEL_NAMES['1-5'];
  if (level <= 10) return LEVEL_NAMES['6-10'];
  if (level <= 20) return LEVEL_NAMES['11-20'];
  if (level <= 35) return LEVEL_NAMES['21-35'];
  if (level <= 50) return LEVEL_NAMES['36-50'];
  return LEVEL_NAMES['51+'];
}

export const XP_REWARDS = {
  FOOD_LOG: 10,
  WEIGHT_LOG: 15,
  WORKOUT: 25,
  COMPLETE_DAY: 50,
  ONBOARDING: 50,
  FIRST_CHAT: 10,
};

export async function addXp(
  userId: string,
  amount: number
): Promise<{ newXp: number; newLevel: number; leveledUp: boolean; oldLevel: number }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const oldLevel = user.level;
  const newXp = user.xp + amount;
  const newLevel = levelFromXp(newXp);

  await prisma.user.update({
    where: { id: userId },
    data: { xp: newXp, level: newLevel },
  });

  return { newXp, newLevel, leveledUp: newLevel > oldLevel, oldLevel };
}

export async function updateStreak(userId: string, type: string): Promise<{ currentCount: number; isNew: boolean }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let streak = await prisma.streak.findUnique({ where: { userId_type: { userId, type } } });

  if (!streak) {
    streak = await prisma.streak.create({
      data: { userId, type, currentCount: 1, bestCount: 1, lastActiveDate: today },
    });
    return { currentCount: 1, isNew: true };
  }

  const lastActive = streak.lastActiveDate ? new Date(streak.lastActiveDate) : null;
  if (lastActive) lastActive.setHours(0, 0, 0, 0);

  // Already updated today
  if (lastActive && lastActive.getTime() === today.getTime()) {
    return { currentCount: streak.currentCount, isNew: false };
  }

  // Continued streak (was yesterday)
  const continued = lastActive && lastActive.getTime() === yesterday.getTime();
  const newCount = continued ? streak.currentCount + 1 : 1;
  const newBest = Math.max(newCount, streak.bestCount);

  await prisma.streak.update({
    where: { userId_type: { userId, type } },
    data: { currentCount: newCount, bestCount: newBest, lastActiveDate: today },
  });

  return { currentCount: newCount, isNew: !continued };
}

export async function checkAndGrantAchievements(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      achievements: { include: { achievement: true } },
      foodLogs: true,
      weightEntries: true,
      streaks: true,
      chatMessages: { where: { role: 'user' } },
    },
  });

  if (!user) return [];

  const earned = user.achievements.map((ua) => ua.achievement.code);
  const newlyEarned: string[] = [];

  const grant = async (code: string) => {
    if (earned.includes(code)) return;
    const achievement = await prisma.achievement.findUnique({ where: { code } });
    if (!achievement) return;
    await prisma.userAchievement.create({ data: { userId, achievementId: achievement.id } });
    await addXp(userId, achievement.xpReward);
    newlyEarned.push(code);
  };

  // Nutrition
  if (user.foodLogs.length >= 1) await grant('first_meal');

  // Weight
  if (user.weightEntries.length >= 1) await grant('first_weight');
  if (user.weightEntries.length >= 10) await grant('weight_10_entries');

  // Chat
  if (user.chatMessages.length >= 1) await grant('first_chat');

  // Onboarding
  if (user.onboardingCompleted) await grant('onboarding_complete');

  // Streaks
  const foodStreak = user.streaks.find((s) => s.type === 'food_log');
  if (foodStreak) {
    if (foodStreak.currentCount >= 7) await grant('meal_7_streak');
    if (foodStreak.currentCount >= 30) await grant('meal_30_streak');
  }

  // Level achievements
  if (user.level >= 5) await grant('level_5');
  if (user.level >= 10) await grant('level_10');
  if (user.xp >= 1000) await grant('xp_1000');

  return newlyEarned;
}
