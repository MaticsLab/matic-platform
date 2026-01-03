# AI Testing Guide

## Quick Start

I've created a comprehensive testing system. Here's how to use it:

---

## 1. Test Interface (Easiest)

**URL:** `http://localhost:3000/test-ai` (or `https://www.maticsapp.com/test-ai` on production)

### Features:
- ✅ Test all AI tasks (improve, fix, shorter, longer)
- ✅ Test with different providers (OpenAI, Claude, Gemini, Cohere)
- ✅ See debug information (provider, model, response time)
- ✅ Quality checks (no prefixes, no markdown artifacts)
- ✅ Pre-loaded test cases

### How to Use:
1. Navigate to `/test-ai`
2. Enter text or select a test case
3. Choose a task (improve, fix, etc.)
4. Optionally select a specific provider
5. Click "Test AI"
6. Review output and quality checks

### Example Test Cases:
- **Casual text:** `hey can u send me that file`
- **With markdown:** `**this is important** and needs work`
- **Grammar errors:** `their going too the store`
- **With links:** `[click here](https://example.com) for more`

---

## 2. Test from Email Composer/Cover Editor

### Enable Debug Mode:

**In Browser Console:**
```javascript
// Enable debug mode
window.__AI_DEBUG__ = true;

// Now use the AI feature normally - it will log everything
```

### What Gets Logged:
```
=== AI Selector Debug ===
Selected option: improve
Editor selection: {from: 0, to: 25}
Serialized text (Markdown): **bold** text here
Text length: 22

=== AI Completion Debug ===
Prompt sent: **bold** text here
Completion received: Bold text here
```

### Steps:
1. Open browser DevTools Console (F12)
2. Run: `window.__AI_DEBUG__ = true`
3. Open email composer or cover editor
4. Type some text
5. Highlight it and use AI (Cmd/Ctrl + Space)
6. Check console for detailed logs

---

## 3. Server-Side Debug Logs

### Enable in API:

The API now has built-in debug mode. When you use the test interface or set `debug: true` in the request, you'll see:

```
=== AI API Debug ===
Available providers: { hasOpenAI: true, hasAnthropic: true, hasGoogle: false, hasCohere: false }
Request params: { option: 'improve', command: undefined, provider: undefined, model: undefined }
Raw prompt length: 45
Raw prompt (first 200 chars): **this is important** and needs work
Cleaned prompt length: 35
Cleaned prompt: this is important and needs work
Cleaning removed: 10 characters
AI Request: {
  temperature: 0.3,
  maxTokens: 4096,
  stopSequences: ['Here's', 'Here is', ...],
  messageCount: 2
}
System prompt: You are a professional writing editor. Improve the text while preserving meaning...
AI Response: {
  provider: 'openai',
  model: 'gpt-4o-mini'
}
```

### View Logs:

**Local Development:**
```bash
# Your terminal where you ran `npm run dev` will show all logs
```

**Production (Vercel):**
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Functions" tab
4. Click on the `/api/generate` function
5. View real-time logs

---

## 4. What to Look For

### ✅ Good Response:
```
Input: "hey can u send me that file"
Output: "Hi, could you please send me that file?"

Checks:
✅ No "Here's" prefix
✅ No quotes around output
✅ No markdown artifacts (**bold**)
✅ Clean, direct text
```

### ❌ Bad Response:
```
Input: "hey can u send me that file"
Output: "Here's the improved version: 'Hi, could you please send me that file?'"

Issues:
❌ Has "Here's" prefix
❌ Has quotes
❌ Includes explanatory text
```

---

## 5. Testing Checklist

Use this checklist when testing:

### Text Cleaning:
- [ ] Test with markdown bold: `**text**` → should remove `**`
- [ ] Test with markdown italic: `_text_` → should remove `_`
- [ ] Test with links: `[text](url)` → should show just "text"
- [ ] Test with HTML: `<b>text</b>` → should remove tags

### AI Quality:
- [ ] No "Here's" or "Here is" prefix
- [ ] No quotes around output
- [ ] No "Improved version:" or similar
- [ ] Output starts directly with improved text
- [ ] Preserves meaning and tone

### Provider Testing:
- [ ] Test with OpenAI (should work)
- [ ] Test with Claude (may fallback to OpenAI)
- [ ] Test auto-selection (should pick best available)
- [ ] Verify correct model in headers

### Tasks:
- [ ] "Improve writing" - enhances text
- [ ] "Fix grammar" - only fixes errors, doesn't rephrase
- [ ] "Make shorter" - condenses text
- [ ] "Make longer" - adds detail

---

## 6. Common Issues & Solutions

### Issue: "Bad responses" still happening

**Check:**
1. Is debug mode enabled? See what's being sent
2. Check server logs - is text being cleaned?
3. Which provider/model is being used?
4. Are stop sequences working?

**Solution:**
- Run test interface to isolate the issue
- Check if it's input cleaning or AI response
- Try different providers

### Issue: Using wrong model

**Check:**
- Look at response headers: `X-AI-Provider`, `X-AI-Model`
- Check which API keys are set

**Solution:**
- Verify `.env.local` has correct keys
- Try forcing a specific provider in test interface

### Issue: Markdown not being cleaned

**Check:**
- Look at server logs: "Raw prompt" vs "Cleaned prompt"
- Should show characters removed

**Solution:**
- If not cleaning, there's a bug in `cleanText()`
- Check the diff between raw and cleaned

---

## 7. Quick Test Commands

### Browser Console:
```javascript
// Enable debug
window.__AI_DEBUG__ = true;

// Test AI API directly
fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: '**bold** text to improve',
    option: 'improve',
    debug: true
  })
}).then(r => r.text()).then(console.log);

// Check what headers are returned
fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'test',
    option: 'improve',
  })
}).then(r => {
  console.log('Provider:', r.headers.get('X-AI-Provider'));
  console.log('Model:', r.headers.get('X-AI-Model'));
  return r.text();
}).then(console.log);
```

---

## 8. Expected Results

### Test Case 1: Casual Text
**Input:** `hey can u send me that file`
**Expected:** `Hi, could you please send me that file?`
**Provider:** Any (OpenAI, Claude, etc.)

### Test Case 2: Markdown Bold
**Input:** `**this is important** and needs work`
**Expected:** `This is important and needs work.`
**Note:** `**` should be removed during cleaning

### Test Case 3: Grammar Fix
**Input:** `their going too the store`
**Expected:** `They're going to the store.`
**Note:** Should fix only, not rephrase

### Test Case 4: Mixed Markdown
**Input:** `_italic text_ that should be **improved**`
**Expected:** `Italic text that should be improved.`
**Note:** All markdown removed and improved

---

## Need Help?

1. **Check server logs** - Most issues show up here
2. **Use test interface** - Isolated environment
3. **Enable browser debug** - See what editor sends
4. **Compare raw vs cleaned** - Verify text cleaning works

---

## Success Criteria

Your AI is working correctly when:
- ✅ Text cleaning removes all markdown/HTML
- ✅ No unwanted prefixes in responses
- ✅ Output is natural and direct
- ✅ Quality checks pass in test interface
- ✅ All providers work (or fallback correctly)

---

Ready to test! 🚀

