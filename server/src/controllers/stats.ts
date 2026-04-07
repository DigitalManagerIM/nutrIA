import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';

export async function getStats(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [user, evaluation, weightHistory, foodLogCount, streaks, latestBloodTest] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true, goal: true, targetCalories: true, targetProtein: true,
        targetCarbs: true, targetFat: true, xp: true, level: true, createdAt: true,
      },
    }),
    prisma.aiEvaluation.findFirst({
      where: { userId, type: 'initial' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { recordedAt: 'asc' },
      select: { weightKg: true, bodyFatPct: true, muscleMassKg: true, recordedAt: true },
    }),
    prisma.foodLog.count({ where: { userId } }),
    prisma.streak.findMany({ where: { userId } }),
    prisma.bloodTest.findFirst({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      select: { extractedData: true, uploadedAt: true, testDate: true },
    }),
  ]);

  // Build weekly adherence (last 7 days with at least 1 food log)
  const last7Days: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setHours(23, 59, 59, 999);
    const count = await prisma.foodLog.count({ where: { userId, loggedAt: { gte: d, lte: next } } });
    last7Days.push(count > 0);
  }

  res.json({
    success: true,
    data: {
      user,
      evaluation: evaluation?.content || null,
      evaluationDate: evaluation?.createdAt || null,
      weightHistory,
      foodLogCount,
      streaks,
      weeklyAdherence: last7Days,
      latestBloodTest,
    },
  });
}
