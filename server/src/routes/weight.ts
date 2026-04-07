import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { logWeight, getWeightHistory } from '../controllers/weight';

const router = Router();

router.use(authMiddleware);

router.post('/log', aiRateLimiter, upload.single('image'), logWeight);
router.get('/history', getWeightHistory);

export default router;
