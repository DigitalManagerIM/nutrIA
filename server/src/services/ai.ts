import OpenAI from 'openai';
import fs from 'fs';
import { enrichWithUSDA, sumMacros } from './nutrition';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const NURI_ERROR = '¡Ups! Se me ha ido la onda. Inténtalo de nuevo, ¿vale?';

/** Accepts either a Buffer (in-memory upload) or a file path (legacy disk). */
function imageToDataUrl(source: Buffer | string, mimetype?: string): string {
  if (Buffer.isBuffer(source)) {
    const base64 = source.toString('base64');
    const mime = mimetype || 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  }
  // Legacy: read from disk path
  const buffer = fs.readFileSync(source);
  const base64 = buffer.toString('base64');
  const ext = source.split('.').pop()?.toLowerCase() || 'jpeg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
  const mime = mimeMap[ext] || 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

export async function analyzeFoodPhoto(imageSource: Buffer | string, details?: string, userContext?: string, imageMime?: string): Promise<{
  items: string[];
  itemsDetail: Array<{ nombre: string; nombre_en: string; cantidad: string; cantidad_gramos: number; calorias: number; proteina: number; carbos: number; grasa: number; source: 'usda' | 'estimate'; usdaFood?: string; }>;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  comment: string;
  analisis_personalizado?: string;
  usdaItemsCount?: number;
}> {
  try {
    const dataUrl = imageToDataUrl(imageSource, imageMime);
    const contextBlock = userContext ? `\nDATOS DEL USUARIO:\n${userContext}\n` : '';
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Eres NutrIA, nutricionista deportiva experta. Analiza esta comida con máxima precisión.
${details ? `El usuario describe: "${details}"` : ''}
${contextBlock}
Identifica cada alimento por separado con su nombre EN INGLÉS (para búsqueda en bases de datos nutricionales) y estima la cantidad en gramos.
Devuelve ÚNICAMENTE JSON válido sin markdown:
{
  "items": ["nombre_alimento_1", "nombre_alimento_2"],
  "itemsDetail": [
    {
      "nombre": "Pechuga de pollo a la plancha",
      "nombre_en": "grilled chicken breast",
      "cantidad": "150g aprox.",
      "cantidad_gramos": 150,
      "calorias": 165,
      "proteina": 31,
      "carbos": 0,
      "grasa": 3.6
    }
  ],
  "calories": número_total_entero,
  "protein": número_total_decimal,
  "carbs": número_total_decimal,
  "fat": número_total_decimal,
  "analisis_personalizado": "Análisis DETALLADO en 3-5 frases citando datos reales del usuario: cómo encaja con su objetivo calórico, macros del día, y si tiene analítica anormal mencionar qué impacto tiene esta comida. Si no hay datos de usuario, da un análisis nutricional general.",
  "comment": "Comentario MUY CORTO con personalidad de NutrIA (máx 100 chars)"
}
Sé muy preciso estimando gramos. Desglosa cada ingrediente por separado.`,
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 1400,
    });

    const raw = response.choices[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Enrich GPT-4o estimates with USDA precise data
    const enrichedItems = parsed.itemsDetail?.length
      ? await enrichWithUSDA(parsed.itemsDetail)
      : [];

    // Recalculate totals from enriched items (mix of USDA + GPT estimates)
    const totals = enrichedItems.length ? sumMacros(enrichedItems) : {
      calories: parsed.calories,
      protein:  parsed.protein,
      carbs:    parsed.carbs,
      fat:      parsed.fat,
    };

    const usdaCount = enrichedItems.filter(i => i.source === 'usda').length;

    return {
      items:            parsed.items || [],
      itemsDetail:      enrichedItems,
      calories:         Math.round(totals.calories),
      protein:          Math.round(totals.protein * 10) / 10,
      carbs:            Math.round(totals.carbs   * 10) / 10,
      fat:              Math.round(totals.fat      * 10) / 10,
      comment:          parsed.comment || '',
      analisis_personalizado: parsed.analisis_personalizado,
      usdaItemsCount:   usdaCount,
    };
  } catch (error) {
    console.error('Food photo analysis error:', error);
    return { items: [], itemsDetail: [], calories: 0, protein: 0, carbs: 0, fat: 0, comment: NURI_ERROR, usdaItemsCount: 0 };
  }
}

export async function extractSmartScaleData(imageSource: Buffer | string, imageMime?: string): Promise<{
  weightKg?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  waterPct?: number;
  visceralFat?: number;
  basalMetabolism?: number;
  boneMassKg?: number;
}> {
  try {
    const dataUrl = imageToDataUrl(imageSource, imageMime);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza esta foto de báscula inteligente y extrae los datos mostrados en pantalla.
Devuelve ÚNICAMENTE JSON válido sin markdown (omite campos que no veas):
{
  "weightKg": número,
  "bodyFatPct": número,
  "muscleMassKg": número,
  "waterPct": número,
  "visceralFat": número,
  "basalMetabolism": número,
  "boneMassKg": número
}`,
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 300,
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Smart scale extraction error:', error);
    return {};
  }
}

const BLOOD_TEST_PROMPT = `Eres NutrIA, nutricionista experta. Analiza esta analítica de sangre.
Extrae TODOS los valores que puedas identificar y devuelve SOLO este JSON sin markdown:
{
  "valores": [
    {
      "nombre": "Glucosa",
      "valor": 92,
      "unidad": "mg/dL",
      "rango_min": 70,
      "rango_max": 100,
      "estado": "normal"
    }
  ],
  "fecha_estimada": "YYYY-MM-DD o null",
  "notas": "Observaciones clave sobre los hallazgos más relevantes"
}
Busca especialmente: glucosa, colesterol total, HDL, LDL, triglicéridos, hierro sérico, ferritina, vitamina D, vitamina B12, TSH, testosterona, estradiol, hemoglobina, hematocrito, leucocitos, plaquetas, ALT, AST, creatinina, urea, proteína C reactiva.
El estado es: "bajo" si está por debajo del rango, "alto" si está por encima, "normal" si está dentro.
Extrae TODOS los valores visibles, no solo los de ejemplo.`;

export async function extractBloodTestData(imageSource: Buffer | string, mimetype?: string): Promise<Record<string, unknown>> {
  try {
    const isPdf = mimetype
      ? mimetype === 'application/pdf'
      : typeof imageSource === 'string' && imageSource.split('.').pop()?.toLowerCase() === 'pdf';

    let response;

    if (isPdf) {
      const pdfBuffer = Buffer.isBuffer(imageSource) ? imageSource : fs.readFileSync(imageSource);
      const pdfData = await pdfParse(pdfBuffer);
      const pdfText = pdfData.text.slice(0, 8000);
      console.log('[BloodTest PDF] texto extraído (primeros 300 chars):', pdfText.slice(0, 300));

      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: `${BLOOD_TEST_PROMPT}\n\nTEXTO EXTRAÍDO DEL PDF:\n${pdfText}`,
          },
        ],
        max_tokens: 2000,
      });
    } else {
      const dataUrl = imageToDataUrl(imageSource, mimetype);
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: BLOOD_TEST_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 2000,
      });
    }

    const raw = response.choices[0]?.message?.content || '{}';
    console.log('[BloodTest] respuesta GPT:', raw.slice(0, 200));
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Blood test extraction error:', error);
    return { valores: [], notas: 'Error al procesar la analítica' };
  }
}

export async function extractBloodTestDataFromFiles(
  files: Array<{ buffer: Buffer; mimetype: string; originalname?: string }>
): Promise<Record<string, unknown>> {
  if (!Array.isArray(files) || files.length === 0) {
    return { valores: [], notas: 'No se recibieron archivos' };
  }
  const results = await Promise.all(files.map(f => extractBloodTestData(f.buffer, f.mimetype)));
  // Merge all valores arrays, deduplicate by nombre
  const allValores: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    const vals = r.valores as Record<string, unknown>[] | undefined;
    if (Array.isArray(vals)) {
      for (const v of vals) {
        const key = String(v.nombre);
        if (!seen.has(key)) { seen.add(key); allValores.push(v); }
      }
    }
  }
  const fecha = results.find(r => r.fecha_estimada)?.fecha_estimada ?? null;
  const notas = results.map(r => r.notas).filter(Boolean).join(' | ') || undefined;
  return { valores: allValores, fecha_estimada: fecha, notas };
}

export interface InitialEvaluation {
  summary: string;
  currentState: {
    bmi?: number;
    bmiCategory?: string;
    estimatedBodyFatPct?: number;
    estimatedMuscleMassKg?: number;
    bodyType?: string;
  };
  strengths: string[];
  improvements: string[];
  bloodTestAnalysis?: {
    alertas: Array<{ parametro: string; estado: string; recomendacion: string }>;
    resumen: string;
  };
  supplementAnalysis?: {
    adecuados: string[];
    sobran: string[];
    faltan: string[];
    resumen: string;
  };
  goals: {
    threeMonths: string;
    sixMonths: string;
    twelveMonths: string;
  };
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
  calorieBreakdown: {
    bmr: number;
    tdee: number;
    adjustment: string;
    target: number;
  };
  recommendations: string[];
  nuriMessage: string;
}

export async function generateInitialEvaluation(userData: Record<string, unknown>): Promise<InitialEvaluation> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Eres NutrIA, una nutria europea que trabaja como nutricionista deportiva y entrenadora personal experta en recomposición corporal.
Tu personalidad: cercana, directa, motivadora, con humor. Usas "tú" siempre. Haces referencias a tu vida de nutria.
Eres experta en: nutrición deportiva, fisiología del ejercicio, bioquímica, análisis de analíticas de sangre y suplementación.
Basas tus cálculos en evidencia científica: Harris-Benedict/Mifflin-St Jeor para TMB, factores de actividad de FAO/WHO.`,
        },
        {
          role: 'user',
          content: `Analiza los datos de este usuario y genera su evaluación inicial COMPLETA de recomposición corporal.
Sé específico, personalizado y usa toda la información disponible.

DATOS DEL USUARIO:
${JSON.stringify(userData, null, 2)}

Devuelve ÚNICAMENTE JSON válido sin markdown:
{
  "summary": "Resumen del estado actual en 3-4 frases con personalidad de NutrIA, menciona datos específicos del usuario",
  "currentState": {
    "bmi": número_con_un_decimal,
    "bmiCategory": "Infrapeso|Normopeso|Sobrepeso|Obesidad",
    "estimatedBodyFatPct": número_si_no_hay_dato_de_báscula_estimar_por_IMC_y_sexo,
    "estimatedMuscleMassKg": número_estimado,
    "bodyType": "descripción breve del fenotipo corporal actual"
  },
  "strengths": ["punto fuerte 1", "punto fuerte 2", "punto fuerte 3"],
  "improvements": ["área de mejora 1", "área de mejora 2", "área de mejora 3"],
  "bloodTestAnalysis": {
    "alertas": [
      { "parametro": "nombre", "estado": "alto|bajo", "recomendacion": "acción específica" }
    ],
    "resumen": "resumen del estado de salud según la analítica"
  },
  "supplementAnalysis": {
    "adecuados": ["suplemento que sí tiene sentido"],
    "sobran": ["suplemento innecesario"],
    "faltan": ["suplemento que le vendría bien según sus datos"],
    "resumen": "análisis de la suplementación con personalidad de NutrIA"
  },
  "goals": {
    "threeMonths": "objetivo realista y específico a 3 meses (con números: kg perdidos, músculo ganado, etc.)",
    "sixMonths": "objetivo realista y específico a 6 meses",
    "twelveMonths": "objetivo realista y específico a 12 meses"
  },
  "dailyCalories": número_entero_kcal_objetivo_diarias,
  "dailyProtein": número_gramos_proteína,
  "dailyCarbs": número_gramos_carbohidratos,
  "dailyFat": número_gramos_grasa,
  "calorieBreakdown": {
    "bmr": número_TMB_calculada,
    "tdee": número_TDEE_con_factor_actividad,
    "adjustment": "déficit de X kcal para perder grasa | superávit de X kcal para ganar músculo | mantenimiento",
    "target": número_igual_a_dailyCalories
  },
  "recommendations": [
    "recomendación específica y accionable 1",
    "recomendación específica y accionable 2",
    "recomendación específica y accionable 3",
    "recomendación específica y accionable 4"
  ],
  "nuriMessage": "Mensaje motivacional de Nuri de 2-3 frases con su personalidad característica, menciona algo específico del usuario"
}

IMPORTANTE: Calcula los macros con rigor científico:
- Proteína: 1.6-2.2g/kg peso corporal (ajustar según objetivo y % grasa estimado)
- Grasa: mínimo 0.8g/kg, idealmente 25-30% de calorías totales
- Carbohidratos: el resto de calorías
- Calorías: TMB × factor actividad ± ajuste según objetivo (déficit -300 a -500kcal, superávit +200 a +300kcal)`,
        },
      ],
      max_tokens: 2000,
    });

    const raw = response.choices[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Initial evaluation error:', error);
    throw new Error(NURI_ERROR);
  }
}

// Estimate macros from meal name (no photo)
export async function estimateMacrosFromText(mealName: string, userContext?: string): Promise<{
  items: string[];
  itemsDetail: Array<{ nombre: string; nombre_en: string; cantidad: string; cantidad_gramos: number; calorias: number; proteina: number; carbos: number; grasa: number; source: 'usda' | 'estimate'; usdaFood?: string; }>;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  comment: string;
  analisis_personalizado?: string;
  usdaItemsCount?: number;
}> {
  try {
    const contextBlock = userContext ? `\nDATOS DEL USUARIO:\n${userContext}\n` : '';
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Eres NutrIA, nutricionista deportiva experta. Desglosa y estima los macros de: "${mealName}".
${contextBlock}
Asume una porción estándar para un adulto activo. Incluye el nombre en inglés de cada alimento para búsqueda en bases de datos nutricionales.
Devuelve ÚNICAMENTE JSON válido sin markdown:
{
  "items": ["ingrediente1", "ingrediente2"],
  "itemsDetail": [
    {
      "nombre": "Pechuga de pollo",
      "nombre_en": "chicken breast",
      "cantidad": "150g",
      "cantidad_gramos": 150,
      "calorias": número,
      "proteina": número,
      "carbos": número,
      "grasa": número
    }
  ],
  "calories": número_entero_total,
  "protein": número_decimal_total,
  "carbs": número_decimal_total,
  "fat": número_decimal_total,
  "analisis_personalizado": "Análisis breve en 2-3 frases con datos reales del usuario si los hay. Si no hay contexto, análisis nutricional general.",
  "comment": "Comentario muy corto con personalidad de NutrIA (máx 80 chars)"
}`,
        },
      ],
      max_tokens: 900,
    });
    const raw = response.choices[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Enrich with USDA
    const enrichedItems = parsed.itemsDetail?.length
      ? await enrichWithUSDA(parsed.itemsDetail)
      : [];

    const totals = enrichedItems.length ? sumMacros(enrichedItems) : {
      calories: parsed.calories,
      protein:  parsed.protein,
      carbs:    parsed.carbs,
      fat:      parsed.fat,
    };

    const usdaCount = enrichedItems.filter((i: { source: string }) => i.source === 'usda').length;

    return {
      items:           parsed.items || [mealName],
      itemsDetail:     enrichedItems,
      calories:        Math.round(totals.calories),
      protein:         Math.round(totals.protein * 10) / 10,
      carbs:           Math.round(totals.carbs   * 10) / 10,
      fat:             Math.round(totals.fat      * 10) / 10,
      comment:         parsed.comment || '',
      analisis_personalizado: parsed.analisis_personalizado,
      usdaItemsCount:  usdaCount,
    };
  } catch (error) {
    console.error('Macro estimation error:', error);
    return { items: [mealName], itemsDetail: [], calories: 0, protein: 0, carbs: 0, fat: 0, comment: NURI_ERROR, usdaItemsCount: 0 };
  }
}

// Generate personalized NutrIA advice after a meal
export async function generateMealAdvice(params: {
  mealAnalysis: { items: string[]; calories: number; protein: number; carbs: number; fat: number };
  todayTotals: { calories: number; protein: number; carbs: number; fat: number };
  userContext: {
    name: string;
    goal: string | null;
    targetCalories: number | null;
    targetProtein: number | null;
    bloodTestData?: Record<string, unknown> | null;
  };
}): Promise<string> {
  try {
    const { mealAnalysis, todayTotals, userContext } = params;
    const targetCalories = userContext.targetCalories || 2000;
    const targetProtein = userContext.targetProtein || 150;
    const remaining = targetCalories - todayTotals.calories;
    const proteinRemaining = targetProtein - todayTotals.protein;

    // Extract notable blood test values for the prompt
    let bloodContext = 'No disponible.';
    if (userContext.bloodTestData) {
      const bd = userContext.bloodTestData as { valores?: Record<string, { valor: number; unidad: string; estado: string }> };
      if (bd.valores) {
        const notable = Object.entries(bd.valores)
          .filter(([, v]) => v.estado !== 'normal')
          .slice(0, 5)
          .map(([k, v]) => `${k}: ${v.valor} ${v.unidad} (${v.estado})`)
          .join(', ');
        bloodContext = notable || 'Todos los valores en rango normal.';
      }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Eres NutrIA, una nutria nutricionista personal. Eres cercana, directa y con humor. Máx 2 frases cortas.
REGLA CRÍTICA: Cita siempre números reales del usuario. Nunca des consejos genéricos. Menciona gramos, kilocalorías o valores específicos.
Objetivo del usuario: ${userContext.goal || 'recomposición corporal'}.`,
        },
        {
          role: 'user',
          content: `Acaba de comer: ${mealAnalysis.items.join(', ')} — ${Math.round(mealAnalysis.calories)} kcal, ${Math.round(mealAnalysis.protein)}g proteína.
Acumulado hoy: ${Math.round(todayTotals.calories)} de ${targetCalories} kcal (${Math.round(todayTotals.protein)}g de ${targetProtein}g proteína).
Restante: ${Math.round(remaining)} kcal y ${Math.round(proteinRemaining)}g proteína.
Analítica (valores fuera de rango): ${bloodContext}

Da un consejo concreto citando los números reales de arriba. Si hay valores de analítica alterados relevantes para la comida, menciónalos con sus valores.`,
        },
      ],
      max_tokens: 150,
    });
    return response.choices[0]?.message?.content || '¡Comida registrada! Sigue así. 🦦';
  } catch (error) {
    console.error('Meal advice error:', error);
    return '¡Registrado! Sigue así, lo estás haciendo genial. 🦦';
  }
}

export interface TrainingPlanResult {
  name: string;
  description: string;
  days: Array<{
    dayNumber: number;
    name: string;
    muscleGroups: string[];
    exercises: Array<{
      name: string;
      sets: number;
      reps: string;
      rest: string;
      technique: string;
      alternatives: string[];
    }>;
  }>;
  weeklyStructure: string;
  progressionNotes: string;
  nuriMessage: string;
}

export async function generateTrainingPlan(params: {
  userProfile: {
    name: string;
    sex: string | null;
    age: number | null;
    heightCm: number | null;
    weightKg: number | null;
    bodyFatPct: number | null;
    goal: string | null;
  };
  preferences: {
    daysPerWeek: number;
    sessionMinutes: number;
    equipment: string;
    experienceLevel: string;
    focusMuscles: string[];
    injuries: string | null;
  };
}): Promise<TrainingPlanResult> {
  try {
    const { userProfile, preferences } = params;

    const equipmentMap: Record<string, string> = {
      gym: 'gimnasio completo (máquinas, barras, mancuernas)',
      home_full: 'casa con equipamiento completo (barra, mancuernas, banco)',
      home_minimal: 'casa con equipamiento mínimo (mancuernas ligeras o bandas)',
      none: 'sin equipamiento, solo peso corporal',
    };

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Eres NutrIA, una nutria entrenadora personal experta en programación de fuerza e hipertrofia.
Diseñas planes basados en evidencia científica: periodización, volumen óptimo, frecuencia por grupo muscular.
Adaptas todo al objetivo, nivel y equipamiento del usuario.`,
        },
        {
          role: 'user',
          content: `Diseña un plan de entrenamiento personalizado para este usuario.

PERFIL:
- Nombre: ${userProfile.name}
- Sexo: ${userProfile.sex || 'no especificado'}
- Edad: ${userProfile.age || 'no especificada'} años
- Peso: ${userProfile.weightKg || 'no especificado'} kg
- % Grasa corporal: ${userProfile.bodyFatPct || 'estimado'}
- Objetivo principal: ${userProfile.goal || 'recomposición corporal'}

PREFERENCIAS DE ENTRENAMIENTO:
- Días por semana: ${preferences.daysPerWeek}
- Duración por sesión: ${preferences.sessionMinutes} minutos
- Equipamiento: ${equipmentMap[preferences.equipment] || preferences.equipment}
- Nivel: ${preferences.experienceLevel}
- Músculos a priorizar: ${preferences.focusMuscles.join(', ') || 'equilibrado'}
- Lesiones/limitaciones: ${preferences.injuries || 'ninguna'}

Devuelve ÚNICAMENTE JSON válido sin markdown:
{
  "name": "nombre del plan (ej: Push/Pull/Legs 4 días)",
  "description": "descripción breve del plan y su lógica (2-3 frases)",
  "days": [
    {
      "dayNumber": 1,
      "name": "Push - Pecho, Hombros y Tríceps",
      "muscleGroups": ["chest", "shoulders", "triceps"],
      "exercises": [
        {
          "name": "Press Banca con Barra",
          "sets": 4,
          "reps": "8-10",
          "rest": "2-3 min",
          "technique": "Instrucción técnica clave en 1 frase",
          "alternatives": ["Press con Mancuernas", "Fondos en paralelas"]
        }
      ]
    }
  ],
  "weeklyStructure": "descripción de cómo distribuir los días en la semana",
  "progressionNotes": "cómo progresar semana a semana",
  "nuriMessage": "Mensaje motivacional de NutrIA de 2-3 frases con su personalidad, menciona algo específico del plan"
}

IMPORTANTE:
- ${preferences.daysPerWeek} días de entrenamiento exactamente
- Adapta ejercicios al equipamiento disponible
- Para principiantes: ejercicios básicos, técnica simple
- Para avanzados: más variación y técnicas avanzadas
- Cada sesión debe caber en ${preferences.sessionMinutes} minutos (incluye calentamiento)
- 4-6 ejercicios por sesión como máximo`,
        },
      ],
      max_tokens: 3000,
    });

    const raw = response.choices[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Training plan generation error:', error);
    throw new Error(NURI_ERROR);
  }
}

export { openai, NURI_ERROR };
