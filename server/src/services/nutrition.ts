/**
 * USDA FoodData Central integration
 * Free API: https://fdc.nal.usda.gov/api-guide.html
 * Get your free key at: https://fdc.nal.usda.gov/api-key-signup.html
 */

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// USDA nutrient IDs
const NID = {
  energy:  1008, // kcal
  protein: 1003, // g
  carbs:   1005, // Carbohydrate, by difference (g)
  fat:     1004, // Total lipid (fat) (g)
};

export interface USDAResult {
  fdcId: number;
  matchedName: string;  // what USDA calls this food
  per100g: {
    calories: number;
    protein:  number;
    carbs:    number;
    fat:      number;
  };
}

export interface MacroBreakdown {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

// Words that indicate a processed/composite product — deprioritize these
const PROCESSED_TERMS = [
  'breaded', 'fried', 'frozen', 'canned', 'soup', 'stew', 'casserole',
  'nugget', 'patty', 'sandwich', 'pizza', 'pot pie', 'stuffed',
  'sauce', 'seasoned', 'marinated', 'battered', 'coated', 'with',
];

function scoreFood(description: string, query: string): number {
  const desc = description.toLowerCase();
  const q    = query.toLowerCase();
  let score  = 0;

  // Reward if query words appear in description
  q.split(/\s+/).forEach(word => { if (desc.includes(word)) score += 2; });

  // Penalise processed variants
  PROCESSED_TERMS.forEach(term => { if (desc.includes(term)) score -= 3; });

  // Reward simple preparations
  if (desc.includes('raw'))     score += 1;
  if (desc.includes('cooked'))  score += 0.5;

  return score;
}

function extractNutrients(foodNutrients: Array<{ nutrientId: number; value: number }>) {
  const get = (id: number) => foodNutrients.find(n => n.nutrientId === id)?.value ?? 0;
  return {
    calories: Math.round(get(NID.energy)),
    protein:  Math.round(get(NID.protein) * 10) / 10,
    carbs:    Math.round(get(NID.carbs)   * 10) / 10,
    fat:      Math.round(get(NID.fat)     * 10) / 10,
  };
}

type USDAFood = { fdcId: number; description: string; foodNutrients: Array<{ nutrientId: number; value: number }> };

async function fetchUSDA(query: string, dataType: string, apiKey: string): Promise<USDAFood[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = new URL(`${USDA_BASE}/foods/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('dataType', dataType);
    url.searchParams.set('pageSize', '5');

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json() as { foods?: USDAFood[] };
    return data.foods ?? [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

/** Search USDA for a food item.
 *  Strategy: Foundation first (basic unprocessed foods), fall back to SR Legacy.
 *  Within each dataset, pick the candidate with the highest relevance score. */
export async function searchUSDA(query: string): Promise<USDAResult | null> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey || apiKey === 'DEMO_KEY' || !query.trim()) return null;

  try {
    // 1. Try Foundation first — most scientifically accurate, unprocessed ingredients
    let candidates = await fetchUSDA(query, 'Foundation', apiKey);

    // 2. Fall back to SR Legacy if Foundation has no results
    if (candidates.length === 0) {
      candidates = await fetchUSDA(query, 'SR Legacy', apiKey);
    }

    if (candidates.length === 0) return null;

    // 3. Pick the best-scoring candidate
    const best = candidates
      .map(f => ({ food: f, score: scoreFood(f.description, query) }))
      .sort((a, b) => b.score - a.score)[0].food;

    const per100g = extractNutrients(best.foodNutrients);

    // Sanity check: a food with 0 calories is a bad match → return null to use GPT estimate
    if (per100g.calories === 0) return null;

    console.log(`[USDA] "${query}" → "${best.description}" (${per100g.calories} kcal/100g)`);

    return {
      fdcId:       best.fdcId,
      matchedName: best.description,
      per100g,
    };
  } catch {
    return null;
  }
}

/** Scale per-100g values to actual portion weight */
export function scaleToGrams(result: USDAResult, grams: number): MacroBreakdown {
  const f = grams / 100;
  return {
    calories: Math.round(result.per100g.calories * f),
    protein:  Math.round(result.per100g.protein  * f * 10) / 10,
    carbs:    Math.round(result.per100g.carbs     * f * 10) / 10,
    fat:      Math.round(result.per100g.fat       * f * 10) / 10,
  };
}

/** Enrich an array of GPT-identified food items with USDA data where possible */
export async function enrichWithUSDA(
  items: Array<{
    nombre:          string;
    nombre_en:       string;
    cantidad_gramos: number;
    calorias:        number;
    proteina:        number;
    carbos:          number;
    grasa:           number;
  }>
): Promise<Array<{
  nombre:          string;
  nombre_en:       string;
  cantidad:        string;
  cantidad_gramos: number;
  calorias:        number;
  proteina:        number;
  carbos:          number;
  grasa:           number;
  source:          'usda' | 'estimate';
  usdaFood?:       string;
  fdcId?:          number;
}>> {
  const enriched = await Promise.all(
    items.map(async item => {
      const grams = item.cantidad_gramos || 100;
      const usdaResult = await searchUSDA(item.nombre_en || item.nombre);

      if (usdaResult) {
        const macros = scaleToGrams(usdaResult, grams);
        return {
          nombre:          item.nombre,
          nombre_en:       item.nombre_en,
          cantidad:        `${grams}g`,
          cantidad_gramos: grams,
          calorias:        macros.calories,
          proteina:        macros.protein,
          carbos:          macros.carbs,
          grasa:           macros.fat,
          source:          'usda' as const,
          usdaFood:        usdaResult.matchedName,
          fdcId:           usdaResult.fdcId,
        };
      }

      // Fallback: use GPT-4o estimate
      return {
        nombre:          item.nombre,
        nombre_en:       item.nombre_en,
        cantidad:        `${grams}g`,
        cantidad_gramos: grams,
        calorias:        item.calorias,
        proteina:        item.proteina,
        carbos:          item.carbos,
        grasa:           item.grasa,
        source:          'estimate' as const,
      };
    })
  );

  return enriched;
}

/** Sum macros from enriched items */
export function sumMacros(items: Array<{ calorias: number; proteina: number; carbos: number; grasa: number }>) {
  return items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calorias,
      protein:  acc.protein  + i.proteina,
      carbs:    acc.carbs    + i.carbos,
      fat:      acc.fat      + i.grasa,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
