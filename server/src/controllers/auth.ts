import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { AuthRequest } from '../middleware/auth';

function signAccess(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'],
  });
}

function signRefresh(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ success: false, error: 'Nombre, email y contraseña son obligatorios' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ success: false, error: 'Ya existe una cuenta con ese email' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  const accessToken = signAccess(user.id);
  const refreshToken = signRefresh(user.id);

  res.status(201).json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, email: user.email, level: user.level, xp: user.xp, onboardingCompleted: user.onboardingCompleted },
      accessToken,
      refreshToken,
    },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email y contraseña son obligatorios' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    return;
  }

  const accessToken = signAccess(user.id);
  const refreshToken = signRefresh(user.id);

  res.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, email: user.email, level: user.level, xp: user.xp, onboardingCompleted: user.onboardingCompleted },
      accessToken,
      refreshToken,
    },
  });
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true, name: true, email: true, sex: true, age: true, heightCm: true,
      hasSmartScale: true, activityLevel: true, sleepHours: true, stressLevel: true,
      workType: true, supplements: true, xp: true, level: true, onboardingCompleted: true,
      goal: true, targetCalories: true, targetProtein: true, targetCarbs: true, targetFat: true,
      intermittentFasting: true, fastingHours: true, mealPattern: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    return;
  }

  res.json({ success: true, data: { user } });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'Refresh token requerido' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    const accessToken = signAccess(payload.userId);
    res.json({ success: true, data: { accessToken } });
  } catch {
    res.status(401).json({ success: false, error: 'Refresh token inválido o expirado' });
  }
}
