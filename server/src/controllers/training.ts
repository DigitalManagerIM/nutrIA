import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { generateTrainingPlan } from '../services/ai';
import { addXp, XP_REWARDS, updateStreak } from '../services/gamification';

export async function getPreferences(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const prefs = await prisma.trainingPreferences.findUnique({ where: { userId } });
  res.json({ success: true, data: prefs });
}

export async function savePreferences(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { daysPerWeek, sessionMinutes, equipment, experienceLevel, focusMuscles, injuries } = req.body;

  if (!daysPerWeek || !equipment || !experienceLevel) {
    res.status(400).json({ success: false, error: 'Faltan datos obligatorios' });
    return;
  }

  const prefs = await prisma.trainingPreferences.upsert({
    where: { userId },
    create: {
      userId,
      daysPerWeek: Number(daysPerWeek),
      sessionMinutes: Number(sessionMinutes) || 60,
      equipment,
      experienceLevel,
      focusMuscles: focusMuscles || [],
      injuries: injuries || null,
    },
    update: {
      daysPerWeek: Number(daysPerWeek),
      sessionMinutes: Number(sessionMinutes) || 60,
      equipment,
      experienceLevel,
      focusMuscles: focusMuscles || [],
      injuries: injuries || null,
    },
  });

  res.json({ success: true, data: prefs });
}

export async function generatePlan(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [prefs, user, latestWeight] = await Promise.all([
    prisma.trainingPreferences.findUnique({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, sex: true, age: true, goal: true, heightCm: true },
    }),
    prisma.weightEntry.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } }),
  ]);

  if (!prefs) {
    res.status(400).json({ success: false, error: 'Primero configura tus preferencias de entrenamiento' });
    return;
  }

  // Deactivate existing plans
  await prisma.trainingPlan.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });

  const planData = await generateTrainingPlan({
    userProfile: {
      name: user?.name || '',
      sex: user?.sex || null,
      age: user?.age || null,
      heightCm: user?.heightCm || null,
      weightKg: latestWeight?.weightKg || null,
      bodyFatPct: latestWeight?.bodyFatPct || null,
      goal: user?.goal || null,
    },
    preferences: prefs,
  });

  const plan = await prisma.trainingPlan.create({
    data: {
      userId,
      name: planData.name,
      description: planData.description,
      content: planData as unknown as object,
      isActive: true,
    },
  });

  res.json({ success: true, data: { plan, nuriMessage: planData.nuriMessage } });
}

export async function getActivePlan(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [plan, prefs, recentLogs] = await Promise.all([
    prisma.trainingPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.trainingPreferences.findUnique({ where: { userId } }),
    prisma.workoutLog.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
  ]);

  res.json({ success: true, data: { plan, preferences: prefs, recentLogs } });
}

export async function logWorkout(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { trainingPlanId, dayName, exercises, durationMin } = req.body;

  if (!dayName || !exercises) {
    res.status(400).json({ success: false, error: 'dayName y exercises son obligatorios' });
    return;
  }

  const log = await prisma.workoutLog.create({
    data: {
      userId,
      trainingPlanId: trainingPlanId || null,
      dayName,
      exercises,
      durationMin: durationMin ? Number(durationMin) : null,
    },
  });

  const xpResult = await addXp(userId, XP_REWARDS.WORKOUT);
  await updateStreak(userId, 'workout');

  res.status(201).json({ success: true, data: { log, xp: xpResult } });
}

export async function getWorkoutLogs(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const limit = parseInt((req.query.limit as string) || '20', 10);

  const logs = await prisma.workoutLog.findMany({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    take: limit,
  });

  res.json({ success: true, data: { logs } });
}
