export type Theme = 'dark' | 'light';

export type ExamSlug = 'cat' | 'ssc-cgl' | 'gmat' | 'gre';

export interface Exam {
  id: string;
  name: string;
  slug: ExamSlug;
  description?: string;
  is_active: boolean;
  display_order?: number;
}

export interface Section {
  id: string;
  exam_id: string;
  name: string;
  slug: string;
  display_order?: number;
}

export interface Topic {
  id: string;
  section_id: string;
  name: string;
  slug: string;
  topic_weight: number;
  display_order?: number;
}

export interface Subtopic {
  id: string;
  topic_id: string;
  name: string;
  slug: string;
  concept_code: string;
  primary_concept?: string;
  secondary_concept?: string;
  frequency_band?: 'low' | 'medium' | 'high' | 'very_high';
  priority_band?: 'low' | 'medium' | 'high' | 'very_high';
  frequency_weight?: number;
  display_order?: number;
}

export interface Question {
  id: string;
  exam_id: string;
  subtopic_id: string;
  external_id: string;
  year?: number;
  slot?: string;
  source?: string;
  is_pyq?: boolean;
  question_text: string;
  question_type: 'mcq' | 'tita';
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer: string;
  solution?: string;
  alternate_solution?: string;
  difficulty?: number;
  calculation_level?: 'low' | 'medium' | 'high';
  logic_level?: 'low' | 'medium' | 'high';
  expected_time_seconds?: number;
  primary_concept?: string;
  secondary_concept?: string;
  common_mistakes?: string;
}

export interface UserProfile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  is_pro: boolean;
  pro_expires_at?: string;
  theme_preference: Theme;
  onboarding_complete: boolean;
  created_at: string;
}

export interface UserExam {
  id: string;
  user_id: string;
  exam_id: string;
  attempt_year?: number;
  daily_target: number;
  streak: number;
  last_practice_date?: string;
  is_primary: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  exam_id: string;
  mode: 'weakness' | 'mock' | 'topic';
  subtopic_id?: string;
  total_questions: number;
  correct_count?: number;
  accuracy?: number;
  avg_time_seconds?: number;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface Attempt {
  id: string;
  user_id: string;
  session_id: string;
  question_id: string;
  subtopic_id: string;
  selected_answer?: string;
  is_correct: boolean;
  time_taken_seconds?: number;
  attempted_at: string;
}

export interface ConceptMastery {
  id: string;
  user_id: string;
  exam_id: string;
  subtopic_id: string;
  attempts_count: number;
  correct_count: number;
  incorrect_count: number;
  accuracy: number;
  consecutive_correct: number;
  consecutive_incorrect: number;
  mastery_score: number;
  priority_weight?: number;
  expected_score_gain?: number;
  status: 'unattempted' | 'learning' | 'weak' | 'very_weak' | 'improving' | 'mastered' | 'old_weakness';
  last_attempt_at?: string;
  last_updated: string;
}

export interface Doubt {
  id: string;
  user_id: string;
  exam_id: string;
  subtopic_id?: string;
  title: string;
  body?: string;
  image_url?: string;
  answer_count: number;
  is_resolved: boolean;
  created_at: string;
}

export interface Flashcard {
  id: string;
  subtopic_id: string;
  front: string;
  back_formula?: string;
  back_explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  years_appeared?: number[];
  display_order?: number;
}

export interface UserFlashcard {
  user_id: string;
  flashcard_id: string;
  mastery: 'new' | 'learning' | 'reviewing' | 'mastered';
  review_count: number;
  ease_factor: number;
  interval_days: number;
  next_review_at?: string;
  last_reviewed_at?: string;
}
