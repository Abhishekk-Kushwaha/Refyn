-- ============================================================
-- REFYN — PASSWORD AUTH: Row Level Security Setup
-- Run this in the Supabase SQL Editor after enabling Email/Password auth
-- ============================================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role (if needed for admin operations) can do anything
CREATE POLICY "Service role can manage profiles"
  ON profiles FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- ============================================================
-- Enable RLS on user_exams table
-- ============================================================
ALTER TABLE user_exams ENABLE ROW LEVEL SECURITY;

-- Users can read their own exam records
CREATE POLICY "Users can read own exam records"
  ON user_exams FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own exam records
CREATE POLICY "Users can insert own exam records"
  ON user_exams FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own exam records
CREATE POLICY "Users can update own exam records"
  ON user_exams FOR UPDATE
  USING (user_id = auth.uid());
