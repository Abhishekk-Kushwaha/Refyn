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
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
};

export const handleError = (error: unknown, context?: string) => {
  const message = getErrorMessage(error);
  console.error(`[${context || 'Error'}]`, message, error);
  return message;
};
