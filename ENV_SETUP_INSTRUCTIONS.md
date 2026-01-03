# Environment Variables Setup

## Add to `.env.local`

Add the following API key to your `.env.local` file:

```bash
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

## Complete `.env.local` Example

Your `.env.local` should include:

```bash
# OpenAI (required for basic functionality)
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic/Claude (for best quality - ADD THIS)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Optional: Google/Gemini
# GOOGLE_API_KEY=your-google-key-here

# Optional: Cohere (you may already have this)
# COHERE_API_KEY=your-cohere-key-here
```

## After Adding

1. **Restart your dev server** for changes to take effect
2. **Test the AI features** - they should now use Claude 3.5 Sonnet for "improve" tasks
3. **Check the response headers** - you'll see `X-AI-Provider: anthropic` when Claude is used

## Verification

The system will automatically:
- ✅ Detect the ANTHROPIC_API_KEY
- ✅ Use Claude 3.5 Sonnet for "improve" tasks (best quality)
- ✅ Fall back to GPT-4o if Claude is unavailable
- ✅ Show which provider was used in response headers

