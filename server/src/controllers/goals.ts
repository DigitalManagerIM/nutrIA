import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';

const GOAL_LABELS: Record<string, string> = {
  lose_fat: 'Perder grasa',
  recomposition: 'Recomposición corporal',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantener peso',
  health: 'Mejorar salud general',
};

function calculateNutritionTargets(params: {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  strategy: string;
  macroDistribution: string;
}): { tmb: number; tdee: number; targetCalories: number; targetProtein: number; targetCarbs: number; targetFat: number } {
  const { sex, age, heightCm, weightKg, activityLevel, strategy, macroDistribution } = params;

  // Mifflin-St Jeor
  let tmb: number;
  if (sex === 'male') {
    tmb = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    tmb = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

  const activityFactors: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = Math.round(tmb * (activityFactors[activityLevel] || 1.375));

  const strategyAdjustments: Record<string, number> = {
    aggressive_deficit: -500,
    moderate_deficit: -300,
    maintenance: 0,
    light_surplus: 200,
    surplus: 400,
  };
  const targetCalories = Math.round(tdee + (strategyAdjustments[strategy] || 0));

  const macroDistributions: Record<string, { proteinPct: number; carbsPct: number; fatPct: number }> = {
    high_protein: { proteinPct: 0.35, carbsPct: 0.35, fatPct: 0.30 },
    balanced:     { proteinPct: 0.30, carbsPct: 0.40, fatPct: 0.30 },
    high_carb:    { proteinPct: 0.25, carbsPct: 0.50, fatPct: 0.25 },
    keto:         { proteinPct: 0.30, carbsPct: 0.10, fatPct: 0.60 },
  };
  const dist = macroDistributions[macroDistribution] || macroDistributions.balanced;

  return {
    tmb: Math.round(tmb),
    tdee,
    targetCalories,
    targetProtein: Math.round((targetCalories * dist.proteinPct) / 4),
    targetCarbs: Math.round((targetCalories * dist.carbsPct) / 4),
    targetFat: Math.round((targetCalories * dist.fatPct) / 9),
  };
}

export async function getGoals(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const [user, latestWeight] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        goal: true, targetCalories: true, targetProtein: true, targetCarbs: true, targetFat: true,
        sex: true, age: true, heightCm: true, activityLevel: true,
      },
    }),
    prisma.weightEntry.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' }, select: { weightKg: true } }),
  ]);

  if (!user) {
    res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    return;
  }

  res.json({ success: true, data: { ...user, currentWeightKg: latestWeight?.weightKg || null } });
}

export { calculateNutritionTargets };

export async function updateGoals(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { goal, targetCalories, targetProtein, targetCarbs, targetFat, strategy, macroDistribution } = req.body;

  if (goal && !GOAL_LABELS[goal]) {
    res.status(400).json({ success: false, error: 'Objetivo no válido' });
    return;
  }

  // If strategy + macroDistribution provided, auto-calculate
  let calculated: ReturnType<typeof calculateNutritionTargets> | null = null;
  if (strategy && macroDistribution) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sex: true, age: true, heightCm: true, activityLevel: true },
    });
    const latestWeight = await prisma.weightEntry.findFirst({
      where: { userId }, orderBy: { recordedAt: 'desc' }, select: { weightKg: true },
    });
    if (user?.sex && user?.age && user?.heightCm && latestWeight?.weightKg) {
      calculated = calculateNutritionTargets({
        sex: user.sex,
        age: user.age,
        heightCm: user.heightCm,
        weightKg: latestWeight.weightKg,
        activityLevel: user.activityLevel || 'moderate',
        strategy,
        macroDistribution,
      });
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(goal !== undefined && { goal }),
      targetCalories: calculated?.targetCalories ?? (targetCalories !== undefined ? Number(targetCalories) : undefined),
      targetProtein: calculated?.targetProtein ?? (targetProtein !== undefined ? Number(targetProtein) : undefined),
      targetCarbs: calculated?.targetCarbs ?? (targetCarbs !== undefined ? Number(targetCarbs) : undefined),
      targetFat: calculated?.targetFat ?? (targetFat !== undefined ? Number(targetFat) : undefined),
    },
    select: { goal: true, targetCalories: true, targetProtein: true, targetCarbs: true, targetFat: true },
  });

  res.json({ success: true, data: { ...updated, calculated } });
}
