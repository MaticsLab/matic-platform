# Complete AI Feature Audit & Unified Solution

## Date: January 3, 2026

## Executive Summary

After a complete audit of all AI features, I identified several issues causing "bad responses":

### Issues Found:

1. **Input Format Mismatch**: Novel editor sends Markdown, but API expects HTML
2. **Incomplete Text Cleaning**: Markdown formatting not being cleaned properly
3. **Inconsistent Stop Sequences**: Not preventing unwanted AI prefixes
4. **Temperature Settings**: May be too high for some tasks
5. **Model Deprecation**: Claude 3.5 Sonnet deprecated (already fixed)

---

## Architecture

### Current Flow:

```
Novel Editor (Cover Sections, Email Composer)
  ↓ (serializes to Markdown)
  ↓ editor.storage.markdown.serializer.serialize()
  ↓
AI Selector (ai-selector.tsx)
  ↓ (sends as 'prompt' parameter)
  ↓
API Route (/api/generate)
  ↓ (tries to clean as HTML - MISMATCH!)
  ↓ htmlToPlainText()  ← THIS IS THE PROBLEM
  ↓
AI Providers (OpenAI, Claude, Gemini, Cohere)
  ↓
Streamed Response
```

### The Problem:

**In `ai-selector-commands.tsx:45`:**
```typescript
const text = editor.storage.markdown.serializer.serialize(slice.content);
// Sends markdown like: **bold** text, _italic_, etc.
```

**In `src/app/api/generate/route.ts:24-53`:**
```typescript
const htmlToPlainText = (html: string): string => {
  // Expects HTML: <b>bold</b>, <i>italic</i>
  // But receives Markdown: **bold**, _italic_
  // Doesn't clean it properly!
}
```

---

## Solution: Unified Text Cleaner

### 1. Smart Text Cleaning (handles both HTML and Markdown)

```typescript
const cleanText = (input: string): string => {
  let text = input;
  
  // Step 1: Remove script/style tags (if HTML)
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Step 2: Convert HTML elements to plain text
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li>/gi, '• ');
  text = text.replace(/<[^>]*>/g, '');
  
  // Step 3: Clean Markdown formatting (NEW!)
  // Remove bold/italic markers that might confuse AI
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1'); // Bold+Italic
  text = text.replace(/\*\*(.+?)\*\*/g, '$1'); // Bold
  text = text.replace(/\*(.+?)\*/g, '$1'); // Italic
  text = text.replace(/__(.+?)__/g, '$1'); // Bold (alternative)
  text = text.replace(/_(.+?)_/g, '$1'); // Italic (alternative)
  text = text.replace(/~~(.+?)~~/g, '$1'); // Strikethrough
  text = text.replace(/`(.+?)`/g, '$1'); // Inline code
  
  // Clean markdown links: [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // Clean markdown headings: ## Heading → Heading
  text = text.replace(/^#{1,6}\s+/gm, '');
  
  // Step 4: Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Step 5: Clean up whitespace
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to one
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  text = text.replace(/^\s+|\s+$/gm, ''); // Trim each line
  
  return text.trim();
};
```

### 2. Enhanced Stop Sequences

Add more stop sequences to prevent unwanted prefixes:

```typescript
const stopSequences = {
  improve: [
    "\n\n---",
    "Here's",
    "Here is",
    "Improved version:",
    "Improved text:",
    "Note:",
    "Here's the",
    "The improved",
    "I've improved",
    "I improved",
    "Here you go",
  ],
  fix: [
    "\n\n---",
    "Here's",
    "Fixed version:",
    "Corrected text:",
    "I've fixed",
  ],
  all: [
    "\n\n\n", // Triple newline
  ],
};
```

### 3. Optimized Temperatures

```typescript
const temperatures = {
  improve: 0.3, // Lower for consistency
  fix: 0.1,     // Very low for accuracy
  shorter: 0.4,
  longer: 0.5,
  continue: 0.6,
  zap: 0.7,
};
```

### 4. Enhanced Prompts

**Improve Prompt (Updated):**
```
You are a professional writing editor. Improve the text while preserving meaning, tone, and intent.

RULES:
1. Fix grammar, spelling, and punctuation
2. Improve clarity and readability
3. Enhance word choice naturally
4. Keep similar length (unless wordy)
5. Preserve the author's voice completely
6. Do NOT change facts, numbers, or key information

CRITICAL OUTPUT RULES:
- Output ONLY the improved text
- No quotes around the output
- No explanations or notes
- No prefixes like "Here's" or "Improved version:"
- Start directly with the improved text

Examples:
Input: "hey can u send me that file"
Output: Hi, could you please send me that file?

Input: "i think we should do this thing"
Output: I think we should proceed with this.
```

---

## Files to Update:

1. `src/app/api/generate/route.ts` - Fix text cleaning
2. Add better stop sequences
3. Adjust temperatures
4. Improve prompts

---

## Testing Checklist:

- [ ] Test "Improve writing" with plain text
- [ ] Test "Improve writing" with bold/italic text
- [ ] Test "Fix grammar" with errors
- [ ] Test "Make shorter/longer"
- [ ] Test "Continue writing"
- [ ] Test custom commands (zap)
- [ ] Test with HTML input (email composer)
- [ ] Test with Markdown input (cover editor)
- [ ] Verify no unwanted prefixes in output
- [ ] Verify proper text cleaning

---

## Implementation Priority:

1. **CRITICAL**: Fix text cleaning (handle Markdown)
2. **HIGH**: Add enhanced stop sequences
3. **MEDIUM**: Adjust temperatures
4. **LOW**: Minor prompt improvements

