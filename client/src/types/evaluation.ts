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
