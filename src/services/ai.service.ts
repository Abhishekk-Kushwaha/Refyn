import { MockQuestion } from '@/lib/mockQuestions';
import { AppError } from '@/lib/errors';
import { env } from '@/config/env';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';

// AI solution explanations for post-quiz review.
//
// The UI (SolutionCard "Explain with AI") calls through here. Requests go to
// VITE_AI_EXPLAIN_URL — the ai-explain Supabase Edge Function, which holds the
// model API key server-side and returns { explanation: string }. The key is
// deliberately not a VITE_ variable: those are compiled into the browser
// bundle, where anyone could read it. See supabase/functions/ai-explain.
//
// With the URL unset, isAiExplainerConfigured() is false and the button stays
// in its coming-soon state instead of firing a request.

export interface AiExplainRequest {
  questionId: string;
  questionText: string;
  questionType: 'mcq' | 'tita';
  options?: { a: string; b: string; c: string; d: string };
  correctAnswer: string;
  /** null when the learner skipped the question */
  userAnswer: string | null;
  isCorrect: boolean;
  subtopicName: string;
  topicName: string;
  /** The authored solution, when one exists — the model expands on it rather than re-deriving. */
  authoredSolution?: string;
}

export interface AiExplanation {
  /** Markdown-ish plain text; rendered as paragraphs. */
  explanation: string;
}

/** True once an explain endpoint is configured — gates the AI button's live behaviour. */
export const isAiExplainerConfigured = (): boolean => Boolean(env.aiExplainUrl);

/** Shown wherever the AI is offered to someone without a real account. */
export const AI_SIGN_IN_MESSAGE =
  'Sign in to see the AI explanation. The written solution above is still available.';

/**
 * The caller's Supabase access token, or null when nobody is really signed in.
 * Demo/explore sessions land here as null: they are a local flag, not a real
 * Supabase session, so they have no token to send.
 */
const getAccessToken = async (): Promise<string | null> => {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
};

export const buildExplainRequest = (
  question: MockQuestion,
  userAnswer: string | null,
  isCorrect: boolean
): AiExplainRequest => ({
  questionId: question.id,
  questionText: question.questionText,
  questionType: question.questionType,
  options: question.options,
  correctAnswer: question.correctAnswer,
  userAnswer,
  isCorrect,
  subtopicName: question.subtopicName,
  topicName: question.topicName,
  authoredSolution: question.solution || undefined,
});

/**
 * Ask the AI to explain a question. Throws an AppError with a user-safe message
 * while no endpoint is configured, so the caller can surface it as-is.
 */
export const explainQuestion = async (request: AiExplainRequest): Promise<AiExplanation> => {
  if (!isAiExplainerConfigured()) {
    throw new AppError(
      'NOT_FOUND',
      'AI explanations are coming soon. The written solution is available below.'
    );
  }

  // The endpoint verifies the caller's JWT, so quota can only be spent by
  // signed-in learners rather than by anyone who finds the URL. Check for the
  // token here rather than sending the request without one: an anonymous call
  // can only ever come back 401, and the generic failure it produced read like
  // the AI itself was down.
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new AppError('AUTH_ERROR', AI_SIGN_IN_MESSAGE);
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabaseAnonKey,
    };

    const response = await fetch(env.aiExplainUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const data = (await response.json().catch(() => ({}))) as Partial<AiExplanation> & {
      error?: string;
    };

    if (!response.ok) {
      if (response.status === 401) {
        throw new AppError('AUTH_ERROR', 'Please sign in again to use AI explanations.');
      }
      // The endpoint sends a learner-safe message; fall back if it didn't.
      throw new AppError(
        'NETWORK_ERROR',
        data.error || "Couldn't reach the AI tutor. Please try again."
      );
    }

    if (!data.explanation) {
      throw new AppError('UNKNOWN', 'The AI tutor returned an empty explanation.');
    }

    return { explanation: data.explanation };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('NETWORK_ERROR', "Couldn't reach the AI tutor. Please try again.", e);
  }
};
