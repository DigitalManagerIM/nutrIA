import prisma from '../prisma/client';
import { openai } from './ai';
import { Response } from 'express';

const NUTRIA_SYSTEM_PROMPT = `Eres NutrIA, una nutria europea que trabaja como nutricionista deportiva y entrenadora personal experta en recomposición corporal.

PERSONALIDAD:
- Cercana, usa "tú" siempre. Nunca condescendiente
- Directa, motivadora, con humor de nutria
- Referencias naturales a tu vida: "yo con mis truchas tengo la proteína cubierta, ¿y tú?"
- Celebras logros con entusiasmo genuino, señalas mejoras con cariño
- Expresiones: "¡Vamos!", "¡Eso es!", "¡Esa es mi nutria!"

REGLAS:
- Responde SIEMPRE en español
- Cita SIEMPRE datos reales del usuario cuando sean relevantes (gramos, calorías, valores de analítica exactos)
- Sé concisa (máx 3-4 frases salvo que pidan algo extenso)
- Cuando el usuario comparte una foto de comida, analiza y estima macros con personalidad de NutrIA

CAPACIDADES Y ACCIONES:
Puedes registrar datos directamente en la app cuando el usuario te lo dice explícitamente.
Cuando tu respuesta implique registrar datos, incluye AL FINAL del texto visible (después de todo el texto) este bloque exacto:
###ACTIONS###
[{"type":"register_food","data":{"mealType":"comida","mealName":"tortilla de 2 huevos con jamón","calories":320,"protein":24,"carbs":2,"fat":22}},{"type":"register_weight","data":{"weightKg":58.2}},{"type":"register_workout","data":{"sessionName":"Running","type":"free_cardio","durationMin":40,"caloriesBurned":350}}]
###END_ACTIONS###

TIPOS DE ACCIÓN DISPONIBLES:
- "register_food": cuando el usuario dice que comió algo. Campos: mealType (breakfast/morning_snack/lunch/afternoon_snack/dinner/snack), mealName, calories, protein, carbs, fat.
- "register_weight": cuando el usuario dice su peso hoy. Campos: weightKg (número).
- "register_workout": cuando el usuario dice que entrenó/corrió/fue al gimnasio. Campos: sessionName, type (free_cardio/free_strength/class/sport/hiit/yoga/walk/cycling), durationMin, caloriesBurned (estima).

IMPORTANTE:
- Solo incluye acciones cuando el usuario EXPLÍCITAMENTE dice que hizo algo (comió, pesó, entrenó). NO cuando pregunta o pide consejos.
- El bloque ###ACTIONS### va después del texto visible, no en medio
- Si no hay acciones, NO incluyas el bloque`;

// Exported for use in other services (food analysis, etc.)
export async function buildUserContext(userId: string): Promise<string> {
  return buildChatContext(userId);
}

export async function buildChatContext(userId: string): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    user,
    todayLogs,
    latestWeight,
    weightHistory,
    streaks,
    summary,
    latestBloodTest,
    trainingPrefs,
    activePlan,
    recentWorkouts,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        sex: true,
        age: true,
        heightCm: true,
        goal: true,
        targetCalories: true,
        targetProtein: true,
        targetCarbs: true,
        targetFat: true,
        activityLevel: true,
        sleepHours: true,
        stressLevel: true,
        supplements: true,
        intermittentFasting: true,
        fastingHours: true,
        mealPattern: true,
      },
    }),
    prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: today } },
      orderBy: { loggedAt: 'asc' },
    }),
    prisma.weightEntry.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } }),
    prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: 5,
      select: { weightKg: true, bodyFatPct: true, muscleMassKg: true, recordedAt: true },
    }),
    prisma.streak.findMany({ where: { userId } }),
    prisma.chatSummary.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.bloodTest.findFirst({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      select: { extractedData: true, testDate: true },
    }),
    prisma.trainingPreferences.findUnique({ where: { userId } }),
    prisma.trainingPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { name: true, description: true },
    }),
    prisma.workoutLog.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: { dayName: true, durationMin: true, completedAt: true },
    }),
  ]);

  if (!user) return '';

  // Calculate today's totals
  const todayTotals = todayLogs.reduce(
    (acc, log) => {
      const a = (log.userAdjusted ? log.adjustedData : log.aiAnalysis) as {
        calories?: number; protein?: number; carbs?: number; fat?: number;
      } | null;
      return {
        calories: acc.calories + (a?.calories || 0),
        protein: acc.protein + (a?.protein || 0),
        carbs: acc.carbs + (a?.carbs || 0),
        fat: acc.fat + (a?.fat || 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Format blood test values
  let bloodSummary = '';
  if (latestBloodTest?.extractedData) {
    const bd = latestBloodTest.extractedData as {
      valores?: Array<{ nombre: string; valor: number; unidad: string; estado: string }>;
      notas?: string;
    };
    if (Array.isArray(bd.valores) && bd.valores.length > 0) {
      bloodSummary = bd.valores
        .map(v => `${v.nombre}: ${v.valor} ${v.unidad} → ${v.estado.toUpperCase()}`)
        .join(' | ');
      if (bd.notas) bloodSummary += `. Notas: ${bd.notas}`;
    }
  }

  // Format today's meals
  const mealsText = todayLogs.length > 0
    ? todayLogs.map(log => {
        const a = (log.userAdjusted ? log.adjustedData : log.aiAnalysis) as {
          calories?: number; protein?: number; carbs?: number; items?: string[];
        } | null;
        return `  - ${log.mealName || log.mealType}: ${Math.round(a?.calories || 0)} kcal / ${Math.round(a?.protein || 0)}g P${a?.items ? ` (${a.items.slice(0, 3).join(', ')})` : ''}`;
      }).join('\n')
    : '  Ninguna registrada aún';

  const sections: string[] = [
    `=== PERFIL ===
Nombre: ${user.name} | Sexo: ${user.sex || 'N/A'} | Edad: ${user.age || 'N/A'} años | Talla: ${user.heightCm || 'N/A'} cm
Objetivo: ${user.goal || 'no definido'} | Actividad: ${user.activityLevel || 'N/A'}
Sueño: ${user.sleepHours || 'N/A'}h | Estrés: ${user.stressLevel || 'N/A'}/10
Patrón alimentario: ${user.mealPattern || 'no definido'} | Ayuno intermitente: ${user.intermittentFasting ? `Sí (${user.fastingHours || '?'}h)` : 'No'}
Suplementación: ${user.supplements || 'ninguna'}`,

    `=== PLAN NUTRICIONAL ===
Calorías objetivo: ${user.targetCalories || 'N/A'} kcal
Proteína: ${user.targetProtein || 'N/A'}g | Carbos: ${user.targetCarbs || 'N/A'}g | Grasa: ${user.targetFat || 'N/A'}g`,

    `=== HOY (${new Date().toLocaleDateString('es-ES')}) ===
${mealsText}
Total hoy: ${Math.round(todayTotals.calories)} kcal | ${Math.round(todayTotals.protein)}g P | ${Math.round(todayTotals.carbs)}g C | ${Math.round(todayTotals.fat)}g G
Pendiente: ${Math.round((user.targetCalories || 0) - todayTotals.calories)} kcal | ${Math.round((user.targetProtein || 0) - todayTotals.protein)}g proteína`,

    `=== PESO ===
Actual: ${latestWeight?.weightKg || 'N/A'} kg | Grasa: ${latestWeight?.bodyFatPct || 'N/A'}% | Músculo: ${latestWeight?.muscleMassKg || 'N/A'} kg
Historial reciente: ${weightHistory.map(w => `${w.weightKg}kg (${new Date(w.recordedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })})`).join(' → ')}`,

    streaks.length > 0 ? `=== RACHAS ===
${streaks.map(s => `${s.type}: ${s.currentCount} días (mejor: ${s.bestCount})`).join(' | ')}` : '',

    bloodSummary ? `=== ANALÍTICA DE SANGRE (${latestBloodTest?.testDate ? new Date(latestBloodTest.testDate).toLocaleDateString('es-ES') : 'N/A'}) ===
${bloodSummary}` : '',

    trainingPrefs ? `=== ENTRENAMIENTO ===
Plan activo: ${activePlan?.name || 'ninguno'} | ${trainingPrefs.daysPerWeek} días/sem | ${trainingPrefs.equipment} | nivel ${trainingPrefs.experienceLevel}
Últimos entrenos: ${recentWorkouts.length > 0 ? recentWorkouts.slice(0, 3).map(w => `${w.dayName} (${new Date(w.completedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })})`).join(' | ') : 'ninguno'}` : '',

    summary ? `=== CONTEXTO CONVERSACIÓN ===
${summary.summary}` : '',
  ];

  return sections.filter(Boolean).join('\n\n');
}

export async function streamChatMessage(
  userId: string,
  userContent: string,
  res: Response,
  imageBuffer?: Buffer,
  imageMime?: string
): Promise<string> {
  const context = await buildChatContext(userId);

  // Get recent messages (last 20)
  const recentMessages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  recentMessages.reverse();

  type OpenAIMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
  };

  const messages: OpenAIMessage[] = [
    { role: 'system', content: `${NUTRIA_SYSTEM_PROMPT}\n\n${context}` },
    ...recentMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // Build user message (with optional image)
  if (imageBuffer) {
    const base64 = imageBuffer.toString('base64');
    const mime = imageMime || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${base64}`;

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userContent },
        { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: userContent });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let fullResponse = '';

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: messages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
    stream: true,
    max_tokens: 800,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      fullResponse += delta;
      // Don't stream the actions block — stream only visible text
      if (!fullResponse.includes('###ACTIONS###')) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
  }

  // Parse and execute actions
  const actionsMatch = fullResponse.match(/###ACTIONS###\s*([\s\S]*?)\s*###END_ACTIONS###/);
  const visibleText = fullResponse.replace(/\s*###ACTIONS###[\s\S]*?###END_ACTIONS###\s*/, '').trim();
  let executedActions: Array<{ type: string; label: string; ok: boolean }> = [];

  if (actionsMatch) {
    try {
      const actions = JSON.parse(actionsMatch[1]) as Array<{ type: string; data: Record<string, unknown> }>;
      for (const action of actions) {
        try {
          if (action.type === 'register_food') {
            const d = action.data;
            await prisma.foodLog.create({
              data: {
                userId,
                mealType: String(d.mealType || 'snack'),
                mealName: String(d.mealName || ''),
                aiAnalysis: { calories: Number(d.calories), protein: Number(d.protein), carbs: Number(d.carbs), fat: Number(d.fat), items: [String(d.mealName || '')] },
              },
            });
            executedActions.push({ type: 'register_food', label: `✅ Comida registrada: ${d.mealName} — ${d.calories} kcal`, ok: true });
          } else if (action.type === 'register_weight') {
            const d = action.data;
            await prisma.weightEntry.create({
              data: { userId, weightKg: Number(d.weightKg), source: 'manual' },
            });
            executedActions.push({ type: 'register_weight', label: `✅ Peso registrado: ${d.weightKg} kg`, ok: true });
          } else if (action.type === 'register_workout') {
            const d = action.data;
            await prisma.workoutLog.create({
              data: {
                userId,
                dayName: String(d.sessionName || 'Entrenamiento'),
                exercises: [],
                durationMin: Number(d.durationMin) || null,
              },
            });
            executedActions.push({ type: 'register_workout', label: `✅ Entreno registrado: ${d.sessionName} — ${d.durationMin} min`, ok: true });
          }
        } catch {
          executedActions.push({ type: action.type, label: `⚠️ No se pudo registrar ${action.type}`, ok: false });
        }
      }
    } catch {
      // Invalid JSON in actions block — ignore
    }
  }

  res.write(`data: ${JSON.stringify({ done: true, actions: executedActions })}\n\n`);
  res.end();

  return visibleText;
}
