# AI Feature Audit Report - Email Composer

## Current Issues Identified

### 1. **Model Selection**
- **Current**: Using `gpt-4o-mini` (budget model)
- **Problem**: Lower quality outputs, especially for text improvement tasks
- **Impact**: Weird, repetitive, or contextually incorrect responses

### 2. **Text Extraction & Context Loss**
- **Current**: Using `editor.storage.markdown.serializer.serialize()` 
- **Problem**: 
  - Loses formatting context
  - May not preserve sentence boundaries
  - No surrounding context provided to AI
- **Impact**: AI doesn't understand full context, produces disconnected improvements

### 3. **HTML Stripping**
- **Current**: Aggressively strips ALL HTML tags: `prompt.replace(/<[^>]*>/g, '')`
- **Problem**: 
  - Loses semantic structure (paragraphs, line breaks)
  - Removes emphasis markers
  - No way to preserve formatting hints
- **Impact**: AI receives flat text without structure understanding

### 4. **Prompt Engineering**
- **Current**: Generic prompts without examples
- **Problem**:
  - No few-shot examples
  - Vague instructions
  - No output format specification
- **Impact**: Model guesses what you want, leading to inconsistent results

### 5. **Temperature Settings**
- **Current**: 0.3 for improve/fix, 0.7 for others
- **Problem**: 
  - 0.3 might be too low, causing repetitive patterns
  - No task-specific tuning
- **Impact**: Overly conservative or too creative outputs

### 6. **Missing Stop Sequences**
- **Current**: No stop sequences defined
- **Problem**: Model might add unwanted explanations or continue beyond intended text
- **Impact**: Extra text appended to responses

### 7. **Streaming Response Handling**
- **Current**: Basic SSE parsing
- **Problem**: 
  - No error recovery
  - May cut off mid-sentence
  - No validation of complete responses
- **Impact**: Incomplete or malformed outputs

---

## 4 Recommended Approaches

### **Approach 1: Upgrade Model + Enhanced Prompts (Quick Win)**
**Priority**: High | **Effort**: Low | **Impact**: Medium-High

**Changes**:
1. Upgrade to `gpt-4o` (better quality) or `gpt-4-turbo` (balanced)
2. Add few-shot examples to prompts
3. Add stop sequences
4. Improve prompt specificity

**Implementation**:
```typescript
// Better model
model: "gpt-4o", // or "gpt-4-turbo-preview"

// Enhanced improve prompt with examples
content: `You are an expert writing editor. Improve the following text while preserving meaning and tone.

Examples:
Input: "hey can u send me that file"
Output: "Hi, could you please send me that file?"

Input: "i think we should do this thing"
Output: "I think we should proceed with this."

Now improve this text:
${cleanPrompt}

Output ONLY the improved text, nothing else.`
```

**Pros**: Quick to implement, immediate quality improvement
**Cons**: Higher API costs, still has context issues

---

### **Approach 2: Better Text Extraction + Context Preservation (Recommended)**
**Priority**: High | **Effort**: Medium | **Impact**: High

**Changes**:
1. Extract text with surrounding context (previous/next sentences)
2. Preserve paragraph structure
3. Use plain text extraction instead of markdown serialization
4. Include formatting hints

**Implementation**:
```typescript
// Better text extraction
const getTextWithContext = (editor: EditorInstance, selection: Selection) => {
  const { from, to } = selection;
  
  // Get selected text
  const selectedText = editor.state.doc.textBetween(from, to);
  
  // Get context (50 chars before and after)
  const contextBefore = editor.state.doc.textBetween(
    Math.max(0, from - 50), 
    from
  );
  const contextAfter = editor.state.doc.textBetween(
    to, 
    Math.min(editor.state.doc.content.size, to + 50)
  );
  
  // Preserve paragraph structure
  const paragraphBreaks = selectedText.split('\n').length > 1;
  
  return {
    text: selectedText,
    contextBefore: contextBefore.trim(),
    contextAfter: contextAfter.trim(),
    hasParagraphs: paragraphBreaks
  };
};

// Enhanced prompt with context
content: `You are improving text in an email. Here's the context:

Previous text: "${contextBefore}"
Text to improve: "${text}"
Following text: "${contextAfter}"

Improve the "Text to improve" section while maintaining flow with surrounding context.`
```

**Pros**: Preserves context, better understanding
**Cons**: More complex implementation

---

### **Approach 3: Structured Output + Validation (Advanced)**
**Priority**: Medium | **Effort**: High | **Impact**: Very High

**Changes**:
1. Use structured output (JSON mode) for consistent format
2. Add response validation
3. Implement retry logic for malformed responses
4. Add confidence scoring

**Implementation**:
```typescript
// Use JSON mode with schema
body: JSON.stringify({
  model: "gpt-4o",
  messages: messages,
  response_format: { type: "json_object" },
  // ... rest
})

// Prompt with JSON schema
content: `Return a JSON object with:
{
  "improved_text": "the improved version",
  "changes_made": ["list of changes"],
  "confidence": 0.95
}

Text to improve: ${cleanPrompt}`
```

**Pros**: Consistent format, validatable, reliable
**Cons**: Complex, requires schema management

---

### **Approach 4: Hybrid Model Selection + Fallback (Production-Ready)**
**Priority**: Medium | **Effort**: Medium | **Impact**: High

**Changes**:
1. Use different models for different tasks
2. Implement fallback chain (gpt-4o → gpt-4o-mini)
3. Add response quality checks
4. Cache common improvements

**Implementation**:
```typescript
const getModelForTask = (option: string) => {
  const modelMap = {
    improve: "gpt-4o",      // Best quality for improvement
    fix: "gpt-4o",           // Best for grammar
    shorter: "gpt-4o-mini",  // Cheaper for simple tasks
    longer: "gpt-4o-mini",
    continue: "gpt-4o-mini",
    zap: "gpt-4o"            // Custom commands need quality
  };
  return modelMap[option] || "gpt-4o-mini";
};

// With fallback
try {
  response = await fetch(/* with primary model */);
} catch (error) {
  response = await fetch(/* with fallback model */);
}
```

**Pros**: Cost-effective, quality where needed, resilient
**Cons**: More complex routing logic

---

## Recommended Implementation Plan

### Phase 1 (Immediate - This Week)
1. ✅ **Upgrade model** to `gpt-4o` for improve/fix tasks
2. ✅ **Add stop sequences** to prevent extra text
3. ✅ **Improve prompts** with examples and clearer instructions
4. ✅ **Better text extraction** with context preservation

### Phase 2 (Next Week)
1. ✅ **Implement Approach 2** - Better context extraction
2. ✅ **Add response validation** - Check for complete sentences
3. ✅ **Error handling** - Retry on failures

### Phase 3 (Future)
1. ✅ **Consider Approach 3** - Structured outputs if needed
2. ✅ **Implement Approach 4** - Hybrid model selection
3. ✅ **Add caching** for common improvements

---

## Specific Code Fixes Needed

### Fix 1: Better Text Extraction
```typescript
// Replace markdown serialization with plain text + context
const getTextForAI = (editor: EditorInstance) => {
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to);
  
  // Get surrounding context
  const contextBefore = editor.state.doc.textBetween(
    Math.max(0, from - 100), from
  );
  const contextAfter = editor.state.doc.textBetween(
    to, Math.min(editor.state.doc.content.size, to + 100)
  );
  
  return {
    text: text.trim(),
    context: {
      before: contextBefore.trim().slice(-50), // Last 50 chars
      after: contextAfter.trim().slice(0, 50)  // First 50 chars
    }
  };
};
```

### Fix 2: Enhanced Prompts
```typescript
.with("improve", () => [
  {
    role: "system" as const,
    content: `You are a professional writing editor. Your task is to improve text while:
- Preserving the original meaning and intent
- Maintaining the author's tone and style
- Fixing grammar, spelling, and awkward phrasing
- Improving clarity and flow
- Keeping approximately the same length

CRITICAL: Output ONLY the improved text. No explanations, no quotes, no prefixes like "Here's" or "Improved version:".`
  },
  {
    role: "user" as const,
    content: `Context before: "${contextBefore || '(start of document)'}"
Text to improve: "${text}"
Context after: "${contextAfter || '(end of document)'}"

Improve the "Text to improve" section.`
  }
])
```

### Fix 3: Add Stop Sequences
```typescript
body: JSON.stringify({
  model: "gpt-4o",
  messages: messages,
  max_tokens: 4096,
  temperature: 0.4, // Slightly higher for better variety
  stop: ["\n\n---", "Here's", "Here is", "Improved version:", "Note:"], // Stop at common prefixes
  stream: true,
})
```

### Fix 4: Better HTML Handling
```typescript
// Instead of stripping all HTML, convert to plain text intelligently
const htmlToPlainText = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Preserve paragraph breaks
  doc.querySelectorAll('p, br').forEach(el => {
    if (el.tagName === 'BR') {
      el.replaceWith('\n');
    } else {
      el.replaceWith(el.textContent + '\n\n');
    }
  });
  
  // Remove other tags but keep text
  return doc.body.textContent || '';
};
```

---

## Testing Checklist

- [ ] Test "Improve writing" with various text types
- [ ] Test "Fix grammar" with common errors
- [ ] Test "Make shorter" with long paragraphs
- [ ] Test "Make longer" with short sentences
- [ ] Test with email signatures present
- [ ] Test with HTML content
- [ ] Test with empty selections
- [ ] Test streaming completion
- [ ] Test error handling
- [ ] Test response validation

---

## Expected Improvements

After implementing these fixes:
- ✅ More natural, contextually appropriate improvements
- ✅ Better preservation of original meaning
- ✅ Fewer weird or repetitive responses
- ✅ More consistent output quality
- ✅ Better handling of edge cases

