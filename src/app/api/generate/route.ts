import { match } from "ts-pattern";
import { callAIProvider } from "@/lib/ai-providers";

// IMPORTANT! Set the runtime to edge: https://vercel.com/docs/functions/edge-functions/edge-runtime
export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {
  // Check if at least one API key is set
  const hasOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "";
  const hasAnthropic = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "";
  const hasGoogle = (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== "") || 
                    (process.env.GOOGLE_GEMINI_API_KEY && process.env.GOOGLE_GEMINI_API_KEY !== "");
  const hasCohere = process.env.COHERE_API_KEY && process.env.COHERE_API_KEY !== "";

  if (!hasOpenAI && !hasAnthropic && !hasGoogle && !hasCohere) {
    return new Response(
      "Missing AI API key. Please set at least one: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY (or GOOGLE_GEMINI_API_KEY), or COHERE_API_KEY",
      { status: 400 }
    );
  }

  const { prompt, option, command, provider, model, debug } = await req.json();
  
  // Debug logging
  if (debug) {
    console.log('=== AI API Debug ===');
    console.log('Available providers:', { hasOpenAI, hasAnthropic, hasGoogle, hasCohere });
    console.log('Request params:', { option, command, provider, model });
    console.log('Raw prompt length:', prompt?.length || 0);
    console.log('Raw prompt (first 200 chars):', prompt?.substring(0, 200));
  }
  
  // Unified text cleaner - handles both HTML and Markdown
  const cleanText = (input: string): string => {
    if (!input) return '';
    
    let text = input;
    
    // Step 1: Remove script/style tags (if HTML present)
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Step 2: Convert HTML elements to plain text
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<li>/gi, '• ');
    text = text.replace(/<[^>]*>/g, ''); // Remove all remaining HTML tags
    
    // Step 3: Clean Markdown formatting (prevent confusion)
    // Bold+Italic: ***text*** → text
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
    text = text.replace(/___(.+?)___/g, '$1');
    // Bold: **text** or __text__ → text
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');
    text = text.replace(/__(.+?)__/g, '$1');
    // Italic: *text* or _text_ → text
    text = text.replace(/\*([^*\n]+?)\*/g, '$1');
    text = text.replace(/_([^_\n]+?)_/g, '$1');
    // Strikethrough: ~~text~~ → text
    text = text.replace(/~~(.+?)~~/g, '$1');
    // Inline code: `text` → text
    text = text.replace(/`([^`]+)`/g, '$1');
    // Links: [text](url) → text
    text = text.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1');
    // Images: ![alt](url) → alt
    text = text.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1');
    // Headings: ## Heading → Heading
    text = text.replace(/^#{1,6}\s+/gm, '');
    // Blockquotes: > text → text
    text = text.replace(/^>\s*/gm, '');
    
    // Step 4: Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&apos;/g, "'");
    
    // Step 5: Clean up whitespace
    text = text.replace(/[ \t]+/g, ' '); // Multiple spaces → single space
    text = text.replace(/\n[ \t]+/g, '\n'); // Remove leading spaces on lines
    text = text.replace(/[ \t]+\n/g, '\n'); // Remove trailing spaces on lines
    text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
    
    return text.trim();
  };
  
  const cleanPrompt = cleanText(prompt);
  
  // Debug logging for text cleaning
  if (debug) {
    console.log('Cleaned prompt length:', cleanPrompt?.length || 0);
    console.log('Cleaned prompt:', cleanPrompt);
    console.log('Cleaning removed:', (prompt?.length || 0) - (cleanPrompt?.length || 0), 'characters');
  }
  
  const messages = match(option)
    .with("continue", () => [
      {
        role: "system" as const,
        content:
          "You are an AI writing assistant that continues existing text based on context from prior text. " +
          "Give more weight/priority to the later characters than the beginning ones. " +
          "Limit your response to no more than 200 characters, but make sure to construct complete sentences. " +
          "Output ONLY the continuation text, nothing else. Do not include any explanations or prefacing.",
      },
      {
        role: "user" as const,
        content: cleanPrompt,
      },
    ])
    .with("improve", () => [
      {
        role: "system" as const,
        content:
          "You are a professional writing editor. Improve the text while preserving meaning, tone, and intent.\n\n" +
          "RULES:\n" +
          "1. Fix grammar, spelling, and punctuation\n" +
          "2. Improve clarity and readability\n" +
          "3. Enhance word choice naturally\n" +
          "4. Keep similar length (unless the text is unnecessarily wordy)\n" +
          "5. Preserve the author's voice and style completely\n" +
          "6. Do NOT change facts, numbers, names, or key information\n\n" +
          "CRITICAL OUTPUT RULES:\n" +
          "- Output ONLY the improved text\n" +
          "- NO quotes around the output\n" +
          "- NO explanations, notes, or commentary\n" +
          "- NO prefixes like 'Here's', 'Improved version:', or 'Here is'\n" +
          "- Start directly with the first word of the improved text\n\n" +
          "Examples:\n" +
          "Input: hey can u send me that file\n" +
          "Output: Hi, could you please send me that file?\n\n" +
          "Input: i think we should do this thing\n" +
          "Output: I think we should proceed with this.",
      },
      {
        role: "user" as const,
        content: `Improve this text:\n\n${cleanPrompt}`,
      },
    ])
    .with("shorter", () => [
      {
        role: "system" as const,
        content:
          "You are an AI writing assistant that shortens existing text while preserving meaning. " +
          "Output ONLY the shortened text, nothing else. Do not include any explanations or prefacing.",
      },
      {
        role: "user" as const,
        content: cleanPrompt,
      },
    ])
    .with("longer", () => [
      {
        role: "system" as const,
        content:
          "You are an AI writing assistant that lengthens existing text by adding more detail and context. " +
          "Output ONLY the lengthened text, nothing else. Do not include any explanations or prefacing.",
      },
      {
        role: "user" as const,
        content: cleanPrompt,
      },
    ])
    .with("fix", () => [
      {
        role: "system" as const,
        content:
          "You are a grammar and spelling editor. Fix all grammatical and spelling errors.\n\n" +
          "RULES:\n" +
          "1. Correct all spelling mistakes\n" +
          "2. Fix grammatical errors (subject-verb agreement, tense, etc.)\n" +
          "3. Fix punctuation errors\n" +
          "4. Do NOT change the meaning or style\n" +
          "5. Do NOT rephrase unless grammatically incorrect\n\n" +
          "CRITICAL OUTPUT RULES:\n" +
          "- Output ONLY the corrected text\n" +
          "- NO explanations or notes\n" +
          "- NO prefixes like 'Here's' or 'Corrected:'\n" +
          "- Start directly with the corrected text",
      },
      {
        role: "user" as const,
        content: cleanPrompt,
      },
    ])
    .with("zap", () => [
      {
        role: "system" as const,
        content:
          "You are an AI writing assistant that generates or transforms text based on a command. " +
          "Output ONLY the resulting text, nothing else. Do not include any explanations or prefacing.",
      },
      {
        role: "user" as const,
        content: `Text: ${cleanPrompt}\n\nCommand: ${command}`,
      },
    ])
    .run();
  
  // Optimize temperature per task
  const getTemperatureForTask = (task: string): number => {
    switch (task) {
      case "improve":
        return 0.3; // Lower for more consistent improvements
      case "fix":
        return 0.1; // Very low for accuracy
      case "shorter":
        return 0.4;
      case "longer":
        return 0.5;
      case "continue":
        return 0.6;
      case "zap":
        return 0.7; // Higher for creative tasks
      default:
        return 0.5;
    }
  };

  // Enhanced stop sequences to prevent unwanted prefixes
  // NOTE: Anthropic requires each stop sequence to contain non-whitespace
  const getStopSequences = (task: string): string[] | undefined => {
    switch (task) {
      case "improve":
        return [
          "\n\nHere's",
          "\n\nHere is",
          "\n\nHere you go",
          "\n\nImproved version:",
          "\n\nImproved text:",
          "\n\nThe improved",
          "\n\nI've improved",
          "\n\nI improved",
          "\n\nNote:",
          "\n\nNote that",
          "\n---",
          "Here's the",
          "Here is the",
        ];
      case "fix":
        return [
          "\n\nHere's",
          "\n\nHere is",
          "\n\nFixed version:",
          "\n\nCorrected text:",
          "\n\nCorrected version:",
          "\n\nI've fixed",
          "\n\nI fixed",
          "\n---",
          "Here's the",
        ];
      case "shorter":
      case "longer":
        return [
          "\n\nHere's",
          "\n\nHere is",
          "\n---",
        ];
      case "continue":
        return [
          "\n\nHere's",
          "\n---",
        ];
      default:
        return undefined; // No stop sequences for other tasks
    }
  };

  // Prepare AI request
  const aiRequest = {
    messages,
    temperature: getTemperatureForTask(option),
    maxTokens: 4096,
    stop: getStopSequences(option),
  };

  try {
    // Debug logging before AI call
    if (debug) {
      console.log('AI Request:', {
        temperature: aiRequest.temperature,
        maxTokens: aiRequest.maxTokens,
        stopSequences: aiRequest.stop,
        messageCount: aiRequest.messages.length,
      });
      console.log('System prompt:', aiRequest.messages[0]?.content.substring(0, 200));
    }
    
    // Call AI provider with automatic fallback
    const aiResponse = await callAIProvider(option, aiRequest, provider, model);

    if (debug) {
      console.log('AI Response:', {
        provider: aiResponse.provider,
        model: aiResponse.model,
      });
    }

    return new Response(aiResponse.stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-AI-Provider": aiResponse.provider,
        "X-AI-Model": aiResponse.model,
        "X-Debug": debug ? "true" : "false",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error('AI API Error:', errorMessage);
    if (debug) {
      console.error('Full error:', error);
    }
    return new Response(`AI API error: ${errorMessage}`, { status: 500 });
  }
}
