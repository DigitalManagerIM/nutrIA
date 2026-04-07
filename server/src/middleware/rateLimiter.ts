import rateLimit from 'express-rate-limit';

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  // Use userId when available (authenticated routes), fallback to IP
  keyGenerator: (req) => (req as { userId?: string }).userId || req.ip || 'unknown',
  message: { success: false, error: 'Demasiadas peticiones. ¡Respira, que también las nutrias necesitamos un descanso!' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }, // disable X-Forwarded-For validation warning
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, error: 'Demasiados intentos. Espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});
