import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { uploadBloodTest, getLatestBloodTest, getBloodTestHistory } from '../controllers/blood-test';

const router = Router();
router.use(authMiddleware);

router.post('/', aiRateLimiter, upload.array('files', 10), uploadBloodTest);
router.get('/latest', getLatestBloodTest);
router.get('/history', getBloodTestHistory);

export default router;
