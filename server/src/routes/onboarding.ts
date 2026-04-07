import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { aiRateLimiter } from '../middleware/rateLimiter';
import {
  saveGoal,
  saveBasics,
  uploadSmartScale,
  saveMeasurements,
  saveLifestyle,
  uploadBloodTest,
  saveSupplements,
  evaluate,
} from '../controllers/onboarding';

const router = Router();

router.use(authMiddleware);

router.put('/goal', saveGoal);
router.put('/basics', saveBasics);
router.post('/smart-scale', aiRateLimiter, upload.single('image'), uploadSmartScale);
router.put('/measurements', saveMeasurements);
router.put('/lifestyle', saveLifestyle);
router.post('/blood-test', aiRateLimiter, upload.single('file'), uploadBloodTest);
router.put('/supplements', saveSupplements);
router.post('/evaluate', aiRateLimiter, evaluate);

export default router;
