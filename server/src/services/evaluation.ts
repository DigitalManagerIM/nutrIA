import prisma from '../prisma/client';
import { generateInitialEvaluation } from './ai';

export async function triggerReEvaluation(userId: string): Promise<void> {
  const [user, latestWeight, measurements, bloodTest] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { measurements: { orderBy: { measuredAt: 'desc' }, take: 1 } } }),
    prisma.weightEntry.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } }),
    prisma.userMeasurement.findFirst({ where: { userId }, orderBy: { measuredAt: 'desc' } }),
    prisma.bloodTest.findFirst({ where: { userId }, orderBy: { uploadedAt: 'desc' } }),
  ]);

  if (!user || !user.onboardingCompleted) return;

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
    mealPattern: user.mealPattern,
    intermittentFasting: user.intermittentFasting,
    fastingHours: user.fastingHours,
    goal: user.goal,
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

  await prisma.aiEvaluation.create({
    data: { userId, type: 'weekly', content: evaluation as object },
  });

  // Update macro targets
  await prisma.user.update({
    where: { id: userId },
    data: {
      targetCalories: Math.round(evaluation.dailyCalories),
      targetProtein: evaluation.dailyProtein,
      targetCarbs: evaluation.dailyCarbs,
      targetFat: evaluation.dailyFat,
    },
  });
}
