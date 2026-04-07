import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { streamChatMessage } from '../services/chat';
import { checkAndGrantAchievements } from '../services/gamification';

export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { content } = req.body;
  const file = req.file;

  if (!content?.trim() && !file) {
    res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío' });
    return;
  }

  const messageContent = content?.trim() || 'Mira esta imagen';

  // Save user message
  await prisma.chatMessage.create({
    data: {
      userId,
      role: 'user',
      content: messageContent,
      imagePath: null, // buffers are not persisted for chat images
    },
  });

  // Stream Nuri's response
  let assistantContent = '';
  try {
    assistantContent = await streamChatMessage(
      userId,
      messageContent,
      res,
      file?.buffer,
      file?.mimetype
    );
  } catch (error) {
    console.error('Chat stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: '¡Ups! Se me ha ido la onda. Inténtalo de nuevo, ¿vale?' });
    }
    return;
  }

  // Save assistant message
  await prisma.chatMessage.create({
    data: { userId, role: 'assistant', content: assistantContent },
  });

  // Check achievements (first chat)
  await checkAndGrantAchievements(userId);
}

export async function getChatHistory(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '20', 10);
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    }),
    prisma.chatMessage.count({ where: { userId } }),
  ]);

  res.json({
    success: true,
    data: {
      messages: messages.reverse(),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
}
