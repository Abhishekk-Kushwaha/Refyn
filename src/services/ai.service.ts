import { MockQuestion } from '@/lib/mockQuestions';
import { AppError } from '@/lib/errors';
import { env } from '@/config/env';

// AI solution explanations for post-quiz review.
//
// The UI (SolutionCard "Explain with AI") is fully built and calls through here
// today. Nothing is wired to a model yet: isAiExplainerConfigured() is false
// until VITE_AI_EXPLAIN_URL points at the explain endpoint, and the button
// renders in a "coming soon" state instead of firing a request.
//
// To switch it on, set VITE_AI_EXPLAIN_URL and make the endpoint accept the
// AiExplainRequest body below and return { explanation: string }. No component
// changes needed.

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

  try {
    const response = await fetch(env.aiExplainUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new AppError('NETWORK_ERROR', "Couldn't reach the AI tutor. Please try again.");
    }

    const data = (await response.json()) as Partial<AiExplanation>;
    if (!data.explanation) {
      throw new AppError('UNKNOWN', 'The AI tutor returned an empty explanation.');
    }

    return { explanation: data.explanation };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('NETWORK_ERROR', "Couldn't reach the AI tutor. Please try again.", e);
  }
};
