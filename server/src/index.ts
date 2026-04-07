import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

import authRoutes from './routes/auth';
import onboardingRoutes from './routes/onboarding';
import foodRoutes from './routes/food';
import weightRoutes from './routes/weight';
import chatRoutes from './routes/chat';
import gamificationRoutes from './routes/gamification';
import statsRoutes from './routes/stats';
import goalsRoutes from './routes/goals';
import trainingRoutes from './routes/training';
import bloodTestRoutes from './routes/blood-test';
import profileRoutes from './routes/profile';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Render/Vercel proxy (required for rate limiter and IP detection)
app.set('trust proxy', 1);

// Security & parsing middleware
app.use(helmet());

// CORS: specific origins in production, all origins in dev
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/weight', weightRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/blood-test', bloodTestRoutes);
app.use('/api/profile', profileRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '¡Ups! Se me ha ido la onda. Inténtalo de nuevo, ¿vale?' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🦦 NutrIA server running on http://0.0.0.0:${PORT}`);
});

export default app;
