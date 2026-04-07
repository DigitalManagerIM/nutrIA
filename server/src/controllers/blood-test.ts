import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { extractBloodTestDataFromFiles } from '../services/ai';
import { triggerReEvaluation } from '../services/evaluation';
import { storeFile } from '../config/firebase';
import path from 'path';

export async function uploadBloodTest(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const rawFiles = req.files;
  let files: Express.Multer.File[];
  if (Array.isArray(rawFiles)) {
    files = rawFiles;
  } else if (rawFiles && typeof rawFiles === 'object') {
    files = Object.values(rawFiles).flat();
  } else {
    files = [];
  }

  if (files.length === 0) {
    res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
    return;
  }

  // Build buffer-based file objects for AI
  const fileObjects = files.map(f => ({
    buffer: f.buffer,
    mimetype: f.mimetype,
    originalname: f.originalname,
  }));

  console.log('[BloodTest] archivos recibidos:', files.map(f => f.originalname));
  const extractedData = await extractBloodTestDataFromFiles(fileObjects);

  // Persist first file (representative)
  const firstFile = files[0];
  const filename = `blood-test-${Date.now()}${path.extname(firstFile.originalname)}`;
  const storedPath = await storeFile(firstFile.buffer, firstFile.mimetype, userId, filename).catch(() => '');

  const raw = extractedData as { fecha_estimada?: string; fechaAnalítica?: string };
  let testDate: Date | undefined;
  const dateStr = raw.fecha_estimada || raw.fechaAnalítica;
  if (dateStr && dateStr !== 'null') {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) testDate = parsed;
  }

  const bloodTest = await prisma.bloodTest.create({
    data: {
      userId,
      imagePath: storedPath || '',
      extractedData: extractedData as object,
      testDate: testDate || undefined,
    },
  });

  res.json({ success: true, data: { bloodTest, extractedData } });

  // Fire-and-forget re-evaluation with new blood data
  triggerReEvaluation(userId).catch(e => console.error('Re-eval error:', e));
}

export async function getLatestBloodTest(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const bloodTest = await prisma.bloodTest.findFirst({
    where: { userId },
    orderBy: { uploadedAt: 'desc' },
  });

  res.json({ success: true, data: { bloodTest } });
}

export async function getBloodTestHistory(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const tests = await prisma.bloodTest.findMany({
    where: { userId },
    orderBy: { uploadedAt: 'desc' },
    take: 10,
  });

  res.json({ success: true, data: { tests } });
}
