# API Keys Checklist for Multi-Model AI Support

## Required API Keys

You need **at least one** of the following API keys to use the AI features. The system will automatically use the best available model.

### ✅ OpenAI (Recommended for Speed)
**Environment Variable:** `OPENAI_API_KEY`

**How to Get:**
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

**Models Available:**
- GPT-4o (best balance)
- GPT-4o Mini (budget option)

**Cost:** ~$2.50-$10 per 1M tokens

**Status:** ✅ **REQUIRED** (currently used as default)

---

### ✅ Anthropic/Claude (Recommended for Quality)
**Environment Variable:** `ANTHROPIC_API_KEY`

**How to Get:**
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-`)

**Models Available:**
- Claude 3.5 Sonnet (best quality for editing)
- Claude 3 Opus (premium)
- Claude 3 Haiku (budget)

**Cost:** ~$3-$15 per 1M tokens

**Status:** ⚠️ **OPTIONAL** (but recommended for best quality)

---

### ✅ Google/Gemini (Recommended for Long Context)
**Environment Variable:** `GOOGLE_API_KEY`

**How to Get:**
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

**Models Available:**
- Gemini 1.5 Pro (long context)
- Gemini 1.5 Flash (fast)

**Cost:** ~$1.25-$5 per 1M tokens

**Status:** ⚠️ **OPTIONAL** (good for long documents)

---

### ✅ Cohere (Recommended for Enterprise)
**Environment Variable:** `COHERE_API_KEY`

**How to Get:**
1. Go to https://dashboard.cohere.com/
2. Sign up or log in
3. Navigate to API Keys
4. Click "Create API Key"
5. Copy the key

**Models Available:**
- Command R+ (enterprise)
- Command R (budget)

**Cost:** ~$3-$15 per 1M tokens

**Status:** ⚠️ **OPTIONAL** (already used in backend for embeddings)

**Note:** You already have Cohere set up in your Go backend (`go-backend/config/config.go`), so you can reuse the same key!

---

## Setup Instructions

### 1. Add to `.env` file (root directory)

```bash
# At minimum, add OpenAI (recommended)
OPENAI_API_KEY=sk-your-key-here

# Optional: Add Anthropic for best quality
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional: Add Google for long context
GOOGLE_API_KEY=your-google-key-here

# Optional: Add Cohere (you may already have this)
COHERE_API_KEY=your-cohere-key-here
```

### 2. For Vercel/Production

Add the same environment variables in your Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each key with the same names

### 3. Verify Setup

The system will automatically:
- ✅ Check which API keys are available
- ✅ Select the best model for each task
- ✅ Fall back to available models if preferred is unavailable
- ✅ Show error if no keys are set

---

## Current Status Check

Run this to see which providers are available:

```bash
# Check if keys are set (won't show values for security)
echo "OpenAI: ${OPENAI_API_KEY:+✅ Set}" 
echo "Anthropic: ${ANTHROPIC_API_KEY:+✅ Set}"
echo "Google: ${GOOGLE_API_KEY:+✅ Set}"
echo "Cohere: ${COHERE_API_KEY:+✅ Set}"
```

---

## Recommended Setup

### Minimum (Budget-Friendly)
```bash
OPENAI_API_KEY=sk-...
```
- Uses GPT-4o and GPT-4o Mini
- Fast and cost-effective
- Good quality

### Recommended (Best Quality)
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```
- Uses Claude 3.5 Sonnet for "improve" (best quality)
- Falls back to GPT-4o for speed
- Best of both worlds

### Full Setup (All Providers)
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
COHERE_API_KEY=...
```
- Maximum flexibility
- Automatic best model selection
- Full fallback chain

---

## Cost Comparison

| Provider | Model | Input (1M) | Output (1M) | Best For |
|----------|-------|------------|-------------|----------|
| OpenAI | GPT-4o | $2.50 | $10.00 | Speed + Quality |
| OpenAI | GPT-4o Mini | $0.15 | $0.60 | Budget |
| Anthropic | Claude 3.5 Sonnet | $3.00 | $15.00 | **Best Quality** |
| Anthropic | Claude 3 Haiku | $0.25 | $1.25 | Budget Claude |
| Google | Gemini 1.5 Pro | $1.25 | $5.00 | Long Context |
| Google | Gemini 1.5 Flash | $0.075 | $0.30 | Budget |
| Cohere | Command R+ | $3.00 | $15.00 | Enterprise |

---

## Troubleshooting

### "No AI provider available"
- ✅ Check that at least one API key is set
- ✅ Verify keys are valid (not expired)
- ✅ Restart your dev server after adding keys

### Provider-specific errors

**OpenAI:**
- Check key starts with `sk-`
- Verify account has credits

**Anthropic:**
- Check key starts with `sk-ant-`
- Verify account is active

**Google:**
- Enable Generative AI API in Google Cloud Console
- Check API key has correct permissions

**Cohere:**
- Verify key is valid
- Check account status

---

## Security Notes

- ⚠️ **Never commit API keys to git**
- ✅ Add `.env` to `.gitignore`
- ✅ Use environment variables in production
- ✅ Rotate keys periodically
- ✅ Use different keys for dev/prod if possible

