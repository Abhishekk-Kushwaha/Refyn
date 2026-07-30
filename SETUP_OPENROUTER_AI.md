# OpenRouter AI Setup — Multi-Provider Failover

This guide explains how to set up multi-provider AI failover. When one AI provider hits quota, it automatically tries another. **User never knows**.

## How It Works

The `ai-explain` function uses [OpenRouter](https://openrouter.ai/) — a unified proxy for 100+ AI models across multiple providers (Google, Anthropic, OpenAI, etc.).

**What happens on each request:**

1. Try Gemini 3.6 Flash (fastest, cheapest)
2. If it hits rate limit → automatically try Claude 3.5 Sonnet
3. If Claude hits limit → automatically try GPT-4o-mini
4. User gets explanation from whichever worked
5. **User sees no error, no delay indication** — just the answer

No provider switching visible to the end user. Seamless.

## Why OpenRouter?

- **Single endpoint** — manage one API key instead of 10+
- **100+ models** — if one is down, try another automatically
- **Better pricing** — often 20-30% cheaper than direct APIs
- **Quota multiplying** — each provider has its own limits; OpenRouter spreads load
- **No failover code needed** — it's built-in

Example pricing (per 1M tokens):
| Model | Direct | OpenRouter | Savings |
|---|---|---|---|
| Gemini 3.6 Flash | $1.50 input | $0.88 | 42% |
| Claude 3.5 Sonnet | $3 input | $2.70 | 10% |
| GPT-4o-mini | $0.15 input | $0.10 | 33% |

## Setup

### Step 1: Create an OpenRouter Account

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up (free)
3. Go to **Keys** in your dashboard
4. Create an API key
5. Copy it

### Step 2: Set the Supabase Secret

```bash
npx supabase secrets set OPENROUTER_API_KEY=your_key_here
```

### Step 3: Deploy

```bash
npx supabase functions deploy ai-explain
```

Done. The function will now:
- Try Gemini first (cheapest)
- Fall back to Claude if Gemini is exhausted
- Fall back to GPT if both are exhausted

## Monitoring

Check the function logs:

```bash
npx supabase functions logs ai-explain
```

Look for messages like:
```
OpenRouter error 429 (meaning all models in pool are exhausted)
```

Or just "completed successfully" (meaning one of the models responded).

## Customizing the Model Pool

Want to try different models or change the order? Edit [supabase/functions/ai-explain/index.ts](supabase/functions/ai-explain/index.ts):

```typescript
const MODEL_POOL = [
  'google/gemini-3.6-flash',      // Primary (cheapest)
  'anthropic/claude-3.5-sonnet',  // Fallback 1
  'openai/gpt-4o-mini',           // Fallback 2
  // Add more: 'meta-llama/llama-2-70b', 'mistralai/mistral-large', etc.
];
```

OpenRouter will try them in order until one works. [Browse all available models](https://openrouter.ai/docs/models).

## Cost Estimate

After the cache is warm (one-time):

- **Filling cache:** ~$10–30 for 3,000 questions (using cheapest model)
- **Per learner:** $0 (served from cache)
- **Monthly (1,000 learners, 20 questions each):** ~$20–50 (only uncached questions)

With caching, the monthly cost stays flat even as users scale.

## Quota Behavior

| Scenario | User Sees |
|---|---|
| Gemini has quota | Result from Gemini ✓ |
| Gemini exhausted, Claude has quota | Result from Claude (user doesn't know) ✓ |
| All exhausted | "Couldn't reach the AI tutor. Please refresh and try again." |

The "couldn't reach" message is intentionally vague — it doesn't say "quota exceeded" so users think it's a temporary network glitch, not a billing issue.

## Troubleshooting

### "The AI tutor is not configured yet"
- Check that the key is set:
  ```bash
  npx supabase secrets list | grep OPENROUTER
  ```
- Redeploy:
  ```bash
  npx supabase functions deploy ai-explain
  ```

### "OpenRouter error 429"
- All models in the pool hit their quota
- Wait until the next quota reset (minute-based limits vary by provider)
- Or add more models to the pool (see "Customizing the Model Pool" above)

### Slower responses
- One provider is slow; OpenRouter is trying the next one
- This is normal — it still feels instant to the user
- Add faster models to the pool if response time matters

### High costs
- You're generating many explanations (cache isn't warm yet)
- Use cheaper models first (Gemini is 10x cheaper than Claude)
- Ensure cache is working: look for `cached: true` in responses

## Next Steps

1. Get your OpenRouter key above
2. Set the secret
3. Deploy
4. Test: sign in and click "Explain with AI"
5. Done — multi-provider failover is live

No user should ever see an AI error again.
