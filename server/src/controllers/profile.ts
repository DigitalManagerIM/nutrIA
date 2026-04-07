import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { triggerReEvaluation } from '../services/evaluation';

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [user, latestMeasurement, latestWeight, latestEvaluation] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true,
        sex: true, age: true, heightCm: true,
        activityLevel: true, sleepHours: true, stressLevel: true, workType: true,
        supplements: true, intermittentFasting: true, fastingHours: true, mealPattern: true,
        goal: true, targetCalories: true, targetProtein: true, targetCarbs: true, targetFat: true,
        xp: true, level: true, onboardingCompleted: true,
      },
    }),
    prisma.userMeasurement.findFirst({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
    }),
    prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      select: { weightKg: true, bodyFatPct: true, muscleMassKg: true, recordedAt: true },
    }),
    prisma.aiEvaluation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { content: true, createdAt: true, type: true },
    }),
  ]);

  if (!user) {
    res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    return;
  }

  res.json({ success: true, data: { user, latestMeasurement, latestWeight, latestEvaluation } });
}

export async function updateLifestyle(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const {
    activityLevel, sleepHours, stressLevel, workType,
    supplements, intermittentFasting, fastingHours, mealPattern,
  } = req.body;

  // Derive IF fields from mealPattern if provided
  let ifActive = intermittentFasting === true || intermittentFasting === 'true';
  let ifHours: number | null = fastingHours ? parseInt(String(fastingHours)) : null;

  if (mealPattern) {
    if (mealPattern === 'if_16_8') { ifActive = true; ifHours = 16; }
    else if (mealPattern === 'if_18_6') { ifActive = true; ifHours = 18; }
    else if (mealPattern === 'if_20_4') { ifActive = true; ifHours = 20; }
    else { ifActive = false; ifHours = null; }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(activityLevel !== undefined && { activityLevel }),
      ...(sleepHours !== undefined && { sleepHours: parseFloat(String(sleepHours)) }),
      ...(stressLevel !== undefined && { stressLevel: parseInt(String(stressLevel)) }),
      ...(workType !== undefined && { workType }),
      ...(supplements !== undefined && { supplements }),
      ...(mealPattern !== undefined && { mealPattern }),
      intermittentFasting: ifActive,
      fastingHours: ifHours,
    },
    select: {
      activityLevel: true, sleepHours: true, stressLevel: true, workType: true,
      supplements: true, intermittentFasting: true, fastingHours: true, mealPattern: true,
    },
  });

  res.json({ success: true, data: { user: updated } });

  // Fire-and-forget re-evaluation with updated profile
  triggerReEvaluation(userId).catch(e => console.error('Re-eval (lifestyle) error:', e));
}

export async function updateMeasurements(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { chestCm, waistCm, hipCm, armCm, thighCm } = req.body;

  // Only create if at least one measurement provided
  const hasAny = [chestCm, waistCm, hipCm, armCm, thighCm].some(v => v !== undefined && v !== '');
  if (!hasAny) {
    res.status(400).json({ success: false, error: 'Proporciona al menos una medida' });
    return;
  }

  const measurement = await prisma.userMeasurement.create({
    data: {
      userId,
      chestCm: chestCm ? parseFloat(String(chestCm)) : null,
      waistCm: waistCm ? parseFloat(String(waistCm)) : null,
      hipCm: hipCm ? parseFloat(String(hipCm)) : null,
      armCm: armCm ? parseFloat(String(armCm)) : null,
      thighCm: thighCm ? parseFloat(String(thighCm)) : null,
    },
  });

  res.status(201).json({ success: true, data: { measurement } });

  // Fire-and-forget re-evaluation with new body measurements
  triggerReEvaluation(userId).catch(e => console.error('Re-eval (measurements) error:', e));
}
