import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { sendMessage, getChatHistory } from '../controllers/chat';

const router = Router();

router.use(authMiddleware);

router.post('/message', aiRateLimiter, upload.single('image'), sendMessage);
router.get('/history', getChatHistory);

export default router;
