export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  // Endpoint that returns AI solution explanations. Empty until the model is
  // wired up — the review screen's "Explain with AI" button stays in its
  // coming-soon state while this is blank. See services/ai.service.ts.
  aiExplainUrl: import.meta.env.VITE_AI_EXPLAIN_URL ?? '',
} as const;

export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
