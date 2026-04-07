import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { logFood, updateFoodLog, deleteFoodLog, getDailyLogs, toggleFavorite, getFavorites } from '../controllers/food';
import { searchUSDA } from '../services/nutrition';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/log', aiRateLimiter, upload.single('image'), logFood);
router.put('/log/:id', updateFoodLog);
router.delete('/log/:id', deleteFoodLog);
router.put('/log/:id/favorite', toggleFavorite);
router.get('/favorites', getFavorites);
router.get('/daily/:date', getDailyLogs);

// Test endpoint: GET /api/food/test-usda?q=chicken+breast
router.get('/test-usda', async (req: AuthRequest, res: Response): Promise<void> => {
  const q = (req.query.q as string) || 'chicken breast';
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey || apiKey === 'DEMO_KEY') {
    res.status(400).json({ success: false, error: 'USDA_API_KEY no configurada o es DEMO_KEY. Añádela en server/.env' });
    return;
  }
  const result = await searchUSDA(q);
  if (!result) {
    res.status(404).json({ success: false, error: `USDA no encontró resultados para "${q}"` });
    return;
  }
  res.json({
    success: true,
    data: {
      query: q,
      matched: result.matchedName,
      fdcId: result.fdcId,
      per100g: result.per100g,
      note: 'Estos son los valores por 100g del alimento identificado en USDA'
    }
  });
});

export default router;
