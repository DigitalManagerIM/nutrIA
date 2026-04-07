import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { aiRateLimiter } from '../middleware/rateLimiter';
import {
  getPreferences,
  savePreferences,
  generatePlan,
  getActivePlan,
  logWorkout,
  getWorkoutLogs,
} from '../controllers/training';

const router = Router();
router.use(authMiddleware);

router.get('/preferences', getPreferences);
router.post('/preferences', savePreferences);
router.post('/generate', aiRateLimiter, generatePlan);
router.get('/plan', getActivePlan);
router.post('/log', logWorkout);
router.get('/logs', getWorkoutLogs);

export default router;
