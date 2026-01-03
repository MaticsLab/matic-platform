/**
 * AI Model Provider Configuration
 * Supports multiple AI providers: OpenAI, Anthropic (Claude), Google (Gemini), Cohere
 */

export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'cohere';

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  costPer1MInput?: number;
  costPer1MOutput?: number;
}

export interface ModelRecommendation {
  model: string;
  provider: ModelProvider;
  reason: string;
  quality: 'high' | 'medium' | 'low';
  speed: 'fast' | 'medium' | 'slow';
  cost: 'low' | 'medium' | 'high';
}

/**
 * Model recommendations by task type
 */
export const getRecommendedModel = (task: string, preferQuality: boolean = true): ModelRecommendation => {
  switch (task) {
    case 'improve':
      if (preferQuality) {
        return {
          model: 'claude-3-5-sonnet-20241022',
          provider: 'anthropic',
          reason: 'Best quality for professional writing improvements',
          quality: 'high',
          speed: 'medium',
          cost: 'high',
        };
      }
      return {
        model: 'gpt-4o',
        provider: 'openai',
        reason: 'Best balance of quality and speed',
        quality: 'high',
        speed: 'fast',
        cost: 'medium',
      };
    
    case 'fix':
      return {
        model: 'gpt-4o',
        provider: 'openai',
        reason: 'Fast and accurate for grammar fixes',
        quality: 'high',
        speed: 'fast',
        cost: 'medium',
      };
    
    case 'shorter':
    case 'longer':
      return {
        model: 'gpt-4o',
        provider: 'openai',
        reason: 'Fast and reliable for length adjustments',
        quality: 'high',
        speed: 'fast',
        cost: 'medium',
      };
    
    case 'continue':
      return {
        model: 'gpt-4o',
        provider: 'openai',
        reason: 'Fast continuation with good context',
        quality: 'high',
        speed: 'fast',
        cost: 'medium',
      };
    
    default:
      return {
        model: 'gpt-4o-mini',
        provider: 'openai',
        reason: 'Default budget option',
        quality: 'medium',
        speed: 'fast',
        cost: 'low',
      };
  }
};

/**
 * Get available models based on environment variables
 * Edge Runtime compatible - uses process.env directly
 */
export const getAvailableModels = (): ModelConfig[] => {
  const models: ModelConfig[] = [];

  // OpenAI Models
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey !== '') {
    models.push(
      {
        provider: 'openai',
        modelId: 'gpt-4o',
        displayName: 'GPT-4o',
        apiKey: openaiKey,
        baseUrl: 'https://api.openai.com/v1',
        maxTokens: 4096,
        temperature: 0.4,
        costPer1MInput: 2.50,
        costPer1MOutput: 10.00,
      },
      {
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        apiKey: openaiKey,
        baseUrl: 'https://api.openai.com/v1',
        maxTokens: 4096,
        temperature: 0.4,
        costPer1MInput: 0.15,
        costPer1MOutput: 0.60,
      }
    );
  }

  // Anthropic (Claude) Models
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey !== '') {
    models.push(
      {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        apiKey: anthropicKey,
        baseUrl: 'https://api.anthropic.com/v1',
        maxTokens: 4096,
        temperature: 0.4,
        costPer1MInput: 3.00,
        costPer1MOutput: 15.00,
      },
      {
        provider: 'anthropic',
        modelId: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        apiKey: anthropicKey,
        baseUrl: 'https://api.anthropic.com/v1',
        maxTokens: 4096,
        temperature: 0.4,
        costPer1MInput: 15.00,
        costPer1MOutput: 75.00,
      },
      {
        provider: 'anthropic',
        modelId: 'claude-3-haiku-20240307',
        displayName: 'Claude 3 Haiku',
        apiKey: anthropicKey,
        baseUrl: 'https://api.anthropic.com/v1',
        maxTokens: 4096,
        temperature: 0.4,
        costPer1MInput: 0.25,
        costPer1MOutput: 1.25,
      }
    );
  }

  // Google (Gemini) Models - support both GOOGLE_API_KEY and GOOGLE_GEMINI_API_KEY
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (googleKey && googleKey !== '') {
    models.push(
      {
        provider: 'google',
        modelId: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        apiKey: googleKey,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: 4096,
        temperature: 0.4,
        costPer1MInput: 1.25,
        costPer1MOutput: 5.00,
      },
      {
        provider: 'google',
        modelId: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        apiKey: googleKey,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: 4096,
        temperature: 0.4,
        costPer1MInput: 0.075,
        costPer1MOutput: 0.30,
      }
    );
  }

  // Cohere Models
  const cohereKey = process.env.COHERE_API_KEY;
  if (cohereKey && cohereKey !== '') {
    models.push(
      {
        provider: 'cohere',
        modelId: 'command-r-plus',
        displayName: 'Cohere Command R+',
        apiKey: cohereKey,
        baseUrl: 'https://api.cohere.com/v2',
        maxTokens: 4096,
        temperature: 0.4,
        costPer1MInput: 3.00,
        costPer1MOutput: 15.00,
      },
      {
        provider: 'cohere',
        modelId: 'command-r',
        displayName: 'Cohere Command R',
        apiKey: cohereKey,
        baseUrl: 'https://api.cohere.com/v2',
        maxTokens: 4096,
        temperature: 0.4,
        costPer1MInput: 0.50,
        costPer1MOutput: 1.50,
      }
    );
  }

  return models;
};

/**
 * Find model config by provider and model ID
 */
export const findModel = (provider: ModelProvider, modelId: string): ModelConfig | null => {
  const models = getAvailableModels();
  return models.find(m => m.provider === provider && m.modelId === modelId) || null;
};

