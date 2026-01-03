# Debugging 500 Error

## Current Situation

You're getting a 500 Internal Server Error when trying to use the AI feature.

## Possible Causes

1. **Stop sequences still have whitespace** (we just fixed this, might not be deployed)
2. **Model name issue** (we changed to `claude-sonnet-4-5`)
3. **Request size too large** (content-length: 2283)
4. **Streaming error**
5. **API key issue**

## How to Debug

### 1. Check Vercel Logs

Go to Vercel Dashboard:
1. https://vercel.com/dashboard
2. Select your project
3. Go to "Functions" tab
4. Click on `/api/generate`
5. View real-time logs

**Look for:**
```
=== AI API Error ===
Error message: [THE ERROR]
```

### 2. Test Locally

Run locally to see full error:
```bash
npm run dev
```

Then try the AI feature and check your terminal.

### 3. Check the Response Body

In browser DevTools Network tab:
1. Click on the failed request
2. Go to "Response" tab
3. See what error message is returned

Should show something like:
```
AI API error: [detailed error message]
```

### 4. Test with Simple Text

Try with very short text first:
```
Input: "test"
Option: "improve"
```

If this works, the issue is with longer text.

### 5. Check Which Provider is Being Used

Look at the request in Network tab:
- Is it trying to use Anthropic?
- Or falling back to OpenAI?

## Quick Fixes to Try

### Fix 1: Restart Vercel Deployment

The fixes might not be deployed yet:
```bash
# Push changes
git add .
git commit -m "fix: Update AI stop sequences and error logging"
git push origin main
```

### Fix 2: Test with OpenAI Only

In the test interface, select:
- Provider: "OpenAI (GPT-4o)"

This will bypass Claude and use OpenAI directly.

### Fix 3: Check API Keys

Make sure environment variables are set in Vercel:
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Check: `ANTHROPIC_API_KEY`
3. Check: `OPENAI_API_KEY`

## Most Likely Issue

Based on the timeline, the most likely issue is that **the stop sequences fix hasn't been deployed yet**.

The error is probably still:
```
stop_sequences: each stop sequence must contain non-whitespace
```

## Verify Fix is Deployed

Check if the latest code is deployed:
1. Look at Vercel deployments
2. Check the timestamp of the last deployment
3. Verify it includes the stop sequences fix

## Alternative: Use OpenAI Only (Temporary)

While debugging, you can temporarily force OpenAI:

Add this to the test:
```typescript
// Force OpenAI as provider
provider: 'openai'
```

This will bypass Claude entirely until the issue is resolved.

## Expected Logs

After the fix is deployed, you should see:
```
=== AI API Debug ===
Available providers: { hasOpenAI: true, hasAnthropic: true, ... }
Stop sequences: ['\n\nHere's', '\n\nHere is', ...]  // ← Should have text after newlines
AI Request: { temperature: 0.3, ... }
AI Response: { provider: 'anthropic', model: 'claude-sonnet-4-5' }
```

## Next Steps

1. **Check Vercel logs** - See the actual error message
2. **Verify deployment** - Make sure latest code is live
3. **Test with OpenAI** - Use as fallback while debugging
4. **Report back** - Share the error message from logs

