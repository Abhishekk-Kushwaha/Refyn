export interface AuthSession {
  user: {
    id: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  };
  isAuthenticated: boolean;
}

export interface OnboardingState {
  selectedExamId?: string;
  weakAreas: string[];
  dailyTarget?: number;
  isComplete: boolean;
}
