import { match } from "ts-pattern";

// IMPORTANT! Set the runtime to edge: https://vercel.com/docs/functions/edge-functions/edge-runtime
export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {
  // Check if the OPENAI_API_KEY is set, if not return 400
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "") {
    return new Response("Missing OPENAI_API_KEY - make sure to add it to your .env file.", {
      status: 400,
    });
  }

  const { prompt, option, command } = await req.json();
  
  // Strip HTML tags from prompt to get clean text
  const cleanPrompt = prompt.replace(/<[^>]*>/g, '').trim();
  
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
          "You are an AI writing assistant that improves existing text while preserving the original meaning and tone. " +
          "Improve the text by: enhancing clarity and readability, fixing awkward phrasing, improving word choice, " +
          "ensuring proper grammar and flow, and making it more professional and polished. " +
          "Do NOT change the core message, facts, or intent. Keep the same length unless the original is unnecessarily wordy. " +
          "Output ONLY the improved text, nothing else. Do not include any explanations, prefacing, or phrases like 'Here is' or 'Here's the improved version'. " +
          "Do not wrap the output in quotes or any markup. Return the text exactly as it should appear.",
      },
      {
        role: "user" as const,
        content: `Improve the following text:\n\n${cleanPrompt}`,
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

  // Call OpenAI API directly with streaming
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 4096,
      temperature: option === "improve" || option === "fix" ? 0.3 : 0.7, // Lower temperature for improvement/fixing tasks
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return new Response(`OpenAI API error: ${error}`, { status: response.status });
  }

  // Transform the OpenAI SSE stream to plain text stream for useCompletion
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk);
      const lines = text.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return;
          }
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          } catch {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    },
  });

  return new Response(response.body?.pipeThrough(transformStream), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
