import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { analyzeFoodPhoto, estimateMacrosFromText, generateMealAdvice } from '../services/ai';
import { buildUserContext } from '../services/chat';
import { addXp, XP_REWARDS, updateStreak, checkAndGrantAchievements } from '../services/gamification';
import { storeFile } from '../config/firebase';
import path from 'path';

export async function logFood(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { mealName, mealType, location } = req.body;
  const file = req.file;

  if (!mealType) {
    res.status(400).json({ success: false, error: 'El tipo de comida es obligatorio' });
    return;
  }

  let aiAnalysis: object | undefined;
  let imagePath: string | undefined;

  // Build user context for personalized analysis
  const userContext = await buildUserContext(userId).catch(() => '');

  if (file) {
    // Run AI analysis on the in-memory buffer
    aiAnalysis = await analyzeFoodPhoto(file.buffer, mealName?.trim(), userContext, file.mimetype) as object;

    // Persist file (Firebase in prod, disk in dev)
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`;
    imagePath = await storeFile(file.buffer, file.mimetype, userId, filename).catch(() => undefined);
  } else if (mealName?.trim()) {
    aiAnalysis = await estimateMacrosFromText(mealName.trim(), userContext) as object;
  }

  const foodLog = await prisma.foodLog.create({
    data: {
      userId,
      mealType,
      mealName: mealName || null,
      location: location || null,
      imagePath: imagePath || null,
      aiAnalysis,
    },
  });

  // Get today's totals AFTER adding this meal for advice context
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLogs = await prisma.foodLog.findMany({
    where: { userId, loggedAt: { gte: today } },
  });
  const todayTotals = todayLogs.reduce(
    (acc, log) => {
      const a = (log.userAdjusted ? log.adjustedData : log.aiAnalysis) as { calories?: number; protein?: number; carbs?: number; fat?: number } | null;
      return {
        calories: acc.calories + (a?.calories || 0),
        protein: acc.protein + (a?.protein || 0),
        carbs: acc.carbs + (a?.carbs || 0),
        fat: acc.fat + (a?.fat || 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Generate Nuri advice
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, goal: true, targetCalories: true, targetProtein: true },
  });
  const bloodTest = await prisma.bloodTest.findFirst({ where: { userId }, orderBy: { uploadedAt: 'desc' } });

  let nuriAdvice = '';
  if (aiAnalysis) {
    const analysis = aiAnalysis as { items: string[]; calories: number; protein: number; carbs: number; fat: number };
    nuriAdvice = await generateMealAdvice({
      mealAnalysis: analysis,
      todayTotals,
      userContext: {
        name: user?.name || '',
        goal: user?.goal || null,
        targetCalories: user?.targetCalories || null,
        targetProtein: user?.targetProtein || null,
        bloodTestData: bloodTest?.extractedData as Record<string, unknown> | null,
      },
    });
  }

  const xpResult = await addXp(userId, XP_REWARDS.FOOD_LOG);
  const streak = await updateStreak(userId, 'food_log');
  const newAchievements = await checkAndGrantAchievements(userId);

  res.status(201).json({
    success: true,
    data: { foodLog, aiAnalysis, todayTotals, nuriAdvice, xp: xpResult, streak, newAchievements },
  });
}

export async function updateFoodLog(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;
  const { adjustedData } = req.body;

  const existing = await prisma.foodLog.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Registro no encontrado' });
    return;
  }

  const updated = await prisma.foodLog.update({
    where: { id },
    data: { adjustedData, userAdjusted: true },
  });

  res.json({ success: true, data: { foodLog: updated } });
}

export async function toggleFavorite(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;
  const existing = await prisma.foodLog.findFirst({ where: { id, userId } });
  if (!existing) { res.status(404).json({ success: false, error: 'Registro no encontrado' }); return; }
  const updated = await prisma.foodLog.update({ where: { id }, data: { isFavorite: !existing.isFavorite } });
  res.json({ success: true, data: { isFavorite: updated.isFavorite } });
}

export async function getFavorites(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const favorites = await prisma.foodLog.findMany({
    where: { userId, isFavorite: true },
    orderBy: { loggedAt: 'desc' },
    take: 20,
  });
  res.json({ success: true, data: { favorites } });
}

export async function deleteFoodLog(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;

  const existing = await prisma.foodLog.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Registro no encontrado' });
    return;
  }

  await prisma.foodLog.delete({ where: { id } });
  res.json({ success: true, data: { message: 'Comida eliminada' } });
}

export async function getDailyLogs(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { date } = req.params;

  const day = new Date(date || new Date());
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end = new Date(day); end.setHours(23, 59, 59, 999);

  const logs = await prisma.foodLog.findMany({
    where: { userId, loggedAt: { gte: start, lte: end } },
    orderBy: { loggedAt: 'asc' },
  });

  const totals = logs.reduce(
    (acc, log) => {
      const analysis = (log.userAdjusted ? log.adjustedData : log.aiAnalysis) as {
        calories?: number; protein?: number; carbs?: number; fat?: number;
      } | null;
      return {
        calories: acc.calories + (analysis?.calories || 0),
        protein: acc.protein + (analysis?.protein || 0),
        carbs: acc.carbs + (analysis?.carbs || 0),
        fat: acc.fat + (analysis?.fat || 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  res.json({ success: true, data: { logs, totals } });
}
