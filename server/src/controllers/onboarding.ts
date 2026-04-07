import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { extractSmartScaleData, extractBloodTestData, generateInitialEvaluation } from '../services/ai';
import { addXp, XP_REWARDS, checkAndGrantAchievements } from '../services/gamification';
import { storeFile } from '../config/firebase';
import path from 'path';

export async function saveGoal(req: AuthRequest, res: Response): Promise<void> {
  const { goal } = req.body;
  const userId = req.userId!;
  await prisma.user.update({ where: { id: userId }, data: { goal: goal || undefined } });
  res.json({ success: true, data: { message: '¡Objetivo guardado!' } });
}

export async function saveBasics(req: AuthRequest, res: Response): Promise<void> {
  const { sex, age, heightCm, weightKg, hasSmartScale } = req.body;
  const userId = req.userId!;

  await prisma.user.update({
    where: { id: userId },
    data: {
      sex: sex || undefined,
      age: age ? parseInt(age) : undefined,
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
      hasSmartScale: hasSmartScale === true || hasSmartScale === 'true',
    },
  });

  if (weightKg) {
    await prisma.weightEntry.create({
      data: { userId, weightKg: parseFloat(weightKg), source: 'manual' },
    });
  }

  res.json({ success: true, data: { message: '¡Apuntado! Vamos al siguiente paso.' } });
}

export async function uploadSmartScale(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: 'No se recibió ninguna imagen' });
    return;
  }

  // AI analysis directly from buffer
  const extracted = await extractSmartScaleData(file.buffer, file.mimetype);

  // Persist file
  const filename = `smart-scale-${Date.now()}${path.extname(file.originalname)}`;
  const storedPath = await storeFile(file.buffer, file.mimetype, userId, filename).catch(() => '');

  await prisma.weightEntry.create({
    data: {
      userId,
      weightKg: extracted.weightKg || 0,
      bodyFatPct: extracted.bodyFatPct,
      muscleMassKg: extracted.muscleMassKg,
      waterPct: extracted.waterPct,
      visceralFat: extracted.visceralFat,
      basalMetabolism: extracted.basalMetabolism,
      boneMassKg: extracted.boneMassKg,
      source: 'smart_scale_photo',
      imagePath: storedPath || null,
    },
  });

  res.json({ success: true, data: { extracted } });
}

export async function saveMeasurements(req: AuthRequest, res: Response): Promise<void> {
  const { chestCm, waistCm, hipCm, armCm, thighCm } = req.body;
  const userId = req.userId!;

  await prisma.userMeasurement.create({
    data: {
      userId,
      chestCm: chestCm ? parseFloat(chestCm) : undefined,
      waistCm: waistCm ? parseFloat(waistCm) : undefined,
      hipCm: hipCm ? parseFloat(hipCm) : undefined,
      armCm: armCm ? parseFloat(armCm) : undefined,
      thighCm: thighCm ? parseFloat(thighCm) : undefined,
    },
  });

  res.json({ success: true, data: { message: '¡Medidas guardadas!' } });
}

export async function saveLifestyle(req: AuthRequest, res: Response): Promise<void> {
  const { activityLevel, sleepHours, stressLevel, workType, intermittentFasting, fastingHours } = req.body;
  const userId = req.userId!;

  await prisma.user.update({
    where: { id: userId },
    data: {
      activityLevel: activityLevel || undefined,
      sleepHours: sleepHours ? parseFloat(sleepHours) : undefined,
      stressLevel: stressLevel ? parseInt(stressLevel) : undefined,
      workType: workType || undefined,
      intermittentFasting: intermittentFasting === true || intermittentFasting === 'true',
      fastingHours: fastingHours ? parseInt(fastingHours) : null,
    },
  });

  res.json({ success: true, data: { message: '¡Perfecto! Ya sé cómo vives.' } });
}

export async function uploadBloodTest(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
    return;
  }

  // AI analysis from buffer
  const extractedData = await extractBloodTestData(file.buffer, file.mimetype);

  // Persist file
  const filename = `blood-test-${Date.now()}${path.extname(file.originalname)}`;
  const storedPath = await storeFile(file.buffer, file.mimetype, userId, filename).catch(() => '');

  const raw = extractedData as { fecha_estimada?: string; fechaAnalítica?: string };
  let testDate: Date | undefined;
  const dateStr = raw.fecha_estimada || raw.fechaAnalítica;
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) testDate = parsed;
  }

  await prisma.bloodTest.create({
    data: {
      userId,
      imagePath: storedPath || '',
      extractedData: extractedData as object,
      testDate: testDate || undefined,
    },
  });

  res.json({ success: true, data: { extractedData } });
}

export async function saveSupplements(req: AuthRequest, res: Response): Promise<void> {
  const { supplements } = req.body;
  const userId = req.userId!;

  await prisma.user.update({ where: { id: userId }, data: { supplements: supplements || '' } });

  res.json({ success: true, data: { message: '¡Anotado!' } });
}

export async function evaluate(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [user, latestWeight, measurements, bloodTest] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.weightEntry.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } }),
    prisma.userMeasurement.findFirst({ where: { userId }, orderBy: { measuredAt: 'desc' } }),
    prisma.bloodTest.findFirst({ where: { userId }, orderBy: { uploadedAt: 'desc' } }),
  ]);

  const userData = {
    name: user.name,
    sex: user.sex,
    age: user.age,
    heightCm: user.heightCm,
    activityLevel: user.activityLevel,
    sleepHours: user.sleepHours,
    stressLevel: user.stressLevel,
    workType: user.workType,
    supplements: user.supplements,
    intermittentFasting: user.intermittentFasting,
    fastingHours: user.fastingHours,
    currentWeight: latestWeight?.weightKg,
    bodyFatPct: latestWeight?.bodyFatPct,
    muscleMassKg: latestWeight?.muscleMassKg,
    measurements: measurements ? {
      chest: measurements.chestCm,
      waist: measurements.waistCm,
      hip: measurements.hipCm,
      arm: measurements.armCm,
      thigh: measurements.thighCm,
    } : null,
    bloodTestData: bloodTest?.extractedData || null,
  };

  const evaluation = await generateInitialEvaluation(userData as Record<string, unknown>);

  // Save evaluation
  await prisma.aiEvaluation.create({
    data: { userId, type: 'initial', content: evaluation as object },
  });

  // Save macro targets to user profile so dashboard can use them
  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingCompleted: true,
      targetCalories: Math.round(evaluation.dailyCalories),
      targetProtein: evaluation.dailyProtein,
      targetCarbs: evaluation.dailyCarbs,
      targetFat: evaluation.dailyFat,
    },
  });

  const xpResult = await addXp(userId, XP_REWARDS.ONBOARDING);
  const newAchievements = await checkAndGrantAchievements(userId);

  res.json({
    success: true,
    data: { evaluation, xp: xpResult, newAchievements },
  });
}
