import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { extractSmartScaleData } from '../services/ai';
import { addXp, XP_REWARDS, updateStreak, checkAndGrantAchievements } from '../services/gamification';
import { triggerReEvaluation } from '../services/evaluation';
import { storeFile } from '../config/firebase';
import path from 'path';

export async function logWeight(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const file = req.file;
  const { weightKg } = req.body;

  let entry;

  if (file) {
    // Analyse directly from buffer (memoryStorage — no file.path)
    const extracted = await extractSmartScaleData(file.buffer, file.mimetype);

    // Persist image (Firebase in prod, disk in dev)
    const filename = `scale-${Date.now()}${path.extname(file.originalname)}`;
    const storedPath = await storeFile(file.buffer, file.mimetype, userId, filename).catch(() => '');

    entry = await prisma.weightEntry.create({
      data: {
        userId,
        weightKg: extracted.weightKg || (weightKg ? parseFloat(weightKg) : 0),
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
  } else {
    if (!weightKg) {
      res.status(400).json({ success: false, error: 'El peso es obligatorio' });
      return;
    }

    entry = await prisma.weightEntry.create({
      data: { userId, weightKg: parseFloat(weightKg), source: 'manual' },
    });
  }

  // Get previous entry to show trend
  const previous = await prisma.weightEntry.findFirst({
    where: { userId, id: { not: entry.id } },
    orderBy: { recordedAt: 'desc' },
  });

  const trend = previous ? entry.weightKg - previous.weightKg : null;

  const xpResult = await addXp(userId, XP_REWARDS.WEIGHT_LOG);
  const streak = await updateStreak(userId, 'weight');
  const newAchievements = await checkAndGrantAchievements(userId);

  res.status(201).json({
    success: true,
    data: { entry, trend, xp: xpResult, streak, newAchievements },
  });

  // Fire-and-forget re-evaluation with new weight data
  triggerReEvaluation(userId).catch(e => console.error('Re-eval (weight) error:', e));
}

export async function getWeightHistory(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const limit = parseInt((req.query.limit as string) || '30', 10);

  const entries = await prisma.weightEntry.findMany({
    where: { userId },
    orderBy: { recordedAt: 'desc' },
    take: limit,
  });

  res.json({ success: true, data: { entries } });
}
