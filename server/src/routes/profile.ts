import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getProfile, updateLifestyle, updateMeasurements } from '../controllers/profile';

const router = Router();

router.use(authMiddleware);

router.get('/', getProfile);
router.put('/lifestyle', updateLifestyle);
router.put('/measurements', updateMeasurements);

export default router;
