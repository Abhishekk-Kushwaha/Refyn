export const env = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
} as const;

export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
