import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getGoals, updateGoals } from '../controllers/goals';

const router = Router();
router.use(authMiddleware);

router.get('/', getGoals);
router.put('/', updateGoals);

export default router;
