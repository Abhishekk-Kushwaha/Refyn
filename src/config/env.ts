export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
} as const;

export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
