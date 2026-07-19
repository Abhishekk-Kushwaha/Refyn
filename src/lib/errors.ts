export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'PAYMENT_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public userMessage: string,
    public originalError?: unknown
  ) {
    super(userMessage);
    this.name = 'AppError';
  }
}

export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

export const getErrorMessage = (error: unknown): string => {
  if (isAppError(error)) {
    return error.userMessage;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  // Supabase/PostgREST errors are plain objects, not Error instances, and their
  // text can sit under any of several keys — without this they stringify to "{}"
  // and the real failure never reaches the user.
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    for (const key of ['message', 'msg', 'error_description', 'error', 'details', 'hint']) {
      const value = e[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  if (typeof error === 'string' && error.trim()) return error;
  return 'Something went wrong';
};

export const handleError = (error: unknown, context?: string) => {
  const message = getErrorMessage(error);
  console.error(`[${context || 'Error'}]`, message, error);
  return message;
};
