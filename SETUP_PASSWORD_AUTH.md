# Supabase Password Authentication Setup

This guide explains how to configure Supabase for password-based authentication (replacing OTP).

## Prerequisites
- Supabase project created
- Database schema set up (run `SQL/master_setup.sql` + `SQL/phase1_fix_auth_trigger.sql`)
- Environment variables configured (`.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`)

## Backend Configuration (Supabase Console)

### Step 1: Enable Email/Password Provider

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Email** provider
4. Toggle on "Email/Password Authentication"
5. Leave other email options as default or configure to your preference:
   - "Confirm email" - Set to your preference (can disable for faster dev)
   - Email templates - Can customize later

### Step 2: Verify Database Schema

The following should already exist (from SQL scripts):

```sql
-- User profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Step 3: Enable Row Level Security (RLS)

Run this SQL in Supabase SQL Editor to add RLS policies:

```sql
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
```

## Frontend Implementation

The frontend is already configured:
- `LoginView.tsx` - Unified email/password form with toggle between Sign In and Sign Up
- `AuthStore.ts` - Calls Supabase's `signInWithPassword()` and `signUp()` methods
- Session management - Handled by Supabase client (auto-refresh, cross-device sync)

## Testing Locally

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local (copy from .env.example)
cp .env.example .env.local
# Add your Supabase credentials

# 3. Start dev server
npm run dev

# 4. Open http://localhost:5173
# You should see the login screen with email + password fields
```

## How It Works

1. **Sign Up:**
   - User enters email + password
   - Frontend calls `AuthStore.signup(email, password)`
   - Supabase Auth creates user account with hashed password
   - Trigger automatically creates user profile
   - Session is established

2. **Sign In:**
   - User enters email + password
   - Frontend calls `AuthStore.login(email, password)`
   - Supabase Auth verifies credentials
   - Session token is returned and stored locally
   - Token auto-refreshes before expiry

3. **Cross-Device Sync:**
   - Session token is persisted in browser storage
   - Token is sent with each request to Supabase
   - Supabase validates token and returns user data
   - Auto-refresh prevents token expiry

## Database Schema

Key tables involved:

| Table | Purpose |
|-------|---------|
| `auth.users` | Supabase Auth (email, password hash, created_at) |
| `profiles` | User metadata (display_name, avatar_url, preferences) |
| `user_exams` | User's exam progress and stats |

## Security Notes

- Password hashing: Handled by Supabase (bcrypt)
- Session tokens: Secured HTTPOnly cookies (on production)
- RLS policies: Enforce user-level data access
- Environment keys: Anon key is safe in browser (RLS is the security boundary)

## Troubleshooting

### "Supabase is not configured"
- Ensure `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server after adding env vars

### "Database error saving new user"
- This was a known issue, fixed by `SQL/phase1_fix_auth_trigger.sql`
- If you see this, ensure that SQL file was run

### Password reset / Account recovery
- Set up email templates in Supabase → Authentication → Email Templates
- Users can reset password via password recovery link

## Next Steps

1. Configure email provider in Supabase (step 1 above)
2. Run the .env setup and start dev server
3. Test signup/login flows
4. (Optional) Configure email verification and password recovery templates
