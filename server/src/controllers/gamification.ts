import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { getLevelName, xpForLevel } from '../services/gamification';

export async function getStatus(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [user, streaks] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.streak.findMany({ where: { userId } }),
  ]);

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const xpInCurrentLevel = user.xp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;

  res.json({
    success: true,
    data: {
      xp: user.xp,
      level: user.level,
      levelName: getLevelName(user.level),
      xpInCurrentLevel,
      xpNeededForNextLevel,
      xpProgressPct: Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100),
      streaks,
    },
  });
}

export async function getAchievements(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [allAchievements, userAchievements] = await Promise.all([
    prisma.achievement.findMany({ orderBy: { category: 'asc' } }),
    prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    }),
  ]);

  const earnedIds = new Set(userAchievements.map((ua) => ua.achievementId));

  const achievements = allAchievements.map((a) => ({
    ...a,
    earned: earnedIds.has(a.id),
    unlockedAt: userAchievements.find((ua) => ua.achievementId === a.id)?.unlockedAt || null,
  }));

  res.json({ success: true, data: { achievements } });
}
