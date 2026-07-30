# Gemini API Multi-Key Setup Guide

This guide explains how to set up multiple Gemini API keys to multiply your free tier quota.

## Why Multiple Keys?

Each Google Cloud project gets its own free tier quota:
- **Gemini Flash-Lite:** 1,000 requests/day
- **Gemini Flash:** 250 requests/day

With N keys, you get N × that quota. The `ai-explain` function automatically rotates between them.

## Prerequisites

- Multiple Google Cloud projects (free to create)
- Gemini API enabled in each project
- One API key per project

## Step 1: Create Google Cloud Projects

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project for each key you want
   - Project name: `refyn-ai-key-1`, `refyn-ai-key-2`, etc.
3. For each project:
   - Enable the **Generative Language API**
   - Go to **APIs & Services** → **Credentials**
   - Create an **API Key** (not OAuth)
   - Copy the key value

## Step 2: Configure Supabase Secrets

Choose **one** of these approaches. The function tries them in order.

### Option A: Comma-Separated List (Simplest)

Best for a small number of keys (2-5).

```bash
npx supabase secrets set GEMINI_API_KEYS="key1,key2,key3"
```

**To add more keys later:**
```bash
npx supabase secrets set GEMINI_API_KEYS="key1,key2,key3,key4,key5"
```

### Option B: Numbered Keys (Cleanest)

Best for many keys or frequent updates.

```bash
npx supabase secrets set \
  GEMINI_API_KEY_1=key1 \
  GEMINI_API_KEY_2=key2 \
  GEMINI_API_KEY_3=key3
```

**To add more keys later:**
```bash
npx supabase secrets set GEMINI_API_KEY_4=key4
```

The function reads keys in order (KEY_1, KEY_2, …, KEY_N) and stops at the first missing one.

### Option C: Single Key (Legacy)

If you have only one key and don't plan to scale:

```bash
npx supabase secrets set GEMINI_API_KEY=key1
```

## Step 3: Deploy

```bash
npx supabase functions deploy ai-explain
```

The function will auto-detect your keys and rotate between them on each request.

## Monitoring

Check the function logs to see which key is being used:

```bash
npx supabase functions logs ai-explain
```

Look for messages like:
```
[using key #2/5]
```

This tells you that key #2 out of 5 was used.

## Scaling Example

| Keys | Daily Requests | Questions to Cache | Concurrent Users |
|------|---|---|---|
| 1 | 1,000 | 3,000 (3 days) | ~10-50 |
| 3 | 3,000 | 1 day | ~30-150 |
| 5 | 5,000 | ~2 hours | ~50-250 |
| 10 | 10,000 | ~30 min | ~100-500 |

**The cache is what matters:** After the question bank is warm, you're serving free cache hits. Multiple keys mainly help fill the cache faster and handle traffic spikes.

## Quota Exhaustion

When all keys hit their daily quota (429 error from Gemini):
- The function returns: *"The AI tutor is busy right now. Please try again in a moment."*
- Users can retry after the quota resets (midnight Pacific Time)
- The cache serves free hits regardless

## Troubleshooting

### "The AI tutor is not configured yet"
- Check that at least one key is set:
  ```bash
  npx supabase secrets list | grep GEMINI
  ```
- If keys are set, redeploy the function:
  ```bash
  npx supabase functions deploy ai-explain
  ```

### "Using key #X/Y" doesn't match the number of keys I set
- The function stopped loading keys at the first gap (for numbered keys)
- Ensure your numbering is sequential (KEY_1, KEY_2, KEY_3, not KEY_1, KEY_3)

### One key keeps failing
- It may have hit its daily quota early
- Check the key's limit in Google Cloud Console → Quotas & System Limits
- Temporarily remove it with:
  ```bash
  npx supabase secrets unset GEMINI_API_KEY_2
  ```
- (For numbered keys, you'll need to re-set the rest without that key)

## Cost Estimate

After the cache is warm (one-time cost):
- **Per question:** ~$0.003–0.01 first-time generation (cached forever after)
- **Total cache:** ~$15–50 to fill a 3,000-question bank
- **Per learner:** $0 (served from cache)

With 5 free keys:
- Fill cache: 2 hours of traffic
- Serve 1,000+ learners free thereafter

## Next Steps

1. Create 3–5 Google Cloud projects
2. Generate one API key per project
3. Set `GEMINI_API_KEYS` or numbered keys above
4. Deploy the function
5. Test with: `curl ... -X POST .../ai-explain`
