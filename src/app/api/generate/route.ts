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

  const { prompt, option, command, provider, model } = await req.json();
  
  // Convert HTML to plain text intelligently (preserve structure)
  const htmlToPlainText = (html: string): string => {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Convert common HTML elements to text with structure
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<li>/gi, '• ');
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // Clean up excessive whitespace but preserve paragraph breaks
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
  };
  
  const cleanPrompt = htmlToPlainText(prompt);
  
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
          "You are a professional writing editor. Improve text while preserving meaning, tone, and intent.\n\n" +
          "Guidelines:\n" +
          "- Fix grammar, spelling, and punctuation\n" +
          "- Improve clarity and flow\n" +
          "- Enhance word choice naturally\n" +
          "- Keep the same length (unless unnecessarily wordy)\n" +
          "- Preserve the author's voice and style\n" +
          "- Do NOT change facts, numbers, or core message\n\n" +
          "Examples:\n" +
          "Input: 'hey can u send me that file'\n" +
          "Output: 'Hi, could you please send me that file?'\n\n" +
          "Input: 'i think we should do this thing'\n" +
          "Output: 'I think we should proceed with this.'\n\n" +
          "CRITICAL: Output ONLY the improved text. No explanations, no quotes, no prefixes like 'Here's' or 'Improved version:'.",
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
          "You are an AI writing assistant that fixes grammar and spelling errors in existing text. " +
          "Output ONLY the corrected text, nothing else. Do not include any explanations or prefacing.",
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
        return 0.4; // Slightly higher for more natural improvements
      case "fix":
        return 0.2; // Very low for grammar fixes (consistency)
      case "shorter":
      case "longer":
        return 0.5; // Balanced for length adjustments
      default:
        return 0.7; // Default for creative tasks
    }
  };

  // Prepare AI request
  const aiRequest = {
    messages,
    temperature: getTemperatureForTask(option),
    maxTokens: 4096,
    stop: option === "improve" || option === "fix" 
      ? ["\n\n---", "Here's", "Here is", "Improved version:", "Note:", "Here's the", "The improved"] 
      : undefined,
  };

  try {
    // Call AI provider with automatic fallback
    const aiResponse = await callAIProvider(option, aiRequest, provider, model);

    return new Response(aiResponse.stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-AI-Provider": aiResponse.provider,
        "X-AI-Model": aiResponse.model,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(`AI API error: ${errorMessage}`, { status: 500 });
  }
}
