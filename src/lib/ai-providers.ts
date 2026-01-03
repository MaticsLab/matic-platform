/**
 * AI Provider API Handlers
 * Handles API calls to different AI providers with unified interface
 */

import { getRecommendedModel, findModel, type ModelProvider, type ModelConfig } from './ai-models';

export interface AIRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature: number;
  maxTokens: number;
  stop?: string[];
}

export interface AIResponse {
  stream: ReadableStream<Uint8Array>;
  provider: ModelProvider;
  model: string;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(config: ModelConfig, request: AIRequest): Promise<AIResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelId,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stop: request.stop,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  // Transform OpenAI SSE stream to plain text
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk);
      const lines = text.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      }
    },
  });

  return {
    stream: response.body!.pipeThrough(transformStream),
    provider: 'openai',
    model: config.modelId,
  };
}

/**
 * Call Anthropic (Claude) API
 */
async function callAnthropic(config: ModelConfig, request: AIRequest): Promise<AIResponse> {
  // Convert messages format for Anthropic (they don't use 'system' role in messages array)
  const systemMessage = request.messages.find(m => m.role === 'system');
  const conversationMessages = request.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.modelId,
      messages: conversationMessages,
      system: systemMessage?.content || '',
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stop_sequences: request.stop || [],
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Anthropic API Error Response:', {
      status: response.status,
      statusText: response.statusText,
      body: error,
      model: config.modelId,
    });
    throw new Error(`Anthropic API error: ${error}`);
  }

  // Transform Anthropic SSE stream
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  let buffer = '';

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      buffer += text;
      
      const lines = buffer.split('\n');
      // Keep the last partial line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'event: ping') continue;
        
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const json = JSON.parse(data);
            
            // Log for debugging
            if (process.env.NODE_ENV !== 'production') {
              console.log('Anthropic stream event:', json.type);
            }
            
            // Handle different event types
            if (json.type === 'content_block_delta' && json.delta?.text) {
              controller.enqueue(encoder.encode(json.delta.text));
            } else if (json.type === 'content_block_start' && json.content_block?.text) {
              controller.enqueue(encoder.encode(json.content_block.text));
            }
          } catch (e) {
            // Log parse errors in dev
            if (process.env.NODE_ENV !== 'production') {
              console.error('Failed to parse Anthropic stream data:', data, e);
            }
          }
        }
      }
    },
    flush(controller) {
      // Process any remaining data in buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta' && json.delta?.text) {
              controller.enqueue(encoder.encode(json.delta.text));
            }
          } catch {
            // Ignore
          }
        }
      }
    }
  });

  return {
    stream: response.body!.pipeThrough(transformStream),
    provider: 'anthropic',
    model: config.modelId,
  };
}

/**
 * Call Google (Gemini) API
 */
async function callGoogle(config: ModelConfig, request: AIRequest): Promise<AIResponse> {
  // Convert messages format for Gemini
  const contents = request.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

  const systemInstruction = request.messages.find(m => m.role === 'system')?.content;

  // Build request body
  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
    },
  };

  // Add system instruction if present
  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  // Add stop sequences if present
  if (request.stop && request.stop.length > 0) {
    requestBody.generationConfig.stopSequences = request.stop;
  }

  const response = await fetch(
    `${config.baseUrl}/models/${config.modelId}:streamGenerateContent?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API error: ${error}`);
  }

  // Transform Google stream (Gemini uses Server-Sent Events)
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk);
      const lines = text.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          try {
            const json = JSON.parse(data);
            // Gemini stream format
            const candidates = json.candidates || (Array.isArray(json) ? json[0]?.candidates : null);
            if (candidates?.[0]?.content?.parts) {
              for (const part of candidates[0].content.parts) {
                if (part.text) {
                  controller.enqueue(encoder.encode(part.text));
                }
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    },
  });

  return {
    stream: response.body!.pipeThrough(transformStream),
    provider: 'google',
    model: config.modelId,
  };
}

/**
 * Call Cohere API
 */
async function callCohere(config: ModelConfig, request: AIRequest): Promise<AIResponse> {
  // Convert messages format for Cohere (they use chat_history format)
  const systemMessage = request.messages.find(m => m.role === 'system');
  const chatHistory = request.messages
    .filter(m => m.role !== 'system' && m.role !== 'user')
    .map(m => ({
      role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
      message: m.content,
    }));

  const lastUserMessage = request.messages
    .filter(m => m.role === 'user')
    .slice(-1)[0]?.content || '';

  const response = await fetch(`${config.baseUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelId,
      message: lastUserMessage,
      chat_history: chatHistory,
      preamble: systemMessage?.content || '',
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stop_sequences: request.stop || [],
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cohere API error: ${error}`);
  }

  // Transform Cohere stream (Cohere uses SSE format)
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk);
      const lines = text.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          try {
            const json = JSON.parse(data);
            // Cohere stream format - check for text in various event types
            if (json.event_type === 'text-generation' && json.text) {
              controller.enqueue(encoder.encode(json.text));
            } else if (json.delta?.text) {
              controller.enqueue(encoder.encode(json.delta.text));
            } else if (json.text) {
              controller.enqueue(encoder.encode(json.text));
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    },
  });

  return {
    stream: response.body!.pipeThrough(transformStream),
    provider: 'cohere',
    model: config.modelId,
  };
}

/**
 * Call AI provider with automatic fallback
 */
export async function callAIProvider(
  task: string,
  request: AIRequest,
  preferredProvider?: ModelProvider,
  preferredModel?: string
): Promise<AIResponse> {
  // Get recommended model
  const recommendation = getRecommendedModel(task, true);
  
  // Determine which provider/model to use
  let provider: ModelProvider = preferredProvider || recommendation.provider;
  let modelId: string = preferredModel || recommendation.model;

  // Try to find the model config
  let config = findModel(provider, modelId);

  // If not found, try fallback chain
  if (!config) {
    const fallbacks: Array<{ provider: ModelProvider; model: string }> = [
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'anthropic', model: 'claude-sonnet-4-5' },
      { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
      { provider: 'google', model: 'gemini-1.5-pro' },
      { provider: 'cohere', model: 'command-r-plus' },
    ];

    for (const fallback of fallbacks) {
      config = findModel(fallback.provider, fallback.model);
      if (config) {
        provider = fallback.provider;
        modelId = fallback.model;
        break;
      }
    }
  }

  if (!config) {
    throw new Error('No AI provider available. Please set at least one API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or COHERE_API_KEY)');
  }

  // Call the appropriate provider
  switch (config.provider) {
    case 'openai':
      return callOpenAI(config, request);
    case 'anthropic':
      return callAnthropic(config, request);
    case 'google':
      return callGoogle(config, request);
    case 'cohere':
      return callCohere(config, request);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

